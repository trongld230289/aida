/**
 * @module review/interfaces/detection
 * @description Interfaces for language / framework auto-detection results.
 */

/** Result of language auto-detection for a single file or PR */
export interface IDetectionResult {
    /** Detected language or framework name (e.g. 'TypeScript', 'Angular') */
    detected: string;
    /** Classification kind — 'language' or 'fallback' */
    type: string;
    /** Detection confidence — 'low' | 'medium' | 'high' */
    confidence: string;
    /** Human-readable explanation of why this detection was chosen */
    reason: string;
    /** Relative template path (e.g. 'review-code/languages/typescript') */
    templatePath: string;
    /** Source that provided the template (set after template loading) */
    templateSource?: string;
}

/** Extended detection result with workspace-level data */
export interface IWorkspaceDetectionResult extends IDetectionResult {
    templateType: string | null;
}
