const vscode = require('vscode');
const path = require('path');
const { BarrelResolver } = require('./barrel-resolver');
const { aidaLogging } = require('../settings');

/**
 * Enhanced Dependency Analyzer using VS Code Language Server APIs
 * Strategy: "Symbol Crawling" - Use regex to find candidates, then LSP to resolve accurately
 */
class VSCodeApiDependencyAnalyzer {
    constructor(workspaceRoot) {
        this.workspaceRoot = workspaceRoot;
        // Graph: SourcePath -> Set<TargetPaths>
        this.graph = new Map();
        // 🔥 NEW: Barrel resolver for advanced barrel file handling
        this.barrelResolver = new BarrelResolver();
        
        // Configuration-driven language support
        this.languageConfig = {
            typescript: {
                extensions: ['.ts', '.tsx', '.js', '.jsx'],
                // 🔥 NEW: Barrel/Entry file names
                barrelFiles: ['index.ts', 'index.tsx', 'index.js', 'index.jsx', 'public_api.ts'],
                importPatterns: [
                    /(?:from|import)\s+['"]([^'"]+)['"]/g,
                    /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g
                ],
                // 🔥 NEW: Asset patterns for UI templates/styles
                assetPatterns: [
                    // Angular
                    { type: 'html', regex: /templateUrl\s*:\s*['"`]([^'"`]+)['"`]/ }
                    // CSS/SCSS patterns removed to disable style impact analysis
                ],
                // 🔥 NEW: Ignore patterns for Impact Analysis (e.g. Angular Modules)
                ignorePatterns: [
                    '**/*.module.ts', // Angular Modules are just declarations
                    '**/*.spec.ts',   // Tests
                    '**/*.test.ts'
                ],
                // Expanded pattern to catch CONSTANTS and camelCase functions
                classPattern: /\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g,
                // 🔥 NEW: Regex patterns for symbol extraction from patches
                symbolPatterns: {
                    objectStart: /^([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:\s*\{/,
                    blockEnd: /^\},?$/,
                    property: /^([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:\s*/,
                    function: /function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/,
                    const: /const\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=/,
                    class: /class\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/,
                    interface: /interface\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/
                },
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
                // 🔥 NEW: Barrel/Entry file names
                barrelFiles: ['__init__.py'],
                importPatterns: [
                    /(?:import|from)\s+([a-zA-Z_][a-zA-Z0-9_.]*)/g
                ],
                // 🔥 NEW: Asset patterns
                assetPatterns: [
                    // Flask/Django templates
                    { type: 'template', regex: /render_template\s*\(\s*['"`]([^'"`]+)['"`]/ }
                ],
                // 🔥 NEW: Ignore patterns
                ignorePatterns: [
                    '**/tests/**',
                    '**/test_*.py',
                    '**/*_test.py'
                ],
                classPattern: /class\s+([A-Z][a-zA-Z0-9_]*)/g,
                // 🔥 NEW: Regex patterns for symbol extraction from patches
                symbolPatterns: {
                    class: /class\s+([a-zA-Z_][a-zA-Z0-9_]*)/,
                    function: /def\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/,
                },
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
                // 🔥 NEW: Asset patterns for Views/Layouts
                assetPatterns: [
                    { type: 'view', regex: /View\s*\(\s*['"]([^'"]+)['"]/ },
                    { type: 'view', regex: /PartialView\s*\(\s*['"]([^'"]+)['"]/ },
                    { type: 'layout', regex: /Layout\s*=\s*['"]([^'"]+)['"]/ }
                ],
                // 🔥 NEW: Ignore patterns
                ignorePatterns: [
                    '**/*.Test.cs',
                    '**/*.Tests.cs'
                ],
                classPattern: /\b([A-Z][a-zA-Z0-9]*(?:[A-Z][a-zA-Z0-9]*)*)\b/g,
                // 🔥 NEW: Regex patterns for symbol extraction from patches
                symbolPatterns: {
                    class: /class\s+([a-zA-Z_][a-zA-Z0-9_]*)/,
                    interface: /interface\s+([a-zA-Z_][a-zA-Z0-9_]*)/,
                    function: /(?:public|private|protected|internal|static|\s)+[\w<>[\]]+\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/,
                    const: /const\s+[\w<>[\]]+\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*=/,
                    blockEnd: /^\s*\}\s*$/
                },
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
                // 🔥 NEW: Asset patterns for Views/JSP
                assetPatterns: [
                    { type: 'view', regex: /return\s+['"]([^'"]+)['"]\s*;/ },
                    { type: 'jsp', regex: /<jsp:include\s+page=['"]([^'"]+)['"]/ }
                ],
                // 🔥 NEW: Ignore patterns
                ignorePatterns: [
                    '**/*Test.java',
                    '**/Test*.java',
                    '**/*.spec.java'
                ],
                classPattern: /\b([A-Z][a-zA-Z0-9]*)\b/g,
                // 🔥 NEW: Regex patterns for symbol extraction from patches
                symbolPatterns: {
                    class: /class\s+([a-zA-Z_][a-zA-Z0-9_]*)/,
                    interface: /interface\s+([a-zA-Z_][a-zA-Z0-9_]*)/,
                    function: /(?:public|private|protected|static|\s)+[\w<>[\]]+\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/,
                    const: /(?:final|static)\s+[\w<>[\]]+\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*=/,
                    blockEnd: /^\s*\}\s*$/
                },
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
                // 🔥 NEW: Asset patterns for external templates/styles
                assetPatterns: [
                    { type: 'template', regex: /<template\s+src=['"]([^'"]+)['"]/ },
                    { type: 'style', regex: /<style\s+src=['"]([^'"]+)['"]/ }
                ],
                // 🔥 NEW: Ignore patterns
                ignorePatterns: [
                    '**/*.spec.js',
                    '**/*.test.js',
                    '**/*.spec.ts',
                    '**/*.test.ts'
                ],
                classPattern: /\b([A-Z][a-zA-Z0-9]*)\b/g,
                // 🔥 NEW: Regex patterns for symbol extraction from patches (similar to JS/TS)
                symbolPatterns: {
                    objectStart: /^([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:\s*\{/,
                    blockEnd: /^\},?$/,
                    property: /^([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:\s*/,
                    function: /(?:function\s+)?([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/,
                    const: /(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=/,
                    class: /class\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/
                },
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
                // 🔥 NEW: Barrel/Entry file names
                barrelFiles: ['index.php'],
                importPatterns: [
                    /(?:use|require|include)\s+['"]?([^'";\s]+)/g
                ],
                // 🔥 NEW: Asset patterns for Views/Includes
                assetPatterns: [
                    { type: 'view', regex: /view\s*\(\s*['"]([^'"]+)['"]/ },
                    { type: 'include', regex: /(?:include|require)(?:_once)?\s*['"]([^'"]+)['"]/ }
                ],
                // 🔥 NEW: Ignore patterns
                ignorePatterns: [
                    '**/tests/**',
                    '**/*Test.php'
                ],
                classPattern: /\b([A-Z][a-zA-Z0-9]*)\b/g,
                // 🔥 NEW: Regex patterns for symbol extraction from patches
                symbolPatterns: {
                    class: /class\s+([a-zA-Z_][a-zA-Z0-9_]*)/,
                    interface: /interface\s+([a-zA-Z_][a-zA-Z0-9_]*)/,
                    function: /function\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/,
                    const: /const\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*=/,
                    property: /(?:public|private|protected|var)\s+\$([a-zA-Z_][a-zA-Z0-9_]*)/,
                    blockEnd: /^\s*\}\s*$/
                },
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
                // 🔥 NEW: Asset patterns for templates
                assetPatterns: [
                    { type: 'template', regex: /template\.ParseFiles\s*\(\s*['"]([^'"]+)['"]/ }
                ],
                // 🔥 NEW: Ignore patterns
                ignorePatterns: [
                    '**/*_test.go'
                ],
                classPattern: /type\s+([A-Z][a-zA-Z0-9]*)/g,
                // 🔥 NEW: Regex patterns for symbol extraction from patches
                symbolPatterns: {
                    class: /type\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+(?:struct|interface)/,
                    function: /func\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/,
                    const: /const\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*=/,
                    blockEnd: /^\s*\}\s*$/
                },
                standardLibraries: ['fmt', 'os', 'io', 'net', 'http', 'context'],
                excludePatterns: [
                    '**/vendor/**',
                    '**/*_test.go',
                    '**/testdata/**'
                ]
            },
            rust: {
                extensions: ['.rs'],
                // 🔥 NEW: Barrel/Entry file names
                barrelFiles: ['mod.rs', 'lib.rs', 'main.rs'],
                importPatterns: [
                    /use\s+([a-zA-Z_][a-zA-Z0-9_:]*)/g
                ],
                // 🔥 NEW: Asset patterns for includes
                assetPatterns: [
                    { type: 'include', regex: /include_(?:str|bytes)!\s*\(\s*['"]([^'"]+)['"]\s*\)/ }
                ],
                // 🔥 NEW: Ignore patterns
                ignorePatterns: [
                    '**/*_test.rs'
                ],
                classPattern: /(?:struct|enum|trait)\s+([A-Z][a-zA-Z0-9]*)/g,
                // 🔥 NEW: Regex patterns for symbol extraction from patches
                symbolPatterns: {
                    class: /(?:struct|enum|trait)\s+([a-zA-Z_][a-zA-Z0-9_]*)/,
                    function: /fn\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/,
                    const: /const\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*:/,
                    blockEnd: /^\s*\}\s*$/
                },
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
                // 🔥 NEW: Asset patterns for Android layouts
                assetPatterns: [
                    { type: 'layout', regex: /R\.layout\.([a-zA-Z0-9_]+)/ }
                ],
                // 🔥 NEW: Ignore patterns
                ignorePatterns: [
                    '**/*Test.kt',
                    '**/Test*.kt'
                ],
                classPattern: /\b([A-Z][a-zA-Z0-9]*)\b/g,
                // 🔥 NEW: Regex patterns for symbol extraction from patches
                symbolPatterns: {
                    class: /(?:class|interface|object)\s+([a-zA-Z_][a-zA-Z0-9_]*)/,
                    function: /fun\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/,
                    const: /(?:val|const\s+val)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*=/,
                    blockEnd: /^\s*\}\s*$/
                },
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
                // 🔥 NEW: Asset patterns for Nibs/Storyboards
                assetPatterns: [
                    { type: 'nib', regex: /nibName:\s*['"]([^'"]+)['"]/ },
                    { type: 'storyboard', regex: /name:\s*['"]([^'"]+)['"]/ }
                ],
                // 🔥 NEW: Ignore patterns
                ignorePatterns: [
                    '**/*Tests.swift',
                    '**/*UITests.swift'
                ],
                classPattern: /\b([A-Z][a-zA-Z0-9]*)\b/g,
                // 🔥 NEW: Regex patterns for symbol extraction from patches
                symbolPatterns: {
                    class: /(?:class|struct|enum|protocol)\s+([a-zA-Z_][a-zA-Z0-9_]*)/,
                    function: /func\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/,
                    const: /let\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*=/,
                    blockEnd: /^\s*\}\s*$/
                },
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
                // 🔥 NEW: Asset patterns for Flutter assets
                assetPatterns: [
                    { type: 'asset', regex: /asset\s*\(\s*['"]([^'"]+)['"]/ },
                    { type: 'image', regex: /Image\.asset\s*\(\s*['"]([^'"]+)['"]/ }
                ],
                // 🔥 NEW: Ignore patterns
                ignorePatterns: [
                    '**/*_test.dart'
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
                // 🔥 NEW: Asset patterns for Rails views
                assetPatterns: [
                    { type: 'view', regex: /render\s+['"]([^'"]+)['"]/ },
                    { type: 'partial', regex: /render\s+partial:\s*['"]([^'"]+)['"]/ }
                ],
                // 🔥 NEW: Ignore patterns
                ignorePatterns: [
                    '**/spec/**',
                    '**/test/**',
                    '**/*_spec.rb',
                    '**/*_test.rb'
                ],
                classPattern: /class\s+([A-Z][a-zA-Z0-9]*)/g,
                standardLibraries: ['String', 'Integer', 'Array', 'Hash', 'File'],
                excludePatterns: [
                    '**/vendor/**',
                    '**/.bundle/**',
                    '**/spec/**',
                    '**/*_spec.rb'
                ]
            },
            // HTML Templates
            html: {
                extensions: ['.html'],
                importPatterns: [],
                assetPatterns: [],
                symbolPatterns: {},
                standardLibraries: [],
                excludePatterns: []
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
            aidaLogging('🔍 Starting Symbol Crawling analysis...');
            
            // Reset graph
            this.graph.clear();
            
            // Step 1: Find all source files
            const sourceFiles = await this.findSourceFiles();
            aidaLogging(`📁 Found ${sourceFiles.length} source files`);
            
            // Step 2: Process each file with throttling
            for (let i = 0; i < sourceFiles.length; i++) {
                const fileUri = sourceFiles[i];
                aidaLogging(`📝 Processing ${i + 1}/${sourceFiles.length}: ${path.basename(fileUri.fsPath)}`);
                
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
            '**/tests/**',
            '**/environments/**', // 🔥 Exclude environments
            '**/scripts/**'       // 🔥 Exclude scripts folder
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
            .filter(uri => uri.fsPath.startsWith(this.workspaceRoot))
            // 🔥 NEW: Exclude files in the root directory (same level as package.json)
            .filter(uri => {
                const fileDir = path.dirname(uri.fsPath);
                // Check if file is directly in workspace root
                // We compare normalized paths to be safe
                return path.normalize(fileDir) !== path.normalize(this.workspaceRoot);
            });
            
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
            
            // 1. Try VS Code Link Provider (High Accuracy for Imports)
            try {
                const links = await vscode.commands.executeCommand('vscode.executeLinkProvider', document.uri);
                if (links && links.length > 0) {
                    for (const link of links) {
                        if (!link.target) continue;
                        
                        const targetPath = link.target.fsPath;
                        
                        // Filter out external dependencies & self-references
                        if (this.isExternalDependency(targetPath) || targetPath === document.uri.fsPath) {
                            continue;
                        }

                        // Add to graph if it's in workspace
                        if (targetPath.startsWith(this.workspaceRoot)) {
                            const targetFile = this.getRelativePath(targetPath);
                            this.graph.get(sourceFile).add(targetFile);
                        }
                    }
                }
            } catch (e) {
                // Link provider failed, continue to regex
            }

            // 2. Process import patterns (Fallback & Complementary)
            for (const pattern of config.importPatterns) {
                let match;
                // Reset regex lastIndex for reuse
                pattern.lastIndex = 0;
                
                while ((match = pattern.exec(text)) !== null) {
                    // We no longer filter by isExternalImport here
                    // We let the LSP resolve it and check the final path
                    
                    await this.resolveAndAddDependency(document, text, match, sourceFile, 'import');
                    await this.sleep(5);
                }
            }
            
            // 3. Process class/type references (Symbol Crawling)
            if (config.classPattern) {
                let match;
                config.classPattern.lastIndex = 0;
                
                while ((match = config.classPattern.exec(text)) !== null) {
                    const symbol = match[1];
                    
                    // Skip already processed symbols
                    // We no longer filter by standardLibraries here
                    if (processedSymbols.has(symbol)) {
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
            // FIX: Point to the captured group (the path/symbol) instead of the start of the match
            // This ensures VS Code API receives the correct context
            let absoluteIndex = match.index;
            if (match[1]) {
                const offset = match[0].indexOf(match[1]);
                if (offset !== -1) {
                    absoluteIndex += offset;
                }
            }

            const line = text.substring(0, absoluteIndex).split('\n').length - 1;
            const character = absoluteIndex - text.lastIndexOf('\n', absoluteIndex) - 1;
            const position = new vscode.Position(line, character);
            
            // Use VS Code LSP to resolve actual file
            const targetFile = await this.resolveDefinition(document, position);
            if (targetFile) {
                this.graph.get(sourceFile).add(targetFile);
                aidaLogging(`🔗 ${sourceFile} -> ${targetFile} (${type})`);
            }
        } catch (error) {
            // Silent fail - LSP might not be available for this symbol
        }
    }

    /**
     * The "Magic" function - calls VS Code API to find where a symbol is defined
     * @param {vscode.TextDocument} document 
     * @param {vscode.Position} position 
     * @param {number} depth - Recursion depth for barrel files
     * @returns {string|null} - Relative path to target file or null
     */
    async resolveDefinition(document, position, depth = 0) {
        // Prevent infinite recursion
        if (depth > 3) return null;

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
                    // Check if it's a barrel file (index.ts/js)
                    const fileName = path.basename(targetPath).toLowerCase();
                    if (fileName.startsWith('index.') && (fileName.endsWith('.ts') || fileName.endsWith('.js'))) {
                        // It's a barrel file! We need to dig deeper.
                        // But we can't just "dig" without knowing WHAT symbol we are looking for.
                        // Since we don't have the symbol name easily here, we accept the barrel file as a dependency.
                        // The consumer -> barrel link is valid.
                        // Ideally, we should also link barrel -> implementation, which happens when we scan the barrel file itself.
                        
                        // However, if the user wants "Consumer -> Implementation" direct link, we would need to parse the barrel.
                        // For now, let's return the barrel file. The graph will be Consumer -> Barrel -> Implementation.
                        // This is technically correct for a dependency graph.
                        return this.getRelativePath(targetPath);
                    }

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

    // 🔥 ===== BARREL RESOLVER INTEGRATION =====
    // Helper methods to access BarrelResolver functionality

    /**
     * Resolve barrel references recursively
     * @returns {Promise<{references: Location[], barrelChain: Array}>}
     */
    async resolveBarrelReferences(symbolUri, symbolPosition, symbolName, visitedBarrels = new Set(), currentLevel = 0) {
        return await this.barrelResolver.resolveBarrelReferences(
            symbolUri, symbolPosition, symbolName, visitedBarrels, currentLevel
        );
    }

    /**
     * Parse barrel export symbol
     * @returns {Promise<{name: string, position: Position, isWildcard: boolean}|null>}
     */
    async getBarrelExportSymbol(barrelLocation, originalSymbolName = null) {
        return await this.barrelResolver.getBarrelExportSymbolImproved(barrelLocation, originalSymbolName);
    }

    /**
     * Find imports of barrel file (for wildcard exports)
     * @returns {Promise<Location[]>}
     */
    async findImportsOfBarrelFile(barrelUri, symbolName, currentLevel = 0) {
        return await this.barrelResolver.findImportsOfBarrelFileImproved(barrelUri, symbolName, currentLevel);
    }

    /**
     * Check if location is a barrel export
     * @returns {Promise<boolean>}
     */
    async isBarrelExport(location) {
        return await this.barrelResolver.isBarrelExport(location);
    }
}

module.exports = {
    VSCodeApiDependencyAnalyzer
};
