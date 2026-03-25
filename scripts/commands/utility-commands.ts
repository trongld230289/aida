/**
 * @module utility-commands
 * @description Misc commands: Azure DevOps setup, show models, confirmReviewDocs, enhanced review options.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { ctx } from '../core/aida-context';

import type { ICopilotSidebarChat } from './chat-commands';
import { toError } from '../core/error-utils';

export function registerUtilityCommands(
    context: vscode.ExtensionContext,
    copilotSidebarChat: ICopilotSidebarChat | null,
    deps: {
        setupAzureDevOpsSettings: () => Promise<void>;
        showAvailableModels: () => Promise<void>;
        getBusinessDocumentFolders: (folder: vscode.WorkspaceFolder) => Promise<any[]>;
    }
): void {
    // ── Azure DevOps Setup ───────────────────────────────────────────
    context.subscriptions.push(
        vscode.commands.registerCommand('aida.setupAzureDevOps', async () => {
            await deps.setupAzureDevOpsSettings();
        })
    );

    // ── Show available AI models ─────────────────────────────────────
    context.subscriptions.push(
        vscode.commands.registerCommand('aida.showAvailableModels', deps.showAvailableModels)
    );

    // ── Quick Review (confirm docs) ──────────────────────────────────
    context.subscriptions.push(
        vscode.commands.registerCommand('aida.confirmReviewDocs', async (filePath: string, chatCommand = 'review-changes', keepSelectedDocs = false) => {
            if (!keepSelectedDocs) {
                ctx.selectedBusinessDocs = [];
            }

            console.log(`🚀 Quick Review button clicked - set selectedBusinessDocs = [] (command: ${chatCommand})`);

            const aidaSidebarActive = copilotSidebarChat?.webviewView?.visible;

            if (aidaSidebarActive && copilotSidebarChat) {
                copilotSidebarChat.show();
                await copilotSidebarChat.sendMessage(`@${chatCommand} ${filePath}`);
            } else {
                await vscode.commands.executeCommand('workbench.panel.chat.view.copilot.focus');
                await vscode.commands.executeCommand('workbench.action.chat.open', {
                    query: `@${chatCommand} ${filePath}`
                });
            }
        })
    );

    // ── Enhanced Review Options ──────────────────────────────────────
    context.subscriptions.push(
        vscode.commands.registerCommand('aida.showEnhancedReviewOptions', async (filePath: string, chatCommand = 'review-changes') => {
            try {
                console.log(`📚 Showing enhanced review options for: ${filePath}, command: ${chatCommand}`);
                await _showEnhancedReviewOptionsInChat(filePath, chatCommand, copilotSidebarChat, deps.getBusinessDocumentFolders);
            } catch (_error: unknown) {
                const error = toError(_error);
                console.error('❌ Error showing enhanced review options:', error);
                vscode.window.showErrorMessage(`Failed to show enhanced options: ${error.message}`);
            }
        })
    );
}

// ── Helper ───────────────────────────────────────────────────────────

async function _showEnhancedReviewOptionsInChat(
    filePath: string,
    chatCommand: string,
    copilotSidebarChat: ICopilotSidebarChat | null,
    getBusinessDocumentFolders: (folder: vscode.WorkspaceFolder) => Promise<any[]>
): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        vscode.window.showErrorMessage('❌ No workspace found for business documents');
        return;
    }

    const businessDocs = await getBusinessDocumentFolders(workspaceFolder);
    if (businessDocs.length === 0) {
        vscode.window.showInformationMessage('⚠️ No business-docs folders found for enhanced review.');
        return;
    }

    function generateDescription(folder: Record<string, any>): string {
        try {
            const files = folder.getFiles();
            if (files.length === 0) return `: 📋 (no documents)`;

            const previewFiles = files.slice(0, 3);
            const titles = previewFiles.map((file: Record<string, any>) => {
                const fileName = file.name.replace('.md', '').replace(/-/g, ' ');
                return fileName.charAt(0).toUpperCase() + fileName.slice(1);
            });

            const titlesList = titles.join(', ');
            const moreText = files.length > 3 ? ` (+${files.length - 3} more)` : '';
            return `: 📋 ${titlesList}${moreText}`;
        } catch {
            return `📋 ${folder.displayName}`;
        }
    }

    const reviewDisplayName = chatCommand === 'review-file' ? 'file review' : 'review';
    const titleText = chatCommand === 'review-file' ? '📚 Enhanced File Review Options' : '📚 Enhanced Review Options';

    const items = businessDocs.map((folder) => ({
        label: `📁 ${folder.displayName}`,
        description: generateDescription(folder),
        detail: `Include ${folder.displayName} documentation in ${reviewDisplayName}`,
        categoryName: folder.name,
        categoryDisplayName: folder.displayName
    }));

    const selected = await vscode.window.showQuickPick(items, {
        placeHolder: `📚 Select business docs for enhanced review, or select none for quick review of ${path.basename(filePath)}`,
        title: titleText,
        canPickMany: true,
        ignoreFocusOut: false
    });

    if (!selected) return;

    let selectedCategories: any[] = [];
    if (selected.length > 0) {
        selectedCategories = selected.map((item) => ({
            name: item.categoryName,
            displayName: item.categoryDisplayName,
            path: businessDocs.find((f) => f.name === item.categoryName)?.path,
            relativePath: businessDocs.find((f) => f.name === item.categoryName)?.relativePath
        }));
    }

    ctx.selectedBusinessDocs = selectedCategories;
    console.log(`🎯 Set selectedBusinessDocs for ${selectedCategories.length > 0 ? 'Enhanced' : 'Quick'} ${chatCommand} Review:`, selectedCategories);

    const aidaSidebarActive = copilotSidebarChat?.webviewView?.visible;
    const chatText = `@${chatCommand} ${filePath}`;

    if (aidaSidebarActive && copilotSidebarChat) {
        copilotSidebarChat.show();
        await copilotSidebarChat.sendMessage(chatText);
    } else {
        await vscode.commands.executeCommand('workbench.panel.chat.view.copilot.focus');
        await vscode.commands.executeCommand('workbench.action.chat.open', { query: chatText });
    }
}
