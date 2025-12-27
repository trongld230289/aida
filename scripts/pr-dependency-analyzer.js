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
        const relevantNodeIds = new Set(prNodes.map(n => n.id));
        
        let totalDeps = 0;
        let totalDependents = 0;
        let filteredDependents = 0;
        
        // Track which files use which specific symbols
        const symbolToDependentsMap = new Map(); // symbol → [dependent file paths]

        for (const node of prNodes) {
            if (node.prStatus === 'delete') {
                console.log(`🚫 Skipping dependency/dependent scan for deleted file: ${node.prPath}`);
                continue;
            }
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
                                    totalDependents++;
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
                                const barrelPath = path.join(prDir, 'index.ts');
                                
                                if (fs.existsSync(barrelPath)) {
                                    console.log(`               📦 Found barrel: ${path.basename(barrelPath)}`);
                                    
                                    const barrelUri = vscode.Uri.file(barrelPath);
                                    const wildcardRefs = await this.findImportsOfBarrelFile(
                                        barrelUri,
                                        symbol.fullName
                                    );
                                    
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
                                        totalDependents++;
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

        // Ensure PR nodes that are not part of the cached graph (e.g., deleted files) are included
        const existingIds = new Set(nodes.map(n => n.id));
        for (const prNode of prNodes) {
            if (!existingIds.has(prNode.id)) {
                const clonedNode = { ...prNode };
                if (nodeChangedSymbols.has(prNode.id)) {
                    clonedNode.changedSymbols = nodeChangedSymbols.get(prNode.id);
                }
                nodes.push(clonedNode);
                existingIds.add(prNode.id);
            }
        }

        const deletedNodeIds = new Set(
            prNodes.filter(n => n.prStatus === 'delete').map(n => n.id)
        );

        // Get all edges between relevant nodes excluding those touching deleted files
        const edges = this.fullGraph.edges.filter(e =>
            relevantNodeIds.has(e.source) &&
            relevantNodeIds.has(e.target) &&
            !deletedNodeIds.has(e.source) &&
            !deletedNodeIds.has(e.target)
        );

        // 🔥 NEW: Add edges for barrel export detected files (not in original graph)
        // These are files found via resolveBarrelReferences that were added dynamically
        for (const prNode of prNodes) {
            if (prNode.prStatus === 'delete') {
                continue;
            }
            if (prNode.changedSymbols && Array.isArray(prNode.changedSymbols)) {
                // For each impacted file found via barrel resolution
                for (const nodeId of relevantNodeIds) {
                    if (nodeId === prNode.id) continue; // Skip self
                    
                    const targetNode = nodes.find(n => n.id === nodeId);
                    if (!targetNode || targetNode.isPRFile) continue;
                    
                    // Check if edge already exists
                    const edgeExists = edges.some(e => 
                        e.source === nodeId && e.target === prNode.id
                    );
                    
                    if (!edgeExists) {
                        // Create edge from impacted file to PR file (dependent relationship)
                        edges.push({
                            source: nodeId,
                            target: prNode.id,
                            type: 'uses'
                        });
                    }
                }
            }
        }

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
            const ext = path.extname(prFilePath).toLowerCase();
            let languageId = 'typescript';
            if (ext === '.html') languageId = 'html';
            else if (ext === '.css' || ext === '.scss') languageId = 'scss';
            else if (ext === '.json') languageId = 'json';
            else if (ext === '.py') languageId = 'python';
            
            const doc = await vscode.workspace.openTextDocument({
                content: newCodeContent,
                language: languageId
            });
            
            // 3. Execute Symbol Provider
            const symbols = await vscode.commands.executeCommand(
                'vscode.executeDocumentSymbolProvider',
                doc.uri
            );
            
            if (!symbols || symbols.length === 0) {
                return [];
            }
            
            // 4. Process Symbols
            const extractedSymbols = [];
            
            const processSymbol = (symbol, parentName = null) => {
                const typeMap = {
                    [vscode.SymbolKind.File]: 'file',
                    [vscode.SymbolKind.Module]: 'module',
                    [vscode.SymbolKind.Namespace]: 'namespace',
                    [vscode.SymbolKind.Package]: 'package',
                    [vscode.SymbolKind.Class]: 'class',
                    [vscode.SymbolKind.Method]: 'method',
                    [vscode.SymbolKind.Property]: 'property',
                    [vscode.SymbolKind.Field]: 'field',
                    [vscode.SymbolKind.Constructor]: 'constructor',
                    [vscode.SymbolKind.Enum]: 'enum',
                    [vscode.SymbolKind.Interface]: 'interface',
                    [vscode.SymbolKind.Function]: 'function',
                    [vscode.SymbolKind.Variable]: 'variable',
                    [vscode.SymbolKind.Constant]: 'const',
                    [vscode.SymbolKind.String]: 'string',
                    [vscode.SymbolKind.Number]: 'number',
                    [vscode.SymbolKind.Boolean]: 'boolean',
                    [vscode.SymbolKind.Array]: 'array',
                    [vscode.SymbolKind.Object]: 'object',
                    [vscode.SymbolKind.Key]: 'key',
                    [vscode.SymbolKind.Null]: 'null',
                    [vscode.SymbolKind.EnumMember]: 'enum-member',
                    [vscode.SymbolKind.Struct]: 'struct',
                    [vscode.SymbolKind.Event]: 'event',
                    [vscode.SymbolKind.Operator]: 'operator',
                    [vscode.SymbolKind.TypeParameter]: 'type-param'
                };
                
                const typeStr = typeMap[symbol.kind] || 'unknown';
                
                const isSignificant = [
                    vscode.SymbolKind.Class,
                    vscode.SymbolKind.Method,
                    vscode.SymbolKind.Property,
                    vscode.SymbolKind.Function,
                    vscode.SymbolKind.Variable,
                    vscode.SymbolKind.Constant,
                    vscode.SymbolKind.Interface,
                    vscode.SymbolKind.Enum
                ].includes(symbol.kind);

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