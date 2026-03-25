/**
 * Centralized Language Support Configuration
 * Single source of truth for all AIDA supported languages
 * Used by: Review Templates, Dependency Graph, Environment Checker
 */

const SUPPORTED_LANGUAGES = {
    typescript: {
        name: 'TypeScript',
        templateFolder: 'typescript',
        filePatterns: ['**/*.ts', '**/*.tsx', 'tsconfig.json'],
        // TypeScript has built-in LSP in VS Code
        requiresExtension: false
    },
    javascript: {
        name: 'JavaScript',
        templateFolder: 'javascript',
        filePatterns: ['**/*.js', '**/*.jsx', 'package.json'],
        // JavaScript has built-in LSP in VS Code
        requiresExtension: false
    },
    nodejs: {
        name: 'Node.js',
        templateFolder: 'nodejs',
        filePatterns: ['**/server.js', '**/app.js', 'package.json'],
        // Node.js uses JavaScript LSP
        requiresExtension: false
    },
    react: {
        name: 'React',
        templateFolder: 'react',
        filePatterns: ['**/*.jsx', '**/*.tsx'],
        // React uses JavaScript/TypeScript LSP
        requiresExtension: false
    },
    angular: {
        name: 'Angular',
        templateFolder: 'angular',
        filePatterns: ['**/angular.json', '**/*.component.ts'],
        // Angular requires Language Service for template parsing
        requiresExtension: true,
        requiredExtensions: [
            { id: 'angular.ng-template', name: 'Angular Language Service' }
        ],
        message: 'Angular project detected. Please install the "Angular Language Service" extension for accurate template dependency analysis.'
    },
    vue: {
        name: 'Vue',
        templateFolder: 'vue',
        filePatterns: ['**/*.vue'],
        // Vue requires Volar for template and script analysis
        requiresExtension: true,
        requiredExtensions: [
            { id: 'Vue.volar', name: 'Vue - Official (Volar)' }
        ],
        message: 'Vue project detected. Please install the "Vue - Official (Volar)" extension for accurate dependency analysis.'
    },
    python: {
        name: 'Python',
        templateFolder: 'python',
        filePatterns: ['**/*.py', 'requirements.txt', 'Pipfile'],
        requiresExtension: true,
        requiredExtensions: [
            { id: 'ms-python.python', name: 'Python' }
        ],
        message: 'Python project detected. Please install the "Python" extension for accurate dependency analysis.'
    },
    csharp: {
        name: 'C#',
        templateFolder: 'csharp',
        filePatterns: ['**/*.cs', '**/*.csproj', '**/*.sln'],
        requiresExtension: true,
        requiredExtensions: [
            { id: 'ms-dotnettools.csdevkit', name: 'C# Dev Kit' },
            { id: 'ms-dotnettools.csharp', name: 'C# (Base)' }
        ],
        message: 'C# project detected. For accurate dependency scanning, please install the "C# Dev Kit" or "C#" extension.'
    },
    go: {
        name: 'Go',
        templateFolder: 'go',
        filePatterns: ['**/*.go', 'go.mod', 'go.sum'],
        requiresExtension: true,
        requiredExtensions: [
            { id: 'golang.go', name: 'Go' }
        ],
        message: 'Go project detected. Please install the "Go" extension for accurate dependency analysis.'
    }
};

/**
 * Get list of all supported language keys
 * @returns {string[]} Array of language keys
 */
function getSupportedLanguageKeys() {
    return Object.keys(SUPPORTED_LANGUAGES);
}

/**
 * Get languages that require VS Code extensions
 * @returns {object[]} Array of language configs requiring extensions
 */
function getLanguagesRequiringExtensions() {
    return (Object.entries(SUPPORTED_LANGUAGES) as [string, any][])
        .filter(([_key, config]) => config.requiresExtension)
        .map(([key, config]) => ({ key, ...config }));
}

/**
 * Get language config by key
 * @param {string} key - Language key
 * @returns {object|null} Language config or null
 */
function getLanguageConfig(key: string) {
    return (SUPPORTED_LANGUAGES as any)[key] || null;
}

/**
 * Get all template folder names
 * @returns {string[]} Array of template folder names
 */
function getTemplateFolderNames() {
    return (Object.values(SUPPORTED_LANGUAGES) as any[]).map(config => config.templateFolder);
}

// ES exports
export { SUPPORTED_LANGUAGES, getSupportedLanguageKeys, getLanguagesRequiringExtensions, getLanguageConfig, getTemplateFolderNames };
