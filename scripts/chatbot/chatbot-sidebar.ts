/**
 * @module chatbot-sidebar
 * @description Thin facade that re-exports everything from the split sub-modules.
 * The original monolith (~1,205 LOC) was split during Phase 6 refactoring into:
 *   - sidebar-core.ts        - Class definition, constructor, lifecycle, thin wrappers
 *   - sidebar-history.ts     - Chat history management (load/save/clear/restore)
 *   - sidebar-messaging.ts   - processChatMessage pipeline, determineParticipant
 *   - sidebar-participants.ts - Participant routing, mock-stream, template helpers, fallback
 */

// Re-export the three public symbols that consumers depend on
export { CopilotSidebarChat, AidaChatViewProvider, initializeCopilotSidebarChat } from './sidebar-core';
