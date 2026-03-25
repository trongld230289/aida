/**
 * @module monaco-webview
 * @description Monaco Editor webview content generation for PR diff viewing
 * Extracted from extension.js during Phase 5 refactoring.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as _https from 'https';
import { parseFullDiffContentEnhanced } from './diff-utils';
import { toError } from '../core/error-utils';
import * as fs from 'fs';

/**
 * Get Monaco Editor language identifier from file extension
 * @param {string} fileExtension - File extension (e.g., ".js", ".py")
 * @returns {string} Monaco language identifier
 */
function getMonacoLanguage(fileExtension: string) {
    const languageMap = {
        '.js': 'javascript',
        '.jsx': 'javascript',
        '.ts': 'typescript',
        '.tsx': 'typescript',
        '.py': 'python',
        '.java': 'java',
        '.cs': 'csharp',
        '.cpp': 'cpp',
        '.c': 'c',
        '.h': 'c',
        '.hpp': 'cpp',
        '.php': 'php',
        '.rb': 'ruby',
        '.go': 'go',
        '.rs': 'rust',
        '.swift': 'swift',
        '.kt': 'kotlin',
        '.scala': 'scala',
        '.sh': 'shell',
        '.bash': 'shell',
        '.ps1': 'powershell',
        '.html': 'html',
        '.htm': 'html',
        '.xml': 'xml',
        '.css': 'css',
        '.scss': 'scss',
        '.sass': 'sass',
        '.less': 'less',
        '.json': 'json',
        '.yaml': 'yaml',
        '.yml': 'yaml',
        '.md': 'markdown',
        '.sql': 'sql',
        '.r': 'r',
        '.lua': 'lua',
        '.dart': 'dart',
        '.vue': 'vue'
    };

    return (languageMap as any)[fileExtension.toLowerCase()] || 'plaintext';
}

/**
 * Generate Monaco Editor webview content for enhanced diff viewing
 * @param {Object} diffData - The diff data object
 * @param {Object} panel - The webview panel
 * @param {Object} context - The extension context
 * @returns {string} HTML content for webview with Monaco Editor
 */
async function getMonacoWebviewContent(diffData: Record<string, any>, panel: vscode.WebviewPanel, context: Record<string, any>) {
    const { path: filePath, changeType, additions, deletions, diff } = diffData;

    console.log('🚀 Monaco webview content generation started for:', filePath);

    // Get all files in PR for sidebar
    let allFiles: Record<string, any>[] = [];
    let currentFileIndex = 0;
    const cache = (global as any).prDiffCache;

    if (cache) {
        // Determine PR prefix based on provider to filter correct files
        const { provider, prId } = diffData;
        let prPrefix;

        if (provider === 'github') {
            prPrefix = `github_${prId}_`;
        } else if (provider === 'gitlab') {
            prPrefix = `gitlab_${prId}_`;
        } else {
            // Azure DevOps
            prPrefix = `azure_${prId}_`;
        }

        console.log(`📁 Filtering cache for ${provider} PR ${prId} with prefix: ${prPrefix}`);

        const cacheKeys = Object.keys(cache).filter(key =>
            key.startsWith(prPrefix) && (cache)[key].path
        );
        allFiles = cacheKeys.map((key, index) => {
            const file = (cache)[key];
            const isCurrentFile = file.path === filePath;
            if (isCurrentFile) currentFileIndex = index;

            return {
                path: file.path,
                name: file.path.split('/').pop(),
                additions: file.additions || 0,
                deletions: file.deletions || 0,
                changeType: file.changeType || 'modified',
                active: isCurrentFile
            };
        });

        // Sort files alphabetically by path (A-Z)
        allFiles.sort((a, b) => a.path.localeCompare(b.path));

        // Recalculate currentFileIndex after sorting
        currentFileIndex = allFiles.findIndex(file => file.active);

        console.log('📁 Found', allFiles.length, 'files in PR, sorted A-Z, current file index:', currentFileIndex);

        // Background preloading of next few files (async, non-blocking)
        if (allFiles.length > 1) {
            setTimeout(async () => {
                console.log('🔄 Starting background preload of other files...');
                let preloadCount = 0;
                const maxPreload = Math.min(3, allFiles.length - 1); // Preload max 3 files

                for (const file of allFiles) {
                    if (file.path !== filePath && preloadCount < maxPreload) {
                        const contentCacheKey = `content_${file.path}`;
                        if (!(cache)[contentCacheKey]) {
                            try {
                                // Find the full diff data for this file
                                const cacheKeys = Object.keys(cache);
                                for (const key of cacheKeys) {
                                    if (key.startsWith('pr') && (cache)[key].path === file.path) {
                                        console.log('📋 Preloading:', file.path);
                                        const { originalLines, modifiedLines } = await parseFullDiffContentEnhanced((cache)[key].diff, file.path);

                                        (cache)[contentCacheKey] = {
                                            originalContent: originalLines.map((line) => line.content).join('\n'),
                                            modifiedContent: modifiedLines.map((line) => line.content).join('\n'),
                                            timestamp: Date.now()
                                        };

                                        preloadCount++;
                                        console.log('💾 Preloaded:', file.path);
                                        break;
                                    }
                                }
                            } catch (_error: unknown) {
                                const error = toError(_error);
                                console.warn('⚠️ Failed to preload:', file.path, error.message);
                            }
                        }
                    }
                }
            }, 1000); // Start preload after 1 second to not block initial load
        }
    }

    // Generate file URL for Azure DevOps/GitHub (PR context)
    let fileUrl = null;

    if (cache && (cache).organization && (cache).project && (cache).repository) {
        // Get PR ID from any cached diff data
        let prId = null;
        const cacheKeys = Object.keys(cache);
        for (const key of cacheKeys) {
            if (key.startsWith('pr') && (cache)[key].prId) {
                prId = (cache)[key].prId;
                break;
            }
        }

        if (prId) {
            // Azure DevOps PR file URL format
            fileUrl = `https://dev.azure.com/${(cache).organization}/${(cache).project}/_git/${(cache).repository}/pullrequest/${prId}?_a=files&path=${encodeURIComponent(filePath)}`;
        }
    } else if (diffData.provider === 'github' && diffData.owner && diffData.repo && diffData.prId) {
        // GitHub PR file URL format
        fileUrl = `https://github.com/${diffData.owner}/${diffData.repo}/pull/${diffData.prId}/files#diff-${encodeURIComponent(filePath)}`;
    } else if (diffData.provider === 'gitlab' && diffData.owner && diffData.repo && diffData.prId && diffData.gitlabHost) {
        // GitLab MR file URL format
        fileUrl = `https://${diffData.gitlabHost}/${diffData.owner}/${diffData.repo}/-/merge_requests/${diffData.prId}/diffs#diff-content-${encodeURIComponent(filePath)}`;
    }

    // Get Monaco Editor URIs
    const monacoUri = panel.webview.asWebviewUri(
        vscode.Uri.file(path.join(context.extensionPath, 'dist', 'monaco-editor', 'min', 'vs'))
    );

    // Lazy load: Only parse current file content, cache others for later
    let originalContent = '';
    let modifiedContent = '';

    // Check if content is already cached
    const contentCacheKey = `content_${filePath}`;
    if ((global as any).prDiffCache && (global as any).prDiffCache[contentCacheKey]) {
        const cached = (global as any).prDiffCache[contentCacheKey];
        originalContent = cached.originalContent;
        modifiedContent = cached.modifiedContent;
    } else {
        // PRIORITY 1: Check if full content already stored in diffData (from Azure DevOps API)
        if (diffData.fullBaseContent !== undefined && diffData.fullSourceContent !== undefined) {
            originalContent = diffData.fullBaseContent || '';
            modifiedContent = diffData.fullSourceContent || '';
        }
        // PRIORITY 2: For Azure DevOps, fetch full file content directly from API
        else if (diffData.useFullContent && diffData.organization && diffData.sourceCommit && diffData.targetCommit && diffData.accessToken) {
            try {
                const reviewPrPath = path.join(context.extensionPath, 'scripts', 'review-pr.js');
                const reviewPrModule = require(reviewPrPath);
                const getFileContent = reviewPrModule.getFileContent;

                if (typeof getFileContent === 'function') {
                    // Fetch both versions in parallel
                    const [baseContent, sourceContent] = await Promise.all([
                        getFileContent(diffData.organization, diffData.project, diffData.repository, filePath, diffData.targetCommit, diffData.accessToken),
                        getFileContent(diffData.organization, diffData.project, diffData.repository, filePath, diffData.sourceCommit, diffData.accessToken)
                    ]);

                    originalContent = baseContent || '';
                    modifiedContent = sourceContent || '';

                } else {
                    const { originalLines, modifiedLines } = await parseFullDiffContentEnhanced(diff, filePath);
                    originalContent = originalLines.map((line) => line.content).join('\n');
                    modifiedContent = modifiedLines.map((line) => line.content).join('\n');
                }
            } catch (_error: unknown) {
                // Fallback to diff parsing
                const { originalLines, modifiedLines } = await parseFullDiffContentEnhanced(diff, filePath);
                originalContent = originalLines.map((line) => line.content).join('\n');
                modifiedContent = modifiedLines.map((line) => line.content).join('\n');
            }
        }
        // PRIORITY 3: Fallback to diff parsing
        else {
            const { originalLines, modifiedLines } = await parseFullDiffContentEnhanced(diff, filePath);

            // Reconstruct full file content
            originalContent = originalLines.map((line) => line.content).join('\n');
            modifiedContent = modifiedLines.map((line) => line.content).join('\n');
        }

        // Cache the parsed content for future use
        if ((global as any).prDiffCache) {
            (global as any).prDiffCache[contentCacheKey] = {
                originalContent,
                modifiedContent,
                timestamp: Date.now()
            };
        }

        console.log('� Cached parsed content for:', filePath);
    }

    console.log('📝 Content lengths - Original:', originalContent.length, 'Modified:', modifiedContent.length);

    // Detect file language from extension
    const fileExtension = path.extname(filePath);
    const language = getMonacoLanguage(fileExtension);

    console.log('🔤 Detected language:', language, 'for extension:', fileExtension);

    // Generate file list HTML for sidebar
    let fileListHtml = '';
    if (allFiles.length > 0) {
        fileListHtml = allFiles.map((file, _index) => `
            <div class="file-item ${file.active ? 'active' : ''}" data-path="${escapeHtml(file.path)}" title="${escapeHtml(file.path)}">
                <div class="file-icon">📄</div>
                <div class="file-details">
                    <div class="file-name">${escapeHtml(file.name)}</div>
                    <div class="file-path">${escapeHtml(file.path)}</div>
                    <div class="file-stats">
                        <span class="additions">+${file.additions}</span>
                        <span class="deletions">-${file.deletions}</span>
                        <span class="change-type">${escapeHtml(file.changeType)}</span>
                    </div>
                </div>
            </div>
        `).join('');
    }

    // Pre-compute dynamic values for template placeholders
    const cspSource = panel.webview.cspSource;
    const filePathEscaped = escapeHtml(filePath);
    const sidebarClass = allFiles.length > 1 ? '' : 'hide-sidebar';
    const filePathLink = fileUrl
        ? `<a href="${fileUrl}" target="_blank" class="file-path-link" title="Open this file in PR on Azure DevOps">${escapeHtml(filePath)}</a>`
        : escapeHtml(filePath);
    const changeTypeEscaped = escapeHtml(changeType);
    const filesSidebar = allFiles.length > 1 ? `
        <div class="file-sidebar">
            <div class="sidebar-header">
                Files Changed
                <span class="files-count">${allFiles.length} files</span>
            </div>
            <div class="file-list">
                ${fileListHtml}
            </div>
            <div class="resize-handle"></div>
        </div>
        ` : '';
    const originalContentJson = JSON.stringify(originalContent);
    const modifiedContentJson = JSON.stringify(modifiedContent);
    const allFilesJson = JSON.stringify(allFiles);

    // Load HTML template from file

    const templatePath = path.join(context.extensionPath, 'scripts', 'review', 'templates', 'monaco-diff-viewer.html');
    let html = fs.readFileSync(templatePath, 'utf8');

    // Replace all {{PLACEHOLDER}} markers with runtime values
    html = html
        .replace(/\{\{CSP_SOURCE\}\}/g, cspSource)
        .replace(/\{\{FILE_PATH_ESCAPED\}\}/g, filePathEscaped)
        .replace(/\{\{SIDEBAR_CLASS\}\}/g, sidebarClass)
        .replace(/\{\{FILE_PATH_LINK\}\}/g, filePathLink)
        .replace(/\{\{CHANGE_TYPE\}\}/g, changeTypeEscaped)
        .replace(/\{\{ADDITIONS\}\}/g, String(additions))
        .replace(/\{\{DELETIONS\}\}/g, String(deletions))
        .replace(/\{\{LANGUAGE\}\}/g, language)
        .replace(/\{\{FILES_SIDEBAR\}\}/g, filesSidebar)
        .replace(/\{\{MONACO_URI\}\}/g, String(monacoUri))
        .replace(/\{\{ORIGINAL_CONTENT_JSON\}\}/g, originalContentJson)
        .replace(/\{\{MODIFIED_CONTENT_JSON\}\}/g, modifiedContentJson)
        .replace(/\{\{ALL_FILES_JSON\}\}/g, allFilesJson);

    return html;
}

/**
 * Escape HTML special characters
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text: string) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, m => (map as any)[m]);
}

// ES exports
export { getMonacoLanguage, getMonacoWebviewContent, escapeHtml };
