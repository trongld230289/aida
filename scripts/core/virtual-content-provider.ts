import * as vscode from 'vscode';

/**
 * VirtualContentProvider
 * Implements a read-only file system for in-memory content.
 * Used to analyze file content (like PR patches) without creating "Untitled" tabs.
 * Scheme: aida-memory
 */
class VirtualContentProvider {
    _onDidChange: import("vscode").EventEmitter<import("vscode").Uri>;
    onDidChange: import("vscode").Event<import("vscode").Uri>;
    fileContentMap: Map<string, string>;
    constructor() {
        // Event emitter to notify VS Code when content changes
        this._onDidChange = new vscode.EventEmitter();
        this.onDidChange = this._onDidChange.event;
        
        // Store content in memory: path -> content
        this.fileContentMap = new Map();
    }

    /**
     * Required method for TextDocumentContentProvider
     * Returns the content for a given URI
     */
    provideTextDocumentContent(uri: vscode.Uri) {
        // uri.path comes with a leading slash, e.g., /src/app.ts
        return this.fileContentMap.get(uri.path) || '';
    }

    /**
     * Store content for a file path and return the URI
     * @param {string} filePath - The file path (e.g., src/app.ts)
     * @param {string} content - The file content
     * @returns {vscode.Uri} - The URI to access this content
     */
    setFileContent(filePath: string, content: string) {
        // Ensure path starts with / for URI consistency
        // Windows paths might need normalization, but for virtual URIs we want forward slashes
        let normalizedPath = filePath.replace(/\\/g, '/');
        if (!normalizedPath.startsWith('/')) {
            normalizedPath = '/' + normalizedPath;
        }
        
        this.fileContentMap.set(normalizedPath, content);
        
        const uri = vscode.Uri.parse(`aida-memory:${normalizedPath}`);
        
        // Notify listeners that content has changed (updates the editor if open)
        this._onDidChange.fire(uri);
        
        return uri;
    }

    /**
     * Remove content from memory
     * @param {string} filePath 
     */
    clearFileContent(filePath: string) {
        let normalizedPath = filePath.replace(/\\/g, '/');
        if (!normalizedPath.startsWith('/')) {
            normalizedPath = '/' + normalizedPath;
        }
        this.fileContentMap.delete(normalizedPath);
    }
    
    /**
     * Clear all stored content
     */
    clearAll() {
        this.fileContentMap.clear();
    }
}

// Export a singleton instance to be shared across the extension
const virtualContentProvider = new VirtualContentProvider();

// ES exports
export { VirtualContentProvider, virtualContentProvider };
