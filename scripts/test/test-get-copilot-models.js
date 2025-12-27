const vscode = require('vscode');

/**
 * Test script to get all available GitHub Copilot models
 * Run this in VS Code Extension Host to see available models
 * Ctrl+Shift+P: AIDA: Test Get Copilot Models
 */
async function testGetCopilotModels() {
    console.log('🔍 Testing GitHub Copilot Model Discovery...\n');
    
    try {
        // Method 1: Try vscode.lm API (VS Code 1.90+)
        console.log('📋 Method 1: Using vscode.lm.selectChatModels()');
        if (vscode.lm && vscode.lm.selectChatModels) {
            const models = await vscode.lm.selectChatModels();
            console.log(`✅ Found ${models.length} models:\n`);
            
            models.forEach((model, index) => {
                console.log(`${index + 1}. Model ID: ${model.id}`);
                console.log(`   Name: ${model.name || 'N/A'}`);
                console.log(`   Vendor: ${model.vendor || 'N/A'}`);
                console.log(`   Family: ${model.family || 'N/A'}`);
                console.log(`   Version: ${model.version || 'N/A'}`);
                console.log(`   Max Input Tokens: ${model.maxInputTokens || 'N/A'}`);
                console.log(`   Max Output Tokens: ${model.maxOutputTokens || 'N/A'}`);
                console.log('');
            });
            
            // Try to get specific model families
            console.log('\n🔎 Filtering by families:');
            
            const claudeModels = models.filter(m => 
                m.family?.toLowerCase().includes('claude') || 
                m.id?.toLowerCase().includes('claude')
            );
            console.log(`\n🤖 Claude models (${claudeModels.length}):`);
            claudeModels.forEach(m => console.log(`   - ${m.id} (${m.name || 'unnamed'})`));
            
            const gptModels = models.filter(m => 
                m.family?.toLowerCase().includes('gpt') || 
                m.id?.toLowerCase().includes('gpt')
            );
            console.log(`\n🤖 GPT models (${gptModels.length}):`);
            gptModels.forEach(m => console.log(`   - ${m.id} (${m.name || 'unnamed'})`));
            
            const geminiModels = models.filter(m => 
                m.family?.toLowerCase().includes('gemini') || 
                m.id?.toLowerCase().includes('gemini')
            );
            console.log(`\n🤖 Gemini models (${geminiModels.length}):`);
            geminiModels.forEach(m => console.log(`   - ${m.id} (${m.name || 'unnamed'})`));
            
            const o1Models = models.filter(m => 
                m.family?.toLowerCase().includes('o1') || 
                m.id?.toLowerCase().includes('o1')
            );
            console.log(`\n🤖 O1 models (${o1Models.length}):`);
            o1Models.forEach(m => console.log(`   - ${m.id} (${m.name || 'unnamed'})`));
            
        } else {
            console.log('❌ vscode.lm.selectChatModels not available');
        }
        
        // Method 2: Try languageModelAccessInformation
        console.log('\n📋 Method 2: Using vscode.lm.languageModels');
        if (vscode.lm && vscode.lm.languageModels) {
            const languageModels = vscode.lm.languageModels;
            console.log('✅ Available language models:', languageModels);
        } else {
            console.log('❌ vscode.lm.languageModels not available');
        }
        
        // Method 3: Check chat model access
        console.log('\n📋 Method 3: Checking specific model IDs');
        const testModelIds = [
            'copilot-gpt-4',
            'copilot-gpt-4-turbo',
            'copilot-gpt-4o',
            'copilot-gpt-3.5-turbo',
            'claude-3-5-sonnet',
            'claude-3-opus',
            'claude-sonnet-4',
            'claude-sonnet-4.5',
            'gemini-1.5-pro',
            'gemini-2.0-flash',
            'o1-preview',
            'o1-mini'
        ];
        
        for (const modelId of testModelIds) {
            try {
                const models = await vscode.lm.selectChatModels({ id: modelId });
                if (models && models.length > 0) {
                    console.log(`✅ ${modelId}: Available`);
                } else {
                    console.log(`❌ ${modelId}: Not found`);
                }
            } catch (error) {
                console.log(`❌ ${modelId}: Error - ${error.message}`);
            }
        }
        
        console.log('\n✅ Test completed!');
        
    } catch (error) {
        console.error('❌ Error testing models:', error);
        console.error('Stack:', error.stack);
    }
}

/**
 * Alternative: Get currently selected model in chat context
 */
async function getCurrentChatModel(chatContext) {
    console.log('\n🔍 Getting current chat model from context...');
    
    if (!chatContext) {
        console.log('❌ No chat context provided');
        return null;
    }
    
    try {
        // Check if context has model info
        if (chatContext.model) {
            console.log('✅ Model from context:', chatContext.model);
            return chatContext.model;
        }
        
        // Check language model accessor
        if (chatContext.languageModelAccessInformation) {
            console.log('✅ Language model info:', chatContext.languageModelAccessInformation);
            return chatContext.languageModelAccessInformation;
        }
        
        console.log('❌ No model information in chat context');
        return null;
        
    } catch (error) {
        console.error('❌ Error getting current model:', error);
        return null;
    }
}

/**
 * Register test command
 */
function registerTestCommand(context) {
    const testCommand = vscode.commands.registerCommand('aida.testGetCopilotModels', async () => {
        await testGetCopilotModels();
    });
    
    context.subscriptions.push(testCommand);
    console.log('✅ Test command registered: aida.testGetCopilotModels');
    console.log('💡 Run command: Developer: Run Command > "Test Get Copilot Models"');
}

module.exports = {
    testGetCopilotModels,
    getCurrentChatModel,
    registerTestCommand
};
