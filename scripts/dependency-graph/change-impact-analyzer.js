const vscode = require('vscode');
const path = require('path');
const fs = require('fs').promises;
const { VSCodeApiDependencyAnalyzer } = require('./vscode-api-analyzer');

/**
 * Change-Impact Analysis System
 * 
 * Purpose: Build a Change-Impact Graph based on actual code changes in a PR
 * to detect "Hidden Impacts" - files affected by changes but not included in the PR.
 * 
 * Process:
 * 1. Identify Initial Nodes (PR Files)
 * 2. Extract Code Changes (exports, keys, logic)
 * 3. Scan Workspace for Usages
 * 4. Construct & Expand Graph (add hidden impact nodes)
 */
class ChangeImpactAnalyzer {
    constructor(workspaceRoot) {
        this.workspaceRoot = workspaceRoot || vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath;
        this.apiAnalyzer = new VSCodeApiDependencyAnalyzer(this.workspaceRoot);
        
        // Cache for performance
        this.fileContentCache = new Map();
        this.symbolCache = new Map();
    }

    /**
     * Main entry point for impact analysis
     * @param {string[]} prFiles - List of files in the PR (relative paths)
     * @param {object} options - Analysis options
     * @returns {Promise<object>} Impact graph with nodes and edges
     */
    async analyzeImpact(prFiles, options = {}) {
        const {
            includeDiffAnalysis = true,
            includeExportAnalysis = true,
            includeUsageAnalysis = true,
            maxDepth = 2
        } = options;

        console.log('🔍 Starting Change-Impact Analysis...');
        console.log(`📁 PR Files: ${prFiles.length}`);
        console.log(`📂 Workspace: ${this.workspaceRoot}`);

        // Step 1: Initialize graph with PR files
        const graph = {
            nodes: [],
            edges: [],
            metadata: {
                prFiles: prFiles.map(f => this.normalizePath(f)),
                hiddenImpacts: [],
                analysisDate: new Date().toISOString()
            }
        };

        // Create initial nodes
        for (const file of prFiles) {
            const normalizedPath = this.normalizePath(file);
            graph.nodes.push({
                id: normalizedPath,
                label: path.basename(file),
                path: normalizedPath,
                type: 'pr-file',
                changedSymbols: []
            });
        }

        // Step 2: Extract code changes for each PR file
        console.log('\n📝 Step 2: Extracting code changes...');
        const changedSymbols = await this.extractCodeChanges(prFiles);
        
        // Update nodes with changed symbols
        for (const [filePath, symbols] of changedSymbols.entries()) {
            const node = graph.nodes.find(n => n.path === filePath);
            if (node) {
                node.changedSymbols = symbols;
            }
        }

        // Step 3: Scan workspace for usages
        console.log('\n🔎 Step 3: Scanning workspace for symbol usages...');
        const usageMap = await this.scanWorkspaceForUsages(changedSymbols);

        // Step 4: Build impact graph
        console.log('\n🔗 Step 4: Building impact graph...');
        await this.buildImpactGraph(graph, usageMap, changedSymbols);

        // Generate summary
        this.generateSummary(graph);

        return graph;
    }

    /**
     * Step 2: Extract code changes from PR files
     * Identifies: exports, new keys, function signatures, etc.
     */
    async extractCodeChanges(prFiles) {
        const changedSymbols = new Map();

        for (const file of prFiles) {
            const absolutePath = path.isAbsolute(file) 
                ? file 
                : path.join(this.workspaceRoot, file);
            
            const normalizedPath = this.normalizePath(file);
            
            try {
                // Check if file exists
                await fs.access(absolutePath);
                
                // Analyze file to get its symbols
                const symbols = await this.extractSymbolsFromFile(absolutePath);
                
                if (symbols.length > 0) {
                    changedSymbols.set(normalizedPath, symbols);
                    console.log(`  ✓ ${path.basename(file)}: Found ${symbols.length} symbols`);
                } else {
                    console.log(`  ⚠ ${path.basename(file)}: No symbols found`);
                }
            } catch (error) {
                console.error(`  ✗ Error analyzing ${file}:`, error.message);
            }
        }

        return changedSymbols;
    }

    /**
     * Extract symbols from a file using VS Code API
     */
    async extractSymbolsFromFile(absolutePath) {
        const uri = vscode.Uri.file(absolutePath);
        const symbols = [];

        try {
            // Get document symbols using VS Code API
            const documentSymbols = await vscode.commands.executeCommand(
                'vscode.executeDocumentSymbolProvider',
                uri
            );

            if (documentSymbols && documentSymbols.length > 0) {
                // Flatten and filter symbols
                const flatSymbols = this.flattenSymbols(documentSymbols);
                
                for (const sym of flatSymbols) {
                    // Focus on exported/public symbols that could affect other files
                    if (this.isRelevantSymbol(sym)) {
                        symbols.push({
                            name: sym.name,
                            kind: vscode.SymbolKind[sym.kind],
                            line: sym.range.start.line,
                            containerName: sym.containerName || '',
                            range: {
                                start: { line: sym.range.start.line, character: sym.range.start.character },
                                end: { line: sym.range.end.line, character: sym.range.end.character }
                            }
                        });
                    }
                }
            }

            // Also extract string literals for resource keys (e.g., message-resources.ts)
            if (absolutePath.includes('resource') || absolutePath.includes('constant')) {
                const resourceKeys = await this.extractResourceKeys(absolutePath);
                symbols.push(...resourceKeys);
            }

        } catch (error) {
            console.error(`Error extracting symbols from ${absolutePath}:`, error.message);
        }

        return symbols;
    }

    /**
     * Extract resource keys and constants from files like message-resources.ts and constants.ts
     */
    async extractResourceKeys(absolutePath) {
        const keys = [];
        
        try {
            const content = await fs.readFile(absolutePath, 'utf8');
            
            // Pattern 1: Match export const CONSTANT_NAME = value
            const exportConstPattern = /export\s+const\s+([A-Z_][A-Z0-9_]*)\s*=/gm;
            let match;
            
            while ((match = exportConstPattern.exec(content)) !== null) {
                const constName = match[1];
                keys.push({
                    name: constName,
                    kind: 'Constant',
                    type: 'export-const',
                    line: content.substring(0, match.index).split('\n').length - 1
                });
                console.log(`  ✓ Extracted export const: ${constName}`);
            }
            
            // Pattern 2: Match object keys: key: "value" or key = "value"
            const keyPattern = /(?:^|\s)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*[:=]/gm;
            
            while ((match = keyPattern.exec(content)) !== null) {
                const keyName = match[1];
                
                // Skip common keywords and already extracted constants
                if (!['const', 'let', 'var', 'export', 'import', 'from', 'return', 'function', 'class'].includes(keyName) &&
                    !keys.some(k => k.name === keyName)) {
                    keys.push({
                        name: keyName,
                        kind: 'Property',
                        type: 'resource-key',
                        line: content.substring(0, match.index).split('\n').length - 1
                    });
                }
            }
        } catch (error) {
            console.error(`Error extracting resource keys:`, error.message);
        }

        return keys;
    }

    /**
     * Step 3: Scan workspace for usages of changed symbols
     */
    async scanWorkspaceForUsages(changedSymbols) {
        const usageMap = new Map(); // symbolName -> [files using it]

        // Collect all symbol names
        const allSymbolNames = new Set();
        for (const symbols of changedSymbols.values()) {
            for (const symbol of symbols) {
                allSymbolNames.add(symbol.name);
            }
        }

        console.log(`  Searching for ${allSymbolNames.size} unique symbols...`);

        // Use VS Code's search API for better performance
        for (const symbolName of allSymbolNames) {
            try {
                const locations = await this.findSymbolUsages(symbolName);
                
                if (locations.length > 0) {
                    usageMap.set(symbolName, locations);
                    console.log(`  ✓ "${symbolName}": Found in ${locations.length} files`);
                }
            } catch (error) {
                console.warn(`  ⚠ Error searching for "${symbolName}":`, error.message);
            }
        }

        return usageMap;
    }

    /**
     * Find all usages of a symbol across the workspace
     */
    async findSymbolUsages(symbolName) {
        const locations = [];

        try {
            // Use workspace.findFiles and grep for better control
            const files = await vscode.workspace.findFiles(
                '**/*.{ts,js,html,vue,tsx,jsx}',
                '**/node_modules/**'
            );

            for (const fileUri of files) {
                try {
                    const content = await fs.readFile(fileUri.fsPath, 'utf8');
                    
                    // Check if symbol is used in this file
                    if (content.includes(symbolName)) {
                        const relativePath = path.relative(this.workspaceRoot, fileUri.fsPath);
                        locations.push({
                            path: this.normalizePath(relativePath),
                            absolutePath: fileUri.fsPath,
                            fileName: path.basename(fileUri.fsPath)
                        });
                    }
                } catch (error) {
                    // Skip files that can't be read
                }
            }
        } catch (error) {
            console.error(`Error finding usages for ${symbolName}:`, error.message);
        }

        return locations;
    }

    /**
     * Step 4: Build the impact graph
     */
    async buildImpactGraph(graph, usageMap, changedSymbols) {
        const prFilePaths = new Set(graph.metadata.prFiles);
        const hiddenImpacts = [];
        
        console.log('  Building impact graph...');
        
        // For each symbol and its usages, determine impact
        for (const [symbolName, usageLocations] of usageMap.entries()) {
            console.log(`  Processing symbol "${symbolName}" with ${usageLocations.length} usages`);
            
            for (const location of usageLocations) {
                const locationPath = location.path;
                
                // Check if this usage location is already in the PR
                const isInPR = prFilePaths.has(locationPath);
                
                if (isInPR) {
                    // Case A: File already in PR - Create internal edge
                    console.log(`    ✓ Internal edge: ${symbolName} used in PR file ${locationPath}`);
                    
                    // Find which PR file changed this symbol
                    let sourceNode = null;
                    for (const [prFile, symbols] of changedSymbols.entries()) {
                        if (symbols.some(s => s.name === symbolName)) {
                            sourceNode = graph.nodes.find(n => n.path === prFile);
                            break;
                        }
                    }
                    
                    // Find target node
                    const targetNode = graph.nodes.find(n => n.path === locationPath);
                    
                    if (sourceNode && targetNode) {
                        // Create edge if it doesn't already exist
                        const edgeExists = graph.edges.some(e => 
                            e.source === sourceNode.id && e.target === targetNode.id
                        );
                        
                        if (!edgeExists) {
                            graph.edges.push({
                                source: sourceNode.id,
                                target: targetNode.id,
                                type: 'symbol-usage',
                                label: symbolName,
                                symbolsUsed: [symbolName]
                            });
                        }
                    }
                    
                } else {
                    // Case B: File NOT in PR - Hidden Impact!
                    console.log(`    🚨 Hidden Impact: ${symbolName} used in ${locationPath} (NOT in PR)`);
                    
                    // Check if we already identified this file as a hidden impact
                    let existingImpact = hiddenImpacts.find(hi => hi.path === locationPath);
                    
                    if (existingImpact) {
                        // Add symbol to existing impact
                        if (!existingImpact.affectedSymbols.includes(symbolName)) {
                            existingImpact.affectedSymbols.push(symbolName);
                        }
                    } else {
                        // Create new hidden impact entry
                        hiddenImpacts.push({
                            path: locationPath,
                            fileName: path.basename(locationPath),
                            affectedSymbols: [symbolName],
                            type: 'hidden-impact',
                            riskLevel: 'medium' // Default risk level
                        });
                        
                        // Add as new node to graph
                        graph.nodes.push({
                            id: locationPath,
                            label: path.basename(locationPath),
                            path: locationPath,
                            type: 'hidden-impact',
                            affectedSymbols: [symbolName]
                        });
                    }
                }
            }
        }
        
        // Update metadata
        graph.metadata.hiddenImpacts = hiddenImpacts;
        graph.metadata.totalHiddenImpacts = hiddenImpacts.length;
        graph.metadata.totalSymbolsChanged = [...changedSymbols.values()].reduce((sum, arr) => sum + arr.length, 0);
        
        console.log(`  ✅ Impact graph built: ${hiddenImpacts.length} hidden impacts found`);
    }

    /**
     * Check if two paths match (handles different formats)
     */
    pathsMatch(path1, path2) {
        // Normalize both paths
        const norm1 = this.normalizePath(path1).toLowerCase();
        const norm2 = this.normalizePath(path2).toLowerCase();
        
        // Exact match
        if (norm1 === norm2) return true;
        
        // Suffix match (in case one has workspace prefix)
        if (norm1.endsWith(norm2) || norm2.endsWith(norm1)) return true;
        
        // Match last 2 segments (folder/file.ts)
        const segments1 = norm1.split('/');
        const segments2 = norm2.split('/');
        
        if (segments1.length >= 2 && segments2.length >= 2) {
            const suffix1 = segments1.slice(-2).join('/');
            const suffix2 = segments2.slice(-2).join('/');
            if (suffix1 === suffix2) return true;
        }
        
        return false;
    }

    /**
     * Generate analysis summary
     */
    generateSummary(graph) {
        console.log('\n' + '='.repeat(60));
        console.log('📊 CHANGE-IMPACT ANALYSIS SUMMARY');
        console.log('='.repeat(60));
        console.log(`Initial PR Nodes: ${graph.metadata.prFiles.length}`);
        console.log(`Total Graph Nodes: ${graph.nodes.length}`);
        console.log(`Hidden Impact Nodes: ${graph.metadata.hiddenImpacts.length}`);
        console.log(`Total Edges: ${graph.edges.length}`);
        
        if (graph.metadata.hiddenImpacts.length > 0) {
            console.log('\n⚠️  WARNING: The following files are impacted but NOT in the PR:');
            graph.metadata.hiddenImpacts.forEach(file => {
                const node = graph.nodes.find(n => n.path === file);
                const symbols = node?.impactedBy || [];
                console.log(`  📄 ${file}`);
                if (symbols.length > 0) {
                    console.log(`     → Impacted by: ${symbols.join(', ')}`);
                }
            });
        } else {
            console.log('\n✅ No hidden impacts found. Graph is contained within PR files.');
        }
        
        console.log('='.repeat(60));
    }

    /**
     * Helper: Flatten hierarchical symbols (e.g., Class -> Methods)
     */
    flattenSymbols(symbols, parentName = '') {
        const flat = [];
        
        for (const symbol of symbols) {
            const symbolWithParent = {
                ...symbol,
                containerName: parentName
            };
            flat.push(symbolWithParent);
            
            if (symbol.children && symbol.children.length > 0) {
                flat.push(...this.flattenSymbols(symbol.children, symbol.name));
            }
        }
        
        return flat;
    }

    /**
     * Check if a symbol is relevant for impact analysis
     */
    isRelevantSymbol(symbol) {
        const kind = symbol.kind;
        
        // Include: Classes, Interfaces, Functions, Methods, Properties, Variables
        const relevantKinds = [
            vscode.SymbolKind.Class,
            vscode.SymbolKind.Interface,
            vscode.SymbolKind.Function,
            vscode.SymbolKind.Method,
            vscode.SymbolKind.Property,
            vscode.SymbolKind.Variable,
            vscode.SymbolKind.Enum,
            vscode.SymbolKind.Constant
        ];

        if (!relevantKinds.includes(kind)) {
            return false;
        }

        // Exclude Angular lifecycle hooks and constructors
        const name = symbol.name;
        if (name.startsWith('ngOn') || name === 'constructor') {
            return false;
        }

        return true;
    }

    /**
     * Normalize file path to use forward slashes and be relative to workspace
     */
    normalizePath(filePath) {
        let normalized = filePath;
        
        // Convert to relative if absolute
        if (path.isAbsolute(filePath)) {
            normalized = path.relative(this.workspaceRoot, filePath);
        }
        
        // Convert backslashes to forward slashes
        normalized = normalized.replace(/\\/g, '/');
        
        return normalized;
    }

    /**
     * Get changed files from git (alternative to manual PR file list)
     */
    async getChangedFilesFromGit(baseBranch = 'main') {
        const changedFiles = [];
        
        try {
            const { exec } = require('child_process');
            const { promisify } = require('util');
            const execAsync = promisify(exec);
            
            // Get changed files compared to base branch
            const { stdout } = await execAsync(
                `git diff --name-only ${baseBranch}...HEAD`,
                { cwd: this.workspaceRoot }
            );
            
            const files = stdout.trim().split('\n').filter(f => f.length > 0);
            changedFiles.push(...files);
            
            console.log(`📋 Found ${files.length} changed files from git`);
        } catch (error) {
            console.error('Error getting changed files from git:', error.message);
        }
        
        return changedFiles;
    }
}

module.exports = { ChangeImpactAnalyzer };
