/**
 * @module __tests__/ml-classifier.test
 * @description Unit tests for chatbot/ml-classifier — MLClassifier class
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { MLClassifier } from '../chatbot/ml-classifier';
import type { IClassificationResult } from '../chatbot/ml-classifier';

let classifier: MLClassifier;

beforeAll(() => {
  classifier = new MLClassifier();
});

// ─── constructor / training ──────────────────────────────────────────

describe('MLClassifier constructor', () => {
  it('initializes and trains the Bayes classifier', () => {
    expect(classifier.trained).toBe(true);
  });

  it('has context and no-context keywords', () => {
    expect(classifier.contextKeywords.length).toBeGreaterThan(0);
    expect(classifier.noContextKeywords.length).toBeGreaterThan(0);
  });

  it('has context and no-context regex patterns', () => {
    expect(classifier.contextPatterns.length).toBeGreaterThan(0);
    expect(classifier.noContextPatterns.length).toBeGreaterThan(0);
  });
});

// ─── classify() ──────────────────────────────────────────────────────

describe('classify', () => {
  it('returns needs_context for "explain this function"', () => {
    const result = classifier.classify('explain this function');
    expect(result.label).toBe('needs_context');
  });

  it('returns no_context for "hello"', () => {
    const result = classifier.classify('hello');
    expect(result.label).toBe('no_context');
  });

  it('returns unknown for empty string', () => {
    const result = classifier.classify('');
    expect(result.label).toBe('unknown');
    expect(result.confidence).toBe(0);
  });

  it('returns unknown for null-ish input', () => {
    // @ts-expect-error - testing defensive guard
    expect(classifier.classify(null).label).toBe('unknown');
  });

  it('uses bayes method when trained', () => {
    const result = classifier.classify('fix this bug');
    expect(result.method).toBe('bayes');
  });

  it('classifies "what is javascript" as no_context', () => {
    const result = classifier.classify('what is javascript');
    expect(result.label).toBe('no_context');
  });

  it('classifies "debug this code" as needs_context', () => {
    const result = classifier.classify('debug this code');
    expect(result.label).toBe('needs_context');
  });
});

// ─── fallbackClassify() ─────────────────────────────────────────────

describe('fallbackClassify', () => {
  it('returns a result with the fallback method', () => {
    const result = classifier.fallbackClassify('fix this bug here');
    expect(result.method).toBe('fallback');
  });

  it('includes scores breakdown', () => {
    const result = classifier.fallbackClassify('explain this code');
    expect(result.scores).toBeDefined();
    expect(result.scores).toHaveProperty('pattern');
    expect(result.scores).toHaveProperty('keyword');
    expect(result.scores).toHaveProperty('length');
    expect(result.scores).toHaveProperty('structure');
  });

  it('classifies contextual text as needs_context', () => {
    const result = classifier.fallbackClassify('fix this code here');
    expect(result.label).toBe('needs_context');
  });

  it('classifies general text as no_context', () => {
    const result = classifier.fallbackClassify('what is the concept of object oriented programming in general');
    expect(result.label).toBe('no_context');
  });
});

// ─── calculatePatternScore() ─────────────────────────────────────────

describe('calculatePatternScore', () => {
  it('returns higher context score for "fix this code"', () => {
    const score = classifier.calculatePatternScore('fix this code');
    expect(score.context).toBeGreaterThan(0);
  });

  it('returns higher noContext score for "hello there"', () => {
    const score = classifier.calculatePatternScore('hello');
    expect(score.noContext).toBeGreaterThan(0);
  });

  it('returns zero scores for unrecognized text', () => {
    const score = classifier.calculatePatternScore('xyzxyzxyz');
    expect(score.context).toBe(0);
    expect(score.noContext).toBe(0);
  });
});

// ─── calculateLengthScore() ──────────────────────────────────────────

describe('calculateLengthScore', () => {
  it('favors context for short text (<20 chars)', () => {
    const score = classifier.calculateLengthScore('fix this');
    expect(score.context).toBe(0.7);
  });

  it('favors noContext for very long text (>100 chars)', () => {
    const longText = 'a'.repeat(150);
    const score = classifier.calculateLengthScore(longText);
    expect(score.noContext).toBe(0.8);
  });
});

// ─── calculateStructureScore() ───────────────────────────────────────

describe('calculateStructureScore', () => {
  it('detects demonstrative pronouns as contextual', () => {
    const score = classifier.calculateStructureScore('what does this do');
    expect(score.context).toBeGreaterThan(0);
  });

  it('detects commands as contextual', () => {
    const score = classifier.calculateStructureScore('fix the issue');
    expect(score.context).toBeGreaterThan(0);
  });
});

// ─── getSimilarityScore() ────────────────────────────────────────────

describe('getSimilarityScore', () => {
  it('returns a high score for identical text', () => {
    const score = classifier.getSimilarityScore('hello world', ['hello world']);
    expect(score).toBeGreaterThan(0.9);
  });

  it('returns 0 for empty reference list', () => {
    expect(classifier.getSimilarityScore('hello', [])).toBe(0);
  });

  it('returns a score between 0 and 1', () => {
    const score = classifier.getSimilarityScore('fix this bug', ['debug this code', 'hello there']);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });
});

// ─── calculateJaccardSimilarity() ────────────────────────────────────

describe('calculateJaccardSimilarity', () => {
  it('returns 1 for identical word sets', () => {
    expect(classifier.calculateJaccardSimilarity(['a', 'b'], ['a', 'b'])).toBe(1);
  });

  it('returns 0 for completely disjoint word sets', () => {
    expect(classifier.calculateJaccardSimilarity(['a', 'b'], ['c', 'd'])).toBe(0);
  });

  it('returns 0.5 for half-overlapping sets', () => {
    const similarity = classifier.calculateJaccardSimilarity(['a', 'b'], ['b', 'c']);
    expect(similarity).toBeCloseTo(1 / 3); // intersection {b}=1, union {a,b,c}=3
  });
});

// ─── addTrainingExample() ────────────────────────────────────────────

describe('addTrainingExample', () => {
  it('adds an example to trainingData', () => {
    const before = classifier.trainingData.length;
    classifier.addTrainingExample('test text', 'needs_context');
    expect(classifier.trainingData.length).toBe(before + 1);
  });

  it('includes timestamp in stored example', () => {
    classifier.addTrainingExample('another test', 'no_context');
    const last = classifier.trainingData[classifier.trainingData.length - 1];
    expect(last.timestamp).toBeGreaterThan(0);
    expect(last.text).toBe('another test');
    expect(last.label).toBe('no_context');
  });
});

// ─── getStats() ──────────────────────────────────────────────────────

describe('getStats', () => {
  it('returns expected statistical fields', () => {
    const stats = classifier.getStats();
    expect(stats).toHaveProperty('contextKeywordsCount');
    expect(stats).toHaveProperty('noContextKeywordsCount');
    expect(stats).toHaveProperty('contextPatternsCount');
    expect(stats).toHaveProperty('noContextPatternsCount');
    expect(stats).toHaveProperty('trainingDataSize');
    expect(stats.contextPatternsCount).toBeGreaterThan(0);
  });
});
