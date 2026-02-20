/**
 * review-common.js - Barrel file (re-exports from core modules)
 * 
 * This file was refactored from ~3,500 lines into a thin barrel.
 * All functions now live in scripts/core/ submodules.
 * Existing require('./review-common') calls continue to work unchanged.
 */

const abortSignal = require('../core/abort-signal');
const tokenEstimator = require('../core/token-estimator');
const aiProvider = require('../core/ai-provider');
const modelSelector = require('../core/model-selector');
const templateEngine = require('../core/template-engine');
const sourceControlConfig = require('../core/source-control-config');
const businessDocs = require('../core/business-docs');
const reviewUI = require('../core/review-ui');

module.exports = {
    // ai-provider
    executeAIReview: aiProvider.executeAIReview,
    executeAIReviewWithApiKey: aiProvider.executeAIReviewWithApiKey,
    executeAIReviewWithCopilot: aiProvider.executeAIReviewWithCopilot,
    shouldUseApiKey: aiProvider.shouldUseApiKey,
    callAI: aiProvider.callAI,
    normalizeApiParameters: aiProvider.normalizeApiParameters,
    detectProvider: aiProvider.detectProvider,
    mapProviderResponse: aiProvider.mapProviderResponse,
    prepareImageForProvider: aiProvider.prepareImageForProvider,
    normalizeApiParametersForReview: aiProvider.normalizeApiParametersForReview,
    detectProviderForReview: aiProvider.detectProviderForReview,
    getFallbackModel: aiProvider.getFallbackModel,
    stripInternalBlocks: aiProvider.stripInternalBlocks,
    executeApiAnalysisCall: aiProvider.executeApiAnalysisCall,

    // token-estimator
    estimateTokenCount: tokenEstimator.estimateTokenCount,
    estimateCost: tokenEstimator.estimateCost,
    normalizeModelFamily: tokenEstimator.normalizeModelFamily,

    // model-selector
    getUnifiedModel: modelSelector.getUnifiedModel,
    getAidaChatbotSelectedModel: modelSelector.getAidaChatbotSelectedModel,
    getAvailableModels: modelSelector.getAvailableModels,
    showAvailableModels: modelSelector.showAvailableModels,

    // template-engine
    getReviewTemplate: templateEngine.getReviewTemplate,
    loadTemplateWithPriority: templateEngine.loadTemplateWithPriority,
    processTemplateWithPlaceholders: templateEngine.processTemplateWithPlaceholders,
    loadBaseTemplate: templateEngine.loadBaseTemplate,
    processTemplateContent: templateEngine.processTemplateContent,
    resolveAidaBasePath: templateEngine.resolveAidaBasePath,
    copyTemplatesRecursive: templateEngine.copyTemplatesRecursive,
    normalizePathForDisplay: templateEngine.normalizePathForDisplay,

    // review-ui
    displayReviewHeader: reviewUI.displayReviewHeader,
    getChecklistStatusIcon: reviewUI.getChecklistStatusIcon,
    showTokenStatistics: reviewUI.showTokenStatistics,
    displayCommonReviewInfo: reviewUI.displayCommonReviewInfo,
    showReviewOptions: businessDocs.showReviewOptions,

    // business-docs
    getBusinessDocumentFolders: businessDocs.getBusinessDocumentFolders,
    buildBusinessDocsContent: businessDocs.buildBusinessDocsContent,

    // abort-signal
    setGlobalAbortSignal: abortSignal.setGlobalAbortSignal,
    getGlobalAbortSignal: abortSignal.getGlobalAbortSignal,

    // language detection (re-exported from language-detection.js)
    get getReviewTemplateWithDetection() {
        return require('./language-detection').getReviewTemplateWithDetection;
    },
    get autoDetectLanguage() {
        return require('./language-detection').autoDetectLanguage;
    },
    get displayDetectionInfo() {
        return require('./language-detection').displayDetectionInfo;
    },
    get getLanguageFromExtension() {
        return require('./language-detection').getLanguageFromExtension;
    },

    // source-control
    parsePRUrl: sourceControlConfig.parsePRUrl,
    getTokenForPR: sourceControlConfig.getTokenForPR,
    hasTokenForProvider: sourceControlConfig.hasTokenForProvider,
    getConfiguredOrganizations: sourceControlConfig.getConfiguredOrganizations,
    showTokenConfigurationHelp: sourceControlConfig.showTokenConfigurationHelp
};