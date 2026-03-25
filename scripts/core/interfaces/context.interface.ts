/**
 * @module core/interfaces/context
 * @description Interfaces for the AidaContext singleton shared state.
 */

/** A business-doc category that the user can select for review context */
export interface IBusinessDocCategory {
    name: string;
    displayName: string;
    path?: string;
    relativePath?: string;
}

/** Per-review-mode state tracking selected business doc categories */
export interface IBusinessDocsReviewState {
    selectedCategories: Set<string>;
    allCategories: unknown[];
}

/** Map of review-mode → business-docs selection state */
export interface IBusinessDocsState {
    'changes-review': IBusinessDocsReviewState;
    'file-review': IBusinessDocsReviewState;
    [key: string]: IBusinessDocsReviewState;
}

/** A single cached diff entry (file-level) */
export interface IDiffCacheEntry {
    path: string;
    provider?: string;
    prId?: string;
    originalContent?: string;
    modifiedContent?: string;
    [key: string]: unknown;
}

/** Full PR diff cache with provider metadata */
export interface IPrDiffCache {
    accessToken?: string;
    organization?: string;
    project?: string;
    repository?: string;
    sourceCommit?: string;
    targetCommit?: string;
    mergeBaseCommit?: string;
    [diffId: string]: unknown;
}

/** Cached PR data (file changes list) */
export interface IPRData {
    fileChanges?: unknown[];
    [key: string]: unknown;
}
