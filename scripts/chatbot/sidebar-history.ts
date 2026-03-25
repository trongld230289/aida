/**
 * @module sidebar-history
 * @description Chat history management – load, save, clear, restore.
 * Extracted from chatbot-sidebar.ts during Phase 6 refactoring.
 */

import * as vscode from 'vscode';
import { aidaLogging } from '../core/settings';
import type { IFileContext } from './interfaces/chat-host.interface';

// ─── Types ───────────────────────────────────────────────────────────

/** Serializable chat message stored in history */
export interface IChatHistoryMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp?: number | Date;
    images?: string[];
    mode?: string;
    model?: string;
    fileContext?: IFileContext | Record<string, any> | null;
}

// ─── Workspace Key ───────────────────────────────────────────────────

/**
 * Get workspace-specific key for storage
 */
export function getWorkspaceSpecificKey(baseKey: string): string {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
        // Use workspace folder name and path hash for unique identification
        const workspacePath = workspaceFolders[0]!.uri.fsPath;
        const workspaceName = workspaceFolders[0]!.name;

        // Create a simple hash of the workspace path for uniqueness
        const pathHash = Buffer.from(workspacePath).toString('base64').substring(0, 8);
        return `${baseKey}.${workspaceName}.${pathHash}`;
    }

    // Fallback to global key if no workspace
    return `${baseKey}.global`;
}

// ─── Load ────────────────────────────────────────────────────────────

/**
 * Load chat history from workspace-specific storage
 */
export function loadChatHistory(
    context: vscode.ExtensionContext
): { chatHistory: IChatHistoryMessage[]; messageHistory: string[] } {
    try {
        const chatKey = getWorkspaceSpecificKey('aida.chatHistory');
        const messageKey = getWorkspaceSpecificKey('aida.messageHistory');

        const savedHistory = context.globalState.get<IChatHistoryMessage[]>(chatKey, []);
        const savedMessageHistory = context.globalState.get<string[]>(messageKey, []);

        // Limit history to last 50 messages to prevent memory issues
        const chatHistory = savedHistory.slice(-50);
        const messageHistory = savedMessageHistory.slice(-20);

        const workspaceName = vscode.workspace.workspaceFolders?.[0]?.name || 'global';
        aidaLogging(`\u{1F4DA} Loaded ${chatHistory.length} chat messages for workspace: ${workspaceName}`);
        return { chatHistory, messageHistory };
    } catch (error: unknown) {
        aidaLogging('Failed to load chat history:', error);
        return { chatHistory: [], messageHistory: [] };
    }
}

// ─── Save ────────────────────────────────────────────────────────────

/**
 * Save chat history to workspace-specific persistent storage
 */
export function saveChatHistory(
    context: vscode.ExtensionContext,
    chatHistory: IChatHistoryMessage[],
    messageHistory: string[]
): void {
    try {
        // Save only essential data to prevent storage bloat
        const historyToSave = chatHistory.map(msg => ({
            role: msg.role,
            content: msg.content,
            timestamp: msg.timestamp,
            images: msg.images, // Include images to preserve image-based conversations
            mode: msg.mode,     // Include mode for context
            model: msg.model    // Include model for context
        }));

        const chatKey = getWorkspaceSpecificKey('aida.chatHistory');
        const messageKey = getWorkspaceSpecificKey('aida.messageHistory');

        context.globalState.update(chatKey, historyToSave);
        context.globalState.update(messageKey, messageHistory);

        const workspaceName = vscode.workspace.workspaceFolders?.[0]?.name || 'global';
        aidaLogging(`\u{1F4BE} Saved ${historyToSave.length} chat messages for workspace: ${workspaceName}`);
    } catch (error: unknown) {
        aidaLogging('Failed to save chat history:', error);
    }
}

// ─── Clear ───────────────────────────────────────────────────────────

/**
 * Clear chat history from workspace-specific storage
 */
export function clearChatHistoryStorage(context: vscode.ExtensionContext): void {
    const chatKey = getWorkspaceSpecificKey('aida.chatHistory');
    const messageKey = getWorkspaceSpecificKey('aida.messageHistory');

    context.globalState.update(chatKey, []);
    context.globalState.update(messageKey, []);

    const workspaceName = vscode.workspace.workspaceFolders?.[0]?.name || 'global';
    aidaLogging(`\u{1F5D1}\uFE0F Chat history cleared for workspace: ${workspaceName}`);
}

// ─── Restore ─────────────────────────────────────────────────────────

/**
 * Restore workspace chat history to webview
 */
export function restoreWorkspaceChatHistory(
    webviewView: vscode.WebviewView | null,
    chatHistory: IChatHistoryMessage[]
): void {
    if (!webviewView || !chatHistory || chatHistory.length === 0) {
        return;
    }

    aidaLogging(`\u{1F4DA} Restoring ${chatHistory.length} workspace chat messages`);

    for (const message of chatHistory) {
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

// ─── CJS dual export ─────────────────────────────────────────────────
