const vscode = require('vscode');

// Create a dedicated output channel for AIDA
const outputChannel = vscode.window.createOutputChannel("AIDA Extension");

/**
 * Custom logging function that logs to the AIDA Output Channel
 * based on the 'aida.debugMode' configuration setting.
 * 
 * @param {any} message - The message to log
 * @param {...any} optionalParams - Additional parameters to log
 */
function aidaLogging(message, ...optionalParams) {
    // Read configuration from VS Code settings
    const config = vscode.workspace.getConfiguration('aida');
    const isDebug = config.get('debugMode', false);

    if (isDebug) {
        // Format log with timestamp
        const timestamp = new Date().toLocaleTimeString();
        const logMessage = `[${timestamp}] ${message}`;
        
        // Write to Output Channel
        outputChannel.appendLine(logMessage);
        
        if (optionalParams.length > 0) {
            // Handle objects/arrays gracefully
            const formattedParams = optionalParams.map(param => {
                if (typeof param === 'object') {
                    try {
                        return JSON.stringify(param, null, 2);
                    } catch (e) {
                        return String(param);
                    }
                }
                return String(param);
            }).join(' ');
            
            outputChannel.appendLine(formattedParams);
        }
        
        // Also log to console for DevTools debugging if needed
        console.log(message, ...optionalParams);
    }
}

// Export isProd for backward compatibility if needed, 
// but logic should rely on aidaLogging now.
// We map isProd to !debugMode for compatibility.
const config = vscode.workspace.getConfiguration('aida');
const isProd = !config.get('debugMode', false);

module.exports = {
    isProd,
    aidaLogging,
    outputChannel
};
