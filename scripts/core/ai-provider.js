/**
 * @module ai-provider
 * @description AI provider integration, API calls, response mapping, and fallback logic
 * Extracted from review-common.js during Phase 1 refactoring
 */

const vscode = require('vscode');
const { aidaLogging } = require('./settings');
const { estimateTokenCount } = require('./token-estimator');
const { getGlobalAbortSignal } = require('./abort-signal');

// Lazy require to avoid circular dependencies
function _getReviewUI() { return require('./review-ui'); }
function _getModelSelector() { return require('./model-selector'); }

function stripInternalBlocks(output) {
    // Remove <INTERNAL_ONLY>...</INTERNAL_ONLY> blocks
    let cleanedOutput = output.replace(/<INTERNAL_ONLY>[\s\S]*?<\/INTERNAL_ONLY>/g, '');

    // // Remove HTML comments (<!-- ... -->)
    // cleanedOutput = cleanedOutput.replace(/<!--[\s\S]*?-->/g, '');

    // // Clean up multiple newlines
    // cleanedOutput = cleanedOutput.replace(/\n{3,}/g, '\n\n');

    return cleanedOutput.trim();
}

// Unified fallback model selection function
async function getFallbackModel(currentModel, stream, attemptNumber = 1) {
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

        // Priority 1: Claude models (if available)
        fallbackModel = availableModels.find(m =>
            m.family.toLowerCase().includes('claude') &&
            (m.family.includes('4') || m.family.toLowerCase().includes('sonnet'))
        );

        // Priority 2: GPT models (if no Claude available)
        if (!fallbackModel) {
            fallbackModel = availableModels.find(m =>
                m.family.toLowerCase().includes('gpt') &&
                (m.family.includes('4o') || m.family.includes('4'))
            );
        }

        // Priority 3: First available model
        if (!fallbackModel) {
            fallbackModel = availableModels[0];
        }

        // Show detailed fallback information with reasoning
        const availableList = availableModels.map(m => m.family).join(', ');

        aidaLogging(`🔄 Fallback ${attemptNumber}: ${currentModel.family} → ${fallbackModel.family}`);

        // Show user-friendly fallback messaging
        stream.markdown(`🔄 **Switching models** (attempt ${attemptNumber}):\n`);
        stream.markdown(`   ❌ **Previous:** ${currentModel.family} (failed)\n`);
        stream.markdown(`   ✅ **New:** ${fallbackModel.family} (selected as fallback)\n\n`);

        // Show fallback reasoning
        if (fallbackModel.family.toLowerCase().includes('claude')) {
            stream.markdown(`💡 **Fallback reason:** Switched to Claude model (Priority 1 fallback)\n\n`);
        } else if (fallbackModel.family.toLowerCase().includes('gpt')) {
            stream.markdown(`💡 **Fallback reason:** Switched to GPT model (Priority 2 fallback)\n\n`);
        } else {
            stream.markdown(`💡 **Fallback reason:** Using first available model (Priority 3 fallback)\n\n`);
        }

        stream.markdown(`📋 **All available models:** ${availableList}\n\n`);
        stream.markdown('⏳ **Continuing analysis with new model...**\n\n');

        return fallbackModel;

    } catch (error) {
        aidaLogging('❌ Fallback model selection failed:', error);
        stream.markdown(`❌ **Fallback failed:** ${error.message}\n\n`);
        throw error;
    }
}

/**
 * 🔄 Response mapping functions for different providers
 */
function mapOpenAIResponse(data) {
    return {
        content: data.choices?.[0]?.message?.content || null,
        inputTokens: data.usage?.prompt_tokens || 0,
        outputTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0
    };
}

function mapAnthropicResponse(data) {
    return {
        content: data.content?.[0]?.text || data.completion || null,
        inputTokens: data.usage?.input_tokens || 0,
        outputTokens: data.usage?.output_tokens || 0,
        totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0)
    };
}

function mapGoogleResponse(data) {
    return {
        content: data.candidates?.[0]?.content?.parts?.[0]?.text || null,
        inputTokens: data.usage?.prompt_token_count || 0,
        outputTokens: data.usage?.candidates_token_count || 0,
        totalTokens: data.usage?.total_token_count || 0
    };
}

function mapSTUResponse(data) {
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
            const smartContentExtraction = (obj, path = '', depth = 0) => {
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
                        const result = smartContentExtraction(obj[i], `${path}[${i}]`, depth + 1);
                        if (result) return result;
                    }
                }

                // Handle objects with priority fields first
                if (typeof obj === 'object' && obj !== null) {
                    // Priority fields (likely to contain content)
                    const priorityFields = ['content', 'message', 'text', 'response', 'answer', 'data', 'result'];

                    for (const field of priorityFields) {
                        if (obj[field] !== undefined) {
                            const result = smartContentExtraction(obj[field], `${path}.${field}`, depth + 1);
                            if (result) return result;
                        }
                    }

                    // Then check all other fields
                    for (const [key, value] of Object.entries(obj)) {
                        if (!priorityFields.includes(key)) {
                            const result = smartContentExtraction(value, `${path}.${key}`, depth + 1);
                            if (result) return result;
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
                const fragments = [];
                const collectTextFragments = (obj, maxDepth = 5, currentDepth = 0) => {
                    if (currentDepth >= maxDepth) return;

                    if (typeof obj === 'string' && obj.trim().length > 5) {
                        fragments.push(obj.trim());
                    } else if (Array.isArray(obj)) {
                        obj.forEach(item => collectTextFragments(item, maxDepth, currentDepth + 1));
                    } else if (typeof obj === 'object' && obj !== null) {
                        Object.values(obj).forEach(value => collectTextFragments(value, maxDepth, currentDepth + 1));
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
                    aidaLogging('🔧 Falling back to Copilot for this request');
                    return { content: null, error: 'COMPLEX_PARSING_FAILED', inputTokens: data.usage?.prompt_tokens || 0, outputTokens: data.usage?.completion_tokens || 0 };
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

    const result = {
        content: content,
        inputTokens: data.usage?.prompt_tokens || 0,
        outputTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0
    };

    aidaLogging('🎯 Final STU mapping result:', {
        hasContent: !!result.content,
        contentLength: result.content?.length || 0,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens
    });

    return result;
}

function mapGenericResponse(data) {
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
 * 🎯 Map API response based on provider
 * @param {object} rawResponse - Raw API response
 * @param {string} provider - Provider name
 * @returns {object} - Mapped response with content and token info
 */
function mapProviderResponse(rawResponse, provider) {
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

/**
 * Check if user wants to use API key instead of Copilot
 * @returns {boolean} - true if API key mode is enabled
 */
function shouldUseApiKey() {
    const config = vscode.workspace.getConfiguration('aida');
    const useApiKey = config.get('useExternalAI', false);
    const apiKey = config.get('ai.apiKey');

    aidaLogging(`🔍 API Key mode check: useExternalAI=${useApiKey}, hasApiKey=${!!apiKey}`);

    return useApiKey && !!apiKey;
}

/**
 * Execute AI call using API key (OpenAI, Claude, etc.)
 * @param {string} userPrompt - The prompt to send
 * @param {object} stream - Chat stream for output
 * @param {string} reviewType - Type of review
 * @param {number} attemptCount - Current attempt number
 * @returns {Promise<boolean>} - true if successful
 */
async function executeAIReviewWithApiKey(userPrompt, stream, reviewType, attemptCount = 0, abortSignal = null) {
    try {
        const config = vscode.workspace.getConfiguration('aida');
        const apiKey = config.get('ai.apiKey');
        let apiHost = config.get('ai.apiHost') || 'https://api.openai.com';
        const model = config.get('ai.model') || 'gpt-4o';

        // Ensure API host has the correct endpoint
        if (!apiHost.includes('/chat/completions') && !apiHost.includes('/v1')) {
            if (apiHost.includes('openai.com')) {
                apiHost = apiHost.replace(/\/$/, '') + '/v1/chat/completions';
            } else if (apiHost.includes('anthropic.com')) {
                apiHost = apiHost.replace(/\/$/, '') + '/v1/messages';
            } else {
                // Assume OpenAI-compatible format for custom hosts
                apiHost = apiHost.replace(/\/$/, '') + '/v1/chat/completions';
            }
        }

        if (!apiKey) {
            throw new Error('AI API key not configured. Please set aida.ai.apiKey in VS Code settings.');
        }

        aidaLogging(`📤 API Key mode - Attempt ${attemptCount + 1}: Sending request to ${apiHost} with model: ${model}`);
        aidaLogging(`🔑 API Key configured: ${apiKey ? 'Yes' : 'No'}`);
        aidaLogging(`🌐 Final API Host: ${apiHost}`);

        const reviewIcon = reviewType === 'Changes' ? '🔍' : '📄';
        const modelStatus = attemptCount === 0 ? 'API key mode' : `API key fallback (attempt ${attemptCount + 1})`;

        stream.markdown(`🤖 **Streaming ${reviewType} ${reviewIcon}** (using ${model} - ${modelStatus}):\n\n`);
        stream.markdown(`🔧 **Host**: ${apiHost}\n\n`);
        stream.markdown('---\n\n');

        // Debug: Check if userPrompt contains template and diff
        aidaLogging(`🔍 UserPrompt length: ${userPrompt.length} characters`);
        aidaLogging(`🔍 UserPrompt preview (first 500 chars):`, userPrompt.substring(0, 500));
        aidaLogging(`🔍 UserPrompt contains 'MANDATORY CHANGE ANALYSIS':`, userPrompt.includes('MANDATORY CHANGE ANALYSIS'));
        aidaLogging(`🔍 UserPrompt contains diff (+++/-):`, userPrompt.includes('+++') || userPrompt.includes('---'));

        // Use the shared callAI function
        const defaultOptions = {
            temperature: 0.1,
            max_tokens: 8000, // Increased for comprehensive reviews - Claude 4 max is 8192
            stream: true, // Enable streaming for better UX
            response_format: undefined // Remove JSON format for reviews
        };

        const result = await callAI('You are an expert code reviewer and software architect. Provide detailed, actionable code review feedback.', userPrompt, defaultOptions, [], abortSignal);

        let mappedResponse;
        let outputText = '';

        // Detect provider for both streaming and non-streaming responses
        const provider = detectProvider(result.apiHost, result.model || model);

        if (result.isStreaming) {
            aidaLogging('🔄 Handling streaming response...');

            // Handle streaming response
            const reader = result.streamResponse.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let totalInputTokens = 0;
            let totalOutputTokens = 0;

            try {
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
                                    stream.markdown(content); // Stream each chunk immediately
                                }

                                // Collect token usage if available
                                if (parsed.usage) {
                                    totalInputTokens = parsed.usage.prompt_tokens || 0;
                                    totalOutputTokens = parsed.usage.completion_tokens || 0;
                                }
                            } catch (e) {
                                aidaLogging('⚠️ Failed to parse streaming chunk:', data);
                            }
                        }
                    }
                }

                // Fallback to estimation if streaming didn't provide token usage
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
            // Handle non-streaming response
            mappedResponse = mapProviderResponse(result.rawResponse, provider);

            aidaLogging(`🎯 Mapped response for ${provider}:`, mappedResponse);

            // Handle complex parsing failure - trigger fallback to Copilot
            if (mappedResponse.error === 'COMPLEX_PARSING_FAILED') {
                aidaLogging(`⚠️ ${provider} failed on complex content parsing - triggering Copilot fallback`);
                // Only throw if we truly have no content
                if (!mappedResponse.content || mappedResponse.content.trim().length === 0) {
                    throw new Error(`${provider} complex parsing failed - content too complex for current parser`);
                } else {
                    aidaLogging(`✅ ${provider} recovered content despite parsing complexity - proceeding normally`);
                    // Clear the error flag since we have content
                    delete mappedResponse.error;
                }
            }

            if (!mappedResponse.content) {
                aidaLogging(`⚠️ No content extracted from ${provider} response, but API call succeeded`);
                // Don't throw error - API succeeded, just show a helpful message
                const fallbackMessage = `⚠️ **${provider.toUpperCase()} API Response Issue**: The API call succeeded and returned ${mappedResponse.outputTokens} tokens, but content extraction failed. This suggests a response format compatibility issue rather than an API failure.\n\n**Possible solutions:**\n- Try a different model (e.g., switch from GPT-5 to GPT-4o)\n- Check API provider documentation for response format changes\n- Contact support if the issue persists\n\n**Debug info**: Provider: ${provider}, Output tokens: ${mappedResponse.outputTokens}`;

                stream.markdown(fallbackMessage);

                // Show token statistics even with empty content (using actual tokens)
                const actualTokens = {
                    inputTokens: mappedResponse.inputTokens,
                    outputTokens: mappedResponse.outputTokens,
                    totalTokens: mappedResponse.totalTokens
                };
                _getReviewUI().showTokenStatistics(stream, userPrompt, fallbackMessage, { family: model }, reviewType, attemptCount, provider, result.apiHost, actualTokens);

                return true; // Don't trigger fallback since API actually worked
            }            // Handle both JSON and text responses
            outputText = typeof mappedResponse.content === 'string' ? mappedResponse.content : JSON.stringify(mappedResponse.content, null, 2);

            // Stream the output (simulate streaming for consistency)
            stream.markdown(outputText);
        }

        // Show completion with token statistics using actual tokens from API
        const actualTokens = {
            inputTokens: mappedResponse.inputTokens,
            outputTokens: mappedResponse.outputTokens,
            totalTokens: mappedResponse.totalTokens
        };

        _getReviewUI().showTokenStatistics(stream, userPrompt, outputText, { family: model }, reviewType, attemptCount, provider, result.apiHost, actualTokens);

        return true;

    } catch (apiError) {
        aidaLogging(`❌ API Key mode failed (attempt ${attemptCount + 1}):`, apiError);

        // Provide detailed error information
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

/**
 * 🔍 Detect AI provider from API host and model (moved from scan-app.js)
 * @param {string} apiHost - API host URL
 * @param {string} model - Model name
 * @returns {string} - Provider identifier
 */
function detectProvider(apiHost, model) {
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
 * 🔧 Normalize API parameters based on provider/model (moved from scan-app.js)
 * @param {string} model - Model name
 * @param {string} apiHost - API host URL
 * @param {object} options - Original options
 * @returns {object} - Normalized options
 */
function normalizeApiParameters(model, apiHost, options) {
    const normalized = { ...options };

    // Detect provider from API host or model name
    const provider = detectProvider(apiHost, model);

    aidaLogging(`🔄 Normalizing parameters for provider: ${provider}`);

    switch (provider) {
        case 'openai':
            // OpenAI uses max_tokens
            if (options.max_completion_tokens) {
                normalized.max_tokens = options.max_completion_tokens;
                delete normalized.max_completion_tokens;
            }
            break;

        case 'anthropic':
            // Anthropic uses max_tokens but different structure
            if (options.max_tokens) {
                normalized.max_tokens = options.max_tokens;
            }
            // Remove OpenAI-specific parameters
            delete normalized.response_format;
            break;

        case 'google':
            // Google PaLM/Gemini uses different parameter names
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
            // Cohere uses max_generation_length
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
            // STU Platform - experimental GPT-5 compatibility mode
            aidaLogging('🔧 STU Platform detected - applying compatibility fixes...');

            // Remove ALL potentially problematic parameters for GPT-5
            if (model.includes('gpt-5') || model.toLowerCase().includes('gpt-5')) {
                aidaLogging('⚠️ GPT-5 on STU Platform - Using minimal parameter set');

                // Keep only essential parameters
                const essentialParams = {
                    model: normalized.model,
                    messages: normalized.messages,
                    stream: normalized.stream || false
                };

                // Clear all other parameters that might cause conflicts
                Object.keys(normalized).forEach(key => {
                    if (!essentialParams.hasOwnProperty(key)) {
                        delete normalized[key];
                    }
                });

                aidaLogging('🔧 STU GPT-5 params:', Object.keys(normalized));
            } else {
                // For non-GPT-5 models, use standard parameter mapping
                if (options.max_tokens) {
                    normalized.max_completion_tokens = options.max_tokens;
                    delete normalized.max_tokens;
                }
            }
            break;

        case 'azure':
            // Azure OpenAI uses max_completion_tokens for most models
            if (options.max_tokens) {
                // Azure prefers max_completion_tokens for all GPT models
                normalized.max_completion_tokens = options.max_tokens;
                delete normalized.max_tokens;
            }
            if (options.max_completion_tokens) {
                // Keep it if already set
                normalized.max_completion_tokens = options.max_completion_tokens;
            }
            break;

        case 'huggingface':
            // HuggingFace uses max_new_tokens
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
            // Ollama uses num_predict
            if (options.max_tokens) {
                normalized.num_predict = options.max_tokens;
                delete normalized.max_tokens;
            }
            if (options.max_completion_tokens) {
                normalized.num_predict = options.max_completion_tokens;
                delete normalized.max_completion_tokens;
            }
            // Remove OpenAI-specific parameters
            delete normalized.response_format;
            break;

        case 'custom':
        default:
            // For custom providers, try to detect based on model name
            if (model.includes('claude')) {
                // Likely Anthropic-compatible
                delete normalized.response_format;
            } else if (model.includes('gemini') || model.includes('palm')) {
                // Likely Google-compatible
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
 * 🤖 Reusable AI API call function with image support
 * @param {string} systemPrompt - System prompt
 * @param {string} userPrompt - User prompt  
 * @param {object} options - API call options
 * @param {Array} images - Optional array of images for vision models
 * @returns {Promise<object>} - API response with token usage
 */
async function callAI(systemPrompt, userPrompt, options = {}, images = [], abortSignal = null) {
    const config = vscode.workspace.getConfiguration('aida');
    const apiKey = config.get('ai.apiKey');
    let apiHost = config.get('ai.apiHost') || 'https://api.openai.com';
    const model = config.get('ai.model') || 'gpt-4o';

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
            // Assume OpenAI-compatible format for custom hosts
            apiHost = apiHost.replace(/\/$/, '') + '/v1/chat/completions';
        }
    }

    const defaultOptions = {
        temperature: 0.1,
        max_tokens: 8000, // Increased for comprehensive analysis - Claude 4 max is 8192
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
    const userMessage = {
        role: 'user',
        content: userPrompt
    };

    // Add images for vision models if provided
    if (images && images.length > 0) {
        aidaLogging(`�️ Adding ${images.length} images to API call`);

        // Detect provider for image format
        const provider = detectProvider(apiHost, model);

        if (provider === 'anthropic') {
            // Claude format: content array with text and images
            userMessage.content = [
                {
                    type: 'text',
                    text: userPrompt
                }
            ];

            // Add images in Claude format
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
            // OpenAI format: content array with text and image_url
            userMessage.content = [
                {
                    type: 'text',
                    text: userPrompt
                }
            ];

            // Add images in OpenAI format
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

    messages.push(userMessage);

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
        signal: signalToUse, // Use the signal (global or passed)
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

        // Just return the raw response - mapping will be done by caller
        return {
            rawResponse: data,
            apiHost: apiHost,
            model: model,
            isStreaming: false
        };
    }
}

/**
 * 🖼️ Prepare image for specific AI provider format
 * @param {object|string} imageInput - Image data (base64 or data URL)
 * @param {string} provider - Target provider ('anthropic', 'openai', etc.)
 * @returns {object|null} - Prepared image data with base64 and mimeType
 */
function prepareImageForProvider(imageInput, provider = 'openai') {
    let base64Data, mimeType;

    if (typeof imageInput === 'string') {
        // If it's a data URL
        if (imageInput.startsWith('data:')) {
            const matches = imageInput.match(/^data:(image\/\w+);base64,(.+)$/);
            if (matches) {
                mimeType = matches[1];
                base64Data = matches[2];
            }
        } else {
            // Already clean base64
            base64Data = imageInput;
            mimeType = 'image/png';
        }
    } else if (imageInput && imageInput.data && imageInput.type) {
        // From our image attachment format
        if (imageInput.data.startsWith('data:')) {
            const matches = imageInput.data.match(/^data:(image\/\w+);base64,(.+)$/);
            if (matches) {
                mimeType = matches[1];
                base64Data = matches[2];
            }
        } else {
            base64Data = imageInput.data;
            mimeType = imageInput.type;
        }
    }

    // Validate mime type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(mimeType)) {
        aidaLogging('Unsupported image type:', mimeType, 'defaulting to image/png');
        mimeType = 'image/png';
    }

    if (!base64Data) {
        aidaLogging('Failed to extract base64 data from image');
        return null;
    }

    return { base64: base64Data, mimeType };
}

// Legacy function names for backward compatibility
const normalizeApiParametersForReview = normalizeApiParameters;
const detectProviderForReview = detectProvider;

/**
 * Unified AI execution function with token counting, streaming, and fallback logic
 * Enhanced with API key support for users without Copilot license
 * @param {string} userPrompt - The prompt to send to the AI model
 * @param {object} model - The AI model to use (null if using API key mode)
 * @param {object} stream - Chat stream for output
 * @param {string} reviewType - Type of review ('Changes' or 'File')


/**
 * Unified AI execution function with token counting, streaming, and fallback logic
 * Enhanced with API key support for users without Copilot license
 * @param {string} userPrompt - The prompt to send to the AI model
 * @param {object} model - The AI model to use (null if using API key mode)
 * @param {object} stream - Chat stream for output
 * @param {string} reviewType - Type of review ('Changes' or 'File')
 * @param {number} attemptCount - Current attempt number for recursion
 * @returns {Promise<boolean>} - true if successful, false if failed
 */
async function executeAIReview(userPrompt, model, stream, reviewType = 'Analysis', attemptCount = 0, originalRequestedModel = null, abortSignal = null) {
    const maxAttempts = 3;

    // Check if user wants to use API key instead of Copilot
    if (shouldUseApiKey()) {
        aidaLogging('🔑 Using API key mode instead of Copilot');
        stream.markdown(`🔑 **API Key Mode Enabled** - Using your configured AI service\n\n`);

        try {
            return await executeAIReviewWithApiKey(userPrompt, stream, reviewType, attemptCount, abortSignal);
        } catch (apiError) {
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

/**
 * Execute AI review using Copilot (original function logic)
 * @param {string} userPrompt - The prompt to send to the AI model
 * @param {object} model - The AI model to use
 * @param {object} stream - Chat stream for output
 * @param {string} reviewType - Type of review ('Changes' or 'File')
 * @param {number} attemptCount - Current attempt number for recursion
 * @returns {Promise<boolean>} - true if successful, false if failed
 */
async function executeAIReviewWithCopilot(userPrompt, model, stream, reviewType = 'Analysis', attemptCount = 0, originalRequestedModel = null, abortSignal = null) {
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
        aidaLogging(`   📏 Prompt length: ${userPrompt.length.toLocaleString()} characters`);
        aidaLogging(`   📋 Model: ${model.family} (${model.id})`);

        // ⚠️ TOKEN WARNING SYSTEM
        const COPILOT_SOFT_LIMIT = 25000;  // Warning threshold
        const COPILOT_HARD_LIMIT = 32000;  // Likely failure point

        if (inputTokens > COPILOT_HARD_LIMIT) {
            aidaLogging(`🚨 CRITICAL: Token count ${inputTokens} exceeds hard limit ${COPILOT_HARD_LIMIT}!`);
            aidaLogging(`   ❌ This request will likely FAIL with "Message exceeds token limit"`);
        } else if (inputTokens > COPILOT_SOFT_LIMIT) {
            aidaLogging(`⚠️ WARNING: Token count ${inputTokens} approaching limit (${Math.round(inputTokens / COPILOT_HARD_LIMIT * 100)}% of ${COPILOT_HARD_LIMIT})`);
            aidaLogging(`   🔥 Risk of "Message exceeds token limit" error`);
        } else {
            aidaLogging(`✅ Token count OK: ${inputTokens} / ${COPILOT_HARD_LIMIT} (${Math.round(inputTokens / COPILOT_HARD_LIMIT * 100)}%)`);
        }

        aidaLogging(`📤 Copilot mode - Attempt ${attemptCount + 1}: Sending request to model:`, model.family);

        const chatResponse = await model.sendRequest(messages, {}, new vscode.CancellationTokenSource().token);

        // Show successful model usage with accurate status  
        const reviewIcon = reviewType === 'Changes' ? '🔍' : '📄';

        // Determine if this is really the originally requested model
        let modelStatus;
        if (attemptCount === 0) {
            // First attempt - check if this matches original request
            if (originalRequestedModel && model.family === originalRequestedModel) {
                modelStatus = 'selected model';
            } else if (originalRequestedModel && model.family !== originalRequestedModel) {
                modelStatus = `fallback model (${originalRequestedModel} not available)`;
            } else {
                // No original model info, assume this is user's choice
                modelStatus = 'selected model';
            }
        } else {
            // Subsequent attempts are always fallbacks
            modelStatus = `fallback model (attempt ${attemptCount + 1})`;
        }

        stream.markdown(`🤖 **Streaming ${reviewType} ${reviewIcon}** (using ${model.family} - ${modelStatus}):\n\n`);

        let fragmentCount = 0;
        let outputText = '';

        // Stream output in real-time
        stream.markdown('---\n\n');

        for await (const fragment of chatResponse.text) {
            outputText += fragment;
            fragmentCount++;

            // Stream each fragment immediately for real-time display
            stream.markdown(fragment);

            // Progress indicator every 50 fragments
            if (fragmentCount % 50 === 0) {
                aidaLogging(`Streaming progress: ${fragmentCount} fragments processed`);
            }
        }

        // TODO: Clean the output to remove internal blocks (temporarily disabled for streaming)
        // const cleanedOutput = stripInternalBlocks(outputText);
        // aidaLogging(`🧹 Cleaned output: ${outputText.length} chars -> ${cleanedOutput.length} chars`);

        // Show completion with token statistics
        _getReviewUI().showTokenStatistics(stream, userPrompt, outputText, model, reviewType, attemptCount, 'copilot', null, null);

        return true; // Success

    } catch (modelError) {
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
                return await executeAIReviewWithCopilot(userPrompt, fallbackModel, stream, reviewType, attemptCount + 1, originalRequestedModel || model.family);
            } catch (fallbackError) {
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
                return await executeAIReviewWithCopilot(userPrompt, fallbackModel, stream, reviewType, attemptCount + 1, originalRequestedModel || model.family);
            } catch (fallbackError) {
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

/**
 * Get review template (simplified - templates already combined in workspace)
 * @param {string} templateName - Name of template file (e.g., 'review-changes.md')
 * @param {object} context - VS Code extension context
 * @returns {object} - {content: string, source: string, path: string}
 */
/**
 * Process template content by replacing placeholders with base template content
 * @param {string} templateContent - The raw template content
 * @param {string} templateDir - Directory containing the templates
 * @returns {string} - Processed template content with placeholders replaced
 */

async function executeApiAnalysisCall(prompt, stream, analysisType = 'API Pattern Analysis') {
    try {
        // Get AI model
        const model = await _getModelSelector().getUnifiedModel(stream);
        if (!model) {
            // Check if this is API key mode before showing error
            if (shouldUseApiKey()) {
                // API key mode - try executeAIReview which will handle API key calls
                aidaLogging('🔑 API key mode enabled for analysis - proceeding with executeAIReview');
                const success = await executeAIReview(prompt, null, stream, analysisType);
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
        _getReviewUI().showTokenStatistics(stream, prompt, outputText, model, analysisType, 0);

        // Try to parse JSON response
        try {
            const parsedResponse = JSON.parse(outputText);
            aidaLogging(`✅ ${analysisType} JSON parsed successfully`);
            return parsedResponse;
        } catch (parseError) {
            aidaLogging(`⚠️ ${analysisType} response is not JSON, returning raw text`);
            return { rawResponse: outputText };
        }

    } catch (error) {
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
                const fallbackModel = await getFallbackModel(model, stream, 1);
                const messages = [vscode.LanguageModelChatMessage.User(prompt)];
                const chatResponse = await fallbackModel.sendRequest(messages, {}, new vscode.CancellationTokenSource().token);

                let outputText = '';
                for await (const fragment of chatResponse.text) {
                    outputText += fragment;
                }

                _getReviewUI().showTokenStatistics(stream, prompt, outputText, fallbackModel, analysisType, 1);

                try {
                    const parsedResponse = JSON.parse(outputText);
                    aidaLogging(`✅ ${analysisType} fallback JSON parsed successfully`);
                    return parsedResponse;
                } catch (parseError) {
                    return { rawResponse: outputText };
                }

            } catch (fallbackError) {
                stream.markdown(`❌ **Fallback also failed:** ${fallbackError.message}\n\n`);
                return null;
            }
        }

        return null;
    }
}

/**
 * Auto-detect framework or language for template selection
 * Returns appropriate template path based on project structure and file patterns
 * @param {string} workspacePath - Root workspace path
 * @param {string} targetFilePath - File being reviewed (optional)
 * @returns {Promise<object>} - Detection result with template info
 */

module.exports = {
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
    normalizeApiParametersForReview: normalizeApiParameters,
    detectProviderForReview: detectProvider
};