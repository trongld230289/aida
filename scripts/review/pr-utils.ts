/**
 * @module pr-utils
 * @description Shared utility functions for PR review operations
 * Extracted from review-pr.js during Phase 4 refactoring.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';
import { processTemplateContent } from './review-common';
import { detectFromPRFiles, getReviewTemplateWithDetection } from './language-detection';
import { aidaLogging } from '../core/settings';
import { commonIgnores, languageIgnores, isIgnored } from '../core/ignore-rules';

// Diff package (loaded on first use)
let Diff: any;
try { Diff = require('diff'); } catch (_e: unknown) { Diff = null; }

/**
 * Parse PR URL and extract repository information
 * @param {string} userMessage - The user input containing PR URL
 * @returns {object} Parsed PR information
 */
function parsePRUrlInfo(userMessage: string) {
    let prId = null;
    let repoType = null;
    let organization = null;
    let project = null;
    let repository = null;
    let owner = null;
    let repo = null;
    let originalUrl = null;

    // GitHub URL pattern: https://github.com/{owner}/{repo}/pull/{id}
    const githubUrlPattern = /https:\/\/github\.com\/([^\/]+)\/([^\/]+)\/pull\/(\d+)/i;
    const githubMatch = userMessage.match(githubUrlPattern);

    // Azure DevOps URL pattern: https://dev.azure.com/{org}/{project}/_git/{repo}/pullrequest/{id}
    const azureUrlPattern = /https:\/\/dev\.azure\.com\/([^\/]+)\/([^\/]+)\/_git\/([^\/]+)\/pullrequest\/(\d+)/i;
    const azureMatch = userMessage.match(azureUrlPattern);

    // GitLab URL pattern: https://gitlab.com/{namespace}/{project}/-/merge_requests/{id}
    // Supports nested namespaces like: ds365ai/FDP/time-and-cost-project/fdp-activity-middleware-service
    const gitlabUrlPattern = /https:\/\/([^\/]+)\/(.+?)\/-\/merge_requests\/(\d+)/i;
    const gitlabMatch = userMessage.match(gitlabUrlPattern);

    // Bitbucket Cloud URL pattern: https://bitbucket.org/{workspace}/{repo}/pull-requests/{id}
    const bitbucketUrlPattern = /https:\/\/bitbucket\.org\/([^\/]+)\/([^\/]+)\/pull-requests\/(\d+)/i;
    const bitbucketMatch = userMessage.match(bitbucketUrlPattern);

    if (githubMatch) {
        repoType = 'github';
        owner = githubMatch[1];
        repo = githubMatch[2];
        prId = githubMatch[3];
        originalUrl = githubMatch[0];
    } else if (azureMatch) {
        repoType = 'azure';
        organization = azureMatch[1];
        project = azureMatch[2];
        repository = azureMatch[3];
        prId = azureMatch[4];
        originalUrl = azureMatch[0];
    } else if (gitlabMatch) {
        repoType = 'gitlab';
        // Extract GitLab instance, full namespace path, and MR ID
        const gitlabHost = gitlabMatch[1]; // gitlab.com or custom instance
        const fullPath = gitlabMatch[2]!; // Full namespace/project path
        prId = gitlabMatch[3]; // merge request ID
        originalUrl = gitlabMatch[0]; // Store the full matched URL
        
        // Parse namespace/project - take last part as repo, rest as owner
        const pathParts = fullPath.split('/');
        repo = pathParts[pathParts.length - 1]; // Last part is project name
        owner = pathParts.slice(0, -1).join('/'); // Everything else is namespace
        
        // Store GitLab host for API calls
        organization = gitlabHost;
    } else if (bitbucketMatch) {
        repoType = 'bitbucket';
        owner = bitbucketMatch[1];
        organization = bitbucketMatch[1];
        repo = bitbucketMatch[2];
        repository = bitbucketMatch[2];
        prId = bitbucketMatch[3];
        originalUrl = bitbucketMatch[0];
    } else {
        // Fallback to simple PR ID pattern (Azure DevOps default)
        const prPattern = /(?:pullrequest(?:s)?\/(\d+)|pr[#\s]?(\d+)|id[:\s]?(\d+))/i;
        const match = userMessage.match(prPattern);
        if (match) {
            repoType = 'azure';
            prId = match[1] || match[2] || match[3];
        }
    }

    return {
        prId,
        repoType,
        organization,
        project,
        repository,
        owner,
        repo,
        originalUrl
    };
}

/**
 * Get review template for PR with cross-platform detection
 * @param {string} templateType - Template type (review-pr.md, review-changes.md, etc.)
 * @param {object} prData - PR data with fileChanges for detection
 * @returns {object} Template result with detection info
 */
async function getPRReviewTemplate(templateType: string, prData: Record<string, any>): Promise<unknown> {
    try {
        aidaLogging('Ã°Å¸â€Â Starting PR detection for template selection...');
        
        // Convert PR files to detection format
        const prFiles = (prData.fileChanges || []).map((f: Record<string, string | number>) => ({
            path: f.path || f.fileName,
            content: f.content || f.rawContent,
            patch: f.diffContent || f.patch || f.diff,
            additions: f.additions || 0,
            deletions: f.deletions || 0
        }));

        aidaLogging(`Ã°Å¸â€œÅ  Processing ${prFiles.length} files for detection`);

        // Run PR detection
        const detection = await detectFromPRFiles(prFiles);
        
        aidaLogging('Ã°Å¸Å½Â¯ PR Detection Results:', {
            language: (detection as any).language,
            framework: (detection as any).framework,
            templatePath: (detection as any).template.path,
            confidence: (detection as any).confidence
        });

        // Build template path
        const templatePath = `${(detection as any).template.path}/${templateType}`;
        
        // Load template content
        const extensionPath = global.extensionPath || process.cwd();
        
        // Try workspace AIDA templates first, then extension templates
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        let templatePaths = [];
        let templateSource = 'extension/templates';
        
        if (workspaceFolder) {
            const workspaceAidaPath = path.join(workspaceFolder.uri.fsPath, 'AIDA', 'templates');
            templatePaths = [
                // Workspace AIDA templates (highest priority)
                path.join(workspaceAidaPath, 'review-code', 'languages', ((detection as any).framework || (detection as any).language || 'javascript').toLowerCase(), templateType),
                path.join(workspaceAidaPath, 'review-code', 'fallback', templateType),
                // Extension templates (fallback)
                path.join(extensionPath as any, 'templates', templatePath),
                path.join(extensionPath as any, 'templates', 'review-code', 'fallback', templateType)
            ];
        } else {
            templatePaths = [
                path.join(extensionPath as any, 'templates', templatePath),
                path.join(extensionPath as any, 'templates', 'review-code', 'fallback', templateType)
            ];
        }
        
        let content = '';
        let usedTemplatePath = '';
        
        for (const fullTemplatePath of templatePaths) {
            if (fs.existsSync(fullTemplatePath)) {
                content = fs.readFileSync(fullTemplatePath, 'utf8');
                usedTemplatePath = fullTemplatePath;
                
                // Determine template source
                if (workspaceFolder && fullTemplatePath.includes(path.join(workspaceFolder.uri.fsPath, 'AIDA'))) {
                    templateSource = 'workspace/AIDA/templates';
                }
                
                aidaLogging(`Ã¢Å“â€¦ Loaded template from: ${templateSource} - ${fullTemplatePath}`);
                break;
            }
        }
        
        if (!content) {
            throw new Error(`Template not found: ${templatePath} and fallback not available`);
        }

        // Process template content with placeholder replacement using new utility function
        const processedContent = processTemplateContent(content, usedTemplatePath);

        return {
            content: processedContent,
            detection,
            templatePath,
            templateSource,
            confidence: (detection as any).confidence,
            debugInfo: (detection as any).debugInfo
        };

    } catch (error: unknown) {
        aidaLogging('Ã¢ÂÅ’ PR template detection failed:', error);
        
        // Final fallback - use workspace detection
        aidaLogging('Ã°Å¸â€â€ž Falling back to workspace detection...');
        return await getReviewTemplateWithDetection(templateType, null as any);
    }
}

/**
 * Filter out auto-generated files that should not be included in AI review
 * @param {Array} fileChanges - Array of file change objects
 * @param {string} provider - Provider name for logging ('Azure DevOps', 'GitHub', 'GitLab')
 * @returns {Array} Filtered array of reviewable files
 */
function filterReviewableFiles(fileChanges: unknown[], provider = 'Unknown') {
    const reviewableFiles = fileChanges.filter((file) => {
        const filePath = (file as any).path || (file as any).filename || '';
        
        // Check common ignores
        if (isIgnored(filePath, commonIgnores)) {
            aidaLogging(`Ã°Å¸Å¡Â« [FILTERED] ${provider} Common ignore: ${filePath}`);
            return false;
        }

        // Check C# specific ignores
        if (isIgnored(filePath, languageIgnores.csharp)) {
            aidaLogging(`Ã°Å¸Å¡Â« [FILTERED] ${provider} C# ignore: ${filePath}`);
            return false;
        }
        
        // Filter out Migration Designer files (auto-generated, no review value)
        const isMigrationDesigner = filePath.includes('/Migrations/') && filePath.endsWith('.Designer.cs');
        
        if (isMigrationDesigner) {
            aidaLogging(`Ã°Å¸Å¡Â« [FILTERED] ${provider} Migration Designer file: ${filePath}`);
            return false;
        }

        return true;
    });

    aidaLogging(`Ã°Å¸â€œÅ  ${provider}: ${fileChanges.length} total files, ${reviewableFiles.length} reviewable files`);
    if (fileChanges.length !== reviewableFiles.length) {
        aidaLogging(`Ã°Å¸Å¡Â« Filtered ${fileChanges.length - reviewableFiles.length} auto-generated files from review`);
    }

    return reviewableFiles;
}

/**
 * Clear PR diff cache for a specific provider and PR ID
 * This prevents file count discrepancy when reviewing the same PR multiple times
 * @param {string} provider - Provider name ('github', 'gitlab', 'azure')
 * @param {string} prId - Pull Request ID
 */
function clearPrDiffCache(provider: string, prId: string | number) {
    if (!(global as any).prDiffCache) {
        (global as any).prDiffCache = {};
        return;
    }

    const cache = (global as any).prDiffCache;
    const prefix = `${provider}_${prId}_`;
    // Also clear parsed-content entries (keyed only by file path, not namespaced)
    // so stale content from a previous review/PR is never reused.
    const keysToDelete = Object.keys(cache).filter(key => key.startsWith(prefix) || key.startsWith('content_'));
    
    if (keysToDelete.length > 0) {
        aidaLogging(`Ã°Å¸Â§Â¹ Clearing ${keysToDelete.length} cached entries for ${provider} PR ${prId}:`);
        keysToDelete.forEach(key => {
            aidaLogging(`  Ã¢ÂÅ’ Removing: ${key}`);
            delete (global as any).prDiffCache[key];
        });
        aidaLogging(`Ã¢Å“â€¦ Cache cleared for ${provider} PR ${prId}`);
    } else {
        aidaLogging(`Ã°Å¸â€™Â¡ No cached entries found for ${provider} PR ${prId}`);
    }

    // Azure DevOps stores credentials/commit metadata as global cache properties to
    // enable full-file-content fetching. These leak into other providers (e.g. Bitbucket
    // files get routed through Azure's getFullFileContent path, returning wrong content).
    // Clear them for any non-Azure review.
    if (provider !== 'azure') {
        for (const k of ['accessToken', 'organization', 'project', 'repository', 'sourceCommit', 'targetCommit', 'mergeBaseCommit']) {
            delete cache[k];
        }
    }
}

function countDiffLines(diffContent: string) {
    const lines = diffContent.split('\n');
    let additions = 0;
    let deletions = 0;
    
    for (const line of lines) {
        if (line.startsWith('+') && !line.startsWith('+++')) {
            const content = line.substring(1);
            // ChÃ¡Â»â€° Ã„â€˜Ã¡ÂºÂ¿m dÃƒÂ²ng cÃƒÂ³ nÃ¡Â»â„¢i dung thÃ¡Â»Â±c (khÃƒÂ´ng phÃ¡ÂºÂ£i trÃ¡Â»â€˜ng)
            if (content.trim().length > 0) {
                additions++;
            }
        } else if (line.startsWith('-') && !line.startsWith('---')) {
            const content = line.substring(1);
            if (content.trim().length > 0) {
                deletions++;
            }
        }
    }
    
    return { additions, deletions };
}

/**
 * Generate unified diff format from two file contents
 */
/**
 * Generate unified diff format using diff library for accuracy
 */
function generateUnifiedDiff(filePath: string, baseContent: string, targetContent: string, changeType: string) {
    if (changeType === 'add') {
        // File mÃ¡Â»â€ºi - tÃ¡ÂºÂ¥t cÃ¡ÂºÂ£ lÃƒÂ  additions
        const lines = targetContent.split('\n');
        let diff = `--- /dev/null\n+++ b/${filePath}\n@@ -0,0 +1,${lines.length} @@\n`;
        lines.forEach((line) => {
            diff += `+${line}\n`;
        });
        return diff;
    }
    
    if (changeType === 'delete') {
        // File bÃ¡Â»â€¹ xÃƒÂ³a - tÃ¡ÂºÂ¥t cÃ¡ÂºÂ£ lÃƒÂ  deletions  
        const lines = baseContent.split('\n');
        let diff = `--- a/${filePath}\n+++ /dev/null\n@@ -1,${lines.length} +0,0 @@\n`;
        lines.forEach((line) => {
            diff += `-${line}\n`;
        });
        return diff;
    }
    
    // File edit - sÃ¡Â»Â­ dÃ¡Â»Â¥ng diff library
    const patches = Diff.createPatch(filePath, baseContent, targetContent, '', '', {
        context: 3, // GiÃ¡Â»â€˜ng Azure DevOps (3 context lines)
        ignoreWhitespace: false, // Ã°Å¸â€Â§ KEEP whitespace and indentation!
        newlineIsToken: false   // Don't treat newlines as separate tokens
    });
    
    return patches;
}

/**
 * Parse real git diff into structured format
 */
function parseRealGitDiff(gitDiff: string, prId: string | number, org: string, proj: string, repo: string, diffCommand: string) {
    const fileChanges = [];
    const lines = gitDiff.split('\n');
    let currentFile = null;
    let currentDiff: string[] = [];
    let inHunk = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;

        if (line.startsWith('diff --git')) {
            // Save previous file
            if (currentFile) {
                currentFile.diff = currentDiff.join('\n');
                currentFile.diffContent = currentDiff.join('\n'); // Also set diffContent for new display logic
                fileChanges.push(currentFile);
            }

            // Start new file
            const match = line.match(/b\/(.*)/);
            if (match) {
                currentFile = {
                    path: match[1],
                    changeType: 'edit',
                    additions: 0,
                    deletions: 0,
                    diff: '' as any,
                    diffContent: '' as any
                };
                currentDiff = [line]; // Include the diff --git line
                inHunk = false;
            }
        } else if (line.startsWith('@@')) {
            // Start of hunk
            inHunk = true;
            currentDiff.push(line);
        } else if (inHunk) {
            currentDiff.push(line);

            if (line.startsWith('+') && !line.startsWith('+++')) {
                if (currentFile) currentFile.additions++;
            } else if (line.startsWith('-') && !line.startsWith('---')) {
                if (currentFile) currentFile.deletions++;
            }
        }
    }

    // Save last file
    if (currentFile) {
        currentFile.diff = currentDiff.join('\n');
        currentFile.diffContent = currentDiff.join('\n'); // Also set diffContent for new display logic
        fileChanges.push(currentFile);
    }

    // Get git info
    let currentBranch = 'unknown';
    let lastCommit = 'unknown';
    try {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        currentBranch = execSync('git branch --show-current', {
            cwd: workspaceFolder!.uri.fsPath,
            encoding: 'utf8'
        }).trim();
        lastCommit = execSync('git log -1 --oneline', {
            cwd: workspaceFolder!.uri.fsPath,
            encoding: 'utf8'
        }).trim();
    } catch { }

    return {
        success: true,
        data: {
            id: prId,
            title: `Real PR #${prId} - ${currentBranch} branch`,
            description: `Live analysis from workspace: ${lastCommit}`,
            author: 'Current User',
            status: 'Active',
            organization: org,
            project: proj,
            repository: repo,
            sourceCommit: currentBranch,
            targetCommit: 'HEAD~1',
            diffCommand: diffCommand,
            fileChanges: fileChanges,
            analysis: {
                quality: fileChanges.length > 0 ? `${fileChanges.length} file(s) with real changes` : 'No changes detected',
                security: 'Live diff analysis - review required',
                performance: 'Real-time analysis needed',
                testCoverage: 'Update tests for modified files',
                codeReview: [
                    `Ã°Å¸â€œÂ ${fileChanges.length} file(s) modified`,
                    `Ã¢Å¾â€¢ ${fileChanges.reduce((sum, f) => sum + f.additions, 0)} lines added`,
                    `Ã¢Å¾â€“ ${fileChanges.reduce((sum, f) => sum + f.deletions, 0)} lines removed`,
                    `Ã°Å¸â€Â§ Diff command: ${diffCommand}`,
                    'Ã°Å¸â€Â Real workspace analysis'
                ]
            }
        }
    };
}

// ES exports
export { parsePRUrlInfo, getPRReviewTemplate, filterReviewableFiles, clearPrDiffCache, countDiffLines, generateUnifiedDiff, parseRealGitDiff };
