import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { BarrelResolver } from './graph/barrel-resolver';
import { aidaLogging } from '../core/settings';
import { toError } from '../core/error-utils';
import { virtualContentProvider } from '../core/virtual-content-provider';
import {
    getLanguagePatterns,
    resolveBarrelReferences,
    isBarrelExport as isBarrelExportHelper,
} from './pr-barrel-resolver-helpers';
import type { IChangedSymbol } from './interfaces/pr-analysis.interface';

/**
 * Context needed by symbol extraction helpers.
 */
export interface ISymbolExtractorContext {
    vscodeAnalyzer: any;
    barrelResolver: BarrelResolver;
    workspaceRoot: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Hybrid entry point
// ────────────────────────────────────────────────────────────────────────────

/**
 * Main entry point for symbol extraction.
 * Combines Regex (fast, robust for fragments) and VS Code API (accurate for structure).
 */
async function extractChangedSymbolsHybrid(
    patch: string,
    prFilePath: string,
    ctx: ISymbolExtractorContext
): Promise<IChangedSymbol[]> {
    aidaLogging(`   🔍 Extracting symbols using Hybrid approach (Regex + VS Code API)...`);

    // 1. Run Regex extraction
    const regexSymbols = extractChangedSymbolsRegex(patch, prFilePath, ctx);

    // 2. Run VS Code API extraction
    const vscodeSymbols = await extractChangedSymbolsVscode(patch, prFilePath, ctx);

    // 3. Merge and Deduplicate
    const mergedMap = new Map<string, IChangedSymbol>();

    // Helper to add symbol if valid
    const addSymbol = (sym: IChangedSymbol, source: string) => {
        // Filter out symbols that match the filename (likely module wrappers)
        const fileName = path.basename(prFilePath, path.extname(prFilePath));
        if (sym.name.toLowerCase() === fileName.toLowerCase()) {
            aidaLogging(`   🚫 Ignoring symbol '${sym.name}' (matches filename) from ${source}`);
            return;
        }

        if (!mergedMap.has(sym.fullName)) {
            mergedMap.set(sym.fullName, sym);
        } else {
            // If we already have it, maybe update metadata?
            // Prefer VS Code API type info if available
            if (source === 'VSCode' && mergedMap.get(sym.fullName)!.type === 'unknown') {
                mergedMap.set(sym.fullName, sym);
            }
        }
    };

    regexSymbols.forEach(s => addSymbol(s, 'Regex'));
    vscodeSymbols.forEach(s => addSymbol(s, 'VSCode'));

    const finalSymbols = Array.from(mergedMap.values());
    aidaLogging(`   ✅ Hybrid extraction found ${finalSymbols.length} unique symbols`);
    return finalSymbols;
}

// ────────────────────────────────────────────────────────────────────────────
// VS Code API extraction
// ────────────────────────────────────────────────────────────────────────────

/**
 * Extract changed symbols using VS Code DocumentSymbolProvider on Virtual Document
 * @param patch - The git patch
 * @param prFilePath - Relative path to file
 * @param ctx - Symbol extractor context
 */
async function extractChangedSymbolsVscode(
    patch: string,
    prFilePath: string,
    ctx: ISymbolExtractorContext
): Promise<IChangedSymbol[]> {
    if (!patch) {
        return [];
    }

    aidaLogging(`   📄 Extracting symbols from patch content (VS Code API)...`);

    // 1. Extract "New Code" from patch (lines starting with +)
    const lines = patch.split('\n');
    let newCodeContent = '';
    let hasContent = false;

    for (const line of lines) {
        if (line.startsWith('+++') || line.startsWith('---') || line.startsWith('@@')) {
            continue;
        }
        if (line.startsWith('+')) {
            const cleanLine = line.substring(1);
            newCodeContent += cleanLine + '\n';
            hasContent = true;
        }
    }

    if (!hasContent || !newCodeContent.trim()) {
        return [];
    }

    // 2. Create Virtual Document
    try {
        // 🔥 IMPROVED: Use virtual content provider to avoid opening "Untitled" tabs
        // Store content in memory and get URI (scheme: aida-memory)
        const virtualUri = virtualContentProvider.setFileContent(prFilePath, newCodeContent);

        // Open the virtual document (read-only, no tab opened)
        const doc = await vscode.workspace.openTextDocument(virtualUri);

        // 3. Execute Symbol Provider
        const symbols = await vscode.commands.executeCommand(
            'vscode.executeDocumentSymbolProvider',
            doc.uri
        ) as any;

        // Clean up memory
        virtualContentProvider.clearFileContent(prFilePath);

        if (!symbols || symbols.length === 0) {
            return [];
        }

        // 4. Process Symbols
        const extractedSymbols: IChangedSymbol[] = [];

        const processSymbol = (symbol: vscode.DocumentSymbol, parentName: string | null = null) => {
            // 🔥 FIX: Dynamic symbol type mapping
            let typeStr = vscode.SymbolKind[symbol.kind] ? vscode.SymbolKind[symbol.kind].toLowerCase() : 'unknown';

            // Handle special cases
            if (typeStr === 'enummember') typeStr = 'enum-member';
            if (typeStr === 'typeparameter') typeStr = 'type-param';

            // 🔥 FIX: Configuration-driven significance check
            let isSignificant = false;
            const patterns = getLanguagePatterns(prFilePath, ctx.vscodeAnalyzer);

            if (patterns) {
                // Check if type is configured in patterns
                if (patterns[typeStr]) {
                    isSignificant = true;
                } else {
                    // Map related types
                    if (typeStr === 'method' && patterns['function']) isSignificant = true;
                    if (typeStr === 'field' && patterns['property']) isSignificant = true;
                    // Always include containers if they have children
                    if (['class', 'interface', 'module', 'namespace'].includes(typeStr)) isSignificant = true;
                }
            } else {
                // Fallback to hardcoded list
                isSignificant = [
                    vscode.SymbolKind.Class,
                    vscode.SymbolKind.Method,
                    vscode.SymbolKind.Property,
                    vscode.SymbolKind.Function,
                    vscode.SymbolKind.Variable,
                    vscode.SymbolKind.Constant,
                    vscode.SymbolKind.Interface,
                    vscode.SymbolKind.Enum
                ].includes(symbol.kind);
            }

            if (isSignificant) {
                extractedSymbols.push({
                    name: symbol.name,
                    fullName: parentName ? `${parentName}.${symbol.name}` : symbol.name,
                    type: typeStr,
                    lineNumber: 0,
                    column: 0,
                    filePath: prFilePath,
                    isRoot: !parentName,
                    kind: symbol.kind
                });
            }

            if (symbol.children && symbol.children.length > 0) {
                symbol.children.forEach((child: vscode.DocumentSymbol) => processSymbol(child, symbol.name));
            }
        };

        symbols.forEach((s: vscode.DocumentSymbol) => processSymbol(s));

        // Deduplicate
        const uniqueSymbols: IChangedSymbol[] = [];
        const seenNames = new Set<string>();
        for (const sym of extractedSymbols) {
            if (!seenNames.has(sym.fullName)) {
                seenNames.add(sym.fullName);
                uniqueSymbols.push(sym);
            }
        }

        return uniqueSymbols;

    } catch (_error: unknown) {
        const error = toError(_error);
        aidaLogging(`   ❌ Error in VS Code symbol extraction: ${error.message}`);
        return [];
    }
}

// ────────────────────────────────────────────────────────────────────────────
// Regex-based extraction
// ────────────────────────────────────────────────────────────────────────────

/**
 * Legacy regex-based extraction (kept for reference or fallback)
 */
function extractChangedSymbolsRegex(
    patch: string,
    prFilePath: string,
    ctx: ISymbolExtractorContext
): IChangedSymbol[] {
    if (!patch) {
        aidaLogging(`   ⚠️ No patch data`);
        return [];
    }

    aidaLogging(`   📄 Extracting from patch (${patch.length} chars)...`);

    const allSymbols: any[] = [];
    const lines = patch.split('\n');
    const contextStack: string[] = [];
    let currentLineNumber = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line) continue;

        if (line.startsWith('@@')) {
            const match = line.match(/@@ -\d+,?\d* \+(\d+),?\d* @@/);
            if (match) {
                currentLineNumber = parseInt(match[1]!) - 1;
            }
            continue;
        }

        if (line.startsWith('+') && !line.startsWith('+++')) {
            const codeLine = line.substring(1);
            const trimmed = codeLine.trim();

            // Detect object start
            const objectStartMatch = trimmed.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:\s*\{/);
            if (objectStartMatch) {
                const objectName = objectStartMatch[1]!;
                const column = codeLine.indexOf(objectName);
                contextStack.push(objectName);

                allSymbols.push({
                    name: objectName,
                    fullName: objectName,
                    type: 'object',
                    lineNumber: currentLineNumber,
                    column: column,
                    filePath: prFilePath,
                    isRoot: true
                });
                currentLineNumber++;
                continue;
            }

            if (trimmed === '},' || trimmed === '}') {
                if (contextStack.length > 0) {
                    contextStack.pop();
                }
                currentLineNumber++;
                continue;
            }

            const extracted = extractSymbolsFromLine(codeLine, contextStack, currentLineNumber, prFilePath, ctx);
            allSymbols.push(...extracted);
            currentLineNumber++;
        } else if (line.startsWith('-') && !line.startsWith('---')) {
            continue;
        } else if (!line.startsWith('\\')) {
            currentLineNumber++;
        }
    }

    // 🔥 KEY FIX: Group by root object
    const rootSymbolMap = new Map<string, any>();

    for (const sym of allSymbols) {
        let rootName: string | undefined;
        let rootSymbol: any;

        if (sym.type === 'object' && sym.isRoot) {
            // This is a root object
            rootName = sym.name;
            rootSymbol = sym;
        } else if (sym.parentName) {
            // This is a nested property - find its root
            rootName = sym.parentName;

            // Find the root object definition
            rootSymbol = allSymbols.find(s =>
                s.name === rootName && s.isRoot
            );

            if (!rootSymbol) {
                // Create virtual root if not found
                rootSymbol = {
                    name: rootName,
                    fullName: rootName,
                    type: 'object',
                    lineNumber: sym.lineNumber,
                    column: 0,
                    filePath: sym.filePath,
                    isRoot: true,
                    children: []
                };
            }
        } else {
            // Top-level symbol (function, const, etc.)
            rootName = sym.name;
            rootSymbol = sym;
        }

        if (!rootSymbolMap.has(rootName!)) {
            rootSymbolMap.set(rootName!, {
                ...rootSymbol,
                children: []
            });
        }

        // Track child properties
        if (sym.parentName && sym.parentName === rootName) {
            rootSymbolMap.get(rootName!)!.children.push(sym.fullName);
        }
    }

    // Convert to array
    const uniqueRootSymbols = Array.from(rootSymbolMap.values());

    aidaLogging(`   ✅ Found ${uniqueRootSymbols.length} root symbols:`);
    uniqueRootSymbols.forEach(s => {
        if (s.children && s.children.length > 0) {
            aidaLogging(`      - ${s.fullName} (object with ${s.children.length} properties)`);
            s.children.forEach((child: string) => {
                aidaLogging(`         └─ ${child}`);
            });
        } else {
            aidaLogging(`      - ${s.fullName}`);
        }
    });

    return uniqueRootSymbols;
}

// ────────────────────────────────────────────────────────────────────────────
// Line-level extraction
// ────────────────────────────────────────────────────────────────────────────

/**
 * Extract symbols from a single line of code with positions
 * @param line - The code line to extract from
 * @param contextStack - Current nested object context
 * @param lineNumber - Line number in file (0-indexed)
 * @param filePath - File path
 * @param ctx - Symbol extractor context
 */
function extractSymbolsFromLine(
    line: string,
    contextStack: string[] = [],
    lineNumber = 0,
    filePath = '',
    ctx: ISymbolExtractorContext
): IChangedSymbol[] {
    const symbols: IChangedSymbol[] = [];
    const trimmedLine = line.trim();

    if (!trimmedLine || trimmedLine.length === 0) return symbols;

    // 🔥 FIX: Use configuration-driven patterns
    const patterns = getLanguagePatterns(filePath, ctx.vscodeAnalyzer);

    if (patterns) {
        for (const [type, regex] of (Object.entries(patterns) as [string, string | RegExp][])) {
            if (type === 'objectStart' || type === 'blockEnd') continue;

            try {
                const pattern = regex instanceof RegExp ? regex : new RegExp(regex);
                const match = trimmedLine.match(pattern);

                if (match) {
                    const name = match[1]!;
                    const column = line.indexOf(name);

                    if (type === 'property' && contextStack.length > 0) {
                        const nestedPath = [...contextStack, name].join('.');
                        symbols.push({
                            name: name,
                            fullName: nestedPath,
                            type: 'property',
                            parentName: contextStack[contextStack.length - 1]!,
                            lineNumber: lineNumber,
                            column: column,
                            filePath: filePath
                        });
                    } else {
                        symbols.push({
                            name: name,
                            fullName: name,
                            type: type,
                            lineNumber: lineNumber,
                            column: column,
                            filePath: filePath
                        });
                    }
                }
            } catch (_e: unknown) { /* VS Code symbol API unavailable for this document */ }
        }
        return symbols;
    }

    // Fallback to hardcoded JS/TS regexes
    // Property within object: propertyName: value
    const propertyMatch = trimmedLine.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:\s*/);
    if (propertyMatch) {
        const propertyName = propertyMatch[1]!;
        const column = line.indexOf(propertyName);

        if (contextStack.length > 0) {
            // Nested property: parentObject.propertyName
            const nestedPath = [...contextStack, propertyName].join('.');
            symbols.push({
                name: propertyName,
                fullName: nestedPath,
                type: 'property',
                parentName: contextStack[contextStack.length - 1]!,
                lineNumber: lineNumber,
                column: column,
                filePath: filePath
            });
        } else {
            // Top-level property
            symbols.push({
                name: propertyName,
                fullName: propertyName,
                type: 'property',
                lineNumber: lineNumber,
                column: column,
                filePath: filePath
            });
        }
    }

    // Function declarations: function name() {}
    const functionMatch = trimmedLine.match(/function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/);
    if (functionMatch) {
        const funcName = functionMatch[1]!;
        const column = line.indexOf(funcName);
        symbols.push({
            name: funcName,
            fullName: funcName,
            type: 'function',
            lineNumber: lineNumber,
            column: column,
            filePath: filePath
        });
    }

    // Const declarations: const NAME = ...
    const constMatch = trimmedLine.match(/const\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=/);
    if (constMatch) {
        const constName = constMatch[1]!;
        const column = line.indexOf(constName);
        symbols.push({
            name: constName,
            fullName: constName,
            type: 'const',
            lineNumber: lineNumber,
            column: column,
            filePath: filePath
        });
    }

    // Class declarations: class ClassName {}
    const classMatch = trimmedLine.match(/class\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/);
    if (classMatch) {
        const className = classMatch[1]!;
        const column = line.indexOf(className);
        symbols.push({
            name: className,
            fullName: className,
            type: 'class',
            lineNumber: lineNumber,
            column: column,
            filePath: filePath
        });
    }

    // Interface declarations: interface InterfaceName {}
    const interfaceMatch = trimmedLine.match(/interface\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/);
    if (interfaceMatch) {
        const interfaceName = interfaceMatch[1]!;
        const column = line.indexOf(interfaceName);
        symbols.push({
            name: interfaceName,
            fullName: interfaceName,
            type: 'interface',
            lineNumber: lineNumber,
            column: column,
            filePath: filePath
        });
    }

    return symbols;
}

// ────────────────────────────────────────────────────────────────────────────
// Changed line extraction
// ────────────────────────────────────────────────────────────────────────────

/**
 * Extract line numbers that were changed in patch
 */
function extractChangedLineNumbers(patch: string): number[] {
    const changedLines: number[] = [];
    const lines = patch.split('\n');
    let currentLineNumber = 0;

    for (const line of lines) {
        // Parse @@ -a,b +c,d @@ headers
        const hunkHeader = line.match(/^@@ -\d+,?\d* \+(\d+),?\d* @@/);
        if (hunkHeader) {
            currentLineNumber = parseInt(hunkHeader[1]!, 10);
            continue;
        }

        // Track added/modified lines
        if (line.startsWith('+') && !line.startsWith('+++')) {
            changedLines.push(currentLineNumber);
            currentLineNumber++;
        } else if (!line.startsWith('-')) {
            currentLineNumber++;
        }
    }

    return changedLines;
}

// ────────────────────────────────────────────────────────────────────────────
// Used-symbol checking
// ────────────────────────────────────────────────────────────────────────────

/**
 * Simplified getUsedSymbols — works with root symbols only.
 * When root symbol is found, automatically includes all child properties.
 */
async function getUsedSymbols(
    dependentPath: string,
    prFilePath: string,
    changedSymbols: IChangedSymbol[],
    ctx: ISymbolExtractorContext
): Promise<string[]> {
    const usedSymbols: string[] = [];

    if (!changedSymbols || changedSymbols.length === 0) {
        return usedSymbols;
    }

    try {
        aidaLogging(`      🔍 Checking dependent: ${dependentPath}`);
        aidaLogging(`         Root symbols to check: [${changedSymbols.map((s: IChangedSymbol) => s.fullName).join(', ')}]`);

        const fullDependentPath = path.join(ctx.workspaceRoot, dependentPath);
        const fullPRFilePath = path.join(ctx.workspaceRoot, prFilePath);

        if (!fs.existsSync(fullDependentPath)) {
            aidaLogging(`         ❌ File not found: ${fullDependentPath}`);
            return usedSymbols;
        }

        const symbolFileUri = vscode.Uri.file(fullPRFilePath);

        // Check each root symbol
        for (const symbol of changedSymbols) {
            const symbolPosition = new vscode.Position(symbol.lineNumber, symbol.column);

            aidaLogging(`         🔎 Searching: ${symbol.fullName}`);

            try {
                const result = await resolveBarrelReferences(
                    ctx.barrelResolver,
                    symbolFileUri,
                    symbolPosition,
                    symbol.fullName,
                    new Set<string>(),
                    0
                );

                const allReferences = result.references;

                if (allReferences.length === 0) {
                    aidaLogging(`            ⭕ No references found`);
                    continue;
                }

                aidaLogging(`            🔍 Found ${allReferences.length} total references`);

                // Filter to this dependent file only
                const referencesInDependent = allReferences.filter((ref: vscode.Location) => {
                    const refPath = ref.uri.fsPath;
                    const isSameFile = path.normalize(refPath) === path.normalize(fullDependentPath);
                    const isNotDefinition = ref.range.start.line !== symbol.lineNumber;
                    return isSameFile && isNotDefinition;
                });

                if (referencesInDependent.length > 0) {
                    // Filter out barrel exports
                    const realRefs: vscode.Location[] = [];
                    for (const ref of referencesInDependent) {
                        const isBarrel = await isBarrelExportHelper(ctx.barrelResolver, ref);
                        if (!isBarrel) {
                            realRefs.push(ref);
                        }
                    }

                    if (realRefs.length > 0) {
                        usedSymbols.push(symbol.fullName);

                        // Also add all child properties
                        if (symbol.children && symbol.children.length > 0) {
                            usedSymbols.push(...symbol.children);
                        }

                        aidaLogging(`            ✅ Found ${realRefs.length} real usages`);
                        if (symbol.children && symbol.children.length > 0) {
                            aidaLogging(`            ✅ Including ${symbol.children.length} child properties`);
                        }
                    }
                }

            } catch (_error: unknown) {
                const error = toError(_error);
                aidaLogging(`            ❌ Reference error: ${error.message}`);
            }
        }

        if (usedSymbols.length > 0) {
            aidaLogging(`         ✅ Total confirmed: ${usedSymbols.length} symbols`);
        } else {
            aidaLogging(`         ℹ️ No symbols from PR file used`);
        }

        return usedSymbols;
    } catch (_error: unknown) {
        const error = toError(_error);
        aidaLogging(`      ❌ Analysis failed for ${dependentPath}:`, error.message);
        return [];
    }
}

// ES exports
export {
    extractChangedSymbolsHybrid,
    extractChangedSymbolsVscode,
    extractChangedSymbolsRegex,
    extractSymbolsFromLine,
    extractChangedLineNumbers,
    getUsedSymbols,
};
