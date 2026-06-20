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

        // Bitbucket's /pullrequests/{id}/diffstat and /diff endpoints respond with a 302
        // redirect to an internal URL whose commit range is separated by an encoded CR (%0D).
        // Some corporate web filters block that URL. The canonical commit-range endpoints
        // (/diffstat/{src}..{dst} and /diff/{src}..{dst}) return 200 directly, so prefer them.
        const sourceHash = pr.source?.commit?.hash as string | undefined;
        const targetHash = pr.destination?.commit?.hash as string | undefined;
        const repoBase = `${BITBUCKET_API}/repositories/${workspace}/${repo}`;
        const hasRange = !!(sourceHash && targetHash);
        const diffSpec = hasRange ? `${sourceHash}..${targetHash}` : '';

        // Diffstat (file metadata, paginated)
        aidaLogging('📁 Fetching Bitbucket diffstat...');
        const diffstatUrl = hasRange
            ? `${repoBase}/diffstat/${diffSpec}?pagelen=100`
            : `${base}/diffstat?pagelen=100`;
        const diffstat = await fetchAllPages(diffstatUrl, token);
        aidaLogging(`✅ Found ${diffstat.length} changed files`);

        // Raw unified diff
        aidaLogging('🔄 Fetching unified diff from Bitbucket...');
        const diffUrl = hasRange ? `${repoBase}/diff/${diffSpec}` : `${base}/diff`;
        const diffResponse = await makeBitbucketRequest(diffUrl, token, 'GET', { Accept: 'text/plain' });
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

            // For renamed files the unified-diff header is `a/<oldPath> b/<newPath>`,
            // so extract using the distinct old/new paths rather than reusing fileName.
            const aPath = oldPath || fileName;
            const bPath = newPath || fileName;

            let diffContent = '';
            if (finalDiff) {
                const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const filePattern = new RegExp(`diff --git a/${escapeRe(aPath)} b/${escapeRe(bPath)}([\\s\\S]*?)(?=diff --git|$)`, 'g');
                const match = filePattern.exec(finalDiff);
                if (match) {
                    diffContent = `diff --git a/${aPath} b/${bPath}${match[1]}`;
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
                provider: 'bitbucket',
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
                        `➕ ${fileChanges.reduce((sum: number, f: any) => sum + (f.additions ?? 0), 0)} lines added`,
                        `➖ ${fileChanges.reduce((sum: number, f: any) => sum + (f.deletions ?? 0), 0)} lines removed`,
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
