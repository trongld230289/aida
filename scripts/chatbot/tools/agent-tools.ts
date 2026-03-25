/**
 * @module chatbot/tools/agent-tools
 * @description VS Code file API integration tools for the agent.
 * Extracted from chatbot-agent.ts during Sprint 3 refactoring.
 */

import * as vscode from 'vscode';
import { toError } from '../../core/error-utils';

export const agentToolsMethods = {

    getAgentTools() {
        return {
            createFile: async (path: string, content: string) => {
                try {
                    const uri = vscode.Uri.file(path);
                    await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf8'));
                    return { success: true, message: `Created file: ${path}` };
                } catch (_error: unknown) {
                    const error = toError(_error);
                    return { success: false, error: error.message };
                }
            },

            editFile: async (path: string, oldText: string, newText: string) => {
                try {
                    const document = await vscode.workspace.openTextDocument(path);
                    const editor = await vscode.window.showTextDocument(document);

                    const text = document.getText();
                    const index = text.indexOf(oldText);
                    if (index === -1) {
                        return { success: false, error: 'Text not found in file' };
                    }

                    const startPos = document.positionAt(index);
                    const endPos = document.positionAt(index + oldText.length);
                    const range = new vscode.Range(startPos, endPos);

                    await editor.edit(editBuilder => {
                        editBuilder.replace(range, newText);
                    });

                    return { success: true, message: `Edited file: ${path}` };
                } catch (_error: unknown) {
                    const error = toError(_error);
                    return { success: false, error: error.message };
                }
            },

            createDirectory: async (path: string) => {
                try {
                    const uri = vscode.Uri.file(path);
                    await vscode.workspace.fs.createDirectory(uri);
                    return { success: true, message: `Created directory: ${path}` };
                } catch (_error: unknown) {
                    const error = toError(_error);
                    return { success: false, error: error.message };
                }
            },

            runTerminalCommand: async (command: string) => {
                try {
                    const terminal = vscode.window.createTerminal('AIDA Agent');
                    terminal.sendText(command);
                    terminal.show();
                    return { success: true, message: `Executed: ${command}` };
                } catch (_error: unknown) {
                    const error = toError(_error);
                    return { success: false, error: error.message };
                }
            },

            openFile: async (path: string, line = 1) => {
                try {
                    const document = await vscode.workspace.openTextDocument(path);
                    const editor = await vscode.window.showTextDocument(document);

                    if (line > 1) {
                        const position = new vscode.Position(line - 1, 0);
                        editor.selection = new vscode.Selection(position, position);
                        editor.revealRange(new vscode.Range(position, position));
                    }

                    return { success: true, message: `Opened file: ${path}` };
                } catch (_error: unknown) {
                    const error = toError(_error);
                    return { success: false, error: error.message };
                }
            },

            readFile: async (path: string) => {
                try {
                    const uri = vscode.Uri.file(path);
                    const content = await vscode.workspace.fs.readFile(uri);
                    return { success: true, content: content.toString() };
                } catch (_error: unknown) {
                    const error = toError(_error);
                    return { success: false, error: error.message };
                }
            },

            listFiles: async (directoryPath: string) => {
                try {
                    const uri = vscode.Uri.file(directoryPath);
                    const files = await vscode.workspace.fs.readDirectory(uri);
                    return { success: true, files: files };
                } catch (_error: unknown) {
                    const error = toError(_error);
                    return { success: false, error: error.message };
                }
            }
        };
    },

};
