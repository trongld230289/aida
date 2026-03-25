/**
 * @module pr-fetch-github
 * @description GitHub PR data fetching
 * Extracted from review-pr.js during Phase 4 refactoring.
 */

import * as _vscode from 'vscode';
import { getTokenForPR, showTokenConfigurationHelp } from './review-common';
import { aidaLogging } from '../core/settings';
import { DEFAULTS } from '../core/aida-config';
import { filterReviewableFiles } from './pr-utils';
import { toError } from '../core/error-utils';
import { makeHttpsRequest, githubAuthHeader, GITHUB_ERROR_MESSAGES, type IHttpsResponse } from './pr-fetch-base';

/**
 * Get file content from GitHub API at a specific commit
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name  
 * @param {string} filePath - File path
 * @param {string} commitSha - Commit SHA
 * @param {string} token - GitHub token
 * @returns {string|null} - File content or null if not found
 */
async function getGitHubFileContent(owner: string, repo: string, filePath: string, commitSha: string, token: string) {
    try {
        aidaLogging(`🔄 Fetching GitHub content for ${filePath} at commit ${commitSha.substring(0, 7)}`);

        // GitHub Contents API URL
        const contentsUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(filePath)}?ref=${commitSha}`;

        const response = await makeGitHubRequest(contentsUrl, token);

        if (response.success && response.data) {
            // GitHub API returns base64 encoded content
            if (response.data.content && response.data.encoding === 'base64') {
                const content = Buffer.from(response.data.content, 'base64').toString('utf8');
                aidaLogging(`✅ Got GitHub file content: ${content.length} chars`);
                return content;
            }
        }

        aidaLogging(`❌ Could not fetch GitHub content: ${response.error || 'unknown'}`);
        return null;
    } catch (_error: unknown) {
        const error = toError(_error);
        aidaLogging(`❌ Error fetching GitHub content for ${filePath}: ${error.message}`);
        return null;
    }
}

/**
 * Analyze GitHub Pull Request using GitHub REST API
 * @param {object} stream - VS Code stream for progress updates
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} prId - Pull Request number
 */
async function analyzeGitHubPullRequest(stream: _vscode.ChatResponseStream, owner: string, repo: string, prId: string | number): Promise<Record<string, unknown>> {
    try {
        aidaLogging(`🔄 Fetching GitHub PR ${owner}/${repo}#${prId}`);

        // Get token using new multi-org helper
        const prUrl = `https://github.com/${owner}/${repo}/pull/${prId}`;
        const githubToken = getTokenForPR(prUrl);

        if (!githubToken) {
            // Show configuration help using new helper
            showTokenConfigurationHelp('github', owner, stream);
            return { success: false, error: `GitHub Personal Access Token is required for organization: ${owner}` };
        }

        // Get PR details from GitHub API
        const prData = await getGitHubPR(owner, repo, prId, githubToken);

        if (!prData.success) {
            aidaLogging('Failed to get GitHub PR:', prData.error);
            stream.markdown('❌ **GitHub API Error**\n\n');
            stream.markdown(`Error: ${prData.error}\n\n`);

            return { error: prData.error };
        }

        return prData;

    } catch (_error: unknown) {
        const error = toError(_error);
        aidaLogging('Error in analyzeGitHubPullRequest:', error);
        return { error: `Analysis failed: ${error.message}` };
    }
}

/**
 * Get Pull Request data from GitHub REST API
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} prId - Pull Request number
 * @param {string} token - GitHub Personal Access Token (optional for public repos)
 */
async function getGitHubPR(owner: string, repo: string, prId: string | number, token: string) {
    try {
        aidaLogging(`📝 Fetching PR details: ${owner}/${repo}#${prId}`);

        // Get PR details
        const prUrl = `https://api.github.com/repos/${owner}/${repo}/pulls/${prId}`;
        const prResponse = await makeGitHubRequest(prUrl, token);

        if (!prResponse.success) {
            aidaLogging('Failed to get PR details:', prResponse.error);
            return { success: false, error: `Failed to get PR: ${prResponse.error}` };
        }

        const pr = prResponse.data!;

        // Get PR files (changes)
        aidaLogging('📁 Fetching changed files...');
        const filesUrl = `https://api.github.com/repos/${owner}/${repo}/pulls/${prId}/files`;
        const filesResponse = await makeGitHubRequest(filesUrl, token);

        if (!filesResponse.success) {
            aidaLogging('Failed to get files:', filesResponse.error);
            return { success: false, error: `Failed to get files: ${filesResponse.error}` };
        }

        const files = filesResponse.data!;
        aidaLogging(`✅ Found ${files.length} changed files`);

        // Get diff in unified format
        aidaLogging('🔄 Fetching unified diff from GitHub...');
        const diffUrl = `https://api.github.com/repos/${owner}/${repo}/pulls/${prId}`;
        const diffResponse = await makeGitHubRequest(diffUrl, token, 'GET', {
            'Accept': 'application/vnd.github.v3.diff'
        });

        let finalDiff = '';
        if (diffResponse.success && typeof diffResponse.data === 'string') {
            finalDiff = diffResponse.data;
            aidaLogging(`✅ Got unified diff: ${finalDiff.length} characters`);
        } else {
            aidaLogging('⚠️ Could not get unified diff, will build from file patches');
        }

        // Process file changes
        const fileChanges = files.map((file: Record<string, any>) => {
            let diffContent = '';

            // GitHub API provides patch content directly (not full git diff)
            if (file.patch) {
                // Build complete diff format from GitHub patch
                diffContent = `diff --git a/${file.filename} b/${file.filename}\n`;
                
                // Add file mode information based on status
                if (file.status === 'added') {
                    diffContent += `new file mode 100644\n`;
                    diffContent += `--- /dev/null\n`;
                    diffContent += `+++ b/${file.filename}\n`;
                } else if (file.status === 'removed') {
                    diffContent += `deleted file mode 100644\n`;
                    diffContent += `--- a/${file.filename}\n`;
                    diffContent += `+++ /dev/null\n`;
                } else if (file.status === 'renamed') {
                    diffContent += `--- a/${file.previous_filename || file.filename}\n`;
                    diffContent += `+++ b/${file.filename}\n`;
                } else {
                    diffContent += `--- a/${file.filename}\n`;
                    diffContent += `+++ b/${file.filename}\n`;
                }
                
                // Add the patch content (which contains the @@ hunks)
                diffContent += file.patch;
                
                aidaLogging(`🔧 DEBUG: Built complete diff for ${file.filename}: ${diffContent.length} chars`);
                aidaLogging(`🔍 DEBUG: GitHub patch for ${file.filename}:`, file.patch);
                aidaLogging(`🔧 DEBUG: Complete diffContent:`, diffContent);
            } else if (file.status === 'renamed' && !file.patch) {
                // Handle renamed files without content changes
                diffContent = `diff --git a/${file.previous_filename} b/${file.filename}\n`;
                diffContent += `similarity index 100%\n`;
                diffContent += `rename from ${file.previous_filename}\n`;
                diffContent += `rename to ${file.filename}\n`;
            } else if (finalDiff) {
                // Extract from unified diff as fallback
                const filePattern = new RegExp(`diff --git a/${file.filename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} b/${file.filename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([\\s\\S]*?)(?=diff --git|$)`, 'g');
                const match = filePattern.exec(finalDiff);
                if (match) {
                    diffContent = `diff --git a/${file.filename} b/${file.filename}${match[1]}`;
                }
            }

            aidaLogging(`🔍 Final diffContent for ${file.filename}: ${diffContent.length} chars`);

            return {
                path: file.filename,
                changeType: file.status, // 'added', 'removed', 'modified', 'renamed'
                additions: file.additions || 0,
                deletions: file.deletions || 0,
                changes: file.changes || 0,
                diffContent: diffContent,
                diff: diffContent, // For compatibility
                source: 'GitHub API',
                previousFilename: file.previous_filename
            };
        });

        // Filter out auto-generated files for review using shared function
        const reviewableFileChanges = filterReviewableFiles(fileChanges, 'GitHub');

        // Get commits
        aidaLogging('📝 Fetching commits...');
        const commitsUrl = `https://api.github.com/repos/${owner}/${repo}/pulls/${prId}/commits`;
        const commitsResponse = await makeGitHubRequest(commitsUrl, token);

        let commits = [];
        if (commitsResponse.success && commitsResponse.data) {
            commits = commitsResponse.data.map((commit: Record<string, any>) => ({
                commitId: commit.sha,
                comment: commit.commit.message,
                author: {
                    name: commit.commit.author.name,
                    date: commit.commit.author.date
                }
            }));
            aidaLogging(`✅ Found ${commits.length} commits`);
        }

        return {
            success: true,
            data: {
                id: prId,
                title: pr.title || `PR #${prId}`,
                description: pr.body || 'No description provided',
                author: pr.user?.login || 'Unknown',
                status: pr.state || 'open',
                owner: owner,
                repository: repo,
                sourceCommit: pr.head?.sha,
                targetCommit: pr.base?.sha,
                sourceBranch: pr.head?.ref,
                targetBranch: pr.base?.ref,
                diffCommand: 'GitHub API (workspace-independent)',
                fileChanges: fileChanges, // ALL files for diff view Monaco
                reviewableFileChanges: reviewableFileChanges, // Filtered files for AI review content
                commits: commits,
                totalCommits: commits.length,
                finalDiff: finalDiff,
                commitsList: commits.map((commit: Record<string, any>) => ({
                    id: commit.commitId.substring(0, 7),
                    fullId: commit.commitId,
                    message: commit.comment,
                    author: commit.author.name,
                    date: commit.author.date
                })),
                analysis: {
                    quality: `GitHub PR with ${fileChanges.length} file(s) changed (${reviewableFileChanges.length} for review)`,
                    security: 'Complete PR diff analysis',
                    performance: 'Full PR data from GitHub API',
                    testCoverage: 'Review test coverage for modified files',
                    codeReview: [
                        `📁 ${fileChanges.length} file(s) changed (${reviewableFileChanges.length} reviewable)`,
                        `➕ ${fileChanges.reduce((sum: number, f: Record<string, number>) => sum + (f.additions ?? 0), 0)} lines added`,
                        `➖ ${fileChanges.reduce((sum: number, f: Record<string, number>) => sum + (f.deletions ?? 0), 0)} lines removed`,
                        `🔍 Source: GitHub REST API`,
                        `📝 ${commits.length} commits`,
                        `🌿 ${pr.head?.ref} → ${pr.base?.ref}`
                    ]
                }
            }
        };
    } catch (_error: unknown) {
        const error = toError(_error);
        aidaLogging('Error in getGitHubPR:', error);
        return { success: false, error: `Unable to fetch PR: ${error.message}` };
    }
}

/**
 * Make HTTP request to GitHub REST API
 * @param {string} url - API endpoint URL
 * @param {string} token - GitHub Personal Access Token (optional)
 * @param {string} method - HTTP method (default: GET)
 * @param {object} customHeaders - Additional headers
 */
/**
 * Make HTTP request to GitHub REST API.
 * Delegates to shared makeHttpsRequest with GitHub-specific auth & error messages.
 */
async function makeGitHubRequest(url: string, token: string, method = 'GET', customHeaders: Record<string, string> = {}): Promise<IHttpsResponse<Record<string, any>>> {
    return makeHttpsRequest<Record<string, any>>({
        url,
        method,
        token,
        authHeaderFn: githubAuthHeader,
        defaultHeaders: { Accept: 'application/vnd.github.v3+json' },
        extraHeaders: customHeaders,
        timeoutMs: DEFAULTS.PR_FETCH_TIMEOUT_MS,
        errorMessages: GITHUB_ERROR_MESSAGES,
        isTextResponse: (h) => !!h['Accept']?.includes('diff'),
    });
}

// ES exports
export { getGitHubFileContent, analyzeGitHubPullRequest, getGitHubPR, makeGitHubRequest };
