const TreeSitterAnalyzer = require('./tree-sitter-analyzer');
const path = require('path');
const fs = require('fs');

/**
 * Enhanced Graph Builder using Tree-sitter analysis
 * Builds dependency graphs with better accuracy and Angular awareness
 */
class EnhancedGraphBuilder {
    constructor() {
        this.analyzer = new TreeSitterAnalyzer();
        this.nodeIdCounter = 0;
        this.edgeIdCounter = 0;
    }

    /**
     * Build dependency graph from file list
     * @param {Array} filePaths - Array of file paths
     * @returns {Object} - Enhanced dependency graph
     */
    buildGraph(filePaths) {
        console.log('🚀 Building enhanced dependency graph with Tree-sitter...');
        
        const graph = {
            nodes: [],
            edges: [],
            metadata: {
                nodeCount: 0,
                edgeCount: 0,
                analyzer: 'tree-sitter',
                generatedAt: new Date()
            }
        };

        // Step 1: Analyze all files with Tree-sitter
        console.log(`📄 Analyzing ${filePaths.length} files...`);
        const analyzedFiles = filePaths.map(filePath => {
            try {
                return this.analyzer.analyzeFile(filePath);
            } catch (error) {
                console.warn(`⚠️ Failed to analyze ${filePath}:`, error.message);
                return null;
            }
        }).filter(Boolean);

        console.log(`✅ Successfully analyzed ${analyzedFiles.length} files`);

        // Step 2: Create nodes from analyzed files
        const filePathToNode = new Map();
        
        analyzedFiles.forEach(file => {
            const node = this.createEnhancedNode(file);
            graph.nodes.push(node);
            filePathToNode.set(file.filePath, node);
            filePathToNode.set(file.relativePath, node);
            
            // Also map by normalized paths for better resolution
            const normalizedPath = path.normalize(file.relativePath);
            filePathToNode.set(normalizedPath, node);
        });

        console.log(`📊 Created ${graph.nodes.length} nodes`);

        // Step 3: Create edges from dependencies
        analyzedFiles.forEach(file => {
            const sourceNode = filePathToNode.get(file.filePath);
            if (!sourceNode) return;

            file.dependencies.forEach(dependency => {
                const targetNode = this.resolveTargetNode(dependency, file, filePathToNode);
                if (targetNode && targetNode.id !== sourceNode.id) {
                    const edge = this.createEnhancedEdge(sourceNode, targetNode, dependency);
                    if (!this.isDuplicateEdge(graph.edges, edge)) {
                        graph.edges.push(edge);
                    }
                }
            });
        });

        // Step 4: Add barrel export relationships
        this.addBarrelExportDependencies(graph, analyzedFiles, filePathToNode);

        // Step 5: Enhance with Angular relationships
        this.addAngularComponentRelationships(graph, filePathToNode);

        // Step 6: Calculate metadata
        graph.metadata.nodeCount = graph.nodes.length;
        graph.metadata.edgeCount = graph.edges.length;

        // Step 7: Enhance with graph properties
        this.enhanceGraphProperties(graph);

        console.log(`✅ Graph complete: ${graph.nodes.length} nodes, ${graph.edges.length} edges`);
        return graph;
    }

    /**
     * Create enhanced node with Tree-sitter analysis
     * @param {Object} file - Analyzed file
     * @returns {Object} - Enhanced graph node
     */
    createEnhancedNode(file) {
        const node = {
            id: `node_${++this.nodeIdCounter}`,
            filePath: file.filePath,
            relativePath: file.relativePath,
            fileName: file.fileName,
            extension: file.extension,
            size: file.content ? file.content.length : 0,
            
            // Tree-sitter analysis results
            dependencies: file.dependencies,
            exports: file.exports,
            metadata: file.metadata,
            content: file.content,
            
            // Graph properties
            inDegree: 0,
            outDegree: 0,
            complexity: file.dependencies.length + file.exports.length,
            
            // Visualization properties
            group: this.determineEnhancedNodeGroup(file),
            category: this.determineEnhancedNodeCategory(file),
            level: 0,
            
            // Analysis properties
            isEntryPoint: false,
            isLeaf: false,
            isCritical: false,
            
            // Angular-specific properties
            displayName: this.getNodeDisplayName(file),
            entityType: this.getNodeEntityType(file),
            angularRole: this.getAngularRole(file)
        };

        return node;
    }

    /**
     * Get display name for node (prioritize Angular entity names)
     * @param {Object} file - Analyzed file
     * @returns {string} - Display name
     */
    getNodeDisplayName(file) {
        const entities = file.metadata?.angularEntities;
        if (!entities) return file.fileName;

        // Prioritize Angular entities
        const primaryEntities = [
            ...entities.components || [],
            ...entities.services || [],
            ...entities.modules || [],
            ...entities.directives || [],
            ...entities.pipes || []
        ];

        if (primaryEntities.length > 0) {
            return primaryEntities[0]; // Use first/main entity
        }

        // Fallback to interfaces, models
        const secondaryEntities = [
            ...entities.interfaces || [],
            ...entities.models || []
        ];

        if (secondaryEntities.length > 0) {
            return secondaryEntities[0];
        }

        return file.fileName;
    }

    /**
     * Get entity type for node
     * @param {Object} file - Analyzed file
     * @returns {string} - Entity type
     */
    getNodeEntityType(file) {
        const metadata = file.metadata;
        
        if (metadata?.isComponent) return 'component';
        if (metadata?.isService) return 'service';
        if (metadata?.isModule) return 'module';
        if (metadata?.isDirective) return 'directive';
        if (metadata?.isPipe) return 'pipe';
        
        const entities = metadata?.angularEntities;
        if (entities) {
            if (entities.components?.length > 0) return 'component';
            if (entities.services?.length > 0) return 'service';
            if (entities.modules?.length > 0) return 'module';
            if (entities.interfaces?.length > 0) return 'interface';
            if (entities.models?.length > 0) return 'model';
        }
        
        if (file.extension === '.html') return 'template';
        if (['.scss', '.css'].includes(file.extension)) return 'stylesheet';
        
        return 'typescript';
    }

    /**
     * Get Angular role for node
     * @param {Object} file - Analyzed file
     * @returns {string} - Angular role
     */
    getAngularRole(file) {
        if (file.relativePath.includes('/core/')) return 'core';
        if (file.relativePath.includes('/shared/')) return 'shared';
        if (file.relativePath.includes('/data/')) return 'data';
        if (file.relativePath.includes('/modules/')) return 'feature';
        if (file.relativePath.includes('/layout/')) return 'layout';
        return 'other';
    }

    /**
     * Determine enhanced node group
     * @param {Object} file - Analyzed file
     * @returns {string} - Node group
     */
    determineEnhancedNodeGroup(file) {
        const { metadata, extension, relativePath } = file;

        // Angular-specific groups (more accurate with Tree-sitter)
        if (metadata.isComponent || metadata.angularEntities?.components?.length > 0) return 'component';
        if (metadata.isService || metadata.angularEntities?.services?.length > 0) return 'service';
        if (metadata.isModule || metadata.angularEntities?.modules?.length > 0) return 'module';
        if (metadata.isDirective || metadata.angularEntities?.directives?.length > 0) return 'directive';
        if (metadata.isPipe || metadata.angularEntities?.pipes?.length > 0) return 'pipe';

        // Path-based groups
        if (relativePath.includes('/core/')) return 'core';
        if (relativePath.includes('/shared/')) return 'shared';
        if (relativePath.includes('/data/')) return 'data';
        if (relativePath.includes('/layout/')) return 'layout';
        if (relativePath.includes('/modules/')) return 'feature';

        // Extension-based groups
        if (extension === '.html') return 'template';
        if (['.scss', '.css'].includes(extension)) return 'style';
        if (metadata.interfaces?.length > 0) return 'interface';
        if (metadata.angularEntities?.models?.length > 0) return 'model';

        return 'other';
    }

    /**
     * Determine enhanced node category
     * @param {Object} file - Analyzed file
     * @returns {string} - Node category
     */
    determineEnhancedNodeCategory(file) {
        const { metadata, dependencies } = file;

        // Angular categories
        if (metadata.isComponent) return 'Component';
        if (metadata.isService) return 'Service';
        if (metadata.isModule) return 'Module';
        
        // Complexity-based categories
        if (dependencies.length > 10) return 'Complex';
        if (dependencies.length > 5) return 'Moderate';
        if (dependencies.length > 0) return 'Simple';
        
        return 'Leaf';
    }

    /**
     * Create enhanced edge with Tree-sitter info
     * @param {Object} sourceNode - Source node
     * @param {Object} targetNode - Target node
     * @param {Object} dependency - Dependency info
     * @returns {Object} - Enhanced edge
     */
    createEnhancedEdge(sourceNode, targetNode, dependency) {
        return {
            id: `edge_${++this.edgeIdCounter}`,
            source: sourceNode.id,
            target: targetNode.id,
            sourceFile: sourceNode.filePath,
            targetFile: targetNode.filePath,
            
            // Enhanced dependency information
            type: dependency.type,
            statement: dependency.statement,
            line: dependency.line,
            column: dependency.column || 0,
            
            // Edge properties
            weight: this.calculateEnhancedEdgeWeight(dependency),
            strength: this.calculateEnhancedEdgeStrength(dependency, sourceNode, targetNode),
            
            // Tree-sitter metadata
            isTreeSitterAnalyzed: true,
            
            // Metadata
            createdAt: new Date()
        };
    }

    /**
     * Calculate enhanced edge weight based on Tree-sitter analysis
     * @param {Object} dependency - Dependency info
     * @returns {number} - Edge weight
     */
    calculateEnhancedEdgeWeight(dependency) {
        const weights = {
            'import': 1.0,
            'require': 1.0,
            'dynamic-import': 0.8,
            'template': 1.5,      // Angular component-template relationship
            'stylesheet': 1.2,    // Angular component-style relationship
            'barrel-export': 0.6,
            'indirect-import': 0.4
        };
        
        return weights[dependency.type] || 0.5;
    }

    /**
     * Calculate enhanced edge strength
     * @param {Object} dependency - Dependency info
     * @param {Object} sourceNode - Source node
     * @param {Object} targetNode - Target node
     * @returns {number} - Edge strength
     */
    calculateEnhancedEdgeStrength(dependency, sourceNode, targetNode) {
        let strength = 1.0;
        
        // Angular component relationships are stronger
        if (dependency.type === 'template' || dependency.type === 'stylesheet') {
            strength = 2.0;
        }
        
        // Same module relationships are stronger
        if (sourceNode.angularRole === targetNode.angularRole) {
            strength *= 1.2;
        }
        
        return strength;
    }

    /**
     * Resolve target node using enhanced strategies
     * @param {Object} dependency - Dependency object
     * @param {Object} sourceFile - Source file
     * @param {Map} filePathToNode - File path to node mapping
     * @returns {Object|null} - Target node
     */
    resolveTargetNode(dependency, sourceFile, filePathToNode) {
        const sourcePath = dependency.source;
        
        // Enhanced resolution strategies with Tree-sitter
        const resolutionStrategies = [
            () => this.resolveAbsoluteFilePath(sourcePath, filePathToNode),
            () => this.resolveTypeScriptPathMapping(sourcePath, filePathToNode),
            () => this.resolveRelativePath(sourcePath, sourceFile, filePathToNode),
            () => this.resolveByFileName(sourcePath, filePathToNode),
            () => this.resolveAngularPath(sourcePath, sourceFile, filePathToNode)
        ];

        for (const strategy of resolutionStrategies) {
            const node = strategy();
            if (node) return node;
        }

        return null;
    }

    /**
     * Add barrel export dependencies using Tree-sitter analysis
     * @param {Object} graph - Dependency graph
     * @param {Array} analyzedFiles - Analyzed files
     * @param {Map} filePathToNode - File path to node mapping
     */
    addBarrelExportDependencies(graph, analyzedFiles, filePathToNode) {
        analyzedFiles.forEach(file => {
            const node = filePathToNode.get(file.filePath);
            if (!node) return;

            const barrelExports = file.exports?.filter(exp => exp.type === 'barrel-export') || [];
            
            barrelExports.forEach(barrelExport => {
                const targetNode = this.resolveTargetNode(
                    { source: barrelExport.source, type: 'barrel-export' },
                    file,
                    filePathToNode
                );

                if (targetNode && targetNode.id !== node.id) {
                    const edge = this.createEnhancedEdge(node, targetNode, {
                        type: 'barrel-export',
                        statement: barrelExport.statement,
                        line: barrelExport.line
                    });
                    
                    if (!this.isDuplicateEdge(graph.edges, edge)) {
                        graph.edges.push(edge);
                    }
                }
            });
        });
    }

    /**
     * Add Angular component relationships
     * @param {Object} graph - Dependency graph
     * @param {Map} filePathToNode - File path to node mapping
     */
    addAngularComponentRelationships(graph, filePathToNode) {
        graph.nodes.forEach(node => {
            if (node.entityType === 'component') {
                const basePath = node.filePath.replace('.component.ts', '');
                
                // Link to template
                const templatePath = basePath + '.component.html';
                const templateNode = filePathToNode.get(templatePath);
                if (templateNode) {
                    const edge = this.createEnhancedEdge(node, templateNode, {
                        type: 'template',
                        statement: 'templateUrl',
                        line: 0
                    });
                    if (!this.isDuplicateEdge(graph.edges, edge)) {
                        graph.edges.push(edge);
                    }
                }

                // Link to stylesheet
                const stylePath = basePath + '.component.scss';
                const styleNode = filePathToNode.get(stylePath);
                if (styleNode) {
                    const edge = this.createEnhancedEdge(node, styleNode, {
                        type: 'stylesheet',
                        statement: 'styleUrls',
                        line: 0
                    });
                    if (!this.isDuplicateEdge(graph.edges, edge)) {
                        graph.edges.push(edge);
                    }
                }
            }
        });
    }

    // Include all the resolution methods from the original graph builder
    resolveAbsoluteFilePath(sourcePath, filePathToNode) {
        return filePathToNode.get(sourcePath) || null;
    }

    resolveTypeScriptPathMapping(sourcePath, filePathToNode) {
        if (!sourcePath || typeof sourcePath !== 'string') return null;
        
        const pathMappings = {
            '@app/': 'src/app/core/',
            '@shared/': 'src/app/shared/',
            '@env': 'src/environments/environment',
            '@modules/': 'src/app/modules/',
            '@data/': 'src/app/data/'
        };

        for (const [alias, actualPath] of Object.entries(pathMappings)) {
            if (sourcePath.startsWith(alias)) {
                const resolvedPath = sourcePath.replace(alias, actualPath);
                const possibleExtensions = ['.ts', '.js', ''];
                
                for (const ext of possibleExtensions) {
                    const fullPath = resolvedPath + ext;
                    
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

    resolveRelativePath(sourcePath, sourceFile, filePathToNode) {
        if (!sourcePath || !sourcePath.startsWith('.')) return null;

        const sourceDir = path.dirname(sourceFile.filePath);
        const possibleExtensions = ['.ts', '.js', '.html', '.scss', '.css'];
        
        for (const ext of possibleExtensions) {
            const resolvedPath = path.resolve(sourceDir, sourcePath + ext);
            const node = filePathToNode.get(resolvedPath);
            if (node) return node;
        }

        return null;
    }

    resolveByFileName(sourcePath, filePathToNode) {
        if (!sourcePath) return null;
        
        const fileName = path.basename(sourcePath);
        for (const node of filePathToNode.values()) {
            if (node.fileName.startsWith(fileName)) {
                return node;
            }
        }
        return null;
    }

    resolveAngularPath(sourcePath, sourceFile, filePathToNode) {
        // Angular-specific path resolution logic
        return null;
    }

    isDuplicateEdge(edges, newEdge) {
        return edges.some(edge => 
            edge.source === newEdge.source && 
            edge.target === newEdge.target && 
            edge.type === newEdge.type
        );
    }

    enhanceGraphProperties(graph) {
        // Calculate in/out degrees
        graph.nodes.forEach(node => {
            node.inDegree = graph.edges.filter(edge => edge.target === node.id).length;
            node.outDegree = graph.edges.filter(edge => edge.source === node.id).length;
            
            // Determine node importance
            node.isEntryPoint = node.inDegree === 0 && node.outDegree > 0;
            node.isLeaf = node.outDegree === 0 && node.inDegree > 0;
            node.isCritical = node.inDegree > 5 || node.outDegree > 5;
        });
    }
}

module.exports = EnhancedGraphBuilder;