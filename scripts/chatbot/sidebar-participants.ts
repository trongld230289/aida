/**
 * @module sidebar-participants
 * @description Participant routing, mock-stream builder, template helpers,
 *              and fallback response generation.
 * Extracted from chatbot-sidebar.ts during Phase 6 refactoring.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { aidaLogging } from '../core/settings';
import { trackEvent } from '../tracking/usage-tracking';
import { TrackingEvent, AiProvider, TrackingSource } from '../tracking/tracking-enums';
import { processReviewFile } from '../review/review-file';
import { processReviewChanges } from '../review/review-changes';
import { processReviewAllChanges } from '../review/review-all-changes';
import { processReviewPr } from '../review/review-pr';
import { aiSyncReviewTemplates } from '../review/sync-review-templates';
import { aiDependencyAnalysis, aiDependencyPrAnalysis } from '../dependency/dependency';
import type { IMockStream } from '../core/interfaces/shared-state.interface';
import type { AidaChatbotService } from './chatbot-service';
import { toError } from '../core/error-utils';

// ─── Mock Stream Builder ─────────────────────────────────────────────

/**
 * Build a mock stream object that matches VS Code ChatResponseStream API.
 * Returns the stream and a getter for the accumulated result text.
 */
export function buildMockStream(
    streamCallback: ((chunk: string) => void) | null
): { mockStream: IMockStream; getResult: () => string } {
    let result = '';
    const isStreaming = typeof streamCallback === 'function';

    const mockStream: IMockStream = {
        markdown: (text: string) => {
            if (text) {
                result += text;
                if (isStreaming) { streamCallback(text); }
            }
            return mockStream;
        },
        button: (button: Record<string, string>) => {
            if (button && button.title) {
                // Use simple placeholder with encoded data
                const buttonId = 'AIDA_BTN_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                const buttonHtml = `<span data-button-id="${buttonId}" data-title="${button.title}" data-command="${button.command || ''}" data-args='${JSON.stringify(button.arguments || [])}' data-tooltip="${button.tooltip || button.title}" class="button-placeholder">[${button.title}]</span> `;
                result += buttonHtml;
                if (isStreaming) { streamCallback(buttonHtml); }
            }
            return mockStream;
        },
        progress: (text: string) => {
            if (text) {
                const progressText = '\u{1F504} ' + text + '\n';
                result += progressText;
                if (isStreaming) { streamCallback(progressText); }
            }
            return mockStream;
        },
        filetree: (tree: unknown[]) => {
            if (tree) {
                const treeText = '\n**File Tree:**\n' + JSON.stringify(tree, null, 2) + '\n\n';
                result += treeText;
                if (isStreaming) { streamCallback(treeText); }
            }
            return mockStream;
        },
        anchor: (anchor: Record<string, string>) => {
            if (anchor && anchor.value) {
                const anchorText = '[' + (anchor.title || anchor.value) + '](' + anchor.value + ')';
                result += anchorText;
                if (isStreaming) { streamCallback(anchorText); }
            }
            return mockStream;
        },
        reference: (ref: Record<string, string>) => {
            if (ref && ref.value) {
                const refText = '\u{1F50E} Reference: ' + ref.value + '\n';
                result += refText;
                if (isStreaming) { streamCallback(refText); }
            }
            return mockStream;
        }
    };

    return { mockStream, getResult: () => result };
}

// ─── Template Helpers ────────────────────────────────────────────────

/**
 * Ensure AIDA templates folder exists (like Copilot does)
 */
export async function ensureAidaTemplatesExist(
    context: vscode.ExtensionContext,
    webviewView: vscode.WebviewView | null
): Promise<void> {
    try {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            aidaLogging('\u26A0\uFE0F No workspace folder found for AIDA templates');
            return;
        }

        const aidaPath = path.join(workspaceFolder.uri.fsPath, 'AIDA');
        const templatesPath = path.join(aidaPath, 'templates');

        // Check if AIDA templates already exist
        if (fs.existsSync(templatesPath)) {
            aidaLogging('\u2705 AIDA templates already exist');
            return;
        }

        aidaLogging('\u{1F504} AIDA Chatbot: Creating AIDA templates folder...');

        // Create AIDA/templates directory
        fs.mkdirSync(templatesPath, { recursive: true });

        // Copy templates from extension to workspace
        const extensionTemplatesPath = path.join(context.extensionPath, 'templates');
        if (fs.existsSync(extensionTemplatesPath)) {
            await copyTemplatesRecursively(extensionTemplatesPath, templatesPath);
            aidaLogging('\u2705 AIDA Chatbot: Templates created successfully');

            // Notify webview
            if (webviewView) {
                webviewView.webview.postMessage({
                    type: 'showNotification',
                    message: '\u2705 AIDA templates created automatically!',
                    isSuccess: true
                });
            }
        } else {
            aidaLogging('\u26A0\uFE0F Extension templates not found');
        }
    } catch (_error: unknown) {
        const error = toError(_error);
        aidaLogging('\u274C Failed to create AIDA templates:', error.message);
    }
}

/**
 * Copy templates recursively
 */
export async function copyTemplatesRecursively(src: string, dest: string): Promise<void> {
    if (!fs.existsSync(src)) return;

    fs.mkdirSync(dest, { recursive: true });
    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            await copyTemplatesRecursively(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

// ─── Participant Router ──────────────────────────────────────────────

/**
 * Call AIDA participant with image support
 */
export async function callParticipant(
    participant: string,
    message: string,
    images: string[],
    streamCallback: ((chunk: string) => void) | null,
    context: vscode.ExtensionContext,
    chatbotService: AidaChatbotService,
    webviewView: vscode.WebviewView | null
): Promise<string> {
    try {
        const { mockStream, getResult } = buildMockStream(streamCallback);
        const messageWithoutParticipant = message.replace(/@[\w-]+\s*/, '').trim();

        switch (participant) {
            case 'review-file':
                try {
                    aidaLogging('\u{1F4DD} AIDA Chat: Calling review-file with streaming');

                    // Tracking now handled inside processReviewFile at execution commit point

                    // Ensure AIDA templates exist before review (like Copilot does)
                    await ensureAidaTemplatesExist(context, webviewView);

                    await processReviewFile(messageWithoutParticipant, mockStream as any);
                    return getResult() || '\u2705 **File Review Complete**\n\nCode analysis completed.';
                } catch (_error: unknown) {
                    const error = toError(_error);
                    aidaLogging('\u274C AIDA Chat review-file error:', error);
                    return '\u274C **Error**: ' + error.message + '\n\nPlease check the console for details.';
                }

            case 'review-changes':
                try {
                    aidaLogging('\u{1F4DD} AIDA Chat: Calling review-changes with streaming');

                    // Tracking now handled inside processReviewChanges at execution commit point

                    // Ensure AIDA templates exist before review (like Copilot does)
                    await ensureAidaTemplatesExist(context, webviewView);

                    await processReviewChanges(messageWithoutParticipant, mockStream as any, null, null, {
                        source: TrackingSource.AIDA_CHATBOT,
                        aiProvider: AiProvider.AIDA_CHATBOT
                    });
                    return getResult() || '\u2705 **Changes Review Complete**\n\nGit changes analysis completed.';
                } catch (_error: unknown) {
                    const error = toError(_error);
                    aidaLogging('\u274C AIDA Chat review-changes error:', error);
                    return '\u274C **Error**: ' + error.message + '\n\nPlease check the console for details.';
                }

            case 'review-all-changes':
                try {
                    aidaLogging('\u{1F4DD} AIDA Chat: Calling review-all-changes with streaming');

                    // Tracking now handled inside processReviewAllChanges at execution commit point

                    // Ensure AIDA templates exist before review (like Copilot does)
                    await ensureAidaTemplatesExist(context, webviewView);

                    await processReviewAllChanges(messageWithoutParticipant, mockStream as any);
                    return getResult() || '\u2705 **All Changes Review Complete**\n\nWorkspace git changes analysis completed.';
                } catch (_error: unknown) {
                    const error = toError(_error);
                    aidaLogging('\u274C AIDA Chat review-all-changes error:', error);
                    return '\u274C **Error**: ' + error.message + '\n\nPlease check the console for details.';
                }

            case 'review-pr':
                try {
                    aidaLogging('\u{1F504} AIDA Chat: Calling review-pr with streaming');

                    // Ensure AIDA templates exist before review (like Copilot does)
                    await ensureAidaTemplatesExist(context, webviewView);

                    await processReviewPr(messageWithoutParticipant, mockStream as any);
                    return getResult() || '\u2705 **PR Review Complete**\n\nPull request analysis completed.';
                } catch (_error: unknown) {
                    const error = toError(_error);
                    aidaLogging('\u274C AIDA Chat review-pr error:', error);
                    return '\u274C **Error**: ' + error.message + '\n\nPlease check the console for details.';
                }

            case 'sync-review-templates':
                try {
                    aidaLogging('\u{1F504} AIDA Chat: Calling sync-review-templates with reusable logic');

                    // Track usage - AIDA Chatbot
                    void trackEvent(TrackingEvent.SYNC_REVIEW_TEMPLATES, {
                        source: TrackingSource.AIDA_CHATBOT,
                        aiProvider: AiProvider.AIDA_CHATBOT
                    });

                    await aiSyncReviewTemplates(messageWithoutParticipant, mockStream as any, null as any, context);
                    return getResult() || '\u2705 **Template Sync Complete**\n\nTemplate synchronization completed.';
                } catch (_error: unknown) {
                    const error = toError(_error);
                    aidaLogging('\u274C AIDA Chat sync-review-templates error:', error);
                    return '\u274C **Error**: ' + error.message + '\n\nPlease check the console for details.';
                }

            case 'dependency':
                try {
                    aidaLogging('\u{1F50D} AIDA Chat: Calling dependency analysis with reusable logic');
                    await aiDependencyAnalysis(messageWithoutParticipant, mockStream as any, null as any, context);
                    return getResult() || '\u2705 **Dependency Analysis Complete**\n\nDependency analysis completed.';
                } catch (_error: unknown) {
                    const error = toError(_error);
                    aidaLogging('\u274C AIDA Chat dependency error:', error);
                    return '\u274C **Error**: ' + error.message + '\n\nPlease check the console for details.';
                }

            case 'dependency-pr':
                try {
                    aidaLogging('\u{1F50D} AIDA Chat: Calling dependency-pr analysis');

                    await aiDependencyPrAnalysis(messageWithoutParticipant, mockStream as any, null as any, context);
                    return getResult() || '\u2705 **Dependency PR Analysis Complete**\n\nPR dependency analysis completed.';
                } catch (_error: unknown) {
                    const error = toError(_error);
                    aidaLogging('\u274C AIDA Chat dependency-pr error:', error);
                    return '\u274C **Error**: ' + error.message + '\n\nPlease check the console for details.';
                }

            default:
                return await generateGeneralResponse(message, images, streamCallback, chatbotService);
        }

    } catch (_error: unknown) {
        const error = toError(_error);
        aidaLogging('\u274C Error calling ' + participant + ' participant:', error);
        return '\u274C **Error**\n\nSorry, I encountered an error: ' + error.message;
    }
}

// ─── General / Fallback Response ─────────────────────────────────────

/**
 * Generate conversational response using AI chatbot service with image support
 */
export async function generateGeneralResponse(
    message: string,
    images: string[],
    streamCallback: ((chunk: string) => void) | null,
    chatbotService: AidaChatbotService
): Promise<string> {
    try {
        aidaLogging('\u{1F4AC} Generating conversational response for:', message);
        if (images && images.length > 0) {
            aidaLogging('\u{1F5BC}\uFE0F Processing with', images.length, 'image(s)');
        }

        // Use AI chatbot service for intelligent conversation with images
        const response = await chatbotService.generateResponse(message, images, streamCallback);

        aidaLogging('\u2705 Generated response length:', response.length);
        return response;

    } catch (error: unknown) {
        aidaLogging('\u274C Error generating conversation response:', error);

        // Fallback to simple response
        return getFallbackResponse(message);
    }
}

/**
 * Fallback response when chatbot service fails
 */
export function getFallbackResponse(message: string): string {
    const isVietnamese = /[\u00e0\u00e1\u1ea3\u00e3\u1ea1\u0103\u1eaf\u1eb1\u1eb3\u1eb5\u1eb7\u00e2\u1ea5\u1ea7\u1ea9\u1eab\u1ead\u0111\u00e8\u00e9\u1ebb\u1ebd\u1eb9\u00ea\u1ebf\u1ec1\u1ec3\u1ec5\u1ec7\u00ec\u00ed\u1ec9\u0129\u1ecb\u00f2\u00f3\u1ecf\u00f5\u1ecd\u00f4\u1ed1\u1ed3\u1ed5\u1ed7\u1ed9\u01a1\u1edb\u1edd\u1edf\u1ee1\u1ee3\u00f9\u00fa\u1ee7\u0169\u1ee5\u01b0\u1ee9\u1eeb\u1eed\u1eef\u1ef1\u1ef3\u00fd\u1ef7\u1ef9\u1ef5]/.test(message);

    if (isVietnamese) {
        return `# \u{1F916} AIDA Assistant

Xin ch\u00e0o! T\u00f4i l\u00e0 AIDA, tr\u1ee3 l\u00fd AI chuy\u00ean v\u1ec1 l\u1eadp tr\u00ecnh.

**T\u00f4i c\u00f3 th\u1ec3 gi\u00fap b\u1ea1n:**
- Tr\u1ea3 l\u1eddi c\u00e2u h\u1ecfi v\u1ec1 coding
- Review v\u00e0 ph\u00e2n t\u00edch code  
- Debug v\u00e0 troubleshooting
- Gi\u1ea3i th\u00edch concepts v\u00e0 patterns

**Commands \u0111\u1eb7c bi\u1ec7t:**
- \`@review-file\` - Review file hi\u1ec7n t\u1ea1i
- \`@review-changes\` - Ph\u00e2n t\u00edch git changes
- \`@review-all-changes\` - Ph\u00e2n t\u00edch T\u1ea4T C\u1ea2 git changes trong workspace
- \`@review-pr\` - Review pull request  
- \`@dependency\` / \`@dependency-pr\` - Impact Analysis (ph\u00e2n t\u00edch \u1ea3nh h\u01b0\u1edfng)
- \`@sync-review-templates\` - Sync templates

B\u1ea1n \u0111ang l\u00e0m g\u00ec th\u00fa v\u1ecb v\u1eady? \u{1F680}`;
    } else {
        return `# \u{1F916} AIDA Assistant

Hello! I'm AIDA, your AI coding assistant.

**I can help you with:**
- Programming questions and concepts
- Code review and analysis
- Debugging and troubleshooting
- Best practices and patterns

**Special Commands:**
- \`@review-file\` - Review current file
- \`@review-changes\` - Analyze git changes
- \`@review-all-changes\` - Analyze ALL git changes in workspace
- \`@review-pr\` - Review pull request
- \`@dependency\` / \`@dependency-pr\` - Impact Analysis (dependency graph + AI)
- \`@sync-review-templates\` - Sync templates

What interesting project are you working on? \u{1F680}`;
    }
}

// ─── CJS dual export ─────────────────────────────────────────────────
