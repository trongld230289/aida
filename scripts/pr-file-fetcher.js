const { getTokenForPR } = require('./review-common');
const { parsePRUrlInfo, getGitHubPR, getAzureDevOpsPR, getGitLabMR } = require('./review-pr');
const { aidaLogging } = require('./settings');

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
        // Reuse parsePRUrlInfo from review-pr.js
        const parsed = parsePRUrlInfo(prUrl);
        
        if (!parsed.repoType) {
            throw new Error('Unsupported PR URL format. Supported: GitHub, Azure DevOps, GitLab');
        }

        return parsed;
    }

    /**
     * Fetch file changes from PR URL
     * @param {object} prInfo - Parsed PR info
     * @returns {Promise<Array>} File change objects
     */
    async fetchFiles(prInfo) {
        aidaLogging(`🔍 Fetching files from ${prInfo.repoType} PR...`);

        // Get token
        const token = getTokenForPR(prInfo.originalUrl);
        if (!token) {
            throw new Error(`Token required for ${prInfo.repoType} (${prInfo.owner || prInfo.organization})`);
        }

        let result;
        switch (prInfo.repoType) {
            case 'github':
                result = await getGitHubPR(prInfo.owner, prInfo.repo, prInfo.prId, token);
                break;
            case 'azure':
                result = await getAzureDevOpsPR(prInfo.organization, prInfo.project, prInfo.repository, prInfo.prId, token);
                break;
            case 'gitlab':
                // getGitLabMR signature: (gitlabHost, owner, repo, mrId, token)
                result = await getGitLabMR(prInfo.organization, prInfo.owner, prInfo.repo, prInfo.prId, token);
                break;
            default:
                throw new Error(`Unsupported repo type: ${prInfo.repoType}`);
        }

        if (!result.success) {
            throw new Error(result.error || 'Failed to fetch PR data');
        }

        // Extract and normalize file changes
        // review-pr.js returns { success: true, data: { fileChanges: [...] } }
        const fileChanges = result.data?.fileChanges || [];
        return fileChanges.map(file => this.normalizeFileChange(file, prInfo.repoType));
    }

    /**
     * Normalize file change object across providers
     * review-pr.js already provides normalized structure:
     * - path: file path
     * - changeType: 'added', 'removed', 'modified', 'renamed'
     * - additions: number of lines added
     * - deletions: number of lines deleted
     * - changes: total changes
     * - diffContent: unified diff format
     */
    normalizeFileChange(file, provider) {
        // Map changeType to simpler status
        // Azure returns: add, edit, delete, rename, rename2
        // GitHub returns: added, removed, modified, renamed
        // GitLab returns: added, deleted, modified, renamed
        const statusMap = {
            'added': 'add',
            'removed': 'delete',
            'modified': 'edit',
            'renamed': 'rename',
            'edit': 'edit',
            'delete': 'delete',
            'add': 'add',
            'rename': 'rename',
            'rename2': 'rename'
        };

        const status = statusMap[file.changeType?.toLowerCase()] || 
                      statusMap[file.status?.toLowerCase()] || 
                      'edit';

        aidaLogging(`🔍 Normalize ${file.path}: changeType="${file.changeType}" → status="${status}" (+${file.additions}/-${file.deletions})`);

        return {
            path: file.path,
            status: status,
            additions: file.additions || 0,
            deletions: file.deletions || 0,
            changes: file.changes || (file.additions + file.deletions),
            patch: file.diffContent || file.diff || '',
            provider: provider,
            oldPath: file.previousFilename || file.previous_filename || file.old_path,
            newPath: file.new_path || file.path,
            changeType: file.changeType // Keep original for reference
        };
    }
}

module.exports = { PRFileFetcher };
