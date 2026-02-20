const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const { aidaLogging } = require('../core/settings');

/**
 * BarrelResolver - Module xử lý barrel files (index.ts re-exports)
 * 
 * Module này chứa các hàm để:
 * - Resolve references qua các barrel files (đệ quy)
 * - Parse barrel export symbols
 * - Tìm imports của barrel files (wildcard exports)
 * - Build import patterns với path aliases
 */
class BarrelResolver {
    constructor() {
        this.referenceCache = new Map(); // Cache for reference lookups
        this.tsconfigAliasCache = new Map(); // Cache for tsconfig aliases
    }

    /**
     * 🔥 Main function: Resolve barrel references đệ quy
     * @param {vscode.Uri} symbolUri - URI của file chứa symbol
     * @param {vscode.Position} symbolPosition - Position của symbol
     * @param {string} symbolName - Tên symbol cần resolve
     * @param {Set<string>} visitedBarrels - Set các barrels đã visit (tránh infinite loop)
     * @param {number} currentLevel - Level hiện tại (limit depth)
     * @returns {Promise<{references: vscode.Location[], barrelChain: Array}>}
     */
    async resolveBarrelReferences(symbolUri, symbolPosition, symbolName, visitedBarrels = new Set(), currentLevel = 0) {
        const allReferences = [];
        const barrelChain = [];
        
        // Protection against infinite loops
        if (currentLevel > 10) {
            aidaLogging('⚠️ Barrel chain depth exceeded 10 levels, stopping recursion');
            return { references: allReferences, barrelChain };
        }
        
        try {
            // Check cache first with version key
            const cacheKey = `${symbolUri.fsPath}:${symbolPosition.line}:${symbolPosition.character}:v2`;
            let directReferences = this.referenceCache.get(cacheKey);
            
            if (!directReferences) {
                // 🔥 IMPROVED: Add timeout to prevent hanging
                const timeout = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Reference provider timeout')), 10000)
                );
                
                const refPromise = vscode.commands.executeCommand(
                    'vscode.executeReferenceProvider',
                    symbolUri,
                    symbolPosition
                );
                
                try {
                    directReferences = await Promise.race([refPromise, timeout]);
                } catch (timeoutError) {
                    aidaLogging(`         ⚠️ Timeout finding references for ${symbolName}`);
                    return { references: allReferences, barrelChain };
                }
                
                // Cache the result
                if (directReferences && directReferences.length > 0) {
                    this.referenceCache.set(cacheKey, directReferences);
                }
            }
            
            if (!directReferences || directReferences.length === 0) {
                return { references: allReferences, barrelChain };
            }
            
            // 🔥 IMPROVED: Separate barrels and real usages first
            const barrels = [];
            const realUsages = [];
            
            for (const ref of directReferences) {
                const isBarrel = await this.isBarrelExport(ref);
                if (isBarrel) {
                    barrels.push(ref);
                } else {
                    // Skip definition itself
                    if (ref.uri.fsPath !== symbolUri.fsPath || 
                        ref.range.start.line !== symbolPosition.line) {
                        realUsages.push(ref);
                    }
                }
            }
            
            // Add real usages immediately
            allReferences.push(...realUsages);
            
            const indent = '  '.repeat(currentLevel);
            aidaLogging(`         ${indent}📍 Level ${currentLevel}: ${barrels.length} barrels, ${realUsages.length} real usages`);
            
            // Process barrels
            for (const barrelRef of barrels) {
                const refPath = barrelRef.uri.fsPath;
                const refKey = `${refPath}:${barrelRef.range.start.line}:${barrelRef.range.start.character}`;
                
                aidaLogging(`         ${indent}🔄 Barrel: ${path.basename(refPath)}:${barrelRef.range.start.line}`);
                
                // Avoid infinite loops
                if (visitedBarrels.has(refKey)) {
                    aidaLogging(`         ${indent}⏭️ Already visited, skipping`);
                    continue;
                }
                
                visitedBarrels.add(refKey);
                
                // 🔥 IMPROVED: Get barrel export info with fallback
                const barrelSymbolInfo = await this.getBarrelExportSymbolImproved(barrelRef, symbolName);
                
                if (!barrelSymbolInfo) {
                    aidaLogging(`         ${indent}⚠️ Could not parse barrel export`);
                    continue;
                }
                
                // Add to barrel chain
                barrelChain.push({
                    file: refPath,
                    exportedAs: barrelSymbolInfo.name,
                    level: currentLevel,
                    isWildcard: barrelSymbolInfo.isWildcard
                });
                
                // Handle wildcard exports
                if (barrelSymbolInfo.isWildcard) {
                    aidaLogging(`         ${indent}⭐ Wildcard: finding imports of barrel...`);
                    const wildcardRefs = await this.findImportsOfBarrelFileImproved(
                        barrelRef.uri, 
                        symbolName,
                        currentLevel
                    );
                    aidaLogging(`         ${indent}✅ Found ${wildcardRefs.length} usages through wildcard`);
                    allReferences.push(...wildcardRefs);
                } else {
                    // Recursively resolve named exports
                    aidaLogging(`         ${indent}🔍 Following named export: ${barrelSymbolInfo.name}`);
                    const result = await this.resolveBarrelReferences(
                        barrelRef.uri,
                        barrelSymbolInfo.position,
                        barrelSymbolInfo.name,
                        visitedBarrels,
                        currentLevel + 1
                    );
                    
                    aidaLogging(`         ${indent}✅ Found ${result.references.length} refs through chain`);
                    allReferences.push(...result.references);
                    barrelChain.push(...result.barrelChain);
                }
            }
            
            return { references: allReferences, barrelChain };
            
        } catch (error) {
            aidaLogging(`         ❌ Barrel resolution error at level ${currentLevel}:`, error.message);
            // 🔥 IMPROVED: Clear cache on error
            const cacheKey = `${symbolUri.fsPath}:${symbolPosition.line}:${symbolPosition.character}:v2`;
            this.referenceCache.delete(cacheKey);
            return { references: allReferences, barrelChain };
        }
    }

    /**
     * 🔥 Parse barrel export symbol (improved version)
     * Xử lý các patterns:
     * - export * from './somewhere'
     * - export { Name } from './somewhere'
     * - export { Name as Alias } from './somewhere'
     * - export { Name1, Name2, ... } from './somewhere'
     * 
     * @param {vscode.Location} barrelLocation - Location của barrel export
     * @param {string} originalSymbolName - Tên symbol gốc (optional, dùng cho multi-export)
     * @returns {Promise<{name: string, position: vscode.Position, isWildcard: boolean}|null>}
     */
    async getBarrelExportSymbolImproved(barrelLocation, originalSymbolName = null) {
        try {
            const document = await vscode.workspace.openTextDocument(barrelLocation.uri);
            const line = document.lineAt(barrelLocation.range.start.line);
            const text = line.text.trim();
            const refColumn = barrelLocation.range.start.character;
            
            // Pattern 1: export * from './somewhere'
            if (/^export\s+\*\s+from/.test(text)) {
                return {
                    name: originalSymbolName || '*', // Use original name for wildcard
                    position: barrelLocation.range.start,
                    isWildcard: true
                };
            }
            
            // Pattern 2: export { Name } from './somewhere'
            const simpleMatch = text.match(/export\s+\{\s*(\w+)\s*\}\s+from/);
            if (simpleMatch) {
                const symbolName = simpleMatch[1];
                const symbolIndex = text.indexOf(symbolName, text.indexOf('{'));
                
                return {
                    name: symbolName,
                    position: new vscode.Position(
                        barrelLocation.range.start.line, 
                        symbolIndex >= 0 ? symbolIndex : refColumn
                    ),
                    isWildcard: false
                };
            }
            
            // Pattern 3: export { Name as Alias } from './somewhere'
            const aliasMatch = text.match(/export\s+\{\s*(\w+)\s+as\s+(\w+)\s*\}\s+from/);
            if (aliasMatch) {
                const originalName = aliasMatch[1];
                const aliasName = aliasMatch[2];
                const symbolIndex = text.indexOf(aliasName, text.indexOf('as'));
                
                return {
                    name: aliasName, // Use alias for next lookup
                    position: new vscode.Position(
                        barrelLocation.range.start.line,
                        symbolIndex >= 0 ? symbolIndex : refColumn
                    ),
                    isWildcard: false
                };
            }
            
            // Pattern 4: export { Name1, Name2, ... } from './somewhere'
            const multiMatch = text.match(/export\s+\{([^}]+)\}\s+from/);
            if (multiMatch) {
                const exportList = multiMatch[1];
                const specs = exportList.split(',').map(s => s.trim());
                
                // 🔥 IMPROVED: Find the export spec closest to reference position
                let bestMatch = null;
                let minDistance = Infinity;
                
                for (const spec of specs) {
                    // Parse 'Name' or 'Name as Alias'
                    const parts = spec.split(/\s+as\s+/);
                    const originalName = parts[0].trim();
                    const exportedName = parts.length === 2 ? parts[1].trim() : originalName;
                    
                    // Find position of this export in the line
                    const nameIndex = text.indexOf(exportedName, text.indexOf('{'));
                    if (nameIndex >= 0) {
                        const distance = Math.abs(nameIndex - refColumn);
                        if (distance < minDistance) {
                            minDistance = distance;
                            bestMatch = {
                                name: exportedName,
                                position: new vscode.Position(barrelLocation.range.start.line, nameIndex),
                                isWildcard: false
                            };
                        }
                    }
                }
                
                if (bestMatch) {
                    return bestMatch;
                }
                
                // Fallback: use original symbol name if present
                if (originalSymbolName) {
                    for (const spec of specs) {
                        if (spec.includes(originalSymbolName)) {
                            const parts = spec.split(/\s+as\s+/);
                            const exportedName = parts.length === 2 ? parts[1].trim() : parts[0].trim();
                            const nameIndex = text.indexOf(exportedName, text.indexOf('{'));
                            
                            return {
                                name: exportedName,
                                position: new vscode.Position(
                                    barrelLocation.range.start.line,
                                    nameIndex >= 0 ? nameIndex : refColumn
                                ),
                                isWildcard: false
                            };
                        }
                    }
                }
            }
            
            return null;
        } catch (error) {
            aidaLogging(`Error parsing barrel export:`, error.message);
            return null;
        }
    }

    /**
     * 🔥 Tìm imports của barrel file (xử lý wildcard exports)
     * Search tất cả files import từ barrel và sử dụng symbol
     * 
     * @param {vscode.Uri} barrelUri - URI của barrel file
     * @param {string} symbolName - Tên symbol cần tìm
     * @param {number} currentLevel - Level hiện tại (for logging)
     * @returns {Promise<vscode.Location[]>}
     */
    async findImportsOfBarrelFileImproved(barrelUri, symbolName, currentLevel = 0) {
        const imports = [];
        
        try {
            const barrelPath = barrelUri.fsPath;
            const barrelDir = path.dirname(barrelPath);
            
            // Get all TypeScript/JavaScript files in workspace
            const workspaceFolder = vscode.workspace.getWorkspaceFolder(barrelUri);
            if (!workspaceFolder) return imports;
            
            // Get barrel path relative to workspace (for alias matching)
            const workspacePath = workspaceFolder.uri.fsPath;
            const barrelRelativeToWorkspace = path.relative(workspacePath, barrelDir).replace(/\\/g, '/');
            
            const indent = '  '.repeat(currentLevel);
            aidaLogging(`${indent}         🔍 Looking for imports of barrel: ${barrelRelativeToWorkspace}`);
            aidaLogging(`${indent}         🎯 Searching for symbol: ${symbolName}`);
            
            // Load tsconfig aliases for better matching
            const pathAliases = await this.loadTSConfigAliases(workspacePath);
            aidaLogging(`${indent}         📋 Loaded ${pathAliases.size} path aliases`);
            
            const files = await vscode.workspace.findFiles(
                new vscode.RelativePattern(workspaceFolder, '**/*.{ts,tsx,js,jsx}'),
                '**/node_modules/**',
                1000 // Increase limit
            );
            
            // Search for files that import from this barrel and use the symbol
            for (const fileUri of files) {
                if (fileUri.fsPath === barrelPath) continue;
                
                try {
                    const document = await vscode.workspace.openTextDocument(fileUri);
                    const text = document.getText();
                    
                    const fileDir = path.dirname(fileUri.fsPath);
                    
                    // 🔥 Use buildImportPatterns for comprehensive matching
                    const importPatterns = this.buildImportPatterns(
                        fileUri.fsPath,
                        barrelDir,
                        barrelRelativeToWorkspace,
                        pathAliases
                    );
                    
                    let hasImport = false;
                    for (const pattern of importPatterns) {
                        if (pattern.test(text)) {
                            hasImport = true;
                            break;
                        }
                    }
                    
                    if (!hasImport) continue;
                    
                    // File imports from this barrel - now check if it uses the symbol
                    // symbolName is already the root object (e.g., 'limitedEquipment')
                    const symbolPattern = new RegExp(`\\b${symbolName.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\b`, 'g');
                    let match;
                    let foundInFile = 0;
                    
                    while ((match = symbolPattern.exec(text)) !== null) {
                        const position = document.positionAt(match.index);
                        const line = document.lineAt(position.line);
                        
                        // Skip import/export lines
                        const lineText = line.text.trim();
                        if (!lineText.startsWith('import') && !lineText.startsWith('export')) {
                            imports.push(new vscode.Location(fileUri, position));
                            foundInFile++;
                        }
                    }
                    
                    if (foundInFile > 0) {
                        aidaLogging(`${indent}         ✅ ${path.basename(fileUri.fsPath)}: ${foundInFile} usages`);
                    }
                } catch (error) {
                    // Skip files that can't be read
                    continue;
                }
            }
            
            aidaLogging(`${indent}         ✅ Found ${imports.length} usages of ${symbolName} through barrel`);
            return imports;
            
        } catch (error) {
            aidaLogging(`Error finding imports of barrel:`, error.message);
            return imports;
        }
    }

    /**
     * 🔥 Build import patterns (xử lý alias và Angular patterns)
     * Tạo các regex patterns để match imports với:
     * - Relative paths
     * - Absolute paths
     * - TypeScript path aliases
     * - Angular common patterns (@shared, @app, etc.)
     * 
     * @param {string} importerPath - Path của file đang import
     * @param {string} barrelDir - Directory của barrel file
     * @param {string} barrelRelativeToWorkspace - Path của barrel relative to workspace
     * @param {Map} pathAliases - Map của tsconfig path aliases
     * @returns {RegExp[]} Array of regex patterns
     */
    buildImportPatterns(importerPath, barrelDir, barrelRelativeToWorkspace, pathAliases) {
        const patterns = [];
        const fileDir = path.dirname(importerPath);
        
        // 1. Relative imports
        let relativePath = path.relative(fileDir, barrelDir);
        if (!relativePath.startsWith('.')) {
            relativePath = './' + relativePath;
        }
        relativePath = relativePath.replace(/\\/g, '/');
        
        patterns.push(
            new RegExp(`from\\s+['"]${relativePath.replace(/\./g, '\\.')}['"]`, 'i'),
            new RegExp(`from\\s+['"]${relativePath.replace(/\./g, '\\.')}/index['"]`, 'i')
        );
        
        // 2. Absolute from workspace
        patterns.push(
            new RegExp(`from\\s+['"]${barrelRelativeToWorkspace}['"]`, 'i')
        );
        
        // 3. TypeScript path aliases
        for (const [alias, target] of pathAliases.entries()) {
            if (barrelRelativeToWorkspace.startsWith(target)) {
                const aliasedPath = barrelRelativeToWorkspace.replace(target, alias);
                patterns.push(
                    new RegExp(`from\\s+['"]${aliasedPath}['"]`, 'i')
                );
            }
        }
        
        // 🔥 4. Angular common patterns
        // Based on typical path: app/shared/utilities
        const pathParts = barrelRelativeToWorkspace.split('/');
        
        // If path contains 'shared/utilities', add common Angular aliases
        if (barrelRelativeToWorkspace.includes('shared/utilities')) {
            patterns.push(
                new RegExp(`from\\s+['"]@shared/utilities['"]`, 'i'),
                new RegExp(`from\\s+['"]@app/shared/utilities['"]`, 'i')
            );
        }
        
        // Generic: extract pattern from path
        // app/shared/utilities → @shared/utilities
        if (pathParts.length >= 3 && pathParts[0] === 'app') {
            const aliased = `@${pathParts[1]}/${pathParts.slice(2).join('/')}`;
            patterns.push(
                new RegExp(`from\\s+['"]${aliased}['"]`, 'i')
            );
        }
        
        // Also try: src/app/shared/utilities → @shared/utilities
        if (pathParts.length >= 4 && pathParts[0] === 'src' && pathParts[1] === 'app') {
            const aliased = `@${pathParts[2]}/${pathParts.slice(3).join('/')}`;
            patterns.push(
                new RegExp(`from\\s+['"]${aliased}['"]`, 'i')
            );
        }
        
        return patterns;
    }

    /**
     * 🔥 Helper: Load TypeScript path aliases from tsconfig.json
     * @param {string} workspacePath - Workspace root path
     * @returns {Promise<Map<string, string>>}
     */
    async loadTSConfigAliases(workspacePath) {
        // Check cache first
        if (this.tsconfigAliasCache.has(workspacePath)) {
            return this.tsconfigAliasCache.get(workspacePath);
        }

        const aliases = new Map();
        
        try {
            const tsconfigPath = path.join(workspacePath, 'tsconfig.json');
            if (!fs.existsSync(tsconfigPath)) {
                this.tsconfigAliasCache.set(workspacePath, aliases);
                return aliases;
            }
            
            const tsconfigContent = fs.readFileSync(tsconfigPath, 'utf8');
            // Remove comments (simple approach)
            const jsonContent = tsconfigContent.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
            const tsconfig = JSON.parse(jsonContent);
            
            const paths = tsconfig.compilerOptions?.paths;
            if (paths) {
                for (const [alias, targets] of Object.entries(paths)) {
                    // Remove /* from alias and target
                    const cleanAlias = alias.replace(/\/\*$/, '');
                    const cleanTarget = targets[0].replace(/\/\*$/, '');
                    aliases.set(cleanAlias, cleanTarget);
                }
                
                aidaLogging(`✅ Loaded ${aliases.size} path aliases from tsconfig.json`);
            }
            
        } catch (error) {
            aidaLogging(`⚠️ Could not load tsconfig.json:`, error.message);
        }
        
        // Cache the result
        this.tsconfigAliasCache.set(workspacePath, aliases);
        return aliases;
    }

    /**
     * 🔥 Helper: Check if a reference location is a barrel export (re-export)
     * @param {vscode.Location} location - Reference location
     * @returns {Promise<boolean>}
     */
    async isBarrelExport(location) {
        try {
            const document = await vscode.workspace.openTextDocument(location.uri);
            const line = document.lineAt(location.range.start.line);
            const text = line.text.trim();
            
            // Pattern 1: export { Something } from './somewhere'
            const isReExport = /^export\s+(?:\{[^}]+\}|\*)\s+from/.test(text);
            
            // Pattern 2: File is named index.ts/tsx
            const fileName = path.basename(location.uri.fsPath);
            const isIndexFile = /^index\.(ts|tsx|js|jsx)$/.test(fileName);
            
            if (isReExport) {
                return true;
            }
            
            // If index file, check if it's mostly exports
            if (isIndexFile) {
                const fullText = document.getText();
                const lines = fullText.split('\n').filter(l => l.trim());
                const exportLines = lines.filter(l => 
                    l.trim().startsWith('export') || l.trim().startsWith('//')
                );
                
                // If >80% of lines are exports, likely a barrel
                if (lines.length > 0 && exportLines.length / lines.length > 0.8) {
                    return true;
                }
            }
            
            return false;
        } catch (error) {
            return false;
        }
    }

    /**
     * Clear all caches
     */
    clearCache() {
        this.referenceCache.clear();
        this.tsconfigAliasCache.clear();
    }
}

module.exports = { BarrelResolver };
