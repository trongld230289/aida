/**
 * @module core/interfaces/ai-provider
 * @description Interfaces for AI provider response mapping.
 */

/** Normalised AI model response (provider-agnostic) */
export interface IAIResponse {
    content: string | null;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
}
