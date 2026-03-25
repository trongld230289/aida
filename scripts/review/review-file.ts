/**
 * @module review-file
 * @description Review individual files using AI + templates
 * Migrated to TypeScript in Phase 3.
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import {
    executeAIReview, getUnifiedModel, shouldUseApiKey,
    loadTemplateWithPriority,
    displayCommonReviewInfo, showReviewOptions,
} from './review-common';
import { autoDetectWorkspace, displayDetectionInfo, getLanguageFromExtension } from './language-detection';
import { aidaLogging } from '../core/settings';
import { buildFileReviewPrompt, getDefaultFileTemplate } from '../core/prompts';
import { trackEvent } from '../tracking/usage-tracking';
import { TrackingEvent, TrackingSource, ReviewMode, AiProvider, getReviewMode, getIdeAiProvider } from '../tracking/tracking-enums';

// Direct imports — no circular dependency through extension.js
// import { handleEnterTwiceLogic } from '../core/shared-state';
import { ensureAidaTemplatesForReview } from '../core/template-engine';

import { IFileTargetInfo } from './interfaces/file-target.interface';
// IWorkspaceDetectionResult removed - unused import
import { toError } from '../core/error-utils';

// ── Initialize ──────────────────────────────────────────────────

export function initializeReviewFile(context: vscode.ExtensionContext): Record<string, unknown> {
    const reviewFileParticipant = vscode.chat.createChatParticipant(
        'review-file',
        async (request: vscode.ChatRequest, chatContext: vscode.ChatContext, stream: vscode.ChatResponseStream, _token: vscode.CancellationToken) => {
            try {
                // Tracking moved to execution points below — fires once when review actually runs

                if (ensureAidaTemplatesForReview) {
                    await ensureAidaTemplatesForReview(context);
                }

                aidaLogging('🎯 review-file participant called');

                const input = request.prompt.trim();

                if ((chatContext as any).participant?.id === 'review-file' && request.prompt.includes('@review-file')) {
                    stream.markdown('⚠️ **Loop Prevention**: Recursive call detected\n');
                    stream.markdown('💡 **Use direct commands instead**: Review your active file or specify a file path\n');
                    return;
                }

                const activeEditor = vscode.window.activeTextEditor;
                const targetInput = input || (activeEditor ? activeEditor.document.fileName : null);

                if ((global as any).selectedBusinessDocs) {
                    aidaLogging('🎯 Enhanced/Quick File Review detected:', (global as any).selectedBusinessDocs);

                    // ── Track once — user committed to a review mode ──
                    void trackEvent(TrackingEvent.REVIEW_FILE, {
                        source: TrackingSource.CHAT_PARTICIPANT,
                        aiProvider: getIdeAiProvider(),
                        reviewMode: getReviewMode(),
                    });

                    await aiReviewFile(targetInput!, stream, request.model, context, request);
                    return;
                }

                if (targetInput) {
                    const shouldContinue = await showReviewOptions(
                        targetInput,
                        stream,
                        {
                            quickCommand: 'aida.confirmReviewDocs',
                            enhancedCommand: 'aida.showEnhancedReviewOptions',
                            reviewType: 'File',
                            chatCommand: 'review-file',
                        },
                        async (_useDocuments: boolean) => {
                            // ── Track once — auto Quick (no business docs) ──
                            void trackEvent(TrackingEvent.REVIEW_FILE, {
                                source: TrackingSource.CHAT_PARTICIPANT,
                                aiProvider: getIdeAiProvider(),
                                reviewMode: ReviewMode.QUICK,
                            });

                            await aiReviewFile(targetInput, stream, request.model, context, request);
                        },
                    );
                    if (shouldContinue || shouldContinue === false) { return; }
                } else {
                    stream.markdown('# 🔍 File Review Assistant\n\n');
                    stream.markdown('Please provide a file path or open a file to review.\n\n');
                    stream.markdown('**Examples:**\n- `@review-file` - Review current active file\n- `@review-file src/app/component.ts` - Review specific file\n');
                    return;
                }

                await aiReviewFile(targetInput, stream, request.model, context, request);
            } catch (_error: unknown) {
                const error = toError(_error);
                stream.markdown(`❌ Error: ${error.message}\n\n`);
                stream.markdown('**Fallback:** Please open a file in the editor and try again.\n');
                aidaLogging('Review File error:', error);
            }
        },
    );

    reviewFileParticipant.iconPath = vscode.Uri.file(
        path.join(context.extensionPath, 'icons', 'icon.svg'),
    );

    return { reviewFileParticipant, aiReviewFile, handleActiveFileReview, analyzeCodeSection, reviewFile, performBasicFileAnalysis };
}

// ── Reusable for AIDA Chatbot ───────────────────────────────────

export async function processReviewFile(input: string | null, stream: vscode.ChatResponseStream): Promise<void> {
    aidaLogging('🎯 processReviewFile called with input:', input);

    const activeEditor = vscode.window.activeTextEditor;
    const targetInput = input || (activeEditor ? activeEditor.document.fileName : null);

    if ((global as any).selectedBusinessDocs) {
        aidaLogging('🎯 Enhanced/Quick File Review detected:', (global as any).selectedBusinessDocs);

        // ── Track once — sidebar AIDA Chatbot, user committed to mode ──
        void trackEvent(TrackingEvent.REVIEW_FILE, {
            source: TrackingSource.AIDA_CHATBOT,
            aiProvider: AiProvider.AIDA_CHATBOT,
            reviewMode: getReviewMode(),
        });

        await aiReviewFile(targetInput!, stream, null, null, { model: null, prompt: input } as any);
        return;
    }

    if (targetInput) {
        const shouldContinue = await showReviewOptions(
            targetInput,
            stream,
            { quickCommand: 'aida.confirmReviewDocs', enhancedCommand: 'aida.showEnhancedReviewOptions', reviewType: 'File', chatCommand: 'review-file' },
            async (_useDocuments: boolean) => {
                // ── Track once — sidebar auto Quick (no business docs) ──
                void trackEvent(TrackingEvent.REVIEW_FILE, {
                    source: TrackingSource.AIDA_CHATBOT,
                    aiProvider: AiProvider.AIDA_CHATBOT,
                    reviewMode: ReviewMode.QUICK,
                });

                await aiReviewFile(targetInput, stream, null, null, { model: null, prompt: input } as any);
            },
        );
        if (shouldContinue || shouldContinue === false) { return; }
    } else {
        stream.markdown('# 🔍 File Review Assistant\n\nPlease provide a file path or open a file to review.\n\n');
        stream.markdown('**Examples:**\n- `@review-file` - Review current active file\n- `@review-file src/app/component.ts` - Review specific file\n');
        return;
    }

    await aiReviewFile(targetInput, stream, null, null, { model: null, prompt: input } as any);
}

// ── Main AI Review ──────────────────────────────────────────────

export async function aiReviewFile(
    input: string,
    stream: vscode.ChatResponseStream,
    selectedModel: vscode.LanguageModelChat | null = null,
    context: vscode.ExtensionContext | null = null,
    request: vscode.ChatRequest | null = null,
): Promise<void> {
    try {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            stream.markdown('❌ **No workspace folder found**\n\n💡 **Tips:**\n- Open a folder in VS Code\n- Or open a file in the editor to review\n');
            return;
        }

        const targetInfo = getTargetFileInfoForReview(input);

        if (!targetInfo.success) {
            stream.markdown(`❌ **${targetInfo.message}**\n\n💡 **Tips:**\n- Open a file in the editor\n- Provide a specific file path like: \`src/app/component.ts\`\n`);
            return;
        }

        await reviewFile(targetInfo.filePath!, stream, selectedModel, context, request);
    } catch (_error: unknown) {
        const error = toError(_error);
        stream.markdown(`❌ **Review process failed:** ${error.message}\n\n`);
        stream.markdown('**Fallback options:**\n- Check if the file exists and is accessible\n- Ensure VS Code has proper file access\n- Try opening the file in the editor first\n');
        aidaLogging('AI Review File error:', error);
    }
}

// ── Helpers ─────────────────────────────────────────────────────

export function getTargetFileInfoForReview(input: string): IFileTargetInfo {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

    const isFilePath = input && (
        input.includes('.ts') || input.includes('.js') ||
        input.includes('.html') || input.includes('.css') ||
        input.includes('/') || input.includes('\\')
    );

    if (isFilePath) {
        let cleanPath: string = input.trim().replace(/^['"](.*)['"]$/, '$1');
        if (!path.isAbsolute(cleanPath) && workspaceFolder) {
            cleanPath = path.join(workspaceFolder.uri.fsPath, cleanPath);
        }
        if (!fs.existsSync(cleanPath)) {
            return { success: false, message: `File not found: ${cleanPath}` };
        }
        return { success: true, filePath: cleanPath, source: 'input' };
    }

    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor) {
        return { success: true, filePath: activeEditor.document.fileName, source: 'editor' };
    }

    return { success: false, message: 'No file specified and no active editor found' };
}

export async function handleActiveFileReview(
    stream: vscode.ChatResponseStream,
    requestedModel: vscode.LanguageModelChat | null = null,
    context: vscode.ExtensionContext | null = null,
    request: vscode.ChatRequest | null = null,
): Promise<void> {
    try {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) {
            stream.markdown('❌ **No active editor found**\n\n💡 **Tips:**\n- Open a file in the editor\n- Select some code to review a specific section\n- Or try `@review-changes` to review git changes instead\n');
            return;
        }

        const document = activeEditor.document;
        const selection = activeEditor.selection;

        if (!selection.isEmpty) {
            stream.markdown('# 🔍 Code Selection Review\n\n');
            stream.markdown(`**File:** \`${path.basename(document.fileName)}\`\n`);
            stream.markdown(`**Selected Lines:** ${selection.start.line + 1}-${selection.end.line + 1}\n\n`);
            const selectedText = document.getText(selection);

            if (selectedText.trim()) {
                stream.markdown('## 📋 Selected Code\n\n');
                stream.markdown('```' + document.languageId + '\n' + selectedText + '\n```\n\n');
                await analyzeCodeSection(selectedText, document.languageId, stream, requestedModel, context);
            } else {
                stream.markdown('⚠️ **Selected text is empty**\n\n💡 **Tip:** Select some code and try again\n');
            }
        } else {
            await reviewFile(document.fileName, stream, requestedModel, context, request);
        }
    } catch (_error: unknown) {
        const error = toError(_error);
        stream.markdown(`❌ **Error during file review:** ${error.message}\n\n`);
        aidaLogging('Active file review error:', error);
    }
}

export async function analyzeCodeSection(
    code: string,
    language: string,
    stream: vscode.ChatResponseStream,
    _requestedModel: vscode.LanguageModelChat | null = null,
    _context: vscode.ExtensionContext | null = null,
): Promise<void> {
    try {
        stream.markdown('## 🔍 Quick Analysis\n\n');
        const lines = code.split('\n');
        const nonEmptyLines = lines.filter((l: string) => l.trim());

        stream.markdown(`**Lines of code:** ${nonEmptyLines.length}\n**Total lines:** ${lines.length}\n\n`);

        const hasComments = code.includes('//') || code.includes('/*') || code.includes('#');
        const hasTodos = /TODO|FIXME|HACK|XXX/i.test(code);
        const hasConsoleLog = /console\.(log|warn|error)/i.test(code);

        stream.markdown(hasComments ? '✅ **Has comments** - Good documentation practice\n' : '⚠️ **No comments found** - Consider adding documentation\n');
        if (hasTodos) { stream.markdown('⚠️ **TODO/FIXME found** - Review pending items\n'); }
        if (hasConsoleLog) { stream.markdown('⚠️ **Console statements found** - Consider removing for production\n'); }

        if (language === 'typescript' || language === 'javascript') {
            analyzeTypeScriptCode(code, stream);
        }

        stream.markdown('\n💡 **For detailed AI review:** Use the main review function with unified model support\n');
    } catch (_error: unknown) {
        const error = toError(_error);
        stream.markdown(`⚠️ **Analysis error:** ${error.message}\n`);
    }
}

function analyzeTypeScriptCode(code: string, stream: vscode.ChatResponseStream): void {
    const hasTypes = /:\s*(string|number|boolean|void|any|unknown)/i.test(code);
    const hasInterfaces = /interface\s+\w+/i.test(code);
    const hasClasses = /class\s+\w+/i.test(code);
    const hasFunctions = /function\s+\w+|=>\s*{|\w+\s*=\s*\(/i.test(code);

    stream.markdown('\n**TypeScript/JavaScript Features:**\n');
    if (hasTypes) { stream.markdown('✅ **Type annotations found**\n'); }
    if (hasInterfaces) { stream.markdown('✅ **Interfaces defined**\n'); }
    if (hasClasses) { stream.markdown('✅ **Classes found**\n'); }
    if (hasFunctions) { stream.markdown('✅ **Functions/methods found**\n'); }
}

// ── Core Review ─────────────────────────────────────────────────

export async function reviewFile(
    filePath: string,
    stream: vscode.ChatResponseStream,
    requestedModel: vscode.LanguageModelChat | null = null,
    context: vscode.ExtensionContext | null = null,
    request: vscode.ChatRequest | null = null,
): Promise<void> {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const fileExtension = path.extname(filePath);
        const fileName = path.basename(filePath);

        let detection: Record<string, any> | null = null;
        let templateContent: string | null = null;
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (workspaceFolder) {
                detection = await autoDetectWorkspace(workspaceFolder.uri.fsPath, filePath) as Record<string, any>;
                const templateResult = await loadTemplateWithPriority('review-file.md', detection);
                templateContent = templateResult.content;
                detection.templateSource = templateResult.templateSource;
                detection.templatePath = templateResult.templatePath;
                displayDetectionInfo(stream, detection, 'review-file.md');
            }
        } catch (_error: unknown) {
            const error = toError(_error);
            aidaLogging('Template detection failed:', error.message);
        }

        displayCommonReviewInfo(stream, 'File Review', filePath, { length: content.length, lengthType: 'file' });

        try {
            let reviewPrompt = '';

            try {
                if (!templateContent && detection) {
                    const fallbackPath = path.join((global as any).extensionPath, 'templates', 'review-code', 'fallback', 'review-file.md');
                    if (fs.existsSync(fallbackPath)) {
                        templateContent = fs.readFileSync(fallbackPath, 'utf8');
                    }
                }
                if (!templateContent) {
                    templateContent = getDefaultFileTemplate(fileExtension);
                }
                aidaLogging(`✅ Using ${detection?.detected || 'fallback'} template (${templateContent.length} characters)`);
                reviewPrompt = buildFileReviewPrompt(templateContent, { fileName, filePath, fileExtension, content }, detection);
            } catch (_templateError: unknown) {
                const templateError = toError(_templateError);
                stream.markdown('⚠️ **Template not found** - using basic review\n\n');
                aidaLogging(`⚠️ Template loading failed: ${templateError.message}`);
                reviewPrompt = buildFileReviewPrompt(null as any, { fileName, filePath, fileExtension, content }, null);
            }

            const model = await getUnifiedModel(stream, requestedModel, context, request);

            if (model) {
                stream.markdown('🔄 **Initializing File Analysis...** \n\n');
                stream.markdown('⏳ **Preparing model:** `' + model.family + '`\n\n');
                stream.markdown('🚀 **Starting comprehensive file review...**\n\n');

                const success = await executeAIReview(reviewPrompt, model, stream, 'File');
                if (!success) {
                    stream.markdown('⚠️ **AI analysis failed - using basic analysis**\n\n');
                    await performBasicFileAnalysis(content, stream, fileExtension);
                }
            } else {
                if (shouldUseApiKey()) {
                    try {
                        const success = await executeAIReview(reviewPrompt, null as any, stream, 'File');
                        if (success) { return; }
                    } catch (_apiError: unknown) {
                        const apiError = toError(_apiError);
                        stream.markdown(`⚠️ **API key mode failed:** ${apiError.message}\n\n🔄 **Falling back to basic analysis...**\n\n`);
                    }
                } else {
                    stream.markdown('⚠️ **AI model not available - using basic analysis**\n\n💡 **Tip:** Install GitHub Copilot or configure API key mode in settings\n\n');
                }
                await performBasicFileAnalysis(content, stream, fileExtension);
            }
        } catch (_aiError: unknown) {
            const aiError = toError(_aiError);
            stream.markdown(`⚠️ **AI analysis failed:** ${aiError.message}\n\n🔄 **Falling back to basic analysis...**\n\n`);
            await performBasicFileAnalysis(content, stream, fileExtension);
        }
    } catch (_error: unknown) {
        const error = toError(_error);
        stream.markdown(`❌ Error reading file: ${error.message}`);
    }
}

export async function performBasicFileAnalysis(content: string, stream: vscode.ChatResponseStream, fileExtension: string): Promise<void> {
    const lines = content.split('\n');
    const analysis = {
        totalLines: lines.length,
        codeLines: lines.filter((l: string) => l.trim() && !l.trim().startsWith('//')).length,
        commentLines: lines.filter((l: string) => l.trim().startsWith('//')).length,
        issues: [] as string[],
    };

    lines.forEach((line: string, index: number) => {
        const lineNum = index + 1;
        if (line.includes(': any') && !line.includes('// @ts-ignore')) {
            analysis.issues.push(`⚠️ Line ${lineNum}: TypeScript 'any' type - consider proper typing`);
        }
        if (line.includes('aidaLogging') || line.includes('console.error')) {
            analysis.issues.push(`🔍 Line ${lineNum}: Console statement - remove for production`);
        }
        if (line.length > 120) {
            analysis.issues.push(`📏 Line ${lineNum}: Line too long (${line.length} chars)`);
        }
    });

    stream.markdown('### 📊 File Statistics\n\n');
    stream.markdown(`- **Total lines:** ${analysis.totalLines}\n- **Code lines:** ${analysis.codeLines}\n- **Comment lines:** ${analysis.commentLines}\n\n`);

    if (analysis.issues.length > 0) {
        stream.markdown('### ⚠️ Issues Found\n\n');
        analysis.issues.forEach((issue: string) => stream.markdown(`- ${issue}\n`));
    } else {
        stream.markdown('### ✅ No obvious issues detected\n\n');
    }

    stream.markdown('### 📝 File Content (Preview)\n\n');
    const language = getLanguageFromExtension(fileExtension);
    const preview = content.length > 2000 ? content.substring(0, 2000) + '\n... (truncated)' : content;
    stream.markdown(`\`\`\`${language}\n${preview}\n\`\`\`\n\n`);
}

// ── Backward-compat CommonJS exports ────────────────────────────
