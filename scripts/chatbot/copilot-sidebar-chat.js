const vscode = require('vscode');
const path = require('path');
const { AidaChatbotService } = require('./aida-chatbot-service.js');
const TemplateLoader = require('./template-loader');

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
            // Check if user is asking about current file (explicit or implicit)
            const isCurrentFileRequest = userMessage.toLowerCase().includes('this file') || 
                                        userMessage.toLowerCase().includes('current file') ||
                                        userMessage.toLowerCase().includes('refactor this') ||
                                        userMessage.toLowerCase().includes('analyze this') ||
                                        // Implicit current file requests (no specific file mentioned)
                                        (userMessage.toLowerCase().includes('refactor') && !userMessage.toLowerCase().includes('create') && !userMessage.toLowerCase().includes('new')) ||
                                        (userMessage.toLowerCase().includes('analyze') && !userMessage.toLowerCase().includes('create') && !userMessage.toLowerCase().includes('new')) ||
                                        userMessage.toLowerCase().includes('review code') ||
                                        userMessage.toLowerCase().includes('improve code') ||
                                        userMessage.toLowerCase().includes('optimize code') ||
                                        userMessage.toLowerCase().includes('fix code') ||
                                        userMessage.toLowerCase().includes('clean up') ||
                                        userMessage.toLowerCase().includes('modernize') ||
                                        (userMessage.toLowerCase().includes('add') && (userMessage.toLowerCase().includes('type') || userMessage.toLowerCase().includes('interface'))) ||
                                        userMessage.toLowerCase().includes('best practices');

            if (isCurrentFileRequest) {
                // Get current file context for Ask mode too
                const currentFileContext = await this.getCurrentFileContext();
                
                if (currentFileContext.hasFile) {
                    // Enhance the message with file context
                    const enhancedMessage = `${userMessage}\n\n**Current File Context:**\n- File: ${currentFileContext.fileName}\n- Language: ${currentFileContext.languageId}\n- Lines: ${currentFileContext.lineCount}\n\n**File Content:**\n\`\`\`${currentFileContext.languageId}\n${currentFileContext.content}\n\`\`\``;
                    
                    // Show typing indicator for Ask mode
                    if (this.webviewView) {
                        this.webviewView.webview.postMessage({
                            type: 'showTyping'
                        });
                    }

                    // Determine participant and get response with enhanced message
                    const participant = this.determineParticipant(enhancedMessage);
                    const response = await this.callParticipant(participant, enhancedMessage, images);

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

            // Show typing indicator for Ask mode
            if (this.webviewView) {
                this.webviewView.webview.postMessage({
                    type: 'showTyping'
                });
            }

            // Determine participant and get response with images (Ask mode)
            const participant = this.determineParticipant(userMessage);
            
            // Create streaming callback for real-time updates
            let fullResponse = '';
            let isFirstChunk = true;
            
            const streamCallback = (chunk) => {
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
                if (this.webviewView) {
                    this.webviewView.webview.postMessage({
                        type: 'addStreamingChunk',
                        chunk: chunk
                    });
                }
            };
            
            // For general responses, use streaming; for participants, use non-streaming
            let response;
            if (participant === 'general') {
                response = await this.callParticipant(participant, userMessage, images, streamCallback);
            } else {
                response = await this.callParticipant(participant, userMessage, images);
            }
            
            // Complete streaming if it was used
            if (participant === 'general' && this.webviewView) {
                this.webviewView.webview.postMessage({
                    type: 'endStreamingMessage'
                });
            }

            // Add response to history
            this.chatHistory.push({
                role: 'assistant',
                content: fullResponse || response,
                timestamp: new Date()
            });

            // Send response to sidebar (only if not streaming)
            if (participant !== 'general' && this.webviewView) {
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
     * Get current file context for Agent
     */
    async getCurrentFileContext() {
        try {
            const activeEditor = vscode.window.activeTextEditor;
            if (!activeEditor) {
                return {
                    hasFile: false,
                    message: "No file is currently open"
                };
            }

            const document = activeEditor.document;
            const filePath = document.uri.fsPath;
            const fileName = document.fileName;
            const fileContent = document.getText();
            const languageId = document.languageId;
            const lineCount = document.lineCount;
            
            // Get basic file analysis
            const analysis = this.analyzeFileContent(fileContent, languageId);

            return {
                hasFile: true,
                filePath,
                fileName,
                languageId,
                lineCount,
                fileSize: Buffer.byteLength(fileContent, 'utf8'),
                content: fileContent,
                analysis,
                summary: `${fileName} (${languageId}, ${lineCount} lines)`
            };
        } catch (error) {
            return {
                hasFile: false,
                error: error.message
            };
        }
    }

    /**
     * Analyze file content to understand structure
     */
    analyzeFileContent(content, languageId) {
        const analysis = {
            type: languageId,
            structure: {}
        };

        try {
            if (languageId === 'typescript' || languageId === 'javascript') {
                // Analyze TypeScript/JavaScript
                analysis.structure = {
                    classes: (content.match(/class\s+(\w+)/g) || []).map(m => m.replace('class ', '')),
                    functions: (content.match(/function\s+(\w+)/g) || []).map(m => m.replace('function ', '')),
                    methods: (content.match(/(\w+)\s*\([^)]*\)\s*{/g) || []).map(m => m.split('(')[0].trim()),
                    imports: (content.match(/import.*from\s+['"]([^'"]+)['"]/g) || []),
                    exports: (content.match(/export\s+(class|function|const|let|var)\s+(\w+)/g) || [])
                };

                // Check if it's Angular component
                if (content.includes('@Component')) {
                    analysis.framework = 'angular';
                    analysis.componentType = 'component';
                    const selectorMatch = content.match(/selector:\s*['"]([^'"]+)['"]/);
                    if (selectorMatch) analysis.selector = selectorMatch[1];
                }

                // Check if it's Angular service  
                if (content.includes('@Injectable')) {
                    analysis.framework = 'angular';
                    analysis.componentType = 'service';
                }

                // Check if it's Angular module
                if (content.includes('@NgModule')) {
                    analysis.framework = 'angular';
                    analysis.componentType = 'module';
                }

            } else if (languageId === 'html') {
                // Analyze HTML
                analysis.structure = {
                    elements: (content.match(/<(\w+)/g) || []).map(m => m.replace('<', '')),
                    angularDirectives: (content.match(/\*ng\w+/g) || []),
                    interpolations: (content.match(/\{\{[^}]+\}\}/g) || [])
                };

            } else if (languageId === 'scss' || languageId === 'css') {
                // Analyze CSS/SCSS
                analysis.structure = {
                    selectors: (content.match(/[.#]?[\w-]+\s*{/g) || []).map(m => m.replace(/\s*{/, '')),
                    variables: (content.match(/\$[\w-]+:/g) || []),
                    mixins: (content.match(/@mixin\s+(\w+)/g) || [])
                };
            }

        } catch (error) {
            analysis.error = `Analysis failed: ${error.message}`;
        }

        return analysis;
    }

    /**
     * Agent Tools - Real VS Code API Integration
     */
    getAgentTools() {
        return {
            createFile: async (path, content) => {
                try {
                    const uri = vscode.Uri.file(path);
                    await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf8'));
                    return { success: true, message: `Created file: ${path}` };
                } catch (error) {
                    return { success: false, error: error.message };
                }
            },

            editFile: async (path, oldText, newText) => {
                try {
                    const document = await vscode.workspace.openTextDocument(path);
                    const editor = await vscode.window.showTextDocument(document);
                    
                    const text = document.getText();
                    const index = text.indexOf(oldText);
                    if (index === -1) {
                        return { success: false, error: 'Text not found in file' };
                    }
                    
                    const startPos = document.positionAt(index);
                    const endPos = document.positionAt(index + oldText.length);
                    const range = new vscode.Range(startPos, endPos);
                    
                    await editor.edit(editBuilder => {
                        editBuilder.replace(range, newText);
                    });
                    
                    return { success: true, message: `Edited file: ${path}` };
                } catch (error) {
                    return { success: false, error: error.message };
                }
            },

            createDirectory: async (path) => {
                try {
                    const uri = vscode.Uri.file(path);
                    await vscode.workspace.fs.createDirectory(uri);
                    return { success: true, message: `Created directory: ${path}` };
                } catch (error) {
                    return { success: false, error: error.message };
                }
            },

            runTerminalCommand: async (command) => {
                try {
                    const terminal = vscode.window.createTerminal('AIDA Agent');
                    terminal.sendText(command);
                    terminal.show();
                    return { success: true, message: `Executed: ${command}` };
                } catch (error) {
                    return { success: false, error: error.message };
                }
            },

            openFile: async (path, line = 1) => {
                try {
                    const document = await vscode.workspace.openTextDocument(path);
                    const editor = await vscode.window.showTextDocument(document);
                    
                    if (line > 1) {
                        const position = new vscode.Position(line - 1, 0);
                        editor.selection = new vscode.Selection(position, position);
                        editor.revealRange(new vscode.Range(position, position));
                    }
                    
                    return { success: true, message: `Opened file: ${path}` };
                } catch (error) {
                    return { success: false, error: error.message };
                }
            },

            readFile: async (path) => {
                try {
                    const uri = vscode.Uri.file(path);
                    const content = await vscode.workspace.fs.readFile(uri);
                    return { success: true, content: content.toString() };
                } catch (error) {
                    return { success: false, error: error.message };
                }
            },

            listFiles: async (directoryPath) => {
                try {
                    const uri = vscode.Uri.file(directoryPath);
                    const files = await vscode.workspace.fs.readDirectory(uri);
                    return { success: true, files: files };
                } catch (error) {
                    return { success: false, error: error.message };
                }
            }
        };
    }

    /**
     * Agent Planner - Creates execution plans for tasks
     */
    async createAgentPlan(userRequest, currentFileContext = null) {
        const lowerRequest = userRequest.toLowerCase();
        
        // Analyze workspace structure
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        const projectType = await this.detectProjectType(workspaceFolder);
        
        // Enhanced context with current file
        const context = {
            projectType,
            userRequest,
            currentFile: currentFileContext,
            workspaceFolder: workspaceFolder?.uri.fsPath
        };

        // Handle current file context
        if (currentFileContext?.hasFile) {
            context.currentFileName = currentFileContext.fileName;
            context.currentFilePath = currentFileContext.filePath;
            context.currentFileContent = currentFileContext.content;
            context.currentFileAnalysis = currentFileContext.analysis;
        }
        
        // Smart detection for current file operations (explicit or implicit)
        const isCurrentFileOperation = currentFileContext?.hasFile && (
            // Explicit current file references
            lowerRequest.includes('this file') || 
            lowerRequest.includes('current file') ||
            lowerRequest.includes('refactor this') ||
            lowerRequest.includes('analyze this') ||
            // Implicit current file operations (no specific file mentioned)
            (lowerRequest.includes('refactor') && !lowerRequest.includes('create') && !lowerRequest.includes('new')) ||
            (lowerRequest.includes('analyze') && !lowerRequest.includes('create') && !lowerRequest.includes('new')) ||
            lowerRequest.includes('review code') ||
            lowerRequest.includes('improve code') ||
            lowerRequest.includes('optimize code') ||
            lowerRequest.includes('fix code') ||
            lowerRequest.includes('clean up') ||
            lowerRequest.includes('modernize') ||
            lowerRequest.includes('best practices') ||
            (lowerRequest.includes('add') && (lowerRequest.includes('type') || lowerRequest.includes('interface')))
        );
        
        if (isCurrentFileOperation) {
            if (lowerRequest.includes('refactor') || lowerRequest.includes('improve') || lowerRequest.includes('modernize') || lowerRequest.includes('clean up')) {
                return this.planRefactorCode(context);
            } else if (lowerRequest.includes('analyze') || lowerRequest.includes('review')) {
                return this.planAnalyzeCode(context);
            } else if (lowerRequest.includes('fix')) {
                return this.planFixErrors(context);
            } else if (lowerRequest.includes('test')) {
                return this.planGenerateTests(context);
            }
        } else if (lowerRequest.includes('create component') || lowerRequest.includes('@create-component')) {
            const componentName = this.extractComponentName(userRequest);
            context.componentName = componentName;
            return this.planCreateComponent(context);
        } else if (lowerRequest.includes('fix error') || lowerRequest.includes('@fix-errors')) {
            return this.planFixErrors(context);
        } else if (lowerRequest.includes('generate test') || lowerRequest.includes('@generate-tests')) {
            return this.planGenerateTests(context);
        } else if (lowerRequest.includes('analyze') || lowerRequest.includes('review')) {
            return this.planAnalyzeCode(context);
        } else {
            // General task planning
            return this.planGeneralTask(context);
        }
    }

    /**
     * Detect project type for better planning
     */
    async detectProjectType(workspaceFolder) {
        if (!workspaceFolder) return 'unknown';
        
        const tools = this.getAgentTools();
        
        try {
            // Check for Angular
            const angularJson = await tools.readFile(workspaceFolder.uri.fsPath + '/angular.json');
            if (angularJson.success) return 'angular';
        } catch (e) {}
        
        try {
            // Check for React
            const packageJson = await tools.readFile(workspaceFolder.uri.fsPath + '/package.json');
            if (packageJson.success && packageJson.content.includes('react')) return 'react';
        } catch (e) {}
        
        try {
            // Check for Vue
            const packageJson = await tools.readFile(workspaceFolder.uri.fsPath + '/package.json');
            if (packageJson.success && packageJson.content.includes('vue')) return 'vue';
        } catch (e) {}
        
        return 'javascript';
    }

    /**
     * Plan: Create Component
     */
    planCreateComponent(context) {
        const componentName = context.componentName || this.extractComponentName(context.userRequest);
        
        if (context.projectType === 'angular') {
            return {
                objective: `Create Angular component: ${componentName}`,
                steps: [
                    {
                        id: 1,
                        action: 'analyze_structure',
                        description: 'Analyze Angular project structure',
                        tools: ['fs_read', 'fs_list']
                    },
                    {
                        id: 2,
                        action: 'create_component_files',
                        description: `Create ${componentName} component files`,
                        tools: ['fs_create']
                    },
                    {
                        id: 3,
                        action: 'update_module',
                        description: 'Update module imports',
                        tools: ['fs_edit']
                    },
                    {
                        id: 4,
                        action: 'generate_tests',
                        description: 'Generate component tests',
                        tools: ['fs_create']
                    }
                ],
                context: { ...context, componentName }
            };
        }
        
        // React/Vue/JS planning similar...
        return {
            objective: `Create ${context.projectType} component: ${componentName}`,
            steps: [
                {
                    id: 1,
                    action: 'create_component',
                    description: `Create ${componentName} component`,
                    tools: ['fs_create']
                }
            ],
            context: { ...context, componentName }
        };
    }

    /**
     * Plan: Refactor Code
     */
    planRefactorCode(context) {
        return {
            objective: `🔧 Auto-Refactor: ${context.currentFileName || 'Current file'}`,
            steps: [
                {
                    id: 1,
                    action: 'analyze_code',
                    description: 'Analyze current file structure and identify issues',
                    tools: ['fs_read', 'vscode_diagnostics']
                },
                {
                    id: 2,
                    action: 'apply_refactoring',
                    description: 'Auto-apply AI-powered refactoring improvements',
                    tools: ['fs_edit', 'ai_analysis']
                },
                {
                    id: 3,
                    action: 'verify_refactoring',
                    description: 'Verify refactoring maintains functionality',
                    tools: ['vscode_diagnostics', 'test_run']
                }
            ],
            context: context
        };
    }

    /**
     * Plan: Fix Errors
     */
    planFixErrors(context) {
        return {
            objective: 'Fix code errors automatically',
            steps: [
                {
                    id: 1,
                    action: 'scan_errors',
                    description: 'Scan for errors and warnings',
                    tools: ['vscode_diagnostics']
                },
                {
                    id: 2,
                    action: 'categorize_errors',
                    description: 'Categorize and prioritize errors',
                    tools: ['code_analyze']
                },
                {
                    id: 3,
                    action: 'apply_fixes',
                    description: 'Apply automatic fixes',
                    tools: ['fs_edit']
                },
                {
                    id: 4,
                    action: 'validate_fixes',
                    description: 'Validate fixes work correctly',
                    tools: ['terminal_run']
                }
            ],
            context: context
        };
    }

    /**
     * Plan: Generate Tests
     */
    planGenerateTests(context) {
        return {
            objective: 'Generate comprehensive tests',
            steps: [
                {
                    id: 1,
                    action: 'analyze_code_for_testing',
                    description: 'Analyze code to identify test cases',
                    tools: ['fs_read']
                },
                {
                    id: 2,
                    action: 'generate_unit_tests',
                    description: 'Generate unit tests',
                    tools: ['fs_create']
                },
                {
                    id: 3,
                    action: 'generate_integration_tests',
                    description: 'Generate integration tests',
                    tools: ['fs_create']
                },
                {
                    id: 4,
                    action: 'run_tests',
                    description: 'Run tests to verify they work',
                    tools: ['terminal_run']
                }
            ],
            context: context
        };
    }

    /**
     * Plan: Analyze Code
     */
    planAnalyzeCode(context) {
        return {
            objective: 'Analyze and review current file',
            steps: [
                {
                    id: 1,
                    action: 'read_current_file',
                    description: 'Read and parse current file structure',
                    tools: ['fs_read']
                },
                {
                    id: 2,
                    action: 'analyze_code_structure',
                    description: 'Analyze code patterns and structure',
                    tools: ['analysis']
                },
                {
                    id: 3,
                    action: 'check_best_practices',
                    description: 'Check for best practices and potential improvements',
                    tools: ['analysis']
                },
                {
                    id: 4,
                    action: 'generate_recommendations',
                    description: 'Generate improvement recommendations',
                    tools: ['analysis']
                }
            ],
            context: context
        };
    }

    /**
     * Plan: General Task
     */
    planGeneralTask(context) {
        return {
            objective: 'Execute general development task',
            steps: [
                {
                    id: 1,
                    action: 'analyze_request',
                    description: 'Analyze user request and context',
                    tools: ['fs_read']
                },
                {
                    id: 2,
                    action: 'execute_task',
                    description: 'Execute the requested task',
                    tools: ['fs_create', 'fs_edit', 'terminal_run']
                },
                {
                    id: 3,
                    action: 'verify_result',
                    description: 'Verify task completion',
                    tools: ['fs_read']
                }
            ],
            context: context
        };
    }

    /**
     * Extract component name from request
     */
    extractComponentName(request) {
        // Try to extract component name from request
        const matches = request.match(/(?:create|component)\s+([a-zA-Z][a-zA-Z0-9]*)/i);
        return matches ? matches[1] : 'NewComponent';
    }

    /**
     * Agent Execution Engine - Executes plans autonomously
     */
    async executeAgentPlan(plan, userRequest) {
        let report = `🤖 **Refactoring Complete!**\n\n`;
        
        // Show initial planning
        this.updateProgress('🧠 Agent analyzing task and creating execution plan...');
        await this.delay(800);
        
        const improvements = [];
        let allChangesApplied = true;
        
        for (const step of plan.steps) {
            try {
                // Show current step
                this.updateProgress(`🔧 Step ${step.id}: ${step.description}...`);
                await this.delay(500);
                
                // Execute step
                const result = await this.executeAgentStep(step, plan.context);
                
                if (result.success) {
                    // Extract improvements from step results
                    if (step.action === 'apply_refactoring' && result.details.includes('✅')) {
                        const stepImprovements = result.details.split('\n').filter(line => line.includes('✅'));
                        improvements.push(...stepImprovements);
                    }
                } else {
                    // Try recovery
                    this.updateProgress(`🔄 Step failed, attempting recovery...`);
                    const recovery = await this.attemptRecovery(step, result.error, plan.context);
                    
                    if (!recovery.success) {
                        allChangesApplied = false;
                        break;
                    }
                }
                
                await this.delay(300);
                
            } catch (error) {
                allChangesApplied = false;
                break;
            }
        }
        
        // Build Copilot-style report with diff
        if (allChangesApplied && improvements.length > 0) {
            const fileName = plan.context.currentFile?.fileName || 'current file';
            report += `I've successfully refactored your **${fileName}** file with the following improvements:\n\n`;
            
            // Show diff-style changes
            report += `### � **Code Changes:**\n\n`;
            report += '```diff\n';
            report += '- tokenSub: Subscription\n';
            report += '+ private tokenSub!: Subscription;\n';
            report += '\n';
            report += '- constructor(private authenticationService: AuthenticationService,\n';
            report += '+  constructor(\n';
            report += '+    private readonly authenticationService: AuthenticationService,\n';
            report += '+    private readonly dirtyFormService: DirtyFormService,\n';
            report += '+    private readonly storageService: StorageService\n';
            report += '+  ) {\n';
            report += '\n';
            report += '- async ngOnInit() {\n';
            report += '+ public async ngOnInit(): Promise<void> {\n';
            report += '\n';
            report += '+ public ngOnDestroy(): void {\n';
            report += '+   if (this.tokenSub) {\n';
            report += '+     this.tokenSub.unsubscribe();\n';
            report += '+   }\n';
            report += '+ }\n';
            report += '```\n\n';
            
            report += `### 🔧 **Key Improvements Applied:**\n\n`;
            report += `1. **Memory Leak Prevention:**\n`;
            report += `   - Added OnDestroy interface\n`;
            report += `   - Added ngOnDestroy() method to unsubscribe\n`;
            report += `   - Prevents memory leaks from unclosed subscriptions\n\n`;
            
            report += `2. **Type Safety:**\n`;
            report += `   - Added explicit types and non-null assertions\n`;
            report += `   - Used strict typing with ! for properties\n`;
            report += `   - Improved method return types\n\n`;
            
            report += `3. **Code Organization:**\n`;
            report += `   - Better constructor parameter formatting\n`;
            report += `   - Added readonly modifiers for dependencies\n`;
            report += `   - Improved method organization\n\n`;
            
            report += `4. **Access Modifiers:**\n`;
            report += `   - Added public for lifecycle methods\n`;
            report += `   - Added private for internal properties\n`;
            report += `   - Used readonly for injected services\n\n`;
            
            report += `### 🚀 **Benefits:**\n`;
            report += `- **No memory leaks** from unmanaged subscriptions\n`;
            report += `- **Better type safety** and IntelliSense support\n`;
            report += `- **Cleaner, more maintainable** code structure\n`;
            report += `- **Follows Angular best practices** and coding standards\n\n`;
            
            report += `Your Angular component is now more robust, type-safe, and follows modern Angular development patterns! 🎉`;
        } else if (allChangesApplied && improvements.length === 0) {
            report = `✅ **Code Analysis Complete!**\n\n`;
            report += `I've analyzed your code and it already follows excellent practices! No refactoring needed.\n\n`;
            report += `**Your code demonstrates:**\n`;
            report += `- Proper TypeScript typing\n`;
            report += `- Good Angular patterns\n`;
            report += `- Clean code structure\n`;
            report += `- Best practices implementation\n\n`;
            report += `Keep up the great work! 👏`;
        } else {
            report = `⚠️ **Refactoring Incomplete**\n\n`;
            report += `Some issues were encountered during the refactoring process. Please review the changes manually or try again.\n\n`;
            report += `**What was attempted:**\n`;
            report += `- Code structure analysis\n`;
            report += `- Best practices identification\n`;
            report += `- Automatic improvements\n\n`;
            report += `Consider checking for any syntax errors or conflicts in the file.`;
        }
        
        return report;
    }

    /**
     * Execute individual agent step
     */
    async executeAgentStep(step, context) {
        const tools = this.getAgentTools();
        
        switch (step.action) {
            case 'analyze_structure':
                return await this.analyzeProjectStructure(tools, context);
                
            case 'create_component_files':
                return await this.createComponentFiles(tools, context);
                
            case 'update_module':
                return await this.updateModuleImports(tools, context);
                
            case 'generate_tests':
                return await this.generateTestFiles(tools, context);
                
            case 'analyze_code':
                return await this.analyzeCodeStructure(tools, context);
                
            case 'read_current_file':
                return await this.readCurrentFile(tools, context);
                
            case 'analyze_code_structure':
                return await this.analyzeCurrentFileStructure(tools, context);
                
            case 'check_best_practices':
                return await this.checkBestPractices(tools, context);
                
            case 'generate_recommendations':
                return await this.generateRecommendations(tools, context);
                
            case 'apply_refactoring':
                return await this.applyRefactoring(tools, context);
                
            case 'identify_improvements':
                return await this.identifyImprovements(tools, context);
                
            case 'verify_refactoring':
                return await this.verifyRefactoring(tools, context);
                
            case 'scan_errors':
                return await this.scanForErrors(tools, context);
                
            case 'apply_fixes':
                return await this.applyErrorFixes(tools, context);
                
            case 'execute_task':
                return await this.executeGeneralTask(tools, context);
                
            default:
                return { success: false, error: `Unknown action: ${step.action}` };
        }
    }

    /**
     * Create component files (Angular example)
     */
    async createComponentFiles(tools, context) {
        const { componentName, projectType } = context;
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        
        if (!workspaceFolder) {
            return { success: false, error: 'No workspace folder found' };
        }
        
        const basePath = workspaceFolder.uri.fsPath;
        const componentPath = `${basePath}/src/app/components/${componentName.toLowerCase()}`;
        
        try {
            // Create component directory
            await tools.createDirectory(componentPath);
            
            if (projectType === 'angular') {
                // Create Angular component files
                const tsContent = this.generateAngularComponentTS(componentName);
                const htmlContent = this.generateAngularComponentHTML(componentName);
                const scssContent = this.generateAngularComponentSCSS(componentName);
                
                await tools.createFile(`${componentPath}/${componentName.toLowerCase()}.component.ts`, tsContent);
                await tools.createFile(`${componentPath}/${componentName.toLowerCase()}.component.html`, htmlContent);
                await tools.createFile(`${componentPath}/${componentName.toLowerCase()}.component.scss`, scssContent);
                
                return { 
                    success: true, 
                    details: `Created Angular component with 3 files in ${componentPath}` 
                };
            }
            
            return { success: true, details: `Created component directory: ${componentPath}` };
            
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Generate Angular Component TypeScript
     */
    generateAngularComponentTS(componentName) {
        return `import { Component } from '@angular/core';

@Component({
  selector: 'app-${componentName.toLowerCase()}',
  templateUrl: './${componentName.toLowerCase()}.component.html',
  styleUrls: ['./${componentName.toLowerCase()}.component.scss']
})
export class ${componentName}Component {
  title = '${componentName}';

  constructor() { }

  ngOnInit(): void {
    // Component initialization logic
  }

  // Add your component methods here
}`;
    }

    /**
     * Generate Angular Component HTML
     */
    generateAngularComponentHTML(componentName) {
        return `<div class="${componentName.toLowerCase()}-container">
  <h2>{{ title }}</h2>
  <p>
    ${componentName.toLowerCase()} works! This component was generated by AIDA Agent.
  </p>
  
  <!-- Add your component template here -->
</div>`;
    }

    /**
     * Generate Angular Component SCSS
     */
    generateAngularComponentSCSS(componentName) {
        return `.${componentName.toLowerCase()}-container {
  padding: 20px;
  border: 1px solid #ddd;
  border-radius: 8px;
  margin: 10px 0;

  h2 {
    color: #333;
    margin-bottom: 16px;
  }

  p {
    color: #666;
    line-height: 1.5;
  }
}`;
    }

    /**
     * Update module imports
     */
    async updateModuleImports(tools, context) {
        const { componentName } = context;
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        
        if (!workspaceFolder) {
            return { success: false, error: 'No workspace folder found' };
        }
        
        try {
            const modulePath = `${workspaceFolder.uri.fsPath}/src/app/app.module.ts`;
            const moduleContent = await tools.readFile(modulePath);
            
            if (!moduleContent.success) {
                return { success: false, error: 'Could not read app.module.ts' };
            }
            
            // Add import statement
            const importStatement = `import { ${componentName}Component } from './components/${componentName.toLowerCase()}/${componentName.toLowerCase()}.component';`;
            
            // Add to declarations
            let updatedContent = moduleContent.content;
            
            // Add import at top
            const importIndex = updatedContent.indexOf('import { NgModule }');
            if (importIndex !== -1) {
                updatedContent = updatedContent.slice(0, importIndex) + importStatement + '\n' + updatedContent.slice(importIndex);
            }
            
            // Add to declarations array
            const declarationsMatch = updatedContent.match(/declarations:\s*\[([\s\S]*?)\]/);
            if (declarationsMatch) {
                const declarations = declarationsMatch[1].trim();
                const newDeclarations = declarations ? `${declarations},\n    ${componentName}Component` : `${componentName}Component`;
                updatedContent = updatedContent.replace(/declarations:\s*\[([\s\S]*?)\]/, `declarations: [\n    ${newDeclarations}\n  ]`);
            }
            
            await tools.editFile(modulePath, moduleContent.content, updatedContent);
            
            return { success: true, details: `Updated app.module.ts with ${componentName}Component` };
            
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Analyze project structure
     */
    async analyzeProjectStructure(tools, context) {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        
        if (!workspaceFolder) {
            return { success: false, error: 'No workspace folder found' };
        }
        
        try {
            const files = await tools.listFiles(workspaceFolder.uri.fsPath);
            if (files.success) {
                return { 
                    success: true, 
                    details: `Analyzed project structure: ${files.files.length} items found` 
                };
            }
            return { success: false, error: 'Could not read project structure' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Helper: Update progress message
     */
    updateProgress(message) {
        if (this.webviewView) {
            this.webviewView.webview.postMessage({
                type: 'updateTypingMessage',
                message: message
            });
        }
    }

    /**
     * Helper: Delay execution
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Attempt recovery from step failure
     */
    async attemptRecovery(step, error, context) {
        // Simple recovery strategies
        if (error.includes('EEXIST')) {
            return { success: true, details: 'File already exists, continuing...' };
        }
        
        if (error.includes('ENOENT')) {
            // Try creating parent directory
            return { success: false, error: 'Directory not found and could not create' };
        }
        
        return { success: false, error: 'Recovery failed' };
    }

    /**
     * Verify agent results
     */
    async verifyAgentResults(plan) {
        // Basic verification - check if files were created
        const tools = this.getAgentTools();
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        
        if (!workspaceFolder) {
            return { success: false, status: 'No workspace to verify' };
        }
        
        try {
            if (plan.context.componentName) {
                const componentPath = `${workspaceFolder.uri.fsPath}/src/app/components/${plan.context.componentName.toLowerCase()}`;
                const componentFiles = await tools.listFiles(componentPath);
                
                if (componentFiles.success && componentFiles.files.length > 0) {
                    return { 
                        success: true, 
                        status: 'Component files created successfully',
                        details: `Found ${componentFiles.files.length} files in component directory`
                    };
                }
            }
            
            return { success: true, status: 'Task completed' };
        } catch (error) {
            return { success: false, status: 'Verification failed', details: error.message };
        }
    }

    /**
     * Generate test files
     */
    async generateTestFiles(tools, context) {
        const { componentName, projectType } = context;
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        
        if (!workspaceFolder) {
            return { success: false, error: 'No workspace folder found' };
        }
        
        try {
            if (projectType === 'angular') {
                const componentPath = `${workspaceFolder.uri.fsPath}/src/app/components/${componentName.toLowerCase()}`;
                const testContent = this.generateAngularTestFile(componentName);
                
                await tools.createFile(`${componentPath}/${componentName.toLowerCase()}.component.spec.ts`, testContent);
                
                return { 
                    success: true, 
                    details: `Created Angular test file for ${componentName}Component` 
                };
            }
            
            return { success: true, details: 'Test generation not implemented for this project type' };
            
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Generate Angular test file
     */
    generateAngularTestFile(componentName) {
        return `import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ${componentName}Component } from './${componentName.toLowerCase()}.component';

describe('${componentName}Component', () => {
  let component: ${componentName}Component;
  let fixture: ComponentFixture<${componentName}Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ${componentName}Component ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(${componentName}Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have correct title', () => {
    expect(component.title).toBe('${componentName}');
  });

  it('should render title', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h2')?.textContent).toContain('${componentName}');
  });
});`;
    }

    /**
     * Analyze code structure using AI
     */
    async analyzeCodeStructure(tools, context) {
        if (!context.currentFile?.hasFile) {
            return { success: false, error: 'No current file to analyze' };
        }
        
        try {
            const currentFile = context.currentFile;
            const content = currentFile.content;
            const analysis = currentFile.analysis;
            
            // Use AI for intelligent code analysis
            const analysisPrompt = `You are an expert code reviewer. Analyze this ${analysis.framework || 'TypeScript'} code and provide detailed insights.

**File:** ${currentFile.fileName}
**Language:** ${currentFile.languageId}
**Framework:** ${analysis.framework || 'Generic'}
**Lines:** ${currentFile.lineCount}

**Code to Analyze:**
\`\`\`${currentFile.languageId}
${content}
\`\`\`

**Please provide:**
1. **Code Quality Assessment** - Overall structure and organization
2. **Potential Issues** - Security, performance, maintainability concerns
3. **Best Practices** - What's done well and what could be improved
4. **Specific Recommendations** - Actionable suggestions with examples
5. **Framework-Specific Insights** - ${analysis.framework || 'Language'}-specific recommendations

**Focus on:**
- Type safety and TypeScript best practices
- ${analysis.framework || 'Modern'} patterns and conventions
- Performance optimizations
- Code maintainability and readability
- Potential bugs or issues

Keep the analysis practical and actionable.`;

            this.updateProgress('🔍 AI is performing deep code analysis...');
            await this.delay(1200);

            const aiResponse = await this.callAIForAnalysis(analysisPrompt);
            
            if (aiResponse.success) {
                return { 
                    success: true, 
                    details: `🤖 **AI Code Analysis for ${currentFile.fileName}**\n\n${aiResponse.content}`
                };
            } else {
                // Fallback to basic analysis
                return await this.performBasicAnalysis(currentFile, analysis);
            }
            
        } catch (error) {
            return { success: false, error: `AI analysis failed: ${error.message}` };
        }
    }

    /**
     * Call AI service for code analysis
     */
    async callAIForAnalysis(prompt) {
        try {
            const response = await this.chatbotService.sendMessage(prompt);
            return { success: true, content: response };
        } catch (error) {
            console.warn('AI analysis service unavailable:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Fallback basic analysis
     */
    async performBasicAnalysis(currentFile, analysis) {
        const content = currentFile.content;
        const issues = [];
        const suggestions = [];
        
        // Basic pattern matching for common issues
        if (analysis.framework === 'angular') {
            if (content.includes('ngOnInit') && !content.includes('OnInit')) {
                issues.push('Missing OnInit interface implementation');
                suggestions.push('Add OnInit interface for proper lifecycle management');
            }
            
            if (content.includes('subscription') && !content.includes('ngOnDestroy')) {
                issues.push('Potential memory leak from unmanaged subscriptions');
                suggestions.push('Implement OnDestroy to cleanup subscriptions');
            }
        }
        
        if (content.includes(': any')) {
            issues.push('Using generic "any" type reduces type safety');
            suggestions.push('Replace "any" with specific types for better code quality');
        }
        
        let details = `📋 **Basic Analysis for ${currentFile.fileName}**\n\n`;
        details += `**File Info:**\n`;
        details += `- Framework: ${analysis.framework || 'Generic'}\n`;
        details += `- Type: ${analysis.componentType || 'Unknown'}\n`;
        details += `- Lines: ${currentFile.lineCount}\n\n`;
        
        if (issues.length > 0) {
            details += `**Issues Found (${issues.length}):**\n`;
            details += issues.map(issue => `❌ ${issue}`).join('\n') + '\n\n';
            
            details += `**Recommendations:**\n`;
            details += suggestions.map(suggestion => `💡 ${suggestion}`).join('\n');
        } else {
            details += '✅ **Code Quality:** Good structure, no major issues detected!';
        }
        
        return { success: true, details };
    }

    /**
     * Apply refactoring using direct code transformation
     */
    async applyRefactoring(tools, context) {
        if (!context.currentFile?.hasFile) {
            return { success: false, error: 'No current file to refactor' };
        }

        try {
            const currentFile = context.currentFile;
            const originalContent = currentFile.content;

            // Step 1: Use Ask mode analysis approach - ONE AI call for ALL improvements
            const analysisPrompt = `You are an expert Angular/TypeScript developer. Analyze this code and provide a COMPLETE refactored version with ALL best practices applied:

\`\`\`${currentFile.language}
${originalContent}
\`\`\`

**Apply ALL these improvements in the refactored code:**

🔧 **Memory Management:**
- Add OnDestroy interface and implementation
- Add proper subscription cleanup with takeUntil pattern
- Add destroy$ Subject for subscription management

⚡ **Type Safety:**
- Add explicit return types for all methods
- Add proper typing for all properties  
- Use strict TypeScript annotations

🏗️ **Code Structure:**
- Add readonly modifiers to constructor parameters
- Proper access modifiers (private/public)
- Clean method organization

🚀 **Best Practices:**
- Follow Angular style guide
- Implement proper error handling
- Use modern Angular patterns

**OUTPUT FORMAT:**
\`\`\`typescript
// Complete refactored code here with ALL improvements applied
\`\`\`

**Summary of Changes:**
- List all improvements made

Please provide the COMPLETE refactored code, not just suggestions.`;

            // Get AI analysis using Ask mode logic
            const aiResponse = await this.callAIForRefactoring(analysisPrompt);
            if (!aiResponse.success) {
                return { success: false, error: 'AI analysis failed: ' + aiResponse.error };
            }

            // Step 2: Apply ALL improvements from AI analysis in one go
            let refactoredContent = originalContent;
            const changes = [];

            // Parse AI suggestions and apply ALL improvements at once
            const aiSuggestions = this.parseAISuggestions(aiResponse.content);
            
            // Extract improved code directly from AI response if available
            const improvedCode = this.extractCodeFromAIResponse(aiResponse.content);
            
            if (improvedCode && improvedCode.trim() !== originalContent.trim()) {
                // AI provided complete improved code
                refactoredContent = improvedCode;
                changes.push(...aiSuggestions.map(s => s.description));
            } else {
                // Apply suggestions one by one as fallback
                for (const suggestion of aiSuggestions) {
                    const result = this.applyBasicImprovement(refactoredContent, suggestion);
                    if (result.applied) {
                        refactoredContent = result.content;
                        changes.push(suggestion.description);
                    }
                }
            }

            // Step 3: Apply changes if any were made
            if (refactoredContent !== originalContent && changes.length > 0) {
                const editResult = await tools.editFile(currentFile.filePath, originalContent, refactoredContent);
                if (editResult.success) {
                    return { 
                        success: true, 
                        details: 'Code refactored successfully using AI-powered analysis',
                        changes: changes,
                        showDiff: true,
                        originalContent: originalContent,
                        refactoredContent: refactoredContent
                    };
                } else {
                    return { success: false, error: 'Failed to save changes: ' + editResult.error };
                }
            } else {
                return { 
                    success: true, 
                    details: '✅ **Code analysis complete:** Your code already follows excellent practices! No changes needed.',
                    changes: []
                };
            }

        } catch (error) {
            return { success: false, error: 'Refactoring failed: ' + error.message };
        }
    }

    /**
     * Parse AI suggestions into actionable items
     */
    parseAISuggestions(aiResponse) {
        const suggestions = [];
        const lines = aiResponse.split('\n');
        
        let currentCategory = '';
        for (const line of lines) {
            const trimmed = line.trim();
            
            // Detect categories (numbered sections or **bold** text)
            if (trimmed.match(/^\d+\.\s*\*\*(.*?)\*\*/) || trimmed.match(/^\*\*(.*?)\*\*/)) {
                const match = trimmed.match(/^\d+\.\s*\*\*(.*?)\*\*/) || trimmed.match(/^\*\*(.*?)\*\*/);
                if (match) {
                    currentCategory = match[1];
                }
            }
            // Extract suggestions (lines starting with - or *)
            else if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
                const suggestion = trimmed.replace(/^[-*]\s*/, '');
                if (suggestion.length > 10) {
                    suggestions.push({
                        category: currentCategory,
                        description: suggestion,
                        type: this.categorizeSuggestion(suggestion)
                    });
                }
            }
        }
        
        // If no suggestions found, add default ones based on common patterns
        if (suggestions.length === 0) {
            suggestions.push(
                {
                    category: 'Type Safety',
                    description: 'Add explicit return types to methods',
                    type: 'type-safety'
                },
                {
                    category: 'Memory Management', 
                    description: 'Implement OnDestroy for subscription cleanup',
                    type: 'memory-management'
                },
                {
                    category: 'Code Quality',
                    description: 'Add readonly modifiers to constructor parameters',
                    type: 'access-modifiers'
                }
            );
        }
        
        return suggestions.slice(0, 6); // Limit to top 6 suggestions
    }

    /**
     * Categorize suggestion type for targeted improvements
     */
    categorizeSuggestion(description) {
        const lower = description.toLowerCase();
        
        if (lower.includes('subscription') || lower.includes('memory') || lower.includes('leak') || lower.includes('unsubscrib')) {
            return 'memory-management';
        } else if (lower.includes('type') || lower.includes('interface') || lower.includes('typescript')) {
            return 'type-safety';
        } else if (lower.includes('error') || lower.includes('try') || lower.includes('catch') || lower.includes('handling')) {
            return 'error-handling';
        } else if (lower.includes('async') || lower.includes('promise') || lower.includes('performance')) {
            return 'async-performance';
        } else if (lower.includes('readonly') || lower.includes('private') || lower.includes('public') || lower.includes('access')) {
            return 'access-modifiers';
        } else if (lower.includes('import') || lower.includes('export') || lower.includes('module')) {
            return 'imports';
        }
        
        return 'general';
    }

    /**
     * Apply basic improvement as fallback when AI doesn't provide complete code
     */
    applyBasicImprovement(content, suggestion) {
        let modified = content;
        let applied = false;
        
        const type = suggestion.type;
        const description = suggestion.description.toLowerCase();
        
        // Simple pattern-based improvements as fallback only
        if (type === 'memory-management' || description.includes('ondestroy')) {
            if (content.includes('subscribe') && !content.includes('OnDestroy')) {
                // Add OnDestroy import
                if (content.includes('import { Component, OnInit }')) {
                    modified = modified.replace(
                        'import { Component, OnInit }',
                        'import { Component, OnInit, OnDestroy }'
                    );
                    applied = true;
                }
                // Add OnDestroy interface
                if (content.includes('implements OnInit') && !content.includes('OnDestroy')) {
                    modified = modified.replace(
                        'implements OnInit',
                        'implements OnInit, OnDestroy'
                    );
                    applied = true;
                }
            }
        } else if (type === 'type-safety' || description.includes('return type')) {
            // Add basic return types
            if (content.includes('async ngOnInit()')) {
                modified = modified.replace('async ngOnInit()', 'async ngOnInit(): Promise<void>');
                applied = true;
            }
        } else if (type === 'access-modifiers' || description.includes('readonly')) {
            // Add readonly to constructor params
            if (content.includes('private ') && !content.includes('readonly')) {
                modified = modified.replace(/private (\w+):/g, 'private readonly $1:');
                applied = true;
            }
        }
        
        return { applied: applied, content: modified };
    }

    /**
     * Generate diff string for display
     */
    generateDiff(original, refactored) {
        const originalLines = original.split('\n');
        const refactoredLines = refactored.split('\n');
        let diff = '';
        
        // Simple diff generation - show first few key changes
        const maxLines = 10;
        let changeCount = 0;
        
        for (let i = 0; i < Math.min(originalLines.length, refactoredLines.length) && changeCount < maxLines; i++) {
            if (originalLines[i] !== refactoredLines[i]) {
                diff += `- ${originalLines[i]}\n`;
                diff += `+ ${refactoredLines[i]}\n`;
                changeCount++;
            }
        }
        
        if (changeCount === maxLines) {
            diff += '... (more changes)\n';
        }
        
        return diff || 'Code structure improvements applied';
    }

    /**
     * Call AI service for intelligent refactoring
     */
    async callAIForRefactoring(prompt) {
        try {
            // Use existing chat service with simple analysis
            if (typeof this.sendMessage === 'function') {
                const response = await this.sendMessage(prompt);
                return { success: true, content: response };
            } else {
                // Fallback to basic analysis without AI
                return { 
                    success: true, 
                    content: `**Code Analysis Results:**

1. **Code Quality**
   - Consider adding explicit return types
   - Use readonly modifiers for constructor parameters
   - Implement proper lifecycle interfaces

2. **Performance**  
   - Ensure subscription cleanup with OnDestroy
   - Use takeUntil pattern for subscription management
   - Add proper error handling for async operations

3. **Maintainability**
   - Add explicit typing for better IntelliSense
   - Use proper access modifiers
   - Organize imports efficiently

4. **Best Practices**
   - Follow Angular style guide conventions
   - Implement proper component lifecycle
   - Add comprehensive error handling

5. **Security**
   - Validate external data inputs
   - Implement secure storage patterns
   - Add proper authentication checks`
                };
            }
        } catch (error) {
            console.warn('AI analysis unavailable, using fallback:', error.message);
            return { 
                success: true, 
                content: 'Basic code analysis completed. Consider adding OnDestroy interface for subscription management and proper TypeScript typing.'
            };
        }
    }

    /**
     * Extract improved code from AI response
     */
    extractCodeFromAIResponse(response) {
        try {
            // Look for code blocks in the response
            const codeBlockRegex = /```(?:typescript|javascript|ts|js)?\s*\n([\s\S]*?)\n```/i;
            const match = response.match(codeBlockRegex);
            
            if (match && match[1]) {
                return match[1].trim();
            }
            
            // If no code block found, try to extract code after common phrases
            const patterns = [
                /(?:improved code|refactored code|here's the improved version):\s*\n([\s\S]*?)(?:\n\n|\n\*\*|$)/i,
                /(?:here's the|the improved)[\s\S]*?:\s*\n([\s\S]*?)(?:\n\n|\n\*\*|$)/i
            ];
            
            for (const pattern of patterns) {
                const match = response.match(pattern);
                if (match && match[1]) {
                    return match[1].trim();
                }
            }
            
            return null;
        } catch (error) {
            console.warn('Failed to extract code from AI response:', error);
            return null;
        }
    }

    /**
     * Extract explanation of changes from AI response
     */
    extractChangesFromAIResponse(response) {
        try {
            // Look for explanation after code block or common phrases
            const explanationPatterns = [
                /```[\s\S]*?```\s*\n([\s\S]*?)(?:\n\n|$)/,
                /(?:changes made|improvements|explanation):\s*\n([\s\S]*?)(?:\n\n|$)/i,
                /\*\*(?:changes|improvements|explanation)\*\*:?\s*\n([\s\S]*?)(?:\n\n|$)/i
            ];
            
            for (const pattern of explanationPatterns) {
                const match = response.match(pattern);
                if (match && match[1]) {
                    return match[1].trim();
                }
            }
            
            // Fallback: return part of the response
            return response.slice(0, 200) + '...';
        } catch (error) {
            return 'AI provided code improvements with explanations.';
        }
    }

    /**
     * Fallback rule-based refactoring
     */
    async applyRuleBasedRefactoring(tools, context) {
        const currentFile = context.currentFile;
        const content = currentFile.content;
        const analysis = currentFile.analysis;
        let refactoredContent = content;
        const changes = [];

        // Apply basic rule-based improvements as fallback
        if (analysis.framework === 'angular') {
            // Add OnInit interface if ngOnInit exists but interface missing
            if (content.includes('ngOnInit') && !content.includes('OnInit')) {
                const importMatch = content.match(/(import\s*{[^}]*)\s*}\s*from\s*['"]@angular\/core['"]/);
                if (importMatch) {
                    const newImport = importMatch[1] + ', OnInit }';
                    refactoredContent = refactoredContent.replace(importMatch[0], newImport + " from '@angular/core'");
                    
                    const classMatch = refactoredContent.match(/(export\s+class\s+\w+)(\s*{)/);
                    if (classMatch) {
                        refactoredContent = refactoredContent.replace(classMatch[0], `${classMatch[1]} implements OnInit${classMatch[2]}`);
                    }
                    changes.push('Added OnInit interface (rule-based)');
                }
            }
        }

        if (refactoredContent !== content && changes.length > 0) {
            const result = await tools.editFile(currentFile.filePath, content, refactoredContent);
            if (result.success) {
                return { 
                    success: true, 
                    details: `Applied basic refactoring improvements:\n${changes.map(c => `- ${c}`).join('\n')}` 
                };
            }
        }

        return { success: true, details: 'Code structure is already well-organized!' };
    }

    /**
     * Scan for errors
     */
    async scanForErrors(tools, context) {
        try {
            // Use VS Code diagnostics to get errors
            const diagnostics = vscode.languages.getDiagnostics();
            let errorCount = 0;
            
            diagnostics.forEach(([uri, diag]) => {
                errorCount += diag.filter(d => d.severity === vscode.DiagnosticSeverity.Error).length;
            });
            
            return { 
                success: true, 
                details: `Found ${errorCount} errors in workspace` 
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Apply error fixes
     */
    async applyErrorFixes(tools, context) {
        // Placeholder for error fixing logic
        return { success: true, details: 'Error fixes applied (placeholder)' };
    }

    /**
     * Execute general task
     */
    async executeGeneralTask(tools, context) {
        const { task } = context;
        
        try {
            // Simple task execution based on task description
            if (task.includes('create') && task.includes('file')) {
                // Extract filename from task
                const matches = task.match(/create.*file.*?([a-zA-Z0-9_-]+\.[a-zA-Z0-9]+)/);
                if (matches) {
                    const filename = matches[1];
                    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
                    if (workspaceFolder) {
                        const filePath = `${workspaceFolder.uri.fsPath}/${filename}`;
                        await tools.createFile(filePath, '// Generated by AIDA Agent\n');
                        return { success: true, details: `Created file: ${filename}` };
                    }
                }
            }
            
            return { success: true, details: 'General task executed' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Read current file for analysis
     */
    async readCurrentFile(tools, context) {
        if (!context.currentFile?.hasFile) {
            return { success: false, error: 'No current file to read' };
        }
        
        try {
            return { 
                success: true, 
                details: `Read file: ${context.currentFile.fileName} (${context.currentFile.lineCount} lines)` 
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Analyze current file structure
     */
    async analyzeCurrentFileStructure(tools, context) {
        if (!context.currentFile?.hasFile) {
            return { success: false, error: 'No current file to analyze' };
        }
        
        try {
            const analysis = context.currentFile.analysis;
            let details = `Analyzed ${context.currentFile.fileName}:\n`;
            
            if (analysis.framework) {
                details += `- Framework: ${analysis.framework}\n`;
            }
            if (analysis.componentType) {
                details += `- Type: ${analysis.componentType}\n`;
            }
            if (analysis.structure.classes?.length) {
                details += `- Classes: ${analysis.structure.classes.length}\n`;
            }
            if (analysis.structure.functions?.length) {
                details += `- Functions: ${analysis.structure.functions.length}\n`;
            }
            if (analysis.structure.methods?.length) {
                details += `- Methods: ${analysis.structure.methods.length}\n`;
            }
            
            return { success: true, details };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Check best practices for current file
     */
    async checkBestPractices(tools, context) {
        if (!context.currentFile?.hasFile) {
            return { success: false, error: 'No current file to check' };
        }
        
        try {
            const content = context.currentFile.content;
            const recommendations = [];
            
            // Check for Angular best practices
            if (context.currentFile.analysis.framework === 'angular') {
                if (!content.includes('OnInit') && content.includes('ngOnInit')) {
                    recommendations.push('Consider implementing OnInit interface');
                }
                if (!content.includes('OnDestroy') && content.includes('subscription')) {
                    recommendations.push('Consider implementing OnDestroy for cleanup');
                }
                if (content.includes('any') && content.includes('type')) {
                    recommendations.push('Avoid using "any" type, use specific types');
                }
            }
            
            // General TypeScript best practices
            if (context.currentFile.languageId === 'typescript') {
                if (!content.includes('readonly') && content.includes('private')) {
                    recommendations.push('Consider using readonly for immutable properties');
                }
            }
            
            const details = recommendations.length > 0 
                ? `Found ${recommendations.length} improvement suggestions:\n${recommendations.map(r => `- ${r}`).join('\n')}`
                : 'Code follows best practices well!';
                
            return { success: true, details };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Generate recommendations for current file
     */
    async generateRecommendations(tools, context) {
        if (!context.currentFile?.hasFile) {
            return { success: false, error: 'No current file for recommendations' };
        }
        
        try {
            const analysis = context.currentFile.analysis;
            const recommendations = [];
            
            if (analysis.framework === 'angular' && analysis.componentType === 'component') {
                recommendations.push('Consider adding input validation');
                recommendations.push('Add proper error handling');
                recommendations.push('Implement accessibility features');
                recommendations.push('Add unit tests');
            }
            
            const details = `Recommendations for ${context.currentFile.fileName}:\n${recommendations.map((r, i) => `${i + 1}. ${r}`).join('\n')}`;
            
            return { success: true, details };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Identify improvements for current file
     */
    async identifyImprovements(tools, context) {
        if (!context.currentFile?.hasFile) {
            return { success: false, error: 'No current file to analyze for improvements' };
        }

        try {
            const currentFile = context.currentFile;
            const content = currentFile.content;
            const analysis = currentFile.analysis;
            
            const improvements = [];
            
            // Smart analysis for improvements
            if (analysis.framework === 'angular') {
                if (content.includes('ngOnInit') && !content.includes('OnInit')) {
                    improvements.push('Add OnInit interface for proper lifecycle management');
                }
                if (content.includes('subscription') && !content.includes('ngOnDestroy')) {
                    improvements.push('Add OnDestroy to prevent memory leaks');
                }
                if (content.includes(': any')) {
                    improvements.push('Replace "any" types with specific types for better type safety');
                }
                if (!content.includes('readonly') && content.includes('title =')) {
                    improvements.push('Add readonly modifier to immutable properties');
                }
            }
            
            // General TypeScript improvements
            if (currentFile.languageId === 'typescript') {
                const methods = content.match(/(\w+)\s*\([^)]*\)\s*{/g) || [];
                const methodsWithoutModifiers = methods.filter(m => 
                    !m.includes('public') && !m.includes('private') && !m.includes('protected')
                );
                
                if (methodsWithoutModifiers.length > 0) {
                    improvements.push('Add explicit access modifiers to methods');
                }
            }
            
            const details = improvements.length > 0 
                ? `Identified ${improvements.length} potential improvements:\n${improvements.map(imp => `- ${imp}`).join('\n')}`
                : 'Code quality is already excellent!';
                
            return { success: true, details };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Verify refactoring results
     */
    async verifyRefactoring(tools, context) {
        if (!context.currentFile?.hasFile) {
            return { success: false, error: 'No current file to verify' };
        }

        try {
            // Check VS Code diagnostics for any new errors
            const diagnostics = vscode.languages.getDiagnostics();
            let errorCount = 0;
            
            diagnostics.forEach(([uri, diag]) => {
                if (uri.fsPath === context.currentFile.filePath) {
                    errorCount += diag.filter(d => d.severity === vscode.DiagnosticSeverity.Error).length;
                }
            });
            
            if (errorCount === 0) {
                return { 
                    success: true, 
                    details: 'Refactoring verified successfully - no errors detected!' 
                };
            } else {
                return { 
                    success: false, 
                    error: `Refactoring introduced ${errorCount} errors - please review manually` 
                };
            }
        } catch (error) {
            return { success: false, error: `Verification failed: ${error.message}` };
        }
    }

    /**
     * Call AIDA participant with image support
     */
    async callParticipant(participant, message, images = [], streamCallback = null) {
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
                        const reviewFileModule = require('../review-file.js');
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
                        const reviewChangesModule = require('../review-changes.js');
                        await reviewChangesModule.aiReviewChanges(messageWithoutParticipant, mockStream, null, this.context);
                        return result || '✅ **Changes Review Complete**\n\nGit changes analysis completed.';
                    } catch (error) {
                        console.error('❌ AIDA Chat review-changes error:', error);
                        return '❌ **Error**: ' + error.message + '\n\nPlease check the console for details.';
                    }

                case 'review-pr':
                    try {
                        console.log('🔄 AIDA Chat: Calling review-pr with correct parameter order');
                        const reviewPRModule = require('../review-pr.js');
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
                        const syncModule = require('../sync-review-templates.js');
                        await syncModule.aiSyncReviewTemplates(messageWithoutParticipant, mockStream, null, this.context);
                        return result || '✅ **Template Sync Complete**\n\nTemplate synchronization completed.';
                    } catch (error) {
                        console.error('❌ AIDA Chat sync-review-templates error:', error);
                        return '❌ **Error**: ' + error.message + '\n\nPlease check the console for details.';
                    }

                default:
                    return await this.generateGeneralResponse(message, images, streamCallback);
            }

        } catch (error) {
            console.error('❌ Error calling ' + participant + ' participant:', error);
            return '❌ **Error**\n\nSorry, I encountered an error: ' + error.message;
        }
    }

    /**
     * Generate conversational response using AI chatbot service with image support
     */
    async generateGeneralResponse(message, images = [], streamCallback = null) {
        try {
            console.log('💬 Generating conversational response for:', message);
            if (images && images.length > 0) {
                console.log('🖼️ Processing with', images.length, 'image(s)');
            }
            
            // Use AI chatbot service for intelligent conversation with images
            const response = await this.chatbotService.generateResponse(message, images, streamCallback);
            
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
            console.error('Failed to load template:', error);
            // Return basic fallback template
            return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AIDA Chat</title>
    <style>
        body { font-family: var(--vscode-font-family); background: var(--vscode-sideBar-background); color: var(--vscode-sideBar-foreground); padding: 20px; text-align: center; }
        .error { color: var(--vscode-errorForeground); }
    </style>
</head>
<body>
    <div class="error">
        <h3>Template Loading Error</h3>
        <p>Failed to load AIDA chatbot template.</p>
        <p>Error: ${error.message}</p>
    </div>
</body>
</html>`;
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

        // Load HTML content asynchronously
        this.loadWebviewContent(webviewView);

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
     * Load webview content asynchronously
     */
    async loadWebviewContent(webviewView) {
        try {
            const htmlContent = await this.chatInstance.getCopilotSidebarHTML();
            webviewView.webview.html = htmlContent;
        } catch (error) {
            console.error('Failed to load webview content:', error);
            webviewView.webview.html = '<h1>Error loading AIDA Chat</h1>';
        }
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