const vscode = require('vscode');
const path = require('path');

/**
 * GitHub Copilot-Style Right Sidebar Chat Panel
 * Exactly like GitHub Copilot with right-side panel, chat bubbles, and full functionality
 */
class CopilotStyleChatPanel {
    constructor(context) {
        this.context = context;
        this.currentPanel = null;
        this.chatHistory = [];
        this.isProcessing = false;
    }

    /**
     * Check if should show AIDA chat instead of GitHub Copilot
     */
    shouldShowAidaChat() {
        const config = vscode.workspace.getConfiguration('aida');
        const hasNoGithubCopilot = config.get('hasNoGithubCopilot', false);
        
        // Show AIDA if setting is true OR if Copilot is not available
        const copilotExtension = vscode.extensions.getExtension('GitHub.copilot');
        const copilotAvailable = copilotExtension && copilotExtension.isActive;
        
        return hasNoGithubCopilot || !copilotAvailable;
    }

    /**
     * Create or show the Copilot-style chat panel (right sidebar)
     */
    createOrShowChatPanel() {
        // Check if we should show AIDA chat
        if (!this.shouldShowAidaChat()) {
            // Try to open GitHub Copilot chat instead
            vscode.commands.executeCommand('github.copilot.openChat').catch(() => {
                vscode.window.showInformationMessage(
                    'GitHub Copilot is not available. Enable "aida.hasNoGithubCopilot" to use AIDA Chat.',
                    'Enable AIDA Chat'
                ).then(selection => {
                    if (selection === 'Enable AIDA Chat') {
                        const config = vscode.workspace.getConfiguration('aida');
                        config.update('hasNoGithubCopilot', true, vscode.ConfigurationTarget.Global);
                        this.createOrShowChatPanel(); // Retry
                    }
                });
            });
            return;
        }

        // Force recreate panel to apply changes
        if (this.currentPanel) {
            this.currentPanel.dispose();
            this.currentPanel = null;
        }

        // Create webview panel that mimics GitHub Copilot position
        this.currentPanel = vscode.window.createWebviewPanel(
            'aidaCopilotChat',
            'AIDA Chat',
            {
                viewColumn: vscode.ViewColumn.Beside,
                preserveFocus: true // Don't steal focus from editor
            },
            {
                enableScripts: true,
                retainContextWhenHidden: false, // Don't retain to force refresh
                localResourceRoots: [
                    vscode.Uri.file(this.context.extensionPath)
                ]
            }
        );

        // Set the HTML content
        this.currentPanel.webview.html = this.getCopilotStyleHTML();

        // Handle messages from webview
        this.currentPanel.webview.onDidReceiveMessage(
            async (message) => {
                await this.handleChatMessage(message);
            },
            undefined,
            this.context.subscriptions
        );

        // Clean up when panel is closed
        this.currentPanel.onDidDispose(
            () => {
                this.currentPanel = null;
            },
            null,
            this.context.subscriptions
        );

        console.log('✅ AIDA Copilot-style chat panel created');
    }

    /**
     * Get HTML content that looks exactly like GitHub Copilot
     */
    getCopilotStyleHTML() {
        const timestamp = Date.now(); // Force refresh
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AIDA Chat - ${timestamp}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
            background-color: var(--vscode-sideBar-background);
            color: var(--vscode-sideBar-foreground);
            height: 100vh;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }

        /* GitHub Copilot-style header */
        .chat-header {
            padding: 12px 16px;
            border-bottom: 1px solid var(--vscode-sideBar-border);
            background-color: var(--vscode-sideBarTitle-background);
            display: flex;
            align-items: center;
            justify-content: space-between;
            flex-shrink: 0;
        }

        .chat-title {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 13px;
            font-weight: 600;
            color: var(--vscode-sideBarTitle-foreground);
        }

        .copilot-icon {
            width: 16px;
            height: 16px;
            border-radius: 50%;
            background: linear-gradient(135deg, #7c3aed 0%, #3b82f6 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 10px;
            font-weight: bold;
        }

        .chat-actions {
            display: flex;
            align-items: center;
            gap: 4px;
        }

        .action-button {
            width: 20px;
            height: 20px;
            border: none;
            background: transparent;
            color: var(--vscode-icon-foreground);
            cursor: pointer;
            border-radius: 3px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
        }

        .action-button:hover {
            background-color: var(--vscode-toolbar-hoverBackground);
        }

        /* Chat messages area */
        .chat-messages {
            flex: 1;
            overflow-y: auto;
            padding: 16px;
            display: flex;
            flex-direction: column;
            gap: 16px;
        }

        .message {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        .message-header {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
        }

        .message-avatar {
            width: 18px;
            height: 18px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            font-weight: 600;
            flex-shrink: 0;
        }

        .message.user .message-avatar {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }

        .message.assistant .message-avatar {
            background: linear-gradient(135deg, #7c3aed 0%, #3b82f6 100%);
            color: white;
        }

        .message-content {
            margin-left: 26px;
            padding: 12px;
            border-radius: 8px;
            font-size: 13px;
            line-height: 1.5;
            word-wrap: break-word;
        }

        .message.user .message-content {
            background-color: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            color: var(--vscode-input-foreground);
        }

        .message.assistant .message-content {
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            color: var(--vscode-editor-foreground);
        }

        /* Code blocks in messages */
        .message-content pre {
            background-color: var(--vscode-textCodeBlock-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 6px;
            padding: 12px;
            margin: 8px 0;
            overflow-x: auto;
            font-family: var(--vscode-editor-font-family);
            font-size: 12px;
        }

        .message-content code {
            background-color: var(--vscode-textCodeBlock-background);
            padding: 2px 4px;
            border-radius: 3px;
            font-family: var(--vscode-editor-font-family);
            font-size: 12px;
        }

        /* Chat input area - exactly like Copilot */
        .chat-input-area {
            padding: 12px 16px;
            border-top: 1px solid var(--vscode-sideBar-border);
            background-color: var(--vscode-sideBar-background);
            flex-shrink: 0;
        }

        /* Mode and Model selectors */
        .chat-controls {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 8px;
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

        .chat-input-container {
            position: relative;
            display: flex;
            align-items: flex-end;
            gap: 8px;
        }

        .chat-input {
            flex: 1;
            min-height: 32px;
            max-height: 120px;
            padding: 6px 32px 6px 12px;
            border: 1px solid var(--vscode-input-border);
            border-radius: 16px;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            font-size: 13px;
            font-family: inherit;
            resize: none;
            outline: none;
            overflow-y: auto;
        }

        .chat-input:focus {
            border-color: var(--vscode-focusBorder);
        }

        .chat-input::placeholder {
            color: var(--vscode-input-placeholderForeground);
        }

        .send-button {
            position: absolute;
            right: 6px;
            bottom: 6px;
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
            font-size: 10px;
            transition: all 0.2s;
        }

        .send-button:hover:not(:disabled) {
            background-color: var(--vscode-button-hoverBackground);
            transform: scale(1.05);
        }

        .send-button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        /* Suggestions like GitHub Copilot */
        .suggestions {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            margin-top: 8px;
        }

        .suggestion-chip {
            padding: 4px 8px;
            border: 1px solid var(--vscode-button-border);
            border-radius: 12px;
            background-color: transparent;
            color: var(--vscode-button-secondaryForeground);
            font-size: 11px;
            cursor: pointer;
            transition: all 0.2s;
            white-space: nowrap;
        }

        .suggestion-chip:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }

        /* Typing indicator */
        .typing-indicator {
            display: none;
            margin-left: 26px;
            padding: 8px 12px;
            color: var(--vscode-descriptionForeground);
            font-size: 12px;
            font-style: italic;
        }

        .typing-indicator.show {
            display: block;
        }

        .typing-dots {
            display: inline-flex;
            gap: 2px;
            margin-left: 4px;
        }

        .typing-dot {
            width: 3px;
            height: 3px;
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

        /* Empty state */
        .empty-state {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
            text-align: center;
            color: var(--vscode-descriptionForeground);
            padding: 32px 16px;
        }

        .empty-state-icon {
            width: 48px;
            height: 48px;
            border-radius: 50%;
            background: linear-gradient(135deg, #7c3aed 0%, #3b82f6 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 20px;
            margin-bottom: 16px;
        }

        .empty-state h2 {
            font-size: 16px;
            font-weight: 600;
            margin-bottom: 8px;
            color: var(--vscode-foreground);
        }

        .empty-state p {
            font-size: 13px;
            line-height: 1.4;
            max-width: 280px;
        }

        /* Scrollbar styling */
        .chat-messages::-webkit-scrollbar {
            width: 8px;
        }

        .chat-messages::-webkit-scrollbar-track {
            background: transparent;
        }

        .chat-messages::-webkit-scrollbar-thumb {
            background-color: var(--vscode-scrollbarSlider-background);
            border-radius: 4px;
        }

        .chat-messages::-webkit-scrollbar-thumb:hover {
            background-color: var(--vscode-scrollbarSlider-hoverBackground);
        }

        /* Hide scrollbar in Firefox */
        .chat-messages {
            scrollbar-width: thin;
            scrollbar-color: var(--vscode-scrollbarSlider-background) transparent;
        }
    </style>
</head>
<body>
    <div class="chat-header">
        <div class="chat-title">
            <div class="copilot-icon">A</div>
            <span>AIDA</span>
        </div>
        <div class="chat-actions">
            <button class="action-button" onclick="clearChat()" title="Clear conversation">
                🗑️
            </button>
            <button class="action-button" onclick="toggleSettings()" title="Settings">
                ⚙️
            </button>
        </div>
    </div>

    <div class="chat-messages" id="chatMessages">
        <div class="empty-state">
            <div class="empty-state-icon">🤖</div>
            <h2>Hi! I'm AIDA</h2>
            <p>I can help you review code, analyze changes, check pull requests, and more. What would you like me to help with?</p>
        </div>
    </div>

    <div class="typing-indicator" id="typingIndicator">
        <span>AIDA is thinking</span>
        <div class="typing-dots">
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
        </div>
    </div>

    <div class="chat-input-area">
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
        
        <div class="chat-input-container">
            <textarea 
                id="chatInput" 
                class="chat-input" 
                placeholder="Ask AIDA to help with code, or let Agent automatically solve problems..."
                rows="1"
            ></textarea>
            <button id="sendButton" class="send-button">
                ▶
            </button>
        </div>
        
        <div class="suggestions" id="suggestions">
            <!-- Dynamic suggestions based on mode -->
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        
        const chatMessages = document.getElementById('chatMessages');
        const chatInput = document.getElementById('chatInput');
        const sendButton = document.getElementById('sendButton');
        const typingIndicator = document.getElementById('typingIndicator');
        const suggestionsContainer = document.getElementById('suggestions');
        
        let messageCount = 0;
        let currentMode = 'ask'; // 'ask' or 'agent'
        let currentModel = 'claude-sonnet-4';
        
        // Mode switching
        document.querySelectorAll('.mode-button').forEach(button => {
            button.addEventListener('click', function() {
                // Remove active from all buttons
                document.querySelectorAll('.mode-button').forEach(btn => btn.classList.remove('active'));
                
                // Add active to clicked button
                this.classList.add('active');
                
                // Update current mode
                currentMode = this.getAttribute('data-mode');
                
                // Update UI based on mode
                updateUIForMode(currentMode);
            });
        });
        
        function updateUIForMode(mode) {
            const placeholder = chatInput.getAttribute('placeholder');
            
            if (mode === 'ask') {
                chatInput.placeholder = 'Ask AIDA to help with code, review files, or answer questions...';
                updateSuggestions([
                    { command: '@review-file', icon: '📁', text: 'Review current file' },
                    { command: '@review-changes', icon: '🔍', text: 'Review my changes' },
                    { command: '@review-pr', icon: '🔄', text: 'Review PR' },
                    { command: '@sync-review-templates', icon: '⚙️', text: 'Sync templates' }
                ]);
            } else if (mode === 'agent') {
                chatInput.placeholder = 'Describe what you want to build, and Agent will automatically create it...';
                updateSuggestions([
                    { command: '@create-component', icon: '🧩', text: 'Create component' },
                    { command: '@refactor-code', icon: '🔧', text: 'Refactor code' },
                    { command: '@fix-errors', icon: '🐛', text: 'Fix errors' },
                    { command: '@generate-tests', icon: '🧪', text: 'Generate tests' }
                ]);
            }
        }
        
        function updateSuggestions(suggestions) {
            suggestionsContainer.innerHTML = '';
            suggestions.forEach(suggestion => {
                const chip = document.createElement('div');
                chip.className = 'suggestion-chip';
                chip.setAttribute('data-command', suggestion.command);
                chip.innerHTML = suggestion.icon + ' ' + suggestion.text;
                chip.addEventListener('click', function() {
                    const command = this.getAttribute('data-command');
                    chatInput.value = command + ' ';
                    chatInput.focus();
                    sendMessage();
                });
                suggestionsContainer.appendChild(chip);
            });
        }
        
        function openModelConfig() {
            vscode.postMessage({
                type: 'openModelConfig'
            });
        }
        
        // Auto-resize textarea
        chatInput.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 120) + 'px';
        });
        
        // Send message on Enter
        chatInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
        
        // Send button click
        sendButton.addEventListener('click', sendMessage);
        
        // Initialize suggestions for default mode
        updateUIForMode(currentMode);
        
        function sendMessage() {
            const message = chatInput.value.trim();
            if (!message) return;
            
            // Remove empty state
            const emptyState = chatMessages.querySelector('.empty-state');
            if (emptyState) {
                emptyState.remove();
            }
            
            // Add user message
            addMessage(message, 'user');
            
            // Clear input
            chatInput.value = '';
            chatInput.style.height = 'auto';
            
            // Show typing
            showTypingIndicator();
            
            // Disable input
            chatInput.disabled = true;
            sendButton.disabled = true;
            
            // Send to extension
            vscode.postMessage({
                type: 'sendMessage',
                message: message,
                mode: currentMode,
                model: currentModel
            });
        }
        
        function addMessage(content, role) {
            messageCount++;
            
            const messageDiv = document.createElement('div');
            messageDiv.className = \`message \${role}\`;
            
            const timestamp = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            const displayName = role === 'user' ? 'You' : 'AIDA';
            const avatar = role === 'user' ? '👤' : '🤖';
            
            messageDiv.innerHTML = \`
                <div class="message-header">
                    <div class="message-avatar">\${avatar}</div>
                    <span>\${displayName}</span>
                    <span>\${timestamp}</span>
                </div>
                <div class="message-content">\${parseMarkdown(content)}</div>
            \`;
            
            chatMessages.appendChild(messageDiv);
            scrollToBottom();
        }
        
        function showTypingIndicator() {
            typingIndicator.classList.add('show');
            scrollToBottom();
        }
        
        function hideTypingIndicator() {
            typingIndicator.classList.remove('show');
        }
        
        function scrollToBottom() {
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
        
        function parseMarkdown(text) {
            // Basic markdown parsing
            text = text.replace(/\`\`\`([\\s\\S]*?)\`\`\`/g, '<pre><code>$1</code></pre>');
            text = text.replace(/\`([^\`]+)\`/g, '<code>$1</code>');
            text = text.replace(/\\*\\*([^\\*]+)\\*\\*/g, '<strong>$1</strong>');
            text = text.replace(/\\*([^\\*]+)\\*/g, '<em>$1</em>');
            text = text.replace(/\\n/g, '<br>');
            return text;
        }
        
        function clearChat() {
            vscode.postMessage({
                type: 'clearChat'
            });
            
            chatMessages.innerHTML = \`
                <div class="empty-state">
                    <div class="empty-state-icon">🤖</div>
                    <h2>Hi! I'm AIDA</h2>
                    <p>I can help you review code, analyze changes, check pull requests, and more. What would you like me to help with?</p>
                </div>
            \`;
        }
        
        function toggleSettings() {
            vscode.postMessage({
                type: 'openSettings'
            });
        }
        
        // Listen for messages from extension
        window.addEventListener('message', event => {
            const message = event.data;
            
            switch (message.type) {
                case 'receiveMessage':
                    hideTypingIndicator();
                    addMessage(message.content, 'assistant');
                    
                    // Re-enable input
                    chatInput.disabled = false;
                    sendButton.disabled = false;
                    chatInput.focus();
                    break;
                    
                case 'error':
                    hideTypingIndicator();
                    addMessage(\`❌ \${message.error}\`, 'assistant');
                    
                    // Re-enable input
                    chatInput.disabled = false;
                    sendButton.disabled = false;
                    chatInput.focus();
                    break;
                    
                case 'addMessage':
                    addMessage(message.content, message.role || 'assistant');
                    break;
            }
        });
        
        // Focus input on load
        chatInput.focus();
    </script>
</body>
</html>`;
    }

    /**
     * Handle chat message from webview
     */
    async handleChatMessage(message) {
        try {
            switch (message.type) {
                case 'sendMessage':
                    await this.processChatMessage(message.message, message.mode, message.model);
                    break;
                    
                case 'clearChat':
                    this.chatHistory = [];
                    break;
                    
                case 'openSettings':
                    vscode.commands.executeCommand('workbench.action.openSettings', 'aida');
                    break;
                    
                case 'openModelConfig':
                    this.openModelConfigDialog();
                    break;
            }
        } catch (error) {
            console.error('❌ Error handling chat message:', error);
            this.sendErrorToPanel(error.message);
        }
    }

    /**
     * Process chat message through AIDA participants
     */
    async processChatMessage(userMessage, mode = 'ask', model = 'claude-sonnet-4') {
        try {
            // Add to history
            this.chatHistory.push({
                role: 'user',
                content: userMessage,
                mode: mode,
                model: model,
                timestamp: new Date()
            });

            console.log('💬 Processing message:', userMessage, 'Mode:', mode, 'Model:', model);

            let response;
            
            if (mode === 'agent') {
                // Agent mode - autonomous code generation and task execution
                response = await this.handleAgentMode(userMessage, model);
            } else {
                // Ask mode - traditional Q&A
                const participant = this.determineParticipant(userMessage);
                response = await this.callParticipant(participant, userMessage);
            }

            // Add response to history
            this.chatHistory.push({
                role: 'assistant',
                content: response,
                mode: mode,
                model: model,
                timestamp: new Date()
            });

            // Send response to webview
            this.sendMessageToPanel(response);

        } catch (error) {
            console.error('❌ Error processing message:', error);
            this.sendErrorToPanel(error.message);
        }
    }

    /**
     * Handle Agent mode - autonomous task execution
     */
    async handleAgentMode(userMessage, model) {
        try {
            const lowerMessage = userMessage.toLowerCase();
            
            if (lowerMessage.includes('@create-component') || lowerMessage.includes('create component')) {
                return await this.agentCreateComponent(userMessage);
            }
            
            if (lowerMessage.includes('@refactor-code') || lowerMessage.includes('refactor')) {
                return await this.agentRefactorCode(userMessage);
            }
            
            if (lowerMessage.includes('@fix-errors') || lowerMessage.includes('fix error')) {
                return await this.agentFixErrors(userMessage);
            }
            
            if (lowerMessage.includes('@generate-tests') || lowerMessage.includes('generate test')) {
                return await this.agentGenerateTests(userMessage);
            }
            
            // General agent task
            return await this.agentGeneralTask(userMessage, model);
            
        } catch (error) {
            return '❌ **Agent Error**\n\nAgent encountered an error: ' + error.message;
        }
    }

    /**
     * Agent: Create Component
     */
    async agentCreateComponent(request) {
        return '🤖 **Agent Mode: Create Component**\n\n' +
               '**Request:** ' + request + '\n\n' +
               '**Status:** 🚧 Under Development\n\n' +
               'Agent will automatically:\n' +
               '1. 📝 Analyze component requirements\n' +
               '2. 🏗️ Generate component structure\n' +
               '3. 💾 Create files automatically\n' +
               '4. ✅ Add to module imports\n\n' +
               '*This feature is coming soon!*';
    }

    /**
     * Agent: Refactor Code
     */
    async agentRefactorCode(request) {
        return '🤖 **Agent Mode: Refactor Code**\n\n' +
               '**Request:** ' + request + '\n\n' +
               '**Status:** 🚧 Under Development\n\n' +
               'Agent will automatically:\n' +
               '1. 🔍 Analyze code structure\n' +
               '2. 🔧 Apply best practices\n' +
               '3. 💾 Update files automatically\n' +
               '4. ✅ Verify changes work\n\n' +
               '*This feature is coming soon!*';
    }

    /**
     * Agent: Fix Errors
     */
    async agentFixErrors(request) {
        return '🤖 **Agent Mode: Fix Errors**\n\n' +
               '**Request:** ' + request + '\n\n' +
               '**Status:** 🚧 Under Development\n\n' +
               'Agent will automatically:\n' +
               '1. 🐛 Scan for errors\n' +
               '2. 🔧 Propose fixes\n' +
               '3. 💾 Apply fixes automatically\n' +
               '4. ✅ Verify resolution\n\n' +
               '*This feature is coming soon!*';
    }

    /**
     * Agent: Generate Tests
     */
    async agentGenerateTests(request) {
        return '🤖 **Agent Mode: Generate Tests**\n\n' +
               '**Request:** ' + request + '\n\n' +
               '**Status:** 🚧 Under Development\n\n' +
               'Agent will automatically:\n' +
               '1. 📝 Analyze code to test\n' +
               '2. 🧪 Generate test cases\n' +
               '3. 💾 Create test files\n' +
               '4. ✅ Run tests to verify\n\n' +
               '*This feature is coming soon!*';
    }

    /**
     * Agent: General Task
     */
    async agentGeneralTask(request, model) {
        return '🤖 **Agent Mode: General Task**\n\n' +
               '**Request:** ' + request + '\n' +
               '**Model:** ' + model + '\n\n' +
               '**Status:** 🚧 Under Development\n\n' +
               'Agent capabilities:\n' +
               '- 🏗️ **Autonomous Code Generation**\n' +
               '- 📁 **File Management**\n' +
               '- 🔧 **Auto-refactoring**\n' +
               '- 🐛 **Error Resolution**\n' +
               '- 🧪 **Test Generation**\n\n' +
               'The Agent will analyze your request and automatically execute the required tasks.\n\n' +
               '*Full Agent capabilities coming soon!*';
    }

    /**
     * Open Model Configuration Dialog
     */
    openModelConfigDialog() {
        vscode.window.showQuickPick([
            {
                label: '$(check) Claude Sonnet 4',
                description: 'Currently Active',
                detail: 'Advanced reasoning and code generation'
            },
            {
                label: '$(settings-gear) Configure Models',
                description: 'Add more models',
                detail: 'Set up additional AI models'
            }
        ], {
            placeHolder: 'Select AI Model for AIDA',
            title: 'AIDA Model Configuration'
        }).then(selection => {
            if (selection) {
                if (selection.label.includes('Configure Models')) {
                    vscode.commands.executeCommand('workbench.action.openSettings', 'aida.models');
                } else {
                    // Model selected, could update config here
                    vscode.window.showInformationMessage('Model: ' + selection.label + ' is active');
                }
            }
        });
    }

    /**
     * Determine which participant to use based on message content
     */
    determineParticipant(message) {
        const lowerMessage = message.toLowerCase();
        
        if (lowerMessage.includes('@review-file') || lowerMessage.includes('review file') || lowerMessage.includes('analyze file')) {
            return 'review-file';
        }
        
        if (lowerMessage.includes('@review-changes') || lowerMessage.includes('review changes') || lowerMessage.includes('git diff')) {
            return 'review-changes';
        }
        
        if (lowerMessage.includes('@review-pr') || lowerMessage.includes('review pr') || lowerMessage.includes('pull request')) {
            return 'review-pr';
        }
        
        if (lowerMessage.includes('@sync-review-templates') || lowerMessage.includes('sync templates')) {
            return 'sync-review-templates';
        }
        
        return 'general';
    }

    /**
     * Call specific AIDA participant
     */
    async callParticipant(participant, message) {
        try {
            let result = '';
            
            // Create complete stream object like VS Code ChatResponseStream
            const mockStream = {
                markdown: (text) => {
                    if (text) {
                        result += text;
                    }
                    return mockStream;
                },
                button: (button) => {
                    if (button && button.title) {
                        result += '\n\n**' + button.title + '**\n\n';
                    }
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
                progress: (text) => {
                    if (text) {
                        result += '🔄 ' + text + '\n';
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

            // Remove participant prefix from message
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
                        // Use extension functions for syncing templates
                        mockStream.progress('Syncing AIDA templates...');
                        const extensionModule = require('../extension.js');
                        
                        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
                            await extensionModule.syncNewLanguageTemplates(
                                path.join(this.context.extensionPath, 'AIDA', 'templates'),
                                path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, 'AIDA')
                            );
                            mockStream.markdown('\n✅ **Templates Synced Successfully**\n\nAIDA templates have been updated in your workspace.\n');
                        } else {
                            mockStream.markdown('\n⚠️ **No Workspace Found**\n\nPlease open a workspace folder to sync templates.\n');
                        }
                        
                        return result || '✅ **Templates Synced**\n\nAIDA templates updated successfully.';
                    } catch (error) {
                        mockStream.markdown('\n❌ **Template Sync Error**\n\nFailed to sync templates: ' + error.message + '\n');
                        return '❌ **Template Sync Error**\n\nFailed to sync templates: ' + error.message;
                    }

                default:
                    return this.generateGeneralResponse(message);
            }

        } catch (error) {
            console.error('❌ Error calling ' + participant + ' participant:', error);
            return '❌ **Error**\n\nSorry, I encountered an error while processing your request: ' + error.message;
        }
    }

    /**
     * Generate general AI response
     */
    generateGeneralResponse(message) {
        return '# 🤖 AIDA Assistant Response\n\n' +
               'Thank you for your message: "' + message + '"\n\n' +
               '## Available Commands:\n' +
               '- **`@review-file`** - Analyze and review the current file\n' +
               '- **`@review-changes`** - Review git changes and modifications\n' +
               '- **`@review-pr`** - Review Azure DevOps pull requests\n' +
               '- **`@sync-review-templates`** - Sync and update AIDA templates\n\n' +
               '## How can I help?\n' +
               'I can assist you with code reviews, analyzing changes, managing templates, and more. Try using one of the commands above or ask me specific questions about your code.\n\n' +
               '*Powered by AIDA Extension*';
    }

    /**
     * Send message to panel
     */
    sendMessageToPanel(content) {
        if (this.currentPanel) {
            this.currentPanel.webview.postMessage({
                type: 'receiveMessage',
                content: content
            });
        }
    }

    /**
     * Send error to panel
     */
    sendErrorToPanel(error) {
        if (this.currentPanel) {
            this.currentPanel.webview.postMessage({
                type: 'error',
                error: error
            });
        }
    }
}

/**
 * Initialize Copilot-Style Chat Panel
 */
function initializeCopilotStyleChat(context) {
    try {
        const chatPanel = new CopilotStyleChatPanel(context);
        
        // Register command to open chat (replaces existing command)
        const openChatCommand = vscode.commands.registerCommand('aida.openChat', () => {
            chatPanel.createOrShowChatPanel();
        });

        // Register right-click context menu handler
        const reviewFileFromContext = vscode.commands.registerCommand('aida.reviewFileContext', async (uri) => {
            // Open AIDA chat and auto-trigger review
            chatPanel.createOrShowChatPanel();
            
            // Auto-send review command
            setTimeout(() => {
                if (chatPanel.currentPanel) {
                    const fileName = uri ? uri.fsPath : 'current file';
                    chatPanel.currentPanel.webview.postMessage({
                        type: 'addMessage',
                        content: '@review-file ' + fileName,
                        role: 'user'
                    });
                    
                    // Process the command
                    chatPanel.processChatMessage('@review-file ' + fileName);
                }
            }, 500);
        });

        const reviewChangesFromContext = vscode.commands.registerCommand('aida.reviewChangesContext', async (uri) => {
            chatPanel.createOrShowChatPanel();
            
            setTimeout(() => {
                if (chatPanel.currentPanel) {
                    const fileName = uri ? uri.fsPath : 'current changes';
                    chatPanel.currentPanel.webview.postMessage({
                        type: 'addMessage',
                        content: '@review-changes ' + fileName,
                        role: 'user'
                    });
                    
                    chatPanel.processChatMessage('@review-changes ' + fileName);
                }
            }, 500);
        });

        // Add to subscriptions
        context.subscriptions.push(
            openChatCommand,
            reviewFileFromContext,
            reviewChangesFromContext
        );

        console.log('✅ Copilot-Style Chat Panel initialized');
        return chatPanel;

    } catch (error) {
        console.error('❌ Error initializing Copilot-style chat:', error);
        throw error;
    }
}

module.exports = {
    CopilotStyleChatPanel,
    initializeCopilotStyleChat
};