import { getTokenForPR } from './review-common';
import { parsePRUrlInfo } from './pr-utils';
import { getGitHubPR } from './pr-fetch-github';
import { getAzureDevOpsPR } from './pr-fetch-azure';
import { getGitLabMR } from './pr-fetch-gitlab';
import { aidaLogging } from '../core/settings';

import { IParsedPRInfo, INormalizedFileChange } from './interfaces/pr.interface';

// ── Status map ──────────────────────────────────────────────

const STATUS_MAP: Record<string, string> = {
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

/**
 * Unified PR file fetcher for all providers
 * Reuses logic from review-pr for fetching file changes
 */
class PRFileFetcher {
    /**
     * Parse PR URL and extract information
     */
    parsePRUrl(prUrl: string): IParsedPRInfo {
        const parsed = parsePRUrlInfo(prUrl) as IParsedPRInfo;

        if (!parsed.repoType) {
            throw new Error('Unsupported PR URL format. Supported: GitHub, Azure DevOps, GitLab');
        }

        return parsed;
    }

    /**
     * Fetch file changes from PR URL
     */
    async fetchFiles(prInfo: IParsedPRInfo): Promise<INormalizedFileChange[]> {
        aidaLogging(`🔍 Fetching files from ${prInfo.repoType} PR...`);

        const token = getTokenForPR(prInfo.originalUrl as any);
        if (!token) {
            throw new Error(`Token required for ${prInfo.repoType} (${prInfo.owner || prInfo.organization})`);
        }

        let result: Record<string, unknown>;
        switch (prInfo.repoType) {
            case 'github':
                result = await getGitHubPR(prInfo.owner as any, prInfo.repo as any, prInfo.prId as any, token);
                break;
            case 'azure':
                result = await getAzureDevOpsPR(prInfo.organization as any, prInfo.project as any, prInfo.repository as any, prInfo.prId as any, token);
                break;
            case 'gitlab':
                result = await getGitLabMR(prInfo.organization as any, prInfo.owner as any, prInfo.repo as any, prInfo.prId as any, token);
                break;
            default:
                throw new Error(`Unsupported repo type: ${prInfo.repoType}`);
        }

        if (!(result as any).success) {
            throw new Error((result as any).error || 'Failed to fetch PR data');
        }

        const fileChanges: Record<string, string | number>[] = (result as any).data?.fileChanges || [];
        return fileChanges.map((file) => this.normalizeFileChange(file, prInfo.repoType!));
    }

    /**
     * Normalize file change object across providers
     */
    normalizeFileChange(file: Record<string, any>, provider: string): INormalizedFileChange {
        const status: string =
            STATUS_MAP[file.changeType?.toLowerCase()] ||
            STATUS_MAP[file.status?.toLowerCase()] ||
            'edit';

        aidaLogging(`🔍 Normalize ${file.path}: changeType="${file.changeType}" → status="${status}" (+${file.additions}/-${file.deletions})`);

        return {
            path: file.path,
            status,
            additions: file.additions || 0,
            deletions: file.deletions || 0,
            changes: file.changes || (file.additions + file.deletions),
            patch: file.diffContent || file.diff || '',
            provider,
            oldPath: file.previousFilename || file.previous_filename || file.old_path,
            newPath: file.new_path || file.path,
            changeType: file.changeType
        };
    }
}

// Dual exports
export { PRFileFetcher };
export type { IParsedPRInfo, INormalizedFileChange };
