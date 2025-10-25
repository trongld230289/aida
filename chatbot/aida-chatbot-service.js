const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

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
        const systemPromptWithVisionPath = path.join(this.context.extensionPath, 'chatbot', 'system_prompt_with_vision.md');
        
        try {
            // Try to load vision-enhanced prompt first
            const visionContent = await fs.readFile(systemPromptWithVisionPath, 'utf8');
            return visionContent;
        } catch (error) {
            // Fallback to regular prompt
            try {
                const content = await fs.readFile(systemPromptPath, 'utf8');
                return content;
            } catch (fallbackError) {
                throw fallbackError;
            }
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
    async generateResponse(userMessage, images = []) {
        try {
            console.log('💬 generateResponse called with:', { message: userMessage, imageCount: images?.length || 0 });
            
            // Add user message to history with images
            this.addMessage('user', userMessage, images);

            // Build messages for API
            const messages = this.buildMessagesForAPI();
            
            console.log('📦 Built messages for API:', messages.length, 'messages');

            // Check if we have AI service configured
            const aiResponse = await this.callAIService(messages);

            // Add AI response to history
            this.addMessage('assistant', aiResponse);

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
    async callAIService(messages) {
        // Check for API key configuration
        const config = await this.getAIConfig();
        
        console.log('🔧 AI Config:', { provider: config.provider, hasApiKey: !!config.apiKey, apiHost: config.apiHost, model: config.model });
        
        if (config.provider === 'openai' && config.apiKey) {
            console.log('📡 Using OpenAI API');
            return await this.callOpenAI(messages, config);
        } else if (config.provider === 'anthropic' && config.apiKey) {
            console.log('📡 Using Anthropic API');
            return await this.callAnthropic(messages, config);
        } else if ((config.provider === 'local' || config.provider === 'ollama' || config.provider === 'openai-compatible') && config.apiHost) {
            console.log('📡 Using Local LLM API');
            return await this.callLocalLLM(messages, config);
        } else {
            console.log('📡 Using Smart Responses (no AI service configured)');
            // No AI service configured, use smart rule-based responses
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
            
            // Enhanced provider detection from apiHost
            let provider = 'smart'; // Default to smart responses
            let detectedModel = model;
            
            if (apiHost && apiKey) {
                const host = apiHost.toLowerCase();
                
                // OpenAI and compatible providers
                if (host.includes('openai.com') || host.includes('api.openai.com')) {
                    provider = 'openai';
                } 
                // Azure OpenAI
                else if (host.includes('openai.azure.com') || host.includes('.azure.com')) {
                    provider = 'azure-openai';
                }
                // Anthropic (Claude)
                else if (host.includes('anthropic.com') || host.includes('api.anthropic.com')) {
                    provider = 'anthropic';
                    detectedModel = model.includes('claude') ? model : 'claude-3-haiku-20240307';
                }
                // Google AI (Gemini)
                else if (host.includes('googleapis.com') || host.includes('generativeai.googleapis.com')) {
                    provider = 'google';
                    detectedModel = model.includes('gemini') ? model : 'gemini-pro';
                }
                // Cohere
                else if (host.includes('cohere.ai') || host.includes('api.cohere.ai')) {
                    provider = 'cohere';
                }
                // Mistral AI
                else if (host.includes('mistral.ai') || host.includes('api.mistral.ai')) {
                    provider = 'mistral';
                }
                // Ollama (local)
                else if (host.includes('localhost') || host.includes('127.0.0.1') || host.includes(':11434')) {
                    provider = 'ollama';
                    detectedModel = model || 'llama3';
                }
                // LMStudio (local)
                else if (host.includes(':1234') || host.includes('lmstudio')) {
                    provider = 'lmstudio';
                }
                // Together AI
                else if (host.includes('together.ai') || host.includes('api.together.xyz')) {
                    provider = 'together';
                }
                // Hugging Face
                else if (host.includes('huggingface.co') || host.includes('api-inference.huggingface.co')) {
                    provider = 'huggingface';
                }
                // OpenRouter (aggregator)
                else if (host.includes('openrouter.ai')) {
                    provider = 'openrouter';
                }
                // Generic local/custom endpoint
                else {
                    provider = 'local';
                }
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
     * Call OpenAI API
     */
    async callOpenAI(messages, config) {
        const apiUrl = config.apiHost || 'https://api.openai.com/v1/chat/completions';
        
        const response = await axios.post(apiUrl, {
            model: config.model || 'gpt-3.5-turbo',
            messages: messages,
            max_tokens: 1000,
            temperature: 0.7
        }, {
            headers: {
                'Authorization': `Bearer ${config.apiKey}`,
                'Content-Type': 'application/json'
            }
        });

        return response.data.choices[0].message.content;
    }

    /**
     * Call Anthropic API with image support (Claude Vision)
     */
    async callAnthropic(messages, config) {
        const apiUrl = config.apiHost || 'https://api.anthropic.com/v1/messages';
        
        console.log('🔍 Debug callAnthropic - messages:', JSON.stringify(messages, null, 2));
        
        // Extract system message
        const systemMessage = messages.find(m => m.role === 'system')?.content || '';
        const conversationMessages = messages.filter(m => m.role !== 'system');

        console.log('🔍 Debug conversationMessages:', JSON.stringify(conversationMessages, null, 2));

        // Build content for Claude with images
        const claudeMessages = conversationMessages.map(msg => {
            const content = [];
            
            // Add text content
            if (msg.content) {
                content.push({
                    type: 'text',
                    text: msg.content
                });
            }
            
            // FIX: Check for images in the correct property
            console.log('🔍 Debug msg.images:', msg.images?.length || 0);
            if (msg.images && msg.images.length > 0) {
                console.log('🖼️ Processing', msg.images.length, 'images');
                for (const image of msg.images) {
                    const imageData = this.prepareImageForClaude(image);
                    if (imageData) {
                        console.log('✅ Image prepared:', imageData.mimeType, 'base64 length:', imageData.base64.length);
                        content.push({
                            type: 'image',
                            source: {
                                type: 'base64',
                                media_type: imageData.mimeType,
                                data: imageData.base64
                            }
                        });
                    } else {
                        console.error('❌ Failed to prepare image:', image);
                    }
                }
            }
            
            console.log('📝 Final content for message:', content.length, 'items');
            return {
                role: msg.role,
                content: content
            };
        });

        console.log('🚀 Sending to Claude:', { model: config.model, system: systemMessage?.length || 0, messages: claudeMessages.length });

        const response = await axios.post(apiUrl, {
            model: config.model || 'claude-3-5-sonnet-20241022',
            max_tokens: 4000,
            system: systemMessage,
            messages: claudeMessages
        }, {
            headers: {
                'x-api-key': config.apiKey,
                'Content-Type': 'application/json',
                // 'anthropic-version': '2023-06-01'
            }
        });

        console.log('✅ Claude response received');
        return response.data.content[0].text;
    }

    /**
     * Call local LLM endpoint with image support (for company-hosted Claude)
     */
    async callLocalLLM(messages, config) {
        console.log('🔍 Debug callLocalLLM - messages:', JSON.stringify(messages, null, 2));
        
        // Check if this is Claude-based model that supports vision
        const isClaudeModel = config.model?.toLowerCase().includes('claude');
        
        if (isClaudeModel) {
            console.log('🎯 Detected Claude model, using OpenAI-compatible vision format for local endpoint');
            
            // Build OpenAI-compatible messages with images
            const openAIMessages = messages.map(msg => {
                if (msg.role === 'system') {
                    return msg; // Keep system message as-is
                }
                
                const content = [];
                
                // Add text content
                if (msg.content) {
                    content.push({
                        type: 'text',
                        text: msg.content
                    });
                }
                
                // Add images in OpenAI format
                console.log('🔍 Debug msg.images:', msg.images?.length || 0);
                if (msg.images && msg.images.length > 0) {
                    console.log('🖼️ Processing', msg.images.length, 'images for local Claude in OpenAI format');
                    for (const image of msg.images) {
                        const imageData = this.prepareImageForClaude(image);
                        if (imageData) {
                            console.log('✅ Image prepared for local Claude:', imageData.mimeType, 'base64 length:', imageData.base64.length);
                            content.push({
                                type: 'image_url',
                                image_url: {
                                    url: `data:${imageData.mimeType};base64,${imageData.base64}`
                                }
                            });
                        } else {
                            console.error('❌ Failed to prepare image for local Claude:', image);
                        }
                    }
                }
                
                console.log('📝 Final content for local Claude message:', content.length, 'items');
                return {
                    role: msg.role,
                    content: content
                };
            });

            console.log('🚀 Sending to Local Claude in OpenAI format:', { model: config.model, messages: openAIMessages.length });

            // Use OpenAI format for local endpoint
            const response = await axios.post(config.apiHost, {
                model: config.model || 'claude-4-sonnet',
                messages: openAIMessages,
                max_tokens: 4000,
                temperature: 0.7
            }, {
                headers: {
                    'Authorization': config.apiKey ? `Bearer ${config.apiKey}` : undefined,
                    'Content-Type': 'application/json'
                }
            });

            console.log('✅ Local Claude response received');
            return response.data.choices?.[0]?.message?.content || response.data.content?.[0]?.text || response.data.response;
            
        } else {
            console.log('🔄 Using standard OpenAI-compatible format for non-Claude model');
            
            // Standard OpenAI format for non-Claude models
            const response = await axios.post(config.apiHost, {
                messages: messages,
                max_tokens: 1000,
                temperature: 0.7,
                model: config.model
            }, {
                headers: {
                    'Authorization': config.apiKey ? `Bearer ${config.apiKey}` : undefined,
                    'Content-Type': 'application/json'
                }
            });

            return response.data.choices?.[0]?.message?.content || response.data.response;
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