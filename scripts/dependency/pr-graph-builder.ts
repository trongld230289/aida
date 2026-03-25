import * as path from 'path';
import type {
    IPRGraphNode, IChangedSymbol,
    IFilteredGraph, IFilteredGraphNode, IFilteredGraphEdge,
    IFullGraph,
} from './interfaces/pr-analysis.interface';

/**
 * Graph construction and analysis helpers for PRDependencyAnalyzer.
 */

// ────────────────────────────────────────────────────────────────────────────
// shouldIgnoreNode
// ────────────────────────────────────────────────────────────────────────────

/**
 * Check if a node should be ignored based on language configuration
 * @param filePath - Relative path of the file
 * @param vscodeAnalyzer - Analyzer instance holding languageConfig
 * @returns True if should be ignored
 */
function shouldIgnoreNode(filePath: string, vscodeAnalyzer: any): boolean {
    if (!filePath) return false;

    // Get language config from VSCode Analyzer
    const languageConfig = vscodeAnalyzer.languageConfig;
    const ext = path.extname(filePath).toLowerCase();

    // Find matching language
    const language = Object.values(languageConfig).find((config: any) =>
        config.extensions.includes(ext)
    );

    if (language && (language as any).ignorePatterns) {
        return (language as any).ignorePatterns.some((pattern: string) => {
            // Simple glob to regex conversion
            // **/*.module.ts -> .*\.module\.ts$
            let regexStr = pattern
                .replace(/\./g, '\\.')
                .replace(/\*\*\//g, '.*')
                .replace(/\*/g, '[^/]*');

            // Handle leading **/
            if (!regexStr.startsWith('.*')) {
                regexStr = '.*' + regexStr; // Ensure we match anywhere if it was **/
            }

            const regex = new RegExp(regexStr + '$');
            return regex.test(filePath);
        });
    }
    return false;
}

// ────────────────────────────────────────────────────────────────────────────
// buildFilteredGraph
// ────────────────────────────────────────────────────────────────────────────

/**
 * Build filtered graph with only relevant nodes.
 * 🔥 REWRITE: Clean Slate Approach — Focus purely on Impact (Dependents → PR Files)
 *
 * @param relevantNodeIds - Set of node IDs deemed relevant by analysis
 * @param prNodes - PR-enriched graph nodes
 * @param nodeChangedSymbols - Map of nodeId → changed symbols
 * @param fullGraph - The full dependency graph
 * @param vscodeAnalyzer - Analyzer instance holding languageConfig
 */
function buildFilteredGraph(
    relevantNodeIds: Set<string>,
    prNodes: IPRGraphNode[],
    nodeChangedSymbols: Map<string, IChangedSymbol[]>,
    fullGraph: IFullGraph,
    vscodeAnalyzer: any
): IFilteredGraph {
    // 1. Identify PR Nodes (The Center of the Universe)
    const prNodeIds = new Set(prNodes.map((n) => n.id));
    const deletedNodeIds = new Set(
        prNodes.filter((n) => n.prStatus === 'delete').map((n) => n.id)
    );

    // 2. Identify Edges (Strict Impact Filtering)
    // We only care about edges that point TO a PR file.
    // Source can be anything (PR file or External file).
    // Target MUST be a PR file.
    const edges: IFilteredGraphEdge[] = [];

    // 2a. Scan Full Graph Edges
    fullGraph.edges.forEach((e: { source: string; target: string }) => {
        // Skip if touching deleted files
        if (deletedNodeIds.has(e.source) || deletedNodeIds.has(e.target)) return;

        // 🔥 NEW: Check ignore patterns for Source (Dependent)
        // If the dependent is an ignored file (e.g. Angular Module), don't show it as impacted
        if (shouldIgnoreNode(e.source, vscodeAnalyzer)) return;

        // CRITICAL: Only keep edge if it points TO a PR file
        if (prNodeIds.has(e.target)) {
            // Also check if source is relevant (found via symbol analysis or is another PR file)
            if (relevantNodeIds.has(e.source) || prNodeIds.has(e.source)) {
                edges.push(e);
            }
        }
    });

    // 2b. Add Dynamic Edges (Barrel Exports / Wildcards)
    // These are edges found during symbol analysis that might not exist in the static full graph
    // The 'relevantNodeIds' set contains these dynamically found dependents
    for (const nodeId of relevantNodeIds) {
        // If this node is NOT a PR file, it must be a dependent found via analysis
        if (!prNodeIds.has(nodeId)) {
            // Check if we already added an edge for this node
            const isConnected = edges.some(e => e.source === nodeId);

            if (!isConnected) {
                // This node was deemed relevant but has no edge in full graph pointing to a PR file.
                // This likely means it was found via Barrel/Wildcard search.
                // We trust the 'edges' array from Full Graph for standard deps.
                // For barrel deps, if no static edge exists, they may be orphan dependents.
            }
        }
    }

    // 🔥 RE-INTEGRATE BARREL LOGIC (Cleaner)
    // We need to add edges for dependents found via barrel resolution that aren't in the static graph
    for (const prNode of prNodes) {
        if (prNode.prStatus === 'delete') continue;
        // Trust the Full Graph edges + strict filtering.
        // Barrel-found nodes in 'relevantNodeIds' are connected via the same mechanism.
    }

    // 3. Identify Nodes based on Filtered Edges + PR Nodes
    const finalNodeIds = new Set(prNodeIds);
    edges.forEach(e => finalNodeIds.add(e.source));

    // 4. Construct Node Objects
    const nodes: IFilteredGraphNode[] = [];
    const addedNodeIds = new Set<string>();

    // Helper to add node
    const addNode = (id: string, sourceNode: IFilteredGraphNode | null = null) => {
        if (addedNodeIds.has(id)) return;

        let nodeToAdd: IFilteredGraphNode | null = sourceNode;

        if (!nodeToAdd) {
            // Try finding in full graph
            const found = fullGraph.nodes.find((n) => n.id === id);
            if (found) {
                nodeToAdd = found as IFilteredGraphNode;
            }
        }

        if (!nodeToAdd) {
            // Create placeholder if not found (e.g. new file or dynamic barrel file)
            nodeToAdd = {
                id: id,
                relativePath: id,
                label: path.basename(id),
                type: 'dependent' // Default to dependent if not found
            };
        }

        // Merge PR metadata if it's a PR file
        if (prNodeIds.has(id)) {
            const prNode = prNodes.find((pn) => pn.id === id);
            nodeToAdd = { ...nodeToAdd, ...prNode } as IFilteredGraphNode;
            nodeToAdd.nodeType = 'pr-file';

            if (nodeChangedSymbols.has(id)) {
                nodeToAdd.changedSymbols = nodeChangedSymbols.get(id) ?? null;
            }
        } else {
            // It's a dependent
            nodeToAdd = { ...nodeToAdd }; // Clone
            nodeToAdd.nodeType = 'dependent';
        }

        nodes.push(nodeToAdd);
        addedNodeIds.add(id);
    };

    // Add all nodes involved in edges
    edges.forEach(e => {
        addNode(e.source);
        addNode(e.target);
    });

    // Ensure all PR nodes are added (even if isolated)
    prNodes.forEach((pn: IPRGraphNode) => addNode(pn.id));

    return { nodes, edges };
}

// ────────────────────────────────────────────────────────────────────────────
// Impact analysis
// ────────────────────────────────────────────────────────────────────────────

/**
 * Get impact analysis for PR files
 */
function getImpactAnalysis(graph: IFilteredGraph) {
    const prNodes = graph.nodes.filter((n) => n.isPRFile);
    const dependencies = graph.nodes.filter((n) => n.nodeType === 'dependency');
    const dependents = graph.nodes.filter((n) => n.nodeType === 'dependent');

    return {
        prFiles: prNodes.map((n) => ({
            path: n.relativePath,
            status: n.prStatus,
            changes: n.prChanges
        })),
        affectedFiles: {
            dependencies: dependencies.map((n) => n.relativePath),
            dependents: dependents.map((n) => n.relativePath),
            total: dependencies.length + dependents.length
        },
        riskLevel: calculateRiskLevel(graph),
        recommendations: generateRecommendations(graph)
    };
}

/**
 * Calculate risk level based on graph metrics
 */
function calculateRiskLevel(graph: IFilteredGraph): string {
    const prNodes = graph.nodes.filter((n) => n.isPRFile);
    const dependents = graph.nodes.filter((n) => n.nodeType === 'dependent');

    const totalChanges = prNodes.reduce((sum, n) => sum + (n.prChanges?.total || 0), 0);
    const dependentCount = dependents.length;

    if (dependentCount > 20 || totalChanges > 1000) {
        return 'HIGH';
    } else if (dependentCount > 10 || totalChanges > 500) {
        return 'MEDIUM';
    } else {
        return 'LOW';
    }
}

/**
 * Generate recommendations based on graph analysis
 */
function generateRecommendations(graph: IFilteredGraph): string[] {
    const recommendations: string[] = [];
    const dependents = graph.nodes.filter((n) => n.nodeType === 'dependent');
    const prNodes = graph.nodes.filter((n) => n.isPRFile);

    if (dependents.length > 15) {
        recommendations.push('High impact change - Consider notifying affected teams');
    }

    if (dependents.length > 0) {
        recommendations.push(`Test ${dependents.length} dependent file(s) for regressions`);
    }

    const totalChanges = prNodes.reduce((sum, n) => sum + (n.prChanges?.total || 0), 0);
    if (totalChanges > 500) {
        recommendations.push('Large PR - Consider breaking into smaller changes');
    }

    const coreFiles = prNodes.filter((n) =>
        n.relativePath.includes('core') ||
        n.relativePath.includes('shared') ||
        n.relativePath.includes('common')
    );

    if (coreFiles.length > 0) {
        recommendations.push('Core module changes detected - Extra scrutiny recommended');
    }

    return recommendations;
}

// ES exports
export {
    shouldIgnoreNode,
    buildFilteredGraph,
    getImpactAnalysis,
    calculateRiskLevel,
    generateRecommendations,
};
