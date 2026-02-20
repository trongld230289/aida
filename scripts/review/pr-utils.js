/**
 * @module pr-utils
 * @description Shared utility functions for PR review operations
 * Extracted from review-pr.js during Phase 4 refactoring.
 */

const vscode = require('vscode');
const path = require('path');
const { getUnifiedModel, executeAIReview, shouldUseApiKey, processTemplateContent, showReviewOptions, getTokenForPR, parsePRUrl, showTokenConfigurationHelp } = require('./review-common');
const { detectFromPRFiles, getReviewTemplateWithDetection, displayDetectionInfo } = require('./language-detection');
const { aidaLogging } = require('../core/settings');

// Diff package (loaded on first use)
let Diff;
try { Diff = require('diff'); } catch (e) { Diff = null; }

/**
 * Parse PR URL and extract repository information
 * @param {string} userMessage - The user input containing PR URL
 * @returns {object} Parsed PR information
 */
function parsePRUrlInfo(userMessage) {
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
        const fullPath = gitlabMatch[2]; // Full namespace/project path
        prId = gitlabMatch[3]; // merge request ID
        originalUrl = gitlabMatch[0]; // Store the full matched URL
        
        // Parse namespace/project - take last part as repo, rest as owner
        const pathParts = fullPath.split('/');
        repo = pathParts[pathParts.length - 1]; // Last part is project name
        owner = pathParts.slice(0, -1).join('/'); // Everything else is namespace
        
        // Store GitLab host for API calls
        organization = gitlabHost;
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
async function getPRReviewTemplate(templateType, prData) {
    try {
        aidaLogging('🔍 Starting PR detection for template selection...');
        
        // Convert PR files to detection format
        const prFiles = (prData.fileChanges || []).map(f => ({
            path: f.path || f.fileName,
            content: f.content || f.rawContent,
            patch: f.diffContent || f.patch || f.diff,
            additions: f.additions || 0,
            deletions: f.deletions || 0
        }));

        aidaLogging(`📊 Processing ${prFiles.length} files for detection`);

        // Run PR detection
        const detection = await detectFromPRFiles(prFiles);
        
        aidaLogging('🎯 PR Detection Results:', {
            language: detection.language,
            framework: detection.framework,
            templatePath: detection.template.path,
            confidence: detection.confidence
        });

        // Build template path
        const templatePath = `${detection.template.path}/${templateType}`;
        
        // Load template content
        const fs = require('fs');
        const vscode = require('vscode');
        const extensionPath = global.extensionPath || process.cwd();
        
        // Try workspace AIDA templates first, then extension templates
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        let templatePaths = [];
        let templateSource = 'extension/templates';
        
        if (workspaceFolder) {
            const workspaceAidaPath = path.join(workspaceFolder.uri.fsPath, 'AIDA', 'templates');
            templatePaths = [
                // Workspace AIDA templates (highest priority)
                path.join(workspaceAidaPath, 'review-code', 'languages', (detection.framework || detection.language || 'javascript').toLowerCase(), templateType),
                path.join(workspaceAidaPath, 'review-code', 'fallback', templateType),
                // Extension templates (fallback)
                path.join(extensionPath, 'templates', templatePath),
                path.join(extensionPath, 'templates', 'review-code', 'fallback', templateType)
            ];
        } else {
            templatePaths = [
                path.join(extensionPath, 'templates', templatePath),
                path.join(extensionPath, 'templates', 'review-code', 'fallback', templateType)
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
                
                aidaLogging(`✅ Loaded template from: ${templateSource} - ${fullTemplatePath}`);
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
            confidence: detection.confidence,
            debugInfo: detection.debugInfo
        };

    } catch (error) {
        aidaLogging('❌ PR template detection failed:', error);
        
        // Final fallback - use workspace detection
        aidaLogging('🔄 Falling back to workspace detection...');
        return await getReviewTemplateWithDetection(templateType);
    }
}

/**
 * Filter out auto-generated files that should not be included in AI review
 * @param {Array} fileChanges - Array of file change objects
 * @param {string} provider - Provider name for logging ('Azure DevOps', 'GitHub', 'GitLab')
 * @returns {Array} Filtered array of reviewable files
 */
function filterReviewableFiles(fileChanges, provider = 'Unknown') {
    const { commonIgnores, languageIgnores, isIgnored } = require('../core/ignore-rules');
    
    const reviewableFiles = fileChanges.filter(file => {
        const filePath = file.path || file.filename || '';
        
        // Check common ignores
        if (isIgnored(filePath, commonIgnores)) {
            aidaLogging(`🚫 [FILTERED] ${provider} Common ignore: ${filePath}`);
            return false;
        }

        // Check C# specific ignores
        if (isIgnored(filePath, languageIgnores.csharp)) {
            aidaLogging(`🚫 [FILTERED] ${provider} C# ignore: ${filePath}`);
            return false;
        }
        
        // Filter out Migration Designer files (auto-generated, no review value)
        const isMigrationDesigner = filePath.includes('/Migrations/') && filePath.endsWith('.Designer.cs');
        
        if (isMigrationDesigner) {
            aidaLogging(`🚫 [FILTERED] ${provider} Migration Designer file: ${filePath}`);
            return false;
        }

        // Add more filter patterns here in the future:
        // const isAutoGenerated = filePath.includes('.generated.') || filePath.includes('.auto.');
        // const isPackageLock = filePath.endsWith('package-lock.json') || filePath.endsWith('yarn.lock');
        
        return true;
    });

    aidaLogging(`📊 ${provider}: ${fileChanges.length} total files, ${reviewableFiles.length} reviewable files`);
    if (fileChanges.length !== reviewableFiles.length) {
        aidaLogging(`🚫 Filtered ${fileChanges.length - reviewableFiles.length} auto-generated files from review`);
    }

    return reviewableFiles;
}

/**
 * Clear PR diff cache for a specific provider and PR ID
 * This prevents file count discrepancy when reviewing the same PR multiple times
 * @param {string} provider - Provider name ('github', 'gitlab', 'azure')
 * @param {string} prId - Pull Request ID
 */
function clearPrDiffCache(provider, prId) {
    if (!global.prDiffCache) {
        global.prDiffCache = {};
        return;
    }

    const prefix = `${provider}_${prId}_`;
    const keysToDelete = Object.keys(global.prDiffCache).filter(key => key.startsWith(prefix));
    
    if (keysToDelete.length > 0) {
        aidaLogging(`🧹 Clearing ${keysToDelete.length} cached entries for ${provider} PR ${prId}:`);
        keysToDelete.forEach(key => {
            aidaLogging(`  ❌ Removing: ${key}`);
            delete global.prDiffCache[key];
        });
        aidaLogging(`✅ Cache cleared for ${provider} PR ${prId}`);
    } else {
        aidaLogging(`💡 No cached entries found for ${provider} PR ${prId}`);
    }
}

function countDiffLines(diffContent) {
    const lines = diffContent.split('\n');
    let additions = 0;
    let deletions = 0;
    
    for (const line of lines) {
        if (line.startsWith('+') && !line.startsWith('+++')) {
            const content = line.substring(1);
            // Chỉ đếm dòng có nội dung thực (không phải trống)
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
function generateUnifiedDiff(filePath, baseContent, targetContent, changeType) {
    if (changeType === 'add') {
        // File mới - tất cả là additions
        const lines = targetContent.split('\n');
        let diff = `--- /dev/null\n+++ b/${filePath}\n@@ -0,0 +1,${lines.length} @@\n`;
        lines.forEach(line => {
            diff += `+${line}\n`;
        });
        return diff;
    }
    
    if (changeType === 'delete') {
        // File bị xóa - tất cả là deletions  
        const lines = baseContent.split('\n');
        let diff = `--- a/${filePath}\n+++ /dev/null\n@@ -1,${lines.length} +0,0 @@\n`;
        lines.forEach(line => {
            diff += `-${line}\n`;
        });
        return diff;
    }
    
    // File edit - sử dụng diff library
    const patches = Diff.createPatch(filePath, baseContent, targetContent, '', '', {
        context: 3, // Giống Azure DevOps (3 context lines)
        ignoreWhitespace: false, // 🔧 KEEP whitespace and indentation!
        newlineIsToken: false   // Don't treat newlines as separate tokens
    });
    
    return patches;
}

/**
 * Parse real git diff into structured format
 */
function parseRealGitDiff(gitDiff, prId, org, proj, repo, diffCommand) {
    const fileChanges = [];
    const lines = gitDiff.split('\n');
    let currentFile = null;
    let currentDiff = [];
    let inHunk = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

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
                    deletions: 0
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
            cwd: workspaceFolder.uri.fsPath,
            encoding: 'utf8'
        }).trim();
        lastCommit = execSync('git log -1 --oneline', {
            cwd: workspaceFolder.uri.fsPath,
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
                    `📁 ${fileChanges.length} file(s) modified`,
                    `➕ ${fileChanges.reduce((sum, f) => sum + f.additions, 0)} lines added`,
                    `➖ ${fileChanges.reduce((sum, f) => sum + f.deletions, 0)} lines removed`,
                    `🔧 Diff command: ${diffCommand}`,
                    '🔍 Real workspace analysis'
                ]
            }
        }
    };
}

module.exports = {
    parsePRUrlInfo,
    getPRReviewTemplate,
    filterReviewableFiles,
    clearPrDiffCache,
    countDiffLines,
    generateUnifiedDiff,
    parseRealGitDiff,
};
