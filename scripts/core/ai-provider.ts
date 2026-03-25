/**
 * @module ai-provider
 * @description Thin facade that re-exports from the four sub-modules.
 * All logic lives in:
 *   - ./response-mappers   (map*Response)
 *   - ./provider-detection  (detectProvider, normalizeApiParameters, shouldUseApiKey, etc.)
 *   - ./ai-api-client       (callAI, executeAIReviewWithApiKey)
 *   - ./ai-copilot-client   (getFallbackModel, executeAIReview, executeAIReviewWithCopilot, executeApiAnalysisCall)
 *
 * Consumers (review-common.ts, model-selector.ts) continue to
 *   import * as aiProvider from './ai-provider'
 * without any change.
 */

// -- Re-export: response mappers --
import {
    mapOpenAIResponse,
    mapAnthropicResponse,
    mapGoogleResponse,
    mapSTUResponse,
    mapGenericResponse,
    mapProviderResponse
} from './response-mappers';

// -- Re-export: provider detection / utilities --
import {
    stripInternalBlocks,
    detectProvider,
    normalizeApiParameters,
    shouldUseApiKey,
    prepareImageForProvider
} from './provider-detection';

// -- Re-export: external-API client --
import { callAI, executeAIReviewWithApiKey } from './ai-api-client';

// -- Re-export: Copilot client --
import {
    getFallbackModel,
    executeAIReview,
    executeAIReviewWithCopilot,
    executeApiAnalysisCall
} from './ai-copilot-client';

// ES named exports (preserves existing public API including aliases)
export {
    callAI,
    detectProvider,
    normalizeApiParameters,
    shouldUseApiKey,
    executeAIReviewWithApiKey,
    executeAIReview,
    executeAIReviewWithCopilot,
    executeApiAnalysisCall,
    mapOpenAIResponse,
    mapAnthropicResponse,
    mapGoogleResponse,
    mapSTUResponse,
    mapGenericResponse,
    mapProviderResponse,
    prepareImageForProvider,
    getFallbackModel,
    stripInternalBlocks,
    normalizeApiParameters as normalizeApiParametersForReview,
    detectProvider as detectProviderForReview
};
