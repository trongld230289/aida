/**
 * @module model-selector
 * @description AI model selection & configuration logic
 * Extracted from review-common.js during Phase 1 refactoring
 */

const vscode = require('vscode');
const { aidaLogging } = require('./settings');
const { getChatbotPreferredModelKeyword } = require('./aida-config');

// Lazy requires to avoid circular deps
function _getAIProvider() { return require('./ai-provider'); }
function _getTokenEstimator() { return require('./token-estimator'); }

async function getAidaChatbotSelectedModel(context) {
    try {
        aidaLogging('🔍 getAidaChatbotSelectedModel called');

        if (!context || !context.workspaceState) {
            aidaLogging('⚠️ getAidaChatbotSelectedModel: No context or workspaceState available');
            return null;
        }

        // Get all available models from Copilot first
        const availableModels = await vscode.lm.selectChatModels();
        aidaLogging('🔍 Available models:', availableModels.map(m => `${m.id} (${m.family})`));

        if (availableModels.length === 0) {
            aidaLogging('⚠️ No Copilot models available');
            return null;
        }

        // Get saved model ID from AIDA chatbot state
        let savedModelId = context.workspaceState.get('aida.selectedModelId');
        aidaLogging('🔍 Saved model ID from state:', savedModelId);

        // FIRST TIME USE: Default to preferred model from aida-config.js
        if (!savedModelId) {
            const preferredKeyword = getChatbotPreferredModelKeyword();
            aidaLogging(`ℹ️ First time use - looking for preferred model keyword: "${preferredKeyword}"`);

            // Find preferred model in available models using config keyword
            const opusModel = availableModels.find(m =>
                m.family?.toLowerCase().includes(preferredKeyword) ||
                m.id?.toLowerCase().includes(preferredKeyword)
            );

            if (opusModel) {
                savedModelId = opusModel.id;
                // Save as default for future use
                await context.workspaceState.update('aida.selectedModelId', savedModelId);
                aidaLogging('✅ Default model set to Opus:', opusModel.family);
                return opusModel;
            } else {
                // Fallback to first available if Opus not found
                const firstModel = availableModels[0];
                savedModelId = firstModel.id;
                await context.workspaceState.update('aida.selectedModelId', savedModelId);
                aidaLogging('⚠️ Opus not available, defaulting to:', firstModel.family);
                return firstModel;
            }
        }

        // Find the saved model in available models
        const savedModel = availableModels.find(m => m.id === savedModelId);

        if (savedModel) {
            aidaLogging('✅ Using AIDA Chatbot selected model:', savedModel.family);
            return savedModel;
        } else {
            aidaLogging('⚠️ Saved model not found in available models, resetting to Opus');
            // Model no longer available, reset to Opus
            const opusModel = availableModels.find(m =>
                m.family?.toLowerCase().includes('opus') ||
                m.id?.toLowerCase().includes('opus')
            ) || availableModels[0];

            await context.workspaceState.update('aida.selectedModelId', opusModel.id);
            return opusModel;
        }
    } catch (error) {
        aidaLogging('❌ getAidaChatbotSelectedModel error:', error.message);
        return null;
    }
}

async function getUnifiedModel(stream, requestedModel = null, contextOrChatContext = null, request = null) {
    let models = [];

    aidaLogging('=== getUnifiedModel DEBUG START ===');
    aidaLogging('🔍 Parameters received:');
    aidaLogging('   requestedModel:', requestedModel);
    aidaLogging('   contextOrChatContext type:', typeof contextOrChatContext);
    aidaLogging('   contextOrChatContext keys:', contextOrChatContext ? Object.keys(contextOrChatContext).slice(0, 10) : 'null');
    aidaLogging('   request:', request ? 'exists' : 'null');

    // PRIORITY 0: Check if API key mode is enabled - if so, skip ALL Copilot model detection
    if (_getAIProvider().shouldUseApiKey()) {
        aidaLogging('🔑 API Key mode enabled - skipping ALL Copilot model detection');
        aidaLogging('=== getUnifiedModel DEBUG END (API KEY MODE) ===');
        return null; // Let API key mode handle the AI calls
    }

    aidaLogging('🔍 Full request object:', JSON.stringify(request, null, 2));
    aidaLogging('🔍 Request keys:', request ? Object.keys(request) : 'null');
    aidaLogging('🔍 Request.model:', request?.model);
    aidaLogging('🔍 Request.model?.family:', request?.model?.family);
    aidaLogging('🔍 Request.model?.id:', request?.model?.id);

    // Check ALL possible model locations in request
    if (request) {
        aidaLogging('🔍 Checking all request properties for model...');
        for (const key in request) {
            aidaLogging(`   - request.${key}:`, typeof request[key] === 'object' ? JSON.stringify(request[key]).substring(0, 200) : request[key]);
        }
    }

    // PRIORITY 1: Check request.model first (this is where VS Code puts the selected model!)
    if (request && request.model) {
        aidaLogging('✅ Found model in request.model:', request.model);
        aidaLogging('✅ Model family:', request.model.family);
        aidaLogging('✅ Model id:', request.model.id);
        aidaLogging('🎯 Using user-selected model from VS Code chat');

        // Add warning if user selected GPT but wanted Claude
        if (request.model.family && request.model.family.toLowerCase().includes('gpt')) {
            aidaLogging('ℹ️ NOTE: User selected GPT model. To use Claude, please select a Claude model in VS Code chat dropdown.');
        }

        return request.model;
    } else {
        aidaLogging('❌ No model found in request.model');
        aidaLogging('❌ Request is:', request ? 'valid object' : 'null/undefined');
        aidaLogging('❌ Request.model is:', request?.model ? 'valid' : 'null/undefined');
    }

    // PRIORITY 2: Check AIDA Chatbot selected model BEFORE any fallback
    // This ensures user's chatbot selection is respected
    aidaLogging('🔍 PRIORITY 2: Checking AIDA Chatbot selected model...');

    let extensionContext = null;

    // Try to find extension context with workspaceState
    // Option 1: From passed contextOrChatContext
    if (contextOrChatContext?.workspaceState) {
        extensionContext = contextOrChatContext;
        aidaLogging('✅ Found extension context from parameter (has workspaceState)');
    }
    // Option 2: From nested context property
    else if (contextOrChatContext?.context?.workspaceState) {
        extensionContext = contextOrChatContext.context;
        aidaLogging('✅ Found extension context in contextOrChatContext.context');
    }
    // Option 3: From global (fallback for when context not passed properly)
    else if (global.aidaExtensionContext?.workspaceState) {
        extensionContext = global.aidaExtensionContext;
        aidaLogging('✅ Found extension context from global.aidaExtensionContext');
    }

    aidaLogging('   extensionContext found:', !!extensionContext);

    if (extensionContext) {
        aidaLogging('🔍 Attempting to load AIDA Chatbot selected model from state...');
        const aidaSelectedModel = await getAidaChatbotSelectedModel(extensionContext);
        if (aidaSelectedModel) {
            aidaLogging('✅ PRIORITY 2: Using AIDA Chatbot selected model:', aidaSelectedModel.family);
            return aidaSelectedModel;
        } else {
            aidaLogging('⚠️ PRIORITY 2: getAidaChatbotSelectedModel returned null');
        }
    } else {
        aidaLogging('⚠️ PRIORITY 2: No extension context found');
    }

    // PRIORITY 3: Use passed requestedModel object
    if (requestedModel && typeof requestedModel === 'object' && requestedModel.family) {
        aidaLogging('PRIORITY 3: Using requested model object:', requestedModel);
        return requestedModel;
    }

    // PRIORITY 4: Try to get the current model from chat context  
    const chatContext = contextOrChatContext;
    if (chatContext) {
        aidaLogging('🔍 PRIORITY 4: Checking for model in chatContext...');

        // VS Code chat context may have model at chatContext.model or chatContext.participant.model
        let currentModel = null;

        if (chatContext.model) {
            aidaLogging('✅ Found model at chatContext.model:', chatContext.model);
            currentModel = chatContext.model;
        } else {
            aidaLogging('❌ No model found at chatContext.model');
        }

        if (chatContext.participant && chatContext.participant.model) {
            aidaLogging('✅ Found model at chatContext.participant.model:', chatContext.participant.model);
            currentModel = chatContext.participant.model;
        } else {
            aidaLogging('❌ No model found at chatContext.participant.model');
        }

        // Check other possible locations
        if (chatContext.request && chatContext.request.model) {
            aidaLogging('✅ Found model at chatContext.request.model:', chatContext.request.model);
            currentModel = chatContext.request.model;
        }

        if (currentModel) {
            aidaLogging('PRIORITY 4: Using selected chatbox model:', currentModel);
            return currentModel;
        } else {
            aidaLogging('⚠️ No model found in any chatContext location');
        }
    }

    // PRIORITY 5: Last resort - try global context one more time with model lookup
    aidaLogging('🔄 PRIORITY 5: Last resort fallback...');

    // Try one more time with global context
    if (global.aidaExtensionContext?.workspaceState) {
        aidaLogging('🔍 PRIORITY 5: Trying global.aidaExtensionContext one more time...');
        const aidaModel = await getAidaChatbotSelectedModel(global.aidaExtensionContext);
        if (aidaModel) {
            aidaLogging('✅ PRIORITY 5: Got model from global context:', aidaModel.family);
            return aidaModel;
        }
    }

    // Absolute last fallback - get available models
    try {
        models = await vscode.lm.selectChatModels();
        aidaLogging('📋 All available models:', models.map(m => `${m.family || m.id} (${m.vendor || 'Unknown'})`));

        if (models.length === 0) {
            aidaLogging('⚠️ No Copilot models available - check GitHub Copilot installation and authentication');
            return null;
        }

        // Just return first available - user should configure via AIDA Chatbot
        const selectedModel = models[0];
        aidaLogging(`⚠️ PRIORITY 5: Using first available model (configure in AIDA Chatbot): ${selectedModel.family}`);

        return selectedModel;
    } catch (error) {
        aidaLogging('❌ Error getting Copilot models:', error.message);

        // Check if this is a GitHub authentication error
        if (error.message.includes('GitHubLoginFailed') || error.message.includes('authentication')) {
            aidaLogging('🔑 GitHub Copilot authentication failed. Consider using API key mode instead.');

            // If user has API key configured, suggest enabling API key mode
            const config = vscode.workspace.getConfiguration('aida');
            const hasApiKey = config.get('ai.apiKey');

            if (hasApiKey) {
                aidaLogging('💡 You have an API key configured. Enable API key mode: aida.useExternalAI = true');
            } else {
                aidaLogging('💡 Configure an API key in settings: aida.ai.apiKey and enable aida.useExternalAI');
            }
        }

        return null;
    }

    aidaLogging('=== getUnifiedModel DEBUG END ===');
    return null;
}

async function getAvailableModels() {
    try {
        // Check if API key mode is enabled - return empty array for Copilot models
        if (_getAIProvider().shouldUseApiKey()) {
            aidaLogging('🔑 API Key mode enabled - returning API provider models');
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
        aidaLogging('Error fetching available models:', error);
        return [];
    }
}

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
        aidaLogging('Error showing available models:', error);
        vscode.window.showErrorMessage(`Error fetching models: ${error.message}`);
    }
}

module.exports = {
    getAidaChatbotSelectedModel,
    getUnifiedModel,
    getAvailableModels,
    showAvailableModels
};
