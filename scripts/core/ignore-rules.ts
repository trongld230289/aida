/**
 * Common ignore rules for AIDA extension
 * Shared between PR Review and Dependency Analysis
 */

const commonIgnores: readonly string[] = [
    '**/.vscode/**',
    '**/.git/**',
    '**/.vs/**',
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/out-tsc/**',
    '**/coverage/**',
    '**/test/**',
    '**/tests/**',
    '**/environments/**',
    '**/scripts/**',
    '**/*.map',
    '**/*.lock',
    '**/*.log'
];

export interface ILanguageIgnores {
    [language: string]: string[];
}

const languageIgnores: ILanguageIgnores = {
    csharp: [
        '**/bin/**',
        '**/obj/**',
        '**/packages/**',
        '**/.vs/**',
        '**/Debug/**',
        '**/Release/**',
        '**/Migrations/**',
        '**/*.AssemblyInfo.cs',
        '**/*.Designer.cs'
    ],
    typescript: [
        '**/*.spec.ts',
        '**/*.test.ts',
        '**/*.d.ts'
    ],
    python: [
        '**/__pycache__/**',
        '**/venv/**',
        '**/env/**',
        '**/.venv/**',
        '**/*.pyc'
    ],
    java: [
        '**/*Test.java',
        '**/Test*.java',
        '**/*.spec.java'
    ]
};

const extensionIgnores: readonly string[] = [
    '.json', '.xml', '.yaml', '.yml',
    '.md', '.txt', '.lock', '.map',
    '.config', '.ini', '.env',
    '.css', '.scss', '.sass', '.less',
    '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico'
];

/**
 * Check if a file path matches any of the ignore patterns
 */
function isIgnored(filePath: string | null | undefined, patterns: readonly string[] | null | undefined): boolean {
    if (!filePath || !patterns) return false;

    const normalizedPath = filePath.replace(/\\/g, '/');

    return patterns.some(pattern => {
        // Handle **/*.ext
        if (pattern.startsWith('**/*') && pattern.lastIndexOf('/') === 3) {
            const ext = pattern.substring(4);
            return normalizedPath.endsWith(ext);
        }

        // Handle **/folder/**
        if (pattern.startsWith('**/') && pattern.endsWith('/**')) {
            const folder = pattern.substring(3, pattern.length - 3);
            return normalizedPath.includes(`/${folder}/`);
        }

        // Handle **/folder/*.ext
        if (pattern.startsWith('**/') && pattern.includes('/*. ')) {
            const parts = pattern.split('/');
            const folder = parts[1];
            const ext = parts[2]!.substring(1);
            return normalizedPath.includes(`/${folder}/`) && normalizedPath.endsWith(ext);
        }

        // Fallback to simple includes for other cases
        const simplePattern = pattern.replace(/\*\*/g, '').replace(/\*/g, '');
        return normalizedPath.includes(simplePattern);
    });
}

export { commonIgnores, languageIgnores, extensionIgnores, isIgnored };
