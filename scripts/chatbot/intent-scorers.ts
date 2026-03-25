/**
 * Intent Scorers Sub-Module
 * Provides intent classification scoring functions using universal / language-agnostic pattern detection.
 */

import type { ISemanticFeatures } from './semantic-detection';

// ── Interfaces ─────────────────────────────────────────────

export interface IScoreData {
    confidence: number;
    category: string;
    reasoning: string[];
    needsContext?: boolean;
    subcategory?: string;
    [key: string]: unknown;
}

export interface IIntentResult {
    intent: string;
    confidence: number;
    needsContext: boolean;
    category?: string;
    subcategory?: string;
    [key: string]: unknown;
}

// ── Code-Analysis Score ────────────────────────────────────

/**
 * Calculate semantic score for code analysis intent
 */
export function calculateCodeAnalysisScore(semanticFeatures: ISemanticFeatures, _text: string): IScoreData {
    let score = 0;
    const reasoning: string[] = [];

    if (semanticFeatures.hasCodeActionVerbs) {
        score += 0.4;
        reasoning.push('code action verbs detected');
    }

    if (semanticFeatures.hasCodeEntityReferences) {
        score += 0.3;
        reasoning.push('code entities referenced');
    }

    if (semanticFeatures.hasCurrentStateInquiries) {
        score += 0.3;
        reasoning.push('state inquiry patterns');
    }

    if (semanticFeatures.hasProximalReferences) {
        score += 0.2;
        reasoning.push('proximal references');
    }

    return {
        confidence: Math.min(score, 1.0),
        category: 'code_interaction',
        reasoning
    };
}

// ── Code-Modification Score ────────────────────────────────

/**
 * Universal modification pattern detection (language-agnostic)
 */
export function detectUniversalModificationPatterns(text: string) {
    const analysis = {
        hasModificationVerbs: false,
        hasImprovementConcepts: false
    };

    const modificationPatterns = [
        /\b[rf][aeiou][cfp][aeiou]*[crt]\w*\b/i,
        /\b[ims][aeiou]*[pm][aeiou]*[rv]\w*\b/i,
        /\b[of][aeiou]*[pt][aeiou]*[mn]\w*\b/i,
        /\b[fc][aeiou]*[xi]\w*\b/i,
        /\b[us][aeiou]*[pd][aeiou]*[dt]\w*\b/i,
        /\b[cm][aeiou]*[hn][aeiou]*[gn]\w*\b/i,
        /\b[mns][aeiou]*[od][aeiou]*[dfy]\w*\b/i,
        /\b[ce][aeiou]*[nh][aeiou]*[hn]\w*\b/i,
        /\b[cm][aeiou]*[ld][aeiou]*[aen]\w*\b/i,
    ];

    analysis.hasModificationVerbs = modificationPatterns.some(pattern => pattern.test(text));

    const improvementConcepts = [
        /\b(better|best|improve|enhance|optim|perfect|upgrade|modern)\w*\b/i,
        /\b(quality|performance|efficiency|speed|fast|clean|neat)\w*\b/i,
        /\b(practice|standard|convention|pattern|architecture)\w*\b/i
    ];

    analysis.hasImprovementConcepts = improvementConcepts.some(pattern => pattern.test(text));

    return analysis;
}

/**
 * Calculate semantic score for code modification intent
 */
export function calculateCodeModificationScore(semanticFeatures: ISemanticFeatures, text: string): IScoreData {
    let score = 0;
    const reasoning: string[] = [];

    const modificationIndicators = detectUniversalModificationPatterns(text);

    if (modificationIndicators.hasModificationVerbs) {
        score += 0.5;
        reasoning.push('universal modification verbs detected');
    }

    if (modificationIndicators.hasImprovementConcepts) {
        score += 0.3;
        reasoning.push('improvement concepts identified');
    }

    if (semanticFeatures.hasProximalReferences) {
        score += 0.4;
        reasoning.push('proximal reference (this/current)');
    }

    if (semanticFeatures.hasCodeEntityReferences) {
        score += 0.2;
        reasoning.push('code entities referenced');
    }

    return {
        confidence: Math.min(score, 1.0),
        category: 'code_interaction',
        reasoning
    };
}

// ── Code-Creation Score ────────────────────────────────────

/**
 * Universal creation pattern detection (language-agnostic)
 */
export function detectUniversalCreationPatterns(text: string) {
    const analysis = {
        hasCreationVerbs: false,
        hasNewnessConcepts: false
    };

    const creationPatterns = [
        /\b[ck][aeiou]*[rt][aeiou]*[aet]\w*\b/i,
        /\b[gj][aeiou]*[nm][aeiou]*[rt]\w*\b/i,
        /\b[m][aeiou]*[ck][aeiou]*\b/i,
        /\b[bv][aeiou]*[il][aeiou]*[ld]\w*\b/i,
        /\b[aei]*[d][aeiou]*\b/i,
        /\b[wv][aeiou]*[rt][aeiou]*[t]\w*\b/i,
        /\b[ck][aeiou]*[nmn][aeiou]*[st]\w*\b/i,
    ];

    analysis.hasCreationVerbs = creationPatterns.some(pattern => pattern.test(text));

    const newnessConcepts = [
        /\b(new|fresh|novel|original|initial|start|begin)\w*\b/i,
        /\b(first|empty|blank|zero|from.{0,10}scratch)\w*\b/i
    ];

    analysis.hasNewnessConcepts = newnessConcepts.some(pattern => pattern.test(text));

    return analysis;
}

/**
 * Calculate semantic score for code creation intent
 */
export function calculateCodeCreationScore(semanticFeatures: ISemanticFeatures, text: string): IScoreData {
    let score = 0;
    const reasoning: string[] = [];

    const creationIndicators = detectUniversalCreationPatterns(text);

    if (creationIndicators.hasCreationVerbs) {
        score += 0.4;
        reasoning.push('universal creation verbs detected');
    }

    if (creationIndicators.hasNewnessConcepts) {
        score += 0.3;
        reasoning.push('newness concepts identified');
    }

    if (semanticFeatures.hasCodeEntityReferences) {
        score += 0.3;
        reasoning.push('code entities for creation');
    }

    if (semanticFeatures.hasProximalReferences) {
        score -= 0.2;
        reasoning.push('proximal reference reduces creation likelihood');
    }

    return {
        confidence: Math.max(score, 0),
        category: 'code_generation',
        reasoning
    };
}

// ── General-Question Score ─────────────────────────────────

/**
 * Detect question concepts using semantic analysis (works for any language)
 */
export function detectSemanticQuestionConcepts(text: string): string[] {
    const concepts: string[] = [];

    const conceptPatterns: Record<string, RegExp> = {
        information_seeking: /\b(inform|info|know|understand|learn|explain|clarify)\w*\b/i,
        procedural: /\b(process|procedure|method|way|step|instruction|direction)\w*\b/i,
        causal: /\b(reason|cause|because|purpose|goal|objective|motivation)\w*\b/i,
        temporal: /\b(time|when|schedule|moment|period|duration|timing)\w*\b/i,
        spatial: /\b(place|location|position|where|site|area|region)\w*\b/i
    };

    for (const [concept, pattern] of (Object.entries(conceptPatterns) as [string, any][])) {
        if (pattern.test(text)) {
            concepts.push(concept);
        }
    }

    return concepts;
}

/**
 * Universal question pattern detection (language-agnostic)
 */
export function detectUniversalQuestionPatterns(text: string) {
    const analysis = {
        hasQuestionWords: false,
        hasHelpSeeking: false,
        hasInterrogativeStructure: false
    };

    // 1. Universal interrogative markers
    const questionMarkers = ['?', '？', '¿'];
    analysis.hasInterrogativeStructure = questionMarkers.some(marker => text.includes(marker));

    // 2. Universal WH-question patterns
    const whPatterns = [
        /\b[wv][hx]?[aeiou]{1,2}[tn]?\b/i,
        /\b[hw][aeiou][wv]?\b/i,
        /\b[wv][hx]?[yie]{1,2}\b/i,
        /\b[wv][hx]?[aeiou][nr][aeiou]?\b/i
    ];
    analysis.hasQuestionWords = whPatterns.some(pattern => pattern.test(text));

    // 3. Universal help-seeking patterns
    const helpPatterns = [
        /\b[hg][aeiou][lpr][pf]?\b/i,
        /\b[gs][uoi][iaeo][dr][aeiou]?\b/i,
        /\b[t][uio][nt][aeiou][rn]/i,
        /\b[aei][yie][uo]d[aeiou]\b/i
    ];
    analysis.hasHelpSeeking = helpPatterns.some(pattern => pattern.test(text));

    // 4. Semantic indicators
    const semanticQuestionWords = detectSemanticQuestionConcepts(text);
    if (semanticQuestionWords.length > 0) {
        analysis.hasQuestionWords = true;
    }

    return analysis;
}

/**
 * Calculate semantic score for general question intent
 */
export function calculateGeneralQuestionScore(semanticFeatures: ISemanticFeatures, text: string): IScoreData {
    let score = 0;
    const reasoning: string[] = [];

    const questionIndicators = detectUniversalQuestionPatterns(text);

    if (questionIndicators.hasQuestionWords) {
        score += 0.4;
        reasoning.push('universal question words detected');
    }

    if (questionIndicators.hasHelpSeeking) {
        score += 0.3;
        reasoning.push('help-seeking patterns identified');
    }

    if (questionIndicators.hasInterrogativeStructure) {
        score += 0.2;
        reasoning.push('interrogative sentence structure');
    }

    if (semanticFeatures.hasCodeEntityReferences && semanticFeatures.hasProximalReferences) {
        score -= 0.2;
        reasoning.push('specific code focus reduces general question likelihood');
    }

    return {
        confidence: Math.max(score, 0),
        category: 'information',
        reasoning
    };
}
