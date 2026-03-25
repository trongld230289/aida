/**
 * @module pr-fetch-gitlab
 * @description GitLab MR data fetching
 * Extracted from review-pr.js during Phase 4 refactoring.
 */

import * as _vscode from 'vscode';
import { getTokenForPR, showTokenConfigurationHelp } from './review-common';
import { aidaLogging } from '../core/settings';
import { DEFAULTS } from '../core/aida-config';
import { filterReviewableFiles, countDiffLines } from './pr-utils';
import { toError } from '../core/error-utils';
import { makeHttpsRequest, gitlabAuthHeader, GITLAB_ERROR_MESSAGES, type IHttpsResponse } from './pr-fetch-base';

/**
 * Analyze GitLab Merge Request using GitLab REST API
 * @param {object} stream - VS Code stream for progress updates
 * @param {string} gitlabHost - GitLab instance hostname (e.g., gitlab.com)
 * @param {string} owner - Repository owner/namespace
 * @param {string} repo - Repository name
 * @param {string} mrId - Merge Request number
 */
async function analyzeGitLabMergeRequest(stream: _vscode.ChatResponseStream, gitlabHost: string, owner: string, repo: string, mrId: string | number): Promise<Record<string, unknown>> {
    try {
        aidaLogging(`🔄 Fetching GitLab MR ${owner}/${repo}!${mrId} from ${gitlabHost}`);

        // Get token using new multi-org helper
        const mrUrl = `https://${gitlabHost}/${owner}/${repo}/-/merge_requests/${mrId}`;
        const gitlabToken = getTokenForPR(mrUrl);

        if (!gitlabToken) {
            // Show configuration help using new helper
            showTokenConfigurationHelp('gitlab', owner, stream);
            return { success: false, error: `GitLab Personal Access Token is required for organization: ${owner}` };
        }

        // Get MR details from GitLab API
        const mrData = await getGitLabMR(gitlabHost, owner, repo, mrId, gitlabToken);

        if (!mrData.success) {
            aidaLogging('Failed to get GitLab MR:', mrData.error);
            stream.markdown('❌ **GitLab API Error**\n\n');
            stream.markdown(`Error: ${mrData.error}\n\n`);
            return { error: mrData.error };
        }

        // ✅ FIX: Return the correct structure - extract the data portion
        aidaLogging(`🔧 DEBUG: GitLab API returned ${mrData.data?.finalDiff?.length || 0} chars of finalDiff`);
        aidaLogging(`🔧 DEBUG: GitLab API returned ${mrData.data?.fileChanges?.length || 0} file changes`);
        
        return {
            success: true,
            data: mrData.data
        };

    } catch (_error: unknown) {
        const error = toError(_error);
        aidaLogging('Error in analyzeGitLabMergeRequest:', error);
        return { error: `Analysis failed: ${error.message}` };
    }
}

/**
 * Get Merge Request data from GitLab REST API
 * @param {string} gitlabHost - GitLab instance hostname
 * @param {string} owner - Repository owner/namespace
 * @param {string} repo - Repository name
 * @param {string} mrId - Merge Request number
 * @param {string} token - GitLab Personal Access Token (optional for public repos)
 */
async function getGitLabMR(gitlabHost: string, owner: string, repo: string, mrId: string | number, token: string) {
    try {
        aidaLogging(`📝 Fetching MR details: ${owner}/${repo}!${mrId} from ${gitlabHost}`);

        // Encode project path for GitLab API (owner/repo becomes owner%2Frepo)
        const projectPath = encodeURIComponent(`${owner}/${repo}`);

        // Get MR details
        const mrUrl = `https://${gitlabHost}/api/v4/projects/${projectPath}/merge_requests/${mrId}`;
        const mrResponse = await makeGitLabRequest(mrUrl, token);

        if (!mrResponse.success) {
            aidaLogging('Failed to get MR details:', mrResponse.error);
            return { success: false, error: `Failed to get MR: ${mrResponse.error}` };
        }

        const mr = mrResponse.data!;

        // Get MR changes (diffs)
        aidaLogging('📁 Fetching changed files...');
        const changesUrl = `https://${gitlabHost}/api/v4/projects/${projectPath}/merge_requests/${mrId}/changes`;
        const changesResponse = await makeGitLabRequest(changesUrl, token);

        if (!changesResponse.success) {
            aidaLogging('Failed to get changes:', changesResponse.error);
            return { success: false, error: `Failed to get changes: ${changesResponse.error}` };
        }

        const changes = changesResponse.data!;
        aidaLogging(`✅ Found ${changes.changes?.length || 0} changed files`);
        
        // Debug: Log structure of changes response
        if (changes.changes && changes.changes.length > 0) {
            aidaLogging('🔍 DEBUG: GitLab changes structure:', JSON.stringify(changes.changes[0], null, 2));
        }

        // Get diff in unified format
        aidaLogging('🔄 Fetching unified diff from GitLab...');
        const diffUrl = `https://${gitlabHost}/api/v4/projects/${projectPath}/merge_requests/${mrId}.diff`;
        const diffResponse = await makeGitLabRequest(diffUrl, token, 'GET', {
            'Accept': 'text/plain'
        });

        let finalDiff = '';
        if (diffResponse.success && typeof diffResponse.data === 'string') {
            finalDiff = diffResponse.data;
            aidaLogging(`✅ Got unified diff: ${finalDiff.length} characters`);
        } else {
            aidaLogging('⚠️ Could not get unified diff, will build from file changes');
        }

        // Process file changes
        const fileChanges = (changes.changes || []).map((change: Record<string, any>) => {
            let diffContent = '';
            
            // Debug: Log each change structure
            aidaLogging(`🔍 Processing file: ${change.new_path || change.old_path}`);
            aidaLogging(`🔍 Change has diff: ${!!change.diff}, diff length: ${change.diff?.length || 0}`);

            // GitLab API provides diff content directly
            if (change.diff) {
                // Build complete diff format from GitLab diff
                diffContent = `diff --git a/${change.old_path || change.new_path} b/${change.new_path}\n`;
                
                // Add file mode information based on status
                if (change.new_file) {
                    diffContent += `new file mode 100644\n`;
                    diffContent += `--- /dev/null\n`;
                    diffContent += `+++ b/${change.new_path}\n`;
                } else if (change.deleted_file) {
                    diffContent += `deleted file mode 100644\n`;
                    diffContent += `--- a/${change.old_path}\n`;
                    diffContent += `+++ /dev/null\n`;
                } else if (change.renamed_file) {
                    diffContent += `--- a/${change.old_path}\n`;
                    diffContent += `+++ b/${change.new_path}\n`;
                } else {
                    diffContent += `--- a/${change.old_path || change.new_path}\n`;
                    diffContent += `+++ b/${change.new_path}\n`;
                }
                
                // Add the diff content
                diffContent += change.diff;
                
                aidaLogging(`🔧 DEBUG: Built complete diff for ${change.new_path}: ${diffContent.length} chars`);
            } else if (finalDiff) {
                // Extract from unified diff as fallback
                const fileName = change.new_path || change.old_path;
                const filePattern = new RegExp(`diff --git a/${fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} b/${fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([\\s\\S]*?)(?=diff --git|$)`, 'g');
                const match = filePattern.exec(finalDiff);
                if (match) {
                    diffContent = `diff --git a/${fileName} b/${fileName}${match[1]}`;
                    aidaLogging(`🔧 DEBUG: Extracted diff from finalDiff for ${fileName}: ${diffContent.length} chars`);
                }
            } else {
                // Last resort: create minimal diff representation
                aidaLogging(`⚠️ WARNING: No diff content available for ${change.new_path || change.old_path}, creating placeholder`);
                const fileName = change.new_path || change.old_path;
                diffContent = `diff --git a/${fileName} b/${fileName}\n`;
                if (change.new_file) {
                    diffContent += `new file mode 100644\n--- /dev/null\n+++ b/${fileName}\n@@ -0,0 +1,1 @@\n+[File content not available via GitLab API]`;
                } else if (change.deleted_file) {
                    diffContent += `deleted file mode 100644\n--- a/${fileName}\n+++ /dev/null\n@@ -1,1 +0,0 @@\n-[File content not available via GitLab API]`;
                } else {
                    diffContent += `--- a/${fileName}\n+++ b/${fileName}\n@@ -1,1 +1,1 @@\n-[Original content not available]\n+[Modified content not available]`;
                }
            }

            // Count additions and deletions from diff
            const { additions, deletions } = countDiffLines(diffContent);

            return {
                path: change.new_path || change.old_path,
                changeType: change.new_file ? 'added' : 
                           change.deleted_file ? 'removed' : 
                           change.renamed_file ? 'renamed' : 'modified',
                additions: additions,
                deletions: deletions,
                changes: additions + deletions,
                diffContent: diffContent,
                diff: diffContent, // For compatibility
                source: 'GitLab API',
                oldPath: change.old_path,
                newPath: change.new_path
            };
        });

        // Filter out auto-generated files for review using shared function
        const reviewableFileChanges = filterReviewableFiles(fileChanges, 'GitLab');

        // Get commits
        aidaLogging('📝 Fetching commits...');
        const commitsUrl = `https://${gitlabHost}/api/v4/projects/${projectPath}/merge_requests/${mrId}/commits`;
        const commitsResponse = await makeGitLabRequest(commitsUrl, token);

        let commits = [];
        if (commitsResponse.success && commitsResponse.data) {
            commits = commitsResponse.data.map((commit: Record<string, any>) => ({
                commitId: commit.id,
                comment: commit.message,
                author: {
                    name: commit.author_name,
                    date: commit.authored_date
                }
            }));
            aidaLogging(`✅ Found ${commits.length} commits`);
        }

        return {
            success: true,
            data: {
                id: mrId,
                title: mr.title || `MR !${mrId}`,
                description: mr.description || 'No description provided',
                author: mr.author?.username || 'Unknown',
                status: mr.state || 'opened',
                owner: owner,
                repository: repo,
                gitlabHost: gitlabHost,
                sourceCommit: mr.sha,
                targetCommit: mr.target_branch_sha || mr.merge_commit_sha,
                sourceBranch: mr.source_branch,
                targetBranch: mr.target_branch,
                diffCommand: 'GitLab API (workspace-independent)',
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
                    quality: `GitLab MR with ${fileChanges.length} file(s) changed (${reviewableFileChanges.length} for review)`,
                    security: 'Complete MR diff analysis',
                    performance: 'Full MR data from GitLab API',
                    testCoverage: 'Review test coverage for modified files',
                    codeReview: [
                        `📁 ${fileChanges.length} file(s) changed (${reviewableFileChanges.length} reviewable)`,
                        `➕ ${fileChanges.reduce((sum: number, f: Record<string, number>) => sum + (f.additions ?? 0), 0)} lines added`,
                        `➖ ${fileChanges.reduce((sum: number, f: Record<string, number>) => sum + (f.deletions ?? 0), 0)} lines removed`,
                        `🔍 Source: GitLab REST API`,
                        `📝 ${commits.length} commits`,
                        `🌿 ${mr.source_branch} → ${mr.target_branch}`
                    ]
                }
            }
        };
    } catch (_error: unknown) {
        const error = toError(_error);
        aidaLogging('Error in getGitLabMR:', error);
        return { success: false, error: `Unable to fetch MR: ${error.message}` };
    }
}

/**
 * Make HTTP request to GitLab REST API
 * @param {string} url - API endpoint URL
 * @param {string} token - GitLab Personal Access Token (optional)
 * @param {string} method - HTTP method (default: GET)
 * @param {object} customHeaders - Additional headers
 */
/**
 * Make HTTP request to GitLab REST API.
 * Delegates to shared makeHttpsRequest with GitLab-specific auth & error messages.
 */
async function makeGitLabRequest(url: string, token: string, method = 'GET', customHeaders: Record<string, string> = {}): Promise<IHttpsResponse<Record<string, any>>> {
    return makeHttpsRequest<Record<string, any>>({
        url,
        method,
        token,
        authHeaderFn: gitlabAuthHeader,
        defaultHeaders: { Accept: 'application/json' },
        extraHeaders: customHeaders,
        timeoutMs: DEFAULTS.PR_FETCH_TIMEOUT_MS,
        errorMessages: GITLAB_ERROR_MESSAGES,
        isTextResponse: (h) => !!h['Accept']?.includes('text/plain'),
    });
}

// ES exports
export { analyzeGitLabMergeRequest, getGitLabMR, makeGitLabRequest };
