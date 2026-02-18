const vscode = require('vscode');
const path = require('path');
const fs = require('fs');

// Import settings
const { isProd, aidaLogging } = require('./settings');

// Usage Tracking
const { trackEvent } = require('./usage-tracking');
const { TrackingEvent, AiProvider, TrackingSource } = require('./tracking-enums');

// Import VS Code API analyzer - required
const { VSCodeApiDependencyAnalyzer } = require('./dependency-graph/vscode-api-analyzer');
const { SymbolAnalyzer } = require('./dependency-graph/symbol-analyzer');

// Import PR analysis modules
const { PRFileFetcher } = require('./pr-file-fetcher');
const { PRDependencyAnalyzer } = require('./pr-dependency-analyzer');
const { FileDependencyAnalyzer } = require('./file-dependency-analyzer');
const { DependencyGraphService } = require('./dependency-graph-service');

// Import Capability Check
const { checkEnvironmentCapabilities } = require('./capability-check');

// Cache management
const CACHE_VERSION = '1.1';
let cacheFilePath = null;
let extensionContext = null;
let skipCapabilityCheck = false;
let globalGraphService = null;

/**
 * Auto-activate dependency watcher if cache exists
 * @param {vscode.ExtensionContext} context
 */
async function activateDependencyWatcherIfCacheExists(context) {
    try {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath;
        if (!workspaceRoot) return;

        const cachePath = path.join(workspaceRoot, '.vscode', 'dependency-cache.json');

        if (fs.existsSync(cachePath)) {
            aidaLogging('🚀 Found dependency cache, auto-activating watcher...');

            if (!globalGraphService) {
                globalGraphService = new DependencyGraphService(workspaceRoot);
            }

            // This will load cache and start watcher
            await globalGraphService.ensureFullGraph();
            aidaLogging('✅ Dependency watcher activated from cache');
        }
    } catch (error) {
        aidaLogging('❌ Failed to auto-activate dependency watcher:', error);
    }
}

/**
 * Check environment capabilities and report issues to stream
 * @returns {Promise<boolean>} - Returns true if analysis should be aborted (missing capabilities)
 */
async function handleEnvironmentCheck(stream, workspaceRoot) {
    // If skip flag is set, reset it and proceed without check
    if (skipCapabilityCheck) {
        skipCapabilityCheck = false;
        return false;
    }

    const missingCapabilities = await checkEnvironmentCapabilities(workspaceRoot);

    if (missingCapabilities.length > 0) {
        stream.markdown('### ⚠️ Environment Check Required\n\n');
        stream.markdown('Dependency analysis relies on the **Language Server Protocol (LSP)** to accurately resolve symbols and imports. Please install the following extensions to enable this capability:\n\n');

        for (const missing of missingCapabilities) {
            for (const ext of missing.recommendedExtensions) {
                stream.markdown(`> ### 📦 ${ext.name}\n`);
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
            title: '⚠️ Continue Anyway',
            arguments: [workspaceRoot, true]
        });
        stream.markdown('\n\n');

        return true; // Abort
    }

    return false; // Continue
}

/**
 * Initialize dependency graph functionality
 * @param {vscode.ExtensionContext} context
 * @returns {object} - Chat participant and related functions
 */
function initializeDependencyGraph(context) {
    // Store extension context for later use
    extensionContext = context;
    // Create chat participant for dependency analysis
    const dependencyParticipant = vscode.chat.createChatParticipant('dependency', async (request, chatContext, stream, token) => {
        try {
            // Get workspace root
            const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath;
            if (!workspaceRoot) {
                stream.markdown('❌ **Error**: No workspace folder found. Please open a project folder.');
                return;
            }

            // Set cache file path
            cacheFilePath = path.join(workspaceRoot, '.vscode', 'dependency-cache.json');

            const userMessage = request.prompt.trim();

            // Track dependency analysis (workspace)
            trackEvent(TrackingEvent.ANALYZE_DEPENDENCY, {
                aiProvider: AiProvider.GITHUB_COPILOT,
                source: TrackingSource.CHAT_PARTICIPANT
            });

            // Check if user explicitly requested re-analysis
            const isReAnalyzeRequest = userMessage.toLowerCase().includes('re-analyze') || userMessage.toLowerCase().includes('reanalyze');

            // Check for existing cache
            const cacheExists = await checkCacheExists();

            if (cacheExists && !isReAnalyzeRequest) {
                // Show cache options
                stream.markdown(`## 🔍 Dependency Analysis Options\n\n`);
                stream.markdown(`📁 **Found existing cache** from previous analysis\n\n`);
                stream.markdown(`**Choose your option:**\n\n`);

                stream.button({
                    command: 'aida.loadDependencyCache',
                    title: '⚡ Load from Cache (Fast)',
                    arguments: [workspaceRoot]
                });

                stream.markdown('   ');

                stream.button({
                    command: 'aida.analyzeDependencies',
                    title: '🔄 Re-analyze (Slow but Fresh)',
                    arguments: [workspaceRoot]
                });

                stream.markdown('\n\n✨ **Note:** Dependency scanning uses **VS Code Language Server APIs** - **No AI Tokens consumed!** 🆓');

            } else {
                // No cache or explicit re-analyze request - analyze directly in background

                // Check environment capabilities
                if (await handleEnvironmentCheck(stream, workspaceRoot)) {
                    return;
                }

                const message = isReAnalyzeRequest
                    ? '🔄 **Re-analyzing dependencies...** - This will take some time\n\n'
                    : '🔍 **No cache found** - Starting fresh analysis...\n\n';
                stream.markdown(message);
                stream.markdown('✅ **Analysis started in background** - You can continue working!\n\n');
                stream.markdown('💡 The dependency graph will open automatically when complete.\n\n');

                // Run in background without blocking chat
                performDependencyAnalysisInBackground(workspaceRoot);
            }

        } catch (error) {
            aidaLogging('❌ Dependency analysis error:', error);
            aidaLogging('❌ Stack trace:', error.stack);
            stream.markdown(`❌ **Analysis Error**\n\n**Error:** ${error.message}\n\n**Debug Info:**\n- Workspace: \`${workspaceRoot || 'undefined'}\`\n- Please check console for details\n\n💡 **Fix:** Ensure the workspace folder is properly opened.`);
        }
    });

    // Set participant metadata
    dependencyParticipant.iconPath = vscode.Uri.file(
        path.join(context.extensionPath, 'icons', 'dependency-icon.svg')
    );

    // Remove followup provider that might be causing help responses
    // dependencyParticipant.followupProvider = null;

    // Create chat participant for dependency-pr analysis (similar to @review-pr)
    const dependencyPrParticipant = vscode.chat.createChatParticipant('dependency-pr', async (request, chatContext, stream, token) => {
        try {
            const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath;
            if (!workspaceRoot) {
                stream.markdown('❌ **Error**: No workspace folder found. Please open a project folder.');
                return;
            }

            // Set cache file path
            cacheFilePath = path.join(workspaceRoot, '.vscode', 'dependency-cache.json');

            const userMessage = request.prompt.trim();

            // Track dependency PR analysis
            trackEvent(TrackingEvent.ANALYZE_DEPENDENCY_PR, {
                source: TrackingSource.CHAT_PARTICIPANT,
                aiProvider: AiProvider.GITHUB_COPILOT
            });

            if (!userMessage || !isPRUrl(userMessage)) {
                stream.markdown('## 🔍 Dependency PR Analysis\n\n');
                stream.markdown('Please provide a Pull Request URL to analyze.\n\n');
                stream.markdown('**Usage:** `@dependency-pr <pr-url>`\n\n');
                stream.markdown('**Examples:**\n');
                stream.markdown('- `@dependency-pr https://dev.azure.com/org/project/_git/repo/pullrequest/123`\n');
                stream.markdown('- `@dependency-pr https://github.com/user/repo/pull/456`\n');
                stream.markdown('- `@dependency-pr https://gitlab.com/group/repo/-/merge_requests/78`\n');
                return;
            }

            await handlePRDependencyAnalysis(userMessage, stream, token, workspaceRoot);

        } catch (error) {
            aidaLogging('❌ Dependency PR analysis error:', error);
            stream.markdown(`❌ **Analysis Error**\n\n**Error:** ${error.message}\n\n`);
        }
    });

    // Set participant metadata
    dependencyPrParticipant.iconPath = vscode.Uri.file(
        path.join(context.extensionPath, 'icons', 'dependency-icon.svg')
    );

    return {
        dependencyParticipant,
        dependencyPrParticipant,
        registerCacheCommands
    };
}

/**
 * AI Dependency Analysis function for AIDA Chatbot
 * @param {string} message - User message
 * @param {object} stream - Stream object for responses
 * @param {object} token - Cancellation token
 * @param {vscode.ExtensionContext} context - Extension context
 */
async function aiDependencyAnalysis(message, stream, token, context) {
    try {
        stream.markdown('# 🔍 AIDA Dependency Analysis\n\n');

        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath;
        if (!workspaceRoot) {
            stream.markdown('❌ **Error:** No workspace folder found. Please open a project folder.\n\n');
            return;
        }

        // Set cache file path
        cacheFilePath = path.join(workspaceRoot, '.vscode', 'dependency-cache.json');

        const userMessage = message.trim();

        // Track dependency analysis (workspace) from AIDA Chatbot
        trackEvent(TrackingEvent.ANALYZE_DEPENDENCY, {
            aiProvider: AiProvider.AIDA_CHATBOT,
            source: TrackingSource.AIDA_CHATBOT
        });

        // Check if user explicitly requested re-analysis
        const lowerMessage = userMessage.toLowerCase();
        const isReAnalyzeRequest = lowerMessage.includes('re-analyze') || lowerMessage.includes('reanalyze');

        // Check for existing cache
        const cacheExists = await checkCacheExists();

        if (cacheExists && !isReAnalyzeRequest) {
            // Show cache options (same as Copilot)
            stream.markdown(`## 🔍 Dependency Analysis Options\n\n`);
            stream.markdown(`📁 **Found existing cache** from previous analysis\n\n`);
            stream.markdown(`**Choose your option:**\n\n`);

            stream.button({
                command: 'aida.loadDependencyCache',
                title: '⚡ Load from Cache (Fast)',
                arguments: [workspaceRoot]
            });

            stream.markdown('   ');

            stream.button({
                command: 'aida.analyzeDependencies',
                title: '🔄 Re-analyze (Slow but Fresh)',
                arguments: [workspaceRoot]
            });

            stream.markdown('\n\n✨ **Note:** Dependency scanning uses **VS Code Language Server APIs** - **No AI Tokens consumed!** 🆓');

        } else {
            // No cache or explicit re-analyze request

            // Check environment capabilities
            if (await handleEnvironmentCheck(stream, workspaceRoot)) {
                return;
            }

            const message = isReAnalyzeRequest
                ? '🔄 **Re-analyzing dependencies...** - This will take some time\n\n'
                : '🔍 **No cache found** - Starting fresh analysis...\n\n';
            stream.markdown(message);
            stream.markdown('✅ **Analysis started in background** - You can continue working!\n\n');
            stream.markdown('💡 The dependency graph will open automatically when complete.\n\n');

            // Run in background without blocking chat
            performDependencyAnalysisInBackground(workspaceRoot);
        }

    } catch (error) {
        aidaLogging('❌ aiDependencyAnalysis error:', error);
        stream.markdown(`❌ **Error:** ${error.message}\n\n`);
        stream.markdown('Please check the console for details.\n\n');
    }
}

/**
 * Register cache-related commands
 */
function registerCacheCommands(context) {
    // Command to load from cache
    const loadCacheCommand = vscode.commands.registerCommand('aida.loadDependencyCache', async (workspaceRoot) => {
        try {
            const cachedData = await loadFromCache();
            if (cachedData) {
                await createWebviewFromData(cachedData.graph, cachedData.report, 'Cache');
                vscode.window.showInformationMessage('✅ Dependency graph loaded from cache!');
            } else {
                vscode.window.showErrorMessage('❌ Failed to load cache data');
            }
        } catch (error) {
            aidaLogging('❌ Error loading cache:', error);
            vscode.window.showErrorMessage(`❌ Cache load failed: ${error.message}`);
        }
    });

    // Command to re-analyze
    const analyzeCommand = vscode.commands.registerCommand('aida.analyzeDependencies', async (workspaceRoot, force = false) => {
        try {
            if (force) {
                skipCapabilityCheck = true;
            }
            // Trigger chat participant with re-analyze command
            await vscode.commands.executeCommand('workbench.action.chat.open', {
                query: '@dependency re-analyze'
            });
        } catch (error) {
            aidaLogging('❌ Error triggering re-analysis:', error);
            vscode.window.showErrorMessage(`❌ Failed to trigger re-analysis: ${error.message}`);
        }
    });

    context.subscriptions.push(loadCacheCommand, analyzeCommand);
}

/**
 * Check if cache exists and is valid
 */
async function checkCacheExists() {
    try {
        if (!cacheFilePath) return false;

        const cacheStats = await fs.promises.stat(cacheFilePath);
        const cacheAge = Date.now() - cacheStats.mtime.getTime();
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours

        return cacheAge < maxAge;
    } catch (error) {
        return false;
    }
}

/**
 * Save analysis result to cache
 */
async function saveToCache(graph, report, analysisType) {
    try {
        if (!cacheFilePath) return;

        // Ensure .vscode directory exists
        const vscodeDir = path.dirname(cacheFilePath);
        await fs.promises.mkdir(vscodeDir, { recursive: true });

        const cacheData = {
            version: CACHE_VERSION,
            timestamp: new Date().toISOString(),
            analysisType,
            graph,
            report
        };

        await fs.promises.writeFile(cacheFilePath, JSON.stringify(cacheData, null, 2));
        aidaLogging('💾 Dependency analysis cached successfully');
    } catch (error) {
        aidaLogging('⚠️ Failed to save cache:', error.message);
    }
}

/**
 * Load analysis result from cache
 */
async function loadFromCache() {
    try {
        if (!cacheFilePath) return null;

        const cacheData = JSON.parse(await fs.promises.readFile(cacheFilePath, 'utf8'));

        if (cacheData.version !== CACHE_VERSION) {
            aidaLogging('🔄 Cache version mismatch, will regenerate');
            return null;
        }

        // Validate cache structure
        if (!cacheData.graph || !cacheData.report || !cacheData.report.summary) {
            aidaLogging('⚠️ Invalid cache data structure, will regenerate');
            return null;
        }

        aidaLogging('💾 Loaded dependency analysis from cache');
        return cacheData;
    } catch (error) {
        aidaLogging('⚠️ Failed to load cache:', error.message);
        return null;
    }
}

/**
 * Perform dependency analysis in background (non-blocking)
 */
function performDependencyAnalysisInBackground(workspaceRoot) {
    // Run analysis in background with status bar progress (lightweight, non-intrusive)
    vscode.window.withProgress({
        location: vscode.ProgressLocation.Window,
        title: "🔍 Analyzing Dependencies",
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

            aidaLogging(`🔍 Graph validation: ${graph.nodes.length} nodes, ${graph.edges.length} edges`);

            progress.report({ increment: 85, message: "Saving cache..." });
            await saveToCache(graph, report, analysisType);

            progress.report({ increment: 95, message: "Opening visualization..." });
            await createWebviewFromData(graph, report, analysisType);

            // Show completion notification
            vscode.window.showInformationMessage(
                `✅ Dependency analysis complete! Found ${graph.nodes.length} files with ${graph.edges.length} dependencies.`,
                'View Graph'
            ).then(selection => {
                if (selection === 'View Graph') {
                    // Graph already opened, just bring it to focus
                    vscode.commands.executeCommand('workbench.view.extension.aida-dependency-view');
                }
            });

        } catch (error) {
            aidaLogging('❌ Background analysis error:', error);
            aidaLogging('❌ Stack trace:', error.stack);
            vscode.window.showErrorMessage(
                `❌ Dependency analysis failed: ${error.message}`,
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
function performPRAnalysisInBackground(prUrl, prInfo, prFiles, workspaceRoot) {
    // Run analysis in background with status bar progress (lightweight, non-intrusive)
    vscode.window.withProgress({
        location: vscode.ProgressLocation.Window,
        title: "🔍 Analyzing PR Dependencies",
        cancellable: false
    }, async (progress) => {
        try {
            progress.report({ increment: 0, message: "Starting PR analysis - you can continue working..." });

            // Build file summary for notification
            const added = prFiles.filter(f => f.status === 'add').length;
            const modified = prFiles.filter(f => f.status === 'edit').length;
            const deleted = prFiles.filter(f => f.status === 'delete').length;

            progress.report({ increment: 30, message: `Analyzing ${prFiles.length} files...` });

            // Analyze dependencies for PR files
            const analyzer = new PRDependencyAnalyzer(workspaceRoot);
            const graph = await analyzer.analyzePRFiles(prFiles);

            progress.report({ increment: 70, message: "Generating graph visualization..." });

            // Create and open PR graph webview
            const summary = graph.prSummary;
            await createPRGraphWebview(graph, prInfo, summary);

            progress.report({ increment: 95, message: "Complete!" });

            // Calculate impact stats
            const impactedFiles = graph.nodes.filter(n => n.nodeType === 'dependent').length;
            const dependencies = graph.nodes.filter(n => n.nodeType === 'dependency').length;

            // Show completion notification
            vscode.window.showInformationMessage(
                `✅ PR Analysis complete! ${prFiles.length} PR files → ${impactedFiles} impacted, ${dependencies} dependencies`,
                'View Graph'
            ).then(selection => {
                if (selection === 'View Graph') {
                    // Focus the graph view
                    vscode.commands.executeCommand('workbench.view.extension.aida-dependency-view');
                }
            });

        } catch (error) {
            aidaLogging('❌ Background PR analysis error:', error);
            aidaLogging('❌ Stack trace:', error.stack);

            let errorMessage = `❌ PR analysis failed: ${error.message}`;
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
 * Create webview from data (extracted for reuse)
 */
async function createWebviewFromData(graph, report, analysisType) {
    // Create and open webview panel
    const panel = vscode.window.createWebviewPanel(
        'dependencyGraph',
        `Dependency Graph - ${analysisType}`,
        vscode.ViewColumn.One,
        {
            enableScripts: true,
            retainContextWhenHidden: true
        }
    );

    // Generate webview content
    aidaLogging(`📊 Creating webview with data:`, {
        nodeCount: graph.nodes.length,
        edgeCount: graph.edges.length,
        analysisType
    });

    const webviewHtml = generateFilteredGraphWebviewHtml(graph, report.summary, 'all');
    panel.webview.html = webviewHtml;

    // Handle messages from webview
    panel.webview.onDidReceiveMessage(async (message) => {
        if (message.command === 'buildSelectedNodeObject') {
            await buildSelectedNodeObject(message.nodeId, graph, panel);
        } else if (message.command === 'analyzeImpact') {
            await analyzeImpactWithAI(message.selectedNodeData, panel);
        } else if (message.command === 'analyzeDeepImpact') {
            // Pass graph to ensure consistent dependency/dependent logic
            await openImpactAnalysisWebview(message.nodeId, graph);
        }
    });

    aidaLogging(`✅ Webview created with ${graph.nodes.length} nodes, ${graph.edges.length} edges`);
}



/**
 * Build complete selected node object with all CSS/HTML assets
 */
async function buildSelectedNodeObject(nodeId, graph, panel) {
    try {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath;
        if (!workspaceRoot) {
            aidaLogging('No workspace root found');
            return;
        }

        const selectedNode = graph.nodes.find(n => n.id === nodeId);
        if (!selectedNode) {
            aidaLogging('Node not found:', nodeId);
            return;
        }

        // Helper function to load assets for a node
        const loadNodeAssets = async (node) => {
            const result = { main: node.id };

            const fileName = node.fileName || path.basename(node.id);

            // Get absolute path
            let absolutePath = node.id;
            if (!path.isAbsolute(node.id) && workspaceRoot) {
                absolutePath = path.join(workspaceRoot, node.id);
            }

            // Check if file exists
            if (!fs.existsSync(absolutePath)) {
                return result;
            }

            // Read file content
            const fileContent = fs.readFileSync(absolutePath, 'utf8');

            // Detect framework and load assets accordingly
            // 🔥 REFACTORED: Use AssetLoaderStrategy pattern instead of hardcoded if/else
            const { AssetLoaderFactory } = require('./dependency-graph/asset-loader-factory');
            const assetLoader = AssetLoaderFactory.getLoader(fileName);

            if (assetLoader) {
                const assets = await assetLoader.loadAssets(absolutePath, fileContent, workspaceRoot);
                Object.assign(result, assets);
            }

            return result;
        };

        // Build dependencies array
        const dependencies = [];
        const dependencyEdges = graph.edges.filter(edge => {
            const sourceId = edge.source.id || edge.source;
            return sourceId === nodeId;
        });

        for (const edge of dependencyEdges) {
            const targetId = edge.target.id || edge.target;
            const targetNode = graph.nodes.find(n => n.id === targetId);
            if (targetNode) {
                const assets = await loadNodeAssets(targetNode);
                dependencies.push(assets);
            }
        }

        // Build dependents array
        const dependents = [];
        const dependentEdges = graph.edges.filter(edge => {
            const targetId = edge.target.id || edge.target;
            return targetId === nodeId;
        });

        for (const edge of dependentEdges) {
            const sourceId = edge.source.id || edge.source;
            const sourceNode = graph.nodes.find(n => n.id === sourceId);
            if (sourceNode) {
                const assets = await loadNodeAssets(sourceNode);
                dependents.push(assets);
            }
        }

        // Build final object
        const selectedNodeObject = {
            id: selectedNode.fileName || path.basename(nodeId),
            fileName: selectedNode.fileName || path.basename(nodeId),
            originalNodeId: nodeId, // Keep original nodeId for webview message matching
            dependencies,
            dependents
        };

        aidaLogging('\n🎯 Selected Node Object:', JSON.stringify(selectedNodeObject, null, 2));

        // Send to AI for analysis
        await analyzeImpactWithAI(selectedNodeObject, panel);

        return selectedNodeObject;

    } catch (error) {
        aidaLogging('❌ Error building selected node object:', error);
        return null;
    }
}

/**
 * Analyze impact with AI using selected node data or PR context
 */
async function analyzeImpactWithAI(data, originalPanel) {
    // Track AI analysis button click
    const eventName = data.isPRAnalysis ? TrackingEvent.ANALYZE_DEPENDENCY_AI_PR : TrackingEvent.ANALYZE_DEPENDENCY_AI_NODE;
    trackEvent(eventName, {
        aiProvider: AiProvider.GITHUB_COPILOT,
        source: TrackingSource.WEBVIEW_BUTTON
    });

    // Create NEW panel aside
    const analysisPanel = vscode.window.createWebviewPanel(
        'aiImpactAnalysis',
        `AI Analysis: ${data.fileName}`,
        vscode.ViewColumn.Beside,
        {
            enableScripts: true,
            retainContextWhenHidden: true
        }
    );

    // Helper to format markdown (now just cleans up HTML response)
    const formatMarkdown = (text) => {
        if (!text) return '';
        // Remove markdown code blocks if present
        return text.replace(/```html/g, '').replace(/```/g, '');
    };

    // Helper to generate HTML
    const getHtml = (content) => `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Analysis: ${data.fileName}</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            padding: 20px;
            line-height: 1.5;
            font-size: 13px;
        }
        h1 { color: #3794ff; margin-top: 15px; margin-bottom: 10px; font-size: 1.4em; display: block; }
        h2 { color: #3794ff; margin-top: 15px; margin-bottom: 10px; font-size: 1.2em; display: block; clear: both; }
        h3 { color: #3794ff; margin-top: 10px; margin-bottom: 8px; font-size: 1.1em; display: block; clear: both; }
        h4 { color: #3794ff; margin-top: 10px; margin-bottom: 8px; font-size: 1em; display: block; clear: both; }
        strong { color: #e0e0e0; }
        ul { padding-left: 20px; margin-top: 5px; margin-bottom: 10px; }
        li { margin-bottom: 4px; }
        .loading { display: flex; align-items: center; gap: 10px; font-style: italic; color: #cccccc; }
    </style>
</head>
<body>
    <h2 style="margin-top: 0;">🤖 AI Analysis: ${data.fileName}</h2>
    <hr style="border: 0; border-top: 1px solid #333; margin: 15px 0;">
    <div id="content">${content}</div>
</body>
</html>`;

    // Set initial loading state
    analysisPanel.webview.html = getHtml('<div class="loading">🤖 Analyzing impact... Please wait...</div>');

    try {
        // Import review-common for executeAIReview and getUnifiedModel
        const { executeAIReview, getUnifiedModel } = require('./review-common');

        let prompt = '';

        if (data.isPRAnalysis) {
            // PR Analysis Prompt
            prompt = `You are an expert code reviewer and architect.
Analyze the impact of this Pull Request based on the dependency graph data.

PR Context:
${JSON.stringify({
                summary: data.prSummary,
                changes: data.changes,
                impact: data.impact,
                // Limit symbol map to avoid token limits if necessary
                symbolMap: data.symbolMap
            }, null, 2)}

Please provide a comprehensive report covering:
1. Summary of Changes: What is being changed at a high level?
2. Impact Analysis: Which components are affected and how critical is the impact?
3. Risk Assessment: Are there any high-risk changes (e.g., modifying core services, circular dependencies)?
4. Testing Recommendations: What should be tested to ensure no regressions?

FORMAT OUTPUT AS HTML:
- Use <h1> for the title: "Pull Request Impact Analysis"
- Use <h2> for section headers.
- Use <ul> and <li> for lists.
- Use <p> for paragraphs.
- Use <strong> for emphasis.
- Do NOT use markdown. Do NOT use \`\`\`html code blocks. Just raw HTML.

IMPORTANT INSTRUCTION:
For files listed in the PR that have NO dependents or impact on other files:
- Explicitly mention that they have "Low Risk" or are "Isolated Changes".
- Do NOT hallucinate impacts for these isolated files.
- Focus the "Impact Analysis" and "Testing Recommendations" on the files that actually have dependents.

Keep the language simple and focus on USER IMPACT.`;
        } else {
            // Single Node Analysis Prompt
            prompt = `You are analyzing a code change impact. A developer wants to modify a file and needs to know what to test.

**File being modified:** ${data.fileName}

**This file uses these components/modules (${data.dependencies.length} dependencies):**
${data.dependencies.map(dep => {
                let parts = [`- ${dep.main}`];
                if (dep.html) parts.push(`(has UI template: ${dep.html})`);
                if (dep.css) parts.push(`(has styles: ${dep.css})`);
                return parts.join(' ');
            }).join('\n')}

**These components/modules depend on this file (${data.dependents.length} dependents):**
${data.dependents.map(dep => {
                let parts = [`- ${dep.main}`];
                if (dep.html) parts.push(`(has UI template: ${dep.html})`);
                if (dep.css) parts.push(`(has styles: ${dep.css})`);
                return parts.join(' ');
            }).join('\n')}

IMPORTANT INSTRUCTION:
If the list of dependents is EMPTY (0 dependents), it means this file is NOT used by any other file in the scanned codebase.
In this case, you MUST conclude that the risk is LOW or the file might be unused/dead code (unless it is a known entry point like main.ts or index.html).
Do NOT hallucinate features or impacts if there are no dependents.
If there are dependents, analyze the impact based ONLY on the listed files.

Please provide a simple, easy-to-understand analysis for a QA tester or project manager (non-technical user).

FORMAT OUTPUT AS HTML:
- Use <h1> for the title: "Testing Impact Analysis for {filename}"
- Use <h2> for section headers.
- Use <ul> and <li> for lists.
- Use <p> for paragraphs.
- Use <strong> for emphasis.
- Do NOT use markdown. Do NOT use \`\`\`html code blocks. Just raw HTML.

Sections to include:
1. What features should be tested?
2. Which pages/screens need checking?
3. Risk level (High/Medium/Low) and why
4. Testing priority

Keep the language simple and focus on USER IMPACT, not technical details.`;
        }

        aidaLogging('🤖 Sending to AI for analysis...');
        aidaLogging('📋 Prompt:', prompt);

        // Create a stream object to collect AI response
        let aiResponse = '';
        const mockStream = {
            markdown: (text) => {
                // Strip markdown formatting and accumulate response
                aiResponse += text;
            },
            progress: (text) => {
                aidaLogging('Progress:', text);
            }
        };

        // Get current selected model using getUnifiedModel (same as review-changes)
        // Pass global.aidaExtensionContext to respect AIDA Chatbot model selection
        const model = await getUnifiedModel(mockStream, null, global.aidaExtensionContext, null);

        // Use executeAIReview which handles both Copilot and API key modes
        const success = await executeAIReview(prompt, model, mockStream, 'Impact Analysis', 0, null, null);

        if (success) {
            aidaLogging('✅ AI Response received, length:', aiResponse.length);

            // Clean up the response - remove markdown decorations that we added
            let cleanResponse = aiResponse
                .replace(/^[\s\S]*?---\s*/, '') // Remove everything up to and including the first separator
                .replace(/\s*---\s*$/, '') // Remove trailing separator
                .replace(/🤖 \*\*Streaming.*?\*\*.*?\n\n/gs, '') // Remove streaming header
                .replace(/\n\n---\n\n📊 \*\*Token Usage Summary:\*\*[\s\S]*$/g, '') // Remove token stats section
                .replace(/💰 \*\*Cost.*?\*\*[\s\S]*$/g, '') // Remove cost footer
                .trim();

            // Update panel with result
            analysisPanel.webview.html = getHtml(formatMarkdown(cleanResponse));

        } else {
            throw new Error('AI analysis failed');
        }

    } catch (error) {
        aidaLogging('❌ Error analyzing with AI:', error);
        analysisPanel.webview.html = getHtml(`<div style="color: #f48771;">❌ Error: ${error.message}</div>`);
    }
}

/**
 * Open Deep Impact Analysis Webview
 * @param {string} nodeId - The node ID from graph
 * @param {object} graph - Optional: The full graph data for consistent dependency/dependent lookup
 */
async function openImpactAnalysisWebview(nodeId, graph = null) {
    try {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath;
        if (!workspaceRoot) return;

        // Resolve absolute path
        let absolutePath = nodeId;
        if (!path.isAbsolute(nodeId)) {
            absolutePath = path.join(workspaceRoot, nodeId);
        }

        // Create panel
        const panel = vscode.window.createWebviewPanel(
            'impactAnalysis',
            `Impact: ${path.basename(absolutePath)}`,
            vscode.ViewColumn.One, // Open in main column
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        // Load HTML content
        const extensionPath = extensionContext ? extensionContext.extensionPath : __dirname;
        const htmlPath = path.join(extensionPath, 'scripts', 'dependency-graph', 'impact-analysis.html');
        let htmlContent = fs.readFileSync(htmlPath, 'utf8');
        panel.webview.html = htmlContent;

        // Handle messages
        panel.webview.onDidReceiveMessage(async (message) => {
            if (message.command === 'refresh') {
                await runAnalysis();
            }
        });

        // Run analysis
        const runAnalysis = async () => {
            try {
                const analyzer = new SymbolAnalyzer();
                // Pass graph to analyzer for consistent dependency/dependent resolution
                const data = await analyzer.analyzeFile(absolutePath, graph);

                if (data) {
                    panel.webview.postMessage({
                        command: 'loadData',
                        data: data
                    });
                } else {
                    panel.webview.postMessage({
                        command: 'error',
                        error: 'Could not analyze file. Ensure language support is active.'
                    });
                }
            } catch (error) {
                aidaLogging('Impact analysis error:', error);
                panel.webview.postMessage({
                    command: 'error',
                    error: error.message
                });
            }
        };

        // Start analysis immediately
        await runAnalysis();

    } catch (error) {
        aidaLogging('Error opening impact analysis:', error);
        vscode.window.showErrorMessage(`Failed to open impact analysis: ${error.message}`);
    }
}

/**
 * Get dependencies from graph (files that nodeId imports)
 */
function getGraphDependencies(nodeId, graph, workspaceRoot) {
    const dependencies = [];
    const dependencyEdges = graph.edges.filter(edge => {
        const sourceId = edge.source.id || edge.source;
        return sourceId === nodeId;
    });

    for (const edge of dependencyEdges) {
        const targetId = edge.target.id || edge.target;
        const targetNode = graph.nodes.find(n => n.id === targetId);
        if (targetNode) {
            let absolutePath = targetId;
            if (!path.isAbsolute(targetId)) {
                absolutePath = path.join(workspaceRoot, targetId);
            }
            dependencies.push({
                path: targetId,
                fileName: targetNode.fileName || path.basename(targetId),
                absolutePath: absolutePath
            });
        }
    }

    return dependencies;
}

/**
 * Get dependents from graph (files that import nodeId)
 */
function getGraphDependents(nodeId, graph, workspaceRoot) {
    const dependents = [];
    const dependentEdges = graph.edges.filter(edge => {
        const targetId = edge.target.id || edge.target;
        return targetId === nodeId;
    });

    for (const edge of dependentEdges) {
        const sourceId = edge.source.id || edge.source;
        const sourceNode = graph.nodes.find(n => n.id === sourceId);
        if (sourceNode) {
            let absolutePath = sourceId;
            if (!path.isAbsolute(sourceId)) {
                absolutePath = path.join(workspaceRoot, sourceId);
            }
            dependents.push({
                path: sourceId,
                fileName: sourceNode.fileName || path.basename(sourceId),
                absolutePath: absolutePath
            });
        }
    }

    return dependents;
}

/**
 * Load assets for Angular components
 */
async function loadAngularAssets(absolutePath, fileContent, workspaceRoot) {
    const result = {};

    // Try VS Code Link Provider API first (more accurate for aliases)
    try {
        const uri = vscode.Uri.file(absolutePath);
        const links = await vscode.commands.executeCommand('vscode.executeLinkProvider', uri);

        if (links && links.length > 0) {
            for (const link of links) {
                if (!link.target) continue;

                const targetPath = link.target.fsPath;
                const ext = path.extname(targetPath).toLowerCase();

                if (ext === '.html') {
                    result.html = path.relative(workspaceRoot, targetPath);
                } else if (['.css', '.scss', '.sass', '.less'].includes(ext)) {
                    result.css = path.relative(workspaceRoot, targetPath);
                }
            }
        }
    } catch (error) {
        // API might fail if extension not active, fallback to regex
    }

    // Fallback to regex if API missed it
    if (!result.html) {
        // Parse templateUrl (HTML)
        const templateUrlMatch = fileContent.match(/templateUrl\s*:\s*['"`]([^'"`]+)['"`]/);
        if (templateUrlMatch) {
            const htmlPath = path.resolve(path.dirname(absolutePath), templateUrlMatch[1]);
            if (fs.existsSync(htmlPath)) {
                result.html = path.relative(workspaceRoot, htmlPath);
            }
        }
    }

    if (!result.css) {
        // Parse styleUrls (CSS/SCSS)
        const styleUrlsMatch = fileContent.match(/styleUrls\s*:\s*\[([\s\S]*?)\]/);
        if (styleUrlsMatch) {
            const styleUrls = styleUrlsMatch[1].match(/['"`]([^'"`]+)['"`]/g);
            if (styleUrls && styleUrls.length > 0) {
                const cleanUrl = styleUrls[0].replace(/['"`]/g, '');
                const cssPath = path.resolve(path.dirname(absolutePath), cleanUrl);
                if (fs.existsSync(cssPath)) {
                    result.css = path.relative(workspaceRoot, cssPath);
                }
            }
        }
    }

    return result;
}

/**
 * Load assets for React components
 */
async function loadReactAssets(absolutePath, fileContent, workspaceRoot) {
    const result = {};
    const dirPath = path.dirname(absolutePath);

    // Try VS Code Link Provider API first
    try {
        const uri = vscode.Uri.file(absolutePath);
        const links = await vscode.commands.executeCommand('vscode.executeLinkProvider', uri);

        if (links && links.length > 0) {
            for (const link of links) {
                if (!link.target) continue;

                const targetPath = link.target.fsPath;
                const ext = path.extname(targetPath).toLowerCase();

                if (['.css', '.scss', '.sass', '.less'].includes(ext)) {
                    result.css = path.relative(workspaceRoot, targetPath);
                    break; // Take first CSS file found
                }
            }
        }
    } catch (error) {
        // Fallback to regex
    }

    if (!result.css) {
        // Find CSS/SCSS imports
        // import './Component.css'
        // import styles from './Component.module.css'
        // import './styles.scss'
        const cssImports = fileContent.matchAll(/import\s+(?:['"`]([^'"`]+\.(?:css|scss|sass|less))['"`]|.*?from\s+['"`]([^'"`]+\.(?:css|scss|sass|less))['"`])/gi);

        for (const match of cssImports) {
            const cssFile = match[1] || match[2];
            if (cssFile) {
                const cssPath = path.resolve(dirPath, cssFile);
                if (fs.existsSync(cssPath)) {
                    result.css = path.relative(workspaceRoot, cssPath);
                    break; // Take first CSS file found
                }
            }
        }
    }

    // Check for co-located CSS files (Component.tsx -> Component.css/module.css)
    if (!result.css) {
        const baseName = path.basename(absolutePath, path.extname(absolutePath));
        const possibleCssFiles = [
            `${baseName}.module.css`,
            `${baseName}.module.scss`,
            `${baseName}.css`,
            `${baseName}.scss`,
            'styles.module.css',
            'styles.css'
        ];

        for (const cssFile of possibleCssFiles) {
            const cssPath = path.join(dirPath, cssFile);
            if (fs.existsSync(cssPath)) {
                result.css = path.relative(workspaceRoot, cssPath);
                break;
            }
        }
    }

    // React components don't have separate HTML files (JSX is inline)
    // But we can mark it as JSX-based
    result.jsx = path.relative(workspaceRoot, absolutePath);

    return result;
}

/**
 * Load assets for Node.js files
 */
async function loadNodeJsAssets(absolutePath, fileContent, workspaceRoot) {
    const result = {};
    const dirPath = path.dirname(absolutePath);

    // Check for static file serving
    // app.use(express.static('public'))
    const staticMatch = fileContent.match(/express\.static\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/);
    if (staticMatch) {
        const staticDir = path.resolve(dirPath, staticMatch[1]);
        if (fs.existsSync(staticDir)) {
            result.staticDir = path.relative(workspaceRoot, staticDir);
        }
    }

    // Check for view engine and views directory
    // app.set('views', './views')
    const viewsMatch = fileContent.match(/set\s*\(\s*['"`]views['"`]\s*,\s*['"`]([^'"`]+)['"`]\s*\)/);
    if (viewsMatch) {
        const viewsDir = path.resolve(dirPath, viewsMatch[1]);
        if (fs.existsSync(viewsDir)) {
            result.viewsDir = path.relative(workspaceRoot, viewsDir);
        }
    }

    return result;
}

/**
 * Load assets for C# class files
 */
async function loadCSharpAssets(absolutePath, fileContent, workspaceRoot) {
    const result = {};
    const dirPath = path.dirname(absolutePath);

    // Check for associated .cshtml or .razor files (same name convention)
    const baseName = path.basename(absolutePath, '.cs');

    // Check for Razor views (e.g., HomeController.cs -> Home folder)
    if (baseName.endsWith('Controller')) {
        const viewName = baseName.replace('Controller', '');
        const possibleViewPaths = [
            path.join(dirPath, '..', 'Views', viewName, 'Index.cshtml'),
            path.join(dirPath, '..', 'Views', viewName, `${viewName}.cshtml`),
            path.join(dirPath, 'Views', viewName, 'Index.cshtml')
        ];

        for (const viewPath of possibleViewPaths) {
            if (fs.existsSync(viewPath)) {
                result.view = path.relative(workspaceRoot, viewPath);
                break;
            }
        }
    }

    // Check for Razor component
    const razorPath = absolutePath.replace('.cs', '.razor');
    if (fs.existsSync(razorPath)) {
        result.razor = path.relative(workspaceRoot, razorPath);
    }

    return result;
}

/**
 * Load assets for C# view files (.cshtml, .razor)
 */
async function loadCSharpViewAssets(absolutePath, fileContent, workspaceRoot) {
    const result = {};
    const dirPath = path.dirname(absolutePath);

    // Check for associated CSS files
    const baseName = path.basename(absolutePath, path.extname(absolutePath));
    const possibleCssFiles = [
        `${baseName}.css`,
        `${baseName}.razor.css`, // Blazor scoped CSS
        path.join(dirPath, 'wwwroot', 'css', `${baseName}.css`)
    ];

    for (const cssFile of possibleCssFiles) {
        const cssPath = path.isAbsolute(cssFile) ? cssFile : path.join(dirPath, cssFile);
        if (fs.existsSync(cssPath)) {
            result.css = path.relative(workspaceRoot, cssPath);
            break;
        }
    }

    // Parse @section styles or link tags for external CSS
    const cssLinkMatch = fileContent.match(/<link[^>]+href=["']([^"']+\.css)["']/i);
    if (cssLinkMatch && !result.css) {
        const cssHref = cssLinkMatch[1];
        // Try to resolve relative to wwwroot
        const wwwrootPath = path.join(dirPath, '..', '..', 'wwwroot', cssHref.replace(/^\//, ''));
        if (fs.existsSync(wwwrootPath)) {
            result.css = path.relative(workspaceRoot, wwwrootPath);
        }
    }

    return result;
}



/**
 * Get display name for a node based on Angular entities
 * @param {Object} node - The node object
 * @param {Object} angularEntities - Angular entities from metadata
 * @returns {Object} - Object with name and type
 */
function getNodeDisplayName(node, angularEntities) {
    // Priority: Component > Service > Module > Model > Interface > File
    if (angularEntities.components && angularEntities.components.length > 0) {
        return { name: angularEntities.components[0], type: 'component' };
    }
    if (angularEntities.services && angularEntities.services.length > 0) {
        return { name: angularEntities.services[0], type: 'service' };
    }
    if (angularEntities.modules && angularEntities.modules.length > 0) {
        return { name: angularEntities.modules[0], type: 'module' };
    }
    if (angularEntities.models && angularEntities.models.length > 0) {
        return { name: angularEntities.models[0], type: 'model' };
    }
    if (angularEntities.interfaces && angularEntities.interfaces.length > 0) {
        return { name: angularEntities.interfaces[0], type: 'interface' };
    }
    // Fallback to filename
    return {
        name: node.fileName || 'unknown',
        type: 'file'
    };
}

/**
 * Check if message contains PR URL
 */
function isPRUrl(message) {
    const patterns = [
        /github\.com\/[^\/]+\/[^\/]+\/pull\/\d+/i,
        /dev\.azure\.com\/[^\/]+\/[^\/]+\/_git\/[^\/]+\/pullrequest\/\d+/i,
        /gitlab\.com\/.+\/-\/merge_requests\/\d+/i
    ];
    return patterns.some(pattern => pattern.test(message));
}

/**
 * Handle PR dependency analysis workflow
 */
async function handlePRDependencyAnalysis(prUrl, stream, token, workspaceRoot) {
    try {
        stream.markdown('## 🔍 PR Dependency Analysis\n\n');
        stream.markdown(`📌 **Analyzing PR:** ${prUrl}\n\n`);

        // Step 1: Parse PR URL
        const fetcher = new PRFileFetcher();
        const prInfo = fetcher.parsePRUrl(prUrl);

        // Step 2: Fetch PR files
        stream.markdown('⏳ Fetching PR file changes...\n\n');

        let prFiles;
        try {
            prFiles = await fetcher.fetchFiles(prInfo);
        } catch (error) {
            stream.markdown(`❌ **Error fetching PR files:** ${error.message}\n\n`);

            if (error.message.includes('token')) {
                stream.markdown('💡 **Setup Required:**\n\n');
                stream.markdown(`- Configure your ${prInfo.repoType.toUpperCase()} token in settings\n`);
                stream.markdown('- Check AIDA documentation for token setup instructions\n\n');
            }

            return;
        }

        if (!prFiles || prFiles.length === 0) {
            stream.markdown('❌ No files found in PR\n\n');
            return;
        }

        // 🧪 TEST: Filter to specific files for debugging
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
            stream.markdown('⚠️ No test files found in PR\n\n');
            return;
        }

        stream.markdown(`✅ Found **${prFiles.length} files** in PR:\n\n`);

        // Show file summary
        const added = prFiles.filter(f => f.status === 'add').length;
        const modified = prFiles.filter(f => f.status === 'edit').length;
        const deleted = prFiles.filter(f => f.status === 'delete').length;
        const renamed = prFiles.filter(f => f.status === 'rename').length;

        stream.markdown(`🟢 Added: ${added}\n`);
        stream.markdown(`🟡 Modified: ${modified}\n`);
        stream.markdown(`🔴 Deleted: ${deleted}\n`);
        if (renamed > 0) stream.markdown(`🔵 Renamed: ${renamed}\n`);
        stream.markdown('\n');

        // Step 3: Start background analysis (non-blocking)
        stream.markdown('✅ **Analysis started in background** - You can continue working!\n\n');
        stream.markdown('💡 The dependency graph will open automatically when complete.\n\n');
        stream.markdown('📊 Check the **status bar** at the bottom for progress updates.\n\n');

        // Run analysis in background without blocking chat
        performPRAnalysisInBackground(prUrl, prInfo, prFiles, workspaceRoot);

    } catch (error) {
        aidaLogging('❌ PR dependency analysis error:', error);
        stream.markdown(`❌ **Unexpected Error:** ${error.message}\n\n`);
        stream.markdown('Please check the console for details.\n\n');
    }
}

/**
 * Handle messages from graph webview
 */
async function handleGraphWebviewMessage(message, panel, graph) {
    if (message.command === 'buildSelectedNodeObject') {
        await buildSelectedNodeObject(message.nodeId, graph, panel);
    } else if (message.command === 'analyzeImpact') {
        await analyzeImpactWithAI(message.selectedNodeData, panel);
    } else if (message.command === 'analyzeDeepImpact') {
        await openImpactAnalysisWebview(message.nodeId, graph);
    } else if (message.command === 'analyzePRImpact') {
        const prContext = buildPRContextObject(graph);
        await analyzeImpactWithAI(prContext, panel);
    }
}

/**
 * Build PR Context Object for AI Analysis
 */
function buildPRContextObject(graph) {
    const prFiles = graph.nodes.filter(n => n.isPRFile).map(n => ({
        file: n.relativePath || n.fileName,
        status: n.prStatus,
        changes: n.prChanges,
        changedSymbols: n.changedSymbols
    }));

    const impactedFiles = graph.nodes.filter(n => !n.isPRFile && (n.nodeType === 'dependent' || n.nodeType === 'both')).map(n => ({
        file: n.relativePath || n.fileName,
        type: n.nodeType
    }));

    return {
        isPRAnalysis: true,
        fileName: `PR #${graph.prInfo?.prId || 'Analysis'}`,
        prSummary: graph.prSummary,
        changes: prFiles,
        impact: impactedFiles,
        symbolMap: graph.symbolToDependentsMap ? Object.fromEntries(graph.symbolToDependentsMap) : {}
    };
}

/**
 * Create webview for PR dependency graph
 */
async function createPRGraphWebview(graph, prInfo, summary) {
    try {
        const panel = vscode.window.createWebviewPanel(
            'prDependencyGraph',
            `PR Dependency Graph - ${prInfo.repoType} #${prInfo.prId}`,
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        // Generate HTML with PR-enhanced graph
        const html = generatePRGraphWebviewHtml(graph, summary, prInfo);
        panel.webview.html = html;

        // Handle messages from webview
        panel.webview.onDidReceiveMessage(
            async message => {
                await handleGraphWebviewMessage(message, panel, graph);
            },
            undefined,
            extensionContext.subscriptions
        );

    } catch (error) {
        aidaLogging('❌ Error creating PR graph webview:', error);
        vscode.window.showErrorMessage(`Failed to create graph viewer: ${error.message}`);
    }
}

/**
 * Generate HTML for PR dependency graph
 */
function generatePRGraphWebviewHtml(graph, summary, prInfo) {
    const extensionPath = extensionContext ? extensionContext.extensionPath : __dirname;

    // Read HTML template
    const htmlTemplatePath = path.join(extensionPath, 'scripts', 'dependency-graph', 'graph-view.html');
    let htmlTemplate = fs.readFileSync(htmlTemplatePath, 'utf8');

    // Read TypeScript script
    const scriptPath = path.join(extensionPath, 'scripts', 'dependency-graph', 'graph-view.ts');
    let scriptContent = fs.readFileSync(scriptPath, 'utf8');

    // 🔥 Filter graph to show only impacted nodes in PR mode
    const symbolToDependentsMap = graph.symbolToDependentsMap;
    let filteredNodes = graph.nodes;
    let filteredEdges = graph.edges;
    let impactedPaths = new Set(); // ✅ Moved outside for access in map()

    aidaLogging(`📊 Original graph: ${graph.nodes.length} nodes, ${graph.edges.length} edges`);
    aidaLogging(`📊 symbolToDependentsMap type:`, symbolToDependentsMap?.constructor?.name, 'size:', symbolToDependentsMap?.size);

    // Check if symbolToDependentsMap exists and has data (could be Map or Object)
    const hasImpactData = symbolToDependentsMap && (
        (symbolToDependentsMap instanceof Map && symbolToDependentsMap.size > 0) ||
        (typeof symbolToDependentsMap === 'object' && Object.keys(symbolToDependentsMap).length > 0)
    );

    if (hasImpactData) {
        // Collect all impacted file paths
        // impactedPaths is already defined

        // Handle both Map and Object formats
        if (symbolToDependentsMap instanceof Map) {
            for (const [symbol, files] of symbolToDependentsMap) {
                aidaLogging(`   Symbol: ${symbol} → ${files.length} files`);
                files.forEach(f => impactedPaths.add(f));
            }
        } else {
            for (const [symbol, files] of Object.entries(symbolToDependentsMap)) {
                aidaLogging(`   Symbol: ${symbol} → ${files.length} files`);
                files.forEach(f => impactedPaths.add(f));
            }
        }

        aidaLogging(`🎯 Total impacted files from symbols: ${impactedPaths.size}`);
        aidaLogging(`🎯 Impacted paths:`, Array.from(impactedPaths));

        // Keep: PR files + dependencies + actually impacted dependents
        const keepNodeIds = new Set();
        filteredNodes = graph.nodes.filter(node => {
            aidaLogging(`   Checking node: ${node.id}, type: ${node.nodeType}, isPR: ${node.isPRFile}`);

            // Always keep PR files
            if (node.isPRFile) {
                keepNodeIds.add(node.id);
                aidaLogging(`      ✅ Keep (PR file)`);
                return true;
            }
            // 🚫 HIDE dependencies in PR mode (user doesn't need to see what PR file imports)
            if (node.nodeType === 'dependency') {
                aidaLogging(`      ❌ Filter out (dependency - not needed in PR mode)`);
                return false;
            }
            // Keep dependents that are actually impacted
            if (node.nodeType === 'dependent') {
                const nodePath = node.relativePath || node.id;
                const isImpacted = impactedPaths.has(nodePath);
                aidaLogging(`      Path: ${nodePath}, Impacted: ${isImpacted}`);
                if (isImpacted) {
                    keepNodeIds.add(node.id);
                    aidaLogging(`      ✅ Keep (impacted dependent)`);
                    return true;
                }
                aidaLogging(`      ❌ Filter out (non-impacted dependent)`);
                return false;
            }
            // Handle "both" type (dependency + dependent)
            if (node.nodeType === 'both') {
                const nodePath = node.relativePath || node.id;
                const isImpacted = impactedPaths.has(nodePath);
                aidaLogging(`      Path: ${nodePath}, Impacted: ${isImpacted}`);
                if (isImpacted) {
                    keepNodeIds.add(node.id);
                    aidaLogging(`      ✅ Keep (impacted both)`);
                    return true;
                }
                aidaLogging(`      ❌ Filter out (non-impacted both)`);
                return false;
            }
            // Filter out other types by default
            aidaLogging(`      ❌ Filter out (other type)`);
            return false;
        });

        // Filter edges to only include connections between kept nodes
        filteredEdges = graph.edges.filter(edge => {
            const sourceId = edge.source.id || edge.source;
            const targetId = edge.target.id || edge.target;
            return keepNodeIds.has(sourceId) && keepNodeIds.has(targetId);
        });

        aidaLogging(`🎯 Filtered graph: ${filteredNodes.length} nodes (from ${graph.nodes.length}), ${filteredEdges.length} edges (from ${graph.edges.length})`);
    } else {
        aidaLogging(`⚠️ No impact data available, filtering to show ONLY PR files`);
        // If no impact data, we still want to hide dependencies in PR mode
        // Only show the PR files themselves
        filteredNodes = graph.nodes.filter(node => node.isPRFile);
        filteredEdges = []; // No edges if no impacts
    }

    // Prepare PR-enhanced graph data
    const graphDataJson = JSON.stringify({
        nodes: filteredNodes.map(node => {
            const angularEntities = node.metadata?.angularEntities || {};
            const primaryEntity = getNodeDisplayName(node, angularEntities);

            return {
                id: node.id,
                fileName: node.fileName || 'unknown',
                relativePath: node.relativePath || '',
                category: node.category || 'file',
                displayName: primaryEntity.name,
                entityType: primaryEntity.type,
                entities: {
                    components: angularEntities.components || [],
                    services: angularEntities.services || [],
                    modules: angularEntities.modules || [],
                    models: angularEntities.models || [],
                    interfaces: angularEntities.interfaces || []
                },
                // PR-specific metadata
                isPRFile: node.isPRFile || false,
                isHiddenImpact: !node.isPRFile && impactedPaths.has(node.relativePath || node.id), // 🔴 Mark hidden impacts
                prStatus: node.prStatus,
                prChanges: node.prChanges,
                changedSymbols: node.changedSymbols, // Add changed symbols
                nodeType: node.nodeType || 'file'
            };
        }),
        edges: filteredEdges,
        // Add PR metadata
        prMode: true,
        prInfo: {
            repoType: prInfo.repoType,
            prId: prInfo.prId,
            summary: summary
        },
        // Add symbol impact mapping for accurate dependent filtering
        symbolToDependentsMap: graph.symbolToDependentsMap ?
            Object.fromEntries(graph.symbolToDependentsMap) : null
    });

    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath || '';
    const searchTerm = `PR #${prInfo.prId}`;

    // Replace placeholders
    htmlTemplate = htmlTemplate.replace('{{SEARCH_TERM}}', searchTerm);
    htmlTemplate = htmlTemplate.replace('{{NODE_COUNT}}', filteredNodes.length);

    scriptContent = scriptContent.replace('__GRAPH_DATA__', graphDataJson);
    scriptContent = scriptContent.replace('__SEARCH_TERM__', JSON.stringify(searchTerm));
    scriptContent = scriptContent.replace('__WORKSPACE_ROOT__', JSON.stringify(workspaceRoot));

    // Inject script into HTML
    htmlTemplate = htmlTemplate.replace('/*__GRAPH_SCRIPT__*/', scriptContent);

    return htmlTemplate;
}



/**
 * Generate HTML content for filtered webview with drag support
 */
function generateFilteredGraphWebviewHtml(graph, summary, searchTerm) {
    // Get extension path from context
    const extensionPath = extensionContext ? extensionContext.extensionPath : __dirname;

    // Read HTML template
    const htmlTemplatePath = path.join(extensionPath, 'scripts', 'dependency-graph', 'graph-view.html');
    let htmlTemplate = fs.readFileSync(htmlTemplatePath, 'utf8');

    // Read TypeScript script
    const scriptPath = path.join(extensionPath, 'scripts', 'dependency-graph', 'graph-view.ts');
    let scriptContent = fs.readFileSync(scriptPath, 'utf8');

    // Replace placeholders in HTML
    htmlTemplate = htmlTemplate.replace('{{SEARCH_TERM}}', searchTerm);
    htmlTemplate = htmlTemplate.replace('{{NODE_COUNT}}', graph.nodes.length);

    // Prepare graph data with Angular entity info
    const graphDataJson = JSON.stringify({
        nodes: graph.nodes.map(node => {
            // Extract Angular entities for display
            const angularEntities = node.metadata?.angularEntities || {};
            const primaryEntity = getNodeDisplayName(node, angularEntities);

            return {
                id: node.id,
                fileName: node.fileName || 'unknown',
                relativePath: node.relativePath || '',
                category: node.category || 'file',
                displayName: primaryEntity.name,
                entityType: primaryEntity.type,
                entities: {
                    components: angularEntities.components || [],
                    services: angularEntities.services || [],
                    modules: angularEntities.modules || [],
                    models: angularEntities.models || [],
                    interfaces: angularEntities.interfaces || []
                }
            };
        }),
        edges: graph.edges
    });

    // Get workspace root for file reading in AI analysis
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath || '';

    // Replace script placeholders
    scriptContent = scriptContent.replace('__GRAPH_DATA__', graphDataJson);
    scriptContent = scriptContent.replace('__SEARCH_TERM__', JSON.stringify(searchTerm));
    scriptContent = scriptContent.replace('__WORKSPACE_ROOT__', JSON.stringify(workspaceRoot));

    // Inject script into HTML
    htmlTemplate = htmlTemplate.replace('/*__GRAPH_SCRIPT__*/', scriptContent);

    return htmlTemplate;
}

/**
 * Analyze dependencies for a single file
 */
async function analyzeFileDependency(uri) {
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

        } catch (error) {
            aidaLogging('Error analyzing file dependency:', error);
            vscode.window.showErrorMessage(`Analysis failed: ${error.message}`);
        }
    });
}

/**
 * Create webview for single file dependency graph
 */
async function createFileGraphWebview(graph, filePath) {
    try {
        const fileName = path.basename(filePath);
        const panel = vscode.window.createWebviewPanel(
            'fileDependencyGraph',
            `Dependency Graph - ${fileName}`,
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        const html = generateFileGraphWebviewHtml(graph, fileName);
        panel.webview.html = html;

        // Handle messages from webview
        panel.webview.onDidReceiveMessage(
            async message => {
                if (message.command === 'buildSelectedNodeObject') {
                    // Handle AI analysis request
                    const nodeId = message.nodeId;
                    await buildSelectedNodeObject(nodeId, graph, panel);
                }
            },
            undefined,
            extensionContext.subscriptions
        );

    } catch (error) {
        aidaLogging('❌ Error creating file graph webview:', error);
        vscode.window.showErrorMessage(`Failed to create graph viewer: ${error.message}`);
    }
}

function generateFileGraphWebviewHtml(graph, fileName) {
    const extensionPath = extensionContext ? extensionContext.extensionPath : __dirname;

    // Read HTML template
    const htmlTemplatePath = path.join(extensionPath, 'scripts', 'dependency-graph', 'graph-view.html');
    let htmlTemplate = fs.readFileSync(htmlTemplatePath, 'utf8');

    // Read TypeScript script
    const scriptPath = path.join(extensionPath, 'scripts', 'dependency-graph', 'graph-view.ts');
    let scriptContent = fs.readFileSync(scriptPath, 'utf8');

    // Prepare data for the view
    const graphData = {
        nodes: graph.nodes,
        edges: graph.edges,
        summary: graph.summary,
        mode: 'file', // Tell the view it's single file mode
        targetFile: fileName
    };

    const graphDataJson = JSON.stringify(graphData);

    // Inject data
    scriptContent = scriptContent.replace('__GRAPH_DATA__', graphDataJson);
    // Inject empty search term and workspace root
    scriptContent = scriptContent.replace('__SEARCH_TERM__', '""');
    scriptContent = scriptContent.replace('__WORKSPACE_ROOT__', '""');

    // Inject script into HTML
    htmlTemplate = htmlTemplate.replace('/*__GRAPH_SCRIPT__*/', scriptContent);

    return htmlTemplate;
}


/**
 * AI Dependency PR Analysis function for AIDA Chatbot
 * @param {string} message - PR URL message
 * @param {object} stream - Stream object for responses
 * @param {object} token - Cancellation token
 * @param {vscode.ExtensionContext} context - Extension context
 */
async function aiDependencyPrAnalysis(message, stream, token, context) {
    try {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath;
        if (!workspaceRoot) {
            stream.markdown('❌ **Error:** No workspace folder found. Please open a project folder.\n\n');
            return;
        }

        // Set cache file path
        cacheFilePath = path.join(workspaceRoot, '.vscode', 'dependency-cache.json');

        const userMessage = message.trim();

        // Track dependency PR analysis from AIDA Chatbot
        trackEvent(TrackingEvent.ANALYZE_DEPENDENCY_PR, {
            source: TrackingSource.AIDA_CHATBOT,
            aiProvider: AiProvider.AIDA_CHATBOT
        });

        if (!userMessage || !isPRUrl(userMessage)) {
            stream.markdown('## 🔍 Dependency PR Analysis\n\n');
            stream.markdown('Please provide a Pull Request URL to analyze.\n\n');
            stream.markdown('**Usage:** `@dependency-pr <pr-url>`\n\n');
            stream.markdown('**Examples:**\n');
            stream.markdown('- `@dependency-pr https://dev.azure.com/org/project/_git/repo/pullrequest/123`\n');
            stream.markdown('- `@dependency-pr https://github.com/user/repo/pull/456`\n');
            stream.markdown('- `@dependency-pr https://gitlab.com/group/repo/-/merge_requests/78`\n');
            return;
        }

        await handlePRDependencyAnalysis(userMessage, stream, token, workspaceRoot);

    } catch (error) {
        aidaLogging('❌ aiDependencyPrAnalysis error:', error);
        stream.markdown(`❌ **Error:** ${error.message}\n\n`);
    }
}

module.exports = {
    initializeDependencyGraph,
    aiDependencyAnalysis,
    aiDependencyPrAnalysis,
    analyzeFileDependency,
    activateDependencyWatcherIfCacheExists
};