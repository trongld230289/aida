/**
 * Common ignore rules for AIDA extension
 * Shared between PR Review and Dependency Analysis
 */

const commonIgnores = [
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

const languageIgnores = {
    csharp: [
        '**/bin/**',
        '**/obj/**',
        '**/packages/**',
        '**/.vs/**',
        '**/Debug/**',
        '**/Release/**',
        '**/*.AssemblyInfo.cs',
        '**/*.Designer.cs',
        '**/Migrations/*.Designer.cs' // Specific for Migration Designer
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

const extensionIgnores = [
    '.json', '.xml', '.yaml', '.yml',
    '.md', '.txt', '.lock', '.map',
    '.config', '.ini', '.env',
    '.css', '.scss', '.sass', '.less',
    '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico'
];

/**
 * Check if a file path matches any of the ignore patterns
 * @param {string} filePath - The file path to check
 * @param {string[]} patterns - List of glob patterns
 * @returns {boolean} - True if matched
 */
function isIgnored(filePath, patterns) {
    if (!filePath || !patterns) return false;

    // Normalize path separators
    const normalizedPath = filePath.replace(/\\/g, '/');

    return patterns.some(pattern => {
        // Handle **/*.ext
        if (pattern.startsWith('**/*') && pattern.lastIndexOf('/') === 3) {
            const ext = pattern.substring(4); // .ext
            return normalizedPath.endsWith(ext);
        }

        // Handle **/folder/**
        if (pattern.startsWith('**/') && pattern.endsWith('/**')) {
            const folder = pattern.substring(3, pattern.length - 3);
            return normalizedPath.includes(`/${folder}/`);
        }

        // Handle **/folder/*.ext
        if (pattern.startsWith('**/') && pattern.includes('/*. ')) {
            // Simple check for folder presence and extension
            // This is a bit loose but works for common cases
            const parts = pattern.split('/');
            const folder = parts[1];
            const ext = parts[2].substring(1);
            return normalizedPath.includes(`/${folder}/`) && normalizedPath.endsWith(ext);
        }

        // Fallback to simple includes for other cases
        const simplePattern = pattern.replace(/\*\*/g, '').replace(/\*/g, '');
        return normalizedPath.includes(simplePattern);
    });
}

module.exports = {
    commonIgnores,
    languageIgnores,
    extensionIgnores,
    isIgnored
};
