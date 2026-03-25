/**
 * @module ITokenEstimate
 * @description Token estimation and cost tracking interfaces.
 */

/** Result of token cost estimation */
export interface ITokenCost {
    inputCost: number;
    outputCost: number;
    totalCost: number;
    inputRate: number;
    outputRate: number;
    provider: string;
    modelKey: string;
    currency: string;
}

/** Token usage summary for a single AI call */
export interface ITokenEstimate {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    /** Normalized model family slug (e.g. "claude-sonnet-4") */
    modelFamily: string;
    cost?: ITokenCost;
}
