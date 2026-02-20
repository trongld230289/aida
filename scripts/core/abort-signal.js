/**
 * @module abort-signal
 * @description Global abort signal management for review operations
 * Extracted from review-common.js during Phase 1 refactoring
 */

// Global AbortController for cancellation
let globalAbortSignal = null;

/**
 * Set global abort signal for review operations
 * @param {AbortSignal} signal - The abort signal to use
 */
function setGlobalAbortSignal(signal) {
    globalAbortSignal = signal;
}

/**
 * Get global abort signal for review operations
 * @returns {AbortSignal|null} - The current abort signal
 */
function getGlobalAbortSignal() {
    return globalAbortSignal;
}

module.exports = {
    setGlobalAbortSignal,
    getGlobalAbortSignal
};
