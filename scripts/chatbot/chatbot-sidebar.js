const vscode = require('vscode');
const path = require('path');
const { AidaChatbotService } = require('./chatbot-service.js');
const { ChatbotContextEngine } = require('./chatbot-algorithm.js');
const TemplateLoader = require('./template-loader');
const { setGlobalAbortSignal } = require('../review/review-common');
const { aidaLogging } = require('../core/settings');
const { trackEvent } = require('../tracking/usage-tracking');
const { TrackingEvent, AiProvider, TrackingSource } = require('../tracking/tracking-enums');
const { AidaChatViewProvider } = require('./chatbot-view-provider');
const { agentMethods } = require('./chatbot-agent');
const { contextMethods } = require('./chatbot-context');

/**
 * GitHub Copilot-Style Sidebar Chat (True Right Sidebar like Copilot)
 * Uses TreeView + WebView combination for authentic Copilot experience
 */
class CopilotSidebarChat {
    constructor(context) {
        this.context = context;
        this.webviewView = null;
        this.chatHistory = [];
        this.isProcessing = false;
        this.messageHistory = []; // Store user message history for arrow navigation
        this.historyIndex = -1;   // Current position in history (-1 = not navigating)
        this.chatbotService = new AidaChatbotService(context); // AI chatbot service
        this.contextEngine = new ChatbotContextEngine(); // Smart context decision engine
        this.currentFileName = null; // Track current file
        this.currentAbortController = null; // For canceling AI requests
        this.initializeChatbot();
        this.setupFileWatcher();
        this.loadChatHistory(); // Load persisted chat history
    }

    /**
     * Setup file watcher to detect active file changes and workspace changes
     */
    setupFileWatcher() {
        // Listen for file save events instead of active editor changes
        this.context.subscriptions.push(
            vscode.workspace.onDidSaveTextDocument(document => {
                // Only update if the saved document is the active one
                if (vscode.window.activeTextEditor &&
                    vscode.window.activeTextEditor.document === document) {
                    this.updateCurrentFile(vscode.window.activeTextEditor);
                }
            })
        );

        // Listen for workspace folder changes
        this.context.subscriptions.push(
            vscode.workspace.onDidChangeWorkspaceFolders(() => {
                aidaLogging('📁 Workspace changed, reloading chat history...');
                // Clear current chat and load new workspace chat history
                this.chatHistory = [];
                this.messageHistory = [];
                this.historyIndex = -1;
                this.loadChatHistory();

                // Refresh webview to show new chat history
                if (this.webviewView) {
                    this.webviewView.webview.postMessage({ type: 'clearChat' });
                    // Restore the new workspace's chat history
                    setTimeout(() => {
                        this.restoreWorkspaceChatHistory();
                    }, 100);
                }
            })
        );

        // Set initial file if there's an active editor
        this.updateCurrentFile(vscode.window.activeTextEditor);
    }

    /**
     * Update current file and notify webview
     */
    updateCurrentFile(editor = null, forceUpdate = false) {
        // Use provided editor or get current active editor
        editor = editor || vscode.window.activeTextEditor;
        if (editor && editor.document) {
            const fileName = editor.document.fileName;
            const displayName = fileName.split(/[\\/]/).pop(); // Get just filename

            if (this.currentFileName !== displayName || forceUpdate) {
                this.currentFileName = displayName;

                // Notify webview about file change
                if (this.webviewView) {
                    this.webviewView.webview.postMessage({
                        type: 'updateCurrentFile',
                        fileName: displayName,
                        fullPath: fileName
                    });
                    aidaLogging('📁 Current file updated:', displayName, forceUpdate ? '(forced)' : '');
                } else {
                    aidaLogging('📁 Webview not ready, current file will be updated later:', displayName);
                }
            }
        } else {
            // No active editor
            if (this.currentFileName !== null || forceUpdate) {
                this.currentFileName = null;

                if (this.webviewView) {
                    this.webviewView.webview.postMessage({
                        type: 'updateCurrentFile',
                        fileName: null,
                        fullPath: null
                    });
                }
                aidaLogging('📁 Current file cleared');
            }
        }
    }

    /**
     * Initialize chatbot service
     */
    async initializeChatbot() {
        try {
            await this.chatbotService.initialize();
            aidaLogging('✅ AIDA Chatbot Service initialized');
        } catch (error) {
            aidaLogging('❌ Failed to initialize chatbot service:', error);
        }
    }

    /**
     * Register the sidebar view exactly like GitHub Copilot
     */
    registerSidebarView() {
        // Register webview view provider for sidebar
        const provider = new AidaChatViewProvider(this.context, this);

        // Register in Activity Bar sidebar (like Copilot)
        this.context.subscriptions.push(
            vscode.window.registerWebviewViewProvider(
                'aidaChatSidebar',
                provider,
                {
                    webviewOptions: {
                        retainContextWhenHidden: true
                    }
                }
            )
        );

        aidaLogging('✅ AIDA Chat Sidebar registered (GitHub Copilot style)');
        return provider;
    }

    /**
     * Show the sidebar (like clicking Copilot icon)
     */
    show() {
        vscode.commands.executeCommand('aidaChatSidebar.focus');
    }

    /**
     * Load chat history from persistent storage
     */
    /**
     * Get workspace-specific key for storage
     */
    getWorkspaceSpecificKey(baseKey) {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
            // Use workspace folder name and path hash for unique identification
            const workspacePath = workspaceFolders[0].uri.fsPath;
            const workspaceName = workspaceFolders[0].name;

            // Create a simple hash of the workspace path for uniqueness
            const pathHash = Buffer.from(workspacePath).toString('base64').substring(0, 8);
            return `${baseKey}.${workspaceName}.${pathHash}`;
        }

        // Fallback to global key if no workspace
        return `${baseKey}.global`;
    }

    /**
     * Load chat history from workspace-specific storage
     */
    loadChatHistory() {
        try {
            const chatKey = this.getWorkspaceSpecificKey('aida.chatHistory');
            const messageKey = this.getWorkspaceSpecificKey('aida.messageHistory');

            const savedHistory = this.context.globalState.get(chatKey, []);
            const savedMessageHistory = this.context.globalState.get(messageKey, []);

            // Limit history to last 50 messages to prevent memory issues
            this.chatHistory = savedHistory.slice(-50);
            this.messageHistory = savedMessageHistory.slice(-20);

            const workspaceName = vscode.workspace.workspaceFolders?.[0]?.name || 'global';
            aidaLogging(`📚 Loaded ${this.chatHistory.length} chat messages for workspace: ${workspaceName}`);
        } catch (error) {
            aidaLogging('Failed to load chat history:', error);
            this.chatHistory = [];
            this.messageHistory = [];
        }
    }

    /**
     * Save chat history to workspace-specific persistent storage
     */
    saveChatHistory() {
        try {
            // Save only essential data to prevent storage bloat
            const historyToSave = this.chatHistory.map(msg => ({
                role: msg.role,
                content: msg.content,
                timestamp: msg.timestamp,
                images: msg.images, // Include images to preserve image-based conversations
                mode: msg.mode,     // Include mode for context
                model: msg.model    // Include model for context
            }));

            const chatKey = this.getWorkspaceSpecificKey('aida.chatHistory');
            const messageKey = this.getWorkspaceSpecificKey('aida.messageHistory');

            this.context.globalState.update(chatKey, historyToSave);
            this.context.globalState.update(messageKey, this.messageHistory);

            const workspaceName = vscode.workspace.workspaceFolders?.[0]?.name || 'global';
            aidaLogging(`💾 Saved ${historyToSave.length} chat messages for workspace: ${workspaceName}`);
        } catch (error) {
            aidaLogging('Failed to save chat history:', error);
        }
    }

    /**
     * Clear chat history from workspace-specific storage
     */
    clearChatHistory() {
        this.chatHistory = [];
        this.messageHistory = [];
        this.historyIndex = -1;

        const chatKey = this.getWorkspaceSpecificKey('aida.chatHistory');
        const messageKey = this.getWorkspaceSpecificKey('aida.messageHistory');

        this.context.globalState.update(chatKey, []);
        this.context.globalState.update(messageKey, []);

        const workspaceName = vscode.workspace.workspaceFolders?.[0]?.name || 'global';
        aidaLogging(`🗑️ Chat history cleared for workspace: ${workspaceName}`);
    }

    /**
     * Restore workspace chat history to webview
     */
    restoreWorkspaceChatHistory() {
        if (!this.webviewView || !this.chatHistory || this.chatHistory.length === 0) {
            return;
        }

        aidaLogging(`📚 Restoring ${this.chatHistory.length} workspace chat messages`);

        for (const message of this.chatHistory) {
            if (message.role === 'user') {
                this.webviewView.webview.postMessage({
                    type: 'addUserMessage',
                    message: message.content,
                    images: message.images || []
                });
            } else if (message.role === 'assistant') {
                this.webviewView.webview.postMessage({
                    type: 'addAssistantMessage',
                    message: message.content
                });
            }
        }
    }

    /**
     * Ensure AIDA templates folder exists (like Copilot does)
     */
    async ensureAidaTemplatesExist() {
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                aidaLogging('⚠️ No workspace folder found for AIDA templates');
                return;
            }

            const aidaPath = path.join(workspaceFolder.uri.fsPath, 'AIDA');
            const templatesPath = path.join(aidaPath, 'templates');

            // Check if AIDA templates already exist
            if (require('fs').existsSync(templatesPath)) {
                aidaLogging('✅ AIDA templates already exist');
                return;
            }

            aidaLogging('🔄 AIDA Chatbot: Creating AIDA templates folder...');

            // Create AIDA/templates directory
            require('fs').mkdirSync(templatesPath, { recursive: true });

            // Copy templates from extension to workspace
            const extensionTemplatesPath = require('path').join(this.context.extensionPath, 'templates');
            if (require('fs').existsSync(extensionTemplatesPath)) {
                await this.copyTemplatesRecursively(extensionTemplatesPath, templatesPath);
                aidaLogging('✅ AIDA Chatbot: Templates created successfully');

                // Notify webview
                if (this.webviewView) {
                    this.webviewView.webview.postMessage({
                        type: 'showNotification',
                        message: '✅ AIDA templates created automatically!',
                        isSuccess: true
                    });
                }
            } else {
                aidaLogging('⚠️ Extension templates not found');
            }
        } catch (error) {
            aidaLogging('❌ Failed to create AIDA templates:', error.message);
        }
    }

    /**
     * Copy templates recursively
     */
    async copyTemplatesRecursively(src, dest) {
        const fs = require('fs');
        const path = require('path');

        if (!fs.existsSync(src)) return;

        fs.mkdirSync(dest, { recursive: true });
        const entries = fs.readdirSync(src, { withFileTypes: true });

        for (const entry of entries) {
            const srcPath = path.join(src, entry.name);
            const destPath = path.join(dest, entry.name);

            if (entry.isDirectory()) {
                await this.copyTemplatesRecursively(srcPath, destPath);
            } else {
                fs.copyFileSync(srcPath, destPath);
            }
        }
    }

    /**
     * Send message directly to sidebar
     */
    async sendMessage(message) {
        if (this.webviewView) {
            await this.processChatMessage(message);
        } else {
            // Show sidebar first, then send message
            this.show();
            setTimeout(async () => {
                await this.processChatMessage(message);
            }, 500);
        }
    }

    /**
     * Process chat message through AIDA participants with image support
     */
    async processChatMessage(userMessage, images = [], mode = 'ask', model = 'claude-sonnet-4.5') {
        try {
            // Check for /clear command
            if (userMessage.trim() === '/clear') {
                // Clear conversation messages but preserve input history
                this.chatHistory = []; // Clear in-memory conversation
                this.chatbotService.clearHistory(); // Clear AI service conversation history

                // Clear only conversation from persistent storage, keep message history
                const chatKey = this.getWorkspaceSpecificKey('aida.chatHistory');
                this.context.globalState.update(chatKey, []);

                // DON'T clear messageHistory and historyIndex - preserve for arrow navigation

                // Send clear command to frontend
                if (this.webviewView) {
                    this.webviewView.webview.postMessage({ type: 'clearChat' });
                }

                aidaLogging('🗑️ Conversation cleared - arrow key history preserved');
                return; // Don't process further
            }

            // Use advanced context engine to determine if file context is needed
            let contextDecision = null;
            let currentFileContext = null;
            let enhancedMessage = userMessage;

            // Get current file context first (for context engine analysis)
            const participantType = this.determineParticipant(userMessage);
            const isReviewCommand = ['review-file', 'review-changes', 'review-all-changes', 'review-pr', 'sync-review-templates', 'dependency', 'dependency-pr'].includes(participantType);

            if (!isReviewCommand) {
                currentFileContext = await this.getCurrentFileContext();

                // Use ChatbotContextEngine for intelligent context decision
                try {
                    // Prepare input for context engine (handle both text and images)
                    const engineInput = images && images.length > 0
                        ? { text: userMessage, images: images }
                        : userMessage;

                    // Get conversation history for context
                    const conversationHistory = this.chatHistory.slice(-5); // Last 5 messages for context

                    // Make intelligent context decision
                    contextDecision = await this.contextEngine.shouldIncludeContext(
                        engineInput,
                        currentFileContext,
                        conversationHistory
                    );

                    aidaLogging('🧠 Context Engine Decision:', {
                        shouldInclude: contextDecision.shouldInclude,
                        confidence: contextDecision.confidence,
                        intent: contextDecision.intent,
                        reasoning: contextDecision.reasoning,
                        userMessage: userMessage,
                        hasFile: !!currentFileContext?.hasFile,
                        fileName: currentFileContext?.fileName
                    });

                    // Universal semantic-based context decision (language-agnostic)
                    const semanticDecision = this.contextEngine.makeUniversalContextDecision(
                        userMessage,
                        contextDecision,
                        currentFileContext
                    );

                    // Enhanced multimodal context decision (like GitHub Copilot)
                    const multimodalDecision = this.makeMultimodalContextDecision(
                        userMessage,
                        images,
                        currentFileContext,
                        contextDecision,
                        semanticDecision
                    );

                    // Apply multimodal decision
                    if (multimodalDecision.shouldInclude) {
                        aidaLogging(`🖼️ Multimodal context decision: ${multimodalDecision.reason}`);
                        contextDecision.shouldInclude = true;
                        contextDecision.reasoning = [...(contextDecision.reasoning || []), multimodalDecision.reason];
                        enhancedMessage = multimodalDecision.enhancedMessage;
                    } else if (!contextDecision.shouldInclude) {
                        // If all decisions say no, log why
                        aidaLogging(`🚫 No context needed: Engine=${contextDecision.shouldInclude}, Semantic=${semanticDecision.shouldInclude}, Multimodal=${multimodalDecision.shouldInclude}`);
                    }

                } catch (engineError) {
                    aidaLogging('⚠️ Context engine error, falling back to basic logic:', engineError.message);
                    // Fallback to basic pattern matching if engine fails
                    contextDecision = this.basicContextDecision(userMessage, currentFileContext);
                }
            }

            // For backward compatibility, set isCurrentFileRequest based on context decision
            const isCurrentFileRequest = contextDecision?.shouldInclude || false;

            // Add user message to chat (except for current file requests which handle this separately)
            if (!isCurrentFileRequest && this.webviewView) {
                this.webviewView.webview.postMessage({
                    type: 'addUserMessage',
                    message: userMessage,
                    images: images
                });
            }

            // Add to message history for arrow navigation (only if not empty and different from last)
            const trimmedMessage = userMessage.trim();
            if (trimmedMessage && (this.messageHistory.length === 0 || this.messageHistory[this.messageHistory.length - 1] !== trimmedMessage)) {
                this.messageHistory.push(trimmedMessage);
                // Keep only last 50 messages to prevent memory issues
                if (this.messageHistory.length > 50) {
                    this.messageHistory.shift();
                }
            }
            // Reset history navigation index
            this.historyIndex = -1;

            // Note: currentFileContext and other variables already defined above by context engine

            // Add to history with images and mode/model info (except for current file requests which handle this separately)
            if (!isCurrentFileRequest) {
                this.chatHistory.push({
                    role: 'user',
                    content: userMessage,
                    images: images,
                    mode: mode,
                    model: model,
                    fileContext: currentFileContext, // Add file context
                    timestamp: new Date()
                });

                // Save user message to persistent storage
                this.saveChatHistory();
            }

            aidaLogging('💬 Processing sidebar message:', userMessage);

            // Handle Agent Mode
            if (mode === 'agent') {
                try {
                    // Show thinking animation
                    if (this.webviewView) {
                        this.webviewView.webview.postMessage({
                            type: 'updateTypingMessage',
                            message: '🤖 Agent is analyzing your request...'
                        });
                    }

                    await new Promise(resolve => setTimeout(resolve, 800));

                    // Get current file context
                    const currentFileContext = await this.getCurrentFileContext();

                    // Create execution plan with current file context
                    const plan = await this.createAgentPlan(userMessage, currentFileContext);

                    // Execute plan autonomously
                    const report = await this.executeAgentPlan(plan, userMessage);

                    // Add response to history
                    this.chatHistory.push({
                        role: 'assistant',
                        content: report,
                        timestamp: new Date()
                    });

                    // Send final report
                    if (this.webviewView) {
                        this.webviewView.webview.postMessage({
                            type: 'addAssistantMessage',
                            message: report
                        });
                    }

                } catch (error) {
                    const errorMessage = `❌ **Agent Error:** ${error.message}\n\nPlease try rephrasing your request or check if the workspace is properly configured.`;

                    this.chatHistory.push({
                        role: 'assistant',
                        content: errorMessage,
                        timestamp: new Date()
                    });

                    if (this.webviewView) {
                        this.webviewView.webview.postMessage({
                            type: 'addAssistantMessage',
                            message: errorMessage
                        });
                    }
                }
                return;
            }

            // Handle Ask Mode with current file detection
            // (isCurrentFileRequest already declared above)

            if (isCurrentFileRequest) {
                // Get current file context for Ask mode too
                const currentFileContext = await this.getCurrentFileContext();

                if (currentFileContext.hasFile) {
                    // Show original user message in UI (not enhanced message)
                    if (this.webviewView) {
                        this.webviewView.webview.postMessage({
                            type: 'addUserMessage',
                            message: userMessage, // Show original message only
                            images: images
                        });
                    }

                    // Add original user message to history (not enhanced)
                    this.chatHistory.push({
                        role: 'user',
                        content: userMessage, // Store original message
                        images: images,
                        mode: mode,
                        model: model,
                        fileContext: currentFileContext,
                        timestamp: new Date()
                    });

                    // Save user message to persistent storage
                    this.saveChatHistory();

                    // Enhance the message with file context for AI only (not for UI)
                    const enhancedMessageForAI = `${userMessage}\n\n**Current File Context:**\n- File: ${currentFileContext.fileName}\n- Language: ${currentFileContext.languageId}\n- Lines: ${currentFileContext.lineCount}\n\n**File Content:**\n\`\`\`${currentFileContext.languageId}\n${currentFileContext.content}\n\`\`\``;

                    // Show typing indicator for Ask mode
                    if (this.webviewView) {
                        this.webviewView.webview.postMessage({
                            type: 'showTyping'
                        });
                    }

                    // Determine participant and get response with enhanced message (AI gets full context)
                    const participant = this.determineParticipant(enhancedMessageForAI);
                    const response = await this.callParticipant(participant, enhancedMessageForAI, images);

                    // Add response to history
                    this.chatHistory.push({
                        role: 'assistant',
                        content: response,
                        timestamp: new Date()
                    });

                    // Send response to sidebar
                    if (this.webviewView) {
                        this.webviewView.webview.postMessage({
                            type: 'addAssistantMessage',
                            message: response
                        });
                    }

                    // Save chat history after AI response
                    this.saveChatHistory();
                    return;
                } else {
                    // No file is open, show helpful message
                    const noFileMessage = `I'd be happy to help you ${userMessage.toLowerCase().includes('refactor') ? 'refactor' : 'analyze'} a file! However, I don't see any file or code attached to your message. Could you please:

1. **Open the file** you want me to ${userMessage.toLowerCase().includes('refactor') ? 'refactor' : 'analyze'} in VS Code, or
2. **Paste the code directly** in your message, or
3. **Share the file content** you'd like me to review

Once you provide the code, I can help you with:
• Code structure improvements
• Performance optimizations  
• Best practices implementation
• Readability enhancements
• Modern syntax updates
• Design pattern applications

Please share your code and I'll provide a comprehensive ${userMessage.toLowerCase().includes('refactor') ? 'refactoring' : 'analysis'} with explanations for each improvement! 🚀`;

                    // Add to history
                    this.chatHistory.push({
                        role: 'assistant',
                        content: noFileMessage,
                        timestamp: new Date()
                    });

                    // Send response to sidebar
                    if (this.webviewView) {
                        this.webviewView.webview.postMessage({
                            type: 'addAssistantMessage',
                            message: noFileMessage
                        });
                    }
                    return;
                }
            }

            // Reset cancellation flag for new request
            this.isCanceled = false;

            // Create new AbortController for this request
            this.currentAbortController = new AbortController();

            // Set global abort signal for review functions
            setGlobalAbortSignal(this.currentAbortController.signal);

            // Show typing indicator for Ask mode
            if (this.webviewView) {
                this.webviewView.webview.postMessage({
                    type: 'showTyping'
                });
            }

            // Determine participant and get response with images (Ask mode)
            const participant = this.determineParticipant(userMessage);

            // Get current file context for better responses (reuse from above)
            // const currentFileContext was already declared above

            // Enhance message with current file context if available (like GitHub Copilot)
            // enhancedMessage should already be set by context engine above if context is needed
            if (currentFileContext && currentFileContext.hasFile) {
                if (contextDecision?.shouldInclude) {
                    // Context engine decided context is needed - use enhanced message from context engine
                    aidaLogging('📁 Using enhanced message from context engine:', currentFileContext.fileName);
                    // enhancedMessage already set by this.enhanceMessageWithContext() above
                } else {
                    // Context engine decided no context needed, but add minimal context as fallback
                    enhancedMessage = `${userMessage}\n\n**Current File Context:** ${currentFileContext.summary}\nFile: ${currentFileContext.languageId} file with ${currentFileContext.lineCount} lines`;
                    aidaLogging('📁 Enhanced message with minimal context (fallback):', currentFileContext.fileName);
                }
            } else {
                aidaLogging('📁 No file context available');
            }

            // Create streaming callback for real-time updates
            let fullResponse = '';
            let isFirstChunk = true;

            const streamCallback = (chunk) => {
                // Check for cancellation
                if (this.isCanceled) {
                    aidaLogging('🛑 Streaming canceled, stopping chunk processing');
                    return;
                }

                if (isFirstChunk) {
                    // Hide typing indicator and start streaming message
                    if (this.webviewView) {
                        this.webviewView.webview.postMessage({
                            type: 'startStreamingMessage'
                        });
                    }
                    isFirstChunk = false;
                }

                fullResponse += chunk;

                // Send streaming chunk to webview
                if (this.webviewView && !this.isCanceled) {
                    this.webviewView.webview.postMessage({
                        type: 'addStreamingChunk',
                        chunk: chunk
                    });
                }
            };

            // Determine if streaming should be used
            const isReviewMode = ['review-file', 'review-changes', 'review-all-changes', 'review-pr', 'sync-review-templates', 'dependency', 'dependency-pr'].includes(participant);
            const shouldStream = participant === 'general' || isReviewMode;

            let response;
            aidaLogging('🤖 Calling participant with enhanced message:', enhancedMessage.substring(0, 200) + '...');
            if (shouldStream) {
                response = await this.callParticipant(participant, enhancedMessage, images, streamCallback);
            } else {
                response = await this.callParticipant(participant, enhancedMessage, images);
            }

            // Check for cancellation before completing
            if (this.isCanceled) {
                aidaLogging('🛑 Operation was canceled, stopping processing');
                return;
            }

            // Complete streaming if it was used
            if (shouldStream && this.webviewView) {
                this.webviewView.webview.postMessage({
                    type: 'endStreamingMessage'
                });
            }

            // Clean up abort controller
            this.currentAbortController = null;
            setGlobalAbortSignal(null);

            // Add response to history
            this.chatHistory.push({
                role: 'assistant',
                content: fullResponse || response,
                timestamp: new Date()
            });

            // Save chat history to persistent storage
            this.saveChatHistory();

            // Send response to sidebar (only if not streaming)
            if (!shouldStream && this.webviewView) {
                this.webviewView.webview.postMessage({
                    type: 'addAssistantMessage',
                    message: response
                });
            }

        } catch (error) {
            aidaLogging('❌ Error processing sidebar message:', error);
            if (this.webviewView) {
                this.webviewView.webview.postMessage({
                    type: 'showError',
                    error: error.message
                });
            }
        }
    }

    /**
     * Determine participant (same as before)
     */
    determineParticipant(message) {
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

    /**
     * Call AIDA participant with image support
     */
    async callParticipant(participant, message, images = [], streamCallback = null) {
        try {
            let result = '';
            const isStreaming = typeof streamCallback === 'function';

            const mockStream = {
                markdown: (text) => {
                    if (text) {
                        result += text;
                        // Stream the chunk if streaming is enabled
                        if (isStreaming) {
                            streamCallback(text);
                        }
                    }
                    return mockStream;
                },
                button: (button) => {
                    if (button && button.title) {
                        // Use simple placeholder with encoded data
                        const buttonId = 'AIDA_BTN_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                        const buttonHtml = `<span data-button-id="${buttonId}" data-title="${button.title}" data-command="${button.command || ''}" data-args='${JSON.stringify(button.arguments || [])}' data-tooltip="${button.tooltip || button.title}" class="button-placeholder">[${button.title}]</span> `;
                        result += buttonHtml;
                        if (isStreaming) {
                            streamCallback(buttonHtml);
                        }
                    }
                    return mockStream;
                },
                progress: (text) => {
                    if (text) {
                        const progressText = '🔄 ' + text + '\n';
                        result += progressText;
                        if (isStreaming) {
                            streamCallback(progressText);
                        }
                    }
                    return mockStream;
                },
                filetree: (tree) => {
                    if (tree) {
                        const treeText = '\n**File Tree:**\n' + JSON.stringify(tree, null, 2) + '\n\n';
                        result += treeText;
                        if (isStreaming) {
                            streamCallback(treeText);
                        }
                    }
                    return mockStream;
                },
                anchor: (anchor) => {
                    if (anchor && anchor.value) {
                        const anchorText = '[' + (anchor.title || anchor.value) + '](' + anchor.value + ')';
                        result += anchorText;
                        if (isStreaming) {
                            streamCallback(anchorText);
                        }
                    }
                    return mockStream;
                },
                reference: (ref) => {
                    if (ref && ref.value) {
                        const refText = '📎 Reference: ' + ref.value + '\n';
                        result += refText;
                        if (isStreaming) {
                            streamCallback(refText);
                        }
                    }
                    return mockStream;
                }
            };

            const mockContext = {
                prompt: message,
                stream: mockStream
            };

            const messageWithoutParticipant = message.replace(/@[\w-]+\s*/, '').trim();

            switch (participant) {
                case 'review-file':
                    try {
                        aidaLogging('📁 AIDA Chat: Calling review-file with streaming');

                        // Track usage - AIDA Chatbot
                        trackEvent(TrackingEvent.REVIEW_FILE, {
                            source: TrackingSource.AIDA_CHATBOT,
                            aiProvider: AiProvider.AIDA_CHATBOT
                        });

                        // Ensure AIDA templates exist before review (like Copilot does)
                        await this.ensureAidaTemplatesExist();

                        const reviewFileModule = require('../review/review-file.js');
                        await reviewFileModule.processReviewFile(messageWithoutParticipant, mockStream);
                        return result || '✅ **File Review Complete**\n\nCode analysis completed.';
                    } catch (error) {
                        aidaLogging('❌ AIDA Chat review-file error:', error);
                        return '❌ **Error**: ' + error.message + '\n\nPlease check the console for details.';
                    }

                case 'review-changes':
                    try {
                        aidaLogging('📝 AIDA Chat: Calling review-changes with streaming');

                        // Track usage - AIDA Chatbot
                        trackEvent(TrackingEvent.REVIEW_CHANGES, {
                            source: TrackingSource.AIDA_CHATBOT,
                            aiProvider: AiProvider.AIDA_CHATBOT
                        });

                        // Ensure AIDA templates exist before review (like Copilot does)
                        await this.ensureAidaTemplatesExist();

                        const reviewChangesModule = require('../review/review-changes.js');
                        await reviewChangesModule.processReviewChanges(messageWithoutParticipant, mockStream);
                        return result || '✅ **Changes Review Complete**\n\nGit changes analysis completed.';
                    } catch (error) {
                        aidaLogging('❌ AIDA Chat review-changes error:', error);
                        return '❌ **Error**: ' + error.message + '\n\nPlease check the console for details.';
                    }

                case 'review-all-changes':
                    try {
                        aidaLogging('🔍 AIDA Chat: Calling review-all-changes with streaming');

                        // Track usage - AIDA Chatbot
                        trackEvent(TrackingEvent.REVIEW_ALL_CHANGES, {
                            source: TrackingSource.AIDA_CHATBOT,
                            aiProvider: AiProvider.AIDA_CHATBOT
                        });

                        // Ensure AIDA templates exist before review (like Copilot does)
                        await this.ensureAidaTemplatesExist();

                        const reviewAllChangesModule = require('../review/review-all-changes.js');
                        await reviewAllChangesModule.processReviewAllChanges(messageWithoutParticipant, mockStream);
                        return result || '✅ **All Changes Review Complete**\n\nWorkspace git changes analysis completed.';
                    } catch (error) {
                        aidaLogging('❌ AIDA Chat review-all-changes error:', error);
                        return '❌ **Error**: ' + error.message + '\n\nPlease check the console for details.';
                    }

                case 'review-pr':
                    try {
                        aidaLogging('🔄 AIDA Chat: Calling review-pr with streaming');

                        // Ensure AIDA templates exist before review (like Copilot does)
                        await this.ensureAidaTemplatesExist();

                        const reviewPRModule = require('../review/review-pr.js');
                        await reviewPRModule.processReviewPr(messageWithoutParticipant, mockStream);
                        return result || '✅ **PR Review Complete**\n\nPull request analysis completed.';
                    } catch (error) {
                        aidaLogging('❌ AIDA Chat review-pr error:', error);
                        return '❌ **Error**: ' + error.message + '\n\nPlease check the console for details.';
                    }

                case 'sync-review-templates':
                    try {
                        aidaLogging('🔄 AIDA Chat: Calling sync-review-templates with reusable logic');

                        // Track usage - AIDA Chatbot
                        trackEvent(TrackingEvent.SYNC_REVIEW_TEMPLATES, {
                            source: TrackingSource.AIDA_CHATBOT,
                            aiProvider: AiProvider.AIDA_CHATBOT
                        });

                        const syncModule = require('../review/sync-review-templates.js');
                        await syncModule.aiSyncReviewTemplates(messageWithoutParticipant, mockStream, null, this.context);
                        return result || '✅ **Template Sync Complete**\n\nTemplate synchronization completed.';
                    } catch (error) {
                        aidaLogging('❌ AIDA Chat sync-review-templates error:', error);
                        return '❌ **Error**: ' + error.message + '\n\nPlease check the console for details.';
                    }

                case 'dependency':
                    try {
                        aidaLogging('🔍 AIDA Chat: Calling dependency analysis with reusable logic');
                        const dependencyModule = require('../dependency/dependency.js');
                        await dependencyModule.aiDependencyAnalysis(messageWithoutParticipant, mockStream, null, this.context);
                        return result || '✅ **Dependency Analysis Complete**\n\nDependency analysis completed.';
                    } catch (error) {
                        aidaLogging('❌ AIDA Chat dependency error:', error);
                        return '❌ **Error**: ' + error.message + '\n\nPlease check the console for details.';
                    }

                case 'dependency-pr':
                    try {
                        aidaLogging('🔍 AIDA Chat: Calling dependency-pr analysis');

                        const dependencyPrModule = require('../dependency/dependency.js');
                        await dependencyPrModule.aiDependencyPrAnalysis(messageWithoutParticipant, mockStream, null, this.context);
                        return result || '✅ **Dependency PR Analysis Complete**\n\nPR dependency analysis completed.';
                    } catch (error) {
                        aidaLogging('❌ AIDA Chat dependency-pr error:', error);
                        return '❌ **Error**: ' + error.message + '\n\nPlease check the console for details.';
                    }

                default:
                    return await this.generateGeneralResponse(message, images, streamCallback);
            }

        } catch (error) {
            aidaLogging('❌ Error calling ' + participant + ' participant:', error);
            return '❌ **Error**\n\nSorry, I encountered an error: ' + error.message;
        }
    }

    /**
     * Generate conversational response using AI chatbot service with image support
     */
    async generateGeneralResponse(message, images = [], streamCallback = null) {
        try {
            aidaLogging('💬 Generating conversational response for:', message);
            if (images && images.length > 0) {
                aidaLogging('🖼️ Processing with', images.length, 'image(s)');
            }

            // Use AI chatbot service for intelligent conversation with images
            const response = await this.chatbotService.generateResponse(message, images, streamCallback);

            aidaLogging('✅ Generated response length:', response.length);
            return response;

        } catch (error) {
            aidaLogging('❌ Error generating conversation response:', error);

            // Fallback to simple response
            return this.getFallbackResponse(message);
        }
    }

    /**
     * Fallback response when chatbot service fails
     */
    getFallbackResponse(message) {
        const isVietnamese = /[àáảãạăắằẳẵặâấầẩẫậđèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵ]/.test(message);

        if (isVietnamese) {
            return `# 🤖 AIDA Assistant

Xin chào! Tôi là AIDA, trợ lý AI chuyên về lập trình.

**Tôi có thể giúp bạn:**
- Trả lời câu hỏi về coding
- Review và phân tích code  
- Debug và troubleshooting
- Giải thích concepts và patterns

**Commands đặc biệt:**
- \`@review-file\` - Review file hiện tại
- \`@review-changes\` - Phân tích git changes
- \`@review-all-changes\` - Phân tích TẤT CẢ git changes trong workspace
- \`@review-pr\` - Review pull request  
- \`@sync-review-templates\` - Sync templates
- \`@dependency\` - Phân tích dependency graph

Bạn đang làm gì thú vị vậy? 🚀`;
        } else {
            return `# 🤖 AIDA Assistant

Hello! I'm AIDA, your AI coding assistant.

**I can help you with:**
- Programming questions and concepts
- Code review and analysis
- Debugging and troubleshooting
- Best practices and patterns

**Special Commands:**
- \`@review-file\` - Review current file
- \`@review-changes\` - Analyze git changes
- \`@dependency\` - Analyze project dependencies
- \`@review-all-changes\` - Analyze ALL git changes in workspace
- \`@review-pr\` - Review pull request
- \`@sync-review-templates\` - Sync templates

What interesting project are you working on? 🚀`;
        }
    }

    /**
     * Get the HTML content for the sidebar using template system
     */
    async getCopilotSidebarHTML() {
        try {
            // Initialize template loader if needed
            if (!this.templateLoader) {
                this.templateLoader = new TemplateLoader(this.context.extensionPath);
            }

            return await this.templateLoader.getSidebarTemplate();
        } catch (error) {
            aidaLogging('Failed to load template:', error);
            // Return error template from file
            try {
                const fs = require('fs');
                const errorTemplatePath = require('path').join(this.context.extensionPath, 'scripts', 'chatbot', 'templates', 'sidebar-error.html');
                let html = fs.readFileSync(errorTemplatePath, 'utf8');
                return html.replace(/\{\{ERROR_MESSAGE\}\}/g, error.message);
            } catch (e) {
                // Ultimate fallback
                return `<!DOCTYPE html><html><body style="font-family:var(--vscode-font-family);background:var(--vscode-sideBar-background);color:var(--vscode-errorForeground);padding:20px;text-align:center;"><h3>Template Loading Error</h3><p>${error.message}</p></body></html>`;
            }
        }
    }

}

// Mix in extracted methods from chatbot-agent.js and chatbot-context.js
Object.assign(CopilotSidebarChat.prototype, agentMethods, contextMethods);

/**
 * Initialize Chatbot Sidebar (True GitHub Copilot Experience)
 */
function initializeCopilotSidebarChat(context) {
    try {
        const sidebarChat = new CopilotSidebarChat(context);
        const provider = sidebarChat.registerSidebarView();

        // Register commands
        const openSidebarChatCommand = vscode.commands.registerCommand('aida.openSidebarChat', () => {
            sidebarChat.show();
        });

        aidaLogging('✅ AIDA Chatbot Sidebar initialized');

        return {
            sidebarChat,
            provider,
            openSidebarChatCommand
        };

    } catch (error) {
        aidaLogging('❌ Failed to initialize Chatbot Sidebar:', error);
        return null;
    }
}

module.exports = {
    CopilotSidebarChat,
    AidaChatViewProvider,
    initializeCopilotSidebarChat
};
