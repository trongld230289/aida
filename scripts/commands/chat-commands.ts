/**
 * @module chat-commands
 * @description Commands for AIDA sidebar chat: open, clear, settings, close.
 */

import * as vscode from 'vscode';

export interface ICopilotSidebarChat {
    show(): void;
    chatHistory: unknown[];
    saveChatHistory(): void;
    webviewView: vscode.WebviewView | null;
    sendMessage(message: string): Promise<void>;
}

export function registerChatCommands(
    context: vscode.ExtensionContext,
    copilotSidebarChat: ICopilotSidebarChat | null
): void {
    // Open AIDA sidebar chat
    context.subscriptions.push(
        vscode.commands.registerCommand('aida.openChat', async () => {
            if (copilotSidebarChat) {
                copilotSidebarChat.show();
            } else {
                vscode.window.showErrorMessage('AIDA Sidebar Chat is not initialized. Please check the logs for errors.');
            }
        })
    );

    // Clear chat history
    context.subscriptions.push(
        vscode.commands.registerCommand('aida.clearChatSidebar', async () => {
            if (copilotSidebarChat) {
                copilotSidebarChat.chatHistory = [];
                copilotSidebarChat.saveChatHistory();
                if (copilotSidebarChat.webviewView) {
                    copilotSidebarChat.webviewView.webview.postMessage({ type: 'clearChat' });
                }
            }
        })
    );

    // Open AIDA settings
    context.subscriptions.push(
        vscode.commands.registerCommand('aida.openSettingsSidebar', async () => {
            vscode.commands.executeCommand('workbench.action.openSettings', 'aida');
        })
    );

    // Close sidebar
    context.subscriptions.push(
        vscode.commands.registerCommand('aida.closeChatSidebar', async () => {
            vscode.commands.executeCommand('workbench.action.closeSidebar');
        })
    );
}
