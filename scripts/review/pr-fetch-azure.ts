/**
 * @module pr-fetch-azure
 * @description Azure DevOps PR data fetching
 * Extracted from review-pr.js during Phase 4 refactoring.
 */

import * as _vscode from 'vscode';
import { getTokenForPR, parsePRUrl, showTokenConfigurationHelp } from './review-common';
import { aidaLogging } from '../core/settings';
import { DEFAULTS } from '../core/aida-config';
import { filterReviewableFiles, generateUnifiedDiff, countDiffLines } from './pr-utils';
import { toError } from '../core/error-utils';
import { makeHttpsRequest, azureAuthHeader, AZURE_ERROR_MESSAGES, type IHttpsResponse } from './pr-fetch-base';

/**
 * Analyze Pull Request using Azure DevOps API
 */
async function analyzePullRequest(stream: _vscode.ChatResponseStream, prUrl: string, organization: string | null = null, project: string | null = null, repository: string | null = null): Promise<unknown> {
    try {
        // Parse PR URL and auto-detect organization info if full URL provided
        let org = organization;
        let proj = project;
        let repo = repository;
        let prId = null;
        
        if (prUrl.includes('dev.azure.com')) {
            try {
                const parsed = parsePRUrl(prUrl);
                org = parsed.organization ?? null;
                proj = parsed.project ?? null;
                repo = parsed.repository ?? null;
                prId = parsed.prId;
                aidaLogging(`✅ Auto-detected from URL: org=${org}, project=${proj}, repo=${repo}, PR=${prId}`);
                stream.markdown(`🔍 **Auto-detected**: ${org}/${proj}/${repo}/PR#${prId}\n\n`);
            } catch (_parseError: unknown) {
                aidaLogging('⚠️ Failed to parse URL, using provided values');
                prId = prUrl; // Assume it's just a PR ID
            }
        } else {
            prId = prUrl; // Assume it's just a PR ID
        }
        
        // Validate required parameters
        if (!org || !proj || !repo || !prId) {
            return { error: `Missing required parameters: org=${org}, project=${proj}, repo=${repo}, prId=${prId}` };
        }
        
        if (!organization && !project && !repository) {
            aidaLogging(`⚠️ Using defaults: org=${org}, project=${proj}, repo=${repo}`);
            stream.markdown(`⚠️ **Using defaults**: ${org}/${proj}/${repo} (provide full URL for auto-detection)\n\n`);
        }

        // Get token using new multi-org helper
        const fullPrUrl = `https://dev.azure.com/${org}/${proj}/_git/${repo}/pullrequest/${prId}`;
        aidaLogging(`🔍 Checking token for Azure DevOps URL: ${fullPrUrl}`);
        const personalAccessToken = getTokenForPR(fullPrUrl);
        aidaLogging(`🔍 Token found: ${personalAccessToken ? 'YES' : 'NO'}`);

        if (!personalAccessToken) {
            aidaLogging(`❌ No token found for Azure DevOps org: ${org}`);
            // Show configuration help using new helper
            showTokenConfigurationHelp('azureDevOps', org, stream);
            return { error: `Azure DevOps Personal Access Token is required for organization: ${org}` };
        }

        try {
            // Call Azure DevOps REST API with token
            aidaLogging(`🔄 Calling Azure DevOps API for PR ${prId}...`);
            const prData = await getAzureDevOpsPR(org, proj, repo, prId, personalAccessToken);
            aidaLogging('✅ Azure DevOps API call successful:', prData);
            return prData;

        } catch (_apiError: unknown) {
            const apiError = toError(_apiError);
            // Return error instead of mock data
            aidaLogging('❌ Azure DevOps API failed:', apiError.message);
            stream.markdown('❌ **Azure DevOps API Error**\n\n');
            stream.markdown(`Error: ${apiError.message}\n\n`);
            return { error: `Azure DevOps API failed: ${apiError.message}` };
        }

    } catch (_error: unknown) {
        const error = toError(_error);
        return { error: `Analysis failed: ${error.message}` };
    }
}

/**
 * Get Pull Request data from Azure DevOps REST API
 */
async function getAzureDevOpsPR(organization: string, project: string, repository: string, prId: string | number, token: string) {
    try {
        aidaLogging(`Fetching PR ${prId} from ${organization}/${project}/${repository}`);

        // Get PR details
        const prUrl = `https://dev.azure.com/${organization}/${project}/_apis/git/repositories/${repository}/pullRequests/${prId}?api-version=7.0`;
        const prResponse = await makeAzureDevOpsRequest(prUrl, token);

        if (!(prResponse as any).success) {
            aidaLogging('Failed to get PR details:', (prResponse as any).error);
            throw new Error(`Failed to get PR details: ${(prResponse as any).error}`);
        }

        const pr = (prResponse as any).data;
        
        // Extract branch information
        const sourceBranch = pr.sourceRefName?.replace('refs/heads/', '') || 'Unknown';
        const targetBranch = pr.targetRefName?.replace('refs/heads/', '') || 'Unknown';
        aidaLogging(`🌿 Branch info: ${sourceBranch} → ${targetBranch}`);

        let commits = [];
        const finalDiff = '';
        const diffSource = 'PR-specific changes only';
        // mergeBaseCommit now declared at function scope above

        aidaLogging('🔍 Getting PR-specific changes from source commit...');

        // STEP 1: Get ALL commits in this PR
        aidaLogging('📝 Getting all commits from PR...');
        const commitsUrl = `https://dev.azure.com/${organization}/${project}/_apis/git/repositories/${repository}/pullRequests/${prId}/commits?api-version=7.0&$top=1000`;
        const commitsResponse = await makeAzureDevOpsRequest(commitsUrl, token);

        if ((commitsResponse as any).success && (commitsResponse as any).data.value?.length > 0) {
            commits = (commitsResponse as any).data.value;
            aidaLogging(`✅ Found ${commits.length} commits in PR`);
            commits.forEach((commit: Record<string, any>, index: number) => {
                aidaLogging(`  ${index + 1}. ${commit.commitId.substring(0, 7)} - ${commit.comment || 'No message'}`);
            });
        } else {
            aidaLogging('⚠️ No commits found, trying single source commit...');
            // Fallback to single commit if API fails
            if (pr.lastMergeSourceCommit) {
                const sourceCommitId = pr.lastMergeSourceCommit.commitId;
                aidaLogging(`📝 PR source commit: ${sourceCommitId.substring(0, 7)}`);

                // Get detailed info about this specific commit
                const commitUrl = `https://dev.azure.com/${organization}/${project}/_apis/git/repositories/${repository}/commits/${sourceCommitId}?api-version=7.0`;
                const commitResponse = await makeAzureDevOpsRequest(commitUrl, token);

                if ((commitResponse as any).success && (commitResponse as any).data) {
                    const commit = (commitResponse as any).data;
                    commits = [{
                        commitId: commit.commitId,
                        comment: commit.comment || 'No message',
                        author: {
                            name: commit.author?.name || 'Unknown',
                            date: commit.author?.date || new Date().toISOString()
                        }
                    }];
                    aidaLogging(`✅ Found PR source commit: ${commit.commitId.substring(0, 7)} - ${commit.comment}`);
                }
            }
        }

        // STEP 2: Get PR iterations to find the latest iteration (this contains actual PR changes)
        const iterationsUrl = `https://dev.azure.com/${organization}/${project}/_apis/git/repositories/${repository}/pullRequests/${prId}/iterations?api-version=7.0`;
        const iterationsResponse = await makeAzureDevOpsRequest(iterationsUrl, token);

        // Initialize variables at FUNCTION scope (not block scope)
        aidaLogging('🐛 DEBUG: Initializing allFileChanges and reviewableFileChanges at FUNCTION scope...');
        let allFileChanges = [];
        let reviewableFileChanges: Record<string, any>[] = [];
        let mergeBaseCommit = null;
        aidaLogging('🐛 DEBUG: Variables initialized at function scope - allFileChanges.length:', allFileChanges.length);

        if ((iterationsResponse as any).success && (iterationsResponse as any).data.value?.length > 0) {
            const iterations = (iterationsResponse as any).data.value;
            const latestIteration = iterations[iterations.length - 1];

            aidaLogging(`✅ Found ${iterations.length} iterations, using latest: ${latestIteration.id}`);

            // STEP 3: Get file changes from the latest iteration (this gives us actual PR changes)
            const changesUrl = `https://dev.azure.com/${organization}/${project}/_apis/git/repositories/${repository}/pullRequests/${prId}/iterations/${latestIteration.id}/changes?api-version=7.0&$top=1000`;
            const changesResponse = await makeAzureDevOpsRequest(changesUrl, token);

            if ((changesResponse as any).success && (changesResponse as any).data.changeEntries) {
                // First: Get ALL actual files (for diff view Monaco - shows complete changes)
                const allActualFiles = (changesResponse as any).data.changeEntries.filter((change: Record<string, any>) => {
                    const filePath = change.item?.path || change.originalPath || '';
                    const isFile = filePath &&
                        filePath.includes('.') &&
                        !filePath.endsWith('/') &&
                        filePath.split('/').pop().includes('.') &&
                        !filePath.includes('/.git/');

                    if (isFile) {
                        aidaLogging(`📄 All files: ${filePath} (${change.changeType})`);
                    }
                    return isFile;
                });

                // Second: Filter out auto-generated files (for AI review content) using shared function

                // Process ALL files for diff view (Monaco needs complete file list) 
                aidaLogging('🔄 Finding merge base (branch point) for accurate diff...');

                // Get source and target commits from PR
                const sourceCommit = pr.lastMergeSourceCommit?.commitId;
                const targetCommit = pr.lastMergeTargetCommit?.commitId;
                
                if (!sourceCommit || !targetCommit) {
                    throw new Error('Missing source or target commit information in PR data');
                }
                
                aidaLogging(`🎯 Source commit (PR): ${sourceCommit.substring(0, 7)}`);
                aidaLogging(`🎯 Target commit (${targetBranch}): ${targetCommit.substring(0, 7)}`);
                
                // Find merge base (the common ancestor commit where the branch diverged)
                let baseCommit;
                try {
                    const mergeBaseUrl = `https://dev.azure.com/${organization}/${project}/_apis/git/repositories/${repository}/commits/${sourceCommit}/mergebases?otherCommitId=${targetCommit}&api-version=7.0`;
                    const mergeBaseResponse = await makeAzureDevOpsRequest(mergeBaseUrl, token);
                    
                    if ((mergeBaseResponse as any).success && (mergeBaseResponse as any).data.value && (mergeBaseResponse as any).data.value.length > 0) {
                        baseCommit = (mergeBaseResponse as any).data.value[0].commitId;
                        mergeBaseCommit = baseCommit; // Store for Monaco diff view
                        aidaLogging(`✅ Found merge base (branch point): ${baseCommit.substring(0, 7)}`);
                        aidaLogging(`📊 This will show ONLY changes made in the feature branch, not full target branch diff`);
                    } else {
                        aidaLogging(`⚠️ Could not find merge base, falling back to target commit`);
                        baseCommit = targetCommit;
                        mergeBaseCommit = targetCommit; // Fallback to target commit
                    }
                } catch (_error: unknown) {
                    const error = toError(_error);
                    aidaLogging(`❌ Error finding merge base: ${error.message}, using target commit`);
                    baseCommit = targetCommit;
                    mergeBaseCommit = targetCommit; // Fallback to target commit
                }

                // Process ALL files for diff view (Monaco needs complete file list)
                allFileChanges = await Promise.all(allActualFiles.map(async (change: Record<string, any>) => {
                    const filePath = change.item?.path || change.originalPath || 'Unknown';
                    aidaLogging(`📁 Processing file: ${filePath} (${change.changeType})`);
                    
                    // 🔥 FIX: Detect rename when Azure reports 'edit' but paths differ
                    let effectiveChangeType = change.changeType?.toLowerCase() || 'edit';
                    if (change.originalPath && change.item?.path && change.originalPath !== change.item.path) {
                        effectiveChangeType = 'rename';
                        aidaLogging(`🔄 Detected rename: ${change.originalPath} -> ${change.item.path}`);
                    }

                    aidaLogging(`📁 Processing file: ${filePath} (${effectiveChangeType})`);

                    let diffContent = '';
                    let additions = 0;
                    let deletions = 0;
                    let fileSourceContent = null; // Declare outside try block for new files
                    let fileBaseContent = null; // Store base content for Monaco

                    if (baseCommit && sourceCommit) {
                        try {
                            aidaLogging(`🔍 Comparing commits for ${filePath} (CORRECTED LOGIC):`);
                            aidaLogging(`  📍 Base commit (merge base): ${baseCommit.substring(0, 7)} - branch point where ${targetBranch} and feature branch diverged`);
                            aidaLogging(`  📍 Source commit (PR): ${sourceCommit.substring(0, 7)} - latest commit in feature branch`);
                            aidaLogging(`  💡 This shows ONLY changes made in feature branch, not full diff vs current ${targetBranch}`);

                            // FIX: Use correct paths for rename
                            const basePath = (effectiveChangeType === 'rename' && change.originalPath) ? change.originalPath : filePath;
                            const sourcePath = filePath;
                            
                            // Get file content from both commits
                            const baseContent = await getFileContent(organization, project, repository, basePath, baseCommit, token);
                            const sourceContent = await getFileContent(organization, project, repository, sourcePath, sourceCommit, token);
                            
                            // Store for Monaco diff viewer
                            fileBaseContent = baseContent;
                            fileSourceContent = sourceContent;
                            
                            // Store source content for new files
                            fileSourceContent = sourceContent;

                            aidaLogging(`📊 Content retrieved:`);
                            aidaLogging(`  Base content (merge base): ${baseContent ? baseContent.length + ' chars' : 'NULL'}`);
                            aidaLogging(`  Source content (PR): ${sourceContent ? sourceContent.length + ' chars' : 'NULL'}`);

                            if (baseContent !== null || sourceContent !== null) {
                                // Generate unified diff using diff library
                                aidaLogging(`🎯 Calling generateUnifiedDiff for ${filePath} with CORRECTED commits...`);
                                diffContent = generateUnifiedDiff(filePath, baseContent || '', sourceContent || '', effectiveChangeType);

                                // Count changes using our counting function
                                const counts = countDiffLines(diffContent);
                                additions = counts.additions;
                                deletions = counts.deletions;

                                aidaLogging(`✅ Generated diff for ${filePath}: +${additions}/-${deletions} (using merge base)`);
                            } else {
                                aidaLogging(`⚠️ Could not fetch content for ${filePath}`);
                                diffContent = `diff --git a/${filePath} b/${filePath}\n[Could not retrieve file content]`;
                            }
                        } catch (_err: unknown) {
                            const err = toError(_err);
                            aidaLogging(`❌ Error processing ${filePath}: ${err.message}`);
                            diffContent = `diff --git a/${filePath} b/${filePath}\n[Error: ${err.message}]`;
                        }
                    } else {
                        aidaLogging(`⚠️ Missing commit information for ${filePath}`);
                        diffContent = `diff --git a/${filePath} b/${filePath}\n[Missing commit information]`;
                    }

                    // For new files (add/new), store full content for detailed review (like review-file.js)
                    const fileObj: Record<string, any> = {
                        path: filePath,
                        changeType: effectiveChangeType,
                        previousFilename: change.originalPath,
                        sourceCommit: baseCommit?.substring(0, 7) || 'target',
                        targetCommit: sourceCommit?.substring(0, 7) || 'source',
                        additions: additions,
                        deletions: deletions,
                        diffContent: diffContent,
                        // Store FULL file content for Monaco diff viewer
                        fullBaseContent: fileBaseContent || '',
                        fullSourceContent: fileSourceContent || ''
                    };
                    
                    // Store full content for new files (needed for typescript code block injection)
                    const changeTypeLower = (change.changeType || '').toLowerCase();
                    const isAddType = (changeTypeLower === 'add' || changeTypeLower === 'added' || changeTypeLower === 'new');
                    
                    aidaLogging(`🔍 [DEBUG] File ${filePath}:`);
                    aidaLogging(`   - changeType="${change.changeType}" (lowercase="${changeTypeLower}")`);
                    aidaLogging(`   - isAddType=${isAddType}`);
                    aidaLogging(`   - fileSourceContent=${fileSourceContent ? fileSourceContent.length + ' chars' : 'NULL'}`);
                    aidaLogging(`   - Will store fullContent? ${isAddType && fileSourceContent ? 'YES ✅' : 'NO ❌'}`);
                    
                    if (isAddType && fileSourceContent) {
                        fileObj.fullContent = fileSourceContent;
                        aidaLogging(`💾 ✅ STORED fullContent for new file ${filePath}: ${fileSourceContent.length} chars`);
                    } else {
                        aidaLogging(`⚠️ NOT storing fullContent for ${filePath}: isAddType=${isAddType}, hasContent=${!!fileSourceContent}`);
                    }
                    
                    return fileObj;
                }));

                // Filter reviewable files from processed results using shared function
                reviewableFileChanges = filterReviewableFiles(allFileChanges, 'Azure DevOps') as Record<string, any>[];

                aidaLogging(`✅ Processed ${allFileChanges.length} total files, ${reviewableFileChanges.length} for review content`);
            } else {
                aidaLogging('⚠️ No file changes found in PR iteration');
            }

        } else {
            aidaLogging('⚠️ No iterations found for PR');
        }

        return {
            success: true,
            data: {
                id: prId,
                title: pr.title || `PR #${prId}`,
                description: pr.description || 'No description provided',
                author: pr.createdBy?.displayName || 'Unknown',
                status: pr.status || 'Active',
                organization: organization,
                project: project,
                repository: repository,
                sourceBranch: sourceBranch,
                targetBranch: targetBranch,
                sourceCommit: pr.lastMergeSourceCommit?.commitId,
                targetCommit: mergeBaseCommit || pr.lastMergeTargetCommit?.commitId, // Use merge base for correct Monaco diff
                mergeBaseCommit: mergeBaseCommit, // Store merge base explicitly for reference
                diffCommand: diffSource,
                fileChanges: allFileChanges, // ALL files for diff view Monaco
                reviewableFileChanges: reviewableFileChanges, // Filtered files for AI review content
                // Include commits and final diff info (PR-specific only)
                commits: commits || [],
                totalCommits: commits?.length || 0,
                finalDiff: finalDiff,
                commitsList: commits?.map((commit: Record<string, any>) => ({
                    id: commit.commitId.substring(0, 7),
                    fullId: commit.commitId,
                    message: commit.comment || 'No message',
                    author: commit.author?.name || 'Unknown',
                    date: commit.author?.date || new Date().toISOString()
                })) || [],
                analysis: {
                    quality: `Azure DevOps PR with ${allFileChanges.length} file(s) changed (${reviewableFileChanges.length} for review) across ${commits?.length || 0} commits`,
                    security: 'Complete PR diff analysis',
                    performance: 'Full PR data processing',
                    testCoverage: 'Review test coverage for modified files',
                    codeReview: [
                        `📁 ${allFileChanges.length} file(s) modified (${reviewableFileChanges.length} reviewable)`,
                        `➕ ${allFileChanges.reduce((sum: number, f: Record<string, number>) => sum + (f.additions ?? 0), 0)} lines added`,
                        `➖ ${allFileChanges.reduce((sum: number, f: Record<string, number>) => sum + (f.deletions ?? 0), 0)} lines removed`,
                        `🔍 Source: ${diffSource}`,
                        `📝 Total commits: ${commits?.length || 0}`
                    ]
                }
            }
        };
    } catch (_error: unknown) {
        const error = toError(_error);
        aidaLogging('Error in getAzureDevOpsPR:', error);
        throw new Error(`Unable to fetch PR data: ${error.message}`);
    }
}

/**
 * Make HTTP request to Azure DevOps REST API
 * Delegates to shared makeHttpsRequest with Azure-specific auth & error messages.
 */
async function makeAzureDevOpsRequest(url: string, token: string, method = 'GET', body: Record<string, unknown> | null = null): Promise<IHttpsResponse<Record<string, any>>> {
    return makeHttpsRequest<Record<string, any>>({
        url,
        method,
        token,
        authHeaderFn: azureAuthHeader,
        defaultHeaders: { 'Content-Type': 'application/json' },
        body,
        timeoutMs: DEFAULTS.AZURE_API_TIMEOUT_MS,
        errorMessages: AZURE_ERROR_MESSAGES,
    });
}

/**
 * Get file content from a specific commit using download endpoint
 */
async function getFileContent(organization: string, project: string, repository: string, filePath: string, commitId: string, token: string) {
    try {
        aidaLogging(`🔄 Fetching content for ${filePath} at commit ${commitId.substring(0, 7)}`);

        // Use download parameter to get actual content as text
        const itemUrl = `https://dev.azure.com/${organization}/${project}/_apis/git/repositories/${repository}/items?path=${encodeURIComponent(filePath)}&versionDescriptor.version=${commitId}&versionDescriptor.versionType=commit&download=true&api-version=7.0`;

        const response = await makeHttpsRequest<string>({
            url: itemUrl,
            token,
            authHeaderFn: azureAuthHeader,
            defaultHeaders: { Accept: 'text/plain' },
            timeoutMs: DEFAULTS.AZURE_API_TIMEOUT_MS,
            isTextResponse: () => true,
        });

        if (response.success && response.data) {
            aidaLogging(`\u2705 Got file content: ${response.data.length} chars`);
            
            // Debug indentation in API response
            const lines = response.data.split('\n');
            aidaLogging(`\uD83D\uDCCA DEBUG API CONTENT - Total lines: ${lines.length}`);
            aidaLogging(`\uD83D\uDCCA First 5 lines analysis:`);
            for (let i = 0; i < Math.min(5, lines.length); i++) {
                const line = lines[i]!;
                const leadingSpaces = (line.match(/^ */) ?? [''])[0].length;
                const leadingTabs = (line.match(/^\t*/) ?? [''])[0].length;
                aidaLogging(`\uD83D\uDCCA Line ${i + 1}: spaces=${leadingSpaces}, tabs=${leadingTabs}, content="${line.substring(0, 50)}"`)
            }
            
            return response.data;
        }

        aidaLogging(`\u274C Could not fetch content: ${response.error || 'unknown'}`);
        return null;
    } catch (_error: unknown) {
        const error = toError(_error);
        aidaLogging(`❌ Error fetching content for ${filePath}: ${error.message}`);
        return null;
    }
}

// ES exports
export { analyzePullRequest, getAzureDevOpsPR, makeAzureDevOpsRequest, getFileContent };
