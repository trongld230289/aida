/**
 * @module core/response-mappers
 * @description AI provider response mapping functions.
 * Extracted from ai-provider.ts during Sprint 3 refactoring.
 */

import { aidaLogging } from './settings';
import type { IAIResponse } from './interfaces/ai-provider.interface';

/**
 * Map OpenAI API response to normalised format
 */
function mapOpenAIResponse(data: Record<string, any>): IAIResponse {
    return {
        content: data.choices?.[0]?.message?.content || null,
        inputTokens: data.usage?.prompt_tokens || 0,
        outputTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0
    };
}

function mapAnthropicResponse(data: Record<string, any>): IAIResponse {
    return {
        content: data.content?.[0]?.text || data.completion || null,
        inputTokens: data.usage?.input_tokens || 0,
        outputTokens: data.usage?.output_tokens || 0,
        totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0)
    };
}

function mapGoogleResponse(data: Record<string, any>): IAIResponse {
    return {
        content: data.candidates?.[0]?.content?.parts?.[0]?.text || null,
        inputTokens: data.usage?.prompt_token_count || 0,
        outputTokens: data.usage?.candidates_token_count || 0,
        totalTokens: data.usage?.total_token_count || 0
    };
}

function mapSTUResponse(data: Record<string, any>): IAIResponse & { error?: string } {
    aidaLogging('🔍 STU Response Mapping - Full structure analysis:');
    aidaLogging('📊 Top-level keys:', Object.keys(data));

    if (data.choices) {
        aidaLogging('📊 Choices array length:', data.choices.length);
        if (data.choices[0]) {
            aidaLogging('📊 First choice keys:', Object.keys(data.choices[0]));
            if (data.choices[0].message) {
                aidaLogging('📊 Message keys:', Object.keys(data.choices[0].message));
                aidaLogging('📊 Message content type:', typeof data.choices[0].message.content);
                aidaLogging('📊 Message content length:', data.choices[0].message.content?.length || 'null/undefined');
            }
        }
    }

    if (data.usage) {
        aidaLogging('📊 Usage:', JSON.stringify(data.usage, null, 2));
    }

    // STU Platform may have different response structure
    let content = null;

    // Primary: Standard OpenAI format
    if (data.choices?.[0]?.message?.content) {
        content = data.choices[0].message.content;
        aidaLogging('✅ Content found in standard location');
    }

    // Special case: STU Platform sometimes returns empty content even with tokens
    if (!content && data.usage?.completion_tokens > 0) {
        aidaLogging('⚠️ STU Platform returned tokens but empty content:');
        aidaLogging(`   - Input tokens: ${data.usage.prompt_tokens}`);
        aidaLogging(`   - Output tokens: ${data.usage.completion_tokens}`);
        aidaLogging(`   - Total tokens: ${data.usage.total_tokens}`);
        aidaLogging('   - Checking alternative content fields...');

        // Try alternative fields
        const alternatives = ['content', 'answer', 'generated_text', 'completion', 'text'];
        for (const field of alternatives) {
            if (data[field]) {
                aidaLogging(`✅ Found content in alternative field: ${field}`);
                content = data[field];
                break;
            }
        }

        // Check nested structures
        if (!content && data.data) {
            aidaLogging('🔍 Checking nested data structure...');
            content = data.data.choices?.[0]?.message?.content || data.data.content;
        }

        // If still no content but we have tokens, try aggressive parsing
        if (!content) {
            aidaLogging('⚠️ STU Platform: Trying aggressive content parsing...');

            // Enhanced content extraction for complex structures
            const smartContentExtraction = (obj: unknown, path = '', depth = 0): string | null => {
                // Prevent infinite recursion
                if (depth > 10) return null;

                // Check for string content (more flexible length check)
                if (typeof obj === 'string') {
                    const trimmed = obj.trim();
                    // Accept any meaningful text content (even short ones)
                    if (trimmed.length > 10 && (trimmed.includes('#') || trimmed.includes('**') || trimmed.includes('```') || trimmed.length > 50)) {
                        aidaLogging(`✅ Found meaningful content at ${path}: ${trimmed.substring(0, 150)}...`);
                        return trimmed;
                    }
                }

                // Handle arrays (common in streaming responses)
                if (Array.isArray(obj)) {
                    for (let i = 0; i < obj.length; i++) {
                        const innerResult1 = smartContentExtraction((obj as Record<string, any>)[i], `${path}[${i}]`, depth + 1);
                        if (innerResult1) return innerResult1;
                    }
                }

                // Handle objects with priority fields first
                if (typeof obj === 'object' && obj !== null) {
                    // Priority fields (likely to contain content)
                    const priorityFields = ['content', 'message', 'text', 'response', 'answer', 'data', 'result'];

                    for (const field of priorityFields) {
                        if ((obj as Record<string, any>)[field] !== undefined) {
                            const innerResult2 = smartContentExtraction((obj as Record<string, any>)[field], `${path}.${field}`, depth + 1);
                            if (innerResult2) return innerResult2;
                        }
                    }

                    // Then check all other fields
                    for (const [key, value] of (Object.entries(obj))) {
                        if (!priorityFields.includes(key)) {
                             const innerResult3 = smartContentExtraction(value, `${path}.${key}`, depth + 1);
                            if (innerResult3) return innerResult3;
                        }
                    }
                }

                return null;
            };

            content = smartContentExtraction(data);

            // Advanced recovery: Try to reconstruct content from partial data
            if (!content) {
                aidaLogging('🔄 STU Platform: Attempting advanced content recovery...');

                // Try to find any text fragments
                const fragments: string[] = [];
                const collectTextFragments = (obj: unknown, maxDepth = 5, currentDepth = 0) => {
                    if (currentDepth >= maxDepth) return;

                    if (typeof obj === 'string' && obj.trim().length > 5) {
                        fragments.push(obj.trim());
                    } else if (Array.isArray(obj)) {
                        obj.forEach(item => collectTextFragments(item, maxDepth, currentDepth + 1));
                    } else if (typeof obj === 'object' && obj !== null) {
                        (Object.values(obj)).forEach(value => collectTextFragments(value, maxDepth, currentDepth + 1));
                    }
                };

                collectTextFragments(data);

                // If we found fragments, try to piece them together
                if (fragments.length > 0) {
                    // Filter meaningful fragments (avoid single chars, numbers, etc.)
                    const meaningfulFragments = fragments.filter(frag =>
                        frag.length > 10 &&
                        /[a-zA-Z]/.test(frag) &&
                        !frag.match(/^[\d\s\-_]+$/)
                    );

                    if (meaningfulFragments.length > 0) {
                        content = meaningfulFragments.join('\n\n');
                        aidaLogging(`✅ STU Platform: Reconstructed content from ${meaningfulFragments.length} fragments`);
                    }
                }

                // Final fallback: Check if this is a streaming response issue
                if (!content && data.choices && data.choices.length > 0) {
                    const choice = data.choices[0];
                    if (choice.delta && choice.delta.content) {
                        content = choice.delta.content;
                        aidaLogging('✅ STU Platform: Found content in streaming delta');
                    }
                }

                // If absolutely no content found, return error for fallback
                if (!content) {
                    aidaLogging('❌ STU Platform: All content recovery attempts failed');
                    aidaLogging('🧠 Falling back to Copilot for this request');
                    return { content: null as any, error: 'COMPLEX_PARSING_FAILED', inputTokens: data.usage?.prompt_tokens || 0, outputTokens: data.usage?.completion_tokens || 0, totalTokens: 0 };
                }
            }
        }
    }

    // Fallback for other fields if still no content
    if (!content) {
        aidaLogging('🔍 Fallback content search...');
        content = data.content ||
            data.answer ||
            data.generated_text ||
            data.completion ||
            null;
    }

    const result: IAIResponse = {
        content: content,
        inputTokens: data.usage?.prompt_tokens || 0,
        outputTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0
    };

    aidaLogging('🏯 Final STU mapping result:', {
        hasContent: !!result.content,
        contentLength: (typeof result.content === 'string' ? result.content.length : 0),
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens
    });

    return result;
}

function mapGenericResponse(data: Record<string, any>): IAIResponse {
    // Generic fallback for any provider
    return {
        content: data.choices?.[0]?.message?.content ||
            data.choices?.[0]?.text ||
            data.content ||
            data.text ||
            data.result ||
            data.response ||
            data.output ||
            data.completion || null,
        inputTokens: data.usage?.prompt_tokens || data.usage?.input_tokens || 0,
        outputTokens: data.usage?.completion_tokens || data.usage?.output_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0
    };
}

/**
 * Map API response based on provider
 */
function mapProviderResponse(rawResponse: Record<string, any>, provider: string) {
    aidaLogging(`🔄 Mapping response for provider: ${provider}`);

    switch (provider) {
        case 'openai':
        case 'azure':
            return mapOpenAIResponse(rawResponse);
        case 'anthropic':
            return mapAnthropicResponse(rawResponse);
        case 'google':
            return mapGoogleResponse(rawResponse);
        case 'stu':
            return mapSTUResponse(rawResponse);
        case 'cohere':
        case 'huggingface':
        case 'ollama':
        case 'custom':
        default:
            return mapGenericResponse(rawResponse);
    }
}

// ES exports
export {
    mapOpenAIResponse,
    mapAnthropicResponse,
    mapGoogleResponse,
    mapSTUResponse,
    mapGenericResponse,
    mapProviderResponse
};
