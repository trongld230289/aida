/**
 * @module graph-model
 * @description Dependency Graph Data Model — pure data structure for nodes + edges.
 * Migrated to TypeScript in Phase 3.4.  Adds typed Maps and reverse dependency index.
 */

import {
    INodeMetadata, ISerializedNode, ISerializedEdge, ISerializedGraph,
} from '../interfaces/graph.interface';

// Re-export so existing consumers can still import from this module
export type { INodeMetadata, ISerializedNode, ISerializedEdge, ISerializedGraph };

// ── Model ───────────────────────────────────────────────────────

export class DependencyGraphModel {
    /** Map<SourcePath, Set<TargetPath>> — forward edges */
    adjacencyList: Map<string, Set<string>>;

    /** Map<TargetPath, Set<SourcePath>> — reverse edges (auto-maintained) */
    reverseIndex: Map<string, Set<string>>;

    /** Map<FilePath, NodeMetadata> */
    nodeMetadata: Map<string, INodeMetadata>;

    constructor() {
        this.adjacencyList = new Map();
        this.reverseIndex = new Map();
        this.nodeMetadata = new Map();
    }

    clear(): void {
        this.adjacencyList.clear();
        this.reverseIndex.clear();
        this.nodeMetadata.clear();
    }

    /**
     * Add or update a dependency link.
     * Maintains both forward and reverse indices.
     */
    addDependency(source: string, target: string): void {
        // Forward
        if (!this.adjacencyList.has(source)) {
            this.adjacencyList.set(source, new Set<string>());
        }
        this.adjacencyList.get(source)!.add(target);

        // Reverse
        if (!this.reverseIndex.has(target)) {
            this.reverseIndex.set(target, new Set<string>());
        }
        this.reverseIndex.get(target)!.add(source);
    }

    /**
     * Remove all dependencies originating from a source file.
     * Used when re-analyzing a file.
     */
    clearDependencies(source: string): void {
        const targets = this.adjacencyList.get(source);
        if (targets) {
            // Clean reverse index first
            for (const target of targets) {
                this.reverseIndex.get(target)?.delete(source);
            }
            targets.clear();
        }
    }

    /**
     * Remove a file completely from the graph (both as source and target).
     * O(1) for reverse lookups thanks to reverseIndex.
     */
    removeNode(file: string): void {
        // Remove as source — also clean reverse entries
        const targets = this.adjacencyList.get(file);
        if (targets) {
            for (const target of targets) {
                this.reverseIndex.get(target)?.delete(file);
            }
        }
        this.adjacencyList.delete(file);
        this.nodeMetadata.delete(file);

        // Remove as target — use reverse index (O(k) where k = dependents)
        const dependents = this.reverseIndex.get(file);
        if (dependents) {
            for (const dep of dependents) {
                this.adjacencyList.get(dep)?.delete(file);
            }
        }
        this.reverseIndex.delete(file);
    }

    /** Get all dependencies of a file (outgoing edges). */
    getDependencies(file: string): Set<string> {
        return this.adjacencyList.get(file) || new Set<string>();
    }

    /**
     * Get all dependents (files that import this file).
     * Now O(1) lookup via reverseIndex instead of full graph scan.
     */
    getDependents(file: string): Set<string> {
        return this.reverseIndex.get(file) || new Set<string>();
    }

    /** Export to format used by UI. */
    serialize(_workspaceRoot?: string): ISerializedGraph {
        const nodes: ISerializedNode[] = [];
        const edges: ISerializedEdge[] = [];

        // Collect all unique file paths
        const allFiles = new Set<string>();
        for (const [source, targets] of this.adjacencyList) {
            allFiles.add(source);
            for (const target of targets) {
                allFiles.add(target);
                edges.push({ source, target });
            }
        }

        for (const file of allFiles) {
            const meta = this.nodeMetadata.get(file);
            const node: ISerializedNode = {
                id: file,
                label: file.split(/[/\\]/).pop() || file,
            };
            if (meta) {
                node.metadata = meta;
            }
            nodes.push(node);
        }

        return { nodes, edges };
    }
}

// ── Dual exports ────────────────────────────────────────────────
