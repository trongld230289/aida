/**
 * @module file-loader
 * @description Shared file-loading utilities for the AIDA extension.
 *
 * Wraps common `readFileSync` + `JSON.parse` patterns with consistent
 * error handling so callers don't have to repeat try/catch boilerplate.
 */

import * as fs from 'fs';

// ─── JSON Loaders ────────────────────────────────────────────────────

/**
 * Synchronously read a JSON file and parse it into a typed object.
 *
 * @param filePath  Absolute path to the JSON file.
 * @returns The parsed object, or `null` if the file is missing / unparseable.
 *
 * @example
 * ```ts
 * const pkg = loadJsonFileSync<{ version: string }>('/repo/package.json');
 * ```
 */
export function loadJsonFileSync<T = unknown>(filePath: string): T | null {
    try {
        if (!fs.existsSync(filePath)) { return null; }
        return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
    } catch {
        return null;
    }
}

/**
 * Synchronously read a JSON-with-comments file (e.g. `tsconfig.json`),
 * strip single-line (`//`) and block (`/* … *​/`) comments, then parse.
 *
 * @param filePath  Absolute path to the file.
 * @returns The parsed object, or `null` if the file is missing / unparseable.
 */
export function loadJsonWithCommentsSync<T = unknown>(filePath: string): T | null {
    try {
        if (!fs.existsSync(filePath)) { return null; }
        const raw = fs.readFileSync(filePath, 'utf8');
        const stripped = raw.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
        return JSON.parse(stripped) as T;
    } catch {
        return null;
    }
}

/**
 * Asynchronously read a JSON file and parse it into a typed object.
 *
 * @param filePath  Absolute path to the JSON file.
 * @returns The parsed object, or `null` if the file is missing / unparseable.
 */
export async function loadJsonFileAsync<T = unknown>(filePath: string): Promise<T | null> {
    try {
        if (!fs.existsSync(filePath)) { return null; }
        const raw = await fs.promises.readFile(filePath, 'utf8');
        return JSON.parse(raw) as T;
    } catch {
        return null;
    }
}

// ─── Text / Template Loaders ─────────────────────────────────────────

/**
 * Synchronously read a text file (HTML template, Markdown, source code, etc.).
 *
 * @param filePath  Absolute path to the file.
 * @returns The file content string, or `null` if the file is missing / unreadable.
 */
export function loadTextFileSync(filePath: string): string | null {
    try {
        if (!fs.existsSync(filePath)) { return null; }
        return fs.readFileSync(filePath, 'utf8');
    } catch {
        return null;
    }
}

/**
 * Synchronously read an HTML template and perform placeholder replacements.
 *
 * Each key in `replacements` is treated as a global regex pattern
 * (e.g. `{{FILE_NAME}}`) and every occurrence is replaced with its value.
 *
 * @param filePath      Absolute path to the HTML template.
 * @param replacements  Map of placeholder → replacement value.
 * @returns The processed HTML string, or `null` if the file is missing.
 *
 * @example
 * ```ts
 * const html = loadHtmlTemplate(templatePath, {
 *   '{{FILE_NAME}}': 'app.component.ts',
 *   '{{CONTENT}}': analysisHtml,
 * });
 * ```
 */
export function loadHtmlTemplate(
    filePath: string,
    replacements: Record<string, string>,
): string | null {
    const raw = loadTextFileSync(filePath);
    if (raw === null) { return null; }

    let result = raw;
    for (const [placeholder, value] of Object.entries(replacements)) {
        // Escape regex special chars in the placeholder key
        const escaped = placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        result = result.replace(new RegExp(escaped, 'g'), value);
    }
    return result;
}

// ─── CJS dual export for backward compatibility ──────────────────────
