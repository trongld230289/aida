/**
 * @module chatbot/interfaces/language-processor
 * @description Interfaces for language detection and pattern matching.
 */

/** A set of regex patterns for context-need classification */
export interface IPatternSet {
    CONTEXT_REQUIRED: RegExp[];
    NO_CONTEXT: RegExp[];
    CONTEXT_KEYWORDS?: string[];
    GENERAL_KEYWORDS?: string[];
}

/** Result of checking user input against context patterns */
export interface IPatternCheckResult {
    needsContext: boolean | null;
    matched: string | null;
    confidence?: number;
}

/** Keyword scoring breakdown (contextual vs general) */
export interface IKeywordScores {
    contextual: number;
    general: number;
}
