import * as vscode from 'vscode';
import * as path from 'path';
import * as _fs from 'fs';
import { BarrelResolver } from './barrel-resolver';
import { aidaLogging } from '../../core/settings';
import { languageConfig } from './language-rules';
import { DependencyGraphModel } from './graph-model';
import { GraphWatcher } from './graph-watcher';
import { DependencyUtils } from './dependency-utils';
import { toError } from '../../core/error-utils';
import { commonIgnores } from '../../core/ignore-rules';

/**
 * Enhanced Dependency Analyzer using VS Code Language Server APIs
 * Strategy: "Symbol Crawling" - Use regex to find candidates, then LSP to resolve accurately
 */
class VSCodeApiDependencyAnalyzer {
    workspaceRoot: string | null;
    model: DependencyGraphModel;
    watcher: GraphWatcher;
    isReady: boolean;
    barrelResolver: BarrelResolver;
    languageConfig: Record<string, Record<string, any>>;
    extensionMap: Map<string, string>;
    onGraphUpdate!: (() => void) | null;
    constructor(workspaceRoot: string | null = null) {
        this.workspaceRoot = workspaceRoot;

        // 🔥 NEW: Use Graph Model instead of raw Map
        this.model = new DependencyGraphModel();

        // 🔥 NEW: Watcher for incremental updates
        this.watcher = new GraphWatcher(this) as any;
        this.isReady = false;

        // 🔥 NEW: Barrel resolver for advanced barrel file handling
        this.barrelResolver = new BarrelResolver();

        // Configuration-driven language support
        this.languageConfig = languageConfig;

        // Build extension to language mapping for fast lookup
        this.extensionMap = this.buildExtensionMap();
    }

    /**
     * Build extension to language mapping
     * @returns {Map} - Extension to language map
     */
    buildExtensionMap() {
        const map = new Map();
        for (const [language, config] of (Object.entries(this.languageConfig) as [string, any][])) {
            config.extensions.forEach((ext: string) => map.set(ext, language));
        }
        return map;
    }

    /**
     * Load graph from cache data
     * @param {Object} graphData - The serialized graph data (nodes, edges)
     */
    loadFromCache(graphData: Record<string, any>) {
        try {
            this.model.clear();

            // Reconstruct adjacency list from edges
            if (graphData.edges) {
                for (const edge of graphData.edges) {
                    this.model.addDependency(edge.source, edge.target);
                }
            }

            // Mark as ready and start watching
            this.isReady = true;
            this.watcher.startWatching();

            aidaLogging('✅ Graph model restored from cache');
        } catch (error: unknown) {
            aidaLogging('❌ Failed to load graph from cache:', error);
            this.isReady = false;
        }
    }

    /**
     * Main entry point - scan workspace for dependencies
     * @returns {Object} - Complete dependency graph
     */
    async analyze() {
        try {
            aidaLogging('🔍 Starting Symbol Crawling analysis...');

            // Reset graph
            this.model.clear();
            this.isReady = false;

            // Step 1: Find all source files
            const sourceFiles = await this.findSourceFiles();
            aidaLogging(`📁 Found ${sourceFiles.length} source files`);

            // Step 2: Process each file with throttling
            for (let i = 0; i < sourceFiles.length; i++) {
                const fileUri = sourceFiles[i]!;
                aidaLogging(`📝 Processing ${i + 1}/${sourceFiles.length}: ${path.basename(fileUri.fsPath)}`);

                await this.processFile(fileUri);

                // Throttle to prevent freezing Extension Host
                await this.sleep(5);
            }

            // Mark graph as ready and start watching
            this.isReady = true;
            this.watcher.startWatching();

            // Step 3: Convert to nodes/edges format
            return this.buildGraphResult();

        } catch (_error: unknown) {
            const error = toError(_error);
            aidaLogging('❌ Symbol crawling failed:', error);
            throw new Error(`Symbol crawling analysis failed: ${error.message}`);
        }
    }

    /**
     * Find all source files in workspace (.ts, .js, .cs, etc.)
     * @returns {Array} - Array of file URIs
     */
    async findSourceFiles() {
        // Generate patterns from language config
        const patterns = [...new Set(
            (Object.values(this.languageConfig) as any[])
                .flatMap(config => config.extensions.map((ext: string) => `**/*${ext}`))
        )];

        // Collect all exclude patterns from language configs + common excludes

        const commonExcludes = commonIgnores;

        const languageExcludes = [...new Set(
            (Object.values(this.languageConfig) as any[])
                .flatMap(config => config.excludePatterns || [])
        )];

        const excludePatterns = [...commonExcludes, ...languageExcludes];

        const allFiles = [];

        for (const pattern of patterns) {
            try {
                const files = await vscode.workspace.findFiles(
                    pattern,
                    `{${excludePatterns.join(',')}}`
                );
                allFiles.push(...files);
            } catch (_error: unknown) {
                const error = toError(_error);
                aidaLogging(`⚠️ Error finding files with pattern ${pattern}:`, error.message);
            }
        }

        // Remove duplicates and filter workspace files
        const uniqueFiles = Array.from(new Set(allFiles.map(uri => uri.toString())))
            .map(uriString => vscode.Uri.parse(uriString))
            .filter(uri => uri.fsPath.startsWith(this.workspaceRoot as any))
            // 🔥 NEW: Exclude files in the root directory (same level as package.json)
            .filter(uri => {
                const fileDir = path.dirname(uri.fsPath);
                // Check if file is directly in workspace root
                // We compare normalized paths to be safe
                return path.normalize(fileDir) !== path.normalize(this.workspaceRoot as any);
            });

        return uniqueFiles;
    }

    /**
     * Process a single file using configuration-driven approach
     * @param {vscode.Uri} fileUri - File to process
     */
    async processFile(fileUri: vscode.Uri) {
        // 🔥 Safety Check: Explicitly ignore node_modules and output directories
        // This prevents accidental scanning if glob patterns fail
        if (fileUri.fsPath.includes('node_modules') ||
            fileUri.fsPath.includes('out-tsc') ||
            fileUri.fsPath.includes('coverage')) {
            return;
        }

        try {
            const document = await vscode.workspace.openTextDocument(fileUri);
            const text = document.getText();
            const extension = path.extname(fileUri.fsPath).toLowerCase();

            // Initialize source file in graph
            const sourceFile = this.getRelativePath(fileUri.fsPath);
            // Ensure node exists in model
            if (!this.model.adjacencyList.has(sourceFile)) {
                this.model.adjacencyList.set(sourceFile, new Set<string>());
            }

            // Auto-detect language from extension
            const language = this.extensionMap.get(extension);
            if (!language) {
                // aidaLogging(`⚠️ Unsupported file extension: ${extension}`);
                return;
            }

            // Process file with language-specific configuration
            const config = this.languageConfig[language]!;
            await this.processWithConfig(document, text, sourceFile, config, language);

            // 🔥 NEW: Asset Fallback (Sibling Convention)
            // If it's a TS/JS file, check for sibling HTML/CSS
            if (language === 'typescript' || language === 'javascript') {
                await this.processSiblingAssets(fileUri, sourceFile);
            }

        } catch (_error: unknown) {
            const error = toError(_error);
            aidaLogging(`⚠️ Error processing file ${fileUri.fsPath}:`, error.message);
        }
    }

    /**
     * Check for sibling asset files (HTML/CSS) and add them as dependencies
     * @param {vscode.Uri} fileUri 
     * @param {string} sourceFile 
     */
    async processSiblingAssets(fileUri: vscode.Uri, sourceFile: string) {
        const extensions = ['.html', '.css', '.scss', '.less', '.sass'];

        // Use shared utility
        const siblings = DependencyUtils.findSiblingFiles(fileUri.fsPath, extensions);

        for (const siblingPath of siblings) {
            const targetFile = this.getRelativePath(siblingPath);
            this.model.addDependency(sourceFile, targetFile);
        }
    }

    /**
     * Generic file processor using language configuration
     * @param {vscode.TextDocument} document - Document to process
     * @param {string} text - File content
     * @param {string} sourceFile - Source file relative path
     * @param {Object} config - Language configuration
     * @param {string} language - Language name
     */
    async processWithConfig(document: vscode.TextDocument, text: string, sourceFile: string, config: Record<string, any>, language: string) {
        try {
            const processedSymbols = new Set<string>();

            // 1. Try VS Code Link Provider (High Accuracy for Imports)
            try {
                const links = await vscode.commands.executeCommand('vscode.executeLinkProvider', document.uri) as any;
                if (links && links.length > 0) {
                    for (const link of links) {
                        if (!link.target) continue;

                        const targetPath = link.target.fsPath;

                        // Filter out external dependencies & self-references
                        if (this.isExternalDependency(targetPath) || targetPath === document.uri.fsPath) {
                            continue;
                        }

                        // Add to graph if it's in workspace
                        if (targetPath.startsWith(this.workspaceRoot)) {
                            const targetFile = this.getRelativePath(targetPath);
                            this.model.addDependency(sourceFile, targetFile);
                        }
                    }
                }
            } catch (_e: unknown) {
                // Link provider failed, continue to regex
            }

            // 🔥 NEW: Try VS Code Document Symbol Provider (High Accuracy for Imports)
            // This helps find imports that Link Provider might miss (e.g. named imports)
            try {
                const symbols = await vscode.commands.executeCommand('vscode.executeDocumentSymbolProvider', document.uri) as any;
                if (symbols && symbols.length > 0) {
                    // Filter for Module/Namespace/Package symbols which usually represent imports
                    // SymbolKind: Module=2, Namespace=3, Package=4
                    const importSymbols = symbols.filter((s: Record<string, any>) => s.kind === 2 || s.kind === 3 || s.kind === 4);

                    for (const symbol of importSymbols) {
                        // Use the symbol location to resolve definition
                        const position = symbol.selectionRange ? symbol.selectionRange.start : symbol.location.range.start;
                        const targetFile = await this.resolveDefinition(document, position);

                        if (targetFile) {
                            this.model.addDependency(sourceFile, targetFile);
                            aidaLogging(`🔗 ${sourceFile} -> ${targetFile} (symbol-provider)`);
                        }
                    }
                }
            } catch (_e: unknown) {
                // Symbol provider failed, continue
            }

            // 2. Process import patterns (Fallback & Complementary)
            for (const pattern of config.importPatterns) {
                let match;
                // Reset regex lastIndex for reuse
                pattern.lastIndex = 0;

                while ((match = pattern.exec(text)) !== null) {
                    // We no longer filter by isExternalImport here
                    // We let the LSP resolve it and check the final path

                    await this.resolveAndAddDependency(document, text, match, sourceFile, 'import');
                    await this.sleep(5);
                }
            }

            // 3. Process class/type references (Symbol Crawling)
            if (config.classPattern) {
                let match;
                config.classPattern.lastIndex = 0;

                while ((match = config.classPattern.exec(text)) !== null) {
                    const symbol = match[1];

                    // Skip already processed symbols
                    // We no longer filter by standardLibraries here
                    if (processedSymbols.has(symbol)) {
                        continue;
                    }
                    processedSymbols.add(symbol);

                    await this.resolveAndAddDependency(document, text, match, sourceFile, `class: ${symbol}`);
                    await this.sleep(5);
                }
            }

        } catch (_error: unknown) {
            const error = toError(_error);
            aidaLogging(`⚠️ Error processing ${language} file:`, error.message);
        }
    }

    /**
     * Resolve symbol and add dependency to graph
     * @param {vscode.TextDocument} document - Document
     * @param {string} text - File content
     * @param {Object} match - Regex match object
     * @param {string} sourceFile - Source file path
     * @param {string} type - Dependency type for logging
     */
    async resolveAndAddDependency(document: vscode.TextDocument, text: string, match: RegExpMatchArray, sourceFile: string, type: string) {
        try {
            // 🔥 OPTIMIZATION: Try manual resolution for relative imports first
            // This avoids expensive LSP calls for simple cases like import ... from './utils'
            if (type === 'import' && match[1] && match[1].startsWith('.')) {
                const dir = path.dirname(document.uri.fsPath);
                const candidate = DependencyUtils.resolveRelativeImport(dir, match[1]);

                if (candidate) {
                    const targetFile = this.getRelativePath(candidate);
                    this.model.addDependency(sourceFile, targetFile);
                    return; // Skip LSP
                }
            }

            // 🔥 Python bare module resolution: `from add import x` / `import add`
            // Python bare imports don't start with '.', so the check above skips them.
            // If the module name matches a .py file in the same directory, resolve it
            // directly without LSP (Pylance may not be installed or may fail to resolve
            // local modules in small/standalone repos).
            const fileExt = path.extname(document.uri.fsPath).toLowerCase();
            if (type === 'import' && fileExt === '.py' && match[1] && !match[1].startsWith('.')) {
                const moduleName = (match[1].split('.')[0]) ?? match[1]; // handle dotted: pkg.sub → pkg
                const dir = path.dirname(document.uri.fsPath);
                const candidates = [
                    path.join(dir, moduleName + '.py'),
                    path.join(dir, moduleName, '__init__.py'),
                ];
                for (const candidate of candidates) {
                    try {
                        if (_fs.existsSync(candidate)) {
                            const targetFile = this.getRelativePath(candidate);
                            this.model.addDependency(sourceFile, targetFile);
                            aidaLogging(`🔗 ${sourceFile} -> ${targetFile} (python-local)`);
                            return; // Skip LSP
                        }
                    } catch (_e) { /* ignore */ }
                }
            }

            // Calculate position for LSP resolution
            // FIX: Point to the captured group (the path/symbol) instead of the start of the match
            // This ensures VS Code API receives the correct context
            let absoluteIndex = match.index;
            if (match[1]) {
                const offset = match[0].indexOf(match[1]);
                if (offset !== -1) {
                    absoluteIndex! += offset;
                }
            }

            const line = text.substring(0, absoluteIndex).split('\n').length - 1;
            const character = absoluteIndex! - text.lastIndexOf('\n', absoluteIndex) - 1;
            const position = new vscode.Position(line, character);

            // Use VS Code LSP to resolve actual file
            const targetFile = await this.resolveDefinition(document, position);
            if (targetFile) {
                this.model.addDependency(sourceFile, targetFile);
                aidaLogging(`🔗 ${sourceFile} -> ${targetFile} (${type})`);
            }
        } catch (_error: unknown) {
            // Silent fail - LSP might not be available for this symbol
        }
    }

    /**
     * The "Magic" function - calls VS Code API to find where a symbol is defined
     * @param {vscode.TextDocument} document 
     * @param {vscode.Position} position 
     * @param {number} depth - Recursion depth for barrel files
     * @returns {string|null} - Relative path to target file or null
     */
    async resolveDefinition(document: vscode.TextDocument, position: vscode.Position, depth = 0) {
        // Prevent infinite recursion
        if (depth > 3) return null;

        try {
            const definitions: vscode.Location[] | undefined = await (Promise.resolve(vscode.commands.executeCommand(
                'vscode.executeDefinitionProvider',
                document.uri,
                position
            )).catch((lspError: unknown): undefined => {
                // LSP errors are expected for external dependencies - silently ignore common cases:
                // - C# Language Server: "Sequence contains no matching element" (external library without PDB)
                // - Python Language Server: "No module named" (unresolved imports)
                // - Angular/CSS Language Server: "Invalid Selector" (CSS peek issues)
                // - CSS Peek extension: "Request textDocument/definition failed" (definition lookup failed)
                const errorMsg = (lspError as any)?.message || String(lspError);

                // Only log if it's NOT a common/expected LSP error
                if (!errorMsg.includes('Sequence contains no matching element') &&
                    !errorMsg.includes('No module named') &&
                    !errorMsg.includes('Invalid Selector') &&
                    !errorMsg.includes('textDocument/definition failed')) {
                    aidaLogging(`⚠️ LSP error for ${path.basename(document.fileName)}:${position.line} - ${errorMsg}`);
                }

                return null as any;
            }) as any);

            if (!definitions || definitions.length === 0) {
                return null;
            }

            // Handle both Location and LocationLink formats
            for (const definition of definitions) {
                let targetUri;
                if (definition.uri) {
                    // Location format
                    targetUri = definition.uri;
                } else if ((definition as any).targetUri) {
                    // LocationLink format  
                    targetUri = (definition as any).targetUri;
                } else {
                    continue;
                }

                const targetPath = targetUri.fsPath;

                // Filter out external dependencies
                if (this.isExternalDependency(targetPath) || targetPath === document.uri.fsPath) {
                    continue;
                }

                // Return first valid workspace file
                if (targetPath.startsWith(this.workspaceRoot)) {
                    // Check if it's a barrel file (index.ts/js)
                    const fileName = path.basename(targetPath).toLowerCase();
                    if (fileName.startsWith('index.') && (fileName.endsWith('.ts') || fileName.endsWith('.js'))) {
                        // It's a barrel file! We need to dig deeper.
                        // But we can't just "dig" without knowing WHAT symbol we are looking for.
                        // Since we don't have the symbol name easily here, we accept the barrel file as a dependency.
                        // The consumer -> barrel link is valid.
                        // Ideally, we should also link barrel -> implementation, which happens when we scan the barrel file itself.

                        // However, if the user wants "Consumer -> Implementation" direct link, we would need to parse the barrel.
                        // For now, let's return the barrel file. The graph will be Consumer -> Barrel -> Implementation.
                        // This is technically correct for a dependency graph.
                        return this.getRelativePath(targetPath);
                    }

                    return this.getRelativePath(targetPath);
                }
            }

            return null;

        } catch (_error: unknown) {
            // Language server might not be available
            return null;
        }
    }

    /**
     * Check if a path is external dependency (should be filtered)
     */
    isExternalDependency(filePath: string) {
        return DependencyUtils.isExternalDependency(filePath);
    }

    /**
     * Get relative path from workspace root
     */
    getRelativePath(absolutePath: string) {
        return DependencyUtils.getRelativePath(this.workspaceRoot as any, absolutePath);
    }

    /**
     * Helper to prevent UI freezing
     */
    async sleep(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Check if graph is ready for incremental updates
     */
    isGraphReady() {
        return this.isReady;
    }

    /**
     * Update a single file in the graph (Incremental Update)
     * @param {vscode.Uri} fileUri 
     */
    async updateFile(fileUri: vscode.Uri) {
        const sourceFile = this.getRelativePath(fileUri.fsPath);

        // 1. Clear existing dependencies for this file
        this.model.clearDependencies(sourceFile);

        // 2. Re-analyze the file
        aidaLogging(`🔄 Updating graph for: ${sourceFile}`);
        await this.processFile(fileUri);

        // 3. Notify listeners
        if (this.onGraphUpdate) {
            this.onGraphUpdate();
        }
    }

    /**
     * Remove a file from the graph
     * @param {vscode.Uri} fileUri 
     */
    removeFile(fileUri: vscode.Uri) {
        const sourceFile = this.getRelativePath(fileUri.fsPath);
        this.model.removeNode(sourceFile);
        aidaLogging(`🗑️ Removed from graph: ${sourceFile}`);

        // Notify listeners
        if (this.onGraphUpdate) {
            this.onGraphUpdate();
        }
    }

    /**
     * Convert internal graph to nodes/edges format
     */
    buildGraphResult() {
        const nodes = [];
        const edges = [];

        // Create nodes for all files that have dependencies or are dependencies
        const allFileIds = new Set<string>();
        for (const [sourceFile, dependencies] of this.model.adjacencyList) {
            allFileIds.add(sourceFile);
            dependencies.forEach((dep: string) => allFileIds.add(dep));
        }

        // Create nodes for all referenced files
        for (const fileId of allFileIds) {
            const fullPath = path.join(this.workspaceRoot as any, fileId);
            const fileName = path.basename(fullPath);

            const node = {
                id: fileId,
                fileName,
                filePath: fullPath,
                relativePath: fileId,
                language: this.getLanguageFromExtension(fileName),
                type: this.inferFileType(fileName),
                dependencies: Array.from(this.model.getDependencies(fileId)),
                dependents: [] as any[]
            };

            nodes.push(node);
        }

        // Create edges and update dependents
        let edgeId = 0;
        const nodeIdSet = new Set(nodes.map(n => n.id));

        for (const [sourceFile, dependencies] of this.model.adjacencyList) {
            for (const targetFile of dependencies) {
                // Only create edge if both source and target nodes exist
                if (nodeIdSet.has(sourceFile) && nodeIdSet.has(targetFile)) {
                    const edge = {
                        id: `edge-${edgeId++}`,
                        source: sourceFile,
                        target: targetFile,
                        type: 'dependency',
                        weight: 1,
                        strength: 'medium',
                        discoveredBy: 'symbol-crawling'
                    };

                    edges.push(edge);

                    // Update dependents
                    const targetNode = nodes.find(n => n.id === targetFile);
                    if (targetNode && !targetNode.dependents.includes(sourceFile)) {
                        targetNode.dependents.push(sourceFile);
                    }
                }
            }
        }

        return {
            nodes,
            edges,
            metadata: {
                totalFiles: nodes.length,
                totalDependencies: edges.length,
                analyzedAt: new Date().toISOString(),
                analyzer: 'Symbol Crawling + VS Code LSP'
            }
        };
    }

    /**
     * Get programming language from file extension
     */
    getLanguageFromExtension(fileName: string) {
        return DependencyUtils.getLanguageFromExtension(fileName);
    }

    /**
     * Infer file type (component, service, etc.)
     */
    inferFileType(fileName: string) {
        return DependencyUtils.inferFileType(fileName);
    }

    /**
     * Generate enhanced report with VS Code API insights
     */
    generateReport(graph: Record<string, any>) {
        // Calculate basic metrics
        const totalFiles = graph.nodes.length;
        const totalDependencies = graph.edges.length;

        // Calculate file type distribution
        const typeDistribution: Record<string, any> = {};
        graph.nodes.forEach((node: Record<string, any>) => {
            typeDistribution[node.type] = (typeDistribution[node.type] || 0) + 1;
        });

        // Calculate language distribution  
        const languageDistribution: Record<string, any> = {};
        graph.nodes.forEach((node: Record<string, any>) => {
            languageDistribution[node.language] = (languageDistribution[node.language] || 0) + 1;
        });

        // Find most connected files
        const connectionCounts: Record<string, any> = {};
        graph.edges.forEach((edge: Record<string, any>) => {
            connectionCounts[edge.source] = (connectionCounts[edge.source] || 0) + 1;
            connectionCounts[edge.target] = (connectionCounts[edge.target] || 0) + 1;
        });

        const mostConnected = (Object.entries(connectionCounts))
            .sort(([, a], [, b]) => b - a)
            .slice(0, 10)
            .map(([file, count]) => ({
                file: file,
                connections: count,
                node: graph.nodes.find((n: Record<string, any>) => n.relativePath === file)
            }));

        // Detect potential circular dependencies
        const circularDeps = this.detectCircularDependencies(graph);

        return {
            summary: {
                totalFiles,
                totalDependencies,
                averageDependenciesPerFile: totalFiles > 0 ? totalDependencies / totalFiles : 0,
                typeDistribution,
                languageDistribution,
                analyzedWith: 'Symbol Crawling + VS Code LSP'
            },
            metrics: {
                mostConnected,
                circularDependencies: circularDeps.length,
                circularDependencyDetails: circularDeps
            },
            recommendations: this.generateRecommendations(graph, mostConnected, circularDeps)
        };
    }

    /**
     * Detect circular dependencies
     */
    detectCircularDependencies(graph: Record<string, any>) {
        const visited = new Set<string>();
        const recursionStack = new Set<string>();
        const cycles: string[][] = [];

        const dfs = (nodeId: string, path: string[] = []) => {
            if (recursionStack.has(nodeId)) {
                // Found a cycle
                const cycleStart = path.indexOf(nodeId);
                const cycle = path.slice(cycleStart).concat([nodeId]);
                cycles.push(cycle);
                return;
            }

            if (visited.has(nodeId)) return;

            visited.add(nodeId);
            recursionStack.add(nodeId);
            path.push(nodeId);

            // Find outgoing edges
            const outgoingEdges = graph.edges.filter((edge: Record<string, any>) => edge.source === nodeId);
            for (const edge of outgoingEdges) {
                dfs(edge.target, [...path]);
            }

            recursionStack.delete(nodeId);
            path.pop();
        };

        // Start DFS from each unvisited node
        for (const node of graph.nodes) {
            if (!visited.has(node.relativePath)) {
                dfs(node.relativePath, []);
            }
        }

        return cycles;
    }

    /**
     * Generate actionable recommendations
     */
    generateRecommendations(graph: Record<string, any>, mostConnected: Record<string, any>[], circularDeps: string[][]) {
        const recommendations = [];

        // High coupling recommendations
        const highCouplingThreshold = 10;
        const highCouplingFiles = mostConnected.filter((item: Record<string, any>) => item.connections > highCouplingThreshold);

        if (highCouplingFiles.length > 0) {
            recommendations.push({
                type: 'high-coupling',
                severity: 'warning',
                title: 'High Coupling Detected',
                description: `${highCouplingFiles.length} files have more than ${highCouplingThreshold} dependencies. Consider using interfaces and dependency injection.`,
                files: highCouplingFiles.map((item: Record<string, any>) => item.file),
                action: 'Consider breaking down large components or services into smaller, more focused units.'
            });
        }

        // Circular dependency recommendations
        if (circularDeps.length > 0) {
            recommendations.push({
                type: 'circular-dependency',
                severity: 'error',
                title: 'Circular Dependencies Found',
                description: `Found ${circularDeps.length} circular dependency cycles that should be resolved.`,
                cycles: circularDeps,
                action: 'Break circular dependencies by introducing interfaces, moving shared code to utilities, or restructuring the dependency flow.'
            });
        }

        // Service vs Component balance
        const services = graph.nodes.filter((n: Record<string, any>) => n.type === 'service').length;
        const components = graph.nodes.filter((n: Record<string, any>) => n.type === 'component').length;

        if (components > 0 && services === 0) {
            recommendations.push({
                type: 'architecture',
                severity: 'info',
                title: 'Consider Adding Services',
                description: 'No services found. Consider extracting business logic into services for better separation of concerns.',
                action: 'Create services to handle business logic, data access, and shared functionality.'
            });
        }

        return recommendations;
    }

    // 🔥 ===== BARREL RESOLVER INTEGRATION =====
    // Helper methods to access BarrelResolver functionality

    /**
     * Resolve barrel references recursively
     * @returns {Promise<{references: Location[], barrelChain: Array}>}
     */
    async resolveBarrelReferences(symbolUri: vscode.Uri, symbolPosition: vscode.Position, symbolName: string, visitedBarrels = new Set<string>(), currentLevel = 0) {
        return await this.barrelResolver.resolveBarrelReferences(
            symbolUri, symbolPosition, symbolName, visitedBarrels, currentLevel
        );
    }

    /**
     * Parse barrel export symbol
     * @returns {Promise<{name: string, position: Position, isWildcard: boolean}|null>}
     */
    async getBarrelExportSymbol(barrelLocation: vscode.Location, originalSymbolName: string | null = null) {
        return await this.barrelResolver.getBarrelExportSymbolImproved(barrelLocation, originalSymbolName);
    }

    /**
     * Find imports of barrel file (for wildcard exports)
     * @returns {Promise<Location[]>}
     */
    async findImportsOfBarrelFile(barrelUri: vscode.Uri, symbolName: string, currentLevel = 0) {
        return await this.barrelResolver.findImportsOfBarrelFileImproved(barrelUri, symbolName, currentLevel);
    }

    /**
     * Check if location is a barrel export
     * @returns {Promise<boolean>}
     */
    async isBarrelExport(location: vscode.Location) {
        return await this.barrelResolver.isBarrelExport(location);
    }
}

// ES exports
export { VSCodeApiDependencyAnalyzer };
