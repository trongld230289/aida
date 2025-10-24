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
                        result += '\n\n**' + button.title + '**\n\n';
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
                    const reviewFileModule = require('./review-file.js');
                    await reviewFileModule.aiReviewFile(messageWithoutParticipant, mockStream, null, this.context);
                    return result || '✅ **File Review Complete**\n\nCode analysis completed.';

                case 'review-changes':  
                    const reviewChangesModule = require('./review-changes.js');
                    await reviewChangesModule.aiReviewChanges(messageWithoutParticipant, mockStream, null, this.context);
                    return result || '✅ **Changes Review Complete**\n\nGit changes analysis completed.';

                case 'review-pr':
                    const reviewPRModule = require('./review-pr.js');
                    await reviewPRModule.handleReviewPr(mockContext, mockStream, this.context);
                    return result || '✅ **PR Review Complete**\n\nPull request analysis completed.';

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

        /* Sidebar optimized header */
        .sidebar-header {
            padding: 8px 12px;
            border-bottom: 1px solid var(--vscode-sideBar-border);
            background-color: var(--vscode-sideBarSectionHeader-background);
            display: flex;
            align-items: center;
            justify-content: space-between;
            flex-shrink: 0;
            min-height: 35px;
        }

        .header-title {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 11px;
            font-weight: 600;
            color: var(--vscode-sideBarSectionHeader-foreground);
        }

        .aida-icon {
            width: 14px;
            height: 14px;
            border-radius: 50%;
            background: linear-gradient(135deg, #7c3aed 0%, #3b82f6 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 8px;
            font-weight: bold;
        }

        .header-actions {
            display: flex;
            gap: 2px;
        }

        .header-btn {
            width: 16px;
            height: 16px;
            border: none;
            background: transparent;
            color: var(--vscode-icon-foreground);
            cursor: pointer;
            border-radius: 2px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
        }

        .header-btn:hover {
            background-color: var(--vscode-toolbar-hoverBackground);
        }

        /* Chat messages - optimized for sidebar */
        .chat-container {
            flex: 1;
            overflow-y: auto;
            padding: 8px;
            display: flex;
            flex-direction: column;
            gap: 12px;
        }

        .message {
            display: flex;
            flex-direction: column;
            gap: 4px;
        }

        .message-meta {
            display: flex;
            align-items: center;
            gap: 4px;
            font-size: 10px;
            color: var(--vscode-descriptionForeground);
        }

        .msg-avatar {
            width: 14px;
            height: 14px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 8px;
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

        .message-body {
            margin-left: 18px;
            padding: 8px;
            border-radius: 6px;
            font-size: 11px;
            line-height: 1.4;
            word-wrap: break-word;
            word-break: break-word;
        }

        .message.user .message-body {
            background-color: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            color: var(--vscode-input-foreground);
        }

        .message.assistant .message-body {
            background-color: var(--vscode-textCodeBlock-background);
            border: 1px solid var(--vscode-panel-border);
            color: var(--vscode-editor-foreground);
        }

        /* Code in messages - sidebar optimized */
        .message-body pre {
            background-color: var(--vscode-textCodeBlock-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            padding: 6px;
            margin: 4px 0;
            overflow-x: auto;
            font-family: var(--vscode-editor-font-family);
            font-size: 10px;
        }

        .message-body code {
            background-color: var(--vscode-textCodeBlock-background);
            padding: 1px 3px;
            border-radius: 2px;
            font-family: var(--vscode-editor-font-family);
            font-size: 10px;
        }

        /* Input area - sidebar optimized */
        .input-area {
            padding: 8px;
            border-top: 1px solid var(--vscode-sideBar-border);
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
            min-height: 28px;
            max-height: 80px;
            padding: 4px 24px 4px 8px;
            border: 1px solid var(--vscode-input-border);
            border-radius: 12px;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            font-size: 11px;
            font-family: inherit;
            resize: none;
            outline: none;
            overflow-y: auto;
        }

        .msg-input:focus {
            border-color: var(--vscode-focusBorder);
        }

        .msg-input::placeholder {
            color: var(--vscode-input-placeholderForeground);
        }

        .send-btn {
            position: absolute;
            right: 4px;
            bottom: 4px;
            width: 20px;
            height: 20px;
            border: none;
            border-radius: 50%;
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

        /* Quick actions - sidebar style */
        .quick-actions {
            display: flex;
            flex-wrap: wrap;
            gap: 3px;
            margin-top: 6px;
        }

        .quick-btn {
            padding: 2px 6px;
            border: 1px solid var(--vscode-button-border);
            border-radius: 8px;
            background-color: transparent;
            color: var(--vscode-button-secondaryForeground);
            font-size: 9px;
            cursor: pointer;
            white-space: nowrap;
        }

        .quick-btn:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }

        /* Typing indicator */
        .typing {
            display: none;
            margin-left: 18px;
            padding: 4px 8px;
            color: var(--vscode-descriptionForeground);
            font-size: 10px;
            font-style: italic;
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
            width: 32px;
            height: 32px;
            border-radius: 50%;
            background: linear-gradient(135deg, #7c3aed 0%, #3b82f6 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 14px;
            margin-bottom: 8px;
        }

        .empty-state h3 {
            font-size: 13px;
            font-weight: 600;
            margin-bottom: 4px;
            color: var(--vscode-foreground);
        }

        .empty-state p {
            font-size: 10px;
            line-height: 1.3;
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
    </style>
</head>
<body>
    <div class="sidebar-header">
        <div class="header-title">
            <div class="aida-icon">A</div>
            <span>AIDA</span>
        </div>
        <div class="header-actions">
            <button class="header-btn" onclick="clearChat()" title="Clear">🗑️</button>
            <button class="header-btn" onclick="openSettings()" title="Settings">⚙️</button>
        </div>
    </div>

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
            <textarea 
                id="msgInput" 
                class="msg-input" 
                placeholder="Ask AIDA to help with code..."
                rows="1"
            ></textarea>
            <button id="sendBtn" class="send-btn">▶</button>
        </div>
        
        <div class="quick-actions">
            <button class="quick-btn" data-cmd="@review-file">📁 File</button>
            <button class="quick-btn" data-cmd="@review-changes">🔍 Changes</button>
            <button class="quick-btn" data-cmd="@review-pr">🔄 PR</button>
            <button class="quick-btn" data-cmd="@sync-review-templates">⚙️ Sync</button>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        
        const chatContainer = document.getElementById('chatContainer');
        const msgInput = document.getElementById('msgInput');
        const sendBtn = document.getElementById('sendBtn');
        const typingIndicator = document.getElementById('typingIndicator');
        
        // Auto-resize input
        msgInput.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 80) + 'px';
        });
        
        // Send on Enter
        msgInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
        
        sendBtn.addEventListener('click', sendMessage);
        
        // Quick action buttons
        document.querySelectorAll('.quick-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const cmd = this.getAttribute('data-cmd');
                msgInput.value = cmd + ' ';
                msgInput.focus();
                sendMessage();
            });
        });
        
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
            if (emptyState) emptyState.remove();
            
            const messageDiv = document.createElement('div');
            messageDiv.className = \`message \${role}\`;
            
            const timestamp = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            const displayName = role === 'user' ? 'You' : 'AIDA';
            const avatar = role === 'user' ? '👤' : '🤖';
            
            messageDiv.innerHTML = \`
                <div class="message-meta">
                    <div class="msg-avatar">\${avatar}</div>
                    <span>\${displayName}</span>
                    <span>\${timestamp}</span>
                </div>
                <div class="message-body">\${parseMarkdown(content)}</div>
            \`;
            
            chatContainer.appendChild(messageDiv);
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }
        
        function showTyping() {
            typingIndicator.classList.add('show');
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }
        
        function hideTyping() {
            typingIndicator.classList.remove('show');
        }
        
        function parseMarkdown(text) {
            text = text.replace(/\`\`\`([\\s\\S]*?)\`\`\`/g, '<pre><code>$1</code></pre>');
            text = text.replace(/\`([^\`]+)\`/g, '<code>$1</code>');
            text = text.replace(/\\*\\*([^\\*]+)\\*\\*/g, '<strong>$1</strong>');
            text = text.replace(/\\*([^\\*]+)\\*/g, '<em>$1</em>');
            text = text.replace(/\\n/g, '<br>');
            return text;
        }
        
        function clearChat() {
            vscode.postMessage({ type: 'clearChat' });
        }
        
        function openSettings() {
            vscode.postMessage({ type: 'openSettings' });
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