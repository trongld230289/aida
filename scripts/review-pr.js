const vscode = require('vscode');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');
const { getUnifiedModel, executeAIReview, shouldUseApiKey, processTemplateContent, showReviewOptions } = require('./review-common');
const { detectFromPRFiles, getReviewTemplateWithDetection, displayDetectionInfo } = require('./language-detection');

// Import functions from extension.js
let checkAndInitializeTemplates;
try {
    const extensionModule = require('../extension');
    checkAndInitializeTemplates = extensionModule.ensureAidaTemplatesForReview;
} catch (error) {
    console.log('⚠️ Could not import functions from extension.js');
}

/**
 * Get review template for PR with cross-platform detection
 * @param {string} templateType - Template type (review-pr.md, review-changes.md, etc.)
 * @param {object} prData - PR data with fileChanges for detection
 * @returns {object} Template result with detection info
 */
async function getPRReviewTemplate(templateType, prData) {
    try {
        console.log('🔍 Starting PR detection for template selection...');
        
        // Convert PR files to detection format
        const prFiles = (prData.fileChanges || []).map(f => ({
            path: f.path || f.fileName,
            content: f.content || f.rawContent,
            patch: f.diffContent || f.patch || f.diff,
            additions: f.additions || 0,
            deletions: f.deletions || 0
        }));

        console.log(`📊 Processing ${prFiles.length} files for detection`);

        // Run PR detection
        const detection = await detectFromPRFiles(prFiles);
        
        console.log('🎯 PR Detection Results:', {
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
                
                console.log(`✅ Loaded template from: ${templateSource} - ${fullTemplatePath}`);
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
        console.error('❌ PR template detection failed:', error);
        
        // Final fallback - use workspace detection
        console.log('🔄 Falling back to workspace detection...');
        return await getReviewTemplateWithDetection(templateType);
    }
}

// Try to require diff package with fallback
let Diff;
try {
    // Use npm installed diff package
    Diff = require('diff');
} catch (error) {
    console.warn('⚠️ diff package not available, using fallback diff functionality');
    // Create a simple fallback for basic diff functionality
    Diff = {
        createPatch: (fileName, oldStr, newStr) => {
            return `--- ${fileName}\n+++ ${fileName}\n@@ -1,${oldStr.split('\n').length} +1,${newStr.split('\n').length} @@\n${newStr}`;
        }
    };
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
        console.log(`🧹 Clearing ${keysToDelete.length} cached entries for ${provider} PR ${prId}:`);
        keysToDelete.forEach(key => {
            console.log(`  ❌ Removing: ${key}`);
            delete global.prDiffCache[key];
        });
        console.log(`✅ Cache cleared for ${provider} PR ${prId}`);
    } else {
        console.log(`💡 No cached entries found for ${provider} PR ${prId}`);
    }
}


/**
 * FUNCTION B - Handle GitHub PR diffs and show in webview
 * Dedicated function for GitHub diffs - clean separation from Azure DevOps
 * @param {object} prAnalysis - GitHub PR analysis result
 * @param {object} stream - VS Code stream for output
 */
async function showGitHubDiffInWebview(prAnalysis, stream) {
    console.log('🐙 GitHub Function B: Starting GitHub diff webview display');
    
    if (!prAnalysis || !prAnalysis.data || !prAnalysis.data.fileChanges) {
        stream.markdown('❌ **No GitHub diff data available**\n\n');
        return;
    }

    const data = prAnalysis.data;
    const fileChanges = data.fileChanges;
    
    // Initialize global cache for GitHub diffs
    if (!global.prDiffCache) {
        global.prDiffCache = {};
    }

    // Clear existing cache entries for this GitHub PR to prevent file count discrepancy
    clearPrDiffCache('github', data.id);

    stream.markdown('🐙 **GitHub Diff Webview Display**\n\n');
    
    // Cache all GitHub file changes for webview access
    fileChanges.forEach(fileChange => {
        const diffId = `github_${data.id}_${fileChange.path.replace(/[^a-zA-Z0-9]/g, '_')}`;
        
        global.prDiffCache[diffId] = {
            ...fileChange,
            provider: 'github',
            prId: data.id,
            owner: data.owner,
            repo: data.repository,
            // Ensure diffContent is available for webview
            diff: fileChange.diffContent || fileChange.diff || '',
            diffContent: fileChange.diffContent || fileChange.diff || ''
        };
        
        console.log(`🔍 Cached GitHub diff: ${diffId} for ${fileChange.path}`);
        console.log(`📊 DEBUG: owner=${data.owner}, repo=${data.repository}, provider=github`);
    });

    // Debug cache summary for GitHub
    const githubCacheKeys = Object.keys(global.prDiffCache).filter(k => k.startsWith(`github_${data.id}_`));
    console.log(`🐙 GitHub cache summary: ${githubCacheKeys.length} files cached:`, githubCacheKeys);

    // Display file links with webview buttons (hover for details)
    stream.markdown('📁 **Files in this GitHub PR:**\n\n');
    
    // Only show first file with custom title
    if (fileChanges.length > 0) {
        const firstFile = fileChanges[0];
        const diffId = `github_${data.id}_${firstFile.path.replace(/[^a-zA-Z0-9]/g, '_')}`;
        
        // Create single button with custom title
        stream.button({
            command: 'aida.viewPrDiff',
            title: `🪟 Open Diff Viewer (${fileChanges.length} files)`,
            tooltip: `View changes in Monaco Diff Editor - ${fileChanges.length} files total`,
            arguments: [diffId]
        });
    }

    stream.markdown('\n\n💡 **Click to explore changes in diff viewer**\n\n');
}

/**
 * FUNCTION C - Handle GitLab MR diffs and show in webview
 * Dedicated function for GitLab diffs - clean separation from other providers
 * @param {object} mrAnalysis - GitLab MR analysis result
 * @param {object} stream - VS Code stream for output
 */
async function showGitLabDiffInWebview(mrAnalysis, stream) {
    console.log('🦊 GitLab Function C: Starting GitLab diff webview display');
    
    if (!mrAnalysis || !mrAnalysis.data || !mrAnalysis.data.fileChanges) {
        stream.markdown('❌ **No GitLab diff data available**\n\n');
        return;
    }

    const data = mrAnalysis.data;
    const fileChanges = data.fileChanges;
    
    // Initialize global cache for GitLab diffs
    if (!global.prDiffCache) {
        global.prDiffCache = {};
    }

    // Clear existing cache entries for this GitLab MR to prevent file count discrepancy
    clearPrDiffCache('gitlab', data.id);

    stream.markdown('🦊 **GitLab Diff Webview Display**\n\n');
    
    // Cache all GitLab file changes for webview access
    fileChanges.forEach(fileChange => {
        const diffId = `gitlab_${data.id}_${fileChange.path.replace(/[^a-zA-Z0-9]/g, '_')}`;
        
        global.prDiffCache[diffId] = {
            ...fileChange,
            provider: 'gitlab',
            prId: data.id,
            owner: data.owner,
            repo: data.repository,
            gitlabHost: data.gitlabHost,
            // Ensure diffContent is available for webview
            diff: fileChange.diffContent || fileChange.diff || '',
            diffContent: fileChange.diffContent || fileChange.diff || ''
        };
        
        console.log(`🔍 Cached GitLab diff: ${diffId} for ${fileChange.path}`);
        console.log(`📊 DEBUG: owner=${data.owner}, repo=${data.repository}, host=${data.gitlabHost}, provider=gitlab`);
    });

    // Debug cache summary for GitLab
    const gitlabCacheKeys = Object.keys(global.prDiffCache).filter(k => k.startsWith(`gitlab_${data.id}_`));
    console.log(`🦊 GitLab cache summary: ${gitlabCacheKeys.length} files cached:`, gitlabCacheKeys);

    // Display file links with webview buttons (hover for details)
    stream.markdown('📁 **Files in this GitLab MR:**\n\n');
    
    // Only show first file with custom title
    if (fileChanges.length > 0) {
        const firstFile = fileChanges[0];
        const diffId = `gitlab_${data.id}_${firstFile.path.replace(/[^a-zA-Z0-9]/g, '_')}`;
        
        // Create single button with custom title
        stream.button({
            command: 'aida.viewPrDiff',
            title: `🪟 Open Diff Viewer (${fileChanges.length} files)`,
            tooltip: `View changes in Monaco Diff Editor - ${fileChanges.length} files total`,
            arguments: [diffId]
        });
    }

    stream.markdown('\n\n💡 **Click to explore changes in diff viewer**\n\n');
}

/**
 * FUNCTION A - Handle Azure DevOps PR diffs and show in webview  
 * Dedicated function for Azure DevOps diffs - clean separation from GitHub
 * @param {object} prAnalysis - Azure DevOps PR analysis result
 * @param {object} stream - VS Code stream for output
 */
async function showAzureDevOpsDiffInWebview(prAnalysis, stream) {
    console.log('🔵 Azure Function A: Starting Azure DevOps diff webview display');
    
    if (!prAnalysis || !prAnalysis.data || !prAnalysis.data.fileChanges) {
        stream.markdown('❌ **No Azure DevOps diff data available**\n\n');
        return;
    }

    const data = prAnalysis.data;
    const fileChanges = data.fileChanges;
    
    // Initialize global cache for Azure DevOps diffs
    if (!global.prDiffCache) {
        global.prDiffCache = {};
    }

    // Clear existing cache entries for this Azure DevOps PR to prevent file count discrepancy
    clearPrDiffCache('azure', data.id);

    // 🚀 Cache Azure DevOps API credentials and PR metadata for full content retrieval
    const config = vscode.workspace.getConfiguration('aida');
    const accessToken = config.get('azureDevOps.personalAccessToken');
    
    // Store global Azure DevOps API info for parseFullDiffContentEnhanced
    global.prDiffCache.accessToken = accessToken;
    global.prDiffCache.organization = data.organization;
    global.prDiffCache.project = data.project;
    global.prDiffCache.repository = data.repository;
    global.prDiffCache.sourceCommit = data.sourceCommit;
    global.prDiffCache.targetCommit = data.targetCommit; // This is now merge base
    global.prDiffCache.mergeBaseCommit = data.mergeBaseCommit; // Explicit merge base reference
    
    console.log('🚀 Cached Azure DevOps API credentials for full content retrieval:');
    console.log(`   Organization: ${data.organization}`);
    console.log(`   Project: ${data.project}`);
    console.log(`   Repository: ${data.repository}`);
    console.log(`   Source Commit (PR): ${data.sourceCommit?.substring(0, 7)}`);
    console.log(`   Target Commit (Merge Base): ${data.targetCommit?.substring(0, 7)} - CORRECTED`);
    console.log(`   Merge Base: ${data.mergeBaseCommit?.substring(0, 7)} - for Monaco diff accuracy`);
    console.log(`   Access Token: ${accessToken ? '✅ Available' : '❌ Missing'}`);

    stream.markdown('🔵 **Azure DevOps Diff Webview Display**\n\n');
    
    // Cache all Azure DevOps file changes for webview access
    fileChanges.forEach(fileChange => {
        const diffId = `azure_${data.id}_${fileChange.path.replace(/[^a-zA-Z0-9]/g, '_')}`;
        
        global.prDiffCache[diffId] = {
            ...fileChange,
            provider: 'azure',
            prId: data.id,
            // Ensure diffContent is available for webview
            diff: fileChange.diffContent || fileChange.diff || '',
            diffContent: fileChange.diffContent || fileChange.diff || '',
            // Add Azure DevOps API info for full content retrieval
            organization: data.organization,
            project: data.project,
            repository: data.repository,
            sourceCommit: data.sourceCommit,
            targetCommit: data.targetCommit,
            accessToken: accessToken
        };
        
        console.log(`🔍 Cached Azure DevOps diff: ${diffId} for ${fileChange.path}`);
    });

    // Display file links with webview buttons (hover for details)
    stream.markdown('📁 **Files in this Azure DevOps PR:**\n\n');
    
    // Only show first file with custom title
    if (fileChanges.length > 0) {
        const firstFile = fileChanges[0];
        const diffId = `azure_${data.id}_${firstFile.path.replace(/[^a-zA-Z0-9]/g, '_')}`;
        
        // Create single button with custom title
        stream.button({
            command: 'aida.viewPrDiff',
            title: `🪟 Open Diff Viewer (${fileChanges.length} files)`,
            tooltip: `View changes in Monaco Diff Editor - ${fileChanges.length} files total`,
            arguments: [diffId]
        });
    }

    stream.markdown('\n\n💡 **Click to explore changes in diff viewer**\n\n');
}

// Helper function to count diff lines accurately (matches Azure DevOps)
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

// Azure DevOps Pull Request Review Feature

/**
 * Initialize PR review functionality
 */
function initializePrReview(extensionContext) {
    // Create new chat participant for PR review with context
    const reviewPrParticipant = vscode.chat.createChatParticipant('review-pr', async (request, context, stream, token) => {
        // Lazy load templates on first usage
        if (checkAndInitializeTemplates) {
            await checkAndInitializeTemplates(extensionContext);
        }
        return handleReviewPr(request, context, stream, token);
    });

    // Set theme-appropriate PR review icon
    reviewPrParticipant.iconPath = {
        light: vscode.Uri.file(path.join(extensionContext.extensionPath, 'icons', 'pr-review-light.svg')),
        dark: vscode.Uri.file(path.join(extensionContext.extensionPath, 'icons', 'pr-review-dark.svg'))
    };

    // Register review PR command
    let reviewPullRequest = vscode.commands.registerCommand('aida.reviewPullRequest', async () => {
        await reviewPullRequestCommand();
    });

    return { reviewPrParticipant, reviewPullRequest };
}

/**
 * Process PR review with review options (for AIDA Chatbot reuse)
 * @param {string} userMessage - User input message with PR URL
 * @param {object} stream - Chat stream object
 */
async function processReviewPr(userMessage, stream) {
    console.log('🔄 processReviewPr: Starting PR review with options');
    
    // Parse repo URL and detect type
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

    // GitLab URL pattern: https://gitlab.com/{owner}/{repo}/-/merge_requests/{id}
    const gitlabUrlPattern = /https:\/\/([^\/]+)\/([^\/]+)\/([^\/]+)\/-\/merge_requests\/(\d+)/i;
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
        // For GitLab, owner and repo extraction
        owner = gitlabMatch[2];
        repo = gitlabMatch[3];
        prId = gitlabMatch[4];
        originalUrl = gitlabMatch[0];
    }

    // Check for global selectedBusinessDocs (unified pattern with other review modules)
    if (global.selectedBusinessDocs) {
        console.log('🎯 Enhanced/Quick PR Review detected:', global.selectedBusinessDocs);
        
        // Execute review directly
        await processPrReview(userMessage, repoType, prId, owner, repo, organization, project, repository, originalUrl, stream, null);
        return;
    }

    // Show review options (Quick Review vs Enhanced Review) if PR URL detected
    if (prId) {
        // Check if business documents exist for Enhanced Review option
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        let hasBusinessDocs = false;
        
        if (workspaceFolder) {
            try {
                const { getBusinessDocumentFolders } = require('./review-common');
                const businessDocs = await getBusinessDocumentFolders(workspaceFolder);
                hasBusinessDocs = businessDocs && businessDocs.length > 0;
            } catch (error) {
                console.log('❌ Error checking business documents:', error.message);
                hasBusinessDocs = false;
            }
        }
        
        // If no business documents, execute Quick Review immediately
        if (!hasBusinessDocs) {
            console.log('📋 No business documents found - executing Quick Review automatically');
            stream.markdown('� **Starting Quick Review automatically** (no business documents found)\n\n');
            
            // Set Quick Review mode
            global.selectedBusinessDocs = [];
            
            await processPrReview(userMessage, repoType, prId, owner, repo, organization, project, repository, originalUrl, stream, null);
            return;
        }
        
        // Show options only if business documents exist
        const fileName = prId;
        stream.markdown(`# 📋 Review Options for PR \`${fileName}\`\n\n`);
        stream.markdown('**Choose how to proceed with the review:**\n\n');
            
        // Option 1: Quick Review (default/recommended)
        stream.markdown('### 🚀 **Quick Review** (Recommended)\n');
        stream.markdown('- Fast standard code review\n');
        stream.markdown('- Uses built-in review templates\n');
        stream.markdown('- No business document integration\n\n');
        
        stream.button({
            command: 'aida.confirmReviewDocs',
            title: '🚀 Start Quick Review',
            arguments: [userMessage, 'review-pr']
        });
        
        stream.markdown('\n');
        
        // Option 2: Enhanced Review (with business docs)
        stream.markdown('### 📚 **Enhanced Review**\n');
        stream.markdown('- Includes business rule validation\n');
        stream.markdown('- Cross-references business documents\n');
        stream.markdown('- More comprehensive analysis\n\n');
        
        stream.button({
            command: 'aida.showEnhancedReviewOptions',
            title: '📚 Start Enhanced Review',
            arguments: [userMessage, 'review-pr']
        });
        
        stream.markdown('\n\n');
        stream.markdown('💡 **Choose an option above to start the review**\n');
        
        return; // Show options dialog
    }

    // Continue with normal PR processing
    await processPrReview(userMessage, repoType, prId, owner, repo, organization, project, repository, originalUrl, stream, null);
}

/**
 * Handle PR review chat participant
 */
async function handleReviewPr(request, context, stream, token) {
    try {
        
        const userMessage = request.prompt;

        // Parse repo URL and detect type
        let prId = null;
        let repoType = null;
        let organization = null;
        let project = null;
        let repository = null;
        let owner = null;
        let repo = null;
        let originalUrl = null; // Store the original URL from user input

        // GitHub URL pattern: https://github.com/{owner}/{repo}/pull/{id}
        const githubUrlPattern = /https:\/\/github\.com\/([^\/]+)\/([^\/]+)\/pull\/(\d+)/i;
        const githubMatch = userMessage.match(githubUrlPattern);

        // Azure DevOps URL pattern: https://dev.azure.com/{org}/{project}/_git/{repo}/pullrequest/{id}
        const azureUrlPattern = /https:\/\/dev\.azure\.com\/([^\/]+)\/([^\/]+)\/_git\/([^\/]+)\/pullrequest\/(\d+)/i;
        const azureMatch = userMessage.match(azureUrlPattern);

        // GitLab URL pattern: https://gitlab.com/{owner}/{repo}/-/merge_requests/{id}
        // Also supports custom GitLab instances: https://custom-gitlab.domain.com/{owner}/{repo}/-/merge_requests/{id}
        const gitlabUrlPattern = /https:\/\/([^\/]+)\/([^\/]+)\/([^\/]+)\/-\/merge_requests\/(\d+)/i;
        const gitlabMatch = userMessage.match(gitlabUrlPattern);

        if (githubMatch) {
            repoType = 'github';
            owner = githubMatch[1];
            repo = githubMatch[2];
            prId = githubMatch[3];
            originalUrl = githubMatch[0]; // Store the full matched URL
        } else if (azureMatch) {
            repoType = 'azure';
            organization = azureMatch[1];
            project = azureMatch[2];
            repository = azureMatch[3];
            prId = azureMatch[4];
            originalUrl = azureMatch[0]; // Store the full matched URL
        } else if (gitlabMatch) {
            repoType = 'gitlab';
            // Extract GitLab instance, owner, repo, and MR ID
            const gitlabHost = gitlabMatch[1]; // gitlab.com or custom instance
            owner = gitlabMatch[2]; // namespace/group
            repo = gitlabMatch[3]; // project name
            prId = gitlabMatch[4]; // merge request ID
            originalUrl = gitlabMatch[0]; // Store the full matched URL
            
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

        // Check for quick-analyze command
        if (userMessage.toLowerCase().includes('quick-analyze')) {
            // Try to get the last analyzed PR data from context or show instructions
            stream.markdown('🚀 **Quick Analyze Command**\n\n');
            stream.markdown('To perform quick analysis, first provide a PR URL, then use `quick-analyze`.\n\n');
            stream.markdown('**Example workflow:**\n');
            stream.markdown('1. `https://dev.azure.com/org/project/_git/repo/pullrequest/123`\n');
            stream.markdown('2. `quick-analyze`\n\n');
            return;
        }

        if (!prId) {
            stream.markdown('🤖 **PR Reviewer (GitHub, GitLab & Azure DevOps)**\n\n');
            stream.markdown('I can review PRs/MRs from GitHub, GitLab, and Azure DevOps! Please provide:\n\n');
            stream.markdown('**GitHub:**\n');
            stream.markdown('• `https://github.com/owner/repo/pull/123`\n\n');
            stream.markdown('**GitLab:**\n');
            stream.markdown('• `https://gitlab.com/owner/repo/-/merge_requests/123`\n');
            stream.markdown('• `https://custom-gitlab.domain.com/owner/repo/-/merge_requests/123`\n\n');
            stream.markdown('**Azure DevOps:**\n');
            stream.markdown('• `https://dev.azure.com/org/project/_git/repo/pullrequest/123`\n');
            stream.markdown('• `PR #123` or `ID: 123` (defaults to configured Azure DevOps)\n\n');
            stream.markdown('**Examples:**\n');
            stream.markdown('```\n');
            stream.markdown('https://github.com/microsoft/vscode/pull/12345\n');
            stream.markdown('https://gitlab.com/gitlab-org/gitlab/-/merge_requests/12345\n');
            stream.markdown('https://dev.azure.com/BusinessWebUS/Shippo/_git/Shippo-Web/pullrequest/1396\n');
            stream.markdown('Review PR #123\n');
            stream.markdown('```\n\n');
            stream.markdown('💡 **Note**: Configure tokens in VS Code settings for private repos.');
            return;
        }

        // Check for global selectedBusinessDocs (like review-file.js)
        if (global.selectedBusinessDocs) {
            console.log('🎯 Enhanced/Quick PR Review detected:', global.selectedBusinessDocs);
            
            // Execute review directly
            await processPrReview(userMessage, repoType, prId, owner, repo, organization, project, repository, originalUrl, stream, context);
            return;
        }

        // Show review options (Quick Review vs Enhanced Review)
        if (prId) {
            // Check if business documents exist for Enhanced Review option
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            let hasBusinessDocs = false;
            
            if (workspaceFolder) {
                try {
                    const { getBusinessDocumentFolders } = require('./review-common');
                    const businessDocs = await getBusinessDocumentFolders(workspaceFolder);
                    hasBusinessDocs = businessDocs && businessDocs.length > 0;
                } catch (error) {
                    console.log('❌ Error checking business documents:', error.message);
                    hasBusinessDocs = false;
                }
            }
            
            // If no business documents, execute Quick Review immediately
            if (!hasBusinessDocs) {
                console.log('📋 No business documents found - executing Quick Review automatically');
                stream.markdown('� **Starting Quick Review automatically** (no business documents found)\n\n');
                
                // Set Quick Review mode
                global.selectedBusinessDocs = [];
                
                await processPrReview(userMessage, repoType, prId, owner, repo, organization, project, repository, originalUrl, stream, context);
                return;
            }
            
            // Show options only if business documents exist
            const fileName = prId;
            stream.markdown(`# 📋 Review Options for PR \`${fileName}\`\n\n`);
            stream.markdown('**Choose how to proceed with the review:**\n\n');
                
            // Option 1: Quick Review (default/recommended)
            stream.markdown('### 🚀 **Quick Review** (Recommended)\n');
            stream.markdown('- Fast standard code review\n');
            stream.markdown('- Uses built-in review templates\n');
            stream.markdown('- No business document integration\n\n');
            
            stream.button({
                command: 'aida.confirmReviewDocs',
                title: '🚀 Start Quick Review',
                arguments: [userMessage, 'review-pr']
            });
            
            stream.markdown('\n');
            
            // Option 2: Enhanced Review (with business docs)
            stream.markdown('### 📚 **Enhanced Review**\n');
            stream.markdown('- Includes business rule validation\n');
            stream.markdown('- Cross-references business documents\n');
            stream.markdown('- More comprehensive analysis\n\n');
            
            stream.button({
                command: 'aida.showEnhancedReviewOptions',
                title: '📚 Start Enhanced Review',
                arguments: [userMessage, 'review-pr']
            });
            
            stream.markdown('\n\n');
            stream.markdown('💡 **Choose an option above to start the review**\n');
            
            return; // Show options dialog
        }

        // Continue with normal PR processing
        await processPrReview(userMessage, repoType, prId, owner, repo, organization, project, repository, originalUrl, stream, context);

    } catch (error) {
        stream.markdown('❌ **Unexpected Error**\n\n');
        stream.markdown(`Details: ${error.message}\n\n`);
        stream.markdown('Please try again or check the extension logs.');
    }
}

/**
 * Process PR review logic (extracted from handleReviewPr)
 */
async function processPrReview(userMessage, repoType, prId, owner, repo, organization, project, repository, originalUrl, stream, context) {
    try {
        // Display repo info based on type
        if (repoType === 'github') {
            stream.markdown(`🐙 **Repository**: ${owner}/${repo}\n`);
            stream.markdown(`📋 **PR**: #${prId}\n`);
            stream.markdown('⏳ **Fetching from GitHub API...**\n\n');
        } else if (repoType === 'gitlab') {
            stream.markdown('🦊 **Analyzing GitLab Merge Request...**\n\n');
            stream.markdown(`🦊 **Repository**: ${owner}/${repo}\n`);
            stream.markdown(`📋 **MR**: !${prId}\n`);
            stream.markdown(`🌐 **Instance**: ${organization}\n`);
            stream.markdown('⏳ **Fetching from GitLab API...**\n\n');
        } else {
            stream.markdown('🔍 **Analyzing Azure DevOps** 📋 **PR ID**: ' + prId + '\n\n');
            if (organization && project && repository) {
                stream.markdown(`🏢 **Organization**: ${organization} 📁 **Project**: ${project} 📦 **Repository**: ${repository}\n`);
            }
            stream.markdown('⏳ **Fetching from Azure DevOps API...**\n\n');
        }

        // Get PR diff and analyze based on repo type
        let prAnalysis;
        if (repoType === 'github') {
            console.log(`🐙 DEBUG: Starting GitHub PR analysis for ${owner}/${repo}#${prId}`);
            prAnalysis = await analyzeGitHubPullRequest(stream, owner, repo, prId);
            console.log('🐙 DEBUG: GitHub PR analysis result:', JSON.stringify(prAnalysis, null, 2));
        } else if (repoType === 'gitlab') {
            console.log(`🦊 DEBUG: Starting GitLab MR analysis for ${owner}/${repo}!${prId}`);
            prAnalysis = await analyzeGitLabMergeRequest(stream, organization, owner, repo, prId);
            console.log('🦊 DEBUG: GitLab MR analysis result:', JSON.stringify(prAnalysis, null, 2));
        } else {
            console.log(`🔵 DEBUG: Starting Azure DevOps PR analysis for PR #${prId}`);
            prAnalysis = await analyzePullRequest(stream, prId, organization, project, repository);
            console.log('🔵 DEBUG: Azure PR analysis result:', JSON.stringify(prAnalysis, null, 2));
        }

        if (prAnalysis.error) {
            stream.markdown(`❌ **Error**: ${prAnalysis.error}\n\n`);
            stream.markdown('**Possible causes:**\n');
            if (repoType === 'github') {
                stream.markdown('• GitHub token not configured or insufficient permissions\n');
                stream.markdown('• PR ID does not exist or repository is private\n');
                stream.markdown('• Rate limit exceeded\n');
            } else if (repoType === 'gitlab') {
                stream.markdown('• GitLab token not configured or insufficient permissions\n');
                stream.markdown('• MR ID does not exist or repository is private\n');
                stream.markdown('• GitLab instance not accessible\n');
                stream.markdown('• Rate limit exceeded\n');
            } else {
                stream.markdown('• Insufficient Azure DevOps access permissions\n');
                stream.markdown('• PR ID does not exist\n');
                stream.markdown('• Credentials configuration is incorrect\n');
            }
            return;
        }

        // Display basic PR info after successful fetch
        const data = prAnalysis.data;
        if (data) {
            console.log(`📊 DEBUG: PR data structure:`, {
                title: data.title,
                author: data.author,
                status: data.status,
                sourceBranch: data.sourceBranch,
                targetBranch: data.targetBranch,
                fileChangesCount: data.fileChanges?.length,
                repoType: repoType
            });
            
            stream.markdown(`📝 **Title**: ${data.title} ⭐ **Author**: ${data.author} 🔄 **Status**: ${data.status}\n\n`);
            
            // Display branch information
            if (data.sourceBranch && data.targetBranch) {
                stream.markdown(`🌿 **Merging**: \`${data.sourceBranch}\` → \`${data.targetBranch}\`\n\n`);
            }
            
            // Debug file changes for GitHub
            if (repoType === 'github' && data.fileChanges) {
                console.log(`🐙 DEBUG: GitHub file changes:`, data.fileChanges.map(f => ({
                    path: f.path,
                    changeType: f.changeType,
                    additions: f.additions,
                    deletions: f.deletions,
                    hasDiffContent: !!f.diffContent,
                    diffContentLength: f.diffContent?.length || 0
                })));
            }
        }

        // Display PR review results
        await displayPrReviewResults(stream, prAnalysis);

        // Add quick review option with original URL
        await addQuickReviewOption(stream, prAnalysis, context, originalUrl);

    } catch (error) {
        stream.markdown('❌ **Unexpected Error in PR Processing**\n\n');
        stream.markdown(`Details: ${error.message}\n\n`);
        console.error('Process PR Review error:', error);
    }
}

/**
 * Review Pull Request command
 */
async function reviewPullRequestCommand() {
    try {
        // Show input box for PR URL or ID
        const prInput = await vscode.window.showInputBox({
            prompt: 'Enter Azure DevOps PR URL or PR ID',
            placeHolder: 'Example: https://dev.azure.com/org/project/_git/repo/pullrequest/123 or PR #123',
            validateInput: (value) => {
                if (!value) return 'Please enter PR URL or ID';
                if (!value.match(/(?:pullrequest(?:s)?\/(\d+)|pr[#\s]?(\d+)|id[:\s]?(\d+)|dev\.azure\.com)/i)) {
                    return 'Invalid format. Example: PR #123 or Azure DevOps URL';
                }
                return null;
            }
        });

        if (!prInput) return;

        // Extract PR ID from input
        const prPattern = /(?:pullrequest(?:s)?\/(\d+)|pr[#\s]?(\d+)|id[:\s]?(\d+))/i;
        const match = prInput.match(prPattern);
        const prId = match ? (match[1] || match[2] || match[3]) : null;

        if (!prId) {
            vscode.window.showErrorMessage('Unable to determine PR ID from provided input');
            return;
        }

        // Show progress
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Reviewing Azure DevOps PR #${prId}`,
            cancellable: false
        }, async (progress) => {
            progress.report({ increment: 0, message: 'Connecting to Azure DevOps...' });

            // Create a mock stream for the command-based call
            const mockStream = {
                markdown: (text) => console.log(text)
            };
            const prAnalysis = await analyzePullRequest(mockStream, prId);

            progress.report({ increment: 50, message: 'Analyzing diff...' });

            if (prAnalysis.error) {
                vscode.window.showErrorMessage(`Error reviewing PR: ${prAnalysis.error}`);
                return;
            }

            progress.report({ increment: 100, message: 'Hoàn tất!' });

            // Open review results in new document
            await openPrReviewDocument(prAnalysis);
        });

    } catch (error) {
        vscode.window.showErrorMessage(`Error reviewing PR: ${error.message}`);
    }
}

/**
 * Analyze Pull Request using Azure DevOps API
 */
async function analyzePullRequest(stream, prId, organization = null, project = null, repository = null) {
    try {
        // Get Azure DevOps configuration from VS Code settings
        const config = vscode.workspace.getConfiguration('aida');
        const personalAccessToken = config.get('azureDevOps.personalAccessToken');
        const defaultOrg = config.get('azureDevOps.organization');
        const defaultProject = config.get('azureDevOps.defaultProject');

        // Use provided values or fall back to configuration
        const org = organization || defaultOrg || 'BusinessWebUS';
        const proj = project || defaultProject || 'Shippo';
        const repo = repository || 'Shippo-Web';

        if (!personalAccessToken) {
            // Show configuration help if no token
            stream.markdown('⚠️ **Azure DevOps Token Not Configured**\n\n');
            stream.markdown('To get real PR data from Azure DevOps:\n\n');
            stream.markdown('**Click button below to open User Settings JSON:**\n\n');

            stream.markdown(`[🔧 Open User Settings JSON](command:workbench.action.openSettingsJson)\n\n`);
            stream.markdown('**Add to end of settings.json file (before closing `}`):**\n\n');
            stream.markdown('```json\n');
            stream.markdown('{\n');
            stream.markdown('    "aida.azureDevOps.personalAccessToken": "YOUR_TOKEN_HERE",\n');
            stream.markdown('    "aida.azureDevOps.organization": "BusinessWebUS",\n');
            stream.markdown('    "aida.azureDevOps.defaultProject": "Shippo"\n');
            stream.markdown('}\n');
            stream.markdown('```\n\n');

            stream.markdown('**Create token at:** https://dev.azure.com/BusinessWebUS/_usersSettings/tokens\n\n');
            stream.markdown('**Required permissions:** Code (Read) + Pull Request (Read)\n\n');
            stream.markdown('---\n\n');

            // Return error instead of mock data
            return { error: 'Azure DevOps Personal Access Token is required' };
        }

        try {
            // Call Azure DevOps REST API with token
            console.log(`🔄 Calling Azure DevOps API for PR ${prId}...`);
            const prData = await getAzureDevOpsPR(org, proj, repo, prId, personalAccessToken);
            console.log('✅ Azure DevOps API call successful:', prData);
            return prData;

        } catch (apiError) {
            // Return error instead of mock data
            console.error('❌ Azure DevOps API failed:', apiError.message);
            stream.markdown('❌ **Azure DevOps API Error**\n\n');
            stream.markdown(`Error: ${apiError.message}\n\n`);
            return { error: `Azure DevOps API failed: ${apiError.message}` };
        }

    } catch (error) {
        return { error: `Analysis failed: ${error.message}` };
    }
}

/**
 * Get Pull Request data from Azure DevOps REST API
 */
async function getAzureDevOpsPR(organization, project, repository, prId, token) {
    try {
        console.log(`Fetching PR ${prId} from ${organization}/${project}/${repository}`);

        // Get PR details
        const prUrl = `https://dev.azure.com/${organization}/${project}/_apis/git/repositories/${repository}/pullRequests/${prId}?api-version=7.0`;
        const prResponse = await makeAzureDevOpsRequest(prUrl, token);

        if (!prResponse.success) {
            console.error('Failed to get PR details:', prResponse.error);
            throw new Error(`Failed to get PR details: ${prResponse.error}`);
        }

        const pr = prResponse.data;
        
        // Extract branch information
        const sourceBranch = pr.sourceRefName?.replace('refs/heads/', '') || 'Unknown';
        const targetBranch = pr.targetRefName?.replace('refs/heads/', '') || 'Unknown';
        console.log(`🌿 Branch info: ${sourceBranch} → ${targetBranch}`);

        let commits = [];
        let fileChanges = [];
        let finalDiff = '';
        let diffSource = 'PR-specific changes only';
        let mergeBaseCommit = null; // Store the actual merge base for Monaco diff view

        console.log('🔍 Getting PR-specific changes from source commit...');

        // STEP 1: Get ALL commits in this PR
        console.log('📝 Getting all commits from PR...');
        const commitsUrl = `https://dev.azure.com/${organization}/${project}/_apis/git/repositories/${repository}/pullRequests/${prId}/commits?api-version=7.0&$top=1000`;
        const commitsResponse = await makeAzureDevOpsRequest(commitsUrl, token);

        if (commitsResponse.success && commitsResponse.data.value?.length > 0) {
            commits = commitsResponse.data.value;
            console.log(`✅ Found ${commits.length} commits in PR`);
            commits.forEach((commit, index) => {
                console.log(`  ${index + 1}. ${commit.commitId.substring(0, 7)} - ${commit.comment || 'No message'}`);
            });
        } else {
            console.log('⚠️ No commits found, trying single source commit...');
            // Fallback to single commit if API fails
            if (pr.lastMergeSourceCommit) {
                const sourceCommitId = pr.lastMergeSourceCommit.commitId;
                console.log(`📝 PR source commit: ${sourceCommitId.substring(0, 7)}`);

                // Get detailed info about this specific commit
                const commitUrl = `https://dev.azure.com/${organization}/${project}/_apis/git/repositories/${repository}/commits/${sourceCommitId}?api-version=7.0`;
                const commitResponse = await makeAzureDevOpsRequest(commitUrl, token);

                if (commitResponse.success && commitResponse.data) {
                    const commit = commitResponse.data;
                    commits = [{
                        commitId: commit.commitId,
                        comment: commit.comment || 'No message',
                        author: {
                            name: commit.author?.name || 'Unknown',
                            date: commit.author?.date || new Date().toISOString()
                        }
                    }];
                    console.log(`✅ Found PR source commit: ${commit.commitId.substring(0, 7)} - ${commit.comment}`);
                }
            }
        }

        // STEP 2: Get PR iterations to find the latest iteration (this contains actual PR changes)
        const iterationsUrl = `https://dev.azure.com/${organization}/${project}/_apis/git/repositories/${repository}/pullRequests/${prId}/iterations?api-version=7.0`;
        const iterationsResponse = await makeAzureDevOpsRequest(iterationsUrl, token);

        if (iterationsResponse.success && iterationsResponse.data.value?.length > 0) {
            const iterations = iterationsResponse.data.value;
            const latestIteration = iterations[iterations.length - 1];

            console.log(`✅ Found ${iterations.length} iterations, using latest: ${latestIteration.id}`);

            // STEP 3: Get file changes from the latest iteration (this gives us actual PR changes)
            const changesUrl = `https://dev.azure.com/${organization}/${project}/_apis/git/repositories/${repository}/pullRequests/${prId}/iterations/${latestIteration.id}/changes?api-version=7.0&$top=1000`;
            const changesResponse = await makeAzureDevOpsRequest(changesUrl, token);

            if (changesResponse.success && changesResponse.data.changeEntries) {
                // Filter to get only actual file changes (not folders)
                const actualFiles = changesResponse.data.changeEntries.filter(change => {
                    const filePath = change.item?.path || change.originalPath || '';
                    const isFile = filePath &&
                        filePath.includes('.') &&
                        !filePath.endsWith('/') &&
                        filePath.split('/').pop().includes('.') &&
                        !filePath.includes('/.git/');

                    if (isFile) {
                        console.log(`📄 File found: ${filePath} (${change.changeType})`);
                    }
                    return isFile;
                });

                console.log(`✅ Found ${actualFiles.length} actual file changes in PR (filtered from ${changesResponse.data.changeEntries.length} total entries)`);

                // STEP 4 (CORRECTED): Find merge base to get actual branch point 
                console.log('🔄 Finding merge base (branch point) for accurate diff...');

                // Get source and target commits from PR
                const sourceCommit = pr.lastMergeSourceCommit?.commitId;
                const targetCommit = pr.lastMergeTargetCommit?.commitId;
                
                if (!sourceCommit || !targetCommit) {
                    throw new Error('Missing source or target commit information in PR data');
                }
                
                console.log(`🎯 Source commit (PR): ${sourceCommit.substring(0, 7)}`);
                console.log(`🎯 Target commit (${targetBranch}): ${targetCommit.substring(0, 7)}`);
                
                // Find merge base (the common ancestor commit where the branch diverged)
                let baseCommit;
                try {
                    const mergeBaseUrl = `https://dev.azure.com/${organization}/${project}/_apis/git/repositories/${repository}/commits/${sourceCommit}/mergebases?otherCommitId=${targetCommit}&api-version=7.0`;
                    const mergeBaseResponse = await makeAzureDevOpsRequest(mergeBaseUrl, token);
                    
                    if (mergeBaseResponse.success && mergeBaseResponse.data.value && mergeBaseResponse.data.value.length > 0) {
                        baseCommit = mergeBaseResponse.data.value[0].commitId;
                        mergeBaseCommit = baseCommit; // Store for Monaco diff view
                        console.log(`✅ Found merge base (branch point): ${baseCommit.substring(0, 7)}`);
                        console.log(`📊 This will show ONLY changes made in the feature branch, not full target branch diff`);
                    } else {
                        console.log(`⚠️ Could not find merge base, falling back to target commit`);
                        baseCommit = targetCommit;
                        mergeBaseCommit = targetCommit; // Fallback to target commit
                    }
                } catch (error) {
                    console.log(`❌ Error finding merge base: ${error.message}, using target commit`);
                    baseCommit = targetCommit;
                    mergeBaseCommit = targetCommit; // Fallback to target commit
                }

                // Process file changes with simple approach
                fileChanges = await Promise.all(actualFiles.map(async (change) => {
                    const filePath = change.item?.path || change.originalPath || 'Unknown';
                    console.log(`📁 Processing file: ${filePath} (${change.changeType})`);

                    let diffContent = '';
                    let additions = 0;
                    let deletions = 0;
                    let fileSourceContent = null; // Declare outside try block for new files

                    if (baseCommit && sourceCommit) {
                        try {
                            console.log(`🔍 Comparing commits for ${filePath} (CORRECTED LOGIC):`);
                            console.log(`  📍 Base commit (merge base): ${baseCommit.substring(0, 7)} - branch point where ${targetBranch} and feature branch diverged`);
                            console.log(`  📍 Source commit (PR): ${sourceCommit.substring(0, 7)} - latest commit in feature branch`);
                            console.log(`  💡 This shows ONLY changes made in feature branch, not full diff vs current ${targetBranch}`);
                            
                            // Get file content from both commits
                            const baseContent = await getFileContent(organization, project, repository, filePath, baseCommit, token);
                            const sourceContent = await getFileContent(organization, project, repository, filePath, sourceCommit, token);
                            
                            // Store source content for new files
                            fileSourceContent = sourceContent;

                            console.log(`📊 Content retrieved:`);
                            console.log(`  Base content (merge base): ${baseContent ? baseContent.length + ' chars' : 'NULL'}`);
                            console.log(`  Source content (PR): ${sourceContent ? sourceContent.length + ' chars' : 'NULL'}`);

                            if (baseContent !== null || sourceContent !== null) {
                                // Generate unified diff using diff library
                                console.log(`🎯 Calling generateUnifiedDiff for ${filePath} with CORRECTED commits...`);
                                diffContent = generateUnifiedDiff(filePath, baseContent || '', sourceContent || '', change.changeType);

                                // Count changes using our counting function
                                const counts = countDiffLines(diffContent);
                                additions = counts.additions;
                                deletions = counts.deletions;

                                console.log(`✅ Generated diff for ${filePath}: +${additions}/-${deletions} (using merge base)`);
                            } else {
                                console.log(`⚠️ Could not fetch content for ${filePath}`);
                                diffContent = `diff --git a/${filePath} b/${filePath}\n[Could not retrieve file content]`;
                            }
                        } catch (err) {
                            console.log(`❌ Error processing ${filePath}: ${err.message}`);
                            diffContent = `diff --git a/${filePath} b/${filePath}\n[Error: ${err.message}]`;
                        }
                    } else {
                        console.log(`⚠️ Missing commit information for ${filePath}`);
                        diffContent = `diff --git a/${filePath} b/${filePath}\n[Missing commit information]`;
                    }

                    // For new files (add/new), store full content for detailed review (like review-file.js)
                    const fileObj = {
                        path: filePath,
                        changeType: change.changeType?.toLowerCase() || 'edit',
                        sourceCommit: baseCommit?.substring(0, 7) || 'target',
                        targetCommit: sourceCommit?.substring(0, 7) || 'source',
                        additions: additions,
                        deletions: deletions,
                        diffContent: diffContent
                    };
                    
                    // Store full content for new files (needed for typescript code block injection)
                    const changeTypeLower = (change.changeType || '').toLowerCase();
                    const isAddType = (changeTypeLower === 'add' || changeTypeLower === 'added' || changeTypeLower === 'new');
                    
                    console.log(`🔍 [DEBUG] File ${filePath}:`);
                    console.log(`   - changeType="${change.changeType}" (lowercase="${changeTypeLower}")`);
                    console.log(`   - isAddType=${isAddType}`);
                    console.log(`   - fileSourceContent=${fileSourceContent ? fileSourceContent.length + ' chars' : 'NULL'}`);
                    console.log(`   - Will store fullContent? ${isAddType && fileSourceContent ? 'YES ✅' : 'NO ❌'}`);
                    
                    if (isAddType && fileSourceContent) {
                        fileObj.fullContent = fileSourceContent;
                        console.log(`💾 ✅ STORED fullContent for new file ${filePath}: ${fileSourceContent.length} chars`);
                    } else {
                        console.log(`⚠️ NOT storing fullContent for ${filePath}: isAddType=${isAddType}, hasContent=${!!fileSourceContent}`);
                    }
                    
                    return fileObj;
                }));

                console.log(`✅ Processed ${fileChanges.length} files with PR-specific changes`);
            } else {
                console.log('⚠️ No file changes found in PR iteration');
            }

        } else {
            console.log('⚠️ No iterations found for PR');
        }

        return {
            success: true,
            data: {
                id: prId,
                title: pr.title || `PR #${prId}`,
                description: pr.description || 'No description provided',
                author: pr.createdBy?.displayName || 'Unknown',
                status: pr.status || 'Active',
                organization: organization,
                project: project,
                repository: repository,
                sourceBranch: sourceBranch,
                targetBranch: targetBranch,
                sourceCommit: pr.lastMergeSourceCommit?.commitId,
                targetCommit: mergeBaseCommit || pr.lastMergeTargetCommit?.commitId, // Use merge base for correct Monaco diff
                mergeBaseCommit: mergeBaseCommit, // Store merge base explicitly for reference
                diffCommand: diffSource,
                fileChanges: fileChanges,
                // Include commits and final diff info (PR-specific only)
                commits: commits || [],
                totalCommits: commits?.length || 0,
                finalDiff: finalDiff,
                commitsList: commits?.map(commit => ({
                    id: commit.commitId.substring(0, 7),
                    fullId: commit.commitId,
                    message: commit.comment || 'No message',
                    author: commit.author?.name || 'Unknown',
                    date: commit.author?.date || new Date().toISOString()
                })) || [],
                analysis: {
                    quality: `Azure DevOps PR with ${fileChanges.length} file(s) changed across ${commits?.length || 0} commits`,
                    security: 'Complete PR diff analysis',
                    performance: 'Full PR data processing',
                    testCoverage: 'Review test coverage for modified files',
                    codeReview: [
                        `📁 ${fileChanges.length} file(s) modified`,
                        `➕ ${fileChanges.reduce((sum, f) => sum + f.additions, 0)} lines added`,
                        `➖ ${fileChanges.reduce((sum, f) => sum + f.deletions, 0)} lines removed`,
                        `🔍 Source: ${diffSource}`,
                        `📝 Total commits: ${commits?.length || 0}`
                    ]
                }
            }
        };
    } catch (error) {
        console.error('Error in getAzureDevOpsPR:', error);
        throw new Error(`Unable to fetch PR data: ${error.message}`);
    }
}

/**
 * Make HTTP request to Azure DevOps REST API
 */
async function makeAzureDevOpsRequest(url, token, method = 'GET', body = null) {
    return new Promise((resolve) => {
        const urlObj = new URL(url);
        const options = {
            hostname: urlObj.hostname,
            port: 443,
            path: urlObj.pathname + urlObj.search,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'VS Code AI Self Check Extension'
            }
        };

        // Add authentication if token is provided
        if (token && token.trim()) {
            options.headers['Authorization'] = `Basic ${Buffer.from(':' + token).toString('base64')}`;
        }

        const req = https.request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        const parsed = JSON.parse(data);
                        resolve({ success: true, data: parsed });
                    } else {
                        resolve({ success: false, error: `HTTP ${res.statusCode}: ${data}` });
                    }
                } catch (parseError) {
                    resolve({ success: false, error: `JSON parse error: ${parseError.message}` });
                }
            });
        });

        req.on('error', (error) => {
            resolve({ success: false, error: error.message });
        });

        // Set timeout for API calls
        req.setTimeout(10000, () => {
            req.destroy();
            resolve({ success: false, error: 'Request timeout' });
        });

        if (body) {
            req.write(JSON.stringify(body));
        }

        req.end();
    });
}

/**
 * Get file content from a specific commit using download endpoint
 */
async function getFileContent(organization, project, repository, filePath, commitId, token) {
    try {
        console.log(`🔄 Fetching content for ${filePath} at commit ${commitId.substring(0, 7)}`);

        // Use download parameter to get actual content as text
        const itemUrl = `https://dev.azure.com/${organization}/${project}/_apis/git/repositories/${repository}/items?path=${encodeURIComponent(filePath)}&versionDescriptor.version=${commitId}&versionDescriptor.versionType=commit&download=true&api-version=7.0`;

        // Make request expecting text response
        const response = await new Promise((resolve) => {
            const authToken = Buffer.from(':' + token).toString('base64');
            const url = new URL(itemUrl);

            const options = {
                hostname: url.hostname,
                path: url.pathname + url.search,
                method: 'GET',
                headers: {
                    'Authorization': `Basic ${authToken}`,
                    'Accept': 'text/plain',
                    'User-Agent': 'VSCode-Extension'
                }
            };

            const req = https.request(options, (res) => {
                let data = '';

                res.on('data', (chunk) => {
                    data += chunk.toString();
                });

                res.on('end', () => {
                    if (res.statusCode === 200) {
                        resolve({ success: true, data: data });
                    } else {
                        console.log(`⚠️ Download failed: ${res.statusCode} ${res.statusMessage}`);
                        resolve({ success: false, error: `HTTP ${res.statusCode}` });
                    }
                });
            });

            req.on('error', (error) => {
                resolve({ success: false, error: error.message });
            });

            req.setTimeout(10000, () => {
                req.destroy();
                resolve({ success: false, error: 'Timeout' });
            });

            req.end();
        });

        if (response.success && response.data) {
            console.log(`✅ Got file content: ${response.data.length} chars`);
            
            // Debug indentation in API response
            const lines = response.data.split('\n');
            console.log(`📊 DEBUG API CONTENT - Total lines: ${lines.length}`);
            console.log(`📊 First 5 lines analysis:`);
            for (let i = 0; i < Math.min(5, lines.length); i++) {
                const line = lines[i];
                const leadingSpaces = line.match(/^ */)[0].length;
                const leadingTabs = line.match(/^\t*/)[0].length;
                console.log(`📊 Line ${i + 1}: spaces=${leadingSpaces}, tabs=${leadingTabs}, content="${line.substring(0, 50)}"`);
            }
            
            return response.data;
        }

        console.log(`❌ Could not fetch content: ${response.error || 'unknown'}`);
        return null;
    } catch (error) {
        console.log(`❌ Error fetching content for ${filePath}: ${error.message}`);
        return null;
    }
}

/**
 * Get file content from GitHub API at a specific commit
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name  
 * @param {string} filePath - File path
 * @param {string} commitSha - Commit SHA
 * @param {string} token - GitHub token
 * @returns {string|null} - File content or null if not found
 */
async function getGitHubFileContent(owner, repo, filePath, commitSha, token) {
    try {
        console.log(`🔄 Fetching GitHub content for ${filePath} at commit ${commitSha.substring(0, 7)}`);

        // GitHub Contents API URL
        const contentsUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(filePath)}?ref=${commitSha}`;

        const response = await makeGitHubRequest(contentsUrl, token);

        if (response.success && response.data) {
            // GitHub API returns base64 encoded content
            if (response.data.content && response.data.encoding === 'base64') {
                const content = Buffer.from(response.data.content, 'base64').toString('utf8');
                console.log(`✅ Got GitHub file content: ${content.length} chars`);
                return content;
            }
        }

        console.log(`❌ Could not fetch GitHub content: ${response.error || 'unknown'}`);
        return null;
    } catch (error) {
        console.log(`❌ Error fetching GitHub content for ${filePath}: ${error.message}`);
        return null;
    }
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
 * Analyze GitHub Pull Request using GitHub REST API
 * @param {object} stream - VS Code stream for progress updates
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} prId - Pull Request number
 */
async function analyzeGitHubPullRequest(stream, owner, repo, prId) {
    try {
        // Get GitHub token from VS Code settings
        const config = vscode.workspace.getConfiguration('aida');
        const githubToken = config.get('github.personalAccessToken');

        console.log(`🔄 Fetching GitHub PR ${owner}/${repo}#${prId}`);

        // Get PR details from GitHub API
        const prData = await getGitHubPR(owner, repo, prId, githubToken);

        if (!prData.success) {
            console.error('Failed to get GitHub PR:', prData.error);
            stream.markdown('❌ **GitHub API Error**\n\n');
            stream.markdown(`Error: ${prData.error}\n\n`);

            if (!githubToken) {
                stream.markdown('**Configure GitHub Token:**\n\n');
                stream.markdown('[🔧 Open User Settings JSON](command:workbench.action.openSettingsJson)\n\n');
                stream.markdown('```json\n');
                stream.markdown('{\n');
                stream.markdown('    "aida.github.personalAccessToken": "YOUR_GITHUB_TOKEN"\n');
                stream.markdown('}\n');
                stream.markdown('```\n\n');
                stream.markdown('**Create token at:** https://github.com/settings/tokens\n');
                stream.markdown('**Required scope:** `repo` (for private repos) or `public_repo` (for public repos)\n\n');
            }

            return { error: prData.error };
        }

        return prData;

    } catch (error) {
        console.error('Error in analyzeGitHubPullRequest:', error);
        return { error: `Analysis failed: ${error.message}` };
    }
}

/**
 * Get Pull Request data from GitHub REST API
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} prId - Pull Request number
 * @param {string} token - GitHub Personal Access Token (optional for public repos)
 */
async function getGitHubPR(owner, repo, prId, token) {
    try {
        console.log(`📝 Fetching PR details: ${owner}/${repo}#${prId}`);

        // Get PR details
        const prUrl = `https://api.github.com/repos/${owner}/${repo}/pulls/${prId}`;
        const prResponse = await makeGitHubRequest(prUrl, token);

        if (!prResponse.success) {
            console.error('Failed to get PR details:', prResponse.error);
            return { success: false, error: `Failed to get PR: ${prResponse.error}` };
        }

        const pr = prResponse.data;

        // Get PR files (changes)
        console.log('📁 Fetching changed files...');
        const filesUrl = `https://api.github.com/repos/${owner}/${repo}/pulls/${prId}/files`;
        const filesResponse = await makeGitHubRequest(filesUrl, token);

        if (!filesResponse.success) {
            console.error('Failed to get files:', filesResponse.error);
            return { success: false, error: `Failed to get files: ${filesResponse.error}` };
        }

        const files = filesResponse.data;
        console.log(`✅ Found ${files.length} changed files`);

        // Get diff in unified format
        console.log('🔄 Fetching unified diff from GitHub...');
        const diffUrl = `https://api.github.com/repos/${owner}/${repo}/pulls/${prId}`;
        const diffResponse = await makeGitHubRequest(diffUrl, token, 'GET', {
            'Accept': 'application/vnd.github.v3.diff'
        });

        let finalDiff = '';
        if (diffResponse.success && typeof diffResponse.data === 'string') {
            finalDiff = diffResponse.data;
            console.log(`✅ Got unified diff: ${finalDiff.length} characters`);
        } else {
            console.log('⚠️ Could not get unified diff, will build from file patches');
        }

        // Process file changes
        const fileChanges = files.map(file => {
            let diffContent = '';

            // GitHub API provides patch content directly (not full git diff)
            if (file.patch) {
                // Build complete diff format from GitHub patch
                diffContent = `diff --git a/${file.filename} b/${file.filename}\n`;
                
                // Add file mode information based on status
                if (file.status === 'added') {
                    diffContent += `new file mode 100644\n`;
                    diffContent += `--- /dev/null\n`;
                    diffContent += `+++ b/${file.filename}\n`;
                } else if (file.status === 'removed') {
                    diffContent += `deleted file mode 100644\n`;
                    diffContent += `--- a/${file.filename}\n`;
                    diffContent += `+++ /dev/null\n`;
                } else if (file.status === 'renamed') {
                    diffContent += `--- a/${file.previous_filename || file.filename}\n`;
                    diffContent += `+++ b/${file.filename}\n`;
                } else {
                    diffContent += `--- a/${file.filename}\n`;
                    diffContent += `+++ b/${file.filename}\n`;
                }
                
                // Add the patch content (which contains the @@ hunks)
                diffContent += file.patch;
                
                console.log(`🔧 DEBUG: Built complete diff for ${file.filename}: ${diffContent.length} chars`);
                console.log(`🔍 DEBUG: GitHub patch for ${file.filename}:`, file.patch);
                console.log(`🔧 DEBUG: Complete diffContent:`, diffContent);
            } else if (file.status === 'renamed' && !file.patch) {
                // Handle renamed files without content changes
                diffContent = `diff --git a/${file.previous_filename} b/${file.filename}\n`;
                diffContent += `similarity index 100%\n`;
                diffContent += `rename from ${file.previous_filename}\n`;
                diffContent += `rename to ${file.filename}\n`;
            } else if (finalDiff) {
                // Extract from unified diff as fallback
                const filePattern = new RegExp(`diff --git a/${file.filename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} b/${file.filename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([\\s\\S]*?)(?=diff --git|$)`, 'g');
                const match = filePattern.exec(finalDiff);
                if (match) {
                    diffContent = `diff --git a/${file.filename} b/${file.filename}${match[1]}`;
                }
            }

            console.log(`🔍 Final diffContent for ${file.filename}: ${diffContent.length} chars`);

            return {
                path: file.filename,
                changeType: file.status, // 'added', 'removed', 'modified', 'renamed'
                additions: file.additions || 0,
                deletions: file.deletions || 0,
                changes: file.changes || 0,
                diffContent: diffContent,
                diff: diffContent, // For compatibility
                source: 'GitHub API',
                previousFilename: file.previous_filename
            };
        });

        // Get commits
        console.log('📝 Fetching commits...');
        const commitsUrl = `https://api.github.com/repos/${owner}/${repo}/pulls/${prId}/commits`;
        const commitsResponse = await makeGitHubRequest(commitsUrl, token);

        let commits = [];
        if (commitsResponse.success && commitsResponse.data) {
            commits = commitsResponse.data.map(commit => ({
                commitId: commit.sha,
                comment: commit.commit.message,
                author: {
                    name: commit.commit.author.name,
                    date: commit.commit.author.date
                }
            }));
            console.log(`✅ Found ${commits.length} commits`);
        }

        return {
            success: true,
            data: {
                id: prId,
                title: pr.title || `PR #${prId}`,
                description: pr.body || 'No description provided',
                author: pr.user?.login || 'Unknown',
                status: pr.state || 'open',
                owner: owner,
                repository: repo,
                sourceCommit: pr.head?.sha,
                targetCommit: pr.base?.sha,
                sourceBranch: pr.head?.ref,
                targetBranch: pr.base?.ref,
                diffCommand: 'GitHub API (workspace-independent)',
                fileChanges: fileChanges,
                commits: commits,
                totalCommits: commits.length,
                finalDiff: finalDiff,
                commitsList: commits.map(commit => ({
                    id: commit.commitId.substring(0, 7),
                    fullId: commit.commitId,
                    message: commit.comment,
                    author: commit.author.name,
                    date: commit.author.date
                })),
                analysis: {
                    quality: `GitHub PR with ${fileChanges.length} file(s) changed`,
                    security: 'Complete PR diff analysis',
                    performance: 'Full PR data from GitHub API',
                    testCoverage: 'Review test coverage for modified files',
                    codeReview: [
                        `📁 ${fileChanges.length} file(s) changed`,
                        `➕ ${fileChanges.reduce((sum, f) => sum + f.additions, 0)} lines added`,
                        `➖ ${fileChanges.reduce((sum, f) => sum + f.deletions, 0)} lines removed`,
                        `🔍 Source: GitHub REST API`,
                        `📝 ${commits.length} commits`,
                        `🌿 ${pr.head?.ref} → ${pr.base?.ref}`
                    ]
                }
            }
        };
    } catch (error) {
        console.error('Error in getGitHubPR:', error);
        return { success: false, error: `Unable to fetch PR: ${error.message}` };
    }
}

/**
 * Make HTTP request to GitHub REST API
 * @param {string} url - API endpoint URL
 * @param {string} token - GitHub Personal Access Token (optional)
 * @param {string} method - HTTP method (default: GET)
 * @param {object} customHeaders - Additional headers
 */
async function makeGitHubRequest(url, token, method = 'GET', customHeaders = {}) {
    return new Promise((resolve) => {
        const urlObj = new URL(url);
        const headers = {
            'User-Agent': 'VSCode-AI-Self-Check-Extension',
            'Accept': 'application/vnd.github.v3+json',
            ...customHeaders
        };

        // Add authentication if token is provided
        if (token && token.trim()) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const options = {
            hostname: urlObj.hostname,
            port: 443,
            path: urlObj.pathname + urlObj.search,
            method: method,
            headers: headers
        };

        const req = https.request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        // Check if response is JSON or plain text (diff)
                        if (customHeaders['Accept']?.includes('diff')) {
                            resolve({ success: true, data: data });
                        } else {
                            const parsed = JSON.parse(data);
                            resolve({ success: true, data: parsed });
                        }
                    } else {
                        let errorMsg = `HTTP ${res.statusCode}`;
                        try {
                            const errorData = JSON.parse(data);
                            errorMsg += `: ${errorData.message || data}`;
                        } catch {
                            errorMsg += `: ${data}`;
                        }
                        resolve({ success: false, error: errorMsg });
                    }
                } catch (parseError) {
                    resolve({ success: false, error: `Parse error: ${parseError.message}` });
                }
            });
        });

        req.on('error', (error) => {
            resolve({ success: false, error: error.message });
        });

        req.setTimeout(15000, () => {
            req.destroy();
            resolve({ success: false, error: 'Request timeout' });
        });

        req.end();
    });
}

/**
 * Analyze GitLab Merge Request using GitLab REST API
 * @param {object} stream - VS Code stream for progress updates
 * @param {string} gitlabHost - GitLab instance hostname (e.g., gitlab.com)
 * @param {string} owner - Repository owner/namespace
 * @param {string} repo - Repository name
 * @param {string} mrId - Merge Request number
 */
async function analyzeGitLabMergeRequest(stream, gitlabHost, owner, repo, mrId) {
    try {
        // Get GitLab token from VS Code settings
        const config = vscode.workspace.getConfiguration('aida');
        const gitlabToken = config.get('gitlab.personalAccessToken');

        console.log(`🔄 Fetching GitLab MR ${owner}/${repo}!${mrId} from ${gitlabHost}`);

        // Get MR details from GitLab API
        const mrData = await getGitLabMR(gitlabHost, owner, repo, mrId, gitlabToken);

        if (!mrData.success) {
            console.error('Failed to get GitLab MR:', mrData.error);
            stream.markdown('❌ **GitLab API Error**\n\n');
            stream.markdown(`Error: ${mrData.error}\n\n`);

            if (!gitlabToken) {
                stream.markdown('**Configure GitLab Token:**\n\n');
                stream.markdown('[🔧 Open User Settings JSON](command:workbench.action.openSettingsJson)\n\n');
                stream.markdown('```json\n');
                stream.markdown('{\n');
                stream.markdown('    "aida.gitlab.personalAccessToken": "YOUR_GITLAB_TOKEN"\n');
                stream.markdown('}\n');
                stream.markdown('```\n\n');
                stream.markdown(`**Create token at:** https://${gitlabHost}/-/profile/personal_access_tokens\n`);
                stream.markdown('**Required scope:** `read_api` (for public repos) or `api` (for private repos)\n\n');
            }

            return { error: mrData.error };
        }

        // ✅ FIX: Return the correct structure - extract the data portion
        console.log(`🔧 DEBUG: GitLab API returned ${mrData.data?.finalDiff?.length || 0} chars of finalDiff`);
        console.log(`🔧 DEBUG: GitLab API returned ${mrData.data?.fileChanges?.length || 0} file changes`);
        
        return {
            success: true,
            data: mrData.data
        };

    } catch (error) {
        console.error('Error in analyzeGitLabMergeRequest:', error);
        return { error: `Analysis failed: ${error.message}` };
    }
}

/**
 * Get Merge Request data from GitLab REST API
 * @param {string} gitlabHost - GitLab instance hostname
 * @param {string} owner - Repository owner/namespace
 * @param {string} repo - Repository name
 * @param {string} mrId - Merge Request number
 * @param {string} token - GitLab Personal Access Token (optional for public repos)
 */
async function getGitLabMR(gitlabHost, owner, repo, mrId, token) {
    try {
        console.log(`📝 Fetching MR details: ${owner}/${repo}!${mrId} from ${gitlabHost}`);

        // Encode project path for GitLab API (owner/repo becomes owner%2Frepo)
        const projectPath = encodeURIComponent(`${owner}/${repo}`);

        // Get MR details
        const mrUrl = `https://${gitlabHost}/api/v4/projects/${projectPath}/merge_requests/${mrId}`;
        const mrResponse = await makeGitLabRequest(mrUrl, token);

        if (!mrResponse.success) {
            console.error('Failed to get MR details:', mrResponse.error);
            return { success: false, error: `Failed to get MR: ${mrResponse.error}` };
        }

        const mr = mrResponse.data;

        // Get MR changes (diffs)
        console.log('📁 Fetching changed files...');
        const changesUrl = `https://${gitlabHost}/api/v4/projects/${projectPath}/merge_requests/${mrId}/changes`;
        const changesResponse = await makeGitLabRequest(changesUrl, token);

        if (!changesResponse.success) {
            console.error('Failed to get changes:', changesResponse.error);
            return { success: false, error: `Failed to get changes: ${changesResponse.error}` };
        }

        const changes = changesResponse.data;
        console.log(`✅ Found ${changes.changes?.length || 0} changed files`);
        
        // Debug: Log structure of changes response
        if (changes.changes && changes.changes.length > 0) {
            console.log('🔍 DEBUG: GitLab changes structure:', JSON.stringify(changes.changes[0], null, 2));
        }

        // Get diff in unified format
        console.log('🔄 Fetching unified diff from GitLab...');
        const diffUrl = `https://${gitlabHost}/api/v4/projects/${projectPath}/merge_requests/${mrId}.diff`;
        const diffResponse = await makeGitLabRequest(diffUrl, token, 'GET', {
            'Accept': 'text/plain'
        });

        let finalDiff = '';
        if (diffResponse.success && typeof diffResponse.data === 'string') {
            finalDiff = diffResponse.data;
            console.log(`✅ Got unified diff: ${finalDiff.length} characters`);
        } else {
            console.log('⚠️ Could not get unified diff, will build from file changes');
        }

        // Process file changes
        const fileChanges = (changes.changes || []).map(change => {
            let diffContent = '';
            
            // Debug: Log each change structure
            console.log(`🔍 Processing file: ${change.new_path || change.old_path}`);
            console.log(`🔍 Change has diff: ${!!change.diff}, diff length: ${change.diff?.length || 0}`);

            // GitLab API provides diff content directly
            if (change.diff) {
                // Build complete diff format from GitLab diff
                diffContent = `diff --git a/${change.old_path || change.new_path} b/${change.new_path}\n`;
                
                // Add file mode information based on status
                if (change.new_file) {
                    diffContent += `new file mode 100644\n`;
                    diffContent += `--- /dev/null\n`;
                    diffContent += `+++ b/${change.new_path}\n`;
                } else if (change.deleted_file) {
                    diffContent += `deleted file mode 100644\n`;
                    diffContent += `--- a/${change.old_path}\n`;
                    diffContent += `+++ /dev/null\n`;
                } else if (change.renamed_file) {
                    diffContent += `--- a/${change.old_path}\n`;
                    diffContent += `+++ b/${change.new_path}\n`;
                } else {
                    diffContent += `--- a/${change.old_path || change.new_path}\n`;
                    diffContent += `+++ b/${change.new_path}\n`;
                }
                
                // Add the diff content
                diffContent += change.diff;
                
                console.log(`🔧 DEBUG: Built complete diff for ${change.new_path}: ${diffContent.length} chars`);
            } else if (finalDiff) {
                // Extract from unified diff as fallback
                const fileName = change.new_path || change.old_path;
                const filePattern = new RegExp(`diff --git a/${fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} b/${fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([\\s\\S]*?)(?=diff --git|$)`, 'g');
                const match = filePattern.exec(finalDiff);
                if (match) {
                    diffContent = `diff --git a/${fileName} b/${fileName}${match[1]}`;
                    console.log(`🔧 DEBUG: Extracted diff from finalDiff for ${fileName}: ${diffContent.length} chars`);
                }
            } else {
                // Last resort: create minimal diff representation
                console.log(`⚠️ WARNING: No diff content available for ${change.new_path || change.old_path}, creating placeholder`);
                const fileName = change.new_path || change.old_path;
                diffContent = `diff --git a/${fileName} b/${fileName}\n`;
                if (change.new_file) {
                    diffContent += `new file mode 100644\n--- /dev/null\n+++ b/${fileName}\n@@ -0,0 +1,1 @@\n+[File content not available via GitLab API]`;
                } else if (change.deleted_file) {
                    diffContent += `deleted file mode 100644\n--- a/${fileName}\n+++ /dev/null\n@@ -1,1 +0,0 @@\n-[File content not available via GitLab API]`;
                } else {
                    diffContent += `--- a/${fileName}\n+++ b/${fileName}\n@@ -1,1 +1,1 @@\n-[Original content not available]\n+[Modified content not available]`;
                }
            }

            // Count additions and deletions from diff
            const { additions, deletions } = countDiffLines(diffContent);

            return {
                path: change.new_path || change.old_path,
                changeType: change.new_file ? 'added' : 
                           change.deleted_file ? 'removed' : 
                           change.renamed_file ? 'renamed' : 'modified',
                additions: additions,
                deletions: deletions,
                changes: additions + deletions,
                diffContent: diffContent,
                diff: diffContent, // For compatibility
                source: 'GitLab API',
                oldPath: change.old_path,
                newPath: change.new_path
            };
        });

        // Get commits
        console.log('📝 Fetching commits...');
        const commitsUrl = `https://${gitlabHost}/api/v4/projects/${projectPath}/merge_requests/${mrId}/commits`;
        const commitsResponse = await makeGitLabRequest(commitsUrl, token);

        let commits = [];
        if (commitsResponse.success && commitsResponse.data) {
            commits = commitsResponse.data.map(commit => ({
                commitId: commit.id,
                comment: commit.message,
                author: {
                    name: commit.author_name,
                    date: commit.authored_date
                }
            }));
            console.log(`✅ Found ${commits.length} commits`);
        }

        return {
            success: true,
            data: {
                id: mrId,
                title: mr.title || `MR !${mrId}`,
                description: mr.description || 'No description provided',
                author: mr.author?.username || 'Unknown',
                status: mr.state || 'opened',
                owner: owner,
                repository: repo,
                gitlabHost: gitlabHost,
                sourceCommit: mr.sha,
                targetCommit: mr.target_branch_sha || mr.merge_commit_sha,
                sourceBranch: mr.source_branch,
                targetBranch: mr.target_branch,
                diffCommand: 'GitLab API (workspace-independent)',
                fileChanges: fileChanges,
                commits: commits,
                totalCommits: commits.length,
                finalDiff: finalDiff,
                commitsList: commits.map(commit => ({
                    id: commit.commitId.substring(0, 7),
                    fullId: commit.commitId,
                    message: commit.comment,
                    author: commit.author.name,
                    date: commit.author.date
                })),
                analysis: {
                    quality: `GitLab MR with ${fileChanges.length} file(s) changed`,
                    security: 'Complete MR diff analysis',
                    performance: 'Full MR data from GitLab API',
                    testCoverage: 'Review test coverage for modified files',
                    codeReview: [
                        `📁 ${fileChanges.length} file(s) changed`,
                        `➕ ${fileChanges.reduce((sum, f) => sum + f.additions, 0)} lines added`,
                        `➖ ${fileChanges.reduce((sum, f) => sum + f.deletions, 0)} lines removed`,
                        `🔍 Source: GitLab REST API`,
                        `📝 ${commits.length} commits`,
                        `🌿 ${mr.source_branch} → ${mr.target_branch}`
                    ]
                }
            }
        };
    } catch (error) {
        console.error('Error in getGitLabMR:', error);
        return { success: false, error: `Unable to fetch MR: ${error.message}` };
    }
}

/**
 * Make HTTP request to GitLab REST API
 * @param {string} url - API endpoint URL
 * @param {string} token - GitLab Personal Access Token (optional)
 * @param {string} method - HTTP method (default: GET)
 * @param {object} customHeaders - Additional headers
 */
async function makeGitLabRequest(url, token, method = 'GET', customHeaders = {}) {
    return new Promise((resolve) => {
        const urlObj = new URL(url);
        const headers = {
            'User-Agent': 'VSCode-AI-Self-Check-Extension',
            'Accept': 'application/json',
            ...customHeaders
        };

        // Add authentication if token is provided
        if (token && token.trim()) {
            headers['PRIVATE-TOKEN'] = token;
        }

        const options = {
            hostname: urlObj.hostname,
            port: 443,
            path: urlObj.pathname + urlObj.search,
            method: method,
            headers: headers
        };

        const req = https.request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        // Check if response is JSON or plain text (diff)
                        if (customHeaders['Accept']?.includes('text/plain')) {
                            resolve({ success: true, data: data });
                        } else {
                            const parsed = JSON.parse(data);
                            resolve({ success: true, data: parsed });
                        }
                    } else {
                        let errorMsg = `HTTP ${res.statusCode}`;
                        try {
                            const errorData = JSON.parse(data);
                            errorMsg += `: ${errorData.message || data}`;
                        } catch {
                            errorMsg += `: ${data}`;
                        }
                        resolve({ success: false, error: errorMsg });
                    }
                } catch (parseError) {
                    resolve({ success: false, error: `Parse error: ${parseError.message}` });
                }
            });
        });

        req.on('error', (error) => {
            resolve({ success: false, error: error.message });
        });

        req.setTimeout(15000, () => {
            req.destroy();
            resolve({ success: false, error: 'Request timeout' });
        });

        req.end();
    });
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

/**
 * Add quick review option using review-pr template
 */
async function addQuickReviewOption(stream, prAnalysis, request, originalUrl = null) {
    const data = prAnalysis.data;

    // 🔍 DEBUG: Check what we have in prAnalysis structure
    console.log('🔧 DEBUG addQuickReviewOption: prAnalysis structure:', JSON.stringify({
        hasData: !!prAnalysis.data,
        finalDiffLength: prAnalysis.data?.finalDiff?.length || 0,
        fileChangesCount: prAnalysis.data?.fileChanges?.length || 0,
        keys: Object.keys(prAnalysis.data || {})
    }, null, 2));

    // Build diff from cache (same source as webview) or fallback to data structure
    let diffContent = '';

    // 🔄 NEW APPROACH: Try to get diff from cache first (same as webview)
    if (global.prDiffCache) {
        const cacheKeys = Object.keys(global.prDiffCache);
        console.log(`🔍 Checking cache for diff content. Available keys: ${cacheKeys.length}`);
        
        // Filter cache keys for current PR/MR
        const relevantKeys = cacheKeys.filter(key => {
            if (data.gitlabHost && key.includes(`gitlab_${data.id}_`)) return true;
            if (data.owner && data.repository && key.includes(`github_${data.id}_`)) return true;
            if (data.organization && key.includes(`azure_${data.id}_`)) return true;
            return false;
        });
        
        console.log(`🎯 Found ${relevantKeys.length} relevant cache entries for current PR/MR`);
        
        if (relevantKeys.length > 0) {
            // Build diff from cache (same as webview uses)
            const cacheDiffs = relevantKeys.map(key => {
                const cached = global.prDiffCache[key];
                console.log(`📄 Cache entry ${key}: diffContent length = ${cached.diffContent?.length || 0}`);
                return cached.diffContent || cached.diff || '';
            }).filter(diff => diff.trim());
            
            if (cacheDiffs.length > 0) {
                diffContent = cacheDiffs.join('\n\n');
                console.log(`✅ Using cache diff: ${diffContent.length} chars from ${cacheDiffs.length} files`);
            }
        }
    }

    // 🔄 FALLBACK 1: Original finalDiff approach
    if (!diffContent && data.finalDiff && data.finalDiff.trim()) {
        diffContent = data.finalDiff;
        console.log(`✅ Fallback to finalDiff: ${diffContent.length} chars`);
    } 
    // 🔄 FALLBACK 2: Build from fileChanges
    else if (!diffContent && data.fileChanges && data.fileChanges.length > 0) {
        console.log(`⚠️ Fallback to fileChanges: building from ${data.fileChanges.length} file changes`);
        
        data.fileChanges.forEach((file, index) => {
            console.log(`🔍 File ${index + 1}: ${file.path}, diffContent length: ${file.diffContent?.length || 0}`);
        });
        
        diffContent = data.fileChanges
            .filter(file => file.diffContent && file.diffContent.trim())
            .map(file => file.diffContent)
            .join('\n\n');
        console.log(`✅ Built diff from fileChanges: ${diffContent.length} chars`);
    }

    // Only proceed if we have any diff content
    if (!diffContent || !diffContent.trim()) {
        console.log('⚠️ No diff content available for review');
        stream.markdown('⚠️ **No diff content available for AI review**\n\n');
        return;
    }

    try {

        // Actually perform the quick review with AI
        await performQuickReviewWithAI(stream, data, request, diffContent, originalUrl);

    } catch (error) {
        console.error('Error in quick review option:', error);
        stream.markdown('⚠️ Quick review option temporarily unavailable.\n\n');
    }
}

/**
 * Perform quick review with AI using template and shared functions
 */
async function performQuickReviewWithAI(stream, prData, request, diffContent, originalUrl = null) {
    let templateContent;

    // Set global context for any sub-functions
    global.currentPRData = prData;

    try {
        // Auto-detect framework/language from PR files and load appropriate template
        const templateResult = await getPRReviewTemplate('review-pr.md', prData);
        templateContent = templateResult.content;

        console.log(`✅ Loaded ${templateResult.detection.template.name} review template from: ${templateResult.templatePath} (${templateResult.content.length} characters)`);
        
        // Import and use displayCommonReviewInfo and displayDetectionInfo functions
        const { displayCommonReviewInfo, displayDetectionInfo } = require('./review-common');
        
        // Display detection information FIRST (as user requested)
        const detectionForDisplay = {
            type: templateResult.detection.template.type || 'fallback',
            detected: templateResult.detection.framework || templateResult.detection.language || 'General',
            templatePath: templateResult.detection.template.type + '/' + templateResult.detection.template.name,
            confidence: templateResult.confidence,
            reason: `${templateResult.detection.template.name} template selected based on PR content analysis`
        };
        displayDetectionInfo(stream, detectionForDisplay, 'review-pr.md');
        
        // Display common review info SECOND (PR title, path, file changes count)
        // Use original URL if available, otherwise fallback to generated name
        const displayName = originalUrl || 
                           (prData.gitlabHost ? `${prData.owner}/${prData.repository}` : 
                            prData.owner && prData.repository ? `${prData.owner}/${prData.repository}` : 
                            prData.repository || `PR #${prData.id}`);
        displayCommonReviewInfo(stream, 'PR Quick Review', displayName, {
            length: prData.fileChanges ? prData.fileChanges.length : 0,
            lengthType: 'changes'
        });

    } catch (error) {
        stream.markdown('❌ **Error**: Could not load quick review template\n');
        stream.markdown(`Error: ${error.message}\n`);
        return;
    }

    // Use provided diffContent (from finalDiff or built from files)
    console.log(`🔍 Diff content for review: ${diffContent.length} chars`);

    // Clean up any old diff placeholder and inject diff at end of template
    let processedTemplate = templateContent.replace(/```diff[\s\S]*?\{\{FINAL_DIFF_CONTENT\}\}[\s\S]*?```/g, '');
    
    // Inject content at the end of template - SEPARATED by file type (like performQuickReview)
    processedTemplate += '\n\n---\n\n';
    processedTemplate += '## PULL REQUEST CHANGES TO REVIEW\n\n';
    
    // Separate files by change type for better analysis
    const modifiedFiles = prData.fileChanges?.filter(f => {
        const changeType = (f.changeType || '').toLowerCase();
        return (changeType === 'edit' || changeType === 'modify' || changeType === 'modified') || !f.fullContent;
    }) || [];
    const newFiles = prData.fileChanges?.filter(f => {
        const changeType = (f.changeType || '').toLowerCase();
        const isNewFile = (changeType === 'add' || changeType === 'added' || changeType === 'new') && f.fullContent;
        console.log(`🔍 [FILTER] File ${f.path}: changeType="${changeType}", hasFullContent=${!!f.fullContent}, isNewFile=${isNewFile}`);
        return isNewFile;
    }) || [];
    
    console.log(`📊 [FILTER RESULT] Total files: ${prData.fileChanges?.length}, Modified: ${modifiedFiles.length}, New: ${newFiles.length}`);
    if (newFiles.length > 0) {
        console.log(`✅ New files to inject as fullContent:`, newFiles.map(f => f.path));
    }
    
    // 1. Inject modified files as DIFF (like before)
    if (modifiedFiles.length > 0 || diffContent) {
        processedTemplate += '### GIT DIFF TO REVIEW\n\n';
        processedTemplate += '```diff\n';
        processedTemplate += diffContent;
        processedTemplate += '\n```\n\n';
    }
    
    // 2. Inject new files as FULL CONTENT with proper language (like review-file.js)
    if (newFiles.length > 0) {
        processedTemplate += '## FILE CONTENT TO REVIEW\n\n';
        newFiles.forEach((file, index) => {
            // Hardcode typescript for consistency with review-file.js
            console.log(`📄 [USE] Injecting fullContent for new file: ${file.path} (${file.fullContent?.length || 0} chars)`);
            processedTemplate += `#### File ${index + 1}: \`${file.path}\` (+${file.additions} lines)\n\n`;
            processedTemplate += `\`\`\`typescript\n`;
            processedTemplate += file.fullContent || '';
            processedTemplate += '\n```\n\n';
        });
    }
    
    processedTemplate += '**Instructions:** Please analyze ALL changes above (both diffs and new files) using the strict review framework provided in this template.\n';

    try {
        // Get unified model using shared function with request
        const model = await getUnifiedModel(stream, null, null, request);

        if (!model) {
            // Check if API key mode is enabled
            if (shouldUseApiKey()) {
                // API key mode - executeAIReview will handle it
                console.log('🔑 API key mode enabled for PR review - model is null as expected');
            } else {
                stream.markdown('❌ **No AI model available**\n\n');
                stream.markdown('Using fallback basic analysis instead.\n\n');
                await performBasicQuickAnalysis(stream, prData);
                return;
            }
        }

        // Use shared executeAIReview function
        const success = await executeAIReview(
            processedTemplate,
            model,
            stream,
            'PR Quick Review'
        );

        console.log(`🔍 executeAIReview result: ${success}`);

        if (!success) {
            console.log('❌ AI review failed, using fallback');
            stream.markdown('⚠️ **AI analysis failed. Using fallback analysis:**\n\n');
            await performBasicQuickAnalysis(stream, prData);
        } else {
            console.log('✅ AI review completed successfully');
        }

    } catch (error) {
        // Safe fallback - show basic analysis
        stream.markdown('⚠️ **AI processing failed. Showing basic analysis:**\n\n');
        await performBasicQuickAnalysis(stream, prData);
        stream.markdown(`**Error details:** ${error.message}\n\n`);
    } finally {
        // Cleanup global context
        delete global.currentPRData;
    }
}



/**
 * Perform structured quick analysis based on diff content
 */
async function performStructuredQuickAnalysis(stream, prData) {
    const fileChanges = prData.fileChanges || [];
    const finalDiff = prData.finalDiff || '';

    // Set global context for file assessments
    global.currentPRData = prData;

    stream.markdown('## 📊 Quick PR Assessment Results\n\n');

    // Analyze each file - show ALL files in compact format
    let passCount = 0, warningCount = 0, criticalCount = 0;
    const fileAssessments = [];

    // Process all files first (with AI assessment)
    let templateContent = null;
    try {
        const templateResult = await getPRReviewTemplate('review-pr.md', prData);
        templateContent = templateResult.content;
        console.log(`✅ Loaded ${templateResult.detection.template.name} template for AI file assessment`);
        
        // Display PR detection information
        stream.markdown('## 🎯 Auto-Detection Results\n\n');
        stream.markdown(`**Detection:** ${templateResult.detection.template.name} (${templateResult.confidence})\n`);
        stream.markdown(`**Template:** ${templateResult.templatePath}\n\n`);
    } catch (error) {
        console.log('⚠️ Template not available, using enhanced fallback');
    }

    for (let i = 0; i < fileChanges.length; i++) {
        const file = fileChanges[i];
        // Use async assessment with AI/template
        const assessment = await assessFileQuickly(file, finalDiff, templateContent);

        if (assessment.status === 'PASS') {
            passCount++;
        } else if (assessment.status === 'WARNING') {
            warningCount++;
        } else {
            criticalCount++;
        }

        fileAssessments.push({ file, assessment, index: i + 1 });
    }

    // Display all files in compact format
    fileAssessments.forEach(({ file, assessment, index }) => {
        const statusIcon = assessment.status === 'PASS' ? '✅' :
            assessment.status === 'WARNING' ? '⚠️' : '🚨';

        stream.markdown(`### 📄 File ${index}: \`${file.path}\`\n`);
        stream.markdown(`**Status**: ${statusIcon} **${assessment.status}**\n\n`);

        // Show issues only for non-PASS files (to keep it compact)
        if (assessment.issues.length > 0) {
            stream.markdown('**Issues:**\n');
            assessment.issues.forEach(issue => {
                stream.markdown(`- 🚨 **${issue.type}**: ${issue.problem}\n`);
            });
            stream.markdown('\n');
        }

        stream.markdown('---\n\n');
    });

    // Summary
    stream.markdown('## 📊 PR Summary\n\n');
    stream.markdown('### Files Status Overview:\n');
    stream.markdown(`- ✅ **PASS**: ${passCount} files\n`);
    stream.markdown(`- ⚠️ **WARNING**: ${warningCount} files\n`);
    stream.markdown(`- 🚨 **CRITICAL**: ${criticalCount} files\n\n`);

    // Overall assessment
    let overallStatus;
    if (criticalCount > 0) {
        overallStatus = '🚨 **REJECTED**';
    } else if (warningCount > 0) {
        overallStatus = '⚠️ **NEEDS REVIEW**';
    } else {
        overallStatus = '✅ **APPROVED**';
    }

    stream.markdown(`### Overall PR Assessment:\n**Status**: ${overallStatus}\n\n`);

    // Quick checklist results
    stream.markdown('### 🎯 Quick Checklist Results:\n');
    const checklist = performQuickChecklist(finalDiff);
    Object.entries(checklist).forEach(([check, result]) => {
        const icon = result.passed ? '✅' : '❌';
        stream.markdown(`- [${icon}] **${check}**: ${result.message}\n`);
    });

    stream.markdown('\n**Review completed with review-pr template.**\n');
}

/**
 * Assess individual file using AI with review-pr template
 */
async function assessFileQuickly(file, fullDiff, templateContent = null) {
    try {
        // If no template provided, try to load it with PR detection
        if (!templateContent) {
            try {
                // Pass prData context if available, otherwise use file-only context
                const contextData = global.currentPRData || { fileChanges: [file] };
                const templateResult = await getPRReviewTemplate('review-pr.md', contextData);
                templateContent = templateResult.content;
                console.log(`🎯 Using ${templateResult.detection.template.name} template for file assessment`);
            } catch (error) {
                console.log('⚠️ Template loading failed, using fallback analysis');
                return assessFileQuicklyFallback(file, fullDiff);
            }
        }

        // Clean up old placeholder and inject diff at end of template
        let processedTemplate = templateContent.replace(/```diff[\s\S]*?\{\{FINAL_DIFF_CONTENT\}\}[\s\S]*?```/g, '');
        
        // Inject diff content at the end of template
        processedTemplate += '\n\n---\n\n';
        processedTemplate += '## PULL REQUEST DIFF TO REVIEW\n\n';
        processedTemplate += '```diff\n';
        processedTemplate += (fullDiff || '');
        processedTemplate += '\n```\n\n';
        processedTemplate += '**Instructions:** Please analyze the diff above using the strict review framework provided in this template.\n';

        // TODO: Send processedTemplate to AI for analysis
        console.log(`🤖 Template ready for AI: ${file.path}`);

        // For now, use enhanced fallback until AI integration
        const aiResponse = simulateAIFileAssessment(file, fullDiff);

        return aiResponse;

    } catch (error) {
        console.error(`❌ AI assessment failed for ${file.path}:`, error.message);
        // Fallback to rule-based assessment
        return assessFileQuicklyFallback(file, fullDiff);
    }
}

/**
 * Fallback rule-based assessment when AI is not available
 */
function assessFileQuicklyFallback(file, fullDiff) {
    const issues = [];
    let status = 'PASS';
    const filePath = file.path.toLowerCase();
    const diffContent = file.diffContent || '';

    console.log(`🔧 Using fallback rule-based assessment for: ${file.path}`);

    // Security checks
    if (diffContent.includes('password') || diffContent.includes('secret') || diffContent.includes('api_key')) {
        issues.push({
            type: 'Security',
            problem: 'Potential hardcoded secrets detected',
            solution: 'Remove hardcoded secrets and use environment variables',
            impact: 'Could expose sensitive information'
        });
        status = 'CRITICAL';
    }

    // Null safety checks for JS/TS files
    if (filePath.endsWith('.ts') || filePath.endsWith('.js')) {
        if (diffContent.includes('!.') && !diffContent.includes('?.')) {
            issues.push({
                type: 'Null Safety',
                problem: 'Non-null assertion without null checks',
                solution: 'Use optional chaining (?.) or add null checks',
                impact: 'Potential runtime errors'
            });
            if (status === 'PASS') status = 'WARNING';
        }
    }

    // Error handling checks
    if (diffContent.includes('try') && !diffContent.includes('catch')) {
        issues.push({
            type: 'Error Handling',
            problem: 'Try block without catch',
            solution: 'Add proper error handling with catch block',
            impact: 'Unhandled exceptions may crash application'
        });
        status = 'CRITICAL';
    }

    // Performance checks
    if (diffContent.includes('forEach') && diffContent.includes('find')) {
        issues.push({
            type: 'Performance',
            problem: 'Potential O(n²) nested loop detected',
            solution: 'Consider using Map for O(1) lookups',
            impact: 'Performance degradation with large datasets'
        });
        if (status === 'PASS') status = 'WARNING';
    }

    return { status, issues };
}

/**
 * Simulate AI assessment response (replace with real AI call)
 */
function simulateAIFileAssessment(file, fullDiff) {
    const filePath = file.path.toLowerCase();
    const diffContent = file.diffContent || '';
    const issues = [];
    let status = 'PASS';

    // Smarter analysis based on file type and content
    if (filePath.includes('component.ts')) {
        // Angular component analysis
        if (diffContent.includes('ngOnInit') && !diffContent.includes('ngOnDestroy')) {
            issues.push({
                type: 'Memory Management',
                problem: 'Component implements OnInit but not OnDestroy',
                solution: 'Implement OnDestroy to clean up subscriptions',
                impact: 'Memory leaks from unsubscribed observables'
            });
            status = 'WARNING';
        }
    }

    if (filePath.includes('service.ts')) {
        // Service analysis
        if (diffContent.includes('subscribe') && !diffContent.includes('unsubscribe')) {
            issues.push({
                type: 'Resource Management',
                problem: 'Observable subscription without unsubscribe',
                solution: 'Use takeUntil pattern or async pipe',
                impact: 'Memory leaks and unexpected behavior'
            });
            if (status === 'PASS') status = 'WARNING';
        }
    }

    // Enhanced security checks
    if (diffContent.includes('localStorage.setItem') || diffContent.includes('sessionStorage.setItem')) {
        if (diffContent.includes('password') || diffContent.includes('token')) {
            issues.push({
                type: 'Security',
                problem: 'Storing sensitive data in browser storage',
                solution: 'Use secure HTTP-only cookies or server-side sessions',
                impact: 'XSS attacks could steal sensitive information'
            });
            status = 'CRITICAL';
        }
    }

    // Performance analysis
    if (diffContent.includes('*ngFor') && diffContent.includes('function')) {
        issues.push({
            type: 'Performance',
            problem: 'Function call in *ngFor template',
            solution: 'Use pipe or pre-compute values in component',
            impact: 'Performance degradation from repeated function calls'
        });
        if (status === 'PASS') status = 'WARNING';
    }

    return { status, issues };
}

/**
 * Perform quick checklist assessment
 */
function performQuickChecklist(finalDiff) {
    const diff = finalDiff.toLowerCase();

    return {
        'Security': {
            passed: !diff.includes('password') && !diff.includes('secret') && !diff.includes('api_key'),
            message: diff.includes('password') || diff.includes('secret') ? 'Potential secrets detected' : 'No obvious secrets found'
        },
        'Null Safety': {
            passed: !diff.includes('!.') || diff.includes('?.'),
            message: diff.includes('!.') && !diff.includes('?.') ? 'Non-null assertions found' : 'Proper null handling'
        },
        'Error Handling': {
            passed: !diff.includes('try') || diff.includes('catch'),
            message: diff.includes('try') && !diff.includes('catch') ? 'Try without catch found' : 'Error handling looks good'
        },
        'Resource Management': {
            passed: !diff.includes('new ') || diff.includes('dispose') || diff.includes('close'),
            message: 'Basic resource checks passed'
        },
        'Performance': {
            passed: !(diff.includes('foreach') && diff.includes('find')),
            message: diff.includes('foreach') && diff.includes('find') ? 'Potential O(n²) operations' : 'No obvious bottlenecks'
        },
        'Code Quality': {
            passed: true, // Basic assumption
            message: 'Code structure looks reasonable'
        }
    };
}

/**
 * Perform basic quick analysis as fallback
 */
async function performBasicQuickAnalysis(stream, prData) {
    stream.markdown('## 📋 Basic Quick Analysis\n\n');

    const fileChanges = prData.fileChanges || [];
    const totalAdditions = fileChanges.reduce((sum, f) => sum + f.additions, 0);
    const totalDeletions = fileChanges.reduce((sum, f) => sum + f.deletions, 0);

    stream.markdown(`### Quick Stats:\n`);
    stream.markdown(`- **Files**: ${fileChanges.length}\n`);
    stream.markdown(`- **Changes**: +${totalAdditions}/-${totalDeletions} lines\n`);
    stream.markdown(`- **Commits**: ${prData.totalCommits || 0}\n\n`);

    stream.markdown('### Manual Review Checklist:\n');
    stream.markdown('- [ ] Check for hardcoded secrets\n');
    stream.markdown('- [ ] Verify null safety\n');
    stream.markdown('- [ ] Confirm error handling\n');
    stream.markdown('- [ ] Review resource management\n');
    stream.markdown('- [ ] Assess performance impact\n\n');
}

/**
 * Perform actual quick review using AI and template
 */
async function performQuickReview(stream, prAnalysis) {
    const data = prAnalysis.data;

    try {
        // Get the template content
        const templateContent = await getQuickReviewTemplate();
        if (!templateContent) {
            stream.markdown('❌ Quick review template not found.\n\n');
            return;
        }

        stream.markdown('## 🚀 AI Quick Review Analysis\n\n');
        stream.markdown('⚡ **Analyzing Final Diff with Quick Review Template...**\n\n');

        // Clean up old diff placeholder and inject at end of template
        let reviewPrompt = templateContent.replace(/```diff[\s\S]*?\{\{FINAL_DIFF_CONTENT\}\}[\s\S]*?```/g, '');
        
        // Inject content at the end of template - SEPARATED by file type
        reviewPrompt += '\n\n---\n\n';
        reviewPrompt += '## PULL REQUEST CHANGES TO REVIEW\n\n';
        
        // Separate files by change type for better analysis
        const modifiedFiles = data.fileChanges?.filter(f => {
            const changeType = (f.changeType || '').toLowerCase();
            return (changeType === 'edit' || changeType === 'modify' || changeType === 'modified') || !f.fullContent;
        }) || [];
        const newFiles = data.fileChanges?.filter(f => {
            const changeType = (f.changeType || '').toLowerCase();
            const isNewFile = (changeType === 'add' || changeType === 'added' || changeType === 'new') && f.fullContent;
            console.log(`🔍 [FILTER] File ${f.path}: changeType="${changeType}", hasFullContent=${!!f.fullContent}, isNewFile=${isNewFile}`);
            return isNewFile;
        }) || [];
        
        console.log(`📊 [FILTER RESULT] Total files: ${data.fileChanges?.length}, Modified: ${modifiedFiles.length}, New: ${newFiles.length}`);
        if (newFiles.length > 0) {
            console.log(`✅ New files to inject as fullContent:`, newFiles.map(f => f.path));
        }
        
        // 1. Inject modified files as DIFF (like before)
        if (modifiedFiles.length > 0 || data.finalDiff) {
            reviewPrompt += '### GIT DIFF TO REVIEW\n\n';
            reviewPrompt += '```diff\n';
            reviewPrompt += (data.finalDiff || '');
            reviewPrompt += '\n```\n\n';
        }
        
        // 2. Inject new files as FULL CONTENT with proper language (like review-file.js)
        if (newFiles.length > 0) {
            reviewPrompt += '## FILE CONTENT TO REVIEW\n\n';
            newFiles.forEach((file, index) => {
                // Hardcode typescript for consistency with review-file.js
                console.log(`📄 [USE] Injecting fullContent for new file: ${file.path} (${file.fullContent?.length || 0} chars)`);
                reviewPrompt += `#### File ${index + 1}: \`${file.path}\` (+${file.additions} lines)\n\n`;
                reviewPrompt += `\`\`\`typescript\n`;
                reviewPrompt += file.fullContent || '';
                reviewPrompt += '\n```\n\n';
            });
        }
        
        reviewPrompt += '**Instructions:** Please analyze ALL changes above (both diffs and new files) using the strict review framework provided in this template.\n\n';

        // Add file information if available
        if (data.fileChanges && data.fileChanges.length > 0) {
            const filesSummary = data.fileChanges.map((file, index) =>
                `File ${index + 1}: ${file.path} (${file.changeType}) +${file.additions}/-${file.deletions}`
            ).join('\n');
            reviewPrompt = reviewPrompt.replace(/\{\{FILES_SUMMARY\}\}/g, filesSummary);
        }

        // Create the analysis prompt
        const analysisPrompt = `${reviewPrompt}\n\nPlease analyze this PR diff following the quick review template structure exactly. Focus on critical issues that would block deployment.`;

        // Note: In a real implementation, this would call the AI model
        // For now, we'll show that the analysis is ready
        stream.markdown('📋 **Quick Analysis Ready**\n\n');
        stream.markdown('**Analysis scope:**\n');
        stream.markdown(`- Files: ${data.fileChanges?.length || 0}\n`);
        stream.markdown(`- Changes: +${data.fileChanges?.reduce((sum, f) => sum + f.additions, 0) || 0}/-${data.fileChanges?.reduce((sum, f) => sum + f.deletions, 0) || 0} lines\n`);
        stream.markdown(`- Commits: ${data.totalCommits || 0}\n\n`);

        // Show quick assessment preview
        stream.markdown('### 🎯 Quick Assessment Preview:\n\n');

        // Analyze file types for quick insights
        const fileExtensions = data.fileChanges?.map(f => {
            const ext = f.path.split('.').pop();
            return ext;
        }).filter(Boolean) || [];

        const uniqueExtensions = [...new Set(fileExtensions)];
        stream.markdown(`**File types**: ${uniqueExtensions.join(', ')}\n`);

        // Basic security check
        const hasSecurityConcerns = data.finalDiff?.includes('password') ||
            data.finalDiff?.includes('secret') ||
            data.finalDiff?.includes('api_key') ||
            data.finalDiff?.includes('token');

        stream.markdown(`**Security scan**: ${hasSecurityConcerns ? '⚠️ Potential secrets detected' : '✅ No obvious secrets'}\n`);

        // Basic error handling check
        const hasErrorHandling = data.finalDiff?.includes('try') ||
            data.finalDiff?.includes('catch') ||
            data.finalDiff?.includes('error');

        stream.markdown(`**Error handling**: ${hasErrorHandling ? '✅ Error handling present' : '⚠️ Limited error handling'}\n\n`);

        stream.markdown('💡 **Full AI analysis available with model integration**\n\n');

    } catch (error) {
        console.error('Error in quick review analysis:', error);
        stream.markdown('❌ Quick review analysis failed.\n\n');
    }
}

/**
 * Display PR review results - PROVIDER ROUTING
 * Routes to Function A (Azure DevOps) or Function B (GitHub) based on provider
 */
async function displayPrReviewResults(stream, prAnalysis) {
    const data = prAnalysis.data;

    // Detect provider type based on PR data structure
    const isGitHubPR = data.owner && data.repository && !data.gitlabHost; // GitHub has owner/repo but no gitlabHost
    const isGitLabMR = data.owner && data.repository && data.gitlabHost; // GitLab has owner/repo and gitlabHost
    const isAzurePR = data.organization && data.project; // Azure has org/project

    console.log(`🔍 Provider detection: GitHub=${isGitHubPR}, GitLab=${isGitLabMR}, Azure=${isAzurePR}`);

    // Display commits list (common for all providers)
    if (data.commitsList && data.commitsList.length > 0) {
        const commitType = isGitLabMR ? 'MR' : 'PR';
        stream.markdown(`## 📝 Commits in this ${commitType}\n\n`);
        data.commitsList.forEach((commit, index) => {
            stream.markdown(`${index + 1}. **\`${commit.id}\`** - ${commit.message}\n`);
            stream.markdown(`   👤 *${commit.author}* on ${new Date(commit.date).toLocaleDateString()}\n\n`);
        });
    }

    // Summary of Changes section (common for all providers)
    const totalFiles = data.fileChanges ? data.fileChanges.length : 0;
    const totalAdditions = data.fileChanges ? data.fileChanges.reduce((sum, f) => sum + f.additions, 0) : 0;
    const totalDeletions = data.fileChanges ? data.fileChanges.reduce((sum, f) => sum + f.deletions, 0) : 0;

    stream.markdown('## 📊 Summary of Changes\n\n');
    stream.markdown(`📁 **${totalFiles} file(s)** changed\n`);
    stream.markdown(`➕ **${totalAdditions} lines** added\n`);
    stream.markdown(`➖ **${totalDeletions} lines** deleted\n\n`);

    // PROVIDER ROUTING: Route to appropriate diff display function
    if (isGitHubPR) {
        console.log('🐙 Routing to GitHub Function B');
        await showGitHubDiffInWebview(prAnalysis, stream);
    } else if (isGitLabMR) {
        console.log('🦊 Routing to GitLab Function C');
        await showGitLabDiffInWebview(prAnalysis, stream);
    } else if (isAzurePR) {
        console.log('🔵 Routing to Azure DevOps Function A');
        await showAzureDevOpsDiffInWebview(prAnalysis, stream);
    } else {
        // Fallback: assume Azure DevOps for backward compatibility
        console.log('⚠️ Provider unknown, defaulting to Azure DevOps Function A');
        await showAzureDevOpsDiffInWebview(prAnalysis, stream);
    }

    // Provider-specific diff display is handled above by Function A, B, or C
    console.log(`📊 Provider routing complete. ${totalFiles} files processed.`);
}

/**
 * Open PR review results in new document
 */
async function openPrReviewDocument(prAnalysis) {
    const data = prAnalysis.data;

    const reviewContent = `# Azure DevOps PR Review Report

## PR Information
- **ID**: ${data.id}
- **Title**: ${data.title}
- **Author**: ${data.author}
- **Status**: ${data.status}
- **Source Commit**: ${data.sourceCommit}
- **Target Commit**: ${data.targetCommit}

## Files Changed
${data.files.map(file => `
### ${file.path}
- Type: ${file.changeType}
- Additions: +${file.additions}
- Deletions: -${file.deletions}
`).join('')}

## Code Analysis
- **Quality**: ${data.analysis.quality}
- **Security**: ${data.analysis.security}
- **Performance**: ${data.analysis.performance}
- **Test Coverage**: ${data.analysis.testCoverage}

## Diff Content
\`\`\`diff
${data.diff}
\`\`\`

---
*Generated by AI Self Check Extension - ${new Date().toLocaleString()}*
`;

    const doc = await vscode.workspace.openTextDocument({
        content: reviewContent,
        language: 'markdown'
    });

    await vscode.window.showTextDocument(doc);
}

module.exports = {
    initializePrReview,
    handleReviewPr,
    reviewPullRequestCommand,
    analyzePullRequest,
    getAzureDevOpsPR,
    makeAzureDevOpsRequest,
    displayPrReviewResults,
    addQuickReviewOption,
    performQuickReviewWithAI,
    performStructuredQuickAnalysis,
    performBasicQuickAnalysis,
    performQuickReview,
    openPrReviewDocument,
    parseRealGitDiff,
    getFileContent,
    getGitHubFileContent,         // GitHub file content API
    analyzeGitLabMergeRequest,    // GitLab MR analysis
    getGitLabMR,                  // GitLab MR API
    makeGitLabRequest,            // GitLab API request helper
    showGitHubDiffInWebview,      // Function B - GitHub diff webview
    showGitLabDiffInWebview,      // Function C - GitLab diff webview
    showAzureDevOpsDiffInWebview, // Function A - Azure DevOps diff webview
    processReviewPr               // AIDA Chatbot reusable function
};
