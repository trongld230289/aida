const vscode = require('vscode');
const path = require('path');
const fs = require('fs');

// Import VS Code API analyzer - required
const { VSCodeApiDependencyAnalyzer } = require('./dependency-graph/vscode-api-analyzer');
const { SymbolAnalyzer } = require('./dependency-graph/symbol-analyzer');

// Import PR analysis modules
const { PRFileFetcher } = require('./pr-file-fetcher');
const { PRDependencyAnalyzer } = require('./pr-dependency-analyzer');

// Cache management
const CACHE_VERSION = '1.0';
let cacheFilePath = null;
let extensionContext = null;

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
            
            // ✅ NEW: Check if message contains PR URL
            if (isPRUrl(userMessage)) {
                await handlePRDependencyAnalysis(userMessage, stream, token, workspaceRoot);
                return;
            }
            
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
            console.error('❌ Dependency analysis error:', error);
            console.error('❌ Stack trace:', error.stack);
            stream.markdown(`❌ **Analysis Error**\n\n**Error:** ${error.message}\n\n**Debug Info:**\n- Workspace: \`${workspaceRoot || 'undefined'}\`\n- Please check console for details\n\n💡 **Fix:** Ensure the workspace folder is properly opened.`);
        }
    });

    // Set participant metadata
    dependencyParticipant.iconPath = vscode.Uri.file(
        path.join(context.extensionPath, 'icons', 'dependency-icon.svg')
    );
    
    // Remove followup provider that might be causing help responses
    // dependencyParticipant.followupProvider = null;

    return {
        dependencyParticipant,
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
        
        // Check if user explicitly requested re-analysis
        const userMessage = message.toLowerCase();
        const isReAnalyzeRequest = userMessage.includes('re-analyze') || userMessage.includes('reanalyze');
        
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
        console.error('❌ aiDependencyAnalysis error:', error);
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
            console.error('❌ Error loading cache:', error);
            vscode.window.showErrorMessage(`❌ Cache load failed: ${error.message}`);
        }
    });

    // Command to re-analyze
    const analyzeCommand = vscode.commands.registerCommand('aida.analyzeDependencies', async (workspaceRoot) => {
        try {
            // Trigger chat participant with re-analyze command
            await vscode.commands.executeCommand('workbench.action.chat.open', {
                query: '@dependency re-analyze'
            });
        } catch (error) {
            console.error('❌ Error triggering re-analysis:', error);
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
        console.log('💾 Dependency analysis cached successfully');
    } catch (error) {
        console.warn('⚠️ Failed to save cache:', error.message);
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
            console.log('🔄 Cache version mismatch, will regenerate');
            return null;
        }
        
        console.log('💾 Loaded dependency analysis from cache');
        return cacheData;
    } catch (error) {
        console.warn('⚠️ Failed to load cache:', error.message);
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
            
            console.log(`🔍 Graph validation: ${graph.nodes.length} nodes, ${graph.edges.length} edges`);
            
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
            console.error('❌ Background analysis error:', error);
            console.error('❌ Stack trace:', error.stack);
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
    console.log(`📊 Creating webview with data:`, {
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
    
    console.log(`✅ Webview created with ${graph.nodes.length} nodes, ${graph.edges.length} edges`);
}



/**
 * Build complete selected node object with all CSS/HTML assets
 */
async function buildSelectedNodeObject(nodeId, graph, panel) {
    try {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath;
        if (!workspaceRoot) {
            console.error('No workspace root found');
            return;
        }

        const selectedNode = graph.nodes.find(n => n.id === nodeId);
        if (!selectedNode) {
            console.error('Node not found:', nodeId);
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
            if (fileName.endsWith('.ts') || fileName.endsWith('.tsx')) {
                // Angular or React TypeScript
                if (fileContent.includes('@Component') || fileContent.includes('templateUrl')) {
                    // Angular component
                    Object.assign(result, await loadAngularAssets(absolutePath, fileContent, workspaceRoot));
                } else if (fileName.endsWith('.tsx') || fileContent.includes('import React')) {
                    // React component
                    Object.assign(result, await loadReactAssets(absolutePath, fileContent, workspaceRoot));
                }
            } else if (fileName.endsWith('.jsx') || fileName.endsWith('.js')) {
                // JavaScript - React or Node.js
                if (fileContent.includes('import React') || fileContent.includes('from \'react\'')) {
                    Object.assign(result, await loadReactAssets(absolutePath, fileContent, workspaceRoot));
                } else {
                    Object.assign(result, await loadNodeJsAssets(absolutePath, fileContent, workspaceRoot));
                }
            } else if (fileName.endsWith('.cs')) {
                // C# file
                Object.assign(result, await loadCSharpAssets(absolutePath, fileContent, workspaceRoot));
            } else if (fileName.endsWith('.cshtml') || fileName.endsWith('.razor')) {
                // C# view files
                Object.assign(result, await loadCSharpViewAssets(absolutePath, fileContent, workspaceRoot));
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

        console.log('\n🎯 Selected Node Object:', JSON.stringify(selectedNodeObject, null, 2));

        // Send to AI for analysis
        await analyzeImpactWithAI(selectedNodeObject, panel);

        return selectedNodeObject;

    } catch (error) {
        console.error('❌ Error building selected node object:', error);
        return null;
    }
}

/**
 * Analyze impact with AI using selected node data
 */
async function analyzeImpactWithAI(selectedNodeData, panel) {
    try {
        // Import review-common for executeAIReview and getUnifiedModel
        const { executeAIReview, getUnifiedModel } = require('./review-common');
        
        // Build a simple, non-technical prompt for AI
        const prompt = `You are analyzing a code change impact. A developer wants to modify a file and needs to know what to test.

**File being modified:** ${selectedNodeData.fileName}

**This file uses these components/modules (${selectedNodeData.dependencies.length} dependencies):**
${selectedNodeData.dependencies.map(dep => {
    let parts = [`- ${dep.main}`];
    if (dep.html) parts.push(`(has UI template: ${dep.html})`);
    if (dep.css) parts.push(`(has styles: ${dep.css})`);
    return parts.join(' ');
}).join('\n')}

**These components/modules depend on this file (${selectedNodeData.dependents.length} dependents):**
${selectedNodeData.dependents.map(dep => {
    let parts = [`- ${dep.main}`];
    if (dep.html) parts.push(`(has UI template: ${dep.html})`);
    if (dep.css) parts.push(`(has styles: ${dep.css})`);
    return parts.join(' ');
}).join('\n')}

Please provide a simple, easy-to-understand analysis for a QA tester or project manager (non-technical user):

1. **What features should be tested?** - List specific user-facing features that could break
2. **Which pages/screens need checking?** - Identify UI areas to verify
3. **Risk level:** High/Medium/Low and why
4. **Testing priority:** What to test first

Keep the language simple and focus on USER IMPACT, not technical details.`;

        console.log('🤖 Sending to AI for analysis...');
        console.log('📋 Prompt:', prompt);

        // Create a stream object to collect AI response
        let aiResponse = '';
        const mockStream = {
            markdown: (text) => {
                // Strip markdown formatting and accumulate response
                aiResponse += text;
            },
            progress: (text) => {
                console.log('Progress:', text);
            }
        };

        // Get current selected model using getUnifiedModel (same as review-changes)
        const model = await getUnifiedModel(mockStream, null, null, null);

        // Use executeAIReview which handles both Copilot and API key modes
        const success = await executeAIReview(prompt, model, mockStream, 'Impact Analysis', 0, null, null);

        if (success) {
            console.log('✅ AI Response received, length:', aiResponse.length);
            
            // Clean up the response - remove markdown decorations that we added
            let cleanResponse = aiResponse
                .replace(/^---\n\n/, '') // Remove leading separator
                .replace(/\n\n---\n\n$/, '') // Remove trailing separator
                .replace(/🤖 \*\*Streaming.*?\*\*.*?\n\n/gs, '') // Remove streaming header
                .replace(/\n\n---\n\n📊 \*\*Token Usage Summary:\*\*[\s\S]*$/g, '') // Remove token stats section
                .replace(/💰 \*\*Cost.*?\*\*[\s\S]*$/g, '') // Remove cost footer
                .trim();

            console.log('📤 Sending AI response to webview for nodeId:', selectedNodeData.originalNodeId);

            // Send response back to webview using ORIGINAL nodeId for matching
            panel.webview.postMessage({
                command: 'aiAnalysisComplete',
                nodeId: selectedNodeData.originalNodeId, // Use original nodeId from graph
                analysis: cleanResponse
            });
        } else {
            throw new Error('AI analysis failed');
        }

    } catch (error) {
        console.error('❌ Error analyzing with AI:', error);
        panel.webview.postMessage({
            command: 'aiAnalysisError',
            nodeId: selectedNodeData.originalNodeId || selectedNodeData.id, // Fallback to id
            error: error.message
        });
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
                console.error('Impact analysis error:', error);
                panel.webview.postMessage({
                    command: 'error',
                    error: error.message
                });
            }
        };

        // Start analysis immediately
        await runAnalysis();

    } catch (error) {
        console.error('Error opening impact analysis:', error);
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
        
        stream.markdown(`✅ Detected **${prInfo.repoType.toUpperCase()}** PR\n\n`);
        
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
        
        stream.markdown(`✅ Found **${prFiles.length} files** in PR (filtered for testing):\n\n`);
        
        // Show file summary
        const added = prFiles.filter(f => f.status === 'add').length;
        const modified = prFiles.filter(f => f.status === 'edit').length;
        const deleted = prFiles.filter(f => f.status === 'delete').length;
        const renamed = prFiles.filter(f => f.status === 'rename').length;
        
        stream.markdown(`- ➕ Added: ${added}\n`);
        stream.markdown(`- ✏️ Modified: ${modified}\n`);
        stream.markdown(`- ❌ Deleted: ${deleted}\n`);
        if (renamed > 0) stream.markdown(`- ↔️ Renamed: ${renamed}\n`);
        stream.markdown('\n');
        
        // Step 3: Analyze dependencies for PR files
        stream.markdown('🔗 Analyzing dependencies and dependents...\n\n');
        
        const analyzer = new PRDependencyAnalyzer(workspaceRoot);
        let graph;
        
        try {
            graph = await analyzer.analyzePRFiles(prFiles);
        } catch (error) {
            stream.markdown(`❌ **Analysis Error:** ${error.message}\n\n`);
            
            if (error.message.includes('cache') || error.message.includes('graph')) {
                stream.markdown('💡 **Tip:** Run `@dependency` first to build the workspace dependency cache\n\n');
            }
            
            return;
        }
        
        // Step 4: Show extracted symbols with impact analysis
        stream.markdown('✨ **Symbol Extraction Results:**\n\n');
        
        const prNodesWithSymbols = graph.nodes.filter(n => n.isPRFile);
        
        if (prNodesWithSymbols.length === 0) {
            stream.markdown('ℹ️ No PR files found\n\n');
        }
        
        let totalSymbols = 0;
        const symbolToDependentsMap = graph.symbolToDependentsMap || new Map();
        
        for (const prNode of prNodesWithSymbols) {
            stream.markdown(`📄 **File:** ${prNode.prPath}\n\n`);
            
            if (!prNode.changedSymbols || prNode.changedSymbols.length === 0) {
                stream.markdown('  ℹ️ No symbols extracted\n\n');
                continue;
            }
            
            stream.markdown(`🔤 **Symbols (${prNode.changedSymbols.length}):**\n\n`);
            
            for (const symbol of prNode.changedSymbols) {
                // Handle both string and object formats
                const symbolName = typeof symbol === 'string' ? symbol : symbol.fullName;
                const symbolType = typeof symbol === 'object' ? symbol.type : 'unknown';
                
                stream.markdown(`  - \`${symbolName}\` _(${symbolType})_`);
                
                // Show impacted files for this symbol
                const impactedFiles = symbolToDependentsMap.get(symbolName) || [];
                if (impactedFiles.length > 0) {
                    stream.markdown(` → **${impactedFiles.length} files**`);
                }
                
                stream.markdown('\n');
                totalSymbols++;
            }
            
            stream.markdown('\n');
        }
        
        // Step 5: Show Impact Analysis Summary
        stream.markdown('\n---\n\n');
        stream.markdown('📊 **Impact Analysis Summary:**\n\n');
        stream.markdown(`- **Changed Symbols:** ${totalSymbols}\n`);
        stream.markdown(`- **Total Files Analyzed:** ${graph.nodes.length}\n`);
        stream.markdown(`- **Impacted Files:** ${graph.nodes.filter(n => n.nodeType === 'dependent').length}\n`);
        stream.markdown(`- **Dependencies:** ${graph.nodes.filter(n => n.nodeType === 'dependency').length}\n\n`);
        
        // Show top impacted symbols
        if (symbolToDependentsMap.size > 0) {
            stream.markdown('🔥 **Top Impacted Symbols:**\n\n');
            
            const sortedSymbols = Array.from(symbolToDependentsMap.entries())
                .sort((a, b) => b[1].length - a[1].length)
                .slice(0, 5);
            
            for (const [symbolName, dependents] of sortedSymbols) {
                const impactLevel = dependents.length > 5 ? '🔴 HIGH' : 
                                  dependents.length > 2 ? '🟡 MEDIUM' : '🟢 LOW';
                stream.markdown(`  ${impactLevel} \`${symbolName}\` → **${dependents.length} files**\n`);
                
                // Show first 3 impacted files
                const preview = dependents.slice(0, 3);
                for (const file of preview) {
                    const fileName = file.split('/').pop();
                    stream.markdown(`    - ${fileName}\n`);
                }
                if (dependents.length > 3) {
                    stream.markdown(`    - _...and ${dependents.length - 3} more_\n`);
                }
                stream.markdown('\n');
            }
        } else {
            stream.markdown('✅ **No external files impacted** (low risk change)\n\n');
        }
        
        // Step 6: Display graph
        stream.markdown('\n🎨 Opening graph viewer...\n\n');
        
        const summary = graph.prSummary;
        await createPRGraphWebview(graph, prInfo, summary);
        
        stream.markdown('✅ **Graph viewer opened!** Check the new tab for visual analysis.\n\n');
        
    } catch (error) {
        console.error('❌ PR dependency analysis error:', error);
        stream.markdown(`❌ **Unexpected Error:** ${error.message}\n\n`);
        stream.markdown('Please check the console for details.\n\n');
    }
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
        console.error('❌ Error creating PR graph webview:', error);
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
    
    console.log(`📊 Original graph: ${graph.nodes.length} nodes, ${graph.edges.length} edges`);
    console.log(`📊 symbolToDependentsMap type:`, symbolToDependentsMap?.constructor?.name, 'size:', symbolToDependentsMap?.size);
    
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
                console.log(`   Symbol: ${symbol} → ${files.length} files`);
                files.forEach(f => impactedPaths.add(f));
            }
        } else {
            for (const [symbol, files] of Object.entries(symbolToDependentsMap)) {
                console.log(`   Symbol: ${symbol} → ${files.length} files`);
                files.forEach(f => impactedPaths.add(f));
            }
        }
        
        console.log(`🎯 Total impacted files from symbols: ${impactedPaths.size}`);
        console.log(`🎯 Impacted paths:`, Array.from(impactedPaths));
        
        // Keep: PR files + dependencies + actually impacted dependents
        const keepNodeIds = new Set();
        filteredNodes = graph.nodes.filter(node => {
            console.log(`   Checking node: ${node.id}, type: ${node.nodeType}, isPR: ${node.isPRFile}`);
            
            // Always keep PR files
            if (node.isPRFile) {
                keepNodeIds.add(node.id);
                console.log(`      ✅ Keep (PR file)`);
                return true;
            }
            // 🚫 HIDE dependencies in PR mode (user doesn't need to see what PR file imports)
            if (node.nodeType === 'dependency') {
                console.log(`      ❌ Filter out (dependency - not needed in PR mode)`);
                return false;
            }
            // Keep dependents that are actually impacted
            if (node.nodeType === 'dependent') {
                const nodePath = node.relativePath || node.id;
                const isImpacted = impactedPaths.has(nodePath);
                console.log(`      Path: ${nodePath}, Impacted: ${isImpacted}`);
                if (isImpacted) {
                    keepNodeIds.add(node.id);
                    console.log(`      ✅ Keep (impacted dependent)`);
                    return true;
                }
                console.log(`      ❌ Filter out (non-impacted dependent)`);
                return false;
            }
            // Handle "both" type (dependency + dependent)
            if (node.nodeType === 'both') {
                const nodePath = node.relativePath || node.id;
                const isImpacted = impactedPaths.has(nodePath);
                console.log(`      Path: ${nodePath}, Impacted: ${isImpacted}`);
                if (isImpacted) {
                    keepNodeIds.add(node.id);
                    console.log(`      ✅ Keep (impacted both)`);
                    return true;
                }
                console.log(`      ❌ Filter out (non-impacted both)`);
                return false;
            }
            // Filter out other types by default
            console.log(`      ❌ Filter out (other type)`);
            return false;
        });
        
        // Filter edges to only include connections between kept nodes
        filteredEdges = graph.edges.filter(edge => {
            const sourceId = edge.source.id || edge.source;
            const targetId = edge.target.id || edge.target;
            return keepNodeIds.has(sourceId) && keepNodeIds.has(targetId);
        });
        
        console.log(`🎯 Filtered graph: ${filteredNodes.length} nodes (from ${graph.nodes.length}), ${filteredEdges.length} edges (from ${graph.edges.length})`);
    } else {
        console.log(`⚠️ No impact data available, filtering to show ONLY PR files`);
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
    htmlTemplate = htmlTemplate.replace('{{NODE_COUNT}}', graph.nodes.length);
    
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


module.exports = {
    initializeDependencyGraph,
    aiDependencyAnalysis
};