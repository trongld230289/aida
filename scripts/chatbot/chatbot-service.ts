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
        return `You are AIDA (AI Development Assistant), a free VS Code extension built by the AIDA team.
You are NOT the AIDA marketing framework (Attention-Interest-Desire-Action).

## Your Role:
- Help developers with coding questions, debugging, and best practices
- Provide clear explanations and working code examples
- Support multiple programming languages and frameworks
- Maintain conversation context and build upon previous questions

## What is AIDA:
When users ask "what is AIDA", describe it as a VS Code extension with features:
- @review-file, @review-changes, @review-all-changes — AI code review
- @review-pr — PR review for Azure DevOps, GitHub, GitLab
- @dependency / @dependency-pr — Dependency graph + AI analysis
- Smart chat, code explanation, refactoring suggestions
- Works with GitHub Copilot, OpenAI, Anthropic, Google, Ollama
- $0 cost with GitHub Copilot, supports 20+ languages

## Language Guidelines:
- ALWAYS respond in the SAME language as the user's message
- Vietnamese input → Vietnamese response
- English input → English response
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
     * Detect if message is in Vietnamese.
     * Checks for Vietnamese diacritical marks (tổ hợp dấu tiếng Việt).
     */
    detectVietnamese(text: string): boolean {
        // Vietnamese-specific characters with diacritics
        return /[àáảãạăắằẳẵặâấầẩẫậđèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵ]/i.test(text);
    }

    /**
     * Generate contextual response based on conversation history
     */
    generateContextualResponse(message: string, isVietnamese: boolean, conversationHistory: IChatMessage[]) {
        const lowerMessage = message.toLowerCase();
        
        // Check for code-related keywords (both EN and VI)
        const codeKeywords = [
            'code', 'function', 'variable', 'class', 'method', 'api', 'debug', 'error',
            'javascript', 'typescript', 'python', 'react', 'vue', 'angular', 'node',
            'lập trình', 'biến', 'lỗi', 'ứng dụng', 'hàm', 'chạy', 'compile', 'build'
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
                return `# 🧩 Tạo React Component

Đây là cách tạo React component cơ bản:

\`\`\`jsx
// Functional Component với Hooks
import React, { useState, useEffect } from 'react';

const MyComponent = ({ title, data }) => {
    const [count, setCount] = useState(0);
    
    useEffect(() => {
        console.log('Component mounted');
    }, []);
    
    return (
        <div className="my-component">
            <h2>{title}</h2>
            <p>Count: {count}</p>
            <button onClick={() => setCount(count + 1)}>
                Tăng
            </button>
        </div>
    );
};

export default MyComponent;
\`\`\`

**Các điểm quan trọng:**
- Sử dụng functional components với hooks
- Props để truyền dữ liệu
- useState cho state management
- useEffect cho side effects

Bạn muốn tìm hiểu thêm về hooks nào khác không? 🚀`;
            } else {
                return `# 🧩 Creating React Components

Here's how to create a basic React component:

\`\`\`jsx
// Functional Component with Hooks
import React, { useState, useEffect } from 'react';

const MyComponent = ({ title, data }) => {
    const [count, setCount] = useState(0);
    
    useEffect(() => {
        console.log('Component mounted');
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

Want to learn about other hooks? 🚀`;
            }
        }
        
        // JavaScript debugging
        if (lowerMessage.includes('debug') && lowerMessage.includes('javascript')) {
            if (isVietnamese) {
                return `# 🐛 Debug JavaScript

Các cách debug JavaScript hiệu quả:

\`\`\`javascript
// 1. Console debugging
console.log('Debug value:', variable);
console.table(arrayData);
console.group('Function trace');
console.trace();
console.groupEnd();

// 2. Debugger statement
function problematicFunction() {
    debugger; // Trình duyệt sẽ dừng tại đây
    const result = someCalculation();
    return result;
}

// 3. Try-catch error handling
try {
    const result = riskyOperation();
    console.log('Success:', result);
} catch (error) {
    console.error('Error details:', error);
    console.error('Stack trace:', error.stack);
}
\`\`\`

**Tools hữu ích:**
- Browser DevTools (F12)
- VS Code Debugger
- Node.js Inspector
- ESLint để tìm lỗi tiềm ẩn

Bạn đang gặp lỗi gì cụ thể không? 🔍`;
            }
        }
        
        // Generic code response
        if (isVietnamese) {
            return `# 💻 AIDA - Trợ lý Code

Tôi có thể giúp bạn với câu hỏi về lập trình.

**Để hỗ trợ tốt hơn, bạn có thể:**
- Chia sẻ code hiện tại
- Mô tả cụ thể vấn đề gặp phải
- Cho biết ngôn ngữ/framework đang dùng

**Hoặc thử các lệnh đặc biệt:**
- \`@review-file\` — Review file code
- \`@review-changes\` — Phân tích thay đổi
- \`@review-all-changes\` — Phân tích TẤT CẢ thay đổi trong workspace
- \`@review-pr\` — Review pull request
- \`@dependency\` / \`@dependency-pr\` — Impact Analysis (phân tích ảnh hưởng)

Hãy cho tôi thêm chi tiết nhé! 🚀`;
        } else {
            return `# 💻 AIDA - Code Assistant

I can help you with your coding question.

**For better assistance, you can:**
- Share your current code
- Describe the specific issue you're facing  
- Mention the language/framework you're using

**Or try special commands:**
- \`@review-file\` — Review current file
- \`@review-changes\` — Analyze changes
- \`@review-all-changes\` — Analyze ALL changes in workspace
- \`@review-pr\` — Review pull request
- \`@dependency\` / \`@dependency-pr\` — Impact Analysis (dependency graph + AI)

Please provide more details! 🚀`;
        }
    }

    /**
     * Generate conversational response for general questions
     */
    generateConversationalResponse(message: string, isVietnamese: boolean, history: unknown[]) {
        const lowerMessage = message.toLowerCase();
        
        // Time/date questions
        if (lowerMessage.includes('thứ mấy') || lowerMessage.includes('ngày mấy') || lowerMessage.includes('what day') || lowerMessage.includes('what date')) {
            const now = new Date();
            const days = isVietnamese 
                ? ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy']
                : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            
            const today = days[now.getDay()];
            const date = now.toLocaleDateString(isVietnamese ? 'vi-VN' : 'en-US');
            
            if (isVietnamese) {
                return `Hôm nay là **${today}**, ngày ${date}.

Nhân tiện, bạn có đang làm project gì thú vị không? Tôi có thể hỗ trợ code review, debug, hoặc giải thích concepts. Chia sẻ code với tôi nhé! 🚀`;
            } else {
                return `Today is **${today}**, ${date}.

By the way, are you working on any interesting projects? I can help with code review, debugging, or explaining concepts. Share your code with me! 🚀`;
            }
        }
        
        // AIDA identity questions
        if (lowerMessage.includes('aida là gì') || lowerMessage.includes('aida la gi') || lowerMessage.includes('what is aida') || lowerMessage.includes('bạn là ai') || lowerMessage.includes('you are')) {
            if (isVietnamese) {
                return `# 🤖 AIDA là gì?

**AIDA (AI Development Assistant)** là một VS Code extension miễn phí, được phát triển bởi AIDA team.

**Tính năng chính:**
- \`@review-file\` — Review code bằng AI
- \`@review-changes\` — Phân tích git changes
- \`@review-all-changes\` — Phân tích tất cả thay đổi
- \`@review-pr\` — Review pull request (Azure DevOps, GitHub, GitLab)
- \`@dependency\` / \`@dependency-pr\` — Phân tích dependency graph
- **Chat thông minh** — Hỏi đáp, giải thích code, gợi ý refactor

**Hỗ trợ:**
- 20+ ngôn ngữ lập trình
- Nhiều AI provider: GitHub Copilot, OpenAI, Anthropic, Google, Ollama...
- $0 khi dùng GitHub Copilot (có sẵn với GitHub account)

Bạn muốn thử tính năng nào? 🚀`;
            } else {
                return `# 🤖 What is AIDA?

**AIDA (AI Development Assistant)** is a free VS Code extension built by the AIDA team.

**Key Features:**
- \`@review-file\` — AI-powered code review
- \`@review-changes\` — Analyze git changes
- \`@review-all-changes\` — Analyze all workspace changes
- \`@review-pr\` — Review PRs (Azure DevOps, GitHub, GitLab)
- \`@dependency\` / \`@dependency-pr\` — Dependency graph analysis
- **Smart Chat** — Q&A, code explanation, refactoring suggestions

**Supports:**
- 20+ programming languages
- Multiple AI providers: GitHub Copilot, OpenAI, Anthropic, Google, Ollama...
- $0 cost with GitHub Copilot (included with GitHub account)

Which feature would you like to try? 🚀`;
            }
        }
        
        // Default friendly response with context awareness
        const hasHistory = history.length > 2;
        
        if (isVietnamese) {
            const greeting = hasHistory ? 'Còn gì khác tôi có thể giúp không?' : 'Chào bạn! Tôi là AIDA, trợ lý AI chuyên về lập trình.';
            
            return `${greeting}

**Tôi có thể giúp bạn:**
- Trả lời câu hỏi về coding
- Review và phân tích code
- Debug và troubleshooting
- Giải thích concepts và patterns

**Lệnh đặc biệt:**
- \`@review-file\` — Review file hiện tại
- \`@review-changes\` — Phân tích git changes
- \`@review-pr\` — Review pull request
- \`@dependency\` / \`@dependency-pr\` — Impact Analysis (phân tích ảnh hưởng)

Bạn đang làm gì thú vị vậy? 🚀`;
        } else {
            const greeting = hasHistory ? 'What else can I help you with?' : 'Hello! I\'m AIDA, your AI coding assistant.';
            
            return `${greeting}

**I can help you with:**
- Programming questions and concepts
- Code review and analysis
- Debugging and troubleshooting
- Best practices and patterns

**Special Commands:**
- \`@review-file\` — Review current file
- \`@review-changes\` — Analyze git changes
- \`@review-pr\` — Review pull request
- \`@dependency\` / \`@dependency-pr\` — Impact Analysis (dependency graph + AI)

What interesting project are you working on? 🚀`;
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
                return `Tôi thấy bạn đã gửi ${images.length} hình ảnh, nhưng hiện tại tôi gặp vấn đề khi xử lý vision.

**Để hỗ trợ tốt hơn, bạn có thể:**
- Mô tả nội dung hình ảnh bằng text
- Đặt câu hỏi cụ thể về code trong ảnh
- Gửi lại ảnh kèm câu hỏi chi tiết

**Hoặc cấu hình AI API:**
- Vào Settings → AIDA → AI API Host
- Thêm API Key (OpenAI, Anthropic, v.v.)
- Chọn model hỗ trợ vision

Xin lỗi vì sự bất tiện! 🙏`;
            } else {
                return `I can see you've shared ${images.length} image(s), but I'm having trouble processing vision right now.

**For better assistance, you can:**
- Describe the image content in text
- Ask specific questions about code in the image
- Resend with more detailed questions

**Or configure an AI API:**
- Go to Settings → AIDA → AI API Host
- Add your API Key (OpenAI, Anthropic, etc.)
- Select a vision-capable model

Sorry for the inconvenience! 🙏`;
            }
        }
        
        if (isVietnamese) {
            return `Xin lỗi, tôi gặp vấn đề khi xử lý câu hỏi của bạn.

**Tôi có thể giúp bạn với:**
- Câu hỏi về lập trình
- Review và phân tích code
- Debug và troubleshooting
- Giải thích concepts

Bạn thử hỏi lại với chi tiết hơn nhé! 🚀`;
        } else {
            return `Sorry, I encountered an issue processing your question.

**I can help you with:**
- Programming questions
- Code review and analysis
- Debugging and troubleshooting
- Technical explanations

Please try asking again with more details! 🚀`;
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
