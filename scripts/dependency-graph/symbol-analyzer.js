const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const { VSCodeApiDependencyAnalyzer } = require('./vscode-api-analyzer');
const { BarrelResolver } = require('./barrel-resolver');
const { aidaLogging } = require('../core/settings');

class SymbolAnalyzer {
    constructor() {
        // Initialize analyzer to access language config
        this.apiAnalyzer = new VSCodeApiDependencyAnalyzer('');
        // 🔥 NEW: Barrel resolver for advanced barrel file handling
        this.barrelResolver = new BarrelResolver();
    }

    /**
     * Deeply analyze a file to find its symbols and their usages
     * @param {string} filePath - Absolute path to the file
     * @param {object} graph - Optional: Full dependency graph for consistency with Graph View
     */
    async analyzeFile(filePath, graph = null) {
        const uri = vscode.Uri.file(filePath);

        // 1. Get all symbols in the file
        // We use executeDocumentSymbolProvider
        // Note: This requires the language extension (e.g. C#, TS) to be active and ready
        let symbols = [];
        try {
            symbols = await vscode.commands.executeCommand(
                'vscode.executeDocumentSymbolProvider',
                uri
            );
        } catch (e) {
            // LSP errors are expected for external dependencies - silently ignore common cases:
            // - C# Language Server: "Sequence contains no matching element"
            // - Python Language Server: "No module named"
            // - Angular/CSS Language Server: "Invalid Selector"
            // - CSS Peek extension: "Request textDocument/definition failed"
            const errorMsg = e?.message || String(e);
            if (!errorMsg.includes('Sequence contains no matching element') &&
                !errorMsg.includes('No module named') &&
                !errorMsg.includes('Invalid Selector') &&
                !errorMsg.includes('textDocument/definition failed')) {
                aidaLogging(`⚠️ Error getting symbols from ${path.basename(filePath)}: ${errorMsg}`);
            }
            return null;
        }

        if (!symbols || symbols.length === 0) {
            return {
                file: filePath,
                fileName: path.basename(filePath),
                symbols: [],
                relatedFiles: []
            };
        }

        // Flatten symbols if they are hierarchical (e.g. Class -> Methods)
        const flatSymbols = this.flattenSymbols(symbols);

        // Filter for "interesting" symbols (e.g. exported ones, or public members)
        // We skip local variables inside functions usually, keeping Class, Method, Property, Interface, Variable (top level)
        // UPDATE: Removed strict isTopLevel check as it was hiding Classes in some language servers.
        // Added filter to exclude common noisy lifecycle methods.
        const interestingSymbols = flatSymbols.filter(s => {
            // Always keep high-level structures
            if (s.kind === vscode.SymbolKind.Class ||
                s.kind === vscode.SymbolKind.Interface ||
                s.kind === vscode.SymbolKind.Enum) {
                return true;
            }

            // For methods/properties, exclude common lifecycle hooks or noisy names
            if (s.kind === vscode.SymbolKind.Method ||
                s.kind === vscode.SymbolKind.Property ||
                s.kind === vscode.SymbolKind.Function ||
                s.kind === vscode.SymbolKind.Variable) {

                // CRITICAL FIX: Exclude local variables/properties that are NOT top-level
                // If it has a containerName (meaning it's inside something) AND it's a Variable/Function, 
                // it's likely a local variable or inner function which shouldn't be analyzed for external impact.
                // Exception: Class Methods/Properties (which have containerName = ClassName) are fine.
                if (!s.isTopLevel &&
                    (s.kind === vscode.SymbolKind.Variable || s.kind === vscode.SymbolKind.Function) &&
                    s.containerName && !s.containerName.endsWith('Component') && !s.containerName.endsWith('Service') && !s.containerName.endsWith('Store')) {
                    // This heuristic is tricky. Safer bet: Only analyze Top Level Variables/Functions.
                    // Class Members (Method/Property) are fine.
                    return false;
                }

                // Even stricter: If it's a Variable, ONLY analyze if it's Top Level (Global/Module scope).
                // Local variables inside functions are irrelevant for dependency graph.
                if (s.kind === vscode.SymbolKind.Variable && !s.isTopLevel) {
                    return false;
                }

                const name = s.name;
                // Exclude Angular lifecycle methods
                if (name.startsWith('ngOn') || name === 'constructor') return false;

                return true;
            }

            return false;
        });

        const resultSymbols = [];
        const relatedFilesMap = new Map(); // Key: filePath, Value: { path, usages: [] }

        // 2. Find references for each symbol
        // This can be slow, so we process in chunks or sequentially
        for (const sym of interestingSymbols) {
            // We search for references at the definition position
            let references = [];
            try {
                references = await vscode.commands.executeCommand(
                    'vscode.executeReferenceProvider',
                    uri,
                    sym.selectionRange.start // Position of the symbol name
                );
            } catch (e) {
                // LSP errors are expected for external dependencies - silently ignore common cases:
                // - C# Language Server: "Sequence contains no matching element"
                // - Python Language Server: "No module named"
                // - Angular/CSS Language Server: "Invalid Selector"
                // - CSS Peek extension: "Request textDocument/definition failed"
                const errorMsg = e?.message || String(e);
                if (!errorMsg.includes('Sequence contains no matching element') &&
                    !errorMsg.includes('No module named') &&
                    !errorMsg.includes('Invalid Selector') &&
                    !errorMsg.includes('textDocument/definition failed')) {
                    aidaLogging(`⚠️ Could not get references for ${sym.name}: ${errorMsg}`);
                }
            }

            const symbolId = `sym_${sym.name}_${sym.range.start.line}`;

            // Map SymbolKind number to string name
            const kindName = vscode.SymbolKind[sym.kind];

            const symbolData = {
                id: symbolId,
                name: sym.name,
                kind: kindName,
                line: sym.range.start.line,
                containerName: sym.containerName || '',
                usedByFiles: [] // List of file paths that use this symbol
            };

            if (references && references.length > 0) {
                for (const ref of references) {
                    const refFilePath = ref.uri.fsPath;

                    // Skip self-references for the "usedByFiles" list to keep it clean for impact analysis
                    // But we might want to know if it's used internally too? 
                    // For "Impact", external is key.
                    const isSelf = refFilePath.toLowerCase() === filePath.toLowerCase();

                    // Check if file should be excluded (e.g. test files)
                    const isExcluded = this.isExcludedFile(refFilePath);

                    if (!isSelf && !isExcluded) {
                        // Add to symbol's usage list (unique paths)
                        if (!symbolData.usedByFiles.includes(refFilePath)) {
                            symbolData.usedByFiles.push(refFilePath);
                        }

                        // Add to related files map
                        if (!relatedFilesMap.has(refFilePath)) {
                            relatedFilesMap.set(refFilePath, {
                                path: refFilePath,
                                fileName: path.basename(refFilePath),
                                usages: []
                            });
                        }

                        relatedFilesMap.get(refFilePath).usages.push({
                            symbolId: symbolId,
                            symbolName: sym.name,
                            line: ref.range.start.line,
                            // We could read the line content here if we want to show the code snippet
                        });
                    }
                }
            }

            resultSymbols.push(symbolData);
        }

        // 3. Find dependencies (files this file uses)
        // We use the API analyzer's logic to find imports
        const dependencies = await this.findDependencies(filePath);

        // 4. If graph is provided, merge graph-based dependents with symbol-based relatedFiles
        let finalRelatedFiles = Array.from(relatedFilesMap.values());

        if (graph) {
            const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath;
            if (workspaceRoot) {
                // Get relative path for matching with graph
                const relativeFilePath = path.relative(workspaceRoot, filePath).replace(/\\/g, '/');

                // Find dependents from graph (files that import this file)
                const graphDependents = this.getGraphDependents(relativeFilePath, graph, workspaceRoot);

                // Merge: Include all graph files, enhance with symbol data when available
                finalRelatedFiles = this.mergeGraphWithSymbolData(graphDependents, finalRelatedFiles);

                aidaLogging(`📊 SymbolAnalyzer merged: ${graphDependents.length} graph dependents, ${finalRelatedFiles.length} final (with details)`);
            }
        }

        return {
            file: filePath,
            fileName: path.basename(filePath),
            symbols: resultSymbols,
            relatedFiles: finalRelatedFiles,
            dependencies: dependencies
        };
    }

    /**
     * Get dependents from graph (files that import the target file)
     */
    getGraphDependents(nodeId, graph, workspaceRoot) {
        const dependents = [];
        const dependentEdges = graph.edges.filter(edge => {
            const targetId = edge.target.id || edge.target;
            return targetId === nodeId;
        });

        for (const edge of dependentEdges) {
            const sourceId = edge.source.id || edge.source;
            const sourceNode = graph.nodes.find(n => n.id === sourceId);
            if (sourceNode) {
                let absolutePath = sourceId;
                if (!path.isAbsolute(sourceId)) {
                    absolutePath = path.join(workspaceRoot, sourceId);
                }
                dependents.push({
                    path: absolutePath,
                    fileName: sourceNode.fileName || path.basename(sourceId),
                    absolutePath: absolutePath
                });
            }
        }

        return dependents;
    }

    /**
     * Merge graph-based file list with symbol-based usage details
     * This ensures we show ALL files from graph (consistent with Graph View)
     * but also include detailed symbol usage info when available
     */
    mergeGraphWithSymbolData(graphFiles, symbolFiles) {
        const merged = [];
        const symbolFileMap = new Map();

        // Create map of symbol-based files for quick lookup (normalize paths)
        symbolFiles.forEach(sf => {
            const normalizedPath = sf.path.replace(/\\/g, '/').toLowerCase();
            symbolFileMap.set(normalizedPath, sf);
        });

        // For each graph file, try to find matching symbol data
        graphFiles.forEach(gf => {
            const normalizedGraphPath = gf.path.replace(/\\/g, '/').toLowerCase();
            const symbolData = symbolFileMap.get(normalizedGraphPath);

            if (symbolData && symbolData.usages && symbolData.usages.length > 0) {
                // Has detailed usage info - use it with all details
                merged.push(symbolData);
            } else {
                // No detailed usage info - add as graph-only file
                merged.push({
                    path: gf.path,
                    fileName: gf.fileName,
                    usages: [], // Empty usages will trigger "Imports this file" display
                    absolutePath: gf.absolutePath
                });
            }
        });

        return merged;
    }

    /**
     * Find files that the current file depends on (imports)
     * @param {string} filePath 
     */
    async findDependencies(filePath) {
        try {
            const uri = vscode.Uri.file(filePath);
            const document = await vscode.workspace.openTextDocument(uri);
            const text = document.getText();
            const ext = path.extname(filePath).toLowerCase();

            // Get language config
            let language = null;
            let config = null;
            for (const [lang, conf] of Object.entries(this.apiAnalyzer.languageConfig)) {
                if (conf.extensions.includes(ext)) {
                    language = lang;
                    config = conf;
                    break;
                }
            }

            if (!config) return [];

            const dependencies = new Map(); // path -> { path, fileName, imports: [] }

            // Scan for imports using regex from config
            for (const pattern of config.importPatterns) {
                let match;
                pattern.lastIndex = 0;

                while ((match = pattern.exec(text)) !== null) {
                    const importPath = match[1];

                    // Skip external/standard libraries
                    if (this.apiAnalyzer.isExternalImport(importPath, config.standardLibraries, language)) {
                        continue;
                    }

                    // Resolve file path
                    // We use a simplified resolution here since we don't want to call LSP for every import if possible
                    // But for accuracy we should try LSP if regex gives us a position

                    // Calculate position
                    // We need to point exactly to the import path string for resolveDefinition to work
                    const matchString = match[0];
                    const pathIndexInMatch = matchString.indexOf(importPath);
                    const absoluteIndex = match.index + pathIndexInMatch;

                    const line = text.substring(0, absoluteIndex).split('\n').length - 1;
                    const character = absoluteIndex - text.lastIndexOf('\n', absoluteIndex) - 1;
                    const position = new vscode.Position(line, character);

                    // Try LSP resolution first
                    let targetFile = await this.apiAnalyzer.resolveDefinition(document, position);

                    if (targetFile) {
                        // Check if it's a barrel file (index.ts/js)
                        if (this.isBarrelFile(targetFile)) {
                            // Try to resolve specific symbols to get actual files
                            const resolvedFiles = await this.resolveBarrelImports(document, line, text);

                            if (resolvedFiles.length > 0) {
                                for (const resolved of resolvedFiles) {
                                    this.addDependency(dependencies, resolved, importPath);
                                }
                                continue; // Skip adding the barrel file itself if we resolved children
                            }
                        }

                        // Fallback: Add the file (barrel or normal)
                        const absoluteTarget = path.join(this.apiAnalyzer.workspaceRoot, targetFile);
                        this.addDependency(dependencies, absoluteTarget, importPath);
                    }
                }
            }

            return Array.from(dependencies.values());

        } catch (error) {
            aidaLogging('Error finding dependencies:', error);
            return [];
        }
    }

    /**
     * Check if file is a barrel file (index.ts/js)
     * 🔥 Now uses BarrelResolver for more sophisticated detection
     */
    async isBarrelFile(filePath) {
        // Simple filename check (legacy behavior)
        const isIndexFile = filePath.endsWith('index.ts') || filePath.endsWith('index.js') ||
            filePath.endsWith('index.tsx') || filePath.endsWith('index.jsx');

        if (!isIndexFile) return false;

        // 🔥 Use BarrelResolver for deeper analysis
        try {
            const uri = vscode.Uri.file(filePath);
            const location = new vscode.Location(uri, new vscode.Position(0, 0));
            return await this.barrelResolver.isBarrelExport(location);
        } catch (error) {
            // Fallback to simple check
            return isIndexFile;
        }
    }

    /**
     * Try to resolve actual files from a barrel import by analyzing imported symbols
     */
    async resolveBarrelImports(document, lineIndex, fullText) {
        const resolvedFiles = [];
        const lineText = document.lineAt(lineIndex).text;

        // 1. Handle single-line named imports: import { A, B } from '...'
        const namedImportMatch = lineText.match(/\{([^}]+)\}/);
        if (namedImportMatch) {
            const symbols = namedImportMatch[1].split(',').map(s => s.trim()).filter(s => s);

            for (const symbol of symbols) {
                // Handle "A as B" - we need to look up A
                const actualSymbol = symbol.split(/\s+as\s+/)[0];

                // Find position of symbol in the line
                // Note: This is a simple search, might be inaccurate if symbol appears multiple times in line
                const symbolIndex = lineText.indexOf(actualSymbol);

                if (symbolIndex !== -1) {
                    const position = new vscode.Position(lineIndex, symbolIndex);
                    const targetFile = await this.apiAnalyzer.resolveDefinition(document, position);

                    if (targetFile) {
                        const absoluteTarget = path.join(this.apiAnalyzer.workspaceRoot, targetFile);
                        resolvedFiles.push(absoluteTarget);
                    }
                }
            }
        }

        // 2. Handle multiline imports (basic support)
        // If we didn't find {} on this line, but it's an import, maybe look backwards?
        // For now, we'll stick to single line to avoid complexity and performance issues.

        return resolvedFiles;
    }

    /**
     * Helper to add dependency to map
     */
    addDependency(dependenciesMap, absoluteTarget, importPath) {
        if (!dependenciesMap.has(absoluteTarget)) {
            dependenciesMap.set(absoluteTarget, {
                path: absoluteTarget,
                fileName: path.basename(absoluteTarget),
                imports: [importPath]
            });
        } else {
            const dep = dependenciesMap.get(absoluteTarget);
            if (!dep.imports.includes(importPath)) {
                dep.imports.push(importPath);
            }
        }
    }

    flattenSymbols(symbols, parentName = '') {
        let result = [];
        for (const sym of symbols) {
            // Clone to avoid modifying original if needed, or just attach property
            // We need to handle DocumentSymbol vs SymbolInformation. 
            // executeDocumentSymbolProvider usually returns DocumentSymbol[] (hierarchical) or SymbolInformation[] (flat)
            // If it has 'children', it's DocumentSymbol.

            const flatSym = {
                name: sym.name,
                kind: sym.kind,
                range: sym.range,
                selectionRange: sym.selectionRange,
                containerName: parentName
            };

            result.push(flatSym);

            if (sym.children && sym.children.length > 0) {
                result = result.concat(this.flattenSymbols(sym.children, sym.name));
            }
        }
        return result;
    }

    /**
     * Check if a file should be excluded based on language configuration
     * @param {string} filePath 
     */
    isExcludedFile(filePath) {
        const lowerPath = filePath.toLowerCase();
        const ext = path.extname(filePath).toLowerCase();

        // Get language from extension
        let language = null;
        for (const [lang, config] of Object.entries(this.apiAnalyzer.languageConfig)) {
            if (config.extensions.includes(ext)) {
                language = lang;
                break;
            }
        }

        // Only use language-specific exclude patterns
        let excludePatterns = [];
        if (language && this.apiAnalyzer.languageConfig[language].excludePatterns) {
            excludePatterns = this.apiAnalyzer.languageConfig[language].excludePatterns;
        } else {
            // Fallback only if language not found (should be rare)
            return false;
        }

        // Convert glob patterns to simple string checks for now
        // A proper glob matcher would be better, but simple includes works for most cases
        return excludePatterns.some(pattern => {
            // Remove glob stars for simple substring check
            const cleanPattern = pattern.replace(/\*\*\//g, '').replace(/\*\*/g, '').replace(/\*/g, '');
            return lowerPath.includes(cleanPattern.toLowerCase());
        });
    }

    // 🔥 ===== BARREL RESOLVER INTEGRATION =====
    // Helper methods to access BarrelResolver functionality

    /**
     * Resolve barrel references recursively
     * @returns {Promise<{references: Location[], barrelChain: Array}>}
     */
    async resolveBarrelReferences(symbolUri, symbolPosition, symbolName, visitedBarrels = new Set(), currentLevel = 0) {
        return await this.barrelResolver.resolveBarrelReferences(
            symbolUri, symbolPosition, symbolName, visitedBarrels, currentLevel
        );
    }

    /**
     * Parse barrel export symbol
     * @returns {Promise<{name: string, position: Position, isWildcard: boolean}|null>}
     */
    async getBarrelExportSymbol(barrelLocation, originalSymbolName = null) {
        return await this.barrelResolver.getBarrelExportSymbolImproved(barrelLocation, originalSymbolName);
    }

    /**
     * Find imports of barrel file (for wildcard exports)
     * @returns {Promise<Location[]>}
     */
    async findImportsOfBarrelFile(barrelUri, symbolName, currentLevel = 0) {
        return await this.barrelResolver.findImportsOfBarrelFileImproved(barrelUri, symbolName, currentLevel);
    }

    /**
     * Check if location is a barrel export (enhanced version)
     * @returns {Promise<boolean>}
     */
    async isBarrelExportAdvanced(location) {
        return await this.barrelResolver.isBarrelExport(location);
    }
}

module.exports = { SymbolAnalyzer };
