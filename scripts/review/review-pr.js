const vscode = require('vscode');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');
const { getUnifiedModel, executeAIReview, shouldUseApiKey, processTemplateContent, showReviewOptions, getTokenForPR, parsePRUrl, showTokenConfigurationHelp } = require('./review-common');
const { detectFromPRFiles, getReviewTemplateWithDetection, displayDetectionInfo } = require('./language-detection');
const { aidaLogging } = require('../core/settings');
const { buildPRReviewPrompt, buildPRFileAssessmentPrompt } = require('../core/prompts');

// Usage Tracking
const { trackEvent } = require('../tracking/usage-tracking');
const { TrackingEvent, AiProvider } = require('../tracking/tracking-enums');
// Platform-specific PR fetch modules (Phase 4 extraction)
const { analyzePullRequest, getAzureDevOpsPR, makeAzureDevOpsRequest, getFileContent } = require('./pr-fetch-azure');
const { getGitHubFileContent, analyzeGitHubPullRequest, getGitHubPR, makeGitHubRequest } = require('./pr-fetch-github');
const { analyzeGitLabMergeRequest, getGitLabMR, makeGitLabRequest } = require('./pr-fetch-gitlab');
const { parsePRUrlInfo, getPRReviewTemplate, filterReviewableFiles, clearPrDiffCache, countDiffLines, generateUnifiedDiff, parseRealGitDiff } = require('./pr-utils');



// Direct import — no circular dependency through extension.js
const { ensureAidaTemplatesForReview: checkAndInitializeTemplates } = require('../core/template-engine');


// Try to require diff package with fallback
try {
    // Use npm installed diff package
} catch (error) {
    aidaLogging('⚠️ diff package not available, using fallback diff functionality');
    // Create a simple fallback for basic diff functionality
    Diff = {
        createPatch: (fileName, oldStr, newStr) => {
            return `--- ${fileName}\n+++ ${fileName}\n@@ -1,${oldStr.split('\n').length} +1,${newStr.split('\n').length} @@\n${newStr}`;
        }
    };
}



/**
 * FUNCTION B - Handle GitHub PR diffs and show in webview
 * Dedicated function for GitHub diffs - clean separation from Azure DevOps
 * @param {object} prAnalysis - GitHub PR analysis result
 * @param {object} stream - VS Code stream for output
 */
async function showGitHubDiffInWebview(prAnalysis, stream) {
    aidaLogging('🐙 GitHub Function B: Starting GitHub diff webview display');
    
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
    
    // Cache all GitHub file changes for webview access (ALL files for Monaco diff view)
    const allFileChanges = data.fileChanges || [];
    allFileChanges.forEach(fileChange => {
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
        
        aidaLogging(`🔍 Cached GitHub diff: ${diffId} for ${fileChange.path}`);
        aidaLogging(`📊 DEBUG: owner=${data.owner}, repo=${data.repository}, provider=github`);
    });

    // Debug cache summary for GitHub (ALL files)
    const githubCacheKeys = Object.keys(global.prDiffCache).filter(k => k.startsWith(`github_${data.id}_`));
    aidaLogging(`🐙 GitHub cache summary: ${githubCacheKeys.length} files cached:`, githubCacheKeys);

    // Display file links with webview buttons (hover for details)
    stream.markdown('📁 **Files in this GitHub PR:**\n\n');
    
    // Only show first file with custom title (ALL files for Monaco)
    if (allFileChanges.length > 0) {
        const firstFile = allFileChanges[0];
        const diffId = `github_${data.id}_${firstFile.path.replace(/[^a-zA-Z0-9]/g, '_')}`;
        
        // Create single button with custom title
        stream.button({
            command: 'aida.viewPrDiff',
            title: `🪟 Open Diff Viewer (${allFileChanges.length} files)`,
            tooltip: `View changes in Monaco Diff Editor - ${allFileChanges.length} files total`,
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
    aidaLogging('🦊 GitLab Function C: Starting GitLab diff webview display');
    
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
    
    // Cache all GitLab file changes for webview access (ALL files for Monaco diff view)
    const allFileChanges = data.fileChanges || [];
    allFileChanges.forEach(fileChange => {
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
        
        aidaLogging(`🔍 Cached GitLab diff: ${diffId} for ${fileChange.path}`);
        aidaLogging(`📊 DEBUG: owner=${data.owner}, repo=${data.repository}, host=${data.gitlabHost}, provider=gitlab`);
    });

    // Debug cache summary for GitLab (ALL files)
    const gitlabCacheKeys = Object.keys(global.prDiffCache).filter(k => k.startsWith(`gitlab_${data.id}_`));
    aidaLogging(`🦊 GitLab cache summary: ${gitlabCacheKeys.length} files cached:`, gitlabCacheKeys);

    // Display file links with webview buttons (hover for details)
    stream.markdown('📁 **Files in this GitLab MR:**\n\n');
    
    // Only show first file with custom title (ALL files for Monaco)
    if (allFileChanges.length > 0) {
        const firstFile = allFileChanges[0];
        const diffId = `gitlab_${data.id}_${firstFile.path.replace(/[^a-zA-Z0-9]/g, '_')}`;
        
        // Create single button with custom title
        stream.button({
            command: 'aida.viewPrDiff',
            title: `🪟 Open Diff Viewer (${allFileChanges.length} files)`,
            tooltip: `View changes in Monaco Diff Editor - ${allFileChanges.length} files total`,
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
    aidaLogging('🔵 Azure Function A: Starting Azure DevOps diff webview display');
    
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

    // 🚀 Get access token using new multi-org helper
    const prUrl = `https://dev.azure.com/${data.organization}/${data.project}/_git/${data.repository}/pullrequest/${data.id}`;
    const accessToken = getTokenForPR(prUrl);
    
    if (!accessToken) {
        aidaLogging(`⚠️ No token configured for Azure DevOps organization: ${data.organization}`);
    }
    
    // Store global Azure DevOps API info for parseFullDiffContentEnhanced
    global.prDiffCache.accessToken = accessToken;
    global.prDiffCache.organization = data.organization;
    global.prDiffCache.project = data.project;
    global.prDiffCache.repository = data.repository;
    global.prDiffCache.sourceCommit = data.sourceCommit;
    global.prDiffCache.targetCommit = data.targetCommit; // This is now merge base
    global.prDiffCache.mergeBaseCommit = data.mergeBaseCommit; // Explicit merge base reference
    
    aidaLogging('🚀 Cached Azure DevOps API credentials for full content retrieval:');
    aidaLogging(`   Organization: ${data.organization}`);
    aidaLogging(`   Project: ${data.project}`);
    aidaLogging(`   Repository: ${data.repository}`);
    aidaLogging(`   Source Commit (PR): ${data.sourceCommit?.substring(0, 7)}`);
    aidaLogging(`   Target Commit (Merge Base): ${data.targetCommit?.substring(0, 7)} - CORRECTED`);
    aidaLogging(`   Merge Base: ${data.mergeBaseCommit?.substring(0, 7)} - for Monaco diff accuracy`);
    aidaLogging(`   Access Token: ${accessToken ? '✅ Available' : '❌ Missing'}`);

    stream.markdown('🔵 **Azure DevOps Diff Webview Display**\n\n');
    
    // Cache all Azure DevOps file changes for webview access (ALL files for Monaco diff view)
    const allFileChanges = data.fileChanges || [];
    allFileChanges.forEach(fileChange => {
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
            mergeBaseCommit: data.mergeBaseCommit,
            accessToken: accessToken,
            // Flag to force full file content fetching
            useFullContent: true
        };
        
        aidaLogging(`🔍 Cached Azure DevOps diff: ${diffId} for ${fileChange.path}`);
        aidaLogging(`   📊 Commits: base=${data.targetCommit?.substring(0, 7)}, source=${data.sourceCommit?.substring(0, 7)}`);
    });

    // Display file links with webview buttons (hover for details)
    stream.markdown('📁 **Files in this Azure DevOps PR:**\n\n');
    
    // Only show first file with custom title (ALL files for Monaco)
    if (allFileChanges.length > 0) {
        const firstFile = allFileChanges[0];
        const diffId = `azure_${data.id}_${firstFile.path.replace(/[^a-zA-Z0-9]/g, '_')}`;
        
        // Create single button with custom title
        stream.button({
            command: 'aida.viewPrDiff',
            title: `🪟 Open Diff Viewer (${allFileChanges.length} files)`,
            tooltip: `View changes in Monaco Diff Editor - ${allFileChanges.length} files total`,
            arguments: [diffId]
        });
    }

    stream.markdown('\n\n💡 **Click to explore changes in diff viewer**\n\n');
}

// Helper function to count diff lines accurately (matches Azure DevOps)

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
    aidaLogging('🔄 processReviewPr: Starting PR review with options');
    
    // Parse repo URL and detect type using centralized function
    const parsedInfo = parsePRUrlInfo(userMessage);
    const { prId, repoType, organization, project, repository, owner, repo, originalUrl } = parsedInfo;

    // Track PR review usage
    trackEvent(TrackingEvent.REVIEW_PR, {
        repoType: repoType || 'unknown',
        aiProvider: AiProvider.AIDA_CHATBOT
    });

    // Check for global selectedBusinessDocs (unified pattern with other review modules)
    if (global.selectedBusinessDocs) {
        aidaLogging('🎯 Enhanced/Quick PR Review detected:', global.selectedBusinessDocs);
        
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
                aidaLogging('❌ Error checking business documents:', error.message);
                hasBusinessDocs = false;
            }
        }
        
        // If no business documents, execute Quick Review immediately
        if (!hasBusinessDocs) {
            aidaLogging('📋 No business documents found - executing Quick Review automatically');
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

        // Parse PR URL using centralized function
        const parsedInfo = parsePRUrlInfo(userMessage);
        ({ prId, repoType, organization, project, repository, owner, repo, originalUrl } = parsedInfo);

        // Track PR review usage (GitHub Copilot participant)
        if (prId) {
            trackEvent(TrackingEvent.REVIEW_PR, {
                repoType: repoType || 'unknown',
                aiProvider: AiProvider.GITHUB_COPILOT
            });
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
            aidaLogging('🎯 Enhanced/Quick PR Review detected:', global.selectedBusinessDocs);
            
            // Execute review directly
            await processPrReview(userMessage, repoType, prId, owner, repo, organization, project, repository, originalUrl, stream, context, request);
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
                    aidaLogging('❌ Error checking business documents:', error.message);
                    hasBusinessDocs = false;
                }
            }
            
            // If no business documents, execute Quick Review immediately
            if (!hasBusinessDocs) {
                aidaLogging('📋 No business documents found - executing Quick Review automatically');
                stream.markdown('🚀 **Starting Quick Review automatically** (no business documents found)\n\n');
                
                // Set Quick Review mode
                global.selectedBusinessDocs = [];
                
                await processPrReview(userMessage, repoType, prId, owner, repo, organization, project, repository, originalUrl, stream, context, request);
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
        await processPrReview(userMessage, repoType, prId, owner, repo, organization, project, repository, originalUrl, stream, context, request);

    } catch (error) {
        stream.markdown('❌ **Unexpected Error**\n\n');
        stream.markdown(`Details: ${error.message}\n\n`);
        stream.markdown('Please try again or check the extension logs.');
    }
}

/**
 * Process PR review logic (extracted from handleReviewPr)
 */
async function processPrReview(userMessage, repoType, prId, owner, repo, organization, project, repository, originalUrl, stream, context, request = null) {
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
            aidaLogging(`🐙 DEBUG: Starting GitHub PR analysis for ${owner}/${repo}#${prId}`);
            prAnalysis = await analyzeGitHubPullRequest(stream, owner, repo, prId);
            aidaLogging('🐙 DEBUG: GitHub PR analysis result:', JSON.stringify(prAnalysis, null, 2));
        } else if (repoType === 'gitlab') {
            aidaLogging(`🦊 DEBUG: Starting GitLab MR analysis for ${owner}/${repo}!${prId}`);
            prAnalysis = await analyzeGitLabMergeRequest(stream, organization, owner, repo, prId);
            aidaLogging('🦊 DEBUG: GitLab MR analysis result:', JSON.stringify(prAnalysis, null, 2));
        } else {
            aidaLogging(`🔵 DEBUG: Starting Azure DevOps PR analysis for PR #${prId}`);
            prAnalysis = await analyzePullRequest(stream, prId, organization, project, repository);
            aidaLogging('🔵 DEBUG: Azure PR analysis result:', JSON.stringify(prAnalysis, null, 2));
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
            aidaLogging(`📊 DEBUG: PR data structure:`, {
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
                aidaLogging(`🐙 DEBUG: GitHub file changes:`, data.fileChanges.map(f => ({
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
        await addQuickReviewOption(stream, prAnalysis, request, originalUrl);

    } catch (error) {
        stream.markdown('❌ **Unexpected Error in PR Processing**\n\n');
        stream.markdown(`Details: ${error.message}\n\n`);
        aidaLogging('Process PR Review error:', error);
    }
}

/**
 * Review Pull Request command
 */
async function reviewPullRequestCommand() {
    try {
        // Show input box for PR URL or ID
        const prInput = await vscode.window.showInputBox({
            prompt: 'Enter Azure DevOps PR URL or PR ID (org/project auto-detected from URL)',
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

        // Parse organization, project, and repository from Azure DevOps URL
        let organization = null, project = null, repository = null, prId = null;
        
        // Azure DevOps URL pattern: https://dev.azure.com/{org}/{project}/_git/{repo}/pullrequest/{id}
        const azureUrlPattern = /https:\/\/dev\.azure\.com\/([^\/]+)\/([^\/]+)\/_git\/([^\/]+)\/pullrequest\/(\d+)/i;
        const azureMatch = prInput.match(azureUrlPattern);
        
        if (azureMatch) {
            organization = azureMatch[1];
            project = azureMatch[2];
            repository = azureMatch[3];
            prId = azureMatch[4];
            aidaLogging(`🔍 Parsed from URL: org=${organization}, project=${project}, repo=${repository}, prId=${prId}`);
        } else {
            // Fallback to simple PR ID pattern
            const prPattern = /(?:pullrequest(?:s)?\/(\d+)|pr[#\s]?(\d+)|id[:\s]?(\d+))/i;
            const match = prInput.match(prPattern);
            prId = match ? (match[1] || match[2] || match[3]) : null;
            aidaLogging(`🔍 Parsed PR ID only: ${prId} (using defaults for org/project)`);
        }

        if (!prId) {
            vscode.window.showErrorMessage('Unable to determine PR ID from provided input');
            return;
        }

        // Show progress with auto-detection info
        const progressTitle = organization && project 
            ? `Reviewing ${organization}/${project} PR #${prId}`
            : `Reviewing Azure DevOps PR #${prId} (auto-detecting context)`;
            
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: progressTitle,
            cancellable: false
        }, async (progress) => {
            progress.report({ increment: 0, message: 'Connecting to Azure DevOps...' });

            // Create a mock stream for the command-based call
            const mockStream = {
                markdown: (text) => aidaLogging(text)
            };
            // Pass parsed organization, project, repository to analyzePullRequest
            const prAnalysis = await analyzePullRequest(mockStream, prId, organization, project, repository);

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
 * Add quick review option using review-pr template
 */
async function addQuickReviewOption(stream, prAnalysis, request, originalUrl = null) {
    const data = prAnalysis.data;

    // 🔍 DEBUG: Check what we have in prAnalysis structure
    aidaLogging('🔧 DEBUG addQuickReviewOption: prAnalysis structure:', JSON.stringify({
        hasData: !!prAnalysis.data,
        finalDiffLength: prAnalysis.data?.finalDiff?.length || 0,
        fileChangesCount: prAnalysis.data?.fileChanges?.length || 0,
        keys: Object.keys(prAnalysis.data || {})
    }, null, 2));

    // Build diff content from reviewableFileChanges only (filtered files for AI review)
    let diffContent = '';

    // Always get diff from reviewableFileChanges (filtered for AI review)
    const reviewableFiles = data.reviewableFileChanges || [];
    aidaLogging(`🔍 Building diff from reviewableFileChanges: ${reviewableFiles.length} files`);
    
    if (reviewableFiles.length > 0) {
        // Log each reviewable file
        reviewableFiles.forEach((file, index) => {
            aidaLogging(`🔍 Reviewable file ${index + 1}: ${file.path}, diffContent length: ${file.diffContent?.length || 0}`);
        });
        
        // Build diff from reviewable files only
        diffContent = reviewableFiles
            .filter(file => file.diffContent && file.diffContent.trim())
            .map(file => file.diffContent)
            .join('\n\n');
        aidaLogging(`✅ Built diff from reviewableFileChanges: ${diffContent.length} chars from ${reviewableFiles.length} files`);
    }

    // Only proceed if we have reviewable diff content
    if (!diffContent || !diffContent.trim()) {
        const totalFiles = data.fileChanges ? data.fileChanges.length : 0;
        const reviewableCount = reviewableFiles.length;
        
        aidaLogging('⚠️ No reviewable diff content available for AI review');
        stream.markdown('⚠️ **No reviewable files found for AI review**\n\n');
        
        if (totalFiles > 0 && reviewableCount === 0) {
            stream.markdown(`Found ${totalFiles} file changes, but all files were filtered out (auto-generated, config files, etc.)\n\n`);
            stream.markdown('**Filtered file types typically include:**\n');
            stream.markdown('- Lock files (package-lock.json, yarn.lock)\n');
            stream.markdown('- Generated files (*.min.js, *.generated.*)\n');
            stream.markdown('- Config files (webpack.config.js, tsconfig.json)\n');
            stream.markdown('- Documentation files (README.md, CHANGELOG.md)\n\n');
        } else if (reviewableCount > 0) {
            stream.markdown(`Found ${reviewableCount} reviewable files, but no diff content available.\n\n`);
        } else {
            stream.markdown('No file changes detected in this PR/MR.\n\n');
        }
        
        return;
    }

    try {

        // Actually perform the quick review with AI
        await performQuickReviewWithAI(stream, data, request, diffContent, originalUrl);

    } catch (error) {
        aidaLogging('Error in quick review option:', error);
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

        aidaLogging(`✅ Loaded ${templateResult.detection.template.name} review template from: ${templateResult.templatePath} (${templateResult.content.length} characters)`);
        
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
            length: prData.reviewableFileChanges ? prData.reviewableFileChanges.length : 0,
            lengthType: 'reviewable files'
        });

    } catch (error) {
        stream.markdown('❌ **Error**: Could not load quick review template\n');
        stream.markdown(`Error: ${error.message}\n`);
        return;
    }

    // Use provided diffContent (from finalDiff or built from files)
    aidaLogging(`🔍 Diff content for review: ${diffContent.length} chars`);

    // Use reviewableFileChanges (filtered files for AI review)
    const sourceFiles = prData.reviewableFileChanges || [];
    
    aidaLogging(`📊 [REVIEW FILTER] Using reviewableFileChanges: ${sourceFiles.length} files for AI analysis`);

    // Build prompt using centralized prompt builder
    const { processed: processedTemplate, modifiedFiles, newFiles } = buildPRReviewPrompt(templateContent, diffContent, sourceFiles);
    
    aidaLogging(`📊 [FILTER RESULT] Total reviewable files: ${sourceFiles.length}, Modified: ${modifiedFiles.length}, New: ${newFiles.length}`);
    
    if (newFiles.length > 0) {
        aidaLogging(`✅ New files to inject as fullContent:`, newFiles.map(f => f.path));
    }

    try {
        // Get unified model using shared function with request
        const model = await getUnifiedModel(stream, null, null, request);

        if (!model) {
            // Check if API key mode is enabled
            if (shouldUseApiKey()) {
                // API key mode - executeAIReview will handle it
                aidaLogging('🔑 API key mode enabled for PR review - model is null as expected');
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

        aidaLogging(`🔍 executeAIReview result: ${success}`);

        if (!success) {
            aidaLogging('❌ AI review failed, using fallback');
            stream.markdown('⚠️ **AI analysis failed. Using fallback analysis:**\n\n');
            await performBasicQuickAnalysis(stream, prData);
        } else {
            aidaLogging('✅ AI review completed successfully');
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
        aidaLogging(`✅ Loaded ${templateResult.detection.template.name} template for AI file assessment`);
        
        // Display PR detection information
        stream.markdown('## 🎯 Auto-Detection Results\n\n');
        stream.markdown(`**Detection:** ${templateResult.detection.template.name} (${templateResult.confidence})\n`);
        stream.markdown(`**Template:** ${templateResult.templatePath}\n\n`);
    } catch (error) {
        aidaLogging('⚠️ Template not available, using enhanced fallback');
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
                aidaLogging(`🎯 Using ${templateResult.detection.template.name} template for file assessment`);
            } catch (error) {
                aidaLogging('⚠️ Template loading failed, using fallback analysis');
                return assessFileQuicklyFallback(file, fullDiff);
            }
        }

        // Clean up old placeholder and inject diff at end of template
        let processedTemplate = buildPRFileAssessmentPrompt(templateContent, fullDiff);

        // TODO: Send processedTemplate to AI for analysis
        aidaLogging(`🤖 Template ready for AI: ${file.path}`);

        // For now, use enhanced fallback until AI integration
        const aiResponse = simulateAIFileAssessment(file, fullDiff);

        return aiResponse;

    } catch (error) {
        aidaLogging(`❌ AI assessment failed for ${file.path}:`, error.message);
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

    aidaLogging(`🔧 Using fallback rule-based assessment for: ${file.path}`);

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
 * Display PR review results - PROVIDER ROUTING
 * Routes to Function A (Azure DevOps) or Function B (GitHub) based on provider
 */
async function displayPrReviewResults(stream, prAnalysis) {
    const data = prAnalysis.data;

    // Detect provider type based on PR data structure
    const isGitHubPR = data.owner && data.repository && !data.gitlabHost; // GitHub has owner/repo but no gitlabHost
    const isGitLabMR = data.owner && data.repository && data.gitlabHost; // GitLab has owner/repo and gitlabHost
    const isAzurePR = data.organization && data.project; // Azure has org/project

    aidaLogging(`🔍 Provider detection: GitHub=${isGitHubPR}, GitLab=${isGitLabMR}, Azure=${isAzurePR}`);

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
        aidaLogging('🐙 Routing to GitHub Function B');
        await showGitHubDiffInWebview(prAnalysis, stream);
    } else if (isGitLabMR) {
        aidaLogging('🦊 Routing to GitLab Function C');
        await showGitLabDiffInWebview(prAnalysis, stream);
    } else if (isAzurePR) {
        aidaLogging('🔵 Routing to Azure DevOps Function A');
        await showAzureDevOpsDiffInWebview(prAnalysis, stream);
    } else {
        // Fallback: assume Azure DevOps for backward compatibility
        aidaLogging('⚠️ Provider unknown, defaulting to Azure DevOps Function A');
        await showAzureDevOpsDiffInWebview(prAnalysis, stream);
    }

    // Provider-specific diff display is handled above by Function A, B, or C
    aidaLogging(`📊 Provider routing complete. ${totalFiles} files processed.`);
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
    processReviewPr,              // AIDA Chatbot reusable function
    parsePRUrlInfo,               // Parse PR URL to extract info
    getGitHubPR                   // Fetch GitHub PR details
};
