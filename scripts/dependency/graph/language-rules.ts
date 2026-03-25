/**
 * @module language-rules
 * @description Language configuration rules for dependency analysis.
 * Defines regex patterns and rules for different programming languages.
 * Migrated to TypeScript in Phase 3.4. Fixed duplicate `csharp` key.
 */

import { languageIgnores } from '../../core/ignore-rules';

// ── Interfaces ──────────────────────────────────────────────────

export interface IAssetPattern {
    type: string;
    regex: RegExp;
}

export interface ISymbolPatterns {
    [key: string]: RegExp;
}

export interface ILanguageRule {
    extensions: string[];
    barrelFiles?: string[];
    importPatterns: RegExp[];
    assetPatterns: IAssetPattern[];
    ignorePatterns?: string[];
    classPattern?: RegExp;
    symbolPatterns?: ISymbolPatterns;
    standardLibraries: string[];
    excludePatterns: string[];
}

export interface ILanguageConfig {
    [language: string]: ILanguageRule;
}

// ── Configuration ───────────────────────────────────────────────

const languageConfig: ILanguageConfig = {
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
            // '**/*.module.ts', // 🔥 ENABLED: Angular Modules are critical for dependency graph
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
            '**/*.min.js',
            ...(languageIgnores.typescript ?? [])
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
            '**/dist/**',
            '**/build/**',
            ...(languageIgnores.python ?? [])
        ]
    },
    csharp: {
        extensions: ['.cs'],
        // Barrel/Entry file names
        barrelFiles: [],
        importPatterns: [
            /using\s+([a-zA-Z_][a-zA-Z0-9_.]*);/g,
            // Generic patterns - work with ANY framework (MediatR, custom handlers, etc.)
            /\.\w+\s*\(\s*([a-z][a-zA-Z0-9_]*)\s*[,)]/g,
            /<\s*([A-Z][a-zA-Z0-9_]*)\s*>/g,
            /public\s+\w+\s*\(\s*I?([A-Z][a-zA-Z0-9_]*)\s+/g,
            /new\s+([A-Z][a-zA-Z0-9_]*)\s*[(<]/g,
            /\[\s*From\w+\]\s*([A-Z][a-zA-Z0-9_]*)\s+/g,
            // Base class inheritance
            /:\s*([A-Z][a-zA-Z0-9_]*)\s*(?:\{|,)/g,
            // Field/Property declarations
            /(?:private|protected|public|internal)\s+I?([A-Z][a-zA-Z0-9_]*)\s+(?:_?[a-z][a-zA-Z0-9_]*)\s*[;{=]/g,
            // Property access patterns
            /(?:this\.|_)?([A-Z][a-zA-Z0-9_]*)\s*\.\s*\w+\s*\(/g
        ],
        // Asset patterns for Views/Layouts (merged from both blocks)
        assetPatterns: [
            { type: 'view', regex: /View\s*\(\s*['"]([^'"]+)['"]/ },
            { type: 'view', regex: /PartialView\s*\(\s*['"]([^'"]+)['"]/ },
            { type: 'layout', regex: /Layout\s*=\s*['"]([^'"]+)['"]/ }
        ],
        // Ignore patterns (merged)
        ignorePatterns: [
            '**/*Test.cs',
            '**/Test*.cs',
            '**/*.Test.cs',
            '**/*.Tests.cs',
            '**/*.Designer.cs',
            '**/*.AssemblyInfo.cs',
            '**/Migrations/**'
        ],
        classPattern: /\b([A-Z][a-zA-Z0-9]*)\b/g,
        // Regex patterns for symbol extraction from patches
        symbolPatterns: {
            class: /(?:class|interface|enum|struct)\s+([a-zA-Z_][a-zA-Z0-9_]*)/,
            function: /(?:public|private|protected|internal)?\s*(?:static)?\s*(?:async)?\s*\w+\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/,
            property: /(?:public|private|protected|internal)?\s*(?:static)?\s*\w+\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\{\s*get/,
            blockEnd: /^\s*\}\s*$/
        },
        standardLibraries: ['System', 'Microsoft', 'String', 'Int32', 'Boolean', 'Object', 'Void', 'Task',
            'IEnumerable', 'List', 'Dictionary', 'HttpClient', 'JsonSerializer', 'DateTime',
            'Guid', 'Exception', 'StringBuilder', 'Console', 'Math', 'Map', 'Set'],
        excludePatterns: [
            '**/bin/**',
            '**/obj/**',
            '**/packages/**',
            '**/.vs/**',
            '**/Debug/**',
            '**/Release/**',
            '**/Migrations/**',
            '**/*.AssemblyInfo.cs',
            '**/*.Designer.cs',
            ...(languageIgnores.csharp ?? [])
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

// ── Dual exports ────────────────────────────────────────────────

export { languageConfig };
