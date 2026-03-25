/**
 * @module review/interfaces/file-target
 * @description Interface for file target resolution during review.
 */

/** Result of resolving which file to review */
export interface IFileTargetInfo {
    success: boolean;
    filePath?: string;
    source?: string;
    message?: string;
}
