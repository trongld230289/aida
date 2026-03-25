/**
 * @module aida-context
 * @description Singleton context holding all shared state for the AIDA extension.
 *
 * Replaces scattered `global.*` variables with a typed, centralized store.
 * Every module accesses state through `AidaContext.instance` instead of the
 * Node.js `global` object.
 *
 * Migration mapping:
 *   global.extensionPath        → AidaContext.extensionPath
 *   global.aidaExtensionContext  → AidaContext.extensionContext
 *   global.selectedBusinessDocs → AidaContext.selectedBusinessDocs
 *   global.businessDocsState    → AidaContext.businessDocsState
 *   global.prDiffCache          → AidaContext.prDiffCache
 *   global.currentPRData        → AidaContext.currentPRData
 */

import * as vscode from 'vscode';
import {
    IBusinessDocCategory, IBusinessDocsReviewState, IBusinessDocsState,
    IDiffCacheEntry, IPrDiffCache, IPRData,
} from './interfaces/context.interface';

// Re-export so existing consumers can still import from this module
export type {
    IBusinessDocCategory, IBusinessDocsReviewState, IBusinessDocsState,
    IDiffCacheEntry, IPrDiffCache, IPRData,
};

// ─── AidaContext Singleton ───────────────────────────────────────────

export class AidaContext {
    private static _instance: AidaContext | null = null;

    // Formerly global.extensionPath
    extensionPath: string = '';

    // Formerly global.aidaExtensionContext
    extensionContext: vscode.ExtensionContext | null = null;

    // Formerly global.selectedBusinessDocs
    selectedBusinessDocs: IBusinessDocCategory[] | null = null;

    // Formerly global.businessDocsState
    businessDocsState: IBusinessDocsState = {
        'changes-review': { selectedCategories: new Set(), allCategories: [] },
        'file-review': { selectedCategories: new Set(), allCategories: [] },
    };

    // Formerly global.prDiffCache
    prDiffCache: IPrDiffCache = {};

    // Formerly global.currentPRData
    currentPRData: IPRData | null = null;

    private constructor() { }

    /** Get the singleton instance (creates on first call). */
    static get instance(): AidaContext {
        if (!AidaContext._instance) {
            AidaContext._instance = new AidaContext();
        }
        return AidaContext._instance;
    }

    /**
     * Initialize from the VS Code activation context.
     * Called once in `activate()`.
     */
    init(context: vscode.ExtensionContext): void {
        this.extensionPath = context.extensionPath;
        this.extensionContext = context;
    }

}

// ─── Convenience shorthand (avoids `AidaContext.instance` everywhere) ─

/** Module-level shorthand. Import as `import { ctx } from '../core/aida-context';` */
export const ctx = AidaContext.instance;

// ─── Bridge: keep global.* in sync during incremental migration ─────
//
// While JS consumers still read `global.*`, we proxy writes through
// AidaContext so both paths see the same data.  Once all JS files are
// migrated to TS imports, this bridge can be deleted.
// ─────────────────────────────────────────────────────────────────────

export function installGlobalBridge(): void {
    const g = global as any;
    const instance = AidaContext.instance;

    // Define property descriptors so global.* reads/writes go through AidaContext
    Object.defineProperty(g, 'extensionPath', {
        get: () => instance.extensionPath,
        set: (v: string) => { instance.extensionPath = v; },
        configurable: true,
    });
    Object.defineProperty(g, 'aidaExtensionContext', {
        get: () => instance.extensionContext,
        set: (v: vscode.ExtensionContext) => { instance.extensionContext = v; },
        configurable: true,
    });
    Object.defineProperty(g, 'selectedBusinessDocs', {
        get: () => instance.selectedBusinessDocs,
        set: (v: IBusinessDocCategory[] | null) => { instance.selectedBusinessDocs = v; },
        configurable: true,
    });
    Object.defineProperty(g, 'businessDocsState', {
        get: () => instance.businessDocsState,
        set: (v: IBusinessDocsState) => { instance.businessDocsState = v; },
        configurable: true,
    });
    Object.defineProperty(g, 'prDiffCache', {
        get: () => instance.prDiffCache,
        set: (v: IPrDiffCache) => { instance.prDiffCache = v; },
        configurable: true,
    });
    Object.defineProperty(g, 'currentPRData', {
        get: () => instance.currentPRData,
        set: (v: IPRData | null) => { instance.currentPRData = v; },
        configurable: true,
    });
}

// CommonJS compat
