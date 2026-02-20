const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { executeAIReview, getUnifiedModel, shouldUseApiKey, displayReviewHeader, loadTemplateWithPriority, displayCommonReviewInfo, showReviewOptions } = require('./review-common');
const { autoDetectWorkspace, displayDetectionInfo, getLanguageFromExtension } = require('./language-detection');
const { aidaLogging } = require('../core/settings');
const { buildFileReviewPrompt, getDefaultFileTemplate } = require('../core/prompts');
const { trackEvent } = require('../tracking/usage-tracking');
const { TrackingEvent, AiProvider, TrackingSource } = require('../tracking/tracking-enums');

// Direct imports — no circular dependency through extension.js
const { handleEnterTwiceLogic } = require('../core/shared-state');
const { ensureAidaTemplatesForReview } = require('../core/template-engine');

/**
 * Initialize review-file functionality
 * @param {vscode.ExtensionContext} context
 * @returns {object} - Chat participant and related functions
 */
function initializeReviewFile(context) {
    // Create chat participant for review-file
    const reviewFileParticipant = vscode.chat.createChatParticipant('review-file', async (request, chatContext, stream, token) => {
        try {
            // Track usage - Copilot chat participant
            trackEvent(TrackingEvent.REVIEW_FILE, {
                source: TrackingSource.CHAT_PARTICIPANT,
                aiProvider: AiProvider.GITHUB_COPILOT
            });

            // Ensure AIDA templates exist for review commands (create if not exists)
            if (ensureAidaTemplatesForReview) {
                await ensureAidaTemplatesForReview(context);
            }
            
            aidaLogging('🎯 review-file participant called');
            aidaLogging('📥 Request object:', request);
            aidaLogging('📥 Context object:', context);
            aidaLogging('📥 Request.model:', request.model);
            aidaLogging('📥 Context.selectedModel:', context.selectedModel);
            
            const input = request.prompt.trim();
            
            // Improved loop prevention - only prevent if this is a recursive call from the same participant
            if (chatContext.participant && chatContext.participant.id === 'review-file' && request.prompt.includes('@review-file')) {
                stream.markdown('⚠️ **Loop Prevention**: Recursive call detected\n');
                stream.markdown('💡 **Use direct commands instead**: Review your active file or specify a file path\n');
                return;
            }
            
            // Get target input (file path or active editor)
            const activeEditor = vscode.window.activeTextEditor;
            const targetInput = input || (activeEditor ? activeEditor.document.fileName : null);
            
            // Simple check - only one key! (after targetInput is defined)
            if (global.selectedBusinessDocs) {
                aidaLogging('🎯 Enhanced/Quick File Review detected:', global.selectedBusinessDocs);
                
                // Execute review directly
                await aiReviewFile(targetInput, stream, request.model, context, request);
                return;
            }
            
            // Show review options if we have a target file to review
            if (targetInput) {
                // Show review options using generic function
                const shouldContinue = await showReviewOptions(
                    targetInput, 
                    stream, 
                    {
                        quickCommand: 'aida.confirmReviewDocs', // Reuse same command as review-changes
                        enhancedCommand: 'aida.showEnhancedReviewOptions',
                        reviewType: 'File',
                        chatCommand: 'review-file'
                    },
                    async (useDocuments) => {
                         if (useDocuments) {
                            // TODO: Implement with business documents
                            stream.markdown('🔧 **Business documents integration coming soon...**\n\n');
                        }
                        await aiReviewFile(targetInput, stream, request.model, context, request);
                    }
                );
                
                // If showReviewOptions returns true, it handled everything
                if (shouldContinue) {
                    return;
                }
                // If it returns false, it's showing the options dialog
                if (shouldContinue === false) {
                    return;
                }
            } else {
                stream.markdown('# 🔍 File Review Assistant\n\n');
                stream.markdown('Please provide a file path or open a file to review.\n\n');
                stream.markdown('**Examples:**\n');
                stream.markdown('- `@review-file` - Review current active file\n');
                stream.markdown('- `@review-file src/app/component.ts` - Review specific file\n');
                return;
            }
            
            // Use unified AI review file function (fallback if showReviewOptions doesn't handle)
            await aiReviewFile(targetInput, stream, request.model, context, request);
            
        } catch (error) {
            stream.markdown(`❌ Error: ${error.message}\n\n`);
            stream.markdown('**Fallback:** Please open a file in the editor and try again.\n');
            aidaLogging('Review File error:', error);
        }
    });

    // Set custom icon for chat participant
    reviewFileParticipant.iconPath = vscode.Uri.file(path.join(context.extensionPath, 'icons', 'icon.svg'));

    return {
        reviewFileParticipant,
        aiReviewFile,
        handleActiveFileReview,
        analyzeCodeSection,
        reviewFile,
        performBasicFileAnalysis
    };
}

// Reusable function for AIDA Chatbot integration (similar to review-changes)
async function processReviewFile(input, stream) {
    aidaLogging('🎯 processReviewFile called with input:', input);
    
    // Get target input (file path or active editor)
    const activeEditor = vscode.window.activeTextEditor;
    const targetInput = input || (activeEditor ? activeEditor.document.fileName : null);
    
    // Simple check - only one key! (global variable check)
    if (global.selectedBusinessDocs) {
        aidaLogging('🎯 Enhanced/Quick File Review detected:', global.selectedBusinessDocs);
        
        // Execute review directly
        await aiReviewFile(targetInput, stream, null, null, {
            model: null,
            prompt: input
        });
        return;
    }
    
    // Show review options if we have a target file to review
    if (targetInput) {
        // Show review options using generic function
        const shouldContinue = await showReviewOptions(
            targetInput, 
            stream, 
            {
                quickCommand: 'aida.confirmReviewDocs', // Reuse same command as review-changes
                enhancedCommand: 'aida.showEnhancedReviewOptions',
                reviewType: 'File',
                chatCommand: 'review-file'
            },
            async (useDocuments) => {
                 if (useDocuments) {
                    // TODO: Implement with business documents
                    stream.markdown('🔧 **Business documents integration coming soon...**\n\n');
                }
                await aiReviewFile(targetInput, stream, null, null, {
                    model: null,
                    prompt: input
                });
            }
        );
        
        // If showReviewOptions returns true, it handled everything
        if (shouldContinue) {
            return;
        }
        // If it returns false, it's showing the options dialog
        if (shouldContinue === false) {
            return;
        }
    } else {
        stream.markdown('# 🔍 File Review Assistant\n\n');
        stream.markdown('Please provide a file path or open a file to review.\n\n');
        stream.markdown('**Examples:**\n');
        stream.markdown('- `@review-file` - Review current active file\n');
        stream.markdown('- `@review-file src/app/component.ts` - Review specific file\n');
        return;
    }
    
    // Use unified AI review file function (fallback if showReviewOptions doesn't handle)
    await aiReviewFile(targetInput, stream, null, null, {
        model: null,
        prompt: input
    });
}

// UNIFIED AI REVIEW FILE FUNCTION
async function aiReviewFile(input, stream, selectedModel = null, context = null, request = null) {
    try {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            stream.markdown('❌ **No workspace folder found**\n\n');
            stream.markdown('💡 **Tips:**\n');
            stream.markdown('- Open a folder in VS Code\n');
            stream.markdown('- Or open a file in the editor to review\n');
            return;
        }

        // Get file path from input or current editor
        const targetInfo = getTargetFileInfoForReview(input);
        
        if (!targetInfo.success) {
            stream.markdown(`❌ **${targetInfo.message}**\n\n`);
            stream.markdown('💡 **Tips:**\n');
            stream.markdown('- Open a file in the editor\n');
            stream.markdown('- Provide a specific file path like: `src/app/component.ts`\n');
            return;
        }

        // Perform file content review
        await reviewFile(targetInfo.filePath, stream, selectedModel, context, request);

    } catch (error) {
        stream.markdown(`❌ **Review process failed:** ${error.message}\n\n`);
        stream.markdown('**Fallback options:**\n');
        stream.markdown('- Check if the file exists and is accessible\n');
        stream.markdown('- Ensure VS Code has proper file access\n');
        stream.markdown('- Try opening the file in the editor first\n');
        aidaLogging('AI Review File error:', error);
    }
}

// HELPER: Get target file information for file review
function getTargetFileInfoForReview(input) {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    
    // Check if input contains file path indicators
    const isFilePath = input && (
        input.includes('.ts') || input.includes('.js') || 
        input.includes('.html') || input.includes('.css') || 
        input.includes('/') || input.includes('\\')
    );
    
    if (isFilePath) {
        let cleanPath = input.trim().replace(/^['"](.*)['"]$/, '$1'); // Remove quotes
        
        // Make absolute path if relative
        if (!path.isAbsolute(cleanPath)) {
            cleanPath = path.join(workspaceFolder.uri.fsPath, cleanPath);
        }
        
        // Check if file exists
        if (!fs.existsSync(cleanPath)) {
            return {
                success: false,
                message: `File not found: ${cleanPath}`
            };
        }
        
        return {
            success: true,
            filePath: cleanPath,
            source: 'input'
        };
    }
    
    // Get current editor file
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor) {
        return {
            success: true,
            filePath: activeEditor.document.fileName,
            source: 'editor'
        };
    }
    
    return {
        success: false,
        message: 'No file specified and no active editor found'
    };
}

async function handleActiveFileReview(stream, requestedModel = null, context = null, request = null) {
    try {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) {
            stream.markdown('❌ **No active editor found**\n\n');
            stream.markdown('💡 **Tips:**\n');
            stream.markdown('- Open a file in the editor\n');
            stream.markdown('- Select some code to review a specific section\n');
            stream.markdown('- Or try `@review-changes` to review git changes instead\n');
            return;
        }

        const document = activeEditor.document;
        const selection = activeEditor.selection;
        const isSelection = !selection.isEmpty;
        
        if (isSelection) {
            // For selection review, use simple header and analyze selection
            stream.markdown('# 🔍 Code Selection Review\n\n');
            stream.markdown(`**File:** \`${path.basename(document.fileName)}\`\n`);
            stream.markdown(`**Selected Lines:** ${selection.start.line + 1}-${selection.end.line + 1}\n\n`);
            const selectedText = document.getText(selection);
            
            if (selectedText.trim()) {
                stream.markdown('## 📋 Selected Code\n\n');
                stream.markdown('```' + document.languageId + '\n' + selectedText + '\n```\n\n');
                
                // Analyze the selection with the selected model
                await analyzeCodeSection(selectedText, document.languageId, stream, requestedModel, context);
            } else {
                stream.markdown('⚠️ **Selected text is empty**\n\n');
                stream.markdown('💡 **Tip:** Select some code and try again\n');
            }
        } else {
            // For full file review, use consistent file review function
            await reviewFile(document.fileName, stream, requestedModel, context, request);
        }
        
    } catch (error) {
        stream.markdown(`❌ **Error during file review:** ${error.message}\n\n`);
        stream.markdown('**Fallback suggestions:**\n');
        stream.markdown('- Try refreshing the editor\n');
        stream.markdown('- Save the file and try again\n');
        stream.markdown('- Use `@review-changes` for git diff review instead\n');
        aidaLogging('Active file review error:', error);
    }
}

// Helper function to analyze code sections
async function analyzeCodeSection(code, language, stream, requestedModel = null, context = null) {
    try {
        stream.markdown('## 🔍 Quick Analysis\n\n');
        
        const lines = code.split('\n');
        const nonEmptyLines = lines.filter(line => line.trim());
        
        stream.markdown(`**Lines of code:** ${nonEmptyLines.length}\n`);
        stream.markdown(`**Total lines:** ${lines.length}\n\n`);
        
        // Basic code analysis
        const hasComments = code.includes('//') || code.includes('/*') || code.includes('#');
        const hasTodos = /TODO|FIXME|HACK|XXX/i.test(code);
        const hasConsoleLog = /console\.(log|warn|error)/i.test(code);
        
        if (hasComments) {
            stream.markdown('✅ **Has comments** - Good documentation practice\n');
        } else {
            stream.markdown('⚠️ **No comments found** - Consider adding documentation\n');
        }
        
        if (hasTodos) {
            stream.markdown('⚠️ **TODO/FIXME found** - Review pending items\n');
        }
        
        if (hasConsoleLog) {
            stream.markdown('⚠️ **Console statements found** - Consider removing for production\n');
        }
        
        // Language-specific analysis
        if (language === 'typescript' || language === 'javascript') {
            analyzeTypeScriptCode(code, stream);
        }
        
        // Skip AI analysis for this quick preview function - it's handled by the main review function below
        stream.markdown('\n� **For detailed AI review:** Use the main review function with unified model support\n');
        
    } catch (error) {
        stream.markdown(`⚠️ **Analysis error:** ${error.message}\n`);
    }
}

// TypeScript/JavaScript specific analysis
function analyzeTypeScriptCode(code, stream) {
    const hasTypes = /:\s*(string|number|boolean|void|any|unknown)/i.test(code);
    const hasInterfaces = /interface\s+\w+/i.test(code);
    const hasClasses = /class\s+\w+/i.test(code);
    const hasFunctions = /function\s+\w+|=>\s*{|\w+\s*=\s*\(/i.test(code);
    
    stream.markdown('\n**TypeScript/JavaScript Features:**\n');
    
    if (hasTypes) {
        stream.markdown('✅ **Type annotations found**\n');
    }
    
    if (hasInterfaces) {
        stream.markdown('✅ **Interfaces defined**\n');
    }
    
    if (hasClasses) {
        stream.markdown('✅ **Classes found**\n');
    }
    
    if (hasFunctions) {
        stream.markdown('✅ **Functions/methods found**\n');
    }
}

async function reviewFile(filePath, stream, requestedModel = null, context = null, request = null) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const fileExtension = path.extname(filePath);
        const fileName = path.basename(filePath);
        
        // Auto-detect framework/language from workspace
        let detection = null;
        let templateContent = null;
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (workspaceFolder) {
                detection = await autoDetectWorkspace(workspaceFolder.uri.fsPath, filePath);
                
                // Use common template loading function
                const templateResult = await loadTemplateWithPriority('review-file.md', detection);
                templateContent = templateResult.content;
                
                // Update detection with template source info
                detection.templateSource = templateResult.templateSource;
                detection.templatePath = templateResult.templatePath;
                
                displayDetectionInfo(stream, detection, 'review-file.md');
            }
        } catch (error) {
            aidaLogging('Template detection failed:', error.message);
        }
        
        // Use reusable header display function
        displayCommonReviewInfo(stream, 'File Review', filePath, {
            length: content.length,
            lengthType: 'file'
        });

        // Try to use AI model for comprehensive review
        try {
            let reviewPrompt = '';
            
            // Use auto-detected template (already loaded above)
            try {
                if (!templateContent && detection) {
                    // Fallback template loading if not loaded above
                    const fallbackPath = path.join(global.extensionPath, 'templates', 'review-code', 'fallback', 'review-file.md');
                    if (fs.existsSync(fallbackPath)) {
                        templateContent = fs.readFileSync(fallbackPath, 'utf8');
                    }
                }
                
                if (!templateContent) {
                    templateContent = getDefaultFileTemplate(fileExtension);
                }
                
                aidaLogging(`✅ Using ${detection?.detected || 'fallback'} template (${templateContent.length} characters)`);
                
                reviewPrompt = buildFileReviewPrompt(templateContent, { fileName, filePath, fileExtension, content }, detection);

            } catch (templateError) {
                stream.markdown('⚠️ **Template not found** - using basic review\n\n');
                aidaLogging(`⚠️ Template loading failed: ${templateError.message}`);
                reviewPrompt = buildFileReviewPrompt(null, { fileName, filePath, fileExtension, content });
            }

            // Use unified model detection
            const model = await getUnifiedModel(stream, requestedModel, context, request);
            
            if (model) {
                // Animated loading
                stream.markdown('🔄 **Initializing File Analysis...** \n\n');
                stream.markdown('⏳ **Preparing model:** `' + model.family + '`\n\n');

                stream.markdown('🚀 **Starting comprehensive file review...**\n\n');
                
                // Use the unified AI execution function
                const success = await executeAIReview(reviewPrompt, model, stream, 'File');
                
                if (!success) {
                    // AI analysis failed, falling back to basic analysis
                    stream.markdown('⚠️ **AI analysis failed - using basic analysis**\n\n');
                    await performBasicFileAnalysis(content, stream, fileExtension);
                }
            } else {
                // Check if API key mode is enabled
                if (shouldUseApiKey()) {
                    // Try to use API key mode
                    try {
                        const success = await executeAIReview(reviewPrompt, null, stream, 'File');
                        if (success) {
                            return; // Successfully completed with API key
                        }
                    } catch (apiError) {
                        stream.markdown(`⚠️ **API key mode failed:** ${apiError.message}\n\n`);
                        stream.markdown('🔄 **Falling back to basic analysis...**\n\n');
                    }
                } else {
                    stream.markdown('⚠️ **AI model not available - using basic analysis**\n\n');
                    stream.markdown('💡 **Tip:** Install GitHub Copilot or configure API key mode in settings\n\n');
                }
                await performBasicFileAnalysis(content, stream, fileExtension);
            }
            
        } catch (aiError) {
            stream.markdown(`⚠️ **AI analysis failed:** ${aiError.message}\n\n`);
            stream.markdown('🔄 **Falling back to basic analysis...**\n\n');
            await performBasicFileAnalysis(content, stream, fileExtension);
        }

    } catch (error) {
        stream.markdown(`❌ Error reading file: ${error.message}`);
    }
}

async function performBasicFileAnalysis(content, stream, fileExtension) {
    // Basic code analysis for current content
    const lines = content.split('\n');
    const analysis = {
        totalLines: lines.length,
        codeLines: lines.filter(line => line.trim() && !line.trim().startsWith('//')).length,
        commentLines: lines.filter(line => line.trim().startsWith('//')).length,
        issues: []
    };

    // Simple code quality checks
    lines.forEach((line, index) => {
        const lineNum = index + 1;
        if (line.includes(': any') && !line.includes('// @ts-ignore')) {
            analysis.issues.push(`⚠️ Line ${lineNum}: TypeScript 'any' type - consider proper typing`);
        }
        if (line.includes('aidaLogging') || line.includes('console.error')) {
            analysis.issues.push(`🔍 Line ${lineNum}: Console statement - remove for production`);
        }
        if (line.length > 120) {
            analysis.issues.push(`📏 Line ${lineNum}: Line too long (${line.length} chars)`);
        }
    });

    stream.markdown('### 📊 File Statistics\n\n');
    stream.markdown(`- **Total lines:** ${analysis.totalLines}\n`);
    stream.markdown(`- **Code lines:** ${analysis.codeLines}\n`);
    stream.markdown(`- **Comment lines:** ${analysis.commentLines}\n\n`);

    if (analysis.issues.length > 0) {
        stream.markdown('### ⚠️ Issues Found\n\n');
        analysis.issues.forEach(issue => stream.markdown(`- ${issue}\n`));
    } else {
        stream.markdown('### ✅ No obvious issues detected\n\n');
    }

    // Show file content (truncated)
    stream.markdown('### 📝 File Content (Preview)\n\n');
    const language = getLanguageFromExtension(fileExtension);
    const preview = content.length > 2000 ? content.substring(0, 2000) + '\n... (truncated)' : content;
    stream.markdown(`\`\`\`${language}\n${preview}\n\`\`\`\n\n`);
}

module.exports = {
    initializeReviewFile,
    aiReviewFile,
    handleActiveFileReview,
    analyzeCodeSection,
    reviewFile,
    performBasicFileAnalysis,
    getTargetFileInfoForReview,
    processReviewFile
};
