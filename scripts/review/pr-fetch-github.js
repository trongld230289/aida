/**
 * @module pr-fetch-github
 * @description GitHub PR data fetching
 * Extracted from review-pr.js during Phase 4 refactoring.
 */

const vscode = require('vscode');
const https = require('https');
const { getTokenForPR, showTokenConfigurationHelp } = require('./review-common');
const { aidaLogging } = require('../core/settings');
const { filterReviewableFiles, generateUnifiedDiff } = require('./pr-utils');

let Diff;
try { Diff = require('diff'); } catch (e) { Diff = null; }

/**
 * Get file content from GitHub API at a specific commit
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name  
 * @param {string} filePath - File path
 * @param {string} commitSha - Commit SHA
 * @param {string} token - GitHub token
 * @returns {string|null} - File content or null if not found
 */
async function getGitHubFileContent(owner, repo, filePath, commitSha, token) {
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
    } catch (error) {
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
async function analyzeGitHubPullRequest(stream, owner, repo, prId) {
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

    } catch (error) {
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
async function getGitHubPR(owner, repo, prId, token) {
    try {
        aidaLogging(`📝 Fetching PR details: ${owner}/${repo}#${prId}`);

        // Get PR details
        const prUrl = `https://api.github.com/repos/${owner}/${repo}/pulls/${prId}`;
        const prResponse = await makeGitHubRequest(prUrl, token);

        if (!prResponse.success) {
            aidaLogging('Failed to get PR details:', prResponse.error);
            return { success: false, error: `Failed to get PR: ${prResponse.error}` };
        }

        const pr = prResponse.data;

        // Get PR files (changes)
        aidaLogging('📁 Fetching changed files...');
        const filesUrl = `https://api.github.com/repos/${owner}/${repo}/pulls/${prId}/files`;
        const filesResponse = await makeGitHubRequest(filesUrl, token);

        if (!filesResponse.success) {
            aidaLogging('Failed to get files:', filesResponse.error);
            return { success: false, error: `Failed to get files: ${filesResponse.error}` };
        }

        const files = filesResponse.data;
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
        const fileChanges = files.map(file => {
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
            commits = commitsResponse.data.map(commit => ({
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
                commitsList: commits.map(commit => ({
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
                        `➕ ${fileChanges.reduce((sum, f) => sum + f.additions, 0)} lines added`,
                        `➖ ${fileChanges.reduce((sum, f) => sum + f.deletions, 0)} lines removed`,
                        `🔍 Source: GitHub REST API`,
                        `📝 ${commits.length} commits`,
                        `🌿 ${pr.head?.ref} → ${pr.base?.ref}`
                    ]
                }
            }
        };
    } catch (error) {
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
async function makeGitHubRequest(url, token, method = 'GET', customHeaders = {}) {
    return new Promise((resolve) => {
        const urlObj = new URL(url);
        const headers = {
            'User-Agent': 'VSCode-AI-Self-Check-Extension',
            'Accept': 'application/vnd.github.v3+json',
            ...customHeaders
        };

        // Add authentication if token is provided
        if (token && token.trim()) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const options = {
            hostname: urlObj.hostname,
            port: 443,
            path: urlObj.pathname + urlObj.search,
            method: method,
            rejectUnauthorized: false, // Fix SSL certificate issues in corporate environments
            headers: headers
        };

        const req = https.request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        // Check if response is JSON or plain text (diff)
                        if (customHeaders['Accept']?.includes('diff')) {
                            resolve({ success: true, data: data });
                        } else {
                            const parsed = JSON.parse(data);
                            resolve({ success: true, data: parsed });
                        }
                    } else {
                        let errorMsg = `HTTP ${res.statusCode}`;
                        if (res.statusCode === 401) {
                            errorMsg = 'HTTP 401 Unauthorized - Token is expired or invalid. Please create a new token.';
                        } else if (res.statusCode === 403) {
                            errorMsg = 'HTTP 403 Forbidden - Access denied. Check your token permissions.';
                        } else if (res.statusCode === 404) {
                            errorMsg = 'HTTP 404 Not Found - PR, repository, or resource not found. Check the URL.';
                        } else {
                            try {
                                const errorData = JSON.parse(data);
                                errorMsg += `: ${errorData.message || 'Unknown error'}`;
                            } catch {
                                const statusText = res.statusMessage || 'Error';
                                errorMsg += `: ${statusText}`;
                            }
                        }
                        resolve({ success: false, error: errorMsg });
                    }
                } catch (parseError) {
                    resolve({ success: false, error: `Parse error: ${parseError.message}` });
                }
            });
        });

        req.on('error', (error) => {
            resolve({ success: false, error: error.message });
        });

        req.setTimeout(15000, () => {
            req.destroy();
            resolve({ success: false, error: 'Request timeout' });
        });

        req.end();
    });
}

module.exports = {
    getGitHubFileContent,
    analyzeGitHubPullRequest,
    getGitHubPR,
    makeGitHubRequest,
};
