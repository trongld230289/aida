const path = require('path');
const { DependencyGraphService } = require('./dependency-graph-service');
const { aidaLogging } = require('./settings');

class FileDependencyAnalyzer {
    constructor(workspaceRoot) {
        this.workspaceRoot = workspaceRoot;
        this.graphService = new DependencyGraphService(workspaceRoot);
    }

    async analyzeFile(filePath) {
        aidaLogging(`🔍 Analyzing single file: ${filePath}`);
        
        // Ensure graph is loaded
        const fullGraph = await this.graphService.ensureFullGraph();
        
        // Normalize path
        const normalizedPath = filePath.replace(/\\/g, '/');
        const relativePath = path.relative(this.workspaceRoot, filePath).replace(/\\/g, '/');
        
        // Find node
        const node = fullGraph.nodes.find(n => {
            const nodeRelPath = (n.relativePath || '').replace(/\\/g, '/');
            // Try exact match first
            if (nodeRelPath === relativePath) return true;
            // Try absolute path match if node has it
            if (n.fsPath && n.fsPath.replace(/\\/g, '/') === normalizedPath) return true;
            
            return false;
        });
        
        if (!node) {
            aidaLogging(`⚠️ File not found in graph: ${relativePath}`);
            return {
                nodes: [{
                    id: relativePath,
                    relativePath: relativePath,
                    label: path.basename(relativePath),
                    type: 'file',
                    nodeType: 'target'
                }],
                edges: [],
                summary: {
                    filePath: relativePath,
                    dependencies: 0,
                    dependents: 0
                }
            };
        }
        
        // Find dependencies (outgoing)
        const dependencies = fullGraph.edges
            .filter(e => e.source === node.id)
            .map(e => e.target);
            
        // Find dependents (incoming)
        const dependents = fullGraph.edges
            .filter(e => e.target === node.id)
            .map(e => e.source);
            
        aidaLogging(`✅ Found ${dependencies.length} dependencies and ${dependents.length} dependents`);
        
        // Build filtered graph
        const relevantNodeIds = new Set([node.id, ...dependencies, ...dependents]);
        
        const nodes = fullGraph.nodes
            .filter(n => relevantNodeIds.has(n.id))
            .map(n => {
                const clone = { ...n };
                if (n.id === node.id) {
                    clone.nodeType = 'target';
                } else if (dependencies.includes(n.id)) {
                    clone.nodeType = 'dependency';
                } else if (dependents.includes(n.id)) {
                    clone.nodeType = 'dependent';
                }
                return clone;
            });
            
        const edges = fullGraph.edges.filter(e => 
            relevantNodeIds.has(e.source) && relevantNodeIds.has(e.target)
        );
        
        return {
            nodes,
            edges,
            summary: {
                filePath: relativePath,
                dependencies: dependencies.length,
                dependents: dependents.length
            }
        };
    }
}

module.exports = { FileDependencyAnalyzer };
