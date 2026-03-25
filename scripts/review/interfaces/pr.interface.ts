/**
 * @module review/interfaces/pr
 * @description Interfaces for Pull Request URL parsing and normalised file changes.
 */

/** Parsed information extracted from a PR URL */
export interface IParsedPRInfo {
    repoType: string | null;
    prId: string | null;
    owner: string | null;
    repo: string | null;
    organization: string | null;
    project: string | null;
    repository: string | null;
    originalUrl: string | null;
}

/** Provider-agnostic representation of a single file change inside a PR */
export interface INormalizedFileChange {
    path: string;
    status: string;
    additions: number;
    deletions: number;
    changes: number;
    patch: string;
    provider: string;
    oldPath?: string;
    newPath: string;
    changeType?: string;
}
