/**
 * @module dependency-commands
 * @description Command for dependency analysis (right-click context menu).
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { trackEvent } from '../tracking/usage-tracking';
import { TrackingEvent, TrackingSource } from '../tracking/tracking-enums';
import { toError } from '../core/error-utils';

export function registerDependencyCommands(
    context: vscode.ExtensionContext,
    analyzeFileDependency: (uri: vscode.Uri) => Promise<void>
): void {
    context.subscriptions.push(
        vscode.commands.registerCommand('aida.analyzeDependency', async (uri: vscode.Uri) => {
            console.log('🎯 Analyze File Dependency command called', uri);

            void trackEvent(TrackingEvent.ANALYZE_DEPENDENCY, {
                fileType: uri?.fsPath ? path.extname(uri.fsPath) : 'unknown',
                source: TrackingSource.CONTEXT_MENU
            });

            try {
                if (!uri && vscode.window.activeTextEditor) {
                    uri = vscode.window.activeTextEditor.document.uri;
                }

                if (uri) {
                    await analyzeFileDependency(uri);
                } else {
                    vscode.window.showErrorMessage('Please open a file to analyze dependencies.');
                }
            } catch (_error: unknown) {
                const error = toError(_error);
                console.error('Error in analyzeFileDependency command:', error);
                vscode.window.showErrorMessage(`Failed to analyze file dependency: ${error.message}`);
            }
        })
    );
}
