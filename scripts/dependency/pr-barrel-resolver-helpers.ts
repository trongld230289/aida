import * as vscode from 'vscode';
import * as path from 'path';
import { BarrelResolver } from './graph/barrel-resolver';

/**
 * Barrel/re-export resolution helpers for PRDependencyAnalyzer.
 * Thin delegates to BarrelResolver + language configuration utilities.
 */

/**
 * Recursively resolve references through barrel exports with better error handling
 */
async function resolveBarrelReferences(
    barrelResolver: BarrelResolver,
    symbolUri: vscode.Uri,
    symbolPosition: vscode.Position,
    symbolName: string,
    visitedBarrels: Set<string>,
    currentLevel = 0
) {
    return await barrelResolver.resolveBarrelReferences(
        symbolUri,
        symbolPosition,
        symbolName,
        visitedBarrels,
        currentLevel
    );
}

/**
 * Get the exported symbol name and position from a barrel export line
 * @param barrelResolver - BarrelResolver instance
 * @param barrelLocation - Location of barrel export
 * @returns Symbol info or null
 */
async function getBarrelExportSymbol(
    barrelResolver: BarrelResolver,
    barrelLocation: vscode.Location
) {
    return await barrelResolver.getBarrelExportSymbolImproved(barrelLocation, null);
}

/**
 * Improved barrel export symbol parsing
 */
async function getBarrelExportSymbolImproved(
    barrelResolver: BarrelResolver,
    barrelLocation: vscode.Location,
    originalSymbolName: string | null
) {
    return await barrelResolver.getBarrelExportSymbolImproved(barrelLocation, originalSymbolName);
}

/**
 * Find all files that import from a barrel file (for wildcard exports)
 * @param barrelResolver - BarrelResolver instance
 * @param barrelUri - URI of the barrel file
 * @param symbolName - Original symbol name to look for
 */
async function findImportsOfBarrelFile(
    barrelResolver: BarrelResolver,
    barrelUri: vscode.Uri,
    symbolName: string
) {
    return await barrelResolver.findImportsOfBarrelFileImproved(barrelUri, symbolName, 0);
}

/**
 * Improved version of findImportsOfBarrelFile with level tracking
 */
async function findImportsOfBarrelFileImproved(
    barrelResolver: BarrelResolver,
    barrelUri: vscode.Uri,
    symbolName: string,
    currentLevel = 0
) {
    return await barrelResolver.findImportsOfBarrelFileImproved(barrelUri, symbolName, currentLevel);
}

/**
 * Load TypeScript path aliases from tsconfig
 */
async function loadTSConfigAliases(
    barrelResolver: BarrelResolver,
    workspacePath: string
) {
    return await barrelResolver.loadTSConfigAliases(workspacePath);
}

/**
 * Build import patterns for matching barrel imports
 */
function buildImportPatterns(
    barrelResolver: BarrelResolver,
    importerPath: string,
    barrelDir: string,
    barrelRelativeToWorkspace: string,
    pathAliases: Map<string, string>
) {
    return barrelResolver.buildImportPatterns(
        importerPath,
        barrelDir,
        barrelRelativeToWorkspace,
        pathAliases
    );
}

/**
 * Check if a reference location is a barrel export (re-export line)
 * @param barrelResolver - BarrelResolver instance
 * @param location - Reference location to check
 */
async function isBarrelExport(
    barrelResolver: BarrelResolver,
    location: vscode.Location
) {
    return await barrelResolver.isBarrelExport(location);
}

/**
 * Get language configuration patterns for a file based on its extension
 * @param filePath - File path (used to determine language via extension)
 * @param vscodeAnalyzer - Analyzer instance holding languageConfig
 */
function getLanguagePatterns(filePath: string, vscodeAnalyzer: any) {
    const ext = path.extname(filePath).toLowerCase();

    if (vscodeAnalyzer && vscodeAnalyzer.languageConfig) {
        for (const [_lang, config] of (Object.entries(vscodeAnalyzer.languageConfig) as [string, any][])) {
            if (config.extensions && config.extensions.includes(ext)) {
                return config.symbolPatterns;
            }
        }
    }
    return null;
}

/**
 * Get barrel/entry files for a specific language based on file extension
 * @param filePath - File path (used to determine language via extension)
 * @param vscodeAnalyzer - Analyzer instance holding languageConfig
 */
function getBarrelFiles(filePath: string, vscodeAnalyzer: any) {
    const ext = path.extname(filePath).toLowerCase();

    if (vscodeAnalyzer && vscodeAnalyzer.languageConfig) {
        for (const [_lang, config] of (Object.entries(vscodeAnalyzer.languageConfig) as [string, any][])) {
            if (config.extensions && config.extensions.includes(ext)) {
                if (config.barrelFiles) {
                    return config.barrelFiles;
                }
            }
        }
    }

    // Fallback default
    return ['index.ts', 'index.js', 'index.jsx', 'index.tsx'];
}

// ES exports
export {
    resolveBarrelReferences,
    getBarrelExportSymbol,
    getBarrelExportSymbolImproved,
    findImportsOfBarrelFile,
    findImportsOfBarrelFileImproved,
    loadTSConfigAliases,
    buildImportPatterns,
    isBarrelExport,
    getLanguagePatterns,
    getBarrelFiles,
};
