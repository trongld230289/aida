/**
 * @module review-commands
 * @description Commands for code review: reviewFile, reviewChanges, reviewAllChanges + context variants.
 */

import * as vscode from 'vscode';
import * as path from 'path';

import type { ICopilotSidebarChat } from './chat-commands';
import { toError } from '../core/error-utils';

export function registerReviewCommands(
    context: vscode.ExtensionContext,
    copilotSidebarChat: ICopilotSidebarChat | null
): void {
    // ── Review File (context menu + command palette) ─────────────────
    context.subscriptions.push(
        vscode.commands.registerCommand('aida.reviewFile', async (uri: vscode.Uri) => {
            console.log('🎯 Review File command called', uri);

            const config = vscode.workspace.getConfiguration('aida');
            const useAIDAChatbot = config.get('useAIDAChatbot', false);

            // No tracking here — downstream handlers track:
            //   Copilot path → review-file.ts chat participant
            //   AIDA path → sidebar-participants.ts callParticipant

            try {
                if (useAIDAChatbot) {
                    await vscode.commands.executeCommand('aida.reviewFileContext', uri);
                } else {
                    await vscode.commands.executeCommand('workbench.panel.chat.view.copilot.focus');
                    const filePath = uri?.fsPath ? _relPath(uri) : undefined;
                    await vscode.commands.executeCommand('workbench.action.chat.open', {
                        query: filePath ? `@review-file ${filePath}` : '@review-file'
                    });
                }
            } catch (_error: unknown) {
                const error = toError(_error);
                console.error('Error in reviewFile command:', error);
                vscode.window.showErrorMessage(`Failed to review file: ${error.message}`);
            }
        })
    );

    // ── Review Changes ───────────────────────────────────────────────
    context.subscriptions.push(
        vscode.commands.registerCommand('aida.reviewChanges', async (uri: vscode.Uri) => {
            console.log('🎯 Review Changes command called', uri);

            const config = vscode.workspace.getConfiguration('aida');
            const useAIDAChatbot = config.get('useAIDAChatbot', false);

            // No tracking here — downstream handlers track:
            //   Copilot path → review-changes.ts chat participant
            //   AIDA path → sidebar-participants.ts callParticipant

            try {
                if (useAIDAChatbot) {
                    await vscode.commands.executeCommand('aida.reviewChangesContext', uri);
                } else {
                    await vscode.commands.executeCommand('workbench.panel.chat.view.copilot.focus');
                    const filePath = uri?.fsPath ? _relPath(uri) : undefined;
                    await vscode.commands.executeCommand('workbench.action.chat.open', {
                        query: filePath ? `@review-changes ${filePath}` : '@review-changes'
                    });
                }
            } catch (_error: unknown) {
                const error = toError(_error);
                console.error('Error in reviewChanges command:', error);
                vscode.window.showErrorMessage(`Failed to review changes: ${error.message}`);
            }
        })
    );

    // ── Review All Changes ───────────────────────────────────────────
    context.subscriptions.push(
        vscode.commands.registerCommand('aida.reviewAllChanges', async (uri: vscode.Uri) => {
            console.log('🎯 Review All Changes command called', uri);

            const config = vscode.workspace.getConfiguration('aida');
            const useAIDAChatbot = config.get('useAIDAChatbot', false);

            // No tracking here — downstream handlers track:
            //   Copilot path → review-all-changes.ts chat participant
            //   AIDA path → sidebar-participants.ts callParticipant

            try {
                if (useAIDAChatbot) {
                    await vscode.commands.executeCommand('aida.reviewAllChangesContext', uri);
                } else {
                    await vscode.commands.executeCommand('workbench.panel.chat.view.copilot.focus');
                    await vscode.commands.executeCommand('workbench.action.chat.open', {
                        query: '@review-all-changes'
                    });
                }
            } catch (_error: unknown) {
                const error = toError(_error);
                console.error('Error in reviewAllChanges command:', error);
                vscode.window.showErrorMessage(`Failed to review all changes: ${error.message}`);
            }
        })
    );

    // ── Context Commands (AIDA sidebar direct) ───────────────────────
    context.subscriptions.push(
        vscode.commands.registerCommand('aida.reviewFileContext', async (uri: vscode.Uri) => {
            console.log('🎯 AIDA Review File Context command called', uri);
            try {
                if (!copilotSidebarChat) {
                    vscode.window.showErrorMessage('AIDA Sidebar Chat is not initialized');
                    return;
                }
                copilotSidebarChat.show();
                const filePath = uri?.fsPath ? _relPath(uri) : undefined;
                await copilotSidebarChat.sendMessage(filePath ? `@review-file ${filePath}` : '@review-file');
            } catch (_error: unknown) {
                const error = toError(_error);
                console.error('Error in reviewFileContext command:', error);
                vscode.window.showErrorMessage('Failed to review file: ' + error.message);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('aida.reviewChangesContext', async (uri: vscode.Uri) => {
            console.log('🎯 AIDA Review Changes Context command called', uri);
            try {
                if (!copilotSidebarChat) {
                    vscode.window.showErrorMessage('AIDA Sidebar Chat is not initialized');
                    return;
                }
                copilotSidebarChat.show();
                const filePath = uri?.fsPath ? _relPath(uri) : undefined;
                await copilotSidebarChat.sendMessage(filePath ? `@review-changes ${filePath}` : '@review-changes');
            } catch (_error: unknown) {
                const error = toError(_error);
                console.error('Error in reviewChangesContext command:', error);
                vscode.window.showErrorMessage('Failed to review changes: ' + error.message);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('aida.reviewAllChangesContext', async (uri: vscode.Uri) => {
            console.log('🎯 AIDA Review All Changes Context command called', uri);
            try {
                if (!copilotSidebarChat) {
                    vscode.window.showErrorMessage('AIDA Sidebar Chat is not initialized');
                    return;
                }
                copilotSidebarChat.show();
                await copilotSidebarChat.sendMessage('@review-all-changes');
            } catch (_error: unknown) {
                const error = toError(_error);
                console.error('Error in reviewAllChangesContext command:', error);
                vscode.window.showErrorMessage('Failed to review all changes: ' + error.message);
            }
        })
    );

    // ── Help commands ────────────────────────────────────────────────
    context.subscriptions.push(
        vscode.commands.registerCommand('aida.showChangesHelp', async () => {
            vscode.window.showInformationMessage('Code Review Helper - @review-changes', {
                modal: false,
                detail: `Usage examples:\n• @review-changes - Review git changes for current file\n• @review-changes src/components/MyComponent.ts - Review specific file changes\n• Use @review-file to review entire file content instead of just changes`
            });
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('aida.showFileHelp', async () => {
            vscode.window.showInformationMessage('Code Review Helper - @review-file', {
                modal: false,
                detail: `Usage examples:\n• @review-file - Review currently active file\n• @review-file src/components/MyComponent.ts - Review specific file\n• Use @review-changes to review only git changes instead of entire file`
            });
        })
    );
}

/** Convert an absolute URI to a workspace-relative path. */
function _relPath(uri: vscode.Uri): string {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
    if (workspaceFolder) {
        return path.relative(workspaceFolder.uri.fsPath, uri.fsPath);
    }
    return uri.fsPath;
}
