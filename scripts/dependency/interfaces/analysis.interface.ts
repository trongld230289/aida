/**
 * @module dependency/interfaces/analysis
 * @description Interfaces for symbol analysis and dependency reports.
 */

import * as vscode from 'vscode';
import { ISerializedGraph } from './graph.interface';

// ── Symbol analysis ────────────────────────────────────────────

/** Single symbol usage entry with reference locations */
export interface ISymbolUsage {
    name: string;
    kind: vscode.SymbolKind;
    referenceCount: number;
    references: vscode.Location[];
    barrelChain?: unknown[];
}

/** A file related to the analysed file via symbol references */
export interface IRelatedFile {
    path: string;
    usages: { symbolName: string; locations: vscode.Location[] }[];
}

/**
 * Full symbol analysis result for a single file.
 *
 * NOTE: Named `IFileSymbolAnalysis` to distinguish from
 * `IFileAnalysis` in chatbot/interfaces (different shape).
 */
export interface IFileSymbolAnalysis {
    filePath: string;
    symbols: ISymbolUsage[];
    relatedFiles: Map<string, IRelatedFile>;
}

// ── Dependency report ──────────────────────────────────────────

/** High-level numbers in a dependency report */
export interface IReportSummary {
    totalFiles: number;
    totalDependencies: number;
    averageDependenciesPerFile: number;
    typeDistribution: Record<string, number>;
    languageDistribution: Record<string, number>;
    analyzedWith: string;
}

/** Metric / structural data in a dependency report */
export interface IReportMetrics {
    mostConnected: { file: string; connections: number; node?: unknown }[];
    circularDependencies: number;
    circularDependencyDetails: unknown[];
}

/** Full dependency analysis report produced by the analyser */
export interface IDependencyReport {
    summary: IReportSummary;
    metrics: IReportMetrics;
    recommendations: Record<string, unknown>;
}

// ── Graph cache ────────────────────────────────────────────────

/** Persisted graph cache payload (saved to disk between sessions) */
export interface IGraphCacheData {
    version: string;
    timestamp: number | string;
    analysisType?: string;
    graph: ISerializedGraph;
    report?: IDependencyReport | any;
}
