/**
 * @module core/interfaces/template
 * @description Interfaces for template loading results.
 */

/** Result of loading a review template via the priority chain */
export interface ITemplateResult {
    /** Processed template content */
    content: string;
    /** Where the template was found (e.g. 'workspace', 'extension\\templates') */
    templateSource: string;
    /** Relative display path (e.g. 'review-code/languages/angular') */
    templatePath: string;
    /** Absolute filesystem path that was actually used */
    usedPath: string;
}
