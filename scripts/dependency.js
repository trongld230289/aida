const vscode = require('vscode');
const path = require('path');
const fs = require('fs');

// Import dependency analyzers
const DependencyAnalyzer = require('./dependency-graph/index').DependencyAnalyzer;

// Import VS Code API analyzer - with error handling
let VSCodeApiDependencyAnalyzer;
try {
    VSCodeApiDependencyAnalyzer = require('./dependency-graph/vscode-api-analyzer').VSCodeApiDependencyAnalyzer;
} catch (error) {
    console.warn('⚠️ VS Code API analyzer not available, using fallback:', error.message);
    VSCodeApiDependencyAnalyzer = null;
}

// Cache management
const CACHE_VERSION = '1.0';
let cacheFilePath = null;

/**
 * Initialize dependency graph functionality
 * @param {vscode.ExtensionContext} context
 * @returns {object} - Chat participant and related functions
 */
function initializeDependencyGraph(context) {
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
            
            // Check for existing cache
            const cacheExists = await checkCacheExists();
            
            if (cacheExists) {
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
                
                stream.markdown('\n\n💡 **Tip:** Cache loads instantly, re-analysis takes 30-60 seconds but shows latest changes.');
                
            } else {
                // No cache - analyze directly
                stream.markdown('🔍 **No cache found** - Starting fresh analysis...\n\n');
                await performDependencyAnalysis(workspaceRoot, stream);
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
            // Show progress notification
            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "🔍 Analyzing Dependencies",
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 0, message: "Starting analysis..." });
                
                const result = await performDependencyAnalysisWithProgress(workspaceRoot, progress);
                
                if (result) {
                    vscode.window.showInformationMessage('✅ Dependency analysis complete!');
                }
            });
        } catch (error) {
            console.error('❌ Error analyzing dependencies:', error);
            vscode.window.showErrorMessage(`❌ Analysis failed: ${error.message}`);
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
 * Perform dependency analysis (extracted from main function)
 */
async function performDependencyAnalysis(workspaceRoot, stream) {
    // Choose analyzer based on availability
    let analyzer, analysisType;
    
    if (VSCodeApiDependencyAnalyzer) {
        analyzer = new VSCodeApiDependencyAnalyzer(workspaceRoot);
        analysisType = 'VS Code API (Symbol Crawling)';
        if (stream) stream.progress('🔍 Using VS Code Language Server APIs...');
    } else {
        analyzer = new DependencyAnalyzer(workspaceRoot);
        analysisType = 'Enhanced File Analysis';
        if (stream) stream.progress('📊 Using enhanced file analysis...');
    }
    
    if (stream) stream.progress('📊 Generating dependency graph...');
    const graph = VSCodeApiDependencyAnalyzer && analyzer instanceof VSCodeApiDependencyAnalyzer 
        ? await analyzer.analyze() 
        : analyzer.analyze();
    
    if (stream) stream.progress('📈 Calculating metrics...');
    const report = analyzer.generateReport(graph);
    
    // Validate graph data
    if (!graph || !graph.nodes || !Array.isArray(graph.nodes)) {
        throw new Error('Invalid graph data: missing or invalid nodes array');
    }
    if (!graph.edges || !Array.isArray(graph.edges)) {
        throw new Error('Invalid graph data: missing or invalid edges array');  
    }
    
    console.log(`🔍 Graph validation: ${graph.nodes.length} nodes, ${graph.edges.length} edges`);
    
    // Save to cache
    await saveToCache(graph, report, analysisType);
    
    // Create webview
    await createWebviewFromData(graph, report, analysisType);
    
    // Send confirmation message if stream provided
    if (stream) {
        stream.markdown(`## 🔍 Dependency Analysis Complete
            
✅ **${analysisType}** for: \`all modules\`
• Found: **${graph.nodes.length}** modules  
• Connections: **${graph.edges.length}** dependencies
• Analyzed with: **${analysisType}**
• 💾 **Cached** for faster future loads

**Analysis Method:**
${VSCodeApiDependencyAnalyzer && analyzer instanceof VSCodeApiDependencyAnalyzer ? 
`• 🔍 **Language Server APIs** - leveraging existing extensions
• 🎯 **Symbol Resolution** - accurate import tracking  
• ⚡ **Multi-language** - TS, JS, C#, Java, Python
• 🚀 **Real-time** - using IDE's language services` :
`• 📁 **File Parsing** - regex-based analysis
• 🔍 **Import Detection** - static analysis
• 📊 **Basic Metrics** - standard dependency tracking`}

**Features available in webview:**
• 🔍 **Search** components/services by name
• 🎯 **Click nodes** to view impact analysis  
• ↔️ **Drag divider** to resize panels
• 🔄 **Pan & zoom** to navigate graph

Perfect for QC impact analysis! 🎯`
        );
    }
    
    return { graph, report, analysisType };
}

/**
 * Perform analysis with progress reporting
 */
async function performDependencyAnalysisWithProgress(workspaceRoot, progress) {
    progress.report({ increment: 10, message: "Initializing analyzer..." });
    
    let analyzer, analysisType;
    if (VSCodeApiDependencyAnalyzer) {
        analyzer = new VSCodeApiDependencyAnalyzer(workspaceRoot);
        analysisType = 'VS Code API (Symbol Crawling)';
    } else {
        analyzer = new DependencyAnalyzer(workspaceRoot);
        analysisType = 'Enhanced File Analysis';
    }
    
    progress.report({ increment: 30, message: "Scanning files and analyzing dependencies..." });
    const graph = VSCodeApiDependencyAnalyzer && analyzer instanceof VSCodeApiDependencyAnalyzer 
        ? await analyzer.analyze() 
        : analyzer.analyze();
    
    progress.report({ increment: 70, message: "Calculating metrics..." });
    const report = analyzer.generateReport(graph);
    
    progress.report({ increment: 90, message: "Saving cache and creating visualization..." });
    await saveToCache(graph, report, analysisType);
    await createWebviewFromData(graph, report, analysisType);
    
    progress.report({ increment: 100, message: "Complete!" });
    return { graph, report, analysisType };
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
    
    console.log(`✅ Webview created with ${graph.nodes.length} nodes, ${graph.edges.length} edges`);
}

/**
 * Limit graph size for webview performance by keeping most connected nodes
 */
function limitGraphSize(graph, maxNodes) {
    // Calculate connection counts for each node
    const connectionCounts = {};
    
    // Count connections for each node
    graph.nodes.forEach(node => {
        connectionCounts[node.id] = (node.dependencies || []).length + (node.dependents || []).length;
    });
    
    // Sort nodes by connection count (most connected first)
    const sortedNodes = graph.nodes
        .sort((a, b) => (connectionCounts[b.id] || 0) - (connectionCounts[a.id] || 0))
        .slice(0, maxNodes);
    
    // Get IDs of selected nodes
    const selectedNodeIds = new Set(sortedNodes.map(node => node.id));
    
    // Filter edges to only include connections between selected nodes
    const filteredEdges = graph.edges.filter(edge => 
        selectedNodeIds.has(edge.source) && selectedNodeIds.has(edge.target)
    );
    
    return {
        nodes: sortedNodes,
        edges: filteredEdges,
        metadata: {
            ...graph.metadata,
            filtered: true,
            originalSize: graph.nodes.length,
            limitedSize: sortedNodes.length
        }
    };
}

/**
 * Filter graph to focus on specific search term
 */
function filterGraphBySearchTerm(graph, searchTerm) {
    const matchingNodes = graph.nodes.filter(node => {
        const fileName = (node.fileName || path.basename(node.filePath || '')).toLowerCase();
        const relativePath = (node.relativePath || '').toLowerCase();
        return fileName.includes(searchTerm) || relativePath.includes(searchTerm);
    });

    if (matchingNodes.length === 0) {
        return { nodes: [], edges: [] };
    }

    // Include direct dependencies and dependents
    const nodeIds = new Set(matchingNodes.map(n => n.id));
    
    // Add direct dependencies and dependents
    graph.edges.forEach(edge => {
        if (nodeIds.has(edge.source)) {
            const targetNode = graph.nodes.find(n => n.id === edge.target);
            if (targetNode) nodeIds.add(edge.target);
        }
        if (nodeIds.has(edge.target)) {
            const sourceNode = graph.nodes.find(n => n.id === edge.source);
            if (sourceNode) nodeIds.add(edge.source);
        }
    });

    const filteredNodes = graph.nodes.filter(node => nodeIds.has(node.id));
    const filteredEdges = graph.edges.filter(edge => 
        nodeIds.has(edge.source) && nodeIds.has(edge.target)
    );

    return {
        nodes: filteredNodes,
        edges: filteredEdges
    };
}

/**
 * Find node by partial name match
 */
function findNodeByName(graph, searchName) {
    const searchLower = searchName.toLowerCase();
    
    // First try exact match
    let found = graph.nodes.find(node => {
        const fileName = (node.fileName || path.basename(node.filePath || '')).toLowerCase();
        return fileName === searchLower || fileName === searchLower + '.ts' || fileName === searchLower + '.js';
    });
    
    // Then try partial match
    if (!found) {
        found = graph.nodes.find(node => {
            const fileName = (node.fileName || path.basename(node.filePath || '')).toLowerCase();
            const relativePath = (node.relativePath || '').toLowerCase();
            return fileName.includes(searchLower) || relativePath.includes(searchLower);
        });
    }
    
    return found;
}

/**
 * Find similar modules for suggestions
 */
function findSimilarModules(graph, searchName) {
    const searchLower = searchName.toLowerCase();
    return graph.nodes
        .filter(node => {
            const fileName = (node.fileName || path.basename(node.filePath || '')).toLowerCase();
            return fileName.includes(searchLower) || 
                   levenshteinDistance(fileName, searchLower) <= 3;
        })
        .map(node => node.fileName || path.basename(node.filePath || node.id))
        .slice(0, 8);
}

/**
 * Calculate Levenshtein distance for fuzzy matching
 */
function levenshteinDistance(str1, str2) {
    const matrix = [];
    for (let i = 0; i <= str2.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= str1.length; j++) {
        matrix[0][j] = j;
    }
    for (let i = 1; i <= str2.length; i++) {
        for (let j = 1; j <= str1.length; j++) {
            if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }
    return matrix[str2.length][str1.length];
}

/**
 * Analyze module impact (dependencies and dependents)
 */
function analyzeModuleImpact(graph, targetNode) {
    const directDependencies = [];
    const directDependents = [];
    const transitiveImpact = new Set();
    
    // Find direct dependencies (what this module imports)
    graph.edges.forEach(edge => {
        if (edge.source === targetNode.id) {
            directDependencies.push(edge.target);
        }
        if (edge.target === targetNode.id) {
            directDependents.push(edge.source);
        }
    });
    
    // Find transitive impact (recursive dependencies)
    const visited = new Set();
    const findTransitiveImpact = (nodeId, depth = 0) => {
        if (visited.has(nodeId) || depth > 5) return; // Prevent infinite loops and deep recursion
        visited.add(nodeId);
        transitiveImpact.add(nodeId);
        
        graph.edges.forEach(edge => {
            if (edge.target === nodeId) {
                findTransitiveImpact(edge.source, depth + 1);
            }
        });
    };
    
    directDependents.forEach(depId => findTransitiveImpact(depId));
    
    return {
        directDependencies,
        directDependents,
        transitiveImpact: Array.from(transitiveImpact).filter(id => id !== targetNode.id)
    };
}

/**
 * Build focused graph for impact analysis
 */
function buildImpactGraph(graph, targetNode, impact) {
    const relevantNodeIds = new Set([
        targetNode.id,
        ...impact.directDependencies,
        ...impact.directDependents.slice(0, 10), // Limit dependents
        ...Array.from(impact.transitiveImpact).slice(0, 5) // Limit transitive
    ]);
    
    const nodes = graph.nodes.filter(node => relevantNodeIds.has(node.id));
    const edges = graph.edges.filter(edge => 
        relevantNodeIds.has(edge.source) && relevantNodeIds.has(edge.target)
    );
    
    return { nodes, edges };
}

/**
 * Calculate impact radius (max depth of dependencies)
 */
function calculateImpactRadius(impact) {
    return Math.max(
        impact.directDependencies.length > 0 ? 1 : 0,
        impact.directDependents.length > 0 ? 1 : 0,
        impact.transitiveImpact.length > 0 ? 2 : 0
    );
}

/**
 * Generate Mermaid diagram for filtered results
 */
function generateFilteredMermaidDiagram(graph, searchTerm) {
    if (graph.nodes.length === 0) {
        return 'graph TD\n    NotFound["❌ No modules found matching: ' + searchTerm + '"]';
    }
    
    return generateAdvancedMermaidDiagram(graph, {
        highlightSearch: searchTerm,
        maxNodes: 50 // Show more nodes for filtered view
    });
}

/**
 * Generate Mermaid diagram for impact analysis
 */
function generateImpactMermaidDiagram(graph, targetNode) {
    return generateAdvancedMermaidDiagram(graph, {
        highlightNode: targetNode.id,
        showImpactColors: true,
        maxNodes: 30
    });
}

/**
 * Generate advanced Mermaid diagram with highlighting options
 */
function generateAdvancedMermaidDiagram(graph, options = {}) {
    const nodes = graph.nodes || [];
    const edges = graph.edges || [];
    const maxNodes = options.showAll ? nodes.length : (options.maxNodes || 20);
    
    // For webview, we want to show all nodes for full interactivity
    const isWebview = options.forWebview || false;
    const nodeLimit = isWebview ? nodes.length : maxNodes;
    
    // Select nodes based on connections (prioritize most connected)
    const nodeConnections = nodes.map(node => ({
        ...node,
        connectionCount: edges.filter(e => e.source === node.id || e.target === node.id).length
    })).sort((a, b) => b.connectionCount - a.connectionCount);
    
    const selectedNodes = nodeConnections.slice(0, nodeLimit);
    const selectedNodeIds = new Set(selectedNodes.map(n => n.id));
    
    // Create clean name mapping
    const nodeIdToCleanName = new Map();
    selectedNodes.forEach(node => {
        const fileName = node.fileName || node.relativePath || path.basename(node.filePath || 'unknown');
        const cleanName = fileName.replace(/[^\w\-]/g, '_').replace(/^_+|_+$/g, '') || `file_${node.id}`;
        nodeIdToCleanName.set(node.id, cleanName);
    });
    
    // Generate nodes with highlighting
    const mermaidNodes = selectedNodes.map((node) => {
        const fileName = node.fileName || node.relativePath || path.basename(node.filePath || 'unknown');
        const cleanName = nodeIdToCleanName.get(node.id);
        const displayName = fileName.length > 25 ? fileName.substring(0, 22) + '...' : fileName;
        
        let nodeStyle = '';
        if (options.highlightNode === node.id) {
            nodeStyle = ':::highlight';
        } else if (options.highlightSearch && fileName.toLowerCase().includes(options.highlightSearch.toLowerCase())) {
            nodeStyle = ':::searchMatch';
        } else {
            // Assign style based on node category
            switch (node.category || node.type) {
                case 'component': nodeStyle = ':::component'; break;
                case 'service': nodeStyle = ':::service'; break;
                case 'module': nodeStyle = ':::module'; break;
                case 'model': nodeStyle = ':::model'; break;
                default: nodeStyle = '';
            }
        }
        
        return `    ${cleanName}["${displayName}"]${nodeStyle}`;
    }).join('\n');
    
    // For webview, limit edges to prevent overcrowding but show more than text view
    const edgeLimit = isWebview ? Math.min(200, edges.length) : 40;
    const relevantEdges = edges.filter(edge => 
        selectedNodeIds.has(edge.source) && selectedNodeIds.has(edge.target)
    ).slice(0, edgeLimit);
    
    const mermaidEdges = relevantEdges.map(edge => {
        const sourceClean = nodeIdToCleanName.get(edge.source);
        const targetClean = nodeIdToCleanName.get(edge.target);
        if (sourceClean && targetClean) {
            return `    ${sourceClean} --> ${targetClean}`;
        }
        return null;
    }).filter(Boolean).join('\n');
    
    // Generate style definitions
    const styleDefinitions = [
        'classDef highlight fill:#ff6b6b,stroke:#fff,stroke-width:3px,color:#fff',
        'classDef searchMatch fill:#4ecdc4,stroke:#fff,stroke-width:2px,color:#fff',
        'classDef component fill:#45b7d1,stroke:#fff,stroke-width:1px,color:#fff',
        'classDef service fill:#96ceb4,stroke:#fff,stroke-width:1px,color:#fff',
        'classDef module fill:#ffeaa7,stroke:#fff,stroke-width:1px,color:#333'
    ].join('\n    ');
    
    const showMoreText = nodes.length > nodeLimit ? `More["📁 ${nodes.length - nodeLimit} more files..."]` : '';
    
    return [
        'graph TD',
        mermaidNodes,
        mermaidEdges,
        `    ${styleDefinitions}`,
        showMoreText
    ].filter(Boolean).join('\n');
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
 * Open filtered dependency graph in webview
 */
function openFilteredGraphWebview(filteredGraph, summary, searchTerm) {
    try {
        // Only require vscode when actually needed in VS Code environment
        let vscode;
        try {
            vscode = require('vscode');
        } catch (e) {
            throw new Error('vscode module not available - this function requires VS Code environment');
        }
        
        // Create webview panel
        const panel = vscode.window.createWebviewPanel(
            'dependencyGraphFiltered',
            `Dependency Graph: ${searchTerm}`,
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        // Generate HTML content with filtered graph
        const htmlContent = generateFilteredGraphWebviewHtml(filteredGraph, summary, searchTerm);
        panel.webview.html = htmlContent;

        // Handle messages from webview
        panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'showNodeDetails':
                        vscode.window.showInformationMessage(`Node: ${message.nodeId}`);
                        break;
                    case 'openFile':
                        if (message.filePath) {
                            vscode.workspace.openTextDocument(message.filePath)
                                .then(doc => vscode.window.showTextDocument(doc));
                        }
                        break;
                }
            },
            undefined,
            []
        );

        return {
            type: 'success',
            title: `🔍 Filtered Graph Webview: "${searchTerm}"`,
            content: [
                `✅ Interactive filtered graph opened for: \`${searchTerm}\``,
                `• Found: ${filteredGraph.nodes.length} related modules`,
                `• Connections: ${filteredGraph.edges.length} dependencies`,
                '',
                '**Features:**',
                '• Drag nodes to rearrange layout',
                '• Pan and zoom with mouse',
                '• Search within filtered results',
                '• Click nodes for impact analysis'
            ].join('\n'),
            actions: [
                { label: 'Show Full Graph', command: '@dependency graph webview' }
            ]
        };
    } catch (error) {
        console.error('Error opening filtered webview:', error);
        return {
            type: 'error',
            title: '❌ Webview Error',
            content: `Failed to open filtered webview: ${error.message}`,
            actions: [
                { label: 'Try Text Graph', command: `@dependency graph search ${searchTerm}` }
            ]
        };
    }
}

/**
 * Open dependency graph in webview
 */
function openGraphWebview(graph, summary) {
    try {
        // Only require vscode when actually needed in VS Code environment
        let vscode;
        try {
            vscode = require('vscode');
        } catch (e) {
            throw new Error('vscode module not available - this function requires VS Code environment');
        }
        
        // Create webview panel
        const panel = vscode.window.createWebviewPanel(
            'dependencyGraph',
            'Dependency Graph Viewer',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        // Generate HTML content with ALL nodes for webview
        const htmlContent = generateGraphWebviewHtml(graph, summary, { showAll: true });
        panel.webview.html = htmlContent;

        // Handle messages from webview
        panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'showNodeDetails':
                        vscode.window.showInformationMessage(`Node: ${message.nodeId}`);
                        break;
                    case 'openFile':
                        if (message.filePath) {
                            vscode.workspace.openTextDocument(message.filePath)
                                .then(doc => vscode.window.showTextDocument(doc));
                        }
                        break;
                }
            },
            undefined,
            []
        );

        return {
            type: 'success',
            title: '🚀 Dependency Graph Webview Opened',
            content: [
                '✅ Interactive dependency graph opened in new panel!',
                '',
                '**Features:**',
                '• Interactive Mermaid diagram',
                '• Click nodes to see details',
                '• Zoom and pan support',
                '• Search and filter capabilities',
                '• Export options'
            ].join('\n'),
            actions: [
                { label: 'Refresh Graph', command: '@dependency graph webview' }
            ]
        };
    } catch (error) {
        console.error('Error opening webview:', error);
        return {
            type: 'error',
            title: '❌ Webview Error',
            content: `Failed to open webview: ${error.message}`,
            actions: [
                { label: 'Try Text Graph', command: '@dependency graph' }
            ]
        };
    }
}

/**
 * Generate HTML content for filtered webview with drag support
 */
function generateFilteredGraphWebviewHtml(graph, summary, searchTerm) {
    const mermaidDiagram = generateFilteredMermaidDiagram(graph, searchTerm);
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dependency Graph - ${searchTerm}</title>
    <script src="https://d3js.org/d3.v7.min.js"></script>
    <style>
        body {
            margin: 0;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: #1e1e1e;
            color: #cccccc;
            display: flex;
            height: 100vh;
        }
        .main-container {
            display: flex;
            width: 100%;
            height: 100vh;
            position: relative;
        }
        .left-panel {
            width: 65%;
            padding: 20px;
            overflow: hidden;
            min-width: 300px;
            position: relative;
        }
        .resizer {
            width: 4px;
            background: transparent;
            cursor: col-resize;
            position: relative;
            flex-shrink: 0;
            border-left: 1px solid #3c3c3c;
        }
        .resizer:hover {
            background: #007acc;
            border-left: 1px solid #007acc;
        }
        .resizer::after {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
        }
        .right-panel {
            flex: 1;
            padding: 20px;
            background: #252526;
            overflow-y: auto;
            min-width: 200px;
        }
        .header {
            margin-bottom: 20px;
            padding: 15px;
            background: #2d2d30;
            border-radius: 8px;
            border-left: 4px solid #007acc;
        }
        .legend-info {
            background: #2d2d30;
            color: #cccccc;
            padding: 10px;
            border-radius: 4px;
            margin-bottom: 15px;
            font-size: 14px;
            display: flex;
            align-items: center;
            gap: 15px;
            flex-wrap: wrap;
        }
        .legend-item {
            display: flex;
            align-items: center;
            gap: 5px;
        }
        .legend-dot {
            width: 12px;
            height: 12px;
            border-radius: 50%;
            border: 2px solid #fff;
        }
        .legend-dot.service { background: #4CAF50; }
        .legend-dot.component { background: #2196F3; }
        .legend-dot.module { background: #FF9800; }
        .legend-dot.model { background: #9C27B0; }
        .header {
            margin-bottom: 20px;
            padding: 15px;
            background: #2d2d30;
            border-radius: 8px;
            border-left: 4px solid #007acc;
        }
        .legend-info {
            background: #2d2d30;
            color: #cccccc;
            padding: 10px;
            border-radius: 4px;
            margin-bottom: 15px;
            font-size: 14px;
            display: flex;
            align-items: center;
            gap: 15px;
            flex-wrap: wrap;
            border-left: 4px solid #007acc;
        }
        .legend-item {
            display: flex;
            align-items: center;
            gap: 5px;
        }
        .legend-dot {
            width: 12px;
            height: 12px;
            border-radius: 50%;
            border: 2px solid #fff;
        }
        .search-info {
            background: #4ecdc4;
            color: #1e1e1e;
            padding: 10px;
            border-radius: 4px;
            margin-bottom: 15px;
            font-weight: bold;
        }
        .controls {
            margin-bottom: 15px;
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
            align-items: center;
        }
        .search-container {
            display: flex;
            gap: 10px;
            align-items: center;
            width: 100%;
            position: relative;
        }
        #nodeSearch {
            flex: 1;
            padding: 10px 15px;
            border: 2px solid #007acc;
            border-radius: 6px;
            background: #2d2d30;
            color: #cccccc;
            font-size: 14px;
            transition: all 0.2s ease;
        }
        #nodeSearch:focus {
            outline: none;
            border-color: #0078d4;
            box-shadow: 0 0 8px rgba(0, 120, 212, 0.3);
            background: #323233;
        }
        .search-suggestions {
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            background: #2d2d30;
            border: 2px solid #007acc;
            border-top: none;
            border-radius: 0 0 6px 6px;
            max-height: 200px;
            overflow-y: auto;
            z-index: 1000;
            display: none;
        }
        .suggestion-item {
            padding: 10px 15px;
            cursor: pointer;
            border-bottom: 1px solid #444;
            color: #cccccc;
            transition: background-color 0.2s;
        }
        .suggestion-item:hover,
        .suggestion-item.selected {
            background: #007acc;
            color: #ffffff;
        }
        .suggestion-item:last-child {
            border-bottom: none;
        }
        .btn {
            background: #007acc;
            color: #ffffff;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
            font-weight: bold;
            transition: background-color 0.2s;
        }
        .btn:hover {
            background: #0078d4;
        }
        .ai-analyst-btn {
            background: linear-gradient(135deg, #6c5ce7, #a29bfe);
            color: white;
            border: none;
            padding: 12px 20px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 14px;
            font-weight: bold;
            width: 100%;
            margin: 10px 0;
            transition: all 0.3s ease;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        }
        .ai-analyst-btn:hover {
            background: linear-gradient(135deg, #5f3dc4, #9775fa);
            transform: translateY(-1px);
            box-shadow: 0 4px 8px rgba(0,0,0,0.4);
        }
        .ai-analysis-result {
            background: #2d2d30;
            border: 1px solid #6c5ce7;
            border-radius: 6px;
            padding: 15px;
            margin-top: 10px;
            max-height: 300px;
            overflow-y: auto;
            display: none;
        }
        .ai-analysis-loading {
            text-align: center;
            padding: 20px;
            color: #a29bfe;
        }
        #d3-graph {
            width: 100%;
            height: calc(100vh - 140px);
            border: 2px solid #007acc;
            border-radius: 8px;
            background: #252526;
        }
        .detail-section {
            margin-bottom: 20px;
            padding: 15px;
            background: #2d2d30;
            border-radius: 8px;
            border-left: 4px solid #4fc3f7;
            color: #e0e0e0;
        }
        .detail-section h4 {
            margin: 0 0 10px 0;
            color: #4fc3f7;
            font-weight: bold;
        }
        .dependency-item {
            padding: 8px;
            margin: 5px 0;
            background: #3d3d3d;
            border-radius: 4px;
            cursor: pointer;
            transition: background-color 0.2s;
            color: #e0e0e0;
        }
        .dependency-item:hover {
            background: #4d4d4d;
            color: #ffffff;
        }
        .module-title {
            font-size: 18px;
            font-weight: bold;
            color: #81c784;
            margin-bottom: 10px;
        }
        .node-circle {
            stroke: #fff;
            stroke-width: 2px;
            cursor: move;
        }
        .node-circle.service {
            fill: #4CAF50;  /* Green for services */
        }
        .node-circle.component {
            fill: #2196F3;  /* Blue for components */
        }
        .node-circle.module {
            fill: #FF9800;  /* Orange for modules */
        }
        .node-circle.model {
            fill: #9C27B0;  /* Purple for models */
        }
        .node-circle:not(.service):not(.component):not(.module):not(.model) {
            fill: #007acc;  /* Default blue for others */
        }
        .node-circle:hover {
            filter: drop-shadow(0 0 5px currentColor);
        }
        .node-circle.search-match {
            fill: #ffeaa7;
            stroke: #333;
            stroke-width: 3px;
        }
        .link {
            stroke: #6A9EDB;
            stroke-opacity: 0.6;
            stroke-width: 1.5px;
            marker-end: url(#arrowhead);
        }
        .node-text {
            font-size: 11px;
            fill: #cccccc;
            text-anchor: middle;
            pointer-events: none;
        }
        .tooltip {
            position: absolute;
            background: rgba(45, 45, 48, 0.95);
            border: 1px solid #4ecdc4;
            border-radius: 4px;
            padding: 8px;
            font-size: 12px;
            z-index: 1000;
            pointer-events: none;
            opacity: 0;
            max-width: 250px;
        }
    </style>
</head>
<body>
    <div class="main-container">
        <div class="left-panel">
            <div class="header">
                <h1>🔍 Dependency Graph - ${graph.nodes.length} modules found</h1>
            </div>
            
            <div class="legend-info">
                📋 File Types: 
                <span class="legend-item"><span class="legend-dot service"></span>Service</span>
                <span class="legend-item"><span class="legend-dot component"></span>Component</span>
                <span class="legend-item"><span class="legend-dot module"></span>Module</span>
                <span class="legend-item"><span class="legend-dot model"></span>Model</span>
            </div>
            
            <div class="controls">
                <div class="search-container">
                    <input type="text" id="nodeSearch" placeholder="Search modules..." autocomplete="off">
                    <div class="search-suggestions" id="searchSuggestions"></div>
                    <button class="btn" onclick="searchAndFocus()">🔍 Search</button>
                </div>
            </div>
    
    <svg id="d3-graph"></svg>
    <div class="tooltip" id="nodeTooltip"></div>
        </div>
        
        <div class="resizer" id="resizer"></div>
        
        <div class="right-panel">
            <div id="detailView">
                <h3>🎯 Module Details</h3>
                <p>Click on any module to see its dependencies and dependents</p>
            </div>
        </div>
    </div>
    
    <script>
        const graphData = {
            nodes: ${JSON.stringify(graph.nodes.map(node => {
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
            }))},
            edges: ${JSON.stringify(graph.edges)}
        };
        
        let simulation;
        let svg;
        let g;
        let zoom;
        let physicsEnabled = true;
        let isHierarchyView = false;
        
        function initializeGraph() {
            svg = d3.select('#d3-graph');
            const container = document.querySelector('.left-panel');
            const width = container.clientWidth - 40; // Account for padding
            const height = container.clientHeight - 140; // Reduced from 200 to 140
            
            svg.attr('width', width).attr('height', height);
            
            // Add zoom and pan behavior
            zoom = d3.zoom()
                .scaleExtent([0.2, 3])  // Smaller range for better control
                .on('zoom', function(event) {
                    g.attr('transform', event.transform);
                });
            
            svg.call(zoom);
            
            // Double-click to reset zoom
            svg.on('dblclick.zoom', function() {
                svg.transition().duration(750).call(
                    zoom.transform,
                    d3.zoomIdentity
                );
            });
            
            // Arrow marker
            svg.append('defs').append('marker')
                .attr('id', 'arrowhead')
                .attr('viewBox', '0 -5 10 10')
                .attr('refX', 20)
                .attr('refY', 0)
                .attr('markerWidth', 6)
                .attr('markerHeight', 6)
                .attr('orient', 'auto')
                .append('path')
                .attr('d', 'M0,-5L10,0L0,5')
                .attr('fill', '#6A9EDB');
            
            g = svg.append('g');
            
            // Force simulation with better spacing
            simulation = d3.forceSimulation(graphData.nodes)
                .force('link', d3.forceLink(graphData.edges).id(d => d.id).distance(200))  // Further increased
                .force('charge', d3.forceManyBody().strength(-800))  // Much stronger repulsion
                .force('center', d3.forceCenter(width / 2, height / 2))
                .force('collision', d3.forceCollide().radius(50));  // More collision spacing
            
            renderGraph();
        }
        
        function renderGraph() {
            // Links
            const link = g.selectAll('.link')
                .data(graphData.edges)
                .enter().append('line')
                .attr('class', 'link');
            
            // Nodes
            const node = g.selectAll('.node-circle')
                .data(graphData.nodes)
                .enter().append('circle')
                .attr('r', 6)  // Much smaller nodes
                .attr('class', d => {
                    let classes = 'node-circle';
                    // Use the entityType from the parsed data
                    if (d.entityType) {
                        classes += ' ' + d.entityType;
                    } else {
                        // Fallback to file name analysis
                        const fileName = (d.fileName || d.id || '').toLowerCase();
                        if (fileName.includes('service')) classes += ' service';
                        else if (fileName.includes('component')) classes += ' component';
                        else if (fileName.includes('module')) classes += ' module';
                        else if (fileName.includes('model')) classes += ' model';
                    }
                    return classes;
                })
                .on('click', (event, d) => {
                    console.log('Clicked:', d.fileName);
                    // Clear other selections
                    graphData.nodes.forEach(node => node.selected = false);
                    // Select current node
                    d.selected = true;
                    updateNodeStyles();
                    // Show dependencies in right panel
                    showNodeDetails(d);
                })
                .on('mouseenter', (event, d) => {
                    const tooltip = document.getElementById('nodeTooltip');
                    const entityInfo = d.displayName !== d.fileName ? 
                        \`<strong>\${d.displayName}</strong> (\${d.entityType})<br><small>\${d.fileName}</small>\` :
                        \`<strong>\${d.fileName}</strong><br><small>\${d.relativePath}</small>\`;
                    tooltip.innerHTML = entityInfo;
                    tooltip.style.opacity = '1';
                    tooltip.style.left = event.pageX + 10 + 'px';
                    tooltip.style.top = event.pageY + 10 + 'px';
                })
                .on('mouseleave', () => {
                    document.getElementById('nodeTooltip').style.opacity = '0';
                })
                .call(d3.drag()
                    .on('start', (event, d) => {
                        if (!event.active) simulation.alphaTarget(0.3).restart();
                        d.fx = d.x;
                        d.fy = d.y;
                    })
                    .on('drag', (event, d) => {
                        d.fx = event.x;
                        d.fy = event.y;
                    })
                    .on('end', (event, d) => {
                        if (!event.active) simulation.alphaTarget(0);
                        if (!physicsEnabled) {
                            d.fx = d.x;
                            d.fy = d.y;
                        } else {
                            d.fx = null;
                            d.fy = null;
                        }
                    }));
            
            // Labels
            const nodeText = g.selectAll('.node-text')
                .data(graphData.nodes)
                .enter().append('text')
                .attr('class', 'node-text')
                .text(d => {
                    const name = d.displayName || d.fileName || 'unknown';
                    return name.length > 15 ? name.substring(0, 13) + '..' : name;
                })
                .attr('dy', 20);
            
            // Highlight search matches
            node.classed('search-match', d => 
                (d.fileName || '').toLowerCase().includes('${searchTerm}'.toLowerCase())
            );
            
            simulation.on('tick', () => {
                link
                    .attr('x1', d => d.source.x)
                    .attr('y1', d => d.source.y)
                    .attr('x2', d => d.target.x)
                    .attr('y2', d => d.target.y);
                
                node
                    .attr('cx', d => d.x)
                    .attr('cy', d => d.y);
                
                nodeText
                    .attr('x', d => d.x)
                    .attr('y', d => d.y);
            });
        }
        
        function updateNodeStyles() {
            // Update node styles based on selection
            svg.selectAll('.node-circle')
                .style('fill', d => d.selected ? '#ff6b6b' : null)  // Use null to preserve CSS default
                .style('stroke', d => d.selected ? '#fff' : null)
                .style('stroke-width', d => d.selected ? '3px' : null);
        }
        

        
        function showNodeDetails(node) {
            console.log('showNodeDetails called with:', node); // Debug log
            const detailView = document.getElementById('detailView');
            
            if (!detailView) {
                console.error('Detail view element not found!');
                return;
            }
            
            // Find dependencies (outgoing edges from this node)
            const dependencies = graphData.edges
                .filter(edge => {
                    const sourceId = edge.source.id || edge.source;
                    return sourceId === node.id;
                })
                .map(edge => {
                    const targetId = edge.target.id || edge.target;
                    return graphData.nodes.find(n => n.id === targetId);
                })
                .filter(n => n);
            
            // Find dependents (incoming edges to this node)
            const dependents = graphData.edges
                .filter(edge => {
                    const targetId = edge.target.id || edge.target;
                    return targetId === node.id;
                })
                .map(edge => {
                    const sourceId = edge.source.id || edge.source;
                    return graphData.nodes.find(n => n.id === sourceId);
                })
                .filter(n => n);
            
            console.log('Dependencies found:', dependencies.length);
            console.log('Dependents found:', dependents.length);
            
            
            // Build dependencies HTML
            let dependenciesHtml = '';
            dependencies.forEach(dep => {
                dependenciesHtml += \`
                    <div class="dependency-item" onclick="focusOnNode('\${dep.id}')">
                        <strong>\${dep.fileName || dep.id}</strong><br>
                        <small>\${dep.relativePath || 'Unknown path'}</small>
                    </div>
                \`;
            });
            
            // Build dependents HTML
            let dependentsHtml = '';
            dependents.forEach(dep => {
                dependentsHtml += \`
                    <div class="dependency-item" onclick="focusOnNode('\${dep.id}')">
                        <strong>\${dep.fileName || dep.id}</strong><br>
                        <small>\${dep.relativePath || 'Unknown path'}</small>
                    </div>
                \`;
            });
            
            const html = \`
                <div class="module-title">\${node.fileName || node.id}</div>
                <div class="detail-section">
                    <h4>📂 File Path</h4>
                    <div>\${node.relativePath || 'Unknown path'}</div>
                </div>
                
                <div class="detail-section">
                    <h4>📥 Dependencies (\${dependencies.length}) - What this module needs</h4>
                    <div style="max-height: 250px; overflow-y: auto;">
                        \${dependenciesHtml || '<p>No dependencies found</p>'}
                    </div>
                </div>
                
                <div class="detail-section">
                    <h4>📤 Dependents (\${dependents.length}) - What needs this module</h4>
                    <div style="max-height: 250px; overflow-y: auto;">
                        \${dependentsHtml || '<p>No dependents found</p>'}
                    </div>
                </div>
                
                <div class="detail-section">
                    <button class="ai-analyst-btn" onclick="analyzeWithAI('\${node.id}')">
                        🤖 AI Impact Recommendations
                    </button>
                    <div id="ai-analysis-\${node.id}" class="ai-analysis-result"></div>
                </div>
            \`;
            
            console.log('Setting detail view HTML');
            detailView.innerHTML = html;
        }
        
        function focusOnNode(nodeId) {
            // Find the node and center the view on it
            const node = graphData.nodes.find(n => n.id === nodeId);
            if (node) {
                // Clear previous selections
                graphData.nodes.forEach(n => n.selected = false);
                // Select the target node
                node.selected = true;
                updateNodeStyles();
                showNodeDetails(node);
                
                // Center the view on the node if it has position
                if (node.x && node.y) {
                    const container = document.querySelector('.left-panel');
                    const width = container.clientWidth - 40;
                    const height = container.clientHeight - 140;
                    
                    const transform = d3.zoomIdentity
                        .translate(width/2 - node.x, height/2 - node.y)
                        .scale(1.5);
                    svg.transition().duration(750).call(
                        zoom.transform,
                        transform
                    );
                }
            }
        }
        
        function populateAutocomplete() {
            const suggestionsContainer = document.getElementById('searchSuggestions');
            const searchInput = document.getElementById('nodeSearch');
            
            if (!suggestionsContainer || !searchInput) return;
            
            let selectedIndex = -1;
            let filteredNodes = [];
            
            function showSuggestions(filter = '') {
                filteredNodes = graphData.nodes.filter(node => {
                    const fileName = (node.fileName || node.id).toLowerCase();
                    const displayName = (node.displayName || '').toLowerCase();
                    const searchTerm = filter.toLowerCase();
                    return fileName.includes(searchTerm) || displayName.includes(searchTerm);
                }).slice(0, 8); // Limit to 8 suggestions
                
                suggestionsContainer.innerHTML = '';
                
                if (filteredNodes.length > 0 && filter) {
                    filteredNodes.forEach((node, index) => {
                        const div = document.createElement('div');
                        div.className = 'suggestion-item';
                        // Show component name if available, otherwise filename
                        const displayText = node.displayName !== node.fileName ? 
                            node.displayName + ' (' + node.entityType + ')' : 
                            node.fileName || node.id;
                        div.textContent = displayText;
                        div.addEventListener('click', () => {
                            searchInput.value = node.displayName || node.fileName || node.id;
                            hideSuggestions();
                            searchAndFocus();
                        });
                        suggestionsContainer.appendChild(div);
                    });
                    suggestionsContainer.style.display = 'block';
                } else {
                    hideSuggestions();
                }
            }
            
            function hideSuggestions() {
                suggestionsContainer.style.display = 'none';
                selectedIndex = -1;
            }
            
            function updateSelection() {
                const items = suggestionsContainer.querySelectorAll('.suggestion-item');
                items.forEach((item, index) => {
                    item.classList.toggle('selected', index === selectedIndex);
                });
            }
            
            // Input event for real-time filtering
            searchInput.addEventListener('input', (e) => {
                showSuggestions(e.target.value);
                selectedIndex = -1;
            });
            
            // Focus event to show suggestions
            searchInput.addEventListener('focus', (e) => {
                if (e.target.value) {
                    showSuggestions(e.target.value);
                }
            });
            
            // Click outside to hide
            document.addEventListener('click', (e) => {
                if (!e.target.closest('.search-container')) {
                    hideSuggestions();
                }
            });
            
            // Keyboard navigation
            searchInput.addEventListener('keydown', (e) => {
                const items = suggestionsContainer.querySelectorAll('.suggestion-item');
                
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
                    updateSelection();
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    selectedIndex = Math.max(selectedIndex - 1, -1);
                    updateSelection();
                } else if (e.key === 'Enter') {
                    e.preventDefault();
                    if (selectedIndex >= 0 && items[selectedIndex]) {
                        searchInput.value = items[selectedIndex].textContent;
                        hideSuggestions();
                        searchAndFocus();
                    } else {
                        searchAndFocus();
                    }
                } else if (e.key === 'Escape') {
                    hideSuggestions();
                }
            });
        }
        
        function setupSearchInput() {
            // Search functionality is now handled in populateAutocomplete
            // This function kept for compatibility
        }
        
        function searchAndFocus() {
            const searchTerm = document.getElementById('nodeSearch').value.trim();
            if (!searchTerm) return;
            
            // Find matching node
            const matchingNode = graphData.nodes.find(node => {
                const fileName = node.fileName || node.id;
                const displayName = node.displayName || '';
                const searchTermLower = searchTerm.toLowerCase();
                return fileName.toLowerCase().includes(searchTermLower) || 
                       displayName.toLowerCase().includes(searchTermLower);
            });
            
            if (matchingNode) {
                // Clear previous selections
                graphData.nodes.forEach(n => n.selected = false);
                // Select the found node
                matchingNode.selected = true;
                updateNodeStyles();
                showNodeDetails(matchingNode);
                
                // Center the view on the node if it has position
                if (matchingNode.x && matchingNode.y) {
                    const container = document.querySelector('.left-panel');
                    const width = container.clientWidth - 40;
                    const height = container.clientHeight - 140;
                    
                    const transform = d3.zoomIdentity
                        .translate(width/2 - matchingNode.x, height/2 - matchingNode.y)
                        .scale(1.5);
                    svg.transition().duration(750).call(
                        zoom.transform,
                        transform
                    );
                }
            } else {
                alert('Module not found: ' + searchTerm);
            }
        }
        
        function zoomIn() {
            svg.transition().duration(300).call(
                zoom.scaleBy, 1.5
            );
        }
        
        function zoomOut() {
            svg.transition().duration(300).call(
                zoom.scaleBy, 1 / 1.5
            );
        }
        
        function resetZoom() {
            svg.transition().duration(500).call(
                zoom.transform,
                d3.zoomIdentity
            );
        }
        
        function switchToHierarchyView() {
            // Stop current simulation
            simulation.stop();
            
            // Create hierarchical layout for impact analysis
            const layers = calculateLayers(graphData.nodes, graphData.edges);
            
            // Position nodes in layers
            const layerHeight = height / (layers.length + 1);
            layers.forEach((layer, layerIndex) => {
                const layerWidth = width / (layer.length + 1);
                layer.forEach((node, nodeIndex) => {
                    node.fx = (nodeIndex + 1) * layerWidth;
                    node.fy = (layerIndex + 1) * layerHeight;
                });
            });
            
            // Update visual layout
            ticked();
            
            // Style nodes by layer
            node.attr('r', d => d.layer === 0 ? 12 : Math.max(6, 10 - d.layer * 1.5))
                .style('fill', d => getLayerColor(d.layer));
            
            console.log('Switched to hierarchy view with', layers.length, 'layers');
        }
        
        function switchToGraphView() {
            // Reset to force-directed layout
            graphData.nodes.forEach(d => {
                d.fx = null;
                d.fy = null;
            });
            
            // Restart simulation
            simulation.alpha(0.3).restart();
            
            // Reset node styles
            node.attr('r', d => Math.min(8, Math.max(4, Math.log(getNodeConnections(d) + 1) * 2)))
                .style('fill', '#007ACC');
            
            console.log('Switched to graph view');
        }
        
        function calculateLayers(nodes, edges) {
            const layers = [];
            const visited = new Set();
            const nodeToLayer = new Map();
            
            // Find root nodes (nodes with no incoming edges from search matches)
            const searchMatchIds = new Set(nodes.filter(n => 
                (n.fileName || '').toLowerCase().includes('service')
            ).map(n => n.id));
            
            const rootNodes = nodes.filter(node => {
                const hasIncomingFromSearchMatch = edges.some(e => 
                    e.target === node.id && searchMatchIds.has(e.source)
                );
                return searchMatchIds.has(node.id) || !hasIncomingFromSearchMatch;
            });
            
            // Layer 0: Root nodes (core services)
            if (rootNodes.length > 0) {
                layers.push(rootNodes.slice(0, 8)); // Limit for clarity
                rootNodes.slice(0, 8).forEach(node => {
                    visited.add(node.id);
                    nodeToLayer.set(node.id, 0);
                    node.layer = 0;
                });
            }
            
            // Build subsequent layers
            for (let layer = 0; layer < 4; layer++) {
                const currentLayer = layers[layer] || [];
                const nextLayer = [];
                
                currentLayer.forEach(node => {
                    edges.forEach(edge => {
                        if (edge.source === node.id && !visited.has(edge.target)) {
                            const targetNode = nodes.find(n => n.id === edge.target);
                            if (targetNode && nextLayer.length < 10) {
                                nextLayer.push(targetNode);
                                visited.add(edge.target);
                                nodeToLayer.set(edge.target, layer + 1);
                                targetNode.layer = layer + 1;
                            }
                        }
                    });
                });
                
                if (nextLayer.length > 0) {
                    layers.push(nextLayer);
                } else {
                    break;
                }
            }
            
            return layers;
        }
        
        function exportGraph() {
            const svgData = new XMLSerializer().serializeToString(document.getElementById('d3-graph'));
            const blob = new Blob([svgData], {type: 'image/svg+xml'});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = \`dependency-graph-\${searchTerm}.svg\`;
            a.click();
        }
        
        // Resize functionality
        let isResizing = false;
        const resizer = document.getElementById('resizer');
        const leftPanel = document.querySelector('.left-panel');
        const rightPanel = document.querySelector('.right-panel');
        
        resizer.addEventListener('mousedown', (e) => {
            isResizing = true;
            document.addEventListener('mousemove', handleResize);
            document.addEventListener('mouseup', stopResize);
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        });
        
        function handleResize(e) {
            if (!isResizing) return;
            
            const containerRect = document.querySelector('.main-container').getBoundingClientRect();
            const newLeftWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;
            
            // Constrain between 20% and 80%
            const constrainedWidth = Math.min(Math.max(newLeftWidth, 20), 80);
            
            leftPanel.style.width = constrainedWidth + '%';
            // rightPanel flex: 1 will automatically take remaining space
            
            // Trigger resize for D3 graph
            if (window.resizeGraph) {
                setTimeout(() => window.resizeGraph(), 10);
            }
        }
        
        function stopResize() {
            isResizing = false;
            document.removeEventListener('mousemove', handleResize);
            document.removeEventListener('mouseup', stopResize);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        }
        
        // Resize graph function
        window.resizeGraph = function() {
            const container = document.querySelector('.left-panel');
            const newWidth = container.clientWidth - 40;
            const newHeight = container.clientHeight - 140;
            
            svg.attr('width', newWidth).attr('height', newHeight);
            simulation.force('center', d3.forceCenter(newWidth / 2, newHeight / 2));
            simulation.alpha(0.3).restart();
        };
        
        // Handle window resize
        window.addEventListener('resize', () => {
            setTimeout(window.resizeGraph, 100);
        });
        
        window.addEventListener('load', function() {
            initializeGraph();
            populateAutocomplete();
            setupSearchInput();
        });
        
        // AI Analysis function for webview
        function analyzeWithAI(nodeId) {
            console.log('🤖 AI Analysis clicked for nodeId:', nodeId);
            
            const resultDiv = document.getElementById('ai-analysis-' + nodeId);
            console.log('📍 Found resultDiv:', resultDiv);
            
            const node = graphData.nodes.find(n => n.id === nodeId);
            console.log('🎯 Found node:', node);
            
            if (!node) {
                console.error('❌ Node not found for ID:', nodeId);
                return;
            }
            
            // Show loading state
            resultDiv.style.display = 'block';
            resultDiv.innerHTML = '<div class="ai-analysis-loading">🤖 Analyzing dependencies... Please wait</div>';
            console.log('⏳ Loading state shown');
            
            // Get dependency info using edges (not links)
            console.log('📊 Total edges available:', graphData.edges ? graphData.edges.length : 0);
            
            const dependencies = (graphData.edges || [])
                .filter(edge => edge.target === nodeId)
                .map(edge => {
                    const sourceNode = graphData.nodes.find(n => n.id === edge.source);
                    return sourceNode ? {
                        name: sourceNode.fileName,
                        path: sourceNode.relativePath,
                        id: sourceNode.id
                    } : null;
                }).filter(Boolean);
                
            const dependents = (graphData.edges || [])
                .filter(edge => edge.source === nodeId)
                .map(edge => {
                    const targetNode = graphData.nodes.find(n => n.id === edge.target);
                    return targetNode ? {
                        name: targetNode.fileName,
                        path: targetNode.relativePath,
                        id: targetNode.id
                    } : null;
                }).filter(Boolean);
            
            // Read file content and prepare detailed analysis
            console.log('📖 Reading file content for impact analysis...');
            
            // Read actual file content first
            let fileContent = '';
            let fileSize = 0;
            try {
                const fs = require('fs');
                const path = require('path');
                
                // Try different path combinations to find the file
                const possiblePaths = [
                    node.relativePath,
                    node.id,
                    path.join(workspaceRoot || '', node.relativePath || ''),
                    path.join(workspaceRoot || '', node.id || '')
                ].filter(Boolean);
                
                let foundPath = null;
                for (const testPath of possiblePaths) {
                    if (fs.existsSync(testPath)) {
                        foundPath = testPath;
                        break;
                    }
                }
                
                if (foundPath) {
                    fileContent = fs.readFileSync(foundPath, 'utf8');
                    fileSize = Math.round(fileContent.length / 1024);
                    console.log('✅ Successfully read file:', foundPath, 'Size:', fileSize + 'KB');
                } else {
                    console.log('⚠️ File not found at paths:', possiblePaths);
                    fileContent = '[File content could not be read - file not found]';
                }
            } catch (error) {
                console.log('❌ Error reading file:', error.message);
                fileContent = '[Error reading file content: ' + error.message + ']';
            }
            
            // Prepare impact analysis prompt focusing on what happens when file changes
            const analysisPrompt = \`Analyze the potential impact of modifying this file in an Angular application.

File to be modified: \${node.fileName}
Path: \${node.relativePath || node.id}
Content: 
\${fileContent.length > 3000 ? fileContent.substring(0, 3000) + '\\n[... content truncated ...]' : fileContent}

Dependencies (\${dependencies.length} modules this file imports):
\${dependencies.map(dep => \`- \${dep.name} (\${dep.path || dep.id})\`).join('\\n')}

Dependents (\${dependents.length} modules that depend on this file):
\${dependents.map(dep => \`- \${dep.name} (\${dep.path || dep.id})\`).join('\\n')}

Please analyze what could happen if this file is modified and provide:

## Potential Impact Analysis
- What functionality could break if this file changes
- Which user features/workflows might be affected
- What other modules could stop working
- Performance implications of changes
- Security risks if applicable

## Risk Level Assessment
- High Risk: Critical functionality that would definitely break
- Medium Risk: Features that might have issues or need updates
- Low Risk: Minor impacts or easily fixable issues

## Recommended Actions
- What to test before deploying changes
- Which teams/stakeholders to notify
- What documentation to update
- Deployment considerations\`;

            console.log('🔄 Sending impact analysis prompt to AI...');
            
            // Simulate AI analysis with detailed, context-aware recommendations
            setTimeout(() => {
                console.log('🎨 Generating detailed AI response for:', node.fileName);
                console.log('📊 Dependencies count:', dependencies.length);
                console.log('🔗 Dependents count:', dependents.length);
                console.log('📋 Analysis prompt prepared:', analysisPrompt.substring(0, 200) + '...');
                
                // Simple response - let AI service handle the analysis
                const response = \`## Impact Analysis for \${node.fileName}

**File Analysis:**
- **File Size**: \${fileSize}KB
- **Content Available**: \${fileContent.includes('[File content could not be read') || fileContent.includes('[Error reading file') ? 'No - file reading failed' : 'Yes - analyzed successfully'}

\${fileContent.includes('[File content could not be read') || fileContent.includes('[Error reading file') ? 
\`**Note**: File content could not be read. Analysis is based on dependency relationships only.

## Potential Impact Analysis
- **File Type**: \${node.fileName.includes('.component.') ? 'Angular Component' : node.fileName.includes('.service.') ? 'Angular Service' : node.fileName.includes('.module.') ? 'Angular Module' : 'TypeScript File'}
- **Direct Dependencies**: \${dependencies.length} modules import this file
- **Dependent Modules**: \${dependents.length} modules depend on this file
- **Potential Breaking Changes**: Changes to public APIs could break \${dependents.length} dependent modules
- **User Impact**: \${dependents.length > 0 ? \`Modifications may affect user features using \${dependents.length} related modules\` : 'Low user impact - isolated module'}
- **Performance Impact**: Monitor for performance implications in data processing
- **Security Considerations**: Validate input handling if this file processes user data

## Risk Level Assessment
- **High Risk**: \${dependents.length > 5 ? \`\${dependents.length} modules depend on this - high blast radius\` : 'None identified'}
- **Medium Risk**: \${dependents.length > 2 && dependents.length <= 5 ? \`\${dependents.length} dependent modules may need updates\` : dependents.length > 0 ? 'Some integration points to verify' : 'Interface changes only'}
- **Low Risk**: \${dependents.length <= 1 ? 'Minimal dependencies - low risk of breakage' : 'Internal implementation changes'}

## Recommended Actions
- **Testing Priority**: \${dependents.length > 3 ? 'High - test all dependent modules immediately' : dependents.length > 0 ? 'Medium - verify integration points' : 'Low - standard unit testing sufficient'}
- **Stakeholder Notification**: \${dependents.length > 2 ? 'Notify teams owning dependent modules' : 'Standard development team notification'}
- **Deployment Strategy**: \${dependents.length > 5 ? 'Staged rollout recommended' : dependents.length > 0 ? 'Monitor dependent module functionality' : 'Standard deployment'}
- **Documentation**: Update API documentation if public interfaces change\` :

\`## 🔮 AI Impact Recommendations
🚫 **Real AI analysis would provide detailed impact assessment**

This is a mock response. In a real implementation, the prompt above would be sent to an AI service to provide:

**✅ Comprehensive Impact Analysis:**
1. **Functional Impact** - What features could break
2. **Integration Impact** - How other modules are affected  
3. **User Experience Impact** - Which user workflows might change
4. **Performance Impact** - System performance considerations
5. **Security Impact** - Any security implications

**✅ Risk Assessment:**
- Categorized risk levels (High/Medium/Low)
- Blast radius calculation
- Criticality assessment

**✅ Actionable Recommendations:**
- Testing strategy and priorities
- Stakeholder communication plan
- Deployment considerations
- Monitoring requirements

**Next Steps for Implementation:**
- Integrate with AI service API (OpenAI, Claude, etc.)
- Send impact analysis prompt
- Parse and format recommendations
- Display actionable insights\`}

**Module Context:**
- Path: \${node.relativePath || 'Unknown'}
- File Size: \${fileSize}KB
- Dependencies: \${dependencies.length}
- Dependents: \${dependents.length}\`;

                console.log('✅ AI analysis completed, showing results');
                resultDiv.innerHTML = '<div style="white-space: pre-line; line-height: 1.6; color: #cccccc; font-size: 13px;">' + response + '</div>';
            }, 1500);
        }
    </script>
</body>
</html>`;
}

/**
 * Generate HTML content for webview
 */
function generateGraphWebviewHtml(graph, summary) {
    const mermaidDiagram = generateMermaidDiagram(graph);
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dependency Graph</title>
    <script src="https://cdn.jsdelivr.net/npm/mermaid@10.6.1/dist/mermaid.min.js"></script>
    <script src="https://d3js.org/d3.v7.min.js"></script>
    <style>
        body {
            margin: 0;
            padding: 20px;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: #1e1e1e;
            color: #cccccc;
            overflow-x: hidden;
        }
        .header {
            margin-bottom: 20px;
            padding: 15px;
            background: #2d2d30;
            border-radius: 8px;
            border-left: 4px solid #007ACC;
        }
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 10px;
            margin-bottom: 20px;
        }
        .stat-card {
            background: #3c3c3c;
            padding: 15px;
            border-radius: 6px;
            text-align: center;
        }
        .stat-value {
            font-size: 24px;
            font-weight: bold;
            color: #007ACC;
        }
        .stat-label {
            font-size: 12px;
            opacity: 0.8;
            margin-top: 5px;
        }
        .graph-container {
            background: #252526;
            border: 1px solid #3e3e42;
            border-radius: 8px;
            padding: 20px;
            min-height: 600px;
            overflow: hidden;
            position: relative;
        }
        .controls {
            margin-bottom: 15px;
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
            align-items: center;
        }
        .btn {
            background: #0e639c;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
        }
        .btn:hover {
            background: #1177bb;
        }
        .search-box {
            padding: 8px 12px;
            border: 1px solid #3e3e42;
            border-radius: 4px;
            background: #1e1e1e;
            color: #cccccc;
            font-size: 13px;
            min-width: 200px;
        }
        .search-box:focus {
            outline: none;
            border-color: #007ACC;
        }
        #mermaid-graph {
            min-height: 500px;
            cursor: grab;
            overflow: hidden;
        }
        #mermaid-graph:active {
            cursor: grabbing;
        }
        #mermaid-graph svg {
            transition: transform 0.3s ease;
        }
        .error {
            color: #f48771;
            background: #5a1d1d;
            padding: 10px;
            border-radius: 4px;
            margin: 10px 0;
        }
        .loading {
            text-align: center;
            padding: 40px;
            color: #888;
        }
        .node-tooltip {
            position: absolute;
            background: rgba(45, 45, 48, 0.95);
            border: 1px solid #007ACC;
            border-radius: 4px;
            padding: 8px;
            font-size: 12px;
            z-index: 1000;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.3s;
            max-width: 250px;
        }
        .highlighted-node {
            stroke: #ff6b6b !important;
            stroke-width: 3px !important;
            filter: drop-shadow(0 0 5px #ff6b6b);
        }
        .search-result {
            stroke: #4ecdc4 !important;
            stroke-width: 2px !important;
            filter: drop-shadow(0 0 3px #4ecdc4);
        }
        .pan-indicator {
            position: absolute;
            bottom: 10px;
            left: 10px;
            background: rgba(0, 0, 0, 0.7);
            color: white;
            padding: 5px 10px;
            border-radius: 4px;
            font-size: 11px;
            opacity: 0.7;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>📊 Dependency Graph Visualization</h1>
        <p>Interactive analysis with pan, zoom, and search capabilities</p>
    </div>
    
    <div class="stats">
        <div class="stat-card">
            <div class="stat-value">${summary?.totalFiles || 0}</div>
            <div class="stat-label">Total Files</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${summary?.totalDependencies || 0}</div>
            <div class="stat-label">Dependencies</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${summary?.circularDependencies || 0}</div>
            <div class="stat-label">Circular Issues</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${((summary?.totalDependencies || 0) / Math.max(summary?.totalFiles || 1, 1)).toFixed(1)}</div>
            <div class="stat-label">Avg Dependencies</div>
        </div>
    </div>
    
    <div class="controls">
        <input type="text" class="search-box" id="searchBox" placeholder="🔍 Search modules (e.g. app.module, user.service)">
        <button class="btn" onclick="searchGraph()">🔍 Search</button>
        <button class="btn" onclick="clearSearch()">❌ Clear</button>
        <button class="btn" onclick="reloadGraph()">🔄 Reload</button>
        <button class="btn" onclick="showRawDiagram()">📄 Raw</button>
        <button class="btn" onclick="exportDiagram()">💾 Export</button>
    </div>
    
    <div class="graph-container">
        <div class="pan-indicator">🖱️ Click and drag to pan • Mouse wheel to zoom • Click nodes for details</div>
        
        <div class="loading" id="loading">📊 Loading dependency graph...</div>
        <div id="mermaid-graph" style="display:none;"></div>
        <div id="error-display" style="display:none;"></div>
        <div id="raw-display" style="display:none;">
            <h3>Raw Mermaid Diagram:</h3>
            <pre style="background:#1e1e1e; padding:10px; border-radius:4px; overflow:auto; font-size:12px;">${mermaidDiagram}</pre>
        </div>
    </div>
    
    <div class="node-tooltip" id="nodeTooltip"></div>
    
    <script>
        console.log('Interactive webview loaded');
        
        let currentTransform = { x: 0, y: 0, scale: 1 };
        let isDragging = false;
        let lastMousePos = { x: 0, y: 0 };
        let searchResults = [];
        
        // Initialize Mermaid
        mermaid.initialize({
            startOnLoad: false,
            theme: 'dark',
            themeVariables: {
                primaryColor: '#007ACC',
                primaryTextColor: '#FFFFFF',
                primaryBorderColor: '#007ACC',
                lineColor: '#6A9EDB',
                sectionBkgColor: '#1E1E1E',
                altSectionBkgColor: '#2D2D30',
                gridColor: '#404040',
                secondaryColor: '#505050',
                tertiaryColor: '#404040'
            },
            flowchart: {
                useMaxWidth: true,
                htmlLabels: true,
                curve: 'basis'
            }
        });
        
        const graphDefinition = \`${mermaidDiagram}\`;
        console.log('Graph definition:', graphDefinition);
        
        // Function to render graph
        async function renderGraph() {
            try {
                document.getElementById('loading').style.display = 'block';
                document.getElementById('mermaid-graph').style.display = 'none';
                document.getElementById('error-display').style.display = 'none';
                
                const graphDiv = document.getElementById('mermaid-graph');
                graphDiv.innerHTML = '';
                
                const { svg } = await mermaid.render('graphSvg', graphDefinition);
                graphDiv.innerHTML = svg;
                
                document.getElementById('loading').style.display = 'none';
                document.getElementById('mermaid-graph').style.display = 'block';
                
                console.log('Graph rendered successfully');
                
                // Setup interactive features
                setTimeout(() => {
                    setupInteractivity();
                }, 100);
                
            } catch (error) {
                console.error('Error rendering graph:', error);
                document.getElementById('loading').style.display = 'none';
                document.getElementById('error-display').style.display = 'block';
                document.getElementById('error-display').innerHTML = \`
                    <div class="error">
                        <h3>❌ Error rendering graph</h3>
                        <p>\${error.message}</p>
                        <button class="btn" onclick="showRawDiagram()">Show Raw Diagram</button>
                    </div>
                \`;
            }
        }
        
        function setupInteractivity() {
            const graphContainer = document.getElementById('mermaid-graph');
            const svg = graphContainer.querySelector('svg');
            const tooltip = document.getElementById('nodeTooltip');
            
            if (!svg) return;
            
            // Setup pan and zoom
            setupPanZoom(graphContainer, svg);
            
            // Setup node interactions
            const nodes = svg.querySelectorAll('.node');
            nodes.forEach(node => {
                node.style.cursor = 'pointer';
                
                // Click handler
                node.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const nodeText = node.querySelector('text')?.textContent || 'Unknown';
                    highlightNode(node);
                    showNodeDetails(nodeText);
                });
                
                // Hover handlers
                node.addEventListener('mouseenter', (e) => {
                    const nodeText = node.querySelector('text')?.textContent || 'Unknown';
                    showTooltip(e, nodeText);
                });
                
                node.addEventListener('mouseleave', () => {
                    hideTooltip();
                });
            });
            
            // Setup search box
            const searchBox = document.getElementById('searchBox');
            searchBox.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    searchGraph();
                }
            });
        }
        
        function setupPanZoom(container, svg) {
            let isPanning = false;
            let startPoint = { x: 0, y: 0 };
            
            // Mouse events for panning
            container.addEventListener('mousedown', (e) => {
                if (e.target === container || e.target === svg) {
                    isPanning = true;
                    startPoint = { x: e.clientX, y: e.clientY };
                    container.style.cursor = 'grabbing';
                }
            });
            
            container.addEventListener('mousemove', (e) => {
                if (isPanning) {
                    const dx = e.clientX - startPoint.x;
                    const dy = e.clientY - startPoint.y;
                    
                    currentTransform.x += dx;
                    currentTransform.y += dy;
                    
                    updateSVGTransform(svg);
                    
                    startPoint = { x: e.clientX, y: e.clientY };
                }
            });
            
            container.addEventListener('mouseup', () => {
                isPanning = false;
                container.style.cursor = 'grab';
            });
            
            container.addEventListener('mouseleave', () => {
                isPanning = false;
                container.style.cursor = 'grab';
            });
            
            // Mouse wheel for zooming
            container.addEventListener('wheel', (e) => {
                e.preventDefault();
                
                const rect = container.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const mouseY = e.clientY - rect.top;
                
                const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
                const newScale = Math.max(0.1, Math.min(3, currentTransform.scale * zoomFactor));
                
                // Zoom towards mouse position
                currentTransform.x = mouseX - (mouseX - currentTransform.x) * (newScale / currentTransform.scale);
                currentTransform.y = mouseY - (mouseY - currentTransform.y) * (newScale / currentTransform.scale);
                currentTransform.scale = newScale;
                
                updateSVGTransform(svg);
            });
        }
        
        function updateSVGTransform(svg) {
            svg.style.transform = \`translate(\${currentTransform.x}px, \${currentTransform.y}px) scale(\${currentTransform.scale})\`;
        }
        
        function showTooltip(e, nodeText) {
            const tooltip = document.getElementById('nodeTooltip');
            tooltip.innerHTML = \`
                <strong>\${nodeText}</strong><br>
                <small>📁 Click for impact analysis</small><br>
                <small>🔍 Right-click to search dependencies</small>
            \`;
            tooltip.style.opacity = '1';
            tooltip.style.left = e.pageX + 10 + 'px';
            tooltip.style.top = e.pageY + 10 + 'px';
        }
        
        function hideTooltip() {
            document.getElementById('nodeTooltip').style.opacity = '0';
        }
        
        function highlightNode(node) {
            // Remove previous highlights
            document.querySelectorAll('.highlighted-node').forEach(n => {
                n.classList.remove('highlighted-node');
            });
            
            // Add highlight to clicked node
            const rect = node.querySelector('rect, circle, ellipse');
            if (rect) {
                rect.classList.add('highlighted-node');
            }
        }
        
        function showNodeDetails(nodeText) {
            alert(\`📊 Node Details: \${nodeText}\\n\\n🔍 Use search to find dependencies\\n📈 Check impact analysis in chat\`);
        }
        
        function searchGraph() {
            const searchTerm = document.getElementById('searchBox').value.trim().toLowerCase();
            if (!searchTerm) return;
            
            clearSearch();
            
            const nodes = document.querySelectorAll('.node');
            searchResults = [];
            
            nodes.forEach(node => {
                const nodeText = (node.querySelector('text')?.textContent || '').toLowerCase();
                if (nodeText.includes(searchTerm)) {
                    const rect = node.querySelector('rect, circle, ellipse');
                    if (rect) {
                        rect.classList.add('search-result');
                        searchResults.push(node);
                    }
                }
            });
            
            if (searchResults.length > 0) {
                // Pan to first result
                const firstNode = searchResults[0];
                const rect = firstNode.getBoundingClientRect();
                const containerRect = document.getElementById('mermaid-graph').getBoundingClientRect();
                
                currentTransform.x = containerRect.width / 2 - rect.left;
                currentTransform.y = containerRect.height / 2 - rect.top;
                
                const svg = document.querySelector('#mermaid-graph svg');
                updateSVGTransform(svg);
                
                alert(\`🎯 Found \${searchResults.length} matching nodes!\`);
            } else {
                alert('❌ No nodes found matching: ' + searchTerm);
            }
        }
        
        function clearSearch() {
            document.querySelectorAll('.search-result, .highlighted-node').forEach(node => {
                node.classList.remove('search-result', 'highlighted-node');
            });
            searchResults = [];
        }
        
        function zoomIn() {
            currentTransform.scale = Math.min(3, currentTransform.scale * 1.2);
            const svg = document.querySelector('#mermaid-graph svg');
            updateSVGTransform(svg);
        }
        
        function zoomOut() {
            currentTransform.scale = Math.max(0.1, currentTransform.scale / 1.2);
            const svg = document.querySelector('#mermaid-graph svg');
            updateSVGTransform(svg);
        }
        
        function resetZoom() {
            currentTransform = { x: 0, y: 0, scale: 1 };
            const svg = document.querySelector('#mermaid-graph svg');
            updateSVGTransform(svg);
        }
        
        function reloadGraph() {
            renderGraph();
        }
        
        function showRawDiagram() {
            const rawDiv = document.getElementById('raw-display');
            const graphDiv = document.getElementById('mermaid-graph');
            if (rawDiv.style.display === 'none') {
                rawDiv.style.display = 'block';
                graphDiv.style.display = 'none';
            } else {
                rawDiv.style.display = 'none';
                graphDiv.style.display = 'block';
            }
        }
        
        function exportDiagram() {
            const svg = document.querySelector('#mermaid-graph svg');
            if (svg) {
                const svgData = new XMLSerializer().serializeToString(svg);
                const blob = new Blob([svgData], {type: 'image/svg+xml'});
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'dependency-graph.svg';
                a.click();
            }
        }
        
        // Start rendering when page loads
        window.addEventListener('load', () => {
            console.log('Page loaded, rendering interactive graph...');
            renderGraph();
        });
        
    </script>
</body>
</html>`;
}

/**
 * Generate detailed analysis response
 */
function generateDetailedAnalysis(graph, report) {
    const { summary, metrics, recommendations } = report;
    const healthScore = calculateHealthScore(summary);
    
    // Find most connected files
    const nodeConnections = graph.nodes.map(node => ({
        file: path.basename(node.id),
        connections: graph.edges.filter(e => e.source === node.id || e.target === node.id).length,
        complexity: node.complexity || 0
    })).sort((a, b) => b.connections - a.connections);
    
    const topConnected = nodeConnections.slice(0, 5);
    
    return {
        type: 'detailed',
        title: '🔍 Comprehensive Dependency Analysis',
        content: [
            '### 📊 Executive Summary',
            `**Health Score:** ${healthScore}% ${getHealthEmoji(healthScore)}`,
            `**Architecture:** ${summary?.totalFiles || 0} files, ${summary?.totalDependencies || 0} dependencies`,
            `**Critical Issues:** ${summary?.circularDependencies || 0} circular dependencies`,
            '',
            '### 🏗️ Architecture Overview',
            ...Object.entries(summary?.typeDistribution || {}).map(([type, count]) => 
                `• **${type.charAt(0).toUpperCase() + type.slice(1)}s:** ${count} files`
            ),
            '',
            '### 🔗 Most Connected Files',
            ...topConnected.map((item, i) => 
                `${i + 1}. \`${item.file}\` (${item.connections} connections, complexity: ${item.complexity})`
            ),
            '',
            '### ⚡ Performance Metrics',
            `• **Average Complexity:** ${(metrics?.complexity?.averageComplexity || 0).toFixed(1)}`,
            `• **Coupling Factor:** ${((summary?.totalDependencies || 0) / Math.max(summary?.totalFiles || 1, 1)).toFixed(1)} deps/file`,
            `• **Module Cohesion:** ${((summary?.totalFiles || 0) / Math.max(Object.keys(summary?.typeDistribution || {}).length, 1)).toFixed(1)} files/type`,
            '',
            '### 🎯 AI Recommendations',
            recommendations.length > 0 ? 
                recommendations.slice(0, 3).map(rec => 
                    `• **${rec.title}:** ${rec.description}`
                ).join('\n') :
                '• ✅ No immediate recommendations - good structure!',
            '',
            '### 🔄 Circular Dependencies Analysis',
            summary?.circularDependencies > 0 ? 
                `⚠️ Found ${summary.circularDependencies} cycles that should be resolved` :
                '✅ No circular dependencies detected - excellent!',
        ].join('\n'),
        actions: [
            { label: 'View Graph Visualization', command: '@dependency graph' },
            { label: 'Check Circular Dependencies', command: '@dependency circular' },
            { label: 'Get Fix Suggestions', command: '@dependency suggest' }
        ]
    };
}

module.exports = {
    initializeDependencyGraph
};