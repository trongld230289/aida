const vscode = require('vscode');
const path = require('path');
const { AidaChatbotService } = require('../chatbot/aida-chatbot-service.js');

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
        this.currentFileName = null; // Track current file
        this.initializeChatbot();
        this.setupFileWatcher();
    }

    /**
     * Setup file watcher to detect active file changes
     */
    setupFileWatcher() {
        // Listen for active editor changes
        this.context.subscriptions.push(
            vscode.window.onDidChangeActiveTextEditor(editor => {
                this.updateCurrentFile(editor);
            })
        );
        
        // Set initial file if there's an active editor
        this.updateCurrentFile(vscode.window.activeTextEditor);
    }

    /**
     * Update current file and notify webview
     */
    updateCurrentFile(editor) {
        if (editor && editor.document) {
            const fileName = editor.document.fileName;
            const displayName = fileName.split(/[\\/]/).pop(); // Get just filename
            
            if (this.currentFileName !== displayName) {
                this.currentFileName = displayName;
                
                // Notify webview about file change
                if (this.webviewView) {
                    this.webviewView.webview.postMessage({
                        type: 'updateCurrentFile',
                        fileName: displayName,
                        fullPath: fileName
                    });
                }
                
                console.log('📁 Current file updated:', displayName);
            }
        } else {
            // No active editor
            if (this.currentFileName !== null) {
                this.currentFileName = null;
                
                if (this.webviewView) {
                    this.webviewView.webview.postMessage({
                        type: 'updateCurrentFile',
                        fileName: null,
                        fullPath: null
                    });
                }
            }
        }
    }

    /**
     * Initialize chatbot service
     */
    async initializeChatbot() {
        try {
            await this.chatbotService.initialize();
            console.log('✅ AIDA Chatbot Service initialized');
        } catch (error) {
            console.error('❌ Failed to initialize chatbot service:', error);
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

        console.log('✅ AIDA Chat Sidebar registered (GitHub Copilot style)');
        return provider;
    }

    /**
     * Show the sidebar (like clicking Copilot icon)
     */
    show() {
        vscode.commands.executeCommand('aidaChatSidebar.focus');
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
    async processChatMessage(userMessage, images = [], mode = 'ask', model = 'claude-sonnet-4') {
        try {
            // Add user message to chat
            if (this.webviewView) {
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

            // Add to history with images and mode/model info
            this.chatHistory.push({
                role: 'user', 
                content: userMessage,
                images: images,
                mode: mode,
                model: model,
                timestamp: new Date()
            });

            console.log('💬 Processing sidebar message:', userMessage);

            // Show typing indicator
            if (this.webviewView) {
                this.webviewView.webview.postMessage({
                    type: 'showTyping'
                });
            }

            // Determine participant and get response with images
            const participant = this.determineParticipant(userMessage);
            const response = await this.callParticipant(participant, userMessage, images);

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

        } catch (error) {
            console.error('❌ Error processing sidebar message:', error);
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
        if (lowerMessage.includes('@review-pr')) return 'review-pr';
        if (lowerMessage.includes('@sync-review-templates')) return 'sync-review-templates';
        
        return 'general';
    }

    /**
     * Call AIDA participant with image support
     */
    async callParticipant(participant, message, images = []) {
        try {
            let result = '';
            
            const mockStream = {
                markdown: (text) => {
                    if (text) result += text;
                    return mockStream;
                },
                button: (button) => {
                    if (button && button.title) {
                        // Use simple placeholder with encoded data
                        const buttonId = 'AIDA_BTN_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                        // Store button data in a global object that webview can access
                        result += `<span data-button-id="${buttonId}" data-title="${button.title}" data-command="${button.command || ''}" data-args='${JSON.stringify(button.arguments || [])}' data-tooltip="${button.tooltip || button.title}" class="button-placeholder">[${button.title}]</span> `;
                    }
                    return mockStream;
                },
                progress: (text) => {
                    if (text) result += '🔄 ' + text + '\n';
                    return mockStream;
                },
                filetree: (tree) => {
                    if (tree) {
                        result += '\n**File Tree:**\n' + JSON.stringify(tree, null, 2) + '\n\n';
                    }
                    return mockStream;
                },
                anchor: (anchor) => {
                    if (anchor && anchor.value) {
                        result += '[' + (anchor.title || anchor.value) + '](' + anchor.value + ')';
                    }
                    return mockStream;
                },
                reference: (ref) => {
                    if (ref && ref.value) {
                        result += '📎 Reference: ' + ref.value + '\n';
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
                        console.log('📁 AIDA Chat: Calling review-file with mockStream');
                        const reviewFileModule = require('./review-file.js');
                        await reviewFileModule.aiReviewFile(messageWithoutParticipant, mockStream, null, this.context);
                        return result || '✅ **File Review Complete**\n\nCode analysis completed.';
                    } catch (error) {
                        console.error('❌ AIDA Chat review-file error:', error);
                        return '❌ **Error**: ' + error.message + '\n\nPlease check the console for details.';
                    }

                case 'review-changes':  
                    try {
                        console.log('📝 AIDA Chat: Calling review-changes with mockStream');
                        console.log('📝 MockStream methods:', Object.keys(mockStream));
                        const reviewChangesModule = require('./review-changes.js');
                        await reviewChangesModule.aiReviewChanges(messageWithoutParticipant, mockStream, null, this.context);
                        return result || '✅ **Changes Review Complete**\n\nGit changes analysis completed.';
                    } catch (error) {
                        console.error('❌ AIDA Chat review-changes error:', error);
                        return '❌ **Error**: ' + error.message + '\n\nPlease check the console for details.';
                    }

                case 'review-pr':
                    try {
                        console.log('🔄 AIDA Chat: Calling review-pr with correct parameter order');
                        const reviewPRModule = require('./review-pr.js');
                        // handleReviewPr expects: (request, context, stream, token)
                        await reviewPRModule.handleReviewPr(mockContext, this.context, mockStream, null);
                        return result || '✅ **PR Review Complete**\n\nPull request analysis completed.';
                    } catch (error) {
                        console.error('❌ AIDA Chat review-pr error:', error);
                        return '❌ **Error**: ' + error.message + '\n\nPlease check the console for details.';
                    }

                case 'sync-review-templates':
                    try {
                        console.log('🔄 AIDA Chat: Calling sync-review-templates with reusable logic');
                        const syncModule = require('./sync-review-templates.js');
                        await syncModule.aiSyncReviewTemplates(messageWithoutParticipant, mockStream, null, this.context);
                        return result || '✅ **Template Sync Complete**\n\nTemplate synchronization completed.';
                    } catch (error) {
                        console.error('❌ AIDA Chat sync-review-templates error:', error);
                        return '❌ **Error**: ' + error.message + '\n\nPlease check the console for details.';
                    }

                default:
                    return await this.generateGeneralResponse(message, images);
            }

        } catch (error) {
            console.error('❌ Error calling ' + participant + ' participant:', error);
            return '❌ **Error**\n\nSorry, I encountered an error: ' + error.message;
        }
    }

    /**
     * Generate conversational response using AI chatbot service with image support
     */
    async generateGeneralResponse(message, images = []) {
        try {
            console.log('💬 Generating conversational response for:', message);
            if (images && images.length > 0) {
                console.log('🖼️ Processing with', images.length, 'image(s)');
            }
            
            // Use AI chatbot service for intelligent conversation with images
            const response = await this.chatbotService.generateResponse(message, images);
            
            console.log('✅ Generated response length:', response.length);
            return response;
            
        } catch (error) {
            console.error('❌ Error generating conversation response:', error);
            
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
- \`@review-pr\` - Review pull request  
- \`@sync-review-templates\` - Sync templates

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
- \`@review-pr\` - Review pull request
- \`@sync-review-templates\` - Sync templates

What interesting project are you working on? 🚀`;
        }
    }
}

/**
 * WebView Provider for Sidebar (like GitHub Copilot)
 */
class AidaChatViewProvider {
    constructor(context, chatInstance) {
        this.context = context;
        this.chatInstance = chatInstance;
    }

    resolveWebviewView(webviewView, context, token) {
        this.chatInstance.webviewView = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.file(this.context.extensionPath)
            ]
        };

        webviewView.webview.html = this.getCopilotSidebarHTML();

        // Handle messages from webview
        webviewView.webview.onDidReceiveMessage(async (message) => {
            switch (message.type) {
                case 'sendMessage':
                    // Handle both text and image messages with mode and model
                    await this.chatInstance.processChatMessage(
                        message.message, 
                        message.images,
                        message.mode || 'ask',
                        message.model || 'claude-sonnet-4'
                    );
                    break;
                    
                case 'clearChat':
                    this.chatInstance.chatHistory = [];
                    this.chatInstance.messageHistory = []; // Clear message history too
                    this.chatInstance.historyIndex = -1;
                    this.chatInstance.chatbotService.clearHistory(); // Clear AI conversation history
                    webviewView.webview.postMessage({ type: 'clearChat' });
                    break;
                    
                case 'navigateHistory':
                    this.handleHistoryNavigation(message.direction, webviewView);
                    break;
                    
                case 'resetHistoryIndex':
                    this.chatInstance.historyIndex = -1;
                    break;
                    
                case 'openSettings':
                    vscode.commands.executeCommand('workbench.action.openSettings', 'aida');
                    break;
                    
                case 'closeChat':
                    // Hide the sidebar view
                    vscode.commands.executeCommand('workbench.action.closeSidebar');
                    break;

                case 'runDiffCommand':
                    // Simply execute the command - it already works!
                    if (message.command && Array.isArray(message.arguments)) {
                        await vscode.commands.executeCommand(message.command, ...message.arguments);
                    }
                    break;
                    
                case 'getSyncInfo':
                    try {
                        const fs = require('fs');
                        const path = require('path');
                        
                        let syncResult = '📁 **Extension templates:** `' + path.join(this.context.extensionPath, 'AIDA', 'templates') + '`\n\n';
                        
                        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
                            const workspaceAidaPath = path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, 'AIDA', 'templates');
                            syncResult += '📁 **Workspace AIDA path:** `' + workspaceAidaPath + '`\n\n';
                            syncResult += '📋 **Checking for new languages...**\n\n';
                            
                            // Check if workspace AIDA directory exists
                            try {
                                const extTemplatesPath = path.join(this.context.extensionPath, 'AIDA', 'templates');
                                if (fs.existsSync(extTemplatesPath)) {
                                    const extLanguages = fs.readdirSync(extTemplatesPath).filter(item => 
                                        fs.statSync(path.join(extTemplatesPath, item)).isDirectory()
                                    );
                                    
                                    syncResult += '✅ **All templates are up to date!**\n\n';
                                    syncResult += '## 📋 Available Templates:\n\n';
                                    
                                    // Categorize languages
                                    const webFrontend = ['angular', 'javascript', 'react', 'typescript', 'vue'];
                                    const backend = ['csharp', 'go', 'nestjs', 'nodejs', 'php', 'python', 'rust'];
                                    const other = ['express'];
                                    
                                    if (extLanguages.some(lang => webFrontend.includes(lang))) {
                                        syncResult += '**🌐 Web & Frontend:**\n';
                                        extLanguages.filter(lang => webFrontend.includes(lang)).forEach(lang => {
                                            syncResult += '- 📝 ' + lang + '\n';
                                        });
                                        syncResult += '\n';
                                    }
                                    
                                    if (extLanguages.some(lang => backend.includes(lang))) {
                                        syncResult += '**⚙️ Backend & Server:**\n';
                                        extLanguages.filter(lang => backend.includes(lang)).forEach(lang => {
                                            syncResult += '- 📝 ' + lang + '\n';
                                        });
                                        syncResult += '\n';
                                    }
                                    
                                    if (extLanguages.some(lang => other.includes(lang))) {
                                        syncResult += '**🔧 Other Languages:**\n';
                                        extLanguages.filter(lang => other.includes(lang)).forEach(lang => {
                                            syncResult += '- 📝 ' + lang + '\n';
                                        });
                                        syncResult += '\n';
                                    }
                                    
                                    syncResult += '**Total:** ' + extLanguages.length + ' language templates available\n\n';
                                    syncResult += '---\n\n💡 **Tip:** Use `@review-file` or `@review-changes` to start reviewing with templates\n';
                                } else {
                                    syncResult += '⚠️ **Extension templates not found**\n';
                                }
                            } catch (err) {
                                syncResult += '❌ **Error reading templates:** ' + err.message + '\n';
                            }
                        } else {
                            syncResult += '⚠️ **No workspace found**\n\nPlease open a workspace folder.\n';
                        }
                        
                        webviewView.webview.postMessage({
                            type: 'syncInfo',
                            syncResult: syncResult
                        });
                    } catch (error) {
                        webviewView.webview.postMessage({
                            type: 'syncInfo',
                            syncResult: '❌ **Sync Error:** ' + error.message
                        });
                    }
                    break;
                    // Open diff view for file button
                    console.log('🔍 Received runDiffCommand:', message);
                    if (message.command && Array.isArray(message.arguments)) {
                        console.log('🚀 Executing command:', message.command, 'with args:', message.arguments);
                        try {
                            if (message.command === 'aida.viewPrDiff') {
                                const diffId = message.arguments[0];
                                console.log('📄 Opening Monaco diff for diffId:', diffId);
                                
                                // Extract file path from diffId (format: github_id_filepath)
                                const pathPart = diffId.split('_').slice(2).join('_').replace(/_/g, '/');
                                console.log('� Extracted path:', pathPart);
                                
                                // Try to find the file in workspace
                                const workspaceFolders = vscode.workspace.workspaceFolders;
                                if (workspaceFolders && workspaceFolders.length > 0) {
                                    const filePath = vscode.Uri.joinPath(workspaceFolders[0].uri, pathPart);
                                    console.log('🔍 Opening file:', filePath.toString());
                                    
                                    // Open the file
                                    await vscode.commands.executeCommand('vscode.open', filePath);
                                    vscode.window.showInformationMessage(`Opened file: ${pathPart}`);
                                } else {
                                    vscode.window.showErrorMessage('No workspace folder found');
                                }
                            } else {
                                await vscode.commands.executeCommand(message.command, ...message.arguments);
                            }
                            console.log('✅ Command executed successfully');
                        } catch (error) {
                            console.error('❌ Command execution failed:', error);
                            vscode.window.showErrorMessage(`Failed to open file: ${error.message}`);
                        }
                    } else {
                        console.error('❌ Invalid command or arguments:', message);
                    }
                    break;
            }
        });

        console.log('✅ AIDA Chat Sidebar WebView resolved');
    }

    handleHistoryNavigation(direction, webviewView) {
        const messageHistory = this.chatInstance.messageHistory;
        if (messageHistory.length === 0) return;

        if (direction === 'up') {
            // Navigate to older messages
            if (this.chatInstance.historyIndex === -1) {
                // Start navigating from the end
                this.chatInstance.historyIndex = messageHistory.length - 1;
            } else if (this.chatInstance.historyIndex > 0) {
                this.chatInstance.historyIndex--;
            }
        } else if (direction === 'down') {
            // Navigate to newer messages
            if (this.chatInstance.historyIndex !== -1) {
                this.chatInstance.historyIndex++;
                if (this.chatInstance.historyIndex >= messageHistory.length) {
                    // Reset to current input (clear field)
                    this.chatInstance.historyIndex = -1;
                    webviewView.webview.postMessage({ 
                        type: 'setInputValue', 
                        value: '' 
                    });
                    return;
                }
            }
        }

        // Send the message from history to webview
        if (this.chatInstance.historyIndex >= 0 && this.chatInstance.historyIndex < messageHistory.length) {
            webviewView.webview.postMessage({ 
                type: 'setInputValue', 
                value: messageHistory[this.chatInstance.historyIndex] 
            });
        }
    }

    /**
     * Get HTML for true sidebar (optimized for narrow width)
     */
    getCopilotSidebarHTML() {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AIDA Chat</title>
    <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/languages/typescript.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/languages/javascript.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/languages/csharp.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/languages/python.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/languages/json.min.js"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/vs2015.min.css">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            background-color: var(--vscode-sideBar-background);
            color: var(--vscode-sideBar-foreground);
            height: 100vh;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }

        /* GitHub Copilot Flat UI Design */
        .chat-container {
            flex: 1;
            overflow-y: auto;
            padding: 16px 12px;
            display: flex;
            flex-direction: column;
            gap: 16px;
        }

        .message {
            display: flex;
            flex-direction: column;
            gap: 8px;
            padding-bottom: 16px;
            position: relative;
        }

        /* GitHub Copilot style separator - very subtle */
        .message:not(:last-child)::after {
            content: '';
            position: absolute;
            bottom: 0;
            left: 12px;
            right: 12px;
            height: 1px;
            background: var(--vscode-widget-border);
            opacity: 0.1;
        }

        /* GitHub Copilot separator - very light line with flag */
        .conversation-starter {
            margin-top: 16px;
            padding-top: 12px;
            border-top: 1px solid var(--vscode-widget-border);
            border-top-color: rgba(128, 128, 128, 0.15);
            position: relative;
        }

        /* Simple flag for regular separators */
        .conversation-starter::before {
            content: '🏁';
            position: absolute;
            top: -8px;
            left: 8px;
            background: var(--vscode-sideBar-background);
            padding: 0 4px;
            font-size: 10px;
            opacity: 0.6;
        }

        /* "New Conversation" text only for truly new conversations */
        .conversation-starter.truly-new-conversation::before {
            content: '💬 New Conversation';
            left: 50%;
            transform: translateX(-50%);
            padding: 0 8px;
            font-size: 10px;
            color: var(--vscode-descriptionForeground);
            font-weight: 500;
            opacity: 0.8;
        }

        .message-meta {
            display: flex;
            align-items: center;
            gap: 12px;
            font-size: 12px;
            font-weight: 600;
            color: var(--vscode-foreground);
            margin-bottom: 4px;
        }

        .msg-avatar {
            width: 20px;
            height: 20px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            font-weight: 600;
            flex-shrink: 0;
        }

        .message.user .msg-avatar {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }

        .message.assistant .msg-avatar {
            background: linear-gradient(135deg, #7c3aed 0%, #3b82f6 100%);
            color: white;
        }

        /* Flat message design like GitHub Copilot */
        .message-body {
            margin-left: 0;
            padding: 0;
            font-size: 12px;
            line-height: 1.4;
            word-wrap: break-word;
            word-break: break-word;
            color: var(--vscode-foreground);
        }
        
        .message-body hr {
            border-color: #ffffff2e;
            margin: 2px 0;
        }

        .message.user .message-body {
            padding: 0px 12px;
            margin-left: 28px;
            background-color: var(--vscode-chat-requestBubbleBackground);
            border-radius: 6px;
            color: var(--vscode-foreground);
            opacity: 0.95;
        }

        .message.user .message-body:hover {
            background-color: var(--vscode-chat-requestBubbleHoverBackground);
        }

        .message.assistant .message-body {
            color: var(--vscode-foreground);
        }

        /* GitHub Copilot Code Styling with Syntax Highlighting */
        .message-body pre {
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            padding: 8px 10px;
            margin: 6px 0;
            overflow-x: auto;
            font-family: var(--vscode-editor-font-family);
            font-size: 11px;
            line-height: 1.3;
            position: relative;
        }

        .message-body pre code {
            background: none !important;
            padding: 0 !important;
            border-radius: 0 !important;
            font-family: var(--vscode-editor-font-family);
            font-size: 11px;
            color: var(--vscode-editor-foreground);
        }

        .message-body code:not(pre code) {
            background-color: var(--vscode-textCodeBlock-background);
            padding: 1px 4px;
            border-radius: 3px;
            font-family: var(--vscode-editor-font-family);
            font-size: 11px;
            color: var(--vscode-textPreformat-foreground);
        }

        /* Highlight.js theme override for VS Code */
        .hljs {
            background: transparent !important;
            color: var(--vscode-editor-foreground) !important;
        }

        /* Markdown elements styling - GitHub Copilot size */
        .message-body h1, .message-body h2, .message-body h3, .message-body h4 {
            margin: 8px 0 6px 0;
            font-weight: 600;
            color: var(--vscode-foreground);
        }

        .message-body h1 { font-size: 1.538em; }
        .message-body h2 { font-size: 1.384em; }
        .message-body h3 { font-size: 1.157em; }
        .message-body h4 { 
            font-size: 1em; 
            padding: 4px 0;
        }

        .message-body p {
            margin: 8px 0;
            line-height: 1.5;
        }

            /* File diff buttons like GitHub Copilot */
            .file-diff-btn {
                background-color: var(--vscode-button-background);
                color: var(--vscode-button-foreground);
                border: 1px solid var(--vscode-button-border);
                border-radius: 3px;
                padding: 4px 8px;
                font-size: 12px;
                cursor: pointer;
                margin: 2px 4px 2px 0;
                display: inline-block;
                vertical-align: middle;
                transition: background-color 0.1s;
            }

            .file-diff-btn:hover {
                background-color: var(--vscode-button-hoverBackground);
                border-color: var(--vscode-button-hoverBorder);
            }

        .file-diff-btn:active {
            background-color: var(--vscode-button-background);
            transform: translateY(1px);
        }

        .button-placeholder {
            font-weight: bold;
            color: var(--vscode-textLink-foreground);
            text-decoration: underline;
            cursor: pointer;
        }        .message-body ul, .message-body ol {
            margin: 8px 0;
            padding-left: 20px;
        }

        .message-body li {
            margin: 4px 0;
        }

        .message-body blockquote {
            border-left: 3px solid var(--vscode-textLink-foreground);
            padding-left: 12px;
            margin: 8px 0;
            font-style: italic;
            opacity: 0.8;
        }

        /* Input area - sidebar optimized */
        /* GitHub Copilot Input Area - Flat Design */
        .input-area {
            padding: 12px;
            border-top: 1px solid var(--vscode-panel-border);
            background-color: var(--vscode-sideBar-background);
            flex-shrink: 0;
        }

        /* Current File Indicator - GitHub Copilot Style */
        .current-file-indicator {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 4px 6px;
            background-color: var(--vscode-badge-background);
            border: none;
            border-radius: 12px;
            margin-bottom: 6px;
            font-size: 10px;
            color: var(--vscode-badge-foreground);
            max-width: fit-content;
        }

        .file-icon {
            font-size: 10px;
            flex-shrink: 0;
            opacity: 0.8;
        }

        .file-info {
            flex: 1;
            display: flex;
            align-items: center;
            gap: 4px;
        }

        .file-name {
            font-weight: 400;
            color: var(--vscode-badge-foreground);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 120px;
        }

        .file-label {
            display: none; /* Hide label like Copilot */
        }

        .remove-file-btn {
            width: 12px;
            height: 12px;
            border: none;
            background: transparent;
            color: var(--vscode-badge-foreground);
            cursor: pointer;
            border-radius: 2px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            flex-shrink: 0;
            opacity: 0.7;
            margin-left: 2px;
        }

        .remove-file-btn:hover {
            opacity: 1;
            background-color: rgba(255, 255, 255, 0.1);
        }

        /* Mode and Model selectors */
        .chat-controls {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-top: 8px;
            gap: 8px;
        }

        .mode-selector {
            display: flex;
            background-color: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            border-radius: 6px;
            overflow: hidden;
        }

        .mode-button {
            padding: 4px 12px;
            border: none;
            background: transparent;
            color: var(--vscode-input-foreground);
            font-size: 11px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            gap: 4px;
        }

        .mode-button:hover {
            background-color: var(--vscode-list-hoverBackground);
        }

        .mode-button.active {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }

        .model-selector {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 4px 8px;
            background-color: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            border-radius: 6px;
            cursor: pointer;
            font-size: 11px;
            color: var(--vscode-input-foreground);
            transition: all 0.2s;
        }

        .model-selector:hover {
            background-color: var(--vscode-list-hoverBackground);
        }

        .model-icon {
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: linear-gradient(135deg, #7c3aed 0%, #3b82f6 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 8px;
            font-weight: bold;
        }

        .model-name {
            font-weight: 500;
        }

        .model-status {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background-color: #22c55e;
        }

        /* Image attachments container - GitHub Copilot Style */
        .attachments-container {
            max-height: 60px;
            overflow-y: auto;
            margin-bottom: 6px;
            display: none;
            gap: 4px;
        }

        .attachments-container.has-attachments {
            display: flex;
            flex-wrap: wrap;
        }

        .image-attachment {
            display: flex;
            align-items: center;
            gap: 4px;
            padding: 3px 6px;
            background-color: var(--vscode-badge-background);
            border: none;
            border-radius: 12px;
            font-size: 10px;
            color: var(--vscode-badge-foreground);
            position: relative;
            max-width: fit-content;
        }

        .image-preview {
            width: 16px;
            height: 16px;
            border-radius: 2px;
            overflow: hidden;
            flex-shrink: 0;
            position: relative;
            cursor: pointer;
        }

        .image-preview img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }

        .image-filename {
            font-size: 10px;
            color: var(--vscode-badge-foreground);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            max-width: 80px;
        }

        .remove-image {
            width: 12px;
            height: 12px;
            border: none;
            background: none;
            color: var(--vscode-badge-foreground);
            cursor: pointer;
            border-radius: 2px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            opacity: 0.7;
            margin-left: 2px;
        }

        .remove-image:hover {
            opacity: 1;
            background-color: rgba(255, 255, 255, 0.1);
        }
            font-size: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0.7;
            border-radius: 2px;
        }

        .remove-image:hover {
            opacity: 1;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }

        /* Image hover tooltip */
        .image-tooltip {
            position: absolute;
            bottom: 100%;
            left: 50%;
            transform: translateX(-50%);
            background-color: var(--vscode-editorHoverWidget-background);
            border: 1px solid var(--vscode-editorHoverWidget-border);
            border-radius: 4px;
            padding: 8px;
            z-index: 1000;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.2s;
            max-width: 300px;
            max-height: 200px;
        }

        .image-tooltip.show {
            opacity: 1;
        }

        .image-tooltip img {
            max-width: 280px;
            max-height: 180px;
            object-fit: contain;
            border-radius: 2px;
        }

        .input-container {
            position: relative;
            display: flex;
            align-items: flex-end;
        }

        .msg-input {
            flex: 1;
            min-height: 36px;
            max-height: 120px;
            height: 36px; /* Default height */
            padding: 9px 36px 9px 12px;
            border: 2px solid var(--vscode-input-border);
            border-radius: 3px;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            font-size: 13px;
            font-family: inherit;
            resize: none;
            outline: none;
            overflow-y: auto;
            transition: border-color 0.2s ease;
            scrollbar-width: none; /* Firefox */
            -ms-overflow-style: none; /* IE and Edge */
        }

        .msg-input::-webkit-scrollbar {
            display: none; /* Chrome, Safari, Opera */
        }

        .msg-input:focus {
            border-color: var(--vscode-button-background);
            box-shadow: 0 0 0 0 var(--vscode-button-background);
        }

        .msg-input::placeholder {
            color: var(--vscode-input-placeholderForeground);
            opacity: 0.7;
        }

        /* GitHub Copilot Send Button */
        .send-btn {
            position: absolute;
            right: 8px;
            top: 50%;
            transform: translateY(-50%);
            width: 24px;
            height: 24px;
            border: none;
            border-radius: 4px;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 9px;
        }

        .send-btn:hover:not(:disabled) {
            background-color: var(--vscode-button-hoverBackground);
        }

        .send-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        /* User message images display */
        .message-images {
            margin-top: 8px;
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
        }

        .message-image {
            max-width: 200px;
            max-height: 150px;
            border-radius: 4px;
            border: 1px solid var(--vscode-widget-border);
            cursor: pointer;
            transition: transform 0.2s;
        }

        .message-image:hover {
            transform: scale(1.05);
        }

        /* Typing indicator - old bottom style (keeping for compatibility) */
        .typing {
            display: none;
            margin-left: 18px;
            padding: 4px 8px;
            color: var(--vscode-descriptionForeground);
            font-size: 10px;
            font-style: italic;
        }

        /* Inline typing indicator like GitHub Copilot */
        .inline-typing {
            display: flex;
            align-items: center;
            gap: 8px;
            color: var(--vscode-descriptionForeground);
            font-size: 11px;
            font-style: italic;
            padding: 4px 0;
        }

        .typing.show { display: block; }

        .typing-dots {
            display: inline-flex;
            gap: 1px;
            margin-left: 4px;
        }

        .typing-dot {
            width: 2px;
            height: 2px;
            border-radius: 50%;
            background-color: var(--vscode-descriptionForeground);
            animation: typing 1.4s infinite ease-in-out;
        }

        .typing-dot:nth-child(1) { animation-delay: -0.32s; }
        .typing-dot:nth-child(2) { animation-delay: -0.16s; }

        @keyframes typing {
            0%, 80%, 100% { opacity: 0.3; }
            40% { opacity: 1; }
        }

        /* Empty state - sidebar optimized */
        .empty-state {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
            text-align: center;
            color: var(--vscode-descriptionForeground);
            padding: 16px 8px;
        }

        .empty-icon {
            width: 48px;
            height: 48px;
            border-radius: 50%;
            background: linear-gradient(135deg, #7c3aed 0%, #3b82f6 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 24px;
            margin-bottom: 12px;
            box-shadow: 0 4px 16px rgba(124, 58, 237, 0.3);
        }

        .empty-state h3 {
            font-size: 14px;
            font-weight: 600;
            margin-bottom: 6px;
            color: var(--vscode-foreground);
        }

        .empty-state p {
            font-size: 11px;
            line-height: 1.4;
        }

        /* Scrollbar - thin for sidebar */
        .chat-container::-webkit-scrollbar {
            width: 4px;
        }

        .chat-container::-webkit-scrollbar-track {
            background: transparent;
        }

        .chat-container::-webkit-scrollbar-thumb {
            background-color: var(--vscode-scrollbarSlider-background);
            border-radius: 2px;
        }

        .chat-container::-webkit-scrollbar-thumb:hover {
            background-color: var(--vscode-scrollbarSlider-hoverBackground);
        }

        /* Auto-suggest dropdown for @ participants */
        .participant-suggest {
            position: absolute;
            bottom: 100%;
            left: 0;
            right: 0;
            background: var(--vscode-dropdown-background);
            border: 1px solid var(--vscode-dropdown-border);
            border-radius: 4px;
            max-height: 200px;
            overflow-y: auto;
            z-index: 1000;
            display: none;
        }

        .participant-item {
            padding: 8px 12px;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 12px;
            border-bottom: 1px solid var(--vscode-widget-border);
        }

        .participant-item:last-child {
            border-bottom: none;
        }

        .participant-item:hover,
        .participant-item.selected {
            background-color: var(--vscode-list-hoverBackground);
        }
        
        .participant-item.selected {
            background-color: var(--vscode-list-activeSelectionBackground);
        }
        
        .participant-item.selected .participant-name,
        .participant-item.selected .participant-description {
            color: var(--vscode-list-activeSelectionForeground);
        }

        .participant-icon {
            font-size: 14px;
        }

        .participant-name {
            font-weight: 600;
            color: var(--vscode-foreground);
        }

        .participant-description {
            color: var(--vscode-descriptionForeground);
            font-size: 11px;
        }
    </style>
</head>
<body>
    <div class="chat-container" id="chatContainer">
        <div class="empty-state">
            <div class="empty-icon">🤖</div>
            <h3>Hi! I'm AIDA</h3>
            <p>I can help you review code, analyze changes, and more!</p>
        </div>
    </div>

    <div class="typing" id="typingIndicator">
        <span>AIDA is thinking</span>
        <div class="typing-dots">
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
        </div>
    </div>

    <div class="input-area">
        <div class="current-file-indicator" id="currentFileIndicator" style="display: none;">
            <div class="file-icon">📁</div>
            <div class="file-info">
                <span class="file-name" id="currentFileName">No file selected</span>
                <span class="file-label">Current file</span>
            </div>
            <button class="remove-file-btn" id="removeFileBtn" title="Clear file context">×</button>
        </div>
        
        <div class="attachments-container" id="attachmentsContainer"></div>
        <div class="input-container">
            <div class="participant-suggest" id="participantSuggest"></div>
            <textarea 
                id="msgInput" 
                class="msg-input" 
                placeholder="Ask AIDA to help with code, or let Agent automatically solve problems..."
                rows="1"
            ></textarea>
            <button id="sendBtn" class="send-btn">▶</button>
        </div>
        
        <div class="chat-controls">
            <div class="mode-selector">
                <button class="mode-button active" data-mode="ask">
                    <span>💬</span>
                    <span>Ask</span>
                </button>
                <button class="mode-button" data-mode="agent">
                    <span>🤖</span>
                    <span>Agent</span>
                </button>
            </div>
            
            <div class="model-selector" onclick="openModelConfig()">
                <div class="model-icon">C</div>
                <span class="model-name">Claude Sonnet 4</span>
                <div class="model-status" title="Model Active"></div>
            </div>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        
        const chatContainer = document.getElementById('chatContainer');
        const msgInput = document.getElementById('msgInput');
        const sendBtn = document.getElementById('sendBtn');
        const typingIndicator = document.getElementById('typingIndicator');
        const participantSuggest = document.getElementById('participantSuggest');
        const attachmentsContainer = document.getElementById('attachmentsContainer');
        const currentFileIndicator = document.getElementById('currentFileIndicator');
        const currentFileName = document.getElementById('currentFileName');
        const removeFileBtn = document.getElementById('removeFileBtn');
        
        // Image attachments array
        let imageAttachments = [];
        
        // Mode and model state
        let currentMode = 'ask'; // 'ask' or 'agent'
        let currentModel = 'claude-sonnet-4';
        let currentFileContext = null; // Track current file context
        
        // Mode switching
        document.querySelectorAll('.mode-button').forEach(button => {
            button.addEventListener('click', function() {
                // Remove active from all buttons
                document.querySelectorAll('.mode-button').forEach(btn => btn.classList.remove('active'));
                
                // Add active to clicked button
                this.classList.add('active');
                
                // Update current mode
                currentMode = this.getAttribute('data-mode');
                
                // Update placeholder based on mode
                updatePlaceholderForMode(currentMode);
            });
        });
        
        function updatePlaceholderForMode(mode) {
            if (mode === 'ask') {
                msgInput.placeholder = 'Ask AIDA to help with code, review files, or answer questions...';
            } else if (mode === 'agent') {
                msgInput.placeholder = 'Describe what you want to build, and Agent will automatically create it...';
            }
        }
        
        function openModelConfig() {
            vscode.postMessage({
                type: 'openModelConfig'
            });
        }
        
        // Initialize placeholder for default mode
        updatePlaceholderForMode(currentMode);
        
        // Remove file button handler
        removeFileBtn.addEventListener('click', function() {
            clearCurrentFile();
        });
        
        // Function to update current file display
        function updateCurrentFileDisplay(fileName, fullPath) {
            if (fileName) {
                currentFileName.textContent = fileName;
                currentFileIndicator.style.display = 'flex';
                currentFileContext = { fileName, fullPath };
                
                // Update placeholder based on file context
                updatePlaceholderWithFile(fileName);
            } else {
                clearCurrentFile();
            }
        }
        
        // Function to clear current file
        function clearCurrentFile() {
            currentFileIndicator.style.display = 'none';
            currentFileContext = null;
            updatePlaceholderForMode(currentMode);
        }
        
        // Update placeholder with file context
        function updatePlaceholderWithFile(fileName) {
            if (currentMode === 'ask') {
                msgInput.placeholder = 'Ask about ' + fileName + ' or any coding questions...';
            } else if (currentMode === 'agent') {
                msgInput.placeholder = 'What would you like Agent to do with ' + fileName + '?';
            }
        }
        
        // Available chat participants
        const participants = [
            { name: '@review-file', icon: '📁', description: 'Review current opening file or specify file path' },
            { name: '@review-changes', icon: '🔍', description: 'Review changes for current opening file or specify file path' },
            { name: '@review-pr', icon: '🔄', description: 'Review Azure DevOps Pull Request by PR ID or URL' },
            { name: '@sync-review-templates', icon: '⚙️', description: 'Sync AIDA review templates to workspace' }
        ];
        
        let selectedIndex = -1;

        // Auto-resize input
        msgInput.addEventListener('input', function() {
            this.style.height = 'auto';
            const newHeight = Math.max(Math.min(this.scrollHeight, 120), 36); // Min 36px, max 120px
            this.style.height = newHeight + 'px';
            
            // Reset history navigation when user starts typing
            vscode.postMessage({
                type: 'resetHistoryIndex'
            });
            
            // Handle @ participant suggestions
            handleParticipantSuggest(this.value, this.selectionStart);
            
            // Update send button state
            updateSendButtonState();
        });

        // Image paste handling - exactly like GitHub Copilot
        msgInput.addEventListener('paste', async function(event) {
            const items = event.clipboardData.items;
            let hasImage = false;
            
            for (let item of items) {
                if (item.type.indexOf('image') !== -1) {
                    event.preventDefault();
                    hasImage = true;
                    
                    const file = item.getAsFile();
                    if (file) {
                        await addImageAttachment(file);
                    }
                    break;
                }
            }
            
            if (hasImage) {
                updateSendButtonState();
            }
        });

        // Drag and drop support
        msgInput.addEventListener('dragover', function(event) {
            event.preventDefault();
            this.style.borderColor = 'var(--vscode-button-background)';
        });

        msgInput.addEventListener('dragleave', function(event) {
            event.preventDefault();
            this.style.borderColor = 'var(--vscode-input-border)';
        });

        msgInput.addEventListener('drop', async function(event) {
            event.preventDefault();
            this.style.borderColor = 'var(--vscode-input-border)';
            
            const files = Array.from(event.dataTransfer.files);
            for (const file of files) {
                if (file.type.startsWith('image/')) {
                    await addImageAttachment(file);
                }
            }
            
            updateSendButtonState();
        });
        
        // Send on Enter and handle suggestions
        msgInput.addEventListener('keydown', function(e) {
            if (participantSuggest.style.display === 'block') {
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    navigateSuggestions(1);
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    navigateSuggestions(-1);
                } else if (e.key === 'Enter' && selectedIndex >= 0) {
                    e.preventDefault();
                    selectParticipant(selectedIndex);
                } else if (e.key === 'Escape') {
                    hideSuggestions();
                }
            } else if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            } else if (e.key === 'ArrowUp' && !e.shiftKey && !e.ctrlKey) {
                // Navigate message history up (older messages)
                e.preventDefault();
                navigateHistory('up');
            } else if (e.key === 'ArrowDown' && !e.shiftKey && !e.ctrlKey) {
                // Navigate message history down (newer messages)
                e.preventDefault();
                navigateHistory('down');
            }
        });
        
        sendBtn.addEventListener('click', sendMessage);
        
        // Participant suggestion functions
        function handleParticipantSuggest(value, cursorPos) {
            const beforeCursor = value.substring(0, cursorPos);
            const atMatch = beforeCursor.match(/@([a-z-]*)$/);
            
            if (atMatch) {
                const query = atMatch[1].toLowerCase();
                const filtered = participants.filter(p => 
                    p.name.toLowerCase().includes('@' + query)
                );
                
                if (filtered.length > 0) {
                    showSuggestions(filtered);
                } else {
                    hideSuggestions();
                }
            } else {
                hideSuggestions();
            }
        }
        
        function showSuggestions(filtered) {
            selectedIndex = -1;
            participantSuggest.innerHTML = filtered.map((p, index) => 
                '<div class="participant-item" data-index="' + index + '">' +
                    '<span class="participant-icon">' + p.icon + '</span>' +
                    '<div>' +
                        '<div class="participant-name">' + p.name + '</div>' +
                        '<div class="participant-description">' + p.description + '</div>' +
                    '</div>' +
                '</div>'
            ).join('');
            
            participantSuggest.style.display = 'block';
            
            // Add click handlers
            participantSuggest.querySelectorAll('.participant-item').forEach((item, index) => {
                item.addEventListener('click', () => selectParticipant(index));
            });
        }
        
        function hideSuggestions() {
            participantSuggest.style.display = 'none';
            selectedIndex = -1;
        }
        
        function navigateSuggestions(direction) {
            const items = participantSuggest.querySelectorAll('.participant-item');
            if (items.length === 0) return;
            
            // Remove previous selection
            items.forEach(item => item.classList.remove('selected'));
            
            // Update selected index
            selectedIndex += direction;
            if (selectedIndex < 0) selectedIndex = items.length - 1;
            if (selectedIndex >= items.length) selectedIndex = 0;
            
            // Add selection to current item
            items[selectedIndex].classList.add('selected');
        }
        
        function selectParticipant(index) {
            const items = participantSuggest.querySelectorAll('.participant-item');
            if (index >= 0 && index < items.length) {
                const participantName = items[index].querySelector('.participant-name').textContent;
                
                // Replace the @ query with selected participant
                const value = msgInput.value;
                const cursorPos = msgInput.selectionStart;
                const beforeCursor = value.substring(0, cursorPos);
                const afterCursor = value.substring(cursorPos);
                const atMatch = beforeCursor.match(/@([a-z-]*)$/);
                
                if (atMatch) {
                    const newValue = beforeCursor.replace(/@([a-z-]*)$/, participantName + ' ') + afterCursor;
                    msgInput.value = newValue;
                    msgInput.focus();
                    msgInput.setSelectionRange(newValue.length - afterCursor.length, newValue.length - afterCursor.length);
                }
            }
            hideSuggestions();
        }
        
        // Image attachment functions
        async function addImageAttachment(file) {
            // Validate file size (5MB limit like Claude)
            const maxSize = 5 * 1024 * 1024; // 5MB
            if (file.size > maxSize) {
                showError('Image too large. Please use images smaller than 5MB.');
                return;
            }
            
            // Validate file type
            const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
            if (!allowedTypes.includes(file.type.toLowerCase())) {
                showError('Unsupported image format. Please use JPEG, PNG, GIF, or WebP.');
                return;
            }
            
            try {
                const reader = new FileReader();
                
                reader.onload = function(e) {
                    const imageData = {
                        id: Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                        data: e.target.result,
                        type: file.type,
                        name: file.name || 'image',
                        size: file.size
                    };
                    
                    imageAttachments.push(imageData);
                    displayImageAttachment(imageData);
                    updateAttachmentsVisibility();
                };
                
                reader.onerror = function() {
                    showError('Failed to read image file.');
                };
                
                reader.readAsDataURL(file);
            } catch (error) {
                showError('Error processing image: ' + error.message);
            }
        }
        
        function displayImageAttachment(imageData) {
            const attachmentDiv = document.createElement('div');
            attachmentDiv.className = 'image-attachment';
            attachmentDiv.setAttribute('data-id', imageData.id);
            
            attachmentDiv.innerHTML = \`
                <div class="image-preview" onclick="showImageTooltip(this)">
                    <img src="\${imageData.data}" alt="\${imageData.name}">
                    <div class="image-tooltip">
                        <img src="\${imageData.data}" alt="\${imageData.name}">
                    </div>
                </div>
                <div class="image-filename" title="\${imageData.name}">\${imageData.name}</div>
                <button class="remove-image" onclick="removeImageAttachment('\${imageData.id}')" title="Remove image">×</button>
            \`;
            
            attachmentsContainer.appendChild(attachmentDiv);
        }
        
        function removeImageAttachment(imageId) {
            imageAttachments = imageAttachments.filter(img => img.id !== imageId);
            
            const attachmentElement = document.querySelector(\`[data-id="\${imageId}"]\`);
            if (attachmentElement) {
                attachmentElement.remove();
            }
            
            updateAttachmentsVisibility();
            updateSendButtonState();
        }
        
        function updateAttachmentsVisibility() {
            if (imageAttachments.length > 0) {
                attachmentsContainer.classList.add('has-attachments');
            } else {
                attachmentsContainer.classList.remove('has-attachments');
            }
        }
        
        function clearImageAttachments() {
            imageAttachments = [];
            attachmentsContainer.innerHTML = '';
            updateAttachmentsVisibility();
        }
        
        function updateSendButtonState() {
            const hasText = msgInput.value.trim().length > 0;
            const hasImages = imageAttachments.length > 0;
            
            // GitHub Copilot behavior: need text for send (can't send image-only)
            sendBtn.disabled = !hasText;
        }
        
        function showImageTooltip(element) {
            const tooltip = element.querySelector('.image-tooltip');
            tooltip.classList.add('show');
            
            setTimeout(() => {
                tooltip.classList.remove('show');
            }, 2000);
        }
        
        function showError(message) {
            // Could integrate with VS Code notifications or show inline error
            console.error('Image Error:', message);
            // For now, just log - could enhance with UI feedback later
        }
        function navigateHistory(direction) {
            // Get messageHistory from the extension context via postMessage
            vscode.postMessage({
                type: 'navigateHistory',
                direction: direction
            });
        }
        
        function sendMessage() {
            const message = msgInput.value.trim();
            if (!message) return;
            
            // Prepare images for sending
            const imagesToSend = imageAttachments.map(img => ({
                data: img.data,
                type: img.type,
                name: img.name
            }));
            
            vscode.postMessage({
                type: 'sendMessage',
                message: message,
                images: imagesToSend,
                mode: currentMode,
                model: currentModel,
                currentFile: currentFileContext
            });
            
            // Clear input and attachments
            msgInput.value = '';
            msgInput.style.height = 'auto';
            clearImageAttachments();
            updateSendButtonState();
        }
        
        function addMessage(content, role, images = []) {
            // Remove empty state
            const emptyState = chatContainer.querySelector('.empty-state');
            const isFirstMessage = emptyState !== null;
            if (emptyState) emptyState.remove();
            
            // GitHub Copilot behavior: Add separator for user messages when previous message wasn't from user
            const existingMessages = chatContainer.querySelectorAll('.message');
            const lastMessage = existingMessages[existingMessages.length - 1];
            const shouldAddSeparator = role === 'user' && (!lastMessage || !lastMessage.classList.contains('user'));
            
            const messageDiv = document.createElement('div');
            messageDiv.className = \`message \${role}\`;
            
            // Add simple separator like GitHub Copilot (not "New Conversation" unless first message)
            if (shouldAddSeparator) {
                messageDiv.classList.add('conversation-starter');
                
                // Only show "New Conversation" for truly first message
                if (isFirstMessage) {
                    messageDiv.classList.add('truly-new-conversation');
                }
            }
            
            const timestamp = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            const displayName = role === 'user' ? 'You' : 'AIDA';
            const avatar = role === 'user' ? '👤' : '🤖';
            
            // Parse markdown content
            const parsedContent = parseMarkdown(content);
            
            // Build images HTML for user messages
            let imagesHTML = '';
            if (role === 'user' && images && images.length > 0) {
                imagesHTML = '<div class="message-images">';
                images.forEach(img => {
                    imagesHTML += \`<img src="\${img.data}" alt="\${img.name || 'Image'}" class="message-image" onclick="expandImage(this)">\`;
                });
                imagesHTML += '</div>';
            }
            
            messageDiv.innerHTML = \`
                <div class="message-meta">
                    <div class="msg-avatar">\${avatar}</div>
                    <span>\${displayName}</span>
                    <span>\${timestamp}</span>
                </div>
                <div class="message-body">\${parsedContent}\${imagesHTML}</div>
            \`;
            
            chatContainer.appendChild(messageDiv);
            
            // Convert button placeholders to actual buttons
            const messageBody = messageDiv.querySelector('.message-body');
            if (messageBody) {
                const buttonPlaceholders = messageBody.querySelectorAll('.button-placeholder');
                buttonPlaceholders.forEach(placeholder => {
                    const title = placeholder.getAttribute('data-title');
                    const command = placeholder.getAttribute('data-command');
                    const args = placeholder.getAttribute('data-args');
                    const tooltip = placeholder.getAttribute('data-tooltip');
                    
                    const button = document.createElement('button');
                    button.className = 'file-diff-btn';
                    button.textContent = title;
                    button.title = tooltip;
                    button.onclick = function() {
                        try {
                            const parsedArgs = JSON.parse(args);
                            openDiffView(command, JSON.stringify(parsedArgs));
                        } catch (e) {
                            console.error('Failed to parse button args:', e);
                        }
                    };
                    
                    placeholder.parentNode.replaceChild(button, placeholder);
                });
            }
            
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }
        
        function showTyping() {
            // Remove any existing typing message
            const existingTyping = chatContainer.querySelector('.typing-message');
            if (existingTyping) {
                existingTyping.remove();
            }
            
            // Remove empty state if exists
            const emptyState = chatContainer.querySelector('.empty-state');
            if (emptyState) emptyState.remove();
            
            // Create temporary typing message like GitHub Copilot
            const typingDiv = document.createElement('div');
            typingDiv.className = 'message assistant typing-message';
            
            const timestamp = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            
            typingDiv.innerHTML = 
                '<div class="message-meta">' +
                    '<div class="msg-avatar">🤖</div>' +
                    '<span>AIDA</span>' +
                    '<span>' + timestamp + '</span>' +
                '</div>' +
                '<div class="message-body">' +
                    '<div class="inline-typing">' +
                        '<span>AIDA is thinking</span>' +
                        '<div class="typing-dots">' +
                            '<div class="typing-dot"></div>' +
                            '<div class="typing-dot"></div>' +
                            '<div class="typing-dot"></div>' +
                        '</div>' +
                    '</div>' +
                '</div>';
            
            chatContainer.appendChild(typingDiv);
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }
        
        function hideTyping() {
            // Remove typing message instead of hiding indicator
            const typingMessage = chatContainer.querySelector('.typing-message');
            if (typingMessage) {
                typingMessage.remove();
            }
        }
        
        function parseMarkdown(text) {
            try {
                // Configure marked for GitHub Copilot style with highlight.js
                if (typeof marked !== 'undefined' && typeof hljs !== 'undefined') {
                    marked.setOptions({
                        breaks: true,
                        gfm: true,
                        headerIds: false,
                        mangle: false,
                        sanitize: false,  // Allow HTML for buttons
                        pedantic: false,
                        highlight: function(code, lang) {
                            if (lang && hljs.getLanguage(lang)) {
                                try {
                                    return hljs.highlight(code, { language: lang }).value;
                                } catch (err) {
                                    console.warn('Highlight.js error:', err);
                                }
                            }
                            return hljs.highlightAuto(code).value;
                        }
                    });
                    
                    const html = marked.parse(text);
                    
                    // Apply syntax highlighting to any remaining code blocks
                    setTimeout(() => {
                        document.querySelectorAll('pre code:not(.hljs)').forEach((block) => {
                            hljs.highlightElement(block);
                        });
                    }, 100);
                    
                    return html;
                } else if (typeof marked !== 'undefined') {
                    // Fallback without highlight.js
                    marked.setOptions({
                        breaks: true,
                        gfm: true,
                        headerIds: false,
                        mangle: false,
                        sanitize: false,
                        pedantic: false
                    });
                    return marked.parse(text);
                } else {
                    // Fallback to simple parsing with HTML support
                    text = text.replace(/\`\`\`([\\s\\S]*?)\`\`\`/g, '<pre><code>$1</code></pre>');
                    text = text.replace(/\`([^\`]+)\`/g, '<code>$1</code>');
                    text = text.replace(/\\*\\*([^\\*]+)\\*\\*/g, '<strong>$1</strong>');
                    text = text.replace(/\\*([^\\*]+)\\*/g, '<em>$1</em>');
                    text = text.replace(/\\n/g, '<br>');
                    return text;
                }
            } catch (error) {
                console.error('Markdown parsing error:', error);
                return text.replace(/\\n/g, '<br>');
            }
        }
        
        // Handle messages from extension
        window.addEventListener('message', event => {
            const message = event.data;
            
            switch (message.type) {
                case 'addUserMessage':
                    addMessage(message.message, 'user', message.images);
                    break;
                    
                case 'addAssistantMessage':
                    hideTyping();
                    addMessage(message.message, 'assistant');
                    break;
                    
                case 'showTyping':
                    showTyping();
                    break;
                    
                case 'showError':
                    hideTyping();
                    addMessage(\`❌ \${message.error}\`, 'assistant');
                    break;
                    
                case 'clearChat':
                    chatContainer.innerHTML = \`
                        <div class="empty-state">
                            <div class="empty-icon">🤖</div>
                            <h3>Hi! I'm AIDA</h3>
                            <p>I can help you review code, analyze changes, and more!</p>
                        </div>
                    \`;
                    break;
                    
                case 'syncInfo':
                    hideTyping();
                    addMessage(message.syncResult, 'assistant');
                    break;
                    
                case 'updateCurrentFile':
                    updateCurrentFileDisplay(message.fileName, message.fullPath);
                    break;
                    
                case 'setInputValue':
                    msgInput.value = message.value;
                    msgInput.focus();
                    // Auto-resize input
                    msgInput.style.height = 'auto';
                    const newHeight = Math.max(Math.min(msgInput.scrollHeight, 120), 36); // Min 36px, max 120px
                    msgInput.style.height = newHeight + 'px';
                    // Position cursor at end
                    msgInput.setSelectionRange(msgInput.value.length, msgInput.value.length);
                    break;
            }
        });
        
        // Focus input on load
        msgInput.focus();
        
        // Initialize send button state
        updateSendButtonState();

        // Image expand function
        window.expandImage = function(img) {
            // Simple image expansion - could enhance with modal
            const newWindow = window.open('', '_blank');
            newWindow.document.write(\`
                <html>
                    <head><title>Image Preview</title></head>
                    <body style="margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #000;">
                        <img src="\${img.src}" style="max-width: 100%; max-height: 100%; object-fit: contain;">
                    </body>
                </html>
            \`);
        };

            // Handle file diff button clicks
            window.openDiffView = function(command, argsJson) {
                let args = [];
                try {
                    args = argsJson ? JSON.parse(argsJson) : [];
                } catch (e) {
                    args = [];
                }
                vscode.postMessage({
                    type: 'runDiffCommand',
                    command,
                    arguments: args
                });
            };
    </script>
</body>
</html>`;
    }
}

/**
 * Initialize Copilot Sidebar Chat (True GitHub Copilot Experience)
 */
function initializeCopilotSidebarChat(context) {
    try {
        const sidebarChat = new CopilotSidebarChat(context);
        const provider = sidebarChat.registerSidebarView();

        // Register commands
        const openSidebarChatCommand = vscode.commands.registerCommand('aida.openSidebarChat', () => {
            sidebarChat.show();
        });

        console.log('✅ AIDA Copilot Sidebar Chat initialized');
        
        return {
            sidebarChat,
            provider,
            openSidebarChatCommand
        };

    } catch (error) {
        console.error('❌ Failed to initialize Copilot Sidebar Chat:', error);
        return null;
    }
}

module.exports = {
    CopilotSidebarChat,
    AidaChatViewProvider,
    initializeCopilotSidebarChat
};