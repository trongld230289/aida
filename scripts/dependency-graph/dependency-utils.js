const path = require('path');
const fs = require('fs');

/**
 * Shared utilities for dependency analysis
 */
class DependencyUtils {
    /**
     * Check for sibling files with specific extensions
     * Useful for "Convention over Configuration" (e.g. Angular Component parts)
     * @param {string} filePath - Absolute path of the source file
     * @param {string[]} targetExtensions - Extensions to look for (e.g. ['.html', '.css'])
     * @returns {string[]} - Array of absolute paths of found siblings
     */
    static findSiblingFiles(filePath, targetExtensions) {
        const siblings = [];
        const dir = path.dirname(filePath);
        // Handle double extensions like .component.ts correctly if needed, 
        // but usually path.extname gets the last one (.ts).
        // If we have 'app.component.ts', basename without ext is 'app.component'.
        // We look for 'app.component.html'.
        const ext = path.extname(filePath);
        const baseName = path.basename(filePath, ext); 

        for (const targetExt of targetExtensions) {
            const siblingPath = path.join(dir, baseName + targetExt);
            // Avoid self-reference and check existence
            if (siblingPath !== filePath && fs.existsSync(siblingPath)) {
                siblings.push(siblingPath);
            }
        }
        return siblings;
    }

    /**
     * Try to resolve a relative import manually to avoid LSP overhead
     * @param {string} sourceDir - Directory of the source file
     * @param {string} importPath - The relative import path (e.g. './utils')
     * @returns {string|null} - Absolute path if found, null otherwise
     */
    static resolveRelativeImport(sourceDir, importPath) {
        const extensions = ['.ts', '.js', '.tsx', '.jsx', '.d.ts', '/index.ts', '/index.js'];
        
        for (const ext of ['', ...extensions]) {
            try {
                const candidate = path.resolve(sourceDir, importPath + ext);
                if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
                    return candidate;
                }
            } catch (e) {}
        }
        return null;
    }

    /**
     * Infer file type (component, service, etc.) from filename
     * @param {string} fileName 
     * @returns {string}
     */
    static inferFileType(fileName) {
        const name = fileName.toLowerCase();
        
        if (name.includes('.service.')) return 'service';
        if (name.includes('.component.')) return 'component';
        if (name.includes('.directive.')) return 'directive';
        if (name.includes('.pipe.')) return 'pipe';
        if (name.includes('.guard.')) return 'guard';
        if (name.includes('.resolver.')) return 'resolver';
        if (name.includes('.interceptor.')) return 'interceptor';
        if (name.includes('.module.')) return 'module';
        if (name.includes('controller')) return 'controller';
        if (name.includes('model')) return 'model';
        if (name.includes('interface')) return 'interface';
        if (name.includes('enum')) return 'enum';
        if (name.includes('constant')) return 'constant';
        if (name.includes('config')) return 'config';
        if (name.includes('util')) return 'utility';
        
        return 'file';
    }

    /**
     * Get programming language from file extension
     * @param {string} fileName 
     * @returns {string}
     */
    static getLanguageFromExtension(fileName) {
        const ext = path.extname(fileName).toLowerCase();
        const languageMap = {
            '.ts': 'typescript',
            '.tsx': 'typescript',
            '.js': 'javascript',
            '.jsx': 'javascript',
            '.vue': 'vue',
            '.cs': 'csharp',
            '.java': 'java',
            '.py': 'python',
            '.html': 'html',
            '.css': 'css',
            '.scss': 'scss'
        };
        
        return languageMap[ext] || 'unknown';
    }

    /**
     * Check if a path is an external dependency (node_modules, etc.)
     * @param {string} filePath 
     * @returns {boolean}
     */
    static isExternalDependency(filePath) {
        const pathLower = filePath.toLowerCase();
        return (
            pathLower.includes('node_modules') ||
            pathLower.includes('omnisharp-metadata') ||
            pathLower.includes('.nuget') ||
            pathLower.includes('microsoft.netcore') ||
            pathLower.includes('system.') ||
            pathLower.includes('bin/debug') ||
            pathLower.includes('bin/release') ||
            pathLower.includes('obj/')
        );
    }

    /**
     * Get relative path from workspace root with forward slashes
     * @param {string} workspaceRoot 
     * @param {string} absolutePath 
     * @returns {string}
     */
    static getRelativePath(workspaceRoot, absolutePath) {
        return path.relative(workspaceRoot, absolutePath).replace(/\\/g, '/');
    }
}

module.exports = { DependencyUtils };
