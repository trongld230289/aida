/**
 * @module __tests__/language-detection.test
 * @description Unit tests for the pure utility functions in review/language-detection.
 * Only covers functions that don't require vscode or fs mocks.
 */

import { describe, it, expect } from 'vitest';
import {
  ext,
  ignore,
  addedSampleFromPatch,
  detectWithEnryFromContent,
  isCompatibleLanguage,
  getLanguageFromExtension,
  mapToTemplatePath,
} from '../review/language-detection';

// ─── ext() ───────────────────────────────────────────────────────────

describe('ext', () => {
  it('extracts .ts extension', () => {
    expect(ext('app.component.ts')).toBe('.ts');
  });

  it('extracts .js extension', () => {
    expect(ext('index.js')).toBe('.js');
  });

  it('lowercases the extension', () => {
    expect(ext('README.MD')).toBe('.md');
  });

  it('returns the last extension for double extensions', () => {
    expect(ext('app.spec.ts')).toBe('.ts');
  });

  it('returns empty string for no extension', () => {
    expect(ext('Dockerfile')).toBe('');
  });

  it('handles hidden files', () => {
    expect(ext('.gitignore')).toBe('.gitignore');
  });
});

// ─── ignore() ────────────────────────────────────────────────────────

describe('ignore', () => {
  it('ignores paths containing node_modules', () => {
    expect(ignore('src/node_modules/pkg/index.js')).toBe(true);
  });

  it('ignores paths containing dist', () => {
    expect(ignore('project/dist/bundle.js')).toBe(true);
  });

  it('ignores paths containing .git', () => {
    expect(ignore('.git/HEAD')).toBe(true);
  });

  it('ignores paths containing build', () => {
    expect(ignore('out/build/release/main.js')).toBe(true);
  });

  it('ignores paths containing coverage', () => {
    expect(ignore('coverage/lcov.info')).toBe(true);
  });

  it('does not ignore normal source paths', () => {
    expect(ignore('src/app/main.ts')).toBe(false);
  });

  it('does not ignore scripts path', () => {
    expect(ignore('scripts/core/token-estimator.ts')).toBe(false);
  });
});

// ─── addedSampleFromPatch() ──────────────────────────────────────────

describe('addedSampleFromPatch', () => {
  it('extracts only lines starting with +', () => {
    const patch = [
      '@@ -1,3 +1,4 @@',
      ' unchanged',
      '-removed line',
      '+added line 1',
      '+added line 2',
    ].join('\n');
    const result = addedSampleFromPatch(patch);
    expect(result).toContain('added line 1');
    expect(result).toContain('added line 2');
    expect(result).not.toContain('removed line');
    expect(result).not.toContain('unchanged');
  });

  it('limits to 20 added lines', () => {
    const lines = Array.from({ length: 30 }, (_, i) => `+line ${i}`).join('\n');
    const result = addedSampleFromPatch(lines);
    const addedLines = result.split('\n');
    expect(addedLines.length).toBeLessThanOrEqual(20);
  });

  it('includes diff header lines that start with +', () => {
    // The function simply filters all lines starting with '+', including +++ headers
    const patch = '--- a/file.ts\n+++ b/file.ts\n unchanged';
    expect(addedSampleFromPatch(patch)).toBe('+++ b/file.ts');
  });
});

// ─── detectWithEnryFromContent() ─────────────────────────────────────

describe('detectWithEnryFromContent', () => {
  it('detects TypeScript from .ts extension', () => {
    expect(detectWithEnryFromContent('app.ts', '')).toBe('typescript');
  });

  it('detects JavaScript from .js extension', () => {
    expect(detectWithEnryFromContent('app.js', '')).toBe('javascript');
  });

  it('detects Python from .py extension', () => {
    expect(detectWithEnryFromContent('main.py', '')).toBe('python');
  });

  it('detects C# from .cs extension', () => {
    expect(detectWithEnryFromContent('Program.cs', '')).toBe('csharp');
  });

  it('returns null for unknown extensions', () => {
    expect(detectWithEnryFromContent('data.xyz', '')).toBeNull();
  });

  it('returns null for files without extensions', () => {
    expect(detectWithEnryFromContent('Makefile', '')).toBeNull();
  });
});

// ─── isCompatibleLanguage() ──────────────────────────────────────────

describe('isCompatibleLanguage', () => {
  it('angular is compatible with typescript', () => {
    expect(isCompatibleLanguage('angular', 'typescript')).toBe(true);
  });

  it('angular is compatible with javascript', () => {
    expect(isCompatibleLanguage('angular', 'javascript')).toBe(true);
  });

  it('angular is not compatible with python', () => {
    expect(isCompatibleLanguage('angular', 'python')).toBe(false);
  });

  it('nestjs is only compatible with typescript', () => {
    expect(isCompatibleLanguage('nestjs', 'typescript')).toBe(true);
    expect(isCompatibleLanguage('nestjs', 'javascript')).toBe(false);
  });

  it('returns false for unknown frameworks', () => {
    expect(isCompatibleLanguage('unknown-framework', 'typescript')).toBe(false);
  });

  it('returns false for null language', () => {
    expect(isCompatibleLanguage('react', null)).toBe(false);
  });
});

// ─── getLanguageFromExtension() ──────────────────────────────────────

describe('getLanguageFromExtension', () => {
  it('maps .ts to typescript', () => {
    expect(getLanguageFromExtension('.ts')).toBe('typescript');
  });

  it('maps .js to javascript', () => {
    expect(getLanguageFromExtension('.js')).toBe('javascript');
  });

  it('maps .py to python', () => {
    expect(getLanguageFromExtension('.py')).toBe('python');
  });

  it('maps .cs to csharp', () => {
    expect(getLanguageFromExtension('.cs')).toBe('csharp');
  });

  it('maps .html to html', () => {
    expect(getLanguageFromExtension('.html')).toBe('html');
  });

  it('returns "text" for unknown extensions', () => {
    expect(getLanguageFromExtension('.xyz')).toBe('text');
  });
});

// ─── mapToTemplatePath() ─────────────────────────────────────────────

describe('mapToTemplatePath', () => {
  it('returns framework path when a known framework is supplied', () => {
    const result = mapToTemplatePath('typescript', 'angular', {});
    expect(result.type).toBe('language');
    expect(result.name).toBe('angular');
    expect(result.path).toBe('review-code/languages/angular');
    expect(result.confidence).toBe('high');
  });

  it('returns language path when no framework but valid language', () => {
    const result = mapToTemplatePath('python', null, {});
    expect(result.type).toBe('language');
    expect(result.name).toBe('python');
    expect(result.path).toBe('review-code/languages/python');
    expect(result.confidence).toBe('medium');
  });

  it('returns fallback path when no framework and unknown language', () => {
    const result = mapToTemplatePath('unknown', null, {});
    expect(result.type).toBe('fallback');
    expect(result.path).toBe('review-code/fallback');
    expect(result.confidence).toBe('low');
  });

  it('returns fallback path when both are null', () => {
    const result = mapToTemplatePath(null, null, {});
    expect(result.type).toBe('fallback');
    expect(result.confidence).toBe('low');
  });

  it('prefers framework over language', () => {
    const result = mapToTemplatePath('typescript', 'react', {});
    expect(result.name).toBe('react');
    expect(result.source).toBe('framework-detection');
  });
});
