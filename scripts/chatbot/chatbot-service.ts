/**
 * @module chatbot-service
 * @description AIDA Chatbot Service ï¿½ conversational AI for coding assistance.
 * Handles message building, context management, system prompt, and AI integration.
 * Migrated to TypeScript in Phase 4.2.
 */

import * as path from 'path';
import { detectProvider, callAI, mapProviderResponse } from '../review/review-common';
import { aidaLogging } from '../core/settings';
import { DEFAULTS } from '../core/aida-config';
import type { IChatMessage } from './interfaces/chat-host.interface';
import * as vscode from 'vscode';
import { promises as fs } from 'fs';

// -- Constants --------------------------------------------------

const MAX_CONTEXT_LENGTH = DEFAULTS.MAX_CONTEXT_LENGTH;
const MAX_HISTORY_MESSAGES = 20;

// -- Class -------------------------------------------------------

class AidaChatbotService {
    context: Record<string, any>;
    messages: IChatMessage[];
    systemPrompt: string | null;

    maxHistoryMessages: number;

    maxContextLength: number;

    constructor(context: Record<string, any>) {
        this.context = context;
        this.messages = [];
        this.systemPrompt = null;
        this.maxContextLength = MAX_CONTEXT_LENGTH;
        this.maxHistoryMessages = MAX_HISTORY_MESSAGES;
    }

    /**
     * Initialize chatbot with system prompt
     */
    async initialize() {
        try {
            this.systemPrompt = await this.loadSystemPrompt();
            aidaLogging('? AIDA Chatbot initialized with system prompt');
        } catch (_error: unknown) {
            aidaLogging('?? Failed to load system prompt, using default');
            this.systemPrompt = this.getDefaultSystemPrompt();
        }
    }

    /**
     * Load system prompt from file
     */
    async loadSystemPrompt() {
        const systemPromptPath = path.join(this.context.extensionPath, 'scripts', 'chatbot', 'system_prompt.md');
        
        try {
            const content = await fs.readFile(systemPromptPath, 'utf8');
            return content;
        } catch (error: unknown) {
            throw error;
        }
    }

    /**
     * Get default system prompt if file not found
     */
    getDefaultSystemPrompt() {
        return `You are AIDA (AI Development Assistant), a helpful AI coding assistant integrated into VS Code.

## Your Role:
- Help developers with coding questions, debugging, and best practices
- Provide clear explanations and working code examples
- Support multiple programming languages and frameworks
- Maintain conversation context and build upon previous questions

## Language Guidelines:
- ALWAYS respond in the SAME language as the user's message
- Vietnamese input ? Vietnamese response
- English input ? English response
- Detect language patterns and maintain consistency

## Response Style:
- Be concise but thorough
- Use markdown formatting with syntax highlighting
- Provide practical, working examples
- Ask clarifying questions when needed
- Be encouraging and supportive like a senior developer colleague`;
    }

    /**
     * Add message to conversation history with image support
     */
    addMessage(role: 'system' | 'user' | 'assistant', content: string, images: string[] = []) {
        this.messages.push({
            role: role, // 'user', 'assistant', or 'system'
            content: content,
            images: images, // Array of image data
            timestamp: Date.now()
        });

        // Trim history if too long
        if (this.messages.length > this.maxHistoryMessages) {
            this.messages = this.messages.slice(-this.maxHistoryMessages);
        }
    }

    /**
     * Build messages array for AI API with image support
     */
    buildMessagesForAPI(): IChatMessage[] {
        const apiMessages: IChatMessage[] = [];

        // Add system prompt
        if (this.systemPrompt) {
            apiMessages.push({
                role: 'system',
                content: this.systemPrompt
            });
        }

        // Add conversation history with images
        const conversationMessages = this.messages
            .filter(msg => msg.role !== 'system')
            .map(msg => {
                const message: IChatMessage = {
                    role: msg.role,
                    content: msg.content
                };
                
                // Add images for Claude format if available
                if (msg.images && msg.images.length > 0) {
                    message.images = msg.images;
                }
                
                return message;
            });

        apiMessages.push(...conversationMessages);

        return apiMessages;
    }

    /**
     * Generate AI response using conversation context with image support
     */
    async generateResponse(userMessage: string, images: string[] = [], streamCallback: ((chunk: string) => void) | null = null) {
        try {
            aidaLogging('?? generateResponse called with:', { message: userMessage, imageCount: images?.length || 0, streaming: !!streamCallback });
            
            // Notify user about image processing approach
            if (images && images.length > 0) {
                aidaLogging(`??? Processing ${images.length} image(s) from CURRENT message only (not from conversation history)`);
            }
            
            // Add user message to history with images
            this.addMessage('user', userMessage, images);

            // Build messages for API
            const messages = this.buildMessagesForAPI();
            
            aidaLogging('?? Built messages for API:', messages.length, 'messages');

            // Check if we have AI service configured
            const aiResponse = await this.callAIService(messages, streamCallback);

            // Add AI response to history (only if not streaming, streaming adds incrementally)
            if (!streamCallback) {
                this.addMessage('assistant', aiResponse);
            }

            return aiResponse;

        } catch (error: unknown) {
            aidaLogging('? Error generating AI response:', error);
            // Fallback to rule-based response
            return this.generateFallbackResponse(userMessage, images);
        }
    }

    /**
     * Call AI service (OpenAI, Anthropic, or local LLM)
     */
    async callAIService(messages: IChatMessage[], streamCallback: ((chunk: string) => void) | null = null) {
        // Check for API key configuration
        const config = await this.getAIConfig();
        
        aidaLogging('?? AI Config:', { provider: config.provider, hasApiKey: !!config.apiKey, apiHost: config.apiHost, model: config.model, streaming: !!streamCallback });
        
        // If no API service configured, use smart rule-based responses
        if (!config.apiKey || !config.apiHost) {
            aidaLogging('?? Using Smart Responses (no AI service configured)');
            return this.generateSmartResponse(messages);
        }
        
        try {
            // Build system and user prompts from messages
            const systemMessage = messages.find((m: IChatMessage) => m.role === 'system');
            const conversationMessages = messages.filter((m: IChatMessage) => m.role !== 'system');
            
            // Extract images ONLY from the latest user message (current conversation turn)
            const latestUserMessage = conversationMessages.filter((msg: IChatMessage) => msg.role === 'user').pop();
            const currentImages = latestUserMessage && latestUserMessage.images ? latestUserMessage.images : [];
            
            aidaLogging(`??? Using ${currentImages.length} images from current message only (not from history)`);
            
            // Create conversation context for user prompt (without image history pollution)
            const conversationText = conversationMessages.map((msg: IChatMessage) => {
                let text = `${msg.role.toUpperCase()}: ${msg.content}`;
                
                // Only show image info for current message to avoid confusion
                if (msg.role === 'user' && msg === latestUserMessage && msg.images && msg.images.length > 0) {
                    text += ` [${msg.images.length} image(s) attached to current message]`;
                }
                
                return text;
            }).join('\n\n');
            
            aidaLogging('?? Using shared callAI function from review-common');
            aidaLogging(`??? Processing ${currentImages.length} images from current message only`);
            
            // Use shared callAI function with chat-optimized options and ONLY current images
            const chatOptions = {
                temperature: 0.7,
                max_tokens: DEFAULTS.MAX_TOKENS_CHAT,
                stream: !!streamCallback, // Enable streaming if callback provided
                response_format: (streamCallback ? undefined : undefined) as any // Always disable JSON for chat
            };
            
            const result = await callAI(
                systemMessage?.content || this.systemPrompt || 'You are AIDA, a helpful coding assistant.',
                conversationText,
                chatOptions,
                currentImages // Pass ONLY current images, not historical ones
            );
            
            // Handle streaming vs non-streaming responses
            if (result.isStreaming && streamCallback) {
                aidaLogging('?? Processing streaming response...');
                return await this.handleStreamingResponse(result as { streamResponse: Response; apiHost: string }, streamCallback);
            } else {
                // Map the response based on provider
                const provider = detectProvider(config.apiHost, config.model);
                const mappedResponse = mapProviderResponse(result.rawResponse as any, provider);
                
                aidaLogging('? AI response received via shared callAI');
                return mappedResponse.content || 'Sorry, I couldn\'t generate a response.';
            }
            
        } catch (error: unknown) {
            aidaLogging('? Shared callAI failed:', error);
            
            // Fall back to smart responses
            aidaLogging('?? Falling back to smart responses');
            return this.generateSmartResponse(messages);
        }
    }

    /**
     * Get AI configuration from VS Code settings
     */
    async getAIConfig() {
        try {

            const config = vscode.workspace.getConfiguration('aida');
            
            const apiHost = config.get('ai.apiHost', '');
            const apiKey = config.get('ai.apiKey', '');
            const model = config.get('ai.model', 'gpt-3.5-turbo');
            
            // Use detectProvider from review-common for consistency
            let provider = 'smart'; // Default to smart responses
            
            if (apiHost && apiKey) {
                provider = detectProvider(apiHost, model);
                aidaLogging(`?? Provider detected: ${provider} (from ${apiHost} + ${model})`);
            }
            
            return {
                provider: provider,
                apiKey: apiKey,
                apiHost: apiHost,
                model: model
            };
        } catch (_error: unknown) {
            return { provider: 'smart' }; // Default to smart responses
        }
    }

    /**
     * Generate smart rule-based response when no AI service is available
     */
    generateSmartResponse(messages: IChatMessage[]) {
        const lastMessage = messages[messages.length - 1]?.content || '';
        const isVietnamese = this.detectVietnamese(lastMessage);
        
        return this.generateContextualResponse(lastMessage, isVietnamese, messages);
    }

    /**
     * Detect if message is in Vietnamese
     */
    detectVietnamese(text: string) {
        return /[ï¿½ï¿½?ï¿½?a?????ï¿½?????dï¿½ï¿½???ï¿½?????ï¿½ï¿½?i?ï¿½ï¿½?ï¿½?ï¿½?????o?????ï¿½ï¿½?u?u??????ï¿½???]/.test(text);
    }

    /**
     * Generate contextual response based on conversation history
     */
    generateContextualResponse(message: string, isVietnamese: boolean, conversationHistory: IChatMessage[]) {
        const lowerMessage = message.toLowerCase();
        
        // Check for code-related keywords
        const codeKeywords = [
            'code', 'function', 'variable', 'class', 'method', 'api', 'debug', 'error',
            'javascript', 'typescript', 'python', 'react', 'vue', 'angular', 'node',
            'l?p trï¿½nh', 'code', 'function', 'bi?n', 'l?i', 'debug', '?ng d?ng'
        ];
        
        const isCodeQuestion = codeKeywords.some(keyword => lowerMessage.includes(keyword));
        
        if (isCodeQuestion) {
            return this.generateCodeResponse(message, isVietnamese, conversationHistory);
        }
        
        // Handle common questions with context awareness
        return this.generateConversationalResponse(message, isVietnamese, conversationHistory);
    }

    /**
     * Generate code-focused response with examples
     */
    generateCodeResponse(message: string, isVietnamese: boolean, _history: IChatMessage[]) {
        const lowerMessage = message.toLowerCase();
        
        // React component question
        if (lowerMessage.includes('react component')) {
            if (isVietnamese) {
                return `# ?? T?o React Component

ï¿½ï¿½y lï¿½ cï¿½ch t?o React component co b?n:

\`\`\`jsx
// Functional Component v?i Hooks
import React, { useState, useEffect } from 'react';

const MyComponent = ({ title, data }) => {
    const [count, setCount] = useState(0);
    
    useEffect(() => {
        aidaLogging('Component mounted');
    }, []);
    
    return (
        <div className="my-component">
            <h2>{title}</h2>
            <p>Count: {count}</p>
            <button onClick={() => setCount(count + 1)}>
                Increment
            </button>
        </div>
    );
};

export default MyComponent;
\`\`\`

**Cï¿½c di?m quan tr?ng:**
- S? d?ng functional components v?i hooks
- Props d? truy?n d? li?u
- useState cho state management
- useEffect cho side effects

B?n mu?n tï¿½m hi?u thï¿½m v? hooks nï¿½o khï¿½c khï¿½ng? ??`;
            } else {
                return `# ?? Creating React Components

Here's how to create a basic React component:

\`\`\`jsx
// Functional Component with Hooks
import React, { useState, useEffect } from 'react';
import { toError } from '../core/error-utils';

const MyComponent = ({ title, data }) => {
    const [count, setCount] = useState(0);
    
    useEffect(() => {
        aidaLogging('Component mounted');
    }, []);
    
    return (
        <div className="my-component">
            <h2>{title}</h2>
            <p>Count: {count}</p>
            <button onClick={() => setCount(count + 1)}>
                Increment
            </button>
        </div>
    );
};

export default MyComponent;
\`\`\`

**Key Points:**
- Use functional components with hooks
- Props for data passing
- useState for state management
- useEffect for side effects

Want to learn about other hooks? ??`;
            }
        }
        
        // JavaScript debugging
        if (lowerMessage.includes('debug') && lowerMessage.includes('javascript')) {
            if (isVietnamese) {
                return `# ?? Debug JavaScript

Cï¿½c cï¿½ch debug JavaScript hi?u qu?:

\`\`\`javascript
// 1. Console debugging
aidaLogging('Debug value:', variable);
console.table(arrayData);
console.group('Function trace');
console.trace();
console.groupEnd();

// 2. Debugger statement
function problematicFunction() {
    debugger; // Trï¿½nh duy?t s? d?ng t?i dï¿½y
    const result = someCalculation();
    return result;
}

// 3. Try-catch error handling
try {
    const result = riskyOperation();
    aidaLogging('Success:', result);
} catch (error: unknown) {
    const error = toError(_error);
    aidaLogging('Error details:', error);
    aidaLogging('Stack trace:', error.stack);
}
\`\`\`

**Tools h?u ï¿½ch:**
- Browser DevTools (F12)
- VS Code Debugger
- Node.js Inspector
- ESLint d? tï¿½m l?i ti?m ?n

B?n dang g?p l?i gï¿½ c? th? khï¿½ng? ??`;
            }
        }
        
        // Generic code response
        if (isVietnamese) {
            return `# ?? AIDA - Tr? lï¿½ Code

Tï¿½i cï¿½ th? giï¿½p b?n v?i cï¿½u h?i v? "${message}".

**ï¿½? h? tr? t?t hon, b?n cï¿½ th?:**
- Chia s? code hi?n t?i 
- Mï¿½ t? c? th? v?n d? g?p ph?i
- Cho bi?t ngï¿½n ng?/framework dang dï¿½ng

**Ho?c th? cï¿½c l?nh d?c bi?t:**
- \`@review-file\` - Review file code
- \`@review-changes\` - Phï¿½n tï¿½ch thay d?i
- \`@review-all-changes\` - Phï¿½n tï¿½ch T?T C? thay d?i trong workspace
- \`@review-pr\` - Review pull request

Hï¿½y cho tï¿½i thï¿½m chi ti?t nhï¿½! ??`;
        } else {
            return `# ?? AIDA - Code Assistant

I can help you with your question about "${message}".

**For better assistance, you can:**
- Share your current code
- Describe the specific issue you're facing  
- Mention the language/framework you're using

**Or try special commands:**
- \`@review-file\` - Review current file
- \`@review-changes\` - Analyze changes
- \`@review-all-changes\` - Analyze ALL changes in workspace
- \`@review-pr\` - Review pull request

Please provide more details! ??`;
        }
    }

    /**
     * Generate conversational response for general questions
     */
    generateConversationalResponse(message: string, isVietnamese: boolean, history: unknown[]) {
        const lowerMessage = message.toLowerCase();
        
        // Time/date questions
        if (lowerMessage.includes('th? m?y') || lowerMessage.includes('what day')) {
            const now = new Date();
            const days = isVietnamese 
                ? ['Ch? nh?t', 'Th? hai', 'Th? ba', 'Th? tu', 'Th? nam', 'Th? sï¿½u', 'Th? b?y']
                : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            
            const today = days[now.getDay()];
            const date = now.toLocaleDateString(isVietnamese ? 'vi-VN' : 'en-US');
            
            if (isVietnamese) {
                return `# ?? Thï¿½ng tin th?i gian

Hï¿½m nay lï¿½ **${today}**, ngï¿½y ${date}.

Nhï¿½n ti?n, b?n cï¿½ dang lï¿½m project gï¿½ thï¿½ v? khï¿½ng? Tï¿½i cï¿½ th? h? tr? v?i:
- Code review vï¿½ t?i uu hï¿½a
- Debug vï¿½ fix l?i
- Gi?i thï¿½ch concepts vï¿½ patterns
- Hu?ng d?n best practices

Chia s? code v?i tï¿½i nhï¿½! ??`;
            } else {
                return `# ?? Time Information

Today is **${today}**, ${date}.

By the way, are you working on any interesting projects? I can help with:
- Code review and optimization
- Debugging and troubleshooting
- Explaining concepts and patterns
- Best practices guidance

Share your code with me! ??`;
            }
        }
        
        // Default friendly response with context awareness
        const hasHistory = history.length > 2; // More than system + current message
        
        if (isVietnamese) {
            const greeting = hasHistory ? 'Cï¿½n gï¿½ khï¿½c tï¿½i cï¿½ th? giï¿½p khï¿½ng?' : 'Chï¿½o b?n! Tï¿½i lï¿½ AIDA.';
            
            return `# ?? AIDA Assistant

${greeting}

**Tï¿½i chuyï¿½n h? tr?:**
- L?p trï¿½nh vï¿½ development
- Code review vï¿½ t?i uu hï¿½a  
- Debug vï¿½ troubleshooting
- Gi?i thï¿½ch technical concepts

**Commands d?c bi?t:**
- \`@review-file\` - Review file hi?n t?i
- \`@review-changes\` - Phï¿½n tï¿½ch git changes
- \`@review-all-changes\` - Phï¿½n tï¿½ch T?T C? git changes
- \`@review-pr\` - Review pull request

B?n dang code gï¿½ thï¿½ v? v?y? ??`;
        } else {
            const greeting = hasHistory ? 'What else can I help you with?' : 'Hello! I\'m AIDA.';
            
            return `# ?? AIDA Assistant

${greeting}

**I specialize in:**
- Programming and development
- Code review and optimization
- Debugging and troubleshooting  
- Explaining technical concepts

**Special Commands:**
- \`@review-file\` - Review current file
- \`@review-changes\` - Analyze git changes
- \`@review-all-changes\` - Analyze ALL git changes
- \`@review-pr\` - Review pull request

What interesting project are you working on? ??`;
        }
    }

    /**
     * Prepare image for Claude API
     */
    prepareImageForClaude(imageInput: string | Buffer | { data: string; type: string }) {
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
        } else if (typeof imageInput === 'object' && imageInput !== null && 'data' in imageInput && 'type' in imageInput) {
            // From our image attachment format
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
        
        // Validate mime type
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

    /**
     * Generate fallback response when all else fails with image support
     */
    generateFallbackResponse(message: string, images: unknown[] = []) {
        const isVietnamese = this.detectVietnamese(message);
        
        // If there are images, acknowledge them
        if (images && images.length > 0) {
            if (isVietnamese) {
                return `# ?? AIDA Assistant

Tï¿½i th?y b?n dï¿½ g?i ${images.length} hï¿½nh ?nh, nhung hi?n t?i tï¿½i g?p m?t chï¿½t v?n d? khi x? lï¿½ vision.

**ï¿½? h? tr? t?t ho, b?n cï¿½ th?:**
- Mï¿½ t? n?i dung hï¿½nh ?nh b?ng text
- ï¿½?t cï¿½u h?i c? th? v? code trong ?nh
- G?i l?i ?nh kï¿½m cï¿½u h?i chi ti?t

**Ho?c th? c?u hï¿½nh Claude API:**
- Vï¿½o Settings ? AIDA ? AI API Host: \`https://api.anthropic.com\`
- Thï¿½m Claude API Key
- Ch?n model: \`claude-3-5-sonnet-20241022\`

Xin l?i vï¿½ s? b?t ti?n! ??`;
            } else {
                return `# ?? AIDA Assistant

I can see you've shared ${images.length} image(s), but I'm having trouble processing vision right now.

**For better assistance, you can:**
- Describe the image content in text
- Ask specific questions about code in the image
- Resend with more detailed questions

**Or try configuring Claude API:**
- Go to Settings ? AIDA ? AI API Host: \`https://api.anthropic.com\`
- Add your Claude API Key  
- Select model: \`claude-3-5-sonnet-20241022\`

Sorry for the inconvenience! ??`;
            }
        }
        
        if (isVietnamese) {
            return `# ?? AIDA Assistant

Xin l?i, tï¿½i g?p m?t chï¿½t v?n d? khi x? lï¿½ cï¿½u h?i c?a b?n. 

**Tï¿½i cï¿½ th? giï¿½p b?n v?i:**
- Cï¿½u h?i v? l?p trï¿½nh
- Review vï¿½ phï¿½n tï¿½ch code
- Debug vï¿½ troubleshooting
- Gi?i thï¿½ch concepts

B?n th? h?i l?i v?i chi ti?t hon nhï¿½! ??`;
        } else {
            return `# ?? AIDA Assistant

Sorry, I encountered an issue processing your question.

**I can help you with:**
- Programming questions
- Code review and analysis
- Debugging and troubleshooting
- Technical explanations

Please try asking again with more details! ??`;
        }
    }

    /**
     * Handle streaming response from AI API
     */
    async handleStreamingResponse(result: { streamResponse: Response; apiHost: string }, streamCallback: ((chunk: string) => void)) {
        try {
            aidaLogging('?? Starting streaming response processing...');
            
            const response = result.streamResponse;
            const reader = response.body!.getReader();
            const decoder = new TextDecoder();
            
            let buffer = '';
            let fullContent = '';
            
            while (true) {
                const { done, value } = await reader.read();
                
                if (done) {
                    aidaLogging('? Streaming complete');
                    break;
                }
                
                // Decode chunk and add to buffer
                buffer += decoder.decode(value, { stream: true });
                
                // Process complete lines
                const lines = buffer.split('\n');
                buffer = lines.pop()!; // Keep incomplete line in buffer
                
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6).trim();
                        
                        if (data === '[DONE]') {
                            aidaLogging('?? Received [DONE] signal');
                            break;
                        }
                        
                        try {
                            const parsed = JSON.parse(data);
                            const content = this.extractContentFromStreamChunk(parsed, result.apiHost);
                            
                            if (content) {
                                fullContent += content;
                                // Call streaming callback with chunk
                                streamCallback(content);
                            }
                        } catch (parseError: unknown) {
                            aidaLogging('?? Failed to parse streaming chunk:', parseError);
                        }
                    }
                }
            }
            
            // Add complete response to history
            this.addMessage('assistant', fullContent);
            
            aidaLogging('? Streaming response processed, total length:', fullContent.length);
            return fullContent;
            
        } catch (error: unknown) {
            aidaLogging('? Streaming response error:', error);
            throw error;
        }
    }

    /**
     * Extract content from streaming chunk based on provider
     */
    extractContentFromStreamChunk(chunk: Record<string, any>, apiHost: string) {

        const provider = detectProvider(apiHost, '');
        
        if (provider === 'anthropic') {
            // Claude streaming format
            if (chunk.type === 'content_block_delta' && chunk.delta && chunk.delta.text) {
                return chunk.delta.text;
            }
        } else {
            // OpenAI/compatible streaming format
            if (chunk.choices && chunk.choices[0] && chunk.choices[0].delta && chunk.choices[0].delta.content) {
                return chunk.choices[0].delta.content;
            }
        }
        
        return null;
    }

    /**
     * Clear conversation history
     */
    clearHistory() {
        this.messages = [];
    }

    /**
     * Get conversation summary
     */
    getConversationSummary() {
        return {
            messageCount: this.messages.length,
            userMessages: this.messages.filter(m => m.role === 'user').length,
            assistantMessages: this.messages.filter(m => m.role === 'assistant').length,
            lastActivity: this.messages.length > 0 ? this.messages[this.messages.length - 1]!.timestamp : null
        };
    }
}

// -- Dual exports ------------------------------------------------

export { AidaChatbotService };
