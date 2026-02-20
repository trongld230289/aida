const fs = require('fs').promises;
const path = require('path');
const { aidaLogging } = require('../core/settings');
const { DEFAULTS } = require('../core/aida-config');

/**
 * Template Loader for AIDA Chatbot
 * Manages HTML templates and provides caching
 */
class TemplateLoader {
    constructor(extensionPath) {
        this.extensionPath = extensionPath;
        this.templateCache = new Map();
        this.templateDir = path.join(extensionPath, 'scripts', 'chatbot', 'templates');
    }

    /**
     * Get the main sidebar template
     */
    async getSidebarTemplate() {
        const templatePath = path.join(this.templateDir, 'sidebar-template.html');
        
        try {
            // Check cache first
            if (this.templateCache.has('sidebar')) {
                return this.templateCache.get('sidebar');
            }

            // Load template from file
            let template = await fs.readFile(templatePath, 'utf8');
            
            // Load and inline the script file to avoid path issues in webview
            const scriptPath = path.join(this.templateDir, 'sidebar-script.js');
            try {
                const scriptContent = await fs.readFile(scriptPath, 'utf8');
                // Inject AIDA config before the main script
                const configScript = `<script type="text/javascript">\nwindow.__AIDA_CONFIG__ = ${JSON.stringify(DEFAULTS)};\n</script>`;
                template = template.replace(
                    '<script src="./sidebar-script.js"></script>',
                    `${configScript}\n<script type="text/javascript">\n${scriptContent}\n</script>`
                );
                aidaLogging('📜 Inlined script content + AIDA config into template');
            } catch (scriptError) {
                aidaLogging('⚠️ Could not load script file:', scriptError.message);
            }
            
            // Cache for future use
            this.templateCache.set('sidebar', template);
            
            return template;
        } catch (error) {
            aidaLogging('Failed to load sidebar template:', error.message);
            return this.getFallbackTemplate();
        }
    }

    /**
     * Get fallback template if main template fails
     */
    getFallbackTemplate() {
        try {
            const fsSync = require('fs');
            const fallbackPath = path.join(this.templateDir, 'sidebar-fallback.html');
            return fsSync.readFileSync(fallbackPath, 'utf8');
        } catch (e) {
            // Ultimate fallback if even the fallback template file can't be read
            return `<!DOCTYPE html><html><body style="font-family:var(--vscode-font-family);background:var(--vscode-sideBar-background);color:var(--vscode-sideBar-foreground);text-align:center;padding:20px;"><h2>⚠️ Template Loading Error</h2><p>Failed to load AIDA Chat template.</p></body></html>`;
        }
    }

    /**
     * Clear template cache
     */
    clearCache() {
        this.templateCache.clear();
    }

    /**
     * Preload templates
     */
    async preloadTemplates() {
        try {
            await this.getSidebarTemplate();
            aidaLogging('✅ Templates preloaded successfully');
        } catch (error) {
            aidaLogging('⚠️ Failed to preload templates:', error.message);
        }
    }
}

module.exports = TemplateLoader;
