// Global type declarations for AIDA extension
// Extends Node.js globalThis with AIDA-specific properties
// used by the installGlobalBridge() proxy in aida-context.ts

declare namespace NodeJS {
    interface Global {
        [key: string]: unknown;
    }
}

// Allow indexing on globalThis
declare let global: NodeJS.Global & typeof globalThis & { [key: string]: unknown };

// Build-time injected constants (edition.config.js via webpack DefinePlugin)
declare const __ENCRYPTION_SECRET__: string;
declare const __FORCE_TRACKING__: boolean;
declare const __APP_INSIGHTS_IKEY__: string;
declare const __APP_INSIGHTS_ENDPOINT__: string;
declare const __APP_INSIGHTS_APP_ID__: string;
