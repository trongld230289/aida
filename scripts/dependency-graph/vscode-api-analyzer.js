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
        const patterns = [
            '**/*.ts',    // TypeScript
            '**/*.js',    // JavaScript 
            '**/*.tsx',   // React TypeScript
            '**/*.jsx',   // React JavaScript
            '**/*.cs',    // C#
            '**/*.java',  // Java
            '**/*.py'     // Python
        ];
        
        const excludePatterns = [
            '**/node_modules/**',
            '**/bin/**',
            '**/obj/**',
            '**/dist/**',
            '**/build/**',
            '**/out/**',
            '**/coverage/**',
            '**/.vscode/**',
            '**/.git/**',
            '**/.vs/**',
            '**/.*/**',           // Any folder starting with dot
            '**/*.spec.ts',       // Unit test files
            '**/*.spec.js',
            '**/*.test.ts',
            '**/*.test.js',
            '**/*.unit.ts',
            '**/*.unit.js',
            '**/test/**',         // Test folders
            '**/tests/**',
            '**/spec/**',
            '**/*.min.js',
            '**/*.d.ts'
        ];
        
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
     * Process a single file based on extension
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
            
            // Apply language-specific strategies
            if (extension === '.ts' || extension === '.tsx' || extension === '.js' || extension === '.jsx') {
                await this.processTypeScriptFile(document, text, sourceFile);
            } else if (extension === '.cs') {
                await this.processCSharpFile(document, text, sourceFile);
            } else if (extension === '.java') {
                await this.processJavaFile(document, text, sourceFile);
            } else if (extension === '.py') {
                await this.processPythonFile(document, text, sourceFile);
            }
            
        } catch (error) {
            console.warn(`⚠️ Error processing file ${fileUri.fsPath}:`, error.message);
        }
    }

    /**
     * TypeScript/JavaScript Strategy: Scan for Import statements
     */
    async processTypeScriptFile(document, text, sourceFile) {
        try {
            // Strategy: Find import paths and resolve using LSP
            const importRegex = /(?:from|import)\s+['"]([^'"]+)['"]/g;
            const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
            
            let match;
            
            // Process import statements
            while ((match = importRegex.exec(text)) !== null) {
                const importPath = match[1];
                await this.processImportMatch(document, text, match, sourceFile, importPath);
            }
            
            // Process require statements
            while ((match = requireRegex.exec(text)) !== null) {
                const importPath = match[1];
                await this.processImportMatch(document, text, match, sourceFile, importPath);
            }
            
            // Also look for class/type references (PascalCase words)
            await this.findClassReferences(document, text, sourceFile);
            
        } catch (error) {
            console.warn(`⚠️ Error processing TypeScript file:`, error.message);
        }
    }

    /**
     * Helper method to process import matches
     */
    async processImportMatch(document, text, match, sourceFile, importPath) {
        // Skip external libraries (no ./ or ../ prefix)
        if (!importPath.startsWith('./') && !importPath.startsWith('../') && !importPath.startsWith('@') && !importPath.startsWith('src/')) {
            return;
        }
        
        // Calculate position for LSP resolution
        const line = text.substring(0, match.index).split('\n').length - 1;
        const character = match.index - text.lastIndexOf('\n', match.index) - 1;
        const position = new vscode.Position(line, character);
        
        // Use LSP to resolve actual file
        const targetFile = await this.resolveDefinition(document, position);
        if (targetFile) {
            this.graph.get(sourceFile).add(targetFile);
            console.log(`🔗 ${sourceFile} -> ${targetFile} (import)`);
        }
        
        await this.sleep(5); // Throttle
    }

    /**
     * C# Strategy: Scan for Class/Type usages (PascalCase)
     */
    async processCSharpFile(document, text, sourceFile) {
        try {
            // Strategy: Find PascalCase words (potential class references)
            const classRefRegex = /\b([A-Z][a-zA-Z0-9]*(?:[A-Z][a-zA-Z0-9]*)*)\b/g;
            
            let match;
            const processedWords = new Set();
            
            while ((match = classRefRegex.exec(text)) !== null) {
                const className = match[1];
                
                // Skip common keywords and already processed words
                if (processedWords.has(className) || this.isCSharpKeyword(className)) {
                    continue;
                }
                processedWords.add(className);
                
                // Calculate position for LSP resolution
                const line = text.substring(0, match.index).split('\n').length - 1;
                const character = match.index - text.lastIndexOf('\n', match.index) - 1;
                const position = new vscode.Position(line, character);
                
                // Use LSP to resolve class definition
                const targetFile = await this.resolveDefinition(document, position);
                if (targetFile) {
                    this.graph.get(sourceFile).add(targetFile);
                    console.log(`🔗 ${sourceFile} -> ${targetFile} (class: ${className})`);
                }
                
                await this.sleep(5); // Throttle
            }
            
        } catch (error) {
            console.warn(`⚠️ Error processing C# file:`, error.message);
        }
    }

    /**
     * Java Strategy: Similar to C# - find class references
     */
    async processJavaFile(document, text, sourceFile) {
        // Similar to C# strategy
        await this.processCSharpFile(document, text, sourceFile);
    }

    /**
     * Python Strategy: Find import statements and class references
     */
    async processPythonFile(document, text, sourceFile) {
        try {
            // Python imports
            const importRegex = /(?:import|from)\s+([a-zA-Z_][a-zA-Z0-9_.]*)/g;
            
            let match;
            while ((match = importRegex.exec(text)) !== null) {
                const importName = match[1];
                
                // Skip standard library imports
                if (this.isPythonStandardLibrary(importName)) {
                    continue;
                }
                
                const line = text.substring(0, match.index).split('\n').length - 1;
                const character = match.index - text.lastIndexOf('\n', match.index) - 1;
                const position = new vscode.Position(line, character);
                
                const targetFile = await this.resolveDefinition(document, position);
                if (targetFile) {
                    this.graph.get(sourceFile).add(targetFile);
                    console.log(`🔗 ${sourceFile} -> ${targetFile} (python import)`);
                }
                
                await this.sleep(5);
            }
            
        } catch (error) {
            console.warn(`⚠️ Error processing Python file:`, error.message);
        }
    }

    /**
     * Find class/type references in TypeScript (PascalCase words)
     */
    async findClassReferences(document, text, sourceFile) {
        try {
            const classRefRegex = /\b([A-Z][a-zA-Z0-9]*)\b/g;
            
            let match;
            const processedWords = new Set();
            
            while ((match = classRefRegex.exec(text)) !== null) {
                const className = match[1];
                
                // Skip common TS/JS keywords and already processed
                if (processedWords.has(className) || this.isTypeScriptKeyword(className)) {
                    continue;
                }
                processedWords.add(className);
                
                const line = text.substring(0, match.index).split('\n').length - 1;
                const character = match.index - text.lastIndexOf('\n', match.index) - 1;
                const position = new vscode.Position(line, character);
                
                const targetFile = await this.resolveDefinition(document, position);
                if (targetFile) {
                    this.graph.get(sourceFile).add(targetFile);
                    console.log(`🔗 ${sourceFile} -> ${targetFile} (class: ${className})`);
                }
                
                await this.sleep(5);
            }
            
        } catch (error) {
            console.warn(`⚠️ Error finding class references:`, error.message);
        }
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
            );
            
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
     * Check if word is a C# keyword (to skip)
     */
    isCSharpKeyword(word) {
        const keywords = [
            'String', 'Int32', 'Boolean', 'Object', 'Void', 'Task', 'IEnumerable',
            'List', 'Dictionary', 'HttpClient', 'JsonSerializer', 'DateTime',
            'Guid', 'Exception', 'StringBuilder', 'Console', 'Math'
        ];
        return keywords.includes(word);
    }

    /**
     * Check if word is a TypeScript keyword (to skip)
     */
    isTypeScriptKeyword(word) {
        const keywords = [
            'String', 'Number', 'Boolean', 'Object', 'Array', 'Function',
            'Promise', 'Date', 'RegExp', 'Error', 'Map', 'Set', 'WeakMap',
            'Component', 'Injectable', 'NgModule', 'Directive', 'Pipe'
        ];
        return keywords.includes(word);
    }

    /**
     * Check if Python import is standard library (to skip)
     */
    isPythonStandardLibrary(importName) {
        const stdLib = [
            'os', 'sys', 'json', 'urllib', 'datetime', 'collections',
            'itertools', 'functools', 'typing', 're', 'math', 'random'
        ];
        const firstPart = importName.split('.')[0];
        return stdLib.includes(firstPart);
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