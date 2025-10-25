const axios = require('axios');

/**
 * Claude Sonnet Vision Bot - Specialized image processing with Claude 3.5 Sonnet
 * Handles image analysis for code screenshots, error messages, and UI designs
 */
class ClaudeSonnetVisionBot {
    constructor(apiKey) {
        this.apiKey = apiKey;
        // Use latest Sonnet 3.5
        this.model = 'claude-3-5-sonnet-20241022';
        this.apiUrl = 'https://api.anthropic.com/v1/messages';
    }

    /**
     * System prompt cho code assistant với vision capabilities
     */
    getSystemPrompt() {
        return `You are a specialized programming assistant using Claude Sonnet 3.5.
    
## Core Capabilities
- Expert in software development and debugging
- Can analyze code screenshots and provide solutions
- Extract text from images accurately
- Provide formatted code with syntax highlighting

## Language Handling
- Detect and respond in the same language as user (Vietnamese/English)
- Maintain consistency throughout conversation

## Image Analysis
When analyzing code/error screenshots:
1. Extract all visible text/code
2. Format it properly with syntax highlighting
3. Identify issues and provide solutions
4. Suggest improvements

## Response Style
- Be concise but thorough
- Always format code properly
- Provide practical, working solutions`;
    }

    /**
     * Process message with optional image using Claude Sonnet API
     */
    async processMessage(messageData) {
        try {
            const userContent = [];
            
            // Add text content
            if (messageData.text) {
                userContent.push({
                    type: 'text',
                    text: messageData.text
                });
            } else if (messageData.images?.length > 0) {
                // If only images, add instruction
                userContent.push({
                    type: 'text',
                    text: 'Please analyze this image and provide assistance.'
                });
            }
            
            // Add images
            if (messageData.images?.length > 0) {
                for (const image of messageData.images) {
                    // Prepare image data
                    const imageData = this.prepareImage(image);
                    
                    userContent.push({
                        type: 'image',
                        source: {
                            type: 'base64',
                            media_type: imageData.mimeType,
                            data: imageData.base64
                        }
                    });
                }
            }
            
            // Call Claude API
            const response = await axios.post(this.apiUrl, {
                model: this.model,
                max_tokens: 8192,
                temperature: 0.7,
                system: this.getSystemPrompt(),
                messages: [
                    {
                        role: 'user',
                        content: userContent
                    }
                ]
            }, {
                headers: {
                    'x-api-key': this.apiKey,
                    'Content-Type': 'application/json',
                    'anthropic-version': '2023-06-01'
                }
            });
            
            return response.data.content[0].text;
            
        } catch (error) {
            console.error('Claude Sonnet Error:', error);
            
            // Handle specific errors
            if (error.response?.status === 413) {
                throw new Error('Image too large. Please use smaller image (< 5MB)');
            }
            if (error.response?.status === 429) {
                throw new Error('Rate limit exceeded. Please try again later');
            }
            if (error.response?.status === 401) {
                throw new Error('Invalid API key. Please check Claude API configuration');
            }
            
            throw error;
        }
    }
    
    /**
     * Prepare image for Claude API
     */
    prepareImage(imageInput) {
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
        } else if (imageInput.base64 && imageInput.mimeType) {
            // Object with separate fields
            base64Data = imageInput.base64;
            mimeType = imageInput.mimeType;
        } else if (imageInput.data && imageInput.type) {
            // VS Code format
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
            mimeType = 'image/png';
        }
        
        return { base64: base64Data, mimeType };
    }

    /**
     * Analyze code screenshot specifically
     */
    async analyzeCodeScreenshot(imageData, question = '') {
        const message = {
            text: question || 'Please analyze this code screenshot and provide formatted code with suggestions.',
            images: [imageData]
        };

        return await this.processMessage(message);
    }

    /**
     * Analyze error screenshot specifically
     */
    async analyzeErrorScreenshot(imageData, context = '') {
        const message = {
            text: `Please analyze this error screenshot${context ? ` in context of: ${context}` : ''} and provide solutions.`,
            images: [imageData]
        };

        return await this.processMessage(message);
    }

    /**
     * Analyze UI design screenshot
     */
    async analyzeUIScreenshot(imageData, requirements = '') {
        const message = {
            text: `Please analyze this UI design screenshot${requirements ? ` with requirements: ${requirements}` : ''} and provide implementation code.`,
            images: [imageData]
        };

        return await this.processMessage(message);
    }
}

module.exports = { ClaudeSonnetVisionBot };