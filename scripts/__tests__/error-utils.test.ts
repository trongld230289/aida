/**
 * @module __tests__/error-utils.test
 * @description Unit tests for core/error-utils — toError() and errorMessage()
 */

import { describe, it, expect } from 'vitest';
import { toError, errorMessage } from '../core/error-utils';

// ─── toError() ───────────────────────────────────────────────────────

describe('toError', () => {
  it('returns the same Error when given an Error instance', () => {
    const original = new Error('boom');
    expect(toError(original)).toBe(original);
  });

  it('wraps a string into an Error', () => {
    const result = toError('something went wrong');
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe('something went wrong');
  });

  it('wraps an object with a message property', () => {
    const result = toError({ message: 'obj error' });
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe('obj error');
  });

  it('stringifies a plain number', () => {
    const result = toError(42);
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe('42');
  });

  it('stringifies a plain boolean', () => {
    const result = toError(false);
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe('false');
  });

  it('stringifies null', () => {
    const result = toError(null);
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe('null');
  });

  it('stringifies undefined', () => {
    const result = toError(undefined);
    expect(result).toBeInstanceOf(Error);
    // JSON.stringify(undefined) returns JS undefined → new Error(undefined) → message is ''
    expect(result.message).toBe('');
  });

  it('stringifies a plain object without message property', () => {
    const result = toError({ code: 404, detail: 'not found' });
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toContain('404');
  });

  it('handles objects with circular references gracefully', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    const result = toError(circular);
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe('Unknown error');
  });

  it('handles an Error subclass', () => {
    const err = new TypeError('bad type');
    expect(toError(err)).toBe(err);
    expect(toError(err)).toBeInstanceOf(TypeError);
  });

  it('coerces a numeric message property to string', () => {
    const result = toError({ message: 123 });
    expect(result.message).toBe('123');
  });
});

// ─── errorMessage() ──────────────────────────────────────────────────

describe('errorMessage', () => {
  it('extracts message from an Error', () => {
    expect(errorMessage(new Error('fail'))).toBe('fail');
  });

  it('passes through a string as the message', () => {
    expect(errorMessage('oops')).toBe('oops');
  });

  it('handles null', () => {
    expect(errorMessage(null)).toBe('null');
  });

  it('handles undefined', () => {
    expect(errorMessage(undefined)).toBe('');
  });

  it('extracts message from a plain object', () => {
    expect(errorMessage({ message: 'coded' })).toBe('coded');
  });
});
