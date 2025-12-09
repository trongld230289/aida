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
                const changedSymbols = this.extractChangedSymbols(node.prPatch);
                
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
                const changedSymbols = this.extractChangedSymbols(node.prPatch);
                
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

        for (const node of prNodes) {
            // Get direct dependencies (always include all)
            const deps = this.getDependencies(node.id);
            deps.forEach(depId => {
                relevantNodeIds.add(depId);
                totalDeps++;
            });
            
            // Get direct dependents
            const allDependents = this.getDependents(node.id);
            
            if ((node.prStatus === 'edit' || node.prStatus === 'rename') && node.changedSymbols && node.changedSymbols.length > 0) {
                // Modified/renamed file with changed symbols: filter dependents by symbol usage
                console.log(`🔎 Filtering ${allDependents.length} dependents for ${node.prStatus} file: ${node.prPath}`);
                
                for (const depId of allDependents) {
                    const depNode = this.fullGraph.nodes.find(n => n.id === depId);
                    if (!depNode) continue;

                    // Check if dependent uses ANY changed symbol
                    const usesChangedSymbol = await this.fileUsesChangedSymbols(
                        depNode.relativePath,
                        node.relativePath,
                        node.changedSymbols
                    );

                    if (usesChangedSymbol) {
                        relevantNodeIds.add(depId);
                        totalDependents++;
                        filteredDependents++;
                        console.log(`   ✅ Dependent uses changed symbols: ${depNode.relativePath}`);
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
     * Extract changed symbols from unified diff patch
     * Extracts ALL identifiers from added/modified lines (not just definitions)
     */
    extractChangedSymbols(patch) {
        if (!patch) {
            return [];
        }

        const symbols = new Set();
        
        // JavaScript/TypeScript keywords to filter out
        const keywords = new Set([
            'const', 'let', 'var', 'function', 'class', 'interface', 'type', 'enum',
            'import', 'export', 'from', 'default', 'as', 'return', 'if', 'else',
            'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'try',
            'catch', 'finally', 'throw', 'new', 'this', 'super', 'extends',
            'implements', 'public', 'private', 'protected', 'static', 'readonly',
            'async', 'await', 'void', 'null', 'undefined', 'true', 'false',
            'typeof', 'instanceof', 'in', 'of', 'delete', 'yield', 'with'
        ]);

        const lines = patch.split('\n');
        
        for (const line of lines) {
            // Only process added or modified lines
            if (!line.startsWith('+') || line.startsWith('+++')) {
                continue;
            }

            // Remove the '+' prefix
            const codeLine = line.substring(1);

            // Extract ALL identifiers (variables, functions, classes, properties, etc.)
            // Match: word characters, optionally followed by property access
            const identifierPattern = /\b([a-zA-Z_$][a-zA-Z0-9_$]*)\b/g;
            let match;
            
            while ((match = identifierPattern.exec(codeLine)) !== null) {
                const identifier = match[1];
                
                // Filter out keywords and very short names (likely false positives)
                if (!keywords.has(identifier) && identifier.length > 1) {
                    symbols.add(identifier);
                }
            }
        }

        return Array.from(symbols);
    }

    /**
     * Check if a dependent file uses any of the changed symbols from a PR file
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
