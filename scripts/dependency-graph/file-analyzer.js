const fs = require('fs');
const path = require('path');

/**
 * File analyzer for TypeScript/Angular projects
 * Scans and parses files to extract dependency information
 */
class FileAnalyzer {
    constructor(projectRoot) {
        this.projectRoot = projectRoot;
        this.supportedExtensions = ['.ts', '.js', '.html', '.scss', '.css', '.jsx', '.tsx', '.cs', '.cshtml', '.razor'];
        
        // Comprehensive ignore patterns - skip all non-source files
        this.excludePatterns = [
            // Dependencies & Libraries
            'node_modules',
            'bower_components',
            'jspm_packages',
            'packages',
            'vendor',
            
            // Build outputs
            'dist',
            'build',
            'out',
            'out-tsc',
            '.next',
            '.nuxt',
            'coverage',
            'tmp',
            'temp',
            
            // Bundled & Minified files
            '*.min.js',
            '*.min.css',
            '*.bundle.js',
            '*.bundle.css',
            '*.chunk.js',
            '*-compiled.js',
            
            // Testing
            'e2e',
            '*.spec.ts',
            '*.spec.js',
            '*.spec.tsx',
            '*.spec.jsx',
            '*.test.ts',
            '*.test.js',
            '*.test.tsx',
            '*.test.jsx',
            '__tests__',
            '__mocks__',
            
            // Version Control
            '.git',
            '.svn',
            '.hg',
            
            // IDE & Config
            '.vscode',
            '.idea',
            '.vs',
            '.angular',
            
            // Logs & Cache
            'logs',
            '*.log',
            '.cache',
            '.parcel-cache',
            
            // C# specific
            'bin',
            'obj',
            '*.Designer.cs',
            '*.designer.cs',
            
            // Documentation
            'docs',
            'documentation'
        ];
    }

    /**
     * Scan project for relevant files
     * @returns {Array} - Array of file paths
     */
    scanFiles() {
        const files = [];
        this.scanDirectory(this.projectRoot, files);
        
        return files.filter(file => {
            // Filter by extension
            const ext = path.extname(file);
            if (!this.supportedExtensions.includes(ext)) return false;
            
            // Exclude patterns
            const relativePath = path.relative(this.projectRoot, file);
            return !this.shouldExclude(relativePath);
        });
    }

    /**
     * Recursively scan directory
     * @param {string} dir - Directory to scan
     * @param {Array} files - Array to collect files
     */
    scanDirectory(dir, files) {
        try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            
            entries.forEach(entry => {
                const fullPath = path.join(dir, entry.name);
                
                if (entry.isDirectory()) {
                    const relativePath = path.relative(this.projectRoot, fullPath);
                    if (!this.shouldExclude(relativePath)) {
                        this.scanDirectory(fullPath, files);
                    }
                } else if (entry.isFile()) {
                    files.push(fullPath);
                }
            });
        } catch (error) {
            console.warn(`⚠️ Cannot read directory: ${dir}`);
        }
    }

    /**
     * Check if path should be excluded
     * @param {string} relativePath - Relative path to check
     * @returns {boolean} - True if should be excluded
     */
    shouldExclude(relativePath) {
        return this.excludePatterns.some(pattern => {
            if (pattern.includes('*')) {
                // Simple glob pattern matching
                const regex = new RegExp(pattern.replace(/\*/g, '.*'));
                return regex.test(relativePath);
            }
            return relativePath.includes(pattern);
        });
    }

    /**
     * Parse multiple files
     * @param {Array} filePaths - Array of file paths to parse
     * @returns {Array} - Array of parsed file objects
     */
    parseFiles(filePaths) {
        return filePaths.map(filePath => {
            try {
                return this.parseFile(filePath);
            } catch (error) {
                console.warn(`⚠️ Failed to parse ${filePath}: ${error.message}`);
                return null;
            }
        }).filter(Boolean);
    }

    /**
     * Parse a single file
     * @param {string} filePath - Path to the file
     * @returns {Object} - Parsed file object
     */
    parseFile(filePath) {
        const content = fs.readFileSync(filePath, 'utf8');
        const relativePath = path.relative(this.projectRoot, filePath);
        const extension = path.extname(filePath);
        
        const fileInfo = {
            filePath,
            relativePath,
            extension,
            content,
            dependencies: [],
            exports: [],
            metadata: {}
        };

        // Parse based on file type
        switch (extension) {
            case '.ts':
                this.parseTypeScriptFile(fileInfo);
                break;
            case '.js':
                this.parseJavaScriptFile(fileInfo);
                break;
            case '.html':
                this.parseHTMLTemplate(fileInfo);
                break;
            case '.scss':
            case '.css':
                this.parseStylesheet(fileInfo);
                break;
        }

        return fileInfo;
    }

    /**
     * Parse TypeScript file
     * @param {Object} fileInfo - File information object
     */
    parseTypeScriptFile(fileInfo) {
        const { content } = fileInfo;

        // Extract imports
        fileInfo.dependencies = this.extractImports(content);
        
        // Extract exports
        fileInfo.exports = this.extractExports(content);
        
        // Extract Angular-specific metadata
        fileInfo.metadata = {
            ...this.extractAngularMetadata(content),
            ...this.extractTypeScriptMetadata(content)
        };
    }

    /**
     * Parse JavaScript file
     * @param {Object} fileInfo - File information object
     */
    parseJavaScriptFile(fileInfo) {
        const { content } = fileInfo;
        
        fileInfo.dependencies = [
            ...this.extractRequires(content),
            ...this.extractImports(content)
        ];
        
        fileInfo.exports = this.extractExports(content);
        fileInfo.metadata = this.extractJavaScriptMetadata(content);
    }

    /**
     * Parse HTML template
     * @param {Object} fileInfo - File information object
     */
    parseHTMLTemplate(fileInfo) {
        const { content } = fileInfo;
        
        // Extract component selectors and dependencies
        fileInfo.dependencies = this.extractHTMLDependencies(content);
        fileInfo.metadata = {
            componentSelectors: this.extractComponentSelectors(content),
            templateBindings: this.extractTemplateBindings(content)
        };
    }

    /**
     * Parse stylesheet
     * @param {Object} fileInfo - File information object
     */
    parseStylesheet(fileInfo) {
        const { content } = fileInfo;
        
        fileInfo.dependencies = this.extractStyleImports(content);
        fileInfo.metadata = {
            selectors: this.extractCSSSelectors(content),
            variables: this.extractSCSSVariables(content)
        };
    }

    /**
     * Extract import statements
     * @param {string} content - File content
     * @returns {Array} - Array of import objects
     */
    extractImports(content) {
        const imports = [];
        
        // ES6 imports
        const es6ImportRegex = /import\s+(?:{[^}]+}|\*\s+as\s+\w+|\w+)?\s*(?:,\s*(?:{[^}]+}|\*\s+as\s+\w+|\w+))?\s*from\s+['"`]([^'"`]+)['"`]/g;
        let match;
        
        while ((match = es6ImportRegex.exec(content)) !== null) {
            imports.push({
                type: 'import',
                source: match[1],
                statement: match[0],
                line: this.getLineNumber(content, match.index)
            });
        }
        
        // Dynamic imports
        const dynamicImportRegex = /import\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
        while ((match = dynamicImportRegex.exec(content)) !== null) {
            imports.push({
                type: 'dynamic-import',
                source: match[1],
                statement: match[0],
                line: this.getLineNumber(content, match.index)
            });
        }
        
        return imports;
    }

    /**
     * Extract require statements
     * @param {string} content - File content
     * @returns {Array} - Array of require objects
     */
    extractRequires(content) {
        const requires = [];
        const requireRegex = /require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
        let match;
        
        while ((match = requireRegex.exec(content)) !== null) {
            requires.push({
                type: 'require',
                source: match[1],
                statement: match[0],
                line: this.getLineNumber(content, match.index)
            });
        }
        
        return requires;
    }

    /**
     * Extract export statements
     * @param {string} content - File content
     * @returns {Array} - Array of export objects
     */
    extractExports(content) {
        const exports = [];
        
        // Named exports
        const namedExportRegex = /export\s+(?:const|let|var|function|class|interface|type|enum)\s+(\w+)/g;
        let match;
        
        while ((match = namedExportRegex.exec(content)) !== null) {
            exports.push({
                type: 'named',
                name: match[1],
                statement: match[0],
                line: this.getLineNumber(content, match.index)
            });
        }
        
        // Default exports
        const defaultExportRegex = /export\s+default\s+(?:class|function|interface)?\s*(\w+)?/g;
        while ((match = defaultExportRegex.exec(content)) !== null) {
            exports.push({
                type: 'default',
                name: match[1] || 'default',
                statement: match[0],
                line: this.getLineNumber(content, match.index)
            });
        }
        
        // Export from
        const exportFromRegex = /export\s*{[^}]+}\s*from\s+['"`]([^'"`]+)['"`]/g;
        while ((match = exportFromRegex.exec(content)) !== null) {
            exports.push({
                type: 'export-from',
                source: match[1],
                statement: match[0],
                line: this.getLineNumber(content, match.index)
            });
        }
        
        return exports;
    }

    /**
     * Extract Angular-specific metadata
     * @param {string} content - File content
     * @returns {Object} - Angular metadata
     */
    extractAngularMetadata(content) {
        const metadata = {};
        
        // Component decorator
        const componentMatch = content.match(/@Component\s*\(\s*{([^}]+)}\s*\)/);
        if (componentMatch) {
            metadata.isComponent = true;
            metadata.componentConfig = this.parseDecoratorConfig(componentMatch[1]);
        }
        
        // Service decorator
        const serviceMatch = content.match(/@Injectable\s*\(\s*{([^}]*)}\s*\)/);
        if (serviceMatch) {
            metadata.isService = true;
            metadata.serviceConfig = this.parseDecoratorConfig(serviceMatch[1]);
        }
        
        // Module decorator
        const moduleMatch = content.match(/@NgModule\s*\(\s*{([^}]+)}\s*\)/);
        if (moduleMatch) {
            metadata.isModule = true;
            metadata.moduleConfig = this.parseDecoratorConfig(moduleMatch[1]);
        }
        
        // Directive decorator
        const directiveMatch = content.match(/@Directive\s*\(\s*{([^}]+)}\s*\)/);
        if (directiveMatch) {
            metadata.isDirective = true;
            metadata.directiveConfig = this.parseDecoratorConfig(directiveMatch[1]);
        }
        
        // Pipe decorator
        const pipeMatch = content.match(/@Pipe\s*\(\s*{([^}]+)}\s*\)/);
        if (pipeMatch) {
            metadata.isPipe = true;
            metadata.pipeConfig = this.parseDecoratorConfig(pipeMatch[1]);
        }
        
        return metadata;
    }

    /**
     * Extract TypeScript-specific metadata
     * @param {string} content - File content
     * @returns {Object} - TypeScript metadata
     */
    extractTypeScriptMetadata(content) {
        const metadata = {};
        
        // Interfaces
        const interfaces = content.match(/interface\s+(\w+)/g);
        if (interfaces) {
            metadata.interfaces = interfaces.map(i => i.replace('interface ', ''));
        }
        
        // Classes
        const classes = content.match(/class\s+(\w+)/g);
        if (classes) {
            metadata.classes = classes.map(c => c.replace('class ', ''));
        }
        
        // Angular-specific entities
        metadata.angularEntities = this.extractAngularEntities(content);
        
        // Enums
        const enums = content.match(/enum\s+(\w+)/g);
        if (enums) {
            metadata.enums = enums.map(e => e.replace('enum ', ''));
        }
        
        // Types
        const types = content.match(/type\s+(\w+)/g);
        if (types) {
            metadata.types = types.map(t => t.replace('type ', ''));
        }
        
        return metadata;
    }

    /**
     * Extract Angular-specific entities (Components, Services, etc.)
     * @param {string} content - File content
     * @returns {Object} - Angular entities
     */
    extractAngularEntities(content) {
        const entities = {
            components: [],
            services: [],
            directives: [],
            pipes: [],
            modules: [],
            guards: [],
            interceptors: [],
            models: [],
            interfaces: []
        };

        // Find classes and their decorators
        const classRegex = /(@\w+\([^)]*\))?\s*export\s+class\s+(\w+)/g;
        let match;
        while ((match = classRegex.exec(content)) !== null) {
            const decorator = match[1];
            const className = match[2];
            
            if (decorator) {
                if (decorator.includes('@Component')) entities.components.push(className);
                else if (decorator.includes('@Injectable')) entities.services.push(className);
                else if (decorator.includes('@Directive')) entities.directives.push(className);
                else if (decorator.includes('@Pipe')) entities.pipes.push(className);
                else if (decorator.includes('@NgModule')) entities.modules.push(className);
            } else {
                // Classify by naming convention
                if (className.endsWith('Component')) entities.components.push(className);
                else if (className.endsWith('Service')) entities.services.push(className);
                else if (className.endsWith('Guard')) entities.guards.push(className);
                else if (className.endsWith('Interceptor')) entities.interceptors.push(className);
                else if (className.endsWith('Module')) entities.modules.push(className);
                else if (className.endsWith('Model')) entities.models.push(className);
            }
        }

        // Extract interfaces separately
        const interfaceRegex = /export\s+interface\s+(\w+)/g;
        while ((match = interfaceRegex.exec(content)) !== null) {
            entities.interfaces.push(match[1]);
        }

        return entities;
    }

    /**
     * Extract JavaScript metadata
     * @param {string} content - File content
     * @returns {Object} - JavaScript metadata
     */
    extractJavaScriptMetadata(content) {
        const metadata = {};
        
        // Functions
        const functions = content.match(/function\s+(\w+)/g);
        if (functions) {
            metadata.functions = functions.map(f => f.replace('function ', ''));
        }
        
        return metadata;
    }

    /**
     * Extract HTML template dependencies
     * @param {string} content - HTML content
     * @returns {Array} - Array of dependencies
     */
    extractHTMLDependencies(content) {
        const dependencies = [];
        
        // Custom component selectors (Angular)
        const componentRegex = /<([a-z][a-z0-9-]*)/g;
        let match;
        
        while ((match = componentRegex.exec(content)) !== null) {
            if (!this.isStandardHTMLTag(match[1])) {
                dependencies.push({
                    type: 'component',
                    name: match[1],
                    line: this.getLineNumber(content, match.index)
                });
            }
        }
        
        return dependencies;
    }

    /**
     * Extract component selectors from HTML
     * @param {string} content - HTML content
     * @returns {Array} - Array of selectors
     */
    extractComponentSelectors(content) {
        const selectors = [];
        const selectorRegex = /<([a-z][a-z0-9-]*)/g;
        let match;
        
        while ((match = selectorRegex.exec(content)) !== null) {
            if (!this.isStandardHTMLTag(match[1])) {
                selectors.push(match[1]);
            }
        }
        
        return [...new Set(selectors)]; // Remove duplicates
    }

    /**
     * Extract template bindings
     * @param {string} content - HTML content
     * @returns {Array} - Array of bindings
     */
    extractTemplateBindings(content) {
        const bindings = [];
        
        // Property bindings
        const propertyBindings = content.match(/\[([^\]]+)\]/g);
        if (propertyBindings) {
            bindings.push(...propertyBindings.map(b => ({ type: 'property', binding: b })));
        }
        
        // Event bindings
        const eventBindings = content.match(/\(([^)]+)\)/g);
        if (eventBindings) {
            bindings.push(...eventBindings.map(b => ({ type: 'event', binding: b })));
        }
        
        // Two-way bindings
        const twoWayBindings = content.match(/\[\(([^)]+)\)\]/g);
        if (twoWayBindings) {
            bindings.push(...twoWayBindings.map(b => ({ type: 'two-way', binding: b })));
        }
        
        return bindings;
    }

    /**
     * Extract style imports
     * @param {string} content - CSS/SCSS content
     * @returns {Array} - Array of style imports
     */
    extractStyleImports(content) {
        const imports = [];
        
        // @import statements
        const importRegex = /@import\s+['"`]([^'"`]+)['"`]/g;
        let match;
        
        while ((match = importRegex.exec(content)) !== null) {
            imports.push({
                type: 'style-import',
                source: match[1],
                statement: match[0],
                line: this.getLineNumber(content, match.index)
            });
        }
        
        return imports;
    }

    /**
     * Extract CSS selectors
     * @param {string} content - CSS content
     * @returns {Array} - Array of selectors
     */
    extractCSSSelectors(content) {
        const selectors = [];
        const selectorRegex = /([.#]?[a-zA-Z][\w-]*)\s*{/g;
        let match;
        
        while ((match = selectorRegex.exec(content)) !== null) {
            selectors.push(match[1]);
        }
        
        return selectors;
    }

    /**
     * Extract SCSS variables
     * @param {string} content - SCSS content
     * @returns {Array} - Array of variables
     */
    extractSCSSVariables(content) {
        const variables = [];
        const variableRegex = /\$([a-zA-Z][\w-]*)\s*:/g;
        let match;
        
        while ((match = variableRegex.exec(content)) !== null) {
            variables.push(`$${match[1]}`);
        }
        
        return variables;
    }

    /**
     * Parse decorator configuration
     * @param {string} configStr - Configuration string
     * @returns {Object} - Parsed configuration
     */
    parseDecoratorConfig(configStr) {
        try {
            // Simple key-value extraction
            const config = {};
            const keyValueRegex = /(\w+)\s*:\s*(['"`][^'"`]*['"`]|\[[^\]]*\]|{[^}]*}|\w+)/g;
            let match;
            
            while ((match = keyValueRegex.exec(configStr)) !== null) {
                config[match[1]] = match[2];
            }
            
            return config;
        } catch (error) {
            return {};
        }
    }

    /**
     * Get line number from content index
     * @param {string} content - File content
     * @param {number} index - Character index
     * @returns {number} - Line number
     */
    getLineNumber(content, index) {
        return content.substring(0, index).split('\n').length;
    }

    /**
     * Check if tag is standard HTML
     * @param {string} tag - Tag name
     * @returns {boolean} - True if standard HTML tag
     */
    isStandardHTMLTag(tag) {
        const standardTags = [
            'div', 'span', 'p', 'a', 'img', 'ul', 'li', 'ol', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            'form', 'input', 'button', 'select', 'option', 'textarea', 'label', 'table', 'tr', 'td',
            'th', 'thead', 'tbody', 'nav', 'header', 'footer', 'section', 'article', 'aside', 'main'
        ];
        
        return standardTags.includes(tag.toLowerCase());
    }
}

module.exports = FileAnalyzer;