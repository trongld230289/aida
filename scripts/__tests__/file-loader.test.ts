/**
 * @module __tests__/file-loader.test
 * @description Integration tests for core/file-loader using real file I/O.
 * Creates temp files, tests load functions, then cleans up.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  loadJsonFileSync,
  loadJsonWithCommentsSync,
  loadJsonFileAsync,
  loadTextFileSync,
  loadHtmlTemplate,
} from '../core/file-loader';

// ─── Setup temp directory ────────────────────────────────────────────

let tmpDir: string;

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aida-test-'));

  // Write test fixtures
  fs.writeFileSync(path.join(tmpDir, 'valid.json'), JSON.stringify({ name: 'test', version: 1 }));
  fs.writeFileSync(path.join(tmpDir, 'invalid.json'), '{ broken json }}');
  fs.writeFileSync(
    path.join(tmpDir, 'with-comments.json'),
    `{
  // this is a comment
  "compilerOptions": {
    /* block comment */
    "strict": true
  }
}`
  );
  fs.writeFileSync(path.join(tmpDir, 'hello.txt'), 'Hello, AIDA!');
  fs.writeFileSync(
    path.join(tmpDir, 'template.html'),
    '<h1>{{TITLE}}</h1><p>{{BODY}}</p><p>{{TITLE}}</p>'
  );
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ─── loadJsonFileSync() ──────────────────────────────────────────────

describe('loadJsonFileSync', () => {
  it('parses a valid JSON file', () => {
    const result = loadJsonFileSync<{ name: string; version: number }>(
      path.join(tmpDir, 'valid.json'),
    );
    expect(result).toEqual({ name: 'test', version: 1 });
  });

  it('returns null for a missing file', () => {
    expect(loadJsonFileSync(path.join(tmpDir, 'missing.json'))).toBeNull();
  });

  it('returns null for invalid JSON', () => {
    expect(loadJsonFileSync(path.join(tmpDir, 'invalid.json'))).toBeNull();
  });
});

// ─── loadJsonWithCommentsSync() ──────────────────────────────────────

describe('loadJsonWithCommentsSync', () => {
  it('strips comments and parses JSON', () => {
    const result = loadJsonWithCommentsSync<{
      compilerOptions: { strict: boolean };
    }>(path.join(tmpDir, 'with-comments.json'));
    expect(result).toBeDefined();
    expect(result!.compilerOptions.strict).toBe(true);
  });

  it('returns null for missing file', () => {
    expect(loadJsonWithCommentsSync(path.join(tmpDir, 'nope.json'))).toBeNull();
  });
});

// ─── loadJsonFileAsync() ─────────────────────────────────────────────

describe('loadJsonFileAsync', () => {
  it('parses a valid JSON file asynchronously', async () => {
    const result = await loadJsonFileAsync<{ name: string }>(
      path.join(tmpDir, 'valid.json'),
    );
    expect(result).toEqual({ name: 'test', version: 1 });
  });

  it('returns null for missing file', async () => {
    expect(await loadJsonFileAsync(path.join(tmpDir, 'missing.json'))).toBeNull();
  });

  it('returns null for invalid JSON', async () => {
    expect(await loadJsonFileAsync(path.join(tmpDir, 'invalid.json'))).toBeNull();
  });
});

// ─── loadTextFileSync() ──────────────────────────────────────────────

describe('loadTextFileSync', () => {
  it('reads a text file', () => {
    expect(loadTextFileSync(path.join(tmpDir, 'hello.txt'))).toBe('Hello, AIDA!');
  });

  it('returns null for missing file', () => {
    expect(loadTextFileSync(path.join(tmpDir, 'missing.txt'))).toBeNull();
  });
});

// ─── loadHtmlTemplate() ──────────────────────────────────────────────

describe('loadHtmlTemplate', () => {
  it('replaces all placeholder occurrences', () => {
    const html = loadHtmlTemplate(path.join(tmpDir, 'template.html'), {
      '{{TITLE}}': 'AIDA Review',
      '{{BODY}}': 'Report content here',
    });
    expect(html).toBe('<h1>AIDA Review</h1><p>Report content here</p><p>AIDA Review</p>');
  });

  it('returns null for missing template', () => {
    expect(loadHtmlTemplate(path.join(tmpDir, 'missing.html'), {})).toBeNull();
  });

  it('returns original content when no replacements match', () => {
    const html = loadHtmlTemplate(path.join(tmpDir, 'template.html'), {
      '{{NOMATCH}}': 'value',
    });
    expect(html).toContain('{{TITLE}}'); // placeholder unchanged
  });
});
