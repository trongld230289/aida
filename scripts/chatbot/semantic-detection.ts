/**
 * Semantic Detection Sub-Module
 * Provides language-agnostic semantic feature extraction, OCR helpers, and stub analysis classes.
 */

import { aidaLogging } from '../core/settings';
import { toError } from '../core/error-utils';

// ── Interfaces ─────────────────────────────────────────────
export interface ISemanticFeatures {
    hasProximalReferences: boolean;
    hasCodeActionVerbs: boolean;
    hasCodeEntityReferences: boolean;
    hasCurrentStateInquiries: boolean;
}

// ── Semantic Feature Extraction ────────────────────────────

/**
 * Extract semantic features that work across all languages
 * @param text - Input text in any language
 * @returns Language-agnostic semantic features
 */
export function extractSemanticFeatures(text: string): ISemanticFeatures {
    const lowercaseText = text.toLowerCase();

    return {
        hasProximalReferences: detectProximalReferences(lowercaseText),
        hasCodeActionVerbs: detectCodeActionVerbs(lowercaseText),
        hasCodeEntityReferences: detectCodeEntityReferences(lowercaseText),
        hasCurrentStateInquiries: detectCurrentStateInquiries(lowercaseText)
    };
}

/**
 * Detect proximal references across languages using universal linguistic features
 */
export function detectProximalReferences(text: string): boolean {
    // 1. Phonetic clustering (works across language families)
    const proximalPhonetic = [
        /\b[td][hx]?[aeiou][st]?\b/i,
        /\b[td][hx]?[aeiou][sz][aeiou]\b/i,
        /\b[ck][aeiou][rnst]\w*\b/i,
        /\b[aei][ck][st][aeiou][vf]\w*\b/i,
        /\b[aou][pf][aeiou][nm]\w*\b/i,
    ];

    // 2. Semantic clustering (conceptual proximity indicators)
    const proximalSemantic = [
        /\b(now|present|actual|immediate|direct)\w*\b/i,
        /\b(here|local|nearby|close|adjacent)\w*\b/i,
        /\b(focus|target|selected|chosen|picked)\w*\b/i
    ];

    // 3. Universal demonstrative patterns
    const demonstrativeMarkers = [
        /\b.{0,2}[aeiou]{1,2}[yn][aeiou]{0,2}\b/i,
        /\b.{0,2}[eo][st][aeiou]{0,2}\b/i,
        /\b.{0,2}[gc][e][t]?[aeiou]{0,2}\b/i,
    ];

    return proximalPhonetic.some(p => p.test(text)) ||
           proximalSemantic.some(p => p.test(text)) ||
           demonstrativeMarkers.some(p => p.test(text));
}

/**
 * Detect code action verbs using universal linguistic patterns
 */
export function detectCodeActionVerbs(text: string): boolean {
    // 1. Analysis verbs
    const analysisVerbs = [
        /\b[aei]*[nml][aei]*[ly][aeiou]*[sz]\w*\b/i,
        /\b[rv][aei]*[vw][aei]*[w]\w*\b/i,
        /\b[ce][hx]*[aei]*[ck]\w*\b/i,
        /\b[ei][hx]*[aei]*[mnx]\w*\b/i,
    ];

    // 2. Modification verbs
    const modificationVerbs = [
        /\b[rf][aei]*[fct]\w*\b/i,
        /\b[fs][aei]*[xi]\w*\b/i,
        /\b[ims][aei]*[pm]\w*\b/i,
        /\b[ce][hx]*[aei]*[ng]\w*\b/i,
    ];

    // 3. Explanation verbs
    const explanationVerbs = [
        /\b[ei][hx]*[aei]*[xlp]\w*\b/i,
        /\b[dj][aei]*[sc]\w*\b/i,
        /\b[cs][hx]*[aei]*[rwf]\w*\b/i,
    ];

    return analysisVerbs.some(p => p.test(text)) ||
           modificationVerbs.some(p => p.test(text)) ||
           explanationVerbs.some(p => p.test(text));
}

/**
 * Detect code entity references using universal patterns
 */
export function detectCodeEntityReferences(text: string): boolean {
    // 1. File-related terms
    const fileTerms = [
        /\b[fp][aei]*[li][aeiou]*\b/i,
        /\b[dc][aeiou]*[ckt]\w*\b/i,
        /\b[sc][aei]*[rp]\w*\b/i,
    ];

    // 2. Code structure terms
    const codeTerms = [
        /\b[ck][aeiou]*[d][aeiou]*\b/i,
        /\b[fp][aei]*[nct]\w*\b/i,
        /\b[ck][aei]*[ls]\w*\b/i,
        /\b[cm][aei]*[mp]\w*\b/i,
        /\b[mv][aei]*[th]\w*\b/i,
        /\b[vw][aei]*[r]\w*\b/i,
    ];

    // 3. Programming concepts
    const programmingConcepts = [
        /\b(api|interface|module|library|framework)\w*\b/i,
        /\b(object|array|string|number|boolean)\w*\b/i,
        /\b(loop|condition|statement|expression)\w*\b/i
    ];

    return fileTerms.some(p => p.test(text)) ||
           codeTerms.some(p => p.test(text)) ||
           programmingConcepts.some(p => p.test(text));
}

/**
 * Detect current state inquiries using universal patterns
 */
export function detectCurrentStateInquiries(text: string): boolean {
    // 1. State inquiry verbs
    const stateVerbs = [
        /\b[dw][aeiou]*[oesh]\w*\b/i,
        /\b[hw][aeiou]*[vw]\w*\b/i,
        /\b[wp][aeiou]*[rk]\w*\b/i,
        /\b[fp][aei]*[nct]\w*\b/i,
        /\b[bh][aei]*[hv]\w*\b/i,
    ];

    // 2. Operation/activity terms
    const operationTerms = [
        /\b[aeo][ck]*[rst][aeiou]*[nt]\w*\b/i,
        /\b[aeo][pf]*[aeiou]*[rt]\w*\b/i,
        /\b[bp][aeiou]*[rhcv]\w*\b/i,
        /\b[rt][aeiou]*[sk]\w*\b/i,
    ];

    // 3. Purpose/function inquiry
    const purposeTerms = [
        /\b[pf][aei]*[rp]\w*\b/i,
        /\b[fg][aeiou]*[aln]\w*\b/i,
        /\b[mr][aei]*[sn]\w*\b/i,
        /\b[uw][hx]*[aey]\w*\b/i,
    ];

    return stateVerbs.some(p => p.test(text)) ||
           operationTerms.some(p => p.test(text)) ||
           purposeTerms.some(p => p.test(text));
}

// ── Text Normalisation ─────────────────────────────────────

/**
 * Handle Vietnamese + English mixed text normalization
 */
export function normalizeMixedLanguage(text: string): string {
    const mixedPatterns: Record<string, string> = {
        'code nay': 'code này',
        'file nay': 'file này',
        'function nay': 'function này',
        'lam gi': 'làm gì'
    };

    let normalized = text;
    (Object.entries(mixedPatterns) as [string, any][]).forEach(([mixed, correct]) => {
        normalized = normalized.replace(new RegExp(mixed, 'gi'), correct);
    });

    return normalized;
}

// ── OCR Helpers ────────────────────────────────────────────

/**
 * OCR text extraction using Tesseract.js only
 */
export async function extractTextFromImages(images: unknown[]): Promise<string> {
    if (!images || images.length === 0) return '';

    try {
        aidaLogging(`🔍 Processing ${images.length} image(s) with Tesseract OCR...`);
        const extractedTexts = [];

        for (const image of images) {
            try {
                const text = await extractWithTesseract(image as string | Buffer);

                if (text && text.trim()) {
                    extractedTexts.push(text.trim());
                    aidaLogging('✅ Tesseract OCR extracted:', text.substring(0, 100) + '...');
                } else {
                    aidaLogging('⚠️ No text extracted from image');
                }
            } catch (_ocrError: unknown) {
                const ocrError = toError(_ocrError);
                aidaLogging('❌ OCR extraction failed for image:', ocrError.message);
                throw new Error(`OCR not supported: ${ocrError.message}`);
            }
        }

        const combinedText = extractedTexts.join(' ').trim();
        aidaLogging(`📝 Total OCR extracted: ${combinedText.length} characters from ${images.length} images`);

        return combinedText;
    } catch (_error: unknown) {
        const error = toError(_error);
        aidaLogging('❌ OCR processing failed:', error);
        return `[OCR Error: ${error.message}]`;
    }
}

/**
 * Extract text using Tesseract.js (local OCR)
 */
export async function extractWithTesseract(imageData: string | Buffer): Promise<string> {
    try {
        if (typeof require !== 'undefined') {
            let Tesseract;
            try {
                Tesseract = require('tesseract.js');
            } catch (_requireError: unknown) {
                throw new Error('Tesseract.js not installed. Please run: npm install tesseract.js');
            }

            aidaLogging('🔄 Starting Tesseract OCR processing...');

            const { data: { text } } = await Tesseract.recognize(
                imageData,
                'eng+vie',
                {
                    logger: (m: Record<string, any>) => {
                        if (m.status === 'recognizing text') {
                            aidaLogging(`OCR Progress: ${(m.progress * 100).toFixed(1)}%`);
                        }
                    }
                }
            );

            return cleanOCRText(text);
        } else {
            throw new Error('OCR not supported in browser environment. Tesseract.js requires Node.js runtime');
        }
    } catch (_error: unknown) {
        const error = toError(_error);
        aidaLogging('❌ Tesseract OCR failed:', error.message);
        throw new Error(`Tesseract OCR failed: ${error.message}`);
    }
}

/**
 * Clean and normalize OCR text
 */
export function cleanOCRText(rawText: string): string {
    if (!rawText) return '';

    let cleaned = rawText
        .replace(/\s+/g, ' ')
        .replace(/[|]/g, 'l')
        .replace(/[0]/g, 'o')
        .replace(/[1]/g, 'l')
        .replace(/đ/g, 'd').replace(/Đ/g, 'D')
        .trim();

    const vietnameseCorrections: Record<string, string> = {
        'duc': 'được',
        'khong': 'không',
        'nhu': 'như',
        'thi': 'thì',
        'voi': 'với'
    };

    (Object.entries(vietnameseCorrections) as [string, any][]).forEach(([wrong, correct]) => {
        const regex = new RegExp(`\\b${wrong}\\b`, 'gi');
        cleaned = cleaned.replace(regex, correct);
    });

    return cleaned;
}

// ── Stub Helper Classes ────────────────────────────────────

/**
 * Language Detection Helper
 */
export class LanguageDetector {
    detect(text: string): string {
        const vietnamesePattern = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;
        const hasVietnamese = vietnamesePattern.test(text);
        const hasEnglish = /[a-zA-Z]/.test(text);

        if (hasVietnamese && hasEnglish) return 'mixed';
        if (hasVietnamese) return 'vietnamese';
        if (hasEnglish) return 'english';
        return 'unknown';
    }
}

/**
 * Semantic Analysis Helper
 */
export class SemanticAnalyzer {
    async classifyIntent(_text: string): Promise<{ intent: string; confidence: number; needsContext: boolean }> {
        return {
            intent: 'general',
            confidence: 0.5,
            needsContext: false
        };
    }
}

/**
 * Context Relevance Scorer
 */
export class ContextRelevanceScorer {
    calculateSimilarity(_text1: string, _text2: string): number {
        return 0.5;
    }
}

export {
    extractSemanticFeatures as _extractSemanticFeatures,
    detectProximalReferences as _detectProximalReferences,
    detectCodeActionVerbs as _detectCodeActionVerbs,
    detectCodeEntityReferences as _detectCodeEntityReferences,
    detectCurrentStateInquiries as _detectCurrentStateInquiries,
    normalizeMixedLanguage as _normalizeMixedLanguage,
    extractTextFromImages as _extractTextFromImages,
    extractWithTesseract as _extractWithTesseract,
    cleanOCRText as _cleanOCRText,
};
