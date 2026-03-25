/**
 * Centralized enums/constants for usage tracking.
 * Used across all AIDA extension modules to avoid magic strings.
 * 
 * @module tracking-enums
 */

import * as vscode from 'vscode';

/**
 * Event names sent to Application Insights
 */
const TrackingEvent = Object.freeze({
    EXTENSION_ACTIVATED: 'extension_activated',
    REVIEW_FILE: 'review_file',
    REVIEW_CHANGES: 'review_changes',
    REVIEW_ALL_CHANGES: 'review_all_changes',
    REVIEW_PR: 'review_pr',
    ANALYZE_DEPENDENCY: 'analyze_dependency',
    ANALYZE_DEPENDENCY_PR: 'analyze_dependency_pr',
    ANALYZE_DEPENDENCY_AI_PR: 'analyze_dependency_ai_pr',
    ANALYZE_DEPENDENCY_AI_NODE: 'analyze_dependency_ai_node',
    SYNC_REVIEW_TEMPLATES: 'sync_review_templates'
});

/**
 * AI provider identifiers
 */
const AiProvider = Object.freeze({
    GITHUB_COPILOT: 'github_copilot',
    AIDA_CHATBOT: 'aida_chatbot',
    CURSOR: 'cursor'
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
 * Review mode: Quick (no business docs) vs Enhanced (with business docs)
 */
const ReviewMode = Object.freeze({
    QUICK: 'quick',
    ENHANCED: 'enhanced'
});

/**
 * Determine the current review mode based on global.selectedBusinessDocs.
 * @returns {'quick' | 'enhanced'} The review mode
 */
function getReviewMode(): string {
    const docs = (global as any).selectedBusinessDocs;
    if (docs && Array.isArray(docs) && docs.length > 0) {
        return ReviewMode.ENHANCED;
    }
    return ReviewMode.QUICK;
}

/**
 * Detect AI provider based on the IDE (VS Code → GitHub Copilot, Cursor → Cursor).
 * Use this for chat participant tracking where the IDE determines the AI backend.
 * For AIDA Chatbot sidebar, always use AiProvider.AIDA_CHATBOT directly.
 * @returns {string} The AI provider identifier
 */
function getIdeAiProvider(): string {
    const appName = (vscode.env.appName || '').toLowerCase();
    if (appName.includes('cursor')) {
        return AiProvider.CURSOR;
    }
    return AiProvider.GITHUB_COPILOT;
}

// ES exports
export { TrackingEvent, AiProvider, TrackingSource, ReviewMode, getReviewMode, getIdeAiProvider };
