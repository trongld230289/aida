/**
 * @module __tests__/aida-context.test
 * @description Integration tests for core/aida-context — AidaContext singleton
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AidaContext, ctx, installGlobalBridge } from '../core/aida-context';

// ─── Singleton ───────────────────────────────────────────────────────

describe('AidaContext singleton', () => {
  it('returns the same instance on repeated access', () => {
    expect(AidaContext.instance).toBe(AidaContext.instance);
  });

  it('exports ctx as a shorthand for AidaContext.instance', () => {
    expect(ctx).toBe(AidaContext.instance);
  });

  it('has default empty values', () => {
    const instance = AidaContext.instance;
    expect(instance.extensionPath).toBe('');
    expect(instance.extensionContext).toBeNull();
    expect(instance.selectedBusinessDocs).toBeNull();
    expect(instance.currentPRData).toBeNull();
    expect(instance.prDiffCache).toEqual({});
  });

  it('has businessDocsState with both review keys', () => {
    const state = AidaContext.instance.businessDocsState;
    expect(state).toHaveProperty('changes-review');
    expect(state).toHaveProperty('file-review');
    expect(state['changes-review'].selectedCategories).toBeInstanceOf(Set);
    expect(state['file-review'].selectedCategories).toBeInstanceOf(Set);
  });
});

// ─── init() ──────────────────────────────────────────────────────────

describe('AidaContext.init', () => {
  it('sets extensionPath and extensionContext from activation context', () => {
    const instance = AidaContext.instance;
    const fakeContext = {
      extensionPath: '/test/path',
      subscriptions: [],
    } as any;

    instance.init(fakeContext);
    expect(instance.extensionPath).toBe('/test/path');
    expect(instance.extensionContext).toBe(fakeContext);
  });
});

// ─── Global bridge ───────────────────────────────────────────────────

describe('installGlobalBridge', () => {
  beforeEach(() => {
    // Reset mutable instance state
    const instance = AidaContext.instance;
    instance.extensionPath = '';
    instance.currentPRData = null;
  });

  it('syncs global.extensionPath with AidaContext', () => {
    installGlobalBridge();
    const g = global as any;

    AidaContext.instance.extensionPath = '/bridge/test';
    expect(g.extensionPath).toBe('/bridge/test');

    g.extensionPath = '/override';
    expect(AidaContext.instance.extensionPath).toBe('/override');
  });

  it('syncs global.prDiffCache with AidaContext', () => {
    installGlobalBridge();
    const g = global as any;

    AidaContext.instance.prDiffCache = { key: { diff: 'test' } as any };
    expect(g.prDiffCache).toEqual({ key: { diff: 'test' } });
  });
});
