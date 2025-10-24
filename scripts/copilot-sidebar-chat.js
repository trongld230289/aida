const vscode = require('vscode');
const path = require('path');

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
     * Process chat message through AIDA participants  
     */
    async processChatMessage(userMessage) {
        try {
            // Add user message to chat
            if (this.webviewView) {
                this.webviewView.webview.postMessage({
                    type: 'addUserMessage',
                    message: userMessage
                });
            }

            // Add to history
            this.chatHistory.push({
                role: 'user', 
                content: userMessage,
                timestamp: new Date()
            });

            console.log('💬 Processing sidebar message:', userMessage);

            // Show typing indicator
            if (this.webviewView) {
                this.webviewView.webview.postMessage({
                    type: 'showTyping'
                });
            }

            // Determine participant and get response
            const participant = this.determineParticipant(userMessage);
            const response = await this.callParticipant(participant, userMessage);

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
     * Call AIDA participant (same stream mock as before)
     */
    async callParticipant(participant, message) {
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
                        mockStream.progress('Syncing AIDA templates...');
                        const extensionModule = require('../extension.js');
                        
                        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
                            await extensionModule.syncNewLanguageTemplates(
                                path.join(this.context.extensionPath, 'AIDA', 'templates'),
                                path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, 'AIDA')
                            );
                            mockStream.markdown('\n✅ **Templates Synced Successfully**\n\nAIDA templates have been updated.\n');
                        } else {
                            mockStream.markdown('\n⚠️ **No Workspace Found**\n\nPlease open a workspace folder.\n');
                        }
                        
                        return result || '✅ **Templates Synced**\n\nAIDA templates updated successfully.';
                    } catch (error) {
                        mockStream.markdown('\n❌ **Template Sync Error**\n\nFailed: ' + error.message + '\n');
                        return '❌ **Template Sync Error**\n\nFailed: ' + error.message;
                    }

                default:
                    return this.generateGeneralResponse(message);
            }

        } catch (error) {
            console.error('❌ Error calling ' + participant + ' participant:', error);
            return '❌ **Error**\n\nSorry, I encountered an error: ' + error.message;
        }
    }

    /**
     * Generate general response
     */
    generateGeneralResponse(message) {
        return '# 🤖 AIDA Assistant\n\n' +
               'How can I help you?\n\n' +
               '**Available Commands:**\n' +
               '- `@review-file` - Review current file\n' +
               '- `@review-changes` - Review git changes\n' +
               '- `@review-pr` - Review pull request\n' +
               '- `@sync-review-templates` - Sync templates\n\n' +
               '*Powered by AIDA*';
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
                    await this.chatInstance.processChatMessage(message.message);
                    break;
                    
                case 'clearChat':
                    this.chatInstance.chatHistory = [];
                    webviewView.webview.postMessage({ type: 'clearChat' });
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

        .input-container {
            position: relative;
            display: flex;
            align-items: flex-end;
        }

        .msg-input {
            flex: 1;
            min-height: 36px;
            max-height: 120px;
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
            bottom: 8px;
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
        <div class="input-container">
            <div class="participant-suggest" id="participantSuggest"></div>
            <textarea 
                id="msgInput" 
                class="msg-input" 
                placeholder="Ask AIDA to help with code..."
                rows="1"
            ></textarea>
            <button id="sendBtn" class="send-btn">▶</button>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        
        const chatContainer = document.getElementById('chatContainer');
        const msgInput = document.getElementById('msgInput');
        const sendBtn = document.getElementById('sendBtn');
        const typingIndicator = document.getElementById('typingIndicator');
        const participantSuggest = document.getElementById('participantSuggest');
        
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
            this.style.height = Math.min(this.scrollHeight, 80) + 'px';
            
            // Handle @ participant suggestions
            handleParticipantSuggest(this.value, this.selectionStart);
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
        
        function sendMessage() {
            const message = msgInput.value.trim();
            if (!message) return;
            
            vscode.postMessage({
                type: 'sendMessage',
                message: message
            });
            
            msgInput.value = '';
            msgInput.style.height = 'auto';
        }
        
        function addMessage(content, role) {
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
            
            messageDiv.innerHTML = \`
                <div class="message-meta">
                    <div class="msg-avatar">\${avatar}</div>
                    <span>\${displayName}</span>
                    <span>\${timestamp}</span>
                </div>
                <div class="message-body">\${parsedContent}</div>
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
                    addMessage(message.message, 'user');
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
            }
        });
        
        // Focus input on load
        msgInput.focus();

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