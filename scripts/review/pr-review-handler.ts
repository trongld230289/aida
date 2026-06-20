import * as vscode from 'vscode';
import * as path from 'path';
import { aidaLogging } from '../core/settings';
import { toError } from '../core/error-utils';

// Usage Tracking
import { trackEvent } from '../tracking/usage-tracking';
import { TrackingEvent, AiProvider, ReviewMode, getReviewMode, getIdeAiProvider } from '../tracking/tracking-enums';

// Platform-specific PR fetch modules
import { analyzePullRequest } from './pr-fetch-azure';
import { analyzeGitHubPullRequest } from './pr-fetch-github';
import { analyzeGitLabMergeRequest } from './pr-fetch-gitlab';
import { analyzeBitbucketPullRequest } from './pr-fetch-bitbucket';
import { parsePRUrlInfo } from './pr-utils';

// Direct import – no circular dependency through extension.js
import { ensureAidaTemplatesForReview as checkAndInitializeTemplates } from '../core/template-engine';

// Sub-module imports
import { displayPrReviewResults, openPrReviewDocument } from './pr-diff-handler';
import { addQuickReviewOption } from './pr-quick-review';
import { getBusinessDocumentFolders } from './review-common';

/**
 * Initialize PR review functionality
 */
function initializePrReview(extensionContext: vscode.ExtensionContext) {
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
    const reviewPullRequest = vscode.commands.registerCommand('aida.reviewPullRequest', async () => {
        await reviewPullRequestCommand();
    });

    return { reviewPrParticipant, reviewPullRequest };
}

/**
 * Process PR review with review options (for AIDA Chatbot reuse)
 * @param {string} userMessage - User input message with PR URL
 * @param {object} stream - Chat stream object
 */
async function processReviewPr(userMessage: string, stream: vscode.ChatResponseStream) {
    aidaLogging('🔄 processReviewPr: Starting PR review with options');
    
    // Parse repo URL and detect type using centralized function
    const parsedInfo = parsePRUrlInfo(userMessage);
    const { prId = null, repoType = null, organization = null, project = null, repository = null, owner = null, repo = null, originalUrl = null } = parsedInfo;

    // Tracking moved to execution points below — fires once when review actually runs

    // Check for global selectedBusinessDocs (unified pattern with other review modules)
    if (global.selectedBusinessDocs) {
        aidaLogging('🎯 Enhanced/Quick PR Review detected:', global.selectedBusinessDocs);

        // ── Track once — sidebar AIDA Chatbot, user committed to mode ──
        void trackEvent(TrackingEvent.REVIEW_PR, {
            repoType: repoType || 'unknown',
            aiProvider: AiProvider.AIDA_CHATBOT,
            reviewMode: getReviewMode()
        });
        
        // Execute review directly
        await processPrReview(userMessage, repoType, prId, owner, repo, organization, project, repository as any, originalUrl, stream, null as any);
        return;
    }

    // Show review options (Quick Review vs Enhanced Review) if PR URL detected
    if (prId) {
        // Check if business documents exist for Enhanced Review option
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        let hasBusinessDocs = false;
        
        if (workspaceFolder) {
            try {
                const businessDocs = await getBusinessDocumentFolders(workspaceFolder);
                hasBusinessDocs = businessDocs && businessDocs.length > 0;
            } catch (_error: unknown) {
                const error = toError(_error);
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

            // ── Track once — sidebar auto Quick (no business docs) ──
            void trackEvent(TrackingEvent.REVIEW_PR, {
                repoType: repoType || 'unknown',
                aiProvider: AiProvider.AIDA_CHATBOT,
                reviewMode: ReviewMode.QUICK
            });
            
            await processPrReview(userMessage, repoType, prId, owner, repo, organization, project, repository as any, originalUrl, stream, null as any);
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
    await processPrReview(userMessage, repoType, prId, owner, repo, organization, project, repository ?? '', originalUrl, stream, null as any);
}

/**
 * Handle PR review chat participant
 */
async function handleReviewPr(request: vscode.ChatRequest, context: vscode.ChatContext, stream: vscode.ChatResponseStream, _token: vscode.CancellationToken) {
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
        prId = parsedInfo.prId ?? null;
        repoType = parsedInfo.repoType ?? null;
        organization = parsedInfo.organization ?? null;
        project = parsedInfo.project ?? null;
        repository = parsedInfo.repository ?? null;
        owner = parsedInfo.owner ?? null;
        repo = parsedInfo.repo ?? null;
        originalUrl = parsedInfo.originalUrl ?? null;

        // Tracking moved to execution points below — fires once when review actually runs

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

            // ── Track once — Copilot participant, user committed to mode ──
            void trackEvent(TrackingEvent.REVIEW_PR, {
                repoType: repoType || 'unknown',
                aiProvider: getIdeAiProvider(),
                reviewMode: getReviewMode()
            });
            
            // Execute review directly
            await processPrReview(userMessage, repoType, prId, owner, repo, organization, project, repository as any, originalUrl, stream, context, request);
            return;
        }

        // Show review options (Quick Review vs Enhanced Review)
        if (prId) {
            // Check if business documents exist for Enhanced Review option
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            let hasBusinessDocs = false;
            
            if (workspaceFolder) {
                try {
                    const businessDocs = await getBusinessDocumentFolders(workspaceFolder);
                    hasBusinessDocs = businessDocs && businessDocs.length > 0;
                } catch (_error: unknown) {
                    const error = toError(_error);
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

                // ── Track once — Copilot auto Quick (no business docs) ──
                void trackEvent(TrackingEvent.REVIEW_PR, {
                    repoType: repoType || 'unknown',
                    aiProvider: getIdeAiProvider(),
                    reviewMode: ReviewMode.QUICK
                });
                
                await processPrReview(userMessage, repoType, prId, owner, repo, organization, project, repository as any, originalUrl, stream, context, request);
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
        await processPrReview(userMessage, repoType, prId, owner, repo, organization, project, repository as any, originalUrl, stream, context, request);

    } catch (_error: unknown) {
        const error = toError(_error);
        stream.markdown('❌ **Unexpected Error**\n\n');
        stream.markdown(`Details: ${error.message}\n\n`);
        stream.markdown('Please try again or check the extension logs.');
    }
}

/**
 * Process PR review logic (extracted from handleReviewPr)
 */
async function processPrReview(_userMessage: string, repoType: string | null, prId: string | number | null, owner: string | null, repo: string | null, organization: string | null, project: string | null, repository: string, originalUrl: string | null, stream: vscode.ChatResponseStream, _context: unknown, request: vscode.ChatRequest | null = null) {
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
        } else if (repoType === 'bitbucket') {
            stream.markdown('🪣 **Analyzing Bitbucket Pull Request...**\n\n');
            stream.markdown(`🪣 **Repository**: ${owner}/${repo}\n`);
            stream.markdown(`📋 **PR**: #${prId}\n`);
            stream.markdown(`🏢 **Workspace**: ${organization}\n`);
            stream.markdown('⏳ **Fetching from Bitbucket API...**\n\n');
        } else {
            stream.markdown('🔍 **Analyzing Azure DevOps** 📋 **PR ID**: ' + prId + '\n\n');
            if (organization && project && repository) {
                stream.markdown(`🏢 **Organization**: ${organization} 📁 **Project**: ${project} 📦 **Repository**: ${repository}\n`);
            }
            stream.markdown('⏳ **Fetching from Azure DevOps API...**\n\n');
        }

        // Get PR diff and analyze based on repo type
        let prAnalysis: Record<string, any>;
        if (repoType === 'github') {
            aidaLogging(`🐙 DEBUG: Starting GitHub PR analysis for ${owner}/${repo}#${prId}`);
            prAnalysis = await analyzeGitHubPullRequest(stream, owner!, repo!, prId!) as Record<string, any>;
            aidaLogging('🐙 DEBUG: GitHub PR analysis result:', JSON.stringify(prAnalysis, null, 2));
        } else if (repoType === 'gitlab') {
            aidaLogging(`🦊 DEBUG: Starting GitLab MR analysis for ${owner}/${repo}!${prId}`);
            prAnalysis = await analyzeGitLabMergeRequest(stream, organization!, owner!, repo!, prId!) as Record<string, any>;
            aidaLogging('🦊 DEBUG: GitLab MR analysis result:', JSON.stringify(prAnalysis, null, 2));
        } else if (repoType === 'bitbucket') {
            aidaLogging(`🪣 DEBUG: Starting Bitbucket PR analysis for ${owner}/${repo}#${prId}`);
            prAnalysis = await analyzeBitbucketPullRequest(stream, organization!, repo!, prId!) as Record<string, any>;
            aidaLogging('🪣 DEBUG: Bitbucket PR analysis result:', JSON.stringify(prAnalysis, null, 2));
        } else {
            aidaLogging(`🔵 DEBUG: Starting Azure DevOps PR analysis for PR #${prId}`);
            prAnalysis = await analyzePullRequest(stream, String(prId), organization, project, repository) as Record<string, any>;
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
            } else if (repoType === 'bitbucket') {
                stream.markdown('• Bitbucket credentials not configured or insufficient permissions\n');
                stream.markdown('• PR ID does not exist or repository is private\n');
                stream.markdown('• Use API token (`atlassian_email:api_token`) or an Access Token\n');
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
            
            stream.markdown(`🔎 **Title**: ${data.title} ⭐ **Author**: ${data.author} 🔄 **Status**: ${data.status}\n\n`);
            
            // Display branch information
            if (data.sourceBranch && data.targetBranch) {
                stream.markdown(`🌿 **Merging**: \`${data.sourceBranch}\` → \`${data.targetBranch}\`\n\n`);
            }
            
            // Debug file changes for GitHub
            if (repoType === 'github' && data.fileChanges) {
                aidaLogging(`🐙 DEBUG: GitHub file changes:`, data.fileChanges.map((f: Record<string, any>) => ({
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

    } catch (_error: unknown) {
        const error = toError(_error);
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
                markdown: (text: string) => aidaLogging(text)
            };
            // Pass parsed organization, project, repository to analyzePullRequest
            const prAnalysis = await analyzePullRequest(mockStream as any, String(prId), organization, project, repository as any);

            progress.report({ increment: 50, message: 'Analyzing diff...' });

            if ((prAnalysis as any).error) {
                vscode.window.showErrorMessage(`Error reviewing PR: ${(prAnalysis as any).error}`);
                return;
            }

            progress.report({ increment: 100, message: 'Hoàn tất!' });

            // Open review results in new document
            await openPrReviewDocument(prAnalysis as any);
        });

    } catch (_error: unknown) {
        const error = toError(_error);
        vscode.window.showErrorMessage(`Error reviewing PR: ${error.message}`);
    }
}

// ES exports
export { initializePrReview, handleReviewPr, reviewPullRequestCommand, processReviewPr };
