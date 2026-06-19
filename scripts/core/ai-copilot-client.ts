/**
 * @module core/ai-copilot-client
 * @description Copilot-based AI execution — getFallbackModel, executeAIReview,
 * executeAIReviewWithCopilot, executeApiAnalysisCall.
 * Extracted from ai-provider.ts during Sprint 3 refactoring.
 */

import * as vscode from 'vscode';
import { aidaLogging } from './settings';
import { estimateTokenCount } from './token-estimator';
import { DEFAULTS } from './aida-config';
import { toError } from '../core/error-utils';
import { shouldUseApiKey } from './provider-detection';
import { executeAIReviewWithApiKey } from './ai-api-client';
import * as _reviewUI from './review-ui';
import * as _modelSelector from './model-selector';

// Lazy require to avoid circular dependencies

// ──────────────────────────────────────────────
// Fallback model selection
// ──────────────────────────────────────────────

/**
 * Unified fallback model selection function
 */
async function getFallbackModel(currentModel: vscode.LanguageModelChat, stream: vscode.ChatResponseStream, attemptNumber = 1) {
    try {
        // Check if API key mode is enabled - no fallback needed for API key mode
        if (shouldUseApiKey()) {
            aidaLogging('🔑 API Key mode enabled - no fallback needed');
            return null;
        }

        // Get all available models
        const allModels = await vscode.lm.selectChatModels();
        const availableModels = allModels.filter(m => m.id !== currentModel.id);

        if (availableModels.length === 0) {
            throw new Error('No alternative models available for fallback');
        }

        // Fallback priority order (respecting user choice):
        // 1. Available Claude models
        // 2. Available GPT models
        // 3. First available model

        let fallbackModel = null;

        // Priority 1: Claude Sonnet 4.6 (preferred fallback)
        fallbackModel = availableModels.find(m =>
            m.family.toLowerCase().includes('claude') &&
            m.family.toLowerCase().includes('sonnet') &&
            (m.family.includes('4.6') || m.family.includes('4-6'))
        );

        // Priority 2: Any Claude Sonnet 4.x
        if (!fallbackModel) {
            fallbackModel = availableModels.find(m =>
                m.family.toLowerCase().includes('claude') &&
                m.family.toLowerCase().includes('sonnet') &&
                m.family.includes('4')
            );
        }

        // Priority 3: Any Claude model
        if (!fallbackModel) {
            fallbackModel = availableModels.find(m =>
                m.family.toLowerCase().includes('claude')
            );
        }

        // Priority 4: GPT models (if no Claude available)
        if (!fallbackModel) {
            fallbackModel = availableModels.find(m =>
                m.family.toLowerCase().includes('gpt') &&
                (m.family.includes('4o') || m.family.includes('4'))
            );
        }

        // Priority 5: First available model
        if (!fallbackModel) {
            fallbackModel = availableModels[0]!;
        }

        // Show detailed fallback information with reasoning
        const availableList = availableModels.map(m => m.family).join(', ');

        aidaLogging(`🔄 Fallback ${attemptNumber}: ${currentModel.family} → ${fallbackModel.family}`);

        // Show user-friendly fallback messaging
        stream.markdown(`🔄 **Switching models** (attempt ${attemptNumber}):\n`);
        stream.markdown(`   ❌ **Previous:** ${currentModel.family} (failed)\n`);
        stream.markdown(`   ✅ **New:** ${fallbackModel.family} (selected as fallback)\n\n`);

        // Show fallback reasoning
        if (fallbackModel.family.toLowerCase().includes('claude') && fallbackModel.family.includes('sonnet')) {
            stream.markdown(`💡 **Fallback reason:** Switched to Claude Sonnet (Priority 1 fallback)\n\n`);
        } else if (fallbackModel.family.toLowerCase().includes('claude')) {
            stream.markdown(`💡 **Fallback reason:** Switched to Claude model (Priority 3 fallback)\n\n`);
        } else if (fallbackModel.family.toLowerCase().includes('gpt')) {
            stream.markdown(`💡 **Fallback reason:** Switched to GPT model (Priority 4 fallback)\n\n`);
        } else {
            stream.markdown(`💡 **Fallback reason:** Using first available model (Priority 5 fallback)\n\n`);
        }

        stream.markdown(`📋 **All available models:** ${availableList}\n\n`);
        stream.markdown('⏳ **Continuing analysis with new model...**\n\n');

        return fallbackModel;

    } catch (_error: unknown) {
        const error = toError(_error);
        aidaLogging('❌ Fallback model selection failed:', error);
        stream.markdown(`❌ **Fallback failed:** ${error.message}\n\n`);
        throw error;
    }
}

// ──────────────────────────────────────────────
// Unified entry point
// ──────────────────────────────────────────────

/**
 * Unified AI execution function with token counting, streaming, and fallback logic
 * Enhanced with API key support for users without Copilot license
 */
async function executeAIReview(userPrompt: string, model: vscode.LanguageModelChat, stream: vscode.ChatResponseStream, reviewType = 'Analysis', attemptCount = 0, originalRequestedModel: vscode.LanguageModelChat | null = null, abortSignal: AbortSignal | null = null) {
    const maxAttempts = 3;

    // Check if user wants to use API key instead of Copilot
    if (shouldUseApiKey()) {
        aidaLogging('🔑 Using API key mode instead of Copilot');
        stream.markdown(`🔑 **API Key Mode Enabled** - Using your configured AI service\n\n`);

        try {
            return await executeAIReviewWithApiKey(userPrompt, stream, reviewType, attemptCount, abortSignal);
        } catch (apiError: unknown) {
            // If API key fails and we have attempts left, fall back to Copilot if available
            if (attemptCount < maxAttempts - 1 && model) {
                stream.markdown(`🔄 **API key failed, falling back to Copilot...**\n\n`);
                aidaLogging('🔄 API key failed, attempting Copilot fallback');
                return await executeAIReviewWithCopilot(userPrompt, model, stream, reviewType, attemptCount + 1, originalRequestedModel, abortSignal);
            } else {
                throw apiError;
            }
        }
    }

    // Original Copilot mode
    return await executeAIReviewWithCopilot(userPrompt, model, stream, reviewType, attemptCount, originalRequestedModel, abortSignal);
}

// ──────────────────────────────────────────────
// Copilot execution
// ──────────────────────────────────────────────

/**
 * Execute AI review using Copilot (original function logic)
 */
async function executeAIReviewWithCopilot(userPrompt: string, model: vscode.LanguageModelChat, stream: vscode.ChatResponseStream, reviewType = 'Analysis', attemptCount = 0, originalRequestedModel: vscode.LanguageModelChat | null = null, _abortSignal: AbortSignal | null = null) {
    const maxAttempts = 3;

    try {
        if (!model) {
            throw new Error('No Copilot model available. Please ensure GitHub Copilot is installed and active, or enable API key mode.');
        }

        // Calculate input tokens and estimated cost (for final summary only)
        const inputTokens = estimateTokenCount(userPrompt);
        const messages = [vscode.LanguageModelChatMessage.User(userPrompt)];

        // 📊 TOKEN ANALYSIS - Log detailed token information
        aidaLogging(`📊 Token Analysis for ${model.family}:`);
        aidaLogging(`   📤 Input tokens: ${inputTokens.toLocaleString()}`);
        aidaLogging(`   📝 Prompt length: ${userPrompt.length.toLocaleString()} characters`);
        aidaLogging(`   📋 Model: ${model.family} (${model.id})`);

        // ⚠️ TOKEN WARNING SYSTEM
        const COPILOT_SOFT_LIMIT = DEFAULTS.COPILOT_SOFT_LIMIT;
        const COPILOT_HARD_LIMIT = DEFAULTS.COPILOT_HARD_LIMIT;

        if (inputTokens > COPILOT_HARD_LIMIT) {
            aidaLogging(`🚨 CRITICAL: Token count ${inputTokens} exceeds hard limit ${COPILOT_HARD_LIMIT}!`);
            aidaLogging(`   ❌ This request will likely FAIL with "Message exceeds token limit"`);
        } else if (inputTokens > COPILOT_SOFT_LIMIT) {
            aidaLogging(`⚠️ WARNING: Token count ${inputTokens} approaching limit (${Math.round(inputTokens / COPILOT_HARD_LIMIT * 100)}% of ${COPILOT_HARD_LIMIT})`);
            aidaLogging(`   😥 Risk of "Message exceeds token limit" error`);
        } else {
            aidaLogging(`✅ Token count OK: ${inputTokens} / ${COPILOT_HARD_LIMIT} (${Math.round(inputTokens / COPILOT_HARD_LIMIT * 100)}%)`);
        }

        aidaLogging(`📤 Copilot mode - Attempt ${attemptCount + 1}: Sending request to model:`, model.family);

        const chatResponse = await model.sendRequest(messages, {}, new vscode.CancellationTokenSource().token);

        // Show successful model usage with accurate status
        const reviewIcon = reviewType === 'Changes' ? '📝' : '📄';

        // Determine if this is really the originally requested model
        let modelStatus;
        if (attemptCount === 0) {
            if (originalRequestedModel && model.family === originalRequestedModel.family) {
                modelStatus = 'selected model';
            } else if (originalRequestedModel && model.family !== originalRequestedModel.family) {
                modelStatus = `fallback model (${originalRequestedModel.family} not available)`;
            } else {
                modelStatus = 'selected model';
            }
        } else {
            modelStatus = `fallback model (attempt ${attemptCount + 1})`;
        }

        stream.markdown(`🤖 **Streaming ${reviewType} ${reviewIcon}** (using ${model.family} - ${modelStatus}):\n\n`);

        let fragmentCount = 0;
        let outputText = '';

        // Stream output in real-time
        stream.markdown('---\n\n');

        // Line-buffered streaming: accumulate fragments and flush on complete lines
        // to prevent broken markdown rendering (e.g., partial **bold**, incomplete lists)
        let lineBuffer = '';

        for await (const fragment of chatResponse.text) {
            outputText += fragment;
            fragmentCount++;
            lineBuffer += fragment;

            // Flush complete lines to avoid mid-syntax rendering glitches
            const lastNewline = lineBuffer.lastIndexOf('\n');
            if (lastNewline !== -1) {
                stream.markdown(lineBuffer.substring(0, lastNewline + 1));
                lineBuffer = lineBuffer.substring(lastNewline + 1);
            }

            // Progress indicator every 50 fragments
            if (fragmentCount % 50 === 0) {
                aidaLogging(`Streaming progress: ${fragmentCount} fragments processed`);
            }
        }

        // Flush any remaining buffered content
        if (lineBuffer) {
            stream.markdown(lineBuffer);
        }

        // Show completion with token statistics
        _reviewUI.showTokenStatistics(stream, userPrompt, outputText, model, reviewType, attemptCount, 'copilot', null, null);

        return true; // Success

    } catch (_modelError: unknown) {
        const modelError = toError(_modelError);
        aidaLogging(`❌ Copilot model ${model?.family || 'unknown'} failed (attempt ${attemptCount + 1}):`, modelError);

        // If we've reached max attempts, throw the error
        if (attemptCount >= maxAttempts - 1) {
            throw new Error(`All ${maxAttempts} Copilot attempts failed. Last error: ${modelError.message}`);
        }

        // Handle quota/rate limit errors
        if (modelError.message && (
            modelError.message.includes('exhausted your premium model quota') ||
            modelError.message.includes('quota') ||
            modelError.message.includes('rate limit') ||
            modelError.message.includes('too many requests') ||
            modelError.message.includes('limit exceeded')
        )) {
            stream.markdown(`🚫 **${model.family} quota exceeded** - Switching to alternative model...\n\n`);
            stream.markdown(`💡 **Reason:** Premium model quota exhausted. Automatically falling back to available model.\n\n`);

            try {
                const fallbackModel = await getFallbackModel(model, stream, attemptCount + 1);
                return await executeAIReviewWithCopilot(userPrompt, fallbackModel!, stream, reviewType, attemptCount + 1, originalRequestedModel || model);
            } catch (_fallbackError: unknown) {
                const fallbackError = toError(_fallbackError);
                stream.markdown(`❌ **Fallback failed:** ${fallbackError.message}\n\n`);
                throw new Error(`Quota exceeded and fallback failed: ${fallbackError.message}`);
            }
        }
        // Handle model not supported errors
        else if (modelError.message && (
            modelError.message.includes('model_not_supported') ||
            modelError.message.includes('not supported') ||
            modelError.message.includes('model is not available') ||
            modelError.message.includes('The requested model is not supported')
        )) {
            stream.markdown(`❌ **${model.family} not supported** - Switching to alternative model...\n\n`);
            stream.markdown(`💡 **Reason:** Model not available in current environment. Automatically falling back.\n\n`);

            try {
                const fallbackModel = await getFallbackModel(model, stream, attemptCount + 1);
                return await executeAIReviewWithCopilot(userPrompt, fallbackModel!, stream, reviewType, attemptCount + 1, originalRequestedModel || model);
            } catch (_fallbackError: unknown) {
                const fallbackError = toError(_fallbackError);
                stream.markdown(`❌ **Fallback failed:** ${fallbackError.message}\n\n`);
                throw new Error(`Model not supported and fallback failed: ${fallbackError.message}`);
            }
        } else {
            // Other errors, don't retry
            stream.markdown(`❌ **${model?.family || 'Unknown model'} failed** (attempt ${attemptCount + 1}): ${modelError.message}\n\n`);
            throw modelError;
        }
    }
}

// ──────────────────────────────────────────────
// Analysis-specific API call
// ──────────────────────────────────────────────

/**
 * Execute an AI analysis call (non-streaming, JSON response preferred)
 */
async function executeApiAnalysisCall(prompt: string, stream: vscode.ChatResponseStream, analysisType = 'API Pattern Analysis') {
    let model: vscode.LanguageModelChat | null = null;
    try {
        // Get AI model
        model = await _modelSelector.getUnifiedModel(stream);
        if (!model) {
            // Check if this is API key mode before showing error
            if (shouldUseApiKey()) {
                aidaLogging('🔑 API key mode enabled for analysis - proceeding with executeAIReview');
                const success = await executeAIReview(prompt, null!, stream, analysisType);
                return success ? { analysis: 'API key mode analysis completed' } : null;
            } else {
                stream.markdown('❌ **No AI model available** - Please select a model in VS Code\n\n');
                return null;
            }
        }

        aidaLogging(`📤 Starting ${analysisType} with model:`, model.family);

        // Show analysis start
        stream.markdown(`🤖 **${analysisType}** (using ${model.family}):\n\n`);
        stream.markdown('🔄 **Processing with AI...**\n\n');

        // Execute AI call
        const messages = [vscode.LanguageModelChatMessage.User(prompt)];
        const chatResponse = await model.sendRequest(messages, {}, new vscode.CancellationTokenSource().token);

        // Collect output
        let outputText = '';
        for await (const fragment of chatResponse.text) {
            outputText += fragment;
        }

        // Show token statistics
        _reviewUI.showTokenStatistics(stream, prompt, outputText, model, analysisType, 0);

        // Try to parse JSON response
        try {
            const parsedResponse = JSON.parse(outputText);
            aidaLogging(`✅ ${analysisType} JSON parsed successfully`);
            return parsedResponse;
        } catch (_parseError: unknown) {
            aidaLogging(`⚠️ ${analysisType} response is not JSON, returning raw text`);
            return { rawResponse: outputText };
        }

    } catch (_error: unknown) {
        const error = toError(_error);
        aidaLogging(`❌ ${analysisType} failed:`, error);
        stream.markdown(`❌ **${analysisType} failed:** ${error.message}\n\n`);

        // Try fallback if quota/model error
        if (error.message && (
            error.message.includes('quota') ||
            error.message.includes('rate limit') ||
            error.message.includes('not supported')
        )) {
            stream.markdown(`🔄 **Attempting fallback model...**\n\n`);
            try {
                const fallbackModel = await getFallbackModel(model!, stream, 1);
                const messages = [vscode.LanguageModelChatMessage.User(prompt)];
                const chatResponse = await fallbackModel!.sendRequest(messages, {}, new vscode.CancellationTokenSource().token);

                let outputText = '';
                for await (const fragment of chatResponse.text) {
                    outputText += fragment;
                }

                _reviewUI.showTokenStatistics(stream, prompt, outputText, fallbackModel!, analysisType, 1);

                try {
                    const parsedResponse = JSON.parse(outputText);
                    aidaLogging(`✅ ${analysisType} fallback JSON parsed successfully`);
                    return parsedResponse;
                } catch (_parseError: unknown) {
                    return { rawResponse: outputText };
                }

            } catch (_fallbackError: unknown) {
                const fallbackError = toError(_fallbackError);
                stream.markdown(`❌ **Fallback also failed:** ${fallbackError.message}\n\n`);
                return null;
            }
        }

        return null;
    }
}

// ES exports
export {
    getFallbackModel,
    executeAIReview,
    executeAIReviewWithCopilot,
    executeApiAnalysisCall
};
