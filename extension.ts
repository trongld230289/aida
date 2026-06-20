import * as vscode from 'vscode';

// ─── AidaContext: centralized state (replaces global.*) ─────────────
import { ctx, installGlobalBridge } from './scripts/core/aida-context';
installGlobalBridge();

// ─── Core modules ───────────────────────────────────────────────────
import { getMonacoWebviewContent } from './scripts/review/monaco-webview';
import { setupAzureDevOpsSettings } from './scripts/review/diff-utils';
import { showAvailableModels, getBusinessDocumentFolders } from './scripts/review/review-common';
import { analyzeFileDependency, activateDependencyWatcherIfCacheExists, initializeDependencyGraph } from './scripts/dependency/dependency';
import { trackEvent } from './scripts/tracking/usage-tracking';
import { TrackingEvent } from './scripts/tracking/tracking-enums';
import { initializeActivationKey, isActivated, getActivationStatus, clearActivationCache, onActivated, areFeaturesRegistered, markFeaturesRegistered } from './scripts/tracking/activation-key';
import { chatSessions, handleEnterTwiceLogic } from './scripts/core/shared-state';
import { ensureAidaTemplatesForReview, handleSyncTemplates, createAidaTemplateStructure, syncNewLanguageTemplates } from './scripts/core/template-engine';
import { virtualContentProvider } from './scripts/core/virtual-content-provider';
import { initializeCopilotSidebarChat } from './scripts/chatbot/chatbot-sidebar';
import { registerTestCommand } from './scripts/test/test-get-copilot-models';
import { initializeReviewChanges } from './scripts/review/review-changes';
import { initializeReviewFile } from './scripts/review/review-file';
import { initializeReviewAllChanges } from './scripts/review/review-all-changes';
import { initializePrReview } from './scripts/review/review-pr';
import { initializeSyncTemplates } from './scripts/review/sync-review-templates';

// ─── Command modules (Phase 2 extraction) ───────────────────────────
import { registerChatCommands } from './scripts/commands/chat-commands';
import { registerReviewCommands } from './scripts/commands/review-commands';
import { registerPrCommands } from './scripts/commands/pr-commands';
import { registerDependencyCommands } from './scripts/commands/dependency-commands';
import { registerUtilityCommands } from './scripts/commands/utility-commands';

/**
 * Register ALL AIDA features (commands, participants, sidebar, etc.)
 * Called after activation key is validated.
 */
function registerAllFeatures(context: any): void {
    if (areFeaturesRegistered()) {
        console.log('[AIDA] Features already registered, skipping');
        return;
    }

    // Auto-activate dependency watcher if cache exists
    void activateDependencyWatcherIfCacheExists(context);

    // Register Virtual Content Provider for in-memory files (aida-memory scheme)
    try {
        context.subscriptions.push(
            vscode.workspace.registerTextDocumentContentProvider('aida-memory', virtualContentProvider)
        );
        console.log('✅ Registered aida-memory content provider');
    } catch (error: any) {
        console.error('❌ Failed to register virtual content provider:', error);
    }

    // ─── Initialize Sidebar Chat ────────────────────────────────────
    let copilotSidebarChat = null;
    try {
        console.log('🔄 Initializing AIDA Chatbot Sidebar...');
        const sidebarResult = initializeCopilotSidebarChat(context);
        copilotSidebarChat = sidebarResult?.sidebarChat ?? null;
        console.log('✅ AIDA Chatbot Sidebar initialized successfully');
    } catch (error: any) {
        console.error('❌ Failed to initialize AIDA Chatbot Sidebar:', error);
        console.error('❌ Error details:', error.stack);
    }

    // ─── Register extracted command modules ─────────────────────
    registerChatCommands(context, copilotSidebarChat);
    registerReviewCommands(context, copilotSidebarChat);
    registerPrCommands(context, getMonacoWebviewContent);
    registerDependencyCommands(context, analyzeFileDependency);
    registerUtilityCommands(context, copilotSidebarChat, {
        setupAzureDevOpsSettings,
        showAvailableModels,
        getBusinessDocumentFolders
    });

    // Register test command for Copilot models
    registerTestCommand(context);

    // ─── Chat Participants (VS Code Chat API) ───────────────────
    const reviewChangesParticipant = initializeReviewChanges(context).reviewChangesParticipant;
    const reviewFileParticipant = initializeReviewFile(context).reviewFileParticipant;
    const reviewAllChangesParticipant = initializeReviewAllChanges(context).reviewAllChangesParticipant;

    // Dependency chat participants
    try {
        const dependencyResult = initializeDependencyGraph(context);
        if (dependencyResult && typeof dependencyResult.registerCacheCommands === 'function') {
            dependencyResult.registerCacheCommands(context);
            console.log('✅ Dependency cache commands registered');
        }
        context.subscriptions.push(
            ...[dependencyResult.dependencyParticipant, dependencyResult.dependencyPrParticipant].filter(Boolean)
        );
        console.log('✅ Dependency graph analysis participants registered');
    } catch (error: any) {
        console.error('❌ Failed to initialize dependency graph analysis:', error.message);
    }

    // PR review chat participant
    let reviewPrParticipant = null, reviewPullRequest = null;
    try {
        const result = initializePrReview(context);
        reviewPrParticipant = result.reviewPrParticipant;
        reviewPullRequest = result.reviewPullRequest;
        console.log('✅ PR review initialized successfully');
    } catch (error: any) {
        console.error('❌ Error initializing PR review:', error);
    }

    // Sync templates participant
    const { syncTemplatesParticipant } = initializeSyncTemplates(context);
    console.log('✅ Sync Review Templates participant initialized.');

    // ─── Push non-command subscriptions ───────────────────────
    context.subscriptions.push(
        ...[reviewChangesParticipant, reviewFileParticipant, reviewAllChangesParticipant,
            reviewPrParticipant, reviewPullRequest, syncTemplatesParticipant, copilotSidebarChat
        ].filter(Boolean)
    );

    markFeaturesRegistered();
    console.log('✅ All AIDA features registered');
}

/**
 * Register stub handlers for all features when activation key is missing.
 * This ensures commands and chat participants show a clear "activation required" 
 * message instead of silently doing nothing.
 */
function registerActivationStubs(_context: any): vscode.Disposable[] {
    const disposables: vscode.Disposable[] = [];

    const showActivationPrompt = async () => {
        const action = await vscode.window.showWarningMessage(
            '🔑 AIDA requires an activation key to use this feature.\n\nPlease enter your key in Settings → aida.activationKey',
            { modal: true },
            'Open Settings',
            'Show Status'
        );
        if (action === 'Open Settings') {
            vscode.commands.executeCommand('workbench.action.openSettings', 'aida.activationKey');
        } else if (action === 'Show Status') {
            vscode.commands.executeCommand('aida.showActivationStatus');
        }
    };

    // ─── Stub Commands ──────────────────────────────────────────────
    const commandIds = [
        'aida.reviewFile',
        'aida.reviewChanges',
        'aida.reviewAllChanges',
        'aida.reviewPullRequest',
        'aida.setupAzureDevOps',
        'aida.showAvailableModels',
        'aida.openChat',
        'aida.openSidebarChat',
        'aida.clearChatSidebar',
        'aida.openSettingsSidebar',
        'aida.closeChatSidebar',
        'aida.analyzeDependency',
        'aida.testGetCopilotModels',
    ];

    for (const cmdId of commandIds) {
        disposables.push(
            vscode.commands.registerCommand(cmdId, showActivationPrompt)
        );
    }

    // ─── Stub Chat Participants ─────────────────────────────────────
    const participantIds = [
        'review-file',
        'review-changes',
        'review-all-changes',
        'review-pr',
        'sync-review-templates',
        'dependency',
        'dependency-pr',
    ];

    for (const pid of participantIds) {
        disposables.push(
            vscode.chat.createChatParticipant(pid, async (_request, _chatContext, stream, _token) => {
                stream.markdown('🔑 **AIDA requires an activation key.**\n\n');
                stream.markdown('Please enter your activation key to use this feature:\n\n');
                stream.markdown('1. Open **Settings** (`Ctrl+,`)\n');
                stream.markdown('2. Search for `aida.activationKey`\n');
                stream.markdown('3. Paste your encrypted activation key\n\n');
                stream.markdown('Or run command: **AIDA: Enter Activation Key**');
            })
        );
    }

    return disposables;
}

/**
 * Send extension_activated tracking event (throttled: max 1/day).
 * Called after activation key is validated so tracking is properly configured.
 */
function sendExtensionActivatedEvent(context: any): void {
    const today = new Date().toISOString().split('T')[0]; // 'YYYY-MM-DD'
    const lastActivatedDate = context.globalState.get('aida.lastActivatedDate', '');
    if (lastActivatedDate !== today) {
        context.globalState.update('aida.lastActivatedDate', today);
        console.log(`[AIDA][DEBUG] Sending trackEvent("extension_activated")...`);
        void trackEvent(TrackingEvent.EXTENSION_ACTIVATED, {
            isNewInstall: vscode.env.isNewAppInstall,
            remoteName: vscode.env.remoteName || 'local'
        });
    } else {
        console.log(`[AIDA][DEBUG] Skipping extension_activated — already sent today`);
    }
}

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context: any) {
    console.log('🤖 AIDA v1.1.27 - AI Development Assistant');
    console.log('🚀 AIDA extension is now active!');

    console.log(`[AIDA][DEBUG] ═══ ACTIVATION START ═══`);

    // Initialize centralized state (always needed)
    ctx.init(context);

    // ─── Initialize Activation Key System ────────────────────────────
    console.log(`[AIDA][DEBUG] Initializing activation key system...`);
    initializeActivationKey(context);

    // Register activation key commands (always available, even when not activated)
    context.subscriptions.push(
        vscode.commands.registerCommand('aida.clearActivationKey', async () => {
            const config = vscode.workspace.getConfiguration('aida');
            await config.update('activationKey', '', vscode.ConfigurationTarget.Global);
            clearActivationCache();
            vscode.window.showInformationMessage('AIDA: Activation key cleared. Please restart VS Code.');
        }),
        vscode.commands.registerCommand('aida.showActivationStatus', () => {
            const status = getActivationStatus();
            vscode.window.showInformationMessage(`AIDA Activation Status:\n${status}`);
        })
    );

    // ─── Feature Registration (gated by activation key) ───────────
    const activated = isActivated();
    console.log(`[AIDA][DEBUG] isActivated() = ${activated}`);
    if (activated) {
        // Valid activation key → register immediately
        console.log(`[AIDA][DEBUG] Registering all features immediately`);
        registerAllFeatures(context);

        // Send extension_activated event (throttled: max 1/day)
        sendExtensionActivatedEvent(context);
    } else {
        // No valid key → register stubs that show activation message
        console.log('⏳ AIDA: Waiting for activation key — registering stub handlers...');
        const stubDisposables = registerActivationStubs(context);

        // When key is entered and valid → dispose stubs, register real features
        onActivated(() => {
            console.log('🔓 AIDA: Key validated — replacing stubs with real features...');
            for (const d of stubDisposables) {
                d.dispose();
            }
            registerAllFeatures(context);

            // Send extension_activated now that tracking is configured
            sendExtensionActivatedEvent(context);
        });
    }

    console.log('✅ AIDA activation complete');
    console.log(`[AIDA][DEBUG] ═══ ACTIVATION END ═══`);
}

function deactivate() { }

export { activate, deactivate, handleEnterTwiceLogic, ensureAidaTemplatesForReview, handleSyncTemplates, createAidaTemplateStructure, syncNewLanguageTemplates, chatSessions };
