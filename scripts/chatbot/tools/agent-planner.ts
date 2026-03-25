/**
 * @module chatbot/tools/agent-planner
 * @description Agent task planning — creates execution plans for user requests.
 * Extracted from chatbot-agent.ts during Sprint 3 refactoring.
 */

import * as vscode from 'vscode';

export const agentPlannerMethods = {

    async createAgentPlan(this: any, userRequest: string, currentFileContext: Record<string, any> | null = null) {
        const lowerRequest = userRequest.toLowerCase();

        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        const projectType = await this.detectProjectType(workspaceFolder!);

        const context: Record<string, any> = {
            projectType,
            userRequest,
            currentFile: currentFileContext,
            workspaceFolder: workspaceFolder?.uri.fsPath
        };

        if (currentFileContext?.hasFile) {
            context.currentFileName = currentFileContext.fileName;
            context.currentFilePath = currentFileContext.filePath;
            context.currentFileContent = currentFileContext.content;
            context.currentFileAnalysis = currentFileContext.analysis;
        }

        const isCurrentFileOperation = currentFileContext?.hasFile && (
            lowerRequest.includes('this file') ||
            lowerRequest.includes('current file') ||
            lowerRequest.includes('refactor this') ||
            lowerRequest.includes('analyze this') ||
            (lowerRequest.includes('refactor') && !lowerRequest.includes('create') && !lowerRequest.includes('new')) ||
            (lowerRequest.includes('analyze') && !lowerRequest.includes('create') && !lowerRequest.includes('new')) ||
            lowerRequest.includes('review code') ||
            lowerRequest.includes('improve code') ||
            lowerRequest.includes('optimize code') ||
            lowerRequest.includes('fix code') ||
            lowerRequest.includes('clean up') ||
            lowerRequest.includes('modernize') ||
            lowerRequest.includes('best practices') ||
            (lowerRequest.includes('add') && (lowerRequest.includes('type') || lowerRequest.includes('interface')))
        );

        if (isCurrentFileOperation) {
            if (lowerRequest.includes('refactor') || lowerRequest.includes('improve') || lowerRequest.includes('modernize') || lowerRequest.includes('clean up')) {
                return this.planRefactorCode(context);
            } else if (lowerRequest.includes('analyze') || lowerRequest.includes('review')) {
                return this.planAnalyzeCode(context);
            } else if (lowerRequest.includes('fix')) {
                return this.planFixErrors(context);
            } else if (lowerRequest.includes('test')) {
                return this.planGenerateTests(context);
            }
            return this.planAnalyzeCode(context);
        } else if (lowerRequest.includes('create component') || lowerRequest.includes('@create-component')) {
            const componentName = this.extractComponentName(userRequest);
            context.componentName = componentName;
            return this.planCreateComponent(context);
        } else if (lowerRequest.includes('fix error') || lowerRequest.includes('@fix-errors')) {
            return this.planFixErrors(context);
        } else if (lowerRequest.includes('generate test') || lowerRequest.includes('@generate-tests')) {
            return this.planGenerateTests(context);
        } else if (lowerRequest.includes('analyze') || lowerRequest.includes('review')) {
            return this.planAnalyzeCode(context);
        } else {
            return this.planGeneralTask(context);
        }
    },

    async detectProjectType(this: any, workspaceFolder: vscode.WorkspaceFolder) {
        if (!workspaceFolder) return 'unknown';

        const tools = this.getAgentTools();

        try {
            const angularJson = await tools.readFile(workspaceFolder.uri.fsPath + '/angular.json');
            if (angularJson.success) return 'angular';
        } catch (_e: unknown) { /* framework detection: angular.json not found */ }

        try {
            const packageJson = await tools.readFile(workspaceFolder.uri.fsPath + '/package.json');
            if (packageJson.success && packageJson.content!.includes('react')) return 'react';
        } catch (_e: unknown) { /* framework detection */ }

        try {
            const packageJson = await tools.readFile(workspaceFolder.uri.fsPath + '/package.json');
            if (packageJson.success && packageJson.content!.includes('vue')) return 'vue';
        } catch (_e: unknown) { /* framework detection */ }

        return 'javascript';
    },

    planCreateComponent(this: any, context: Record<string, any>) {
        const componentName = context.componentName || this.extractComponentName(context.userRequest);

        if (context.projectType === 'angular') {
            return {
                objective: `Create Angular component: ${componentName}`,
                steps: [
                    { id: 1, action: 'analyze_structure', description: 'Analyze Angular project structure', tools: ['fs_read', 'fs_list'] },
                    { id: 2, action: 'create_component_files', description: `Create ${componentName} component files`, tools: ['fs_create'] },
                    { id: 3, action: 'update_module', description: 'Update module imports', tools: ['fs_edit'] },
                    { id: 4, action: 'generate_tests', description: 'Generate component tests', tools: ['fs_create'] }
                ],
                context: { ...context, componentName }
            };
        }

        return {
            objective: `Create ${context.projectType} component: ${componentName}`,
            steps: [
                { id: 1, action: 'create_component', description: `Create ${componentName} component`, tools: ['fs_create'] }
            ],
            context: { ...context, componentName }
        };
    },

    planRefactorCode(_context: Record<string, any>) {
        return {
            objective: `🔧 Auto-Refactor: ${_context.currentFileName || 'Current file'}`,
            steps: [
                { id: 1, action: 'analyze_code', description: 'Analyze current file structure and identify issues', tools: ['fs_read', 'vscode_diagnostics'] },
                { id: 2, action: 'apply_refactoring', description: 'Auto-apply AI-powered refactoring improvements', tools: ['fs_edit', 'ai_analysis'] },
                { id: 3, action: 'verify_refactoring', description: 'Verify refactoring maintains functionality', tools: ['vscode_diagnostics', 'test_run'] }
            ],
            context: _context
        };
    },

    planFixErrors(_context: Record<string, any>) {
        return {
            objective: 'Fix code errors automatically',
            steps: [
                { id: 1, action: 'scan_errors', description: 'Scan for errors and warnings', tools: ['vscode_diagnostics'] },
                { id: 2, action: 'categorize_errors', description: 'Categorize and prioritize errors', tools: ['code_analyze'] },
                { id: 3, action: 'apply_fixes', description: 'Apply automatic fixes', tools: ['fs_edit'] },
                { id: 4, action: 'validate_fixes', description: 'Validate fixes work correctly', tools: ['terminal_run'] }
            ],
            context: _context
        };
    },

    planGenerateTests(_context: Record<string, any>) {
        return {
            objective: 'Generate comprehensive tests',
            steps: [
                { id: 1, action: 'analyze_code_for_testing', description: 'Analyze code to identify test cases', tools: ['fs_read'] },
                { id: 2, action: 'generate_unit_tests', description: 'Generate unit tests', tools: ['fs_create'] },
                { id: 3, action: 'generate_integration_tests', description: 'Generate integration tests', tools: ['fs_create'] },
                { id: 4, action: 'run_tests', description: 'Run tests to verify they work', tools: ['terminal_run'] }
            ],
            context: _context
        };
    },

    planAnalyzeCode(_context: Record<string, any>) {
        return {
            objective: 'Analyze and review current file',
            steps: [
                { id: 1, action: 'read_current_file', description: 'Read and parse current file structure', tools: ['fs_read'] },
                { id: 2, action: 'analyze_code_structure', description: 'Analyze code patterns and structure', tools: ['analysis'] },
                { id: 3, action: 'check_best_practices', description: 'Check for best practices and potential improvements', tools: ['analysis'] },
                { id: 4, action: 'generate_recommendations', description: 'Generate improvement recommendations', tools: ['analysis'] }
            ],
            context: _context
        };
    },

    planGeneralTask(_context: Record<string, any>) {
        return {
            objective: 'Execute general development task',
            steps: [
                { id: 1, action: 'analyze_request', description: 'Analyze user request and context', tools: ['fs_read'] },
                { id: 2, action: 'execute_task', description: 'Execute the requested task', tools: ['fs_create', 'fs_edit', 'terminal_run'] },
                { id: 3, action: 'verify_result', description: 'Verify task completion', tools: ['fs_read'] }
            ],
            context: _context
        };
    },

    extractComponentName(_request: string) {
        const matches = _request.match(/(?:create|component)\s+([a-zA-Z][a-zA-Z0-9]*)/i);
        return matches ? matches[1] : 'NewComponent';
    },

};
