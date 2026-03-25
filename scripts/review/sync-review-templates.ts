import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { aidaLogging } from '../core/settings';
import { trackEvent } from '../tracking/usage-tracking';
import { TrackingEvent, TrackingSource, getIdeAiProvider } from '../tracking/tracking-enums';

// Direct import — no circular dependency through extension.js
import { handleSyncTemplates } from '../core/template-engine';
import { toError } from '../core/error-utils';

/**
 * Initialize sync-review-templates chat participant
 * @param {vscode.ExtensionContext} context
 * @returns {object} Object containing the participant
 */
function initializeSyncTemplates(context: Record<string, any>) {
    aidaLogging('🔄 Initializing sync-review-templates participant...');

    // Create sync-review-templates chat participant
    const syncTemplatesParticipant = vscode.chat.createChatParticipant('sync-review-templates', async (_request, _chatContext, stream, _token) => {
        aidaLogging('🔄 @sync-review-templates triggered');

        // Track usage - Copilot chat participant
        void trackEvent(TrackingEvent.SYNC_REVIEW_TEMPLATES, {
            source: TrackingSource.CHAT_PARTICIPANT,
            aiProvider: getIdeAiProvider()
        });
        
        try {
            stream.markdown('# 🔄 AIDA Template Sync\n\n');

            if (!handleSyncTemplates) {
                stream.markdown('❌ **Error:** Sync function not available\n\n');
                return;
            }

            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                stream.markdown('❌ **Error:** No workspace folder found\n\n');
                return;
            }

            const workspaceAidaPath = path.join(workspaceFolder.uri.fsPath, 'AIDA', 'templates');
            const aidaExists = fs.existsSync(workspaceAidaPath);

            if (aidaExists) {
                stream.markdown('📁 **AIDA folder exists** - Syncing new language templates...\n\n');
            } else {
                stream.markdown('🆕 **AIDA folder not found** - Creating complete template structure...\n\n');
            }

            // Use the centralized sync logic from extension.js
            await handleSyncTemplates(context);

            if (aidaExists) {
                stream.markdown('✅ **Template sync completed!** New languages have been added to your AIDA folder.\n\n');
            } else {
                stream.markdown('✅ **AIDA templates created successfully!** Complete template structure is now available.\n\n');
            }

            await displayTemplateSummary(stream, workspaceAidaPath);
            stream.markdown('---\n\n');
            stream.markdown('💡 **Tip:** Use `@review-file`, `@review-changes`, or `@review-all-changes` to start reviewing with templates\n\n');

        } catch (_error: unknown) {
            const error = toError(_error);
            console.error('❌ Error in sync-review-templates:', error);
            stream.markdown(`❌ **Error:** ${error.message}\n\n`);
        }
        
    });

    // participant.iconPath = vscode.Uri.file(path.join(context.extensionPath, 'icons', 'sync-icon.png'));

    aidaLogging('✅ sync-review-templates participant created');
    return { syncTemplatesParticipant };
}

/**
 * Creates complete AIDA template structure in workspace
 * @param {string} sourceTemplatePath - Extension template path
 * @param {string} targetAidaPath - Target AIDA path in workspace
 */
async function createAidaTemplateStructure(sourceTemplatePath: string, targetAidaPath: string) {
    
    
    try {
        // Create AIDA directory structure
        await fs.promises.mkdir(targetAidaPath, { recursive: true });
        
        // Copy all language templates
        const reviewCodePath = path.join(sourceTemplatePath, 'review-code');
        const targetReviewCodePath = path.join(targetAidaPath, 'review-code');
        
        if (fs.existsSync(reviewCodePath)) {
            await copyDirectory(reviewCodePath, targetReviewCodePath);
            aidaLogging('✅ AIDA templates created with all available languages');
        }
    } catch (error: unknown) {
        console.error('Error creating AIDA structure:', error);
        throw error;
    }
}

/**
 * Syncs new language templates from extension to workspace AIDA
 * @param {string} sourceTemplatePath - Extension template path  
 * @param {string} targetAidaPath - Target AIDA path in workspace
 * @returns {object} Sync result with newLanguages array
 */
async function syncNewLanguageTemplates(sourceTemplatePath: string, targetAidaPath: string) {
    
    
    try {
        const sourceLanguagesPath = path.join(sourceTemplatePath, 'review-code', 'languages');
        const targetLanguagesPath = path.join(targetAidaPath, 'review-code', 'languages');
        
        if (fs.existsSync(sourceLanguagesPath)) {
            const sourceLanguages = await fs.promises.readdir(sourceLanguagesPath);
            const targetLanguages = fs.existsSync(targetLanguagesPath) 
                ? await fs.promises.readdir(targetLanguagesPath) 
                : [];
            
            // Find new languages to sync
            const newLanguages = sourceLanguages.filter((lang: string) => !targetLanguages.includes(lang));
            
            if (newLanguages.length > 0) {
                aidaLogging(`🔄 Syncing ${newLanguages.length} new language(s): ${newLanguages.join(', ')}`);
                
                for (const newLang of newLanguages) {
                    const sourceLangPath = path.join(sourceLanguagesPath, newLang);
                    const targetLangPath = path.join(targetLanguagesPath, newLang);
                    await copyDirectory(sourceLangPath, targetLangPath);
                }
                
                aidaLogging('✅ New language templates synced to AIDA');
            }
            
            return { newLanguages };
        }
        
        return { newLanguages: [] };
    } catch (error: unknown) {
        console.error('Error syncing language templates:', error);
        throw error;
    }
}

/**
 * Recursively copy directory
 * @param {string} source - Source directory
 * @param {string} target - Target directory
 */
async function copyDirectory(source: string, target: string) {
    
    
    try {
        await fs.promises.mkdir(target, { recursive: true });
        const entries = await fs.promises.readdir(source, { withFileTypes: true });
        
        for (const entry of entries) {
            const sourcePath = path.join(source, entry.name);
            const targetPath = path.join(target, entry.name);
            
            if (entry.isDirectory()) {
                await copyDirectory(sourcePath, targetPath);
            } else {
                await fs.promises.copyFile(sourcePath, targetPath);
            }
        }
    } catch (error: unknown) {
        console.error(`Error copying directory ${source} to ${target}:`, error);
        throw error;
    }
}

/**
 * Display summary of available templates
 * @param {object} stream - Chat stream
 * @param {string} aidaPath - AIDA templates path
 */
async function displayTemplateSummary(stream: vscode.ChatResponseStream, aidaPath: string) {
    try {
        const languagesPath = path.join(aidaPath, 'review-code', 'languages');
        
        if (fs.existsSync(languagesPath)) {
            
            const languages = await fs.promises.readdir(languagesPath);
            
            stream.markdown('## 📋 Available Templates:\n\n');
            
            if (languages.length > 0) {
                // Group languages by category for better display (based on actual available languages)
                const webLanguages = languages.filter((lang: string) => 
                    ['javascript', 'typescript', 'react', 'vue', 'angular'].includes(lang.toLowerCase())
                );
                const backendLanguages = languages.filter((lang: string) => 
                    ['python', 'csharp', 'go', 'nodejs'].includes(lang.toLowerCase())
                );
                const otherLanguages = languages.filter((lang: string) => 
                    !webLanguages.includes(lang) && !backendLanguages.includes(lang)
                );

                if (webLanguages.length > 0) {
                    stream.markdown('**🌐 Web & Frontend:**\n');
                    webLanguages.forEach((lang: string) => {
                        stream.markdown(`- 📝 ${lang}\n`);
                    });
                    stream.markdown('\n');
                }

                if (backendLanguages.length > 0) {
                    stream.markdown('**⚙️ Backend & Server:**\n');
                    backendLanguages.forEach((lang: string) => {
                        stream.markdown(`- 📝 ${lang}\n`);
                    });
                    stream.markdown('\n');
                }

                if (otherLanguages.length > 0) {
                    stream.markdown('**🔧 Other Languages:**\n');
                    otherLanguages.forEach((lang: string) => {
                        stream.markdown(`- 📝 ${lang}\n`);
                    });
                    stream.markdown('\n');
                }

                stream.markdown(`**Total:** ${languages.length} language templates available\n\n`);
            } else {
                stream.markdown('⚠️ No language templates found\n\n');
            }
        } else {
            stream.markdown('⚠️ Templates directory not found\n\n');
        }
    } catch (error: unknown) {
        console.error('Error displaying template summary:', error);
        stream.markdown('⚠️ Error reading template directory\n\n');
    }
}

// ES exports
export { initializeSyncTemplates, aiSyncReviewTemplates };

/**
 * AI sync review templates for AIDA Chat (reusable function)
 * @param {string} messageWithoutParticipant - Message without @sync-review-templates
 * @param {object} stream - Stream object (mockStream or real stream)
 * @param {object} token - Cancellation token (unused for now)
 * @param {vscode.ExtensionContext} context - Extension context
 */
async function aiSyncReviewTemplates(_messageWithoutParticipant: string, stream: vscode.ChatResponseStream, _token: vscode.CancellationToken, context: vscode.ExtensionContext) {
    aidaLogging('🔄 AI Sync Review Templates called');
    
    if (stream.progress) { stream.progress('Syncing AIDA templates...'); }
    
    try {
        stream.markdown('# 🔄 AIDA Template Sync\n\n');
        stream.markdown('Checking for new review templates...\n\n');

        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            stream.markdown('❌ **Error:** No workspace folder found\n\n');
            return;
        }

        const extensionTemplatesPath = path.join(context.extensionPath, 'templates');
        const workspaceAidaPath = path.join(workspaceFolder.uri.fsPath, 'AIDA', 'templates');

        // Check if extension templates exist
        if (!fs.existsSync(extensionTemplatesPath)) {
            stream.markdown('❌ **Error:** Extension templates not found\n\n');
            return;
        }

        stream.markdown('📁 **Extension templates:** `' + extensionTemplatesPath + '`\n\n');
        stream.markdown('📁 **Workspace AIDA path:** `' + workspaceAidaPath + '`\n\n');

        // Check if workspace AIDA folder exists
        if (!fs.existsSync(workspaceAidaPath)) {
            stream.markdown('🆕 **Creating AIDA folder structure...**\n\n');
            await createAidaTemplateStructure(extensionTemplatesPath, workspaceAidaPath);
            stream.markdown('✅ **AIDA templates created successfully!**\n\n');
            await displayTemplateSummary(stream, workspaceAidaPath);
        } else {
            stream.markdown('📋 **Checking for new languages...**\n\n');
            const syncResult = await syncNewLanguageTemplates(extensionTemplatesPath, workspaceAidaPath);
            
            if (syncResult.newLanguages.length > 0) {
                stream.markdown(`✅ **Synced ${syncResult.newLanguages.length} new language(s):**\n`);
                syncResult.newLanguages.forEach((lang: string) => {
                    stream.markdown(`- 📝 ${lang}\n`);
                });
                stream.markdown('\n');
            } else {
                stream.markdown('✅ **All templates are up to date!**\n\n');
            }
            
            await displayTemplateSummary(stream, workspaceAidaPath);
        }

        stream.markdown('---\n\n');
        stream.markdown('💡 **Tip:** Use `@review-file` or `@review-changes` to start reviewing with templates\n\n');

    } catch (_error: unknown) {
        const error = toError(_error);
        console.error('❌ Error in sync-review-templates:', error);
        stream.markdown(`❌ **Error:** ${error.message}\n\n`);
    }
}
