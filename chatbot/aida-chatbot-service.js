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
        const content = await fs.readFile(systemPromptPath, 'utf8');
        return content;
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
     * Add message to conversation history
     */
    addMessage(role, content) {
        this.messages.push({
            role: role, // 'user', 'assistant', or 'system'
            content: content,
            timestamp: Date.now()
        });

        // Trim history if too long
        if (this.messages.length > this.maxHistoryMessages) {
            this.messages = this.messages.slice(-this.maxHistoryMessages);
        }
    }

    /**
     * Build messages array for AI API
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

        // Add conversation history (excluding system messages in history)
        const conversationMessages = this.messages
            .filter(msg => msg.role !== 'system')
            .map(msg => ({
                role: msg.role,
                content: msg.content
            }));

        apiMessages.push(...conversationMessages);

        return apiMessages;
    }

    /**
     * Generate AI response using conversation context
     */
    async generateResponse(userMessage) {
        try {
            // Add user message to history
            this.addMessage('user', userMessage);

            // Build messages for API
            const messages = this.buildMessagesForAPI();

            // Check if we have AI service configured
            const aiResponse = await this.callAIService(messages);

            // Add AI response to history
            this.addMessage('assistant', aiResponse);

            return aiResponse;

        } catch (error) {
            console.error('❌ Error generating AI response:', error);
            // Fallback to rule-based response
            return this.generateFallbackResponse(userMessage);
        }
    }

    /**
     * Call AI service (OpenAI, Anthropic, or local LLM)
     */
    async callAIService(messages) {
        // Check for API key configuration
        const config = await this.getAIConfig();
        
        if (config.provider === 'openai' && config.apiKey) {
            return await this.callOpenAI(messages, config);
        } else if (config.provider === 'anthropic' && config.apiKey) {
            return await this.callAnthropic(messages, config);
        } else if ((config.provider === 'local' || config.provider === 'ollama' || config.provider === 'openai-compatible') && config.apiHost) {
            return await this.callLocalLLM(messages, config);
        } else {
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
     * Call Anthropic API
     */
    async callAnthropic(messages, config) {
        const apiUrl = config.apiHost || 'https://api.anthropic.com/v1/messages';
        
        // Extract system message
        const systemMessage = messages.find(m => m.role === 'system')?.content || '';
        const conversationMessages = messages.filter(m => m.role !== 'system');

        const response = await axios.post(apiUrl, {
            model: config.model || 'claude-3-haiku-20240307',
            max_tokens: 1000,
            system: systemMessage,
            messages: conversationMessages
        }, {
            headers: {
                'x-api-key': config.apiKey,
                'Content-Type': 'application/json',
                'anthropic-version': '2023-06-01'
            }
        });

        return response.data.content[0].text;
    }

    /**
     * Call local LLM endpoint
     */
    async callLocalLLM(messages, config) {
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
     * Generate fallback response when all else fails
     */
    generateFallbackResponse(message) {
        const isVietnamese = this.detectVietnamese(message);
        
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