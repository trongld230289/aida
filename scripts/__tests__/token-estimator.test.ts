/**
 * @module __tests__/token-estimator.test
 * @description Unit tests for core/token-estimator
 */

import { describe, it, expect } from 'vitest';
import { estimateTokenCount, normalizeModelFamily, estimateCost } from '../core/token-estimator';

// ─── estimateTokenCount() ────────────────────────────────────────────

describe('estimateTokenCount', () => {
  it('returns 0 for null', () => {
    expect(estimateTokenCount(null)).toBe(0);
  });

  it('returns 0 for undefined', () => {
    expect(estimateTokenCount(undefined)).toBe(0);
  });

  it('returns 0 for an empty string', () => {
    expect(estimateTokenCount('')).toBe(0);
  });

  it('estimates tokens from a short string', () => {
    const text = 'Hello, world!'; // 13 chars → ceil(13 / 3.8) = 4
    expect(estimateTokenCount(text)).toBe(4);
  });

  it('estimates tokens from a longer string', () => {
    const text = 'a'.repeat(380); // 380 chars → ceil(380 / 3.8) = 100
    expect(estimateTokenCount(text)).toBe(100);
  });

  it('returns a positive integer for any non-empty string', () => {
    const token = estimateTokenCount('test');
    expect(token).toBeGreaterThan(0);
    expect(Number.isInteger(token)).toBe(true);
  });

  it('handles whitespace-only strings', () => {
    const result = estimateTokenCount('   ');
    expect(result).toBeGreaterThan(0); // whitespace characters still count
  });
});

// ─── normalizeModelFamily() ──────────────────────────────────────────

describe('normalizeModelFamily', () => {
  it('returns "unknown" for null', () => {
    expect(normalizeModelFamily(null)).toBe('unknown');
  });

  it('returns "unknown" for undefined', () => {
    expect(normalizeModelFamily(undefined)).toBe('unknown');
  });

  it('returns "unknown" for an empty string', () => {
    expect(normalizeModelFamily('')).toBe('unknown');
  });

  it('lowercases and slugifies a model name', () => {
    expect(normalizeModelFamily('Claude Sonnet 4')).toBe('claude-sonnet-4');
  });

  it('replaces underscores with hyphens', () => {
    expect(normalizeModelFamily('gpt_4_turbo')).toBe('gpt-4-turbo');
  });

  it('removes special characters', () => {
    expect(normalizeModelFamily('model@v2!')).toBe('modelv2');
  });

  it('collapses multiple spaces/underscores into one hyphen', () => {
    expect(normalizeModelFamily('gpt   4   turbo')).toBe('gpt-4-turbo');
  });

  it('trims leading/trailing whitespace', () => {
    expect(normalizeModelFamily('  claude-3  ')).toBe('claude-3');
  });

  it('preserves dots in model names', () => {
    expect(normalizeModelFamily('gpt-4.1')).toBe('gpt-4.1');
  });

  it('handles already-slugified input', () => {
    expect(normalizeModelFamily('claude-opus-4')).toBe('claude-opus-4');
  });
});

// ─── estimateCost() ──────────────────────────────────────────────────

describe('estimateCost', () => {
  it('returns an ITokenCost object with all expected fields', () => {
    const cost = estimateCost(100, 200, 'gpt-4');
    expect(cost).toHaveProperty('inputCost');
    expect(cost).toHaveProperty('outputCost');
    expect(cost).toHaveProperty('totalCost');
    expect(cost).toHaveProperty('inputRate');
    expect(cost).toHaveProperty('outputRate');
    expect(cost).toHaveProperty('provider');
    expect(cost).toHaveProperty('modelKey');
    expect(cost).toHaveProperty('currency');
  });

  it('normalizes the model key', () => {
    const cost = estimateCost(100, 200, 'Claude Sonnet 4');
    expect(cost.modelKey).toBe('claude-sonnet-4');
  });

  it('defaults provider to "unknown" when not supplied', () => {
    const cost = estimateCost(100, 200, 'gpt-4');
    expect(cost.provider).toBe('unknown');
  });

  it('uses the supplied provider name', () => {
    const cost = estimateCost(100, 200, 'gpt-4', 'openai');
    expect(cost.provider).toBe('openai');
  });

  it('handles the object-form modelFamily for backward compat', () => {
    const cost = estimateCost(100, 200, { family: 'GPT 4 Turbo' });
    expect(cost.modelKey).toBe('gpt-4-turbo');
  });

  it('returns USD currency', () => {
    const cost = estimateCost(0, 0, 'gpt-4');
    expect(cost.currency).toBe('USD');
  });

  it('returns zero costs (placeholder implementation)', () => {
    const cost = estimateCost(1000, 500, 'gpt-4', 'openai');
    expect(cost.totalCost).toBe(0);
    expect(cost.inputCost).toBe(0);
    expect(cost.outputCost).toBe(0);
  });
});
