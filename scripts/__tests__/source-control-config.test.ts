import { describe, it, expect, vi } from 'vitest';

vi.mock('vscode', () => ({
  workspace: { getConfiguration: () => ({ get: () => ({}) }) },
  window: {
    createOutputChannel: () => ({ appendLine: vi.fn(), show: vi.fn() }),
    showErrorMessage: vi.fn(),
  },
  commands: { executeCommand: vi.fn() },
}));

import { parsePRUrl } from '../core/source-control-config';

describe('parsePRUrl - Bitbucket Cloud', () => {
  it('parses a Bitbucket Cloud PR URL', () => {
    const result = parsePRUrl('https://bitbucket.org/myworkspace/myrepo/pull-requests/42');
    expect(result).toEqual({
      provider: 'bitbucket',
      organization: 'myworkspace',
      repository: 'myrepo',
      prId: '42',
    });
  });

  it('still parses a GitHub PR URL', () => {
    const result = parsePRUrl('https://github.com/owner/repo/pull/7');
    expect(result.provider).toBe('github');
    expect(result.prId).toBe('7');
  });
});
