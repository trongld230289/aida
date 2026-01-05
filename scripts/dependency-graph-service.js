const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const { VSCodeApiDependencyAnalyzer } = require('./dependency-graph/vscode-api-analyzer');
const { aidaLogging } = require('./settings');

const CACHE_VERSION = '1.1';

class DependencyGraphService {
    constructor(workspaceRoot) {
        this.workspaceRoot = workspaceRoot;
        this.vscodeAnalyzer = new VSCodeApiDependencyAnalyzer(workspaceRoot);
        this.fullGraph = null;
        this.cacheFilePath = path.join(workspaceRoot, '.vscode', 'dependency-cache.json');

        // 🔥 NEW: Listen for incremental updates
        this.vscodeAnalyzer.onGraphUpdate = () => {
            this.handleGraphUpdate();
        };
    }

    isGraphReady() {
        return this.vscodeAnalyzer && this.vscodeAnalyzer.isReady;
    }

    /**
     * Handle graph updates with debounce
     */
    handleGraphUpdate() {
        if (this.saveTimeout) clearTimeout(this.saveTimeout);
        this.saveTimeout = setTimeout(() => {
            aidaLogging('💾 Graph updated, saving cache...');
            this.fullGraph = this.vscodeAnalyzer.buildGraphResult();
            this.saveCache();
        }, 2000); // Wait 2 seconds after last change
    }

    /**
     * Check if cache exists
     */
    hasCache() {
        return fs.existsSync(this.cacheFilePath);
    }

    /**
     * Save graph to disk
     */
    saveCache() {
        if (!this.fullGraph) return;

        try {
            const cacheDir = path.dirname(this.cacheFilePath);
            if (!fs.existsSync(cacheDir)) {
                fs.mkdirSync(cacheDir, { recursive: true });
            }

            // Generate report to ensure compatibility with dependency.js
            const report = this.vscodeAnalyzer.generateReport(this.fullGraph);

            fs.writeFileSync(this.cacheFilePath, JSON.stringify({
                version: CACHE_VERSION,
                timestamp: Date.now(),
                graph: this.fullGraph,
                report: report // 🔥 Save report
            }, null, 2));

            aidaLogging(`✅ Saved graph cache: ${this.fullGraph.nodes.length} nodes`);
        } catch (error) {
            aidaLogging(`⚠️ Cache write error: ${error.message}`);
        }
    }

    /**
     * Get or build full workspace graph
     */
    async ensureFullGraph() {
        if (this.fullGraph) {
            aidaLogging('✅ Using cached full graph');
            return this.fullGraph;
        }

        // Try load from cache
        if (fs.existsSync(this.cacheFilePath)) {
            try {
                const cacheData = JSON.parse(fs.readFileSync(this.cacheFilePath, 'utf8'));
                if (cacheData.version === CACHE_VERSION && cacheData.graph) {
                    this.fullGraph = cacheData.graph;

                    // 🔥 NEW: Restore analyzer state from cache so Watcher works
                    this.vscodeAnalyzer.loadFromCache(this.fullGraph);

                    aidaLogging(`✅ Loaded graph from cache: ${this.fullGraph.nodes.length} nodes, ${this.fullGraph.edges.length} edges`);
                    return this.fullGraph;
                }
            } catch (error) {
                aidaLogging(`⚠️ Cache read error: ${error.message}`);
            }
        }

        // Build new graph
        aidaLogging('🔨 Building new dependency graph...');
        this.fullGraph = await this.buildFullGraph();

        // Save cache
        this.saveCache();

        return this.fullGraph;
    }

    /**
     * Update a single file in the graph
     */
    async updateFile(uri) {
        if (this.vscodeAnalyzer) {
            await this.vscodeAnalyzer.processFile(uri);
        }
    }

    /**
     * Remove a file from the graph
     */
    removeFile(uri) {
        if (this.vscodeAnalyzer) {
            // Not implemented in analyzer yet, but good to have the hook
            // this.vscodeAnalyzer.removeFile(uri);
        }
    }

    /**
     * Build full workspace dependency graph
     */
    async buildFullGraph() {
        aidaLogging('📊 Analyzing workspace dependencies...');

        try {
            const graph = await this.vscodeAnalyzer.analyze();
            aidaLogging(`✅ Built graph: ${graph.nodes.length} nodes, ${graph.edges.length} edges`);
            return graph;
        } catch (error) {
            console.error('❌ Error building graph:', error);
            throw error;
        }
    }

    /**
     * Get the language configuration from the analyzer
     */
    getLanguageConfig() {
        return this.vscodeAnalyzer.languageConfig;
    }
}

module.exports = { DependencyGraphService };
