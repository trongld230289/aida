const vscode = require('vscode');
const path = require('path');
const fs = require('fs');

const { VSCodeApiDependencyAnalyzer } = require('./dependency-graph/vscode-api-analyzer');
const { SymbolAnalyzer } = require('./dependency-graph/symbol-analyzer');

// Cache management
const CACHE_VERSION = '1.0';

/**
 * PR Dependency Analyzer
 * Analyzes dependencies for files changed in a PR
 */
class PRDependencyAnalyzer {
    constructor(workspaceRoot) {
        this.workspaceRoot = workspaceRoot;
        this.vscodeAnalyzer = new VSCodeApiDependencyAnalyzer();
        this.symbolAnalyzer = new SymbolAnalyzer();
        this.fullGraph = null; // Cache full graph
        this.cacheFilePath = path.join(workspaceRoot, '.vscode', 'dependency-cache.json');
        this.referenceCache = new Map(); // Cache for reference lookups
    }

    /**
     * Build dependency graph for PR files
     * @param {Array} prFiles - PR file changes [{path, status, additions, deletions}]
     * @returns {Promise<object>} Graph {nodes, edges, prSummary}
     */
    async analyzePRFiles(prFiles) {
        console.log(`🔍 Analyzing ${prFiles.length} PR files...`);

        // Step 1: Load or build full graph (with cache)
        await this.ensureFullGraph();

        // Step 2: Find PR file nodes in full graph
        const prNodes = this.findPRNodes(prFiles);
        console.log(`✅ Matched ${prNodes.length} PR files to graph nodes`);

        // Step 3: Extract changed symbols for MODIFIED files
        // Store changedSymbols in Map<nodeId, symbols[]> for reuse by Deep Impact
        const nodeChangedSymbols = new Map();

        for (const node of prNodes) {
            if (node.prStatus === 'edit' && node.prPatch) {
                // Modified file: extract changed symbols from patch
                console.log(`\n🔍 Extracting symbols from: ${node.prPath}`);
                console.log(`   Patch length: ${node.prPatch?.length || 0} chars`);
                console.log(`   Patch preview: ${node.prPatch?.substring(0, 200)}...`);
                
                const changedSymbols = this.extractChangedSymbols(node.prPatch, node.relativePath);
                
                if (changedSymbols.length === 0) {
                    console.log(`⚠️ No changed symbols extracted for: ${node.prPath}`);
                    // Don't fallback - if extraction fails, log clearly
                    nodeChangedSymbols.set(node.id, []);
                } else {
                    console.log(`✅ Extracted ${changedSymbols.length} changed symbols from: ${node.prPath}`);
                    console.log(`   Symbols: ${changedSymbols.join(', ')}`);
                    nodeChangedSymbols.set(node.id, changedSymbols);
                }
                
                // Store in node for Deep Impact
                node.changedSymbols = changedSymbols;
            } else if (node.prStatus === 'rename' && node.prPatch) {
                // Renamed + modified file: extract changed symbols if patch exists
                const changedSymbols = this.extractChangedSymbols(node.prPatch, node.relativePath);
                
                if (changedSymbols.length > 0) {
                    console.log(`✅ Extracted ${changedSymbols.length} changed symbols from renamed file: ${node.prPath}`);
                    console.log(`   Symbols: ${changedSymbols.join(', ')}`);
                    nodeChangedSymbols.set(node.id, changedSymbols);
                    node.changedSymbols = changedSymbols;
                } else {
                    // Pure rename (no content changes): full file impact (all dependents need import path updates)
                    console.log(`📄 Full file impact for pure rename: ${node.prPath}`);
                    node.changedSymbols = null;
                }
            } else {
                // New, deleted, or pure rename file: full file impact (no symbol filtering)
                console.log(`📄 Full file impact for ${node.prStatus}: ${node.prPath}`);
                node.changedSymbols = null; // null indicates "scan all symbols"
            }
        }

        // Step 4: Scan dependencies/dependents for each PR node
        const relevantNodeIds = new Set(prNodes.map(n => n.id));
        
        let totalDeps = 0;
        let totalDependents = 0;
        let filteredDependents = 0;
        
        // Track which files use which specific symbols
        const symbolToDependentsMap = new Map(); // symbol → [dependent file paths]

        for (const node of prNodes) {
            // Get direct dependencies (always include all)
            const deps = this.getDependencies(node.id);
            deps.forEach(depId => {
                relevantNodeIds.add(depId);
                totalDeps++;
            });
            
            // Get direct dependents
            const allDependents = this.getDependents(node.id);
            
            console.log(`\n🔍 Analyzing file: ${node.prPath}`);
            console.log(`   Node ID: ${node.id}`);
            console.log(`   Node relative path: ${node.relativePath}`);
            console.log(`   Changed symbols: [${node.changedSymbols?.join(', ') || 'none'}]`);
            console.log(`   Dependents found in graph: ${allDependents.length}`);
            
            if ((node.prStatus === 'edit' || node.prStatus === 'rename') && node.changedSymbols && node.changedSymbols.length > 0) {
                // Modified/renamed file with changed symbols: filter dependents by symbol usage
                console.log(`🔎 Filtering ${allDependents.length} dependents for ${node.prStatus} file: ${node.prPath}`);
                
                for (const depId of allDependents) {
                    const depNode = this.fullGraph.nodes.find(n => n.id === depId);
                    if (!depNode) continue;

                    // Check which specific symbols this dependent uses
                    const usedSymbols = await this.getUsedSymbols(
                        depNode.relativePath,
                        node.relativePath,
                        node.changedSymbols // Now passing full symbol objects with positions
                    );

                    if (usedSymbols.length > 0) {
                        relevantNodeIds.add(depId);
                        totalDependents++;
                        filteredDependents++;
                        
                        // Track which symbols are used by this dependent
                        usedSymbols.forEach(symbolFullName => {
                            if (!symbolToDependentsMap.has(symbolFullName)) {
                                symbolToDependentsMap.set(symbolFullName, []);
                            }
                            symbolToDependentsMap.get(symbolFullName).push(depNode.relativePath);
                        });
                        
                        console.log(`   ✅ Dependent uses symbols [${usedSymbols.join(', ')}]: ${depNode.relativePath}`);
                    } else {
                        console.log(`   ⏭️ Skipping dependent (no symbol usage): ${depNode.relativePath}`);
                    }
                }
            } else {
                // New/deleted/pure-rename file OR modified with no symbols: include all dependents
                allDependents.forEach(depId => {
                    relevantNodeIds.add(depId);
                    totalDependents++;
                });
                console.log(`✅ Included all ${allDependents.length} dependents for ${node.prStatus}: ${node.prPath}`);
            }
        }

        console.log(`📊 Found ${totalDeps} dependencies and ${totalDependents} dependents`);
        if (filteredDependents > 0) {
            console.log(`📊 Filtered dependents: ${filteredDependents} (symbol-level filtering applied)`);
        }
        console.log(`📊 Total relevant nodes: ${relevantNodeIds.size}`);

        // Step 5: Build filtered graph
        const filteredGraph = this.buildFilteredGraph(relevantNodeIds, prNodes, nodeChangedSymbols);

        // Step 6: Add PR summary
        filteredGraph.prSummary = {
            totalPRFiles: prFiles.length,
            matchedNodes: prNodes.length,
            totalDependencies: totalDeps,
            totalDependents: totalDependents,
            filteredDependents: filteredDependents,
            totalNodes: filteredGraph.nodes.length,
            totalEdges: filteredGraph.edges.length,
            addedFiles: prFiles.filter(f => f.status === 'add').length,
            modifiedFiles: prFiles.filter(f => f.status === 'edit').length,
            deletedFiles: prFiles.filter(f => f.status === 'delete').length,
            renamedFiles: prFiles.filter(f => f.status === 'rename').length,
            totalAdditions: prFiles.reduce((sum, f) => sum + f.additions, 0),
            totalDeletions: prFiles.reduce((sum, f) => sum + f.deletions, 0)
        };
        
        // Attach symbol-to-dependents mapping for detailed output
        filteredGraph.symbolToDependentsMap = symbolToDependentsMap;

        return filteredGraph;
    }

    /**
     * Get or build full workspace graph
     */
    async ensureFullGraph() {
        if (this.fullGraph) {
            console.log('✅ Using cached full graph');
            return;
        }

        // Try load from cache
        if (fs.existsSync(this.cacheFilePath)) {
            try {
                const cacheData = JSON.parse(fs.readFileSync(this.cacheFilePath, 'utf8'));
                if (cacheData.version === CACHE_VERSION && cacheData.graph) {
                    this.fullGraph = cacheData.graph;
                    console.log(`✅ Loaded graph from cache: ${this.fullGraph.nodes.length} nodes, ${this.fullGraph.edges.length} edges`);
                    return;
                }
            } catch (error) {
                console.log(`⚠️ Cache read error: ${error.message}`);
            }
        }

        // Build new graph
        console.log('🔨 Building new dependency graph...');
        this.fullGraph = await this.buildFullGraph();

        // Save cache
        try {
            const cacheDir = path.dirname(this.cacheFilePath);
            if (!fs.existsSync(cacheDir)) {
                fs.mkdirSync(cacheDir, { recursive: true });
            }

            fs.writeFileSync(this.cacheFilePath, JSON.stringify({
                version: CACHE_VERSION,
                timestamp: Date.now(),
                graph: this.fullGraph
            }, null, 2));

            console.log(`✅ Saved graph cache: ${this.fullGraph.nodes.length} nodes`);
        } catch (error) {
            console.log(`⚠️ Cache write error: ${error.message}`);
        }
    }

    /**
     * Build full workspace dependency graph
     */
    async buildFullGraph() {
        console.log('📊 Analyzing workspace dependencies...');
        
        try {
            const graph = await this.vscodeAnalyzer.analyzeWorkspace(this.workspaceRoot);
            console.log(`✅ Built graph: ${graph.nodes.length} nodes, ${graph.edges.length} edges`);
            return graph;
        } catch (error) {
            console.error('❌ Error building graph:', error);
            throw error;
        }
    }

    /**
     * Find nodes matching PR files
     */
    findPRNodes(prFiles) {
        const nodes = [];

        for (const prFile of prFiles) {
            // Normalize path (handle both / and \ separators)
            const normalizedPath = prFile.path.replace(/\\/g, '/');
            const fileName = path.basename(normalizedPath);

            // Find in full graph by relativePath or fileName
            const node = this.fullGraph.nodes.find(n => {
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
                
                console.log(`✅ Matched PR file: ${prFile.path} → ${node.relativePath} (${prFile.status})`);
            } else if (prFile.status !== 'delete') {
                // Handle new files not in cache (skip deleted files)
                const newNode = this.createNodeForNewFile(prFile);
                nodes.push(newNode);
                console.log(`➕ Created node for new file: ${prFile.path}`);
            } else {
                console.log(`⚠️ Deleted file not in graph: ${prFile.path}`);
            }
        }

        return nodes;
    }

    /**
     * Create node for newly added file in PR
     */
    createNodeForNewFile(prFile) {
        const filePath = prFile.path.replace(/\\/g, '/');
        const fileName = path.basename(filePath);
        const ext = path.extname(fileName);

        // Determine category based on extension
        let category = 'file';
        if (['.ts', '.js', '.tsx', '.jsx'].includes(ext)) {
            category = 'typescript';
        } else if (['.html', '.css', '.scss'].includes(ext)) {
            category = 'style';
        } else if (['.json', '.xml', '.yaml', '.yml'].includes(ext)) {
            category = 'config';
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
     * Get dependencies of a node (files that this node imports)
     */
    getDependencies(nodeId) {
        const edges = this.fullGraph.edges.filter(e => e.source === nodeId);
        return edges.map(e => e.target);
    }

    /**
     * Get dependents of a node (files that import this node)
     */
    getDependents(nodeId) {
        const edges = this.fullGraph.edges.filter(e => e.target === nodeId);
        return edges.map(e => e.source);
    }

    /**
     * Build filtered graph with only relevant nodes
     */
    buildFilteredGraph(relevantNodeIds, prNodes, nodeChangedSymbols = new Map()) {
        // Get all relevant nodes from full graph
        const nodes = this.fullGraph.nodes
            .filter(n => relevantNodeIds.has(n.id))
            .map(node => {
                // Check if this is a PR node
                const prNode = prNodes.find(pn => pn.id === node.id);
                if (prNode) {
                    // Merge PR metadata and add changedSymbols if available
                    const merged = { ...node, ...prNode };
                    
                    // Add changedSymbols from Map (for Deep Impact reuse)
                    if (nodeChangedSymbols.has(node.id)) {
                        merged.changedSymbols = nodeChangedSymbols.get(node.id);
                    }
                    
                    return merged;
                }
                return { ...node };
            });

        // Get all edges between relevant nodes
        const edges = this.fullGraph.edges.filter(e =>
            relevantNodeIds.has(e.source) && relevantNodeIds.has(e.target)
        );

        // Classify nodes for better visualization
        nodes.forEach(node => {
            if (!node.isPRFile) {
                // Determine if this is a dependency or dependent
                const isDependency = edges.some(e => 
                    prNodes.some(pn => pn.id === e.source) && e.target === node.id
                );
                const isDependent = edges.some(e => 
                    prNodes.some(pn => pn.id === e.target) && e.source === node.id
                );

                if (isDependency && isDependent) {
                    node.nodeType = 'both';
                } else if (isDependency) {
                    node.nodeType = 'dependency';
                } else if (isDependent) {
                    node.nodeType = 'dependent';
                } else {
                    node.nodeType = 'indirect';
                }
            } else {
                node.nodeType = 'pr-file';
            }
        });

        return { nodes, edges };
    }

    /**
     * Get impact analysis for PR files
     */
    getImpactAnalysis(graph) {
        const prNodes = graph.nodes.filter(n => n.isPRFile);
        const dependencies = graph.nodes.filter(n => n.nodeType === 'dependency');
        const dependents = graph.nodes.filter(n => n.nodeType === 'dependent');

        return {
            prFiles: prNodes.map(n => ({
                path: n.relativePath,
                status: n.prStatus,
                changes: n.prChanges
            })),
            affectedFiles: {
                dependencies: dependencies.map(n => n.relativePath),
                dependents: dependents.map(n => n.relativePath),
                total: dependencies.length + dependents.length
            },
            riskLevel: this.calculateRiskLevel(graph),
            recommendations: this.generateRecommendations(graph)
        };
    }

    /**
     * Calculate risk level based on graph metrics
     */
    calculateRiskLevel(graph) {
        const prNodes = graph.nodes.filter(n => n.isPRFile);
        const dependents = graph.nodes.filter(n => n.nodeType === 'dependent');
        
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
    generateRecommendations(graph) {
        const recommendations = [];
        const dependents = graph.nodes.filter(n => n.nodeType === 'dependent');
        const prNodes = graph.nodes.filter(n => n.isPRFile);

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

        const coreFiles = prNodes.filter(n => 
            n.relativePath.includes('core') || 
            n.relativePath.includes('shared') ||
            n.relativePath.includes('common')
        );
        
        if (coreFiles.length > 0) {
            recommendations.push('Core module changes detected - Extra scrutiny recommended');
        }

        return recommendations;
    }

    /**
     * Extract changed symbols from diff patch with line numbers and positions
     * Returns detailed symbol objects for VS Code Reference Provider
     */
    extractChangedSymbols(patch, prFilePath) {
        if (!patch) {
            console.log(`   ⚠️ No patch data`);
            return [];
        }

        console.log(`   📄 Extracting from patch (${patch.length} chars)...`);
        
        const allSymbols = [];
        const lines = patch.split('\n');
        const contextStack = []; // Track nested object context
        let currentLineNumber = 0;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Parse hunk header to get line numbers: @@ -10,5 +12,8 @@
            if (line.startsWith('@@')) {
                const match = line.match(/@@ -\d+,?\d* \+(\d+),?\d* @@/);
                if (match) {
                    currentLineNumber = parseInt(match[1]) - 1; // 0-indexed
                }
                continue;
            }
            
            // Only process added or modified lines
            if (line.startsWith('+') && !line.startsWith('+++')) {
                const codeLine = line.substring(1);
                const trimmed = codeLine.trim();
                
                // Detect object start: objectName: {
                const objectStartMatch = trimmed.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:\s*\{/);
                if (objectStartMatch) {
                    const objectName = objectStartMatch[1];
                    const column = codeLine.indexOf(objectName);
                    contextStack.push(objectName);
                    allSymbols.push({ 
                        name: objectName, 
                        fullName: objectName,
                        type: 'object',
                        lineNumber: currentLineNumber,
                        column: column,
                        filePath: prFilePath
                    });
                    currentLineNumber++;
                    continue;
                }
                
                // Detect object end: },
                if (trimmed === '},' || trimmed === '}') {
                    if (contextStack.length > 0) {
                        contextStack.pop();
                    }
                    currentLineNumber++;
                    continue;
                }
                
                // Extract symbols with context and position
                const extracted = this.extractSymbolsFromLine(codeLine, contextStack, currentLineNumber, prFilePath);
                allSymbols.push(...extracted);
                currentLineNumber++;
            } else if (line.startsWith('-') && !line.startsWith('---')) {
                // Don't increment line number for removed lines
                continue;
            } else if (!line.startsWith('\\')) {
                // Context line - increment counter
                currentLineNumber++;
            }
        }
        
        // Deduplicate by fullName + lineNumber
        const unique = [];
        const seen = new Set();
        for (const sym of allSymbols) {
            const key = `${sym.fullName}:${sym.lineNumber}`;
            if (!seen.has(key)) {
                seen.add(key);
                unique.push(sym);
            }
        }
        
        console.log(`   ✅ Found ${unique.length} symbols: ${unique.map(s => s.fullName).join(', ')}`);
        return unique;
    }

    /**
     * Extract symbols from a single line of code with positions
     * @param {string} line - The code line to extract from
     * @param {string[]} contextStack - Current nested object context
     * @param {number} lineNumber - Line number in file (0-indexed)
     * @param {string} filePath - File path
     */
    extractSymbolsFromLine(line, contextStack = [], lineNumber = 0, filePath = '') {
        const symbols = [];
        const trimmedLine = line.trim();
        
        if (!trimmedLine || trimmedLine.length === 0) return symbols;
        
        // Property within object: propertyName: value
        const propertyMatch = trimmedLine.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:\s*/);
        if (propertyMatch) {
            const propertyName = propertyMatch[1];
            const column = line.indexOf(propertyName);
            
            if (contextStack.length > 0) {
                // Nested property: parentObject.propertyName
                const nestedPath = [...contextStack, propertyName].join('.');
                symbols.push({ 
                    name: propertyName,
                    fullName: nestedPath,
                    type: 'property',
                    parentName: contextStack[contextStack.length - 1],
                    lineNumber: lineNumber,
                    column: column,
                    filePath: filePath
                });
            } else {
                // Top-level property
                symbols.push({ 
                    name: propertyName,
                    fullName: propertyName,
                    type: 'property',
                    lineNumber: lineNumber,
                    column: column,
                    filePath: filePath
                });
            }
        }
        
        // Function declarations: function name() {}
        const functionMatch = trimmedLine.match(/function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/);
        if (functionMatch) {
            const funcName = functionMatch[1];
            const column = line.indexOf(funcName);
            symbols.push({ 
                name: funcName,
                fullName: funcName,
                type: 'function',
                lineNumber: lineNumber,
                column: column,
                filePath: filePath
            });
        }
        
        // Const declarations: const NAME = ...
        const constMatch = trimmedLine.match(/const\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=/);
        if (constMatch) {
            const constName = constMatch[1];
            const column = line.indexOf(constName);
            symbols.push({ 
                name: constName,
                fullName: constName,
                type: 'const',
                lineNumber: lineNumber,
                column: column,
                filePath: filePath
            });
        }
        
        // Class declarations: class ClassName {}
        const classMatch = trimmedLine.match(/class\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/);
        if (classMatch) {
            const className = classMatch[1];
            const column = line.indexOf(className);
            symbols.push({ 
                name: className,
                fullName: className,
                type: 'class',
                lineNumber: lineNumber,
                column: column,
                filePath: filePath
            });
        }
        
        // Interface declarations: interface InterfaceName {}
        const interfaceMatch = trimmedLine.match(/interface\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/);
        if (interfaceMatch) {
            const interfaceName = interfaceMatch[1];
            const column = line.indexOf(interfaceName);
            symbols.push({ 
                name: interfaceName,
                fullName: interfaceName,
                type: 'interface',
                lineNumber: lineNumber,
                column: column,
                filePath: filePath
            });
        }
        
        return symbols;
    }

    /**
     * Extract line numbers that were changed in patch
     */
    extractChangedLineNumbers(patch) {
        const changedLines = [];
        const lines = patch.split('\n');
        let currentLineNumber = 0;
        
        for (const line of lines) {
            // Parse @@ -a,b +c,d @@ headers
            const hunkHeader = line.match(/^@@ -\d+,?\d* \+(\d+),?\d* @@/);
            if (hunkHeader) {
                currentLineNumber = parseInt(hunkHeader[1], 10);
                continue;
            }
            
            // Track added/modified lines
            if (line.startsWith('+') && !line.startsWith('+++')) {
                changedLines.push(currentLineNumber);
                currentLineNumber++;
            } else if (!line.startsWith('-')) {
                currentLineNumber++;
            }
        }
        
        return changedLines;
    }

    /**
     * Get which specific changed symbols a dependent file uses (VS Code Reference Provider with barrel resolution)
     * @param {string} dependentPath - Path to the dependent file
     * @param {string} prFilePath - Path to the PR file  
     * @param {Array} changedSymbols - List of changed symbol objects with positions
     * @returns {Promise<string[]>} - Array of symbol names that are actually used
     */
    async getUsedSymbols(dependentPath, prFilePath, changedSymbols) {
        const usedSymbols = [];
        
        if (!changedSymbols || changedSymbols.length === 0) {
            return usedSymbols;
        }

        try {
            console.log(`      🔍 Checking dependent: ${dependentPath}`);
            console.log(`         Symbols to check: [${changedSymbols.slice(0, 3).map(s => s.fullName).join(', ')}${changedSymbols.length > 3 ? '...' : ''}]`);
            
            const fullDependentPath = path.join(this.workspaceRoot, dependentPath);
            const fullPRFilePath = path.join(this.workspaceRoot, prFilePath);
            
            if (!fs.existsSync(fullDependentPath)) {
                console.log(`         ❌ File not found: ${fullDependentPath}`);
                return usedSymbols;
            }

            // Check each symbol using VS Code Reference Provider with barrel resolution
            for (const symbol of changedSymbols) {
                const symbolFileUri = vscode.Uri.file(fullPRFilePath);
                const symbolPosition = new vscode.Position(symbol.lineNumber, symbol.column);
                
                try {
                    // ✨ Find all references through barrels recursively
                    const result = await this.resolveBarrelReferences(
                        symbolFileUri,
                        symbolPosition,
                        symbol.fullName,
                        new Set(), // Visited barrels tracker
                        0 // Start at level 0
                    );
                    
                    const allReferences = result.references;
                    const barrelChain = result.barrelChain;
                    
                    if (allReferences.length === 0) {
                        console.log(`         ⏭️ No references found for: ${symbol.fullName}`);
                        continue;
                    }
                    
                    if (barrelChain.length > 0) {
                        console.log(`         📍 Found ${allReferences.length} total references through ${barrelChain.length} barrel(s)`);
                    } else {
                        console.log(`         📍 Found ${allReferences.length} direct references`);
                    }
                    
                    // Filter references to find ones in the dependent file
                    const referencesInDependent = allReferences.filter(ref => {
                        const refPath = ref.uri.fsPath;
                        const isSameFile = path.normalize(refPath) === path.normalize(fullDependentPath);
                        const isNotDefinition = ref.range.start.line !== symbol.lineNumber;
                        return isSameFile && isNotDefinition;
                    });
                    
                    if (referencesInDependent.length > 0) {
                        // Filter out barrel exports (though should be minimal after resolution)
                        const realRefs = [];
                        for (const ref of referencesInDependent) {
                            const isBarrel = await this.isBarrelExport(ref);
                            if (!isBarrel) {
                                realRefs.push(ref);
                            }
                        }
                        
                        if (realRefs.length > 0) {
                            usedSymbols.push(symbol.fullName);
                            console.log(`         ✅ Found ${realRefs.length} real references: ${symbol.fullName}`);
                        }
                    }
                    
                } catch (error) {
                    console.error(`         ❌ Reference provider error for ${symbol.fullName}:`, error.message);
                }
            }
            
            if (usedSymbols.length === 0) {
                console.log(`         ℹ️ No symbols from PR file used`);
            } else {
                console.log(`         ✅ Total confirmed: ${usedSymbols.length} symbols`);
            }

            return usedSymbols;
        } catch (error) {
            console.error(`      ❌ Reference analysis failed for ${dependentPath}:`, error.message);
            return [];
        }
    }

    /**
     * 🔥 IMPROVED: Recursively resolve references through barrel exports with better error handling
     */
    async resolveBarrelReferences(symbolUri, symbolPosition, symbolName, visitedBarrels, currentLevel = 0) {
        const allReferences = [];
        const barrelChain = [];
        
        // Protection against infinite loops
        if (currentLevel > 10) {
            console.warn('⚠️ Barrel chain depth exceeded 10 levels, stopping recursion');
            return { references: allReferences, barrelChain };
        }
        
        try {
            // Check cache first with version key
            const cacheKey = `${symbolUri.fsPath}:${symbolPosition.line}:${symbolPosition.character}:v2`;
            let directReferences = this.referenceCache.get(cacheKey);
            
            if (!directReferences) {
                // 🔥 IMPROVED: Add timeout to prevent hanging
                const timeout = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Reference provider timeout')), 5000)
                );
                
                const refPromise = vscode.commands.executeCommand(
                    'vscode.executeReferenceProvider',
                    symbolUri,
                    symbolPosition
                );
                
                try {
                    directReferences = await Promise.race([refPromise, timeout]);
                } catch (timeoutError) {
                    console.warn(`         ⚠️ Timeout finding references for ${symbolName}`);
                    return { references: allReferences, barrelChain };
                }
                
                // Cache the result
                if (directReferences && directReferences.length > 0) {
                    this.referenceCache.set(cacheKey, directReferences);
                }
            }
            
            if (!directReferences || directReferences.length === 0) {
                return { references: allReferences, barrelChain };
            }
            
            // 🔥 IMPROVED: Separate barrels and real usages first
            const barrels = [];
            const realUsages = [];
            
            for (const ref of directReferences) {
                const isBarrel = await this.isBarrelExport(ref);
                if (isBarrel) {
                    barrels.push(ref);
                } else {
                    // Skip definition itself
                    if (ref.uri.fsPath !== symbolUri.fsPath || 
                        ref.range.start.line !== symbolPosition.line) {
                        realUsages.push(ref);
                    }
                }
            }
            
            // Add real usages immediately
            allReferences.push(...realUsages);
            
            const indent = '  '.repeat(currentLevel);
            console.log(`         ${indent}📍 Level ${currentLevel}: ${barrels.length} barrels, ${realUsages.length} real usages`);
            
            // Process barrels
            for (const barrelRef of barrels) {
                const refPath = barrelRef.uri.fsPath;
                const refKey = `${refPath}:${barrelRef.range.start.line}:${barrelRef.range.start.character}`;
                
                console.log(`         ${indent}🔄 Barrel: ${path.basename(refPath)}:${barrelRef.range.start.line}`);
                
                // Avoid infinite loops
                if (visitedBarrels.has(refKey)) {
                    console.log(`         ${indent}⏭️ Already visited, skipping`);
                    continue;
                }
                
                visitedBarrels.add(refKey);
                
                // 🔥 IMPROVED: Get barrel export info with fallback
                const barrelSymbolInfo = await this.getBarrelExportSymbolImproved(barrelRef, symbolName);
                
                if (!barrelSymbolInfo) {
                    console.log(`         ${indent}⚠️ Could not parse barrel export`);
                    continue;
                }
                
                // Add to barrel chain
                barrelChain.push({
                    file: refPath,
                    exportedAs: barrelSymbolInfo.name,
                    level: currentLevel,
                    isWildcard: barrelSymbolInfo.isWildcard
                });
                
                // Handle wildcard exports
                if (barrelSymbolInfo.isWildcard) {
                    console.log(`         ${indent}⭐ Wildcard: finding imports of barrel...`);
                    const wildcardRefs = await this.findImportsOfBarrelFileImproved(
                        barrelRef.uri, 
                        symbolName,
                        currentLevel
                    );
                    console.log(`         ${indent}✅ Found ${wildcardRefs.length} usages through wildcard`);
                    allReferences.push(...wildcardRefs);
                } else {
                    // Recursively resolve named exports
                    console.log(`         ${indent}🔍 Following named export: ${barrelSymbolInfo.name}`);
                    const result = await this.resolveBarrelReferences(
                        barrelRef.uri,
                        barrelSymbolInfo.position,
                        barrelSymbolInfo.name,
                        visitedBarrels,
                        currentLevel + 1
                    );
                    
                    console.log(`         ${indent}✅ Found ${result.references.length} refs through chain`);
                    allReferences.push(...result.references);
                    barrelChain.push(...result.barrelChain);
                }
            }
            
            return { references: allReferences, barrelChain };
            
        } catch (error) {
            console.error(`         ❌ Barrel resolution error at level ${currentLevel}:`, error.message);
            // 🔥 IMPROVED: Clear cache on error
            const cacheKey = `${symbolUri.fsPath}:${symbolPosition.line}:${symbolPosition.character}:v2`;
            this.referenceCache.delete(cacheKey);
            return { references: allReferences, barrelChain };
        }
    }

    /**
     * Get the exported symbol name and position from a barrel export line
     * @param {vscode.Location} barrelLocation - Location of barrel export
     * @returns {Promise<{name: string, position: vscode.Position, isWildcard: boolean}|null>}
     */
    async getBarrelExportSymbol(barrelLocation) {
        // Delegate to improved version
        return await this.getBarrelExportSymbolImproved(barrelLocation, null);
    }

    /**
     * 🔥 NEW: Improved barrel export symbol parsing with better multi-export handling
     */
    async getBarrelExportSymbolImproved(barrelLocation, originalSymbolName) {
        try {
            const document = await vscode.workspace.openTextDocument(barrelLocation.uri);
            const line = document.lineAt(barrelLocation.range.start.line);
            const text = line.text.trim();
            const refColumn = barrelLocation.range.start.character;
            
            // Pattern 1: export * from './somewhere'
            if (/^export\s+\*\s+from/.test(text)) {
                return {
                    name: originalSymbolName || '*', // Use original name for wildcard
                    position: barrelLocation.range.start,
                    isWildcard: true
                };
            }
            
            // Pattern 2: export { Name } from './somewhere'
            const simpleMatch = text.match(/export\s+\{\s*(\w+)\s*\}\s+from/);
            if (simpleMatch) {
                const symbolName = simpleMatch[1];
                const symbolIndex = text.indexOf(symbolName, text.indexOf('{'));
                
                return {
                    name: symbolName,
                    position: new vscode.Position(
                        barrelLocation.range.start.line, 
                        symbolIndex >= 0 ? symbolIndex : refColumn
                    ),
                    isWildcard: false
                };
            }
            
            // Pattern 3: export { Name as Alias } from './somewhere'
            const aliasMatch = text.match(/export\s+\{\s*(\w+)\s+as\s+(\w+)\s*\}\s+from/);
            if (aliasMatch) {
                const originalName = aliasMatch[1];
                const aliasName = aliasMatch[2];
                const symbolIndex = text.indexOf(aliasName, text.indexOf('as'));
                
                return {
                    name: aliasName, // Use alias for next lookup
                    position: new vscode.Position(
                        barrelLocation.range.start.line,
                        symbolIndex >= 0 ? symbolIndex : refColumn
                    ),
                    isWildcard: false
                };
            }
            
            // Pattern 4: export { Name1, Name2, ... } from './somewhere'
            const multiMatch = text.match(/export\s+\{([^}]+)\}\s+from/);
            if (multiMatch) {
                const exportList = multiMatch[1];
                const specs = exportList.split(',').map(s => s.trim());
                
                // 🔥 IMPROVED: Find the export spec closest to reference position
                let bestMatch = null;
                let minDistance = Infinity;
                
                for (const spec of specs) {
                    // Parse 'Name' or 'Name as Alias'
                    const parts = spec.split(/\s+as\s+/);
                    const originalName = parts[0].trim();
                    const exportedName = parts.length === 2 ? parts[1].trim() : originalName;
                    
                    // Find position of this export in the line
                    const nameIndex = text.indexOf(exportedName, text.indexOf('{'));
                    if (nameIndex >= 0) {
                        const distance = Math.abs(nameIndex - refColumn);
                        if (distance < minDistance) {
                            minDistance = distance;
                            bestMatch = {
                                name: exportedName,
                                position: new vscode.Position(barrelLocation.range.start.line, nameIndex),
                                isWildcard: false
                            };
                        }
                    }
                }
                
                if (bestMatch) {
                    return bestMatch;
                }
                
                // Fallback: use original symbol name if present
                if (originalSymbolName) {
                    for (const spec of specs) {
                        if (spec.includes(originalSymbolName)) {
                            const parts = spec.split(/\s+as\s+/);
                            const exportedName = parts.length === 2 ? parts[1].trim() : parts[0].trim();
                            const nameIndex = text.indexOf(exportedName, text.indexOf('{'));
                            
                            return {
                                name: exportedName,
                                position: new vscode.Position(
                                    barrelLocation.range.start.line,
                                    nameIndex >= 0 ? nameIndex : refColumn
                                ),
                                isWildcard: false
                            };
                        }
                    }
                }
            }
            
            return null;
        } catch (error) {
            console.error(`Error parsing barrel export:`, error.message);
            return null;
        }
    }

    /**
     * Find all files that import from a barrel file (for wildcard exports)
     * @param {vscode.Uri} barrelUri - URI of the barrel file
     * @param {string} symbolName - Original symbol name to look for
     * @returns {Promise<vscode.Location[]>}
     */
    async findImportsOfBarrelFile(barrelUri, symbolName) {
        const imports = [];
        
        try {
            const barrelPath = barrelUri.fsPath;
            const barrelDir = path.dirname(barrelPath);
            
            // Get all TypeScript/JavaScript files in workspace
            const workspaceFolder = vscode.workspace.getWorkspaceFolder(barrelUri);
            if (!workspaceFolder) return imports;
            
            // Get barrel path relative to workspace (for alias matching)
            const workspacePath = workspaceFolder.uri.fsPath;
            const barrelRelativeToWorkspace = path.relative(workspacePath, barrelDir).replace(/\\/g, '/');
            
            console.log(`         🔍 Looking for imports of barrel: ${barrelRelativeToWorkspace}`);
            
            const files = await vscode.workspace.findFiles(
                new vscode.RelativePattern(workspaceFolder, '**/*.{ts,tsx,js,jsx}'),
                '**/node_modules/**',
                1000 // Increase limit
            );
            
            // Search for files that import from this barrel and use the symbol
            for (const fileUri of files) {
                if (fileUri.fsPath === barrelPath) continue;
                
                try {
                    const document = await vscode.workspace.openTextDocument(fileUri);
                    const text = document.getText();
                    
                    // Calculate relative path from file to barrel
                    const fileDir = path.dirname(fileUri.fsPath);
                    let relativePath = path.relative(fileDir, barrelDir);
                    
                    // Normalize path for import statements
                    if (!relativePath.startsWith('.')) {
                        relativePath = './' + relativePath;
                    }
                    relativePath = relativePath.replace(/\\/g, '/');
                    
                    // Build comprehensive import patterns
                    const importPatterns = [
                        // Relative imports: from './shared/utilities' or '../shared/utilities'
                        new RegExp(`from\\s+['"]${relativePath.replace(/\./g, '\\.')}['"]`, 'i'),
                        new RegExp(`from\\s+['"]${relativePath.replace(/\./g, '\\.')}/index['"]`, 'i'),
                        // Absolute from workspace root
                        new RegExp(`from\\s+['"]${barrelRelativeToWorkspace}['"]`, 'i'),
                        // Path aliases - generic pattern matching the barrel directory structure
                        // Examples: @shared/utilities, @app/shared/utilities
                        new RegExp(`from\\s+['"]([@\\w]+)/utilities['"]`, 'i'),
                        new RegExp(`from\\s+['"]([@\\w]+)/shared/utilities['"]`, 'i')
                    ];
                    
                    let hasImport = false;
                    for (const pattern of importPatterns) {
                        if (pattern.test(text)) {
                            hasImport = true;
                            break;
                        }
                    }
                    
                    if (!hasImport) continue;
                    
                    // File imports from this barrel - now check if it uses the symbol
                    // For nested properties like 'limitedEquipment.header', search for the root object 'limitedEquipment'
                    const searchTerm = symbolName.includes('.') ? symbolName.split('.')[0] : symbolName;
                    const symbolPattern = new RegExp(`\\b${searchTerm.replace(/\./g, '\\.')}\\b`, 'g');
                    let match;
                    
                    while ((match = symbolPattern.exec(text)) !== null) {
                        const position = document.positionAt(match.index);
                        const line = document.lineAt(position.line);
                        
                        // Skip import lines
                        if (!line.text.trim().startsWith('import')) {
                            imports.push(new vscode.Location(fileUri, position));
                        }
                    }
                } catch (error) {
                    // Skip files that can't be read
                    continue;
                }
            }
            
            console.log(`         ✅ Found ${imports.length} usages of ${symbolName} through barrel`);
            return imports;
            
        } catch (error) {
            console.error(`Error finding imports of barrel:`, error.message);
            return imports;
        }
    }

    /**
     * 🔥 NEW: Load TypeScript path aliases from tsconfig.json
     */
    async loadTSConfigAliases(workspacePath) {
        const aliases = new Map();
        
        try {
            const tsconfigPath = path.join(workspacePath, 'tsconfig.json');
            if (!fs.existsSync(tsconfigPath)) {
                return aliases;
            }
            
            const tsconfigContent = fs.readFileSync(tsconfigPath, 'utf8');
            // Remove comments (simple approach)
            const jsonContent = tsconfigContent.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
            const tsconfig = JSON.parse(jsonContent);
            
            const paths = tsconfig.compilerOptions?.paths;
            if (paths) {
                for (const [alias, targets] of Object.entries(paths)) {
                    // Remove /* from alias and target
                    const cleanAlias = alias.replace(/\/\*$/, '');
                    const cleanTarget = targets[0].replace(/\/\*$/, '');
                    aliases.set(cleanAlias, cleanTarget);
                }
                
                console.log(`✅ Loaded ${aliases.size} path aliases from tsconfig.json`);
            }
            
        } catch (error) {
            console.log(`⚠️ Could not load tsconfig.json:`, error.message);
        }
        
        return aliases;
    }

    /**
     * 🔥 NEW: Build comprehensive import patterns including path aliases
     */
    buildImportPatterns(importerPath, barrelDir, barrelRelativeToWorkspace, pathAliases) {
        const patterns = [];
        const fileDir = path.dirname(importerPath);
        
        // 1. Relative path import
        let relativePath = path.relative(fileDir, barrelDir);
        if (!relativePath.startsWith('.')) {
            relativePath = './' + relativePath;
        }
        relativePath = relativePath.replace(/\\/g, '/');
        
        patterns.push(
            new RegExp(`from\\s+['"]${relativePath.replace(/\./g, '\\.')}['"]`, 'i'),
            new RegExp(`from\\s+['"]${relativePath.replace(/\./g, '\\.')}/index['"]`, 'i')
        );
        
        // 2. Absolute from workspace root
        patterns.push(
            new RegExp(`from\\s+['"]${barrelRelativeToWorkspace}['"]`, 'i'),
            new RegExp(`from\\s+['"]${barrelRelativeToWorkspace}/index['"]`, 'i')
        );
        
        // 3. Path aliases from tsconfig.json
        for (const [alias, target] of pathAliases.entries()) {
            if (barrelRelativeToWorkspace.startsWith(target)) {
                const aliasedPath = barrelRelativeToWorkspace.replace(target, alias);
                patterns.push(
                    new RegExp(`from\\s+['"]${aliasedPath}['"]`, 'i'),
                    new RegExp(`from\\s+['"]${aliasedPath}/index['"]`, 'i')
                );
            }
        }
        
        // 4. Common alias patterns (fallback)
        const barrelParts = barrelRelativeToWorkspace.split('/');
        if (barrelParts.length >= 2) {
            const commonAliases = ['@app', '@shared', '@core', '@modules'];
            for (const aliasPrefix of commonAliases) {
                const aliasedPath = `${aliasPrefix}/${barrelParts.slice(1).join('/')}`;
                patterns.push(
                    new RegExp(`from\\s+['"]${aliasedPath}['"]`, 'i')
                );
            }
        }
        
        return patterns;
    }

    /**
     * Check if a reference location is a barrel export (re-export)
     * @param {vscode.Location} location - Reference location
     * @returns {Promise<boolean>}
     */
    async isBarrelExport(location) {
        try {
            const document = await vscode.workspace.openTextDocument(location.uri);
            const line = document.lineAt(location.range.start.line);
            const text = line.text.trim();
            
            // Pattern 1: export { Something } from './somewhere'
            const isReExport = /^export\s+(?:\{[^}]+\}|\*)\s+from/.test(text);
            
            // Pattern 2: File is named index.ts/tsx
            const fileName = path.basename(location.uri.fsPath);
            const isIndexFile = /^index\.(ts|tsx|js|jsx)$/.test(fileName);
            
            if (isReExport) {
                return true;
            }
            
            // If index file, check if it's mostly exports
            if (isIndexFile) {
                const fullText = document.getText();
                const lines = fullText.split('\n').filter(l => l.trim());
                const exportLines = lines.filter(l => 
                    l.trim().startsWith('export') || l.trim().startsWith('//')
                );
                
                // If >80% of lines are exports, likely a barrel
                if (lines.length > 0 && exportLines.length / lines.length > 0.8) {
                    return true;
                }
            }
            
            return false;
        } catch (error) {
            return false;
        }
    }

    /**
     * Fallback: Simple string matching (when AST fails)
     */
    async getUsedSymbolsFallback(dependentPath, changedSymbols) {
        const usedSymbols = [];
        
        try {
            const fullDependentPath = path.join(this.workspaceRoot, dependentPath);
            if (!fs.existsSync(fullDependentPath)) return usedSymbols;

            const content = fs.readFileSync(fullDependentPath, 'utf8');
            
            for (const symbol of changedSymbols) {
                // Escape dots in symbol path for regex
                const escapedSymbol = symbol.replace(/\\./g, '\\\\.');
                const symbolPattern = new RegExp(`\\\\b${escapedSymbol}\\\\b`);
                if (symbolPattern.test(content)) {
                    usedSymbols.push(symbol);
                }
            }
            
            console.log(`      ⚠️ Fallback found ${usedSymbols.length} symbols (may have false positives)`);
            return usedSymbols;
        } catch (error) {
            console.error(`Error in fallback symbol check:`, error.message);
            return usedSymbols;
        }
    }

    /**     * Check if a dependent file uses any of the changed symbols from a PR file
     * @param {string} dependentPath - Path to the dependent file
     * @param {string} prFilePath - Path to the PR file
     * @param {string[]} changedSymbols - List of changed symbols to check
     * @returns {Promise<boolean>} - True if the file uses any changed symbol
     */
    async fileUsesChangedSymbols(dependentPath, prFilePath, changedSymbols) {
        if (!changedSymbols || changedSymbols.length === 0) {
            return false;
        }

        try {
            // First check: Does dependent import from PR file?
            const importsFile = await this.fileImportsFile(dependentPath, prFilePath);
            if (!importsFile) {
                // No import relationship, so can't use changed symbols
                return false;
            }

            // Second check: Read dependent file and check if it uses any changed symbols
            const fullDependentPath = path.join(this.workspaceRoot, dependentPath);
            
            if (!fs.existsSync(fullDependentPath)) {
                return false;
            }

            const content = fs.readFileSync(fullDependentPath, 'utf8');
            
            // Check if any changed symbol appears in the file
            // Use word boundaries to avoid partial matches
            for (const symbol of changedSymbols) {
                const symbolPattern = new RegExp(`\\b${symbol}\\b`);
                if (symbolPattern.test(content)) {
                    return true;
                }
            }

            return false;
        } catch (error) {
            console.error(`Error checking symbol usage in ${dependentPath}:`, error.message);
            return false;
        }
    }

    /**
     * Check if a file imports from another file
     * @param {string} importerPath - Path to the file doing the importing
     * @param {string} importedPath - Path to the file being imported
     * @returns {Promise<boolean>} - True if there's an import relationship
     */
    async fileImportsFile(importerPath, importedPath) {
        try {
            const fullImporterPath = path.join(this.workspaceRoot, importerPath);
            
            if (!fs.existsSync(fullImporterPath)) {
                return false;
            }

            const content = fs.readFileSync(fullImporterPath, 'utf8');
            
            // Normalize paths for comparison (handle both / and \)
            const normalizedImported = importedPath.replace(/\\/g, '/').replace(/\.[^.]+$/, ''); // Remove extension
            
            // Check for import statements
            // Match: import ... from '...'  or  require('...')
            const importPattern = /(?:import\s+.*?\s+from\s+['"]([^'"]+)['"]|require\s*\(\s*['"]([^'"]+)['"]\s*\))/g;
            let match;
            
            while ((match = importPattern.exec(content)) !== null) {
                const importPath = (match[1] || match[2]).replace(/\\/g, '/');
                
                // Check if the import path matches the imported file
                if (importPath.includes(normalizedImported) || normalizedImported.includes(importPath)) {
                    return true;
                }
                
                // Also check filename match
                const importFileName = path.basename(importPath, path.extname(importPath));
                const importedFileName = path.basename(normalizedImported, path.extname(normalizedImported));
                
                if (importFileName === importedFileName) {
                    return true;
                }
            }

            return false;
        } catch (error) {
            console.error(`Error checking import relationship ${importerPath} → ${importedPath}:`, error.message);
            return false;
        }
    }
}

module.exports = { PRDependencyAnalyzer };
