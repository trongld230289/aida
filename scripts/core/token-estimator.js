/**
 * @module token-estimator
 * @description Token counting and cost estimation utilities
 * Extracted from review-common.js during Phase 1 refactoring
 */

const { aidaLogging } = require('./settings');

/**
 * Estimate token count from text using approximate ratios
 * @param {string} text - Input text to count tokens for
 * @returns {number} - Estimated token count
 */
function estimateTokenCount(text) {
    if (!text || typeof text !== 'string') return 0;

    // Approximate token-to-character ratios for different languages
    // English: ~4 characters per token
    // Code: ~3.5 characters per token (more dense)
    // Mixed content: ~3.8 characters per token

    const charCount = text.length;
    const avgCharsPerToken = 3.8;

    return Math.ceil(charCount / avgCharsPerToken);
}

/**
 * Normalize model family name into a consistent slug for logging/tracking.
 * Dynamic — no hardcoded model list. Turns any "Claude Sonnet 4" → "claude-sonnet-4".
 * Works automatically with new models added to Copilot in the future.
 *
 * @param {string} modelFamily - Raw model family name (from vscode.lm model.family or user input)
 * @returns {string} - Normalized slug (lowercase, hyphen-separated)
 */
function normalizeModelFamily(modelFamily) {
    if (!modelFamily || typeof modelFamily !== 'string') {
        return 'unknown';
    }

    // Slug-ify: lowercase, collapse whitespace/underscores to hyphens, trim edges
    const slug = modelFamily
        .toLowerCase()
        .trim()
        .replace(/[\s_]+/g, '-')   // spaces & underscores → hyphens
        .replace(/[^a-z0-9.\-]/g, '') // strip non-alphanumeric (keep dots for versions)
        .replace(/-+/g, '-')       // collapse multiple hyphens
        .replace(/^-|-$/g, '');    // trim leading/trailing hyphens

    return slug || 'unknown';
}

/**
 * Get estimated cost for token usage based on model
 * @param {number} inputTokens - Input token count
 * @param {number} outputTokens - Output token count
 * @param {string} modelFamily - Model family name
 * @param {string} provider - Provider name (optional)
 * @param {string} apiHost - API host (optional)
 * @returns {object} - Cost breakdown
 */
function estimateCost(inputTokens, outputTokens, modelFamily, provider = null, apiHost = null) {
    // For backward compatibility, handle old function signature
    if (typeof modelFamily === 'object' && modelFamily.family) {
        modelFamily = modelFamily.family;
    }

    // Normalize model name for lookup
    const modelKey = normalizeModelFamily(modelFamily);

    aidaLogging(`💰 Token usage: ${provider}/${modelKey} - ${inputTokens}+${outputTokens} tokens`);

    return {
        inputCost: 0,
        outputCost: 0,
        totalCost: 0,
        inputRate: 0,
        outputRate: 0,
        provider: provider || 'unknown',
        modelKey: modelKey,
        currency: 'USD'
    };
}

module.exports = {
    estimateTokenCount,
    normalizeModelFamily,
    estimateCost
};
