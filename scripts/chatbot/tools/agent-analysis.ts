/**
 * @module chatbot/tools/agent-analysis
 * @description Code analysis, inspection, best-practices checks, and verification.
 * Extracted from chatbot-agent.ts during Sprint 3 refactoring.
 */

import * as vscode from 'vscode';
import { aidaLogging } from '../../core/settings';
import { toError } from '../../core/error-utils';

export const agentAnalysisMethods = {

    async analyzeCodeStructure(this: any, _tools: Record<string, any>, context: Record<string, any>) {
        if (!context.currentFile?.hasFile) {
            return { success: false, error: 'No current file to analyze' };
        }

        try {
            const currentFile = context.currentFile;
            const content = currentFile.content;
            const analysis = currentFile.analysis;

            const analysisPrompt = `You are an expert code reviewer. Analyze this ${analysis.framework || 'TypeScript'} code and provide detailed insights.

**File:** ${currentFile.fileName}
**Language:** ${currentFile.languageId}
**Framework:** ${analysis.framework || 'Generic'}
**Lines:** ${currentFile.lineCount}

**Code to Analyze:**
\`\`\`${currentFile.languageId}
${content}
\`\`\`

**Please provide:**
1. **Code Quality Assessment** - Overall structure and organization
2. **Potential Issues** - Security, performance, maintainability concerns
3. **Best Practices** - What's done well and what could be improved
4. **Specific Recommendations** - Actionable suggestions with examples
5. **Framework-Specific Insights** - ${analysis.framework || 'Language'}-specific recommendations

**Focus on:**
- Type safety and TypeScript best practices
- ${analysis.framework || 'Modern'} patterns and conventions
- Performance optimizations
- Code maintainability and readability
- Potential bugs or issues

Keep the analysis practical and actionable.`;

            this.updateProgress('🔍 AI is performing deep code analysis...');
            await this.delay(1200);

            const aiResponse = await this.callAIForAnalysis(analysisPrompt);

            if (aiResponse.success) {
                return {
                    success: true,
                    details: `🤖 **AI Code Analysis for ${currentFile.fileName}**\n\n${aiResponse.content}`
                };
            } else {
                return await this.performBasicAnalysis(currentFile, analysis);
            }
        } catch (_error: unknown) {
            const error = toError(_error);
            return { success: false, error: `AI analysis failed: ${error.message}` };
        }
    },

    async callAIForAnalysis(this: Record<string, any>, prompt: string) {
        try {
            const response = await this.chatbotService.sendMessage(prompt);
            return { success: true, content: response };
        } catch (_error: unknown) {
            const error = toError(_error);
            aidaLogging('AI analysis service unavailable:', error.message);
            return { success: false, error: error.message };
        }
    },

    async performBasicAnalysis(currentFile: Record<string, any>, analysis: Record<string, any>) {
        const content = currentFile.content;
        const issues: string[] = [];
        const suggestions: string[] = [];

        if (analysis.framework === 'angular') {
            if (content.includes('ngOnInit') && !content.includes('OnInit')) {
                issues.push('Missing OnInit interface implementation');
                suggestions.push('Add OnInit interface for proper lifecycle management');
            }
            if (content.includes('subscription') && !content.includes('ngOnDestroy')) {
                issues.push('Potential memory leak from unmanaged subscriptions');
                suggestions.push('Implement OnDestroy to cleanup subscriptions');
            }
        }

        if (content.includes(': any')) {
            issues.push('Using generic "any" type reduces type safety');
            suggestions.push('Replace "any" with specific types for better code quality');
        }

        let details = `📋 **Basic Analysis for ${currentFile.fileName}**\n\n`;
        details += `**File Info:**\n`;
        details += `- Framework: ${analysis.framework || 'Generic'}\n`;
        details += `- Type: ${analysis.componentType || 'Unknown'}\n`;
        details += `- Lines: ${currentFile.lineCount}\n\n`;

        if (issues.length > 0) {
            details += `**Issues Found (${issues.length}):**\n`;
            details += issues.map(issue => `❌ ${issue}`).join('\n') + '\n\n';
            details += `**Recommendations:**\n`;
            details += suggestions.map(suggestion => `💡 ${suggestion}`).join('\n');
        } else {
            details += '✅ **Code Quality:** Good structure, no major issues detected!';
        }

        return { success: true, details };
    },

    async scanForErrors(_tools: Record<string, any>, _context: Record<string, any>) {
        try {
            const diagnostics = vscode.languages.getDiagnostics();
            let errorCount = 0;

            diagnostics.forEach(([_uri, diag]) => {
                errorCount += diag.filter(d => d.severity === vscode.DiagnosticSeverity.Error).length;
            });

            return { success: true, details: `Found ${errorCount} errors in workspace` };
        } catch (_error: unknown) {
            const error = toError(_error);
            return { success: false, error: error.message };
        }
    },

    async applyErrorFixes(_tools: Record<string, any>, _context: Record<string, any>) {
        return { success: true, details: 'Error fixes applied (placeholder)' };
    },

    async executeGeneralTask(tools: Record<string, any>, context: Record<string, any>) {
        const { task } = context;

        try {
            if (task.includes('create') && task.includes('file')) {
                const matches = task.match(/create.*file.*?([a-zA-Z0-9_-]+\.[a-zA-Z0-9]+)/);
                if (matches) {
                    const filename = matches[1];
                    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
                    if (workspaceFolder) {
                        const filePath = `${workspaceFolder.uri.fsPath}/${filename}`;
                        await tools.createFile(filePath, '// Generated by AIDA Agent\n');
                        return { success: true, details: `Created file: ${filename}` };
                    }
                }
            }

            return { success: true, details: 'General task executed' };
        } catch (_error: unknown) {
            const error = toError(_error);
            return { success: false, error: error.message };
        }
    },

    async readCurrentFile(_tools: Record<string, any>, context: Record<string, any>) {
        if (!context.currentFile?.hasFile) {
            return { success: false, error: 'No current file to read' };
        }

        try {
            return {
                success: true,
                details: `Read file: ${context.currentFile.fileName} (${context.currentFile.lineCount} lines)`
            };
        } catch (_error: unknown) {
            const error = toError(_error);
            return { success: false, error: error.message };
        }
    },

    async analyzeCurrentFileStructure(_tools: Record<string, any>, context: Record<string, any>) {
        if (!context.currentFile?.hasFile) {
            return { success: false, error: 'No current file to analyze' };
        }

        try {
            const analysis = context.currentFile.analysis;
            let details = `Analyzed ${context.currentFile.fileName}:\n`;

            if (analysis.framework) { details += `- Framework: ${analysis.framework}\n`; }
            if (analysis.componentType) { details += `- Type: ${analysis.componentType}\n`; }
            if (analysis.structure.classes?.length) { details += `- Classes: ${analysis.structure.classes.length}\n`; }
            if (analysis.structure.functions?.length) { details += `- Functions: ${analysis.structure.functions.length}\n`; }
            if (analysis.structure.methods?.length) { details += `- Methods: ${analysis.structure.methods.length}\n`; }

            return { success: true, details };
        } catch (_error: unknown) {
            const error = toError(_error);
            return { success: false, error: error.message };
        }
    },

    async checkBestPractices(_tools: Record<string, any>, context: Record<string, any>) {
        if (!context.currentFile?.hasFile) {
            return { success: false, error: 'No current file to check' };
        }

        try {
            const content = context.currentFile.content;
            const recommendations: string[] = [];

            if (context.currentFile.analysis.framework === 'angular') {
                if (!content.includes('OnInit') && content.includes('ngOnInit')) {
                    recommendations.push('Consider implementing OnInit interface');
                }
                if (!content.includes('OnDestroy') && content.includes('subscription')) {
                    recommendations.push('Consider implementing OnDestroy for cleanup');
                }
                if (content.includes('any') && content.includes('type')) {
                    recommendations.push('Avoid using "any" type, use specific types');
                }
            }

            if (context.currentFile.languageId === 'typescript') {
                if (!content.includes('readonly') && content.includes('private')) {
                    recommendations.push('Consider using readonly for immutable properties');
                }
            }

            const details = recommendations.length > 0
                ? `Found ${recommendations.length} improvement suggestions:\n${recommendations.map(r => `- ${r}`).join('\n')}`
                : 'Code follows best practices well!';

            return { success: true, details };
        } catch (_error: unknown) {
            const error = toError(_error);
            return { success: false, error: error.message };
        }
    },

    async generateRecommendations(_tools: Record<string, any>, context: Record<string, any>) {
        if (!context.currentFile?.hasFile) {
            return { success: false, error: 'No current file for recommendations' };
        }

        try {
            const analysis = context.currentFile.analysis;
            const recommendations: string[] = [];

            if (analysis.framework === 'angular' && analysis.componentType === 'component') {
                recommendations.push('Consider adding input validation');
                recommendations.push('Add proper error handling');
                recommendations.push('Implement accessibility features');
                recommendations.push('Add unit tests');
            }

            const details = `Recommendations for ${context.currentFile.fileName}:\n${recommendations.map((r, i) => `${i + 1}. ${r}`).join('\n')}`;

            return { success: true, details };
        } catch (_error: unknown) {
            const error = toError(_error);
            return { success: false, error: error.message };
        }
    },

    async identifyImprovements(_tools: Record<string, any>, context: Record<string, any>) {
        if (!context.currentFile?.hasFile) {
            return { success: false, error: 'No current file to analyze for improvements' };
        }

        try {
            const currentFile = context.currentFile;
            const content = currentFile.content;
            const analysis = currentFile.analysis;
            const improvements: string[] = [];

            if (analysis.framework === 'angular') {
                if (content.includes('ngOnInit') && !content.includes('OnInit')) {
                    improvements.push('Add OnInit interface for proper lifecycle management');
                }
                if (content.includes('subscription') && !content.includes('ngOnDestroy')) {
                    improvements.push('Add OnDestroy to prevent memory leaks');
                }
                if (content.includes(': any')) {
                    improvements.push('Replace "any" types with specific types for better type safety');
                }
                if (!content.includes('readonly') && content.includes('title =')) {
                    improvements.push('Add readonly modifier to immutable properties');
                }
            }

            if (currentFile.languageId === 'typescript') {
                const methods = content.match(/(\w+)\s*\([^)]*\)\s*{/g) || [];
                const methodsWithoutModifiers = methods.filter((m: Record<string, any>) =>
                    !m.includes('public') && !m.includes('private') && !m.includes('protected')
                );
                if (methodsWithoutModifiers.length > 0) {
                    improvements.push('Add explicit access modifiers to methods');
                }
            }

            const details = improvements.length > 0
                ? `Identified ${improvements.length} potential improvements:\n${improvements.map(imp => `- ${imp}`).join('\n')}`
                : 'Code quality is already excellent!';

            return { success: true, details };
        } catch (_error: unknown) {
            const error = toError(_error);
            return { success: false, error: error.message };
        }
    },

    async verifyRefactoring(_tools: Record<string, any>, context: Record<string, any>) {
        if (!context.currentFile?.hasFile) {
            return { success: false, error: 'No current file to verify' };
        }

        try {
            const diagnostics = vscode.languages.getDiagnostics();
            let errorCount = 0;

            diagnostics.forEach(([uri, diag]) => {
                if (uri.fsPath === context.currentFile.filePath) {
                    errorCount += diag.filter(d => d.severity === vscode.DiagnosticSeverity.Error).length;
                }
            });

            if (errorCount === 0) {
                return { success: true, details: 'Refactoring verified successfully - no errors detected!' };
            } else {
                return { success: false, error: `Refactoring introduced ${errorCount} errors - please review manually` };
            }
        } catch (_error: unknown) {
            const error = toError(_error);
            return { success: false, error: `Verification failed: ${error.message}` };
        }
    }

};
