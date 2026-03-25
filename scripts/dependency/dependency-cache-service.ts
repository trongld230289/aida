import * as fs from 'fs';
import * as path from 'path';
import { aidaLogging } from '../core/settings';
import { toError } from '../core/error-utils';
import { loadJsonFileAsync } from '../core/file-loader';

// Cache management
const CACHE_VERSION = '1.1';
let cacheFilePath: string | null = null;

/**
 * Set the cache file path
 */
function setCacheFilePath(filePath: string | null) {
    cacheFilePath = filePath;
}

/**
 * Get the cache file path
 */
function getCacheFilePath(): string | null {
    return cacheFilePath;
}

/**
 * Check if cache exists and is valid
 */
async function checkCacheExists() {
    try {
        if (!cacheFilePath) return false;

        const cacheStats = await fs.promises.stat(cacheFilePath);
        const cacheAge = Date.now() - cacheStats.mtime.getTime();
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours

        return cacheAge < maxAge;
    } catch (_error: unknown) {
        return false;
    }
}

/**
 * Save analysis result to cache
 */
async function saveToCache(graph: Record<string, any>, report: Record<string, any>, analysisType: string) {
    try {
        if (!cacheFilePath) return;

        // Ensure .vscode directory exists
        const vscodeDir = path.dirname(cacheFilePath);
        await fs.promises.mkdir(vscodeDir, { recursive: true });

        const cacheData = {
            version: CACHE_VERSION,
            timestamp: new Date().toISOString(),
            analysisType,
            graph,
            report
        };

        await fs.promises.writeFile(cacheFilePath, JSON.stringify(cacheData, null, 2));
        aidaLogging('\u{1F4BE} Dependency analysis cached successfully');
    } catch (_error: unknown) {
        const error = toError(_error);
        aidaLogging('\u26A0\uFE0F Failed to save cache:', error.message);
    }
}

/**
 * Load analysis result from cache
 */
async function loadFromCache() {
    try {
        if (!cacheFilePath) return null;

        const cacheData = await loadJsonFileAsync<Record<string, any>>(cacheFilePath);

        if (!cacheData || cacheData.version !== CACHE_VERSION) {
            aidaLogging('\u{1F504} Cache version mismatch, will regenerate');
            return null;
        }

        // Validate cache structure
        if (!cacheData.graph || !cacheData.report || !cacheData.report.summary) {
            aidaLogging('\u26A0\uFE0F Invalid cache data structure, will regenerate');
            return null;
        }

        aidaLogging('\u{1F4BE} Loaded dependency analysis from cache');
        return cacheData;
    } catch (_error: unknown) {
        const error = toError(_error);
        aidaLogging('\u26A0\uFE0F Failed to load cache:', error.message);
        return null;
    }
}

// ES exports
export { setCacheFilePath, getCacheFilePath, checkCacheExists, saveToCache, loadFromCache };
