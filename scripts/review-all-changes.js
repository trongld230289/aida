const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { executeAIReview, getUnifiedModel, getChecklistStatusIcon, shouldUseApiKey, displayReviewHeader, loadTemplateWithPriority, displayCommonReviewInfo, showReviewOptions } = require('./review-common');
const { autoDetectWorkspace, getReviewTemplateWithDetection, displayDetectionInfo } = require('./language-detection');

// Import functions from extension.js
let handleEnterTwiceLogic;
let ensureAidaTemplatesForReview;
try {
    const extensionModule = require('../extension');
    handleEnterTwiceLogic = extensionModule.handleEnterTwiceLogic;
    ensureAidaTemplatesForReview = extensionModule.ensureAidaTemplatesForReview;
} catch (error) {
    console.log('⚠️ Could not import functions from extension.js');
}

/**
 * Initialize review-all-changes functionality
 * @param {vscode.ExtensionContext} context
 * @returns {object} - Chat participant and related functions
 */
function initializeReviewAllChanges(context) {
    // Create chat participant for review-all-changes
    const reviewAllChangesParticipant = vscode.chat.createChatParticipant('review-all-changes', async (request, chatContext, stream, token) => {
        try {
            // Ensure AIDA templates exist for review commands (create if not exists)
            if (ensureAidaTemplatesForReview) {
                await ensureAidaTemplatesForReview(context);
            }
            
            console.log('🎯 review-all-changes participant called');
            console.log('📥 Request object:', request);
            console.log('📥 Request.model:', request.model);
            console.log('📥 Request.model?.family:', request.model?.family);
            console.log('📥 Request.model?.id:', request.model?.id);
            
            const input = request.prompt.trim();
            
            // Improved loop prevention - only prevent if this is a recursive call from the same participant
            if (chatContext.participant && chatContext.participant.id === 'review-all-changes' && request.prompt.includes('@review-all-changes')) {
                stream.markdown('⚠️ **Loop Prevention**: Recursive call detected\n');
                stream.markdown('💡 **Use direct commands instead**: Review all your git changes\n');
                return;
            }
            
            // Check for global selectedBusinessDocs (like review-file.js, review-pr.js, review-changes.js)
            if (global.selectedBusinessDocs) {
                console.log('🎯 Enhanced/Quick All Changes Review detected:', global.selectedBusinessDocs);
                
                // Execute review directly
                await aiReviewAllChanges(input, stream, null, context, request);
                return;
            }
            
            // Get workspace folder and check for changes first
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                stream.markdown('❌ **No workspace folder found**\n\n');
                await aiReviewAllChanges(input, stream, null, context, request);
                return;
            }
            
            // Quick check for changes to show appropriate options
            const allChangesResult = await getAllChangedFilesWithDiffs(workspaceFolder);
            
            if (!allChangesResult.success) {
                // No changes found, use normal flow
                await aiReviewAllChanges(input, stream, null, context, request);
                return;
            }
            
            // Show review options (Quick Review vs Enhanced Review)
            const shouldContinue = await showReviewOptions(
                `${allChangesResult.totalFiles} changed files`, 
                stream,
                {
                    chatCommand: 'review-all-changes'
                },
                async (useDocuments) => {
                    if (useDocuments) {
                        // TODO: Implement with business documents
                        stream.markdown('🔧 **Business documents integration coming soon...**\n\n');
                    }
                    await aiReviewAllChanges(input, stream, null, context, request);
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
            
            // Continue with normal processing (fallback)
            await aiReviewAllChanges(input, stream, null, context, request);
            
        } catch (error) {
            stream.markdown(`❌ Error: ${error.message}\n\n`);
            stream.markdown('**Fallback:** Try running a git status check first, or use @review-changes for specific files.\n');
            console.error('Review All Changes error:', error);
        }
    });

    // Set custom icon for chat participant
    reviewAllChangesParticipant.iconPath = vscode.Uri.file(path.join(context.extensionPath, 'icons', 'icon.svg'));

    return {
        reviewAllChangesParticipant,
        aiReviewAllChanges
    };
}

/**
 * Process review all changes with review options (for AIDA Chatbot reuse)
 * @param {string} input - User input message
 * @param {object} stream - Chat stream object
 */
async function processReviewAllChanges(input, stream) {
    console.log('🔍 processReviewAllChanges: Starting review all changes with options');
    
    // Check for global selectedBusinessDocs (unified pattern with review-file, review-changes, review-pr)
    if (global.selectedBusinessDocs) {
        console.log('🎯 Enhanced/Quick All Changes Review detected:', global.selectedBusinessDocs);
        
        // Execute review directly
        await aiReviewAllChanges(input, stream, null, null, null);
        return;
    }
    
    // Get workspace folder and check for changes first
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        stream.markdown('❌ **No workspace folder found**\n\n');
        await aiReviewAllChanges(input, stream, null, null, null);
        return;
    }
    
    // Quick check for changes to show appropriate options
    const allChangesResult = await getAllChangedFilesWithDiffs(workspaceFolder);
    
    if (!allChangesResult.success) {
        // No changes found, use normal flow
        await aiReviewAllChanges(input, stream, null, null, null);
        return;
    }
    
    // Show review options (Quick Review vs Enhanced Review)
    const shouldContinue = await showReviewOptions(
        `${allChangesResult.totalFiles} changed files`, 
        stream,
        {
            chatCommand: 'review-all-changes'
        },
        async (useDocuments) => {
            if (useDocuments) {
                // TODO: Implement with business documents
                stream.markdown('🔧 **Business documents integration coming soon...**\n\n');
            }
            await aiReviewAllChanges(input, stream, null, null, null);
        }
    );
    
    // If showReviewOptions returns false, it's showing the options dialog
    if (shouldContinue === false) {
        return;
    }
    
    // Continue with normal processing (fallback)
    await aiReviewAllChanges(input, stream, null, null, null);
}

/**
 * Find git repository root directory
 * @param {string} startPath - Starting directory path
 * @returns {string|null} - Git repository root path or null if not found
 */
function findGitRepositoryRoot(startPath) {
    let currentPath = startPath;
    
    while (currentPath && currentPath !== path.dirname(currentPath)) {
        try {
            const gitPath = path.join(currentPath, '.git');
            if (fs.existsSync(gitPath)) {
                console.log(`📁 Found git repository root: ${currentPath}`);
                return currentPath;
            }
        } catch (error) {
            // Continue searching
        }
        currentPath = path.dirname(currentPath);
    }
    
    console.log('❌ Git repository root not found');
    return null;
}

/**
 * Get all changed files with their diffs from git
 * @param {object} workspaceFolder - VS Code workspace folder
 * @returns {object} - Result with all file changes
 */
async function getAllChangedFilesWithDiffs(workspaceFolder) {
    try {
        // Find git repository root instead of using workspace folder directly
        const gitRoot = findGitRepositoryRoot(workspaceFolder.uri.fsPath);
        
        if (!gitRoot) {
            return {
                success: false,
                message: 'No git repository found in workspace hierarchy'
            };
        }
        
        console.log(`🔍 Scanning git changes from repository root: ${gitRoot}`);
        console.log(`📂 Original workspace folder: ${workspaceFolder.uri.fsPath}`);
        
        // Get list of all changed files
        let changedFiles = [];
        
        // Get unstaged changes - now using git repository root
        try {
            const unstagedFiles = execSync('git diff --name-only HEAD', { 
                cwd: gitRoot, // ← Fixed: Use git repository root instead of workspace folder
                encoding: 'utf8' 
            }).trim().split('\n').filter(f => f);
            
            console.log(`📄 Found ${unstagedFiles.length} unstaged files:`, unstagedFiles);
            changedFiles = [...changedFiles, ...unstagedFiles.map(f => ({ file: f, type: 'unstaged' }))];
        } catch (error) {
            console.log('No unstaged changes found');
        }
        
        // Get staged changes - now using git repository root
        try {
            const stagedFiles = execSync('git diff --staged --name-only', { 
                cwd: gitRoot, // ← Fixed: Use git repository root instead of workspace folder
                encoding: 'utf8' 
            }).trim().split('\n').filter(f => f);
            
            console.log(`📄 Found ${stagedFiles.length} staged files:`, stagedFiles);
            changedFiles = [...changedFiles, ...stagedFiles.map(f => ({ file: f, type: 'staged' }))];
        } catch (error) {
            console.log('No staged changes found');
        }
        
        if (changedFiles.length === 0) {
            return {
                success: false,
                message: 'No git changes found - workspace is clean'
            };
        }
        
        // Remove duplicates (file might be both staged and unstaged)
        const uniqueFiles = Array.from(new Set(changedFiles.map(cf => cf.file)))
            .map(file => {
                const types = changedFiles.filter(cf => cf.file === file).map(cf => cf.type);
                return { file, types };
            })
            // Filter out files that shouldn't be reviewed
            .filter(({ file }) => {
                const excludePatterns = [
                    '.gitignore',
                    '.gitattributes',
                    'package-lock.json',
                    'yarn.lock',
                    'pnpm-lock.yaml',
                    '.env',
                    '.env.local',
                    '.env.production',
                    '*.log'
                ];
                
                return !excludePatterns.some(pattern => {
                    if (pattern.includes('*')) {
                        // Simple glob pattern matching
                        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
                        return regex.test(file);
                    }
                    return file === pattern || file.endsWith('/' + pattern);
                });
            });
        
        console.log(`📁 Found ${uniqueFiles.length} changed files:`, uniqueFiles.map(f => f.file));
        
        // Get combined diff for all files
        let allDiffs = [];
        let totalLinesAdded = 0;
        let totalLinesRemoved = 0;
        
        for (const { file, types } of uniqueFiles) {
            try {
                // Get diff for this specific file (prefer unstaged, fallback to staged)
                let fileDiff = '';
                let diffType = '';
                
                if (types.includes('unstaged')) {
                    fileDiff = execSync(`git diff HEAD -- "${file}"`, { 
                        cwd: gitRoot, // ← Fixed: Use git repository root
                        encoding: 'utf8' 
                    });
                    diffType = 'unstaged';
                } else if (types.includes('staged')) {
                    fileDiff = execSync(`git diff --staged -- "${file}"`, { 
                        cwd: gitRoot, // ← Fixed: Use git repository root
                        encoding: 'utf8' 
                    });
                    diffType = 'staged';
                }
                
                if (fileDiff.trim()) {
                    // Count lines for this file
                    const lines = fileDiff.split('\n');
                    const added = lines.filter(line => line.startsWith('+')).length;
                    const removed = lines.filter(line => line.startsWith('-')).length;
                    
                    allDiffs.push({
                        file,
                        diff: fileDiff,
                        type: diffType,
                        linesAdded: added,
                        linesRemoved: removed
                    });
                    
                    totalLinesAdded += added;
                    totalLinesRemoved += removed;
                }
            } catch (fileError) {
                console.log(`Warning: Could not get diff for ${file}:`, fileError.message);
            }
        }
        
        if (allDiffs.length === 0) {
            return {
                success: false,
                message: 'No file diffs could be retrieved'
            };
        }
        
        // Combine all diffs into one large diff
        const combinedDiff = allDiffs.map(fd => fd.diff).join('\n\n');
        
        return {
            success: true,
            diff: combinedDiff,
            files: allDiffs,
            totalFiles: allDiffs.length,
            totalLinesAdded,
            totalLinesRemoved,
            changeType: 'All Changes'
        };
        
    } catch (gitError) {
        return {
            success: false,
            message: `Git command failed: ${gitError.message}`
        };
    }
}

/**
 * Handle scenario when no changes found
 * @param {object} stream - Chat stream
 * @param {string} message - Error message
 */
async function handleNoAllChangesScenario(stream, message) {
    stream.markdown(`✅ **${message}**\n\n`);
    
    stream.markdown('💡 **No changes to review in workspace**\n\n');
    stream.markdown('**What you can do:**\n');
    stream.markdown('- Make some code changes and try again\n');
    stream.markdown('- Use `@review-changes` to review a specific file\n');
    stream.markdown('- Use `@review-file` to review the currently active file\n');
    stream.markdown('- Check git status with `git status` in terminal\n\n');
    
    // Offer to review active file instead
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor) {
        const fileName = path.basename(activeEditor.document.fileName);
        stream.markdown(`📂 **Alternative:** Review the currently active file \`${fileName}\`\n\n`);
        
        // Create button for confirming file review
        stream.button({
            command: 'aida.confirmFileReview',
            title: `✅ Review file ${fileName}`,
            arguments: [activeEditor.document.fileName]
        });
        
        stream.markdown('\n\n');
    }
}

/**
 * Main AI review all changes function
 * @param {string} input - User input (usually empty for review-all-changes)
 * @param {object} stream - Chat stream
 * @param {string} selectedModel - Selected AI model
 * @param {object} context - Extension context
 * @param {object} request - Chat request object
 */
async function aiReviewAllChanges(input, stream, selectedModel = null, context = null, request = null) {
    try {
        
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            stream.markdown('❌ **No workspace folder found**\n\n');
            stream.markdown('💡 **Tips:**\n');
            stream.markdown('- Open a folder in VS Code\n');
            stream.markdown('- Initialize a git repository if needed\n');
            stream.markdown('- Or try `@review-file` to review the active file instead\n');
            return;
        }

        // Show initial header
        stream.markdown('# 🔍 Reviewing All Changes\n\n');
        stream.markdown('📂 **Scanning workspace for all git changes...**\n\n');
        
        // Get all changed files with their diffs
        const allChangesResult = await getAllChangedFilesWithDiffs(workspaceFolder);
        
        if (!allChangesResult.success) {
            // Handle no changes scenario
            await handleNoAllChangesScenario(stream, allChangesResult.message);
            return;
        }

        // Display summary of changes found
        stream.markdown(`✅ **Found ${allChangesResult.totalFiles} changed files**\n\n`);
        stream.markdown('**Files being reviewed:**\n');
        allChangesResult.files.forEach((fileData, index) => {
            const statusIcon = fileData.type === 'staged' ? '🟢' : '🟡';
            stream.markdown(`${index + 1}. ${statusIcon} \`${fileData.file}\` (+${fileData.linesAdded} -${fileData.linesRemoved}) [${fileData.type}]\n`);
        });
        stream.markdown('\n');
        stream.markdown(`**Total changes:** +${allChangesResult.totalLinesAdded} additions, -${allChangesResult.totalLinesRemoved} deletions\n\n`);
        stream.markdown('---\n\n');

        // Use the same review logic as review-changes but with all files
        await reviewAllChanges(
            allChangesResult.diff, 
            stream, 
            allChangesResult.changeType, 
            selectedModel, 
            context, 
            request, 
            allChangesResult.files,
            workspaceFolder
        );

    } catch (error) {
        stream.markdown(`❌ **Review process failed:** ${error.message}\n\n`);
        stream.markdown('**Fallback options:**\n');
        stream.markdown('- Try `@review-changes` for specific files\n');
        stream.markdown('- Try `@review-file` for active file review\n');
        stream.markdown('- Check if VS Code has proper workspace access\n');
        stream.markdown('- Restart VS Code if issues persist\n');
        console.error('AI Review All Changes error:', error);
    }
}

/**
 * Review all changes using the same template as review-changes
 * @param {string} diffContent - Combined diff content
 * @param {object} stream - Chat stream
 * @param {string} changeType - Type of changes
 * @param {string} selectedModel - Selected AI model
 * @param {object} context - Extension context
 * @param {object} request - Chat request object
 * @param {array} files - Array of file data
 * @param {object} workspaceFolder - Workspace folder
 */
async function reviewAllChanges(diffContent, stream, changeType, selectedModel = null, context = null, request = null, files = [], workspaceFolder = null) {
    
    let templateContent = null;
    
    try {
        // Auto-detect framework/language from workspace (same as review-changes)
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        const detection = await autoDetectWorkspace(workspaceFolder.uri.fsPath, null);
        
        console.log(`🎯 Detection result for all changes: "${detection.detected}" (type: ${detection.type})`);
        
        // Use common template loading function - SAME template as review-changes
        const templateResult = await loadTemplateWithPriority('review-changes.md', detection);
        templateContent = templateResult.content;
        
        // Update detection with template source info
        detection.templateSource = templateResult.templateSource;
        detection.templatePath = templateResult.templatePath;
        
        // Display detection information
        displayDetectionInfo(stream, detection, 'review-changes.md');
        
        // Display review header for all changes
        if (workspaceFolder) {
            displayCommonReviewInfo(stream, 'All Changes Review', `${files.length} files`, {
                length: diffContent.length,
                lengthType: 'combined diff'
            });
        }
        
        // Modify template content to indicate this is for all changes
        if (templateContent.includes('Review Entire File')) {
            templateContent = templateContent.replace(
                'Review Entire File',
                'Review All Changed Files'
            );
        }
        
        if (templateContent.includes('ONLY the git diff changes')) {
            templateContent = templateContent.replace(
                'ONLY the git diff changes',
                'ALL the git diff changes from multiple files'
            );
        }
        
    } catch (error) {
        stream.markdown('❌ **Error**: Could not load review template\n');
        stream.markdown(`Error: ${error.message}\n`);
        // Fallback to basic review
        await reviewAllChangesWithChecklist(diffContent, stream, changeType, files);
        return;
    }
    
    // Safety check: ensure templateContent is available
    if (!templateContent) {
        stream.markdown('❌ **Error**: Template content not available\n');
        await reviewAllChangesWithChecklist(diffContent, stream, changeType, files);
        return;
    }
    
    // Inject ALL git diffs into template at the appropriate location
    let finalContent = templateContent;
    
    // Find a good insertion point in the template
    const insertionPoint = finalContent.indexOf('## 🔍 SPECIFIC RULES VIOLATED');
    
    if (insertionPoint !== -1) {
        // Insert git diff before the rules section
        const beforeContent = finalContent.substring(0, insertionPoint);
        const afterContent = finalContent.substring(insertionPoint);
        
        finalContent = beforeContent + 
                      '## ALL GIT DIFFS TO REVIEW\n\n' +
                      `**Reviewing ${files.length} changed files:**\n\n` +
                      files.map((f, i) => `${i + 1}. \`${f.file}\` (+${f.linesAdded} -${f.linesRemoved}) [${f.type}]`).join('\n') + '\n\n' +
                      '```diff\n' + diffContent + '\n```\n\n' +
                      '---\n\n' +
                      afterContent;
    } else {
        // Fallback: add at the end
        finalContent += '\n\n## ALL GIT DIFFS TO REVIEW\n\n' +
                       `**Reviewing ${files.length} changed files:**\n\n` +
                       files.map((f, i) => `${i + 1}. \`${f.file}\` (+${f.linesAdded} -${f.linesRemoved}) [${f.type}]`).join('\n') + '\n\n' +
                       '```diff\n' + diffContent + '\n```\n';
    }
    
    try {
        // Use unified model detection (same as review-changes)
        const model = await getUnifiedModel(stream, selectedModel, context, request);
        
        if (!model) {
            // Check if this is API key mode before showing error
            if (shouldUseApiKey()) {
                // API key mode - executeAIReview will handle it
                console.log('🔑 API key mode enabled - model is null as expected');
            } else {
                stream.markdown('❌ **AI models not available** - falling back to template display\n\n');
                throw new Error('No AI models available');
            }
        }
            
        // Use the unified AI execution function
        const success = await executeAIReview(finalContent, model, stream, 'All Changes');
        if (!success) {
            // Model not available, review was stopped
            return;
        }
        
    } catch (error) {
        // Safe fallback without command triggers
        stream.markdown('⚠️ **AI processing failed. Showing template for manual review:**\n\n');
        stream.markdown('```markdown\n');
        stream.markdown(finalContent);
        stream.markdown('\n```\n\n');
        stream.markdown(`**Error details:** ${error.message}\n\n`);
        stream.markdown('💡 **Manual review:** Use the template above to analyze all the changes\n');
    }
}

/**
 * Fallback review with checklist when AI is not available
 * @param {string} diffContent - Combined diff content
 * @param {object} stream - Chat stream
 * @param {string} changeType - Type of changes
 * @param {array} files - Array of file data
 */
async function reviewAllChangesWithChecklist(diffContent, stream, changeType, files = []) {
    // Use same analysis as review-changes but for all files
    const analysis = analyzeAllGitDiffsStructured(diffContent, files);
    
    // 1. Summary for all changes
    stream.markdown('### 📋 All Changes Summary\n\n');
    stream.markdown(`**Overall Impact:** Changes across ${files.length} file(s) with ${analysis.linesAdded} total additions and ${analysis.linesRemoved} total deletions.\n\n`);
    
    // File breakdown
    stream.markdown('**Files changed:**\n');
    files.forEach((fileData, index) => {
        const statusIcon = fileData.type === 'staged' ? '🟢' : '🟡';
        stream.markdown(`${index + 1}. ${statusIcon} \`${fileData.file}\` (+${fileData.linesAdded} -${fileData.linesRemoved})\n`);
    });
    stream.markdown('\n');
    
    if (analysis.checklist.correctness.issues.some(issue => issue.includes('CRITICAL'))) {
        stream.markdown('🚨 **CRITICAL ISSUES DETECTED** - Immediate attention required!\n\n');
    }

    // 2. Inline-style comments for all files
    stream.markdown('### 💬 Issues Found Across All Files\n\n');
    
    let hasInlineComments = false;
    
    // Check each checklist category and format as inline comments
    Object.entries(analysis.checklist).forEach(([category, check]) => {
        if (check.issues.length > 0) {
            check.issues.forEach(issue => {
                hasInlineComments = true;
                stream.markdown(`${issue}\n\n`);
            });
        }
    });
    
    if (!hasInlineComments) {
        stream.markdown('✅ No specific issues found in the changed code across all files.\n\n');
    }

    // 3. Review Checklist Results (same as review-changes)
    stream.markdown('### 📋 Review Checklist (All Files)\n\n');
    
    const checklistMap = {
        'correctness': '1. **Correctness** - Does the new/modified code work as intended? Any logical errors or regressions?',
        'bestPractices': '2. **Best Practices** - Follow Angular + TypeScript coding guidelines, proper component/service usage',
        'performance': '3. **Performance** - Look for inefficient patterns, change detection strategy, subscriptions cleanup',
        'security': '4. **Security** - Identify unsafe DOM access, bypassSecurityTrust, missing input validation',
        'maintainability': '5. **Maintainability** - Avoid duplication, unnecessary complexity, consistent naming',
        'testing': '6. **Testing** - Suggest new unit/e2e tests needed for the new logic'
    };

    Object.entries(checklistMap).forEach(([key, description]) => {
        const check = analysis.checklist[key];
        const statusIcon = getChecklistStatusIcon(check.status);
        
        stream.markdown(`${statusIcon} ${description}\n\n`);
        
        if (check.suggestions.length > 0) {
            stream.markdown('**Suggestions:**\n');
            check.suggestions.forEach(suggestion => {
                stream.markdown(`- ${suggestion}\n`);
            });
            stream.markdown('\n');
        }
    });

    // 4. Next Steps for all changes
    stream.markdown('### 🎯 Next Steps (All Changes)\n\n');
    
    const hasIssues = Object.values(analysis.checklist).some(check => check.issues.length > 0);
    const hasCriticalIssues = Object.values(analysis.checklist).some(check => 
        check.issues.some(issue => issue.includes('CRITICAL'))
    );
    
    if (hasCriticalIssues) {
        stream.markdown('- 🚨 **URGENT**: Fix critical issues identified above across all files\n');
        stream.markdown('- 🔍 **Verify functionality**: Test all affected features thoroughly\n');
    }
    
    if (hasIssues) {
        stream.markdown('- 🔧 **Fix identified issues** in all files before proceeding\n');
        stream.markdown('- 🧪 **Add/update unit tests** for all modified functionality\n');
        stream.markdown('- ✅ **Run linting and formatting checks** on all files\n');
    } else {
        stream.markdown('- ✅ **Code review passed** - no major issues detected across all files\n');
        stream.markdown('- 🧪 **Ensure tests cover changes** in all modified files\n');
        stream.markdown('- 📚 **Update documentation** if public APIs changed\n');
    }
    
    stream.markdown('- 🌐 **Test in development environment** with all changes\n');
    stream.markdown('- 📦 **Consider staging changes incrementally** if large changeset\n');

    // Success message
    stream.markdown('---\n\n');
    stream.markdown('✅ **All Changes Review Complete!**\n');
    stream.markdown(`💡 **Analysis based on review-changes.md template for ${files.length} files**\n`);
}

/**
 * Analyze all git diffs with file context
 * @param {string} diffContent - Combined diff content
 * @param {array} files - Array of file data
 * @returns {object} - Analysis results
 */
function analyzeAllGitDiffsStructured(diffContent, files) {
    // Use same analysis as review-changes but track multiple files
    const analysis = {
        filesChanged: new Set(files.map(f => f.file)),
        linesAdded: files.reduce((sum, f) => sum + f.linesAdded, 0),
        linesRemoved: files.reduce((sum, f) => sum + f.linesRemoved, 0),
        summary: '',
        checklist: {
            correctness: { status: 'unknown', issues: [], suggestions: [] },
            bestPractices: { status: 'unknown', issues: [], suggestions: [] },
            performance: { status: 'unknown', issues: [], suggestions: [] },
            security: { status: 'unknown', issues: [], suggestions: [] },
            maintainability: { status: 'unknown', issues: [], suggestions: [] },
            testing: { status: 'unknown', issues: [], suggestions: [] }
        },
        inlineComments: [],
        nextSteps: []
    };

    const lines = diffContent.split('\n');
    let currentFile = '';
    let currentLineNumber = 0;
    
    lines.forEach((line, index) => {
        // Track files
        if (line.startsWith('diff --git')) {
            const match = line.match(/b\/(.*)/);
            if (match) {
                currentFile = match[1];
                analysis.filesChanged.add(currentFile);
            }
        }

        // Track line numbers
        if (line.startsWith('@@')) {
            const lineMatch = line.match(/@@ -\d+,?\d* \+(\d+),?\d* @@/);
            if (lineMatch) {
                currentLineNumber = parseInt(lineMatch[1]);
            }
        }
        
        // Analyze added lines (same logic as review-changes)
        if (line.startsWith('+') && !line.startsWith('+++')) {
            currentLineNumber++;
            analyzeLineForAllChangesChecklist(line, currentFile, currentLineNumber, analysis);
        }
        
        // Analyze removed lines (same logic as review-changes)
        if (line.startsWith('-') && !line.startsWith('---')) {
            analyzeRemovedLineForAllChangesChecklist(line, currentFile, currentLineNumber, analysis);
        }

        // Track line numbers for context lines
        if (!line.startsWith('+') && !line.startsWith('-') && !line.startsWith('@@') && !line.startsWith('diff')) {
            currentLineNumber++;
        }
    });

    // Generate summary for all changes
    analysis.summary = generateAllChangesSummary(analysis, files);
    
    // Set checklist statuses
    updateAllChangesChecklistStatuses(analysis);

    return analysis;
}

// Same analysis functions as review-changes but adapted for multiple files
function analyzeLineForAllChangesChecklist(line, file, lineNumber, analysis) {
    const content = line.substring(1).trim();
    const fileExt = file.split('.').pop();
    
    // All the same checks as review-changes.js but with file context
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
            `Define proper interfaces/types instead of using \`any\` in ${file}`
        );
    }

    if (content.includes('console.log') || content.includes('console.error')) {
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
            `Implement OnDestroy and unsubscribe in ngOnDestroy for ${file}`
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
        analysis.nextSteps.push(`🔒 Security review required for DOM manipulation in ${file}`);
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
            `Extract magic numbers to constants or configuration in ${file}`
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

function analyzeRemovedLineForAllChangesChecklist(line, file, lineNumber, analysis) {
    const content = line.substring(1).trim();
    
    // Check for removed functionality (same as review-changes)
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

function generateAllChangesSummary(analysis, files) {
    const fileCount = files.length;
    const totalChanges = analysis.linesAdded + analysis.linesRemoved;
    
    let summary = `Changes affect ${fileCount} file(s) with ${analysis.linesAdded} additions and ${analysis.linesRemoved} deletions. `;
    
    // Detect change patterns
    const hasRemovals = analysis.linesRemoved > analysis.linesAdded;
    const hasCriticalIssues = analysis.checklist.correctness.issues.some(issue => issue.includes('CRITICAL'));
    
    if (hasCriticalIssues) {
        summary += 'CRITICAL ISSUES DETECTED across multiple files - immediate attention required. ';
    }
    
    if (hasRemovals) {
        summary += 'Primarily removes existing functionality across files - verify intentional. ';
    }
    
    if (totalChanges > 200) {
        summary += 'Large changeset across multiple files - consider breaking into smaller commits.';
    } else if (fileCount > 5) {
        summary += 'Multiple files changed - ensure cohesive functionality.';
    } else {
        summary += 'Moderate changeset size across multiple files.';
    }
    
    return summary;
}

function updateAllChangesChecklistStatuses(analysis) {
    Object.keys(analysis.checklist).forEach(category => {
        const check = analysis.checklist[category];
        if (check.issues.length > 0) {
            check.status = check.issues.some(issue => issue.includes('CRITICAL') || issue.includes('🚨')) ? 'critical' : 'warning';
        } else if (check.suggestions.length > 0) {
            check.status = 'suggestion';
        } else {
            check.status = 'ok';
        }
    });
}

module.exports = {
    initializeReviewAllChanges,
    aiReviewAllChanges,
    reviewAllChanges,
    getAllChangedFilesWithDiffs,
    handleNoAllChangesScenario,
    processReviewAllChanges
};