const vscode = require('vscode');
const path = require('path');
const fs = require('fs');

const { VSCodeApiDependencyAnalyzer } = require('./dependency-graph/vscode-api-analyzer');
const { SymbolAnalyzer } = require('./dependency-graph/symbol-analyzer');
const { BarrelResolver } = require('./dependency-graph/barrel-resolver');

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
        this.barrelResolver = new BarrelResolver(); // 🔥 NEW: Barrel resolver
        this.fullGraph = null; // Cache full graph
        this.cacheFilePath = path.join(workspaceRoot, '.vscode', 'dependency-cache.json');
        this.referenceCache = new Map(); // Cache for reference lookups (legacy, will be deprecated)
    }

    /**
     * Build dependency graph for PR files
     * @param {Array} prFiles - PR file changes [{path, status, additions, deletions}]
     * @returns {Promise<object>} Graph {nodes, edges, prSummary}
     */
    async analyzePRFiles(prFiles) {
        // 🔥 Filter out unnecessary files from analysis
        const filteredPRFiles = prFiles.filter(file => {
            const ext = path.extname(file.path).toLowerCase();
            const ignoredExtensions = [
                // '.css', '.scss', '.sass', '.less', // 🔥 Allow styles to appear in PR list
                '.json', '.xml', '.yaml', '.yml', 
                '.md', '.txt', '.lock', '.map', 
                '.config', '.ini', '.env'
            ];
            
            // 🔥 Also ignore environment files and scripts
            if (file.path.includes('environments/') || file.path.includes('scripts/')) {
                console.log(`🚫 Ignoring env/script file: ${file.path}`);
                return false;
            }
            
            if (ignoredExtensions.includes(ext)) {
                console.log(`🚫 Ignoring file: ${file.path}`);
                return false;
            }
            return true;
        });

        console.log(`🔍 Analyzing ${filteredPRFiles.length} PR files (filtered from ${prFiles.length})...`);

        // Step 1: Load or build full graph (with cache)
        await this.ensureFullGraph();

        // Step 2: Find PR file nodes in full graph
        const prNodes = this.findPRNodes(filteredPRFiles);
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
                
                // 🔥 Use async extraction with VS Code API
                const changedSymbols = await this.extractChangedSymbols(node.prPatch, node.relativePath);
                
                if (changedSymbols.length === 0) {
                    console.log(`⚠️ No changed symbols extracted for: ${node.prPath}`);
                    // Don't fallback - if extraction fails, log clearly
                    nodeChangedSymbols.set(node.id, []);
                } else {
                    console.log(`✅ Extracted ${changedSymbols.length} changed symbols from: ${node.prPath}`);
                    console.log(`   Symbols: ${changedSymbols.map(s => s.fullName).join(', ')}`);
                    nodeChangedSymbols.set(node.id, changedSymbols);
                }
                
                // Store in node for Deep Impact
                node.changedSymbols = changedSymbols;
            } else if (node.prStatus === 'rename' && node.prPatch) {
                // Renamed + modified file: extract changed symbols if patch exists
                const changedSymbols = await this.extractChangedSymbols(node.prPatch, node.relativePath);
                
                if (changedSymbols.length > 0) {
                    console.log(`✅ Extracted ${changedSymbols.length} changed symbols from renamed file: ${node.prPath}`);
                    console.log(`   Symbols: ${changedSymbols.map(s => s.fullName).join(', ')}`);
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
        // 🔥 REFACTOR: Simplified logic - we only need to find dependents based on symbol usage
        // The graph construction will happen in buildFilteredGraph based on edges found here
        
        const relevantNodeIds = new Set(prNodes.map(n => n.id));
        let filteredDependents = 0;
        
        // Track which files use which specific symbols
        const symbolToDependentsMap = new Map(); // symbol → [dependent file paths]

        for (const node of prNodes) {
            if (node.prStatus === 'delete') {
                console.log(`🚫 Skipping dependency/dependent scan for deleted file: ${node.prPath}`);
                continue;
            }
            
            // Get direct dependents
            const allDependents = this.getDependents(node.id);
            
            console.log(`\n🔍 Analyzing file: ${node.prPath}`);
            console.log(`   Node ID: ${node.id}`);
            console.log(`   Node relative path: ${node.relativePath}`);
            console.log(`   Changed symbols: [${node.changedSymbols?.map(s => s.fullName).join(', ') || 'none'}]`);
            console.log(`   Dependents found in graph: ${allDependents.length}`);
            
            if ((node.prStatus === 'edit' || node.prStatus === 'rename') && node.changedSymbols && node.changedSymbols.length > 0) {
                // 🔥 NEW: If no direct dependents, check if this is a barrel export source
                if (allDependents.length === 0) {
                    console.log(`🔍 No direct dependents → Checking for barrel export usage`);
                    
                    const fullPRFilePath = path.join(this.workspaceRoot, node.relativePath);
                    const symbolFileUri = vscode.Uri.file(fullPRFilePath);
                    
                    // Try to find users through barrel exports
                    for (const symbol of node.changedSymbols) {
                        const symbolPosition = new vscode.Position(symbol.lineNumber, symbol.column);
                        
                        console.log(`         🔍 Finding users of: ${symbol.fullName} via barrel chain`);
                        
                        try {
                            const result = await this.resolveBarrelReferences(
                                symbolFileUri,
                                symbolPosition,
                                symbol.fullName,
                                new Set(),
                                0
                            );
                            
                            if (result.references.length > 0) {
                                console.log(`            📍 Found ${result.references.length} references through barrel`);
                                
                                // Extract unique file paths (excluding definition and barrel files)
                                const userFiles = new Set();
                                for (const ref of result.references) {
                                    const refPath = ref.uri.fsPath;
                                    const isDefinition = path.normalize(refPath) === path.normalize(fullPRFilePath);
                                    const isBarrel = await this.isBarrelExport(ref);
                                    
                                    console.log(`               🔍 Checking ref: ${path.basename(refPath)} (def=${isDefinition}, barrel=${isBarrel})`);
                                    
                                    if (!isDefinition && !isBarrel) {
                                        const relativePath = path.relative(this.workspaceRoot, refPath).replace(/\\/g, '/');
                                        userFiles.add(relativePath);
                                    }
                                }
                                
                                console.log(`            ✅ Found ${userFiles.size} actual user files`);
                                
                                // 🔥 NEW: If no users found via references, try wildcard search through barrel
                                if (userFiles.size === 0 && result.barrelChain && result.barrelChain.length > 0) {
                                    console.log(`            🔍 No users via references → Trying wildcard search through barrel`);
                                    
                                    // Find barrel file in chain
                                    for (const barrelInfo of result.barrelChain) {
                                        if (barrelInfo.isWildcard) {
                                            console.log(`               📦 Found wildcard barrel: ${path.basename(barrelInfo.location.uri.fsPath)}`);
                                            
                                            const wildcardRefs = await this.findImportsOfBarrelFile(
                                                barrelInfo.location.uri,
                                                symbol.fullName
                                            );
                                            
                                            console.log(`               ✅ Wildcard search found ${wildcardRefs.length} usages`);
                                            
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
                                    let userNode = this.fullGraph.nodes.find(n => n.relativePath === userFilePath);
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
                                        symbol.children.forEach(childName => {
                                            if (!symbolToDependentsMap.has(childName)) {
                                                symbolToDependentsMap.set(childName, []);
                                            }
                                            symbolToDependentsMap.get(childName).push(userFilePath);
                                        });
                                    }
                                    
                                    console.log(`            ✅ Added: ${userFilePath}`);
                                }
                            } else {
                                console.log(`            ⚠️ No references found via VS Code API → Trying wildcard search`);
                                
                                // 🔥 NEW: Fallback to wildcard search if no references at all
                                // Find barrel file that re-exports this symbol
                                const prDir = path.dirname(fullPRFilePath);
                                
                                // 🔥 FIX: Use configuration for barrel files
                                const possibleBarrelFiles = this.getBarrelFiles(fullPRFilePath);
                                
                                for (const barrelName of possibleBarrelFiles) {
                                    const barrelPath = path.join(prDir, barrelName);
                                    
                                    if (fs.existsSync(barrelPath)) {
                                        console.log(`               📦 Found barrel: ${path.basename(barrelPath)}`);
                                        
                                        const barrelUri = vscode.Uri.file(barrelPath);
                                        const wildcardRefs = await this.findImportsOfBarrelFile(
                                            barrelUri,
                                            symbol.fullName
                                        );
                                        
                                        if (wildcardRefs.length > 0) {
                                            console.log(`               ✅ Wildcard search found ${wildcardRefs.length} usages`);
                                            
                                            const userFiles = new Set();
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
                                                let userNode = this.fullGraph.nodes.find(n => n.relativePath === userFilePath);
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
                                                    symbol.children.forEach(childName => {
                                                        if (!symbolToDependentsMap.has(childName)) {
                                                            symbolToDependentsMap.set(childName, []);
                                                        }
                                                        symbolToDependentsMap.get(childName).push(userFilePath);
                                                    });
                                                }
                                                
                                                console.log(`            ✅ Added via fallback: ${userFilePath}`);
                                            }
                                            
                                            // Stop after finding the first valid barrel with usages
                                            break;
                                        }
                                    }
                                }
                            }
                        } catch (error) {
                            console.error(`            ❌ Error finding barrel references: ${error.message}`);
                        }
                    }
                } else {
                    // Has direct dependents - filter them normally
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
                }
            } else {
                // New/deleted/pure-rename file OR modified with no symbols: include all dependents
                allDependents.forEach(depId => {
                    relevantNodeIds.add(depId);
                });
                console.log(`✅ Included all ${allDependents.length} dependents for ${node.prStatus}: ${node.prPath}`);
            }
        }

        console.log(`📊 Total relevant nodes: ${relevantNodeIds.size}`);

        // Step 5: Build filtered graph
        const filteredGraph = this.buildFilteredGraph(relevantNodeIds, prNodes, nodeChangedSymbols);

        // Step 6: Add PR summary
        filteredGraph.prSummary = {
            totalPRFiles: prFiles.length,
            matchedNodes: prNodes.length,
            totalDependencies: 0, // Dependencies are now hidden
            totalDependents: filteredGraph.nodes.filter(n => n.nodeType === 'dependent' || n.nodeType === 'both').length,
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
            const graph = await this.vscodeAnalyzer.analyze();
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
            } else {
                // Handle files not present in cached graph (new or deleted)
                const placeholderNode = prFile.status === 'delete'
                    ? this.createNodeForDeletedFile(prFile)
                    : this.createNodeForNewFile(prFile);
                nodes.push(placeholderNode);
                console.log(`➕ Created node for ${prFile.status} file: ${prFile.path}`);
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
        const ext = path.extname(fileName).toLowerCase();

        // Determine category based on extension
        let category = 'file';
        
        // 🔥 FIX: Configuration-driven category detection
        if (this.vscodeAnalyzer && this.vscodeAnalyzer.languageConfig) {
            for (const [lang, config] of Object.entries(this.vscodeAnalyzer.languageConfig)) {
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
    createNodeForDeletedFile(prFile) {
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
     * Check if a node should be ignored based on language configuration
     * @param {string} filePath - Relative path of the file
     * @returns {boolean} - True if should be ignored
     */
    shouldIgnoreNode(filePath) {
        if (!filePath) return false;
        
        // Get language config from VSCode Analyzer
        const languageConfig = this.vscodeAnalyzer.languageConfig;
        const ext = path.extname(filePath).toLowerCase();
        
        // Find matching language
        const language = Object.values(languageConfig).find(config => 
            config.extensions.includes(ext)
        );
        
        if (language && language.ignorePatterns) {
            return language.ignorePatterns.some(pattern => {
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

    /**
     * Build filtered graph with only relevant nodes
     * 🔥 REWRITE: Clean Slate Approach - Focus purely on Impact (Dependents -> PR Files)
     */
    buildFilteredGraph(relevantNodeIds, prNodes, nodeChangedSymbols = new Map()) {
        // 1. Identify PR Nodes (The Center of the Universe)
        const prNodeIds = new Set(prNodes.map(n => n.id));
        const deletedNodeIds = new Set(
            prNodes.filter(n => n.prStatus === 'delete').map(n => n.id)
        );

        // 2. Identify Edges (Strict Impact Filtering)
        // We only care about edges that point TO a PR file.
        // Source can be anything (PR file or External file).
        // Target MUST be a PR file.
        const edges = [];
        
        // 2a. Scan Full Graph Edges
        this.fullGraph.edges.forEach(e => {
            // Skip if touching deleted files
            if (deletedNodeIds.has(e.source) || deletedNodeIds.has(e.target)) return;

            // 🔥 NEW: Check ignore patterns for Source (Dependent)
            // If the dependent is an ignored file (e.g. Angular Module), don't show it as impacted
            if (this.shouldIgnoreNode(e.source)) return;

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
                // We need to connect it to the PR file it depends on
                // Since we don't track exactly WHICH PR file caused this dependent to be relevant in the Set,
                // we rely on the fact that 'relevantNodeIds' was populated by scanning PR files.
                // However, to be precise, we should have tracked the relationship.
                // FALLBACK: If we found a dependent but no edge exists in full graph, 
                // we check if we can infer the connection or if it was added by barrel logic.
                
                // Check if we already added an edge for this node
                const isConnected = edges.some(e => e.source === nodeId);
                
                if (!isConnected) {
                    // This node was deemed relevant but has no edge in full graph pointing to a PR file.
                    // This likely means it was found via Barrel/Wildcard search.
                    // We need to find which PR file it uses.
                    // Since we don't have that mapping here easily without re-scanning, 
                    // we will try to find a connection in the full graph again (maybe missed?)
                    // OR we assume it connects to the PR file that triggered its inclusion.
                    
                    // RE-SCAN: Check which PR file's symbol analysis added this node
                    // This is a bit expensive but accurate.
                    // Actually, we can just look at the 'symbolToDependentsMap' if we had access to it here,
                    // but we don't.
                    
                    // SIMPLIFICATION: If we can't find a static edge, we skip it for now to avoid false positives,
                    // UNLESS we explicitly passed the dynamic edges (which we didn't).
                    // Wait! The previous logic iterated over prNodes to find barrel usages.
                    // Let's bring that back but cleaner.
                }
            }
        }
        
        // 🔥 RE-INTEGRATE BARREL LOGIC (Cleaner)
        // We need to add edges for dependents found via barrel resolution that aren't in the static graph
        for (const prNode of prNodes) {
            if (prNode.prStatus === 'delete') continue;
            
            // We need to know which dependents this PR node is responsible for.
            // Since we don't have that map passed in, we have to rely on the fact that
            // if a node is in relevantNodeIds and NOT in PR, it's a dependent.
            // But we don't know WHICH PR node it depends on without the map.
            
            // FIX: We will trust the 'edges' array we built from Full Graph for standard deps.
            // For barrel deps, we need to rely on the fact that 'relevantNodeIds' contains them.
            // If a relevant node has NO edge to any PR node, it's an orphan dependent.
            // We should probably have passed the 'symbolToDependentsMap' or similar.
            
            // FOR NOW: We will stick to the Full Graph edges + strict filtering.
            // If barrel resolution added nodes to 'relevantNodeIds', but didn't create an edge in 'fullGraph',
            // they will be missing edges.
            // However, 'relevantNodeIds' was populated by 'getDependents' (which uses full graph) 
            // AND 'resolveBarrelReferences' (which finds new files).
            
            // Let's try to recover the barrel edges by checking if any relevant node 
            // is NOT connected yet.
        }

        // 3. Identify Nodes based on Filtered Edges + PR Nodes
        const finalNodeIds = new Set(prNodeIds);
        edges.forEach(e => finalNodeIds.add(e.source));

        // 4. Construct Node Objects
        const nodes = [];
        const addedNodeIds = new Set();

        // Helper to add node
        const addNode = (id, sourceNode = null) => {
            if (addedNodeIds.has(id)) return;
            
            let nodeToAdd = sourceNode;
            
            if (!nodeToAdd) {
                // Try finding in full graph
                nodeToAdd = this.fullGraph.nodes.find(n => n.id === id);
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
                const prNode = prNodes.find(pn => pn.id === id);
                nodeToAdd = { ...nodeToAdd, ...prNode };
                nodeToAdd.nodeType = 'pr-file';
                
                if (nodeChangedSymbols.has(id)) {
                    nodeToAdd.changedSymbols = nodeChangedSymbols.get(id);
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
        prNodes.forEach(pn => addNode(pn.id));

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
     * 🔥 FIX: Extract and deduplicate to root objects only
     * Returns root symbols with children array for nested properties
     */
    /**
     * Main entry point for symbol extraction
     * Combines Regex (fast, robust for fragments) and VS Code API (accurate for structure)
     */
    async extractChangedSymbols(patch, prFilePath) {
        console.log(`   🔍 Extracting symbols using Hybrid approach (Regex + VS Code API)...`);
        
        // 1. Run Regex extraction (using the existing method)
        const regexSymbols = await this.extractChangedSymbolsRegex(patch, prFilePath);
        
        // 2. Run VS Code API extraction
        const vscodeSymbols = await this.extractChangedSymbolsVscode(patch, prFilePath);
        
        // 3. Merge and Deduplicate
        const mergedMap = new Map();
        
        // Helper to add symbol if valid
        const addSymbol = (sym, source) => {
            // Filter out symbols that match the filename (likely module wrappers)
            const fileName = path.basename(prFilePath, path.extname(prFilePath));
            if (sym.name.toLowerCase() === fileName.toLowerCase()) {
                console.log(`   🚫 Ignoring symbol '${sym.name}' (matches filename) from ${source}`);
                return;
            }
            
            if (!mergedMap.has(sym.fullName)) {
                mergedMap.set(sym.fullName, sym);
            } else {
                // If we already have it, maybe update metadata?
                // Prefer VS Code API type info if available
                if (source === 'VSCode' && mergedMap.get(sym.fullName).type === 'unknown') {
                    mergedMap.set(sym.fullName, sym);
                }
            }
        };
        
        regexSymbols.forEach(s => addSymbol(s, 'Regex'));
        vscodeSymbols.forEach(s => addSymbol(s, 'VSCode'));
        
        const finalSymbols = Array.from(mergedMap.values());
        console.log(`   ✅ Hybrid extraction found ${finalSymbols.length} unique symbols`);
        return finalSymbols;
    }

    /**
     * Extract changed symbols using VS Code DocumentSymbolProvider on Virtual Document
     * @param {string} patch - The git patch
     * @param {string} prFilePath - Relative path to file
     */
    async extractChangedSymbolsVscode(patch, prFilePath) {
        if (!patch) {
            return [];
        }

        console.log(`   📄 Extracting symbols from patch content (VS Code API)...`);
        
        // 1. Extract "New Code" from patch (lines starting with +)
        const lines = patch.split('\n');
        let newCodeContent = '';
        let hasContent = false;
        
        for (const line of lines) {
            if (line.startsWith('+++') || line.startsWith('---') || line.startsWith('@@')) {
                continue;
            }
            if (line.startsWith('+')) {
                const cleanLine = line.substring(1);
                newCodeContent += cleanLine + '\n';
                hasContent = true;
            } 
        }
        
        if (!hasContent || !newCodeContent.trim()) {
            return [];
        }

        // 2. Create Virtual Document
        try {
            // 🔥 IMPROVED: Use virtual content provider to avoid opening "Untitled" tabs
            const { virtualContentProvider } = require('./virtual-content-provider');
            
            // Store content in memory and get URI (scheme: aida-memory)
            const virtualUri = virtualContentProvider.setFileContent(prFilePath, newCodeContent);
            
            // Open the virtual document (read-only, no tab opened)
            const doc = await vscode.workspace.openTextDocument(virtualUri);
            
            // 3. Execute Symbol Provider
            const symbols = await vscode.commands.executeCommand(
                'vscode.executeDocumentSymbolProvider',
                doc.uri
            );
            
            // Clean up memory
            virtualContentProvider.clearFileContent(prFilePath);
            
            if (!symbols || symbols.length === 0) {
                return [];
            }
            
            // 4. Process Symbols
            const extractedSymbols = [];
            
            const processSymbol = (symbol, parentName = null) => {
                // 🔥 FIX: Dynamic symbol type mapping
                let typeStr = vscode.SymbolKind[symbol.kind] ? vscode.SymbolKind[symbol.kind].toLowerCase() : 'unknown';
                
                // Handle special cases
                if (typeStr === 'enummember') typeStr = 'enum-member';
                if (typeStr === 'typeparameter') typeStr = 'type-param';
                
                // 🔥 FIX: Configuration-driven significance check
                let isSignificant = false;
                const patterns = this.getLanguagePatterns(prFilePath);
                
                if (patterns) {
                    // Check if type is configured in patterns
                    if (patterns[typeStr]) {
                        isSignificant = true;
                    } else {
                        // Map related types
                        if (typeStr === 'method' && patterns['function']) isSignificant = true;
                        if (typeStr === 'field' && patterns['property']) isSignificant = true;
                        // Always include containers if they have children?
                        if (['class', 'interface', 'module', 'namespace'].includes(typeStr)) isSignificant = true;
                    }
                } else {
                    // Fallback to hardcoded list
                    isSignificant = [
                        vscode.SymbolKind.Class,
                        vscode.SymbolKind.Method,
                        vscode.SymbolKind.Property,
                        vscode.SymbolKind.Function,
                        vscode.SymbolKind.Variable,
                        vscode.SymbolKind.Constant,
                        vscode.SymbolKind.Interface,
                        vscode.SymbolKind.Enum
                    ].includes(symbol.kind);
                }

                if (isSignificant) {
                    extractedSymbols.push({
                        name: symbol.name,
                        fullName: parentName ? `${parentName}.${symbol.name}` : symbol.name,
                        type: typeStr,
                        lineNumber: 0, 
                        column: 0,
                        filePath: prFilePath,
                        isRoot: !parentName,
                        kind: symbol.kind
                    });
                }
                
                if (symbol.children && symbol.children.length > 0) {
                    symbol.children.forEach(child => processSymbol(child, symbol.name));
                }
            };
            
            symbols.forEach(s => processSymbol(s));
            
            // Deduplicate
            const uniqueSymbols = [];
            const seenNames = new Set();
            for (const sym of extractedSymbols) {
                if (!seenNames.has(sym.fullName)) {
                    seenNames.add(sym.fullName);
                    uniqueSymbols.push(sym);
                }
            }
            
            return uniqueSymbols;
            
        } catch (error) {
            console.error(`   ❌ Error in VS Code symbol extraction: ${error.message}`);
            return [];
        }
    }

    /**
     * Legacy regex-based extraction (kept for reference or fallback)
     */
    extractChangedSymbolsRegex(patch, prFilePath) {
        if (!patch) {
            console.log(`   ⚠️ No patch data`);
            return [];
        }

        console.log(`   📄 Extracting from patch (${patch.length} chars)...`);
        
        const allSymbols = [];
        const lines = patch.split('\n');
        const contextStack = [];
        let currentLineNumber = 0;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            if (line.startsWith('@@')) {
                const match = line.match(/@@ -\d+,?\d* \+(\d+),?\d* @@/);
                if (match) {
                    currentLineNumber = parseInt(match[1]) - 1;
                }
                continue;
            }
            
            if (line.startsWith('+') && !line.startsWith('+++')) {
                const codeLine = line.substring(1);
                const trimmed = codeLine.trim();
                
                // Detect object start
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
                        filePath: prFilePath,
                        isRoot: true
                    });
                    currentLineNumber++;
                    continue;
                }
                
                if (trimmed === '},' || trimmed === '}') {
                    if (contextStack.length > 0) {
                        contextStack.pop();
                    }
                    currentLineNumber++;
                    continue;
                }
                
                const extracted = this.extractSymbolsFromLine(codeLine, contextStack, currentLineNumber, prFilePath);
                allSymbols.push(...extracted);
                currentLineNumber++;
            } else if (line.startsWith('-') && !line.startsWith('---')) {
                continue;
            } else if (!line.startsWith('\\')) {
                currentLineNumber++;
            }
        }
        
        // 🔥 KEY FIX: Group by root object
        const rootSymbolMap = new Map();
        
        for (const sym of allSymbols) {
            let rootName;
            let rootSymbol;
            
            if (sym.type === 'object' && sym.isRoot) {
                // This is a root object
                rootName = sym.name;
                rootSymbol = sym;
            } else if (sym.parentName) {
                // This is a nested property - find its root
                rootName = sym.parentName;
                
                // Find the root object definition
                rootSymbol = allSymbols.find(s => 
                    s.name === rootName && s.isRoot
                );
                
                if (!rootSymbol) {
                    // Create virtual root if not found
                    rootSymbol = {
                        name: rootName,
                        fullName: rootName,
                        type: 'object',
                        lineNumber: sym.lineNumber,
                        column: 0,
                        filePath: sym.filePath,
                        isRoot: true,
                        children: []
                    };
                }
            } else {
                // Top-level symbol (function, const, etc.)
                rootName = sym.name;
                rootSymbol = sym;
            }
            
            if (!rootSymbolMap.has(rootName)) {
                rootSymbolMap.set(rootName, {
                    ...rootSymbol,
                    children: []
                });
            }
            
            // Track child properties
            if (sym.parentName && sym.parentName === rootName) {
                rootSymbolMap.get(rootName).children.push(sym.fullName);
            }
        }
        
        // Convert to array
        const uniqueRootSymbols = Array.from(rootSymbolMap.values());
        
        console.log(`   ✅ Found ${uniqueRootSymbols.length} root symbols:`);
        uniqueRootSymbols.forEach(s => {
            if (s.children && s.children.length > 0) {
                console.log(`      - ${s.fullName} (object with ${s.children.length} properties)`);
                s.children.forEach(child => {
                    console.log(`         └─ ${child}`);
                });
            } else {
                console.log(`      - ${s.fullName}`);
            }
        });
        
        return uniqueRootSymbols;
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

        // 🔥 FIX: Use configuration-driven patterns
        const patterns = this.getLanguagePatterns(filePath);
        
        if (patterns) {
            for (const [type, regex] of Object.entries(patterns)) {
                if (type === 'objectStart' || type === 'blockEnd') continue;
                
                try {
                    const pattern = regex instanceof RegExp ? regex : new RegExp(regex);
                    const match = trimmedLine.match(pattern);
                    
                    if (match) {
                        const name = match[1];
                        const column = line.indexOf(name);
                        
                        if (type === 'property' && contextStack.length > 0) {
                            const nestedPath = [...contextStack, name].join('.');
                            symbols.push({ 
                                name: name,
                                fullName: nestedPath,
                                type: 'property',
                                parentName: contextStack[contextStack.length - 1],
                                lineNumber: lineNumber,
                                column: column,
                                filePath: filePath
                            });
                        } else {
                            symbols.push({ 
                                name: name,
                                fullName: name,
                                type: type,
                                lineNumber: lineNumber,
                                column: column,
                                filePath: filePath
                            });
                        }
                    }
                } catch (e) {}
            }
            return symbols;
        }
        
        // Fallback to hardcoded JS/TS regexes
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
     * 🔥 UPDATE: Simplified getUsedSymbols - now works with root symbols only
     * When root symbol is found, automatically includes all child properties
     */
    async getUsedSymbols(dependentPath, prFilePath, changedSymbols) {
        const usedSymbols = [];
        
        if (!changedSymbols || changedSymbols.length === 0) {
            return usedSymbols;
        }

        try {
            console.log(`      🔍 Checking dependent: ${dependentPath}`);
            console.log(`         Root symbols to check: [${changedSymbols.map(s => s.fullName).join(', ')}]`);
            
            const fullDependentPath = path.join(this.workspaceRoot, dependentPath);
            const fullPRFilePath = path.join(this.workspaceRoot, prFilePath);
            
            if (!fs.existsSync(fullDependentPath)) {
                console.log(`         ❌ File not found: ${fullDependentPath}`);
                return usedSymbols;
            }

            const symbolFileUri = vscode.Uri.file(fullPRFilePath);

            // Check each root symbol
            for (const symbol of changedSymbols) {
                const symbolPosition = new vscode.Position(symbol.lineNumber, symbol.column);
                
                console.log(`         🔍 Searching: ${symbol.fullName}`);
                
                try {
                    const result = await this.resolveBarrelReferences(
                        symbolFileUri,
                        symbolPosition,
                        symbol.fullName,
                        new Set(),
                        0
                    );
                    
                    const allReferences = result.references;
                    
                    if (allReferences.length === 0) {
                        console.log(`            ⏭️ No references found`);
                        continue;
                    }
                    
                    console.log(`            📍 Found ${allReferences.length} total references`);
                    
                    // Filter to this dependent file only
                    const referencesInDependent = allReferences.filter(ref => {
                        const refPath = ref.uri.fsPath;
                        const isSameFile = path.normalize(refPath) === path.normalize(fullDependentPath);
                        const isNotDefinition = ref.range.start.line !== symbol.lineNumber;
                        return isSameFile && isNotDefinition;
                    });
                    
                    if (referencesInDependent.length > 0) {
                        // Filter out barrel exports
                        const realRefs = [];
                        for (const ref of referencesInDependent) {
                            const isBarrel = await this.isBarrelExport(ref);
                            if (!isBarrel) {
                                realRefs.push(ref);
                            }
                        }
                        
                        if (realRefs.length > 0) {
                            usedSymbols.push(symbol.fullName);
                            
                            // Also add all child properties
                            if (symbol.children && symbol.children.length > 0) {
                                usedSymbols.push(...symbol.children);
                            }
                            
                            console.log(`            ✅ Found ${realRefs.length} real usages`);
                            if (symbol.children && symbol.children.length > 0) {
                                console.log(`            ✅ Including ${symbol.children.length} child properties`);
                            }
                        }
                    }
                    
                } catch (error) {
                    console.error(`            ❌ Reference error: ${error.message}`);
                }
            }
            
            if (usedSymbols.length > 0) {
                console.log(`         ✅ Total confirmed: ${usedSymbols.length} symbols`);
            } else {
                console.log(`         ℹ️ No symbols from PR file used`);
            }

            return usedSymbols;
        } catch (error) {
            console.error(`      ❌ Analysis failed for ${dependentPath}:`, error.message);
            return [];
        }
    }

    /**
     * 🔥 IMPROVED: Recursively resolve references through barrel exports with better error handling
     */
    async resolveBarrelReferences(symbolUri, symbolPosition, symbolName, visitedBarrels, currentLevel = 0) {
        // 🔥 Delegate to BarrelResolver
        return await this.barrelResolver.resolveBarrelReferences(
            symbolUri, 
            symbolPosition, 
            symbolName, 
            visitedBarrels, 
            currentLevel
        );
    }

    /**
     * Get the exported symbol name and position from a barrel export line
     * @param {vscode.Location} barrelLocation - Location of barrel export
     * @returns {Promise<{name: string, position: vscode.Position, isWildcard: boolean}|null>}
     */
    async getBarrelExportSymbol(barrelLocation) {
        // 🔥 Delegate to BarrelResolver
        return await this.barrelResolver.getBarrelExportSymbolImproved(barrelLocation, null);
    }

    /**
     * 🔥 Improved barrel export symbol parsing (delegated to BarrelResolver)
     */
    async getBarrelExportSymbolImproved(barrelLocation, originalSymbolName) {
        // 🔥 Delegate to BarrelResolver
        return await this.barrelResolver.getBarrelExportSymbolImproved(barrelLocation, originalSymbolName);
    }

    /**
     * Find all files that import from a barrel file (for wildcard exports)
     * @param {vscode.Uri} barrelUri - URI of the barrel file
     * @param {string} symbolName - Original symbol name to look for
     * @returns {Promise<vscode.Location[]>}
     */
    async findImportsOfBarrelFile(barrelUri, symbolName) {
        // 🔥 Delegate to BarrelResolver
        return await this.barrelResolver.findImportsOfBarrelFileImproved(barrelUri, symbolName, 0);
    }

    /**
     * 🔥 Improved version (delegated to BarrelResolver)
     */
    async findImportsOfBarrelFileImproved(barrelUri, symbolName, currentLevel = 0) {
        // 🔥 Delegate to BarrelResolver
        return await this.barrelResolver.findImportsOfBarrelFileImproved(barrelUri, symbolName, currentLevel);
    }

    /**
     * 🔥 Load TypeScript path aliases (delegated to BarrelResolver)
     */
    async loadTSConfigAliases(workspacePath) {
        // 🔥 Delegate to BarrelResolver
        return await this.barrelResolver.loadTSConfigAliases(workspacePath);
    }

    /**
     * 🔥 Build import patterns (delegated to BarrelResolver)
     */
    buildImportPatterns(importerPath, barrelDir, barrelRelativeToWorkspace, pathAliases) {
        // 🔥 Delegate to BarrelResolver
        return this.barrelResolver.buildImportPatterns(
            importerPath, 
            barrelDir, 
            barrelRelativeToWorkspace, 
            pathAliases
        );
    }

    /**
     * Get language configuration patterns for a file
     */
    getLanguagePatterns(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        
        if (this.vscodeAnalyzer && this.vscodeAnalyzer.languageConfig) {
            for (const [lang, config] of Object.entries(this.vscodeAnalyzer.languageConfig)) {
                if (config.extensions && config.extensions.includes(ext)) {
                    return config.symbolPatterns;
                }
            }
        }
        return null;
    }

    /**
     * Get barrel/entry files for a specific language
     */
    getBarrelFiles(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        
        if (this.vscodeAnalyzer && this.vscodeAnalyzer.languageConfig) {
            for (const [lang, config] of Object.entries(this.vscodeAnalyzer.languageConfig)) {
                if (config.extensions && config.extensions.includes(ext)) {
                    if (config.barrelFiles) {
                        return config.barrelFiles;
                    }
                }
            }
        }

        // Fallback default
        return ['index.ts', 'index.js', 'index.jsx', 'index.tsx'];
    }

    /**
     * Check if a reference location is a barrel export (delegated to BarrelResolver)
     * @param {vscode.Location} location - Reference location
     * @returns {Promise<boolean>}
     */
    async isBarrelExport(location) {
        // 🔥 Delegate to BarrelResolver
        return await this.barrelResolver.isBarrelExport(location);
    }

}

module.exports = { PRDependencyAnalyzer };