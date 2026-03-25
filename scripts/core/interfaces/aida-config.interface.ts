/**
 * @module IAidaConfig
 * @description Configuration interfaces for AIDA extension settings.
 */

/** Default constants for the AIDA extension */
export interface IAidaDefaults {
    readonly CHATBOT_DEFAULT_MODEL: string;
    readonly CHATBOT_PREFERRED_MODEL_KEYWORD: string;
    readonly EXTERNAL_AI_MODEL: string;
    readonly EXTERNAL_AI_HOST: string;
    readonly SCROLL_BOTTOM_THRESHOLD: number;

    // ─── Token / Context Limits ──────────────────────────────────
    /** Maximum context length for chatbot prompts (chars) */
    readonly MAX_CONTEXT_LENGTH: number;
    /** Max tokens for chatbot streaming responses */
    readonly MAX_TOKENS_CHAT: number;
    /** Max tokens for comprehensive AI review responses */
    readonly MAX_TOKENS_REVIEW: number;
    /** Copilot prompt soft limit (chars) — triggers warning */
    readonly COPILOT_SOFT_LIMIT: number;
    /** Copilot prompt hard limit (chars) — likely failure */
    readonly COPILOT_HARD_LIMIT: number;

    // ─── Network ─────────────────────────────────────────────────
    /** HTTP request timeout for PR-fetch calls (ms) */
    readonly PR_FETCH_TIMEOUT_MS: number;
    /** HTTP request timeout for Azure DevOps API (ms) */
    readonly AZURE_API_TIMEOUT_MS: number;
    /** Retry delays for chatbot model fallback (ms) */
    readonly RETRY_DELAYS: readonly number[];
    /** Maximum number of retries for model fallback */
    readonly MAX_RETRIES: number;
}

/** Resolved AIDA configuration (VS Code settings merged with defaults) */
export interface IAidaConfig {
    /** Model family used by the chatbot sidebar */
    chatbotDefaultModel: string;
    /** Keyword for locating preferred model in Copilot model list */
    chatbotPreferredModelKeyword: string;
    /** Model used for external (non-Copilot) AI calls */
    externalAiModel: string;
    /** Host URL for external AI provider */
    externalAiHost: string;
    /** Whether debug mode is active */
    debugMode: boolean;
}
