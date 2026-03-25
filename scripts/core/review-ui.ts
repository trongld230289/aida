/**
 * @module review-ui
 * @description Review display & output-channel helpers
 * Extracted from review-common.js during Phase 1 refactoring
 */

import * as vscode from 'vscode';
import { aidaLogging } from './settings';
import * as _tokenEstimator from './token-estimator';
import * as _templateEngine from './template-engine';
import * as path from 'path';

// Lazy requires to avoid circular deps

interface IDisplayOptions {
    length?: number | null;
    lengthLabel?: string;
    lengthType?: 'diff' | 'file' | 'changes' | 'combined diff' | 'reviewable files' | string;
}

interface IActualTokens {
    inputTokens?: number;
    outputTokens?: number;
}

interface IModel {
    family: string;
}

function displayReviewHeader(
    stream: vscode.ChatResponseStream,
    reviewType: string,
    filePath: string,
    diffLength: number | null = null,
    _templatePath: string | null = null,
    _templateSource: string | null = null,
    _businessDocs: unknown[] | null = null
): void {
    const fileName = path.basename(filePath);
    const fullPath = filePath;

    stream.markdown(`# 🔍 ${reviewType}: \`${fileName}\`\n\n`);
    stream.markdown(`📂 **Full Path:** \`${fullPath}\`\n`);

    if (diffLength !== null) {
        stream.markdown(`📄 **Diff Length:** ${diffLength} characters\n`);
    }

    displayDocumentReviewHeader(stream);
}

function displayDocumentReviewHeader(stream: vscode.ChatResponseStream): void {
    if ((global as Record<string, unknown>).selectedBusinessDocs && ((global as Record<string, unknown>).selectedBusinessDocs as unknown[]).length > 0) {
        stream.markdown(`📋 **Enhanced Review Mode - Business Documents:**\n\n`);

        aidaLogging('🔍 Debug selectedBusinessDocs:', (global as Record<string, unknown>).selectedBusinessDocs);

        ((global as Record<string, unknown>).selectedBusinessDocs as Array<Record<string, unknown>>).forEach((doc: Record<string, unknown>, index: number) => {
            aidaLogging(`🔍 Debug doc ${index}:`, doc, 'Type:', typeof doc);

            let docName: string;
            let docPath: string;

            if (typeof doc === 'string') {
                docName = path.basename(doc);
                docPath = _templateEngine.normalizePathForDisplay(doc);
            } else if (doc && typeof doc === 'object' && doc.path) {
                docName = path.basename(doc.path as string);
                docPath = _templateEngine.normalizePathForDisplay(doc.path as string);
            } else if (doc && typeof doc === 'object' && doc.name) {
                docName = doc.name as string;
                docPath = (doc.displayName || doc.relativePath || doc.name) as string;
            } else {
                aidaLogging('⚠️ Invalid business document entry:', doc);
                stream.markdown(`${index + 1}. Invalid document entry (type: ${typeof doc})\n`);
                return;
            }

            stream.markdown(`${index + 1}. \`${docName}\` - \`${docPath}\`\n`);
        });
        stream.markdown(`\n`);
    } else {
        stream.markdown(`⚡ **Quick Review Mode** - No business documents selected\n\n`);
    }

    (global as any).selectedBusinessDocs = null;
    aidaLogging('🧹 displayCommonReviewInfo - cleanup: global.selectedBusinessDocs = null');
}

function getChecklistStatusIcon(status: string): string {
    const statusIcons: Record<string, string> = {
        'ok': '✅',
        'warning': '⚠️',
        'critical': '🚨',
        'suggestion': '💡',
        'unknown': '❓'
    };
    return statusIcons[status] || '❓';
}

function showTokenStatistics(
    stream: vscode.ChatResponseStream,
    inputText: string,
    outputText: string,
    model: IModel,
    reviewType: string,
    attemptCount: number,
    provider: string | null = null,
    apiHost: string | null = null,
    actualTokens: IActualTokens | null = null
): void {
    let inputTokens: number;
    let outputTokens: number;

    if (actualTokens && actualTokens.inputTokens !== undefined && actualTokens.outputTokens !== undefined) {
        inputTokens = actualTokens.inputTokens;
        outputTokens = actualTokens.outputTokens;
        aidaLogging(`📊 Using actual tokens from API: Input=${inputTokens}, Output=${outputTokens}`);
    } else {
        inputTokens = _tokenEstimator.estimateTokenCount(inputText);
        outputTokens = _tokenEstimator.estimateTokenCount(outputText);
        aidaLogging(`📊 Using estimated tokens: Input=${inputTokens}, Output=${outputTokens}`);
    }

    const finalCost = _tokenEstimator.estimateCost(inputTokens, outputTokens, model.family, provider, apiHost);

    const completionStatus = attemptCount === 0 ? 'original model' : `fallback model (${model.family})`;

    stream.markdown(`\n\n---\n\n`);
    stream.markdown(`📊 **Token Usage Summary:**\n`);
    stream.markdown(`- **Input tokens**: ${inputTokens.toLocaleString()}\n`);
    stream.markdown(`- **Output tokens**: ${outputTokens.toLocaleString()}\n`);
    stream.markdown(`- **Total tokens**: ${(inputTokens + outputTokens).toLocaleString()}\n`);

    stream.markdown(`- **Model used**: ${model.family}${finalCost.provider ? ` (${finalCost.provider})` : ''}\n\n`);
    stream.markdown(`✅ **${reviewType} Analysis complete** - successfully used ${completionStatus}\n\n`);

    aidaLogging(`✅ ${reviewType} review completed successfully with model:`, model.family);
    aidaLogging(`📊 Token usage - Input: ${inputTokens}, Output: ${outputTokens}`);
}

function displayCommonReviewInfo(
    stream: vscode.ChatResponseStream,
    reviewType: string,
    filePath: string,
    options: IDisplayOptions = {}
): void {
    const fileName = path.basename(filePath);

    let displayPath = filePath;
    try {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (workspaceFolder && path.isAbsolute(filePath)) {
            const relativePath = path.relative(workspaceFolder.uri.fsPath, filePath);
            displayPath = _templateEngine.normalizePathForDisplay(relativePath);
        }
    } catch (error: unknown) {
        aidaLogging('Failed to convert to relative path:', error);
    }

    stream.markdown(`# 🔍 ${reviewType}: \`${fileName}\`\n\n`);
    stream.markdown(`📂 **Full Path:** \`${displayPath}\`\n\n`);

    if (options.length !== null && options.length !== undefined) {
        let icon = '📄';
        let label = options.lengthLabel || 'File Length';

        if (options.lengthType === 'diff') {
            icon = '📏';
            label = 'Diff Length';
        } else if (options.lengthType === 'file') {
            icon = '📄';
            label = 'File Length';
        } else if (options.lengthType === 'changes') {
            icon = '📊';
            label = 'File Changes';
        }

        const unit = options.lengthType === 'changes' ? '' : ' characters';
        stream.markdown(`${icon} **${label}:** ${options.length}${unit}\n\n`);
    }

    displayDocumentReviewHeader(stream);
}

export {
    displayReviewHeader,
    displayDocumentReviewHeader,
    getChecklistStatusIcon,
    showTokenStatistics,
    displayCommonReviewInfo
};
