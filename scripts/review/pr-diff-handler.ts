import * as vscode from 'vscode';
import { aidaLogging } from '../core/settings';
import { getTokenForPR } from './review-common';
import { clearPrDiffCache } from './pr-utils';

/**
 * FUNCTION B - Handle GitHub PR diffs and show in webview
 * Dedicated function for GitHub diffs - clean separation from Azure DevOps
 * @param {object} prAnalysis - GitHub PR analysis result
 * @param {object} stream - VS Code stream for output
 */
async function showGitHubDiffInWebview(prAnalysis: Record<string, any>, stream: vscode.ChatResponseStream) {
    aidaLogging('🐙 GitHub Function B: Starting GitHub diff webview display');
    
    if (!prAnalysis || !prAnalysis.data || !prAnalysis.data.fileChanges) {
        stream.markdown('❌ **No GitHub diff data available**\n\n');
        return;
    }

    const data = prAnalysis.data;
    
    // Initialize global cache for GitHub diffs
    if (!(global as any).prDiffCache) {
        (global as any).prDiffCache = {};
    }

    // Clear existing cache entries for this GitHub PR to prevent file count discrepancy
    clearPrDiffCache('github', data.id);

    stream.markdown('🐙 **GitHub Diff Webview Display**\n\n');
    
    // Cache all GitHub file changes for webview access (ALL files for Monaco diff view)
    const allFileChanges = data.fileChanges || [];
    allFileChanges.forEach((fileChange: any) => {
        const diffId = `github_${data.id}_${fileChange.path.replace(/[^a-zA-Z0-9]/g, '_')}`;
        
        (global as Record<string, any>).prDiffCache[diffId] = {
            prId: data.id,
            owner: data.owner,
            repo: data.repository,
            // Ensure diffContent is available for webview
            diff: fileChange.diffContent || fileChange.diff || '',
            diffContent: fileChange.diffContent || fileChange.diff || ''
        };
        
        aidaLogging(`📝 Cached GitHub diff: ${diffId} for ${fileChange.path}`);
        aidaLogging(`📊 DEBUG: owner=${data.owner}, repo=${data.repository}, provider=github`);
    });

    // Debug cache summary for GitHub (ALL files)
    const githubCacheKeys = Object.keys((global as any).prDiffCache).filter(k => k.startsWith(`github_${data.id}_`));
    aidaLogging(`🐙 GitHub cache summary: ${githubCacheKeys.length} files cached:`, githubCacheKeys);

    // Display file links with webview buttons (hover for details)
    stream.markdown('📂 **Files in this GitHub PR:**\n\n');
    
    // Only show first file with custom title (ALL files for Monaco)
    if (allFileChanges.length > 0) {
        const firstFile = allFileChanges[0];
        const diffId = `github_${data.id}_${firstFile.path.replace(/[^a-zA-Z0-9]/g, '_')}`;
        
        // Create single button with custom title
        stream.button({
            command: 'aida.viewPrDiff',
            title: `🪟 Open Diff Viewer (${allFileChanges.length} files)`,
            tooltip: `View changes in Monaco Diff Editor - ${allFileChanges.length} files total`,
            arguments: [diffId]
        });
    }

    stream.markdown('\n\n💡 **Click to explore changes in diff viewer**\n\n');
}

/**
 * FUNCTION D - Handle Bitbucket Cloud PR diffs and show in webview
 * Dedicated function for Bitbucket diffs - clean separation from other providers
 * @param {object} prAnalysis - Bitbucket PR analysis result
 * @param {object} stream - VS Code stream for output
 */
async function showBitbucketDiffInWebview(prAnalysis: Record<string, any>, stream: vscode.ChatResponseStream) {
    aidaLogging('🪣 Bitbucket Function D: Starting Bitbucket diff webview display');

    if (!prAnalysis || !prAnalysis.data || !prAnalysis.data.fileChanges) {
        stream.markdown('❌ **No Bitbucket diff data available**\n\n');
        return;
    }

    const data = prAnalysis.data;

    // Initialize global cache for Bitbucket diffs
    if (!(global as any).prDiffCache) {
        (global as any).prDiffCache = {};
    }

    // Clear existing cache entries for this Bitbucket PR to prevent file count discrepancy
    clearPrDiffCache('bitbucket', data.id);

    stream.markdown('🪣 **Bitbucket Diff Webview Display**\n\n');

    // Cache all Bitbucket file changes for webview access (ALL files for Monaco diff view)
    const allFileChanges = data.fileChanges || [];
    allFileChanges.forEach((fileChange: any) => {
        const diffId = `bitbucket_${data.id}_${fileChange.path.replace(/[^a-zA-Z0-9]/g, '_')}`;

        (global as Record<string, any>).prDiffCache[diffId] = {
            ...fileChange,
            provider: 'bitbucket',
            prId: data.id,
            owner: data.owner,
            repo: data.repository,
            // Ensure diffContent is available for webview
            diff: fileChange.diffContent || fileChange.diff || '',
            diffContent: fileChange.diffContent || fileChange.diff || ''
        };

        aidaLogging(`📝 Cached Bitbucket diff: ${diffId} for ${fileChange.path} (${fileChange.changeType})`);
    });

    // Debug cache summary for Bitbucket (ALL files)
    const bitbucketCacheKeys = Object.keys((global as any).prDiffCache).filter(k => k.startsWith(`bitbucket_${data.id}_`));
    aidaLogging(`🪣 Bitbucket cache summary: ${bitbucketCacheKeys.length} files cached:`, bitbucketCacheKeys);

    // Display file links with webview buttons (hover for details)
    stream.markdown('📂 **Files in this Bitbucket PR:**\n\n');

    // Only show first file with custom title (ALL files for Monaco)
    if (allFileChanges.length > 0) {
        const firstFile = allFileChanges[0];
        const diffId = `bitbucket_${data.id}_${firstFile.path.replace(/[^a-zA-Z0-9]/g, '_')}`;

        // Create single button with custom title
        stream.button({
            command: 'aida.viewPrDiff',
            title: `🪟 Open Diff Viewer (${allFileChanges.length} files)`,
            tooltip: `View changes in Monaco Diff Editor - ${allFileChanges.length} files total`,
            arguments: [diffId]
        });
    }

    stream.markdown('\n\n💡 **Click to explore changes in diff viewer**\n\n');
}

/**
 * FUNCTION C - Handle GitLab MR diffs and show in webview
 * Dedicated function for GitLab diffs - clean separation from other providers
 * @param {object} mrAnalysis - GitLab MR analysis result
 * @param {object} stream - VS Code stream for output
 */
async function showGitLabDiffInWebview(mrAnalysis: Record<string, any>, stream: vscode.ChatResponseStream) {
    aidaLogging('🦊 GitLab Function C: Starting GitLab diff webview display');
    
    if (!mrAnalysis || !mrAnalysis.data || !mrAnalysis.data.fileChanges) {
        stream.markdown('❌ **No GitLab diff data available**\n\n');
        return;
    }

    const data = mrAnalysis.data;
    
    // Initialize global cache for GitLab diffs
    if (!(global as any).prDiffCache) {
        (global as any).prDiffCache = {};
    }

    // Clear existing cache entries for this GitLab MR to prevent file count discrepancy
    clearPrDiffCache('gitlab', data.id);

    stream.markdown('🦊 **GitLab Diff Webview Display**\n\n');
    
    // Cache all GitLab file changes for webview access (ALL files for Monaco diff view)
    const allFileChanges = data.fileChanges || [];
    allFileChanges.forEach((fileChange: Record<string, string>) => {
        const diffId = `gitlab_${data.id}_${(fileChange.path ?? '').replace(/[^a-zA-Z0-9]/g, '_')}`;
        
        (global as any).prDiffCache[diffId] = {
            ...fileChange,
            provider: 'gitlab',
            prId: data.id,
            owner: data.owner,
            repo: data.repository,
            gitlabHost: data.gitlabHost,
            // Ensure diffContent is available for webview
            diff: fileChange.diffContent || fileChange.diff || '',
            diffContent: fileChange.diffContent || fileChange.diff || ''
        };
        
        aidaLogging(`📝 Cached GitLab diff: ${diffId} for ${fileChange.path}`);
        aidaLogging(`📊 DEBUG: owner=${data.owner}, repo=${data.repository}, host=${data.gitlabHost}, provider=gitlab`);
    });

    // Debug cache summary for GitLab (ALL files)
    const gitlabCacheKeys = Object.keys((global as any).prDiffCache).filter(k => k.startsWith(`gitlab_${data.id}_`));
    aidaLogging(`🦊 GitLab cache summary: ${gitlabCacheKeys.length} files cached:`, gitlabCacheKeys);

    // Display file links with webview buttons (hover for details)
    stream.markdown('📂 **Files in this GitLab MR:**\n\n');
    
    // Only show first file with custom title (ALL files for Monaco)
    if (allFileChanges.length > 0) {
        const firstFile = allFileChanges[0];
        const diffId = `gitlab_${data.id}_${firstFile.path.replace(/[^a-zA-Z0-9]/g, '_')}`;
        
        // Create single button with custom title
        stream.button({
            command: 'aida.viewPrDiff',
            title: `🪟 Open Diff Viewer (${allFileChanges.length} files)`,
            tooltip: `View changes in Monaco Diff Editor - ${allFileChanges.length} files total`,
            arguments: [diffId]
        });
    }

    stream.markdown('\n\n💡 **Click to explore changes in diff viewer**\n\n');
}

/**
 * FUNCTION A - Handle Azure DevOps PR diffs and show in webview  
 * Dedicated function for Azure DevOps diffs - clean separation from GitHub
 * @param {object} prAnalysis - Azure DevOps PR analysis result
 * @param {object} stream - VS Code stream for output
 */
async function showAzureDevOpsDiffInWebview(prAnalysis: Record<string, any>, stream: vscode.ChatResponseStream) {
    aidaLogging('🔵 Azure Function A: Starting Azure DevOps diff webview display');
    
    if (!prAnalysis || !prAnalysis.data || !prAnalysis.data.fileChanges) {
        stream.markdown('❌ **No Azure DevOps diff data available**\n\n');
        return;
    }

    const data = prAnalysis.data;
    
    // Initialize global cache for Azure DevOps diffs
    if (!(global as any).prDiffCache) {
        (global as any).prDiffCache = {};
    }

    // Clear existing cache entries for this Azure DevOps PR to prevent file count discrepancy
    clearPrDiffCache('azure', data.id);

    // 🚀 Get access token using new multi-org helper
    const prUrl = `https://dev.azure.com/${data.organization}/${data.project}/_git/${data.repository}/pullrequest/${data.id}`;
    const accessToken = getTokenForPR(prUrl);
    
    if (!accessToken) {
        aidaLogging(`⚠️ No token configured for Azure DevOps organization: ${data.organization}`);
    }
    
    // Store global Azure DevOps API info for parseFullDiffContentEnhanced
    (global as any).prDiffCache.accessToken = accessToken;
    (global as any).prDiffCache.organization = data.organization;
    (global as any).prDiffCache.project = data.project;
    (global as any).prDiffCache.repository = data.repository;
    (global as any).prDiffCache.sourceCommit = data.sourceCommit;
    (global as any).prDiffCache.targetCommit = data.targetCommit; // This is now merge base
    (global as any).prDiffCache.mergeBaseCommit = data.mergeBaseCommit; // Explicit merge base reference
    
    aidaLogging('🚀 Cached Azure DevOps API credentials for full content retrieval:');
    aidaLogging(`   Organization: ${data.organization}`);
    aidaLogging(`   Project: ${data.project}`);
    aidaLogging(`   Repository: ${data.repository}`);
    aidaLogging(`   Source Commit (PR): ${data.sourceCommit?.substring(0, 7)}`);
    aidaLogging(`   Target Commit (Merge Base): ${data.targetCommit?.substring(0, 7)} - CORRECTED`);
    aidaLogging(`   Merge Base: ${data.mergeBaseCommit?.substring(0, 7)} - for Monaco diff accuracy`);
    aidaLogging(`   Access Token: ${accessToken ? '✅ Available' : '❌ Missing'}`);

    stream.markdown('🔵 **Azure DevOps Diff Webview Display**\n\n');
    
    // Cache all Azure DevOps file changes for webview access (ALL files for Monaco diff view)
    const allFileChanges = data.fileChanges || [];
    allFileChanges.forEach((fileChange: Record<string, string>) => {
        const diffId = `azure_${data.id}_${(fileChange.path ?? '').replace(/[^a-zA-Z0-9]/g, '_')}`;
        
        (global as any).prDiffCache[diffId] = {
            ...fileChange,
            provider: 'azure',
            prId: data.id,
            // Ensure diffContent is available for webview
            diff: fileChange.diffContent || fileChange.diff || '',
            diffContent: fileChange.diffContent || fileChange.diff || '',
            // Add Azure DevOps API info for full content retrieval
            organization: data.organization,
            project: data.project,
            repository: data.repository,
            sourceCommit: data.sourceCommit,
            targetCommit: data.targetCommit,
            mergeBaseCommit: data.mergeBaseCommit,
            accessToken: accessToken,
            // Flag to force full file content fetching
            useFullContent: true
        };
        
        aidaLogging(`📝 Cached Azure DevOps diff: ${diffId} for ${fileChange.path}`);
        aidaLogging(`   📊 Commits: base=${data.targetCommit?.substring(0, 7)}, source=${data.sourceCommit?.substring(0, 7)}`);
    });

    // Display file links with webview buttons (hover for details)
    stream.markdown('📂 **Files in this Azure DevOps PR:**\n\n');
    
    // Only show first file with custom title (ALL files for Monaco)
    if (allFileChanges.length > 0) {
        const firstFile = allFileChanges[0];
        const diffId = `azure_${data.id}_${firstFile.path.replace(/[^a-zA-Z0-9]/g, '_')}`;
        
        // Create single button with custom title
        stream.button({
            command: 'aida.viewPrDiff',
            title: `🪟 Open Diff Viewer (${allFileChanges.length} files)`,
            tooltip: `View changes in Monaco Diff Editor - ${allFileChanges.length} files total`,
            arguments: [diffId]
        });
    }

    stream.markdown('\n\n💡 **Click to explore changes in diff viewer**\n\n');
}

/**
 * Display PR review results - PROVIDER ROUTING
 * Routes to Function A (Azure DevOps) or Function B (GitHub) based on provider
 */
async function displayPrReviewResults(stream: vscode.ChatResponseStream, prAnalysis: Record<string, any>) {
    const data = prAnalysis.data;

    // Detect provider type based on PR data structure
    const isBitbucketPR = data.provider === 'bitbucket'; // Bitbucket carries an explicit marker
    const isGitHubPR = data.owner && data.repository && !data.gitlabHost && !isBitbucketPR; // GitHub has owner/repo but no gitlabHost
    const isGitLabMR = data.owner && data.repository && data.gitlabHost; // GitLab has owner/repo and gitlabHost
    const isAzurePR = data.organization && data.project; // Azure has org/project

    aidaLogging(`🔍 Provider detection: GitHub=${isGitHubPR}, GitLab=${isGitLabMR}, Azure=${isAzurePR}, Bitbucket=${isBitbucketPR}`);

    // Display commits list (common for all providers)
    if (data.commitsList && data.commitsList.length > 0) {
        const commitType = isGitLabMR ? 'MR' : 'PR';
        stream.markdown(`## 📝 Commits in this ${commitType}\n\n`);
        data.commitsList.forEach((commit: Record<string, any>, index: number) => {
            stream.markdown(`${index + 1}. **\`${commit.id}\`** - ${commit.message}\n`);
            stream.markdown(`   👤 *${commit.author}* on ${new Date(commit.date).toLocaleDateString()}\n\n`);
        });
    }

    // Summary of Changes section (common for all providers)
    const fileChanges: Record<string, any>[] = data.fileChanges || [];
    const totalFiles = fileChanges.length;
    const totalAdditions = fileChanges.reduce((sum: number, f: Record<string, number>) => sum + (f.additions ?? 0), 0);
    const totalDeletions = fileChanges.reduce((sum: number, f: Record<string, number>) => sum + (f.deletions ?? 0), 0);

    // Breakdown by change type (normalized across providers), matching the
    // existing convention used in dependency-handlers.ts.
    let added = 0, modified = 0, deleted = 0, renamed = 0;
    for (const f of fileChanges) {
        switch (String(f.changeType ?? '').toLowerCase()) {
            case 'added': case 'add': added++; break;
            case 'removed': case 'deleted': case 'delete': deleted++; break;
            case 'renamed': case 'rename': case 'moved': renamed++; break;
            default: modified++; break;
        }
    }

    stream.markdown('## 📊 Summary of Changes\n\n');
    stream.markdown(`📁 **${totalFiles} file(s)** changed\n`);
    stream.markdown(`🟢 Added: ${added}\n`);
    stream.markdown(`🟡 Modified: ${modified}\n`);
    stream.markdown(`🔴 Deleted: ${deleted}\n`);
    if (renamed > 0) { stream.markdown(`🔵 Renamed: ${renamed}\n`); }
    stream.markdown(`➕ **${totalAdditions} lines** added\n`);
    stream.markdown(`➖ **${totalDeletions} lines** deleted\n\n`);

    // PROVIDER ROUTING: Route to appropriate diff display function
    if (isBitbucketPR) {
        aidaLogging('🪣 Routing to Bitbucket Function D');
        await showBitbucketDiffInWebview(prAnalysis, stream);
    } else if (isGitHubPR) {
        aidaLogging('🐙 Routing to GitHub Function B');
        await showGitHubDiffInWebview(prAnalysis, stream);
    } else if (isGitLabMR) {
        aidaLogging('🦊 Routing to GitLab Function C');
        await showGitLabDiffInWebview(prAnalysis, stream);
    } else if (isAzurePR) {
        aidaLogging('🔵 Routing to Azure DevOps Function A');
        await showAzureDevOpsDiffInWebview(prAnalysis, stream);
    } else {
        // Fallback: assume Azure DevOps for backward compatibility
        aidaLogging('⚠️ Provider unknown, defaulting to Azure DevOps Function A');
        await showAzureDevOpsDiffInWebview(prAnalysis, stream);
    }

    // Provider-specific diff display is handled above by Function A, B, or C
    aidaLogging(`📊 Provider routing complete. ${totalFiles} files processed.`);
}

/**
 * Open PR review results in new document
 */
async function openPrReviewDocument(prAnalysis: Record<string, any>) {
    const data = prAnalysis.data;

    const reviewContent = `# Azure DevOps PR Review Report

## PR Information
- **ID**: ${data.id}
- **Title**: ${data.title}
- **Author**: ${data.author}
- **Status**: ${data.status}
- **Source Commit**: ${data.sourceCommit}
- **Target Commit**: ${data.targetCommit}

## Files Changed
${data.files.map((file: Record<string, any>) => `
### ${file.path}
- Type: ${file.changeType}
- Additions: +${file.additions}
- Deletions: -${file.deletions}
`).join('')}

## Code Analysis
- **Quality**: ${data.analysis.quality}
- **Security**: ${data.analysis.security}
- **Performance**: ${data.analysis.performance}
- **Test Coverage**: ${data.analysis.testCoverage}

## Diff Content
\`\`\`diff
${data.diff}
\`\`\`

---
*Generated by AI Self Check Extension - ${new Date().toLocaleString()}*
`;

    const doc = await vscode.workspace.openTextDocument({
        content: reviewContent,
        language: 'markdown'
    });

    await vscode.window.showTextDocument(doc);
}

// ES exports
export { showGitHubDiffInWebview, showGitLabDiffInWebview, showAzureDevOpsDiffInWebview, displayPrReviewResults, openPrReviewDocument };
