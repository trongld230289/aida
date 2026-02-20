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

const vscode = require('vscode');

// ─── Default Constants ───────────────────────────────────────────────
const DEFAULTS = Object.freeze({

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
});

// ─── Helper to read VS Code settings with fallback ──────────────────
/**
 * Read a value from VS Code `aida.*` configuration.
 * @param {string} key   - Setting key without "aida." prefix  (e.g. "chatbot.defaultModel")
 * @param {*}      fallback - Value to return when the setting is empty/unset
 * @returns {*}
 */
function getSetting(key, fallback) {
    const config = vscode.workspace.getConfiguration('aida');
    return config.get(key, fallback);
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

module.exports = {
    DEFAULTS,
    getSetting,
    getChatbotDefaultModel,
    getChatbotPreferredModelKeyword,
};
