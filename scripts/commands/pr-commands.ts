/**
 * @module pr-commands
 * @description Commands for PR review and diff viewing.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { ctx } from '../core/aida-context';
import { toError } from '../core/error-utils';

export function registerPrCommands(
    context: vscode.ExtensionContext,
    getMonacoWebviewContent: (diffData: Record<string, any>, panel: vscode.WebviewPanel, ctx: vscode.ExtensionContext) => Promise<string>
): void {
    // ── View PR Diff in Monaco webview ───────────────────────────────
    context.subscriptions.push(
        vscode.commands.registerCommand('aida.viewPrDiff', async (diffId: string) => {
            try {
                console.log(`📄 Opening diff webview for: ${diffId}`);

                const diffData = ctx.prDiffCache?.[diffId] as any;
                if (!diffData) {
                    vscode.window.showErrorMessage('Diff data not found. Please refresh the PR review.');
                    return;
                }

                const panel = vscode.window.createWebviewPanel(
                    'prDiffView',
                    `Diff: ${path.basename(diffData.path)}`,
                    vscode.ViewColumn.One,
                    {
                        enableScripts: true,
                        retainContextWhenHidden: true,
                        localResourceRoots: [
                            vscode.Uri.file(path.join(context.extensionPath, 'dist', 'monaco-editor'))
                        ]
                    }
                );

                // Handle file switching messages from webview
                panel.webview.onDidReceiveMessage(async (message: Record<string, string>) => {
                    console.log('📨 Received message from webview:', message);

                    if (message.type === 'openFileInMonaco') {
                        try {
                            const filePath = message.filePath;
                            console.log('🔄 Loading new file for Monaco:', filePath);

                            const cache = ctx.prDiffCache;
                            let newDiffData: Record<string, any> | null = null;

                            if (cache) {
                                const { provider, prId } = diffData;
                                let prPrefix: string;

                                if (provider === 'github') {
                                    prPrefix = `github_${prId}_`;
                                } else if (provider === 'gitlab') {
                                    prPrefix = `gitlab_${prId}_`;
                                } else {
                                    prPrefix = `azure_${prId}_`;
                                }

                                const cacheKeys = Object.keys(cache);
                                for (const key of cacheKeys) {
                                    if (key.startsWith(prPrefix) && (cache[key] as any)?.path === filePath) {
                                        newDiffData = cache[key] as Record<string, any> | null;
                                        break;
                                    }
                                }
                            }

                            if (newDiffData) {
                                panel.title = `Diff: ${path.basename(filePath!)}`;
                                panel.webview.html = await getMonacoWebviewContent(newDiffData, panel, context);
                                console.log('✅ Successfully loaded new file:', filePath);
                            } else {
                                console.error('❌ File not found in cache:', filePath);
                                vscode.window.showErrorMessage(`File not found: ${filePath}`);
                            }
                        } catch (_error: unknown) {
                            const error = toError(_error);
                            console.error('❌ Error loading file:', error);
                            vscode.window.showErrorMessage(`Failed to load file: ${error.message}`);
                        }
                    }
                });

                panel.webview.html = await getMonacoWebviewContent(diffData, panel, context);

            } catch (_error: unknown) {
                const error = toError(_error);
                console.error('Error opening diff webview:', error);
                vscode.window.showErrorMessage(`Failed to open diff: ${error.message}`);
            }
        })
    );
}
