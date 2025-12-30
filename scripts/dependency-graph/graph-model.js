/**
 * Dependency Graph Data Model
 * Pure data structure to hold nodes and edges
 */
class DependencyGraphModel {
    constructor() {
        // Map<SourcePath, Set<TargetPath>>
        this.adjacencyList = new Map();
        // Map<FilePath, NodeMetadata>
        this.nodeMetadata = new Map();
    }

    clear() {
        this.adjacencyList.clear();
        this.nodeMetadata.clear();
    }

    /**
     * Add or update a dependency link
     * @param {string} source - Relative path of source file
     * @param {string} target - Relative path of target file
     */
    addDependency(source, target) {
        if (!this.adjacencyList.has(source)) {
            this.adjacencyList.set(source, new Set());
        }
        this.adjacencyList.get(source).add(target);
    }

    /**
     * Remove all dependencies originating from a source file
     * Used when re-analyzing a file
     * @param {string} source - Relative path of source file
     */
    clearDependencies(source) {
        if (this.adjacencyList.has(source)) {
            this.adjacencyList.get(source).clear();
        }
    }

    /**
     * Remove a file completely from the graph (both as source and target)
     * @param {string} file - Relative path of file to remove
     */
    removeNode(file) {
        // Remove as source
        this.adjacencyList.delete(file);
        this.nodeMetadata.delete(file);

        // Remove as target (expensive operation, but necessary for consistency)
        // In a large graph, we might want to maintain a reverse index (dependents map)
        for (const [source, targets] of this.adjacencyList) {
            if (targets.has(file)) {
                targets.delete(file);
            }
        }
    }

    /**
     * Get all dependencies of a file
     * @param {string} file 
     * @returns {Set<string>}
     */
    getDependencies(file) {
        return this.adjacencyList.get(file) || new Set();
    }

    /**
     * Get all dependents (files that import this file)
     * @param {string} file 
     * @returns {Set<string>}
     */
    getDependents(file) {
        const dependents = new Set();
        for (const [source, targets] of this.adjacencyList) {
            if (targets.has(file)) {
                dependents.add(source);
            }
        }
        return dependents;
    }

    /**
     * Export to format used by UI
     */
    serialize(workspaceRoot) {
        // Implementation similar to buildGraphResult in original analyzer
        // ... (Logic to be moved here later)
        return {
            nodes: [], // Placeholder
            edges: []
        };
    }
}

module.exports = { DependencyGraphModel };
