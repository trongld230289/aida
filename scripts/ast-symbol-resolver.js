const ts = require('typescript');
const fs = require('fs');
const path = require('path');

/**
 * AST-based Symbol Resolver
 * Uses TypeScript Compiler API to accurately trace symbol definitions and usages
 */
class ASTSymbolResolver {
    constructor(workspaceRoot) {
        this.workspaceRoot = workspaceRoot;
        this.barrelCache = new Map(); // Cache: importPath -> resolved source file
        this.sourceFileCache = new Map(); // Cache: filePath -> SourceFile
    }

    /**
     * Parse a TypeScript/JavaScript file into AST
     * @param {string} filePath - Absolute file path
     * @returns {ts.SourceFile|null}
     */
    parseSourceFile(filePath) {
        try {
            if (this.sourceFileCache.has(filePath)) {
                return this.sourceFileCache.get(filePath);
            }

            if (!fs.existsSync(filePath)) {
                return null;
            }

            const content = fs.readFileSync(filePath, 'utf8');
            const sourceFile = ts.createSourceFile(
                filePath,
                content,
                ts.ScriptTarget.Latest,
                true // setParentNodes
            );

            this.sourceFileCache.set(filePath, sourceFile);
            return sourceFile;
        } catch (error) {
            console.error(`Error parsing ${filePath}:`, error.message);
            return null;
        }
    }

    /**
     * Extract exported symbols and their structure from source file
     * @param {string} filePath - Absolute file path
     * @param {string[]} changedLineNumbers - Line numbers that were changed in PR
     * @returns {Map<string, object>} Symbol name -> {type, fullPath, nested, lineNumber}
     */
    extractExportedSymbols(filePath, changedLineNumbers = []) {
        const sourceFile = this.parseSourceFile(filePath);
        if (!sourceFile) return new Map();

        const symbols = new Map();
        const changedLinesSet = new Set(changedLineNumbers);

        const visit = (node, parentPath = '') => {
            // Export declarations
            if (ts.isExportAssignment(node)) {
                // export = X or export default X
                const name = 'default';
                symbols.set(name, {
                    type: 'default',
                    fullPath: name,
                    nested: this.extractObjectStructure(node.expression),
                    lineNumber: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1
                });
            } else if (node.modifiers && node.modifiers.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) {
                // export const/let/var/function/class
                if (ts.isVariableStatement(node)) {
                    node.declarationList.declarations.forEach(decl => {
                        if (ts.isIdentifier(decl.name)) {
                            const name = decl.name.text;
                            const fullPath = parentPath ? `${parentPath}.${name}` : name;
                            const lineNumber = sourceFile.getLineAndCharacterOfPosition(decl.getStart()).line + 1;
                            
                            symbols.set(fullPath, {
                                type: 'variable',
                                fullPath,
                                nested: decl.initializer ? this.extractObjectStructure(decl.initializer, fullPath, sourceFile, changedLinesSet) : new Map(),
                                lineNumber,
                                isChanged: changedLinesSet.size === 0 || changedLinesSet.has(lineNumber)
                            });
                        }
                    });
                } else if (ts.isFunctionDeclaration(node) && node.name) {
                    const name = node.name.text;
                    const fullPath = parentPath ? `${parentPath}.${name}` : name;
                    const lineNumber = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
                    
                    symbols.set(fullPath, {
                        type: 'function',
                        fullPath,
                        nested: new Map(),
                        lineNumber,
                        isChanged: changedLinesSet.size === 0 || changedLinesSet.has(lineNumber)
                    });
                } else if (ts.isClassDeclaration(node) && node.name) {
                    const name = node.name.text;
                    const fullPath = parentPath ? `${parentPath}.${name}` : name;
                    const lineNumber = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
                    
                    symbols.set(fullPath, {
                        type: 'class',
                        fullPath,
                        nested: this.extractClassMembers(node, fullPath),
                        lineNumber,
                        isChanged: changedLinesSet.size === 0 || changedLinesSet.has(lineNumber)
                    });
                }
            }

            ts.forEachChild(node, child => visit(child, parentPath));
        };

        visit(sourceFile);
        return symbols;
    }

    /**
     * Extract nested structure from object literal
     * @param {ts.Node} node - AST node
     * @param {string} parentPath - Parent symbol path
     * @param {ts.SourceFile} sourceFile - Source file for line numbers
     * @param {Set<number>} changedLinesSet - Changed line numbers
     * @returns {Map<string, object>}
     */
    extractObjectStructure(node, parentPath = '', sourceFile = null, changedLinesSet = null) {
        const structure = new Map();

        if (ts.isObjectLiteralExpression(node)) {
            node.properties.forEach(prop => {
                if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name)) {
                    const propName = prop.name.text;
                    const fullPath = parentPath ? `${parentPath}.${propName}` : propName;
                    const lineNumber = sourceFile ? sourceFile.getLineAndCharacterOfPosition(prop.getStart()).line + 1 : 0;
                    const isChanged = !changedLinesSet || changedLinesSet.size === 0 || changedLinesSet.has(lineNumber);
                    
                    structure.set(fullPath, {
                        type: 'property',
                        fullPath,
                        nested: this.extractObjectStructure(prop.initializer, fullPath, sourceFile, changedLinesSet),
                        parent: parentPath,
                        lineNumber,
                        isChanged
                    });
                } else if (ts.isShorthandPropertyAssignment(prop)) {
                    const propName = prop.name.text;
                    const fullPath = parentPath ? `${parentPath}.${propName}` : propName;
                    const lineNumber = sourceFile ? sourceFile.getLineAndCharacterOfPosition(prop.getStart()).line + 1 : 0;
                    const isChanged = !changedLinesSet || changedLinesSet.size === 0 || changedLinesSet.has(lineNumber);
                    
                    structure.set(fullPath, {
                        type: 'property',
                        fullPath,
                        nested: new Map(),
                        parent: parentPath,
                        lineNumber,
                        isChanged
                    });
                }
            });
        }

        return structure;
    }

    /**
     * Extract class members
     * @param {ts.ClassDeclaration} classNode
     * @param {string} parentPath
     * @returns {Map<string, object>}
     */
    extractClassMembers(classNode, parentPath) {
        const members = new Map();

        classNode.members.forEach(member => {
            if (member.name && ts.isIdentifier(member.name)) {
                const memberName = member.name.text;
                const fullPath = `${parentPath}.${memberName}`;
                
                members.set(fullPath, {
                    type: ts.isMethodDeclaration(member) ? 'method' : 'property',
                    fullPath,
                    nested: new Map(),
                    parent: parentPath
                });
            }
        });

        return members;
    }

    /**
     * Find all import declarations in a file
     * @param {string} filePath - Absolute file path
     * @returns {Map<string, string>} Symbol name -> import path
     */
    findImportDeclarations(filePath) {
        const sourceFile = this.parseSourceFile(filePath);
        if (!sourceFile) return new Map();

        const imports = new Map();

        const visit = (node) => {
            if (ts.isImportDeclaration(node)) {
                const moduleSpecifier = node.moduleSpecifier;
                if (ts.isStringLiteral(moduleSpecifier)) {
                    const importPath = moduleSpecifier.text;

                    // Named imports: import { A, B } from '...'
                    if (node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings)) {
                        node.importClause.namedBindings.elements.forEach(element => {
                            const importedName = element.name.text;
                            imports.set(importedName, importPath);
                        });
                    }

                    // Default import: import X from '...'
                    if (node.importClause?.name) {
                        const importedName = node.importClause.name.text;
                        imports.set(importedName, importPath);
                    }

                    // Namespace import: import * as X from '...'
                    if (node.importClause?.namedBindings && ts.isNamespaceImport(node.importClause.namedBindings)) {
                        const namespaceName = node.importClause.namedBindings.name.text;
                        imports.set(namespaceName, importPath);
                    }
                }
            }

            ts.forEachChild(node, visit);
        };

        visit(sourceFile);
        return imports;
    }

    /**
     * Find usages of symbols in a file
     * @param {string} filePath - Absolute file path
     * @param {string[]} symbols - Symbols to search for
     * @param {Map<string, string>} importMap - Symbol -> import path mapping
     * @returns {Map<string, Array>} Symbol -> usage locations
     */
    findSymbolUsages(filePath, symbols, importMap) {
        const sourceFile = this.parseSourceFile(filePath);
        if (!sourceFile) return new Map();

        const usages = new Map();
        const symbolSet = new Set(symbols);

        // Track variable declarations for destructuring
        const variableBindings = new Map(); // localVar -> originalPath

        const visit = (node) => {
            // Track destructuring: const { a, b } = X
            if (ts.isVariableDeclaration(node)) {
                if (ts.isObjectBindingPattern(node.name) && node.initializer && ts.isIdentifier(node.initializer)) {
                    const sourceName = node.initializer.text;
                    node.name.elements.forEach(element => {
                        if (ts.isBindingElement(element) && ts.isIdentifier(element.name)) {
                            const propName = element.propertyName 
                                ? (ts.isIdentifier(element.propertyName) ? element.propertyName.text : null)
                                : element.name.text;
                            
                            if (propName) {
                                const fullPath = `${sourceName}.${propName}`;
                                variableBindings.set(element.name.text, fullPath);
                            }
                        }
                    });
                }
            }

            // Check identifiers
            if (ts.isIdentifier(node)) {
                const name = node.text;
                
                if (symbolSet.has(name)) {
                    if (!usages.has(name)) usages.set(name, []);
                    usages.get(name).push({
                        line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1,
                        symbol: name
                    });
                }

                // Check if this is a resolved binding
                if (variableBindings.has(name)) {
                    const resolvedPath = variableBindings.get(name);
                    if (symbolSet.has(resolvedPath)) {
                        if (!usages.has(resolvedPath)) usages.set(resolvedPath, []);
                        usages.get(resolvedPath).push({
                            line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1,
                            symbol: resolvedPath,
                            via: name
                        });
                    }
                }
            }

            // Check property access: A.B.C
            if (ts.isPropertyAccessExpression(node)) {
                const fullPath = this.getPropertyAccessPath(node);
                if (fullPath && symbolSet.has(fullPath)) {
                    if (!usages.has(fullPath)) usages.set(fullPath, []);
                    usages.get(fullPath).push({
                        line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1,
                        symbol: fullPath
                    });
                }
            }

            ts.forEachChild(node, visit);
        };

        visit(sourceFile);
        return usages;
    }

    /**
     * Get full property access path (e.g., A.B.C from AST)
     * @param {ts.PropertyAccessExpression} node
     * @returns {string}
     */
    getPropertyAccessPath(node) {
        const parts = [];
        let current = node;

        while (ts.isPropertyAccessExpression(current)) {
            parts.unshift(current.name.text);
            current = current.expression;
        }

        if (ts.isIdentifier(current)) {
            parts.unshift(current.text);
        }

        return parts.join('.');
    }

    /**
     * Resolve barrel export to actual source file
     * @param {string} importPath - Import path (e.g., '@shared/utilities')
     * @param {string} fromFile - File doing the importing
     * @param {string} symbol - Symbol name to trace
     * @returns {Promise<string|null>} Resolved source file path
     */
    async resolveBarrelExport(importPath, fromFile, symbol) {
        const cacheKey = `${importPath}::${symbol}`;
        if (this.barrelCache.has(cacheKey)) {
            return this.barrelCache.get(cacheKey);
        }

        try {
            // Step 1: Resolve import path to file
            const resolvedPath = this.resolveImportPath(importPath, fromFile);
            if (!resolvedPath) return null;

            // Step 2: Check if this file directly exports the symbol
            const symbols = this.extractExportedSymbols(resolvedPath);
            for (const [symbolPath, symbolInfo] of symbols) {
                if (symbolPath === symbol || symbolPath.startsWith(`${symbol}.`)) {
                    this.barrelCache.set(cacheKey, resolvedPath);
                    return resolvedPath;
                }
            }

            // Step 3: Check re-exports (barrel)
            const sourceFile = this.parseSourceFile(resolvedPath);
            if (!sourceFile) return null;

            const reExports = this.findReExports(sourceFile);
            for (const reExportPath of reExports) {
                const actualSource = await this.resolveBarrelExport(reExportPath, resolvedPath, symbol);
                if (actualSource) {
                    this.barrelCache.set(cacheKey, actualSource);
                    return actualSource;
                }
            }

            return null;
        } catch (error) {
            console.error(`Error resolving barrel ${importPath}:`, error.message);
            return null;
        }
    }

    /**
     * Find re-export statements in a file
     * @param {ts.SourceFile} sourceFile
     * @returns {string[]} Re-exported paths
     */
    findReExports(sourceFile) {
        const reExports = [];

        const visit = (node) => {
            // export * from '...'
            if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
                reExports.push(node.moduleSpecifier.text);
            }

            ts.forEachChild(node, visit);
        };

        visit(sourceFile);
        return reExports;
    }

    /**
     * Resolve import path to actual file path
     * @param {string} importPath - Import path from code
     * @param {string} fromFile - File containing the import
     * @returns {string|null} Resolved file path
     */
    resolveImportPath(importPath, fromFile) {
        try {
            let resolvedPath = importPath;

            // Handle path aliases
            if (importPath.startsWith('@shared')) {
                resolvedPath = importPath.replace('@shared', path.join(this.workspaceRoot, 'src/app/shared'));
            } else if (importPath.startsWith('@app')) {
                resolvedPath = importPath.replace('@app', path.join(this.workspaceRoot, 'src/app'));
            } else if (importPath.startsWith('@data')) {
                resolvedPath = importPath.replace('@data', path.join(this.workspaceRoot, 'src/app/data'));
            } else if (importPath.startsWith('@modules')) {
                resolvedPath = importPath.replace('@modules', path.join(this.workspaceRoot, 'src/app/modules'));
            } else if (importPath.startsWith('@core')) {
                resolvedPath = importPath.replace('@core', path.join(this.workspaceRoot, 'src/app/core'));
            } else if (importPath.startsWith('.')) {
                // Relative path
                const fromDir = path.dirname(fromFile);
                resolvedPath = path.join(fromDir, importPath);
            } else {
                // Node modules - skip
                return null;
            }

            // Try with extensions
            const extensions = ['.ts', '.js', '.tsx', '.jsx', '/index.ts', '/index.js'];
            for (const ext of extensions) {
                const fullPath = resolvedPath + ext;
                if (fs.existsSync(fullPath)) {
                    return fullPath;
                }
            }

            return null;
        } catch (error) {
            console.error(`Error resolving import path ${importPath}:`, error.message);
            return null;
        }
    }

    /**
     * Check if two file paths refer to the same file
     * @param {string} file1
     * @param {string} file2
     * @returns {boolean}
     */
    isSameFile(file1, file2) {
        if (!file1 || !file2) return false;
        
        const norm1 = path.normalize(file1).replace(/\\/g, '/').toLowerCase();
        const norm2 = path.normalize(file2).replace(/\\/g, '/').toLowerCase();
        
        return norm1 === norm2;
    }

    /**
     * Clear all caches
     */
    clearCache() {
        this.barrelCache.clear();
        this.sourceFileCache.clear();
    }
}

module.exports = { ASTSymbolResolver };
