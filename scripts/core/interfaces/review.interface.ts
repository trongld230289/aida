/**
 * @module IReview
 * @description Review module shared interfaces.
 */

/** Result of a code review operation */
export interface IReviewResult {
    success: boolean;
    /** Markdown-formatted review content */
    review?: string;
    error?: string;
    /** Number of files reviewed */
    fileCount?: number;
    /** Token usage for this review */
    tokenUsage?: {
        inputTokens: number;
        outputTokens: number;
    };
}

/** Parsed git diff information */
export interface IGitDiff {
    filePath: string;
    hunks: IGitDiffHunk[];
    additions: number;
    deletions: number;
    isBinary: boolean;
}

/** A single hunk within a git diff */
export interface IGitDiffHunk {
    oldStart: number;
    oldLines: number;
    newStart: number;
    newLines: number;
    content: string;
}

/** PR diff data for provider-agnostic processing */
export interface IDiffData {
    originalContent: string;
    modifiedContent: string;
    filePath: string;
    language?: string;
}

/** Options for displaying a diff in a webview */
export interface IDiffViewOptions {
    title?: string;
    filePath: string;
    provider: 'azure' | 'github' | 'gitlab';
}

/** PR file fetcher abstraction (Strategy pattern) */
export interface IPrFileFetcher {
    readonly providerName: string;
    fetchFileContent(filePath: string, commitId: string): Promise<string>;
    fetchDiff(filePath: string): Promise<IDiffData>;
}
