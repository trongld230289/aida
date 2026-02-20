const vscode = require('vscode');
const { aidaLogging } = require('../core/settings');
const { getLanguagesRequiringExtensions, SUPPORTED_LANGUAGES } = require('../core/language-support-config');

/**
 * Checks the VS Code environment for required extensions based on project type.
 * Ensures that Language Server Protocol (LSP) providers are available for accurate dependency scanning.
 */
class EnvironmentChecker {
    constructor() {
        // Use centralized language config instead of duplicating
        this.rules = this.buildRulesFromConfig();
    }

    /**
     * Build environment check rules from centralized language config
     * @returns {object} Rules object
     */
    buildRulesFromConfig() {
        const rules = {};
        const languagesRequiringExtensions = getLanguagesRequiringExtensions();
        
        for (const lang of languagesRequiringExtensions) {
            rules[lang.key] = {
                name: lang.name,
                patterns: lang.filePatterns,
                requiredExtensions: lang.requiredExtensions,
                message: lang.message
            };
        }
        
        return rules;
    }

    /**
     * Main check function.
     * Detects languages and verifies extensions.
     * @returns {Promise<{valid: boolean, missingExtensions: Array<{name: string, id: string}>, warnings: string[]}>}
     */
    async checkEnvironment() {
        aidaLogging('🕵️ Checking environment for required Language Servers...');
        
        const result = {
            valid: true,
            missingExtensions: [],
            warnings: []
        };

        // Check required extensions first
        let checkedLanguages = 0;
        aidaLogging(`   🔍 Checking ${Object.keys(this.rules).length} language rules...`);
        
        for (const [langKey, rule] of Object.entries(this.rules)) {
            // 1. Detect if this language is present in the workspace
            aidaLogging(`   🔎 Checking for ${rule.name} files with patterns: ${rule.patterns.join(', ')}`);
            const isPresent = await this.detectLanguage(rule.patterns);
            
            if (isPresent) {
                checkedLanguages++;
                aidaLogging(`   👉 Detected language: ${rule.name}`);
                
                // 2. Check if ANY of the required extensions are installed and active
                const extensionStatus = rule.requiredExtensions.map(ext => {
                    const extension = vscode.extensions.getExtension(ext.id);
                    return {
                        ...ext,
                        installed: !!extension,
                        active: extension ? extension.isActive : false
                    };
                });

                const hasActiveExtension = extensionStatus.some(ext => ext.active);
                
                if (!hasActiveExtension) {
                    const installedButInactive = extensionStatus.find(ext => ext.installed && !ext.active);
                    const allNotInstalled = extensionStatus.every(ext => !ext.installed);
                    
                    if (installedButInactive) {
                        // Extension installed but not activated
                        result.valid = false;
                        result.warnings.push(`❌ ${rule.name} Language Server "${installedButInactive.name}" is installed but NOT ACTIVE. Please reload VS Code or check extension settings.`);
                        result.missingExtensions.push(installedButInactive);
                    } else if (allNotInstalled) {
                        // No extension installed at all
                        result.valid = false;
                        result.warnings.push(`❌ ${rule.message}`);
                        
                        // Add the preferred one (first in list) to missing list
                        result.missingExtensions.push(rule.requiredExtensions[0]);
                    }
                } else {
                    const activeExt = extensionStatus.find(ext => ext.active);
                    aidaLogging(`      ✅ Language Server active for ${rule.name}: ${activeExt.name}`);
                }
            }
        }

        if (checkedLanguages === 0) {
            aidaLogging('   ℹ️ No languages requiring extension checks detected in workspace');
        } else {
            aidaLogging(`   ✅ Checked ${checkedLanguages} language(s)`);
        }

        // 🔥 NEW: Check optional extensions (soft warnings)
        await this.checkOptionalExtensions(result);

        return result;
    }

    /**
     * Check for optional extensions and provide soft recommendations
     * @param {object} result - Result object to add warnings to
     */
    async checkOptionalExtensions(result) {
        for (const [langKey, config] of Object.entries(SUPPORTED_LANGUAGES)) {
            // Skip if no optional extensions defined
            if (!config.optionalExtensions || config.optionalExtensions.length === 0) continue;

            // Check if this language is present
            const isPresent = await this.detectLanguage(config.filePatterns);
            
            if (isPresent) {
                // Check if ANY optional extension is active
                const hasOptionalExt = config.optionalExtensions.some(ext => {
                    const extension = vscode.extensions.getExtension(ext.id);
                    return extension && extension.isActive;
                });

                if (!hasOptionalExt) {
                    const extNames = config.optionalExtensions.map(e => `"${e.name}"`).join(' or ');
                    result.warnings.push(`💡 ${config.name} detected. Consider installing ${extNames} for enhanced template support.`);
                }
            }
        }
    }

    /**
     * Check if any file matching the patterns exists in the workspace
     * @param {string[]} patterns 
     * @returns {Promise<boolean>}
     */
    async detectLanguage(patterns) {
        // We only need to find ONE file to confirm presence
        // limit to 1 result for performance
        for (const pattern of patterns) {
            // Try findFiles first
            const files = await vscode.workspace.findFiles(pattern, '**/node_modules/**', 1);
            if (files.length > 0) {
                return true;
            }
            
            // Fallback: Check if pattern is a simple filename in root (e.g. 'angular.json')
            // This helps if findFiles is slow or restricted
            if (!pattern.includes('/') && !pattern.includes('*')) {
                const workspaceFolders = vscode.workspace.workspaceFolders;
                if (workspaceFolders) {
                    for (const folder of workspaceFolders) {
                        try {
                            const fileUri = vscode.Uri.joinPath(folder.uri, pattern);
                            await vscode.workspace.fs.stat(fileUri);
                            return true; // File exists
                        } catch (e) {
                            // File not found
                        }
                    }
                }
            }
        }
        return false;
    }
}

module.exports = { EnvironmentChecker };
