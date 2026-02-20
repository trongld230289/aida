/**
 * @module review-ui
 * @description Review display & output-channel helpers
 * Extracted from review-common.js during Phase 1 refactoring
 */

const vscode = require('vscode');
const { aidaLogging } = require('./settings');

// Lazy requires to avoid circular deps
function _getTokenEstimator() { return require('./token-estimator'); }
function _getTemplateEngine() { return require('./template-engine'); }

function displayReviewHeader(stream, reviewType, filePath, diffLength = null, templatePath = null, templateSource = null, businessDocs = null) {
    const path = require('path');
    const fileName = path.basename(filePath);
    const fullPath = filePath;

    stream.markdown(`# 🔍 ${reviewType}: \`${fileName}\`\n\n`);
    stream.markdown(`📂 **Full Path:** \`${fullPath}\`\n`);

    if (diffLength !== null) {
        stream.markdown(`📄 **Diff Length:** ${diffLength} characters\n`);
    }

    // Display business documents if selected
    displayDocumentReviewHeader(stream);
}

function displayDocumentReviewHeader(stream) {
    const path = require('path');

    // Display business documents if selected
    if (global.selectedBusinessDocs && global.selectedBusinessDocs.length > 0) {
        stream.markdown(`📋 **Enhanced Review Mode - Business Documents:**\n\n`);

        // Debug logging
        aidaLogging('🔍 Debug selectedBusinessDocs:', global.selectedBusinessDocs);

        global.selectedBusinessDocs.forEach((doc, index) => {
            aidaLogging(`🔍 Debug doc ${index}:`, doc, 'Type:', typeof doc);

            // Handle different types of doc entries
            let docName, docPath;

            if (typeof doc === 'string') {
                // Direct string path
                docName = path.basename(doc);
                docPath = _getTemplateEngine().normalizePathForDisplay(doc);
            } else if (doc && typeof doc === 'object' && doc.path) {
                // Object with path property
                docName = path.basename(doc.path);
                docPath = _getTemplateEngine().normalizePathForDisplay(doc.path);
            } else if (doc && typeof doc === 'object' && doc.name) {
                // Object with name property
                docName = doc.name;
                docPath = doc.displayName || doc.relativePath || doc.name;
            } else {
                // Invalid entry
                aidaLogging('⚠️ Invalid business document entry:', doc);
                stream.markdown(`${index + 1}. Invalid document entry (type: ${typeof doc})\n`);
                return;
            }

            stream.markdown(`${index + 1}. \`${docName}\` - \`${docPath}\`\n`);
        });
        stream.markdown(`\n`);
    } else {
        stream.markdown(`⚡ **Quick Review Mode** - No business documents selected\n\n`);
    }

    // Cleanup business documents state after display
    global.selectedBusinessDocs = null;
    aidaLogging('🧹 displayCommonReviewInfo - cleanup: global.selectedBusinessDocs = null');
}

function getChecklistStatusIcon(status) {
    const statusIcons = {
        'ok': '✅',
        'warning': '⚠️',
        'critical': '🚨',
        'suggestion': '💡',
        'unknown': '❓'
    };
    return statusIcons[status] || '❓';
}

function showTokenStatistics(stream, inputText, outputText, model, reviewType, attemptCount, provider = null, apiHost = null, actualTokens = null) {
    // Use actual tokens from API response if available, otherwise estimate
    let inputTokens, outputTokens;

    if (actualTokens && actualTokens.inputTokens !== undefined && actualTokens.outputTokens !== undefined) {
        // Use actual tokens from API response (more accurate)
        inputTokens = actualTokens.inputTokens;
        outputTokens = actualTokens.outputTokens;
        aidaLogging(`📊 Using actual tokens from API: Input=${inputTokens}, Output=${outputTokens}`);
    } else {
        // Fall back to estimation (for Copilot mode)
        inputTokens = _getTokenEstimator().estimateTokenCount(inputText);
        outputTokens = _getTokenEstimator().estimateTokenCount(outputText);
        aidaLogging(`📊 Using estimated tokens: Input=${inputTokens}, Output=${outputTokens}`);
    }

    // Get cost estimation with GitHub Copilot quota logic
    const finalCost = _getTokenEstimator().estimateCost(inputTokens, outputTokens, model.family, provider, apiHost, 'pro', 0);

    // Determine completion status
    const completionStatus = attemptCount === 0 ? 'original model' : `fallback model (${model.family})`;

    // Display token statistics with provider info
    stream.markdown(`\n\n---\n\n`);
    stream.markdown(`📊 **Token Usage Summary:**\n`);
    stream.markdown(`- **Input tokens**: ${inputTokens.toLocaleString()}\n`);
    stream.markdown(`- **Output tokens**: ${outputTokens.toLocaleString()}\n`);
    stream.markdown(`- **Total tokens**: ${(inputTokens + outputTokens).toLocaleString()}\n`);

    stream.markdown(`- **Model used**: ${model.family}${finalCost.provider ? ` (${finalCost.provider})` : ''}\n\n`);
    stream.markdown(`✅ **${reviewType} Analysis complete** - successfully used ${completionStatus}\n\n`);

    // Console logging
    aidaLogging(`✅ ${reviewType} review completed successfully with model:`, model.family);
    aidaLogging(`📊 Token usage - Input: ${inputTokens}, Output: ${outputTokens}`);
}

function displayCommonReviewInfo(stream, reviewType, filePath, options = {}) {
    const path = require('path');
    const vscode = require('vscode');

    // Extract file/folder name for title
    const fileName = path.basename(filePath);

    // Convert absolute path to relative path from workspace root
    let displayPath = filePath;
    try {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (workspaceFolder && path.isAbsolute(filePath)) {
            // Convert to relative path from workspace root
            const relativePath = path.relative(workspaceFolder.uri.fsPath, filePath);
            // Use backslashes for consistency (Windows style)
            displayPath = _getTemplateEngine().normalizePathForDisplay(relativePath);
        }
    } catch (error) {
        // Fallback to original path if conversion fails
        aidaLogging('Failed to convert to relative path:', error);
    }

    // Display header
    stream.markdown(`# 🔍 ${reviewType}: \`${fileName}\`\n\n`);

    // Display relative path 
    stream.markdown(`📂 **Full Path:** \`${displayPath}\`\n\n`);

    // Display length info if provided
    if (options.length !== null && options.length !== undefined) {
        let icon = '📄';
        let label = options.lengthLabel || 'File Length';

        if (options.lengthType === 'diff') {
            icon = '📏';
            label = 'Diff Length';
        } else if (options.lengthType === 'file') {
            icon = '📄';
            label = 'File Length';
        } else if (options.lengthType === 'changes') {
            icon = '📊';
            label = 'File Changes';
        }

        const unit = options.lengthType === 'changes' ? '' : ' characters';
        stream.markdown(`${icon} **${label}:** ${options.length}${unit}\n\n`);
    }

    // Display business documents if selected
    displayDocumentReviewHeader(stream);
}

module.exports = {
    displayReviewHeader,
    displayDocumentReviewHeader,
    getChecklistStatusIcon,
    showTokenStatistics,
    displayCommonReviewInfo
};
