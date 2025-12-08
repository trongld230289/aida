const { getTokenForPR, showTokenConfigurationHelp } = require('./review-common');

/**
 * Unified PR file fetcher for all providers
 * Reuses logic from review-pr.js for fetching file changes
 */
class PRFileFetcher {
    /**
     * Parse PR URL and extract information
     * @param {string} prUrl - PR URL from user
     * @returns {object} Parsed PR info
     */
    parsePRUrl(prUrl) {
        // GitHub URL pattern
        const githubPattern = /https:\/\/github\.com\/([^\/]+)\/([^\/]+)\/pull\/(\d+)/i;
        const githubMatch = prUrl.match(githubPattern);

        if (githubMatch) {
            return {
                repoType: 'github',
                owner: githubMatch[1],
                repo: githubMatch[2],
                prId: githubMatch[3],
                originalUrl: githubMatch[0]
            };
        }

        // Azure DevOps URL pattern
        const azurePattern = /https:\/\/dev\.azure\.com\/([^\/]+)\/([^\/]+)\/_git\/([^\/]+)\/pullrequest\/(\d+)/i;
        const azureMatch = prUrl.match(azurePattern);

        if (azureMatch) {
            return {
                repoType: 'azure',
                organization: azureMatch[1],
                project: azureMatch[2],
                repository: azureMatch[3],
                prId: azureMatch[4],
                originalUrl: azureMatch[0]
            };
        }

        // GitLab URL pattern
        const gitlabPattern = /https:\/\/([^\/]+)\/(.+?)\/-\/merge_requests\/(\d+)/i;
        const gitlabMatch = prUrl.match(gitlabPattern);

        if (gitlabMatch) {
            const gitlabHost = gitlabMatch[1];
            const fullPath = gitlabMatch[2];
            const pathParts = fullPath.split('/');
            const repo = pathParts[pathParts.length - 1];
            const owner = pathParts.slice(0, -1).join('/');

            return {
                repoType: 'gitlab',
                gitlabHost: gitlabHost,
                owner: owner,
                repo: repo,
                prId: gitlabMatch[3],
                originalUrl: gitlabMatch[0]
            };
        }

        throw new Error('Unsupported PR URL format. Supported: GitHub, Azure DevOps, GitLab');
    }

    /**
     * Fetch file changes from PR URL
     * @param {object} prInfo - Parsed PR info
     * @returns {Promise<Array>} File change objects
     */
    async fetchFiles(prInfo) {
        console.log(`🔍 Fetching files from ${prInfo.repoType} PR...`);

        switch (prInfo.repoType) {
            case 'github':
                return this.fetchGitHubFiles(prInfo);
            case 'azure':
                return this.fetchAzureFiles(prInfo);
            case 'gitlab':
                return this.fetchGitLabFiles(prInfo);
            default:
                throw new Error(`Unsupported repo type: ${prInfo.repoType}`);
        }
    }

    /**
     * Fetch files from GitHub PR
     */
    async fetchGitHubFiles(prInfo) {
        const { owner, repo, prId, originalUrl } = prInfo;

        // Get token
        const token = getTokenForPR(originalUrl);
        if (!token) {
            throw new Error(`GitHub token required for ${owner}/${repo}`);
        }

        // Fetch PR data
        const prResponse = await this.makeGitHubRequest(
            `https://api.github.com/repos/${owner}/${repo}/pulls/${prId}`,
            token
        );

        if (!prResponse.success) {
            throw new Error(`Failed to fetch GitHub PR: ${prResponse.error}`);
        }

        // Fetch files
        const filesResponse = await this.makeGitHubRequest(
            `https://api.github.com/repos/${owner}/${repo}/pulls/${prId}/files`,
            token
        );

        if (!filesResponse.success) {
            throw new Error(`Failed to fetch GitHub files: ${filesResponse.error}`);
        }

        const files = filesResponse.data;

        // Normalize file structure
        return files.map(file => this.normalizeFileChange({
            path: file.filename,
            status: file.status,
            additions: file.additions || 0,
            deletions: file.deletions || 0,
            changes: file.changes || 0,
            patch: file.patch || '',
            previous_filename: file.previous_filename
        }, 'github'));
    }

    /**
     * Fetch files from Azure DevOps PR
     */
    async fetchAzureFiles(prInfo) {
        const { organization, project, repository, prId, originalUrl } = prInfo;

        // Get token
        const token = getTokenForPR(originalUrl);
        if (!token) {
            throw new Error(`Azure DevOps token required for ${organization}`);
        }

        // Fetch PR details
        const prUrl = `https://dev.azure.com/${organization}/${project}/_apis/git/repositories/${repository}/pullRequests/${prId}?api-version=7.0`;
        const prResponse = await this.makeAzureRequest(prUrl, token);

        if (!prResponse.success) {
            throw new Error(`Failed to fetch Azure PR: ${prResponse.error}`);
        }

        // Get iterations to find latest
        const iterationsUrl = `https://dev.azure.com/${organization}/${project}/_apis/git/repositories/${repository}/pullRequests/${prId}/iterations?api-version=7.0`;
        const iterationsResponse = await this.makeAzureRequest(iterationsUrl, token);

        if (!iterationsResponse.success || !iterationsResponse.data.value?.length) {
            throw new Error('Failed to fetch Azure PR iterations');
        }

        const iterations = iterationsResponse.data.value;
        const latestIteration = iterations[iterations.length - 1];

        // Get file changes from latest iteration
        const changesUrl = `https://dev.azure.com/${organization}/${project}/_apis/git/repositories/${repository}/pullRequests/${prId}/iterations/${latestIteration.id}/changes?api-version=7.0&$top=1000`;
        const changesResponse = await this.makeAzureRequest(changesUrl, token);

        if (!changesResponse.success || !changesResponse.data.changeEntries) {
            throw new Error('Failed to fetch Azure file changes');
        }

        // Filter and normalize files
        const files = changesResponse.data.changeEntries.filter(change => {
            const filePath = change.item?.path || change.originalPath || '';
            return filePath &&
                filePath.includes('.') &&
                !filePath.endsWith('/') &&
                filePath.split('/').pop().includes('.') &&
                !filePath.includes('/.git/');
        });

        return files.map(change => this.normalizeFileChange({
            path: change.item?.path || change.originalPath,
            status: change.changeType,
            additions: 0, // Azure doesn't provide this directly
            deletions: 0,
            changes: 0
        }, 'azure'));
    }

    /**
     * Fetch files from GitLab MR
     */
    async fetchGitLabFiles(prInfo) {
        const { gitlabHost, owner, repo, prId, originalUrl } = prInfo;

        // Get token
        const token = getTokenForPR(originalUrl);
        if (!token) {
            throw new Error(`GitLab token required for ${gitlabHost}`);
        }

        // Build project path
        const projectPath = encodeURIComponent(`${owner}/${repo}`);

        // Fetch MR details
        const mrUrl = `https://${gitlabHost}/api/v4/projects/${projectPath}/merge_requests/${prId}`;
        const mrResponse = await this.makeGitLabRequest(mrUrl, token);

        if (!mrResponse.success) {
            throw new Error(`Failed to fetch GitLab MR: ${mrResponse.error}`);
        }

        // Fetch changes
        const changesUrl = `https://${gitlabHost}/api/v4/projects/${projectPath}/merge_requests/${prId}/changes`;
        const changesResponse = await this.makeGitLabRequest(changesUrl, token);

        if (!changesResponse.success || !changesResponse.data.changes) {
            throw new Error('Failed to fetch GitLab changes');
        }

        const changes = changesResponse.data.changes;

        return changes.map(change => this.normalizeFileChange({
            path: change.new_path || change.old_path,
            status: change.new_file ? 'added' :
                change.deleted_file ? 'deleted' :
                    change.renamed_file ? 'renamed' : 'modified',
            additions: 0, // GitLab doesn't provide this in changes API
            deletions: 0,
            changes: 0,
            old_path: change.old_path,
            new_path: change.new_path
        }, 'gitlab'));
    }

    /**
     * Normalize file change object across providers
     */
    normalizeFileChange(file, provider) {
        const statusMap = {
            github: { added: 'add', removed: 'delete', modified: 'edit', renamed: 'rename' },
            azure: { add: 'add', delete: 'delete', edit: 'edit', rename: 'rename', rename2: 'rename' },
            gitlab: { added: 'add', deleted: 'delete', modified: 'edit', renamed: 'rename' }
        };

        const normalizedStatus = statusMap[provider][file.status.toLowerCase()] || file.status.toLowerCase();

        return {
            path: file.path,
            status: normalizedStatus,
            additions: file.additions || 0,
            deletions: file.deletions || 0,
            changes: file.changes || (file.additions + file.deletions),
            patch: file.patch || '',
            provider: provider,
            oldPath: file.previous_filename || file.old_path,
            newPath: file.new_path || file.path
        };
    }

    /**
     * Make GitHub API request
     */
    async makeGitHubRequest(url, token, method = 'GET', customHeaders = {}) {
        const https = require('https');
        const urlObj = new URL(url);

        return new Promise((resolve) => {
            const headers = {
                'User-Agent': 'AIDA-VSCode-Extension',
                'Accept': 'application/vnd.github.v3+json',
                ...customHeaders
            };

            if (token) {
                headers['Authorization'] = `token ${token}`;
            }

            const options = {
                hostname: urlObj.hostname,
                port: 443,
                path: urlObj.pathname + urlObj.search,
                method: method,
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
                            const parsed = JSON.parse(data);
                            resolve({ success: true, data: parsed });
                        } else {
                            resolve({ success: false, error: `HTTP ${res.statusCode}: ${data}` });
                        }
                    } catch (error) {
                        resolve({ success: false, error: `Parse error: ${error.message}` });
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

    /**
     * Make Azure DevOps API request
     */
    async makeAzureRequest(url, token, method = 'GET') {
        const https = require('https');
        const urlObj = new URL(url);

        return new Promise((resolve) => {
            const auth = Buffer.from(`:${token}`).toString('base64');

            const options = {
                hostname: urlObj.hostname,
                port: 443,
                path: urlObj.pathname + urlObj.search,
                method: method,
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            };

            const req = https.request(options, (res) => {
                let data = '';

                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    try {
                        if (res.statusCode >= 200 && res.statusCode < 300) {
                            const parsed = JSON.parse(data);
                            resolve({ success: true, data: parsed });
                        } else {
                            resolve({ success: false, error: `HTTP ${res.statusCode}: ${data}` });
                        }
                    } catch (error) {
                        resolve({ success: false, error: `Parse error: ${error.message}` });
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

    /**
     * Make GitLab API request
     */
    async makeGitLabRequest(url, token, method = 'GET') {
        const https = require('https');
        const urlObj = new URL(url);

        return new Promise((resolve) => {
            const headers = {
                'User-Agent': 'AIDA-VSCode-Extension',
                'Accept': 'application/json'
            };

            if (token) {
                headers['PRIVATE-TOKEN'] = token;
            }

            const options = {
                hostname: urlObj.hostname,
                port: 443,
                path: urlObj.pathname + urlObj.search,
                method: method,
                rejectUnauthorized: false,
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
                            const parsed = JSON.parse(data);
                            resolve({ success: true, data: parsed });
                        } else {
                            resolve({ success: false, error: `HTTP ${res.statusCode}: ${data}` });
                        }
                    } catch (error) {
                        resolve({ success: false, error: `Parse error: ${error.message}` });
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
}

module.exports = { PRFileFetcher };
