/**
 * @module diff-utils
 * @description Diff parsing and Azure DevOps utility functions
 * Extracted from extension.js during Phase 5 refactoring.
 */

import * as vscode from 'vscode';
import * as _https from 'https';
import * as path from 'path';
import * as fs from 'fs';
import { toError } from '../core/error-utils';
// import { aidaLogging } from '../core/settings';

/**
 * Setup Azure DevOps settings automatically
 */
async function setupAzureDevOpsSettings() {
    try {
        // Open User Settings JSON
        await vscode.commands.executeCommand('workbench.action.openSettingsJson');

        // Show info message with instructions
        const settingsTemplate = `{
    "aida.azureDevOps.personalAccessToken": "YOUR_TOKEN_HERE"
}`;

        const action = await vscode.window.showInformationMessage(
            'Settings JSON opened. Only token needed - organization and project will be auto-detected from PR URL.',
            'Copy Template',
            'Open Azure DevOps'
        );

        if (action === 'Copy Template') {
            await vscode.env.clipboard.writeText(settingsTemplate);
            vscode.window.showInformationMessage('Template dï¿½ copy vï¿½o clipboard!');
        } else if (action === 'Open Azure DevOps') {
            await vscode.env.openExternal(vscode.Uri.parse('https://dev.azure.com/BusinessWebUS/_usersSettings/tokens'));
        }

    } catch (_error: unknown) {
        const error = toError(_error);
        vscode.window.showErrorMessage(`Error opening settings: ${error.message}`);
    }
}

/**
 * Parse diff content to reconstruct full file content for both sides
 * ENHANCED VERSION: For cross-repo PR reviews - reconstructs content directly from diff
 * @param {string} diff - Git diff content
 * @param {string} filePath - Path to the file being diffed
 * @returns {object} - { originalLines: [], modifiedLines: [] }
 */
async function parseFullDiffContentEnhanced(diff: string, filePath: string, provider?: string) {
    console.log('?? parseFullDiffContentEnhanced - FULL FILE CONTENT mode for:', filePath);

    // For non-Azure providers (github/gitlab/bitbucket), never take the Azure
    // full-content path. The Azure branch relies on GLOBAL cache credentials
    // (accessToken/sourceCommit/targetCommit) that can leak across providers and
    // produce identical original/modified sides. Reconstruct straight from diff.
    const normalizedProvider = (provider || '').toLowerCase();
    const isAzureProvider = normalizedProvider === 'azure' || normalizedProvider === 'azure_devops' || normalizedProvider === 'azuredevops';
    if (provider && !isAzureProvider) {
        console.log('?? Non-Azure provider (' + provider + ') - reconstructing directly from diff');
        return await reconstructFromDiffFallback(diff, filePath);
    }

    // Check if we have Azure DevOps cache data for full file content retrieval
    const cache = global.prDiffCache;

    console.log('?? prDiffCache exists:', !!cache);
    if (cache) {
        console.log('?? Cache keys (first 10):', Object.keys(cache).filter(k => !k.startsWith('content_')).slice(0, 10));
        console.log('?? Cache has global properties:', {
            hasAccessToken: !!(cache as any).accessToken,
            hasOrganization: !!(cache as any).organization,
            hasProject: !!(cache as any).project,
            hasRepository: !!(cache as any).repository,
            hasSourceCommit: !!(cache as any).sourceCommit,
            hasTargetCommit: !!(cache as any).targetCommit,
            organization: (cache as any).organization,
            project: (cache as any).project,
            repository: (cache as any).repository,
            sourceCommit: (cache as any).sourceCommit?.substring(0, 7),
            targetCommit: (cache as any).targetCommit?.substring(0, 7)
        });
    }

    if (cache && (cache as any).accessToken && (cache as any).sourceCommit && (cache as any).targetCommit) {
        console.log('? Azure DevOps cache available - fetching FULL FILE CONTENT');
        return await getFullFileContentFromAzureDevOps(filePath, diff);
    } else {
        console.log('?? No Azure DevOps cache - falling back to diff reconstruction');
        console.log('?? Attempting DIRECT Azure DevOps detection from diff content...');

        // Try to detect Azure DevOps info from diff and fetch full content anyway
        const azureInfo = detectAzureDevOpsFromDiff(diff);
        if (azureInfo && azureInfo.organization) {
            console.log('?? Detected Azure DevOps info from diff:', azureInfo);
            return await getFullContentWithDetectedInfo(filePath, diff, azureInfo as Record<string, string>);
        }

        return await reconstructFromDiffFallback(diff, filePath);
    }
}

/**
 * Detect Azure DevOps info from diff content
 */
function detectAzureDevOpsFromDiff(diff: string) {
    // Look for Azure DevOps patterns in diff
    const orgMatch = diff.match(/dev\.azure\.com\/([^\/]+)/);
    const projectMatch = diff.match(/\/_git\/([^\/]+)/);

    if (orgMatch && projectMatch) {
        return {
            organization: orgMatch[1],
            project: projectMatch[1],
            repository: projectMatch[1] // Assume same as project for now
        };
    }

    // Check if this looks like Azure DevOps based on diff format
    if (diff.includes('BusinessWebUS') || diff.includes('Shippo')) {
        return {
            organization: 'BusinessWebUS',
            project: 'Shippo',
            repository: 'Shippo-Web'
        };
    }

    return null;
}

/**
 * Get full content using detected Azure DevOps info
 */
async function getFullContentWithDetectedInfo(filePath: string, diff: string, azureInfo: Record<string, string>) {
    console.log('?? Attempting to fetch full content with detected info...');

    // Try to get access token from vscode settings or prompt user
    const config = vscode.workspace.getConfiguration('aida');
    const accessToken = config.get('azureDevOps.personalAccessToken');

    if (!accessToken) {
        console.log('? No Azure DevOps token available in settings');
        return await reconstructFromDiffFallback(diff, filePath);
    }

    // Extract commit info from diff if possible
    const commits = extractCommitsFromDiff(diff);
    if (!commits.sourceCommit || !commits.targetCommit) {
        console.log('? Could not extract commit info from diff');
        return await reconstructFromDiffFallback(diff, filePath);
    }

    console.log('? Detected commits:', commits);

    try {
        // Import and use getFileContent if available
        const reviewPrPath = path.join(__dirname, 'review-pr.js');
        if (fs.existsSync(reviewPrPath)) {
            const reviewPrModule = require(reviewPrPath);
            const getFileContent = reviewPrModule.getFileContent;

            if (typeof getFileContent === 'function') {
                // ?? FIX: Commit terminology - need to swap for correct Monaco display
                // commits.sourceCommit = NEW code = Monaco "modified" (RIGHT)
                // commits.targetCommit = OLD code = Monaco "original" (LEFT)
                const [targetContent, sourceContent] = await Promise.all([
                    getFileContent(azureInfo.organization, azureInfo.project, azureInfo.repository, filePath, commits.targetCommit, accessToken), // OLD = original = LEFT
                    getFileContent(azureInfo.organization, azureInfo.project, azureInfo.repository, filePath, commits.sourceCommit, accessToken)  // NEW = modified = RIGHT
                ]);

                if (targetContent || sourceContent) {
                    console.log(`? SUCCESS: Got full content - Original (OLD): ${targetContent ? targetContent.length : 0}, Modified (NEW): ${sourceContent ? sourceContent.length : 0}`);

                    // Convert to format using the enhanced logic
                    return convertFullContentToLineFormat(targetContent || '', sourceContent || '');
                }
            }
        }

    } catch (_error: unknown) {
        const error = toError(_error);
        console.log('? Error fetching with detected info:', error.message);
    }

    return await reconstructFromDiffFallback(diff, filePath);
}

/**
 * Extract commit IDs from diff content
 */
function extractCommitsFromDiff(diff: string) {
    // Look for commit hashes in diff header
    const indexMatch = diff.match(/index ([a-f0-9]{7,40})\.\.([a-f0-9]{7,40})/);
    if (indexMatch) {
        return {
            sourceCommit: indexMatch[1],
            targetCommit: indexMatch[2]
        };
    }

    // Look for other patterns
    const commitMatches = diff.match(/[a-f0-9]{40}/g);
    if (commitMatches && commitMatches.length >= 2) {
        return {
            sourceCommit: commitMatches[0],
            targetCommit: commitMatches[1]
        };
    }

    return {};
}

/**
 * Get complete file content from Azure DevOps API for both commits
 */
async function getFullFileContentFromAzureDevOps(filePath: string, diff: string) {
    const cache = global.prDiffCache;

    try {
        console.log(`?? Fetching FULL content for ${filePath} from both commits`);
        console.log(`?? Cache data:`, {
            organization: (cache as any).organization,
            project: (cache as any).project,
            repository: (cache as any).repository,
            sourceCommit: (cache as any).sourceCommit?.substring(0, 7),
            targetCommit: (cache as any).targetCommit?.substring(0, 7),
            hasAccessToken: !!(cache as any).accessToken
        });

        // Import getFileContent function from review-pr.js if available
        const reviewPrPath = path.join(__dirname, 'review-pr.js');
        if (fs.existsSync(reviewPrPath)) {
            const reviewPrModule = require(reviewPrPath);
            const getFileContent = reviewPrModule.getFileContent;

            if (typeof getFileContent === 'function') {
                console.log(`?? Calling getFileContent for both commits...`);
                console.log(`   LEFT (Original/Base): ${(cache as any).targetCommit?.substring(0, 7)}`);
                console.log(`   RIGHT (Modified/Feature): ${(cache as any).sourceCommit?.substring(0, 7)}`);

                // ?? FIX: Azure DevOps PR terminology vs Monaco terminology
                // sourceCommit = NEW code (feature branch) = Monaco "modified" (RIGHT)
                // targetCommit = OLD code (base branch) = Monaco "original" (LEFT)
                const [targetContent, sourceContent] = await Promise.all([
                    getFileContent((cache as any).organization, (cache as any).project, (cache as any).repository, filePath, (cache as any).targetCommit, (cache as any).accessToken), // OLD = original = LEFT
                    getFileContent((cache as any).organization, (cache as any).project, (cache as any).repository, filePath, (cache as any).sourceCommit, (cache as any).accessToken)  // NEW = modified = RIGHT
                ]);

                console.log(`?? API Response:`, {
                    targetContentLength: targetContent ? targetContent.length : 'NULL',
                    sourceContentLength: sourceContent ? sourceContent.length : 'NULL',
                    targetContentFirstLines: targetContent ? targetContent.split('\n').slice(0, 3).join('\n') : 'NULL',
                    sourceContentFirstLines: sourceContent ? sourceContent.split('\n').slice(0, 3).join('\n') : 'NULL'
                });

                if (targetContent || sourceContent) {
                    console.log(`? SUCCESS: Got full content - Original (OLD): ${targetContent ? targetContent.length : 0}, Modified (NEW): ${sourceContent ? sourceContent.length : 0}`);

                    return convertFullContentToLineFormat(targetContent || '', sourceContent || '');
                } else {
                    console.log(`?? Both API calls returned NULL - file might not exist in one or both commits`);
                }
            } else {
                console.log(`? getFileContent is not a function:`, typeof getFileContent);
            }
        } else {
            console.log(`? review-pr.js not found at:`, reviewPrPath);
        }

    } catch (_error: unknown) {
        const error = toError(_error);
        console.log('? Error fetching from Azure DevOps API:', error.message);
        console.log('? Stack trace:', error.stack);
    }

    console.log(`?? Falling back to diff reconstruction...`);
    return await reconstructFromDiffFallback(diff, filePath);
}

/**
 * Convert full file content to line format using diff.js for proper alignment
 */
function convertFullContentToLineFormat(baseContent: string, targetContent: string) {
    // Import diff library from npm package
    let diff;
    try {
        diff = require('diff');
        console.log('? diff module loaded successfully from npm');
    } catch (_error: unknown) {
        const error = toError(_error);
        console.log('? diff library not available, using simple reconstruction');
        console.log('? diff error:', error.message);
        return {
            originalLines: baseContent.split('\n').map((line, i) => ({ content: line, lineNum: i + 1, type: 'context' })),
            modifiedLines: targetContent.split('\n').map((line, i) => ({ content: line, lineNum: i + 1, type: 'context' }))
        };
    }

    // ? PERFORMANCE: Quick check for identical content
    if (baseContent === targetContent) {
        console.log('? Files identical - using fast path');
        const lines = baseContent.split('\n');
        return {
            originalLines: lines.map((line, i) => ({ content: line, lineNum: i + 1, type: 'context' })),
            modifiedLines: lines.map((line, i) => ({ content: line, lineNum: i + 1, type: 'context' }))
        };
    }

    console.time('? Diff processing');
    // Use diff to properly align lines for side-by-side view
    const changes = diff.diffLines(baseContent, targetContent);
    console.timeEnd('? Diff processing');

    const originalLines = [];
    const modifiedLines = [];

    let baseLineNum = 1;
    let targetLineNum = 1;

    for (const change of changes) {
        const lines = change.value.split('\n');
        // Remove empty last element if exists (from split)
        if (lines[lines.length - 1] === '') {
            lines.pop();
        }

        if (change.added) {
            // Lines added in target (new code) - show empty on left, added on right
            for (const line of lines) {
                originalLines.push({
                    content: '',
                    lineNum: '',
                    type: 'empty'
                });

                modifiedLines.push({
                    content: line,
                    lineNum: targetLineNum,
                    type: 'added'
                });

                targetLineNum++;
            }
        } else if (change.removed) {
            // Lines removed from base (old code) - show removed on left, empty on right
            for (const line of lines) {
                originalLines.push({
                    content: line,
                    lineNum: baseLineNum,
                    type: 'removed'
                });

                modifiedLines.push({
                    content: '',
                    lineNum: '',
                    type: 'empty'
                });

                baseLineNum++;
            }
        } else {
            // Unchanged lines - show on both sides
            for (const line of lines) {
                originalLines.push({
                    content: line,
                    lineNum: baseLineNum,
                    type: 'context'
                });

                modifiedLines.push({
                    content: line,
                    lineNum: targetLineNum,
                    type: 'context'
                });

                baseLineNum++;
                targetLineNum++;
            }
        }
    }

    console.log(`? ENHANCED SIDE-BY-SIDE: ${originalLines.length} original lines, ${modifiedLines.length} modified lines`);
    console.log(`?? Added: ${modifiedLines.filter(l => l.type === 'added').length}, Removed: ${originalLines.filter(l => l.type === 'removed').length}`);

    return { originalLines, modifiedLines };
}

/**
 * Fallback to diff reconstruction when full content is not available
 */
async function reconstructFromDiffFallback(diff: string, filePath: string) {
    console.log('?? Using fallback diff reconstruction for:', filePath);

    // Use the existing reconstruction logic
    const { originalLines, modifiedLines } = reconstructFromGitDiff(diff, filePath);

    console.log(`? Fallback reconstruction completed: ${originalLines.length} original, ${modifiedLines.length} modified lines`);
    return { originalLines, modifiedLines };
}

/**
 * Reconstruct file content from git diff (for cross-repo PR reviews)
 * @param {string} diff - Git diff content
 * @param {string} filePath - File path for context
 * @returns {object} - { originalLines: [], modifiedLines: [] }
 */
function reconstructFromGitDiff(diff: string, _filePath: string) {
    console.log('? Reconstructing file content from git diff for cross-repo PR');

    const diffLines = diff.split('\n');
    const originalLines = [];
    const modifiedLines = [];

    let oldLineNum = 1;
    let newLineNum = 1;
    let inHunk = false;

    for (const line of diffLines) {
        // Skip diff headers
        if (line.startsWith('diff --git') || line.startsWith('+++') || line.startsWith('---') || line.startsWith('index ')) {
            continue;
        }

        if (line.startsWith('@@')) {
            // Parse hunk header to get starting line numbers
            const hunkMatch = line.match(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
            if (hunkMatch) {
                oldLineNum = parseInt(hunkMatch[1]!);
                newLineNum = parseInt(hunkMatch[3]!);
                inHunk = true;
                console.log(`?? Hunk: starting at old line ${oldLineNum}, new line ${newLineNum}`);
            }
            continue;
        }

        if (inHunk) {
            if (line.startsWith(' ')) {
                // Context line (unchanged)
                const content = line.substring(1);
                originalLines.push({
                    content: content,
                    lineNum: oldLineNum,
                    type: 'context'
                });
                modifiedLines.push({
                    content: content,
                    lineNum: newLineNum,
                    type: 'context'
                });
                oldLineNum++;
                newLineNum++;
            } else if (line.startsWith('-')) {
                // Removed line
                const content = line.substring(1);
                originalLines.push({
                    content: content,
                    lineNum: oldLineNum,
                    type: 'removed'
                });
                modifiedLines.push({
                    content: '',
                    lineNum: '',
                    type: 'empty'
                });
                oldLineNum++;
            } else if (line.startsWith('+')) {
                // Added line
                const content = line.substring(1);
                originalLines.push({
                    content: '',
                    lineNum: '',
                    type: 'empty'
                });
                modifiedLines.push({
                    content: content,
                    lineNum: newLineNum,
                    type: 'added'
                });
                newLineNum++;
            } else if (line.trim() === '') {
                // Empty line in diff
                originalLines.push({
                    content: '',
                    lineNum: oldLineNum,
                    type: 'context'
                });
                modifiedLines.push({
                    content: '',
                    lineNum: newLineNum,
                    type: 'context'
                });
                oldLineNum++;
                newLineNum++;
            }
        }
    }

    console.log(`? Reconstructed ${originalLines.length} original lines, ${modifiedLines.length} modified lines`);
    console.log(`?? Changes: ${originalLines.filter(l => l.type === 'removed').length} removed, ${modifiedLines.filter(l => l.type === 'added').length} added`);

    return { originalLines, modifiedLines };
}

// ES exports
export { setupAzureDevOpsSettings, parseFullDiffContentEnhanced, detectAzureDevOpsFromDiff, getFullContentWithDetectedInfo, extractCommitsFromDiff, getFullFileContentFromAzureDevOps, convertFullContentToLineFormat, reconstructFromDiffFallback, reconstructFromGitDiff };
