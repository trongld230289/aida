# Bitbucket Cloud Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Bitbucket Cloud (bitbucket.org) as a 4th source control provider for PR Review and Dependency PR analysis, alongside GitHub, Azure DevOps, and GitLab.

**Architecture:** Mirror the existing per-provider module pattern. URL parsing recognizes `bitbucket.org/{workspace}/{repo}/pull-requests/{id}`. A new `pr-fetch-bitbucket.ts` module fetches PR metadata, diffstat, raw diff, and commits from Bitbucket Cloud REST API 2.0, normalizing into the same shape the review/dependency pipelines already consume. Auth reuses the existing `bitbucketAuthHeader` (auto-detects App Password `user:pass` → Basic vs Access Token → Bearer).

**Tech Stack:** TypeScript, VS Code extension API, Node `https`, Vitest (`npm test`), Webpack build (`npm run build`), ESLint (`npm run lint`).

---

## File Structure

- `scripts/core/source-control-config.ts` — add Bitbucket branch to `parsePRUrl`; add Bitbucket entries to `showTokenConfigurationHelp`.
- `scripts/review/pr-utils.ts` — add Bitbucket branch to `parsePRUrlInfo`.
- `scripts/review/pr-fetch-bitbucket.ts` — **NEW** provider module (mirror `pr-fetch-gitlab.ts`).
- `scripts/review/pr-file-fetcher.ts` — add `bitbucket` case + import.
- `scripts/review/pr-review-handler.ts` — add `bitbucket` routing branch + error hints.
- `scripts/dependency/dependency-handlers.ts` — add Bitbucket URL pattern to `isPRUrl`.
- `scripts/dependency/dependency.ts` — add Bitbucket example URLs (two locations).
- `package.json` — add `bitbucket` to `aida.sourceControls` schema.
- `scripts/__tests__/source-control-config.test.ts` — **NEW** test for `parsePRUrl`.
- `scripts/__tests__/pr-utils-parse.test.ts` — **NEW** test for `parsePRUrlInfo`.

**Note on `pr-fetch-base.ts`:** `bitbucketAuthHeader` and `BITBUCKET_ERROR_MESSAGES` already exist there. Do NOT re-add them.

---

## Task 1: Parse Bitbucket URL in `source-control-config.ts`

**Files:**
- Modify: `scripts/core/source-control-config.ts` (function `parsePRUrl`, after the GitLab block ~line 62, before the final `throw`)
- Test: `scripts/__tests__/source-control-config.test.ts` (new)

- [ ] **Step 1: Write the failing test**

Create `scripts/__tests__/source-control-config.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';

vi.mock('vscode', () => ({
  workspace: { getConfiguration: () => ({ get: () => ({}) }) },
  window: {},
  commands: {},
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- source-control-config`
Expected: FAIL — Bitbucket case throws `Unsupported PR/MR URL format`.

- [ ] **Step 3: Add the Bitbucket branch**

In `scripts/core/source-control-config.ts`, insert immediately before `throw new Error(\`Unsupported PR/MR URL format: ${prUrl}\`);`:

```typescript
    // Bitbucket Cloud: https://bitbucket.org/{workspace}/{repository}/pull-requests/{id}
    if (url.includes('bitbucket.org')) {
        const match = url.match(/bitbucket\.org\/([^\/]+)\/([^\/]+)\/pull-requests\/(\d+)/);
        if (match) {
            return {
                provider: 'bitbucket',
                organization: match[1]!,
                repository: match[2]!,
                prId: match[3]!
            };
        }
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- source-control-config`
Expected: PASS (both tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/core/source-control-config.ts scripts/__tests__/source-control-config.test.ts
git commit -m "feat: parse Bitbucket Cloud PR URLs in source-control-config"
```

---

## Task 2: Parse Bitbucket URL in `pr-utils.ts`

**Files:**
- Modify: `scripts/review/pr-utils.ts` (function `parsePRUrlInfo`, ~lines 25-96)
- Test: `scripts/__tests__/pr-utils-parse.test.ts` (new)

- [ ] **Step 1: Write the failing test**

Create `scripts/__tests__/pr-utils-parse.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';

vi.mock('vscode', () => ({
  workspace: { getConfiguration: () => ({ get: () => ({}) }) },
  window: {},
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- pr-utils-parse`
Expected: FAIL — `repoType` is `null` (or falls through to azure) for Bitbucket URL.

- [ ] **Step 3: Add the Bitbucket pattern and branch**

In `scripts/review/pr-utils.ts`, inside `parsePRUrlInfo`:

3a. After the GitLab pattern declarations (~line 46), add:

```typescript
    // Bitbucket Cloud URL pattern: https://bitbucket.org/{workspace}/{repo}/pull-requests/{id}
    const bitbucketUrlPattern = /https:\/\/bitbucket\.org\/([^\/]+)\/([^\/]+)\/pull-requests\/(\d+)/i;
    const bitbucketMatch = userMessage.match(bitbucketUrlPattern);
```

3b. Add a new `else if` branch BEFORE the final `else` fallback block (the one starting `// Fallback to simple PR ID pattern`). Insert after the closing `}` of the `gitlabMatch` branch (~line 75) and before `} else {`:

```typescript
    } else if (bitbucketMatch) {
        repoType = 'bitbucket';
        owner = bitbucketMatch[1];
        organization = bitbucketMatch[1];
        repo = bitbucketMatch[2];
        repository = bitbucketMatch[2];
        prId = bitbucketMatch[3];
        originalUrl = bitbucketMatch[0];
```

(The existing `} else {` fallback now follows this new branch.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- pr-utils-parse`
Expected: PASS (both tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/review/pr-utils.ts scripts/__tests__/pr-utils-parse.test.ts
git commit -m "feat: parse Bitbucket Cloud PR URLs in pr-utils"
```

---

## Task 3: Create `pr-fetch-bitbucket.ts` provider module

**Files:**
- Create: `scripts/review/pr-fetch-bitbucket.ts`

- [ ] **Step 1: Create the module**

Create `scripts/review/pr-fetch-bitbucket.ts` with the following full content:

```typescript
/**
 * @module pr-fetch-bitbucket
 * @description Bitbucket Cloud PR data fetching (REST API 2.0).
 * Mirrors pr-fetch-gitlab.ts for consistency with the existing provider pattern.
 */

import * as _vscode from 'vscode';
import { getTokenForPR, showTokenConfigurationHelp } from './review-common';
import { aidaLogging } from '../core/settings';
import { DEFAULTS } from '../core/aida-config';
import { filterReviewableFiles, countDiffLines } from './pr-utils';
import { toError } from '../core/error-utils';
import { makeHttpsRequest, bitbucketAuthHeader, BITBUCKET_ERROR_MESSAGES, type IHttpsResponse } from './pr-fetch-base';

const BITBUCKET_API = 'https://api.bitbucket.org/2.0';

/**
 * Make HTTP request to Bitbucket Cloud REST API.
 * Delegates to shared makeHttpsRequest with Bitbucket-specific auth & error messages.
 */
async function makeBitbucketRequest(url: string, token: string, method = 'GET', customHeaders: Record<string, string> = {}): Promise<IHttpsResponse<Record<string, any>>> {
    return makeHttpsRequest<Record<string, any>>({
        url,
        method,
        token,
        authHeaderFn: bitbucketAuthHeader,
        defaultHeaders: { Accept: 'application/json' },
        extraHeaders: customHeaders,
        timeoutMs: DEFAULTS.PR_FETCH_TIMEOUT_MS,
        errorMessages: BITBUCKET_ERROR_MESSAGES,
        isTextResponse: (h) => !!h['Accept']?.includes('text/plain'),
    });
}

/**
 * Fetch all pages of a paginated Bitbucket collection endpoint.
 * Bitbucket returns { values: [], next?: string }.
 */
async function fetchAllPages(firstUrl: string, token: string): Promise<Record<string, any>[]> {
    const all: Record<string, any>[] = [];
    let nextUrl: string | undefined = firstUrl;
    let guard = 0;
    while (nextUrl && guard < 50) {
        guard++;
        const res: IHttpsResponse<Record<string, any>> = await makeBitbucketRequest(nextUrl, token);
        if (!res.success || !res.data) {
            break;
        }
        const values = (res.data.values as Record<string, any>[]) || [];
        all.push(...values);
        nextUrl = res.data.next as string | undefined;
    }
    return all;
}

/**
 * Get file content from Bitbucket at a specific commit.
 */
async function getBitbucketFileContent(workspace: string, repo: string, filePath: string, commit: string, token: string) {
    try {
        aidaLogging(`🔄 Fetching Bitbucket content for ${filePath} at commit ${commit.substring(0, 7)}`);
        const url = `${BITBUCKET_API}/repositories/${workspace}/${repo}/src/${commit}/${filePath.split('/').map(encodeURIComponent).join('/')}`;
        const res = await makeBitbucketRequest(url, token, 'GET', { Accept: 'text/plain' });
        if (res.success && typeof res.data === 'string') {
            aidaLogging(`✅ Got Bitbucket file content: ${(res.data as string).length} chars`);
            return res.data as unknown as string;
        }
        aidaLogging(`❌ Could not fetch Bitbucket content: ${res.error || 'unknown'}`);
        return null;
    } catch (_error: unknown) {
        const error = toError(_error);
        aidaLogging(`❌ Error fetching Bitbucket content for ${filePath}: ${error.message}`);
        return null;
    }
}

/**
 * Map a Bitbucket diffstat entry to a normalized changeType.
 */
function mapStatus(status: string): string {
    switch ((status || '').toLowerCase()) {
        case 'added': return 'added';
        case 'removed': return 'removed';
        case 'renamed': return 'renamed';
        case 'modified':
        default: return 'modified';
    }
}

/**
 * Get Pull Request data from Bitbucket Cloud REST API.
 */
async function getBitbucketPR(workspace: string, repo: string, prId: string | number, token: string) {
    try {
        aidaLogging(`📝 Fetching Bitbucket PR details: ${workspace}/${repo}#${prId}`);

        const base = `${BITBUCKET_API}/repositories/${workspace}/${repo}/pullrequests/${prId}`;

        // PR details
        const prResponse = await makeBitbucketRequest(base, token);
        if (!prResponse.success) {
            aidaLogging('Failed to get Bitbucket PR details:', prResponse.error);
            return { success: false, error: `Failed to get PR: ${prResponse.error}` };
        }
        const pr = prResponse.data!;

        // Diffstat (file metadata, paginated)
        aidaLogging('📁 Fetching Bitbucket diffstat...');
        const diffstat = await fetchAllPages(`${base}/diffstat?pagelen=100`, token);
        aidaLogging(`✅ Found ${diffstat.length} changed files`);

        // Raw unified diff
        aidaLogging('🔄 Fetching unified diff from Bitbucket...');
        const diffResponse = await makeBitbucketRequest(`${base}/diff`, token, 'GET', { Accept: 'text/plain' });
        let finalDiff = '';
        if (diffResponse.success && typeof diffResponse.data === 'string') {
            finalDiff = diffResponse.data;
            aidaLogging(`✅ Got unified diff: ${finalDiff.length} characters`);
        } else {
            aidaLogging('⚠️ Could not get unified diff, will build placeholders');
        }

        // Build file changes
        const fileChanges = diffstat.map((entry: Record<string, any>) => {
            const newPath = entry.new?.path as string | undefined;
            const oldPath = entry.old?.path as string | undefined;
            const fileName = newPath || oldPath || 'unknown';
            const changeType = mapStatus(entry.status);

            let diffContent = '';
            if (finalDiff) {
                const escaped = fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const filePattern = new RegExp(`diff --git a/${escaped} b/${escaped}([\\s\\S]*?)(?=diff --git|$)`, 'g');
                const match = filePattern.exec(finalDiff);
                if (match) {
                    diffContent = `diff --git a/${fileName} b/${fileName}${match[1]}`;
                }
            }

            if (!diffContent) {
                diffContent = `diff --git a/${oldPath || fileName} b/${newPath || fileName}\n`;
                if (changeType === 'added') {
                    diffContent += `new file mode 100644\n--- /dev/null\n+++ b/${fileName}\n@@ -0,0 +1,1 @@\n+[File content not available via Bitbucket API]`;
                } else if (changeType === 'removed') {
                    diffContent += `deleted file mode 100644\n--- a/${fileName}\n+++ /dev/null\n@@ -1,1 +0,0 @@\n-[File content not available via Bitbucket API]`;
                } else {
                    diffContent += `--- a/${oldPath || fileName}\n+++ b/${newPath || fileName}\n@@ -1,1 +1,1 @@\n-[Original content not available]\n+[Modified content not available]`;
                }
            }

            const counted = countDiffLines(diffContent);
            const additions = typeof entry.lines_added === 'number' ? entry.lines_added : counted.additions;
            const deletions = typeof entry.lines_removed === 'number' ? entry.lines_removed : counted.deletions;

            return {
                path: fileName,
                changeType,
                additions,
                deletions,
                changes: additions + deletions,
                diffContent,
                diff: diffContent,
                source: 'Bitbucket API',
                oldPath,
                newPath
            };
        });

        const reviewableFileChanges = filterReviewableFiles(fileChanges, 'Bitbucket');

        // Commits (paginated)
        aidaLogging('📝 Fetching Bitbucket commits...');
        const commitValues = await fetchAllPages(`${base}/commits?pagelen=100`, token);
        const commits = commitValues.map((c: Record<string, any>) => ({
            commitId: c.hash,
            comment: c.message,
            author: {
                name: c.author?.user?.display_name || c.author?.raw || 'Unknown',
                date: c.date
            }
        }));
        aidaLogging(`✅ Found ${commits.length} commits`);

        return {
            success: true,
            data: {
                id: prId,
                title: pr.title || `PR #${prId}`,
                description: pr.description || 'No description provided',
                author: pr.author?.display_name || 'Unknown',
                status: pr.state || 'OPEN',
                owner: workspace,
                repository: repo,
                sourceCommit: pr.source?.commit?.hash,
                targetCommit: pr.destination?.commit?.hash,
                sourceBranch: pr.source?.branch?.name,
                targetBranch: pr.destination?.branch?.name,
                diffCommand: 'Bitbucket API (workspace-independent)',
                fileChanges: fileChanges,
                reviewableFileChanges: reviewableFileChanges,
                commits: commits,
                totalCommits: commits.length,
                finalDiff: finalDiff,
                commitsList: commits.map((commit: Record<string, any>) => ({
                    id: String(commit.commitId).substring(0, 7),
                    fullId: commit.commitId,
                    message: commit.comment,
                    author: commit.author.name,
                    date: commit.author.date
                })),
                analysis: {
                    quality: `Bitbucket PR with ${fileChanges.length} file(s) changed (${reviewableFileChanges.length} for review)`,
                    security: 'Complete PR diff analysis',
                    performance: 'Full PR data from Bitbucket API',
                    testCoverage: 'Review test coverage for modified files',
                    codeReview: [
                        `📁 ${fileChanges.length} file(s) changed (${reviewableFileChanges.length} reviewable)`,
                        `➕ ${fileChanges.reduce((sum: number, f: Record<string, number>) => sum + (f.additions ?? 0), 0)} lines added`,
                        `➖ ${fileChanges.reduce((sum: number, f: Record<string, number>) => sum + (f.deletions ?? 0), 0)} lines removed`,
                        `🔍 Source: Bitbucket REST API`,
                        `📝 ${commits.length} commits`,
                        `🌿 ${pr.source?.branch?.name} → ${pr.destination?.branch?.name}`
                    ]
                }
            }
        };
    } catch (_error: unknown) {
        const error = toError(_error);
        aidaLogging('Error in getBitbucketPR:', error);
        return { success: false, error: `Unable to fetch PR: ${error.message}` };
    }
}

/**
 * Analyze Bitbucket Pull Request (token check + fetch).
 */
async function analyzeBitbucketPullRequest(stream: _vscode.ChatResponseStream, workspace: string, repo: string, prId: string | number): Promise<Record<string, unknown>> {
    try {
        aidaLogging(`🔄 Fetching Bitbucket PR ${workspace}/${repo}#${prId}`);

        const prUrl = `https://bitbucket.org/${workspace}/${repo}/pull-requests/${prId}`;
        const token = getTokenForPR(prUrl);

        if (!token) {
            showTokenConfigurationHelp('bitbucket', workspace, stream);
            return { success: false, error: `Bitbucket credentials are required for workspace: ${workspace}` };
        }

        const prData = await getBitbucketPR(workspace, repo, prId, token);
        if (!prData.success) {
            aidaLogging('Failed to get Bitbucket PR:', prData.error);
            stream.markdown('❌ **Bitbucket API Error**\n\n');
            stream.markdown(`Error: ${prData.error}\n\n`);
            return { error: prData.error };
        }

        return { success: true, data: prData.data };
    } catch (_error: unknown) {
        const error = toError(_error);
        aidaLogging('Error in analyzeBitbucketPullRequest:', error);
        return { error: `Analysis failed: ${error.message}` };
    }
}

// ES exports
export { getBitbucketFileContent, analyzeBitbucketPullRequest, getBitbucketPR, makeBitbucketRequest };
```

- [ ] **Step 2: Type-check the new module**

Run: `npx tsc --noEmit`
Expected: PASS — no type errors. (If `DEFAULTS.PR_FETCH_TIMEOUT_MS` errors, confirm the import path matches `pr-fetch-gitlab.ts`, which uses the same import.)

- [ ] **Step 3: Commit**

```bash
git add scripts/review/pr-fetch-bitbucket.ts
git commit -m "feat: add Bitbucket Cloud PR fetch module"
```

---

## Task 4: Wire Bitbucket into `pr-file-fetcher.ts`

**Files:**
- Modify: `scripts/review/pr-file-fetcher.ts` (imports ~line 5, error message ~line 36, switch ~lines 54-66)

- [ ] **Step 1: Add the import**

After line 5 (`import { getGitLabMR } from './pr-fetch-gitlab';`), add:

```typescript
import { getBitbucketPR } from './pr-fetch-bitbucket';
```

- [ ] **Step 2: Update the unsupported-format error message**

In `parsePRUrl`, change:

```typescript
            throw new Error('Unsupported PR URL format. Supported: GitHub, Azure DevOps, GitLab');
```

to:

```typescript
            throw new Error('Unsupported PR URL format. Supported: GitHub, Azure DevOps, GitLab, Bitbucket');
```

- [ ] **Step 3: Add the `bitbucket` case in `fetchFiles`**

In the `switch (prInfo.repoType)` block, after the `gitlab` case block, add:

```typescript
            case 'bitbucket':
                result = await getBitbucketPR(prInfo.organization as any, prInfo.repo as any, prInfo.prId as any, token);
                break;
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/review/pr-file-fetcher.ts
git commit -m "feat: route Bitbucket PRs through unified file fetcher"
```

---

## Task 5: Wire Bitbucket routing into `pr-review-handler.ts`

**Files:**
- Modify: `scripts/review/pr-review-handler.ts` (imports ~lines 12-13, `processPrReview` repo-info block ~lines 328-344, analysis branch ~lines 348-360, error hints ~lines 365-378)

- [ ] **Step 1: Add the import**

After line 13 (`import { analyzeGitLabMergeRequest } from './pr-fetch-gitlab';`), add:

```typescript
import { analyzeBitbucketPullRequest } from './pr-fetch-bitbucket';
```

- [ ] **Step 2: Add the repo-info display branch**

In `processPrReview`, change the `else if (repoType === 'gitlab') { ... } else { ...azure... }` chain so a Bitbucket branch is added before the final Azure `else`. Replace:

```typescript
        } else {
            stream.markdown('🔍 **Analyzing Azure DevOps** 📋 **PR ID**: ' + prId + '\n\n');
```

with:

```typescript
        } else if (repoType === 'bitbucket') {
            stream.markdown('🪣 **Analyzing Bitbucket Pull Request...**\n\n');
            stream.markdown(`🪣 **Repository**: ${owner}/${repo}\n`);
            stream.markdown(`📋 **PR**: #${prId}\n`);
            stream.markdown(`🏢 **Workspace**: ${organization}\n`);
            stream.markdown('⏳ **Fetching from Bitbucket API...**\n\n');
        } else {
            stream.markdown('🔍 **Analyzing Azure DevOps** 📋 **PR ID**: ' + prId + '\n\n');
```

- [ ] **Step 3: Add the analysis branch**

Replace:

```typescript
        } else {
            aidaLogging(`🔵 DEBUG: Starting Azure DevOps PR analysis for PR #${prId}`);
            prAnalysis = await analyzePullRequest(stream, String(prId), organization, project, repository) as Record<string, any>;
```

with:

```typescript
        } else if (repoType === 'bitbucket') {
            aidaLogging(`🪣 DEBUG: Starting Bitbucket PR analysis for ${owner}/${repo}#${prId}`);
            prAnalysis = await analyzeBitbucketPullRequest(stream, organization!, repo!, prId!) as Record<string, any>;
            aidaLogging('🪣 DEBUG: Bitbucket PR analysis result:', JSON.stringify(prAnalysis, null, 2));
        } else {
            aidaLogging(`🔵 DEBUG: Starting Azure DevOps PR analysis for PR #${prId}`);
            prAnalysis = await analyzePullRequest(stream, String(prId), organization, project, repository) as Record<string, any>;
```

- [ ] **Step 4: Add Bitbucket error hints**

In the error-cause block, replace:

```typescript
            } else {
                stream.markdown('• Insufficient Azure DevOps access permissions\n');
```

with:

```typescript
            } else if (repoType === 'bitbucket') {
                stream.markdown('• Bitbucket credentials not configured or insufficient permissions\n');
                stream.markdown('• PR ID does not exist or repository is private\n');
                stream.markdown('• Use App Password (`username:app_password`) or an Access Token\n');
            } else {
                stream.markdown('• Insufficient Azure DevOps access permissions\n');
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add scripts/review/pr-review-handler.ts
git commit -m "feat: route Bitbucket PRs through review handler"
```

---

## Task 6: Recognize Bitbucket URLs in Dependency PR

**Files:**
- Modify: `scripts/dependency/dependency-handlers.ts` (`isPRUrl`, ~lines 142-147)
- Modify: `scripts/dependency/dependency.ts` (two example blocks, ~lines 147-149 and ~lines 289-291)

- [ ] **Step 1: Add Bitbucket pattern to `isPRUrl`**

In `scripts/dependency/dependency-handlers.ts`, change the `patterns` array to include Bitbucket:

```typescript
    const patterns = [
        /github\.com\/[^\/]+\/[^\/]+\/pull\/\d+/i,
        /dev\.azure\.com\/[^\/]+\/[^\/]+\/_git\/[^\/]+\/pullrequest\/\d+/i,
        /gitlab\.com\/.+\/-\/merge_requests\/\d+/i,
        /bitbucket\.org\/[^\/]+\/[^\/]+\/pull-requests\/\d+/i
    ];
```

- [ ] **Step 2: Add Bitbucket example to both help blocks in `dependency.ts`**

In `scripts/dependency/dependency.ts`, in BOTH places where the GitLab example appears:

```typescript
                stream.markdown('- `@dependency-pr https://gitlab.com/group/repo/-/merge_requests/78`\n');
```

add a Bitbucket line immediately after each:

```typescript
                stream.markdown('- `@dependency-pr https://bitbucket.org/workspace/repo/pull-requests/90`\n');
```

(Match the indentation used at each location — ~line 149 uses the indentation shown; the ~line 291 block uses the same pattern.)

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add scripts/dependency/dependency-handlers.ts scripts/dependency/dependency.ts
git commit -m "feat: recognize Bitbucket Cloud URLs in dependency PR analysis"
```

---

## Task 7: Add Bitbucket config schema and token help

**Files:**
- Modify: `package.json` (`aida.sourceControls`, default block ~lines 215-228 and properties block ~lines 230-261)
- Modify: `scripts/core/source-control-config.ts` (`showTokenConfigurationHelp`, `providerNames` ~lines 148-152 and `providerConfigs` ~lines 157-173)

- [ ] **Step 1: Add `bitbucket` to the schema default**

In `package.json`, inside `"aida.sourceControls"` → `"default"`, after the `gitlab` object, add:

```json
            "bitbucket": {
              "workspace": "your-bitbucket-app-password-or-token-here",
              "anotherWorkspace": "username:app_password"
            }
```

(Add a comma after the `gitlab` closing brace so JSON stays valid.)

- [ ] **Step 2: Add `bitbucket` to the schema properties**

In `package.json`, inside `"aida.sourceControls"` → `"properties"`, after the `gitlab` property, add:

```json
            "bitbucket": {
              "type": "object",
              "description": "Bitbucket Cloud workspaces and their credentials. Workspace name from URL: bitbucket.org/{WORKSPACE}/repo. Use an App Password in 'username:app_password' format, or a Repository/Workspace Access Token.",
              "patternProperties": {
                ".*": {
                  "type": "string",
                  "description": "App Password (username:app_password) or Access Token for the workspace"
                }
              }
            }
```

(Add a comma after the `gitlab` property's closing brace so JSON stays valid.)

- [ ] **Step 3: Validate package.json is still valid JSON**

Run: `node -e "require('./package.json'); console.log('valid')"`
Expected: prints `valid`.

- [ ] **Step 4: Add `bitbucket` to `providerNames` in `showTokenConfigurationHelp`**

In `scripts/core/source-control-config.ts`, change:

```typescript
    const providerNames = {
        azureDevOps: 'Azure DevOps',
        github: 'GitHub',
        gitlab: 'GitLab'
    };
```

to:

```typescript
    const providerNames = {
        azureDevOps: 'Azure DevOps',
        github: 'GitHub',
        gitlab: 'GitLab',
        bitbucket: 'Bitbucket'
    };
```

- [ ] **Step 5: Add `bitbucket` to `providerConfigs`**

In the same function, change the `providerConfigs` object by adding a `bitbucket` entry after `gitlab`:

```typescript
        gitlab: {
            name: 'GitLab',
            docs: 'https://docs.gitlab.com/ee/user/profile/personal_access_tokens.html',
            permissions: 'api (Access to the authenticated user\'s API), read_repository'
        },
        bitbucket: {
            name: 'Bitbucket',
            docs: 'https://support.atlassian.com/bitbucket-cloud/docs/create-an-app-password/',
            permissions: 'Pull requests: Read, Repositories: Read (App Password "username:app_password" or Access Token)'
        }
```

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add package.json scripts/core/source-control-config.ts
git commit -m "feat: add Bitbucket config schema and token setup help"
```

---

## Task 8: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the test suite**

Run: `npm test`
Expected: PASS — all existing tests plus the two new parse tests pass.

- [ ] **Step 2: Run the linter**

Run: `npm run lint`
Expected: PASS (0 warnings). Fix any lint errors introduced in the new/modified files.

- [ ] **Step 3: Run the production build**

Run: `npm run build`
Expected: Webpack build completes without errors.

- [ ] **Step 4: Final commit (if lint/build required fixes)**

```bash
git add -A
git commit -m "chore: lint/build fixes for Bitbucket support"
```

(Skip if Steps 1-3 required no changes.)

---

## Self-Review Notes

- **Spec coverage:** URL parsing (Tasks 1-2), token/auth reuse (existing `pr-fetch-base.ts`, used in Task 3), provider module (Task 3), review routing (Task 5), file fetcher (Task 4), dependency PR (Task 6), config + help (Task 7), testing/build (Task 8). All spec sections mapped.
- **Type consistency:** Exported names `getBitbucketPR`, `analyzeBitbucketPullRequest`, `makeBitbucketRequest`, `getBitbucketFileContent` are used consistently in Tasks 3-5. `getBitbucketPR(workspace, repo, prId, token)` signature matches calls in Tasks 4 and 5. `analyzeBitbucketPullRequest(stream, workspace, repo, prId)` is called with `(stream, organization!, repo!, prId!)` in Task 5 — `organization` holds the workspace per Task 2 parsing.
- **Field mapping:** `getBitbucketPR` returns the same data shape as `getGitLabMR` (verified against `pr-file-fetcher.ts` `normalizeFileChange`, which reads `fileChanges[].diffContent/diff/changeType/additions/deletions`).
