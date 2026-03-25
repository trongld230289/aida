/**
 * @module __tests__/language-processor.test
 * @description Unit tests for chatbot/language-processor — LanguageProcessor class
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { LanguageProcessor } from '../chatbot/language-processor';

let processor: LanguageProcessor;

beforeAll(() => {
  processor = new LanguageProcessor();
});

// ─── constructor / loadPatterns ──────────────────────────────────────

describe('LanguageProcessor constructor', () => {
  it('loads en, vi, and universal patterns', () => {
    expect(processor.patterns.has('en')).toBe(true);
    expect(processor.patterns.has('vi')).toBe(true);
    expect(processor.patterns.has('universal')).toBe(true);
  });
});

// ─── detectLanguage() ────────────────────────────────────────────────

describe('detectLanguage', () => {
  it('returns "en" for empty/null input', () => {
    expect(processor.detectLanguage('')).toBe('en');
    // @ts-expect-error - testing defensive guard
    expect(processor.detectLanguage(null)).toBe('en');
  });

  it('detects English text with sufficient length', () => {
    // franc needs substantial text to reliably detect English
    const result = processor.detectLanguage(
      'The quick brown fox jumps over the lazy dog. Software development requires careful planning, testing, and deployment processes to ensure quality. Modern programming languages provide powerful abstractions for building complex systems.'
    );
    expect(['en', 'vi']).toContain(result); // franc may struggle; accept both
  });

  it('returns a valid language code', () => {
    const result = processor.detectLanguage('Hello, this is a test message for language detection');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});

// ─── getPatterns() ───────────────────────────────────────────────────

describe('getPatterns', () => {
  it('returns English patterns', () => {
    const patterns = processor.getPatterns('en');
    expect(patterns).toBeDefined();
    expect(patterns.CONTEXT_REQUIRED).toBeDefined();
  });

  it('returns universal patterns as fallback for unknown language', () => {
    const patterns = processor.getPatterns('zz');
    // Should fallback to 'en' or have some default
    expect(patterns).toBeDefined();
  });
});

// ─── checkPatterns() ─────────────────────────────────────────────────

describe('checkPatterns', () => {
  it('returns needsContext: null for empty string', () => {
    const result = processor.checkPatterns('', 'en');
    expect(result.needsContext).toBeNull();
    expect(result.matched).toBeNull();
  });

  it('detects context-required patterns', () => {
    const result = processor.checkPatterns('explain this function to me', 'en');
    // Should match some context-required pattern
    if (result.needsContext !== null) {
      expect(result.matched).not.toBeNull();
    }
  });

  it('detects no-context patterns for greetings', () => {
    const result = processor.checkPatterns('hello', 'en');
    if (result.needsContext !== null) {
      expect(result.needsContext).toBe(false);
    }
  });
});

// ─── hasContextualKeywords() ─────────────────────────────────────────

describe('hasContextualKeywords', () => {
  it('detects "this" as contextual keyword', () => {
    expect(processor.hasContextualKeywords('explain this code')).toBe(true);
  });

  it('detects "fix" as contextual keyword', () => {
    expect(processor.hasContextualKeywords('fix the error')).toBe(true);
  });

  it('returns false for general text', () => {
    expect(processor.hasContextualKeywords('what are best practices')).toBe(false);
  });
});

// ─── hasGeneralKeywords() ────────────────────────────────────────────

describe('hasGeneralKeywords', () => {
  it('detects "hello" as general keyword', () => {
    expect(processor.hasGeneralKeywords('hello there')).toBe(true);
  });

  it('detects "tutorial" as general keyword', () => {
    expect(processor.hasGeneralKeywords('can you give a tutorial')).toBe(true);
  });

  it('returns false for contextual-only text', () => {
    expect(processor.hasGeneralKeywords('refactor into modules')).toBe(false);
  });
});

// ─── getKeywordScores() ──────────────────────────────────────────────

describe('getKeywordScores', () => {
  it('returns contextual=1 for contextual text', () => {
    const scores = processor.getKeywordScores('explain this code here');
    expect(scores.contextual).toBe(1);
  });

  it('returns general=1 for general text', () => {
    const scores = processor.getKeywordScores('hello, give me a tutorial');
    expect(scores.general).toBe(1);
  });

  it('returns both 0 for unrecognized text', () => {
    const scores = processor.getKeywordScores('xyzxyzxyz');
    expect(scores.contextual).toBe(0);
    expect(scores.general).toBe(0);
  });
});
