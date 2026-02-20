/**
 * @module chatbot-view-provider
 * @description WebView Provider for AIDA Chat Sidebar
 * Extracted from chatbot-sidebar.js during Phase 3 refactoring
 * 
 * Handles: webview resolution, model selection/display, message routing,
 * history navigation, streaming cancellation, and frontend communication.
 */

const vscode = require('vscode');
const { aidaLogging } = require('../core/settings');
const { setGlobalAbortSignal } = require('../core/abort-signal');
const { DEFAULTS } = require('../core/aida-config');

/**
 * WebView Provider for Sidebar (like GitHub Copilot)
 */
class AidaChatViewProvider {
    // Default model priority: Opus > Sonnet > Gemini
    // Higher number = higher priority
    static MODEL_PRIORITY_KEYWORDS = [
        { keyword: 'opus', priority: 100 },
        { keyword: 'sonnet', priority: 90 },
        { keyword: 'gemini', priority: 80 },
        { keyword: 'gpt-5', priority: 75 },
        { keyword: 'gpt5', priority: 75 },
        { keyword: 'gpt-4', priority: 70 },
        { keyword: 'gpt4', priority: 70 },
        { keyword: 'claude', priority: 85 },
        { keyword: 'o4', priority: 72 },
        { keyword: 'o3', priority: 68 },
    ];

    constructor(context, chatInstance) {
        this.context = context;
        this.chatInstance = chatInstance;

        // Listen for configuration changes to update model name
        this.setupConfigurationListener();
    }

    /**
     * Get model priority score (higher = better)
     * Priority: Opus > Sonnet > Gemini
     */
    getModelPriority(modelFamily) {
        if (!modelFamily) return 0;
        const key = modelFamily.toLowerCase().trim();

        // Check keywords in order
        for (const { keyword, priority } of AidaChatViewProvider.MODEL_PRIORITY_KEYWORDS) {
            if (key.includes(keyword)) {
                return priority;
            }
        }

        return 50; // Default priority for unknown models
    }

    /**
     * Get available models list
     * If External API mode: returns single model from settings
     * If Copilot mode: returns all available models sorted by priority
     */
    async getAvailableModels() {
        const config = vscode.workspace.getConfiguration('aida');
        const useExternalAI = config.get('useExternalAI', false);

        if (useExternalAI) {
            // External API mode - single model from settings
            const modelName = config.get('ai.model', 'GPT-4');
            return [{
                id: 'external-api',
                family: modelName,
                name: modelName,
                isExternal: true
            }];
        }

        // Copilot mode - get all available models
        try {
            const models = await vscode.lm.selectChatModels();
            if (!models || models.length === 0) {
                aidaLogging('⚠️ No Copilot models available');
                return [];
            }

            // Sort by priority (highest first)
            const sortedModels = models.sort((a, b) => {
                const priorityA = this.getModelPriority(a.family);
                const priorityB = this.getModelPriority(b.family);
                return priorityB - priorityA;
            });

            aidaLogging('🤖 Available models (sorted by priority):',
                sortedModels.map(m => `${m.family} (${this.getModelPriority(m.family)})`).join(', '));

            return sortedModels;
        } catch (error) {
            aidaLogging('Failed to get Copilot models:', error);
            return [];
        }
    }

    /**
     * Get selected model from workspaceState, or default to highest priority
     */
    async getSelectedModel() {
        const models = await this.getAvailableModels();
        if (models.length === 0) return null;

        // External API mode - always use the single model
        if (models[0].isExternal) {
            return models[0];
        }

        // Check workspaceState for saved selection
        const savedModelId = this.context.workspaceState.get('aida.selectedModelId');
        if (savedModelId) {
            const savedModel = models.find(m => m.id === savedModelId);
            if (savedModel) {
                aidaLogging('🤖 Using saved model from workspaceState:', savedModel.family);
                return savedModel;
            }
        }

        // Default to highest priority model (first in sorted list)
        aidaLogging('🤖 Using default highest priority model:', models[0].family);
        return models[0];
    }

    /**
     * Save selected model to workspaceState
     */
    async saveSelectedModel(model) {
        await this.context.workspaceState.update('aida.selectedModelId', model.id);
        aidaLogging('💾 Saved selected model to workspaceState:', model.family);
    }

    /**
     * Show model picker (QuickPick like GitHub Copilot)
     */
    async showModelPicker() {
        const models = await this.getAvailableModels();

        if (models.length === 0) {
            vscode.window.showWarningMessage('No AI models available. Please check your Copilot license or enable External API mode.');
            return;
        }

        // External API mode - show info, can't change
        if (models[0].isExternal) {
            vscode.window.showInformationMessage(
                `External API mode is enabled. Using model: ${models[0].family}. ` +
                `Change in Settings → AIDA → AI Model.`
            );
            return;
        }

        const currentModel = await this.getSelectedModel();

        // Create QuickPick items
        const items = models.map(model => {
            const priority = this.getModelPriority(model.family);
            const isSelected = currentModel && model.id === currentModel.id;

            // Add tier indicator based on priority
            let tier = '';
            if (priority >= 95) tier = '⭐⭐⭐ Premium';
            else if (priority >= 85) tier = '⭐⭐ Pro';
            else if (priority >= 75) tier = '⭐ Standard';
            else tier = '○ Basic';

            return {
                label: `${isSelected ? '$(check) ' : ''}${model.family}`,
                description: tier,
                detail: `Model ID: ${model.id}`,
                model: model
            };
        });

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select AI Model for AIDA',
            title: 'AIDA - Choose AI Model',
            matchOnDescription: true,
            matchOnDetail: true
        });

        if (selected) {
            await this.saveSelectedModel(selected.model);
            // Update UI
            if (this.chatInstance.webviewView) {
                this.sendCurrentModelName(this.chatInstance.webviewView);
            }
            vscode.window.showInformationMessage(`AIDA now using: ${selected.model.family}`);
        }
    }

    /**
     * Setup listener for configuration changes
     */
    setupConfigurationListener() {
        vscode.workspace.onDidChangeConfiguration(async (event) => {
            if (event.affectsConfiguration('aida.ai.model') || event.affectsConfiguration('aida.useExternalAI')) {
                aidaLogging('🤖 Model configuration changed, reloading model list...');
                if (this.chatInstance.webviewView) {
                    // Reload entire model list when External AI toggle changes
                    await this.sendModelListToFrontend(this.chatInstance.webviewView);
                }
            }
        });
    }

    resolveWebviewView(webviewView, context, token) {
        this.chatInstance.webviewView = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.file(this.context.extensionPath)
            ]
        };

        // Load HTML content asynchronously and then initialize
        this.loadWebviewContent(webviewView).then(() => {
            // Initialize webview with current state after HTML is loaded
            setTimeout(() => {
                this.initializeWebviewState(webviewView);
            }, 100);
        }).catch(error => {
            aidaLogging('Failed to load webview content, initializing anyway:', error);
            setTimeout(() => {
                this.initializeWebviewState(webviewView);
            }, 200);
        });

        // Handle messages from webview
        webviewView.webview.onDidReceiveMessage(async (message) => {
            switch (message.type) {
                case 'sendMessage':
                    // Handle both text and image messages with mode and model
                    await this.chatInstance.processChatMessage(
                        message.message,
                        message.images,
                        message.mode || 'ask',
                        message.model || 'claude-sonnet-4.5'
                    );
                    break;

                case 'clearChat':
                    this.chatInstance.clearChatHistory(); // Use our new method
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

                case 'cancelStreaming':
                    // Cancel ongoing streaming operation
                    aidaLogging('🛑 Cancel streaming requested from frontend');
                    this.cancelStreaming();
                    break;

                case 'runDiffCommand':
                    // Simply execute the command - it already works!
                    if (message.command && Array.isArray(message.arguments)) {
                        await vscode.commands.executeCommand(message.command, ...message.arguments);
                    }
                    break;

                case 'updateTypingMessage':
                    // Agent progress updates - just pass through to webview
                    webviewView.webview.postMessage({
                        type: 'showTypingWithMessage',
                        message: message.message
                    });
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

                                    // Categorize languages based on actual available languages
                                    const webFrontend = ['angular', 'javascript', 'react', 'typescript', 'vue'];
                                    const backend = ['csharp', 'go', 'nodejs', 'python'];
                                    const other = []; // No other languages currently

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
                                    syncResult += '---\n\n💡 **Tip:** Use `@review-file`, `@review-changes`, or `@review-all-changes` to start reviewing with templates\n';
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
                    aidaLogging('🔍 Received runDiffCommand:', message);
                    if (message.command && Array.isArray(message.arguments)) {
                        aidaLogging('🚀 Executing command:', message.command, 'with args:', message.arguments);
                        try {
                            if (message.command === 'aida.viewPrDiff') {
                                const diffId = message.arguments[0];
                                aidaLogging('📄 Opening Monaco diff for diffId:', diffId);

                                // Extract file path from diffId (format: github_id_filepath)
                                const pathPart = diffId.split('_').slice(2).join('_').replace(/_/g, '/');
                                aidaLogging('📍 Extracted path:', pathPart);

                                // Try to find the file in workspace
                                const workspaceFolders = vscode.workspace.workspaceFolders;
                                if (workspaceFolders && workspaceFolders.length > 0) {
                                    const filePath = vscode.Uri.joinPath(workspaceFolders[0].uri, pathPart);
                                    aidaLogging('🔍 Opening file:', filePath.toString());

                                    // Open the file
                                    await vscode.commands.executeCommand('vscode.open', filePath);
                                    vscode.window.showInformationMessage(`Opened file: ${pathPart}`);
                                } else {
                                    vscode.window.showErrorMessage('No workspace folder found');
                                }
                            } else {
                                await vscode.commands.executeCommand(message.command, ...message.arguments);
                            }
                            aidaLogging('✅ Command executed successfully');
                        } catch (error) {
                            aidaLogging('❌ Command execution failed:', error);
                            vscode.window.showErrorMessage(`Failed to open file: ${error.message}`);
                        }
                    } else {
                        aidaLogging('❌ Invalid command or arguments:', message);
                    }
                    break;

                case 'savePartialContent':
                    // Save partial streaming content when user cancels
                    if (message.content && message.content.trim()) {
                        this.chatInstance.chatHistory.push({
                            role: 'assistant',
                            content: message.content,
                            timestamp: new Date(message.timestamp),
                            partial: true // Mark as partial response
                        });

                        // Save to persistent storage
                        this.chatInstance.saveChatHistory();
                        aidaLogging('💾 Saved partial content to chat history');
                    }
                    break;

                case 'frontendReady':
                    // Frontend is ready, send current file info and model list
                    aidaLogging('📁 Frontend ready, updating current file and model...');
                    if (this.chatInstance && typeof this.chatInstance.updateCurrentFile === 'function') {
                        const currentEditor = vscode.window.activeTextEditor;
                        if (currentEditor) {
                            this.chatInstance.updateCurrentFile(currentEditor, true);
                            aidaLogging('📁 Sent current file to ready frontend:', currentEditor.document.fileName);
                        } else {
                            this.chatInstance.updateCurrentFile(null, true);
                            aidaLogging('📁 No active editor, sent null to frontend');
                        }
                    }
                    // Send model list instead of just model name (includes selected model)
                    await this.sendModelListToFrontend(webviewView);
                    break;

                case 'openModelConfig':
                    // Show model picker (QuickPick like GitHub Copilot)
                    aidaLogging('🤖 Opening model picker...');
                    this.showModelPicker();
                    break;

                case 'getModelList':
                    // Send available models to frontend dropdown
                    aidaLogging('🤖 Frontend requested model list');
                    await this.sendModelListToFrontend(webviewView);
                    break;

                case 'selectModel':
                    // Handle model selection from frontend dropdown
                    aidaLogging('🤖 Model selected from dropdown:', message.modelFamily);
                    const models = await this.getAvailableModels();
                    const selectedModel = models.find(m => m.id === message.modelId);
                    if (selectedModel) {
                        await this.saveSelectedModel(selectedModel);
                        this.sendCurrentModelName(webviewView);
                    }
                    break;
            }
        });

        aidaLogging('✅ AIDA Chat Sidebar WebView resolved');
    }

    /**
     * Initialize webview with current state (chat history, current file)
     */
    initializeWebviewState(webviewView) {
        try {
            aidaLogging('🔄 Initializing webview state...');

            // Send current model name to frontend
            this.sendCurrentModelName(webviewView);

            // Restore chat history
            this.restoreChatHistory(webviewView);

            // Show current active file - Force update to ensure it's displayed
            if (this.chatInstance && typeof this.chatInstance.updateCurrentFile === 'function') {
                // Force current file update by passing current active editor
                const currentEditor = vscode.window.activeTextEditor;
                aidaLogging('📁 Active editor during init:', currentEditor ? currentEditor.document.fileName : 'None');

                if (currentEditor) {
                    // Force update even if filename is same
                    this.chatInstance.updateCurrentFile(currentEditor, true);
                    aidaLogging('📁 Forced current file update on webview init');
                } else {
                    // Still force update to clear any previous state
                    this.chatInstance.updateCurrentFile(null, true);
                    aidaLogging('📁 No active editor found during webview init');
                }
            } else {
                aidaLogging('updateCurrentFile not available on chatInstance');
            }

            aidaLogging('🔄 Webview state initialized');
        } catch (error) {
            aidaLogging('Failed to initialize webview state:', error);
        }
    }

    /**
     * Send model list to frontend for dropdown
     */
    async sendModelListToFrontend(webviewView) {
        try {
            const models = await this.getAvailableModels();
            const selectedModel = await this.getSelectedModel();

            // Format models for frontend
            const formattedModels = models.map(m => ({
                id: m.id,
                family: m.family,
                displayName: this.formatModelName(m.family),
                isExternal: m.isExternal || false
            }));

            aidaLogging('🤖 Sending model list to frontend:', formattedModels.map(m => m.displayName).join(', '));

            webviewView.webview.postMessage({
                type: 'updateModelList',
                models: formattedModels,
                selectedModelId: selectedModel ? selectedModel.id : null,
                selectedModelName: selectedModel ? this.formatModelName(selectedModel.family) : 'AIDA'
            });
        } catch (error) {
            aidaLogging('Failed to send model list:', error);
        }
    }

    /**
     * Send current model name to webview (uses workspaceState selection)
     */
    async sendCurrentModelName(webviewView) {
        try {
            const selectedModel = await this.getSelectedModel();
            let modelName = 'AIDA';

            if (selectedModel) {
                modelName = this.formatModelName(selectedModel.family);
            }

            aidaLogging('🤖 Sending model name to frontend:', modelName);

            webviewView.webview.postMessage({
                type: 'updateModelName',
                modelName: modelName
            });
        } catch (error) {
            aidaLogging('Failed to send model name:', error);
            webviewView.webview.postMessage({
                type: 'updateModelName',
                modelName: 'AIDA'
            });
        }
    }

    /**
     * Format model name for display
     */
    formatModelName(rawName) {
        if (!rawName) return 'Unknown';

        let name = rawName.toString();

        // Handle common patterns
        const patterns = [
            { match: /claude.*opus.*4\.?5/i, replace: 'Claude Opus 4.5' },
            { match: /claude.*opus.*4(?!\.)/i, replace: 'Claude Opus 4' },
            { match: /claude.*sonnet.*4\.?5/i, replace: 'Claude Sonnet 4.5' },
            { match: /claude.*sonnet.*4(?!\.)/i, replace: 'Claude Sonnet 4' },
            { match: /claude.*sonnet.*3\.?7/i, replace: 'Claude Sonnet 3.7' },
            { match: /claude.*sonnet.*3\.?5/i, replace: 'Claude Sonnet 3.5' },
            { match: /gpt.*4\.?1/i, replace: 'GPT-4.1' },
            { match: /gpt.*4o.*mini/i, replace: 'GPT-4o Mini' },
            { match: /gpt.*4o/i, replace: 'GPT-4o' },
            { match: /gpt.*5.*mini/i, replace: 'GPT-5 Mini' },
            { match: /gpt.*5/i, replace: 'GPT-5' },
            { match: /gemini.*2\.?5.*pro/i, replace: 'Gemini 2.5 Pro' },
            { match: /gemini.*2\.?0.*flash/i, replace: 'Gemini 2.0 Flash' },
            { match: /o4.*mini/i, replace: 'o4-mini' },
            { match: /o3.*mini/i, replace: 'o3-mini' },
        ];

        for (const pattern of patterns) {
            if (pattern.match.test(name)) {
                return pattern.replace;
            }
        }

        // If no pattern matches, capitalize words
        return name.split(/[-_]/).map(word =>
            word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        ).join(' ');
    }

    /**
     * Restore chat history to webview
     */
    restoreChatHistory(webviewView) {
        if (!this.chatInstance.chatHistory || this.chatInstance.chatHistory.length === 0) {
            return;
        }

        aidaLogging(`📚 Restoring ${this.chatInstance.chatHistory.length} chat messages`);

        for (const message of this.chatInstance.chatHistory) {
            if (message.role === 'user') {
                webviewView.webview.postMessage({
                    type: 'addUserMessage',
                    message: message.content,
                    images: message.images || []
                });
            } else if (message.role === 'assistant') {
                webviewView.webview.postMessage({
                    type: 'addAssistantMessage',
                    message: message.content
                });
            }
        }
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
     * Cancel ongoing streaming operation
     */
    cancelStreaming() {
        aidaLogging('🛑 Canceling streaming operation...');

        // Abort the actual AI HTTP request
        if (this.currentAbortController) {
            this.currentAbortController.abort();
            aidaLogging('🛑 HTTP request aborted');
        }

        // Set a flag to indicate cancellation
        if (this.chatInstance) {
            this.chatInstance.isCanceled = true;
        }

        // Send cancellation notification to webview
        if (this.webviewView) {
            this.webviewView.webview.postMessage({
                type: 'endStreamingMessage'
            });
        }

        // Clean up
        this.currentAbortController = null;
        setGlobalAbortSignal(null); // Clear global signal
    }

    /**
     * Load webview content asynchronously
     */
    async loadWebviewContent(webviewView) {
        try {
            const htmlContent = await this.chatInstance.getCopilotSidebarHTML();
            webviewView.webview.html = htmlContent;
        } catch (error) {
            aidaLogging('Failed to load webview content:', error);
            webviewView.webview.html = '<h1>Error loading AIDA Chat</h1>';
        }
    }
}

module.exports = { AidaChatViewProvider };
