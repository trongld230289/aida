import * as vscode from 'vscode';
import * as path from 'path';
import { DependencyGraphService } from './dependency-graph-service';
import { VSCodeApiDependencyAnalyzer } from './graph/vscode-api-analyzer';
import { DependencyUtils } from './graph/dependency-utils';
import { aidaLogging } from '../core/settings';
import { toError } from '../core/error-utils';

class FileDependencyAnalyzer {
    workspaceRoot: string;
    graphService: Record<string, any>;
    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
        this.graphService = new DependencyGraphService(workspaceRoot);
    }

    /**
     * Analyze a single file using Fast Scan strategy
     * @param {string} filePath - Absolute path to the file
     */
    async analyzeFile(filePath: string) {
        aidaLogging(`🔍 Analyzing single file: ${filePath}`);
        
        // Strategy: Try Fast Scan first for immediate results
        // This avoids building the full graph (which takes 30s+)
        return this.analyzeFileFast(filePath);
    }

    /**
     * Fast Local Scan - Only analyzes the target file and its direct neighbors
     * @param {string} filePath 
     */
    async analyzeFileFast(filePath: string) {
        aidaLogging(`🚀 Starting Fast Local Scan for: ${filePath}`);
        const startTime = Date.now();

        const nodes = new Map();
        const edges = [];
        
        const relativePath = DependencyUtils.getRelativePath(this.workspaceRoot, filePath);
        const fileName = path.basename(filePath);
        
        // 1. Create Target Node
        const targetNode = {
            id: relativePath,
            relativePath: relativePath,
            label: fileName,
            fileName: fileName,
            displayName: fileName,
            type: 'file',
            entityType: DependencyUtils.inferFileType(fileName),
            nodeType: 'target',
            fsPath: filePath
        };
        nodes.set(relativePath, targetNode);

        // 2. Find Outgoing Dependencies (Imports)
        // We reuse VSCodeApiDependencyAnalyzer but ONLY for this file
        const analyzer = new VSCodeApiDependencyAnalyzer(this.workspaceRoot);
        const fileUri = vscode.Uri.file(filePath);
        
        // This populates analyzer.model.adjacencyList with outgoing edges
        await analyzer.processFile(fileUri);
        
        const outgoingDeps = analyzer.model.adjacencyList.get(relativePath);
        if (outgoingDeps) {
            for (const depPath of outgoingDeps) {
                // Add dependency node
                if (!nodes.has(depPath)) {
                    const depFileName = path.basename(depPath);
                    nodes.set(depPath, {
                        id: depPath,
                        relativePath: depPath,
                        label: depFileName,
                        fileName: depFileName,
                        displayName: depFileName,
                        type: 'file',
                        entityType: DependencyUtils.inferFileType(depFileName),
                        nodeType: 'dependency'
                    });
                }
                
                // Add edge: Target -> Dep
                edges.push({
                    source: relativePath,
                    target: depPath,
                    id: `${relativePath}->${depPath}`
                });
            }
        }
        
        aidaLogging(`   ✅ Found ${outgoingDeps ? outgoingDeps.size : 0} outgoing dependencies`);

        // 3. Find Incoming Dependents (Usages)
        // Use VS Code Reference Provider on the file's symbols
        const dependents = await this.findDependents(fileUri);
        
        for (const depPath of dependents) {
             // Add dependent node
             if (!nodes.has(depPath)) {
                const depFileName = path.basename(depPath);
                nodes.set(depPath, {
                    id: depPath,
                    relativePath: depPath,
                    label: depFileName,
                    fileName: depFileName,
                    displayName: depFileName,
                    type: 'file',
                    entityType: DependencyUtils.inferFileType(depFileName),
                    nodeType: 'dependent'
                });
            } else {
                // If it was already a dependency, mark as both (Circular)
                const node = nodes.get(depPath);
                if (node.nodeType === 'dependency') {
                    node.nodeType = 'both'; 
                }
            }
            
            // Add edge: Dependent -> Target
            edges.push({
                source: depPath,
                target: relativePath,
                id: `${depPath}->${relativePath}`
            });
        }
        
        aidaLogging(`   ✅ Found ${dependents.size} incoming dependents`);
        aidaLogging(` Fast Scan completed in ${Date.now() - startTime}ms`);

        return {
            nodes: Array.from(nodes.values()),
            edges: edges,
            summary: {
                filePath: relativePath,
                dependencies: (outgoingDeps ? outgoingDeps.size : 0),
                dependents: dependents.size
            }
        };
    }

    /**
     * Find files that reference symbols in the target file
     * @param {vscode.Uri} fileUri 
     */
    async findDependents(fileUri: vscode.Uri) {
        const dependents = new Set<string>();
        
        try {
            // Get all symbols in the file
            // We use executeDocumentSymbolProvider to get classes, functions, etc.
            const symbols = await vscode.commands.executeCommand(
                'vscode.executeDocumentSymbolProvider',
                fileUri
            ) as any;
            
            if (!symbols || symbols.length === 0) return dependents;
            
            // 🔥 FIX: Scan ALL top-level symbols, not just first 10
            // Filter to keep only relevant types (Class, Function, Interface, Variable, Enum, Constant)
            // SymbolKind: Class=4, Method=5, Property=6, Field=7, Constructor=8, Enum=9, Interface=10, Function=11, Variable=12, Constant=13
            const relevantSymbols = symbols.filter((s: vscode.DocumentSymbol) => {
                const kind = s.kind;
                return (kind === 4 || kind === 9 || kind === 10 || kind === 11 || kind === 12 || kind === 13);
            });

            aidaLogging(`   🔍 Scanning references for ${relevantSymbols.length} symbols...`);
            
            // Use Promise.all to run in parallel (much faster)
            const referencePromises = relevantSymbols.map(async (symbol: vscode.DocumentSymbol) => {
                const position = symbol.selectionRange ? symbol.selectionRange.start : (symbol as any).location.range.start;
                try {
                    const refs = await vscode.commands.executeCommand(
                        'vscode.executeReferenceProvider',
                        fileUri,
                        position
                    ) as any;
                    return refs || [];
                } catch (_e: unknown) {
                    return [];
                }
            });

            const results = await Promise.all(referencePromises);
            
            // Process results
            for (const references of results) {
                for (const ref of references) {
                    const refPath = ref.uri.fsPath;
                    
                    // Ignore self-references
                    if (refPath === fileUri.fsPath) continue;
                    
                    // Ignore external/node_modules
                    if (DependencyUtils.isExternalDependency(refPath)) continue;
                    
                    const relativePath = DependencyUtils.getRelativePath(this.workspaceRoot, refPath);
                    dependents.add(relativePath);
                }
            }
            
            // 🔥 NEW: Asset Fallback Strategy
            // If no dependents found via LSP, and it's an asset file (html, css, scss...), try Text Search
            if (dependents.size === 0) {
                const ext = path.extname(fileUri.fsPath).toLowerCase();
                const assetExtensions = ['.html', '.css', '.scss', '.less', '.sass', '.json', '.xml', '.svg', '.png', '.jpg'];
                
                if (assetExtensions.includes(ext)) {
                    aidaLogging(`   ⚠️ No LSP dependents found for asset file. Trying Sibling Convention...`);
                    const fileName = path.basename(fileUri.fsPath);
                    
                    // Strategy: Check "Sibling" TS file (Convention over Configuration)
                    // e.g. 'abc.component.html' -> check 'abc.component.ts'
                    if (fileName.includes('.component.') || fileName.includes('.service.')) {
                        // Use shared utility
                        const siblings = DependencyUtils.findSiblingFiles(fileUri.fsPath, ['.ts']);
                        
                        for (const tsPath of siblings) {
                            try {
                                const doc = await vscode.workspace.openTextDocument(tsPath);
                                const text = doc.getText();
                                if (text.includes(fileName)) {
                                    const relativePath = path.relative(this.workspaceRoot, tsPath).replace(/\\/g, '/');
                                    dependents.add(relativePath);
                                    aidaLogging(`   ✅ Found dependent via Sibling Convention: ${relativePath}`);
                                }
                            } catch (_e: unknown) {
                                // Sibling ts file might not exist or error reading
                            }
                        }
                    }
                }
            }
            
        } catch (_error: unknown) {
            const error = toError(_error);
            aidaLogging(`⚠️ Error finding dependents: ${error.message}`);
        }
        
        return dependents;
    }
}

// ES exports
export { FileDependencyAnalyzer };
