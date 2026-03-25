import * as _vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { VSCodeApiDependencyAnalyzer } from './graph/vscode-api-analyzer';
import { aidaLogging } from '../core/settings';
import type { IGraphCacheData } from './interfaces/analysis.interface';
import { toError } from '../core/error-utils';
import { loadJsonFileSync } from '../core/file-loader';

const CACHE_VERSION = '1.1';

class DependencyGraphService {
    workspaceRoot: string;
    vscodeAnalyzer: VSCodeApiDependencyAnalyzer;
    fullGraph: Record<string, any> | null;
    cacheFilePath: string;
    saveTimeout: ReturnType<typeof setTimeout> | null = null;
    constructor(workspaceRoot: string) {
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
        } catch (_error: unknown) {
            const error = toError(_error);
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
                const cacheData = loadJsonFileSync<IGraphCacheData>(this.cacheFilePath);
                if (cacheData && cacheData.version === CACHE_VERSION && cacheData.graph) {
                    this.fullGraph = cacheData.graph;

                    // 🔥 NEW: Restore analyzer state from cache so Watcher works
                    this.vscodeAnalyzer.loadFromCache(this.fullGraph);

                    aidaLogging(`✅ Loaded graph from cache: ${this.fullGraph.nodes.length} nodes, ${this.fullGraph.edges.length} edges`);
                    return this.fullGraph;
                }
            } catch (_error: unknown) {
                const error = toError(_error);
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
    async updateFile(uri: _vscode.Uri) {
        if (this.vscodeAnalyzer) {
            await this.vscodeAnalyzer.processFile(uri);
        }
    }

    /**
     * Remove a file from the graph
     */
    removeFile(_uri: _vscode.Uri) {
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
        } catch (error: unknown) {
            aidaLogging('❌ Error building graph:', error);
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

// ES exports
export { DependencyGraphService };
