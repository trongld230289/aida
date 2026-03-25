/**
 * @module review-common
 * @description Barrel file (re-exports from core modules).
 * Refactored from ~3,500 lines into a thin re-export layer.
 */

import * as vscode from 'vscode';
import type { IDetectionResult } from './interfaces/detection.interface';
import * as _langDetection from './language-detection';

// ─── Direct barrel re-exports ────────────────────────────────────────
export {
    executeAIReview, executeAIReviewWithApiKey, executeAIReviewWithCopilot,
    shouldUseApiKey, callAI, normalizeApiParameters, detectProvider,
    mapProviderResponse, prepareImageForProvider, normalizeApiParametersForReview,
    detectProviderForReview, getFallbackModel, stripInternalBlocks, executeApiAnalysisCall,
} from '../core/ai-provider';

export {
    estimateTokenCount, estimateCost, normalizeModelFamily,
} from '../core/token-estimator';

export {
    getUnifiedModel, getAidaChatbotSelectedModel, getAvailableModels, showAvailableModels,
} from '../core/model-selector';

export {
    getReviewTemplate, loadTemplateWithPriority, processTemplateWithPlaceholders,
    loadBaseTemplate, processTemplateContent, resolveAidaBasePath,
    copyTemplatesRecursive, normalizePathForDisplay,
} from '../core/template-engine';

export {
    displayReviewHeader, getChecklistStatusIcon, showTokenStatistics, displayCommonReviewInfo,
} from '../core/review-ui';

export {
    getBusinessDocumentFolders, buildBusinessDocsContent, showReviewOptions,
} from '../core/business-docs';

export {
    setGlobalAbortSignal, getGlobalAbortSignal,
} from '../core/abort-signal';

export {
    parsePRUrl, getTokenForPR, hasTokenForProvider,
    getConfiguredOrganizations, showTokenConfigurationHelp,
} from '../core/source-control-config';

// ─── language-detection (lazy re-exports — avoids circular init) ─────
export function getReviewTemplateWithDetection(templateType: string, filePath: string): Promise<string> {
    return _langDetection.getReviewTemplateWithDetection(templateType, filePath) as Promise<string>;
}
export function autoDetectLanguage(filePath: string): Promise<IDetectionResult> {
    return _langDetection.autoDetectLanguage(filePath);
}
export function displayDetectionInfo(stream: vscode.ChatResponseStream, detection: IDetectionResult, templateType: string): void {
    return _langDetection.displayDetectionInfo(stream, detection, templateType);
}
export function getLanguageFromExtension(ext: string): string {
    return _langDetection.getLanguageFromExtension(ext);
}
