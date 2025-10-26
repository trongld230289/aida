const fs = require('fs').promises;
const path = require('path');

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
                // Replace script src with inline script content
                template = template.replace(
                    '<script src="./sidebar-script.js"></script>',
                    `<script type="text/javascript">\n${scriptContent}\n</script>`
                );
                console.log('📜 Inlined script content into template');
            } catch (scriptError) {
                console.warn('⚠️ Could not load script file:', scriptError.message);
            }
            
            // Cache for future use
            this.templateCache.set('sidebar', template);
            
            return template;
        } catch (error) {
            console.warn('Failed to load sidebar template:', error.message);
            return this.getFallbackTemplate();
        }
    }

    /**
     * Get fallback template if main template fails
     */
    getFallbackTemplate() {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AIDA Chat</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: var(--vscode-font-family);
            background-color: var(--vscode-sideBar-background);
            color: var(--vscode-sideBar-foreground);
            height: 100vh;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
        }
        .error-container {
            text-align: center;
            padding: 20px;
        }
        .error-icon {
            font-size: 48px;
            margin-bottom: 16px;
        }
        h2 {
            margin-bottom: 8px;
            color: var(--vscode-foreground);
        }
        p {
            color: var(--vscode-descriptionForeground);
            font-size: 12px;
        }
    </style>
</head>
<body>
    <div class="error-container">
        <div class="error-icon">⚠️</div>
        <h2>Template Loading Error</h2>
        <p>Failed to load AIDA Chat template. Using fallback interface.</p>
    </div>
</body>
</html>`;
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
            console.log('✅ Templates preloaded successfully');
        } catch (error) {
            console.warn('⚠️ Failed to preload templates:', error.message);
        }
    }
}

module.exports = TemplateLoader;