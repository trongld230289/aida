const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const https = require('https');
const { URL } = require('url');

// Import all required functions including showAvailableModels
const {
    executeAIReview,
    getReviewTemplate,
    displayReviewHeader,
    getUnifiedModel,
    getChecklistStatusIcon,
    showAvailableModels,
    getBusinessDocumentFolders
} = require('./scripts/review-common');


// Session tracking for "Enter twice" functionality and change scores
const chatSessions = new Map();

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
 * Handle "Enter twice" functionality for chat participants
 * @param {string} participantType - 'review-file' or 'review-changes'
 * @param {object} activeEditor - VS Code active editor
 * @param {object} stream - Chat stream
 * @param {function} autoReviewCallback - Function to call on second enter
 * @returns {boolean} - true if handled (first enter), false if should proceed with auto review
 */
async function handleEnterTwiceLogic(participantType, activeEditor, stream, autoReviewCallback) {
    const fileName = path.basename(activeEditor.document.fileName);
    const sessionKey = `${participantType}-${activeEditor.document.fileName}`;
    const hasSeenQuestion = chatSessions.get(sessionKey) || false;

    console.log(`🔍 Session check: ${sessionKey} = ${hasSeenQuestion}`);

    if (hasSeenQuestion) {
        // Second Enter - Auto proceed like clicking "Yes"
        const emoji = participantType === 'review-file' ? '📁' : '🔍';
        const action = participantType === 'review-file' ? 'File' : 'Changes';

        stream.markdown(`# ${emoji} Reviewing ${action}: \`${fileName}\`\n\n`);
        stream.markdown(`📂 **Auto-proceeding with:** \`${activeEditor.document.fileName}\`\n\n`);
        stream.markdown(`🚀 **Starting ${action.toLowerCase()} review...**\n\n`);

        // Clear the session flag
        chatSessions.delete(sessionKey);

        // Call the auto review function
        await autoReviewCallback();
        return true; // Handled, don't continue
    }

    // First time - Show question and set session flag
    chatSessions.set(sessionKey, true);
    console.log(`🔍 Session set: ${sessionKey} = true`);

    const emoji = participantType === 'review-file' ? '📁' : '🔍';
    const title = participantType === 'review-file' ? 'File Review Assistant' : 'Code Review Assistant';
    const confirmCommand = participantType === 'review-file' ? 'aida.confirmFileReview' : 'aida.confirmChangesReview';
    const helpCommand = participantType === 'review-file' ? 'aida.showFileHelp' : 'aida.showChangesHelp';
    const buttonText = participantType === 'review-file' ? `✅ Yes, review file ${fileName}` : `✅ Yes, review changes in ${fileName}`;
    const questionText = participantType === 'review-file' ?
        `**Question:** Do you want to review the file \`${fileName}\`?\n\n` :
        `**Question:** Do you want to review git changes for \`${fileName}\`?\n\n`;

    stream.markdown(`# ${emoji} ${title}\n\n`);
    stream.markdown(`**Current file:** \`${fileName}\`\n\n`);

    // Create Yes/No buttons for confirmation
    stream.button({
        command: confirmCommand,
        title: buttonText,
        arguments: [activeEditor.document.fileName]
    });

    stream.markdown('\n');

    stream.button({
        command: helpCommand,
        title: '❌ No, show help instead',
        arguments: []
    });

    stream.markdown('\n\n');
    stream.markdown(questionText);
    stream.markdown('💡 **Tip:** Press Enter again to auto-proceed\n');

    return false; // Don't continue, show question first
}

/**
 * Setup Azure DevOps settings automatically
 */
async function setupAzureDevOpsSettings() {
    try {
        // Open User Settings JSON
        await vscode.commands.executeCommand('workbench.action.openSettingsJson');

        // Show info message with instructions
        const settingsTemplate = `{
    "aida.azureDevOps.personalAccessToken": "YOUR_TOKEN_HERE",
    "aida.azureDevOps.organization": "YOUR_ORG_HERE",
    "aida.azureDevOps.defaultProject": "YOUR_PROJECT_HERE"
}`;

        const action = await vscode.window.showInformationMessage(
            'Settings JSON opened. Copy và paste template below vào cuối file (trước dấu }).',
            'Copy Template',
            'Open Azure DevOps'
        );

        if (action === 'Copy Template') {
            await vscode.env.clipboard.writeText(settingsTemplate);
            vscode.window.showInformationMessage('Template đã copy vào clipboard!');
        } else if (action === 'Open Azure DevOps') {
            await vscode.env.openExternal(vscode.Uri.parse('https://dev.azure.com/BusinessWebUS/_usersSettings/tokens'));
        }

    } catch (error) {
        vscode.window.showErrorMessage(`Error opening settings: ${error.message}`);
    }
}

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    // console.log('Reload 4');
    console.log('🤖 AIDA v1.0.15 - AI Development Assistant');
    console.log('🚀 AIDA extension is now active!');
    
    // Store extension path globally
    global.extensionPath = context.extensionPath;
    
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

    let closeChatSidebarCommand = vscode.commands.registerCommand('aida.closeChatSidebar', async () => {
        vscode.commands.executeCommand('workbench.action.closeSidebar');
    });

    // Register Azure DevOps setup command
    let setupAzureDevOps = vscode.commands.registerCommand('aida.setupAzureDevOps', async () => {
        await setupAzureDevOpsSettings();
    });

    let confirmChangesReview = vscode.commands.registerCommand('aida.confirmChangesReview', async (filePath) => {
        // Set the session flag to indicate the user confirmed (simulate second enter)
        const sessionKey = `review-changes-${filePath}`;
        chatSessions.set(sessionKey, true);
        console.log(`🔍 Confirmation button clicked - Session set: ${sessionKey} = true`);

        // Keep the review in GitHub Copilot Chat (original behavior)
        await vscode.commands.executeCommand('workbench.panel.chat.view.copilot.focus');
        await vscode.commands.executeCommand('workbench.action.chat.open', {
            query: `@review-changes ${filePath}`
        });
    });

    let confirmFileReview = vscode.commands.registerCommand('aida.confirmFileReview', async (filePath) => {
        // Set the session flag to indicate the user confirmed (simulate second enter)
        const sessionKey = `review-file-${filePath}`;
        chatSessions.set(sessionKey, true);
        console.log(`📁 Confirmation button clicked - Session set: ${sessionKey} = true`);

        // Keep the review in GitHub Copilot Chat (original behavior)
        await vscode.commands.executeCommand('workbench.panel.chat.view.copilot.focus');
        await vscode.commands.executeCommand('workbench.action.chat.open', {
            query: `@review-file ${filePath}`
        });
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
        try {
            // Check if AIDA chat should be used
            const config = vscode.workspace.getConfiguration('aida');
            const hasNoGithubCopilot = config.get('hasNoGithubCopilot', false);
            
            if (hasNoGithubCopilot || !vscode.extensions.getExtension('GitHub.copilot')?.isActive) {
                // Use AIDA Copilot-style chat
                await vscode.commands.executeCommand('aida.reviewFileContext', uri);
            } else {
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

    let reviewChangesCommand = vscode.commands.registerCommand('aida.reviewChanges', async (uri) => {
        console.log('🎯 Review Changes command called', uri);
        try {
            // Check if AIDA chat should be used
            const config = vscode.workspace.getConfiguration('aida');
            const hasNoGithubCopilot = config.get('hasNoGithubCopilot', false);
            
            if (hasNoGithubCopilot || !vscode.extensions.getExtension('GitHub.copilot')?.isActive) {
                // Use AIDA Copilot-style chat
                await vscode.commands.executeCommand('aida.reviewChangesContext', uri);
            } else {
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
        try {
            // Check if AIDA chat should be used
            const config = vscode.workspace.getConfiguration('aida');
            const hasNoGithubCopilot = config.get('hasNoGithubCopilot', false);
            
            if (hasNoGithubCopilot || !vscode.extensions.getExtension('GitHub.copilot')?.isActive) {
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
    
    // Initialize review modules from external scripts
    const reviewChanges = require('./scripts/review-changes');
    const { reviewChangesParticipant } = reviewChanges.initializeReviewChanges(context);

    const reviewFile = require('./scripts/review-file');
    const { reviewFileParticipant } = reviewFile.initializeReviewFile(context);

    const reviewAllChanges = require('./scripts/review-all-changes');
    const { reviewAllChangesParticipant } = reviewAllChanges.initializeReviewAllChanges(context);

    console.log('🔄 About to initialize PR review...');
    // Initialize PR review functionality from external script
    let reviewPrParticipant, reviewPullRequest;
    try {
        const prReview = require('./scripts/review-pr');
        const result = prReview.initializePrReview(context);
        reviewPrParticipant = result.reviewPrParticipant;
        reviewPullRequest = result.reviewPullRequest;
        console.log('✅ PR review initialized successfully');
    } catch (error) {
        console.error('❌ Error initializing PR review:', error);
        reviewPrParticipant = null;
        reviewPullRequest = null;
    }

    // Initialize scan-app functionality from external script
    let scanAppParticipant;
    try {
        const scanApp = require('./scripts/scan-app');
        const result = scanApp.initializeScanApp(context);
        scanAppParticipant = result.scanAppParticipant;
        console.log('✅ Scan-app participant initialized successfully');
    } catch (error) {
        console.error('❌ Failed to initialize scan-app participant:', error);
        // Create a dummy participant to prevent errors
        scanAppParticipant = null;
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
    const syncTemplates = require('./scripts/sync-review-templates');
    console.log(' --- IGNORE --- ');
    const { syncTemplatesParticipant } = syncTemplates.initializeSyncTemplates(context);
    console.log('✅ Sync Review Templates participant initialized.');

    // Command already registered above

    // Register command to show available models
    const showModelsCommand = vscode.commands.registerCommand('aida.showAvailableModels', showAvailableModels);

    // Register command to show daily report in webview
    const showDailyReportCommand = vscode.commands.registerCommand('aida.showDailyReport', async (reportPath, htmlContent) => {
        try {
            console.log('📊 Opening daily report webview...');
            
            // Import the daily report module and create webview
            const dailyReport = require('./scripts/daily-report');
            dailyReport.createDailyReportWebview(reportPath, htmlContent);
            
        } catch (error) {
            console.error('❌ Error opening daily report webview:', error);
            vscode.window.showErrorMessage(`Failed to open daily report: ${error.message}`);
        }
    });

    // Register command to show daily report template
    const showDailyReportTemplateCommand = vscode.commands.registerCommand('aida.showDailyReportTemplate', async () => {
        try {
            console.log('📋 Showing daily report template...');
            
            const panel = vscode.window.createWebviewPanel(
                'dailyReportTemplate',
                '📋 Daily Report Template',
                vscode.ViewColumn.One,
                { enableScripts: false }
            );

            panel.webview.html = `
                <h1>📊 Daily Report Template</h1>
                <p>Use <code>@daily-report</code> in chat to generate your daily project report.</p>
                <h2>Features:</h2>
                <ul>
                    <li>📈 Sprint progress overview</li>
                    <li>✅ Completed tasks tracking</li>
                    <li>🔄 In-progress items</li>
                    <li>⏳ Pending tasks</li>
                    <li>🌟 Daily highlights</li>
                    <li>📝 Technical notes</li>
                </ul>
            `;
            
        } catch (error) {
            console.error('❌ Error showing daily report template:', error);
            vscode.window.showErrorMessage(`Failed to show template: ${error.message}`);
        }
    });

    // Enhanced Review Commands
    const showEnhancedReviewOptionsCommand = vscode.commands.registerCommand('aida.showEnhancedReviewOptions', async (filePath) => {
        try {
            console.log(`📚 Showing enhanced review options for: ${filePath}`);
            
            // Focus chat panel first
            await vscode.commands.executeCommand('workbench.panel.chat.view.copilot.focus');
            
            // Create a mock stream for enhanced review options
            const mockStream = {
                markdown: (text) => {
                    // We'll use a webview or notification approach instead
                    console.log('📚 Enhanced Stream:', text);
                },
                button: (cmd) => {
                    console.log('🔘 Enhanced Button:', cmd);
                }
            };
            
            // Show enhanced options directly via commands/UI
            await showEnhancedReviewOptionsInChat(filePath);
            
        } catch (error) {
            console.error('❌ Error showing enhanced options:', error);
            vscode.window.showErrorMessage(`Failed to show enhanced options: ${error.message}`);
        }
    });

    // Helper function to show enhanced options in chat
    async function showEnhancedReviewOptionsInChat(filePath) {
        // Import required functions - getBusinessDocumentFolders now available from import
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
        
        // Show selection UI via quick pick
         const items = [
            ...businessDocs.map(folder => ({
                label: `📁 ${folder.displayName}`,
                description: generateDescription(folder),
                detail: `Include ${folder.displayName} documentation in review`,
                categoryName: folder.name,
                categoryDisplayName: folder.displayName
            }))
        ];
        
        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: `Select business documentation for enhanced review of ${path.basename(filePath)}`,
            title: '📚 Enhanced Review Options',
            canPickMany: true,
            ignoreFocusOut: false
        });
        
        if (!selected || selected.length === 0) {
            return; // User cancelled or no selection
        }
        
        // Store selected categories with paths in global state
        const selectedCategories = selected.map(item => ({
            name: item.categoryName,
            displayName: item.categoryDisplayName,
            path: businessDocs.find(folder => folder.name === item.categoryName)?.path,
            relativePath: businessDocs.find(folder => folder.name === item.categoryName)?.relativePath
        }));
        global.selectedBusinessDocs = selectedCategories;

        console.log('✅ Selected business document categories for enhanced review:', selectedCategories);

        // Start enhanced review
        await vscode.commands.executeCommand('workbench.action.chat.open', {
            query: `@review-changes ${filePath}`
        });
    }

    // Copilot-Style Chat Panel already initialized above

    // Add all subscriptions, filtering out null values
    const subscriptions = [
        openAidaChat,
        clearChatSidebarCommand,
        openSettingsSidebarCommand,
        closeChatSidebarCommand,
        setupAzureDevOps,
        confirmChangesReview,
        confirmFileReview,
        showChangesHelp,
        showFileHelp,
        reviewFileCommand,
        reviewChangesCommand,
        reviewAllChangesCommand,
        reviewFileContextCommand,
        reviewChangesContextCommand,
        reviewAllChangesContextCommand,
        reviewChangesParticipant,
        reviewFileParticipant,
        reviewAllChangesParticipant,
        reviewPrParticipant,
        reviewPullRequest,
        syncTemplatesParticipant,
        showModelsCommand,
        showDailyReportCommand,
        showDailyReportTemplateCommand,
        toggleBusinessDocCommand,
        selectAllBusinessDocsCommand,
        clearAllBusinessDocsCommand,
        proceedWithBusinessDocsCommand,
        showEnhancedReviewOptionsCommand,
        viewPrDiffCommand,
        copilotSidebarChat
    ].filter(item => item !== null && item !== undefined);

    context.subscriptions.push(...subscriptions);
}

/**
 * Ensure AIDA templates exist for review commands
 * For @review-* commands: Create AIDA folder if not exists, do nothing if exists
 * @param {vscode.ExtensionContext} context
 */
async function ensureAidaTemplatesForReview(context) {
    try {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            console.log('No workspace folder found, skipping template generation');
            return;
        }

        const workspaceAidaPath = path.join(workspaceFolder.uri.fsPath, 'AIDA');
        
        // Check if AIDA folder exists
        if (!fs.existsSync(workspaceAidaPath)) {
            console.log('🆕 AIDA folder not found - creating complete template structure...');
            const extensionTemplatesPath = path.join(context.extensionPath, 'templates');
            await createAidaTemplateStructure(extensionTemplatesPath, path.join(workspaceAidaPath, 'templates'));
            console.log('✅ AIDA templates created for review commands');
        } else {
            console.log('✅ AIDA folder exists - no action needed for review commands');
        }
        
    } catch (error) {
        console.error('Error ensuring AIDA templates for review:', error);
    }
}

/**
 * Handle template sync for @sync command
 * If AIDA exists: sync new language templates only
 * If AIDA doesn't exist: create complete AIDA structure
 * @param {vscode.ExtensionContext} context
 */
async function handleSyncTemplates(context) {
    try {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            console.log('No workspace folder found, skipping sync');
            return;
        }

        const extensionTemplatesPath = path.join(context.extensionPath, 'templates');
        const workspaceAidaPath = path.join(workspaceFolder.uri.fsPath, 'AIDA', 'templates');
        
        if (!fs.existsSync(workspaceAidaPath)) {
            console.log('🆕 AIDA not found - creating complete template structure via sync...');
            await createAidaTemplateStructure(extensionTemplatesPath, workspaceAidaPath);
        } else {
            console.log('🔄 AIDA exists - syncing new language templates...');
            await syncNewLanguageTemplates(extensionTemplatesPath, workspaceAidaPath);
        }
        
    } catch (error) {
        console.error('Error handling sync templates:', error);
    }
}

/**
 * Lazy-load AIDA template structure when needed
 * Creates comprehensive template system for all languages and frameworks  
 * Only called when @review commands are first used
 * @param {vscode.ExtensionContext} context
 */
async function ensureTemplatesExistLazy(context) {
    // This function is deprecated - use ensureAidaTemplatesForReview or handleSyncTemplates instead
    console.warn('⚠️  ensureTemplatesExistLazy is deprecated');
    await ensureAidaTemplatesForReview(context);
}

/**
 * Creates complete AIDA template structure in workspace
 * @param {string} sourceTemplatePath - Extension template path
 * @param {string} targetAidaPath - Target AIDA path in workspace
 */
async function createAidaTemplateStructure(sourceTemplatePath, targetAidaPath) {
    const fs = require('fs').promises;
    
    try {
        // Create AIDA directory structure
        await fs.mkdir(targetAidaPath, { recursive: true });
        
        // Copy all language templates
        const reviewCodePath = path.join(sourceTemplatePath, 'review-code');
        const targetReviewCodePath = path.join(targetAidaPath, 'review-code');
        
        if (require('fs').existsSync(reviewCodePath)) {
            await copyDirectory(reviewCodePath, targetReviewCodePath);
            console.log('✅ AIDA templates created with all available languages');
        }
    } catch (error) {
        console.error('Error creating AIDA structure:', error);
    }
}

/**
 * Syncs new language templates from extension to workspace AIDA
 * @param {string} sourceTemplatePath - Extension template path  
 * @param {string} targetAidaPath - Target AIDA path in workspace
 */
async function syncNewLanguageTemplates(sourceTemplatePath, targetAidaPath) {
    const fs = require('fs').promises;
    
    try {
        const sourceLanguagesPath = path.join(sourceTemplatePath, 'review-code', 'languages');
        const targetLanguagesPath = path.join(targetAidaPath, 'review-code', 'languages');
        
        if (require('fs').existsSync(sourceLanguagesPath)) {
            const sourceLanguages = await fs.readdir(sourceLanguagesPath);
            const targetLanguages = require('fs').existsSync(targetLanguagesPath) 
                ? await fs.readdir(targetLanguagesPath) 
                : [];
            
            // Find new languages to sync
            const newLanguages = sourceLanguages.filter(lang => !targetLanguages.includes(lang));
            
            if (newLanguages.length > 0) {
                console.log(`🔄 Syncing ${newLanguages.length} new language(s): ${newLanguages.join(', ')}`);
                
                for (const newLang of newLanguages) {
                    const sourceLangPath = path.join(sourceLanguagesPath, newLang);
                    const targetLangPath = path.join(targetLanguagesPath, newLang);
                    await copyDirectory(sourceLangPath, targetLangPath);
                }
                
                console.log('✅ New language templates synced to AIDA');
            }
        }
    } catch (error) {
        console.error('Error syncing language templates:', error);
    }
}

/**
 * Recursively copy directory
 * @param {string} source - Source directory
 * @param {string} target - Target directory
 */
async function copyDirectory(source, target) {
    const fs = require('fs').promises;
    
    try {
        await fs.mkdir(target, { recursive: true });
        const entries = await fs.readdir(source, { withFileTypes: true });
        
        for (const entry of entries) {
            const sourcePath = path.join(source, entry.name);
            const targetPath = path.join(target, entry.name);
            
            if (entry.isDirectory()) {
                await copyDirectory(sourcePath, targetPath);
            } else {
                await fs.copyFile(sourcePath, targetPath);
            }
        }
    } catch (error) {
        console.error(`Error copying directory ${source} to ${target}:`, error);
    }
}

/**
 * Get Monaco Editor language identifier from file extension
 * @param {string} fileExtension - File extension (e.g., ".js", ".py")
 * @returns {string} Monaco language identifier
 */
function getMonacoLanguage(fileExtension) {
    const languageMap = {
        '.js': 'javascript',
        '.jsx': 'javascript',
        '.ts': 'typescript',
        '.tsx': 'typescript',
        '.py': 'python',
        '.java': 'java',
        '.cs': 'csharp',
        '.cpp': 'cpp',
        '.c': 'c',
        '.h': 'c',
        '.hpp': 'cpp',
        '.php': 'php',
        '.rb': 'ruby',
        '.go': 'go',
        '.rs': 'rust',
        '.swift': 'swift',
        '.kt': 'kotlin',
        '.scala': 'scala',
        '.sh': 'shell',
        '.bash': 'shell',
        '.ps1': 'powershell',
        '.html': 'html',
        '.htm': 'html',
        '.xml': 'xml',
        '.css': 'css',
        '.scss': 'scss',
        '.sass': 'sass',
        '.less': 'less',
        '.json': 'json',
        '.yaml': 'yaml',
        '.yml': 'yaml',
        '.md': 'markdown',
        '.sql': 'sql',
        '.r': 'r',
        '.lua': 'lua',
        '.dart': 'dart',
        '.vue': 'vue'
    };
    
    return languageMap[fileExtension.toLowerCase()] || 'plaintext';
}

/**
 * Generate Monaco Editor webview content for enhanced diff viewing
 * @param {Object} diffData - The diff data object
 * @param {Object} panel - The webview panel
 * @param {Object} context - The extension context
 * @returns {string} HTML content for webview with Monaco Editor
 */
async function getMonacoWebviewContent(diffData, panel, context) {
    const { path: filePath, changeType, additions, deletions, diff } = diffData;
    
    console.log('🚀 Monaco webview content generation started for:', filePath);

    // Get all files in PR for sidebar
    let allFiles = [];
    let currentFileIndex = 0;
    const cache = global.prDiffCache;
    
    if (cache) {
        // Determine PR prefix based on provider to filter correct files
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
        
        console.log(`📁 Filtering cache for ${provider} PR ${prId} with prefix: ${prPrefix}`);
        
        const cacheKeys = Object.keys(cache).filter(key => 
            key.startsWith(prPrefix) && cache[key].path
        );
        allFiles = cacheKeys.map((key, index) => {
            const file = cache[key];
            const isCurrentFile = file.path === filePath;
            if (isCurrentFile) currentFileIndex = index;
            
            return {
                path: file.path,
                name: file.path.split('/').pop(),
                additions: file.additions || 0,
                deletions: file.deletions || 0,
                changeType: file.changeType || 'modified',
                active: isCurrentFile
            };
        });
        
        console.log('📁 Found', allFiles.length, 'files in PR, current file index:', currentFileIndex);
        
        // Background preloading of next few files (async, non-blocking)
        if (allFiles.length > 1) {
            setTimeout(async () => {
                console.log('🔄 Starting background preload of other files...');
                let preloadCount = 0;
                const maxPreload = Math.min(3, allFiles.length - 1); // Preload max 3 files
                
                for (const file of allFiles) {
                    if (file.path !== filePath && preloadCount < maxPreload) {
                        const contentCacheKey = `content_${file.path}`;
                        if (!cache[contentCacheKey]) {
                            try {
                                // Find the full diff data for this file
                                const cacheKeys = Object.keys(cache);
                                for (const key of cacheKeys) {
                                    if (key.startsWith('pr') && cache[key].path === file.path) {
                                        console.log('📋 Preloading:', file.path);
                                        const { originalLines, modifiedLines } = await parseFullDiffContentEnhanced(cache[key].diff, file.path);
                                        
                                        cache[contentCacheKey] = {
                                            originalContent: originalLines.map(line => line.content).join('\n'),
                                            modifiedContent: modifiedLines.map(line => line.content).join('\n'),
                                            timestamp: Date.now()
                                        };
                                        
                                        preloadCount++;
                                        console.log('💾 Preloaded:', file.path);
                                        break;
                                    }
                                }
                            } catch (error) {
                                console.warn('⚠️ Failed to preload:', file.path, error.message);
                            }
                        }
                    }
                }
                console.log(`✅ Background preload completed: ${preloadCount} files`);
            }, 1000); // Start preload after 1 second to not block initial load
        }
    }

    // Generate file URL for Azure DevOps/GitHub (PR context)
    let fileUrl = null;
    
    if (cache && cache.organization && cache.project && cache.repository) {
        // Get PR ID from any cached diff data
        let prId = null;
        const cacheKeys = Object.keys(cache);
        for (const key of cacheKeys) {
            if (key.startsWith('pr') && cache[key].prId) {
                prId = cache[key].prId;
                break;
            }
        }
        
        if (prId) {
            // Azure DevOps PR file URL format
            fileUrl = `https://dev.azure.com/${cache.organization}/${cache.project}/_git/${cache.repository}/pullrequest/${prId}?_a=files&path=${encodeURIComponent(filePath)}`;
            console.log('🔗 Generated Azure DevOps PR file URL:', fileUrl);
        }
    } else if (diffData.provider === 'github' && diffData.owner && diffData.repo && diffData.prId) {
        // GitHub PR file URL format
        fileUrl = `https://github.com/${diffData.owner}/${diffData.repo}/pull/${diffData.prId}/files#diff-${encodeURIComponent(filePath)}`;
        console.log('🔗 Generated GitHub PR file URL:', fileUrl);
    } else if (diffData.provider === 'gitlab' && diffData.owner && diffData.repo && diffData.prId && diffData.gitlabHost) {
        // GitLab MR file URL format
        fileUrl = `https://${diffData.gitlabHost}/${diffData.owner}/${diffData.repo}/-/merge_requests/${diffData.prId}/diffs#diff-content-${encodeURIComponent(filePath)}`;
        console.log('🔗 Generated GitLab MR file URL:', fileUrl);
    }

    // Get Monaco Editor URIs
    const monacoUri = panel.webview.asWebviewUri(
        vscode.Uri.file(path.join(context.extensionPath, 'node_modules', 'monaco-editor', 'min', 'vs'))
    );
    
    console.log('📁 Monaco URI:', monacoUri.toString());

    // Lazy load: Only parse current file content, cache others for later
    let originalContent = '';
    let modifiedContent = '';
    
    // Check if content is already cached
    const contentCacheKey = `content_${filePath}`;
    if (global.prDiffCache && global.prDiffCache[contentCacheKey]) {
        console.log('📋 Using cached content for:', filePath);
        const cached = global.prDiffCache[contentCacheKey];
        originalContent = cached.originalContent;
        modifiedContent = cached.modifiedContent;
    } else {
        console.log('🔄 Parsing content for:', filePath);
        const { originalLines, modifiedLines } = await parseFullDiffContentEnhanced(diff, filePath);
        
        console.log('📊 Original lines:', originalLines.length, 'Modified lines:', modifiedLines.length);
        
        // Reconstruct full file content
        originalContent = originalLines.map(line => line.content).join('\n');
        modifiedContent = modifiedLines.map(line => line.content).join('\n');
        
        // Cache the parsed content for future use
        if (global.prDiffCache) {
            global.prDiffCache[contentCacheKey] = {
                originalContent,
                modifiedContent,
                timestamp: Date.now()
            };
        }
        
        console.log('� Cached parsed content for:', filePath);
    }
    
    console.log('📝 Content lengths - Original:', originalContent.length, 'Modified:', modifiedContent.length);
    
    // Detect file language from extension
    const fileExtension = path.extname(filePath);
    const language = getMonacoLanguage(fileExtension);
    
    console.log('🔤 Detected language:', language, 'for extension:', fileExtension);

    // Generate file list HTML for sidebar
    let fileListHtml = '';
    if (allFiles.length > 0) {
        fileListHtml = allFiles.map((file, index) => `
            <div class="file-item ${file.active ? 'active' : ''}" data-path="${escapeHtml(file.path)}" title="${escapeHtml(file.path)}">
                <div class="file-icon">📄</div>
                <div class="file-details">
                    <div class="file-name">${escapeHtml(file.name)}</div>
                    <div class="file-path">${escapeHtml(file.path)}</div>
                    <div class="file-stats">
                        <span class="additions">+${file.additions}</span>
                        <span class="deletions">-${file.deletions}</span>
                        <span class="change-type">${escapeHtml(file.changeType)}</span>
                    </div>
                </div>
            </div>
        `).join('');
    }

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" 
          content="default-src 'none'; 
                   script-src ${panel.webview.cspSource} 'unsafe-inline'; 
                   style-src ${panel.webview.cspSource} 'unsafe-inline';">
    <title>Monaco Diff View: ${escapeHtml(filePath)}</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            font-family: var(--vscode-editor-font-family);
        }
        
        .header {
            padding: 16px 20px;
            background-color: var(--vscode-editorWidget-background);
            border-bottom: 1px solid var(--vscode-panel-border);
            position: sticky;
            top: 0;
            z-index: 100;
        }
        
        .header-content {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 20px;
        }
        
        .file-info {
            flex: 1;
            min-width: 0; /* Allow text to truncate */
        }
        
        .file-path {
            font-size: 16px;
            font-weight: bold;
            margin-bottom: 8px;
            color: var(--vscode-editor-foreground);
        }
        
        .file-path-link {
            color: var(--vscode-textLink-foreground);
            text-decoration: none;
            border-bottom: 1px solid transparent;
            transition: all 0.2s ease;
        }
        
        .file-path-link:hover {
            color: var(--vscode-textLink-activeForeground);
            border-bottom-color: var(--vscode-textLink-activeForeground);
        }
        
        .file-path-link:focus {
            outline: 1px solid var(--vscode-focusBorder);
            outline-offset: 2px;
        }
        
        .file-stats {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
        }
        
        .stats-badge {
            display: inline-block;
            padding: 2px 4px;
            margin-right: 4px;
            border-radius: 3px;
            font-weight: 600;
        }
        
        .badge-add {
            background-color: rgba(46, 160, 67, 0.2);
            color: #2ea043;
        }
        
        .badge-remove {
            background-color: rgba(248, 81, 73, 0.2);
            color: #f85149;
        }
        
        .badge-type {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }

        #container {
            height: calc(100vh - 120px);
            width: 100%;
        }
        
        /* Force scrollbar visibility for Monaco Diff Editor */
        .monaco-diff-editor .editor.modified .monaco-scrollable-element > .scrollbar,
        .monaco-diff-editor .editor.original .monaco-scrollable-element > .scrollbar {
            visibility: visible !important;
            opacity: 1 !important;
        }
        
        .monaco-diff-editor .editor.modified .monaco-scrollable-element > .scrollbar.horizontal,
        .monaco-diff-editor .editor.original .monaco-scrollable-element > .scrollbar.horizontal {
            visibility: visible !important;
            opacity: 1 !important;
            height: 14px !important;
        }
        
        .monaco-diff-editor .editor.modified .monaco-scrollable-element > .scrollbar.vertical,
        .monaco-diff-editor .editor.original .monaco-scrollable-element > .scrollbar.vertical {
            visibility: visible !important;
            opacity: 1 !important;
            width: 14px !important;
        }
        
        /* Force scrollbar track visibility */
        .monaco-diff-editor .monaco-scrollable-element .scrollbar .slider {
            visibility: visible !important;
            opacity: 1 !important;
        }
        
        .view-toggle {
            display: flex;
            align-items: center;
            gap: 8px;
            flex-shrink: 0; /* Don't shrink on small screens */
        }
        
        .toggle-group {
            display: flex;
            border: 1px solid var(--vscode-button-border);
            border-radius: 4px;
            overflow: hidden;
            background-color: var(--vscode-button-secondaryBackground);
        }
        
        .toggle-btn {
            padding: 6px 12px;
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: none;
            cursor: pointer;
            font-size: 11px;
            font-weight: 500;
            transition: all 0.2s ease;
            min-width: 85px;
            text-align: center;
            white-space: nowrap;
        }
        
        .toggle-btn:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        
        .toggle-btn.active {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            font-weight: 600;
        }
        
        .toggle-label {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            font-weight: 500;
        }
        
        /* Azure DevOps Style Layout */
        .main-container {
            display: flex;
            height: calc(100vh - 80px);
            overflow: hidden;
        }
        
        body.resizing {
            cursor: col-resize !important;
            user-select: none;
        }
        
        body.resizing * {
            cursor: col-resize !important;
            user-select: none;
        }
        
        .file-sidebar {
            width: 350px;
            background-color: var(--vscode-sideBar-background);
            border-right: 1px solid var(--vscode-panel-border);
            overflow-y: auto;               /* Enable vertical scroll when needed */
            overflow-x: hidden;             /* Keep horizontal hidden */
            flex-shrink: 0;
            min-width: 200px;
            max-width: 600px;
            position: relative;
            user-select: none; /* Prevent text selection during resize */
        }
        
        /* Custom resize handle - full height drag area */
        .file-sidebar .resize-handle {
            position: absolute;
            top: 0;
            right: -2px;
            width: 4px;
            height: 100%;
            background-color: transparent;
            cursor: col-resize;
            z-index: 100;
            transition: background-color 0.2s ease;
        }
        
        .file-sidebar .resize-handle:hover {
            background-color: var(--vscode-focusBorder);
            opacity: 0.7;
        }
        
        .file-sidebar .resize-handle.dragging {
            background-color: var(--vscode-focusBorder);
            opacity: 1;
        }
        
        /* Remove default resize styles */
        .file-sidebar::after {
            display: none;
        }
        
        .sidebar-header {
            padding: 12px 16px;
            border-bottom: 1px solid var(--vscode-panel-border);
            background-color: var(--vscode-editorWidget-background);
            font-weight: 600;
            font-size: 14px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .files-count {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            font-weight: normal;
        }
        
        .file-item {
            padding: 12px 16px;
            border-bottom: 1px solid var(--vscode-panel-border);
            cursor: pointer;
            transition: background-color 0.2s;
            display: flex;
            align-items: flex-start;
            gap: 12px;
        }
        
        .file-item:hover {
            background-color: var(--vscode-list-hoverBackground);
        }
        
        .file-item.active {
            background-color: var(--vscode-list-activeSelectionBackground);
            color: var(--vscode-list-activeSelectionForeground);
        }
        
        .file-icon {
            font-size: 16px;
            flex-shrink: 0;
            margin-top: 2px;
        }
        
        .file-details {
            flex: 1;
            min-width: 0;
        }
        
        .file-item .file-name {
            font-weight: 600;
            margin-bottom: 4px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            font-size: 13px;
        }
        
        .file-item .file-path {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 6px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        
        .file-item .file-stats {
            display: flex;
            gap: 8px;
            font-size: 11px;
            flex-wrap: wrap;
        }
        
        .file-item .additions {
            color: var(--vscode-gitDecoration-addedResourceForeground);
            font-weight: 500;
        }
        
        .file-item .deletions {
            color: var(--vscode-gitDecoration-deletedResourceForeground);
            font-weight: 500;
        }
        
        .file-item .change-type {
            color: var(--vscode-descriptionForeground);
            font-size: 10px;
            text-transform: uppercase;
            font-weight: 500;
        }
        
        .editor-area {
            flex: 1;
            display: flex;
            flex-direction: column;
        }
        
        #container {
            flex: 1;
            overflow: hidden;
        }
        
        /* Hide sidebar when no files */
        .hide-sidebar .file-sidebar {
            display: none;
        }
        
        .hide-sidebar .editor-area {
            width: 100%;
        }
        
        /* Inline mode styles - Keep sidebar on left, only change editor area */
        .inline-mode .main-container {
            display: flex; /* Keep horizontal layout */
            height: calc(100vh - 80px);
        }
        
        .inline-mode .file-sidebar {
            width: 350px; /* Keep default width */
            height: calc(100vh - 80px); /* Keep full height */
            resize: horizontal; /* Keep horizontal resize */
            min-width: 200px;
            max-width: 600px;
            border-right: 1px solid var(--vscode-panel-border);
            border-bottom: none; /* Remove bottom border */
        }
        
        .inline-mode .file-sidebar::after {
            top: 0; /* Reset to default */
            right: 0;
            bottom: auto;
            left: auto;
            width: 4px; /* Keep horizontal resize handle */
            height: 100%;
            cursor: col-resize; /* Keep horizontal cursor */
        }
        
        .inline-mode .editor-area {
            flex: 1;
            overflow: hidden;
        }
        
        /* Inline diff styles */
        .inline-diff-container {
            display: none;
            height: 100%;
            overflow: auto;
            background-color: var(--vscode-editor-background);
            font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
        }
        
        .inline-mode .inline-diff-container {
            display: block;
        }
        
        .inline-mode #container {
            display: none;
        }
        
        .inline-diff-line {
            display: flex;
            min-height: 20px;
            line-height: 20px;
            padding: 2px 0;
            border-left: 3px solid transparent;
            font-size: 13px;
        }
        
        .inline-diff-line.added {
            background-color: rgba(46, 160, 67, 0.15);
            border-left-color: #2ea043;
        }
        
        .inline-diff-line.removed {
            background-color: rgba(248, 81, 73, 0.15);
            border-left-color: #f85149;
        }
        
        .inline-diff-line.context {
            background-color: var(--vscode-editor-background);
        }
        
        .inline-line-num {
            width: 80px;
            text-align: right;
            padding: 0 8px;
            color: var(--vscode-editorLineNumber-foreground);
            background-color: var(--vscode-editorGutter-background);
            user-select: none;
            flex-shrink: 0;
            font-size: 12px;
            display: flex;
            gap: 4px;
        }
        
        .inline-line-content {
            flex: 1;
            padding: 0 8px;
            color: var(--vscode-editor-foreground);
            white-space: pre;
            overflow-x: auto;
        }
        
        .inline-change-indicator {
            width: 20px;
            text-align: center;
            font-weight: bold;
            flex-shrink: 0;
            color: var(--vscode-editor-foreground);
        }
        
        /* Loading spinner styles - lightweight version */
        .loading-spinner {
            display: inline-block;
            width: 20px;
            height: 20px;
            border: 2px solid var(--vscode-button-secondaryBackground);
            border-radius: 50%;
            border-top: 2px solid var(--vscode-button-background);
            animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        /* Lightweight loading for diff editor */
        .editor-loading {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            z-index: 10;
            background-color: var(--vscode-editor-background);
            padding: 12px;
            border-radius: 6px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 13px;
            color: var(--vscode-editor-foreground);
        }
        
        .editor-loading .loading-spinner {
            width: 16px;
            height: 16px;
            border-width: 2px;
        }
        
        /* Remove heavy overlay styles */
        .loading-overlay {
            display: none; /* Disable heavy overlay */
        }
    </style>
</head>
<body class="${allFiles.length > 1 ? '' : 'hide-sidebar'}">
    <div class="header">
        <div class="header-content">
            <div class="file-info">
                <div class="file-path">
                    🚀 Monaco Diff View: 
                    ${fileUrl ? 
                        `<a href="${fileUrl}" target="_blank" class="file-path-link" title="Open this file in PR on Azure DevOps">${escapeHtml(filePath)}</a>` : 
                        escapeHtml(filePath)
                    }
                </div>
                <div class="file-stats">
                    <span class="stats-badge badge-type">${escapeHtml(changeType)}</span>
                    <span class="stats-badge badge-add">+${additions}</span>
                    <span class="stats-badge badge-remove">-${deletions}</span>
                    <span style="margin-left: 10px; color: var(--vscode-descriptionForeground);">Language: ${language}</span>
                </div>
            </div>
            <div class="view-toggle">
                <div class="toggle-group">
                    <button class="toggle-btn active" data-mode="side-by-side" title="Side by side comparison">📊 Side by Side</button>
                    <button class="toggle-btn" data-mode="inline" title="Inline unified diff">📝 Inline</button>
                </div>
            </div>
        </div>
    </div>
    
    <div class="main-container">
        ${allFiles.length > 1 ? `
        <div class="file-sidebar">
            <div class="sidebar-header">
                Files Changed
                <span class="files-count">${allFiles.length} files</span>
            </div>
            <div class="file-list">
                ${fileListHtml}
            </div>
            <div class="resize-handle"></div>
        </div>
        ` : ''}
        
        <div class="editor-area">
            <div id="container"></div>
            <div class="inline-diff-container" id="inlineContainer">
                <!-- Inline diff content will be generated here -->
            </div>
        </div>
    </div>
    
    <script src="${monacoUri}/loader.js"></script>
    <script>
        console.log('🚀 Monaco script loading started');
        console.log('📁 Monaco URI:', '${monacoUri}');
        
        // Add error handler
        window.addEventListener('error', function(e) {
            console.error('❌ Script error:', e.error, e.filename, e.lineno);
            showFallbackView();
        });
        
        // Fallback function to show simple diff view
        function showFallbackView() {
            console.log('🔄 Loading fallback diff view...');
            document.getElementById('container').innerHTML = \`
                <div style="padding: 20px;">
                    <h3>Simple Diff View (Monaco Editor not available)</h3>
                    <div style="display: flex; gap: 20px;">
                        <div style="flex: 1;">
                            <h4>Original</h4>
                            <pre style="background: #1e1e1e; padding: 10px; border-radius: 4px; overflow: auto; max-height: 400px;">\${originalContent}</pre>
                        </div>
                        <div style="flex: 1;">
                            <h4>Modified</h4>
                            <pre style="background: #1e1e1e; padding: 10px; border-radius: 4px; overflow: auto; max-height: 400px;">\${modifiedContent}</pre>
                        </div>
                    </div>
                </div>
            \`;
        }
        
        // Try to load Monaco with timeout
        const timeoutId = setTimeout(() => {
            console.warn('⚠️ Monaco loading timeout, showing fallback view');
            showFallbackView();
        }, 5000);
        
        try {
            require.config({ paths: { vs: '${monacoUri}' } });
            
            console.log('⚙️ Require config set, loading Monaco...');
            
            require(['vs/editor/editor.main'], function() {
                clearTimeout(timeoutId);
                console.log('✅ Monaco editor loaded successfully');
                
                try {
                // Configure Monaco Editor theme to match VS Code
                monaco.editor.defineTheme('vs-code-dark', {
                    base: 'vs-dark',
                    inherit: true,
                    rules: [],
                    colors: {
                        'editor.background': '#1e1e1e',
                        'editor.foreground': '#d4d4d4'
                    }
                });
                
                console.log('🎨 Theme configured');

                // Create diff editor
                const diffEditor = monaco.editor.createDiffEditor(document.getElementById('container'), {
                    theme: 'vs-code-dark',
                    readOnly: true,
                    automaticLayout: true,
                    renderSideBySide: true,
                    renderOverviewRuler: true,
                    diffWordWrap: 'off',           // Turn OFF word wrap để code không bị break
                    wordWrap: 'off',               // Also disable regular word wrap
                    scrollBeyondLastLine: false,
                    scrollbar: {
                        horizontal: 'auto',        // auto = chỉ hiện khi cần
                        vertical: 'auto',          // auto = chỉ hiện khi cần  
                        horizontalScrollbarSize: 14,
                        verticalScrollbarSize: 14,
                        useShadows: false,         // bỏ shadow cho scrollbar
                        handleMouseWheel: true,
                        alwaysConsumeMouseWheel: false
                    },
                    overviewRuler: {
                        border: true
                    },
                    minimap: {
                        enabled: true,
                        side: 'right'
                    },
                    fontSize: 13,
                    lineHeight: 20,
                    fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                    enableSplitViewResizing: false,
                    renderIndicators: true,
                    ignoreTrimWhitespace: false,
                    originalEditable: false,
                    diffAlgorithm: 'advanced'
                });
            
            console.log('🎯 Diff editor created');

            // Set the model for diff editor
            const originalModel = monaco.editor.createModel(
                ${JSON.stringify(originalContent)},
                '${language}'
            );
            
            console.log('📄 Original model created, language:', '${language}');
            
            const modifiedModel = monaco.editor.createModel(
                ${JSON.stringify(modifiedContent)}, 
                '${language}'
            );
            
            console.log('📄 Modified model created');

            diffEditor.setModel({
                original: originalModel,
                modified: modifiedModel
            });
            
            console.log('✅ Diff models set successfully');

            // Get individual editors and force scrollbar settings
            const originalEditor = diffEditor.getOriginalEditor();
            const modifiedEditor = diffEditor.getModifiedEditor();
            
            // Force scrollbar settings on both editors individually
            originalEditor.updateOptions({
                scrollbar: {
                    horizontal: 'auto',        // chỉ hiện khi content overflow
                    vertical: 'auto',          // chỉ hiện khi content overflow
                    horizontalScrollbarSize: 14,
                    verticalScrollbarSize: 14,
                    useShadows: false,         // bỏ shadow 
                    handleMouseWheel: true,
                    alwaysConsumeMouseWheel: false
                },
                wordWrap: 'off',               // Disable word wrap
                wordWrapColumn: 120            // Set wrap column if needed
            });
            
            modifiedEditor.updateOptions({
                scrollbar: {
                    horizontal: 'auto',        // chỉ hiện khi content overflow 
                    vertical: 'auto',          // chỉ hiện khi content overflow
                    horizontalScrollbarSize: 14,
                    verticalScrollbarSize: 14,
                    useShadows: false,         // bỏ shadow
                    handleMouseWheel: true,
                    alwaysConsumeMouseWheel: false
                },
                wordWrap: 'off',               // Disable word wrap
                wordWrapColumn: 120            // Set wrap column if needed
            });
            
            console.log('🔧 Individual editor scrollbar settings applied');
            
            // Force layout refresh to ensure scrollbars are visible
            setTimeout(() => {
                diffEditor.layout();
                originalEditor.layout();
                modifiedEditor.layout();
                console.log('🔄 Layout refreshed for scrollbar visibility');
                
                // Force refresh by updating options again
                if (originalModel && modifiedModel) {
                    // Force refresh by updating options again
                    diffEditor.updateOptions({
                        scrollbar: {
                            horizontal: 'visible',     // Force visible instead of auto
                            vertical: 'visible',       // Force visible instead of auto
                            horizontalScrollbarSize: 14,
                            verticalScrollbarSize: 14,
                            useShadows: false,
                            handleMouseWheel: true,
                            alwaysConsumeMouseWheel: false
                        },
                        diffWordWrap: 'off',           // Ensure word wrap is OFF
                        wordWrap: 'off'                // Ensure word wrap is OFF
                    });
                    
                    // Also force on individual editors again
                    originalEditor.updateOptions({
                        scrollbar: {
                            horizontal: 'visible',
                            vertical: 'visible',
                            horizontalScrollbarSize: 14,
                            verticalScrollbarSize: 14,
                            useShadows: false,
                            handleMouseWheel: true,
                            alwaysConsumeMouseWheel: false
                        },
                        wordWrap: 'off'                // Disable word wrap
                    });
                    
                    modifiedEditor.updateOptions({
                        scrollbar: {
                            horizontal: 'visible',
                            vertical: 'visible',
                            horizontalScrollbarSize: 14,
                            verticalScrollbarSize: 14,
                            useShadows: false,
                            handleMouseWheel: true,
                            alwaysConsumeMouseWheel: false
                        },
                        wordWrap: 'off'                // Disable word wrap
                    });
                    
                    console.log('🔄 Scrollbar options refreshed with forced visibility');
                }
            }, 100);

            // Use a flag to prevent infinite loop
            let isScrolling = false;
            
            // Synchronize scrolling between editors using DOM events as fallback
            originalEditor.onDidScrollChange((e) => {
                if (isScrolling) return;
                isScrolling = true;
                
                if (e.scrollLeftChanged) {
                    modifiedEditor.setScrollLeft(e.scrollLeft);
                }
                if (e.scrollTopChanged) {
                    modifiedEditor.setScrollTop(e.scrollTop);
                }
                
                setTimeout(() => { isScrolling = false; }, 10);
            });
            
            modifiedEditor.onDidScrollChange((e) => {
                if (isScrolling) return;
                isScrolling = true;
                
                if (e.scrollLeftChanged) {
                    originalEditor.setScrollLeft(e.scrollLeft);
                }
                if (e.scrollTopChanged) {
                    originalEditor.setScrollTop(e.scrollTop);
                }
                
                setTimeout(() => { isScrolling = false; }, 10);
            });
            
            // Additional DOM-based scroll sync as backup
            setTimeout(() => {
                const originalDomNode = originalEditor.getDomNode();
                const modifiedDomNode = modifiedEditor.getDomNode();
                
                if (originalDomNode && modifiedDomNode) {
                    // Force scrollbar visibility by manipulating DOM
                    const forceScrollbarVisibility = (editorNode, editorName) => {
                        const scrollbars = editorNode.querySelectorAll('.monaco-scrollable-element > .scrollbar');
                        scrollbars.forEach((scrollbar, index) => {
                            scrollbar.style.visibility = 'visible';
                            scrollbar.style.opacity = '1';
                            console.log('🔧 Forced scrollbar ' + index + ' visibility for ' + editorName);
                        });
                        
                        const sliders = editorNode.querySelectorAll('.monaco-scrollable-element .scrollbar .slider');
                        sliders.forEach((slider, index) => {
                            slider.style.visibility = 'visible';
                            slider.style.opacity = '1';
                            console.log('🔧 Forced slider ' + index + ' visibility for ' + editorName);
                        });
                    };
                    
                    forceScrollbarVisibility(originalDomNode, 'original');
                    forceScrollbarVisibility(modifiedDomNode, 'modified');
                    
                    const originalScrollable = originalDomNode.querySelector('.monaco-scrollable-element');
                    const modifiedScrollable = modifiedDomNode.querySelector('.monaco-scrollable-element');
                    
                    if (originalScrollable && modifiedScrollable) {
                        let domScrolling = false;
                        
                        originalScrollable.addEventListener('scroll', function() {
                            if (domScrolling) return;
                            domScrolling = true;
                            modifiedScrollable.scrollLeft = this.scrollLeft;
                            modifiedScrollable.scrollTop = this.scrollTop;
                            console.log('🔄 DOM sync: Original → Modified', this.scrollLeft, this.scrollTop);
                            setTimeout(() => { domScrolling = false; }, 10);
                        });
                        
                        modifiedScrollable.addEventListener('scroll', function() {
                            if (domScrolling) return;
                            domScrolling = true;
                            originalScrollable.scrollLeft = this.scrollLeft;
                            originalScrollable.scrollTop = this.scrollTop;
                            console.log('🔄 DOM sync: Modified → Original', this.scrollLeft, this.scrollTop);
                            setTimeout(() => { domScrolling = false; }, 10);
                        });
                        
                        console.log('🔄 DOM-based scroll sync configured as backup');
                    }
                }
            }, 500);
            
            console.log('🔄 Scroll synchronization configured');

            // Add toggle functionality for side-by-side vs inline mode with resizable sidebar
            const toggleButtons = document.querySelectorAll('.toggle-btn');
            toggleButtons.forEach(btn => {
                btn.addEventListener('click', function() {
                    const mode = this.getAttribute('data-mode');
                    
                    // Update button states
                    toggleButtons.forEach(b => b.classList.remove('active'));
                    this.classList.add('active');
                    
                    if (mode === 'inline') {
                        console.log('🔄 Switching to Monaco inline mode');
                        
                        // Use Monaco's built-in inline mode
                        diffEditor.updateOptions({
                            renderSideBySide: false
                        });
                        
                    } else {
                        console.log('🔄 Switching to Monaco side-by-side mode');
                        
                        // Use Monaco's side-by-side mode
                        diffEditor.updateOptions({
                            renderSideBySide: true
                        });
                    }
                    
                    // Trigger layout update
                    setTimeout(() => {
                        diffEditor.layout();
                    }, 100);
                });
            });
            
            // Handle window resize
            window.addEventListener('resize', () => {
                diffEditor.layout();
            });
            
            } catch (error) {
                console.error('❌ Error creating Monaco diff editor:', error);
                document.getElementById('container').innerHTML = '<div style="padding: 20px; color: red;">Error loading Monaco Editor: ' + error.message + '</div>';
            }
        }, function(error) {
            console.error('❌ Error loading Monaco editor:', error);
            document.getElementById('container').innerHTML = '<div style="padding: 20px; color: red;">Failed to load Monaco Editor: ' + error + '</div>';
        });
        
        // File sidebar click handlers
        document.addEventListener('DOMContentLoaded', function() {
            // File item click handlers
            const fileItems = document.querySelectorAll('.file-item');
            const editorArea = document.querySelector('.editor-area');
            
            fileItems.forEach(item => {
                item.addEventListener('click', function() {
                    const filePath = this.getAttribute('data-path');
                    if (filePath) {
                        console.log('🔄 Loading file:', filePath);
                        
                        // Update active state only (no loading state)
                        fileItems.forEach(f => f.classList.remove('active'));
                        this.classList.add('active');
                        
                        // Show lightweight loading spinner in editor area
                        const loadingSpinner = document.createElement('div');
                        loadingSpinner.className = 'editor-loading';
                        loadingSpinner.innerHTML = '<div class="loading-spinner"></div>Loading...';
                        editorArea.style.position = 'relative';
                        editorArea.appendChild(loadingSpinner);
                        
                        // Send message to VS Code extension to load new file
                        try {
                            // Use VS Code webview message API to request file content
                            if (window.acquireVsCodeApi) {
                                const vscode = window.acquireVsCodeApi();
                                vscode.postMessage({
                                    type: 'openFileInMonaco',
                                    filePath: filePath
                                });
                                console.log('📤 Sent message to VS Code to load file:', filePath);
                            } else {
                                // Fallback for testing
                                console.warn('⚠️ VS Code API not available, simulating file load');
                                simulateFileLoad(filePath, this, loadingSpinner);
                            }
                        } catch (error) {
                            console.error('❌ Error sending message to VS Code:', error);
                            simulateFileLoad(filePath, this, loadingSpinner);
                        }
                    }
                });
            });
            
            // Simulate file loading for testing
            function simulateFileLoad(filePath, clickedItem, loadingOverlay) {
                setTimeout(() => {
                    // Remove loading spinner only
                    if (loadingSpinner && loadingSpinner.parentNode) {
                        loadingSpinner.parentNode.removeChild(loadingSpinner);
                    }
                    
                    // Update header
                    const filePathElement = document.querySelector('.file-path');
                    if (filePathElement) {
                        filePathElement.innerHTML = '� Monaco Diff View: ' + filePath;
                    }
                    
                    console.log('✅ File loaded successfully (simulated):', filePath);
                    
                }, 800); // Faster loading time
            }

            // Resize handle functionality
            const resizeHandle = document.querySelector('.resize-handle');
            const fileSidebar = document.querySelector('.file-sidebar');
            
            if (resizeHandle && fileSidebar) {
                let isResizing = false;
                let startX, startWidth;
                
                resizeHandle.addEventListener('mousedown', function(e) {
                    isResizing = true;
                    startX = e.clientX;
                    startWidth = parseInt(getComputedStyle(fileSidebar).width, 10);
                    
                    document.body.classList.add('resizing');
                    document.addEventListener('mousemove', doResize);
                    document.addEventListener('mouseup', stopResize);
                    
                    e.preventDefault();
                });
                
                function doResize(e) {
                    if (!isResizing) return;
                    
                    const diffX = e.clientX - startX;
                    const newWidth = startWidth + diffX;
                    
                    // Constrain width between 200px and 800px
                    const minWidth = 200;
                    const maxWidth = 800;
                    const constrainedWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
                    
                    fileSidebar.style.width = constrainedWidth + 'px';
                }
                
                function stopResize() {
                    isResizing = false;
                    document.body.classList.remove('resizing');
                    document.removeEventListener('mousemove', doResize);
                    document.removeEventListener('mouseup', stopResize);
                }
            }
        });
        } catch (error) {
            clearTimeout(timeoutId);
            console.error('❌ Error loading Monaco Editor:', error);
            showFallbackView();
        }
    </script>
</body>
</html>`;
}


/**
 * Parse diff content to reconstruct full file content for both sides
 * ENHANCED VERSION: For cross-repo PR reviews - reconstructs content directly from diff
 * @param {string} diff - Git diff content
 * @param {string} filePath - Path to the file being diffed
 * @returns {object} - { originalLines: [], modifiedLines: [] }
 */
async function parseFullDiffContentEnhanced(diff, filePath) {
    console.log('🔍 parseFullDiffContentEnhanced - FULL FILE CONTENT mode for:', filePath);
    
    // Check if we have Azure DevOps cache data for full file content retrieval
    const cache = global.prDiffCache;
    if (cache && cache.accessToken && cache.sourceCommit && cache.targetCommit) {
        console.log('✅ Azure DevOps cache available - fetching FULL FILE CONTENT');
        return await getFullFileContentFromAzureDevOps(filePath, diff);
    } else {
        console.log('⚠️ No Azure DevOps cache - falling back to diff reconstruction');
        console.log('🔍 Attempting DIRECT Azure DevOps detection from diff content...');
        
        // Try to detect Azure DevOps info from diff and fetch full content anyway
        const azureInfo = detectAzureDevOpsFromDiff(diff);
        if (azureInfo && azureInfo.organization) {
            console.log('🎯 Detected Azure DevOps info from diff:', azureInfo);
            return await getFullContentWithDetectedInfo(filePath, diff, azureInfo);
        }
        
        return await reconstructFromDiffFallback(diff, filePath);
    }
}

/**
 * Detect Azure DevOps info from diff content
 */
function detectAzureDevOpsFromDiff(diff) {
    // Look for Azure DevOps patterns in diff
    const orgMatch = diff.match(/dev\.azure\.com\/([^\/]+)/);
    const projectMatch = diff.match(/\/_git\/([^\/]+)/);
    
    if (orgMatch && projectMatch) {
        return {
            organization: orgMatch[1],
            project: projectMatch[1],
            repository: projectMatch[1] // Assume same as project for now
        };
    }
    
    // Check if this looks like Azure DevOps based on diff format
    if (diff.includes('BusinessWebUS') || diff.includes('Shippo')) {
        return {
            organization: 'BusinessWebUS',
            project: 'Shippo', 
            repository: 'Shippo-Web'
        };
    }
    
    return null;
}

/**
 * Get full content using detected Azure DevOps info
 */
async function getFullContentWithDetectedInfo(filePath, diff, azureInfo) {
    console.log('🔄 Attempting to fetch full content with detected info...');
    
    // Try to get access token from vscode settings or prompt user
    const config = vscode.workspace.getConfiguration('aida');
    const accessToken = config.get('azureDevOps.personalAccessToken');
    
    if (!accessToken) {
        console.log('❌ No Azure DevOps token available in settings');
        return await reconstructFromDiffFallback(diff, filePath);
    }
    
    // Extract commit info from diff if possible
    const commits = extractCommitsFromDiff(diff);
    if (!commits.sourceCommit || !commits.targetCommit) {
        console.log('❌ Could not extract commit info from diff');
        return await reconstructFromDiffFallback(diff, filePath);
    }
    
    console.log('✅ Detected commits:', commits);
    
    try {
        // Import and use getFileContent if available
        const reviewPrPath = path.join(__dirname, 'scripts', 'review-pr.js');
        if (fs.existsSync(reviewPrPath)) {
            const reviewPrModule = require(reviewPrPath);
            const getFileContent = reviewPrModule.getFileContent;
            
            if (typeof getFileContent === 'function') {
                // 🔧 FIX: Commit terminology - need to swap for correct Monaco display
                // commits.sourceCommit = NEW code = Monaco "modified" (RIGHT)
                // commits.targetCommit = OLD code = Monaco "original" (LEFT)
                const [targetContent, sourceContent] = await Promise.all([
                    getFileContent(azureInfo.organization, azureInfo.project, azureInfo.repository, filePath, commits.targetCommit, accessToken), // OLD = original = LEFT
                    getFileContent(azureInfo.organization, azureInfo.project, azureInfo.repository, filePath, commits.sourceCommit, accessToken)  // NEW = modified = RIGHT
                ]);
                
                if (targetContent || sourceContent) {
                    console.log(`✅ SUCCESS: Got full content - Original (OLD): ${targetContent ? targetContent.length : 0}, Modified (NEW): ${sourceContent ? sourceContent.length : 0}`);
                    
                    // Convert to format using the enhanced logic
                    return convertFullContentToLineFormat(targetContent || '', sourceContent || '');
                }
            }
        }
        
    } catch (error) {
        console.log('❌ Error fetching with detected info:', error.message);
    }
    
    return await reconstructFromDiffFallback(diff, filePath);
}

/**
 * Extract commit IDs from diff content
 */
function extractCommitsFromDiff(diff) {
    // Look for commit hashes in diff header
    const indexMatch = diff.match(/index ([a-f0-9]{7,40})\.\.([a-f0-9]{7,40})/);
    if (indexMatch) {
        return {
            sourceCommit: indexMatch[1],
            targetCommit: indexMatch[2]
        };
    }
    
    // Look for other patterns
    const commitMatches = diff.match(/[a-f0-9]{40}/g);
    if (commitMatches && commitMatches.length >= 2) {
        return {
            sourceCommit: commitMatches[0],
            targetCommit: commitMatches[1]
        };
    }
    
    return {};
}

/**
 * Get complete file content from Azure DevOps API for both commits
 */
async function getFullFileContentFromAzureDevOps(filePath, diff) {
    const cache = global.prDiffCache;
    
    try {
        console.log(`🔄 Fetching FULL content for ${filePath} from both commits`);
        
        // Import getFileContent function from review-pr.js if available
        const reviewPrPath = path.join(__dirname, 'scripts', 'review-pr.js');
        if (fs.existsSync(reviewPrPath)) {
            const reviewPrModule = require(reviewPrPath);
            const getFileContent = reviewPrModule.getFileContent;
            
            if (typeof getFileContent === 'function') {
                // 🔧 FIX: Azure DevOps PR terminology vs Monaco terminology
                // sourceCommit = NEW code (feature branch) = Monaco "modified" (RIGHT)
                // targetCommit = OLD code (base branch) = Monaco "original" (LEFT)
                const [targetContent, sourceContent] = await Promise.all([
                    getFileContent(cache.organization, cache.project, cache.repository, filePath, cache.targetCommit, cache.accessToken), // OLD = original = LEFT
                    getFileContent(cache.organization, cache.project, cache.repository, filePath, cache.sourceCommit, cache.accessToken)  // NEW = modified = RIGHT
                ]);
                
                if (targetContent || sourceContent) {
                    console.log(`✅ SUCCESS: Got full content - Original (OLD): ${targetContent ? targetContent.length : 0}, Modified (NEW): ${sourceContent ? sourceContent.length : 0}`);
                    
                    return convertFullContentToLineFormat(targetContent || '', sourceContent || '');
                }
            }
        }
        
    } catch (error) {
        console.log('❌ Error fetching from Azure DevOps API:', error.message);
    }
    
    return await reconstructFromDiffFallback(diff, filePath);
}

/**
 * Convert full file content to line format using diff.js for proper alignment
 */
function convertFullContentToLineFormat(baseContent, targetContent) {
    // Import diff library from npm package
    let diff;
    try {
        diff = require('diff');
        console.log('✅ diff module loaded successfully from npm');
    } catch (error) {
        console.log('❌ diff library not available, using simple reconstruction');
        console.log('❌ diff error:', error.message);
        return {
            originalLines: baseContent.split('\n').map((line, i) => ({ content: line, lineNum: i + 1, type: 'context' })),
            modifiedLines: targetContent.split('\n').map((line, i) => ({ content: line, lineNum: i + 1, type: 'context' }))
        };
    }
    
    // ⚡ PERFORMANCE: Quick check for identical content
    if (baseContent === targetContent) {
        console.log('⚡ Files identical - using fast path');
        const lines = baseContent.split('\n');
        return {
            originalLines: lines.map((line, i) => ({ content: line, lineNum: i + 1, type: 'context' })),
            modifiedLines: lines.map((line, i) => ({ content: line, lineNum: i + 1, type: 'context' }))
        };
    }
    
    console.time('⚡ Diff processing');
    // Use diff to properly align lines for side-by-side view
    const changes = diff.diffLines(baseContent, targetContent);
    console.timeEnd('⚡ Diff processing');
    
    const originalLines = [];
    const modifiedLines = [];
    
    let baseLineNum = 1;
    let targetLineNum = 1;
    
    for (const change of changes) {
        const lines = change.value.split('\n');
        // Remove empty last element if exists (from split)
        if (lines[lines.length - 1] === '') {
            lines.pop();
        }
        
        if (change.added) {
            // Lines added in target (new code) - show empty on left, added on right
            for (const line of lines) {
                originalLines.push({
                    content: '',
                    lineNum: '',
                    type: 'empty'
                });
                
                modifiedLines.push({
                    content: line,
                    lineNum: targetLineNum,
                    type: 'added'
                });
                
                targetLineNum++;
            }
        } else if (change.removed) {
            // Lines removed from base (old code) - show removed on left, empty on right
            for (const line of lines) {
                originalLines.push({
                    content: line,
                    lineNum: baseLineNum,
                    type: 'removed'
                });
                
                modifiedLines.push({
                    content: '',
                    lineNum: '',
                    type: 'empty'
                });
                
                baseLineNum++;
            }
        } else {
            // Unchanged lines - show on both sides
            for (const line of lines) {
                originalLines.push({
                    content: line,
                    lineNum: baseLineNum,
                    type: 'context'
                });
                
                modifiedLines.push({
                    content: line,
                    lineNum: targetLineNum,
                    type: 'context'
                });
                
                baseLineNum++;
                targetLineNum++;
            }
        }
    }
    
    console.log(`✅ ENHANCED SIDE-BY-SIDE: ${originalLines.length} original lines, ${modifiedLines.length} modified lines`);
    console.log(`📊 Added: ${modifiedLines.filter(l => l.type === 'added').length}, Removed: ${originalLines.filter(l => l.type === 'removed').length}`);
    
    return { originalLines, modifiedLines };
}

/**
 * Fallback to diff reconstruction when full content is not available
 */
async function reconstructFromDiffFallback(diff, filePath) {
    console.log('🔄 Using fallback diff reconstruction for:', filePath);
    
    // Use the existing reconstruction logic
    const { originalLines, modifiedLines } = reconstructFromGitDiff(diff, filePath);

    console.log(`✅ Fallback reconstruction completed: ${originalLines.length} original, ${modifiedLines.length} modified lines`);
    return { originalLines, modifiedLines };
}

/**
 * Reconstruct file content from git diff (for cross-repo PR reviews)
 * @param {string} diff - Git diff content
 * @param {string} filePath - File path for context
 * @returns {object} - { originalLines: [], modifiedLines: [] }
 */
function reconstructFromGitDiff(diff, filePath) {
    console.log('� Reconstructing file content from git diff for cross-repo PR');

    const diffLines = diff.split('\n');
    const originalLines = [];
    const modifiedLines = [];

    let oldLineNum = 1;
    let newLineNum = 1;
    let inHunk = false;

    for (const line of diffLines) {
        // Skip diff headers
        if (line.startsWith('diff --git') || line.startsWith('+++') || line.startsWith('---') || line.startsWith('index ')) {
            continue;
        }

        if (line.startsWith('@@')) {
            // Parse hunk header to get starting line numbers
            const hunkMatch = line.match(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
            if (hunkMatch) {
                oldLineNum = parseInt(hunkMatch[1]);
                newLineNum = parseInt(hunkMatch[3]);
                inHunk = true;
                console.log(`📍 Hunk: starting at old line ${oldLineNum}, new line ${newLineNum}`);
            }
            continue;
        }

        if (inHunk) {
            if (line.startsWith(' ')) {
                // Context line (unchanged)
                const content = line.substring(1);
                originalLines.push({
                    content: content,
                    lineNum: oldLineNum,
                    type: 'context'
                });
                modifiedLines.push({
                    content: content,
                    lineNum: newLineNum,
                    type: 'context'
                });
                oldLineNum++;
                newLineNum++;
            } else if (line.startsWith('-')) {
                // Removed line
                const content = line.substring(1);
                originalLines.push({
                    content: content,
                    lineNum: oldLineNum,
                    type: 'removed'
                });
                modifiedLines.push({
                    content: '',
                    lineNum: '',
                    type: 'empty'
                });
                oldLineNum++;
            } else if (line.startsWith('+')) {
                // Added line
                const content = line.substring(1);
                originalLines.push({
                    content: '',
                    lineNum: '',
                    type: 'empty'
                });
                modifiedLines.push({
                    content: content,
                    lineNum: newLineNum,
                    type: 'added'
                });
                newLineNum++;
            } else if (line.trim() === '') {
                // Empty line in diff
                originalLines.push({
                    content: '',
                    lineNum: oldLineNum,
                    type: 'context'
                });
                modifiedLines.push({
                    content: '',
                    lineNum: newLineNum,
                    type: 'context'
                });
                oldLineNum++;
                newLineNum++;
            }
        }
    }

    console.log(`✅ Reconstructed ${originalLines.length} original lines, ${modifiedLines.length} modified lines`);
    console.log(`📊 Changes: ${originalLines.filter(l => l.type === 'removed').length} removed, ${modifiedLines.filter(l => l.type === 'added').length} added`);

    return { originalLines, modifiedLines };
}



/**
 * Escape HTML special characters
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, m => map[m]);
}



function deactivate() { }

module.exports = {
    activate,
    deactivate,
    handleEnterTwiceLogic,  // Export for use in review-changes.js and review-file.js
    ensureAidaTemplatesForReview,  // Export for review commands (replaces checkAndInitializeTemplates)
    handleSyncTemplates,  // Export for sync command
    createAidaTemplateStructure,  // Export for sync-review-templates
    syncNewLanguageTemplates  // Export for sync-review-templates
};
