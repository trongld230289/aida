import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

import { SymbolAnalyzer } from './graph/symbol-analyzer';
import { BarrelResolver } from './graph/barrel-resolver';
import { DependencyGraphService } from './dependency-graph-service';
import { aidaLogging } from '../core/settings';
import { toError } from '../core/error-utils';

import { commonIgnores, extensionIgnores } from '../core/ignore-rules';
import minimatchLib from 'minimatch';

// Sub-module imports
import {
    extractChangedSymbolsHybrid,
    getUsedSymbols,
    type ISymbolExtractorContext,
} from './pr-symbol-extractor';
import {
    buildFilteredGraph,
} from './pr-graph-builder';
import {
    resolveBarrelReferences,
    isBarrelExport,
    findImportsOfBarrelFile,
    getBarrelFiles,
} from './pr-barrel-resolver-helpers';

import type {
    IPRFileInput, IPRGraphNode, IChangedSymbol,
    IFilteredGraph,
    ILanguageConfig, IFullGraph,
} from './interfaces/pr-analysis.interface';

/**
 * PR Dependency Analyzer
 * Analyzes dependencies for files changed in a PR
 */
class PRDependencyAnalyzer {
    workspaceRoot: string;
    graphService: DependencyGraphService;
    symbolAnalyzer: SymbolAnalyzer;
    barrelResolver: BarrelResolver;
    referenceCache: Map<string, vscode.Location[]>;
    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
        this.graphService = new DependencyGraphService(workspaceRoot);
        this.symbolAnalyzer = new SymbolAnalyzer();
        this.barrelResolver = new BarrelResolver(); // 🔥 NEW: Barrel resolver
        this.referenceCache = new Map(); // Cache for reference lookups (legacy, will be deprecated)
    }

    get fullGraph(): IFullGraph {
        return this.graphService.fullGraph as IFullGraph;
    }

    get vscodeAnalyzer() {
        return this.graphService.vscodeAnalyzer;
    }

    /** Helper: creates the context object for symbol-extraction helpers. */
    private get _symbolCtx(): ISymbolExtractorContext {
        return {
            workspaceRoot: this.workspaceRoot,
            vscodeAnalyzer: this.vscodeAnalyzer,
            barrelResolver: this.barrelResolver,
        };
    }

    /**
     * Build dependency graph for PR files
     * @param prFiles - PR file changes [{path, status, additions, deletions}]
     * @returns Graph {nodes, edges, prSummary}
     */
    async analyzePRFiles(prFiles: IPRFileInput[]) {
        // 🔥 Filter out unnecessary files from analysis
        const filteredPRFiles = prFiles.filter((file: IPRFileInput) => {
            const ext = path.extname(file.path).toLowerCase();

            // Check against common ignores using minimatch
            const isIgnored = commonIgnores.some((pattern: string) => minimatchLib(file.path, pattern, { dot: true }));
            if (isIgnored) {
                aidaLogging(`🚫 Ignoring file (common rule): ${file.path}`);
                return false;
            }

            if (extensionIgnores.includes(ext)) {
                aidaLogging(`🚫 Ignoring file (extension): ${file.path}`);
                return false;
            }
            return true;
        });

        aidaLogging(`🔍 Analyzing ${filteredPRFiles.length} PR files (filtered from ${prFiles.length})...`);

        // Step 1: Check if cache exists (PR analysis requires cache for accuracy)
        if (!this.graphService.hasCache() && !this.graphService.fullGraph) {
            throw new Error('Dependency cache is missing. PR analysis requires a pre-built dependency graph for accuracy.');
        }

        // Step 2: Load full graph
        await this.graphService.ensureFullGraph();

        // 🔥 FORCE UPDATE for new files
        // The cache might be stale and missing the new files.
        // We force the analyzer to process them now so they appear in the graph.
        for (const file of filteredPRFiles) {
            if (file.status === 'added' || file.status === 'add') {
                const fullPath = path.join(this.workspaceRoot, file.path);
                const fileUri = vscode.Uri.file(fullPath);
                aidaLogging(`📄 Force updating graph for new file: ${file.path}`);
                try {
                    await this.vscodeAnalyzer.processFile(fileUri);
                } catch (_e: unknown) {
                    const e = toError(_e);
                    aidaLogging(`⚠️ Failed to force update file ${file.path}: ${e.message}`);
                }
            }
        }

        // Step 3: Find PR file nodes in full graph
        const prNodes = this.findPRNodes(filteredPRFiles);
        aidaLogging(`✅ Matched ${prNodes.length} PR files to graph nodes`);

        // Step 3b: Extract changed symbols for MODIFIED files
        // Store changedSymbols in Map<nodeId, symbols[]> for reuse by Deep Impact
        const nodeChangedSymbols = new Map();

        for (const node of prNodes) {
            if (node.prStatus === 'edit' && node.prPatch) {
                // Modified file: extract changed symbols from patch
                aidaLogging(`\n🔍 Extracting symbols from: ${node.prPath}`);
                aidaLogging(`   Patch length: ${node.prPatch?.length || 0} chars`);
                aidaLogging(`   Patch preview: ${node.prPatch?.substring(0, 200)}...`);

                // 🔥 Use async extraction with VS Code API
                const changedSymbols = await extractChangedSymbolsHybrid(node.prPatch, node.relativePath, this._symbolCtx);

                if (changedSymbols.length === 0) {
                    aidaLogging(`⚠️ No changed symbols extracted for: ${node.prPath}`);
                    // Don't fallback - if extraction fails, log clearly
                    nodeChangedSymbols.set(node.id, []);
                } else {
                    aidaLogging(`✅ Extracted ${changedSymbols.length} changed symbols from: ${node.prPath}`);
                    aidaLogging(`   Symbols: ${changedSymbols.map(s => s.fullName).join(', ')}`);
                    nodeChangedSymbols.set(node.id, changedSymbols);
                }

                // Store in node for Deep Impact
                node.changedSymbols = changedSymbols;
            } else if (node.prStatus === 'rename' && node.prPatch) {
                // Renamed + modified file: extract changed symbols if patch exists
                const changedSymbols = await extractChangedSymbolsHybrid(node.prPatch, node.relativePath, this._symbolCtx);

                if (changedSymbols.length > 0) {
                    aidaLogging(`✅ Extracted ${changedSymbols.length} changed symbols from renamed file: ${node.prPath}`);
                    aidaLogging(`   Symbols: ${changedSymbols.map(s => s.fullName).join(', ')}`);
                    nodeChangedSymbols.set(node.id, changedSymbols);
                    node.changedSymbols = changedSymbols;
                } else {
                    // Pure rename (no content changes): full file impact (all dependents need import path updates)
                    aidaLogging(`📄 Full file impact for pure rename: ${node.prPath}`);
                    node.changedSymbols = null;
                }
            } else {
                // New, deleted, or pure rename file: full file impact (no symbol filtering)
                aidaLogging(`📄 Full file impact for ${node.prStatus}: ${node.prPath}`);
                node.changedSymbols = null; // null indicates "scan all symbols"
            }
        }

        // Step 4: Scan dependencies/dependents for each PR node
        const relevantNodeIds = new Set(prNodes.map(n => n.id));
        let filteredDependents = 0;

        // Track which files use which specific symbols
        const symbolToDependentsMap = new Map();

        for (const node of prNodes) {
            if (node.prStatus === 'delete') {
                aidaLogging(`🚫 Skipping dependency/dependent scan for deleted file: ${node.prPath}`);
                continue;
            }

            // Get direct dependents
            const allDependents = this.getDependents(node.id);

            aidaLogging(`\n🔍 Analyzing file: ${node.prPath}`);
            aidaLogging(`   Node ID: ${node.id}`);
            aidaLogging(`   Node relative path: ${node.relativePath}`);
            aidaLogging(`   Changed symbols: [${node.changedSymbols?.map((s: IChangedSymbol) => s.fullName).join(', ') || 'none'}]`);
            aidaLogging(`   Dependents found in graph: ${allDependents.length}`);

            if ((node.prStatus === 'edit' || node.prStatus === 'rename') && node.changedSymbols && node.changedSymbols.length > 0) {
                // ---------------------------------------------------------
                // STRATEGY 1: Barrel / Deep Reference Analysis (VS Code API)
                // ---------------------------------------------------------
                // Only check for barrel usage if NO direct dependents are found.
                // This avoids noise when we already have a clear dependency chain.

                if (allDependents.length === 0) {
                    aidaLogging(`🔍 No direct dependents found → Checking for barrel export usage (Deep Impact)`);

                    const fullPRFilePath = path.join(this.workspaceRoot, node.relativePath);
                    const symbolFileUri = vscode.Uri.file(fullPRFilePath);

                    // Try to find users through barrel exports
                    for (const symbol of node.changedSymbols) {
                        const symbolPosition = new vscode.Position(symbol.lineNumber, symbol.column);

                        aidaLogging(`         🔍 Finding users of: ${symbol.fullName} via barrel chain`);

                        try {
                            const result = await resolveBarrelReferences(
                                this.barrelResolver,
                                symbolFileUri,
                                symbolPosition,
                                symbol.fullName,
                                new Set<string>(),
                                0
                            );

                            if (result.references.length > 0) {
                                aidaLogging(`            🔍 Found ${result.references.length} references through barrel`);

                                // Extract unique file paths (excluding definition and barrel files)
                                const userFiles = new Set<string>();
                                for (const ref of result.references) {
                                    const refPath = ref.uri.fsPath;
                                    const isDefinition = path.normalize(refPath) === path.normalize(fullPRFilePath);
                                    const isBarrel = await isBarrelExport(this.barrelResolver, ref);

                                    aidaLogging(`               🔍 Checking ref: ${path.basename(refPath)} (def=${isDefinition}, barrel=${isBarrel})`);

                                    if (!isDefinition && !isBarrel) {
                                        const relativePath = path.relative(this.workspaceRoot, refPath).replace(/\\/g, '/');
                                        userFiles.add(relativePath);
                                    }
                                }

                                aidaLogging(`            ✅ Found ${userFiles.size} actual user files`);

                                // 🔥 NEW: If no users found via references, try wildcard search through barrel
                                if (userFiles.size === 0 && result.barrelChain && result.barrelChain.length > 0) {
                                    aidaLogging(`            🔍 No users via references → Trying wildcard search through barrel`);

                                    // Find barrel file in chain
                                    for (const barrelInfo of result.barrelChain) {
                                        if (barrelInfo.isWildcard) {
                                            aidaLogging(`               📦 Found wildcard barrel: ${path.basename(barrelInfo.file)}`);

                                            const wildcardRefs = await findImportsOfBarrelFile(
                                                this.barrelResolver,
                                                vscode.Uri.file(barrelInfo.file),
                                                symbol.fullName
                                            );

                                            aidaLogging(`               ✅ Wildcard search found ${wildcardRefs.length} usages`);

                                            for (const ref of wildcardRefs) {
                                                const refPath = ref.uri.fsPath;
                                                const isDefinition = path.normalize(refPath) === path.normalize(fullPRFilePath);

                                                if (!isDefinition) {
                                                    const relativePath = path.relative(this.workspaceRoot, refPath).replace(/\\/g, '/');
                                                    userFiles.add(relativePath);
                                                }
                                            }

                                            break; // Only use first wildcard barrel
                                        }
                                    }
                                }

                                // Add these files to dependents
                                for (const userFilePath of userFiles) {
                                    // Find or create node for this file
                                    let userNode = this.fullGraph.nodes.find((n) => n.relativePath === userFilePath);
                                    if (!userNode) {
                                        // Create temporary node for files not in graph
                                        userNode = {
                                            id: userFilePath,
                                            relativePath: userFilePath,
                                            label: path.basename(userFilePath),
                                            type: 'dependency'
                                        };
                                        this.fullGraph.nodes.push(userNode);
                                    }

                                    relevantNodeIds.add(userNode.id);
                                    filteredDependents++;

                                    // Track symbols
                                    const symbolFullName = symbol.fullName;
                                    if (!symbolToDependentsMap.has(symbolFullName)) {
                                        symbolToDependentsMap.set(symbolFullName, []);
                                    }
                                    symbolToDependentsMap.get(symbolFullName).push(userFilePath);

                                    // Add children if any
                                    if (symbol.children && symbol.children.length > 0) {
                                        symbol.children.forEach((childName: string) => {
                                            if (!symbolToDependentsMap.has(childName)) {
                                                symbolToDependentsMap.set(childName, []);
                                            }
                                            symbolToDependentsMap.get(childName).push(userFilePath);
                                        });
                                    }

                                    aidaLogging(`            ✅ Added: ${userFilePath}`);
                                }
                            } else {
                                aidaLogging(`            ⚠️ No references found via VS Code API → Trying wildcard search`);

                                // 🔥 NEW: Fallback to wildcard search if no references at all
                                // Find barrel file that re-exports this symbol
                                const prDir = path.dirname(fullPRFilePath);

                                // 🔥 FIX: Use configuration for barrel files
                                const possibleBarrelFiles = getBarrelFiles(fullPRFilePath, this.vscodeAnalyzer);

                                for (const barrelName of possibleBarrelFiles) {
                                    const barrelPath = path.join(prDir, barrelName);

                                    if (fs.existsSync(barrelPath)) {
                                        aidaLogging(`               📦 Found barrel: ${path.basename(barrelPath)}`);

                                        const barrelUri = vscode.Uri.file(barrelPath);
                                        const wildcardRefs = await findImportsOfBarrelFile(
                                            this.barrelResolver,
                                            barrelUri,
                                            symbol.fullName
                                        );

                                        if (wildcardRefs.length > 0) {
                                            aidaLogging(`               ✅ Wildcard search found ${wildcardRefs.length} usages`);

                                            const userFiles = new Set<string>();
                                            for (const ref of wildcardRefs) {
                                                const refPath = ref.uri.fsPath;
                                                const isDefinition = path.normalize(refPath) === path.normalize(fullPRFilePath);

                                                if (!isDefinition) {
                                                    const relativePath = path.relative(this.workspaceRoot, refPath).replace(/\\/g, '/');
                                                    userFiles.add(relativePath);
                                                }
                                            }

                                            // Add these files
                                            for (const userFilePath of userFiles) {
                                                let userNode = this.fullGraph.nodes.find((n) => n.relativePath === userFilePath);
                                                if (!userNode) {
                                                    userNode = {
                                                        id: userFilePath,
                                                        relativePath: userFilePath,
                                                        label: path.basename(userFilePath),
                                                        type: 'dependency'
                                                    };
                                                    this.fullGraph.nodes.push(userNode);
                                                }

                                                relevantNodeIds.add(userNode.id);
                                                filteredDependents++;

                                                const symbolFullName = symbol.fullName;
                                                if (!symbolToDependentsMap.has(symbolFullName)) {
                                                    symbolToDependentsMap.set(symbolFullName, []);
                                                }
                                                symbolToDependentsMap.get(symbolFullName).push(userFilePath);

                                                if (symbol.children && symbol.children.length > 0) {
                                                    symbol.children.forEach((childName: string) => {
                                                        if (!symbolToDependentsMap.has(childName)) {
                                                            symbolToDependentsMap.set(childName, []);
                                                        }
                                                        symbolToDependentsMap.get(childName).push(userFilePath);
                                                    });
                                                }

                                                aidaLogging(`            ✅ Added via fallback: ${userFilePath}`);
                                            }

                                            // Stop after finding the first valid barrel with usages
                                            break;
                                        }
                                    }
                                }
                            }
                        } catch (_error: unknown) {
                            const error = toError(_error);
                            aidaLogging(`            ❌ Error finding barrel references: ${error.message}`);
                        }
                    }
                }

                // ---------------------------------------------------------
                // STRATEGY 2: Static Graph Analysis (Direct Dependents)
                // ---------------------------------------------------------
                if (allDependents.length > 0) {
                    // Has direct dependents - filter them normally
                    aidaLogging(`🔎 Filtering ${allDependents.length} dependents for ${node.prStatus} file: ${node.prPath}`);

                    for (const depId of allDependents) {
                        const depNode = this.fullGraph.nodes.find((n) => n.id === depId);
                        if (!depNode) continue;

                        // Check which specific symbols this dependent uses
                        const usedSymbols = await getUsedSymbols(
                            depNode.relativePath,
                            node.relativePath,
                            node.changedSymbols, // Now passing full symbol objects with positions
                            this._symbolCtx
                        );

                        if (usedSymbols.length > 0) {
                            relevantNodeIds.add(depId);
                            filteredDependents++;

                            // Track which symbols are used by this dependent
                            usedSymbols.forEach(symbolFullName => {
                                if (!symbolToDependentsMap.has(symbolFullName)) {
                                    symbolToDependentsMap.set(symbolFullName, []);
                                }
                                symbolToDependentsMap.get(symbolFullName).push(depNode.relativePath);
                            });

                            aidaLogging(`   ✅ Dependent uses symbols [${usedSymbols.join(', ')}]: ${depNode.relativePath}`);
                        } else {
                            aidaLogging(`   ⭕ Skipping dependent (no symbol usage): ${depNode.relativePath}`);
                        }
                    }
                }
            } else {
                // New/deleted/pure-rename file OR modified with no symbols: include all dependents
                allDependents.forEach((depId: string) => {
                    relevantNodeIds.add(depId);
                });
                aidaLogging(`✅ Included all ${allDependents.length} dependents for ${node.prStatus}: ${node.prPath}`);
            }
        }

        aidaLogging(`📊 Total relevant nodes: ${relevantNodeIds.size}`);

        // Step 5: Build filtered graph
        const filteredGraph: IFilteredGraph = buildFilteredGraph(
            relevantNodeIds,
            prNodes,
            nodeChangedSymbols,
            this.fullGraph,
            this.vscodeAnalyzer
        );

        // Step 6: Add PR summary
        filteredGraph.prSummary = {
            totalPRFiles: prFiles.length,
            matchedNodes: prNodes.length,
            totalDependencies: 0, // Dependencies are now hidden
            totalDependents: filteredGraph.nodes.filter((n) => n.nodeType === 'dependent' || n.nodeType === 'both').length,
            filteredDependents: filteredDependents,
            totalNodes: filteredGraph.nodes.length,
            totalEdges: filteredGraph.edges.length,
            addedFiles: prFiles.filter((f: IPRFileInput) => f.status === 'add').length,
            modifiedFiles: prFiles.filter((f: IPRFileInput) => f.status === 'edit').length,
            deletedFiles: prFiles.filter((f: IPRFileInput) => f.status === 'delete').length,
            renamedFiles: prFiles.filter((f: IPRFileInput) => f.status === 'rename').length,
            totalAdditions: prFiles.reduce((sum: number, f: IPRFileInput) => sum + f.additions, 0),
            totalDeletions: prFiles.reduce((sum: number, f: IPRFileInput) => sum + f.deletions, 0)
        };

        // Attach symbol-to-dependents mapping for detailed output
        filteredGraph.symbolToDependentsMap = symbolToDependentsMap;

        return filteredGraph;
    }

    /**
     * Find nodes matching PR files
     */
    findPRNodes(prFiles: IPRFileInput[]): IPRGraphNode[] {
        const nodes: IPRGraphNode[] = [];

        for (const prFile of prFiles) {
            // Normalize path (handle both / and \ separators)
            const normalizedPath = prFile.path.replace(/\\/g, '/');
            const fileName = path.basename(normalizedPath);

            // Find in full graph by relativePath or fileName
            const node = this.fullGraph.nodes.find((n) => {
                const nodeRelPath = (n.relativePath || '').replace(/\\/g, '/');
                const nodeFileName = path.basename(nodeRelPath);

                // Try exact match first
                if (nodeRelPath === normalizedPath) {
                    return true;
                }

                // Try end-of-path match (for cases where PR path is relative)
                if (nodeRelPath.endsWith(normalizedPath)) {
                    return true;
                }

                // Try filename match as last resort
                if (nodeFileName === fileName) {
                    return true;
                }

                return false;
            });

            if (node) {
                // Clone node and add PR metadata
                nodes.push({
                    ...node,
                    isPRFile: true,
                    prStatus: prFile.status,
                    prChanges: {
                        additions: prFile.additions,
                        deletions: prFile.deletions,
                        total: prFile.additions + prFile.deletions
                    },
                    prPath: prFile.path,
                    prPatch: prFile.patch || null // Add patch data for symbol extraction
                });

                aidaLogging(`✅ Matched PR file: ${prFile.path} → ${node.relativePath} (${prFile.status})`);
            } else {
                // Handle files not present in cached graph (new or deleted)
                const placeholderNode = prFile.status === 'delete'
                    ? this.createNodeForDeletedFile(prFile)
                    : this.createNodeForNewFile(prFile);
                nodes.push(placeholderNode);
                aidaLogging(`➕ Created node for ${prFile.status} file: ${prFile.path}`);
            }
        }

        return nodes;
    }

    /**
     * Create node for newly added file in PR
     */
    createNodeForNewFile(prFile: IPRFileInput): IPRGraphNode {
        const filePath = prFile.path.replace(/\\/g, '/');
        const fileName = path.basename(filePath);
        const ext = path.extname(fileName).toLowerCase();

        // Determine category based on extension
        let category = 'file';

        // 🔥 FIX: Configuration-driven category detection
        if (this.vscodeAnalyzer && this.vscodeAnalyzer.languageConfig) {
            for (const [lang, config] of (Object.entries(this.vscodeAnalyzer.languageConfig) as [string, ILanguageConfig][])) {
                if (config.extensions && config.extensions.includes(ext)) {
                    category = lang;
                    break;
                }
            }
        }

        return {
            id: `pr_new_${filePath.replace(/[^a-zA-Z0-9]/g, '_')}`,
            fileName: fileName,
            relativePath: filePath,
            category: category,
            isPRFile: true,
            isNewFile: true,
            prStatus: 'add',
            prChanges: {
                additions: prFile.additions,
                deletions: 0,
                total: prFile.additions
            },
            prPath: prFile.path,
            prPatch: prFile.patch || null, // Add patch data
            metadata: {
                isNewFile: true,
                angularEntities: {}
            }
        };
    }

    /**
     * Create node for deleted file (no longer present in cache)
     */
    createNodeForDeletedFile(prFile: IPRFileInput): IPRGraphNode {
        const filePath = prFile.path.replace(/\\/g, '/');
        const fileName = path.basename(filePath);

        return {
            id: `pr_delete_${filePath.replace(/[^a-zA-Z0-9]/g, '_')}`,
            fileName: fileName,
            relativePath: filePath,
            category: 'file',
            isPRFile: true,
            isDeletedFile: true,
            prStatus: 'delete',
            prChanges: {
                additions: 0,
                deletions: prFile.deletions || 0,
                total: prFile.deletions || 0
            },
            prPath: prFile.path,
            prPatch: null,
            metadata: {
                isDeletedFile: true,
                angularEntities: {}
            }
        };
    }

    /**
     * Get dependencies of a node (files that this node imports)
     */
    getDependencies(nodeId: string): string[] {
        const edges = this.fullGraph.edges.filter((e) => e.source === nodeId);
        return edges.map((e) => e.target);
    }

    /**
     * Get dependents of a node (files that import this node)
     */
    getDependents(nodeId: string): string[] {
        const edges = this.fullGraph.edges.filter((e) => e.target === nodeId);
        return edges.map((e) => e.source);
    }

}

// ES exports
export { PRDependencyAnalyzer };
