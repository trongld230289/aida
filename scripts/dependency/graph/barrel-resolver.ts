/**
 * @module barrel-resolver
 * @description Module for resolving barrel files (index.ts re-exports).
 * Handles recursive reference resolution, barrel export parsing,
 * wildcard import expansion, and tsconfig path alias resolution.
 * Migrated to TypeScript in Phase 3.4.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { aidaLogging } from '../../core/settings';
import { toError } from '../../core/error-utils';
import { loadJsonWithCommentsSync } from '../../core/file-loader';

// -- Constants (extracted from magic numbers) --------------------

/** Maximum barrel resolution depth to prevent infinite recursion */
const MAX_BARREL_DEPTH = 5;

/** Maximum number of barrel reference results per symbol */
const MAX_BARREL_RESULTS = 50;

/** Regex to detect barrel export patterns */
const BARREL_EXPORT_REGEX = /export\s+(?:\*|\{[^}]+\})\s+from\s+['"](\.\/[^'"]+)['"]/g;

/** Regex to detect wildcard re-exports: export * from './x' */
const WILDCARD_EXPORT_REGEX = /export\s+\*\s+from\s+['"](\.\/[^'"]+)['"]/g;

/** Regex to detect named re-exports: export { A, B } from './x' */
const NAMED_EXPORT_REGEX = /export\s+\{([^}]+)\}\s+from\s+['"](\.\/[^'"]+)['"]/g;

// -- Interfaces --------------------------------------------------

export interface IBarrelChainEntry {
    file: string;
    level: number;
    type: string;
}

export interface IBarrelResolution {
    references: vscode.Location[];
    barrelChain: IBarrelChainEntry[];
}

export interface IBarrelExport {
    name: string;
    source: string;
    isWildcard?: boolean;
}

// -- Class -------------------------------------------------------

class BarrelResolver {


    tsconfigAliasCache: Map<string, Map<string, string>>;

    referenceCache: Map<string, vscode.Location[]>;

    constructor() {
        this.referenceCache = new Map();
        this.tsconfigAliasCache = new Map();
    }

    /**
     * ?? Main function: Resolve barrel references d? quy
     * @param {vscode.Uri} symbolUri - URI c?a file ch?a symbol
     * @param {vscode.Position} symbolPosition - Position c?a symbol
     * @param {string} symbolName - T�n symbol c?n resolve
     * @param {Set<string>} visitedBarrels - Set c�c barrels d� visit (tr�nh infinite loop)
     * @param {number} currentLevel - Level hi?n t?i (limit depth)
     * @returns {Promise<{references: vscode.Location[], barrelChain: Array}>}
     */
    async resolveBarrelReferences(symbolUri: vscode.Uri, symbolPosition: vscode.Position, symbolName: string, visitedBarrels = new Set<string>(), currentLevel = 0) {
        const allReferences: vscode.Location[] = [];
        const barrelChain: Array<{ file: string; exportedAs: string; level: number; isWildcard: boolean }> = [];
        
        // Protection against infinite loops
        if (currentLevel > MAX_BARREL_DEPTH) {
            aidaLogging(`?? Barrel chain depth exceeded ${MAX_BARREL_DEPTH} levels, stopping recursion`);
            return { references: allReferences, barrelChain };
        }
        
        try {
            // Check cache first with version key
            const cacheKey = `${symbolUri.fsPath}:${symbolPosition.line}:${symbolPosition.character}:v2`;
            let directReferences = this.referenceCache.get(cacheKey);
            
            if (!directReferences) {
                // ?? IMPROVED: Add timeout to prevent hanging
                const timeout = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Reference provider timeout')), 10000)
                );
                
                const refPromise = vscode.commands.executeCommand(
                    'vscode.executeReferenceProvider',
                    symbolUri,
                    symbolPosition
                );
                
                try {
                    directReferences = await Promise.race([refPromise, timeout]) as vscode.Location[];
                } catch (_timeoutError: unknown) {
                    aidaLogging(`         ?? Timeout finding references for ${symbolName}`);
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
            
            // ?? IMPROVED: Separate barrels and real usages first
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
            aidaLogging(`         ${indent}?? Level ${currentLevel}: ${barrels.length} barrels, ${realUsages.length} real usages`);
            
            // Process barrels
            for (const barrelRef of barrels) {
                const refPath = barrelRef.uri.fsPath;
                const refKey = `${refPath}:${barrelRef.range.start.line}:${barrelRef.range.start.character}`;
                
                aidaLogging(`         ${indent}?? Barrel: ${path.basename(refPath)}:${barrelRef.range.start.line}`);
                
                // Avoid infinite loops
                if (visitedBarrels.has(refKey)) {
                    aidaLogging(`         ${indent}?? Already visited, skipping`);
                    continue;
                }
                
                visitedBarrels.add(refKey);
                
                // ?? IMPROVED: Get barrel export info with fallback
                const barrelSymbolInfo = await this.getBarrelExportSymbolImproved(barrelRef, symbolName);
                
                if (!barrelSymbolInfo) {
                    aidaLogging(`         ${indent}?? Could not parse barrel export`);
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
                    aidaLogging(`         ${indent}? Wildcard: finding imports of barrel...`);
                    const wildcardRefs = await this.findImportsOfBarrelFileImproved(
                        barrelRef.uri, 
                        symbolName,
                        currentLevel
                    );
                    aidaLogging(`         ${indent}? Found ${wildcardRefs.length} usages through wildcard`);
                    allReferences.push(...wildcardRefs);
                } else {
                    // Recursively resolve named exports
                    aidaLogging(`         ${indent}?? Following named export: ${barrelSymbolInfo.name}`);
                    const result = await this.resolveBarrelReferences(
                        barrelRef.uri,
                        barrelSymbolInfo.position,
                        barrelSymbolInfo.name,
                        visitedBarrels,
                        currentLevel + 1
                    );
                    
                    aidaLogging(`         ${indent}? Found ${result.references.length} refs through chain`);
                    allReferences.push(...result.references);
                    barrelChain.push(...result.barrelChain);
                }
            }
            
            return { references: allReferences, barrelChain };
            
        } catch (_error: unknown) {
            const error = toError(_error);
            aidaLogging(`         ? Barrel resolution error at level ${currentLevel}:`, error.message);
            // ?? IMPROVED: Clear cache on error
            const cacheKey = `${symbolUri.fsPath}:${symbolPosition.line}:${symbolPosition.character}:v2`;
            this.referenceCache.delete(cacheKey);
            return { references: allReferences, barrelChain };
        }
    }

    /**
     * ?? Parse barrel export symbol (improved version)
     * X? l� c�c patterns:
     * - export * from './somewhere'
     * - export { Name } from './somewhere'
     * - export { Name as Alias } from './somewhere'
     * - export { Name1, Name2, ... } from './somewhere'
     * 
     * @param {vscode.Location} barrelLocation - Location c?a barrel export
     * @param {string} originalSymbolName - T�n symbol g?c (optional, d�ng cho multi-export)
     * @returns {Promise<{name: string, position: vscode.Position, isWildcard: boolean}|null>}
     */
    async getBarrelExportSymbolImproved(barrelLocation: vscode.Location, originalSymbolName: string | null = null) {
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
                const symbolName = simpleMatch[1]!;
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
                // const _originalName = aliasMatch[1];
                const aliasName = aliasMatch[2]!;
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
                const exportList = multiMatch[1]!;
                const specs = exportList.split(',').map(s => s.trim());
                
                // ?? IMPROVED: Find the export spec closest to reference position
                let bestMatch = null;
                let minDistance = Infinity;
                
                for (const spec of specs) {
                    // Parse 'Name' or 'Name as Alias'
                    const parts = spec.split(/\s+as\s+/);
                    const originalName = parts[0]!.trim();
                    const exportedName = parts.length === 2 ? parts[1]!.trim() : originalName;
                    
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
                            const exportedName = parts.length === 2 ? parts[1]!.trim() : parts[0]!.trim();
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
        } catch (_error: unknown) {
            const error = toError(_error);
            aidaLogging(`Error parsing barrel export:`, error.message);
            return null;
        }
    }

    /**
     * ?? T�m imports c?a barrel file (x? l� wildcard exports)
     * Search t?t c? files import t? barrel v� s? d?ng symbol
     * 
     * @param {vscode.Uri} barrelUri - URI c?a barrel file
     * @param {string} symbolName - T�n symbol c?n t�m
     * @param {number} currentLevel - Level hi?n t?i (for logging)
     * @returns {Promise<vscode.Location[]>}
     */
    async findImportsOfBarrelFileImproved(barrelUri: vscode.Uri, symbolName: string, currentLevel = 0) {
        const imports: vscode.Location[] = [];
        
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
            aidaLogging(`${indent}         ?? Looking for imports of barrel: ${barrelRelativeToWorkspace}`);
            aidaLogging(`${indent}         ?? Searching for symbol: ${symbolName}`);
            
            // Load tsconfig aliases for better matching
            const pathAliases = await this.loadTSConfigAliases(workspacePath);
            aidaLogging(`${indent}         ?? Loaded ${pathAliases.size} path aliases`);
            
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
                    
                    // const _fileDir = path.dirname(fileUri.fsPath);
                    
                    // ?? Use buildImportPatterns for comprehensive matching
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
                        aidaLogging(`${indent}         ? ${path.basename(fileUri.fsPath)}: ${foundInFile} usages`);
                    }
                } catch (_error: unknown) {
                    // Skip files that can't be read
                    continue;
                }
            }
            
            aidaLogging(`${indent}         ? Found ${imports.length} usages of ${symbolName} through barrel`);
            return imports;
            
        } catch (_error: unknown) {
            const error = toError(_error);
            aidaLogging(`Error finding imports of barrel:`, error.message);
            return imports;
        }
    }

    /**
     * ?? Build import patterns (x? l� alias v� Angular patterns)
     * T?o c�c regex patterns d? match imports v?i:
     * - Relative paths
     * - Absolute paths
     * - TypeScript path aliases
     * - Angular common patterns (@shared, @app, etc.)
     * 
     * @param {string} importerPath - Path c?a file dang import
     * @param {string} barrelDir - Directory c?a barrel file
     * @param {string} barrelRelativeToWorkspace - Path c?a barrel relative to workspace
     * @param {Map} pathAliases - Map c?a tsconfig path aliases
     * @returns {RegExp[]} Array of regex patterns
     */
    buildImportPatterns(importerPath: string, barrelDir: string, barrelRelativeToWorkspace: string, pathAliases: Map<string, string>) {
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
        
        // ?? 4. Angular common patterns
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
        // app/shared/utilities ? @shared/utilities
        if (pathParts.length >= 3 && pathParts[0] === 'app') {
            const aliased = `@${pathParts[1]}/${pathParts.slice(2).join('/')}`;
            patterns.push(
                new RegExp(`from\\s+['"]${aliased}['"]`, 'i')
            );
        }
        
        // Also try: src/app/shared/utilities ? @shared/utilities
        if (pathParts.length >= 4 && pathParts[0] === 'src' && pathParts[1] === 'app') {
            const aliased = `@${pathParts[2]}/${pathParts.slice(3).join('/')}`;
            patterns.push(
                new RegExp(`from\\s+['"]${aliased}['"]`, 'i')
            );
        }
        
        return patterns;
    }

    /**
     * ?? Helper: Load TypeScript path aliases from tsconfig.json
     * @param {string} workspacePath - Workspace root path
     * @returns {Promise<Map<string, string>>}
     */
    async loadTSConfigAliases(workspacePath: string) {
        // Check cache first
        if (this.tsconfigAliasCache.has(workspacePath)) {
            return this.tsconfigAliasCache.get(workspacePath)!;
        }

        const aliases = new Map<string, string>();
        
        try {
            const tsconfigPath = path.join(workspacePath, 'tsconfig.json');
            const tsconfig = loadJsonWithCommentsSync<Record<string, any>>(tsconfigPath);
            if (!tsconfig) {
                this.tsconfigAliasCache.set(workspacePath, aliases);
                return aliases;
            }
            
            const paths = tsconfig.compilerOptions?.paths;
            if (paths) {
                for (const [alias, targets] of (Object.entries(paths) as [string, string[]][])) {
                    // Remove /* from alias and target
                    const cleanAlias = alias.replace(/\/\*$/, '');
                    const cleanTarget = targets[0]?.replace(/\/\*$/, '') ?? '';
                    aliases.set(cleanAlias, cleanTarget);
                }
                
                aidaLogging(`? Loaded ${aliases.size} path aliases from tsconfig.json`);
            }
            
        } catch (_error: unknown) {
            const error = toError(_error);
            aidaLogging(`?? Could not load tsconfig.json:`, error.message);
        }
        
        // Cache the result
        this.tsconfigAliasCache.set(workspacePath, aliases);
        return aliases;
    }

    /**
     * ?? Helper: Check if a reference location is a barrel export (re-export)
     * @param {vscode.Location} location - Reference location
     * @returns {Promise<boolean>}
     */
    async isBarrelExport(location: vscode.Location) {
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
        } catch (_error: unknown) {
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

export { BarrelResolver, MAX_BARREL_DEPTH, MAX_BARREL_RESULTS, BARREL_EXPORT_REGEX, WILDCARD_EXPORT_REGEX, NAMED_EXPORT_REGEX };
