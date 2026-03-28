/**
 * @module sidebar-messaging
 * @description Message processing pipeline – the extracted body of
 *              CopilotSidebarChat.processChatMessage() plus determineParticipant().
 * Extracted from chatbot-sidebar.ts during Phase 6 refactoring.
 */

import { setGlobalAbortSignal } from '../review/review-common';
import { aidaLogging } from '../core/settings';
import { toError } from '../core/error-utils';
import { getWorkspaceSpecificKey, saveChatHistory as saveChatHistoryFn } from './sidebar-history';
import { callParticipant as callParticipantFn } from './sidebar-participants';
import type { CopilotSidebarChat } from './sidebar-core';

// ─── Participant Detection ───────────────────────────────────────────

/**
 * Determine participant (same as before)
 */
export function determineParticipant(message: string): string {
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('@review-file')) return 'review-file';
    if (lowerMessage.includes('@review-changes')) return 'review-changes';
    if (lowerMessage.includes('@review-all-changes')) return 'review-all-changes';
    if (lowerMessage.includes('@review-pr')) return 'review-pr';
    if (lowerMessage.includes('@sync-review-templates')) return 'sync-review-templates';
    if (lowerMessage.includes('@dependency-pr')) return 'dependency-pr';
    if (lowerMessage.includes('@dependency')) return 'dependency';

    return 'general';
}

// ─── Process Chat Message ────────────────────────────────────────────

/**
 * Process chat message through AIDA participants with image support.
 * Extracted from CopilotSidebarChat.processChatMessage – takes the class
 * instance as the first parameter so it can read/write shared state.
 */
export async function processChatMessage(
    sidebar: CopilotSidebarChat,
    userMessage: string,
    images: string[] = [],
    mode: string = 'ask',
    model: string = 'claude-sonnet-4.5'
): Promise<void> {
    try {
        // Check for /clear command
        if (userMessage.trim() === '/clear') {
            // Clear conversation messages but preserve input history
            sidebar.chatHistory = []; // Clear in-memory conversation
            sidebar.chatbotService.clearHistory(); // Clear AI service conversation history

            // Clear only conversation from persistent storage, keep message history
            const chatKey = getWorkspaceSpecificKey('aida.chatHistory');
            sidebar.context.globalState.update(chatKey, []);

            // DON'T clear messageHistory and historyIndex - preserve for arrow navigation

            // Send clear command to frontend
            if (sidebar.webviewView) {
                sidebar.webviewView.webview.postMessage({ type: 'clearChat' });
            }

            aidaLogging('\u{1F5D1}\uFE0F Conversation cleared - arrow key history preserved');
            return; // Don't process further
        }

        // Use advanced context engine to determine if file context is needed
        let contextDecision: any = null;
        let currentFileContext: any = null;
        let enhancedMessage = userMessage;

        // Get current file context first (for context engine analysis)
        const participantType = determineParticipant(userMessage);
        const isReviewCommand = ['review-file', 'review-changes', 'review-all-changes', 'review-pr', 'sync-review-templates', 'dependency', 'dependency-pr'].includes(participantType);

        if (!isReviewCommand) {
            currentFileContext = await sidebar.getCurrentFileContext!();

            // Use ChatbotContextEngine for intelligent context decision
            try {
                // Prepare input for context engine (handle both text and images)
                const engineInput = images && images.length > 0
                    ? { text: userMessage, images: images }
                    : userMessage;

                // Get conversation history for context
                const conversationHistory = sidebar.chatHistory.slice(-5); // Last 5 messages for context

                // Make intelligent context decision
                contextDecision = await sidebar.contextEngine.shouldIncludeContext(
                    engineInput as any,
                    currentFileContext,
                    conversationHistory
                );

                aidaLogging('\u{1F9E0} Context Engine Decision:', {
                    shouldInclude: contextDecision.shouldInclude,
                    confidence: contextDecision.confidence,
                    intent: contextDecision.intent,
                    reasoning: contextDecision.reasoning,
                    userMessage: userMessage,
                    hasFile: !!currentFileContext?.hasFile,
                    fileName: currentFileContext?.fileName
                });

                // Universal semantic-based context decision (language-agnostic)
                const semanticDecision = sidebar.contextEngine.makeUniversalContextDecision(
                    userMessage,
                    contextDecision,
                    currentFileContext
                );

                // Enhanced multimodal context decision (like GitHub Copilot)
                const multimodalDecision = sidebar.makeMultimodalContextDecision!(
                    userMessage,
                    images,
                    currentFileContext,
                    contextDecision,
                    semanticDecision
                );

                // Apply multimodal decision
                if (multimodalDecision.shouldInclude) {
                    aidaLogging(`\u{1F5BC}\uFE0F Multimodal context decision: ${multimodalDecision.reason}`);
                    contextDecision.shouldInclude = true;
                    contextDecision.reasoning = [...(contextDecision.reasoning || []), multimodalDecision.reason];
                    enhancedMessage = multimodalDecision.enhancedMessage;
                } else if (!contextDecision.shouldInclude) {
                    // If all decisions say no, log why
                    aidaLogging(`\u{1F6AB} No context needed: Engine=${contextDecision.shouldInclude}, Semantic=${semanticDecision.shouldInclude}, Multimodal=${multimodalDecision.shouldInclude}`);
                }

            } catch (_engineError: unknown) {
                const engineError = toError(_engineError);
                aidaLogging('\u26A0\uFE0F Context engine error, falling back to basic logic:', engineError.message);
                // Fallback to basic pattern matching if engine fails
                contextDecision = sidebar.basicContextDecision!(userMessage, currentFileContext);
            }
        }

        // For backward compatibility, set isCurrentFileRequest based on context decision
        const isCurrentFileRequest = contextDecision?.shouldInclude || false;

        // Add user message to chat (except for current file requests which handle this separately)
        if (!isCurrentFileRequest && sidebar.webviewView) {
            sidebar.webviewView.webview.postMessage({
                type: 'addUserMessage',
                message: userMessage,
                images: images
            });
        }

        // Add to message history for arrow navigation (only if not empty and different from last)
        const trimmedMessage = userMessage.trim();
        if (trimmedMessage && (sidebar.messageHistory.length === 0 || sidebar.messageHistory[sidebar.messageHistory.length - 1] !== trimmedMessage)) {
            sidebar.messageHistory.push(trimmedMessage);
            // Keep only last 50 messages to prevent memory issues
            if (sidebar.messageHistory.length > 50) {
                sidebar.messageHistory.shift();
            }
        }
        // Reset history navigation index
        sidebar.historyIndex = -1;

        // Note: currentFileContext and other variables already defined above by context engine

        // Add to history with images and mode/model info (except for current file requests which handle this separately)
        if (!isCurrentFileRequest) {
            sidebar.chatHistory.push({
                role: 'user',
                content: userMessage,
                images: images,
                mode: mode,
                model: model,
                fileContext: currentFileContext, // Add file context
                timestamp: new Date()
            });

            // Save user message to persistent storage
            saveChatHistoryFn(sidebar.context, sidebar.chatHistory, sidebar.messageHistory);
        }

        aidaLogging('\u{1F4AC} Processing sidebar message:', userMessage);

        // Handle Agent Mode
        if (mode === 'agent') {
            try {
                // Show thinking animation
                if (sidebar.webviewView) {
                    sidebar.webviewView.webview.postMessage({
                        type: 'updateTypingMessage',
                        message: '\u{1F916} Agent is analyzing your request...'
                    });
                }

                await new Promise(resolve => setTimeout(resolve, 800));

                // Get current file context
                const agentFileContext = await sidebar.getCurrentFileContext!();

                // Create execution plan with current file context
                const plan = await sidebar.createAgentPlan!(userMessage, agentFileContext);

                // Execute plan autonomously
                const report = await sidebar.executeAgentPlan!(plan, userMessage);

                // Add response to history
                sidebar.chatHistory.push({
                    role: 'assistant',
                    content: report,
                    timestamp: new Date()
                });

                // Send final report
                if (sidebar.webviewView) {
                    sidebar.webviewView.webview.postMessage({
                        type: 'addAssistantMessage',
                        message: report
                    });
                }

            } catch (_error: unknown) {
                const error = toError(_error);
                const errorMessage = `\u274C **Agent Error:** ${error.message}\n\nPlease try rephrasing your request or check if the workspace is properly configured.`;

                sidebar.chatHistory.push({
                    role: 'assistant',
                    content: errorMessage,
                    timestamp: new Date()
                });

                if (sidebar.webviewView) {
                    sidebar.webviewView.webview.postMessage({
                        type: 'addAssistantMessage',
                        message: errorMessage
                    });
                }
            }
            return;
        }

        // Handle Ask Mode with current file detection

        if (isCurrentFileRequest) {
            // Get current file context for Ask mode too
            const askFileContext = await sidebar.getCurrentFileContext!();

            if (askFileContext.hasFile) {
                // Show original user message in UI (not enhanced message)
                if (sidebar.webviewView) {
                    sidebar.webviewView.webview.postMessage({
                        type: 'addUserMessage',
                        message: userMessage, // Show original message only
                        images: images
                    });
                }

                // Add original user message to history (not enhanced)
                sidebar.chatHistory.push({
                    role: 'user',
                    content: userMessage, // Store original message
                    images: images,
                    mode: mode,
                    model: model,
                    fileContext: askFileContext,
                    timestamp: new Date()
                });

                // Save user message to persistent storage
                saveChatHistoryFn(sidebar.context, sidebar.chatHistory, sidebar.messageHistory);

                // Enhance the message with file context for AI only (not for UI)
                const enhancedMessageForAI = `${userMessage}\n\n**Current File Context:**\n- File: ${askFileContext.fileName}\n- Language: ${askFileContext.languageId}\n- Lines: ${askFileContext.lineCount}\n\n**File Content:**\n\`\`\`${askFileContext.languageId}\n${askFileContext.content}\n\`\`\``;

                // Show typing indicator for Ask mode
                if (sidebar.webviewView) {
                    sidebar.webviewView.webview.postMessage({
                        type: 'showTyping'
                    });
                }

                // Determine participant from ORIGINAL user message only (not enhanced message
                // which includes file content that may contain @review-* strings)
                const participant = determineParticipant(userMessage);
                const response = await callParticipantFn(
                    participant, enhancedMessageForAI, images, null,
                    sidebar.context, sidebar.chatbotService, sidebar.webviewView
                );

                // Add response to history
                sidebar.chatHistory.push({
                    role: 'assistant',
                    content: response,
                    timestamp: new Date()
                });

                // Send response to sidebar
                if (sidebar.webviewView) {
                    sidebar.webviewView.webview.postMessage({
                        type: 'addAssistantMessage',
                        message: response
                    });
                }

                // Save chat history after AI response
                saveChatHistoryFn(sidebar.context, sidebar.chatHistory, sidebar.messageHistory);
                return;
            } else {
                // No file is open, show helpful message
                const noFileMessage = `I'd be happy to help you ${userMessage.toLowerCase().includes('refactor') ? 'refactor' : 'analyze'} a file! However, I don't see any file or code attached to your message. Could you please:

1. **Open the file** you want me to ${userMessage.toLowerCase().includes('refactor') ? 'refactor' : 'analyze'} in VS Code, or
2. **Paste the code directly** in your message, or
3. **Share the file content** you'd like me to review

Once you provide the code, I can help you with:
\u2022 Code structure improvements
\u2022 Performance optimizations  
\u2022 Best practices implementation
\u2022 Readability enhancements
\u2022 Modern syntax updates
\u2022 Design pattern applications

Please share your code and I'll provide a comprehensive ${userMessage.toLowerCase().includes('refactor') ? 'refactoring' : 'analysis'} with explanations for each improvement! \u{1F680}`;

                // Add to history
                sidebar.chatHistory.push({
                    role: 'assistant',
                    content: noFileMessage,
                    timestamp: new Date()
                });

                // Send response to sidebar
                if (sidebar.webviewView) {
                    sidebar.webviewView.webview.postMessage({
                        type: 'addAssistantMessage',
                        message: noFileMessage
                    });
                }
                return;
            }
        }

        // Reset cancellation flag for new request
        sidebar.isCanceled = false;

        // Create new AbortController for this request
        sidebar.currentAbortController = new AbortController();

        // Set global abort signal for review functions
        setGlobalAbortSignal(sidebar.currentAbortController.signal);

        // Show typing indicator for Ask mode
        if (sidebar.webviewView) {
            sidebar.webviewView.webview.postMessage({
                type: 'showTyping'
            });
        }

        // Determine participant and get response with images (Ask mode)
        const participant = determineParticipant(userMessage);

        // Enhance message with current file context if available (like GitHub Copilot)
        // enhancedMessage should already be set by context engine above if context is needed
        if (currentFileContext && currentFileContext.hasFile) {
            if (contextDecision?.shouldInclude) {
                // Context engine decided context is needed - use enhanced message from context engine
                aidaLogging('\u{1F4DD} Using enhanced message from context engine:', currentFileContext.fileName);
                // enhancedMessage already set by this.enhanceMessageWithContext!() above
            } else {
                // Context engine decided no context needed, but add minimal context as fallback
                enhancedMessage = `${userMessage}\n\n**Current File Context:** ${currentFileContext.summary}\nFile: ${currentFileContext.languageId} file with ${currentFileContext.lineCount} lines`;
                aidaLogging('\u{1F4DD} Enhanced message with minimal context (fallback):', currentFileContext.fileName);
            }
        } else {
            aidaLogging('\u{1F4DD} No file context available');
        }

        // Create streaming callback for real-time updates
        let fullResponse = '';
        let isFirstChunk = true;

        const streamCallback = (chunk: string) => {
            // Check for cancellation
            if (sidebar.isCanceled) {
                aidaLogging('\u{1F6D1} Streaming canceled, stopping chunk processing');
                return;
            }

            if (isFirstChunk) {
                // Hide typing indicator and start streaming message
                if (sidebar.webviewView) {
                    sidebar.webviewView.webview.postMessage({
                        type: 'startStreamingMessage'
                    });
                }
                isFirstChunk = false;
            }

            fullResponse += chunk;

            // Send streaming chunk to webview
            if (sidebar.webviewView && !sidebar.isCanceled) {
                sidebar.webviewView.webview.postMessage({
                    type: 'addStreamingChunk',
                    chunk: chunk
                });
            }
        };

        // Determine if streaming should be used
        const isReviewMode = ['review-file', 'review-changes', 'review-all-changes', 'review-pr', 'sync-review-templates', 'dependency', 'dependency-pr'].includes(participant);
        const shouldStream = participant === 'general' || isReviewMode;

        let response;
        aidaLogging('\u{1F916} Calling participant with enhanced message:', enhancedMessage.substring(0, 200) + '...');
        if (shouldStream) {
            response = await callParticipantFn(
                participant, enhancedMessage, images, streamCallback,
                sidebar.context, sidebar.chatbotService, sidebar.webviewView
            );
        } else {
            response = await callParticipantFn(
                participant, enhancedMessage, images, null,
                sidebar.context, sidebar.chatbotService, sidebar.webviewView
            );
        }

        // Check for cancellation before completing
        if (sidebar.isCanceled) {
            aidaLogging('\u{1F6D1} Operation was canceled, stopping processing');
            return;
        }

        // Complete streaming if it was used
        if (shouldStream && sidebar.webviewView) {
            sidebar.webviewView.webview.postMessage({
                type: 'endStreamingMessage'
            });
        }

        // Clean up abort controller
        sidebar.currentAbortController = null;
        setGlobalAbortSignal(null);

        // Add response to history
        sidebar.chatHistory.push({
            role: 'assistant',
            content: fullResponse || response,
            timestamp: new Date()
        });

        // Save chat history to persistent storage
        saveChatHistoryFn(sidebar.context, sidebar.chatHistory, sidebar.messageHistory);

        // Send response to sidebar (only if not streaming)
        if (!shouldStream && sidebar.webviewView) {
            sidebar.webviewView.webview.postMessage({
                type: 'addAssistantMessage',
                message: response
            });
        }

    } catch (_error: unknown) {
        const error = toError(_error);
        aidaLogging('\u274C Error processing sidebar message:', error);
        if (sidebar.webviewView) {
            sidebar.webviewView.webview.postMessage({
                type: 'showError',
                error: error.message
            });
        }
    }
}

// ─── CJS dual export ─────────────────────────────────────────────────
