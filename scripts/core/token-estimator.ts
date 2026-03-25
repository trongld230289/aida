/**
 * @module token-estimator
 * @description Token counting and cost estimation utilities
 * Extracted from review-common.js during Phase 1 refactoring
 */

import { aidaLogging } from './settings';
import { ITokenCost } from './interfaces/token-estimator.interface';
import type { ITokenEstimate } from './interfaces/token-estimator.interface';

// Re-export so existing consumers can still import from this module
export type { ITokenCost, ITokenEstimate };

/**
 * Estimate token count from text using approximate ratios
 */
function estimateTokenCount(text: string | null | undefined): number {
    if (!text || typeof text !== 'string') return 0;

    const charCount = text.length;
    const avgCharsPerToken = 3.8;

    return Math.ceil(charCount / avgCharsPerToken);
}

/**
 * Normalize model family name into a consistent slug for logging/tracking.
 * Dynamic — no hardcoded model list. Turns any "Claude Sonnet 4" → "claude-sonnet-4".
 */
function normalizeModelFamily(modelFamily: string | null | undefined): string {
    if (!modelFamily || typeof modelFamily !== 'string') {
        return 'unknown';
    }

    const slug = modelFamily
        .toLowerCase()
        .trim()
        .replace(/[\s_]+/g, '-')
        .replace(/[^a-z0-9.\-]/g, '')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');

    return slug || 'unknown';
}

/**
 * Get estimated cost for token usage based on model
 */
function estimateCost(
    inputTokens: number,
    outputTokens: number,
    modelFamily: string | { family?: string },
    provider: string | null = null,
    _apiHost: string | null = null
): ITokenCost {
    // For backward compatibility, handle old function signature
    if (typeof modelFamily === 'object' && modelFamily.family) {
        modelFamily = modelFamily.family;
    }

    const modelKey = normalizeModelFamily(modelFamily as string);

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

export { estimateTokenCount, normalizeModelFamily, estimateCost };
