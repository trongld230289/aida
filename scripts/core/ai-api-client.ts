/**
 * @module core/ai-api-client
 * @description External AI API client — callAI and executeAIReviewWithApiKey.
 * Extracted from ai-provider.ts during Sprint 3 refactoring.
 */

import * as vscode from 'vscode';
import { aidaLogging } from './settings';
import { estimateTokenCount } from './token-estimator';
import { getGlobalAbortSignal } from './abort-signal';
import { DEFAULTS } from './aida-config';
import { toError } from '../core/error-utils';
import { detectProvider, normalizeApiParameters, prepareImageForProvider } from './provider-detection';
import { mapProviderResponse } from './response-mappers';
import * as _reviewUI from './review-ui';

// Lazy require to avoid circular dependencies

/**
 * Reusable AI API call function with image support
 */
async function callAI(systemPrompt: string, userPrompt: string, options: Record<string, unknown> = {}, images: string[] = [], abortSignal: AbortSignal | null = null) {
    const config = vscode.workspace.getConfiguration('aida');
    const apiKey = config.get<string>('ai.apiKey');
    let apiHost: string = config.get<string>('ai.apiHost') || DEFAULTS.EXTERNAL_AI_HOST;
    const model: string = config.get<string>('ai.model') || 'gpt-4o';

    // Use global abort signal if none provided
    const signalToUse = abortSignal || getGlobalAbortSignal();

    if (!apiKey) {
        throw new Error('AI API key not configured. Please set aida.ai.apiKey in VS Code settings.');
    }

    // Ensure API host has the correct endpoint
    if (!apiHost.includes('/chat/completions') && !apiHost.includes('/v1') && !apiHost.includes('/messages')) {
        if (apiHost.includes('openai.com')) {
            apiHost = apiHost.replace(/\/$/, '') + '/v1/chat/completions';
        } else if (apiHost.includes('anthropic.com')) {
            apiHost = apiHost.replace(/\/$/, '') + '/v1/messages';
        } else {
            apiHost = apiHost.replace(/\/$/, '') + '/v1/chat/completions';
        }
    }

    const defaultOptions = {
        temperature: 0.1,
        max_tokens: DEFAULTS.MAX_TOKENS_REVIEW,
        response_format: { type: "json_object" },
        ...options
    };

    // Normalize API parameters based on provider/model
    const normalizedOptions = normalizeApiParameters(model, apiHost, defaultOptions);

    // Build messages with optional image support
    const messages = [
        {
            role: 'system',
            content: systemPrompt
        }
    ];

    // Build user message with images if provided
    const userMessage: { role: string; content: string | Record<string, any>[] } = {
        role: 'user',
        content: userPrompt
    };

    // Add images for vision models if provided
    if (images && images.length > 0) {
        aidaLogging(`🖼️ Adding ${images.length} images to API call`);

        const provider = detectProvider(apiHost, model);

        if (provider === 'anthropic') {
            userMessage.content = [
                { type: 'text', text: userPrompt }
            ];
            for (const image of images) {
                const imageData = prepareImageForProvider(image, 'anthropic');
                if (imageData) {
                    userMessage.content.push({
                        type: 'image',
                        source: {
                            type: 'base64',
                            media_type: imageData.mimeType,
                            data: imageData.base64
                        }
                    });
                }
            }
        } else {
            userMessage.content = [
                { type: 'text', text: userPrompt }
            ];
            for (const image of images) {
                const imageData = prepareImageForProvider(image, 'openai');
                if (imageData) {
                    userMessage.content.push({
                        type: 'image_url',
                        image_url: {
                            url: `data:${imageData.mimeType};base64,${imageData.base64}`
                        }
                    });
                }
            }
        }
    }

    messages.push(userMessage as any);

    aidaLogging(`🔑 Making API call to: ${apiHost}`);
    aidaLogging(`🤖 Using model: ${model}`);
    aidaLogging(`📋 Request payload:`, JSON.stringify({
        model: model,
        messages: messages.map(m => ({
            role: m.role,
            content: typeof m.content === 'string' ? m.content.substring(0, 100) + '...' : '[content array]'
        })),
        ...normalizedOptions
    }, null, 2));

    const response = await fetch(apiHost, {
        method: 'POST',
        signal: signalToUse,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'User-Agent': 'VS Code AI Self Check Extension'
        },
        body: JSON.stringify({
            model: model,
            messages: messages,
            ...normalizedOptions
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`AI API error: ${response.status} - ${errorText}`);
    }

    // Handle streaming vs non-streaming responses
    if (normalizedOptions.stream) {
        aidaLogging('🔄 Streaming response detected');
        return {
            streamResponse: response,
            apiHost: apiHost,
            model: model,
            isStreaming: true
        };
    } else {
        const data = await response.json();
        aidaLogging('🔍 Raw API response received:', JSON.stringify(data, null, 2));
        return {
            rawResponse: data,
            apiHost: apiHost,
            model: model,
            isStreaming: false
        };
    }
}

/**
 * Execute AI call using API key (OpenAI, Claude, etc.)
 */
async function executeAIReviewWithApiKey(userPrompt: string, stream: vscode.ChatResponseStream, reviewType: string, attemptCount = 0, abortSignal: AbortSignal | null = null) {
    const config = vscode.workspace.getConfiguration('aida');
    const apiKey = config.get<string>('ai.apiKey');
    let apiHost: string = config.get<string>('ai.apiHost') || DEFAULTS.EXTERNAL_AI_HOST;
    const model: string = config.get<string>('ai.model') || 'gpt-4o';
    try {
        // Ensure API host has the correct endpoint
        if (!apiHost.includes('/chat/completions') && !apiHost.includes('/v1')) {
            if (apiHost.includes('openai.com')) {
                apiHost = apiHost.replace(/\/$/, '') + '/v1/chat/completions';
            } else if (apiHost.includes('anthropic.com')) {
                apiHost = apiHost.replace(/\/$/, '') + '/v1/messages';
            } else {
                apiHost = apiHost.replace(/\/$/, '') + '/v1/chat/completions';
            }
        }

        if (!apiKey) {
            throw new Error('AI API key not configured. Please set aida.ai.apiKey in VS Code settings.');
        }

        aidaLogging(`📤 API Key mode - Attempt ${attemptCount + 1}: Sending request to ${apiHost} with model: ${model}`);
        aidaLogging(`🔑 API Key configured: ${apiKey ? 'Yes' : 'No'}`);
        aidaLogging(`🌐 Final API Host: ${apiHost}`);

        const reviewIcon = reviewType === 'Changes' ? '📝' : '📄';
        const modelStatus = attemptCount === 0 ? 'API key mode' : `API key fallback (attempt ${attemptCount + 1})`;

        stream.markdown(`🤖 **Streaming ${reviewType} ${reviewIcon}** (using ${model} - ${modelStatus}):\n\n`);
        stream.markdown(`🧠 **Host**: ${apiHost}\n\n`);
        stream.markdown('---\n\n');

        aidaLogging(`🔍 UserPrompt length: ${userPrompt.length} characters`);
        aidaLogging(`🔍 UserPrompt preview (first 500 chars):`, userPrompt.substring(0, 500));
        aidaLogging(`🔍 UserPrompt contains 'MANDATORY CHANGE ANALYSIS':`, userPrompt.includes('MANDATORY CHANGE ANALYSIS'));
        aidaLogging(`🔍 UserPrompt contains diff (+++/-):`, userPrompt.includes('+++') || userPrompt.includes('---'));

        const defaultOptions = {
            temperature: 0.1,
            max_tokens: DEFAULTS.MAX_TOKENS_REVIEW,
            stream: true,
            response_format: undefined as any
        };

        const result = await callAI('You are an expert code reviewer and software architect. Provide detailed, actionable code review feedback.', userPrompt, defaultOptions, [], abortSignal);

        let mappedResponse: Record<string, any>;
        let outputText = '';

        const provider = detectProvider(result.apiHost, result.model || model);

        if (result.isStreaming) {
            aidaLogging('🔄 Handling streaming response...');

            const reader = result.streamResponse!.body!.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let totalInputTokens = 0;
            let totalOutputTokens = 0;

            try {
                // Line-buffered streaming: flush on complete lines
                // to prevent broken markdown rendering (e.g., partial **bold**, incomplete lists)
                let mdLineBuffer = '';

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const data = line.slice(6);
                            if (data === '[DONE]') continue;

                            try {
                                const parsed = JSON.parse(data);
                                const content = parsed.choices?.[0]?.delta?.content || '';
                                if (content) {
                                    outputText += content;
                                    mdLineBuffer += content;

                                    // Flush complete lines
                                    const lastNewline = mdLineBuffer.lastIndexOf('\n');
                                    if (lastNewline !== -1) {
                                        stream.markdown(mdLineBuffer.substring(0, lastNewline + 1));
                                        mdLineBuffer = mdLineBuffer.substring(lastNewline + 1);
                                    }
                                }
                                if (parsed.usage) {
                                    totalInputTokens = parsed.usage.prompt_tokens || 0;
                                    totalOutputTokens = parsed.usage.completion_tokens || 0;
                                }
                            } catch (_e: unknown) {
                                aidaLogging('⚠️ Failed to parse streaming chunk:', data);
                            }
                        }
                    }
                }

                // Flush any remaining buffered content
                if (mdLineBuffer) {
                    stream.markdown(mdLineBuffer);
                }

                if (totalInputTokens === 0 && totalOutputTokens === 0) {
                    aidaLogging('⚠️ STU Platform streaming: No token usage in response, falling back to estimation');
                    totalInputTokens = estimateTokenCount(userPrompt);
                    totalOutputTokens = estimateTokenCount(outputText);
                }

                mappedResponse = {
                    content: outputText,
                    inputTokens: totalInputTokens,
                    outputTokens: totalOutputTokens,
                    totalTokens: totalInputTokens + totalOutputTokens
                };

            } finally {
                reader.releaseLock();
            }
        } else {
            mappedResponse = mapProviderResponse(result.rawResponse as any, provider);

            aidaLogging(`🏯 Mapped response for ${provider}:`, mappedResponse);

            if (mappedResponse.error === 'COMPLEX_PARSING_FAILED') {
                aidaLogging(`⚠️ ${provider} failed on complex content parsing - triggering Copilot fallback`);
                if (!mappedResponse.content || mappedResponse.content.trim().length === 0) {
                    throw new Error(`${provider} complex parsing failed - content too complex for current parser`);
                } else {
                    aidaLogging(`✅ ${provider} recovered content despite parsing complexity - proceeding normally`);
                    delete mappedResponse.error;
                }
            }

            if (!mappedResponse.content) {
                aidaLogging(`⚠️ No content extracted from ${provider} response, but API call succeeded`);
                const fallbackMessage = `⚠️ **${provider.toUpperCase()} API Response Issue**: The API call succeeded and returned ${mappedResponse.outputTokens} tokens, but content extraction failed. This suggests a response format compatibility issue rather than an API failure.\n\n**Possible solutions:**\n- Try a different model (e.g., switch from GPT-5 to GPT-4o)\n- Check API provider documentation for response format changes\n- Contact support if the issue persists\n\n**Debug info**: Provider: ${provider}, Output tokens: ${mappedResponse.outputTokens}`;

                stream.markdown(fallbackMessage);

                const actualTokens = {
                    inputTokens: mappedResponse.inputTokens,
                    outputTokens: mappedResponse.outputTokens,
                    totalTokens: mappedResponse.totalTokens
                };
                _reviewUI.showTokenStatistics(stream, userPrompt, fallbackMessage, { family: model }, reviewType, attemptCount, provider, result.apiHost, actualTokens);

                return true;
            }

            outputText = typeof mappedResponse.content === 'string' ? mappedResponse.content : JSON.stringify(mappedResponse.content, null, 2);
            stream.markdown(outputText);
        }

        const actualTokens = {
            inputTokens: mappedResponse.inputTokens,
            outputTokens: mappedResponse.outputTokens,
            totalTokens: mappedResponse.totalTokens
        };

        _reviewUI.showTokenStatistics(stream, userPrompt, outputText, { family: model }, reviewType, attemptCount, provider, result.apiHost, actualTokens);

        return true;

    } catch (_apiError: unknown) {
        const apiError = toError(_apiError);
        aidaLogging(`❌ API Key mode failed (attempt ${attemptCount + 1}):`, apiError);

        let errorDetails = apiError.message;
        if (apiError.message.includes('fetch')) {
            errorDetails += `\n🔍 **Debug**: Check API Host (${apiHost}) and network connectivity`;
        }
        if (!apiKey) {
            errorDetails += `\n🔑 **Missing API Key**: Please set aida.ai.apiKey in VS Code settings`;
        }

        stream.markdown(`❌ **API Key mode failed:** ${errorDetails}\n\n`);
        throw apiError;
    }
}

// ES exports
export {
    callAI,
    executeAIReviewWithApiKey
};
