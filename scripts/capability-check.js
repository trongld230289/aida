const vscode = require('vscode');
const { SUPPORTED_LANGUAGES } = require('./language-support-config');

/**
 * Detect languages used in the workspace based on file patterns.
 * @param {string} workspaceRoot
 * @returns {Promise<string[]>} - List of detected language keys.
 */
async function detectProjectLanguages(workspaceRoot) {
    const detectedLanguages = new Set();
    
    for (const [key, config] of Object.entries(SUPPORTED_LANGUAGES)) {
        // Skip if already detected
        if (detectedLanguages.has(key)) continue;

        // Check file patterns
        if (config.filePatterns) {
            for (const pattern of config.filePatterns) {
                // Use findFiles to check for existence of files matching the pattern
                // Limit to 1 result for performance
                const files = await vscode.workspace.findFiles(new vscode.RelativePattern(workspaceRoot, pattern), '**/node_modules/**', 1);
                if (files.length > 0) {
                    detectedLanguages.add(key);
                    break;
                }
            }
        }
    }
    
    return Array.from(detectedLanguages);
}

/**
 * Check if there is any installed extension that supports the given language ID.
 * @param {string} languageId 
 * @returns {boolean}
 */
function hasLanguageCapability(languageId) {
    return vscode.extensions.all.some(ext => {
        const languages = ext.packageJSON.contributes?.languages;
        if (Array.isArray(languages)) {
            return languages.some(lang => lang.id === languageId);
        }
        return false;
    });
}

/**
 * Check environment capabilities and return missing requirements.
 * @param {string} workspaceRoot 
 * @returns {Promise<object[]>} - Array of missing language support info.
 */
async function checkEnvironmentCapabilities(workspaceRoot) {
    const detectedLanguages = await detectProjectLanguages(workspaceRoot);
    const missingCapabilities = [];

    for (const langKey of detectedLanguages) {
        const config = SUPPORTED_LANGUAGES[langKey];
        
        // If language requires extension support
        if (config.requiresExtension) {
            // Dynamic Capability Check
            // We use the key as the language ID to check (e.g. 'python', 'go', 'csharp', 'vue')
            // This allows any extension that contributes this language ID to satisfy the requirement.
            let isSupported = hasLanguageCapability(langKey);

            // Fallback: Check if the specific required extension is installed by ID
            // This is necessary for extensions like Angular that don't contribute a new language ID (e.g. 'angular')
            // but instead enhance existing languages (HTML, TypeScript).
            if (!isSupported && config.requiredExtensions) {
                isSupported = config.requiredExtensions.some(reqExt => {
                    return !!vscode.extensions.getExtension(reqExt.id);
                });
            }
            
            if (!isSupported) {
                // Fallback: Check if we have specific recommendations to show
                missingCapabilities.push({
                    language: config.name,
                    key: langKey,
                    message: config.message,
                    recommendedExtensions: config.requiredExtensions
                });
            }
        }
    }

    return missingCapabilities;
}

module.exports = {
    checkEnvironmentCapabilities
};
