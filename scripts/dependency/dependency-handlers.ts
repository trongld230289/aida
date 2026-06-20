import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

import { aidaLogging } from '../core/settings';
import { toError } from '../core/error-utils';
import { checkEnvironmentCapabilities } from '../core/capability-check';
import { VSCodeApiDependencyAnalyzer } from './graph/vscode-api-analyzer';
import { PRFileFetcher } from '../review/pr-file-fetcher';
import { PRDependencyAnalyzer } from './pr-dependency-analyzer';
import { FileDependencyAnalyzer } from './file-dependency-analyzer';
import { DependencyGraphService } from './dependency-graph-service';

// Import from sibling sub-modules
import { saveToCache, loadFromCache } from './dependency-cache-service';
import { createWebviewFromData, createPRGraphWebview, createFileGraphWebview } from './dependency-graph-webview';

// Module-level state
let skipCapabilityCheck = false;
let globalGraphService: DependencyGraphService | null = null;

/**
 * Auto-activate dependency watcher if cache exists
 * @param {vscode.ExtensionContext} context
 */
async function activateDependencyWatcherIfCacheExists(_context: vscode.ExtensionContext) {
    try {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath;
        if (!workspaceRoot) return;

        const cachePath = path.join(workspaceRoot, '.vscode', 'dependency-cache.json');

        if (fs.existsSync(cachePath)) {
            aidaLogging('\u{1F680} Found dependency cache, auto-activating watcher...');

            if (!globalGraphService) {
                globalGraphService = new DependencyGraphService(workspaceRoot);
            }

            // This will load cache and start watcher
            await globalGraphService.ensureFullGraph();
            aidaLogging('\u2705 Dependency watcher activated from cache');
        }
    } catch (error: unknown) {
        aidaLogging('\u274C Failed to auto-activate dependency watcher:', error);
    }
}

/**
 * Check environment capabilities and report issues to stream
 * @returns {Promise<boolean>} - Returns true if analysis should be aborted (missing capabilities)
 */
async function handleEnvironmentCheck(stream: vscode.ChatResponseStream, workspaceRoot: string) {
    // If skip flag is set, reset it and proceed without check
    if (skipCapabilityCheck) {
        skipCapabilityCheck = false;
        return false;
    }

    const missingCapabilities = await checkEnvironmentCapabilities(workspaceRoot);

    if (missingCapabilities.length > 0) {
        stream.markdown('### \u26A0\uFE0F Environment Check Required\n\n');
        stream.markdown('Dependency analysis relies on the **Language Server Protocol (LSP)** to accurately resolve symbols and imports. Please install the following extensions to enable this capability:\n\n');

        for (const missing of missingCapabilities) {
            for (const ext of missing.recommendedExtensions) {
                stream.markdown(`> ### \u{1F4E6} ${ext.name}\n`);
                stream.markdown(`> ${missing.message}\n\n`);

                stream.button({
                    command: 'workbench.extensions.installExtension',
                    title: `Install ${ext.name}`,
                    arguments: [ext.id]
                });

                stream.markdown('\n\n');
            }
        }

        stream.markdown('---\n\n');

        stream.markdown('**Or proceed with limited accuracy:**\n\n');
        stream.button({
            command: 'aida.analyzeDependencies',
            title: '\u26A0\uFE0F Continue Anyway',
            arguments: [workspaceRoot, true]
        });
        stream.markdown('\n\n');

        return true; // Abort
    }

    return false; // Continue
}

/**
 * Register cache-related commands
 */
function registerCacheCommands(context: vscode.ExtensionContext) {
    // Command to load from cache
    const loadCacheCommand = vscode.commands.registerCommand('aida.loadDependencyCache', async (_workspaceRoot) => {
        try {
            const cachedData = await loadFromCache();
            if (cachedData) {
                await createWebviewFromData(cachedData.graph, cachedData.report, 'Cache');
                vscode.window.showInformationMessage('\u2705 Dependency graph loaded from cache!');
            } else {
                vscode.window.showErrorMessage('\u274C Failed to load cache data');
            }
        } catch (_error: unknown) {
            const error = toError(_error);
            aidaLogging('\u274C Error loading cache:', error);
            vscode.window.showErrorMessage(`\u274C Cache load failed: ${error.message}`);
        }
    });

    // Command to re-analyze - triggers @dependency chat participant so messages appear in chat
    const analyzeCommand = vscode.commands.registerCommand('aida.analyzeDependencies', async (_workspaceRoot, force = false) => {
        try {
            if (force) {
                skipCapabilityCheck = true;
            }
            // Open @dependency participant in chat so user sees progress messages in the chat window
            await vscode.commands.executeCommand('workbench.action.chat.open', {
                query: '@dependency re-analyze'
            });
        } catch (_error: unknown) {
            const error = toError(_error);
            aidaLogging('\u274C Error triggering re-analysis:', error);
            vscode.window.showErrorMessage(`\u274C Failed to trigger re-analysis: ${error.message}`);
        }
    });

    context.subscriptions.push(loadCacheCommand, analyzeCommand);
}

/**
 * Check if message contains PR URL
 */
function isPRUrl(message: string) {
    const patterns = [
        /github\.com\/[^\/]+\/[^\/]+\/pull\/\d+/i,
        /dev\.azure\.com\/[^\/]+\/[^\/]+\/_git\/[^\/]+\/pullrequest\/\d+/i,
        /gitlab\.com\/.+\/-\/merge_requests\/\d+/i,
        /bitbucket\.org\/[^\/]+\/[^\/]+\/pull-requests\/\d+/i
    ];
    return patterns.some(pattern => pattern.test(message));
}

/**
 * Handle PR dependency analysis workflow
 */
async function handlePRDependencyAnalysis(prUrl: string, stream: vscode.ChatResponseStream, _token: vscode.CancellationToken, workspaceRoot: string) {
    try {
        stream.markdown('## \u{1F50D} PR Dependency Analysis\n\n');
        stream.markdown(`\u{1F4CC} **Analyzing PR:** ${prUrl}\n\n`);

        // Step 1: Parse PR URL
        const fetcher = new PRFileFetcher();
        const prInfo = fetcher.parsePRUrl(prUrl);

        // Step 2: Fetch PR files
        stream.markdown('\u23F3 Fetching PR file changes...\n\n');

        let prFiles;
        try {
            prFiles = await fetcher.fetchFiles(prInfo);
        } catch (_error: unknown) {
            const error = toError(_error);
            stream.markdown(`\u274C **Error fetching PR files:** ${error.message}\n\n`);

            if (error.message.includes('token')) {
                stream.markdown('\u{1F4A1} **Setup Required:**\n\n');
                stream.markdown(`- Configure your ${prInfo.repoType!.toUpperCase()} token in settings\n`);
                stream.markdown('- Check AIDA documentation for token setup instructions\n\n');
            }

            return;
        }

        if (!prFiles || prFiles.length === 0) {
            stream.markdown('\u274C No files found in PR\n\n');
            return;
        }

        // \u{1F9EA} TEST: Filter to specific files for debugging
        // prFiles = prFiles.filter(f => 
        //     f.path.includes('constants.ts')
        //      || 
        //     f.path.includes('message-resources.ts') ||
        //     f.path.includes('tab-management.store.ts') 
        //      ||
        //      f.path.includes('tab-management.service.ts') 
        //      ||
        //     f.path.includes('maintain-equipment-list.component.ts')
        // );

        if (prFiles.length === 0) {
            stream.markdown('\u26A0\uFE0F No test files found in PR\n\n');
            return;
        }

        stream.markdown(`\u2705 Found **${prFiles.length} files** in PR:\n\n`);

        // Show file summary
        const added = prFiles.filter(f => f.status === 'add').length;
        const modified = prFiles.filter(f => f.status === 'edit').length;
        const deleted = prFiles.filter(f => f.status === 'delete').length;
        const renamed = prFiles.filter(f => f.status === 'rename').length;

        stream.markdown(`\u{1F7E2} Added: ${added}\n`);
        stream.markdown(`\u{1F7E1} Modified: ${modified}\n`);
        stream.markdown(`\u{1F534} Deleted: ${deleted}\n`);
        if (renamed > 0) stream.markdown(`\u{1F535} Renamed: ${renamed}\n`);
        stream.markdown('\n');

        // Step 3: Start background analysis (non-blocking)
        stream.markdown('\u2705 **Analysis started in background** - You can continue working!\n\n');
        stream.markdown('\u{1F4A1} The dependency graph will open automatically when complete.\n\n');
        stream.markdown('\u{1F4CA} Check the **status bar** at the bottom for progress updates.\n\n');

        // Run analysis in background without blocking chat
        performPRAnalysisInBackground(prUrl, prInfo, prFiles, workspaceRoot);

    } catch (_error: unknown) {
        const error = toError(_error);
        aidaLogging('\u274C PR dependency analysis error:', error);
        stream.markdown(`\u274C **Unexpected Error:** ${error.message}\n\n`);
        stream.markdown('Please check the console for details.\n\n');
    }
}

/**
 * Perform dependency analysis in background (non-blocking)
 */
function performDependencyAnalysisInBackground(workspaceRoot: string) {
    // Run analysis in background with status bar progress (lightweight, non-intrusive)
    vscode.window.withProgress({
        location: vscode.ProgressLocation.Window,
        title: "\u{1F50D} Analyzing Dependencies",
        cancellable: false
    }, async (progress) => {
        try {
            progress.report({ increment: 0, message: "You can continue working - this runs in background..." });

            // Use VS Code API analyzer
            const analyzer = new VSCodeApiDependencyAnalyzer(workspaceRoot);
            const analysisType = 'VS Code API (Symbol Crawling)';

            progress.report({ increment: 20, message: "Scanning files and building dependency tree..." });
            const graph = await analyzer.analyze();

            progress.report({ increment: 60, message: "Calculating metrics and generating report..." });
            const report = analyzer.generateReport(graph);

            // Validate graph data
            if (!graph || !graph.nodes || !Array.isArray(graph.nodes)) {
                throw new Error('Invalid graph data: missing or invalid nodes array');
            }
            if (!graph.edges || !Array.isArray(graph.edges)) {
                throw new Error('Invalid graph data: missing or invalid edges array');
            }

            aidaLogging(`\u{1F50D} Graph validation: ${graph.nodes.length} nodes, ${graph.edges.length} edges`);

            progress.report({ increment: 85, message: "Saving cache..." });
            await saveToCache(graph, report, analysisType);

            progress.report({ increment: 95, message: "Opening visualization..." });
            await createWebviewFromData(graph, report, analysisType);

            // Show completion notification
            vscode.window.showInformationMessage(
                `\u2705 Dependency analysis complete! Found ${graph.nodes.length} files with ${graph.edges.length} dependencies.`,
                'View Graph'
            ).then(selection => {
                if (selection === 'View Graph') {
                    // Graph already opened, just bring it to focus
                    vscode.commands.executeCommand('workbench.view.extension.aida-dependency-view');
                }
            });

        } catch (_error: unknown) {
            const error = toError(_error);
            aidaLogging('\u274C Background analysis error:', error);
            aidaLogging('\u274C Stack trace:', error.stack);
            vscode.window.showErrorMessage(
                `\u274C Dependency analysis failed: ${error.message}`,
                'View Details'
            ).then(selection => {
                if (selection === 'View Details') {
                    vscode.window.showErrorMessage(`Error Details:\n${error.stack || error.message}`);
                }
            });
        }
    });
}

/**
 * Perform PR dependency analysis in background (non-blocking)
 * @param {string} prUrl - The PR URL
 * @param {object} prInfo - Parsed PR info (repo, owner, prNumber, repoType)
 * @param {Array} prFiles - List of files changed in PR
 * @param {string} workspaceRoot - Workspace root path
 */
function performPRAnalysisInBackground(_prUrl: string, prInfo: Record<string, any>, prFiles: unknown[], workspaceRoot: string) {
    // Run analysis in background with status bar progress (lightweight, non-intrusive)
    vscode.window.withProgress({
        location: vscode.ProgressLocation.Window,
        title: "\u{1F50D} Analyzing PR Dependencies",
        cancellable: false
    }, async (progress) => {
        try {
            progress.report({ increment: 0, message: "Starting PR analysis - you can continue working..." });

            progress.report({ increment: 30, message: `Analyzing ${prFiles.length} files...` });

            // Analyze dependencies for PR files
            const analyzer = new PRDependencyAnalyzer(workspaceRoot);
            const graph: Record<string, any> = await analyzer.analyzePRFiles(prFiles as any);

            progress.report({ increment: 70, message: "Generating graph visualization..." });

            // Create and open PR graph webview
            const summary = graph.prSummary;
            await createPRGraphWebview(graph, prInfo, summary);

            progress.report({ increment: 95, message: "Complete!" });

            // Calculate impact stats
            const impactedFiles = graph.nodes.filter((n: Record<string, any>) => n.nodeType === 'dependent').length;
            const dependencies = graph.nodes.filter((n: Record<string, any>) => n.nodeType === 'dependency').length;

            // Show completion notification
            vscode.window.showInformationMessage(
                `\u2705 PR Analysis complete! ${prFiles.length} PR files \u2192 ${impactedFiles} impacted, ${dependencies} dependencies`,
                'View Graph'
            ).then(selection => {
                if (selection === 'View Graph') {
                    // Focus the graph view
                    vscode.commands.executeCommand('workbench.view.extension.aida-dependency-view');
                }
            });

        } catch (_error: unknown) {
            const error = toError(_error);
            aidaLogging('\u274C Background PR analysis error:', error);
            aidaLogging('\u274C Stack trace:', error.stack);

            let errorMessage = `\u274C PR analysis failed: ${error.message}`;
            if (error.message.includes('cache') || error.message.includes('graph')) {
                errorMessage += ' - Run @dependency first to build workspace cache';
            }

            vscode.window.showErrorMessage(
                errorMessage,
                'View Details'
            ).then(selection => {
                if (selection === 'View Details') {
                    vscode.window.showErrorMessage(`Error Details:\n${error.stack || error.message}`);
                }
            });
        }
    });
}

/**
 * Analyze dependencies for a single file
 */
async function analyzeFileDependency(uri: vscode.Uri) {
    if (!uri) {
        vscode.window.showErrorMessage('No file selected for analysis');
        return;
    }

    const filePath = uri.fsPath;
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);

    if (!workspaceFolder) {
        vscode.window.showErrorMessage('File must be part of a workspace');
        return;
    }

    const workspaceRoot = workspaceFolder.uri.fsPath;

    vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Analyzing File Dependencies",
        cancellable: false
    }, async (progress) => {
        progress.report({ message: "Building dependency graph..." });

        try {
            const analyzer = new FileDependencyAnalyzer(workspaceRoot);
            const graph = await analyzer.analyzeFile(filePath);

            progress.report({ message: "Generating visualization..." });
            await createFileGraphWebview(graph, filePath);

        } catch (_error: unknown) {
            const error = toError(_error);
            aidaLogging('Error analyzing file dependency:', error);
            vscode.window.showErrorMessage(`Analysis failed: ${error.message}`);
        }
    });
}

// ES exports
export {
    activateDependencyWatcherIfCacheExists,
    handleEnvironmentCheck,
    registerCacheCommands,
    isPRUrl,
    handlePRDependencyAnalysis,
    performDependencyAnalysisInBackground,
    performPRAnalysisInBackground,
    analyzeFileDependency
};
