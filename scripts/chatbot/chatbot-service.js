const fs = require('fs').promises;
const path = require('path');
const { detectProvider, callAI, mapProviderResponse } = require('../review-common');

/**
 * AIDA Chatbot Service - Conversational AI for coding assistance
 * Handles message building, context management, and AI integration
 */
class AidaChatbotService {
    constructor(context) {
        this.context = context;
        this.messages = []; // Conversation history with roles
        this.systemPrompt = null;
        this.maxContextLength = 8000; // Token limit for context
        this.maxHistoryMessages = 20; // Limit conversation history
    }

    /**
     * Initialize chatbot with system prompt
     */
    async initialize() {
        try {
            this.systemPrompt = await this.loadSystemPrompt();
            console.log('✅ AIDA Chatbot initialized with system prompt');
        } catch (error) {
            console.warn('⚠️ Failed to load system prompt, using default');
            this.systemPrompt = this.getDefaultSystemPrompt();
        }
    }

    /**
     * Load system prompt from file
     */
    async loadSystemPrompt() {
        const systemPromptPath = path.join(this.context.extensionPath, 'chatbot', 'system_prompt.md');
        
        try {
            const content = await fs.readFile(systemPromptPath, 'utf8');
            return content;
        } catch (error) {
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
    addMessage(role, content, images = []) {
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
    buildMessagesForAPI() {
        const apiMessages = [];

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
                const message = {
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
    async generateResponse(userMessage, images = [], streamCallback = null) {
        try {
            console.log('💬 generateResponse called with:', { message: userMessage, imageCount: images?.length || 0, streaming: !!streamCallback });
            
            // Notify user about image processing approach
            if (images && images.length > 0) {
                console.log(`🖼️ Processing ${images.length} image(s) from CURRENT message only (not from conversation history)`);
            }
            
            // Add user message to history with images
            this.addMessage('user', userMessage, images);

            // Build messages for API
            const messages = this.buildMessagesForAPI();
            
            console.log('📦 Built messages for API:', messages.length, 'messages');

            // Check if we have AI service configured
            const aiResponse = await this.callAIService(messages, streamCallback);

            // Add AI response to history (only if not streaming, streaming adds incrementally)
            if (!streamCallback) {
                this.addMessage('assistant', aiResponse);
            }

            return aiResponse;

        } catch (error) {
            console.error('❌ Error generating AI response:', error);
            // Fallback to rule-based response
            return this.generateFallbackResponse(userMessage, images);
        }
    }

    /**
     * Call AI service (OpenAI, Anthropic, or local LLM)
     */
    async callAIService(messages, streamCallback = null) {
        // Check for API key configuration
        const config = await this.getAIConfig();
        
        console.log('🔧 AI Config:', { provider: config.provider, hasApiKey: !!config.apiKey, apiHost: config.apiHost, model: config.model, streaming: !!streamCallback });
        
        // If no API service configured, use smart rule-based responses
        if (!config.apiKey || !config.apiHost) {
            console.log('📡 Using Smart Responses (no AI service configured)');
            return this.generateSmartResponse(messages);
        }
        
        try {
            // Build system and user prompts from messages
            const systemMessage = messages.find(m => m.role === 'system');
            const conversationMessages = messages.filter(m => m.role !== 'system');
            
            // Extract images ONLY from the latest user message (current conversation turn)
            const latestUserMessage = conversationMessages.filter(msg => msg.role === 'user').pop();
            const currentImages = latestUserMessage && latestUserMessage.images ? latestUserMessage.images : [];
            
            console.log(`🖼️ Using ${currentImages.length} images from current message only (not from history)`);
            
            // Create conversation context for user prompt (without image history pollution)
            const conversationText = conversationMessages.map(msg => {
                let text = `${msg.role.toUpperCase()}: ${msg.content}`;
                
                // Only show image info for current message to avoid confusion
                if (msg.role === 'user' && msg === latestUserMessage && msg.images && msg.images.length > 0) {
                    text += ` [${msg.images.length} image(s) attached to current message]`;
                }
                
                return text;
            }).join('\n\n');
            
            console.log('🔄 Using shared callAI function from review-common');
            console.log(`🖼️ Processing ${currentImages.length} images from current message only`);
            
            // Use shared callAI function with chat-optimized options and ONLY current images
            const chatOptions = {
                temperature: 0.7,
                max_tokens: 4000,
                stream: !!streamCallback, // Enable streaming if callback provided
                response_format: streamCallback ? undefined : undefined // Always disable JSON for chat
            };
            
            const result = await callAI(
                systemMessage?.content || this.systemPrompt || 'You are AIDA, a helpful coding assistant.',
                conversationText,
                chatOptions,
                currentImages // Pass ONLY current images, not historical ones
            );
            
            // Handle streaming vs non-streaming responses
            if (result.isStreaming && streamCallback) {
                console.log('🔄 Processing streaming response...');
                return await this.handleStreamingResponse(result, streamCallback);
            } else {
                // Map the response based on provider
                const provider = detectProvider(config.apiHost, config.model);
                const mappedResponse = mapProviderResponse(result.rawResponse, provider);
                
                console.log('✅ AI response received via shared callAI');
                return mappedResponse.content || 'Sorry, I couldn\'t generate a response.';
            }
            
        } catch (error) {
            console.error('❌ Shared callAI failed:', error);
            
            // Fall back to smart responses
            console.log('🔄 Falling back to smart responses');
            return this.generateSmartResponse(messages);
        }
    }

    /**
     * Get AI configuration from VS Code settings
     */
    async getAIConfig() {
        try {
            const vscode = require('vscode');
            const config = vscode.workspace.getConfiguration('aida');
            
            const apiHost = config.get('ai.apiHost', '');
            const apiKey = config.get('ai.apiKey', '');
            const model = config.get('ai.model', 'gpt-3.5-turbo');
            
            // Use detectProvider from review-common for consistency
            let provider = 'smart'; // Default to smart responses
            
            if (apiHost && apiKey) {
                provider = detectProvider(apiHost, model);
                console.log(`🔍 Provider detected: ${provider} (from ${apiHost} + ${model})`);
            }
            
            return {
                provider: provider,
                apiKey: apiKey,
                apiHost: apiHost,
                model: model
            };
        } catch (error) {
            return { provider: 'smart' }; // Default to smart responses
        }
    }

    /**
     * Generate smart rule-based response when no AI service is available
     */
    generateSmartResponse(messages) {
        const lastMessage = messages[messages.length - 1]?.content || '';
        const isVietnamese = this.detectVietnamese(lastMessage);
        
        return this.generateContextualResponse(lastMessage, isVietnamese, messages);
    }

    /**
     * Detect if message is in Vietnamese
     */
    detectVietnamese(text) {
        return /[àáảãạăắằẳẵặâấầẩẫậđèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵ]/.test(text);
    }

    /**
     * Generate contextual response based on conversation history
     */
    generateContextualResponse(message, isVietnamese, conversationHistory) {
        const lowerMessage = message.toLowerCase();
        
        // Check for code-related keywords
        const codeKeywords = [
            'code', 'function', 'variable', 'class', 'method', 'api', 'debug', 'error',
            'javascript', 'typescript', 'python', 'react', 'vue', 'angular', 'node',
            'lập trình', 'code', 'function', 'biến', 'lỗi', 'debug', 'ứng dụng'
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
    generateCodeResponse(message, isVietnamese, history) {
        const lowerMessage = message.toLowerCase();
        
        // React component question
        if (lowerMessage.includes('react component')) {
            if (isVietnamese) {
                return `# 🔧 Tạo React Component

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
                Increment
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
                return `# 🔧 Creating React Components

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
            return `# 🤖 AIDA - Trợ lý Code

Tôi có thể giúp bạn với câu hỏi về "${message}".

**Để hỗ trợ tốt hơn, bạn có thể:**
- Chia sẻ code hiện tại 
- Mô tả cụ thể vấn đề gặp phải
- Cho biết ngôn ngữ/framework đang dùng

**Hoặc thử các lệnh đặc biệt:**
- \`@review-file\` - Review file code
- \`@review-changes\` - Phân tích thay đổi
- \`@review-all-changes\` - Phân tích TẤT CẢ thay đổi trong workspace
- \`@review-pr\` - Review pull request

Hãy cho tôi thêm chi tiết nhé! 💻`;
        } else {
            return `# 🤖 AIDA - Code Assistant

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

Please provide more details! 💻`;
        }
    }

    /**
     * Generate conversational response for general questions
     */
    generateConversationalResponse(message, isVietnamese, history) {
        const lowerMessage = message.toLowerCase();
        
        // Time/date questions
        if (lowerMessage.includes('thứ mấy') || lowerMessage.includes('what day')) {
            const now = new Date();
            const days = isVietnamese 
                ? ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy']
                : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            
            const today = days[now.getDay()];
            const date = now.toLocaleDateString(isVietnamese ? 'vi-VN' : 'en-US');
            
            if (isVietnamese) {
                return `# 📅 Thông tin thời gian

Hôm nay là **${today}**, ngày ${date}.

Nhân tiện, bạn có đang làm project gì thú vị không? Tôi có thể hỗ trợ với:
- Code review và tối ưu hóa
- Debug và fix lỗi
- Giải thích concepts và patterns
- Hướng dẫn best practices

Chia sẻ code với tôi nhé! 💻`;
            } else {
                return `# 📅 Time Information

Today is **${today}**, ${date}.

By the way, are you working on any interesting projects? I can help with:
- Code review and optimization
- Debugging and troubleshooting
- Explaining concepts and patterns
- Best practices guidance

Share your code with me! 💻`;
            }
        }
        
        // Default friendly response with context awareness
        const hasHistory = history.length > 2; // More than system + current message
        
        if (isVietnamese) {
            const greeting = hasHistory ? 'Còn gì khác tôi có thể giúp không?' : 'Chào bạn! Tôi là AIDA.';
            
            return `# 🤖 AIDA Assistant

${greeting}

**Tôi chuyên hỗ trợ:**
- Lập trình và development
- Code review và tối ưu hóa  
- Debug và troubleshooting
- Giải thích technical concepts

**Commands đặc biệt:**
- \`@review-file\` - Review file hiện tại
- \`@review-changes\` - Phân tích git changes
- \`@review-all-changes\` - Phân tích TẤT CẢ git changes
- \`@review-pr\` - Review pull request

Bạn đang code gì thú vị vậy? 🚀`;
        } else {
            const greeting = hasHistory ? 'What else can I help you with?' : 'Hello! I\'m AIDA.';
            
            return `# 🤖 AIDA Assistant

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

What interesting project are you working on? 🚀`;
        }
    }

    /**
     * Prepare image for Claude API
     */
    prepareImageForClaude(imageInput) {
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
        } else if (imageInput.data && imageInput.type) {
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

    /**
     * Generate fallback response when all else fails with image support
     */
    generateFallbackResponse(message, images = []) {
        const isVietnamese = this.detectVietnamese(message);
        
        // If there are images, acknowledge them
        if (images && images.length > 0) {
            if (isVietnamese) {
                return `# 🤖 AIDA Assistant

Tôi thấy bạn đã gửi ${images.length} hình ảnh, nhưng hiện tại tôi gặp một chút vấn đề khi xử lý vision.

**Để hỗ trợ tốt hơ, bạn có thể:**
- Mô tả nội dung hình ảnh bằng text
- Đặt câu hỏi cụ thể về code trong ảnh
- Gửi lại ảnh kèm câu hỏi chi tiết

**Hoặc thử cấu hình Claude API:**
- Vào Settings → AIDA → AI API Host: \`https://api.anthropic.com\`
- Thêm Claude API Key
- Chọn model: \`claude-3-5-sonnet-20241022\`

Xin lỗi vì sự bất tiện! 🙏`;
            } else {
                return `# 🤖 AIDA Assistant

I can see you've shared ${images.length} image(s), but I'm having trouble processing vision right now.

**For better assistance, you can:**
- Describe the image content in text
- Ask specific questions about code in the image
- Resend with more detailed questions

**Or try configuring Claude API:**
- Go to Settings → AIDA → AI API Host: \`https://api.anthropic.com\`
- Add your Claude API Key  
- Select model: \`claude-3-5-sonnet-20241022\`

Sorry for the inconvenience! 🙏`;
            }
        }
        
        if (isVietnamese) {
            return `# 🤖 AIDA Assistant

Xin lỗi, tôi gặp một chút vấn đề khi xử lý câu hỏi của bạn. 

**Tôi có thể giúp bạn với:**
- Câu hỏi về lập trình
- Review và phân tích code
- Debug và troubleshooting
- Giải thích concepts

Bạn thử hỏi lại với chi tiết hơn nhé! 🙏`;
        } else {
            return `# 🤖 AIDA Assistant

Sorry, I encountered an issue processing your question.

**I can help you with:**
- Programming questions
- Code review and analysis
- Debugging and troubleshooting
- Technical explanations

Please try asking again with more details! 🙏`;
        }
    }

    /**
     * Handle streaming response from AI API
     */
    async handleStreamingResponse(result, streamCallback) {
        try {
            console.log('🔄 Starting streaming response processing...');
            
            const response = result.streamResponse;
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            
            let buffer = '';
            let fullContent = '';
            
            while (true) {
                const { done, value } = await reader.read();
                
                if (done) {
                    console.log('✅ Streaming complete');
                    break;
                }
                
                // Decode chunk and add to buffer
                buffer += decoder.decode(value, { stream: true });
                
                // Process complete lines
                const lines = buffer.split('\n');
                buffer = lines.pop(); // Keep incomplete line in buffer
                
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6).trim();
                        
                        if (data === '[DONE]') {
                            console.log('🏁 Received [DONE] signal');
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
                        } catch (parseError) {
                            console.warn('⚠️ Failed to parse streaming chunk:', parseError);
                        }
                    }
                }
            }
            
            // Add complete response to history
            this.addMessage('assistant', fullContent);
            
            console.log('✅ Streaming response processed, total length:', fullContent.length);
            return fullContent;
            
        } catch (error) {
            console.error('❌ Streaming response error:', error);
            throw error;
        }
    }

    /**
     * Extract content from streaming chunk based on provider
     */
    extractContentFromStreamChunk(chunk, apiHost) {
        const { detectProvider } = require('../review-common');
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
            lastActivity: this.messages.length > 0 ? this.messages[this.messages.length - 1].timestamp : null
        };
    }
}

module.exports = { AidaChatbotService };