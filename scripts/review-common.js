const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

// Global AbortController for cancellation
let globalAbortSignal = null;

/**
 * Set global abort signal for review operations
 * @param {AbortSignal} signal - The abort signal to use
 */
function setGlobalAbortSignal(signal) {
    globalAbortSignal = signal;
}

/**
 * Get global abort signal for review operations
 * @returns {AbortSignal|null} - The current abort signal
 */
function getGlobalAbortSignal() {
    return globalAbortSignal;
}

// Token counting utilities
/**
 * Estimate token count from text using approximate ratios
 * @param {string} text - Input text to count tokens for
 * @returns {number} - Estimated token count
 */
function estimateTokenCount(text) {
    if (!text || typeof text !== 'string') return 0;
    
    // Approximate token-to-character ratios for different languages
    // English: ~4 characters per token
    // Code: ~3.5 characters per token (more dense)
    // Mixed content: ~3.8 characters per token
    
    const charCount = text.length;
    const avgCharsPerToken = 3.8;
    
    return Math.ceil(charCount / avgCharsPerToken);
}

/**
 * Normalize model family name for consistent pricing lookup
 * @param {string} modelFamily - Raw model family name
 * @returns {string} - Normalized model key
 */
function normalizeModelFamily(modelFamily) {
    if (!modelFamily || typeof modelFamily !== 'string') {
        return 'unknown';
    }
    
    const family = modelFamily.toLowerCase().trim();
    
    // Claude models
    if (family.includes('claude')) {
        if (family.includes('4.5') || family.includes('4-5')) return 'claude-sonnet-4.5';
        if (family.includes('4')) return 'claude-sonnet-4';
        if (family.includes('3.7') || family.includes('3-7')) {
            if (family.includes('thinking')) return 'claude-sonnet-3.7-thinking';
            return 'claude-sonnet-3.7';
        }
        if (family.includes('3.5') || family.includes('3-5')) return 'claude-sonnet-3.5';
        if (family.includes('sonnet')) return 'claude-sonnet-3.5'; // Default claude
        return 'claude-sonnet-3.5';
    }
    
    // GPT models
    if (family.includes('gpt')) {
        if (family.includes('4.1') || family.includes('4-1')) return 'gpt-4.1';
        if (family.includes('5') && (family.includes('codex') || family.includes('preview'))) return 'gpt-5-codex';
        if (family.includes('5') && family.includes('mini')) return 'gpt-5-mini';
        if (family.includes('5') && family.includes('nano')) return 'gpt-5-nano';
        if (family.includes('5')) return 'gpt-5';
        if (family.includes('4o') && family.includes('mini')) return 'gpt-4o-mini';
        if (family.includes('4o')) return 'gpt-4o';
        if (family.includes('4') && family.includes('turbo')) return 'gpt-4-turbo';
        if (family.includes('4')) return 'gpt-4';
        return 'gpt-4o'; // Default GPT
    }
    
    // Gemini models  
    if (family.includes('gemini')) {
        if (family.includes('2.5') || family.includes('2-5')) {
            if (family.includes('pro')) return 'gemini-2.5-pro';
            return 'gemini-2.5-pro';
        }
        if (family.includes('2.0') && family.includes('flash')) return 'gemini-2.0-flash';
        if (family.includes('2-0') && family.includes('flash')) return 'gemini-2.0-flash';
        if (family.includes('flash')) return 'gemini-2.0-flash';
        return 'gemini-2.5-pro'; // Default gemini
    }
    
    // O-series models
    if (family.includes('o4') && family.includes('mini')) return 'o4-mini';
    if (family.includes('o3') && family.includes('mini')) return 'o3-mini';
    if (family.includes('o1') && family.includes('mini')) return 'o1-mini';
    
    // Grok models
    if (family.includes('grok')) {
        if (family.includes('code') && family.includes('fast')) return 'grok-code-fast-1';
        return 'grok-code-fast-1';
    }
    
    // Handle exact model names from Copilot that might not match patterns
    // Direct mapping for common Copilot model names
    const directMappings = {
        'claude sonnet 4': 'claude-sonnet-4',
        'claude sonnet 3.5': 'claude-sonnet-3.5',
        'claude 4': 'claude-sonnet-4',
        'claude 3.5': 'claude-sonnet-3.5',
        'gpt 4o': 'gpt-4o',
        'gpt 4.1': 'gpt-4.1',
        'gpt 5': 'gpt-5',
        'gemini 2.5 pro': 'gemini-2.5-pro'
    };
    
    if (directMappings[family]) {
        return directMappings[family];
    }
    
    // Unknown model
    return 'unknown';
}

/**
 * Get estimated cost for token usage based on model
 * @param {number} inputTokens - Input token count
 * @param {number} outputTokens - Output token count
 * @param {string} modelFamily - Model family name
 * @returns {object} - Cost breakdown
 */
/**
 * Get comprehensive pricing data for AI models across different providers
 * Updated as of October 2025
 */
function getModelPricing() {
    return {
        // OpenAI Official (api.openai.com)
        'openai': {
            'gpt-5': { input: 5.00, output: 15.00 },
            'gpt-4o': { input: 2.50, output: 10.00 },
            'gpt-4o-mini': { input: 0.15, output: 0.60 },
            'gpt-4': { input: 30.00, output: 60.00 },
            'gpt-4-turbo': { input: 10.00, output: 30.00 },
            'gpt-3.5-turbo': { input: 0.50, output: 1.50 },
            'o1': { input: 15.00, output: 60.00 },
            'o1-mini': { input: 3.00, output: 12.00 },
            'o1-preview': { input: 15.00, output: 60.00 }
        },
        
        // STU Platform (aiportalapi.stu-platform.live) - From screenshot
        'stu': {
            'gpt-5': { input: 1.25, output: 10.00 },        // From screenshot
            'gpt-5-mini': { input: 0.25, output: 2.00 },    // From screenshot  
            'gpt-5-nano': { input: 0.10, output: 1.00 },    // Estimated from pattern
            'gpt-4o': { input: 2.00, output: 8.00 },        // STU discount ~20%
            'gpt-4o-mini': { input: 0.12, output: 0.50 },   // STU discount ~20%
            'claude-3-5-sonnet': { input: 2.50, output: 12.00 }  // STU discount ~20%
        },
        
        // Anthropic Official (api.anthropic.com)
        'anthropic': {
            'claude-3-5-sonnet': { input: 3.00, output: 15.00 },
            'claude-3-5-haiku': { input: 0.25, output: 1.25 },
            'claude-3-opus': { input: 15.00, output: 75.00 },
            'claude-3-sonnet': { input: 3.00, output: 15.00 },
            'claude-3-haiku': { input: 0.25, output: 1.25 }
        },
        
        // Google AI (googleapis.com)
        'google': {
            'gemini-1.5-pro': { input: 1.25, output: 5.00 },
            'gemini-1.5-flash': { input: 0.075, output: 0.30 },
            'gemini-2.0-flash': { input: 0.075, output: 0.30 },
            'gemini-pro': { input: 0.50, output: 1.50 },
            'palm-2': { input: 1.00, output: 2.00 }
        },
        
        // Azure OpenAI (azure.com)
        'azure': {
            'gpt-4o': { input: 5.00, output: 15.00 },        // Azure premium
            'gpt-4': { input: 30.00, output: 60.00 },
            'gpt-35-turbo': { input: 0.50, output: 1.50 }
        },
        
        // Cohere (cohere.ai)
        'cohere': {
            'command-r-plus': { input: 3.00, output: 15.00 },
            'command-r': { input: 0.50, output: 1.50 },
            'command': { input: 1.00, output: 2.00 }
        },
        
        // HuggingFace (huggingface.co)
        'huggingface': {
            'meta-llama/llama-2-70b-chat': { input: 0.70, output: 0.90 },
            'mistralai/mixtral-8x7b-instruct': { input: 0.27, output: 0.27 },
            'codellama/codellama-34b-instruct': { input: 0.35, output: 0.35 }
        },
        
        // Ollama (localhost - free)
        'ollama': {
            'llama2': { input: 0.00, output: 0.00 },
            'codellama': { input: 0.00, output: 0.00 },
            'mistral': { input: 0.00, output: 0.00 }
        },
        
        // GitHub Copilot (standard per-token pricing)
        // All models use standard input/output token pricing
        'copilot': {
            // Popular models
            'gpt-5-mini': { input: 0.15, output: 0.60 },
            'gpt-4.1': { input: 2.50, output: 10.00 },
            'gpt-4o': { input: 2.50, output: 10.00 },
            'claude-sonnet-4': { input: 3.00, output: 15.00 },
            'claude-sonnet-3.5': { input: 3.00, output: 15.00 },
            'claude-opus-4.1': { input: 15.00, output: 75.00 },
            'gemini-2.5-pro': { input: 1.25, output: 5.00 },
            'gemini-2.0-flash': { input: 0.075, output: 0.30 },
            'gpt-5': { input: 5.00, output: 15.00 },
            'o3-mini': { input: 3.00, output: 12.00 },
            'o4-mini': { input: 3.00, output: 12.00 },
            'grok-code-fast-1': { input: 2.00, output: 8.00 },
            
            // Legacy models for backward compatibility
            'gpt-4': { input: 2.50, output: 10.00 },
            'claude-3-5-sonnet': { input: 3.00, output: 15.00 }
        }
    };
}

function estimateCost(inputTokens, outputTokens, modelFamily, provider = null, apiHost = null) {
    // For backward compatibility, handle old function signature
    if (typeof modelFamily === 'object' && modelFamily.family) {
        modelFamily = modelFamily.family;
    }
    
    const pricing = getModelPricing();
    
    // Detect provider if not provided
    if (!provider && apiHost) {
        provider = detectProvider(apiHost, modelFamily || 'unknown');
    }
    if (!provider) {
        provider = 'copilot'; // Default to copilot for backward compatibility
    }
    
    console.log(`💰 Cost calculation: ${provider}/${modelFamily} - ${inputTokens}+${outputTokens} tokens`);
    
    // Get provider-specific pricing
    const providerPricing = pricing[provider] || pricing['copilot'];
    
    // Normalize model name for lookup
    const modelKey = normalizeModelFamily(modelFamily);
    
    // Get rates for the model
    const rates = providerPricing[modelKey] || 
                 providerPricing[modelFamily] || 
                 providerPricing['gpt-4o'] || 
                 { input: 2.50, output: 10.00 }; // Default fallback rates
    
    console.log(`💰 Provider pricing keys: ${Object.keys(providerPricing).join(', ')}`);
    console.log(`💰 Looking for model key: ${modelKey} (original: ${modelFamily})`);
    console.log(`💰 Using rates for ${provider}/${modelKey}:`, rates);
    
    // Calculate standard per-token pricing
    const inputCost = (inputTokens / 1000000) * rates.input;
    const outputCost = (outputTokens / 1000000) * rates.output;
    const totalCost = inputCost + outputCost;
    
    console.log(`💰 Calculated costs: input=$${inputCost.toFixed(6)}, output=$${outputCost.toFixed(6)}, total=$${totalCost.toFixed(6)}`);
    
    return {
        inputCost: inputCost,
        outputCost: outputCost,
        totalCost: totalCost,
        inputRate: rates.input,
        outputRate: rates.output,
        provider: provider,
        modelKey: modelKey,
        currency: 'USD'
    };
}

/**
 * Strip internal blocks from AI output before displaying to user
 * @param {string} output - The raw AI output text
 * @returns {string} - Cleaned output with internal blocks removed
 */
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
            console.log('🔑 API Key mode enabled - no fallback needed');
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
        
        console.log(`🔄 Fallback ${attemptNumber}: ${currentModel.family} → ${fallbackModel.family}`);
        
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
        console.error('❌ Fallback model selection failed:', error);
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
    console.log('🔍 STU Response Mapping - Full structure analysis:');
    console.log('📊 Top-level keys:', Object.keys(data));
    
    if (data.choices) {
        console.log('📊 Choices array length:', data.choices.length);
        if (data.choices[0]) {
            console.log('📊 First choice keys:', Object.keys(data.choices[0]));
            if (data.choices[0].message) {
                console.log('📊 Message keys:', Object.keys(data.choices[0].message));
                console.log('📊 Message content type:', typeof data.choices[0].message.content);
                console.log('📊 Message content length:', data.choices[0].message.content?.length || 'null/undefined');
            }
        }
    }
    
    if (data.usage) {
        console.log('📊 Usage:', JSON.stringify(data.usage, null, 2));
    }
    
    // STU Platform may have different response structure
    let content = null;
    
    // Primary: Standard OpenAI format
    if (data.choices?.[0]?.message?.content) {
        content = data.choices[0].message.content;
        console.log('✅ Content found in standard location');
    }
    
    // Special case: STU Platform sometimes returns empty content even with tokens
    if (!content && data.usage?.completion_tokens > 0) {
        console.warn('⚠️ STU Platform returned tokens but empty content:');
        console.warn(`   - Input tokens: ${data.usage.prompt_tokens}`);
        console.warn(`   - Output tokens: ${data.usage.completion_tokens}`);
        console.warn(`   - Total tokens: ${data.usage.total_tokens}`);
        console.warn('   - Checking alternative content fields...');
        
        // Try alternative fields
        const alternatives = ['content', 'answer', 'generated_text', 'completion', 'text'];
        for (const field of alternatives) {
            if (data[field]) {
                console.log(`✅ Found content in alternative field: ${field}`);
                content = data[field];
                break;
            }
        }
        
        // Check nested structures
        if (!content && data.data) {
            console.log('🔍 Checking nested data structure...');
            content = data.data.choices?.[0]?.message?.content || data.data.content;
        }
        
        // If still no content but we have tokens, try aggressive parsing
        if (!content) {
            console.warn('⚠️ STU Platform: Trying aggressive content parsing...');
            
            // Enhanced content extraction for complex structures
            const smartContentExtraction = (obj, path = '', depth = 0) => {
                // Prevent infinite recursion
                if (depth > 10) return null;
                
                // Check for string content (more flexible length check)
                if (typeof obj === 'string') {
                    const trimmed = obj.trim();
                    // Accept any meaningful text content (even short ones)
                    if (trimmed.length > 10 && (trimmed.includes('#') || trimmed.includes('**') || trimmed.includes('```') || trimmed.length > 50)) {
                        console.log(`✅ Found meaningful content at ${path}: ${trimmed.substring(0, 150)}...`);
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
                console.warn('🔄 STU Platform: Attempting advanced content recovery...');
                
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
                        console.log(`✅ STU Platform: Reconstructed content from ${meaningfulFragments.length} fragments`);
                    }
                }
                
                // Final fallback: Check if this is a streaming response issue
                if (!content && data.choices && data.choices.length > 0) {
                    const choice = data.choices[0];
                    if (choice.delta && choice.delta.content) {
                        content = choice.delta.content;
                        console.log('✅ STU Platform: Found content in streaming delta');
                    }
                }
                
                // If absolutely no content found, return error for fallback
                if (!content) {
                    console.error('❌ STU Platform: All content recovery attempts failed');
                    console.error('🔧 Falling back to Copilot for this request');
                    return { content: null, error: 'COMPLEX_PARSING_FAILED', inputTokens: data.usage?.prompt_tokens || 0, outputTokens: data.usage?.completion_tokens || 0 };
                }
            }
        }
    }
    
    // Fallback for other fields if still no content
    if (!content) {
        console.log('🔍 Fallback content search...');
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
    
    console.log('🎯 Final STU mapping result:', {
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
    console.log(`🔄 Mapping response for provider: ${provider}`);
    
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
    const useApiKey = config.get('useApiKeyInsteadOfCopilot', false);
    const apiKey = config.get('ai.apiKey');
    
    console.log(`🔍 API Key mode check: useApiKeyInsteadOfCopilot=${useApiKey}, hasApiKey=${!!apiKey}`);
    
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
        
        console.log(`📤 API Key mode - Attempt ${attemptCount + 1}: Sending request to ${apiHost} with model: ${model}`);
        console.log(`🔑 API Key configured: ${apiKey ? 'Yes' : 'No'}`);
        console.log(`🌐 Final API Host: ${apiHost}`);
        
        const reviewIcon = reviewType === 'Changes' ? '🔍' : '📄';
        const modelStatus = attemptCount === 0 ? 'API key mode' : `API key fallback (attempt ${attemptCount + 1})`;
        
        stream.markdown(`🤖 **Streaming ${reviewType} ${reviewIcon}** (using ${model} - ${modelStatus}):\n\n`);
        stream.markdown(`🔧 **Host**: ${apiHost}\n\n`);
        stream.markdown('---\n\n');
        
        // Debug: Check if userPrompt contains template and diff
        console.log(`🔍 UserPrompt length: ${userPrompt.length} characters`);
        console.log(`🔍 UserPrompt preview (first 500 chars):`, userPrompt.substring(0, 500));
        console.log(`🔍 UserPrompt contains 'MANDATORY CHANGE ANALYSIS':`, userPrompt.includes('MANDATORY CHANGE ANALYSIS'));
        console.log(`🔍 UserPrompt contains diff (+++/-):`, userPrompt.includes('+++') || userPrompt.includes('---'));
        
        // Use the shared callAI function
        const defaultOptions = {
            temperature: 0.1,
            max_tokens: 4000,
            stream: true, // Enable streaming for better UX
            response_format: undefined // Remove JSON format for reviews
        };
        
        const result = await callAI('You are an expert code reviewer and software architect. Provide detailed, actionable code review feedback.', userPrompt, defaultOptions, [], abortSignal);
        
        let mappedResponse;
        let outputText = '';
        
        // Detect provider for both streaming and non-streaming responses
        const provider = detectProvider(result.apiHost, result.model || model);
        
        if (result.isStreaming) {
            console.log('🔄 Handling streaming response...');
            
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
                                console.warn('⚠️ Failed to parse streaming chunk:', data);
                            }
                        }
                    }
                }
                
                // Fallback to estimation if streaming didn't provide token usage
                if (totalInputTokens === 0 && totalOutputTokens === 0) {
                    console.warn('⚠️ STU Platform streaming: No token usage in response, falling back to estimation');
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
            
        console.log(`🎯 Mapped response for ${provider}:`, mappedResponse);
        
        // Handle complex parsing failure - trigger fallback to Copilot
        if (mappedResponse.error === 'COMPLEX_PARSING_FAILED') {
            console.warn(`⚠️ ${provider} failed on complex content parsing - triggering Copilot fallback`);
            // Only throw if we truly have no content
            if (!mappedResponse.content || mappedResponse.content.trim().length === 0) {
                throw new Error(`${provider} complex parsing failed - content too complex for current parser`);
            } else {
                console.log(`✅ ${provider} recovered content despite parsing complexity - proceeding normally`);
                // Clear the error flag since we have content
                delete mappedResponse.error;
            }
        }
        
        if (!mappedResponse.content) {
            console.warn(`⚠️ No content extracted from ${provider} response, but API call succeeded`);
            // Don't throw error - API succeeded, just show a helpful message
            const fallbackMessage = `⚠️ **${provider.toUpperCase()} API Response Issue**: The API call succeeded and returned ${mappedResponse.outputTokens} tokens, but content extraction failed. This suggests a response format compatibility issue rather than an API failure.\n\n**Possible solutions:**\n- Try a different model (e.g., switch from GPT-5 to GPT-4o)\n- Check API provider documentation for response format changes\n- Contact support if the issue persists\n\n**Debug info**: Provider: ${provider}, Output tokens: ${mappedResponse.outputTokens}`;
            
            stream.markdown(fallbackMessage);
            
            // Show token statistics even with empty content (using actual tokens)
            const actualTokens = {
                inputTokens: mappedResponse.inputTokens,
                outputTokens: mappedResponse.outputTokens,
                totalTokens: mappedResponse.totalTokens
            };
            showTokenStatistics(stream, userPrompt, fallbackMessage, { family: model }, reviewType, attemptCount, provider, result.apiHost, actualTokens);
            
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
        
        showTokenStatistics(stream, userPrompt, outputText, { family: model }, reviewType, attemptCount, provider, result.apiHost, actualTokens);
        
        return true;
        
    } catch (apiError) {
        console.error(`❌ API Key mode failed (attempt ${attemptCount + 1}):`, apiError);
        
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
    
    console.log(`🔄 Normalizing parameters for provider: ${provider}`);
    
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
            console.log('🔧 STU Platform detected - applying compatibility fixes...');
            
            // Remove ALL potentially problematic parameters for GPT-5
            if (model.includes('gpt-5') || model.toLowerCase().includes('gpt-5')) {
                console.warn('⚠️ GPT-5 on STU Platform - Using minimal parameter set');
                
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
                
                console.log('🔧 STU GPT-5 params:', Object.keys(normalized));
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
        max_tokens: 4000,
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
        console.log(`�️ Adding ${images.length} images to API call`);
        
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
    
    console.log(`🔑 Making API call to: ${apiHost}`);
    console.log(`🤖 Using model: ${model}`);
    console.log(`📋 Request payload:`, JSON.stringify({
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
        console.log('🔄 Streaming response detected');
        return {
            streamResponse: response,
            apiHost: apiHost,
            model: model,
            isStreaming: true
        };
    } else {
        const data = await response.json();
        console.log('🔍 Raw API response received:', JSON.stringify(data, null, 2));
        
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
        console.warn('Unsupported image type:', mimeType, 'defaulting to image/png');
        mimeType = 'image/png';
    }
    
    if (!base64Data) {
        console.error('Failed to extract base64 data from image');
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
 * @param {number} attemptCount - Current attempt number for recursion
 * @returns {Promise<boolean>} - true if successful, false if failed
 */
async function executeAIReview(userPrompt, model, stream, reviewType = 'Analysis', attemptCount = 0, originalRequestedModel = null, abortSignal = null) {
    const maxAttempts = 3;
    
    // Check if user wants to use API key instead of Copilot
    if (shouldUseApiKey()) {
        console.log('🔑 Using API key mode instead of Copilot');
        stream.markdown(`🔑 **API Key Mode Enabled** - Using your configured AI service\n\n`);
        
        try {
            return await executeAIReviewWithApiKey(userPrompt, stream, reviewType, attemptCount, abortSignal);
        } catch (apiError) {
            // If API key fails and we have attempts left, fall back to Copilot if available
            if (attemptCount < maxAttempts - 1 && model) {
                stream.markdown(`🔄 **API key failed, falling back to Copilot...**\n\n`);
                console.log('🔄 API key failed, attempting Copilot fallback');
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
        
        console.log(`📤 Copilot mode - Attempt ${attemptCount + 1}: Sending request to model:`, model.family);
        
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
                console.log(`Streaming progress: ${fragmentCount} fragments processed`);
            }
        }
        
        // TODO: Clean the output to remove internal blocks (temporarily disabled for streaming)
        // const cleanedOutput = stripInternalBlocks(outputText);
        // console.log(`🧹 Cleaned output: ${outputText.length} chars -> ${cleanedOutput.length} chars`);
        
        // Show completion with token statistics
        showTokenStatistics(stream, userPrompt, outputText, model, reviewType, attemptCount, 'copilot', null, null);
        
        return true; // Success
        
    } catch (modelError) {
        console.error(`❌ Copilot model ${model?.family || 'unknown'} failed (attempt ${attemptCount + 1}):`, modelError);
        
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
function processTemplateWithPlaceholders(templateContent, templateDir) {
    console.log('🔍 DEBUG: processTemplateWithPlaceholders called');
    console.log('🔍 DEBUG: Call stack:', new Error().stack?.split('\n').slice(1, 4).join('\n'));
    console.log('🔍 DEBUG: templateDir =', templateDir);
    console.log('🔍 DEBUG: templateContent.length =', templateContent.length);
    console.log('🔍 DEBUG: contains {{REVIEW_BASE}}?', templateContent.includes('{{REVIEW_BASE}}'));
    
    // Check if already processed (to avoid double processing)
    if (templateContent.includes('<!-- AIDA_PROCESSED -->')) {
        console.log('🔍 DEBUG: Template already processed, skipping...');
        return templateContent.replace('<!-- AIDA_PROCESSED -->\n', '');
    }
    
    // Check if template contains the placeholder
    if (!templateContent.includes('{{REVIEW_BASE}}')) {
        console.log('🔍 DEBUG: No {{REVIEW_BASE}} placeholder found, returning original content');
        return templateContent; // No placeholders to replace
    }

    console.log('🔄 Processing template with {{REVIEW_BASE}} placeholder...');

    try {
        // Try to load the review-base.md file from the same directory
        const basePath = path.join(templateDir, 'review-base.md');
        console.log('🔍 DEBUG: Looking for base template at:', basePath);
        console.log('🔍 DEBUG: Base template exists?', fs.existsSync(basePath));
        
        if (fs.existsSync(basePath)) {
            const baseContent = fs.readFileSync(basePath, 'utf8');
            console.log(`✅ Loaded base template from: ${basePath}`);
            console.log('🔍 DEBUG: baseContent.length =', baseContent.length);
            
            // Extract the Angular critical checks content (exclude header comments)
            const angularChecksContent = extractAngularChecks(baseContent);
            console.log('🔍 DEBUG: angularChecksContent.length =', angularChecksContent.length);
            
            // Replace all occurrences of the placeholder
            const processedContent = templateContent.replace(/\{\{REVIEW_BASE\}\}/g, angularChecksContent);
            
            console.log('✅ Template placeholder replacement completed');
            console.log('🔍 DEBUG: processedContent.length =', processedContent.length);
            console.log('🔍 DEBUG: Still contains {{REVIEW_BASE}}?', processedContent.includes('{{REVIEW_BASE}}'));
            
            return processedContent;
        } else {
            console.warn(`⚠️ Base template not found at: ${basePath}, using original content`);
            return templateContent;
        }
    } catch (error) {
        console.error('❌ Error processing template placeholders:', error);
        return templateContent; // Return original content on error
    }
}

/**
 * Extract Angular critical checks content from review-base.md
 * @param {string} baseContent - Content of the base template
 * @returns {string} - Extracted Angular checks content
 */
function extractAngularChecks(baseContent) {
    const lines = baseContent.split('\n');
    const startIndex = lines.findIndex(line => line.includes('### 🚨 SECURITY VIOLATIONS:'));
    
    if (startIndex === -1) {
        console.warn('⚠️ Could not find Angular critical checks start marker in base template');
        return '<!-- Angular critical checks not found -->';
    }

    // Find the end of the critical checks (before final comments or end of file)
    const endMarkers = ['```', '## ', '---'];
    let endIndex = lines.length;
    
    for (let i = startIndex + 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (endMarkers.some(marker => line.startsWith(marker)) && line !== '```markdown') {
            endIndex = i;
            break;
        }
    }

    const extractedContent = lines.slice(startIndex, endIndex).join('\n').trim();
    console.log(`📋 Extracted ${extractedContent.split('\n').length} lines from base template`);
    
    return extractedContent;
}

function getReviewTemplate(templateName, context = null) {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    
    // Determine template paths - workspace first, then extension fallback
    let templatePath, templateSource;
    
    // Always use extension templates - simplified approach
    if (context || global.extensionPath) {
        templatePath = path.join(context?.extensionPath || global.extensionPath, 'templates', templateName);
        templateSource = 'extension';
    } else {
        throw new Error('No extension context available');
    }
    
    try {
        if (fs.existsSync(templatePath)) {
            const rawContent = fs.readFileSync(templatePath, 'utf8');
            
            // Process template with placeholder replacement
            const templateDir = path.dirname(templatePath);
            const processedContent = processTemplateWithPlaceholders(rawContent, templateDir);
            
            console.log(`✅ Loaded and processed template from: ${templatePath}`);
            
            return {
                content: processedContent,
                source: templateSource,
                path: templatePath
            };
        } else {
            throw new Error(`Template not found at: ${templatePath}`);
        }
        
    } catch (error) {
        console.error('❌ Template loading error:', error);
        throw new Error(`Failed to load template: ${error.message}`);
    }
}

/**
 * Unified model detection function used by both @review-file and @review-changes
 * @param {object} stream - Chat stream for output
 * @param {object} requestedModel - Requested model object
 * @param {object} chatContext - VS Code chat context
 * @param {object} request - VS Code request object
 * @returns {Promise<object|null>} - Selected AI model or null
 */
async function getUnifiedModel(stream, requestedModel = null, chatContext = null, request = null) {
    let models = [];
    
    console.log('=== getUnifiedModel DEBUG START ===');
    
    // PRIORITY 0: Check if API key mode is enabled - if so, skip ALL Copilot model detection
    if (shouldUseApiKey()) {
        console.log('🔑 API Key mode enabled - skipping ALL Copilot model detection');
        console.log('=== getUnifiedModel DEBUG END (API KEY MODE) ===');
        return null; // Let API key mode handle the AI calls
    }
    
    console.log('🔍 Full request object:', JSON.stringify(request, null, 2));
    console.log('🔍 Request keys:', request ? Object.keys(request) : 'null');
    console.log('🔍 Request.model:', request?.model);
    console.log('🔍 Request.model?.family:', request?.model?.family);
    console.log('🔍 Request.model?.id:', request?.model?.id);
    
    // Check ALL possible model locations in request
    if (request) {
        console.log('🔍 Checking all request properties for model...');
        for (const key in request) {
            console.log(`   - request.${key}:`, typeof request[key] === 'object' ? JSON.stringify(request[key]).substring(0, 200) : request[key]);
        }
    }
    
    // PRIORITY 1: Check request.model first (this is where VS Code puts the selected model!)
    if (request && request.model) {
        console.log('✅ Found model in request.model:', request.model);
        console.log('✅ Model family:', request.model.family);
        console.log('✅ Model id:', request.model.id);
        console.log('🎯 Using user-selected model from VS Code chat');
        
        // Add warning if user selected GPT but wanted Claude
        if (request.model.family && request.model.family.toLowerCase().includes('gpt')) {
            console.log('ℹ️ NOTE: User selected GPT model. To use Claude, please select a Claude model in VS Code chat dropdown.');
        }
        
        return request.model;
    } else {
        console.log('❌ No model found in request.model');
        console.log('❌ Request is:', request ? 'valid object' : 'null/undefined');
        console.log('❌ Request.model is:', request?.model ? 'valid' : 'null/undefined');
    }
    
    // PRIORITY 2: Use passed requestedModel object
    if (requestedModel && typeof requestedModel === 'object' && requestedModel.family) {
        console.log('Using requested model object:', requestedModel);
        return requestedModel;
    }
    
    // PRIORITY 3: Try to get the current model from chat context  
    if (chatContext) {
        console.log('🔍 Checking for model in chatContext...');
        
        // VS Code chat context may have model at chatContext.model or chatContext.participant.model
        let currentModel = null;
        
        if (chatContext.model) {
            console.log('✅ Found model at chatContext.model:', chatContext.model);
            currentModel = chatContext.model;
        } else {
            console.log('❌ No model found at chatContext.model');
        }
        
        if (chatContext.participant && chatContext.participant.model) {
            console.log('✅ Found model at chatContext.participant.model:', chatContext.participant.model);
            currentModel = chatContext.participant.model;
        } else {
            console.log('❌ No model found at chatContext.participant.model');
        }
        
        // Check other possible locations
        if (chatContext.request && chatContext.request.model) {
            console.log('✅ Found model at chatContext.request.model:', chatContext.request.model);
            currentModel = chatContext.request.model;
        }
        
        if (currentModel) {
            console.log('Using selected chatbox model:', currentModel);
            return currentModel;
        } else {
            console.log('⚠️ No model found in any chatContext location');
        }
    }
    
    // PRIORITY 4: Fallback to available models detection
    // NOTE: Only use this if NO model found in context (user hasn't selected anything)
    console.log('🔄 Falling back to available models detection...');
    
    // Get available models and try to find the currently selected one
    try {
        models = await vscode.lm.selectChatModels();
        console.log('📋 All available models:', models.map(m => `${m.family || m.id} (${m.vendor || 'Unknown'})`));
        
        if (models.length === 0) {
            console.warn('⚠️ No Copilot models available - check GitHub Copilot installation and authentication');
            // If API key is configured, suggest using it instead
            if (vscode.workspace.getConfiguration('aida').get('ai.apiKey')) {
                console.log('💡 Suggestion: Enable API key mode in settings: aida.useApiKeyInsteadOfCopilot = true');
            }
            return null;
        }
        
        if (models.length > 0) {
            // FALLBACK 1: Smart model selection based on quality preference (respecting user choice)
            const modelPreferences = [
                // Tier 1: High-quality models (Claude and GPT)
                'claude-sonnet-4', 'claude-4', 'claude-3.5-sonnet', 'claude-3.7-sonnet',
                'gpt-4o', 'gpt-4-turbo', 'gpt-4',
                // Tier 2: Other advanced models
                'gpt-4o-mini', 'o4-mini', 'o3-mini', 'gemini-2.5-pro', 'gemini-2.0-flash', 
                // Tier 3: Fallback options
                'gpt-3.5-turbo', 'grok-code'
            ];

            let selectedModel = null;
            
            // Try to find best available model based on preference order
            for (const preference of modelPreferences) {
                selectedModel = models.find(m => {
                    const modelName = (m.family || m.id).toLowerCase();
                    const prefLower = preference.toLowerCase();
                    
                    // Exact match or contains match
                    return modelName === prefLower || 
                           modelName.includes(prefLower) ||
                           modelName.replace(/[-_]/g, '').includes(prefLower.replace(/[-_]/g, ''));
                });
                
                if (selectedModel) {
                    console.log(`✅ Found preferred model: ${selectedModel.family || selectedModel.id} (preference: ${preference})`);
                    break;
                }
            }

            // If no preferred model found, use first available
            if (!selectedModel && models.length > 0) {
                selectedModel = models[0];
                console.log(`⚠️ No preferred model found, using first available: ${selectedModel.family || selectedModel.id}`);
            }

            if (selectedModel) {
                models = [selectedModel];
            }
        }
    } catch (error) {
        console.error('❌ Error getting Copilot models:', error.message);
        
        // Check if this is a GitHub authentication error
        if (error.message.includes('GitHubLoginFailed') || error.message.includes('authentication')) {
            console.warn('🔑 GitHub Copilot authentication failed. Consider using API key mode instead.');
            
            // If user has API key configured, suggest enabling API key mode
            const config = vscode.workspace.getConfiguration('aida');
            const hasApiKey = config.get('ai.apiKey');
            
            if (hasApiKey) {
                console.log('💡 You have an API key configured. Enable API key mode: aida.useApiKeyInsteadOfCopilot = true');
            } else {
                console.log('💡 Configure an API key in settings: aida.ai.apiKey and enable aida.useApiKeyInsteadOfCopilot');
            }
        }
        
        models = [];
    }
    
    const finalModel = models.length > 0 ? models[0] : null;
    console.log('🏁 Final model selected:', finalModel);
    
    // If no model is available, provide helpful guidance
    if (!finalModel) {
        console.warn('⚠️ No AI models available. Options:');
        console.warn('   1. Install and authenticate GitHub Copilot');
        console.warn('   2. Configure API key mode in extension settings');
        console.warn('   3. Check VS Code language model permissions');
        
        // Show user-friendly error in stream if available
        if (stream) {
            stream.markdown('❌ **No AI models available**\n\n');
            stream.markdown('**Options to fix this:**\n');
            stream.markdown('1. **GitHub Copilot**: Install and authenticate GitHub Copilot extension\n');
            stream.markdown('2. **API Key Mode**: Configure an API key in extension settings\n');
            stream.markdown('3. **Permissions**: Check VS Code language model permissions\n\n');
            stream.markdown('💡 **Tip**: If you have an API key, enable `aida.useApiKeyInsteadOfCopilot` in settings\n');
        }
    }
    
    console.log('=== getUnifiedModel DEBUG END ===');
    
    return finalModel;
}

/**
 * Reusable function for displaying review headers
 * @param {object} stream - Chat stream for output
 * @param {string} reviewType - Type of review (e.g., 'Changes Review', 'File Review')
 * @param {string} filePath - Path to the file being reviewed
 * @param {number|null} diffLength - Length of diff content (for changes review)
 * @param {string|null} templatePath - Path to the template being used
 */
function displayReviewHeader(stream, reviewType, filePath, diffLength = null, templatePath = null, templateSource = null) {
    const path = require('path');
    const fileName = path.basename(filePath);
    const fullPath = filePath;
    
    stream.markdown(`# 🔍 ${reviewType}: \`${fileName}\`\n\n`);
    stream.markdown(`📂 **Full Path:** \`${fullPath}\`\n`);
    
    if (diffLength !== null) {
        stream.markdown(`📄 **Diff Length:** ${diffLength} characters\n`);
    }
}

/**
 * Get checklist status icon based on status
 * @param {string} status - Status value (ok, warning, critical, suggestion, unknown)
 * @returns {string} - Corresponding emoji icon
 */
function getChecklistStatusIcon(status) {
    const statusIcons = {
        'ok': '✅',
        'warning': '⚠️',
        'critical': '🚨', 
        'suggestion': '💡',
        'unknown': '❓'
    };
    return statusIcons[status] || '❓';
}

/**
 * Get all available language models from VS Code API
 * @returns {Promise<Array>} Array of available models with details
 */
async function getAvailableModels() {
    try {
        // Check if API key mode is enabled - return empty array for Copilot models
        if (shouldUseApiKey()) {
            console.log('🔑 API Key mode enabled - returning API provider models');
            return []; // Return empty for Copilot models since we're using API key
        }
        
        const models = await vscode.lm.selectChatModels();
        return models.map(model => ({
            id: model.id,
            family: model.family || model.id,
            name: model.name || model.family || model.id,
            vendor: model.vendor,
            version: model.version,
            maxInputTokens: model.maxInputTokens,
            countTokens: model.countTokens ? 'supported' : 'not supported'
        }));
    } catch (error) {
        console.error('Error fetching available models:', error);
        return [];
    }
}

/**
 * Display available models information
 */
async function showAvailableModels() {
    try {
        const models = await getAvailableModels();
        
        if (models.length === 0) {
            vscode.window.showInformationMessage('❌ No language models available');
            return;
        }

        const modelList = models.map(model => 
            `• **${model.family}** (${model.id})\n  - Vendor: ${model.vendor || 'Unknown'}\n  - Max tokens: ${model.maxInputTokens || 'Unknown'}\n  - Token counting: ${model.countTokens}`
        ).join('\n\n');

        const message = `🤖 **Available Language Models** (${models.length} found):\n\n${modelList}`;
        
        // Show in information message (for quick view)
        const action = await vscode.window.showInformationMessage(
            `Found ${models.length} available language models`,
            'Show Details',
            'Copy List'
        );

        if (action === 'Show Details') {
            // Create and show in untitled document for detailed view
            const doc = await vscode.workspace.openTextDocument({
                content: message,
                language: 'markdown'
            });
            await vscode.window.showTextDocument(doc);
        } else if (action === 'Copy List') {
            // Copy to clipboard
            const simpleList = models.map(m => `${m.family} (${m.id})`).join('\n');
            await vscode.env.clipboard.writeText(simpleList);
            vscode.window.showInformationMessage('✅ Model list copied to clipboard');
        }

    } catch (error) {
        console.error('Error showing available models:', error);
        vscode.window.showErrorMessage(`Error fetching models: ${error.message}`);
    }
}

/**
 * Show token usage statistics and completion status
 * @param {object} stream - Chat stream for output
 * @param {string} inputText - Input text sent to AI
 * @param {string} outputText - Output text received from AI
 * @param {object} model - AI model used
 * @param {string} reviewType - Type of analysis
 * @param {number} attemptCount - Current attempt number
 */
function showTokenStatistics(stream, inputText, outputText, model, reviewType, attemptCount, provider = null, apiHost = null, actualTokens = null) {
    // Use actual tokens from API response if available, otherwise estimate
    let inputTokens, outputTokens;
    
    if (actualTokens && actualTokens.inputTokens !== undefined && actualTokens.outputTokens !== undefined) {
        // Use actual tokens from API response (more accurate)
        inputTokens = actualTokens.inputTokens;
        outputTokens = actualTokens.outputTokens;
        console.log(`📊 Using actual tokens from API: Input=${inputTokens}, Output=${outputTokens}`);
    } else {
        // Fall back to estimation (for Copilot mode)
        inputTokens = estimateTokenCount(inputText);
        outputTokens = estimateTokenCount(outputText);
        console.log(`📊 Using estimated tokens: Input=${inputTokens}, Output=${outputTokens}`);
    }
    
    // Get cost estimation with GitHub Copilot quota logic
    const finalCost = estimateCost(inputTokens, outputTokens, model.family, provider, apiHost, 'pro', 0);
    
    // Determine completion status
    const completionStatus = attemptCount === 0 ? 'original model' : `fallback model (${model.family})`;
    
    // Display token statistics with provider info
    stream.markdown(`\n\n---\n\n`);
    stream.markdown(`📊 **Token Usage Summary:**\n`);
    stream.markdown(`- **Input tokens**: ${inputTokens.toLocaleString()} ($${finalCost.inputRate.toFixed(2)}/1M)\n`);
    stream.markdown(`- **Output tokens**: ${outputTokens.toLocaleString()} ($${finalCost.outputRate.toFixed(2)}/1M)\n`);
    stream.markdown(`- **Total tokens**: ${(inputTokens + outputTokens).toLocaleString()}\n`);
    
    // Show cost information - always calculate by token
    stream.markdown(`- **Cost**: $${finalCost.totalCost.toFixed(4)} (Input: $${finalCost.inputCost.toFixed(4)} | Output: $${finalCost.outputCost.toFixed(4)})\n`);
    
    stream.markdown(`- **Model used**: ${model.family}${finalCost.provider ? ` (${finalCost.provider})` : ''}\n\n`);
    stream.markdown(`✅ **${reviewType} Analysis complete** - successfully used ${completionStatus}\n\n`);
    
    // Console logging
    console.log(`✅ ${reviewType} review completed successfully with model:`, model.family);
    console.log(`📊 Token usage - Input: ${inputTokens}, Output: ${outputTokens}, Cost: $${finalCost.totalCost.toFixed(4)}`);
}

/**
 * Execute API call for scan-app pattern analysis
 * @param {string} prompt - The prompt to send to the AI model
 * @param {object} stream - Chat stream for output
 * @param {string} analysisType - Type of analysis (e.g. 'API Pattern Analysis')
 * @returns {Promise<object|null>} - Parsed AI response or null if failed
 */
async function executeApiAnalysisCall(prompt, stream, analysisType = 'API Pattern Analysis') {
    try {
        // Get AI model
        const model = await getUnifiedModel(stream);
        if (!model) {
            // Check if this is API key mode before showing error
            if (shouldUseApiKey()) {
                // API key mode - try executeAIReview which will handle API key calls
                console.log('🔑 API key mode enabled for analysis - proceeding with executeAIReview');
                const success = await executeAIReview(prompt, null, stream, analysisType);
                return success ? { analysis: 'API key mode analysis completed' } : null;
            } else {
                stream.markdown('❌ **No AI model available** - Please select a model in VS Code\n\n');
                return null;
            }
        }
        
        console.log(`📤 Starting ${analysisType} with model:`, model.family);
        
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
        showTokenStatistics(stream, prompt, outputText, model, analysisType, 0);
        
        // Try to parse JSON response
        try {
            const parsedResponse = JSON.parse(outputText);
            console.log(`✅ ${analysisType} JSON parsed successfully`);
            return parsedResponse;
        } catch (parseError) {
            console.log(`⚠️ ${analysisType} response is not JSON, returning raw text`);
            return { rawResponse: outputText };
        }
        
    } catch (error) {
        console.error(`❌ ${analysisType} failed:`, error);
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
                
                showTokenStatistics(stream, prompt, outputText, fallbackModel, analysisType, 1);
                
                try {
                    const parsedResponse = JSON.parse(outputText);
                    console.log(`✅ ${analysisType} fallback JSON parsed successfully`);
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
async function autoDetectLanguage(workspacePath, targetFilePath = null) {
    const detectionResult = {
        type: 'fallback', // 'framework', 'language', or 'fallback'
        detected: 'general',
        templatePath: 'fallback',
        confidence: 'low',
        reason: 'Default fallback',
        templateType: null // Will be set by caller (review-changes, review-file, review-pr)
    };

    try {
        // PHASE 1: Framework Detection (Priority 1 - most specific)
        console.log('🔍 Phase 1: Framework Detection');
        
        // Angular Detection
        const angularConfig = path.join(workspacePath, 'angular.json');
        const packageJson = path.join(workspacePath, 'package.json');
        
        if (fs.existsSync(angularConfig)) {
            console.log('✅ Angular detected: angular.json found');
            return {
                ...detectionResult,
                type: 'framework',
                detected: 'Angular',
                templatePath: 'frameworks/angular',
                confidence: 'high',
                reason: 'angular.json configuration file found'
            };
        }

        // React Detection (package.json based)
        if (fs.existsSync(packageJson)) {
            const packageContent = JSON.parse(fs.readFileSync(packageJson, 'utf8'));
            
            // React Framework
            if (packageContent.dependencies?.react || packageContent.devDependencies?.react) {
                console.log('✅ React detected: react dependency found');
                return {
                    ...detectionResult,
                    type: 'framework',
                    detected: 'React',
                    templatePath: 'frameworks/react',
                    confidence: 'high',
                    reason: 'React dependency found in package.json'
                };
            }

            // Vue Framework
            if (packageContent.dependencies?.vue || packageContent.devDependencies?.vue || 
                packageContent.dependencies?.['@vue/core']) {
                console.log('✅ Vue detected: vue dependency found');
                return {
                    ...detectionResult,
                    type: 'framework',
                    detected: 'Vue',
                    templatePath: 'frameworks/vue',
                    confidence: 'high',
                    reason: 'Vue dependency found in package.json'
                };
            }

            // Express Framework
            if (packageContent.dependencies?.express || packageContent.devDependencies?.express) {
                console.log('✅ Express detected: express dependency found');
                return {
                    ...detectionResult,
                    type: 'framework',
                    detected: 'Express',
                    templatePath: 'frameworks/express',
                    confidence: 'high',
                    reason: 'Express dependency found in package.json'
                };
            }

            // NestJS Framework
            if (packageContent.dependencies?.['@nestjs/core'] || 
                packageContent.devDependencies?.['@nestjs/core'] ||
                packageContent.dependencies?.['@nestjs/common']) {
                console.log('✅ NestJS detected: @nestjs dependency found');
                return {
                    ...detectionResult,
                    type: 'framework',
                    detected: 'NestJS',
                    templatePath: 'frameworks/nestjs',
                    confidence: 'high',
                    reason: 'NestJS dependency found in package.json'
                };
            }
        }

        // PHASE 2: Language Detection (Priority 2 - moderately specific)
        console.log('🔍 Phase 2: Language Detection');

        // TypeScript Detection
        const tsConfigPath = path.join(workspacePath, 'tsconfig.json');
        if (fs.existsSync(tsConfigPath) || 
            (targetFilePath && targetFilePath.endsWith('.ts'))) {
            console.log('✅ TypeScript detected: tsconfig.json or .ts file found');
            return {
                ...detectionResult,
                type: 'language',
                detected: 'TypeScript',
                templatePath: 'languages/typescript',
                confidence: 'high',
                reason: 'TypeScript configuration or .ts files found'
            };
        }

        // JavaScript Detection (package.json or .js files)
        if (fs.existsSync(packageJson) || 
            (targetFilePath && targetFilePath.endsWith('.js'))) {
            console.log('✅ JavaScript detected: package.json or .js file found');
            return {
                ...detectionResult,
                type: 'language',
                detected: 'JavaScript',
                templatePath: 'languages/javascript',
                confidence: 'medium',
                reason: 'JavaScript files or Node.js project detected'
            };
        }

        // Node.js Detection (more specific check)
        if (fs.existsSync(packageJson)) {
            const packageContent = JSON.parse(fs.readFileSync(packageJson, 'utf8'));
            if (packageContent.engines?.node || 
                packageContent.scripts?.start ||
                packageContent.main) {
                console.log('✅ Node.js detected: Node.js specific patterns found');
                return {
                    ...detectionResult,
                    type: 'language',
                    detected: 'Node.js',
                    templatePath: 'languages/nodejs',
                    confidence: 'high',
                    reason: 'Node.js runtime patterns found in package.json'
                };
            }
        }

        // Python Detection
        const pythonFiles = ['requirements.txt', 'setup.py', 'pyproject.toml', 'Pipfile'];
        const hasPythonConfig = pythonFiles.some(file => fs.existsSync(path.join(workspacePath, file)));
        if (hasPythonConfig || 
            (targetFilePath && targetFilePath.endsWith('.py'))) {
            console.log('✅ Python detected: Python configuration files or .py files found');
            return {
                ...detectionResult,
                type: 'language',
                detected: 'Python',
                templatePath: 'languages/python',
                confidence: 'high',
                reason: 'Python configuration files or .py files found'
            };
        }

        // C# Detection
        const csharpFiles = ['.csproj', '.sln', 'project.json'];
        const hasCsharpConfig = csharpFiles.some(ext => {
            return fs.readdirSync(workspacePath).some(file => file.endsWith(ext));
        });
        if (hasCsharpConfig || 
            (targetFilePath && targetFilePath.endsWith('.cs'))) {
            console.log('✅ C# detected: C# project files or .cs files found');
            return {
                ...detectionResult,
                type: 'language',
                detected: 'C#',
                templatePath: 'languages/csharp',
                confidence: 'high',
                reason: 'C# project files or .cs files found'
            };
        }

        // Rust Detection
        const cargoToml = path.join(workspacePath, 'Cargo.toml');
        if (fs.existsSync(cargoToml) || 
            (targetFilePath && targetFilePath.endsWith('.rs'))) {
            console.log('✅ Rust detected: Cargo.toml or .rs files found');
            return {
                ...detectionResult,
                type: 'language',
                detected: 'Rust',
                templatePath: 'languages/rust',
                confidence: 'high',
                reason: 'Cargo.toml or .rs files found'
            };
        }

        // Go Detection
        const goMod = path.join(workspacePath, 'go.mod');
        if (fs.existsSync(goMod) || 
            (targetFilePath && targetFilePath.endsWith('.go'))) {
            console.log('✅ Go detected: go.mod or .go files found');
            return {
                ...detectionResult,
                type: 'language',
                detected: 'Go',
                templatePath: 'languages/go',
                confidence: 'high',
                reason: 'go.mod or .go files found'
            };
        }

        // PHASE 3: Fallback (Priority 3 - general)
        console.log('🔍 Phase 3: Fallback to general templates');
        console.log('❌ No specific framework or language detected, using fallback');
        
        return {
            ...detectionResult,
            type: 'fallback',
            detected: 'General',
            templatePath: 'fallback',
            confidence: 'low',
            reason: 'No specific framework or language patterns detected'
        };

    } catch (error) {
        console.error('❌ Error during language detection:', error);
        return {
            ...detectionResult,
            type: 'fallback',
            detected: 'General',
            templatePath: 'fallback',
            confidence: 'low',
            reason: `Detection error: ${error.message}`
        };
    }
}

/**
 * Get review template with auto-detection support
 * Automatically detects framework/language and loads appropriate template
 * @param {string} templateType - Template type (review-changes.md, review-file.md, review-pr.md)
 * @param {object} context - VS Code extension context
 * @param {string} targetFilePath - File being reviewed (optional, for better detection)
 * @returns {Promise<object>} - Template info with detection details
 */
async function getReviewTemplateWithDetection(templateType, context = null, targetFilePath = null) {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    
    if (!workspaceFolder) {
        throw new Error('No workspace folder available for template detection');
    }

    console.log(`🎯 Auto-detecting template for: ${templateType}`);
    
    // Auto-detect framework/language
    const detection = await autoDetectLanguage(workspaceFolder.uri.fsPath, targetFilePath);
    detection.templateType = templateType;
    
    console.log(`🎯 Detection result:`, detection);

    // Build template path based on detection
    let templatePath, templateSource;
    
    // Try AIDA structure first (newest)
    const aidaTemplatePath = path.join(
        workspaceFolder.uri.fsPath, 
        'AIDA', 
        'templates', 
        'review-code',
        detection.templatePath,
        templateType
    );
    
    if (fs.existsSync(aidaTemplatePath)) {
        templatePath = aidaTemplatePath;
        templateSource = 'AIDA workspace';
        console.log(`✅ Using AIDA template: ${templatePath}`);
    } else {
        // Fallback to extension templates
        if (context) {
            const extensionTemplatePath = path.join(
                context.extensionPath,
                'templates',
                'review-code',
                detection.templatePath,
                templateType
            );
            
            if (fs.existsSync(extensionTemplatePath)) {
                templatePath = extensionTemplatePath;
                templateSource = 'extension';
                console.log(`✅ Using extension template: ${templatePath}`);
            } else {
                // Ultimate fallback to legacy templates
                const legacyPath = path.join(context.extensionPath, 'templates', templateType);
                if (fs.existsSync(legacyPath)) {
                    templatePath = legacyPath;
                    templateSource = 'extension legacy';
                    console.log(`⚠️ Using legacy template: ${templatePath}`);
                } else {
                    throw new Error(`Template not found: ${templateType} for ${detection.detected}`);
                }
            }
        } else {
            throw new Error('No extension context available for fallback templates');
        }
    }

    try {
        const rawContent = fs.readFileSync(templatePath, 'utf8');
        
        // Process template with placeholder replacement
        const templateDir = path.dirname(templatePath);
        const processedContent = processTemplateWithPlaceholders(rawContent, templateDir);
        
        console.log(`✅ Loaded and processed template from: ${templatePath}`);
        
        return {
            content: processedContent,
            source: templateSource,
            path: templatePath,
            detection: detection
        };
        
    } catch (error) {
        console.error('❌ Template loading error:', error);
        throw new Error(`Failed to load template: ${error.message}`);
    }
}

/**
 * Display detection information in review output
 * @param {object} stream - Chat stream for output
 * @param {object} detection - Detection result from autoDetectLanguage
 * @param {string} templateType - Type of template being used
 */
function displayDetectionInfo(stream, detection, templateType) {
    // Detection header
    stream.markdown(`## 🎯 Auto-Detection Results\n\n`);
    
    // Framework/Language detection
    if (detection.type === 'framework') {
        stream.markdown(`**Framework Detection:** ${detection.detected} ✅\n`);
    } else if (detection.type === 'language') {
        stream.markdown(`**Language Detection:** ${detection.detected} ✅\n`);
    } else {
        stream.markdown(`**Detection:** ${detection.detected} (${detection.type}) ⚠️\n`);
    }
    
    // Template info
    stream.markdown(`**Review Template:** \`${templateType}\`\n`);
    stream.markdown(`**Template Path:** \`${detection.templatePath}/${templateType}\`\n`);
    stream.markdown(`**Confidence:** ${detection.confidence} (${detection.reason})\n\n`);
    
    // Show appropriate icon and message
    const detectionEmoji = {
        'framework': '🚀',
        'language': '💻', 
        'fallback': '📋'
    };
    
    const emoji = detectionEmoji[detection.type] || '📋';
    stream.markdown(`${emoji} **Using ${detection.detected}-specific review template**\n\n`);
    stream.markdown(`---\n\n`);
}

/**
 * Auto-detect framework/language from file extension and content
 * @param {string} filePath - Path to the file
 * @returns {object} - Detection result with framework, confidence, etc.
 */
function autoDetectLanguage(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const fileName = path.basename(filePath).toLowerCase();
    
    // React detection
    if (ext === '.tsx' || ext === '.jsx' || fileName.includes('.tsx') || fileName.includes('.jsx')) {
        return {
            detected: 'React',
            type: 'framework',
            confidence: 'high',
            reason: 'React component file detected',
            templatePath: 'review-code/frameworks/react'
        };
    }
    
    // Angular detection  
    if (ext === '.ts' && (fileName.includes('.component.') || fileName.includes('.service.') || fileName.includes('.module.'))) {
        return {
            detected: 'Angular',
            type: 'framework', 
            confidence: 'high',
            reason: 'Angular component/service file detected',
            templatePath: 'review-code/frameworks/angular'
        };
    }
    
    // Vue detection
    if (ext === '.vue') {
        return {
            detected: 'Vue',
            type: 'framework',
            confidence: 'high', 
            reason: 'Vue component file detected',
            templatePath: 'review-code/frameworks/vue'
        };
    }
    
    // Express.js detection (server.js, app.js with Express patterns)
    if ((fileName === 'server.js' || fileName === 'app.js' || fileName.includes('server.') || fileName.includes('app.')) && ext === '.js') {
        return {
            detected: 'Express',
            type: 'framework',
            confidence: 'medium',
            reason: 'Express.js server file detected',
            templatePath: 'review-code/frameworks/express'
        };
    }
    
    // NestJS detection
    if (ext === '.ts' && (fileName.includes('.controller.') || fileName.includes('.service.') || fileName.includes('.module.') || fileName.includes('.guard.') || fileName.includes('.interceptor.'))) {
        // Check if it's NestJS vs Angular by looking for NestJS imports or decorators
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (workspaceFolder) {
                const packageJsonPath = path.join(workspaceFolder.uri.fsPath, 'package.json');
                if (fs.existsSync(packageJsonPath)) {
                    const packageContent = fs.readFileSync(packageJsonPath, 'utf8');
                    if (packageContent.includes('@nestjs/')) {
                        return {
                            detected: 'NestJS',
                            type: 'framework',
                            confidence: 'high',
                            reason: 'NestJS framework file detected',
                            templatePath: 'review-code/frameworks/nestjs'
                        };
                    }
                }
            }
        } catch (error) {
            console.log('NestJS detection error:', error);
        }
    }
    
    // Check workspace for framework indicators
    try {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (workspaceFolder) {
            const packageJsonPath = path.join(workspaceFolder.uri.fsPath, 'package.json');
            const angularJsonPath = path.join(workspaceFolder.uri.fsPath, 'angular.json');
            
            // Angular workspace
            if (fs.existsSync(angularJsonPath)) {
                return {
                    detected: 'Angular',
                    type: 'framework',
                    confidence: 'high',
                    reason: 'angular.json configuration file found',
                    templatePath: 'review-code/frameworks/angular'
                };
            }
            
            // Check package.json for framework dependencies
            if (fs.existsSync(packageJsonPath)) {
                const packageContent = fs.readFileSync(packageJsonPath, 'utf8');
                
                // NestJS workspace (check first as it's more specific than Express)
                if (packageContent.includes('@nestjs/')) {
                    return {
                        detected: 'NestJS',
                        type: 'framework',
                        confidence: 'high',
                        reason: 'NestJS dependencies found in package.json',
                        templatePath: 'review-code/frameworks/nestjs'
                    };
                }
                
                // React workspace
                if (packageContent.includes('"react"') || packageContent.includes('@types/react')) {
                    return {
                        detected: 'React',
                        type: 'framework',
                        confidence: 'high',
                        reason: 'React dependencies found in package.json',
                        templatePath: 'review-code/frameworks/react'
                    };
                }
                
                // Vue workspace
                if (packageContent.includes('"vue"') || packageContent.includes('@vue/')) {
                    return {
                        detected: 'Vue',
                        type: 'framework',
                        confidence: 'high',
                        reason: 'Vue dependencies found in package.json',
                        templatePath: 'review-code/frameworks/vue'
                    };
                }
                
                // Express workspace
                if (packageContent.includes('"express"')) {
                    return {
                        detected: 'Express',
                        type: 'framework',
                        confidence: 'high',
                        reason: 'Express dependencies found in package.json',
                        templatePath: 'review-code/frameworks/express'
                    };
                }
                
                // Node.js project (has Node.js specific packages)
                if (packageContent.includes('"@types/node"') || packageContent.includes('nodemon') || packageContent.includes('ts-node')) {
                    return {
                        detected: 'NodeJS',
                        type: 'framework',
                        confidence: 'medium',
                        reason: 'Node.js runtime environment detected',
                        templatePath: 'review-code/languages/nodejs'
                    };
                }
            }
        }
    } catch (error) {
        console.log('Framework detection error:', error);
    }
    
    // Language fallback detection with proper template paths
    const languageMap = {
        '.ts': { name: 'TypeScript', template: 'review-code/languages/typescript' },
        '.js': { name: 'JavaScript', template: 'review-code/languages/javascript' }, 
        '.tsx': { name: 'React', template: 'review-code/frameworks/react' },
        '.jsx': { name: 'React', template: 'review-code/frameworks/react' },
        '.py': { name: 'Python', template: 'review-code/languages/python' },
        '.java': { name: 'Java', template: 'review-code/languages/java' },
        '.cs': { name: 'CSharp', template: 'review-code/languages/csharp' },
        '.cpp': { name: 'C++', template: 'review-code/languages/cpp' },
        '.c': { name: 'C', template: 'review-code/languages/c' },
        '.go': { name: 'Go', template: 'review-code/languages/go' },
        '.rs': { name: 'Rust', template: 'review-code/languages/rust' },
        '.php': { name: 'PHP', template: 'review-code/languages/php' },
        '.rb': { name: 'Ruby', template: 'review-code/languages/ruby' },
        '.kt': { name: 'Kotlin', template: 'review-code/languages/kotlin' },
        '.swift': { name: 'Swift', template: 'review-code/languages/swift' },
        '.html': { name: 'HTML', template: 'review-code/languages/html' },
        '.css': { name: 'CSS', template: 'review-code/languages/css' },
        '.scss': { name: 'SCSS', template: 'review-code/languages/scss' },
        '.less': { name: 'LESS', template: 'review-code/languages/less' }
    };
    
    const language = languageMap[ext];
    if (language) {
        return {
            detected: language.name,
            type: language.name === 'React' ? 'framework' : 'language',
            confidence: 'medium',
            reason: `${language.name} file extension detected`,
            templatePath: language.template
        };
    }
    
    // Fallback
    return {
        detected: 'General (fallback)',
        type: 'fallback',
        confidence: 'low',
        reason: 'No specific framework or language patterns detected',
        templatePath: 'review-code/fallback'
    };
}

/**
 * Get review template with framework detection
 * @param {string} templateType - Template type (review-file, review-changes, etc.)
 * @param {string} filePath - Path to file being reviewed
 * @returns {object} - Template content with detection info
 */
function getReviewTemplateWithDetection(templateType, filePath) {
    const detection = autoDetectLanguage(filePath);
    
    // Try framework-specific template first
    const templatePaths = [
        path.join(global.extensionPath, 'templates', detection.templatePath, `${templateType}.md`),
        path.join(global.extensionPath, 'templates', `${templateType}.md`)
    ];
    
    for (const templatePath of templatePaths) {
        if (fs.existsSync(templatePath)) {
            const content = fs.readFileSync(templatePath, 'utf8');
            return {
                content,
                detection,
                templatePath: templatePath,
                source: detection.detected
            };
        }
    }
    
    // Final fallback
    throw new Error(`Template not found: ${templateType}`);
}

/**
 * Get programming language identifier from file extension
 * @param {string} ext - File extension (with or without dot)
 * @returns {string} - Language identifier for syntax highlighting
 */
function getLanguageFromExtension(ext) {
    const languageMap = {
        '.ts': 'typescript',
        '.js': 'javascript',
        '.html': 'html',
        '.css': 'css',
        '.scss': 'scss',
        '.json': 'json',
        '.md': 'markdown',
        '.py': 'python',
        '.java': 'java',
        '.cs': 'csharp'
    };
    return languageMap[ext] || 'text';
}

/**
 * Load template with workspace AIDA priority
 * @param {string} templateType - Template file name (e.g., 'review-file.md')
 * @param {object} detection - Detection result object
 * @returns {object} Template result with content, source, and path info
 */
async function loadTemplateWithPriority(templateType, detection) {
    const vscode = require('vscode');
    const fs = require('fs');
    const path = require('path');
    
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    let templatePaths = [];
    let templateSourceDisplay = 'extension/templates';
    let templatePathDisplay = detection.templatePath;
    let templateContent = null;
    let usedTemplatePath = null;
    
    if (workspaceFolder) {
        const workspaceAidaPath = path.join(workspaceFolder.uri.fsPath, 'AIDA', 'templates');
        templatePaths = [
            // Workspace AIDA templates (highest priority)
            path.join(workspaceAidaPath, 'review-code', 'languages', detection.detected.toLowerCase(), templateType),
            path.join(workspaceAidaPath, 'review-code', 'fallback', templateType),
            // Extension templates (fallback)
            path.join(global.extensionPath, 'templates', detection.templatePath, templateType),
            path.join(global.extensionPath, 'templates', 'review-code', 'fallback', templateType)
        ];
    } else {
        templatePaths = [
            path.join(global.extensionPath, 'templates', detection.templatePath, templateType),
            path.join(global.extensionPath, 'templates', 'review-code', 'fallback', templateType)
        ];
    }
    
    // Try each template path in priority order
    for (const templatePath of templatePaths) {
        console.log(`🔍 Checking template path: ${templatePath}`);
        if (fs.existsSync(templatePath)) {
            console.log(`✅ Found template at: ${templatePath}`);
            const rawContent = fs.readFileSync(templatePath, 'utf8');
            
            // Process template with placeholder replacement using new utility function
            templateContent = processTemplateContent(rawContent, templatePath);
            
            usedTemplatePath = templatePath;
            break;
        } else {
            console.log(`❌ Template not found at: ${templatePath}`);
        }
    }
    
    // Determine template source for display
    if (workspaceFolder && usedTemplatePath && usedTemplatePath.includes(path.join(workspaceFolder.uri.fsPath, 'AIDA'))) {
        templateSourceDisplay = 'workspace/AIDA/templates';
        // Extract language from workspace path: review-code/languages/angular
        const workspaceAidaPath = path.join(workspaceFolder.uri.fsPath, 'AIDA', 'templates');
        const relativePath = path.relative(workspaceAidaPath, usedTemplatePath);
        const pathParts = relativePath.split(path.sep);
        templatePathDisplay = pathParts.slice(0, -1).join('/'); // e.g., "review-code/languages/angular"
    }
    
    if (!templateContent) {
        throw new Error(`Template not found: ${templateType}`);
    }
    
    console.log(`✅ Loaded review template from: ${templateSourceDisplay}/${templatePathDisplay} (${templateContent.length} characters)`);
    
    return {
        content: templateContent,
        templateSource: templateSourceDisplay,
        templatePath: templatePathDisplay,
        usedPath: usedTemplatePath
    };
}

/**
 * Display common review info header for all review types
 * @param {object} stream - VS Code chat stream
 * @param {string} reviewType - Type of review (File Review, Changes Review, PR Review)  
 * @param {string} filePath - File path to display
 * @param {object} options - Options { length, lengthType, lengthLabel }
 */
function displayCommonReviewInfo(stream, reviewType, filePath, options = {}) {
    const path = require('path');
    const vscode = require('vscode');
    
    // Extract file/folder name for title
    const fileName = path.basename(filePath);
    
    // Convert absolute path to relative path from workspace root
    let displayPath = filePath;
    try {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (workspaceFolder && path.isAbsolute(filePath)) {
            // Convert to relative path from workspace root
            const relativePath = path.relative(workspaceFolder.uri.fsPath, filePath);
            // Use forward slashes for consistency (like VS Code)
            displayPath = relativePath.replace(/\\/g, '/');
        }
    } catch (error) {
        // Fallback to original path if conversion fails
        console.log('Failed to convert to relative path:', error);
    }
    
    // Display header
    stream.markdown(`# 🔍 ${reviewType}: \`${fileName}\`\n\n`);
    
    // Display relative path 
    stream.markdown(`📂 **Full Path:** \`${displayPath}\`\n\n`);
    
    // Display length info if provided
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
}

/**
 * Load base template content from the same directory as main template
 * @param {string} mainTemplatePath - Full path to the main template file
 * @param {string} baseFileName - Base template filename (e.g., 'review-base.md')
 * @returns {string|null} - Base template content or null if not found
 */
function loadBaseTemplate(mainTemplatePath, baseFileName) {
    const fs = require('fs');
    const path = require('path');
    
    try {
        // Get directory of main template
        const templateDir = path.dirname(mainTemplatePath);
        
        // Build base template path in same directory
        const baseTemplatePath = path.join(templateDir, baseFileName);
        
        console.log(`🔍 Looking for base template: ${baseTemplatePath}`);
        
        if (fs.existsSync(baseTemplatePath)) {
            const baseContent = fs.readFileSync(baseTemplatePath, 'utf8');
            console.log(`✅ Loaded base template: ${baseTemplatePath} (${baseContent.length} chars)`);
            return baseContent;
        } else {
            console.log(`⚠️ Base template not found: ${baseTemplatePath}`);
            return null;
        }
    } catch (error) {
        console.log(`❌ Error loading base template: ${error.message}`);
        return null;
    }
}

/**
 * Build business documents content from selected categories
 * @param {Array} selectedBusinessDocs - Array of selected business document objects
 * @returns {string} - Formatted business documents content
 */
function buildBusinessDocsContent(selectedBusinessDocs) {
    if (!selectedBusinessDocs || selectedBusinessDocs.length === 0) {
        console.log('📚 No business documents selected');
        return '';
    }

    console.log(`📚 Building business docs content from ${selectedBusinessDocs.length} categories...`);
    
    let docsContent = `## 📚 Business Rules & Documentation\n\n`;
    
    selectedBusinessDocs.forEach(category => {
        console.log(`📁 Processing category: ${category.displayName} (${category.path})`);
        
        docsContent += `### ${category.displayName}\n\n`;
        
        try {
            // Get all markdown files in the category folder
            const files = fs.readdirSync(category.path, { withFileTypes: true })
                .filter(file => file.isFile() && file.name.endsWith('.md'))
                .map(file => ({
                    name: file.name,
                    path: path.join(category.path, file.name)
                }));
            
            console.log(`📄 Found ${files.length} markdown files in ${category.name}`);
            
            files.forEach(file => {
                try {
                    const fileContent = fs.readFileSync(file.path, 'utf8');
                    const fileName = file.name.replace('.md', '').replace(/-/g, ' ');
                    const titleCase = fileName.charAt(0).toUpperCase() + fileName.slice(1);
                    
                    docsContent += `#### ${titleCase}\n\n`;
                    docsContent += fileContent;
                    docsContent += '\n\n';
                    
                    console.log(`📄 Loaded ${file.name}: ${fileContent.substring(0, 50)}...`);
                } catch (fileError) {
                    console.error(`❌ Error reading file ${file.path}:`, fileError.message);
                }
            });
            
        } catch (folderError) {
            console.error(`❌ Error reading folder ${category.path}:`, folderError.message);
        }
        
        docsContent += '---\n\n';
    });
    
    console.log(`✅ Built business docs content (${docsContent.length} chars)`);
    console.log(`📄 Content preview: ${docsContent.substring(0, 100)}...`);
    
    return docsContent;
}

/**
 * Process template content with placeholder replacement
 * @param {string} content - Template content
 * @param {string} mainTemplatePath - Path to main template (for finding base templates)
 * @param {string} placeholder - Placeholder to replace (default: '{{REVIEW_BASE}}')
 * @param {string} baseFileName - Base template filename (default: 'review-base.md')
 * @returns {string} - Processed content with placeholders replaced
 */
function processTemplateContent(content, mainTemplatePath, placeholder = '{{REVIEW_BASE}}', baseFileName = 'review-base.md') {
    console.log(`🔧 Processing template placeholders for: ${placeholder}`);
    
    if (!content.includes(placeholder)) {
        console.log(`ℹ️ No ${placeholder} placeholder found, using content as-is`);
        return content;
    }
    
    console.log(`✅ Found ${placeholder} placeholder, loading base content...`);
    
    let baseContent = loadBaseTemplate(mainTemplatePath, baseFileName);
    
    if (baseContent) {
        // Check if we have selected business documents
        if (global.selectedBusinessDocs && global.selectedBusinessDocs.length > 0) {
            console.log('📚 Business documents selected, building enhanced base content...');
            const businessDocsContent = buildBusinessDocsContent(global.selectedBusinessDocs);
            
            if (businessDocsContent) {
                // Prepend technical docs to base content
                baseContent = businessDocsContent + '\n\n' + baseContent;
                console.log(`📄 Enhanced businessDocsContent preview: ${businessDocsContent}`);
            }
        } else {
            console.log('📋 No business documents selected, using original base content');
        }
        
        const processedContent = content.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), baseContent);
        console.log(`🔧 Replaced ${placeholder} with enhanced base content (final length: ${processedContent.length} chars)`);
        
        // Always cleanup business docs state after processing template
        global.selectedBusinessDocs = null;
        console.log('🧹 Template processed - cleanup: global.selectedBusinessDocs = null');
        
        return processedContent;
    } else {
        console.log(`⚠️ Base template not found, keeping ${placeholder} placeholder as-is`);
        
        // Cleanup even when no base template
        global.selectedBusinessDocs = null;
        console.log('🧹 No template - cleanup: global.selectedBusinessDocs = null');
        
        return content;
    }
    
}

/**
 * HELPER: Scan business document folders
 * @param {vscode.WorkspaceFolder} workspaceFolder - The workspace folder to scan
 * @returns {Array} Array of business document folder objects with enhanced path info
 */
async function getBusinessDocumentFolders(workspaceFolder) {
    console.log('🔍 getBusinessDocumentFolders called with workspaceFolder:', workspaceFolder?.uri?.fsPath);
    
    try {
        // Try both folder names for backwards compatibility
        const businessDocsPath = path.join(workspaceFolder.uri.fsPath, 'AIDA', 'business-docs');
        
        let actualPath = null;
        if (fs.existsSync(businessDocsPath)) {
            actualPath = businessDocsPath;
            console.log('📁 Found business docs at:', businessDocsPath);
        }
        
        if (!actualPath) {
            console.log(`📁 Business document path not found at either: ${businessDocsPath} or ${technicalDocsPath}`);
            return [];
        }
        
        const subFolders = fs.readdirSync(actualPath, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => {
                const folderPath = path.join(actualPath, dirent.name);
                return {
                    name: dirent.name,
                    displayName: dirent.name.split('-').map(word => 
                        word.charAt(0).toUpperCase() + word.slice(1)
                    ).join(' '),
                    path: folderPath,
                    relativePath: `AIDA/business-docs/${dirent.name}`,
                    basePath: actualPath,
                    workspacePath: workspaceFolder.uri.fsPath,
                    // Helper methods for getting files
                    getFiles: () => {
                        try {
                            return fs.readdirSync(folderPath, { withFileTypes: true })
                                .filter(file => file.isFile() && file.name.endsWith('.md'))
                                .map(file => ({
                                    name: file.name,
                                    path: path.join(folderPath, file.name),
                                    relativePath: `AIDA/business-docs/${dirent.name}/${file.name}`
                                }));
                        } catch (error) {
                            console.error(`❌ Error reading files in ${folderPath}:`, error);
                            return [];
                        }
                    },
                    getMarkdownFiles: function() {
                        return this.getFiles();
                    }
                };
            });
        
        console.log(`📚 Found ${subFolders.length} business document categories:`, subFolders.map(f => f.name));
        return subFolders;
    } catch (error) {
        console.error('❌ Error scanning business documents:', error);
        return [];
    }
}

module.exports = {
    executeAIReview,
    executeAIReviewWithApiKey,
    executeAIReviewWithCopilot,
    shouldUseApiKey,
    callAI,
    normalizeApiParameters,
    detectProvider,
    mapProviderResponse,
    prepareImageForProvider,
    getModelPricing,
    normalizeApiParametersForReview,
    detectProviderForReview,
    getFallbackModel,
    estimateTokenCount,
    estimateCost,
    normalizeModelFamily,
    stripInternalBlocks,
    getReviewTemplate,
    getReviewTemplateWithDetection,
    autoDetectLanguage,
    displayDetectionInfo,
    displayReviewHeader,
    getUnifiedModel,
    getChecklistStatusIcon,
    getAvailableModels,
    showAvailableModels,
    getLanguageFromExtension,
    showTokenStatistics,
    executeApiAnalysisCall,
    setGlobalAbortSignal,
    getGlobalAbortSignal,
    loadTemplateWithPriority,
    displayCommonReviewInfo,
    processTemplateWithPlaceholders,
    loadBaseTemplate,
    processTemplateContent,
    getBusinessDocumentFolders,
    buildBusinessDocsContent
};
