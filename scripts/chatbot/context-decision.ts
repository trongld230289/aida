/**
 * Context Decision Sub-Module
 * Provides context-scoring helpers, linguistic analysis, and multi-layer decision logic.
 */

import { aidaLogging } from '../core/settings';
import { extractSemanticFeatures } from './semantic-detection';
import type { ISemanticFeatures } from './semantic-detection';
import type { IIntentResult } from './intent-scorers';
import type { IFileContext } from './interfaces';
import type { IContextDecision } from './interfaces/chat-host.interface';

// ── Interfaces ─────────────────────────────────────────────

export interface IDecision {
    include: boolean;
    confidence: number;
    reasoning: string[];
}

// ── Constants ──────────────────────────────────────────────

export const DECISION_CONFIDENCE_THRESHOLD = 0.3;
export const HIGH_INTENT_CONFIDENCE = 0.7;
export const HIGH_MODIFICATION_CONFIDENCE = 0.8;
export const CONTEXT_RELEVANCE_THRESHOLD = 0.6;
export const SEMANTIC_THRESHOLD = 0.6;

// ── Explicit / Implicit / No-Context Score ─────────────────

/**
 * Calculate explicit file reference score
 */
export function calculateExplicitFileScore(semanticFeatures: ISemanticFeatures, text: string) {
    let score = 0;
    const reasoning: string[] = [];

    const explicitFilePatterns = /\b(this file|current file|this code|current code|active file|open file)\b/i;
    const explicitInOtherLangs = /\b(file này|tệp này|code này|mã này|file hiện tại|tệp hiện tại|este archivo|este código|ce fichier|ce code|diese datei|dieser code|questo file|questo codice|arquivo atual|código atual)\b/i;

    if (explicitFilePatterns.test(text) || explicitInOtherLangs.test(text)) {
        score += 0.8;
        reasoning.push('explicit file/code reference detected');
    }

    if (semanticFeatures.hasProximalReferences && semanticFeatures.hasCodeEntityReferences) {
        score += 0.4;
        reasoning.push('proximal reference with code entities');
    }

    if (semanticFeatures.hasCodeActionVerbs && semanticFeatures.hasProximalReferences) {
        score += 0.3;
        reasoning.push('code action with proximal reference');
    }

    return {
        needsContext: true,
        confidence: Math.min(score, 1.0),
        subcategory: 'explicit_reference',
        reasoning
    };
}

/**
 * Calculate implicit file reference score
 */
export function calculateImplicitFileScore(semanticFeatures: ISemanticFeatures, text: string) {
    let score = 0;
    const reasoning: string[] = [];

    const modificationPatterns = /\b(refactor|improve|optimize|fix|analyze|review|explain)\b/i;
    const modificationInOtherLangs = /\b(sửa|cải thiện|tối ưu|phân tích|xem xét|giải thích|arreglar|mejorar|analizar|revisar|corriger|améliorer|analyser|réviser|reparieren|verbessern|analysieren|corrigir|melhorar|analisar)\b/i;
    const creationPatterns = /\b(create|new|generate|make|build|add)\b/i;
    const creationInOtherLangs = /\b(tạo|mới|sinh|viết|xây dựng|thêm|crear|nuevo|generar|faire|nouveau|créer|neu|erstellen|novo|criar)\b/i;

    const hasModification = modificationPatterns.test(text) || modificationInOtherLangs.test(text);
    const hasCreation = creationPatterns.test(text) || creationInOtherLangs.test(text);

    if (hasModification && !hasCreation) {
        score += 0.6;
        reasoning.push('modification without creation indicates current file');
    }

    if (semanticFeatures.hasCurrentStateInquiries) {
        score += 0.4;
        reasoning.push('current state inquiry');
    }

    if (semanticFeatures.hasCodeActionVerbs && !semanticFeatures.hasCodeEntityReferences) {
        score += 0.3;
        reasoning.push('code action without explicit target');
    }

    return {
        needsContext: true,
        confidence: Math.min(score, 1.0),
        subcategory: 'implicit_reference',
        reasoning
    };
}

/**
 * Calculate no context needed score
 */
export function calculateNoContextScore(_semanticFeatures: ISemanticFeatures, text: string) {
    let score = 0;
    const reasoning: string[] = [];

    const creationPatterns = /\b(create new|generate new|make new|build new|add new)\b/i;
    const creationInOtherLangs = /\b(tạo mới|sinh mới|viết mới|tạo ra|crear nuevo|generar nuevo|faire nouveau|créer nouveau|neues erstellen|criar novo|gerar novo)\b/i;

    if (creationPatterns.test(text) || creationInOtherLangs.test(text)) {
        score += 0.7;
        reasoning.push('new creation patterns detected');
    }

    const helpPatterns = /\b(how to|what is|tutorial|guide|help|setup|install|config)\b/i;
    const helpInOtherLangs = /\b(như thế nào|là gì|hướng dẫn|giúp|cài đặt|thiết lập|cómo|qué es|guía|ayuda|instalación|comment|qu'est|guide|aide|installation|wie|was ist|anleitung|hilfe|installation|como|o que é|guia|ajuda|instalação)\b/i;

    if (helpPatterns.test(text) || helpInOtherLangs.test(text)) {
        score += 0.6;
        reasoning.push('general help/tutorial patterns');
    }

    return {
        needsContext: false,
        confidence: Math.min(score, 1.0),
        subcategory: 'standalone_task',
        reasoning
    };
}

// ── Context Intent Analysis ────────────────────────────────

/**
 * Universal context intent analysis (language-agnostic)
 */
export function analyzeContextIntent(text: string) {
    const semanticFeatures = extractSemanticFeatures(text);

    const contextScores: Record<string, any> = {
        explicit_current_file: calculateExplicitFileScore(semanticFeatures, text),
        implicit_current_file: calculateImplicitFileScore(semanticFeatures, text),
        no_context_needed: calculateNoContextScore(semanticFeatures, text)
    };

    let bestMatch: Record<string, any> = { needsContext: false, confidence: 0.4, subcategory: 'unknown' };

    for (const [category, scoreData] of (Object.entries(contextScores))) {
        if (scoreData.confidence > bestMatch.confidence) {
            bestMatch = {
                needsContext: scoreData.needsContext,
                confidence: scoreData.confidence,
                subcategory: scoreData.subcategory,
                matchedPattern: category,
                reasoning: scoreData.reasoning
            };
        }
    }

    return bestMatch;
}

// ── Linguistic Pattern Analysis ────────────────────────────

/**
 * Universal linguistic pattern analysis (language-agnostic)
 */
export function analyzeLinguisticPatterns(text: string) {
    const semanticFeatures = extractSemanticFeatures(text);

    const analysis: Record<string, any> = {
        patterns: {
            demonstratives: semanticFeatures.hasProximalReferences ? 1 : 0,
            presentContext: semanticFeatures.hasProximalReferences ? 1 : 0,
            contextActions: semanticFeatures.hasCodeActionVerbs ? 1 : 0,
            codeReferences: semanticFeatures.hasCodeEntityReferences ? 1 : 0,
            currentStateQuestions: semanticFeatures.hasCurrentStateInquiries ? 1 : 0
        },
        scores: {} as Record<string, number>,
        totalScore: 0,
        semanticFeatures
    };

    let totalMatches = 0;

    const weights: Record<string, number> = {
        demonstratives: 0.3,
        presentContext: 0.4,
        contextActions: 0.5,
        codeReferences: 0.3,
        currentStateQuestions: 0.4
    };

    for (const [patternName, count] of (Object.entries(analysis.patterns))) {
        analysis.scores[patternName] = (count as number) * (weights[patternName] || 0.2);
        totalMatches += count as number;
    }

    analysis.totalScore = (Object.values(analysis.scores) as number[]).reduce((sum: number, score: number) => sum + score, 0);
    analysis.hasStrongPatterns = totalMatches >= 2 && analysis.totalScore > 0.8;

    return analysis;
}

// ── Context Relevance ──────────────────────────────────────

/**
 * Check if a file type is relevant to the user's message
 */
export function isRelevantFileType(text: string, fileType: string): boolean {
    const typeKeywords: Record<string, string[]> = {
        'typescript': ['typescript', 'angular', 'ts', 'component'],
        'javascript': ['javascript', 'js', 'react', 'vue'],
        'python': ['python', 'py', 'django', 'flask'],
        'html': ['html', 'template', 'markup'],
        'css': ['css', 'scss', 'sass', 'style']
    };

    const keywords = (typeKeywords as any)[fileType] || [];
    return keywords.some((keyword: string) => text.toLowerCase().includes(keyword));
}

/**
 * Calculate context relevance score
 */
export function calculateContextRelevance(
    text: string,
    currentFileContext: IFileContext | null,
    intentResult: IIntentResult,
    conversationHistory: unknown[]
): number {
    let score = 0;

    if (currentFileContext?.hasFile) {
        score += 0.2;

        if (intentResult.category === 'code_interaction') {
            score += 0.3;
        }

        const fileType = currentFileContext.languageId!;
        if (isRelevantFileType(text, fileType)) {
            score += 0.2;
        }
    }

    if (conversationHistory.length > 0) {
        const recentMessages = conversationHistory.slice(-3);
        const hasRecentFileContext = recentMessages.some(msg =>
            (msg as any).content && (msg as any).content.toLowerCase().includes('file')
        );
        if (hasRecentFileContext) {
            score += 0.15;
        }
    }

    score += intentResult.confidence * 0.15;

    return Math.min(score, 1.0);
}

// ── Multi-Layer Context Decision ───────────────────────────

/**
 * Multi-layer decision algorithm
 */
export function makeContextDecision(analysisData: Record<string, any>): IDecision {
    const {
        intent,
        linguistic,
        contextScore,
        hasActiveFile,
    } = analysisData;

    const decision: IDecision = {
        include: false,
        confidence: 0,
        reasoning: []
    };

    // Layer 1: Intent-based decision
    if (intent.needsContext && intent.confidence > HIGH_INTENT_CONFIDENCE) {
        decision.include = true;
        decision.confidence += 0.4;
        decision.reasoning.push(`Intent classification (${intent.intent}) indicates context needed`);
    }

    // Layer 2: Linguistic pattern analysis
    if (linguistic.hasStrongPatterns) {
        decision.include = true;
        decision.confidence += 0.3;
        decision.reasoning.push(`Strong linguistic patterns detected (score: ${linguistic.totalScore.toFixed(2)})`);
    }

    // Layer 3: Context relevance scoring
    if (contextScore > CONTEXT_RELEVANCE_THRESHOLD) {
        decision.include = true;
        decision.confidence += 0.2;
        decision.reasoning.push(`High context relevance (${(contextScore * 100).toFixed(1)}%)`);
    }

    // Layer 4: File availability check
    if (decision.include && !hasActiveFile) {
        decision.include = false;
        decision.confidence = 0.1;
        decision.reasoning = ['Context needed but no active file available'];
    }

    // Layer 5: Confidence threshold check
    if (decision.confidence < DECISION_CONFIDENCE_THRESHOLD) {
        decision.include = false;
        decision.reasoning.push(`Confidence below threshold (${DECISION_CONFIDENCE_THRESHOLD})`);
    }

    // Layer 6: Override for explicit requests
    if (intent.intent === 'code_modification' && intent.confidence > HIGH_MODIFICATION_CONFIDENCE) {
        decision.include = true;
        decision.confidence = Math.max(decision.confidence, 0.8);
        decision.reasoning.push('Override: Explicit code modification request');
    }

    // Layer 7: Override for Vietnamese/short file questions
    const shortQuestionPatterns = /\b(code này|file này|làm gì|chức năng|what does|this file|this code)\b/i;
    if (shortQuestionPatterns.test(analysisData.originalText || '') && hasActiveFile && !decision.include) {
        decision.include = true;
        decision.confidence = Math.max(decision.confidence, 0.6);
        decision.reasoning.push('Override: Short file question detected');
    }

    return decision;
}

// ── Universal Context Decision ─────────────────────────────

/**
 * Universal semantic-based context decision (language-agnostic)
 */
export function makeUniversalContextDecision(
    userMessage: string,
    contextDecision: IContextDecision,
    currentFileContext: IFileContext | null
) {
    try {
        const semanticFeatures = extractSemanticFeatures(userMessage);

        const universalIndicators = {
            hasProximalDemonstratives: semanticFeatures.hasProximalReferences,
            hasCodeActions: semanticFeatures.hasCodeActionVerbs,
            hasCodeEntities: semanticFeatures.hasCodeEntityReferences,
            hasStateQuestions: semanticFeatures.hasCurrentStateInquiries,
            engineConfidence: contextDecision?.confidence || 0
        };

        let semanticScore = 0;
        const reasoning: string[] = [];

        if (universalIndicators.hasProximalDemonstratives) {
            semanticScore += 0.3;
            reasoning.push('proximal reference detected');
        }

        if (universalIndicators.hasCodeActions) {
            semanticScore += 0.4;
            reasoning.push('code action verbs identified');
        }

        if (universalIndicators.hasCodeEntities) {
            semanticScore += 0.2;
            reasoning.push('code entities referenced');
        }

        if (universalIndicators.hasStateQuestions) {
            semanticScore += 0.3;
            reasoning.push('current state inquiry detected');
        }

        semanticScore += universalIndicators.engineConfidence * 0.3;

        const hasActiveFile = currentFileContext?.hasFile;
        const shouldInclude = semanticScore >= SEMANTIC_THRESHOLD && hasActiveFile;

        if (shouldInclude) {
            reasoning.push('semantic threshold met with active file');
        } else if (!hasActiveFile) {
            reasoning.push('no active file available');
        } else {
            reasoning.push('semantic confidence below threshold');
        }

        return {
            shouldInclude,
            confidence: Math.min(semanticScore, 1.0),
            reason: `Universal semantic analysis: ${reasoning.join(', ')}`,
            semanticScore,
            universalIndicators
        };
    } catch (error: unknown) {
        aidaLogging('Universal context decision error:', error);
        return {
            shouldInclude: false,
            confidence: 0.1,
            reason: 'Universal analysis failed, conservative fallback',
            semanticScore: 0,
            universalIndicators: {}
        };
    }
}
