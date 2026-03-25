/**
 * @module aida-config
 * @description Centralized configuration & defaults for the AIDA extension.
 * 
 * ALL magic values, default settings, and tunable constants should live here
 * so they can be changed in one place instead of hunting across files.
 * 
 * Settings are read from VS Code's `aida.*` configuration when available,
 * falling back to the hardcoded defaults below.
 */

import * as vscode from 'vscode';
import type { IAidaDefaults } from './interfaces/aida-config.interface';

// ─── Default Constants ───────────────────────────────────────────────
const DEFAULTS: Readonly<IAidaDefaults> = Object.freeze({

    /** Default Copilot model family for the AIDA chatbot sidebar */
    CHATBOT_DEFAULT_MODEL: 'claude-opus-4.6',

    /** Keyword used to locate the preferred model in the Copilot model list */
    CHATBOT_PREFERRED_MODEL_KEYWORD: 'opus',

    /** Model used for external AI (non-Copilot) calls */
    EXTERNAL_AI_MODEL: 'Claude-4-Sonnet',

    /** External AI host URL */
    EXTERNAL_AI_HOST: 'https://api.openai.com',

    /** Scroll-to-bottom threshold in pixels */
    SCROLL_BOTTOM_THRESHOLD: 60,

    // ─── Token / Context Limits ──────────────────────────────────
    /** Maximum context length for chatbot prompts (chars) */
    MAX_CONTEXT_LENGTH: 8000,

    /** Max tokens for chatbot streaming responses */
    MAX_TOKENS_CHAT: 4000,

    /** Max tokens for comprehensive AI review responses */
    MAX_TOKENS_REVIEW: 8000,

    /** Copilot prompt soft limit (chars) — triggers warning */
    COPILOT_SOFT_LIMIT: 25000,

    /** Copilot prompt hard limit (chars) — likely failure */
    COPILOT_HARD_LIMIT: 32000,

    // ─── Network ─────────────────────────────────────────────────
    /** HTTP request timeout for PR-fetch calls (ms) */
    PR_FETCH_TIMEOUT_MS: 15000,

    /** HTTP request timeout for Azure DevOps API (ms) */
    AZURE_API_TIMEOUT_MS: 10000,

    /** Retry delays for chatbot model fallback (ms) */
    RETRY_DELAYS: [500, 1000, 2000, 3000, 5000] as const,

    /** Maximum number of retries for model fallback */
    MAX_RETRIES: 5,
});

// ─── Helper to read VS Code settings with fallback ──────────────────
/**
 * Read a value from VS Code `aida.*` configuration.
 * @param key      Setting key without "aida." prefix  (e.g. "chatbot.defaultModel")
 * @param fallback Value to return when the setting is empty/unset
 * @returns The configuration value, or `fallback` if unset.
 */
function getSetting<T>(key: string, fallback: T): T {
    const config = vscode.workspace.getConfiguration('aida');
    return config.get<T>(key, fallback);
}

// ─── Public API ──────────────────────────────────────────────────────
/**
 * Get the default model family for the chatbot sidebar.
 * Reads `aida.chatbot.defaultModel` from settings, falls back to DEFAULTS.
 */
function getChatbotDefaultModel() {
    return getSetting('chatbot.defaultModel', DEFAULTS.CHATBOT_DEFAULT_MODEL);
}

/**
 * Get the keyword used to find the preferred model in the Copilot model list.
 * Reads `aida.chatbot.preferredModelKeyword`, falls back to DEFAULTS.
 */
function getChatbotPreferredModelKeyword() {
    return getSetting('chatbot.preferredModelKeyword', DEFAULTS.CHATBOT_PREFERRED_MODEL_KEYWORD);
}

// ES exports
export { DEFAULTS, getSetting, getChatbotDefaultModel, getChatbotPreferredModelKeyword };
