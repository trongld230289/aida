/**
 * @module pr-fetch-azure
 * @description Azure DevOps PR data fetching
 * Extracted from review-pr.js during Phase 4 refactoring.
 */

const vscode = require('vscode');
const https = require('https');
const { getTokenForPR, parsePRUrl, showTokenConfigurationHelp } = require('./review-common');
const { aidaLogging } = require('../core/settings');
const { filterReviewableFiles, generateUnifiedDiff, countDiffLines } = require('./pr-utils');

let Diff;
try { Diff = require('diff'); } catch (e) { Diff = null; }

/**
 * Analyze Pull Request using Azure DevOps API
 */
async function analyzePullRequest(stream, prUrl, organization = null, project = null, repository = null) {
    try {
        // Parse PR URL and auto-detect organization info if full URL provided
        let org = organization;
        let proj = project;
        let repo = repository;
        let prId = null;
        
        if (prUrl.includes('dev.azure.com')) {
            try {
                const parsed = parsePRUrl(prUrl);
                org = parsed.organization;
                proj = parsed.project;
                repo = parsed.repository;
                prId = parsed.prId;
                aidaLogging(`✅ Auto-detected from URL: org=${org}, project=${proj}, repo=${repo}, PR=${prId}`);
                stream.markdown(`🔍 **Auto-detected**: ${org}/${proj}/${repo}/PR#${prId}\n\n`);
            } catch (parseError) {
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

        } catch (apiError) {
            // Return error instead of mock data
            aidaLogging('❌ Azure DevOps API failed:', apiError.message);
            stream.markdown('❌ **Azure DevOps API Error**\n\n');
            stream.markdown(`Error: ${apiError.message}\n\n`);
            return { error: `Azure DevOps API failed: ${apiError.message}` };
        }

    } catch (error) {
        return { error: `Analysis failed: ${error.message}` };
    }
}

/**
 * Get Pull Request data from Azure DevOps REST API
 */
async function getAzureDevOpsPR(organization, project, repository, prId, token) {
    try {
        aidaLogging(`Fetching PR ${prId} from ${organization}/${project}/${repository}`);

        // Get PR details
        const prUrl = `https://dev.azure.com/${organization}/${project}/_apis/git/repositories/${repository}/pullRequests/${prId}?api-version=7.0`;
        const prResponse = await makeAzureDevOpsRequest(prUrl, token);

        if (!prResponse.success) {
            aidaLogging('Failed to get PR details:', prResponse.error);
            throw new Error(`Failed to get PR details: ${prResponse.error}`);
        }

        const pr = prResponse.data;
        
        // Extract branch information
        const sourceBranch = pr.sourceRefName?.replace('refs/heads/', '') || 'Unknown';
        const targetBranch = pr.targetRefName?.replace('refs/heads/', '') || 'Unknown';
        aidaLogging(`🌿 Branch info: ${sourceBranch} → ${targetBranch}`);

        let commits = [];
        let fileChanges = [];
        let finalDiff = '';
        let diffSource = 'PR-specific changes only';
        // mergeBaseCommit now declared at function scope above

        aidaLogging('🔍 Getting PR-specific changes from source commit...');

        // STEP 1: Get ALL commits in this PR
        aidaLogging('📝 Getting all commits from PR...');
        const commitsUrl = `https://dev.azure.com/${organization}/${project}/_apis/git/repositories/${repository}/pullRequests/${prId}/commits?api-version=7.0&$top=1000`;
        const commitsResponse = await makeAzureDevOpsRequest(commitsUrl, token);

        if (commitsResponse.success && commitsResponse.data.value?.length > 0) {
            commits = commitsResponse.data.value;
            aidaLogging(`✅ Found ${commits.length} commits in PR`);
            commits.forEach((commit, index) => {
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

                if (commitResponse.success && commitResponse.data) {
                    const commit = commitResponse.data;
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
        let reviewableFileChanges = [];
        let mergeBaseCommit = null;
        aidaLogging('🐛 DEBUG: Variables initialized at function scope - allFileChanges.length:', allFileChanges.length);

        if (iterationsResponse.success && iterationsResponse.data.value?.length > 0) {
            const iterations = iterationsResponse.data.value;
            const latestIteration = iterations[iterations.length - 1];

            aidaLogging(`✅ Found ${iterations.length} iterations, using latest: ${latestIteration.id}`);

            // STEP 3: Get file changes from the latest iteration (this gives us actual PR changes)
            const changesUrl = `https://dev.azure.com/${organization}/${project}/_apis/git/repositories/${repository}/pullRequests/${prId}/iterations/${latestIteration.id}/changes?api-version=7.0&$top=1000`;
            const changesResponse = await makeAzureDevOpsRequest(changesUrl, token);

            if (changesResponse.success && changesResponse.data.changeEntries) {
                // First: Get ALL actual files (for diff view Monaco - shows complete changes)
                const allActualFiles = changesResponse.data.changeEntries.filter(change => {
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
                const reviewableFiles = filterReviewableFiles(allActualFiles, 'Azure DevOps');

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
                    
                    if (mergeBaseResponse.success && mergeBaseResponse.data.value && mergeBaseResponse.data.value.length > 0) {
                        baseCommit = mergeBaseResponse.data.value[0].commitId;
                        mergeBaseCommit = baseCommit; // Store for Monaco diff view
                        aidaLogging(`✅ Found merge base (branch point): ${baseCommit.substring(0, 7)}`);
                        aidaLogging(`📊 This will show ONLY changes made in the feature branch, not full target branch diff`);
                    } else {
                        aidaLogging(`⚠️ Could not find merge base, falling back to target commit`);
                        baseCommit = targetCommit;
                        mergeBaseCommit = targetCommit; // Fallback to target commit
                    }
                } catch (error) {
                    aidaLogging(`❌ Error finding merge base: ${error.message}, using target commit`);
                    baseCommit = targetCommit;
                    mergeBaseCommit = targetCommit; // Fallback to target commit
                }

                // Process ALL files for diff view (Monaco needs complete file list)
                allFileChanges = await Promise.all(allActualFiles.map(async (change) => {
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
                        } catch (err) {
                            aidaLogging(`❌ Error processing ${filePath}: ${err.message}`);
                            diffContent = `diff --git a/${filePath} b/${filePath}\n[Error: ${err.message}]`;
                        }
                    } else {
                        aidaLogging(`⚠️ Missing commit information for ${filePath}`);
                        diffContent = `diff --git a/${filePath} b/${filePath}\n[Missing commit information]`;
                    }

                    // For new files (add/new), store full content for detailed review (like review-file.js)
                    const fileObj = {
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
                reviewableFileChanges = filterReviewableFiles(allFileChanges, 'Azure DevOps');

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
                commitsList: commits?.map(commit => ({
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
                        `➕ ${allFileChanges.reduce((sum, f) => sum + f.additions, 0)} lines added`,
                        `➖ ${allFileChanges.reduce((sum, f) => sum + f.deletions, 0)} lines removed`,
                        `🔍 Source: ${diffSource}`,
                        `📝 Total commits: ${commits?.length || 0}`
                    ]
                }
            }
        };
    } catch (error) {
        aidaLogging('Error in getAzureDevOpsPR:', error);
        throw new Error(`Unable to fetch PR data: ${error.message}`);
    }
}

/**
 * Make HTTP request to Azure DevOps REST API
 */
async function makeAzureDevOpsRequest(url, token, method = 'GET', body = null) {
    return new Promise((resolve) => {
        const urlObj = new URL(url);
        const options = {
            hostname: urlObj.hostname,
            port: 443,
            path: urlObj.pathname + urlObj.search,
            method: method,
            rejectUnauthorized: false, // Fix SSL certificate issues in corporate environments
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'VS Code AI Self Check Extension'
            }
        };

        // Add authentication if token is provided
        if (token && token.trim()) {
            options.headers['Authorization'] = `Basic ${Buffer.from(':' + token).toString('base64')}`;
        }

        const req = https.request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        const parsed = JSON.parse(data);
                        resolve({ success: true, data: parsed });
                    } else {
                        // Return concise error messages for common HTTP errors
                        let errorMsg = `HTTP ${res.statusCode}`;
                        if (res.statusCode === 401) {
                            errorMsg = 'HTTP 401 Unauthorized - Personal Access Token (PAT) is expired or invalid. Please create a new PAT at Azure DevOps > User Settings > Personal Access Tokens.';
                        } else if (res.statusCode === 403) {
                            errorMsg = 'HTTP 403 Forbidden - Access denied. Check your PAT permissions (need Code > Read scope).';
                        } else if (res.statusCode === 404) {
                            errorMsg = 'HTTP 404 Not Found - PR, repository, or project not found. Check the URL.';
                        } else {
                            // Try to extract a short message, avoid dumping raw HTML
                            try {
                                const errorData = JSON.parse(data);
                                errorMsg += `: ${errorData.message || errorData.typeKey || 'Unknown error'}`;
                            } catch {
                                // data is likely HTML - don't dump it
                                const statusText = res.statusMessage || 'Error';
                                errorMsg += `: ${statusText}`;
                            }
                        }
                        resolve({ success: false, error: errorMsg });
                    }
                } catch (parseError) {
                    resolve({ success: false, error: `JSON parse error: ${parseError.message}` });
                }
            });
        });

        req.on('error', (error) => {
            resolve({ success: false, error: error.message });
        });

        // Set timeout for API calls
        req.setTimeout(10000, () => {
            req.destroy();
            resolve({ success: false, error: 'Request timeout' });
        });

        if (body) {
            req.write(JSON.stringify(body));
        }

        req.end();
    });
}

/**
 * Get file content from a specific commit using download endpoint
 */
async function getFileContent(organization, project, repository, filePath, commitId, token) {
    try {
        aidaLogging(`🔄 Fetching content for ${filePath} at commit ${commitId.substring(0, 7)}`);

        // Use download parameter to get actual content as text
        const itemUrl = `https://dev.azure.com/${organization}/${project}/_apis/git/repositories/${repository}/items?path=${encodeURIComponent(filePath)}&versionDescriptor.version=${commitId}&versionDescriptor.versionType=commit&download=true&api-version=7.0`;

        // Make request expecting text response
        const response = await new Promise((resolve) => {
            const authToken = Buffer.from(':' + token).toString('base64');
            const url = new URL(itemUrl);

            const options = {
                hostname: url.hostname,
                path: url.pathname + url.search,
                method: 'GET',
                rejectUnauthorized: false, // Fix SSL certificate issues in corporate environments
                headers: {
                    'Authorization': `Basic ${authToken}`,
                    'Accept': 'text/plain',
                    'User-Agent': 'VSCode-Extension'
                }
            };

            const req = https.request(options, (res) => {
                let data = '';

                res.on('data', (chunk) => {
                    data += chunk.toString();
                });

                res.on('end', () => {
                    if (res.statusCode === 200) {
                        resolve({ success: true, data: data });
                    } else {
                        aidaLogging(`⚠️ Download failed: ${res.statusCode} ${res.statusMessage}`);
                        resolve({ success: false, error: `HTTP ${res.statusCode}` });
                    }
                });
            });

            req.on('error', (error) => {
                resolve({ success: false, error: error.message });
            });

            req.setTimeout(10000, () => {
                req.destroy();
                resolve({ success: false, error: 'Timeout' });
            });

            req.end();
        });

        if (response.success && response.data) {
            aidaLogging(`✅ Got file content: ${response.data.length} chars`);
            
            // Debug indentation in API response
            const lines = response.data.split('\n');
            aidaLogging(`📊 DEBUG API CONTENT - Total lines: ${lines.length}`);
            aidaLogging(`📊 First 5 lines analysis:`);
            for (let i = 0; i < Math.min(5, lines.length); i++) {
                const line = lines[i];
                const leadingSpaces = line.match(/^ */)[0].length;
                const leadingTabs = line.match(/^\t*/)[0].length;
                aidaLogging(`📊 Line ${i + 1}: spaces=${leadingSpaces}, tabs=${leadingTabs}, content="${line.substring(0, 50)}"`);
            }
            
            return response.data;
        }

        aidaLogging(`❌ Could not fetch content: ${response.error || 'unknown'}`);
        return null;
    } catch (error) {
        aidaLogging(`❌ Error fetching content for ${filePath}: ${error.message}`);
        return null;
    }
}

module.exports = {
    analyzePullRequest,
    getAzureDevOpsPR,
    makeAzureDevOpsRequest,
    getFileContent,
};
