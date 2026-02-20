const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const https = require('https');
const { URL } = require('url');
// Extracted modules (Phase 5)
const { getMonacoWebviewContent, getMonacoLanguage, escapeHtml } = require('./scripts/review/monaco-webview');
const { setupAzureDevOpsSettings, parseFullDiffContentEnhanced, detectAzureDevOpsFromDiff, getFullContentWithDetectedInfo, extractCommitsFromDiff, getFullFileContentFromAzureDevOps, convertFullContentToLineFormat, reconstructFromDiffFallback, reconstructFromGitDiff } = require('./scripts/review/diff-utils');


// Import all required functions including showAvailableModels
const {
    executeAIReview,
    getReviewTemplate,
    displayReviewHeader,
    getUnifiedModel,
    getChecklistStatusIcon,
    showAvailableModels,
    getBusinessDocumentFolders
} = require('./scripts/review/review-common');

const { analyzeFileDependency, activateDependencyWatcherIfCacheExists } = require('./scripts/dependency/dependency');

// Usage Tracking for Company Version
const { trackEvent, isTrackingConfigured } = require('./scripts/tracking/usage-tracking');
const { TrackingEvent, AiProvider, TrackingSource } = require('./scripts/tracking/tracking-enums');

// Shared state — single source of truth (no more circular deps)
const { chatSessions, handleEnterTwiceLogic } = require('./scripts/core/shared-state');
const { ensureAidaTemplatesForReview, handleSyncTemplates, createAidaTemplateStructure, syncNewLanguageTemplates, copyDirectoryAsync } = require('./scripts/core/template-engine');

// Global state for business documents selection
const businessDocsState = {
    'changes-review': {
        selectedCategories: new Set(),
        allCategories: []
    },
    'file-review': {
        selectedCategories: new Set(),
        allCategories: []
    }
};

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    // console.log('Reload 4');
    console.log('🤖 AIDA v1.1.12 - AI Development Assistant');
    console.log('🚀 AIDA extension is now active!');

    // Track extension activation
    trackEvent(TrackingEvent.EXTENSION_ACTIVATED, {
        isNewInstall: vscode.env.isNewAppInstall,
        remoteName: vscode.env.remoteName || 'local'
    });

    // Store extension path globally
    global.extensionPath = context.extensionPath;

    // Store extension context globally for review commands to access workspaceState
    global.aidaExtensionContext = context;

    // Auto-activate dependency watcher if cache exists
    activateDependencyWatcherIfCacheExists(context);

    // Register Virtual Content Provider for in-memory files (aida-memory scheme)
    try {
        const { virtualContentProvider } = require('./scripts/core/virtual-content-provider');
        context.subscriptions.push(
            vscode.workspace.registerTextDocumentContentProvider('aida-memory', virtualContentProvider)
        );
        console.log('✅ Registered aida-memory content provider');
    } catch (error) {
        console.error('❌ Failed to register virtual content provider:', error);
    }

    // Make business docs state accessible globally
    global.businessDocsState = businessDocsState;

    // Initialize Copilot-Style Sidebar Chat (True GitHub Copilot Experience)
    let copilotSidebarChat = null;
    try {
        console.log('🔄 Initializing AIDA Chatbot Sidebar...');
        const sidebarChatModule = require('./scripts/chatbot/chatbot-sidebar.js');
        const sidebarResult = sidebarChatModule.initializeCopilotSidebarChat(context);
        copilotSidebarChat = sidebarResult?.sidebarChat;
        console.log('✅ AIDA Chatbot Sidebar initialized successfully');
    } catch (error) {
        console.error('❌ Failed to initialize AIDA Chatbot Sidebar:', error);
        console.error('❌ Error details:', error.stack);
    }

    // Register command to open AIDA sidebar chat directly
    let openAidaChat = vscode.commands.registerCommand('aida.openChat', async () => {
        // Track usage - this is AIDA chatbot
        trackEvent(TrackingEvent.OPEN_CHAT, {
            aiProvider: AiProvider.AIDA_CHATBOT
        });

        if (copilotSidebarChat) {
            copilotSidebarChat.show();
        } else {
            vscode.window.showErrorMessage('AIDA Sidebar Chat is not initialized. Please check the logs for errors.');
        }
    });

    // Register title bar commands for AIDA sidebar
    let clearChatSidebarCommand = vscode.commands.registerCommand('aida.clearChatSidebar', async () => {
        if (copilotSidebarChat) {
            copilotSidebarChat.chatHistory = [];
            // Save the cleared history to persistent storage
            copilotSidebarChat.saveChatHistory();
            // Send clear message to webview
            if (copilotSidebarChat.webviewView) {
                copilotSidebarChat.webviewView.webview.postMessage({ type: 'clearChat' });
            }
        }
    });

    let openSettingsSidebarCommand = vscode.commands.registerCommand('aida.openSettingsSidebar', async () => {
        vscode.commands.executeCommand('workbench.action.openSettings', 'aida');
    });

    // Register test command to get Copilot models
    const testModelsModule = require('./scripts/test/test-get-copilot-models.js');
    testModelsModule.registerTestCommand(context);

    let closeChatSidebarCommand = vscode.commands.registerCommand('aida.closeChatSidebar', async () => {
        vscode.commands.executeCommand('workbench.action.closeSidebar');
    });

    // Register Azure DevOps setup command
    let setupAzureDevOps = vscode.commands.registerCommand('aida.setupAzureDevOps', async () => {
        await setupAzureDevOpsSettings();
    });

    let confirmReviewDocs = vscode.commands.registerCommand('aida.confirmReviewDocs', async (filePath, chatCommand = 'review-changes', keepSelectedDocs = false) => {
        // Simple logic - set Quick Review mode (unified for both changes and file review)
        if (!keepSelectedDocs) {
            global.selectedBusinessDocs = [];
        }

        console.log(`🚀 Quick Review button clicked - set global.selectedBusinessDocs = [] (command: ${chatCommand})`);
        console.log('🔍 DEBUG: filePath received =', filePath);

        // Check if user is currently in AIDA Sidebar Chat or Copilot Chat
        const activeView = vscode.window.activeTextEditor?.document.uri.scheme;
        console.log('🔍 Active view scheme:', activeView);

        // Try to detect if AIDA sidebar is visible/active
        const aidaSidebarActive = copilotSidebarChat?.webviewView?.visible;
        console.log('📱 AIDA Sidebar active:', aidaSidebarActive);

        if (aidaSidebarActive && copilotSidebarChat) {
            // User is in AIDA chatbot - send message directly to AIDA
            console.log('🤖 Redirecting to AIDA Chatbot');
            copilotSidebarChat.show();
            const message = `@${chatCommand} ${filePath}`;
            await copilotSidebarChat.sendMessage(message);
        } else {
            // Keep the review in GitHub Copilot Chat (original behavior)  
            console.log('💬 Redirecting to GitHub Copilot Chat');
            await vscode.commands.executeCommand('workbench.panel.chat.view.copilot.focus');
            await vscode.commands.executeCommand('workbench.action.chat.open', {
                query: `@${chatCommand} ${filePath}` // Auto-prepend @ symbol
            });
        }
    });


    let showChangesHelp = vscode.commands.registerCommand('aida.showChangesHelp', async () => {
        vscode.window.showInformationMessage(
            'Code Review Helper - @review-changes',
            {
                modal: false,
                detail: `Usage examples:
• @review-changes - Review git changes for current file
• @review-changes src/components/MyComponent.ts - Review specific file changes
• Use @review-file to review entire file content instead of just changes`
            }
        );
    });

    let showFileHelp = vscode.commands.registerCommand('aida.showFileHelp', async () => {
        vscode.window.showInformationMessage(
            'Code Review Helper - @review-file',
            {
                modal: false,
                detail: `Usage examples:
• @review-file - Review currently active file
• @review-file src/components/MyComponent.ts - Review specific file
• Use @review-changes to review only git changes instead of entire file`
            }
        );
    });

    // Register commands matching package.json (for right-click menu)
    let reviewFileCommand = vscode.commands.registerCommand('aida.reviewFile', async (uri) => {
        console.log('🎯 Review File command called', uri);
        
        // Check AI provider
        const config = vscode.workspace.getConfiguration('aida');
        const useAIDAChatbot = config.get('useAIDAChatbot', false);
        const aiProvider = useAIDAChatbot ? AiProvider.AIDA_CHATBOT : AiProvider.GITHUB_COPILOT;
        
        // Track usage with AI provider info
        trackEvent(TrackingEvent.REVIEW_FILE, {
            fileType: uri?.fsPath ? path.extname(uri.fsPath) : 'unknown',
            source: TrackingSource.CONTEXT_MENU,
            aiProvider: aiProvider
        });

        try {
            // Check if AIDA chat should be used
            console.log('🔍 useAIDAChatbot flag:', useAIDAChatbot);
            console.log('🔍 GitHub Copilot extension active:', vscode.extensions.getExtension('GitHub.copilot')?.isActive);

            if (useAIDAChatbot) {
                console.log('➡️ Using AIDA chatbot (useAIDAChatbot=true)');
                // Use AIDA Copilot-style chat
                await vscode.commands.executeCommand('aida.reviewFileContext', uri);
            } else {
                console.log('➡️ Using GitHub Copilot (useAidaChatbot=false)');
                // Use GitHub Copilot
                await vscode.commands.executeCommand('workbench.panel.chat.view.copilot.focus');
                if (uri && uri.fsPath) {
                    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
                    let filePath = uri.fsPath;
                    if (workspaceFolder) {
                        filePath = path.relative(workspaceFolder.uri.fsPath, uri.fsPath);
                    }
                    await vscode.commands.executeCommand('workbench.action.chat.open', {
                        query: `@review-file ${filePath}`
                    });
                } else {
                    await vscode.commands.executeCommand('workbench.action.chat.open', {
                        query: '@review-file'
                    });
                }
            }
        } catch (error) {
            console.error('Error in reviewFile command:', error);
            vscode.window.showErrorMessage(`Failed to review file: ${error.message}`);
        }
    });

    let analyzeFileDependencyCommand = vscode.commands.registerCommand('aida.analyzeDependency', async (uri) => {
        console.log('🎯 Analyze File Dependency command called', uri);
        
        // Track usage
        trackEvent(TrackingEvent.ANALYZE_DEPENDENCY, {
            fileType: uri?.fsPath ? path.extname(uri.fsPath) : 'unknown'
        });

        try {
            // If uri is undefined (called from command palette), try to get active editor
            if (!uri && vscode.window.activeTextEditor) {
                uri = vscode.window.activeTextEditor.document.uri;
            }

            if (uri) {
                await analyzeFileDependency(uri);
            } else {
                vscode.window.showErrorMessage('Please open a file to analyze dependencies.');
            }
        } catch (error) {
            console.error('Error in analyzeFileDependency command:', error);
            vscode.window.showErrorMessage(`Failed to analyze file dependency: ${error.message}`);
        }
    });
    context.subscriptions.push(analyzeFileDependencyCommand);

    let reviewChangesCommand = vscode.commands.registerCommand('aida.reviewChanges', async (uri) => {
        console.log('🎯 Review Changes command called', uri);
        
        // Check AI provider
        const config = vscode.workspace.getConfiguration('aida');
        const useAIDAChatbot = config.get('useAIDAChatbot', false);
        const aiProvider = useAIDAChatbot ? AiProvider.AIDA_CHATBOT : AiProvider.GITHUB_COPILOT;
        
        // Track usage with AI provider info
        trackEvent(TrackingEvent.REVIEW_CHANGES, {
            fileType: uri?.fsPath ? path.extname(uri.fsPath) : 'unknown',
            source: TrackingSource.CONTEXT_MENU,
            aiProvider: aiProvider
        });

        try {
            // Check if AIDA chat should be used
            console.log('🔍 useAIDAChatbot flag:', useAIDAChatbot);
            console.log('🔍 GitHub Copilot extension active:', vscode.extensions.getExtension('GitHub.copilot')?.isActive);

            if (useAIDAChatbot) {
                console.log('➡️ Using AIDA chatbot (useAIDAChatbot=true)');
                // Use AIDA Copilot-style chat
                await vscode.commands.executeCommand('aida.reviewChangesContext', uri);
            } else {
                console.log('➡️ Using GitHub Copilot (useAIDAChatbot=false)');
                // Use GitHub Copilot
                await vscode.commands.executeCommand('workbench.panel.chat.view.copilot.focus');
                if (uri && uri.fsPath) {
                    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
                    let filePath = uri.fsPath;
                    if (workspaceFolder) {
                        filePath = path.relative(workspaceFolder.uri.fsPath, uri.fsPath);
                    }
                    await vscode.commands.executeCommand('workbench.action.chat.open', {
                        query: `@review-changes ${filePath}`
                    });
                } else {
                    await vscode.commands.executeCommand('workbench.action.chat.open', {
                        query: '@review-changes'
                    });
                }
            }
        } catch (error) {
            console.error('Error in reviewChanges command:', error);
            vscode.window.showErrorMessage(`Failed to review changes: ${error.message}`);
        }
    });

    let reviewAllChangesCommand = vscode.commands.registerCommand('aida.reviewAllChanges', async (uri) => {
        console.log('🎯 Review All Changes command called', uri);
        
        // Check AI provider
        const config = vscode.workspace.getConfiguration('aida');
        const useAIDAChatbot = config.get('useAIDAChatbot', false);
        const aiProvider = useAIDAChatbot ? AiProvider.AIDA_CHATBOT : AiProvider.GITHUB_COPILOT;
        
        // Track usage with AI provider info
        trackEvent(TrackingEvent.REVIEW_ALL_CHANGES, {
            aiProvider: aiProvider
        });

        try {
            // Check if AIDA chat should be used
            if (useAIDAChatbot) {
                // Use AIDA Copilot-style chat
                await vscode.commands.executeCommand('aida.reviewAllChangesContext', uri);
            } else {
                // Use GitHub Copilot
                await vscode.commands.executeCommand('workbench.panel.chat.view.copilot.focus');
                await vscode.commands.executeCommand('workbench.action.chat.open', {
                    query: '@review-all-changes'
                });
            }
        } catch (error) {
            console.error('Error in reviewAllChanges command:', error);
            vscode.window.showErrorMessage(`Failed to review all changes: ${error.message}`);
        }
    });

    // Register AIDA-specific context commands for Copilot-style chat
    let reviewFileContextCommand = vscode.commands.registerCommand('aida.reviewFileContext', async (uri) => {
        console.log('🎯 AIDA Review File Context command called', uri);
        try {
            if (!copilotSidebarChat) {
                vscode.window.showErrorMessage('AIDA Sidebar Chat is not initialized');
                return;
            }

            // Show the sidebar
            copilotSidebarChat.show();

            // Send review file message
            if (uri && uri.fsPath) {
                const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
                let filePath = uri.fsPath;
                if (workspaceFolder) {
                    filePath = path.relative(workspaceFolder.uri.fsPath, uri.fsPath);
                }
                await copilotSidebarChat.sendMessage('@review-file ' + filePath);
            } else {
                await copilotSidebarChat.sendMessage('@review-file');
            }
        } catch (error) {
            console.error('Error in reviewFileContext command:', error);
            vscode.window.showErrorMessage('Failed to review file: ' + error.message);
        }
    });

    let reviewChangesContextCommand = vscode.commands.registerCommand('aida.reviewChangesContext', async (uri) => {
        console.log('🎯 AIDA Review Changes Context command called', uri);
        try {
            if (!copilotSidebarChat) {
                vscode.window.showErrorMessage('AIDA Sidebar Chat is not initialized');
                return;
            }

            // Show the sidebar
            copilotSidebarChat.show();

            // Send review changes message
            if (uri && uri.fsPath) {
                const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
                let filePath = uri.fsPath;
                if (workspaceFolder) {
                    filePath = path.relative(workspaceFolder.uri.fsPath, uri.fsPath);
                }
                await copilotSidebarChat.sendMessage('@review-changes ' + filePath);
            } else {
                await copilotSidebarChat.sendMessage('@review-changes');
            }
        } catch (error) {
            console.error('Error in reviewChangesContext command:', error);
            vscode.window.showErrorMessage('Failed to review changes: ' + error.message);
        }
    });

    let reviewAllChangesContextCommand = vscode.commands.registerCommand('aida.reviewAllChangesContext', async (uri) => {
        console.log('🎯 AIDA Review All Changes Context command called', uri);
        try {
            if (!copilotSidebarChat) {
                vscode.window.showErrorMessage('AIDA Sidebar Chat is not initialized');
                return;
            }

            // Show the sidebar
            copilotSidebarChat.show();

            // Send review all changes message
            await copilotSidebarChat.sendMessage('@review-all-changes');
        } catch (error) {
            console.error('Error in reviewAllChangesContext command:', error);
            vscode.window.showErrorMessage('Failed to review all changes: ' + error.message);
        }
    });

    console.log('🔄 About to initialize review modules...');

    // Always register chat participants for both AIDA and GitHub Copilot compatibility
    const config = vscode.workspace.getConfiguration('aida');
    const useAIDAChatbot = config.get('useAIDAChatbot', false);
    const shouldRegisterParticipants = true; // Always register for GitHub Copilot compatibility

    console.log('🔍 Always register AIDA chat participants for GitHub Copilot compatibility');
    console.log('🔍 useAIDAChatbot flag:', useAIDAChatbot);
    console.log('🔍 GitHub Copilot active:', vscode.extensions.getExtension('GitHub.copilot')?.isActive);

    let reviewChangesParticipant, reviewFileParticipant, reviewAllChangesParticipant, dependencyParticipant, dependencyPrParticipant;

    if (shouldRegisterParticipants) {
        // Always initialize review modules for both AIDA and GitHub Copilot compatibility
        const reviewChanges = require('./scripts/review/review-changes');
        reviewChangesParticipant = reviewChanges.initializeReviewChanges(context).reviewChangesParticipant;

        const reviewFile = require('./scripts/review/review-file');
        reviewFileParticipant = reviewFile.initializeReviewFile(context).reviewFileParticipant;

        const reviewAllChanges = require('./scripts/review/review-all-changes');
        reviewAllChangesParticipant = reviewAllChanges.initializeReviewAllChanges(context).reviewAllChangesParticipant;

        // Initialize dependency graph analysis
        try {
            const dependency = require('./scripts/dependency/dependency');
            const dependencyResult = dependency.initializeDependencyGraph(context);
            dependencyParticipant = dependencyResult.dependencyParticipant;
            dependencyPrParticipant = dependencyResult.dependencyPrParticipant;

            // Register cache commands if available
            if (dependencyResult && typeof dependencyResult.registerCacheCommands === 'function') {
                dependencyResult.registerCacheCommands(context);
                console.log('✅ Dependency cache commands registered');
            } else {
                console.log('⚠️ Cache commands not available, using basic dependency analysis');
            }

            console.log('✅ Dependency graph analysis participant registered');
            console.log('✅ Dependency PR analysis participant registered');
        } catch (error) {
            console.error('❌ Failed to initialize dependency graph analysis:', error.message);
            console.log('⚠️ Continuing without dependency analysis...');
        }

        console.log('✅ Chat participants registered for both AIDA and GitHub Copilot compatibility');
    } else {
        console.log('⚠️ Chat participants NOT registered (this should never happen)');
    }

    console.log('🔄 About to initialize PR review...');
    // Initialize PR review functionality from external script
    let reviewPrParticipant, reviewPullRequest;
    try {
        const prReview = require('./scripts/review/review-pr');
        const result = prReview.initializePrReview(context);
        reviewPrParticipant = result.reviewPrParticipant;
        reviewPullRequest = result.reviewPullRequest;
        console.log('✅ PR review initialized successfully');
    } catch (error) {
        console.error('❌ Error initializing PR review:', error);
        reviewPrParticipant = null;
        reviewPullRequest = null;
    }

    // Register command to view PR diff in webview FIRST
    const viewPrDiffCommand = vscode.commands.registerCommand('aida.viewPrDiff', async (diffId) => {
        try {
            console.log(`📄 Opening diff webview for: ${diffId}`);

            // Get diff data from global cache
            const diffData = global.prDiffCache?.[diffId];
            if (!diffData) {
                vscode.window.showErrorMessage('Diff data not found. Please refresh the PR review.');
                return;
            }

            // Create webview panel
            const panel = vscode.window.createWebviewPanel(
                'prDiffView',
                `Diff: ${path.basename(diffData.path)}`,
                vscode.ViewColumn.One,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true,
                    localResourceRoots: [
                        vscode.Uri.file(path.join(context.extensionPath, 'node_modules', 'monaco-editor'))
                    ]
                }
            );

            // Add message handler for file switching
            panel.webview.onDidReceiveMessage(async (message) => {
                console.log('� Received message from webview:', message);

                if (message.type === 'openFileInMonaco') {
                    try {
                        const filePath = message.filePath;
                        console.log('�🔄 Loading new file for Monaco:', filePath);

                        // Find file in cache using the same PR context as current diffData
                        const cache = global.prDiffCache;
                        let newDiffData = null;

                        if (cache) {
                            // Determine PR prefix based on current diffData's provider
                            const { provider, prId } = diffData;
                            let prPrefix;

                            if (provider === 'github') {
                                prPrefix = `github_${prId}_`;
                            } else if (provider === 'gitlab') {
                                prPrefix = `gitlab_${prId}_`;
                            } else {
                                // Azure DevOps
                                prPrefix = `azure_${prId}_`;
                            }

                            console.log(`🔄 Looking for file in ${provider} PR ${prId} with prefix: ${prPrefix}`);

                            const cacheKeys = Object.keys(cache);
                            for (const key of cacheKeys) {
                                if (key.startsWith(prPrefix) && cache[key].path === filePath) {
                                    newDiffData = cache[key];
                                    break;
                                }
                            }
                        }

                        if (newDiffData) {
                            // Update panel title and content
                            panel.title = `Diff: ${path.basename(filePath)}`;
                            panel.webview.html = await getMonacoWebviewContent(newDiffData, panel, context);
                            console.log('✅ Successfully loaded new file:', filePath);
                        } else {
                            console.error('❌ File not found in cache:', filePath);
                            vscode.window.showErrorMessage(`File not found: ${filePath}`);
                        }

                    } catch (error) {
                        console.error('❌ Error loading file:', error);
                        vscode.window.showErrorMessage(`Failed to load file: ${error.message}`);
                    }
                }
            });

            // Set webview content
            panel.webview.html = await getMonacoWebviewContent(diffData, panel, context);

        } catch (error) {
            console.error('Error opening diff webview:', error);
            vscode.window.showErrorMessage(`Failed to open diff: ${error.message}`);
        }
    });

    console.log('🔄 About to initialize sync review templates...');
    // Initialize sync review templates functionality
    console.log('🚀 Initializing Sync Review Templates participant...');
    const syncTemplates = require('./scripts/review/sync-review-templates');
    console.log(' --- IGNORE --- ');
    const { syncTemplatesParticipant } = syncTemplates.initializeSyncTemplates(context);
    console.log('✅ Sync Review Templates participant initialized.');

    // Command already registered above

    // Register command to show available models
    const showModelsCommand = vscode.commands.registerCommand('aida.showAvailableModels', showAvailableModels);

    // Enhanced Review Commands (Unified)
    const showEnhancedReviewOptionsCommand = vscode.commands.registerCommand('aida.showEnhancedReviewOptions', async (filePath, chatCommand = 'review-changes') => {
        try {
            console.log(`📚 Showing enhanced review options for: ${filePath}, command: ${chatCommand}`);

            // Show QuickPick first to select business documents
            await showEnhancedReviewOptionsInChat(filePath, chatCommand);

        } catch (error) {
            console.error('❌ Error showing enhanced review options:', error);
            vscode.window.showErrorMessage(`Failed to show enhanced options: ${error.message}`);
        }
    });

    // Unified helper function to show enhanced options in chat
    async function showEnhancedReviewOptionsInChat(filePath, chatCommand = 'review-changes') {
        console.log(`🔍 DEBUG: showEnhancedReviewOptionsInChat called with filePath = ${filePath}, chatCommand = ${chatCommand}`);
        console.log(`🔍 DEBUG: typeof filePath = ${typeof filePath}, filePath exists = ${filePath ? 'yes' : 'no'}`);

        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

        if (!workspaceFolder) {
            vscode.window.showErrorMessage('❌ No workspace found for business documents');
            return;
        }

        // Get business document folders
        const businessDocs = await getBusinessDocumentFolders(workspaceFolder);

        if (businessDocs.length === 0) {
            vscode.window.showInformationMessage('⚠️ No business-docs folders found for enhanced review.');
            return; // Exit without showing any UI
        }

        // Generate description for each folder using the enhanced getFiles method
        function generateDescription(folder) {
            try {
                const files = folder.getFiles();
                if (files.length === 0) {
                    return `: 📋 (no documents)`;
                }

                // Extract titles from first few files for preview
                const previewFiles = files.slice(0, 3);
                const titles = previewFiles.map(file => {
                    const fileName = file.name.replace('.md', '').replace(/-/g, ' ');
                    return fileName.charAt(0).toUpperCase() + fileName.slice(1);
                });

                const titlesList = titles.join(', ');
                const moreText = files.length > 3 ? ` (+${files.length - 3} more)` : '';
                return `: 📋 ${titlesList}${moreText}`;
            } catch (error) {
                console.log(`❌ Error generating description for ${folder.name}:`, error.message);
                return `📋 ${folder.displayName}`;
            }
        }

        // Customize UI based on chat command
        const reviewDisplayName = chatCommand === 'review-file' ? 'file review' : 'review';
        const titleText = chatCommand === 'review-file' ? '📚 Enhanced File Review Options' : '📚 Enhanced Review Options';

        // Show selection UI via quick pick
        const items = [
            ...businessDocs.map(folder => ({
                label: `📁 ${folder.displayName}`,
                description: generateDescription(folder),
                detail: `Include ${folder.displayName} documentation in ${reviewDisplayName}`,
                categoryName: folder.name,
                categoryDisplayName: folder.displayName
            }))
        ];

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: `📚 Select business docs for enhanced review, or select none for quick review of ${path.basename(filePath)}`,
            title: titleText,
            canPickMany: true,
            ignoreFocusOut: false
        });

        if (!selected) {
            return; // User cancelled (pressed Escape)
        }

        // Allow empty selection - means Quick Review without business docs
        let selectedCategories = [];
        if (selected.length > 0) {
            // User selected some business docs - Enhanced Review
            selectedCategories = selected.map(item => ({
                name: item.categoryName,
                displayName: item.categoryDisplayName,
                path: businessDocs.find(folder => folder.name === item.categoryName)?.path,
                relativePath: businessDocs.find(folder => folder.name === item.categoryName)?.relativePath
            }));
            console.log(`✅ Selected business document categories for enhanced ${reviewDisplayName}:`, selectedCategories);
        } else {
            // User selected nothing - Quick Review mode
            console.log(`🚀 No business documents selected - Quick ${reviewDisplayName} mode`);
        }

        // Store selected categories (empty array = Quick Review, populated array = Enhanced Review)
        global.selectedBusinessDocs = selectedCategories;
        console.log(`🎯 Set global.selectedBusinessDocs for ${selectedCategories.length > 0 ? 'Enhanced' : 'Quick'} ${chatCommand} Review:`, selectedCategories);

        // Check if user is currently in AIDA Sidebar Chat or Copilot Chat
        const aidaSidebarActive = copilotSidebarChat?.webviewView?.visible;
        console.log('📱 AIDA Sidebar active:', aidaSidebarActive);

        // Start enhanced review with original filePath using chat command
        console.log('🔍 DEBUG: About to submit chat with filePath =', filePath);
        console.log('🔍 DEBUG: typeof filePath =', typeof filePath, 'length =', filePath?.length);

        const chatText = `@${chatCommand} ${filePath}`;
        console.log(`🔍 DEBUG: ${chatCommand} chat text =`, chatText);
        console.log(`🔍 DEBUG: Final chatText length =`, chatText.length);

        if (aidaSidebarActive && copilotSidebarChat) {
            // User is in AIDA chatbot - send message directly to AIDA
            console.log('🤖 Redirecting Enhanced Review to AIDA Chatbot');
            copilotSidebarChat.show();
            await copilotSidebarChat.sendMessage(chatText);
        } else {
            // Keep the review in GitHub Copilot Chat (original behavior)
            console.log('💬 Redirecting Enhanced Review to GitHub Copilot Chat');
            await vscode.commands.executeCommand('workbench.panel.chat.view.copilot.focus');
            await vscode.commands.executeCommand('workbench.action.chat.open', {
                query: chatText
            });
        }
    }

    // Copilot-Style Chat Panel already initialized above

    // Add all subscriptions, filtering out null values
    const subscriptions = [
        openAidaChat,
        clearChatSidebarCommand,
        openSettingsSidebarCommand,
        closeChatSidebarCommand,
        setupAzureDevOps,
        confirmReviewDocs,
        showChangesHelp,
        showFileHelp,
        reviewFileCommand,
        reviewChangesCommand,
        reviewAllChangesCommand,
        reviewFileContextCommand,
        reviewChangesContextCommand,
        reviewAllChangesContextCommand,
        reviewPrParticipant,
        reviewPullRequest,
        syncTemplatesParticipant,
        showModelsCommand,
        showEnhancedReviewOptionsCommand,
        viewPrDiffCommand,
        copilotSidebarChat
    ].filter(item => item !== null && item !== undefined);

    // Add conditional participants only if registered (should always be true now)
    if (shouldRegisterParticipants) {
        subscriptions.push(reviewChangesParticipant, reviewFileParticipant, reviewAllChangesParticipant);
        console.log('✅ Chat participants added to subscriptions for full compatibility');
    }

    context.subscriptions.push(...subscriptions);
}









function deactivate() { }

module.exports = {
    activate,
    deactivate,
    // Re-exported from core modules (kept for backward compat)
    handleEnterTwiceLogic,
    ensureAidaTemplatesForReview,
    handleSyncTemplates,
    createAidaTemplateStructure,
    syncNewLanguageTemplates,
    chatSessions
};
