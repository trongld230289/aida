/**
 * Context Engine Core Sub-Module
 * Contains the ChatbotContextEngine class which orchestrates all sub-modules.
 */

import ContextDetector from './context-detector';
import { aidaLogging } from '../core/settings';
import type { IFileContext, IEditorContext } from './interfaces';
import type { IContextDecision } from './interfaces/chat-host.interface';
import { toError } from '../core/error-utils';

// Sub-module imports
import {
    extractSemanticFeatures,
    normalizeMixedLanguage,
    LanguageDetector,
    SemanticAnalyzer,
    ContextRelevanceScorer,
} from './semantic-detection';

import {
    calculateCodeAnalysisScore,
    calculateCodeModificationScore,
    calculateCodeCreationScore,
    calculateGeneralQuestionScore,
} from './intent-scorers';
import type { IIntentResult } from './intent-scorers';

import {
    analyzeContextIntent,
    analyzeLinguisticPatterns,
    calculateContextRelevance,
    makeContextDecision,
    makeUniversalContextDecision,
} from './context-decision';

// ── Interfaces ─────────────────────────────────────────────

interface IProcessedInput {
    type: string;
    originalText: string;
    cleanText: string;
    language: string;
    ocrText?: string;
    hasImages?: boolean;
}

// ── Main Class ─────────────────────────────────────────────

class ChatbotContextEngine {
    private languageDetector: LanguageDetector;
    private semanticAnalyzer: SemanticAnalyzer;

    contextDetector: Record<string, any>;
    contextScorer: Record<string, any>;
    initialized: boolean;
    semanticCache: Map<string, unknown>;
    intentPatterns: Record<string, any>;

    constructor() {
        this.initialized = false;
        this.semanticCache = new Map();
        this.intentPatterns = this.loadIntentPatterns();
        this.languageDetector = new LanguageDetector();
        this.semanticAnalyzer = new SemanticAnalyzer();
        this.contextScorer = new ContextRelevanceScorer();

        // Initialize the new context detector
        this.contextDetector = new ContextDetector();
    }

    // ── Public API ─────────────────────────────────────────

    /**
     * Enhanced shouldIncludeContent using the new detector
     */
    async shouldIncludeContent(userMessage: string, editorContext: IEditorContext = {}) {
        try {
            const decision = await this.contextDetector.shouldIncludeContent(userMessage, editorContext);

            aidaLogging('🔍 Context Detection Result:', {
                message: userMessage.substring(0, 50) + (userMessage.length > 50 ? '...' : ''),
                includeContent: decision.includeContent,
                confidence: decision.confidence,
                method: decision.method,
                language: decision.language,
                reasons: decision.reasons
            });

            return decision;
        } catch (_error: unknown) {
            const error = toError(_error);
            aidaLogging('❌ Context detection error:', error);
            return {
                includeContent: !!editorContext.selectedText,
                confidence: 50,
                reasons: ['Fallback due to error: ' + error.message],
                language: 'en',
                method: 'fallback'
            };
        }
    }

    /**
     * Get performance report from context detector
     */
    getContextDetectorReport() {
        return this.contextDetector.getPerformanceReport();
    }

    /**
     * Main decision engine – determines if current file context should be included
     */
    async shouldIncludeContext(
        userInput: string,
        currentFileContext: IFileContext | null = null,
        conversationHistory: unknown[] = []
    ) {
        try {
            // Step 1: Multimodal Input Processing
            const processedInput = await this.processMultimodalInput(userInput);

            // Step 2: Intent Classification using ML
            const intentResult = await this.classifyIntent(processedInput.cleanText);

            // Step 3: Linguistic Pattern Analysis
            const linguisticAnalysis = analyzeLinguisticPatterns(processedInput.cleanText);

            // Step 4: Context Relevance Scoring
            const contextScore = calculateContextRelevance(
                processedInput.cleanText,
                currentFileContext,
                intentResult,
                conversationHistory
            );

            // Step 5: Multi-layer Decision Algorithm
            const decision = makeContextDecision({
                intent: intentResult,
                linguistic: linguisticAnalysis,
                contextScore,
                hasActiveFile: !!currentFileContext?.hasFile,
                inputType: processedInput.type
            });

            return {
                shouldInclude: decision.include,
                confidence: decision.confidence,
                reasoning: decision.reasoning,
                intent: intentResult.intent,
                patterns: linguisticAnalysis.patterns,
                contextRelevance: contextScore
            };
        } catch (error: unknown) {
            aidaLogging('Context decision engine error:', error);
            return this.fallbackDecision(userInput, currentFileContext);
        }
    }

    /**
     * Universal semantic-based context decision (delegates to sub-module)
     */
    makeUniversalContextDecision(
        userMessage: string,
        contextDecision: IContextDecision,
        currentFileContext: IFileContext | null
    ) {
        return makeUniversalContextDecision(userMessage, contextDecision, currentFileContext);
    }

    /**
     * Extract semantic features (delegates to sub-module)
     */
    extractSemanticFeatures(text: string) {
        return extractSemanticFeatures(text);
    }

    // ── Internal Methods ───────────────────────────────────

    /**
     * Process multimodal input (text, images, OCR)
     */
    async processMultimodalInput(input: string): Promise<IProcessedInput> {
        if (typeof input === 'string') {
            return {
                type: 'text',
                originalText: input,
                cleanText: this.preprocessText(input),
                language: this.languageDetector.detect(input)
            };
        }

        return {
            type: 'text',
            originalText: (input as any).text || input,
            cleanText: this.preprocessText((input as any).text || input),
            language: this.languageDetector.detect((input as any).text || input)
        };
    }

    /**
     * Advanced text preprocessing with OCR noise handling
     */
    preprocessText(text: string): string {
        if (!text || typeof text !== 'string') return '';

        let processed = text;

        const ocrCorrections: Record<string, string> = {
            '1ãm': 'làm',
            'c0de': 'code',
            '5ửa': 'sửa',
            '0': 'o',
            '1': 'l',
            '5': 's',
            'rn': 'm',
            'đoạn c0de': 'đoạn code',
            'fi1e': 'file',
            'th1s': 'this'
        };

        (Object.entries(ocrCorrections) as [string, any][]).forEach(([error, correct]) => {
            processed = processed.replace(new RegExp(error, 'gi'), correct);
        });

        processed = processed
            .toLowerCase()
            .trim()
            .replace(/[^\w\s\u00C0-\u024F\u1E00-\u1EFF]/g, ' ')
            .replace(/\s+/g, ' ');

        processed = normalizeMixedLanguage(processed);

        return processed;
    }

    /**
     * Intent Classification using pattern matching + semantic analysis
     */
    async classifyIntent(cleanText: string): Promise<IIntentResult> {
        const primaryIntent = this.classifyPrimaryIntent(cleanText);
        const contextIntent = analyzeContextIntent(cleanText);
        const semanticIntent = await this.semanticAnalyzer.classifyIntent(cleanText);

        return {
            intent: primaryIntent.intent,
            confidence: (primaryIntent.confidence + contextIntent.confidence + semanticIntent.confidence) / 3,
            needsContext: contextIntent.needsContext || semanticIntent.needsContext,
            category: primaryIntent.category,
            subcategory: contextIntent.subcategory
        };
    }

    /**
     * Universal primary intent classification (language-agnostic)
     */
    classifyPrimaryIntent(text: string) {
        const semanticFeatures = extractSemanticFeatures(text);

        const intentScores: Record<string, any> = {
            code_analysis: calculateCodeAnalysisScore(semanticFeatures, text),
            code_modification: calculateCodeModificationScore(semanticFeatures, text),
            code_creation: calculateCodeCreationScore(semanticFeatures, text),
            general_question: calculateGeneralQuestionScore(semanticFeatures, text)
        };

        let bestMatch: Record<string, any> = { intent: 'general', confidence: 0.3, category: 'unknown' };

        for (const [intent, scoreData] of (Object.entries(intentScores))) {
            if (scoreData.confidence > bestMatch.confidence) {
                bestMatch = {
                    intent,
                    confidence: scoreData.confidence,
                    category: scoreData.category,
                    semanticBasis: scoreData.reasoning
                };
            }
        }

        return bestMatch;
    }

    /**
     * Fallback decision for errors
     */
    fallbackDecision(userInput: string, currentFileContext: IFileContext | null) {
        const text = typeof userInput === 'string' ? userInput : (userInput as any).text || '';
        const isCodeQuestion = /\b(analyze|review|refactor|fix|explain|làm gì|chức năng)\b/i.test(text);
        const hasFileReference = /\b(this|current|file|code|này)\b/i.test(text);

        return {
            shouldInclude: isCodeQuestion && hasFileReference && currentFileContext?.hasFile,
            confidence: 0.5,
            reasoning: ['Fallback decision based on basic patterns'],
            intent: 'unknown',
            patterns: {},
            contextRelevance: 0.5
        };
    }

    /**
     * Load intent patterns from configuration
     */
    loadIntentPatterns(): Record<string, string[]> {
        return {
            codeInteraction: ['analyze', 'review', 'explain', 'refactor', 'làm gì', 'chức năng'],
            codeGeneration: ['create', 'generate', 'make', 'tạo', 'sinh'],
            generalHelp: ['help', 'how to', 'tutorial', 'giúp', 'hướng dẫn']
        };
    }
}

export { ChatbotContextEngine };
