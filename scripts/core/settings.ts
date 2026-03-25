/**
 * @module settings
 * @description AIDA logging & debug configuration
 */

import * as vscode from 'vscode';

// Create a dedicated output channel for AIDA
const outputChannel: vscode.OutputChannel = vscode.window.createOutputChannel("AIDA Extension");

/**
 * Custom logging function that logs to the AIDA Output Channel
 * based on the 'aida.debugMode' configuration setting.
 */
function aidaLogging(message: unknown, ...optionalParams: unknown[]): void {
    const config = vscode.workspace.getConfiguration('aida');
    const isDebug = config.get<boolean>('debugMode', false);

    if (isDebug) {
        const timestamp = new Date().toLocaleTimeString();
        const logMessage = `[${timestamp}] ${message}`;

        outputChannel.appendLine(logMessage);

        if (optionalParams.length > 0) {
            const formattedParams = optionalParams.map(param => {
                if (typeof param === 'object') {
                    try {
                        return JSON.stringify(param, null, 2);
                    } catch {
                        return String(param);
                    }
                }
                return String(param);
            }).join(' ');

            outputChannel.appendLine(formattedParams);
        }

        console.log(message, ...optionalParams);
    }
}

/**
 * Whether the extension is running in production mode (debugMode OFF).
 * Converted to getter so it re-evaluates each time instead of being cached once at module load.
 */
function getIsProd(): boolean {
    const config = vscode.workspace.getConfiguration('aida');
    return !config.get<boolean>('debugMode', false);
}

/** @deprecated Use `getIsProd()` instead — this is a cached value evaluated once at load time */
const isProd: boolean = getIsProd();

export { isProd, getIsProd, aidaLogging, outputChannel };

// CommonJS compat for JS consumers
