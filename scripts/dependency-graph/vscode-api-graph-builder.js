const { VSCodeAPIAnalyzer } = require('./vscode-api-analyzer');
const vscode = require('vscode');

/**
 * VS Code API-based Graph Builder
 * Level 3: Ultimate solution using VS Code's own language services
 */
class VSCodeAPIGraphBuilder {
    constructor() {
        this.analyzer = new VSCodeAPIAnalyzer();
        this.cache = new Map();
        this.stats = {
            analysisTime: 0,
            cacheHits: 0,
            cacheMisses: 0
        };
    }

    /**
     * Build dependency graph using VS Code APIs
     * @param {string} workspaceRoot - Workspace root path
     * @returns {Object} - Enhanced dependency graph
     */
    async buildGraph(workspaceRoot) {
        const startTime = Date.now();
        
        console.log('🚀 Building dependency graph using VS Code APIs...');
        
        try {
            // Use VS Code APIs to analyze workspace
            const analysis = await this.analyzer.analyzeWorkspace(workspaceRoot);
            
            // Build enhanced graph
            const graph = {
                nodes: analysis.nodes.map(node => this.enhanceNode(node)),
                edges: this.deduplicateEdges(analysis.edges),
                metadata: {
                    generatedAt: new Date().toISOString(),
                    analysisMethod: 'vscode-api',
                    workspaceRoot,
                    stats: {
                        ...analysis.stats,
                        analysisTime: Date.now() - startTime,
                        edgesAfterDeduplication: 0 // Will be set below
                    }
                }
            };

            graph.metadata.stats.edgesAfterDeduplication = graph.edges.length;

            // Calculate additional metrics
            const metrics = this.calculateMetrics(graph);
            graph.metadata.metrics = metrics;

            this.stats.analysisTime = Date.now() - startTime;

            console.log(`✅ VS Code API Graph Analysis Complete:`);
            console.log(`   ⏱️  Analysis time: ${this.stats.analysisTime}ms`);
            console.log(`   📊 Nodes: ${graph.nodes.length}`);
            console.log(`   🔗 Edges: ${graph.edges.length}`);
            console.log(`   🎯 Accuracy: Using VS Code Language Services`);
            console.log(`   🌍 Multi-language: ${Object.keys(analysis.stats.languageBreakdown).join(', ')}`);

            return graph;

        } catch (error) {
            console.error(`💥 VS Code API graph building failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Enhance node with additional metadata
     * @param {Object} node - Base node
     * @returns {Object} - Enhanced node
     */
    enhanceNode(node) {
        return {
            ...node,
            // Add VS Code-specific enhancements
            workspace: vscode.workspace.getWorkspaceFolder(vscode.Uri.parse(node.id))?.name,
            isOpen: this.isDocumentOpen(node.id),
            hasErrors: this.hasDocumentErrors(node.id),
            lastModified: this.getLastModified(node.id),
            
            // Add computed properties
            importance: this.calculateNodeImportance(node),
            category: this.getNodeCategory(node),
            
            // VS Code integration
            canNavigate: true,
            supportsReferences: true,
            supportsDefinition: true
        };
    }

    /**
     * Deduplicate edges to avoid duplicates
     * @param {Array} edges - Raw edges
     * @returns {Array} - Deduplicated edges
     */
    deduplicateEdges(edges) {
        const seen = new Set();
        return edges.filter(edge => {
            const key = `${edge.source}->${edge.target}-${edge.type}`;
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });
    }

    /**
     * Calculate graph metrics
     * @param {Object} graph - Graph
     * @returns {Object} - Metrics
     */
    calculateMetrics(graph) {
        const nodesByType = {};
        const nodesByLanguage = {};
        let totalInDegree = 0;
        let totalOutDegree = 0;

        // Count nodes by type and language
        graph.nodes.forEach(node => {
            nodesByType[node.entityType] = (nodesByType[node.entityType] || 0) + 1;
            nodesByLanguage[node.language] = (nodesByLanguage[node.language] || 0) + 1;
        });

        // Calculate degree distribution
        const inDegree = {};
        const outDegree = {};
        
        graph.edges.forEach(edge => {
            outDegree[edge.source] = (outDegree[edge.source] || 0) + 1;
            inDegree[edge.target] = (inDegree[edge.target] || 0) + 1;
            totalOutDegree++;
            totalInDegree++;
        });

        // Find most connected nodes
        const mostDependent = Object.entries(outDegree)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5)
            .map(([nodeId, degree]) => ({
                nodeId,
                degree,
                displayName: graph.nodes.find(n => n.id === nodeId)?.displayName || 'Unknown'
            }));

        const mostDependedOn = Object.entries(inDegree)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5)
            .map(([nodeId, degree]) => ({
                nodeId,
                degree,
                displayName: graph.nodes.find(n => n.id === nodeId)?.displayName || 'Unknown'
            }));

        return {
            nodeCount: graph.nodes.length,
            edgeCount: graph.edges.length,
            density: graph.edges.length / (graph.nodes.length * (graph.nodes.length - 1)),
            avgInDegree: totalInDegree / graph.nodes.length,
            avgOutDegree: totalOutDegree / graph.nodes.length,
            nodesByType,
            nodesByLanguage,
            mostDependent,
            mostDependedOn,
            complexity: this.calculateComplexity(graph),
            maintainability: this.calculateMaintainability(graph)
        };
    }

    /**
     * Calculate node importance score
     * @param {Object} node - Node
     * @returns {number} - Importance score
     */
    calculateNodeImportance(node) {
        let score = 0;
        
        // Base score by entity type
        const typeScores = {
            'module': 10,
            'service': 8,
            'component': 6,
            'directive': 4,
            'pipe': 4,
            'file': 2
        };
        score += typeScores[node.entityType] || 0;
        
        // Size factor
        score += Math.min(node.size / 1000, 5);
        
        // Complexity factor
        score += Math.min(node.lineCount / 100, 5);
        
        return Math.round(score * 10) / 10;
    }

    /**
     * Get node category
     * @param {Object} node - Node
     * @returns {string} - Category
     */
    getNodeCategory(node) {
        if (node.entityType === 'component') return 'UI Component';
        if (node.entityType === 'service') return 'Business Logic';
        if (node.entityType === 'module') return 'Module System';
        if (node.entityType === 'directive') return 'UI Directive';
        if (node.entityType === 'pipe') return 'Data Transform';
        return 'General';
    }

    /**
     * Check if document is currently open
     * @param {string} nodeId - Node ID (URI)
     * @returns {boolean} - Is open
     */
    isDocumentOpen(nodeId) {
        try {
            const uri = vscode.Uri.parse(nodeId);
            return vscode.workspace.textDocuments.some(doc => 
                doc.uri.toString() === uri.toString()
            );
        } catch (error) {
            return false;
        }
    }

    /**
     * Check if document has errors
     * @param {string} nodeId - Node ID (URI)
     * @returns {boolean} - Has errors
     */
    hasDocumentErrors(nodeId) {
        try {
            const uri = vscode.Uri.parse(nodeId);
            const diagnostics = vscode.languages.getDiagnostics(uri);
            return diagnostics.some(diag => diag.severity === vscode.DiagnosticSeverity.Error);
        } catch (error) {
            return false;
        }
    }

    /**
     * Get last modified time
     * @param {string} nodeId - Node ID (URI)
     * @returns {string} - Last modified
     */
    getLastModified(nodeId) {
        try {
            const uri = vscode.Uri.parse(nodeId);
            const stat = vscode.workspace.fs.stat(uri);
            return new Date(stat.mtime).toISOString();
        } catch (error) {
            return new Date().toISOString();
        }
    }

    /**
     * Calculate complexity score
     * @param {Object} graph - Graph
     * @returns {number} - Complexity score
     */
    calculateComplexity(graph) {
        const nodeCount = graph.nodes.length;
        const edgeCount = graph.edges.length;
        const avgDegree = (edgeCount * 2) / nodeCount;
        
        // Cyclomatic complexity approximation
        return Math.round((edgeCount - nodeCount + 1) * avgDegree / 10);
    }

    /**
     * Calculate maintainability score
     * @param {Object} graph - Graph
     * @returns {number} - Maintainability score (0-100)
     */
    calculateMaintainability(graph) {
        const complexity = this.calculateComplexity(graph);
        const density = graph.edges.length / (graph.nodes.length * (graph.nodes.length - 1));
        
        // Higher complexity and density = lower maintainability
        let score = 100 - (complexity * 2) - (density * 100);
        return Math.max(0, Math.min(100, Math.round(score)));
    }

    /**
     * Navigate to node in VS Code
     * @param {string} nodeId - Node ID
     * @param {number} line - Line number (optional)
     */
    async navigateToNode(nodeId, line = 0) {
        try {
            const uri = vscode.Uri.parse(nodeId);
            const document = await vscode.workspace.openTextDocument(uri);
            const editor = await vscode.window.showTextDocument(document);
            
            if (line > 0) {
                const position = new vscode.Position(line - 1, 0);
                editor.selection = new vscode.Selection(position, position);
                editor.revealRange(new vscode.Range(position, position));
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to navigate to ${nodeId}: ${error.message}`);
        }
    }

    /**
     * Show references for node
     * @param {string} nodeId - Node ID
     */
    async showReferences(nodeId) {
        try {
            const uri = vscode.Uri.parse(nodeId);
            await vscode.commands.executeCommand('references-view.findReferences', uri);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to show references: ${error.message}`);
        }
    }
}

module.exports = { VSCodeAPIGraphBuilder };