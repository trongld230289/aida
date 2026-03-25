/**
 * @module template-loader
 * @description HTML template loader for AIDA chatbot sidebar.
 * Handles loading, caching, script inlining, and fallback templates.
 * Migrated to TypeScript in Phase 4.2.
 */

import * as path from 'path';
import { aidaLogging } from '../core/settings';
import { DEFAULTS } from '../core/aida-config';
import { toError } from '../core/error-utils';
import { promises as fs } from 'fs';
import * as fsSync from 'fs';

// ── Class ───────────────────────────────────────────────────────

class TemplateLoader {
    extensionPath: string;

    templateDir: string;

    templateCache: Map<string, string>;

    constructor(extensionPath: string) {
        this.extensionPath = extensionPath;
        this.templateCache = new Map();
        this.templateDir = path.join(extensionPath, 'scripts', 'chatbot', 'templates');
    }

    /** Get the main sidebar template (with script inlining) */
    async getSidebarTemplate(): Promise<string> {
        const templatePath = path.join(this.templateDir, 'sidebar-template.html');

        try {
            if (this.templateCache.has('sidebar')) {
                return this.templateCache.get('sidebar')!;
            }

            let template: string = await fs.readFile(templatePath, 'utf8');

            // Load and inline the script file to avoid path issues in webview
            const scriptPath = path.join(this.templateDir, 'sidebar-script.js');
            try {
                const scriptContent: string = await fs.readFile(scriptPath, 'utf8');
                const configScript = `<script type="text/javascript">\nwindow.__AIDA_CONFIG__ = ${JSON.stringify(DEFAULTS)};\n</script>`;
                template = template.replace(
                    '<script src="./sidebar-script.js"></script>',
                    `${configScript}\n<script type="text/javascript">\n${scriptContent}\n</script>`
                );
                aidaLogging('📜 Inlined script content + AIDA config into template');
            } catch (_scriptError: unknown) {
                const scriptError = toError(_scriptError);
                aidaLogging('⚠️ Could not load script file:', scriptError.message);
            }

            this.templateCache.set('sidebar', template);
            return template;
        } catch (_error: unknown) {
            const error = toError(_error);
            aidaLogging('Failed to load sidebar template:', error.message);
            return this.getFallbackTemplate();
        }
    }

    /** Get fallback template if main template fails */
    getFallbackTemplate(): string {
        try {
            
            const fallbackPath = path.join(this.templateDir, 'sidebar-fallback.html');
            return fsSync.readFileSync(fallbackPath, 'utf8');
        } catch {
            return `<!DOCTYPE html><html><body style="font-family:var(--vscode-font-family);background:var(--vscode-sideBar-background);color:var(--vscode-sideBar-foreground);text-align:center;padding:20px;"><h2>⚠️ Template Loading Error</h2><p>Failed to load AIDA Chat template.</p></body></html>`;
        }
    }

    /** Clear template cache */
    clearCache(): void {
        this.templateCache.clear();
    }

    /** Preload templates */
    async preloadTemplates(): Promise<void> {
        try {
            await this.getSidebarTemplate();
            aidaLogging('✅ Templates preloaded successfully');
        } catch (_error: unknown) {
            const error = toError(_error);
            aidaLogging('⚠️ Failed to preload templates:', error.message);
        }
    }
}

// ── Dual exports ────────────────────────────────────────────────

export default TemplateLoader;
export { TemplateLoader };
