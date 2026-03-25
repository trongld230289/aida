/**
 * @module language-processor
 * @description Language detection and pattern-based context analysis.
 * Uses franc for NLP language detection, with Vietnamese fallback.
 * Migrated to TypeScript in Phase 4.2.
 */

import { aidaLogging } from '../core/settings';

// franc is a CJS module ï¿½ use require for compat

import { IPatternSet, IPatternCheckResult, IKeywordScores } from './interfaces/language-processor.interface';
import { toError } from '../core/error-utils';
import { franc } from 'franc';
import * as universalPatterns from './patterns/universal-patterns';
import * as viPatterns from './patterns/vi-patterns';
import * as enPatterns from './patterns/en-patterns';

// Re-export so existing consumers can still import from this module
export type { IPatternSet, IPatternCheckResult, IKeywordScores };

// -- Constants ---------------------------------------------------

/** Franc ISO-639-3 ? short code mapping */
const FRANC_LANG_MAP: Record<string, string> = {
    eng: 'en', vie: 'vi', cmn: 'zh', jpn: 'ja',
    fra: 'fr', deu: 'de', spa: 'es', ita: 'it',
    por: 'pt', rus: 'ru', und: 'en',
};

/** Vietnamese diacritic characters for fallback detection */
const VIETNAMESE_CHARS = /[ï¿½ï¿½??ï¿½ï¿½?????a?????ï¿½ï¿½???ï¿½?????ï¿½ï¿½??iï¿½ï¿½??ï¿½ï¿½?????o?????ï¿½ï¿½??uu??????ï¿½???d]/i;

/** Common Vietnamese words for fallback detection */
const VIETNAMESE_WORDS = /\b(lï¿½|c?a|nï¿½y|dï¿½|vï¿½|cï¿½|khï¿½ng|du?c|cho|t?|v?i|v?|trong|trï¿½n|du?i|gi?a|sau|tru?c|khi|n?u|thï¿½|mï¿½|d?|s?|dï¿½|dang|code|function|hï¿½m|s?a|t?i|uu|gi?i|thï¿½ch|cï¿½i|do?n|ph?n)\b/i;

// -- Class -------------------------------------------------------

class LanguageProcessor {
    patterns: Record<string, any>;

    constructor() {
        this.patterns = new Map();
        this.loadPatterns();
    }

    loadPatterns(): void {
        try {
            this.patterns.set('en', enPatterns);
            this.patterns.set('vi', viPatterns);
            this.patterns.set('universal', universalPatterns);
        } catch (_error: unknown) {
            const error = toError(_error);
            aidaLogging('Failed to load some pattern files:', error.message);
            this.patterns.set('universal', {
                CONTEXT_REQUIRED: [/\b(this|current)\s+(code|function)/i],
                NO_CONTEXT: [/^(hello|hi)$/i],
                CONTEXT_KEYWORDS: ['this', 'current'],
                GENERAL_KEYWORDS: ['hello', 'hi'],
            });
        }
    }

    detectLanguage(text: string): string {
        if (!text || typeof text !== 'string') return 'en';

        try {
            const langCode: string = franc(text);
            const detectedLang = FRANC_LANG_MAP[langCode] || 'en';

            // Vietnamese fallback ï¿½ franc sometimes misses Vietnamese
            if (detectedLang === 'en') {
                if (VIETNAMESE_CHARS.test(text) || VIETNAMESE_WORDS.test(text)) {
                    return 'vi';
                }
            }

            return detectedLang;
        } catch (_error: unknown) {
            const error = toError(_error);
            aidaLogging('Language detection error:', error.message);
            return VIETNAMESE_CHARS.test(text) ? 'vi' : 'en';
        }
    }

    getPatterns(language: string): IPatternSet {
        return this.patterns.get(language) || this.patterns.get('en') || {
            CONTEXT_REQUIRED: [],
            NO_CONTEXT: [],
        };
    }

    checkPatterns(text: string, language: string): IPatternCheckResult {
        if (!text || typeof text !== 'string') {
            return { needsContext: null, matched: null };
        }

        const patterns = this.getPatterns(language);
        const universal = this.patterns.get('universal');

        const contextRequiredPatterns = [
            ...(patterns.CONTEXT_REQUIRED || []),
            ...(universal ? universal.CONTEXT_REQUIRED || [] : []),
        ];

        const noContextPatterns = [
            ...(patterns.NO_CONTEXT || []),
            ...(universal ? universal.NO_CONTEXT || [] : []),
        ];

        // Context required patterns have higher priority
        for (const pattern of contextRequiredPatterns) {
            try {
                if (pattern.test(text)) {
                    return { needsContext: true, matched: pattern.toString(), confidence: 90 };
                }
            } catch (_error: unknown) {
                const error = toError(_error);
                aidaLogging('Invalid regex pattern:', pattern, error.message);
            }
        }

        for (const pattern of noContextPatterns) {
            try {
                if (pattern.test(text)) {
                    return { needsContext: false, matched: pattern.toString(), confidence: 85 };
                }
            } catch (_error: unknown) {
                const error = toError(_error);
                aidaLogging('Invalid regex pattern:', pattern, error.message);
            }
        }

        return { needsContext: null, matched: null, confidence: 0 };
    }

    /** Check if text contains contextual keywords */
    hasContextualKeywords(text: string): boolean {
        const universal = this.patterns.get('universal');
        if (!universal || !universal.CONTEXT_KEYWORDS) return false;

        const textLower = text.toLowerCase();
        return universal.CONTEXT_KEYWORDS.some((keyword: string) =>
            textLower.includes(keyword.toLowerCase())
        );
    }

    /** Check if text contains general keywords */
    hasGeneralKeywords(text: string): boolean {
        const universal = this.patterns.get('universal');
        if (!universal || !universal.GENERAL_KEYWORDS) return false;

        const textLower = text.toLowerCase();
        return universal.GENERAL_KEYWORDS.some((keyword: string) =>
            textLower.includes(keyword.toLowerCase())
        );
    }

    /** Get keyword scores for text */
    getKeywordScores(text: string): IKeywordScores {
        return {
            contextual: this.hasContextualKeywords(text) ? 1 : 0,
            general: this.hasGeneralKeywords(text) ? 1 : 0,
        };
    }
}

// -- Dual exports ------------------------------------------------

export default LanguageProcessor;
export { LanguageProcessor };
