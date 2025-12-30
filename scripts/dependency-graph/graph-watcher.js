const vscode = require('vscode');
const { aidaLogging } = require('../settings');

/**
 * @file graph-watcher.js
 * @description Manages file system watching for the Dependency Graph.
 * 
 * Functionality:
 * 1. Uses `vscode.FileSystemWatcher` to detect file changes (Create, Update, Delete).
 * 2. Supports external changes (e.g., git pull, external editors).
 * 3. Triggers incremental graph updates via `dependencyService`.
 * 4. Filters out ignored directories (.git, node_modules, etc.).
 * 
 * Lifecycle:
 * - startWatching(): Activates watcher when graph is ready.
 * - stopWatching(): Disposes watcher to free resources.
 */
class GraphWatcher {
    /**
     * @param {Object} dependencyService - The service that manages the graph
     */
    constructor(dependencyService) {
        this.dependencyService = dependencyService;
        this.disposables = [];
        this.isWatching = false;
    }

    /**
     * Start listening to file changes
     */
    startWatching() {
        if (this.isWatching) return;
        
        this.isWatching = true;
        aidaLogging('👀 Dependency Graph Watcher started (FileSystemWatcher)');

        // 🔥 NEW: Use FileSystemWatcher to catch external changes (git pull, etc.)
        // Watch all files in workspace
        const watcher = vscode.workspace.createFileSystemWatcher('**/*');
        this.disposables.push(watcher);

        // 1. File Created
        watcher.onDidCreate(async (uri) => {
            if (this.shouldIgnore(uri)) return;
            if (this.dependencyService.isGraphReady()) {
                aidaLogging(`✨ File created (FS): ${uri.fsPath}`);
                await this.dependencyService.updateFile(uri);
            }
        });

        // 2. File Changed
        watcher.onDidChange(async (uri) => {
            if (this.shouldIgnore(uri)) return;
            if (this.dependencyService.isGraphReady()) {
                aidaLogging(`📝 File changed (FS): ${uri.fsPath}`);
                await this.dependencyService.updateFile(uri);
            }
        });

        // 3. File Deleted
        watcher.onDidDelete(async (uri) => {
            if (this.shouldIgnore(uri)) return;
            if (this.dependencyService.isGraphReady()) {
                aidaLogging(`🗑️ File deleted (FS): ${uri.fsPath}`);
                this.dependencyService.removeFile(uri);
            }
        });
    }

    /**
     * Check if file should be ignored (e.g. .git, node_modules)
     */
    shouldIgnore(uri) {
        const pathStr = uri.fsPath;
        return pathStr.includes('.git') || 
               pathStr.includes('node_modules') || 
               pathStr.includes('.vscode') ||
               pathStr.includes('dist') ||
               pathStr.includes('out') ||
               pathStr.includes('coverage');
    }

    /**
     * Stop listening
     */
    stopWatching() {
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
        this.isWatching = false;
        aidaLogging('zzz Dependency Graph Watcher stopped');
    }
    
    dispose() {
        this.stopWatching();
    }
}

module.exports = { GraphWatcher };
