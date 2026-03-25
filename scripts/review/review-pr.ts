/**
 * review-pr.ts - Thin facade that re-exports from sub-modules.
 *
 * Sub-modules:
 *   ./pr-diff-handler   - Diff display & webview caching (GitHub, GitLab, Azure)
 *   ./pr-review-handler  - PR review orchestration, chat participant, commands
 *   ./pr-quick-review    - AI quick review, structured analysis, checklist
 *
 * All original public symbols are preserved for backward compatibility.
 */

//  Sub-module imports 
import {
    showGitHubDiffInWebview,
    showGitLabDiffInWebview,
    showAzureDevOpsDiffInWebview,
    displayPrReviewResults,
    openPrReviewDocument
} from './pr-diff-handler';

import {
    initializePrReview,
    handleReviewPr,
    reviewPullRequestCommand,
    processReviewPr
} from './pr-review-handler';

import {
    addQuickReviewOption,
    performQuickReviewWithAI,
    performStructuredQuickAnalysis,
    performBasicQuickAnalysis
} from './pr-quick-review';

//  Re-exports from platform-specific fetch modules 
import { analyzePullRequest, getAzureDevOpsPR, makeAzureDevOpsRequest, getFileContent } from './pr-fetch-azure';
import { getGitHubFileContent } from './pr-fetch-github';
import { analyzeGitLabMergeRequest, getGitLabMR, makeGitLabRequest } from './pr-fetch-gitlab';
import { parsePRUrlInfo, parseRealGitDiff } from './pr-utils';

//  ES named exports (preserves every original public symbol) 
export {
    // pr-diff-handler
    showGitHubDiffInWebview,
    showGitLabDiffInWebview,
    showAzureDevOpsDiffInWebview,
    displayPrReviewResults,
    openPrReviewDocument,
    // pr-review-handler
    initializePrReview,
    handleReviewPr,
    reviewPullRequestCommand,
    processReviewPr,
    // pr-quick-review
    addQuickReviewOption,
    performQuickReviewWithAI,
    performStructuredQuickAnalysis,
    performBasicQuickAnalysis,
    // pr-fetch-azure
    analyzePullRequest,
    getAzureDevOpsPR,
    makeAzureDevOpsRequest,
    getFileContent,
    // pr-fetch-github
    getGitHubFileContent,
    // pr-fetch-gitlab
    analyzeGitLabMergeRequest,
    getGitLabMR,
    makeGitLabRequest,
    // pr-utils
    parsePRUrlInfo,
    parseRealGitDiff
};
