import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { executeAIReview, getUnifiedModel, getChecklistStatusIcon, shouldUseApiKey, loadTemplateWithPriority, displayCommonReviewInfo, getBusinessDocumentFolders, showReviewOptions } from './review-common';
import { autoDetectWorkspace, displayDetectionInfo } from './language-detection';
import { aidaLogging } from '../core/settings';
import { buildChangesReviewPrompt } from '../core/prompts';
import { trackEvent } from '../tracking/usage-tracking';
import { TrackingEvent, TrackingSource, ReviewMode, getReviewMode, getIdeAiProvider } from '../tracking/tracking-enums';

// Direct imports — no circular dependency through extension.js
// import { chatSessions, handleEnterTwiceLogic } from '../core/shared-state';
import { ensureAidaTemplatesForReview } from '../core/template-engine';
import { toError } from '../core/error-utils';

/**
 * Initialize review-changes functionality
 * @param {vscode.ExtensionContext} context
 * @returns {object} - Chat participant and related functions
 */
function initializeReviewChanges(context: vscode.ExtensionContext) {
    // Create chat participant for review-changes
    const reviewChangesParticipant = vscode.chat.createChatParticipant('review-changes', async (request, _chatContext, stream, _token) => {
        try {
            // Ensure AIDA templates exist for review commands (create if not exists)
            if (ensureAidaTemplatesForReview) {
                await ensureAidaTemplatesForReview(context);
            }

            // Tracking moved to processReviewChanges — fires once when review actually executes
            // (after user picks Quick/Enhanced, or auto-Quick when no business docs exist)
            
            const activeEditor = vscode.window.activeTextEditor;
            const input = request.prompt.trim();
            const targetInput = input || (activeEditor ? activeEditor.document.fileName : null);
            
            // Use reusable review changes logic (for AIDA Chatbot reuse)
            await processReviewChanges(targetInput, stream, context, request, {
                source: TrackingSource.CHAT_PARTICIPANT,
                aiProvider: getIdeAiProvider()
            });
            
        } catch (_error: unknown) {
            const error = toError(_error);
            stream.markdown(`❌ Error: ${error.message}\n\n`);
            stream.markdown('**Fallback:** Try running a git status check first, or specify a file path to review.\n');
            aidaLogging('Review Changes error:', error);
        }
    });

    // Set custom icon for chat participant
    reviewChangesParticipant.iconPath = vscode.Uri.file(path.join(context.extensionPath, 'icons', 'icon.svg'));

    return {
        reviewChangesParticipant,
        aiReviewChanges,
        processReviewChanges // Export for AIDA Chatbot reuse
    };
}

/**
 * Process review changes logic - Reusable for AIDA Chatbot
 * @param {string} targetInput - File path or null for auto-detection
 * @param {object} stream - Chat stream
 * @param {object} context - Extension context
 * @param {object} request - Chat request object
 * @param {object} trackingMeta - Tracking source metadata (source + aiProvider). Defaults to Copilot chat.
 */
async function processReviewChanges(
    targetInput: string | null,
    stream: vscode.ChatResponseStream,
    context: vscode.ExtensionContext | null = null,
    request: vscode.ChatRequest | null = null,
    trackingMeta: { source: string; aiProvider: string } = { source: TrackingSource.CHAT_PARTICIPANT, aiProvider: getIdeAiProvider() }
) {
    try {
        // Simple check - only one key! (after targetInput is defined)
        if (global.selectedBusinessDocs) {
            aidaLogging('🎯 Enhanced/Quick Changes Review detected:', global.selectedBusinessDocs);

            // ── Track once — user committed to a review mode ──
            void trackEvent(TrackingEvent.REVIEW_CHANGES, {
                source: trackingMeta.source,
                aiProvider: trackingMeta.aiProvider,
                reviewMode: getReviewMode()
            });

            // Execute review and cleanup
            await aiReviewChanges(targetInput, stream, null, context, request);
            return;
        }
        
        // Show review options if we have a target file to review
        if (targetInput) {
            // Show review options using generic function
            const shouldContinue = await showReviewOptions(
                targetInput, 
                stream, 
                {
                    quickCommand: 'aida.confirmReviewDocs',
                    enhancedCommand: 'aida.showEnhancedReviewOptions',
                    reviewType: 'Changes',
                    chatCommand: 'review-changes'
                },
                async (useDocuments: boolean) => {
                     if (useDocuments) {
                        // TODO: Implement with business documents
                        stream.markdown('🔧 **Business documents integration coming soon...**\n\n');
                    }

                    // ── Track once — auto Quick (no business docs in workspace) ──
                    void trackEvent(TrackingEvent.REVIEW_CHANGES, {
                        source: trackingMeta.source,
                        aiProvider: trackingMeta.aiProvider,
                        reviewMode: ReviewMode.QUICK
                    });

                    await aiReviewChanges(targetInput, stream, null, context, request);
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
            stream.markdown('# 🔍 Code Review Assistant\n\n');
            stream.markdown('Please provide a file path or open a file to review.\n\n');
            stream.markdown('**Examples:**\n');
            stream.markdown('- `@review-changes` - Review current git changes\n');
            stream.markdown('- `@review-changes src/app/component.ts` - Review specific file\n');
            return;
        }
        
        // Use unified AI review changes function (this should not be reached if callback was used)
        await aiReviewChanges(targetInput, stream, null, context, request);
        
    } catch (_error: unknown) {
        const error = toError(_error);
        stream.markdown(`❌ **Review processing failed:** ${error.message}\n\n`);
        aidaLogging('Process Review Changes error:', error);
    }
}

// HELPER: Get target file information from input
function getTargetFileInfo(input: string | { fsPath: string } | null) {
    // Handle VS Code URI object (from Source Control context menu)
    if (input && typeof input === 'object' && input.fsPath) {
        return {
            type: 'file',
            path: input.fsPath,
            source: 'uri'
        };
    }
    
    // Handle string input (file path)
    if (typeof input === 'string') {
        // Check if input contains file path indicators
        const isFilePath = input && (
            input.includes('.ts') || input.includes('.js') || 
            input.includes('.html') || input.includes('.css') || 
            input.includes('/') || input.includes('\\')
        );
        
        if (isFilePath) {
            aidaLogging('🐛 DEBUG - String file path detected:', input);
            return {
                type: 'file',
                path: input.trim(),
                source: 'input'
            };
        }
    }
    
    // Get current editor file as fallback
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor) {
        aidaLogging('🐛 DEBUG - Using active editor:', activeEditor.document.fileName);
        return {
            type: 'file',
            path: activeEditor.document.fileName,
            source: 'editor'
        };
    }
    
    aidaLogging('🐛 DEBUG - No file detected, using workspace');
    return {
        type: 'workspace',
        path: null,
        source: 'workspace'
    };
}

// HELPER: Get git diff for target
async function getGitDiffForTarget(targetInfo: { type: string; path: string | null; source: string }, workspaceFolder: vscode.WorkspaceFolder) {
    try {
        if (targetInfo.type === 'file' && targetInfo.path) {
            // Get diff for specific file
            let cleanPath = targetInfo.path.replace(/^['"](.*)['"]$/, '$1'); // Remove quotes
            
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
            
            // Get git diff for specific file
            let gitDiff = execSync(`git diff HEAD -- "${cleanPath}"`, { 
                cwd: workspaceFolder.uri.fsPath,
                encoding: 'utf8' 
            });
            
            if (!gitDiff.trim()) {
                // Try staged changes
                gitDiff = execSync(`git diff --staged -- "${cleanPath}"`, { 
                    cwd: workspaceFolder.uri.fsPath,
                    encoding: 'utf8' 
                });
                
                if (gitDiff.trim()) {
                    return {
                        success: true,
                        diff: gitDiff,
                        changeType: 'Staged Changes',
                        filePath: cleanPath
                    };
                }
                
                return {
                    success: false,
                    message: `No changes found for file: ${path.basename(cleanPath)}`
                };
            }
            
            return {
                success: true,
                diff: gitDiff,
                changeType: 'Current Changes',
                filePath: cleanPath
            };
        }
        
        // Get workspace-wide diff
        let gitDiff = execSync('git diff HEAD', { 
            cwd: workspaceFolder.uri.fsPath,
            encoding: 'utf8' 
        });
        
        if (!gitDiff.trim()) {
            // Try staged changes
            gitDiff = execSync('git diff --staged', { 
                cwd: workspaceFolder.uri.fsPath,
                encoding: 'utf8' 
            });
            
            if (gitDiff.trim()) {
                return {
                    success: true,
                    diff: gitDiff,
                    changeType: 'Staged Changes'
                };
            }
            
            return {
                success: false,
                message: 'No git changes found - workspace is clean'
            };
        }
        
        return {
            success: true,
            diff: gitDiff,
            changeType: 'Current Changes'
        };
        
    } catch (_gitError: unknown) {
        const gitError = toError(_gitError);
        return {
            success: false,
            message: `Git command failed: ${gitError.message}`
        };
    }
}

// HELPER: Handle scenario when no changes found
async function handleNoChangesScenario(stream: vscode.ChatResponseStream, _selectedModel: vscode.LanguageModelChat | null, _context: vscode.ExtensionContext | null, message: string, requestedFilePath: string | null = null) {
    stream.markdown(`✅ **${message}**\n\n`);
    
    // Try to offer review of the originally requested file if available
    let targetFilePath = null;
    let fileName = null;
    
    if (requestedFilePath) {
        // Use the requested file path
        targetFilePath = requestedFilePath;
        fileName = path.basename(requestedFilePath);
        
        aidaLogging('🐛 DEBUG - Using requested file:', fileName);
        
        stream.markdown(`💡 **Would you like to review the requested file?**\n`);
        stream.markdown(`📂 **Requested file:** \`${fileName}\`\n\n`);
        
        // Create button for confirming file review
        stream.button({
            command: 'aida.confirmReviewDocs',
            title: `✅ Yes, review file ${fileName}`,
            arguments: [targetFilePath, 'review-file']
        });
    } else {
        // Fallback to active file if no requested file
        aidaLogging('🐛 DEBUG - No requestedFilePath, falling back to active editor');
        
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor) {
            targetFilePath = activeEditor.document.fileName;
            fileName = path.basename(activeEditor.document.fileName);
            
            aidaLogging('🐛 DEBUG - Using active file:', fileName);
            
            stream.markdown(`💡 **Would you like to review the active file?**\n`);
            stream.markdown(`📂 **Current file:** \`${fileName}\`\n\n`);
            
            // Create button for confirming file review
            stream.button({
                command: 'aida.confirmReviewDocs',
                title: `✅ Yes, review file ${fileName}`,
                arguments: [targetFilePath, 'review-file', true]
            });
        }
    }
    
    if (targetFilePath) {
        
        stream.markdown('\n');
        
        stream.button({
            command: 'aida.showFileHelp',
            title: '❌ No, show help instead',
            arguments: []
        });
        
        stream.markdown('\n\n');
        stream.markdown(`**Question:** Do you want to review the file \`${fileName}\`?\n\n`);
        stream.markdown('💡 **Tip:** You can also type `@review-file` to review the active file\n');
    } else {
        stream.markdown('💡 **Tips to get started:**\n');
        stream.markdown('- Make some code changes and try again\n');
        stream.markdown('- Open a file and use `@review-file`\n');
        stream.markdown('- Use `@review-changes workspace` for full workspace review\n');
    }
}

// UNIFIED AI REVIEW CHANGES FUNCTION
async function aiReviewChanges(input: string | null, stream: vscode.ChatResponseStream, selectedModel: vscode.LanguageModelChat | null = null, context: vscode.ExtensionContext | null = null, request: vscode.ChatRequest | null = null) {
    try {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            stream.markdown('❌ **No workspace folder found**\n\n');
            stream.markdown('💡 **Tips:**\n');
            stream.markdown('- Open a folder in VS Code\n');
            stream.markdown('- Or try `@review-file` to review the active file instead\n');
            return;
        }

        // Get file path from input or current editor
        const targetInfo = getTargetFileInfo(input);
        
        // Get git diff for the target
        const diffResult = await getGitDiffForTarget(targetInfo, workspaceFolder);
        
        if (!diffResult.success) {
            // Handle no changes scenario - pass the requested file path
            await handleNoChangesScenario(stream, selectedModel, context, diffResult.message!, targetInfo.path);
            return;
        }

        // Always use the modern review approach
        await reviewChanges(diffResult.diff!, stream, diffResult.changeType!, selectedModel, context, request, diffResult.filePath ?? null, workspaceFolder.uri.fsPath);

    } catch (_error: unknown) {
        const error = toError(_error);
        stream.markdown(`❌ **Review process failed:** ${error.message}\n\n`);
        stream.markdown('**Fallback options:**\n');
        stream.markdown('- Try `@review-file` for active file review\n');
        stream.markdown('- Check if VS Code has proper workspace access\n');
        stream.markdown('- Restart VS Code if issues persist\n');
        aidaLogging('AI Review Changes error:', error);
    } 
}

// SIMPLIFIED: Direct template-based approach without command conflicts
async function reviewChanges(diffContent: string, stream: vscode.ChatResponseStream, changeType: string, selectedModel: vscode.LanguageModelChat | null = null, context: vscode.ExtensionContext | null = null, request: vscode.ChatRequest | null = null, filePath: string | null = null, _workspaceFolder: string | null = null) {
    
    let templateContent = null;
    
    try {
        // Auto-detect framework/language from workspace
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        const detection = await autoDetectWorkspace(workspaceFolder!.uri.fsPath, filePath);
        
        aidaLogging(`🎯 Detection result: "${detection.detected}" (type: ${detection.type})`);
        
        // Use common template loading function
        const templateResult = await loadTemplateWithPriority('review-changes.md', detection);
        templateContent = templateResult.content;
        
        // Update detection with template source info
        detection.templateSource = templateResult.templateSource;
        detection.templatePath = templateResult.templatePath;
        
        // Display detection information
        displayDetectionInfo(stream, detection, 'review-changes.md');
        
        // Display review header if workspace folder is provided
        if (workspaceFolder) {
            const displayPath = filePath ? path.relative(workspaceFolder.uri.fsPath, filePath) : changeType;
            displayCommonReviewInfo(stream, 'Changes Review', displayPath, {
                length: diffContent.length,
                lengthType: 'diff'
            });
        }
        
        // Verify template doesn't have old git diff placeholder
        if (templateContent.includes('# Paste git diff here')) {
            aidaLogging('⚠️ Template contains old git diff placeholder - will be handled in code');
        }
        
    } catch (_error: unknown) {
        const error = toError(_error);
        stream.markdown('❌ **Error**: Could not load review template\n');
        stream.markdown(`Error: ${error.message}\n`);
        // Fallback to basic review
        await reviewDiffWithChecklist(diffContent, stream, changeType, filePath);
        return;
    }
    
    // Safety check: ensure templateContent is available
    if (!templateContent) {
        stream.markdown('❌ **Error**: Template content not available\n');
        await reviewDiffWithChecklist(diffContent, stream, changeType, filePath);
        return;
    }
    
    // Inject git diff into template at the appropriate location
    const finalContent = buildChangesReviewPrompt(templateContent, diffContent);
    
    try {
        // Use unified model detection (same as review-file)
        const model = await getUnifiedModel(stream, selectedModel, context, request);
        
        if (!model) {
            // Check if this is API key mode before showing error
            if (shouldUseApiKey()) {
                // API key mode - executeAIReview will handle it
                aidaLogging('🔑 API key mode enabled - model is null as expected');
            } else {
                stream.markdown('❌ **AI models not available** - falling back to template display\n\n');
                throw new Error('No AI models available');
            }
        }
            
        // Use the unified AI execution function
        const success = await executeAIReview(finalContent, model, stream, 'Changes');
        if (!success) {
            // Model not available, review was stopped
            return;
        }
        
    } catch (_error: unknown) {
        const error = toError(_error);
        // Safe fallback without command triggers
        stream.markdown('⚠️ **AI processing failed. Showing template for manual review:**\n\n');
        stream.markdown('```markdown\n');
        stream.markdown(finalContent);
        stream.markdown('\n```\n\n');
        stream.markdown(`**Error details:** ${error.message}\n\n`);
        stream.markdown('💡 **Manual review:** Use the template above to analyze the changes\n');
    }
}

async function reviewDiffWithChecklist(diffContent: string, stream: vscode.ChatResponseStream, _changeType: string, filePath: string | null = null) {
    // Analyze the diff using structured review checklist
    const analysis = analyzeGitDiffStructured(diffContent);
    
    // 1. Summary (as per instruction format) 
    const fileInfo = filePath ? `for file: ${path.basename(filePath)}` : '';
    stream.markdown('### 📋 Summary\n\n');
    stream.markdown(`**Overall Impact:** Changes ${fileInfo} affect ${analysis.filesChanged.size} file(s) with ${analysis.linesAdded} additions and ${analysis.linesRemoved} deletions.\n\n`);
    
    if (analysis.checklist.correctness.issues.some(issue => issue.includes('CRITICAL'))) {
        stream.markdown('🚨 **CRITICAL ISSUES DETECTED** - Immediate attention required!\n\n');
    }

    // 2. Inline-style comments (file + line reference as per instruction)
    stream.markdown('### 💬 Inline-style Comments\n\n');
    
    let hasInlineComments = false;
    
    // Check each checklist category and format as inline comments
    (Object.entries(analysis.checklist) as [string, any][]).forEach(([_category, check]) => {
        if (check.issues.length > 0) {
            check.issues.forEach((issue: string) => {
                hasInlineComments = true;
                stream.markdown(`${issue}\n\n`);
            });
        }
    });
    
    if (!hasInlineComments) {
        stream.markdown('✅ No specific issues found in the changed code.\n\n');
    }

    // 3. Review Checklist Results (following instruction format)
    stream.markdown('### 📋 Review Checklist (From Instructions)\n\n');
    
    const checklistMap = {
        'correctness': '1. **Correctness** - Does the new/modified code work as intended? Any logical errors or regressions?',
        'bestPractices': '2. **Best Practices** - Follow Angular + TypeScript coding guidelines, proper component/service usage',
        'performance': '3. **Performance** - Look for inefficient patterns, change detection strategy, subscriptions cleanup',
        'security': '4. **Security** - Identify unsafe DOM access, bypassSecurityTrust, missing input validation',
        'maintainability': '5. **Maintainability** - Avoid duplication, unnecessary complexity, consistent naming',
        'testing': '6. **Testing** - Suggest new unit/e2e tests needed for the new logic'
    };

    (Object.entries(checklistMap) as [string, any][]).forEach(([key, description]) => {
        const check = (analysis.checklist as any)[key];
        const statusIcon = getChecklistStatusIcon(check.status);
        
        stream.markdown(`${statusIcon} ${description}\n\n`);
        
        if (check.suggestions.length > 0) {
            stream.markdown('**Suggestions:**\n');
            check.suggestions.forEach((suggestion: string) => {
                stream.markdown(`- ${suggestion}\n`);
            });
            stream.markdown('\n');
        }
    });

    // 4. Next Steps (as per instruction output format)
    stream.markdown('### 🎯 Next Steps\n\n');
    
    const hasIssues = (Object.values(analysis.checklist) as any[]).some(check => check.issues.length > 0);
    const hasCriticalIssues = (Object.values(analysis.checklist) as any[]).some(check => 
        check.issues.some((issue: string) => issue.includes('CRITICAL'))
    );
    
    if (hasCriticalIssues) {
        stream.markdown('- 🚨 **URGENT**: Fix critical issues identified above\n');
        stream.markdown('- 🔍 **Verify functionality**: Test the affected features thoroughly\n');
    }
    
    if (hasIssues) {
        stream.markdown('- 🔧 **Fix identified issues** before proceeding\n');
        stream.markdown('- 🧪 **Add/update unit tests** for modified functionality\n');
        stream.markdown('- ✅ **Run linting and formatting checks**\n');
    } else {
        stream.markdown('- ✅ **Code review passed** - no major issues detected\n');
        stream.markdown('- 🧪 **Ensure tests cover changes** if applicable\n');
        stream.markdown('- 📚 **Update documentation** if public API changed\n');
    }
    
    stream.markdown('- 🌐 **Test in development environment**\n');

    // 5. Code Diff (as per instruction format) - REMOVED to match Copilot behavior
    // stream.markdown('\n### 📝 Code Diff\n\n');
    // stream.markdown('<details><summary>🔍 Click to view detailed diff</summary>\n\n');
    // stream.markdown('```diff\n' + diffContent + '\n```\n\n');
    // stream.markdown('</details>\n\n');

    // Success message
    stream.markdown('---\n\n');
    stream.markdown('✅ **Instruction-Based Review Complete!**\n');
    stream.markdown('💡 **Analysis based on code-review.md template structure**\n');
}

// Structured analysis based on code-review.md checklist
function analyzeGitDiffStructured(diffContent: string) {
    const analysis = {
        filesChanged: new Set<string>(),
        linesAdded: 0,
        linesRemoved: 0,
        summary: '',
        checklist: {
            correctness: { status: 'unknown', issues: [] as any[], suggestions: [] as any[] },
            bestPractices: { status: 'unknown', issues: [] as any[], suggestions: [] as any[] },
            performance: { status: 'unknown', issues: [] as any[], suggestions: [] as any[] },
            security: { status: 'unknown', issues: [] as any[], suggestions: [] as any[] },
            maintainability: { status: 'unknown', issues: [] as any[], suggestions: [] as any[] },
            testing: { status: 'unknown', issues: [] as any[], suggestions: [] as any[] }
        },
        inlineComments: [] as any[],
        nextSteps: [] as any[]
    };

    const lines = diffContent.split('\n');
    let currentFile = '';
    let currentLineNumber = 0;
    
    lines.forEach((line, _index) => {
        // Track files
        if (line.startsWith('diff --git')) {
            const match = line.match(/b\/(.*)/);
            if (match) {
                currentFile = match[1] ?? '';
                analysis.filesChanged.add(currentFile);
            }
        }

        // Track line numbers
        if (line.startsWith('@@')) {
            const lineMatch = line.match(/@@ -\d+,?\d* \+(\d+),?\d* @@/);
            if (lineMatch) {
                currentLineNumber = parseInt(lineMatch[1]!);
            }
        }
        
        // Analyze added lines
        if (line.startsWith('+') && !line.startsWith('+++')) {
            analysis.linesAdded++;
            currentLineNumber++;
            analyzeLineForChecklist(line, currentFile as any, currentLineNumber, analysis);
        }
        
        // Analyze removed lines  
        if (line.startsWith('-') && !line.startsWith('---')) {
            analysis.linesRemoved++;
            analyzeRemovedLineForChecklist(line, currentFile as any, currentLineNumber, analysis);
        }

        // Track line numbers for context lines
        if (!line.startsWith('+') && !line.startsWith('-') && !line.startsWith('@@') && !line.startsWith('diff')) {
            currentLineNumber++;
        }
    });

    // Generate summary
    analysis.summary = generateChangeSummary(analysis);
    
    // Set checklist statuses
    updateChecklistStatuses(analysis);

    return analysis;
}

function analyzeLineForChecklist(line: string, file: string, lineNumber: number, analysis: Record<string, any>) {
    const content = line.substring(1).trim();
    const fileExt = file.split('.').pop();
    
    // 1. CORRECTNESS checks
    if (content.includes('getBillings') && line.startsWith('- ')) {
        analysis.checklist.correctness.issues.push(
            `❌ **${file}:${lineNumber}** - Critical function call removed: \`getBillings()\`. This will break data loading functionality.`
        );
        analysis.inlineComments.push(
            `**${file}:${lineNumber}** - REGRESSION: Removing \`getBillings()\` will prevent data refresh on user interactions.`
        );
        analysis.nextSteps.push('🚨 URGENT: Restore \`getBillings()\` calls in customer/status change handlers');
    }

    // 2. BEST PRACTICES checks
    if (content.includes(': any') && !content.includes('// @ts-ignore')) {
        analysis.checklist.bestPractices.issues.push(
            `⚠️ **${file}:${lineNumber}** - TypeScript \`any\` type detected. Use specific types for better type safety.`
        );
        analysis.checklist.bestPractices.suggestions.push(
            'Define proper interfaces/types instead of using \`any\`'
        );
    }

    if (content.includes('aidaLogging') || content.includes('console.error')) {
        analysis.checklist.bestPractices.issues.push(
            `🔍 **${file}:${lineNumber}** - Console statement found. Remove for production code.`
        );
    }

    // Angular specific checks
    if (fileExt === 'ts' && content.includes('subscribe') && !content.includes('unsubscribe')) {
        analysis.checklist.bestPractices.issues.push(
            `🔄 **${file}:${lineNumber}** - Observable subscription without unsubscription. May cause memory leaks.`
        );
        analysis.checklist.bestPractices.suggestions.push(
            'Implement OnDestroy and unsubscribe in ngOnDestroy'
        );
    }

    // 3. PERFORMANCE checks
    if (content.includes('for (') && content.includes('.length')) {
        analysis.checklist.performance.issues.push(
            `⚡ **${file}:${lineNumber}** - Consider caching array length in loop for better performance.`
        );
    }

    if (content.includes('*ngFor') && content.includes('function')) {
        analysis.checklist.performance.issues.push(
            `⚡ **${file}:${lineNumber}** - Function call in \`*ngFor\` can impact performance. Use pipe or memoization.`
        );
    }

    // 4. SECURITY checks
    if (content.includes('innerHTML =') || content.includes('eval(')) {
        analysis.checklist.security.issues.push(
            `🛡️ **${file}:${lineNumber}** - Potential XSS vulnerability. Avoid \`innerHTML\` or \`eval()\`.`
        );
        analysis.nextSteps.push('🔒 Security review required for DOM manipulation');
    }

    if (content.includes('bypassSecurityTrust')) {
        analysis.checklist.security.issues.push(
            `🛡️ **${file}:${lineNumber}** - Security bypass detected. Ensure input is properly sanitized.`
        );
    }

    // 5. MAINTAINABILITY checks
    if (content.length > 120) {
        analysis.checklist.maintainability.issues.push(
            `📏 **${file}:${lineNumber}** - Line too long (${content.length} chars). Consider breaking up.`
        );
    }

    if (content.match(/\d+\.\d+/) && !content.includes('version') && !content.includes('px')) {
        analysis.checklist.maintainability.issues.push(
            `💡 **${file}:${lineNumber}** - Magic number detected. Consider using named constants.`
        );
        analysis.checklist.maintainability.suggestions.push(
            'Extract magic numbers to constants or configuration'
        );
    }

    // 6. TESTING checks
    if (content.includes('async ') || content.includes('Observable') || content.includes('Promise')) {
        analysis.checklist.testing.suggestions.push(
            `Add unit tests for async operations in ${file}`
        );
    }

    if (content.includes('export class') || content.includes('export function')) {
        analysis.checklist.testing.suggestions.push(
            `Ensure ${file} has corresponding test file`
        );
    }
}

function analyzeRemovedLineForChecklist(line: string, file: string, lineNumber: number, analysis: Record<string, any>) {
    const content = line.substring(1).trim();
    
    // Check for removed functionality
    if (content.includes('getBillings') || content.includes('loadData') || content.includes('refresh')) {
        analysis.checklist.correctness.issues.push(
            `🚨 **${file}:${lineNumber}** - CRITICAL: Data loading functionality removed. Verify this is intentional.`
        );
    }

    if (content.includes('error') || content.includes('catch') || content.includes('try')) {
        analysis.checklist.correctness.issues.push(
            `⚠️ **${file}:${lineNumber}** - Error handling removed. Ensure proper error management.`
        );
    }
}

function generateChangeSummary(analysis: Record<string, any>) {
    const fileCount = analysis.filesChanged.size;
    const totalChanges = analysis.linesAdded + analysis.linesRemoved;
    
    let summary = `Changes affect ${fileCount} file(s) with ${analysis.linesAdded} additions and ${analysis.linesRemoved} deletions. `;
    
    // Detect change patterns
    const hasRemovals = analysis.linesRemoved > analysis.linesAdded;
    const hasCriticalIssues = analysis.checklist.correctness.issues.some((issue: string) => issue.includes('CRITICAL'));
    
    if (hasCriticalIssues) {
        summary += 'CRITICAL ISSUES DETECTED - immediate attention required. ';
    }
    
    if (hasRemovals) {
        summary += 'Primarily removes existing functionality - verify intentional. ';
    }
    
    if (totalChanges > 100) {
        summary += 'Large changeset - consider breaking into smaller commits.';
    } else {
        summary += 'Moderate changeset size.';
    }
    
    return summary;
}

function updateChecklistStatuses(analysis: Record<string, any>) {
    Object.keys(analysis.checklist).forEach(category => {
        const check = analysis.checklist[category];
        if (check.issues.length > 0) {
            check.status = check.issues.some((issue: string) => issue.includes('CRITICAL') || issue.includes('🚨')) ? 'critical' : 'warning';
        } else if (check.suggestions.length > 0) {
            check.status = 'suggestion';
        } else {
            check.status = 'ok';
        }
    });
}

// HELPER: Show Enhanced Review options with business documents
async function showEnhancedReviewOptions(_participantType: string, activeEditor: vscode.TextEditor, stream: vscode.ChatResponseStream, _context: Record<string, unknown>) {
    const fileName = path.basename(activeEditor.document.fileName);
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    
    if (!workspaceFolder) {
        stream.markdown('❌ **No workspace found for business documents**\n\n');
        return false;
    }
    
    // Get business document folders
    const businessDocs = await getBusinessDocumentFolders(workspaceFolder.uri.fsPath);
    
    if (businessDocs.length === 0) {
        stream.markdown('⚠️ **No business-docs folders found**\n\n');
        stream.markdown('Creating fallback to Quick Review...\n\n');
        // Fallback to quick review
        stream.button({
            command: 'aida.confirmReviewDocs',
            title: '🚀 Proceed with Quick Review',
            arguments: [activeEditor.document.fileName]
        });
        return false;
    }
    
    const emoji = '📚';
    stream.markdown(`# ${emoji} Enhanced Review for \`${fileName}\`\n\n`);
    stream.markdown('**Select business documentation categories to include:**\n\n');
    
    // Show available categories as buttons
    businessDocs.forEach(folder => {
        stream.markdown(`### 📁 **${folder.displayName}**\n`);
        
        // Try to get description from folder content
        const description = getBusinessDocDescription(folder.name);
        stream.markdown(`${description}\n\n`);
        
        stream.button({
            command: 'aida.reviewWithTechnicalDoc',
            title: `📚 Include ${folder.displayName}`,
            arguments: [activeEditor.document.fileName, folder.name, folder.displayName]
        });
        
        stream.markdown('\n');
    });
    
    stream.markdown('---\n\n');
    
    // Multiple selection options
    stream.markdown('**Bulk Actions:**\n\n');
    
    stream.button({
        command: 'aida.reviewWithAllTechnicalDocs',
        title: '☑️ Include All Categories',
        arguments: [activeEditor.document.fileName, businessDocs.map(f => f.name)]
    });
    
    stream.markdown(' ');
    
    stream.button({
        command: 'aida.confirmReviewDocs',
        title: '🚀 Skip Enhanced - Quick Review',
        arguments: [activeEditor.document.fileName]
    });
    
    stream.markdown('\n\n');
    stream.markdown('💡 **Select one or more categories above, or proceed with Quick Review**\n');
    
    return false; // Show options dialog
}

// HELPER: Get description for business document categories
function getBusinessDocDescription(folderName: string) {
    const descriptions = {
        'billing-rules': '💰 Invoice logic, payment validation, and billing constraints',
        'data-validation': '🔍 Input validation rules and business constraints',
        'navigation-rules': '🗺️ Menu access controls and navigation permissions', 
        'permission-rules': '🔐 User roles, admin permissions, and access control'
    };
    
    return (descriptions as any)[folderName] || `📋 ${folderName.replace('-', ' ')} documentation`;
}

// ES exports
export { initializeReviewChanges, aiReviewChanges, reviewChanges, getTargetFileInfo, getGitDiffForTarget, handleNoChangesScenario, showEnhancedReviewOptions, processReviewChanges };
