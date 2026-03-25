/**
 * Chat Host Interface definitions
 * Core interfaces for the chatbot system
 */

export interface IChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp?: number;
    images?: string[];
    isStreaming?: boolean;
}

export interface IFileContext {
    fileName?: string;
    languageId?: string;
    selectedText?: string;
    fileContent?: string;
    analysis?: string;
    summary?: string;
    lineCount?: number;
    [key: string]: unknown;
}

export interface IFileAnalysis {
    imports: string[];
    exports: string[];
    functions: string[];
    classes: string[];
    complexity: number;
    [key: string]: unknown;
}

export interface IChatHost {
    postMessage(message: string): void;
    onDidReceiveMessage(callback: (message: string) => void): void;
}

export interface IChatbotService {
    processMessage(message: string, history: IChatMessage[], options?: ISendMessageOptions): Promise<string>;
    generateResponse(prompt: string, context?: Record<string, unknown>): Promise<string>;
}

export interface ISendMessageOptions {
    includeContext?: boolean;
    model?: string;
    temperature?: number;
    maxTokens?: number;
    images?: string[];
    stream?: boolean;
    [key: string]: unknown;
}

export interface IChatbotContextEngine {
    shouldIncludeContent(userMessage: string, editorContext?: IEditorContext): Promise<IContextDecision>;
    getPerformanceReport(): IPerformanceReport;
}

export interface IEditorContext {
    fileName?: string;
    languageId?: string;
    selectedText?: string;
    fileContent?: string;
    lineCount?: number;
    [key: string]: unknown;
}

export interface IContextDecision {
    includeContent: boolean;
    confidence: number;
    reasons: string[];
    language: string;
    method: string;
    [key: string]: unknown;
}

export interface IPerformanceReport {
    totalRequests: number;
    contextIncluded: number;
    avgConfidence: number;
    avgProcessingTime: number;
    cacheHits: number;
    [key: string]: unknown;
}
