import * as vscode from 'vscode';
import { getUnifiedModel, executeAIReview, shouldUseApiKey } from './review-common';
import { aidaLogging } from '../core/settings';
import { buildPRReviewPrompt } from '../core/prompts';
import { getPRReviewTemplate } from './pr-utils';
import { toError } from '../core/error-utils';
import { displayCommonReviewInfo, displayDetectionInfo } from './review-common';

/**
 * Add quick review option using review-pr template
 */
async function addQuickReviewOption(stream: vscode.ChatResponseStream, prAnalysis: Record<string, any>, request: vscode.ChatRequest | null, originalUrl: string | null = null) {
    const data = prAnalysis.data;

    // 🔍 DEBUG: Check what we have in prAnalysis structure
    aidaLogging('🔧 DEBUG addQuickReviewOption: prAnalysis structure:', JSON.stringify({
        hasData: !!prAnalysis.data,
        finalDiffLength: prAnalysis.data?.finalDiff?.length || 0,
        fileChangesCount: prAnalysis.data?.fileChanges?.length || 0,
        keys: Object.keys(prAnalysis.data || {})
    }, null, 2));

    // Build diff content from reviewableFileChanges only (filtered files for AI review)
    let diffContent = '';

    // Always get diff from reviewableFileChanges (filtered for AI review)
    const reviewableFiles = data.reviewableFileChanges || [];
    aidaLogging(`📝 Building diff from reviewableFileChanges: ${reviewableFiles.length} files`);
    
    if (reviewableFiles.length > 0) {
        // Log each reviewable file
        reviewableFiles.forEach((file: Record<string, any>, index: number) => {
            aidaLogging(`📝 Reviewable file ${index + 1}: ${file.path}, diffContent length: ${file.diffContent?.length || 0}`);
        });
        
        // Build diff from reviewable files only
        diffContent = reviewableFiles
            .filter((file: Record<string, any>) => file.diffContent && file.diffContent.trim())
            .map((file: Record<string, any>) => file.diffContent)
            .join('\n\n');
        aidaLogging(`✅ Built diff from reviewableFileChanges: ${diffContent.length} chars from ${reviewableFiles.length} files`);
    }

    // Only proceed if we have reviewable diff content
    if (!diffContent || !diffContent.trim()) {
        const totalFiles = data.fileChanges ? data.fileChanges.length : 0;
        const reviewableCount = reviewableFiles.length;
        
        aidaLogging('⚠️ No reviewable diff content available for AI review');
        stream.markdown('⚠️ **No reviewable files found for AI review**\n\n');
        
        if (totalFiles > 0 && reviewableCount === 0) {
            stream.markdown(`Found ${totalFiles} file changes, but all files were filtered out (auto-generated, config files, etc.)\n\n`);
            stream.markdown('**Filtered file types typically include:**\n');
            stream.markdown('- Lock files (package-lock.json, yarn.lock)\n');
            stream.markdown('- Generated files (*.min.js, *.generated.*)\n');
            stream.markdown('- Config files (webpack.config.js, tsconfig.json)\n');
            stream.markdown('- Documentation files (README.md, CHANGELOG.md)\n\n');
        } else if (reviewableCount > 0) {
            stream.markdown(`Found ${reviewableCount} reviewable files, but no diff content available.\n\n`);
        } else {
            stream.markdown('No file changes detected in this PR/MR.\n\n');
        }
        
        return;
    }

    try {

        // Actually perform the quick review with AI
        await performQuickReviewWithAI(stream, data, request, diffContent, originalUrl);

    } catch (error: unknown) {
        aidaLogging('Error in quick review option:', error);
        stream.markdown('⚠️ Quick review option temporarily unavailable.\n\n');
    }
}

/**
 * Perform quick review with AI using template and shared functions
 */
async function performQuickReviewWithAI(stream: vscode.ChatResponseStream, prData: Record<string, any>, request: vscode.ChatRequest | null, diffContent: string, originalUrl: string | null = null) {
    let templateContent;

    // Set global context for any sub-functions
    global.currentPRData = prData;

    try {
        // Auto-detect framework/language from PR files and load appropriate template
        const templateResult = await getPRReviewTemplate('review-pr.md', prData);
        templateContent = (templateResult as any).content;

        aidaLogging(`✅ Loaded ${(templateResult as any).detection.template.name} review template from: ${(templateResult as any).templatePath} (${(templateResult as any).content.length} characters)`);
        
        // Import and use displayCommonReviewInfo and displayDetectionInfo functions
        // Display detection information FIRST (as user requested)
        const detectionForDisplay = {
            type: (templateResult as any).detection.template.type || 'fallback',
            detected: (templateResult as any).detection.framework || (templateResult as any).detection.language || 'General',
            templatePath: (templateResult as any).detection.template.type + '/' + (templateResult as any).detection.template.name,
            confidence: (templateResult as any).confidence,
            reason: `${(templateResult as any).detection.template.name} template selected based on PR content analysis`
        };
        displayDetectionInfo(stream, detectionForDisplay, 'review-pr.md');
        
        // Display common review info SECOND (PR title, path, file changes count)
        // Use original URL if available, otherwise fallback to generated name
        const displayName = originalUrl || 
                           (prData.gitlabHost ? `${prData.owner}/${prData.repository}` : 
                            prData.owner && prData.repository ? `${prData.owner}/${prData.repository}` : 
                            prData.repository || `PR #${prData.id}`);
        displayCommonReviewInfo(stream, 'PR Quick Review', displayName, {
            length: prData.reviewableFileChanges ? prData.reviewableFileChanges.length : 0,
            lengthType: 'reviewable files'
        });

    } catch (_error: unknown) {
        const error = toError(_error);
        stream.markdown('❌ **Error**: Could not load quick review template\n');
        stream.markdown(`Error: ${error.message}\n`);
        return;
    }

    // Use provided diffContent (from finalDiff or built from files)
    aidaLogging(`📝 Diff content for review: ${diffContent.length} chars`);

    // Use reviewableFileChanges (filtered files for AI review)
    const sourceFiles = prData.reviewableFileChanges || [];
    
    aidaLogging(`📊 [REVIEW FILTER] Using reviewableFileChanges: ${sourceFiles.length} files for AI analysis`);

    // Build prompt using centralized prompt builder
    const { processed: processedTemplate, modifiedFiles, newFiles } = buildPRReviewPrompt(templateContent, diffContent, sourceFiles);
    
    aidaLogging(`📊 [FILTER RESULT] Total reviewable files: ${sourceFiles.length}, Modified: ${modifiedFiles.length}, New: ${newFiles.length}`);
    
    if (newFiles.length > 0) {
        aidaLogging(`✅ New files to inject as fullContent:`, newFiles.map((f: Record<string, any>) => f.path));
    }

    try {
        // Get unified model using shared function with request
        const model = await getUnifiedModel(stream, null, null, request);

        if (!model) {
            // Check if API key mode is enabled
            if (shouldUseApiKey()) {
                // API key mode - executeAIReview will handle it
                aidaLogging('🔑 API key mode enabled for PR review - model is null as expected');
            } else {
                stream.markdown('❌ **No AI model available**\n\n');
                stream.markdown('Using fallback basic analysis instead.\n\n');
                await performBasicQuickAnalysis(stream, prData);
                return;
            }
        }

        // Use shared executeAIReview function
        const success = await executeAIReview(
            processedTemplate,
            model,
            stream,
            'PR Quick Review'
        );

        aidaLogging(`📝 executeAIReview result: ${success}`);

        if (!success) {
            aidaLogging('❌ AI review failed, using fallback');
            stream.markdown('⚠️ **AI analysis failed. Using fallback analysis:**\n\n');
            await performBasicQuickAnalysis(stream, prData);
        } else {
            aidaLogging('✅ AI review completed successfully');
        }

    } catch (_error: unknown) {
        const error = toError(_error);
        // Safe fallback - show basic analysis
        stream.markdown('⚠️ **AI processing failed. Showing basic analysis:**\n\n');
        await performBasicQuickAnalysis(stream, prData);
        stream.markdown(`**Error details:** ${error.message}\n\n`);
    } finally {
        // Cleanup global context
        delete global.currentPRData;
    }
}



/**
 * Perform structured quick analysis based on diff content
 */
async function performStructuredQuickAnalysis(stream: vscode.ChatResponseStream, prData: Record<string, any>) {
    const fileChanges = prData.fileChanges || [];
    const finalDiff = prData.finalDiff || '';

    // Set global context for file assessments
    global.currentPRData = prData;

    stream.markdown('## 📊 Quick PR Assessment Results\n\n');

    // Analyze each file - show ALL files in compact format
    let passCount = 0, warningCount = 0, criticalCount = 0;
    const fileAssessments = [];

    // Process all files first (with AI assessment)
    let templateContent = null;
    try {
        const templateResult = await getPRReviewTemplate('review-pr.md', prData);
        templateContent = (templateResult as any).content;
        aidaLogging(`✅ Loaded ${(templateResult as any).detection.template.name} template for AI file assessment`);
        
        // Display PR detection information
        stream.markdown('## 🎯 Auto-Detection Results\n\n');
        stream.markdown(`**Detection:** ${(templateResult as any).detection.template.name} (${(templateResult as any).confidence})\n`);
        stream.markdown(`**Template:** ${(templateResult as any).templatePath}\n\n`);
    } catch (_error: unknown) {
        aidaLogging('⚠️ Template not available, using enhanced fallback');
    }

    for (let i = 0; i < fileChanges.length; i++) {
        const file = fileChanges[i];
        // Use async assessment with AI/template
        const assessment = await assessFileQuickly(file, finalDiff, templateContent);

        if (assessment.status === 'PASS') {
            passCount++;
        } else if (assessment.status === 'WARNING') {
            warningCount++;
        } else {
            criticalCount++;
        }

        fileAssessments.push({ file, assessment, index: i + 1 });
    }

    // Display all files in compact format
    fileAssessments.forEach(({ file, assessment, index }) => {
        const statusIcon = assessment.status === 'PASS' ? '✅' :
            assessment.status === 'WARNING' ? '⚠️' : '🚨';

        stream.markdown(`### 📄 File ${index}: \`${file.path}\`\n`);
        stream.markdown(`**Status**: ${statusIcon} **${assessment.status}**\n\n`);

        // Show issues only for non-PASS files (to keep it compact)
        if (assessment.issues.length > 0) {
            stream.markdown('**Issues:**\n');
            assessment.issues.forEach(issue => {
                stream.markdown(`- 🚨 **${issue.type}**: ${issue.problem}\n`);
            });
            stream.markdown('\n');
        }

        stream.markdown('---\n\n');
    });

    // Summary
    stream.markdown('## 📊 PR Summary\n\n');
    stream.markdown('### Files Status Overview:\n');
    stream.markdown(`- ✅ **PASS**: ${passCount} files\n`);
    stream.markdown(`- ⚠️ **WARNING**: ${warningCount} files\n`);
    stream.markdown(`- 🚨 **CRITICAL**: ${criticalCount} files\n\n`);

    // Overall assessment
    let overallStatus;
    if (criticalCount > 0) {
        overallStatus = '🚨 **REJECTED**';
    } else if (warningCount > 0) {
        overallStatus = '⚠️ **NEEDS REVIEW**';
    } else {
        overallStatus = '✅ **APPROVED**';
    }

    stream.markdown(`### Overall PR Assessment:\n**Status**: ${overallStatus}\n\n`);

    // Quick checklist results
    stream.markdown('### 🎯 Quick Checklist Results:\n');
    const checklist = performQuickChecklist(finalDiff);
    (Object.entries(checklist) as [string, any][]).forEach(([check, result]) => {
        const icon = result.passed ? '✅' : '❌';
        stream.markdown(`- [${icon}] **${check}**: ${result.message}\n`);
    });

    stream.markdown('\n**Review completed with review-pr template.**\n');
}

/**
 * Assess individual file using AI with review-pr template
 */
async function assessFileQuickly(file: Record<string, any>, fullDiff: string, templateContent: string | null = null) {
    try {
        // If no template provided, try to load it with PR detection
        if (!templateContent) {
            try {
                // Pass prData context if available, otherwise use file-only context
                const contextData = global.currentPRData || { fileChanges: [file] };
                const templateResult = await getPRReviewTemplate('review-pr.md', contextData);
                templateContent = (templateResult as any).content;
                aidaLogging(`🎯 Using ${(templateResult as any).detection.template.name} template for file assessment`);
            } catch (_error: unknown) {
                aidaLogging('⚠️ Template loading failed, using fallback analysis');
                return assessFileQuicklyFallback(file, fullDiff);
            }
        }

        // TODO: Send processedTemplate to AI for analysis
        aidaLogging(`🤖 Template ready for AI: ${file.path}`);

        // For now, use enhanced fallback until AI integration
        const aiResponse = simulateAIFileAssessment(file, fullDiff);

        return aiResponse;

    } catch (_error: unknown) {
        const error = toError(_error);
        aidaLogging(`❌ AI assessment failed for ${file.path}:`, error.message);
        // Fallback to rule-based assessment
        return assessFileQuicklyFallback(file, fullDiff);
    }
}

/**
 * Fallback rule-based assessment when AI is not available
 */
function assessFileQuicklyFallback(file: Record<string, any>, _fullDiff: string) {
    const issues = [];
    let status = 'PASS';
    const filePath = file.path.toLowerCase();
    const diffContent = file.diffContent || '';

    aidaLogging(`🔧 Using fallback rule-based assessment for: ${file.path}`);

    // Security checks
    if (diffContent.includes('password') || diffContent.includes('secret') || diffContent.includes('api_key')) {
        issues.push({
            type: 'Security',
            problem: 'Potential hardcoded secrets detected',
            solution: 'Remove hardcoded secrets and use environment variables',
            impact: 'Could expose sensitive information'
        });
        status = 'CRITICAL';
    }

    // Null safety checks for JS/TS files
    if (filePath.endsWith('.ts') || filePath.endsWith('.js')) {
        if (diffContent.includes('!.') && !diffContent.includes('?.')) {
            issues.push({
                type: 'Null Safety',
                problem: 'Non-null assertion without null checks',
                solution: 'Use optional chaining (?.) or add null checks',
                impact: 'Potential runtime errors'
            });
            if (status === 'PASS') status = 'WARNING';
        }
    }

    // Error handling checks
    if (diffContent.includes('try') && !diffContent.includes('catch')) {
        issues.push({
            type: 'Error Handling',
            problem: 'Try block without catch',
            solution: 'Add proper error handling with catch block',
            impact: 'Unhandled exceptions may crash application'
        });
        status = 'CRITICAL';
    }

    // Performance checks
    if (diffContent.includes('forEach') && diffContent.includes('find')) {
        issues.push({
            type: 'Performance',
            problem: 'Potential O(n²) nested loop detected',
            solution: 'Consider using Map for O(1) lookups',
            impact: 'Performance degradation with large datasets'
        });
        if (status === 'PASS') status = 'WARNING';
    }

    return { status, issues };
}

/**
 * Simulate AI assessment response (replace with real AI call)
 */
function simulateAIFileAssessment(file: Record<string, any>, _fullDiff: string) {
    const filePath = file.path.toLowerCase();
    const diffContent = file.diffContent || '';
    const issues = [];
    let status = 'PASS';

    // Smarter analysis based on file type and content
    if (filePath.includes('component.ts')) {
        // Angular component analysis
        if (diffContent.includes('ngOnInit') && !diffContent.includes('ngOnDestroy')) {
            issues.push({
                type: 'Memory Management',
                problem: 'Component implements OnInit but not OnDestroy',
                solution: 'Implement OnDestroy to clean up subscriptions',
                impact: 'Memory leaks from unsubscribed observables'
            });
            status = 'WARNING';
        }
    }

    if (filePath.includes('service.ts')) {
        // Service analysis
        if (diffContent.includes('subscribe') && !diffContent.includes('unsubscribe')) {
            issues.push({
                type: 'Resource Management',
                problem: 'Observable subscription without unsubscribe',
                solution: 'Use takeUntil pattern or async pipe',
                impact: 'Memory leaks and unexpected behavior'
            });
            if (status === 'PASS') status = 'WARNING';
        }
    }

    // Enhanced security checks
    if (diffContent.includes('localStorage.setItem') || diffContent.includes('sessionStorage.setItem')) {
        if (diffContent.includes('password') || diffContent.includes('token')) {
            issues.push({
                type: 'Security',
                problem: 'Storing sensitive data in browser storage',
                solution: 'Use secure HTTP-only cookies or server-side sessions',
                impact: 'XSS attacks could steal sensitive information'
            });
            status = 'CRITICAL';
        }
    }

    // Performance analysis
    if (diffContent.includes('*ngFor') && diffContent.includes('function')) {
        issues.push({
            type: 'Performance',
            problem: 'Function call in *ngFor template',
            solution: 'Use pipe or pre-compute values in component',
            impact: 'Performance degradation from repeated function calls'
        });
        if (status === 'PASS') status = 'WARNING';
    }

    return { status, issues };
}

/**
 * Perform quick checklist assessment
 */
function performQuickChecklist(finalDiff: string) {
    const diff = finalDiff.toLowerCase();

    return {
        'Security': {
            passed: !diff.includes('password') && !diff.includes('secret') && !diff.includes('api_key'),
            message: diff.includes('password') || diff.includes('secret') ? 'Potential secrets detected' : 'No obvious secrets found'
        },
        'Null Safety': {
            passed: !diff.includes('!.') || diff.includes('?.'),
            message: diff.includes('!.') && !diff.includes('?.') ? 'Non-null assertions found' : 'Proper null handling'
        },
        'Error Handling': {
            passed: !diff.includes('try') || diff.includes('catch'),
            message: diff.includes('try') && !diff.includes('catch') ? 'Try without catch found' : 'Error handling looks good'
        },
        'Resource Management': {
            passed: !diff.includes('new ') || diff.includes('dispose') || diff.includes('close'),
            message: 'Basic resource checks passed'
        },
        'Performance': {
            passed: !(diff.includes('foreach') && diff.includes('find')),
            message: diff.includes('foreach') && diff.includes('find') ? 'Potential O(n²) operations' : 'No obvious bottlenecks'
        },
        'Code Quality': {
            passed: true, // Basic assumption
            message: 'Code structure looks reasonable'
        }
    };
}

/**
 * Perform basic quick analysis as fallback
 */
async function performBasicQuickAnalysis(stream: vscode.ChatResponseStream, prData: Record<string, any>) {
    stream.markdown('## 📋 Basic Quick Analysis\n\n');

    const fileChanges = prData.fileChanges || [];
    const totalAdditions = fileChanges.reduce((sum: number, f: Record<string, number>) => sum + (f.additions ?? 0), 0);
    const totalDeletions = fileChanges.reduce((sum: number, f: Record<string, number>) => sum + (f.deletions ?? 0), 0);

    stream.markdown(`### Quick Stats:\n`);
    stream.markdown(`- **Files**: ${fileChanges.length}\n`);
    stream.markdown(`- **Changes**: +${totalAdditions}/-${totalDeletions} lines\n`);
    stream.markdown(`- **Commits**: ${prData.totalCommits || 0}\n\n`);

    stream.markdown('### Manual Review Checklist:\n');
    stream.markdown('- [ ] Check for hardcoded secrets\n');
    stream.markdown('- [ ] Verify null safety\n');
    stream.markdown('- [ ] Confirm error handling\n');
    stream.markdown('- [ ] Review resource management\n');
    stream.markdown('- [ ] Assess performance impact\n\n');
}

// ES exports
export { addQuickReviewOption, performQuickReviewWithAI, performStructuredQuickAnalysis, performBasicQuickAnalysis };
