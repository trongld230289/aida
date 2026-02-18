/**
 * Centralized enums/constants for usage tracking.
 * Used across all AIDA extension modules to avoid magic strings.
 * 
 * @module tracking-enums
 */

/**
 * Event names sent to Application Insights
 */
const TrackingEvent = Object.freeze({
    EXTENSION_ACTIVATED: 'extension_activated',
    OPEN_CHAT: 'open_chat',
    REVIEW_FILE: 'review_file',
    REVIEW_CHANGES: 'review_changes',
    REVIEW_ALL_CHANGES: 'review_all_changes',
    REVIEW_PR: 'review_pr',
    ANALYZE_DEPENDENCY: 'analyze_dependency',
    ANALYZE_DEPENDENCY_PR: 'analyze_dependency_pr',
    ANALYZE_DEPENDENCY_AI_PR: 'analyze_dependency_ai_pr',
    ANALYZE_DEPENDENCY_AI_NODE: 'analyze_dependency_ai_node',
    SYNC_REVIEW_TEMPLATES: 'sync_review_templates',
    SCAN_APP: 'scan_app'
});

/**
 * AI provider identifiers
 */
const AiProvider = Object.freeze({
    GITHUB_COPILOT: 'github_copilot',
    AIDA_CHATBOT: 'aida_chatbot'
});

/**
 * Sources / entry points where tracking is triggered
 */
const TrackingSource = Object.freeze({
    CHAT_PARTICIPANT: 'chat_participant',
    AIDA_CHATBOT: 'aida_chatbot',
    CONTEXT_MENU: 'context_menu',
    WEBVIEW_BUTTON: 'webview_button'
});

/**
 * Identity provider configuration with priority.
 * Lower number = higher priority (checked first).
 * 
 * To reorder: just change the `priority` number.
 * To disable: set `enabled: false`.
 * 
 * Available providers:
 *   WINDOWS  - Windows domain\username (via os.userInfo + env vars). Best for enterprise/offline.
 *   MICROSOFT - Microsoft account (Azure AD / personal). Requires login.
 *   GITHUB   - GitHub account. Requires login.
 *   GIT_EMAIL - Git config user.email. Available if git is configured.
 *   MACHINE_ID - VS Code machineId hash. Always available but not human-readable.
 */
const IdentityProvider = Object.freeze({
    WINDOWS:    { type: 'windows',    priority: 1, enabled: true },
    MICROSOFT:  { type: 'microsoft',  priority: 2, enabled: true },
    GITHUB:     { type: 'github',     priority: 3, enabled: true },
    GIT_EMAIL:  { type: 'git',        priority: 4, enabled: true },
    MACHINE_ID: { type: 'anonymous',  priority: 5, enabled: true }
});

module.exports = {
    TrackingEvent,
    AiProvider,
    TrackingSource,
    IdentityProvider
};
