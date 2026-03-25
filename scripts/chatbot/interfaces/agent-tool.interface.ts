/**
 * Agent Tool Interface definitions
 * Interfaces for the agentic chatbot system
 */

export interface IToolResult {
    success: boolean;
    data?: unknown;
    error?: string;
    output?: string;
    [key: string]: unknown;
}

export interface IAgentTool {
    name: string;
    description: string;
    execute(params: Record<string, unknown>): Promise<IToolResult>;
}

export interface IAgentTools {
    [toolName: string]: IAgentTool;
}

export interface IExecutionStep {
    tool: string;
    params: Record<string, unknown>;
    reasoning?: string;
    result?: IToolResult;
    status?: 'pending' | 'running' | 'completed' | 'failed';
}

export interface IPlanContext {
    userMessage: string;
    fileContext?: Record<string, unknown>;
    history?: unknown[];
    [key: string]: unknown;
}

export interface IExecutionPlan {
    steps: IExecutionStep[];
    context: IPlanContext;
    summary?: string;
}

export interface ICodeTemplate {
    name: string;
    language: string;
    template: string;
    variables?: Record<string, string>;
}

export interface ICodeGenerationResult {
    code: string;
    language: string;
    explanation?: string;
    template?: string;
}
