/**
 * Circular dependency detector
 * Detects and analyzes circular dependencies in dependency graphs
 */
class CircularDetector {
    constructor() {
        this.visitedNodes = new Set();
        this.currentPath = new Set();
        this.cycles = [];
    }

    /**
     * Detect circular dependencies in the graph
     * @param {Object} graph - Dependency graph with nodes and edges
     * @returns {Array} - Array of circular dependency cycles
     */
    detectCircularDependencies(graph) {
        this.reset();
        
        // Create adjacency list for efficient traversal
        const adjacencyList = this.buildAdjacencyList(graph);
        
        // Visit each node that hasn't been visited
        for (const node of graph.nodes) {
            if (!this.visitedNodes.has(node.id)) {
                this.dfsDetectCycles(node.id, adjacencyList, []);
            }
        }

        // Post-process cycles to remove duplicates and enhance information
        const processedCycles = this.processCycles(graph);
        
        return processedCycles;
    }

    /**
     * Detect circular dependencies with detailed analysis
     * @param {Object} graph - Dependency graph
     * @returns {Object} - Detailed circular dependency analysis
     */
    analyzeCircularDependencies(graph) {
        const cycles = this.detectCircularDependencies(graph);
        
        return {
            totalCycles: cycles.length,
            cycles: cycles,
            affectedNodes: this.getAffectedNodes(cycles),
            severity: this.calculateSeverity(cycles, graph),
            recommendations: this.generateRecommendations(cycles, graph),
            hotspots: this.identifyHotspots(cycles, graph)
        };
    }

    /**
     * Build adjacency list from graph
     * @param {Object} graph - Dependency graph
     * @returns {Map} - Adjacency list mapping node IDs to their dependencies
     */
    buildAdjacencyList(graph) {
        const adjacencyList = new Map();
        
        // Initialize all nodes
        graph.nodes.forEach(node => {
            adjacencyList.set(node.id, []);
        });
        
        // Add edges
        graph.edges.forEach(edge => {
            const dependencies = adjacencyList.get(edge.source) || [];
            dependencies.push({
                nodeId: edge.target,
                edge: edge
            });
            adjacencyList.set(edge.source, dependencies);
        });
        
        return adjacencyList;
    }

    /**
     * DFS-based cycle detection
     * @param {string} nodeId - Current node ID
     * @param {Map} adjacencyList - Graph adjacency list
     * @param {Array} path - Current path in DFS
     */
    dfsDetectCycles(nodeId, adjacencyList, path) {
        // Mark current node as visited
        this.visitedNodes.add(nodeId);
        this.currentPath.add(nodeId);
        
        // Add current node to path
        const currentPath = [...path, nodeId];
        
        // Get dependencies of current node
        const dependencies = adjacencyList.get(nodeId) || [];
        
        for (const dependency of dependencies) {
            const dependencyId = dependency.nodeId;
            
            if (this.currentPath.has(dependencyId)) {
                // Cycle detected! Extract the cycle from current path
                const cycleStart = currentPath.indexOf(dependencyId);
                const cycle = currentPath.slice(cycleStart);
                cycle.push(dependencyId); // Complete the cycle
                
                this.cycles.push({
                    nodes: cycle,
                    edges: this.extractCycleEdges(cycle, adjacencyList),
                    length: cycle.length - 1,
                    detectedAt: new Date()
                });
            } else if (!this.visitedNodes.has(dependencyId)) {
                // Continue DFS
                this.dfsDetectCycles(dependencyId, adjacencyList, currentPath);
            }
        }
        
        // Remove current node from current path (backtrack)
        this.currentPath.delete(nodeId);
    }

    /**
     * Extract edges that form a cycle
     * @param {Array} cycle - Array of node IDs forming a cycle
     * @param {Map} adjacencyList - Graph adjacency list
     * @returns {Array} - Array of edges forming the cycle
     */
    extractCycleEdges(cycle, adjacencyList) {
        const edges = [];
        
        for (let i = 0; i < cycle.length - 1; i++) {
            const sourceId = cycle[i];
            const targetId = cycle[i + 1];
            
            const dependencies = adjacencyList.get(sourceId) || [];
            const edge = dependencies.find(dep => dep.nodeId === targetId)?.edge;
            
            if (edge) {
                edges.push(edge);
            }
        }
        
        return edges;
    }

    /**
     * Process and enhance detected cycles
     * @param {Object} graph - Dependency graph
     * @returns {Array} - Processed cycles with enhanced information
     */
    processCycles(graph) {
        const nodeMap = new Map(graph.nodes.map(n => [n.id, n]));
        const uniqueCycles = this.removeDuplicateCycles();
        
        return uniqueCycles.map(cycle => ({
            ...cycle,
            nodeDetails: cycle.nodes.map(nodeId => {
                const node = nodeMap.get(nodeId);
                return node ? {
                    id: nodeId,
                    fileName: node.fileName,
                    filePath: node.filePath,
                    relativePath: node.relativePath,
                    group: node.group,
                    category: node.category,
                    metadata: node.metadata
                } : { id: nodeId, fileName: 'Unknown' };
            }),
            severity: this.calculateCycleSeverity(cycle, nodeMap),
            impact: this.calculateCycleImpact(cycle, nodeMap),
            suggestions: this.generateCycleSuggestions(cycle, nodeMap)
        }));
    }

    /**
     * Remove duplicate cycles
     * @returns {Array} - Unique cycles
     */
    removeDuplicateCycles() {
        const uniqueCycles = [];
        const seenCycles = new Set();
        
        for (const cycle of this.cycles) {
            // Normalize cycle representation (start from smallest node ID)
            const normalized = this.normalizeCycle(cycle.nodes);
            const cycleKey = normalized.join('->');
            
            if (!seenCycles.has(cycleKey)) {
                seenCycles.add(cycleKey);
                uniqueCycles.push({
                    ...cycle,
                    nodes: normalized
                });
            }
        }
        
        return uniqueCycles;
    }

    /**
     * Normalize cycle to start from smallest node ID
     * @param {Array} cycle - Cycle nodes
     * @returns {Array} - Normalized cycle
     */
    normalizeCycle(cycle) {
        if (cycle.length <= 1) return cycle;
        
        // Remove last node if it's same as first (complete cycle)
        const cleanCycle = cycle[cycle.length - 1] === cycle[0] ? 
            cycle.slice(0, -1) : cycle;
        
        // Find index of smallest node ID
        const minIndex = cleanCycle.reduce((minIdx, nodeId, idx) => 
            nodeId < cleanCycle[minIdx] ? idx : minIdx, 0);
        
        // Rotate cycle to start from smallest node ID
        return [
            ...cleanCycle.slice(minIndex),
            ...cleanCycle.slice(0, minIndex),
            cleanCycle[minIndex] // Close the cycle
        ];
    }

    /**
     * Calculate severity of a cycle
     * @param {Object} cycle - Cycle object
     * @param {Map} nodeMap - Map of node IDs to nodes
     * @returns {string} - Severity level (low, medium, high, critical)
     */
    calculateCycleSeverity(cycle, nodeMap) {
        let severityScore = 0;
        
        // Longer cycles are more severe
        severityScore += Math.min(cycle.length * 10, 50);
        
        // Check node types in cycle
        cycle.nodes.forEach(nodeId => {
            const node = nodeMap.get(nodeId);
            if (!node) return;
            
            // Core modules in cycles are critical
            if (node.group === 'core') severityScore += 30;
            if (node.group === 'service') severityScore += 20;
            if (node.metadata.isModule) severityScore += 25;
            if (node.isCritical) severityScore += 15;
        });
        
        // Determine severity level
        if (severityScore >= 80) return 'critical';
        if (severityScore >= 50) return 'high';
        if (severityScore >= 25) return 'medium';
        return 'low';
    }

    /**
     * Calculate impact of a cycle
     * @param {Object} cycle - Cycle object
     * @param {Map} nodeMap - Map of node IDs to nodes
     * @returns {Object} - Impact analysis
     */
    calculateCycleImpact(cycle, nodeMap) {
        const impact = {
            testability: 'reduced',
            maintainability: 'impaired',
            bundleSize: 'increased',
            runtimePerformance: 'degraded'
        };
        
        const involvedGroups = new Set();
        cycle.nodes.forEach(nodeId => {
            const node = nodeMap.get(nodeId);
            if (node) involvedGroups.add(node.group);
        });
        
        // Cross-group cycles have higher impact
        if (involvedGroups.size > 2) {
            impact.architecture = 'violated';
            impact.maintainability = 'severely impaired';
        }
        
        return impact;
    }

    /**
     * Generate suggestions for fixing a cycle
     * @param {Object} cycle - Cycle object
     * @param {Map} nodeMap - Map of node IDs to nodes
     * @returns {Array} - Array of suggestions
     */
    generateCycleSuggestions(cycle, nodeMap) {
        const suggestions = [];
        const nodeTypes = new Set();
        
        cycle.nodes.forEach(nodeId => {
            const node = nodeMap.get(nodeId);
            if (node) {
                if (node.metadata.isService) nodeTypes.add('service');
                if (node.metadata.isComponent) nodeTypes.add('component');
                if (node.metadata.isModule) nodeTypes.add('module');
            }
        });
        
        // Service cycle suggestions
        if (nodeTypes.has('service')) {
            suggestions.push({
                type: 'refactor',
                title: 'Extract Shared Service',
                description: 'Create a shared service or interface to break the dependency cycle.',
                effort: 'medium',
                impact: 'high'
            });
            
            suggestions.push({
                type: 'pattern',
                title: 'Use Event-Driven Communication',
                description: 'Replace direct dependencies with event-based communication.',
                effort: 'high',
                impact: 'high'
            });
        }
        
        // Component cycle suggestions
        if (nodeTypes.has('component')) {
            suggestions.push({
                type: 'architectural',
                title: 'Implement Parent-Child Pattern',
                description: 'Restructure components to follow clear parent-child relationships.',
                effort: 'medium',
                impact: 'medium'
            });
        }
        
        // Module cycle suggestions
        if (nodeTypes.has('module')) {
            suggestions.push({
                type: 'architectural',
                title: 'Reorganize Module Structure',
                description: 'Move shared functionality to a common module or create proper module hierarchy.',
                effort: 'high',
                impact: 'high'
            });
        }
        
        // Generic suggestions
        suggestions.push({
            type: 'pattern',
            title: 'Apply Dependency Injection',
            description: 'Use Angular forwardRef() or redesign to break circular dependencies.',
            effort: 'low',
            impact: 'medium'
        });
        
        return suggestions;
    }

    /**
     * Get all nodes affected by circular dependencies
     * @param {Array} cycles - Array of cycles
     * @returns {Set} - Set of affected node IDs
     */
    getAffectedNodes(cycles) {
        const affectedNodes = new Set();
        
        cycles.forEach(cycle => {
            cycle.nodes.forEach(nodeId => {
                affectedNodes.add(nodeId);
            });
        });
        
        return affectedNodes;
    }

    /**
     * Calculate overall severity of circular dependencies
     * @param {Array} cycles - Array of cycles
     * @param {Object} graph - Dependency graph
     * @returns {Object} - Severity analysis
     */
    calculateSeverity(cycles, graph) {
        if (cycles.length === 0) {
            return {
                level: 'none',
                score: 0,
                description: 'No circular dependencies detected'
            };
        }
        
        const totalNodes = graph.nodes.length;
        const affectedNodes = this.getAffectedNodes(cycles);
        const affectedPercentage = (affectedNodes.size / totalNodes) * 100;
        
        let score = cycles.length * 10 + affectedPercentage;
        
        // Adjust score based on cycle complexity
        cycles.forEach(cycle => {
            if (cycle.severity === 'critical') score += 50;
            else if (cycle.severity === 'high') score += 30;
            else if (cycle.severity === 'medium') score += 15;
        });
        
        let level, description;
        if (score >= 100) {
            level = 'critical';
            description = 'Critical circular dependencies requiring immediate attention';
        } else if (score >= 50) {
            level = 'high';
            description = 'High impact circular dependencies should be resolved soon';
        } else if (score >= 20) {
            level = 'medium';
            description = 'Moderate circular dependencies that should be addressed';
        } else {
            level = 'low';
            description = 'Minor circular dependencies with limited impact';
        }
        
        return { level, score, description };
    }

    /**
     * Generate recommendations for circular dependency resolution
     * @param {Array} cycles - Array of cycles
     * @param {Object} graph - Dependency graph
     * @returns {Array} - Array of recommendations
     */
    generateRecommendations(cycles, graph) {
        const recommendations = [];
        
        if (cycles.length === 0) {
            recommendations.push({
                type: 'positive',
                title: 'Clean Architecture',
                description: 'Excellent! No circular dependencies detected.',
                priority: 'info'
            });
            return recommendations;
        }
        
        // Priority recommendations based on severity
        const criticalCycles = cycles.filter(c => c.severity === 'critical');
        const highSeverityCycles = cycles.filter(c => c.severity === 'high');
        
        if (criticalCycles.length > 0) {
            recommendations.push({
                type: 'urgent',
                title: 'Resolve Critical Cycles First',
                description: `${criticalCycles.length} critical cycles need immediate attention.`,
                priority: 'critical'
            });
        }
        
        if (highSeverityCycles.length > 0) {
            recommendations.push({
                type: 'important',
                title: 'Address High Impact Cycles',
                description: `${highSeverityCycles.length} high-impact cycles should be resolved soon.`,
                priority: 'high'
            });
        }
        
        // Architectural recommendations
        const moduleInvolvedCycles = cycles.filter(c => 
            c.nodeDetails?.some(n => n.metadata?.isModule)
        );
        
        if (moduleInvolvedCycles.length > 0) {
            recommendations.push({
                type: 'architectural',
                title: 'Restructure Module Dependencies',
                description: 'Consider creating shared modules or reorganizing feature modules.',
                priority: 'medium'
            });
        }
        
        return recommendations;
    }

    /**
     * Identify hotspots - nodes involved in multiple cycles
     * @param {Array} cycles - Array of cycles
     * @param {Object} graph - Dependency graph
     * @returns {Array} - Array of hotspot nodes
     */
    identifyHotspots(cycles, graph) {
        const nodeInvolvementCount = new Map();
        
        // Count how many cycles each node is involved in
        cycles.forEach(cycle => {
            cycle.nodes.forEach(nodeId => {
                nodeInvolvementCount.set(nodeId, 
                    (nodeInvolvementCount.get(nodeId) || 0) + 1);
            });
        });
        
        // Find nodes involved in multiple cycles
        const hotspots = [];
        const nodeMap = new Map(graph.nodes.map(n => [n.id, n]));
        
        nodeInvolvementCount.forEach((count, nodeId) => {
            if (count > 1) {
                const node = nodeMap.get(nodeId);
                hotspots.push({
                    nodeId,
                    fileName: node?.fileName || 'Unknown',
                    filePath: node?.filePath || '',
                    cycleCount: count,
                    severity: count >= 3 ? 'critical' : 'high',
                    recommendation: 'Priority candidate for refactoring'
                });
            }
        });
        
        // Sort by involvement count (descending)
        return hotspots.sort((a, b) => b.cycleCount - a.cycleCount);
    }

    /**
     * Reset detector state
     */
    reset() {
        this.visitedNodes.clear();
        this.currentPath.clear();
        this.cycles = [];
    }
}

module.exports = CircularDetector;