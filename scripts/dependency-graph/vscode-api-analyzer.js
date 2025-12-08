const vscode = require('vscode');
const path = require('path');

/**
 * Enhanced Dependency Analyzer using VS Code Language Server APIs
 * Strategy: "Symbol Crawling" - Use regex to find candidates, then LSP to resolve accurately
 */
class VSCodeApiDependencyAnalyzer {
    constructor(workspaceRoot) {
        this.workspaceRoot = workspaceRoot;
        // Graph: SourcePath -> Set<TargetPaths>
        this.graph = new Map();
        
        // Configuration-driven language support
        this.languageConfig = {
            typescript: {
                extensions: ['.ts', '.tsx', '.js', '.jsx'],
                importPatterns: [
                    /(?:from|import)\s+['"]([^'"]+)['"]/g,
                    /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g
                ],
                classPattern: /\b([A-Z][a-zA-Z0-9]*)\b/g,
                standardLibraries: ['String', 'Number', 'Boolean', 'Object', 'Array', 'Function',
                                   'Promise', 'Date', 'RegExp', 'Error', 'Map', 'Set', 'WeakMap',
                                   'Component', 'Injectable', 'NgModule', 'Directive', 'Pipe'],
                excludePatterns: [
                    '**/node_modules/**',
                    '**/dist/**',
                    '**/build/**',
                    '**/coverage/**',
                    '**/*.spec.ts',
                    '**/*.spec.js',
                    '**/*.test.ts',
                    '**/*.test.js',
                    '**/*.min.js',
                    '**/*.d.ts'
                ]
            },
            python: {
                extensions: ['.py'],
                importPatterns: [
                    /(?:import|from)\s+([a-zA-Z_][a-zA-Z0-9_.]*)/g
                ],
                classPattern: /class\s+([A-Z][a-zA-Z0-9_]*)/g,
                standardLibraries: ['os', 'sys', 'json', 'urllib', 'datetime', 'collections',
                                   'itertools', 'functools', 'typing', 're', 'math', 'random'],
                excludePatterns: [
                    '**/__pycache__/**',
                    '**/venv/**',
                    '**/env/**',
                    '**/.venv/**',
                    '**/dist/**',
                    '**/build/**',
                    '**/*.pyc',
                    '**/test_*.py',
                    '**/*_test.py'
                ]
            },
            csharp: {
                extensions: ['.cs'],
                importPatterns: [
                    /using\s+([a-zA-Z_][a-zA-Z0-9_.]*)/g
                ],
                classPattern: /\b([A-Z][a-zA-Z0-9]*(?:[A-Z][a-zA-Z0-9]*)*)\b/g,
                standardLibraries: ['String', 'Int32', 'Boolean', 'Object', 'Void', 'Task', 'IEnumerable',
                                   'List', 'Dictionary', 'HttpClient', 'JsonSerializer', 'DateTime',
                                   'Guid', 'Exception', 'StringBuilder', 'Console', 'Math'],
                excludePatterns: [
                    '**/bin/**',
                    '**/obj/**',
                    '**/packages/**',
                    '**/.vs/**',
                    '**/Debug/**',
                    '**/Release/**',
                    '**/*.AssemblyInfo.cs',
                    '**/*.Designer.cs'
                ]
            },
            java: {
                extensions: ['.java'],
                importPatterns: [
                    /import\s+([a-zA-Z_][a-zA-Z0-9_.]*)/g
                ],
                classPattern: /\b([A-Z][a-zA-Z0-9]*)\b/g,
                standardLibraries: ['String', 'Integer', 'Boolean', 'Object', 'List', 'Map', 'Set',
                                   'ArrayList', 'HashMap', 'Exception', 'System'],
                excludePatterns: [
                    '**/target/**',
                    '**/build/**',
                    '**/.gradle/**',
                    '**/bin/**',
                    '**/*.class',
                    '**/Test*.java',
                    '**/*Test.java'
                ]
            },
            vue: {
                extensions: ['.vue'],
                importPatterns: [
                    /(?:from|import)\s+['"]([^'"]+)['"]/g
                ],
                classPattern: /\b([A-Z][a-zA-Z0-9]*)\b/g,
                standardLibraries: ['Vue', 'Vuex', 'VueRouter'],
                excludePatterns: [
                    '**/node_modules/**',
                    '**/dist/**',
                    '**/.nuxt/**',
                    '**/coverage/**'
                ]
            },
            php: {
                extensions: ['.php'],
                importPatterns: [
                    /(?:use|require|include)\s+['"]?([^'";\s]+)/g
                ],
                classPattern: /\b([A-Z][a-zA-Z0-9]*)\b/g,
                standardLibraries: ['stdClass', 'Exception', 'DateTime', 'PDO'],
                excludePatterns: [
                    '**/vendor/**',
                    '**/cache/**',
                    '**/storage/**',
                    '**/*.blade.php'
                ]
            },
            go: {
                extensions: ['.go'],
                importPatterns: [
                    /import\s+"([^"]+)"/g
                ],
                classPattern: /type\s+([A-Z][a-zA-Z0-9]*)/g,
                standardLibraries: ['fmt', 'os', 'io', 'net', 'http', 'context'],
                excludePatterns: [
                    '**/vendor/**',
                    '**/*_test.go',
                    '**/testdata/**'
                ]
            },
            rust: {
                extensions: ['.rs'],
                importPatterns: [
                    /use\s+([a-zA-Z_][a-zA-Z0-9_:]*)/g
                ],
                classPattern: /(?:struct|enum|trait)\s+([A-Z][a-zA-Z0-9]*)/g,
                standardLibraries: ['std', 'String', 'Vec', 'Option', 'Result'],
                excludePatterns: [
                    '**/target/**',
                    '**/Cargo.lock',
                    '**/*_test.rs'
                ]
            },
            kotlin: {
                extensions: ['.kt'],
                importPatterns: [
                    /import\s+([a-zA-Z_][a-zA-Z0-9_.]*)/g
                ],
                classPattern: /\b([A-Z][a-zA-Z0-9]*)\b/g,
                standardLibraries: ['String', 'Int', 'Boolean', 'List', 'Map', 'Any'],
                excludePatterns: [
                    '**/build/**',
                    '**/.gradle/**',
                    '**/Test*.kt',
                    '**/*Test.kt'
                ]
            },
            swift: {
                extensions: ['.swift'],
                importPatterns: [
                    /import\s+([a-zA-Z_][a-zA-Z0-9_.]*)/g
                ],
                classPattern: /\b([A-Z][a-zA-Z0-9]*)\b/g,
                standardLibraries: ['String', 'Int', 'Bool', 'Array', 'Dictionary', 'Foundation'],
                excludePatterns: [
                    '**/.build/**',
                    '**/DerivedData/**',
                    '**/*.xcodeproj/**',
                    '**/*Tests.swift'
                ]
            },
            dart: {
                extensions: ['.dart'],
                importPatterns: [
                    /import\s+['"]([^'"]+)['"]/g
                ],
                classPattern: /\b([A-Z][a-zA-Z0-9]*)\b/g,
                standardLibraries: ['String', 'int', 'bool', 'List', 'Map', 'dart:'],
                excludePatterns: [
                    '**/.dart_tool/**',
                    '**/build/**',
                    '**/*_test.dart',
                    '**/*.g.dart'
                ]
            },
            ruby: {
                extensions: ['.rb'],
                importPatterns: [
                    /require\s+['"]([^'"]+)['"]/g
                ],
                classPattern: /class\s+([A-Z][a-zA-Z0-9]*)/g,
                standardLibraries: ['String', 'Integer', 'Array', 'Hash', 'File'],
                excludePatterns: [
                    '**/vendor/**',
                    '**/.bundle/**',
                    '**/spec/**',
                    '**/*_spec.rb'
                ]
            }
        };
        
        // Build extension to language mapping for fast lookup
        this.extensionMap = this.buildExtensionMap();
    }
    
    /**
     * Build extension to language mapping
     * @returns {Map} - Extension to language map
     */
    buildExtensionMap() {
        const map = new Map();
        for (const [language, config] of Object.entries(this.languageConfig)) {
            config.extensions.forEach(ext => map.set(ext, language));
        }
        return map;
    }

    /**
     * Main entry point - scan workspace for dependencies
     * @returns {Object} - Complete dependency graph
     */
    async analyze() {
        try {
            console.log('🔍 Starting Symbol Crawling analysis...');
            
            // Reset graph
            this.graph.clear();
            
            // Step 1: Find all source files
            const sourceFiles = await this.findSourceFiles();
            console.log(`📁 Found ${sourceFiles.length} source files`);
            
            // Step 2: Process each file with throttling
            for (let i = 0; i < sourceFiles.length; i++) {
                const fileUri = sourceFiles[i];
                console.log(`📝 Processing ${i + 1}/${sourceFiles.length}: ${path.basename(fileUri.fsPath)}`);
                
                await this.processFile(fileUri);
                
                // Throttle to prevent freezing Extension Host
                await this.sleep(5);
            }
            
            // Step 3: Convert to nodes/edges format
            return this.buildGraphResult();
            
        } catch (error) {
            console.error('❌ Symbol crawling failed:', error);
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
            Object.values(this.languageConfig)
                .flatMap(config => config.extensions.map(ext => `**/*${ext}`))
        )];
        
        // Collect all exclude patterns from language configs + common excludes
        const commonExcludes = [
            '**/.vscode/**',
            '**/.git/**',
            '**/.vs/**',
            '**/.*/**',           // Any folder starting with dot
            '**/test/**',         // Generic test folders
            '**/tests/**'
        ];
        
        const languageExcludes = [...new Set(
            Object.values(this.languageConfig)
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
            } catch (error) {
                console.warn(`⚠️ Error finding files with pattern ${pattern}:`, error.message);
            }
        }
        
        // Remove duplicates and filter workspace files
        const uniqueFiles = Array.from(new Set(allFiles.map(uri => uri.toString())))
            .map(uriString => vscode.Uri.parse(uriString))
            .filter(uri => uri.fsPath.startsWith(this.workspaceRoot));
            
        return uniqueFiles;
    }

    /**
     * Process a single file using configuration-driven approach
     * @param {vscode.Uri} fileUri - File to process
     */
    async processFile(fileUri) {
        try {
            const document = await vscode.workspace.openTextDocument(fileUri);
            const text = document.getText();
            const extension = path.extname(fileUri.fsPath).toLowerCase();
            
            // Initialize source file in graph
            const sourceFile = this.getRelativePath(fileUri.fsPath);
            if (!this.graph.has(sourceFile)) {
                this.graph.set(sourceFile, new Set());
            }
            
            // Auto-detect language from extension
            const language = this.extensionMap.get(extension);
            if (!language) {
                console.warn(`⚠️ Unsupported file extension: ${extension}`);
                return;
            }
            
            // Process file with language-specific configuration
            const config = this.languageConfig[language];
            await this.processWithConfig(document, text, sourceFile, config, language);
            
        } catch (error) {
            console.warn(`⚠️ Error processing file ${fileUri.fsPath}:`, error.message);
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
    async processWithConfig(document, text, sourceFile, config, language) {
        try {
            const processedSymbols = new Set();
            
            // Process all import patterns
            for (const pattern of config.importPatterns) {
                let match;
                // Reset regex lastIndex for reuse
                pattern.lastIndex = 0;
                
                while ((match = pattern.exec(text)) !== null) {
                    const importPath = match[1];
                    
                    // Skip external/standard libraries
                    if (this.isExternalImport(importPath, config.standardLibraries, language)) {
                        continue;
                    }
                    
                    await this.resolveAndAddDependency(document, text, match, sourceFile, 'import');
                    await this.sleep(5);
                }
            }
            
            // Process class/type references
            if (config.classPattern) {
                let match;
                config.classPattern.lastIndex = 0;
                
                while ((match = config.classPattern.exec(text)) !== null) {
                    const symbol = match[1];
                    
                    // Skip already processed symbols and standard libraries
                    if (processedSymbols.has(symbol) || config.standardLibraries.includes(symbol)) {
                        continue;
                    }
                    processedSymbols.add(symbol);
                    
                    await this.resolveAndAddDependency(document, text, match, sourceFile, `class: ${symbol}`);
                    await this.sleep(5);
                }
            }
            
        } catch (error) {
            console.warn(`⚠️ Error processing ${language} file:`, error.message);
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
    async resolveAndAddDependency(document, text, match, sourceFile, type) {
        try {
            // Calculate position for LSP resolution
            const line = text.substring(0, match.index).split('\n').length - 1;
            const character = match.index - text.lastIndexOf('\n', match.index) - 1;
            const position = new vscode.Position(line, character);
            
            // Use VS Code LSP to resolve actual file
            const targetFile = await this.resolveDefinition(document, position);
            if (targetFile) {
                this.graph.get(sourceFile).add(targetFile);
                console.log(`🔗 ${sourceFile} -> ${targetFile} (${type})`);
            }
        } catch (error) {
            // Silent fail - LSP might not be available for this symbol
        }
    }

    /**
     * Check if import is external (standard library or node_modules)
     * @param {string} importPath - Import path
     * @param {Array} standardLibraries - Standard library names
     * @param {string} language - Language name
     * @returns {boolean} - True if external
     */
    isExternalImport(importPath, standardLibraries, language) {
        // Check if it's a relative import (project files)
        if (importPath.startsWith('./') || importPath.startsWith('../') || 
            importPath.startsWith('@/') || importPath.startsWith('src/')) {
            return false;
        }
        
        // For TypeScript/JavaScript, check common patterns
        if (language === 'typescript' && (importPath.startsWith('@angular/') || 
            importPath.startsWith('@vue/') || importPath.startsWith('react'))) {
            return true;
        }
        
        // Check if it's a standard library
        const firstPart = importPath.split(/[./]/)[0];
        return standardLibraries.some(lib => 
            firstPart === lib || importPath.startsWith(lib)
        );
    }

    /**
     * The "Magic" function - calls VS Code API to find where a symbol is defined
     * @param {vscode.TextDocument} document 
     * @param {vscode.Position} position 
     * @returns {string|null} - Relative path to target file or null
     */
    async resolveDefinition(document, position) {
        try {
            const definitions = await vscode.commands.executeCommand(
                'vscode.executeDefinitionProvider',
                document.uri,
                position
            ).catch(lspError => {
                // C# Language Server can throw "Sequence contains no matching element"
                // Silently ignore LSP errors and continue analysis
                console.warn(`⚠️ LSP error for ${document.fileName}:${position.line} - ${lspError.message}`);
                return null;
            });
            
            if (!definitions || definitions.length === 0) {
                return null;
            }
            
            // Handle both Location and LocationLink formats
            for (const definition of definitions) {
                let targetUri;
                if (definition.uri) {
                    // Location format
                    targetUri = definition.uri;
                } else if (definition.targetUri) {
                    // LocationLink format  
                    targetUri = definition.targetUri;
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
                    return this.getRelativePath(targetPath);
                }
            }
            
            return null;
            
        } catch (error) {
            // Language server might not be available
            return null;
        }
    }

    /**
     * Check if a path is external dependency (should be filtered)
     */
    isExternalDependency(filePath) {
        const pathLower = filePath.toLowerCase();
        return (
            pathLower.includes('node_modules') ||
            pathLower.includes('omnisharp-metadata') ||
            pathLower.includes('.nuget') ||
            pathLower.includes('microsoft.netcore') ||
            pathLower.includes('system.') ||
            pathLower.includes('bin/debug') ||
            pathLower.includes('bin/release') ||
            pathLower.includes('obj/')
        );
    }

    /**
     * Get relative path from workspace root
     */
    getRelativePath(absolutePath) {
        return path.relative(this.workspaceRoot, absolutePath).replace(/\\/g, '/');
    }

    /**
     * Helper to prevent UI freezing
     */
    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Convert internal graph to nodes/edges format
     */
    buildGraphResult() {
        const nodes = [];
        const edges = [];
        
        // Create nodes for all files that have dependencies or are dependencies
        const allFileIds = new Set();
        for (const [sourceFile, dependencies] of this.graph) {
            allFileIds.add(sourceFile);
            dependencies.forEach(dep => allFileIds.add(dep));
        }
        
        // Create nodes for all referenced files
        for (const fileId of allFileIds) {
            const fullPath = path.join(this.workspaceRoot, fileId);
            const fileName = path.basename(fullPath);
            
            const node = {
                id: fileId,
                fileName,
                filePath: fullPath,
                relativePath: fileId,
                language: this.getLanguageFromExtension(fileName),
                type: this.inferFileType(fileName),
                dependencies: Array.from(this.graph.get(fileId) || []),
                dependents: []
            };
            
            nodes.push(node);
        }
        
        // Create edges and update dependents
        let edgeId = 0;
        const nodeIdSet = new Set(nodes.map(n => n.id));
        
        for (const [sourceFile, dependencies] of this.graph) {
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
    getLanguageFromExtension(fileName) {
        const ext = path.extname(fileName).toLowerCase();
        const languageMap = {
            '.ts': 'typescript',
            '.tsx': 'typescript',
            '.js': 'javascript',
            '.jsx': 'javascript',
            '.vue': 'vue',
            '.cs': 'csharp',
            '.java': 'java',
            '.py': 'python'
        };
        
        return languageMap[ext] || 'unknown';
    }

    /**
     * Infer file type (component, service, etc.)
     */
    inferFileType(fileName) {
        const name = fileName.toLowerCase();
        
        if (name.includes('.service.')) return 'service';
        if (name.includes('.component.')) return 'component';
        if (name.includes('.directive.')) return 'directive';
        if (name.includes('.pipe.')) return 'pipe';
        if (name.includes('.guard.')) return 'guard';
        if (name.includes('.resolver.')) return 'resolver';
        if (name.includes('.interceptor.')) return 'interceptor';
        if (name.includes('.module.')) return 'module';
        if (name.includes('controller')) return 'controller';
        if (name.includes('model')) return 'model';
        if (name.includes('interface')) return 'interface';
        if (name.includes('enum')) return 'enum';
        if (name.includes('constant')) return 'constant';
        if (name.includes('config')) return 'config';
        if (name.includes('util')) return 'utility';
        
        return 'file';
    }

    /**
     * Generate enhanced report with VS Code API insights
     */
    generateReport(graph) {
        // Calculate basic metrics
        const totalFiles = graph.nodes.length;
        const totalDependencies = graph.edges.length;
        
        // Calculate file type distribution
        const typeDistribution = {};
        graph.nodes.forEach(node => {
            typeDistribution[node.type] = (typeDistribution[node.type] || 0) + 1;
        });
        
        // Calculate language distribution  
        const languageDistribution = {};
        graph.nodes.forEach(node => {
            languageDistribution[node.language] = (languageDistribution[node.language] || 0) + 1;
        });
        
        // Find most connected files
        const connectionCounts = {};
        graph.edges.forEach(edge => {
            connectionCounts[edge.source] = (connectionCounts[edge.source] || 0) + 1;
            connectionCounts[edge.target] = (connectionCounts[edge.target] || 0) + 1;
        });
        
        const mostConnected = Object.entries(connectionCounts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10)
            .map(([file, count]) => ({
                file: file,
                connections: count,
                node: graph.nodes.find(n => n.relativePath === file)
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
    detectCircularDependencies(graph) {
        const visited = new Set();
        const recursionStack = new Set();
        const cycles = [];
        
        const dfs = (nodeId, path = []) => {
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
            const outgoingEdges = graph.edges.filter(edge => edge.source === nodeId);
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
    generateRecommendations(graph, mostConnected, circularDeps) {
        const recommendations = [];
        
        // High coupling recommendations
        const highCouplingThreshold = 10;
        const highCouplingFiles = mostConnected.filter(item => item.connections > highCouplingThreshold);
        
        if (highCouplingFiles.length > 0) {
            recommendations.push({
                type: 'high-coupling',
                severity: 'warning',
                title: 'High Coupling Detected',
                description: `${highCouplingFiles.length} files have more than ${highCouplingThreshold} dependencies. Consider using interfaces and dependency injection.`,
                files: highCouplingFiles.map(item => item.file),
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
        const services = graph.nodes.filter(n => n.type === 'service').length;
        const components = graph.nodes.filter(n => n.type === 'component').length;
        
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
}

module.exports = {
    VSCodeApiDependencyAnalyzer
};