/**
 * Centralized prompt-building utilities for the entire extension.
 * All AI instruction strings, fallback prompts, and template processing
 * logic are kept here so they can be tuned in one place.
 *
 * Covers: review (file, changes, all-changes, PR) and dependency analysis.
 *
 * @module prompts
 */

// ═══════════════════════════════════════════════════════════════════════
//  REVIEW PROMPTS
// ═══════════════════════════════════════════════════════════════════════

// ─── Instruction strings appended after injected content ───────────────

const INSTRUCTIONS = Object.freeze({
    /** Appended after file content in review-file */
    REVIEW_FILE:
        '**Instructions:** Please analyze the file content above using the review framework provided in this template.\n',

    /** Appended after diff in review-changes */
    REVIEW_CHANGES:
        '**Instructions:** Please analyze the diff above using the review framework provided in this template.\n',

    /** Appended after diff in review-all-changes */
    REVIEW_ALL_CHANGES:
        '**Instructions:** Please analyze ALL changes above using the review framework provided in this template.\n',

    /** Appended after diff in review-pr (full PR review) */
    REVIEW_PR:
        '**Instructions:** Please analyze ALL changes above (both diffs and new files) using the strict review framework provided in this template.\n',

    /** Appended after diff in review-pr per-file assessment */
    REVIEW_PR_FILE:
        '**Instructions:** Please analyze the diff above using the strict review framework provided in this template.\n',
});

// ─── Fallback prompts (used when template files can't be loaded) ───────

/**
 * Build a fallback prompt for review-file when no template is available.
 */
function buildFallbackFilePrompt({ fileName, filePath, content }) {
    return `Please review this TypeScript Angular component file:

**File:** ${fileName}
**Path:** ${filePath}

\`\`\`typescript
${content}
\`\`\`

Provide comprehensive analysis with specific examples and actionable recommendations.`;
}

/**
 * Default template sentence when no template file exists for review-file.
 */
function getDefaultFileTemplate(fileExtension) {
    return `Please review the following ${fileExtension} file for code quality, best practices, and potential improvements.`;
}

// ─── Template processing helpers ───────────────────────────────────────

/**
 * Replace common placeholders in a review template.
 * Works for review-file; other modes can extend as needed.
 */
function replaceFilePlaceholders(template, { fileName, filePath, fileExtension, content }) {
    return template
        .replace(/\[FILE_NAME\]/g, fileName)
        .replace(/\[FILE_PATH\]/g, filePath)
        .replace(/\[FILE_TYPE\]/g, fileExtension)
        .replace(/\[FILE_SIZE\]/g, `${content.length} characters`)
        .replace(/\[REVIEW_DATE\]/g, new Date().toLocaleDateString());
}

/**
 * Build the final prompt for **review-file**.
 *
 * @param {string|null} templateContent - Review template markdown (may be null)
 * @param {Object} fileInfo            - { fileName, filePath, fileExtension, content }
 * @param {Object} [detection]         - Language detection result
 * @returns {string} Ready-to-send prompt
 */
function buildFileReviewPrompt(templateContent, fileInfo, detection) {
    const { fileName, filePath, fileExtension, content } = fileInfo;

    if (!templateContent) {
        return buildFallbackFilePrompt({ fileName, filePath, content });
    }

    let processed = replaceFilePlaceholders(templateContent, fileInfo);

    // Remove old file-content placeholder block if present
    processed = processed.replace(/## File Content to Review[\s\S]*?\[FILE_CONTENT\]/g, '');

    // Inject file content at the end
    processed += '\n\n---\n\n';
    processed += '## FILE CONTENT TO REVIEW\n\n';
    processed += `\`\`\`typescript\n${content}\n\`\`\`\n\n`;
    processed += INSTRUCTIONS.REVIEW_FILE;

    return processed;
}

/**
 * Build the final prompt for **review-changes**.
 *
 * @param {string} templateContent - Review template markdown
 * @param {string} diffContent     - Git diff text
 * @returns {string} Ready-to-send prompt
 */
function buildChangesReviewPrompt(templateContent, diffContent) {
    let finalContent = templateContent;
    finalContent += '\n\n## GIT DIFF TO REVIEW\n\n```diff\n' + diffContent + '\n```\n';
    finalContent += '\n```\n\n';
    finalContent += INSTRUCTIONS.REVIEW_CHANGES;
    return finalContent;
}

/**
 * Build the final prompt for **review-all-changes**.
 *
 * @param {string} templateContent - Review template markdown
 * @param {string} diffContent     - Combined git diff
 * @param {Array}  files           - Array of { file, linesAdded, linesRemoved, type }
 * @returns {string} Ready-to-send prompt
 */
function buildAllChangesReviewPrompt(templateContent, diffContent, files) {
    let finalContent = templateContent;

    const fileList = files
        .map((f, i) => `${i + 1}. \`${f.file}\` (+${f.linesAdded} -${f.linesRemoved}) [${f.type}]`)
        .join('\n');

    const diffBlock =
        '## ALL GIT DIFFS TO REVIEW\n\n' +
        `**Reviewing ${files.length} changed files:**\n\n` +
        fileList + '\n\n' +
        '```diff\n' + diffContent + '\n```\n\n' +
        '---\n\n';

    // Try to insert before "SPECIFIC RULES VIOLATED" section
    const insertionPoint = finalContent.indexOf('## 🔍 SPECIFIC RULES VIOLATED');

    if (insertionPoint !== -1) {
        finalContent =
            finalContent.substring(0, insertionPoint) +
            diffBlock +
            finalContent.substring(insertionPoint);
    } else {
        finalContent += '\n\n' + diffBlock;
    }

    return finalContent;
}

/**
 * Build the final prompt for **review-pr** (full PR with diff + new files).
 *
 * @param {string} templateContent - Review template markdown
 * @param {string} diffContent     - PR diff text
 * @param {Array}  sourceFiles     - Array of file change objects from PR data
 * @returns {string} Ready-to-send prompt
 */
function buildPRReviewPrompt(templateContent, diffContent, sourceFiles = []) {
    // Clean up old diff placeholder
    let processed = templateContent.replace(/```diff[\s\S]*?\{\{FINAL_DIFF_CONTENT\}\}[\s\S]*?```/g, '');

    processed += '\n\n---\n\n';
    processed += '## PULL REQUEST CHANGES TO REVIEW\n\n';

    // Separate modified vs new files
    const modifiedFiles = sourceFiles.filter(f => {
        const ct = (f.changeType || '').toLowerCase();
        return (ct === 'edit' || ct === 'modify' || ct === 'modified') || !f.fullContent;
    });

    const newFiles = sourceFiles.filter(f => {
        const ct = (f.changeType || '').toLowerCase();
        return (ct === 'add' || ct === 'added' || ct === 'new') && f.fullContent;
    });

    if (modifiedFiles.length > 0 || diffContent) {
        processed += '### PULL REQUEST CHANGES TO REVIEW\n\n';
        processed += '```diff\n';
        processed += diffContent;
        processed += '\n```\n\n';
    }

    processed += INSTRUCTIONS.REVIEW_PR;

    return { processed, modifiedFiles, newFiles };
}

/**
 * Build the final prompt for **review-pr per-file assessment**.
 *
 * @param {string} templateContent - Review template markdown
 * @param {string} fullDiff        - Diff for the single file
 * @returns {string} Ready-to-send prompt
 */
function buildPRFileAssessmentPrompt(templateContent, fullDiff) {
    let processed = templateContent.replace(/```diff[\s\S]*?\{\{FINAL_DIFF_CONTENT\}\}[\s\S]*?```/g, '');

    processed += '\n\n---\n\n';
    processed += '## PULL REQUEST DIFF TO REVIEW\n\n';
    processed += '```diff\n';
    processed += (fullDiff || '');
    processed += '\n```\n\n';
    processed += INSTRUCTIONS.REVIEW_PR_FILE;

    return processed;
}


// ═══════════════════════════════════════════════════════════════════════
//  DEPENDENCY / IMPACT ANALYSIS PROMPTS
// ═══════════════════════════════════════════════════════════════════════

const HTML_FORMAT_INSTRUCTION = `FORMAT OUTPUT AS HTML:
- Use <h1> for the title.
- Use <h2> for section headers.
- Use <ul> and <li> for lists.
- Use <p> for paragraphs.
- Use <strong> for emphasis.
- Do NOT use markdown. Do NOT use \`\`\`html code blocks. Just raw HTML.`;

/**
 * Build the prompt for **PR-level dependency impact analysis**.
 *
 * @param {Object} data - { prSummary, changes, impact, symbolMap }
 * @returns {string}
 */
function buildDependencyPRAnalysisPrompt(data) {
    return `You are an expert code reviewer and architect.
Analyze the impact of this Pull Request based on the dependency graph data.

PR Context:
${JSON.stringify({
        summary: data.prSummary,
        changes: data.changes,
        impact: data.impact,
        symbolMap: data.symbolMap
    }, null, 2)}

Please provide a comprehensive report covering:
1. Summary of Changes: What is being changed at a high level?
2. Impact Analysis: Which components are affected and how critical is the impact?
3. Risk Assessment: Are there any high-risk changes (e.g., modifying core services, circular dependencies)?
4. Testing Recommendations: What should be tested to ensure no regressions?

${HTML_FORMAT_INSTRUCTION}
- Use <h1> for the title: "Pull Request Impact Analysis"

IMPORTANT INSTRUCTION:
For files listed in the PR that have NO dependents or impact on other files:
- Explicitly mention that they have "Low Risk" or are "Isolated Changes".
- Do NOT hallucinate impacts for these isolated files.
- Focus the "Impact Analysis" and "Testing Recommendations" on the files that actually have dependents.

Keep the language simple and focus on USER IMPACT.`;
}

/**
 * Build the prompt for **single-node dependency impact analysis**.
 *
 * @param {Object} data - { fileName, dependencies[], dependents[] }
 *        Each dep item: { main, html?, css? }
 * @returns {string}
 */
function buildDependencyNodeAnalysisPrompt(data) {
    const depsText = data.dependencies.map(dep => {
        let parts = [`- ${dep.main}`];
        if (dep.html) parts.push(`(has UI template: ${dep.html})`);
        if (dep.css) parts.push(`(has styles: ${dep.css})`);
        return parts.join(' ');
    }).join('\n');

    const dependentsText = data.dependents.map(dep => {
        let parts = [`- ${dep.main}`];
        if (dep.html) parts.push(`(has UI template: ${dep.html})`);
        if (dep.css) parts.push(`(has styles: ${dep.css})`);
        return parts.join(' ');
    }).join('\n');

    return `You are analyzing a code change impact. A developer wants to modify a file and needs to know what to test.

**File being modified:** ${data.fileName}

**This file uses these components/modules (${data.dependencies.length} dependencies):**
${depsText}

**These components/modules depend on this file (${data.dependents.length} dependents):**
${dependentsText}

IMPORTANT INSTRUCTION:
If the list of dependents is EMPTY (0 dependents), it means this file is NOT used by any other file in the scanned codebase.
In this case, you MUST conclude that the risk is LOW or the file might be unused/dead code (unless it is a known entry point like main.ts or index.html).
Do NOT hallucinate features or impacts if there are no dependents.
If there are dependents, analyze the impact based ONLY on the listed files.

Please provide a simple, easy-to-understand analysis for a QA tester or project manager (non-technical user).

${HTML_FORMAT_INSTRUCTION}
- Use <h1> for the title: "Testing Impact Analysis for ${data.fileName}"

Sections to include:
1. What features should be tested?
2. Which pages/screens need checking?
3. Risk level (High/Medium/Low) and why
4. Testing priority

Keep the language simple and focus on USER IMPACT, not technical details.`;
}


// ═══════════════════════════════════════════════════════════════════════
//  EXPORTS
// ═══════════════════════════════════════════════════════════════════════

module.exports = {
    // Review
    INSTRUCTIONS,
    buildFallbackFilePrompt,
    getDefaultFileTemplate,
    replaceFilePlaceholders,
    buildFileReviewPrompt,
    buildChangesReviewPrompt,
    buildAllChangesReviewPrompt,
    buildPRReviewPrompt,
    buildPRFileAssessmentPrompt,
    // Dependency
    buildDependencyPRAnalysisPrompt,
    buildDependencyNodeAnalysisPrompt,
};
