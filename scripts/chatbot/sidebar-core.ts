/**
 * @module sidebar-core
 * @description CopilotSidebarChat class definition, constructor, lifecycle,
 *              and thin wrapper methods that delegate to sub-modules.
 * Extracted from chatbot-sidebar.ts during Phase 6 refactoring.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { AidaChatbotService } from './chatbot-service';
import { ChatbotContextEngine } from './chatbot-algorithm';
import TemplateLoader from './template-loader';
import { aidaLogging } from '../core/settings';
import { AidaChatViewProvider } from './chatbot-view-provider';
import { agentMethods } from './chatbot-agent';
import { contextMethods } from './chatbot-context';
import { toError } from '../core/error-utils';
import type { IFileContext } from './interfaces/chat-host.interface';

// Sub-module imports
import {
    type IChatHistoryMessage,
    getWorkspaceSpecificKey as getWorkspaceSpecificKeyFn,
    loadChatHistory as loadChatHistoryFn,
    saveChatHistory as saveChatHistoryFn,
    clearChatHistoryStorage,
    restoreWorkspaceChatHistory as restoreWorkspaceChatHistoryFn
} from './sidebar-history';

import {
    processChatMessage as processChatMessageFn,
    determineParticipant as determineParticipantFn
} from './sidebar-messaging';

import {
    callParticipant as callParticipantFn,
    generateGeneralResponse as generateGeneralResponseFn,
    getFallbackResponse as getFallbackResponseFn,
    ensureAidaTemplatesExist as ensureAidaTemplatesExistFn,
    copyTemplatesRecursively as copyTemplatesRecursivelyFn
} from './sidebar-participants';

// ─── Class ───────────────────────────────────────────────────────────

/**
 * GitHub Copilot-Style Sidebar Chat (True Right Sidebar like Copilot)
 * Uses TreeView + WebView combination for authentic Copilot experience
 */
class CopilotSidebarChat {
    context: vscode.ExtensionContext;
    webviewView: vscode.WebviewView | null;
    chatHistory: IChatHistoryMessage[];
    isProcessing: boolean;
    messageHistory: string[];
    historyIndex: number;
    chatbotService: AidaChatbotService;
    contextEngine: ChatbotContextEngine;
    currentFileName: string | null;
    currentAbortController: AbortController | null;
    templateLoader!: TemplateLoader | null;
    isCanceled!: boolean;

    // Mixin methods from chatbot-agent and chatbot-context (added via Object.assign)
    [key: string]: unknown;

    // Declared for type-checking only — actual methods are mixed in via Object.assign below.
    // Do NOT use `= null` initializers here: they create instance own-properties
    // that shadow the prototype methods from the mixin, causing "is not a function" errors.
    getCurrentFileContext!: () => Promise<IFileContext>;

    makeMultimodalContextDecision!: (...args: any[]) => any;

    basicContextDecision!: (...args: any[]) => any;

    createAgentPlan!: (...args: any[]) => Promise<any>;

    executeAgentPlan!: (...args: any[]) => Promise<any>;

    enhanceMessageWithContext!: (...args: any[]) => any;

    constructor(context: vscode.ExtensionContext) {
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
        void this.initializeChatbot();
        this.setupFileWatcher();
        this.loadChatHistory(); // Load persisted chat history
    }

    // ─── File Watcher / Lifecycle ────────────────────────────────────

    /**
     * Setup file watcher to detect active file changes and workspace changes
     */
    setupFileWatcher(): void {
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
                aidaLogging('\u{1F4C1} Workspace changed, reloading chat history...');
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
    updateCurrentFile(editor: vscode.TextEditor | null = null, forceUpdate: boolean = false): void {
        // Use provided editor or get current active editor
        editor = editor || vscode.window.activeTextEditor || null;
        if (editor && editor.document) {
            const fileName = editor.document.fileName;
            const displayName: string | null = fileName.split(/[\\/]/).pop() ?? null; // Get just filename

            if (this.currentFileName !== displayName || forceUpdate) {
                this.currentFileName = displayName;

                // Notify webview about file change
                if (this.webviewView) {
                    this.webviewView.webview.postMessage({
                        type: 'updateCurrentFile',
                        fileName: displayName,
                        fullPath: fileName
                    });
                    aidaLogging('\u{1F4C1} Current file updated:', displayName, forceUpdate ? '(forced)' : '');
                } else {
                    aidaLogging('\u{1F4C1} Webview not ready, current file will be updated later:', displayName);
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
                aidaLogging('\u{1F4C1} Current file cleared');
            }
        }
    }

    /**
     * Initialize chatbot service
     */
    async initializeChatbot(): Promise<void> {
        try {
            await this.chatbotService.initialize();
            aidaLogging('\u2705 AIDA Chatbot Service initialized');
        } catch (error: unknown) {
            aidaLogging('\u274C Failed to initialize chatbot service:', error);
        }
    }

    /**
     * Register the sidebar view exactly like GitHub Copilot
     */
    registerSidebarView(): AidaChatViewProvider {
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

        aidaLogging('\u2705 AIDA Chat Sidebar registered (GitHub Copilot style)');
        return provider;
    }

    /**
     * Show the sidebar (like clicking Copilot icon)
     */
    show(): void {
        vscode.commands.executeCommand('aidaChatSidebar.focus');
    }

    // ─── History Wrappers (delegate to sidebar-history) ──────────────

    getWorkspaceSpecificKey(baseKey: string): string {
        return getWorkspaceSpecificKeyFn(baseKey);
    }

    loadChatHistory(): void {
        const result = loadChatHistoryFn(this.context);
        this.chatHistory = result.chatHistory;
        this.messageHistory = result.messageHistory;
    }

    saveChatHistory(): void {
        saveChatHistoryFn(this.context, this.chatHistory, this.messageHistory);
    }

    clearChatHistory(): void {
        this.chatHistory = [];
        this.messageHistory = [];
        this.historyIndex = -1;
        clearChatHistoryStorage(this.context);
    }

    restoreWorkspaceChatHistory(): void {
        restoreWorkspaceChatHistoryFn(this.webviewView, this.chatHistory);
    }

    // ─── Messaging Wrappers (delegate to sidebar-messaging) ─────────

    async processChatMessage(userMessage: string, images: string[] = [], mode: string = 'ask', model: string = 'claude-sonnet-4.5'): Promise<void> {
        return processChatMessageFn(this, userMessage, images, mode, model);
    }

    determineParticipant(message: string): string {
        return determineParticipantFn(message);
    }

    // ─── Participant Wrappers (delegate to sidebar-participants) ─────

    async callParticipant(participant: string, message: string, images: string[] = [], streamCallback: ((chunk: string) => void) | null = null): Promise<string> {
        return callParticipantFn(participant, message, images, streamCallback, this.context, this.chatbotService, this.webviewView);
    }

    async generateGeneralResponse(message: string, images: string[] = [], streamCallback: ((chunk: string) => void) | null = null): Promise<string> {
        return generateGeneralResponseFn(message, images, streamCallback, this.chatbotService);
    }

    getFallbackResponse(message: string): string {
        return getFallbackResponseFn(message);
    }

    async ensureAidaTemplatesExist(): Promise<void> {
        return ensureAidaTemplatesExistFn(this.context, this.webviewView);
    }

    async copyTemplatesRecursively(src: string, dest: string): Promise<void> {
        return copyTemplatesRecursivelyFn(src, dest);
    }

    // ─── Inline Methods ──────────────────────────────────────────────

    /**
     * Send message directly to sidebar
     */
    async sendMessage(message: string): Promise<void> {
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
     * Get the HTML content for the sidebar using template system
     */
    async getCopilotSidebarHTML(): Promise<string> {
        try {
            // Initialize template loader if needed
            if (!this.templateLoader) {
                this.templateLoader = new TemplateLoader(this.context.extensionPath);
            }

            return await this.templateLoader.getSidebarTemplate();
        } catch (_error: unknown) {
            const error = toError(_error);
            aidaLogging('Failed to load template:', error);
            // Return error template from file
            try {
                const errorTemplatePath = path.join(this.context.extensionPath, 'scripts', 'chatbot', 'templates', 'sidebar-error.html');
                const html = fs.readFileSync(errorTemplatePath, 'utf8');
                return html.replace(/\{\{ERROR_MESSAGE\}\}/g, error.message);
            } catch (_e: unknown) {
                // Ultimate fallback
                return `<!DOCTYPE html><html><body style="font-family:var(--vscode-font-family);background:var(--vscode-sideBar-background);color:var(--vscode-errorForeground);padding:20px;text-align:center;"><h3>Template Loading Error</h3><p>${error.message}</p></body></html>`;
            }
        }
    }
}

// Mix in extracted methods from chatbot-agent.js and chatbot-context.js
Object.assign(CopilotSidebarChat.prototype, agentMethods, contextMethods);

// ─── Initialization ──────────────────────────────────────────────────

/**
 * Initialize Chatbot Sidebar (True GitHub Copilot Experience)
 */
function initializeCopilotSidebarChat(context: vscode.ExtensionContext): { sidebarChat: CopilotSidebarChat; provider: AidaChatViewProvider; openSidebarChatCommand: vscode.Disposable } | null {
    try {
        const sidebarChat = new CopilotSidebarChat(context);
        const provider = sidebarChat.registerSidebarView();

        // Register commands
        const openSidebarChatCommand = vscode.commands.registerCommand('aida.openSidebarChat', () => {
            sidebarChat.show();
        });

        aidaLogging('\u2705 AIDA Chatbot Sidebar initialized');

        return {
            sidebarChat,
            provider,
            openSidebarChatCommand
        };

    } catch (error: unknown) {
        aidaLogging('\u274C Failed to initialize Chatbot Sidebar:', error);
        return null;
    }
}

// ─── ES exports ──────────────────────────────────────────────────────

export { CopilotSidebarChat, AidaChatViewProvider, initializeCopilotSidebarChat };

// ─── CJS dual export ─────────────────────────────────────────────────
