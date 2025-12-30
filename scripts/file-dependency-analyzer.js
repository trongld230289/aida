const vscode = require('vscode');
const path = require('path');
const { DependencyGraphService } = require('./dependency-graph-service');
const { VSCodeApiDependencyAnalyzer } = require('./dependency-graph/vscode-api-analyzer');
const { aidaLogging } = require('./settings');

class FileDependencyAnalyzer {
    constructor(workspaceRoot) {
        this.workspaceRoot = workspaceRoot;
        this.graphService = new DependencyGraphService(workspaceRoot);
    }

    /**
     * Analyze a single file using Fast Scan strategy
     * @param {string} filePath - Absolute path to the file
     */
    async analyzeFile(filePath) {
        aidaLogging(`🔍 Analyzing single file: ${filePath}`);
        
        // Strategy: Try Fast Scan first for immediate results
        // This avoids building the full graph (which takes 30s+)
        return this.analyzeFileFast(filePath);
    }

    /**
     * Fast Local Scan - Only analyzes the target file and its direct neighbors
     * @param {string} filePath 
     */
    async analyzeFileFast(filePath) {
        aidaLogging(`🚀 Starting Fast Local Scan for: ${filePath}`);
        const startTime = Date.now();

        const nodes = new Map();
        const edges = [];
        
        const relativePath = path.relative(this.workspaceRoot, filePath).replace(/\\/g, '/');
        const fileName = path.basename(filePath);
        
        // 1. Create Target Node
        const targetNode = {
            id: relativePath,
            relativePath: relativePath,
            label: fileName,
            fileName: fileName,
            displayName: fileName,
            type: 'file',
            entityType: this.inferEntityType(fileName),
            nodeType: 'target',
            fsPath: filePath
        };
        nodes.set(relativePath, targetNode);

        // 2. Find Outgoing Dependencies (Imports)
        // We reuse VSCodeApiDependencyAnalyzer but ONLY for this file
        const analyzer = new VSCodeApiDependencyAnalyzer(this.workspaceRoot);
        const fileUri = vscode.Uri.file(filePath);
        
        // This populates analyzer.graph with outgoing edges
        await analyzer.processFile(fileUri);
        
        const outgoingDeps = analyzer.graph.get(relativePath);
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
                        entityType: this.inferEntityType(depFileName),
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
                    entityType: this.inferEntityType(depFileName),
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
     * Infer entity type from file name
     * @param {string} fileName 
     */
    inferEntityType(fileName) {
        const name = fileName.toLowerCase();
        if (name.includes('.service.')) return 'service';
        if (name.includes('.component.')) return 'component';
        if (name.includes('.module.')) return 'module';
        if (name.includes('.model.')) return 'model';
        if (name.includes('.guard.')) return 'guard';
        if (name.includes('.directive.')) return 'directive';
        if (name.includes('.pipe.')) return 'pipe';
        return 'file';
    }

    /**
     * Find files that reference symbols in the target file
     * @param {vscode.Uri} fileUri 
     */
    async findDependents(fileUri) {
        const dependents = new Set();
        
        try {
            // Get all symbols in the file
            // We use executeDocumentSymbolProvider to get classes, functions, etc.
            const symbols = await vscode.commands.executeCommand(
                'vscode.executeDocumentSymbolProvider',
                fileUri
            );
            
            if (!symbols || symbols.length === 0) return dependents;
            
            // 🔥 FIX: Scan ALL top-level symbols, not just first 10
            // Filter to keep only relevant types (Class, Function, Interface, Variable, Enum, Constant)
            // SymbolKind: Class=4, Method=5, Property=6, Field=7, Constructor=8, Enum=9, Interface=10, Function=11, Variable=12, Constant=13
            const relevantSymbols = symbols.filter(s => {
                const kind = s.kind;
                return (kind === 4 || kind === 9 || kind === 10 || kind === 11 || kind === 12 || kind === 13);
            });

            aidaLogging(`   🔍 Scanning references for ${relevantSymbols.length} symbols...`);
            
            // Use Promise.all to run in parallel (much faster)
            const referencePromises = relevantSymbols.map(async (symbol) => {
                const position = symbol.selectionRange ? symbol.selectionRange.start : symbol.location.range.start;
                try {
                    const refs = await vscode.commands.executeCommand(
                        'vscode.executeReferenceProvider',
                        fileUri,
                        position
                    );
                    return refs || [];
                } catch (e) {
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
                    if (refPath.includes('node_modules')) continue;
                    
                    const relativePath = path.relative(this.workspaceRoot, refPath).replace(/\\/g, '/');
                    dependents.add(relativePath);
                }
            }
            
        } catch (error) {
            aidaLogging(`⚠️ Error finding dependents: ${error.message}`);
        }
        
        return dependents;
    }
}

module.exports = { FileDependencyAnalyzer };
