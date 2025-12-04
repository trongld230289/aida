const path = require('path');

/**
 * Graph builder for creating dependency graphs
 * Converts parsed file data into graph structures
 */
class GraphBuilder {
    constructor() {
        this.nodeIdCounter = 0;
        this.edgeIdCounter = 0;
    }

    /**
     * Build dependency graph from parsed files
     * @param {Array} parsedFiles - Array of parsed file objects
     * @returns {Object} - Dependency graph with nodes and edges
     */
    buildGraph(parsedFiles) {
        const graph = {
            nodes: [],
            edges: [],
            metadata: {
                nodeCount: 0,
                edgeCount: 0,
                generatedAt: new Date()
            }
        };

        // Create file path to node mapping
        const filePathToNode = new Map();
        
        // Step 1: Create nodes for all files
        parsedFiles.forEach(file => {
            const node = this.createNode(file);
            graph.nodes.push(node);
            filePathToNode.set(file.filePath, node);
            filePathToNode.set(file.relativePath, node);
        });

        // Step 2: Create edges based on dependencies
        parsedFiles.forEach(file => {
            const sourceNode = filePathToNode.get(file.filePath);
            if (!sourceNode) return;

            file.dependencies.forEach(dependency => {
                const targetNode = this.resolveTargetNode(dependency, file, filePathToNode);
                if (targetNode && targetNode.id !== sourceNode.id) {
                    const edge = this.createEdge(sourceNode, targetNode, dependency);
                    if (!this.isDuplicateEdge(graph.edges, edge)) {
                        graph.edges.push(edge);
                    }
                }
            });
        });

        // Step 3: Add metadata
        graph.metadata.nodeCount = graph.nodes.length;
        graph.metadata.edgeCount = graph.edges.length;

        // Step 4: Enhance with graph properties
        this.enhanceGraphProperties(graph);

        return graph;
    }

    /**
     * Create a node from parsed file
     * @param {Object} file - Parsed file object
     * @returns {Object} - Graph node
     */
    createNode(file) {
        const node = {
            id: `node_${++this.nodeIdCounter}`,
            filePath: file.filePath,
            relativePath: file.relativePath,
            fileName: path.basename(file.filePath),
            extension: file.extension,
            size: file.content ? file.content.length : 0,
            dependencies: file.dependencies,
            exports: file.exports,
            metadata: file.metadata,
            content: file.content,
            
            // Graph properties (will be calculated later)
            inDegree: 0,
            outDegree: 0,
            complexity: 0,
            
            // Visualization properties
            group: this.determineNodeGroup(file),
            category: this.determineNodeCategory(file),
            level: 0, // Will be calculated based on dependencies
            
            // Analysis properties
            isEntryPoint: false,
            isLeaf: false,
            isCritical: false
        };

        return node;
    }

    /**
     * Create an edge between two nodes
     * @param {Object} sourceNode - Source node
     * @param {Object} targetNode - Target node
     * @param {Object} dependency - Dependency information
     * @returns {Object} - Graph edge
     */
    createEdge(sourceNode, targetNode, dependency) {
        return {
            id: `edge_${++this.edgeIdCounter}`,
            source: sourceNode.id,
            target: targetNode.id,
            sourceFile: sourceNode.filePath,
            targetFile: targetNode.filePath,
            
            // Dependency information
            type: dependency.type,
            statement: dependency.statement,
            line: dependency.line,
            
            // Edge properties
            weight: this.calculateEdgeWeight(dependency),
            strength: this.calculateEdgeStrength(dependency, sourceNode, targetNode),
            
            // Metadata
            createdAt: new Date()
        };
    }

    /**
     * Resolve target node from dependency
     * @param {Object} dependency - Dependency object
     * @param {Object} sourceFile - Source file object
     * @param {Map} filePathToNode - Mapping of file paths to nodes
     * @returns {Object|null} - Target node or null
     */
    resolveTargetNode(dependency, sourceFile, filePathToNode) {
        const sourcePath = dependency.source;
        
        // Try different resolution strategies
        const resolutionStrategies = [
            () => this.resolveTypeScriptPathMapping(sourcePath, filePathToNode),
            () => this.resolveRelativePath(sourcePath, sourceFile, filePathToNode),
            () => this.resolveAbsolutePath(sourcePath, filePathToNode),
            () => this.resolveByFileName(sourcePath, filePathToNode),
            () => this.resolveAngularPath(sourcePath, sourceFile, filePathToNode),
            () => this.resolveNodeModulesPath(sourcePath, filePathToNode)
        ];

        for (const strategy of resolutionStrategies) {
            const node = strategy();
            if (node) return node;
        }

        return null;
    }

    /**
     * Resolve TypeScript path mapping imports (like @data/*, @shared/*, etc.)
     * @param {string} sourcePath - Source path from import
     * @param {Map} filePathToNode - File path to node mapping
     * @returns {Object|null} - Resolved node
     */
    resolveTypeScriptPathMapping(sourcePath, filePathToNode) {
        if (!sourcePath || typeof sourcePath !== 'string') return null;
        
        // Define TypeScript path mappings from tsconfig.json
        const pathMappings = {
            '@app/': 'src/app/core/',
            '@shared/': 'src/app/shared/',
            '@env': 'src/environments/environment',
            '@modules/': 'src/app/modules/',
            '@data/': 'src/app/data/'
        };

        // Check if the import path matches any path mapping
        for (const [alias, actualPath] of Object.entries(pathMappings)) {
            if (sourcePath.startsWith(alias)) {
                // Replace the alias with the actual path
                const resolvedPath = sourcePath.replace(alias, actualPath);
                const possibleExtensions = ['.ts', '.js', ''];
                
                for (const ext of possibleExtensions) {
                    const fullPath = resolvedPath + ext;
                    
                    // Try to find matching node by relative path
                    for (const [filePath, node] of filePathToNode) {
                        if (node.relativePath === fullPath || 
                            node.relativePath.endsWith(fullPath) ||
                            node.relativePath.includes(resolvedPath)) {
                            return node;
                        }
                    }
                }
            }
        }

        return null;
    }

    /**
     * Resolve relative path imports
     * @param {string} sourcePath - Source path from import
     * @param {Object} sourceFile - Source file object
     * @param {Map} filePathToNode - File path to node mapping
     * @returns {Object|null} - Resolved node
     */
    resolveRelativePath(sourcePath, sourceFile, filePathToNode) {
        if (!sourcePath || typeof sourcePath !== 'string' || !sourcePath.startsWith('.')) return null;

        const sourceDir = path.dirname(sourceFile.filePath);
        const possibleExtensions = ['.ts', '.js', '.html', '.scss', '.css'];
        
        for (const ext of possibleExtensions) {
            const resolvedPath = path.resolve(sourceDir, sourcePath + ext);
            const node = filePathToNode.get(resolvedPath);
            if (node) return node;
        }

        // Try without extension
        const resolvedPath = path.resolve(sourceDir, sourcePath);
        return filePathToNode.get(resolvedPath);
    }

    /**
     * Resolve absolute path imports
     * @param {string} sourcePath - Source path from import
     * @param {Map} filePathToNode - File path to node mapping
     * @returns {Object|null} - Resolved node
     */
    resolveAbsolutePath(sourcePath, filePathToNode) {
        if (!sourcePath || typeof sourcePath !== 'string' || sourcePath.startsWith('.') || sourcePath.startsWith('src/')) {
            return null; // Handled by other strategies
        }

        // Try to find by relative path
        for (const [filePath, node] of filePathToNode) {
            if (node.relativePath.includes(sourcePath) || 
                node.relativePath.endsWith(sourcePath + node.extension)) {
                return node;
            }
        }

        return null;
    }

    /**
     * Resolve by filename
     * @param {string} sourcePath - Source path from import
     * @param {Map} filePathToNode - File path to node mapping
     * @returns {Object|null} - Resolved node
     */
    resolveByFileName(sourcePath, filePathToNode) {
        if (!sourcePath || typeof sourcePath !== 'string') return null;
        
        const fileName = path.basename(sourcePath);
        
        for (const node of filePathToNode.values()) {
            if (node.fileName.startsWith(fileName)) {
                return node;
            }
        }

        return null;
    }

    /**
     * Resolve Angular-specific paths
     * @param {string} sourcePath - Source path from import
     * @param {Object} sourceFile - Source file object
     * @param {Map} filePathToNode - File path to node mapping
     * @returns {Object|null} - Resolved node
     */
    resolveAngularPath(sourcePath, sourceFile, filePathToNode) {
        if (!sourcePath || typeof sourcePath !== 'string') return null;
        
        // Handle @angular/* imports
        if (sourcePath.startsWith('@angular/')) {
            return null; // External Angular imports
        }

        // Handle app-relative imports
        if (sourcePath.startsWith('app/')) {
            const appPath = sourcePath.replace('app/', 'src/app/');
            return this.resolveRelativePath('./' + appPath, sourceFile, filePathToNode);
        }

        return null;
    }

    /**
     * Resolve node_modules paths
     * @param {string} sourcePath - Source path from import
     * @param {Map} filePathToNode - File path to node mapping
     * @returns {Object|null} - Resolved node
     */
    resolveNodeModulesPath(sourcePath, filePathToNode) {
        if (!sourcePath || typeof sourcePath !== 'string') return null;
        
        // Skip external packages
        if (!sourcePath.startsWith('.') && 
            !sourcePath.startsWith('/') && 
            !sourcePath.includes('src/')) {
            return null;
        }

        return null;
    }

    /**
     * Determine node group for visualization
     * @param {Object} file - Parsed file object
     * @returns {string} - Node group
     */
    determineNodeGroup(file) {
        const { relativePath, metadata, extension } = file;

        // Angular-specific groups
        if (metadata.isComponent) return 'component';
        if (metadata.isService) return 'service';
        if (metadata.isModule) return 'module';
        if (metadata.isDirective) return 'directive';
        if (metadata.isPipe) return 'pipe';

        // Path-based groups
        if (relativePath.includes('/core/')) return 'core';
        if (relativePath.includes('/shared/')) return 'shared';
        if (relativePath.includes('/layout/')) return 'layout';
        if (relativePath.includes('/modules/')) return 'feature';
        if (relativePath.includes('/data/')) return 'data';

        // Extension-based groups
        if (extension === '.html') return 'template';
        if (['.scss', '.css'].includes(extension)) return 'style';
        if (extension === '.ts' && metadata.interfaces?.length > 0) return 'interface';

        return 'other';
    }

    /**
     * Determine node category for analysis
     * @param {Object} file - Parsed file object
     * @returns {string} - Node category
     */
    determineNodeCategory(file) {
        const { metadata, extension } = file;

        if (metadata.isComponent || metadata.isDirective) return 'presentation';
        if (metadata.isService) return 'business';
        if (metadata.isModule) return 'configuration';
        if (extension === '.html') return 'template';
        if (['.scss', '.css'].includes(extension)) return 'styling';
        if (metadata.interfaces?.length > 0) return 'contract';

        return 'utility';
    }

    /**
     * Calculate edge weight based on dependency type
     * @param {Object} dependency - Dependency object
     * @returns {number} - Edge weight
     */
    calculateEdgeWeight(dependency) {
        const weights = {
            'import': 1,
            'require': 1,
            'dynamic-import': 0.5,
            'component': 2,
            'style-import': 0.3,
            'export-from': 0.8
        };

        return weights[dependency.type] || 1;
    }

    /**
     * Calculate edge strength based on context
     * @param {Object} dependency - Dependency object
     * @param {Object} sourceNode - Source node
     * @param {Object} targetNode - Target node
     * @returns {number} - Edge strength (0-1)
     */
    calculateEdgeStrength(dependency, sourceNode, targetNode) {
        let strength = 0.5; // Base strength

        // Stronger connections for same group
        if (sourceNode.group === targetNode.group) {
            strength += 0.2;
        }

        // Stronger connections for direct imports
        if (dependency.type === 'import') {
            strength += 0.2;
        }

        // Weaker connections for style imports
        if (dependency.type === 'style-import') {
            strength -= 0.2;
        }

        return Math.max(0, Math.min(1, strength));
    }

    /**
     * Check if edge is duplicate
     * @param {Array} edges - Existing edges
     * @param {Object} newEdge - New edge to check
     * @returns {boolean} - True if duplicate
     */
    isDuplicateEdge(edges, newEdge) {
        return edges.some(edge => 
            edge.source === newEdge.source && 
            edge.target === newEdge.target &&
            edge.type === newEdge.type
        );
    }

    /**
     * Enhance graph with additional properties
     * @param {Object} graph - Dependency graph
     */
    enhanceGraphProperties(graph) {
        // Calculate in/out degrees
        this.calculateDegrees(graph);
        
        // Determine entry points and leaf nodes
        this.identifySpecialNodes(graph);
        
        // Calculate levels (topological ordering)
        this.calculateLevels(graph);
        
        // Identify critical nodes
        this.identifyCriticalNodes(graph);
    }

    /**
     * Calculate in and out degrees for all nodes
     * @param {Object} graph - Dependency graph
     */
    calculateDegrees(graph) {
        // Reset degrees
        graph.nodes.forEach(node => {
            node.inDegree = 0;
            node.outDegree = 0;
        });

        // Calculate degrees from edges
        graph.edges.forEach(edge => {
            const sourceNode = graph.nodes.find(n => n.id === edge.source);
            const targetNode = graph.nodes.find(n => n.id === edge.target);
            
            if (sourceNode) sourceNode.outDegree++;
            if (targetNode) targetNode.inDegree++;
        });
    }

    /**
     * Identify entry points and leaf nodes
     * @param {Object} graph - Dependency graph
     */
    identifySpecialNodes(graph) {
        graph.nodes.forEach(node => {
            node.isEntryPoint = node.inDegree === 0 && node.outDegree > 0;
            node.isLeaf = node.outDegree === 0 && node.inDegree > 0;
        });
    }

    /**
     * Calculate node levels using topological sort
     * @param {Object} graph - Dependency graph
     */
    calculateLevels(graph) {
        const nodeMap = new Map(graph.nodes.map(n => [n.id, n]));
        const visited = new Set();
        const levels = new Map();

        // Recursive function to calculate levels
        const calculateLevel = (nodeId) => {
            if (levels.has(nodeId)) return levels.get(nodeId);
            if (visited.has(nodeId)) return 0; // Cycle detected

            visited.add(nodeId);
            
            const node = nodeMap.get(nodeId);
            if (!node) return 0;

            // Find incoming edges
            const incomingEdges = graph.edges.filter(e => e.target === nodeId);
            
            if (incomingEdges.length === 0) {
                levels.set(nodeId, 0);
                return 0;
            }

            const maxSourceLevel = Math.max(
                ...incomingEdges.map(edge => calculateLevel(edge.source))
            );

            const level = maxSourceLevel + 1;
            levels.set(nodeId, level);
            return level;
        };

        // Calculate levels for all nodes
        graph.nodes.forEach(node => {
            visited.clear();
            node.level = calculateLevel(node.id);
        });
    }

    /**
     * Identify critical nodes in the graph
     * @param {Object} graph - Dependency graph
     */
    identifyCriticalNodes(graph) {
        graph.nodes.forEach(node => {
            // Critical if high connectivity or core functionality
            node.isCritical = (
                node.inDegree + node.outDegree > 5 ||
                node.group === 'core' ||
                node.group === 'service' ||
                node.metadata.isModule
            );
        });
    }

    /**
     * Calculate impact analysis for a given component/file
     * @param {Object} graph - Dependency graph
     * @param {string} targetEntity - Component/class name or file path to analyze
     * @returns {Object} - Impact analysis result
     */
    calculateImpactAnalysis(graph, targetEntity) {
        // Find the target node
        const targetNode = this.findNodeByEntity(graph, targetEntity);
        if (!targetNode) {
            return {
                found: false,
                message: `Entity "${targetEntity}" not found in dependency graph`
            };
        }

        // Calculate direct and indirect impacts
        const directImpacts = this.getDirectImpacts(graph, targetNode);
        const indirectImpacts = this.getIndirectImpacts(graph, targetNode, directImpacts);
        
        // Categorize impacts by type
        const impactSummary = this.categorizeImpacts([...directImpacts, ...indirectImpacts]);
        
        // Calculate risk level
        const riskLevel = this.calculateRiskLevel(directImpacts, indirectImpacts, impactSummary);

        return {
            found: true,
            targetEntity,
            targetNode: {
                id: targetNode.id,
                fileName: targetNode.fileName,
                relativePath: targetNode.relativePath,
                type: targetNode.metadata?.angularEntities ? 
                      this.getEntityType(targetNode.metadata.angularEntities) : 'file'
            },
            impactSummary: {
                total: directImpacts.length + indirectImpacts.length,
                direct: directImpacts.length,
                indirect: indirectImpacts.length,
                riskLevel,
                byType: impactSummary
            },
            directImpacts: directImpacts.map(node => this.formatImpactNode(node)),
            indirectImpacts: indirectImpacts.map(node => this.formatImpactNode(node)),
            fullData: {
                directNodes: directImpacts,
                indirectNodes: indirectImpacts
            }
        };
    }

    /**
     * Find node by entity name (component, service, etc.) or file path
     * @param {Object} graph - Dependency graph
     * @param {string} entity - Entity to find
     * @returns {Object|null} - Found node or null
     */
    findNodeByEntity(graph, entity) {
        return graph.nodes.find(node => {
            // Check file name
            if (node.fileName === entity) return true;
            if (node.relativePath === entity) return true;
            
            // Check Angular entities
            if (node.metadata?.angularEntities) {
                const entities = node.metadata.angularEntities;
                return Object.values(entities).some(arr => 
                    Array.isArray(arr) && arr.includes(entity)
                );
            }
            
            // Check classes and interfaces
            if (node.metadata?.classes?.includes(entity)) return true;
            if (node.metadata?.interfaces?.includes(entity)) return true;
            
            return false;
        });
    }

    /**
     * Get direct impacts (dependents) of a node
     * @param {Object} graph - Dependency graph
     * @param {Object} targetNode - Target node
     * @returns {Array} - Array of directly impacted nodes
     */
    getDirectImpacts(graph, targetNode) {
        const directEdges = graph.edges.filter(edge => edge.source === targetNode.id);
        const directNodeIds = directEdges.map(edge => edge.target);
        return graph.nodes.filter(node => directNodeIds.includes(node.id));
    }

    /**
     * Get indirect impacts (2nd level and beyond dependents)
     * @param {Object} graph - Dependency graph
     * @param {Object} targetNode - Target node
     * @param {Array} directImpacts - Direct impacts to exclude
     * @returns {Array} - Array of indirectly impacted nodes
     */
    getIndirectImpacts(graph, targetNode, directImpacts) {
        const visited = new Set([targetNode.id, ...directImpacts.map(n => n.id)]);
        const indirectNodes = [];
        
        // BFS to find indirect impacts (limited to 3 levels to avoid explosion)
        const queue = [...directImpacts.map(n => ({ node: n, level: 2 }))];
        
        while (queue.length > 0 && indirectNodes.length < 50) {
            const { node: currentNode, level } = queue.shift();
            
            if (level > 4) continue; // Limit depth
            
            const nextLevelEdges = graph.edges.filter(edge => edge.source === currentNode.id);
            nextLevelEdges.forEach(edge => {
                if (!visited.has(edge.target)) {
                    visited.add(edge.target);
                    const nextNode = graph.nodes.find(n => n.id === edge.target);
                    if (nextNode) {
                        indirectNodes.push(nextNode);
                        if (level < 4) {
                            queue.push({ node: nextNode, level: level + 1 });
                        }
                    }
                }
            });
        }
        
        return indirectNodes;
    }

    /**
     * Categorize impacts by Angular entity types
     * @param {Array} impactNodes - Array of impact nodes
     * @returns {Object} - Categorized impact summary
     */
    categorizeImpacts(impactNodes) {
        const summary = {
            components: [],
            services: [],
            modules: [],
            models: [],
            others: []
        };

        impactNodes.forEach(node => {
            const entities = node.metadata?.angularEntities;
            if (entities) {
                if (entities.components?.length > 0) summary.components.push(...entities.components);
                if (entities.services?.length > 0) summary.services.push(...entities.services);
                if (entities.modules?.length > 0) summary.modules.push(...entities.modules);
                if (entities.models?.length > 0) summary.models.push(...entities.models);
            } else {
                summary.others.push(node.fileName);
            }
        });

        return {
            components: summary.components.length,
            services: summary.services.length,
            modules: summary.modules.length,
            models: summary.models.length,
            others: summary.others.length,
            details: summary
        };
    }

    /**
     * Calculate risk level based on impact analysis
     * @param {Array} directImpacts - Direct impact nodes
     * @param {Array} indirectImpacts - Indirect impact nodes
     * @param {Object} impactSummary - Categorized impact summary
     * @returns {string} - Risk level: HIGH, MEDIUM, LOW
     */
    calculateRiskLevel(directImpacts, indirectImpacts, impactSummary) {
        const totalImpact = directImpacts.length + indirectImpacts.length;
        const criticalImpacts = [...directImpacts, ...indirectImpacts].filter(n => n.isCritical).length;
        
        // High risk: Many impacts or critical components affected
        if (totalImpact > 20 || criticalImpacts > 5 || impactSummary.modules > 2) {
            return 'HIGH';
        }
        
        // Medium risk: Moderate impacts or some critical components
        if (totalImpact > 8 || criticalImpacts > 2 || impactSummary.components > 5) {
            return 'MEDIUM';
        }
        
        // Low risk: Few impacts
        return 'LOW';
    }

    /**
     * Get primary entity type from Angular entities
     * @param {Object} angularEntities - Angular entities object
     * @returns {string} - Primary entity type
     */
    getEntityType(angularEntities) {
        if (angularEntities.components?.length > 0) return 'component';
        if (angularEntities.services?.length > 0) return 'service';
        if (angularEntities.modules?.length > 0) return 'module';
        if (angularEntities.models?.length > 0) return 'model';
        if (angularEntities.interfaces?.length > 0) return 'interface';
        return 'file';
    }

    /**
     * Format impact node for QC-friendly display
     * @param {Object} node - Impact node
     * @returns {Object} - Formatted impact node
     */
    formatImpactNode(node) {
        const entities = node.metadata?.angularEntities || {};
        const primaryEntities = [
            ...entities.components || [],
            ...entities.services || [],
            ...entities.modules || []
        ];

        return {
            fileName: node.fileName,
            relativePath: node.relativePath,
            entities: primaryEntities,
            type: this.getEntityType(entities),
            isCritical: node.isCritical || false
        };
    }
}

module.exports = GraphBuilder;