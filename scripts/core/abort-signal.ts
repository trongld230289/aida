/**
 * @module abort-signal
 * @description Global abort signal management for review operations
 * Extracted from review-common.js during Phase 1 refactoring
 */

// Global AbortController for cancellation
let globalAbortSignal: AbortSignal | null = null;

/**
 * Set global abort signal for review operations
 */
function setGlobalAbortSignal(signal: AbortSignal | null): void {
    globalAbortSignal = signal;
}

/**
 * Get global abort signal for review operations
 */
function getGlobalAbortSignal(): AbortSignal | null {
    return globalAbortSignal;
}

export { setGlobalAbortSignal, getGlobalAbortSignal };
