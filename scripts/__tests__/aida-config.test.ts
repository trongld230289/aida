/**
 * @module __tests__/aida-config.test
 * @description Unit tests for core/aida-config — DEFAULTS, getSetting, helpers
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { __clearMockConfig, __setMockConfig } from '../__mocks__/vscode';
import { DEFAULTS, getSetting, getChatbotDefaultModel, getChatbotPreferredModelKeyword } from '../core/aida-config';

// Reset mock config store before each test
beforeEach(() => {
  __clearMockConfig();
});

// ─── DEFAULTS constant ───────────────────────────────────────────────

describe('DEFAULTS', () => {
  it('is a frozen object', () => {
    expect(Object.isFrozen(DEFAULTS)).toBe(true);
  });

  it('has required token limit fields', () => {
    expect(DEFAULTS.MAX_CONTEXT_LENGTH).toBe(8000);
    expect(DEFAULTS.MAX_TOKENS_CHAT).toBe(4000);
    expect(DEFAULTS.MAX_TOKENS_REVIEW).toBe(8000);
    expect(DEFAULTS.COPILOT_SOFT_LIMIT).toBe(25000);
    expect(DEFAULTS.COPILOT_HARD_LIMIT).toBe(32000);
  });

  it('has required network timeout fields', () => {
    expect(DEFAULTS.PR_FETCH_TIMEOUT_MS).toBe(15000);
    expect(DEFAULTS.AZURE_API_TIMEOUT_MS).toBe(10000);
  });

  it('has retry configuration', () => {
    expect(DEFAULTS.MAX_RETRIES).toBe(5);
    expect(DEFAULTS.RETRY_DELAYS).toHaveLength(5);
    expect(DEFAULTS.RETRY_DELAYS[0]).toBe(500);
  });

  it('has model defaults', () => {
    expect(typeof DEFAULTS.CHATBOT_DEFAULT_MODEL).toBe('string');
    expect(typeof DEFAULTS.EXTERNAL_AI_MODEL).toBe('string');
    expect(typeof DEFAULTS.EXTERNAL_AI_HOST).toBe('string');
    expect(DEFAULTS.EXTERNAL_AI_HOST).toMatch(/^https:\/\//);
  });
});

// ─── getSetting() ────────────────────────────────────────────────────

describe('getSetting', () => {
  it('returns the fallback when no config value is set', () => {
    expect(getSetting('nonexistent.key', 42)).toBe(42);
  });

  it('returns the config value when one is set', () => {
    __setMockConfig('chatbot.timeout', 9999);
    expect(getSetting('chatbot.timeout', 5000)).toBe(9999);
  });

  it('returns string fallback when unset', () => {
    expect(getSetting('model.name', 'default-model')).toBe('default-model');
  });

  it('returns boolean config values correctly', () => {
    __setMockConfig('debugMode', true);
    expect(getSetting('debugMode', false)).toBe(true);
  });
});

// ─── getChatbotDefaultModel() ────────────────────────────────────────

describe('getChatbotDefaultModel', () => {
  it('returns DEFAULTS when no override is set', () => {
    expect(getChatbotDefaultModel()).toBe(DEFAULTS.CHATBOT_DEFAULT_MODEL);
  });

  it('returns the overridden value from config', () => {
    __setMockConfig('chatbot.defaultModel', 'gpt-4o');
    expect(getChatbotDefaultModel()).toBe('gpt-4o');
  });
});

// ─── getChatbotPreferredModelKeyword() ───────────────────────────────

describe('getChatbotPreferredModelKeyword', () => {
  it('returns DEFAULTS when no override is set', () => {
    expect(getChatbotPreferredModelKeyword()).toBe(DEFAULTS.CHATBOT_PREFERRED_MODEL_KEYWORD);
  });

  it('returns the overridden value from config', () => {
    __setMockConfig('chatbot.preferredModelKeyword', 'sonnet');
    expect(getChatbotPreferredModelKeyword()).toBe('sonnet');
  });
});
