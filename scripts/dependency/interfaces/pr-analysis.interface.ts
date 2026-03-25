/**
 * @module dependency/interfaces/pr-analysis
 * @description Interfaces for PR dependency analysis — graph nodes, edges,
 * changed symbols, and related data shapes used by PRDependencyAnalyzer
 * and VSCodeApiDependencyAnalyzer.
 */

import * as vscode from 'vscode';

// ── Full-graph node (produced by VSCodeApiDependencyAnalyzer.buildGraph) ──

/** A single node in the full dependency graph (as built by VSCodeApiDependencyAnalyzer). */
export interface IGraphNode {
    id: string;
    fileName?: string;
    filePath?: string;
    relativePath: string;
    language?: string;
    type?: string;
    label?: string;
    category?: string;
    dependencies?: string[];
    dependents?: string[];
    nodeType?: string;
    isPRFile?: boolean;
    prStatus?: string;
    prChanges?: IPRChanges;
    changedSymbols?: IChangedSymbol[] | null;
    metadata?: Record<string, any>;
    [key: string]: unknown;
}

/** A directed edge in the full dependency graph. */
export interface IGraphEdge {
    id: string;
    source: string;
    target: string;
    type: string;
    weight: number;
    strength: string;
    discoveredBy: string;
}

/** The full graph structure returned by `buildGraph()`. */
export interface IFullGraph {
    nodes: IGraphNode[];
    edges: IGraphEdge[];
    metadata?: {
        totalFiles: number;
        totalDependencies: number;
        analyzedAt: string;
        analyzer: string;
    };
}

// ── PR-enriched node (produced by PRDependencyAnalyzer.findPRNodes) ──────

/** Changes summary for a PR file. */
export interface IPRChanges {
    additions: number;
    deletions: number;
    total: number;
}

/** Graph node augmented with PR metadata. */
export interface IPRGraphNode extends Partial<IGraphNode> {
    id: string;
    fileName?: string;
    relativePath: string;
    isPRFile?: boolean;
    prStatus?: string;
    prChanges?: IPRChanges;
    prPath?: string;
    prPatch?: string | null;
    changedSymbols?: IChangedSymbol[] | null;
    isNewFile?: boolean;
    isDeletedFile?: boolean;
    label?: string;
    nodeType?: string;
}

// ── Changed symbol (extracted from patches) ──────────────────────────────

/** A symbol detected as changed within a PR patch. */
export interface IChangedSymbol {
    name: string;
    fullName: string;
    type: string;
    lineNumber: number;
    column: number;
    filePath: string;
    isRoot?: boolean;
    kind?: vscode.SymbolKind;
    parentName?: string;
    children?: string[];
}

// ── PR file input (from PR fetchers — thin wrapper around INormalizedFileChange) ──

/** A single file change entry passed into `analyzePRFiles`. */
export interface IPRFileInput {
    path: string;
    status: string;
    additions: number;
    deletions: number;
    patch?: string;
    oldPath?: string;
    newPath?: string;
}

// ── Filtered graph (returned from buildFilteredGraph) ────────────────────

/** A node inside the scope-limited filtered graph. */
export interface IFilteredGraphNode {
    id: string;
    fileName?: string;
    relativePath: string;
    category?: string;
    language?: string;
    type?: string;
    label?: string;
    isPRFile?: boolean;
    nodeType?: string;
    prStatus?: string;
    prChanges?: IPRChanges;
    prPath?: string;
    usedSymbols?: string[];
    changedSymbols?: IChangedSymbol[] | null;
    metadata?: Record<string, any>;
    [key: string]: unknown;
}

/** A directed edge inside the filtered graph. */
export interface IFilteredGraphEdge {
    source: string;
    target: string;
    type?: string;
    usedSymbols?: string[];
}

/** The scope-limited filtered graph returned by `buildFilteredGraph`. */
export interface IFilteredGraph {
    nodes: IFilteredGraphNode[];
    edges: IFilteredGraphEdge[];
    prSummary?: IPRSummary;
    symbolToDependentsMap?: Map<string, string[]>;
}

/** Summary statistics for a PR dependency analysis. */
export interface IPRSummary {
    totalPRFiles: number;
    matchedNodes: number;
    totalDependencies: number;
    totalDependents: number;
    filteredDependents: number;
    totalNodes: number;
    totalEdges: number;
    addedFiles: number;
    modifiedFiles: number;
    deletedFiles: number;
    renamedFiles: number;
    totalAdditions: number;
    totalDeletions: number;
}

// ── Impact analysis ──────────────────────────────────────────────────────

/** High-level impact analysis result. */
export interface IImpactAnalysis {
    prFiles: {
        path: string;
        status: string;
        changes: IPRChanges;
    }[];
    dependencies: string[];
    dependents: string[];
    totalImpactedFiles: number;
}

/** Recommendation generated from graph analysis. */
export interface IRecommendation {
    type: string;
    severity: 'info' | 'warning' | 'error';
    title: string;
    description: string;
    details?: string;
}

// ── Language config (from vscode-api-analyzer) ───────────────────────────

/** Per-language analysis configuration. */
export interface ILanguageConfig {
    extensions: string[];
    symbolPatterns?: Record<string, RegExp[]>;
    barrelFiles?: string[];
    ignorePatterns?: string[];
    [key: string]: unknown;
}
