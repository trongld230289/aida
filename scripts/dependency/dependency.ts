import * as vscode from 'vscode';
import * as path from 'path';

// Import settings
import { aidaLogging } from '../core/settings';

// Usage Tracking
import { trackEvent } from '../tracking/usage-tracking';
import { TrackingEvent, AiProvider, TrackingSource, getIdeAiProvider } from '../tracking/tracking-enums';

import { toError } from '../core/error-utils';

// Import sub-modules
import { setCacheFilePath, checkCacheExists } from './dependency-cache-service';
import { setWebviewExtensionContext } from './dependency-graph-webview';
import { setAiExtensionContext } from './dependency-ai-analysis-service';
import {
    activateDependencyWatcherIfCacheExists,
    handleEnvironmentCheck,
    registerCacheCommands,
    isPRUrl,
    handlePRDependencyAnalysis,
    performDependencyAnalysisInBackground,
    analyzeFileDependency
} from './dependency-handlers';

/**
 * Initialize dependency graph functionality
 * @param {vscode.ExtensionContext} context
 * @returns {object} - Chat participant and related functions
 */
function initializeDependencyGraph(context: vscode.ExtensionContext) {
    // Store extension context in sub-modules
    setWebviewExtensionContext(context);
    setAiExtensionContext(context);

    // Create chat participant for dependency analysis
    const dependencyParticipant = vscode.chat.createChatParticipant('dependency', async (request, _chatContext, stream, _token) => {
        let workspaceRoot: string | undefined;
        try {
            // Get workspace root
            workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath;
            if (!workspaceRoot) {
                stream.markdown('\u274C **Error**: No workspace folder found. Please open a project folder.');
                return;
            }

            // Set cache file path
            setCacheFilePath(path.join(workspaceRoot, '.vscode', 'dependency-cache.json'));

            const userMessage = request.prompt.trim();

            // Track dependency analysis (workspace)
            void trackEvent(TrackingEvent.ANALYZE_DEPENDENCY, {
                aiProvider: getIdeAiProvider(),
                source: TrackingSource.CHAT_PARTICIPANT
            });

            // Check if user explicitly requested re-analysis
            const isReAnalyzeRequest = userMessage.toLowerCase().includes('re-analyze') || userMessage.toLowerCase().includes('reanalyze');

            // Check for existing cache
            const cacheExists = await checkCacheExists();

            if (cacheExists && !isReAnalyzeRequest) {
                // Show cache options
                stream.markdown(`## \u2699\uFE0F Dependency Analysis Options\n\n`);
                stream.markdown(`\u{1F4BE} **Found existing cache** from previous analysis\n\n`);
                stream.markdown(`**Choose your option:**\n\n`);

                stream.button({
                    command: 'aida.loadDependencyCache',
                    title: '\u26A1 Load from Cache (Fast)',
                    arguments: [workspaceRoot]
                });

                stream.markdown('   ');

                stream.button({
                    command: 'aida.analyzeDependencies',
                    title: '\u{1F504} Re-analyze (Slow but Fresh)',
                    arguments: [workspaceRoot]
                });

                stream.markdown('\n\n\u2728 **Note:** Dependency scanning uses **VS Code Language Server APIs** - **No AI Tokens consumed!** \u{1F193}');

            } else {
                // No cache or explicit re-analyze request - analyze directly in background

                // Check environment capabilities
                if (await handleEnvironmentCheck(stream, workspaceRoot)) {
                    return;
                }

                const message = isReAnalyzeRequest
                    ? '\u{1F504} **Re-analyzing dependencies...** - This will take some time\n\n'
                    : '\u{1F50D} **No cache found** - Starting fresh analysis...\n\n';
                stream.markdown(message);
                stream.markdown('\u2705 **Analysis started in background** - You can continue working!\n\n');
                stream.markdown('\u{1F4A1} The dependency graph will open automatically when complete.\n\n');

                // Run in background without blocking chat
                performDependencyAnalysisInBackground(workspaceRoot);
            }

        } catch (_error: unknown) {
            const error = toError(_error);
            aidaLogging('\u274C Dependency analysis error:', error);
            aidaLogging('\u274C Stack trace:', error.stack);
            stream.markdown(`\u274C **Analysis Error**\n\n**Error:** ${error.message}\n\n**Debug Info:**\n- Workspace: \`${workspaceRoot || 'undefined'}\`\n- Please check console for details\n\n\u{1F4A1} **Fix:** Ensure the workspace folder is properly opened.`);
        }
    });

    // Set participant metadata
    dependencyParticipant.iconPath = vscode.Uri.file(
        path.join(context.extensionPath, 'icons', 'dependency-icon.svg')
    );

    // Remove followup provider that might be causing help responses
    // dependencyParticipant.followupProvider = null;

    // Create chat participant for dependency-pr analysis (similar to @review-pr)
    const dependencyPrParticipant = vscode.chat.createChatParticipant('dependency-pr', async (request, _chatContext, stream, token) => {
        try {
            const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath;
            if (!workspaceRoot) {
                stream.markdown('\u274C **Error**: No workspace folder found. Please open a project folder.');
                return;
            }

            // Set cache file path
            setCacheFilePath(path.join(workspaceRoot, '.vscode', 'dependency-cache.json'));

            const userMessage = request.prompt.trim();

            // Track dependency PR analysis
            void trackEvent(TrackingEvent.ANALYZE_DEPENDENCY_PR, {
                source: TrackingSource.CHAT_PARTICIPANT,
                aiProvider: getIdeAiProvider()
            });

            if (!userMessage || !isPRUrl(userMessage)) {
                stream.markdown('## \u{1F50D} Dependency PR Analysis\n\n');
                stream.markdown('Please provide a Pull Request URL to analyze.\n\n');
                stream.markdown('**Usage:** `@dependency-pr <pr-url>`\n\n');
                stream.markdown('**Examples:**\n');
                stream.markdown('- `@dependency-pr https://dev.azure.com/org/project/_git/repo/pullrequest/123`\n');
                stream.markdown('- `@dependency-pr https://github.com/user/repo/pull/456`\n');
                stream.markdown('- `@dependency-pr https://gitlab.com/group/repo/-/merge_requests/78`\n');
                return;
            }

            await handlePRDependencyAnalysis(userMessage, stream, token, workspaceRoot);

        } catch (_error: unknown) {
            const error = toError(_error);
            aidaLogging('\u274C Dependency PR analysis error:', error);
            stream.markdown(`\u274C **Analysis Error**\n\n**Error:** ${error.message}\n\n`);
        }
    });

    // Set participant metadata
    dependencyPrParticipant.iconPath = vscode.Uri.file(
        path.join(context.extensionPath, 'icons', 'dependency-icon.svg')
    );

    return {
        dependencyParticipant,
        dependencyPrParticipant,
        registerCacheCommands
    };
}

/**
 * AI Dependency Analysis function for AIDA Chatbot
 * @param {string} message - User message
 * @param {object} stream - Stream object for responses
 * @param {object} token - Cancellation token
 * @param {vscode.ExtensionContext} context - Extension context
 */
async function aiDependencyAnalysis(message: string, stream: vscode.ChatResponseStream, _token: vscode.CancellationToken, _context: Record<string, any>) {
    try {
        stream.markdown('# \u{1F4E1} AIDA Dependency Analysis\n\n');

        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath;
        if (!workspaceRoot) {
            stream.markdown('\u274C **Error:** No workspace folder found. Please open a project folder.\n\n');
            return;
        }

        // Set cache file path
        setCacheFilePath(path.join(workspaceRoot, '.vscode', 'dependency-cache.json'));

        const userMessage = message.trim();

        // Track dependency analysis (workspace) from AIDA Chatbot
        void trackEvent(TrackingEvent.ANALYZE_DEPENDENCY, {
            aiProvider: AiProvider.AIDA_CHATBOT,
            source: TrackingSource.AIDA_CHATBOT
        });

        // Check if user explicitly requested re-analysis
        const lowerMessage = userMessage.toLowerCase();
        const isReAnalyzeRequest = lowerMessage.includes('re-analyze') || lowerMessage.includes('reanalyze');

        // Check for existing cache
        const cacheExists = await checkCacheExists();

        if (cacheExists && !isReAnalyzeRequest) {
            // Show cache options (same as Copilot)
            stream.markdown(`## \u2699\uFE0F Dependency Analysis Options\n\n`);
            stream.markdown(`\u{1F4BE} **Found existing cache** from previous analysis\n\n`);
            stream.markdown(`**Choose your option:**\n\n`);

            stream.button({
                command: 'aida.loadDependencyCache',
                title: '\u26A1 Load from Cache (Fast)',
                arguments: [workspaceRoot]
            });

            stream.markdown('   ');

            stream.button({
                command: 'aida.analyzeDependencies',
                title: '\u{1F504} Re-analyze (Slow but Fresh)',
                arguments: [workspaceRoot]
            });

            stream.markdown('\n\n\u2728 **Note:** Dependency scanning uses **VS Code Language Server APIs** - **No AI Tokens consumed!** \u{1F193}');

        } else {
            // No cache or explicit re-analyze request

            // Check environment capabilities
            if (await handleEnvironmentCheck(stream, workspaceRoot)) {
                return;
            }

            const message = isReAnalyzeRequest
                ? '\u{1F504} **Re-analyzing dependencies...** - This will take some time\n\n'
                : '\u{1F50D} **No cache found** - Starting fresh analysis...\n\n';
            stream.markdown(message);
            stream.markdown('\u2705 **Analysis started in background** - You can continue working!\n\n');
            stream.markdown('\u{1F4A1} The dependency graph will open automatically when complete.\n\n');

            // Run in background without blocking chat
            performDependencyAnalysisInBackground(workspaceRoot);
        }

    } catch (_error: unknown) {
        const error = toError(_error);
        aidaLogging('\u274C aiDependencyAnalysis error:', error);
        stream.markdown(`\u274C **Error:** ${error.message}\n\n`);
        stream.markdown('Please check the console for details.\n\n');
    }
}

/**
 * AI Dependency PR Analysis function for AIDA Chatbot
 * @param {string} message - PR URL message
 * @param {object} stream - Stream object for responses
 * @param {object} token - Cancellation token
 * @param {vscode.ExtensionContext} context - Extension context
 */
async function aiDependencyPrAnalysis(message: string, stream: vscode.ChatResponseStream, token: vscode.CancellationToken, _context: Record<string, any>) {
    try {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath;
        if (!workspaceRoot) {
            stream.markdown('\u274C **Error:** No workspace folder found. Please open a project folder.\n\n');
            return;
        }

        // Set cache file path
        setCacheFilePath(path.join(workspaceRoot, '.vscode', 'dependency-cache.json'));

        const userMessage = message.trim();

        // Track dependency PR analysis from AIDA Chatbot
        void trackEvent(TrackingEvent.ANALYZE_DEPENDENCY_PR, {
            source: TrackingSource.AIDA_CHATBOT,
            aiProvider: AiProvider.AIDA_CHATBOT
        });

        if (!userMessage || !isPRUrl(userMessage)) {
            stream.markdown('## \u{1F50D} Dependency PR Analysis\n\n');
            stream.markdown('Please provide a Pull Request URL to analyze.\n\n');
            stream.markdown('**Usage:** `@dependency-pr <pr-url>`\n\n');
            stream.markdown('**Examples:**\n');
            stream.markdown('- `@dependency-pr https://dev.azure.com/org/project/_git/repo/pullrequest/123`\n');
            stream.markdown('- `@dependency-pr https://github.com/user/repo/pull/456`\n');
            stream.markdown('- `@dependency-pr https://gitlab.com/group/repo/-/merge_requests/78`\n');
            return;
        }

        await handlePRDependencyAnalysis(userMessage, stream, token, workspaceRoot);

    } catch (_error: unknown) {
        const error = toError(_error);
        aidaLogging('\u274C aiDependencyPrAnalysis error:', error);
        stream.markdown(`\u274C **Error:** ${error.message}\n\n`);
    }
}

// ES exports
export { initializeDependencyGraph, aiDependencyAnalysis, aiDependencyPrAnalysis, analyzeFileDependency, activateDependencyWatcherIfCacheExists };
