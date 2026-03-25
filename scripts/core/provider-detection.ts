/**
 * @module core/provider-detection
 * @description AI provider detection, parameter normalisation, and utility functions.
 * Extracted from ai-provider.ts during Sprint 3 refactoring.
 */

import * as vscode from 'vscode';
import { aidaLogging } from './settings';

/** Remove <INTERNAL_ONLY> blocks from AI output */
function stripInternalBlocks(output: string) {
    // Remove <INTERNAL_ONLY>...</INTERNAL_ONLY> blocks
    const cleanedOutput = output.replace(/<INTERNAL_ONLY>[\s\S]*?<\/INTERNAL_ONLY>/g, '');
    return cleanedOutput.trim();
}

/**
 * Detect AI provider from API host and model
 */
function detectProvider(apiHost: string, model: string) {
    const host = apiHost.toLowerCase();
    const modelLower = model.toLowerCase();

    // Check by API host
    if (host.includes('openai.com')) return 'openai';
    if (host.includes('anthropic.com')) return 'anthropic';
    if (host.includes('googleapis.com') || host.includes('google.com')) return 'google';
    if (host.includes('cohere.ai') || host.includes('cohere.com')) return 'cohere';
    if (host.includes('aiportalapi.stu-platform.live')) return 'stu';
    if (host.includes('azure.com') || host.includes('openai.azure.com')) return 'azure';
    if (host.includes('huggingface.co')) return 'huggingface';
    if (host.includes('ollama') || host.includes('localhost:11434')) return 'ollama';

    // Check by model name
    if (modelLower.includes('gpt') || modelLower.includes('davinci') || modelLower.includes('curie')) return 'openai';
    if (modelLower.includes('claude')) return 'anthropic';
    if (modelLower.includes('gemini') || modelLower.includes('palm') || modelLower.includes('bison')) return 'google';
    if (modelLower.includes('command') || modelLower.includes('cohere')) return 'cohere';
    if (modelLower.includes('llama') || modelLower.includes('mistral') || modelLower.includes('codellama')) return 'ollama';

    return 'custom';
}

/**
 * Normalise API parameters based on provider/model
 */
function normalizeApiParameters(model: string, apiHost: string, options: Record<string, any>) {
    const normalized = { ...options };
    const provider = detectProvider(apiHost, model);

    aidaLogging(`🔄 Normalizing parameters for provider: ${provider}`);

    switch (provider) {
        case 'openai':
            if (options.max_completion_tokens) {
                normalized.max_tokens = options.max_completion_tokens;
                delete normalized.max_completion_tokens;
            }
            break;

        case 'anthropic':
            if (options.max_tokens) {
                normalized.max_tokens = options.max_tokens;
            }
            delete normalized.response_format;
            break;

        case 'google':
            if (options.max_tokens) {
                normalized.max_output_tokens = options.max_tokens;
                delete normalized.max_tokens;
            }
            if (options.max_completion_tokens) {
                normalized.max_output_tokens = options.max_completion_tokens;
                delete normalized.max_completion_tokens;
            }
            break;

        case 'cohere':
            if (options.max_tokens) {
                normalized.max_generation_length = options.max_tokens;
                delete normalized.max_tokens;
            }
            if (options.max_completion_tokens) {
                normalized.max_generation_length = options.max_completion_tokens;
                delete normalized.max_completion_tokens;
            }
            break;

        case 'stu':
            aidaLogging('🧪 STU Platform detected - applying compatibility fixes...');
            if (model.includes('gpt-5') || model.toLowerCase().includes('gpt-5')) {
                aidaLogging('⚠️ GPT-5 on STU Platform - Using minimal parameter set');
                const essentialParams = {
                    model: normalized.model,
                    messages: normalized.messages,
                    stream: normalized.stream || false
                };
                Object.keys(normalized).forEach(key => {
                    if (!essentialParams.hasOwnProperty(key)) {
                        delete normalized[key];
                    }
                });
                aidaLogging('🧪 STU GPT-5 params:', Object.keys(normalized));
            } else {
                if (options.max_tokens) {
                    normalized.max_completion_tokens = options.max_tokens;
                    delete normalized.max_tokens;
                }
            }
            break;

        case 'azure':
            if (options.max_tokens) {
                normalized.max_completion_tokens = options.max_tokens;
                delete normalized.max_tokens;
            }
            if (options.max_completion_tokens) {
                normalized.max_completion_tokens = options.max_completion_tokens;
            }
            break;

        case 'huggingface':
            if (options.max_tokens) {
                normalized.max_new_tokens = options.max_tokens;
                delete normalized.max_tokens;
            }
            if (options.max_completion_tokens) {
                normalized.max_new_tokens = options.max_completion_tokens;
                delete normalized.max_completion_tokens;
            }
            break;

        case 'ollama':
            if (options.max_tokens) {
                normalized.num_predict = options.max_tokens;
                delete normalized.max_tokens;
            }
            if (options.max_completion_tokens) {
                normalized.num_predict = options.max_completion_tokens;
                delete normalized.max_completion_tokens;
            }
            delete normalized.response_format;
            break;

        case 'custom':
        default:
            if (model.includes('claude')) {
                delete normalized.response_format;
            } else if (model.includes('gemini') || model.includes('palm')) {
                if (options.max_tokens) {
                    normalized.max_output_tokens = options.max_tokens;
                    delete normalized.max_tokens;
                }
            }
            break;
    }

    return normalized;
}

/**
 * Check if user wants to use API key instead of Copilot
 */
function shouldUseApiKey() {
    const config = vscode.workspace.getConfiguration('aida');
    const useApiKey = config.get('useExternalAI', false);
    const apiKey = config.get('ai.apiKey');

    aidaLogging(`🔑 API Key mode check: useExternalAI=${useApiKey}, hasApiKey=${!!apiKey}`);

    return useApiKey && !!apiKey;
}

/**
 * Prepare image for specific AI provider format
 */
function prepareImageForProvider(imageInput: string | Buffer | { data: string; type: string }, _provider = 'openai') {
    let base64Data, mimeType;

    if (typeof imageInput === 'string') {
        if (imageInput.startsWith('data:')) {
            const matches = imageInput.match(/^data:(image\/\w+);base64,(.+)$/);
            if (matches) {
                mimeType = matches[1];
                base64Data = matches[2];
            }
        } else {
            base64Data = imageInput;
            mimeType = 'image/png';
        }
    } else if (typeof imageInput === 'object' && imageInput !== null && 'data' in imageInput && 'type' in imageInput) {
        const imgObj = imageInput as { data: string; type: string };
        if (imgObj.data.startsWith('data:')) {
            const matches = imgObj.data.match(/^data:(image\/\w+);base64,(.+)$/);
            if (matches) {
                mimeType = matches[1];
                base64Data = matches[2];
            }
        } else {
            base64Data = imgObj.data;
            mimeType = imgObj.type;
        }
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(mimeType!)) {
        aidaLogging('Unsupported image type:', mimeType, 'defaulting to image/png');
        mimeType = 'image/png';
    }

    if (!base64Data) {
        aidaLogging('Failed to extract base64 data from image');
        return null;
    }

    return { base64: base64Data, mimeType };
}

// ES exports
export {
    stripInternalBlocks,
    detectProvider,
    normalizeApiParameters,
    shouldUseApiKey,
    prepareImageForProvider
};
