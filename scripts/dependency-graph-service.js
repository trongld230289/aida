const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const { VSCodeApiDependencyAnalyzer } = require('./dependency-graph/vscode-api-analyzer');
const { aidaLogging } = require('./settings');

const CACHE_VERSION = '1.0';

class DependencyGraphService {
    constructor(workspaceRoot) {
        this.workspaceRoot = workspaceRoot;
        this.vscodeAnalyzer = new VSCodeApiDependencyAnalyzer();
        this.fullGraph = null;
        this.cacheFilePath = path.join(workspaceRoot, '.vscode', 'dependency-cache.json');
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
        try {
            const cacheDir = path.dirname(this.cacheFilePath);
            if (!fs.existsSync(cacheDir)) {
                fs.mkdirSync(cacheDir, { recursive: true });
            }

            fs.writeFileSync(this.cacheFilePath, JSON.stringify({
                version: CACHE_VERSION,
                timestamp: Date.now(),
                graph: this.fullGraph
            }, null, 2));

            aidaLogging(`✅ Saved graph cache: ${this.fullGraph.nodes.length} nodes`);
        } catch (error) {
            aidaLogging(`⚠️ Cache write error: ${error.message}`);
        }

        return this.fullGraph;
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
