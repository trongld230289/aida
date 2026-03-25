import * as vscode from 'vscode';
import { aidaLogging } from '../core/settings';
import { toError } from '../core/error-utils';

/**
 * Test script to get all available GitHub Copilot models
 * Run this in VS Code Extension Host to see available models
 * Ctrl+Shift+P: AIDA: Test Get Copilot Models
 */
async function testGetCopilotModels() {
    aidaLogging('🔍 Testing GitHub Copilot Model Discovery...\n');
    
    try {
        // Method 1: Try vscode.lm API (VS Code 1.90+)
        aidaLogging('📋 Method 1: Using vscode.lm.selectChatModels()');
        if (vscode.lm && vscode.lm.selectChatModels) {
            const models = await vscode.lm.selectChatModels();
            aidaLogging(`✅ Found ${models.length} models:\n`);
            
            models.forEach((model, index) => {
                aidaLogging(`${index + 1}. Model ID: ${model.id}`);
                aidaLogging(`   Name: ${model.name || 'N/A'}`);
                aidaLogging(`   Vendor: ${model.vendor || 'N/A'}`);
                aidaLogging(`   Family: ${model.family || 'N/A'}`);
                aidaLogging(`   Version: ${model.version || 'N/A'}`);
                aidaLogging(`   Max Input Tokens: ${model.maxInputTokens || 'N/A'}`);
                aidaLogging(`   Max Output Tokens: ${(model as any).maxOutputTokens || 'N/A'}`);
                aidaLogging('');
            });
            
            // Try to get specific model families
            aidaLogging('\n🔎 Filtering by families:');
            
            const claudeModels = models.filter(m => 
                m.family?.toLowerCase().includes('claude') || 
                m.id?.toLowerCase().includes('claude')
            );
            aidaLogging(`\n🤖 Claude models (${claudeModels.length}):`);
            claudeModels.forEach(m => aidaLogging(`   - ${m.id} (${m.name || 'unnamed'})`));
            
            const gptModels = models.filter(m => 
                m.family?.toLowerCase().includes('gpt') || 
                m.id?.toLowerCase().includes('gpt')
            );
            aidaLogging(`\n🤖 GPT models (${gptModels.length}):`);
            gptModels.forEach(m => aidaLogging(`   - ${m.id} (${m.name || 'unnamed'})`));
            
            const geminiModels = models.filter(m => 
                m.family?.toLowerCase().includes('gemini') || 
                m.id?.toLowerCase().includes('gemini')
            );
            aidaLogging(`\n🤖 Gemini models (${geminiModels.length}):`);
            geminiModels.forEach(m => aidaLogging(`   - ${m.id} (${m.name || 'unnamed'})`));
            
            const o1Models = models.filter(m => 
                m.family?.toLowerCase().includes('o1') || 
                m.id?.toLowerCase().includes('o1')
            );
            aidaLogging(`\n🤖 O1 models (${o1Models.length}):`);
            o1Models.forEach(m => aidaLogging(`   - ${m.id} (${m.name || 'unnamed'})`));
            
        } else {
            aidaLogging('❌ vscode.lm.selectChatModels not available');
        }
        
        // Method 2: Try languageModelAccessInformation
        aidaLogging('\n📋 Method 2: Using vscode.lm.languageModels');
        if (vscode.lm && (vscode.lm as any).languageModels) {
            const languageModels = (vscode.lm as any).languageModels;
            aidaLogging('✅ Available language models:', languageModels);
        } else {
            aidaLogging('❌ vscode.lm.languageModels not available');
        }
        
        // Method 3: Check chat model access
        aidaLogging('\n📋 Method 3: Checking specific model IDs');
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
                    aidaLogging(`✅ ${modelId}: Available`);
                } else {
                    aidaLogging(`❌ ${modelId}: Not found`);
                }
            } catch (_error: unknown) {
                const error = toError(_error);
                aidaLogging(`❌ ${modelId}: Error - ${error.message}`);
            }
        }
        
        aidaLogging('\n✅ Test completed!');
        
    } catch (_error: unknown) {
        const error = toError(_error);
        console.error('❌ Error testing models:', error);
        console.error('Stack:', error.stack);
    }
}

/**
 * Alternative: Get currently selected model in chat context
 */
async function getCurrentChatModel(chatContext: Record<string, any>) {
    aidaLogging('\n🔍 Getting current chat model from context...');
    
    if (!chatContext) {
        aidaLogging('❌ No chat context provided');
        return null;
    }
    
    try {
        // Check if context has model info
        if (chatContext.model) {
            aidaLogging('✅ Model from context:', chatContext.model);
            return chatContext.model;
        }
        
        // Check language model accessor
        if (chatContext.languageModelAccessInformation) {
            aidaLogging('✅ Language model info:', chatContext.languageModelAccessInformation);
            return chatContext.languageModelAccessInformation;
        }
        
        aidaLogging('❌ No model information in chat context');
        return null;
        
    } catch (error: unknown) {
        console.error('❌ Error getting current model:', error);
        return null;
    }
}

/**
 * Register test command
 */
function registerTestCommand(context: Record<string, any>) {
    const testCommand = vscode.commands.registerCommand('aida.testGetCopilotModels', async () => {
        await testGetCopilotModels();
    });
    
    context.subscriptions.push(testCommand);
    aidaLogging('✅ Test command registered: aida.testGetCopilotModels');
    aidaLogging('💡 Run command: Developer: Run Command > "Test Get Copilot Models"');
}

// ES exports
export { testGetCopilotModels, getCurrentChatModel, registerTestCommand };
