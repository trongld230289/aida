const path = require('path');
const fs = require('fs');
const vscode = require('vscode');
const { VSCodeApiDependencyAnalyzer } = require('./vscode-api-analyzer');

/**
 * Factory to get appropriate asset loader based on file type
 */
class AssetLoaderFactory {
    static getLoader(fileName) {
        // 🔥 NEW: Use Generic Configurable Loader
        return new ConfigurableAssetLoader();
    }
}

/**
 * Generic Asset Loader driven by VSCodeApiDependencyAnalyzer config
 */
class ConfigurableAssetLoader {
    constructor() {
        // Initialize analyzer to access config
        // Note: In a real DI system, this should be injected
        this.analyzer = new VSCodeApiDependencyAnalyzer();
    }

    async loadAssets(absolutePath, fileContent, workspaceRoot) {
        const result = {};
        const fileName = path.basename(absolutePath);
        const ext = path.extname(fileName).toLowerCase();
        
        // 1. Find matching language config
        let langConfig = null;
        if (this.analyzer && this.analyzer.languageConfig) {
            for (const [lang, config] of Object.entries(this.analyzer.languageConfig)) {
                if (config.extensions && config.extensions.includes(ext)) {
                    langConfig = config;
                    break;
                }
            }
        }

        if (!langConfig) return result;

        // 2. Process Regex Patterns from Config
        if (langConfig.assetPatterns) {
            for (const patternConfig of langConfig.assetPatterns) {
                const regex = patternConfig.regex;
                if (!regex) continue;

                // Reset regex state
                regex.lastIndex = 0;

                if (patternConfig.multi) {
                    // Handle multi-match (e.g. styleUrls: ['a.css', 'b.css'])
                    const match = fileContent.match(regex);
                    if (match && match[1]) {
                        // Extract inner content (e.g. 'a.css', 'b.css')
                        const innerContent = match[1];
                        // Simple extraction of quoted strings
                        const urlMatches = innerContent.match(/['"`]([^'"`]+)['"`]/g);
                        if (urlMatches) {
                            for (const urlMatch of urlMatches) {
                                const cleanUrl = urlMatch.replace(/['"`]/g, '');
                                await this.resolveAndAddAsset(result, patternConfig.type, cleanUrl, absolutePath, workspaceRoot);
                            }
                        }
                    }
                } else {
                    // Handle single match (e.g. templateUrl: 'a.html')
                    // Use matchAll to find all occurrences in file
                    const matches = fileContent.matchAll(new RegExp(regex, 'g'));
                    for (const match of matches) {
                        const url = match[1];
                        if (url) {
                            await this.resolveAndAddAsset(result, patternConfig.type, url, absolutePath, workspaceRoot);
                        }
                    }
                }
            }
        }

        // 3. Handle Co-location Conventions (Hard to config purely via regex)
        // We can keep some generic convention logic here or add 'conventions' to config later
        // For now, let's keep the React/C# co-location logic as a fallback or "Convention Strategy"
        
        // React/C# Co-location fallback
        if (['.tsx', '.jsx', '.js', '.cs', '.razor', '.cshtml'].includes(ext)) {
            await this.applyConventions(result, absolutePath, workspaceRoot, ext);
        }

        return result;
    }

    async resolveAndAddAsset(result, type, relativeUrl, sourcePath, workspaceRoot) {
        try {
            const dirPath = path.dirname(sourcePath);
            const assetPath = path.resolve(dirPath, relativeUrl);
            
            if (fs.existsSync(assetPath)) {
                // Store relative to workspace
                result[type] = path.relative(workspaceRoot, assetPath);
            }
        } catch (e) {
            // Ignore resolution errors
        }
    }

    async applyConventions(result, absolutePath, workspaceRoot, ext) {
        const dirPath = path.dirname(absolutePath);
        const baseName = path.basename(absolutePath, ext);
        
        // React/General CSS Co-location
        if (!result.css && ['.tsx', '.jsx', '.js'].includes(ext)) {
            const possibleCssFiles = [
                `${baseName}.module.css`, `${baseName}.module.scss`,
                `${baseName}.css`, `${baseName}.scss`,
                'styles.module.css', 'styles.css'
            ];
            for (const cssFile of possibleCssFiles) {
                const cssPath = path.join(dirPath, cssFile);
                if (fs.existsSync(cssPath)) {
                    result.css = path.relative(workspaceRoot, cssPath);
                    break;
                }
            }
        }

        // C# View Conventions (Controller -> View)
        if (ext === '.cs' && baseName.endsWith('Controller')) {
            const viewName = baseName.replace('Controller', '');
            const possibleViewPaths = [
                path.join(dirPath, '..', 'Views', viewName, 'Index.cshtml'),
                path.join(dirPath, '..', 'Views', viewName, `${viewName}.cshtml`),
                path.join(dirPath, 'Views', viewName, 'Index.cshtml')
            ];
            for (const viewPath of possibleViewPaths) {
                if (fs.existsSync(viewPath)) {
                    result.view = path.relative(workspaceRoot, viewPath);
                    break;
                }
            }
        }
    }
}

module.exports = {
    AssetLoaderFactory
};