import { describe, it, expect, vi } from 'vitest';

vi.mock('vscode', () => ({
  workspace: { getConfiguration: () => ({ get: () => ({}) }) },
  window: { createOutputChannel: () => ({ appendLine: () => {}, show: () => {}, dispose: () => {} }) },
  commands: {},
}));

import { parsePRUrlInfo } from '../review/pr-utils';

describe('parsePRUrlInfo - Bitbucket Cloud', () => {
  it('parses a Bitbucket Cloud PR URL', () => {
    const r = parsePRUrlInfo('https://bitbucket.org/myworkspace/myrepo/pull-requests/42') as any;
    expect(r.repoType).toBe('bitbucket');
    expect(r.owner).toBe('myworkspace');
    expect(r.organization).toBe('myworkspace');
    expect(r.repo).toBe('myrepo');
    expect(r.repository).toBe('myrepo');
    expect(r.prId).toBe('42');
    expect(r.originalUrl).toBe('https://bitbucket.org/myworkspace/myrepo/pull-requests/42');
  });

  it('still parses GitHub', () => {
    const r = parsePRUrlInfo('https://github.com/owner/repo/pull/7') as any;
    expect(r.repoType).toBe('github');
  });
});
