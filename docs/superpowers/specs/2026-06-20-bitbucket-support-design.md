# Bitbucket Cloud Support — Design

**Date:** 2026-06-20
**Status:** Approved (design), pending implementation
**Scope:** Add Bitbucket Cloud (bitbucket.org) as a 4th source control provider for both **PR Review** and **Dependency PR** features, alongside the existing GitHub, Azure DevOps, and GitLab providers.

## Background

The extension currently supports 3 source controls for reviewing pull requests and analyzing PR dependencies:

| Provider | Auth | Token header |
|----------|------|--------------|
| Azure DevOps | PAT | `Basic base64(":" + token)` |
| GitHub | PAT | `Bearer token` |
| GitLab | PAT | `PRIVATE-TOKEN: token` |

Bitbucket is **not** supported yet. Partial scaffolding already exists in `scripts/review/pr-fetch-base.ts`:
- `bitbucketAuthHeader(token)` — auto-detects format
- `BITBUCKET_ERROR_MESSAGES`

### Auth difference vs the other 3

Unlike GitHub/GitLab/Azure (single-string PAT), **Bitbucket Cloud does not use a classic Personal Access Token**. It uses either:
- **App Password** — format `username:app_password` → `Basic base64(token)`
- **Access Token** (Repository/Project/Workspace) → `Bearer token`

Decision: **support both**, auto-detected by the presence of a `:` in the token string (already implemented in `bitbucketAuthHeader`). The colon → Basic (App Password); no colon → Bearer (Access Token).

## Goals

- Review Bitbucket Cloud PRs via the same `@<review>` flow as the other providers.
- Analyze Bitbucket Cloud PR dependencies via `@dependency-pr`.
- Reuse the existing shared HTTPS layer, diff utilities, and file-fetcher abstraction.
- Keep changes additive and consistent with the existing per-provider module pattern.

## Non-Goals

- Bitbucket **Server / Data Center** (self-hosted) — different URL format and REST API. Out of scope.

## URL & API Reference (Bitbucket Cloud API 2.0)

- **PR URL:** `https://bitbucket.org/{workspace}/{repo}/pull-requests/{id}`
- **PR details:** `GET /2.0/repositories/{workspace}/{repo}/pullrequests/{id}`
- **Diffstat (file metadata):** `GET /2.0/repositories/{workspace}/{repo}/pullrequests/{id}/diffstat?pagelen=100` (paginated via `next`)
- **Unified diff:** `GET /2.0/repositories/{workspace}/{repo}/pullrequests/{id}/diff` (returns `text/plain`)
- **Commits:** `GET /2.0/repositories/{workspace}/{repo}/pullrequests/{id}/commits?pagelen=100` (paginated via `next`)
- **File content:** `GET /2.0/repositories/{workspace}/{repo}/src/{commit}/{path}` (raw)

Base host: `api.bitbucket.org`.

### Field mapping

In Bitbucket, the `workspace` is the equivalent of the "organization" used by the other providers. The token map in `aida.sourceControls.bitbucket` is keyed by **workspace**.

| Normalized field | Bitbucket source |
|------------------|------------------|
| `organization` / `owner` | `workspace` |
| `repository` / `repo` | repo slug |
| `prId` | pull request id |
| PR title | `title` |
| PR description | `description` (raw/markup) |
| author | `author.display_name` |
| status | `state` |
| sourceCommit | `source.commit.hash` |
| targetCommit | `destination.commit.hash` |
| sourceBranch | `source.branch.name` |
| targetBranch | `destination.branch.name` |

### Diffstat status mapping

| Bitbucket `status` | normalized `changeType` |
|--------------------|--------------------------|
| `added` | `added` |
| `removed` | `removed` |
| `modified` | `modified` |
| `renamed` | `renamed` |

## Chosen Approach

**Approach A:** Fetch `/diffstat` for per-file metadata (status, lines_added/removed, old/new paths) plus `/diff` for the raw unified diff, then split the unified diff per file. This mirrors the existing GitHub/GitLab pattern (`finalDiff` + per-file `diffContent`), reusing `countDiffLines` and `filterReviewableFiles`.

Rejected:
- **B** (parse everything from `/diff` only): must infer status/renames, error-prone.
- **C** (`/diffstat` + per-file diff fetch): too many API calls.

## Components & Changes

### 1. URL parsing
- `scripts/core/source-control-config.ts` → `parsePRUrl`: add Bitbucket branch returning `{ provider: 'bitbucket', organization: workspace, repository: repo, prId }`.
- `scripts/review/pr-utils.ts` → `parsePRUrlInfo`: add Bitbucket pattern returning `repoType: 'bitbucket'`, with `owner`/`organization` = workspace, `repo`/`repository` = repo slug.

### 2. Token (already done)
- `pr-fetch-base.ts`: `bitbucketAuthHeader` + `BITBUCKET_ERROR_MESSAGES` already exist. No change beyond using them.

### 3. New module `scripts/review/pr-fetch-bitbucket.ts` (mirror `pr-fetch-gitlab.ts`)
- `makeBitbucketRequest(url, token, method, customHeaders)` → delegates to `makeHttpsRequest` with `bitbucketAuthHeader`, `BITBUCKET_ERROR_MESSAGES`, default `Accept: application/json`, `isTextResponse` when `Accept` includes `text/plain`.
- `getBitbucketPR(workspace, repo, prId, token)` → orchestrates PR details + paginated diffstat + raw diff + paginated commits; builds `fileChanges`, `reviewableFileChanges` (via `filterReviewableFiles`), `finalDiff`, `commits`, `commitsList`, `analysis`. Returns the same `{ success, data }` shape as `getGitLabMR`.
- `getBitbucketFileContent(workspace, repo, filePath, commit, token)` → `/src/{commit}/{path}` raw text.
- `analyzeBitbucketPullRequest(stream, workspace, repo, prId)` → token lookup via `getTokenForPR`, `showTokenConfigurationHelp('bitbucket', workspace, stream)` on missing token, then `getBitbucketPR`.
- Pagination helper: follow `next` links (or loop `?page=`) for `/diffstat` and `/commits`.

### 4. Review routing — `scripts/review/pr-review-handler.ts`
- In `processPrReview`, add a `repoType === 'bitbucket'` branch: header markdown ("🪣 Analyzing Bitbucket PR…", workspace/repo, PR id) + call `analyzeBitbucketPullRequest` + Bitbucket-specific error hints.

### 5. Unified file fetcher — `scripts/review/pr-file-fetcher.ts`
- Import `getBitbucketPR`; add `case 'bitbucket'` to `fetchFiles`; update the unsupported-format error message to include Bitbucket.

### 6. Dependency PR — `scripts/dependency/dependency-handlers.ts` & `dependency.ts`
- `dependency-handlers.ts`: add `/bitbucket\.org\/[^\/]+\/[^\/]+\/pull-requests\/\d+/i` to the valid-URL pattern list.
- `dependency.ts`: add Bitbucket example URL to the help/usage messages.

### 7. Config schema & help
- `package.json`: add a `bitbucket` object to the `aida.sourceControls` properties with description (keyed by workspace) and example default.
- `source-control-config.ts` → `showTokenConfigurationHelp`: add `bitbucket` to `providerNames` and `providerConfigs` (docs link to Bitbucket App Passwords / Access Tokens, permissions: "Pull requests: Read, Repositories: Read").

## Data Flow

```
PR URL ──> parsePRUrlInfo / parsePRUrl ──> repoType='bitbucket', workspace, repo, prId
        ──> getTokenForPR (aida.sourceControls.bitbucket[workspace])
        ──> analyzeBitbucketPullRequest / getBitbucketPR
              ├─ GET pullrequests/{id}            (metadata)
              ├─ GET .../diffstat?pagelen=100     (file list + stats, paginated)
              ├─ GET .../diff                     (raw unified diff)
              └─ GET .../commits?pagelen=100      (commits, paginated)
        ──> normalized { fileChanges, reviewableFileChanges, finalDiff, commits, analysis }
        ──> existing review / dependency pipeline (unchanged)
```

## Error Handling

- Missing token → `showTokenConfigurationHelp('bitbucket', workspace, stream)`.
- HTTP 401/403/404 → `BITBUCKET_ERROR_MESSAGES` (already defined).
- Network/timeout → handled by shared `makeHttpsRequest`.
- Missing per-file diff in `finalDiff` → fall back to placeholder diff (same strategy as GitLab).

## Testing

- Inspect `scripts/__tests__/` for an existing provider test to mirror; if a URL-parsing test exists, add Bitbucket cases.
- Run the existing build (`tsc` / webpack) and `vitest` to confirm no type or test regressions. Do not add new tooling.

## Open Questions

None. Bitbucket Server/Data Center explicitly deferred.
