import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

import { aidaLogging } from '../core/settings';
import { toError } from '../core/error-utils';
import { buildSelectedNodeObject, analyzeImpactWithAI, openImpactAnalysisWebview } from './dependency-ai-analysis-service';

// Module-level state
let extensionContext: vscode.ExtensionContext | null = null;

/**
 * Set the extension context for webview service
 */
function setWebviewExtensionContext(ctx: vscode.ExtensionContext | null) {
    extensionContext = ctx;
}

/**
 * Get display name for a node based on Angular entities
 * @param {Object} node - The node object
 * @param {Object} angularEntities - Angular entities from metadata
 * @returns {Object} - Object with name and type
 */
function getNodeDisplayName(node: Record<string, any>, angularEntities: Record<string, any>) {
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
 * Create webview from data (extracted for reuse)
 */
async function createWebviewFromData(graph: Record<string, any>, report: Record<string, any>, analysisType: string) {
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
    aidaLogging(`\u{1F4CA} Creating webview with data:`, {
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

    aidaLogging(`\u2705 Webview created with ${graph.nodes.length} nodes, ${graph.edges.length} edges`);
}

/**
 * Handle messages from graph webview
 */
async function handleGraphWebviewMessage(message: Record<string, any>, panel: vscode.WebviewPanel, graph: Record<string, any>) {
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
function buildPRContextObject(graph: Record<string, any>) {
    const prFiles = graph.nodes.filter((n: Record<string, any>) => n.isPRFile).map((n: Record<string, any>) => ({
        file: n.relativePath || n.fileName,
        status: n.prStatus,
        changes: n.prChanges,
        changedSymbols: n.changedSymbols
    }));

    const impactedFiles = graph.nodes.filter((n: Record<string, any>) => !n.isPRFile && (n.nodeType === 'dependent' || n.nodeType === 'both')).map((n: Record<string, any>) => ({
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
async function createPRGraphWebview(graph: Record<string, any>, prInfo: Record<string, any>, summary: Record<string, any>) {
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
            extensionContext!.subscriptions
        );

    } catch (_error: unknown) {
        const error = toError(_error);
        aidaLogging('\u274C Error creating PR graph webview:', error);
        vscode.window.showErrorMessage(`Failed to create graph viewer: ${error.message}`);
    }
}

/**
 * Generate HTML for PR dependency graph
 */
function generatePRGraphWebviewHtml(graph: Record<string, any>, summary: Record<string, any>, prInfo: Record<string, any>) {
    const extensionPath = extensionContext ? extensionContext.extensionPath : __dirname;

    // Read HTML template
    const htmlTemplatePath = path.join(extensionPath, 'scripts', 'dependency', 'views', 'graph-view.html');
    let htmlTemplate = fs.readFileSync(htmlTemplatePath, 'utf8');

    // Read TypeScript script
    const scriptPath = path.join(extensionPath, 'scripts', 'dependency', 'views', 'graph-view-script.js');
    let scriptContent = fs.readFileSync(scriptPath, 'utf8');

    // \u{1F525} Filter graph to show only impacted nodes in PR mode
    const symbolToDependentsMap = graph.symbolToDependentsMap;
    let filteredNodes = graph.nodes;
    let filteredEdges = graph.edges;
    const impactedPaths = new Set<string>(); // \u2705 Moved outside for access in map()

    aidaLogging(`\u{1F4CA} Original graph: ${graph.nodes.length} nodes, ${graph.edges.length} edges`);
    aidaLogging(`\u{1F4CA} symbolToDependentsMap type:`, symbolToDependentsMap?.constructor?.name, 'size:', symbolToDependentsMap?.size);

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
                aidaLogging(`   Symbol: ${symbol} \u2192 ${files.length} files`);
                files.forEach((f: string) => impactedPaths.add(f));
            }
        } else {
            for (const [symbol, files] of (Object.entries(symbolToDependentsMap) as [string, string[]][])) {
                aidaLogging(`   Symbol: ${symbol} \u2192 ${files.length} files`);
                files.forEach((f: string) => impactedPaths.add(f));
            }
        }

        aidaLogging(`\u{1F3AF} Total impacted files from symbols: ${impactedPaths.size}`);
        aidaLogging(`\u{1F3AF} Impacted paths:`, Array.from(impactedPaths));

        // Keep: PR files + dependencies + actually impacted dependents
        const keepNodeIds = new Set<string>();
        filteredNodes = graph.nodes.filter((node: Record<string, any>) => {
            aidaLogging(`   Checking node: ${node.id}, type: ${node.nodeType}, isPR: ${node.isPRFile}`);

            // Always keep PR files
            if (node.isPRFile) {
                keepNodeIds.add(node.id);
                aidaLogging(`      \u2705 Keep (PR file)`);
                return true;
            }
            // \u{1F6AB} HIDE dependencies in PR mode (user doesn't need to see what PR file imports)
            if (node.nodeType === 'dependency') {
                aidaLogging(`      \u274C Filter out (dependency - not needed in PR mode)`);
                return false;
            }
            // Keep dependents that are actually impacted
            if (node.nodeType === 'dependent') {
                const nodePath = node.relativePath || node.id;
                const isImpacted = impactedPaths.has(nodePath);
                aidaLogging(`      Path: ${nodePath}, Impacted: ${isImpacted}`);
                if (isImpacted) {
                    keepNodeIds.add(node.id);
                    aidaLogging(`      \u2705 Keep (impacted dependent)`);
                    return true;
                }
                aidaLogging(`      \u274C Filter out (non-impacted dependent)`);
                return false;
            }
            // Handle "both" type (dependency + dependent)
            if (node.nodeType === 'both') {
                const nodePath = node.relativePath || node.id;
                const isImpacted = impactedPaths.has(nodePath);
                aidaLogging(`      Path: ${nodePath}, Impacted: ${isImpacted}`);
                if (isImpacted) {
                    keepNodeIds.add(node.id);
                    aidaLogging(`      \u2705 Keep (impacted both)`);
                    return true;
                }
                aidaLogging(`      \u274C Filter out (non-impacted both)`);
                return false;
            }
            // Filter out other types by default
            aidaLogging(`      \u274C Filter out (other type)`);
            return false;
        });

        // Filter edges to only include connections between kept nodes
        filteredEdges = graph.edges.filter((edge: Record<string, any>) => {
            const sourceId = edge.source.id || edge.source;
            const targetId = edge.target.id || edge.target;
            return keepNodeIds.has(sourceId) && keepNodeIds.has(targetId);
        });

        aidaLogging(`\u{1F3AF} Filtered graph: ${filteredNodes.length} nodes (from ${graph.nodes.length}), ${filteredEdges.length} edges (from ${graph.edges.length})`);
    } else {
        aidaLogging(`\u26A0\uFE0F No impact data available, filtering to show ONLY PR files`);
        // If no impact data, we still want to hide dependencies in PR mode
        // Only show the PR files themselves
        filteredNodes = graph.nodes.filter((node: Record<string, any>) => node.isPRFile);
        filteredEdges = []; // No edges if no impacts
    }

    // Prepare PR-enhanced graph data
    const graphDataJson = JSON.stringify({
        nodes: filteredNodes.map((node: Record<string, any>) => {
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
                isHiddenImpact: !node.isPRFile && impactedPaths.has(node.relativePath || node.id), // \u{1F534} Mark hidden impacts
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
function generateFilteredGraphWebviewHtml(graph: Record<string, any>, _summary: Record<string, any>, searchTerm: string) {
    // Get extension path from context
    const extensionPath = extensionContext ? extensionContext.extensionPath : __dirname;

    // Read HTML template
    const htmlTemplatePath = path.join(extensionPath, 'scripts', 'dependency', 'views', 'graph-view.html');
    let htmlTemplate = fs.readFileSync(htmlTemplatePath, 'utf8');

    // Read TypeScript script
    const scriptPath = path.join(extensionPath, 'scripts', 'dependency', 'views', 'graph-view-script.js');
    let scriptContent = fs.readFileSync(scriptPath, 'utf8');

    // Replace placeholders in HTML
    htmlTemplate = htmlTemplate.replace('{{SEARCH_TERM}}', searchTerm);
    htmlTemplate = htmlTemplate.replace('{{NODE_COUNT}}', graph.nodes.length);

    // Prepare graph data with Angular entity info
    const graphDataJson = JSON.stringify({
        nodes: graph.nodes.map((node: Record<string, any>) => {
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
 * Create webview for single file dependency graph
 */
async function createFileGraphWebview(graph: Record<string, any>, filePath: string) {
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
            extensionContext!.subscriptions
        );

    } catch (_error: unknown) {
        const error = toError(_error);
        aidaLogging('\u274C Error creating file graph webview:', error);
        vscode.window.showErrorMessage(`Failed to create graph viewer: ${error.message}`);
    }
}

function generateFileGraphWebviewHtml(graph: Record<string, any>, fileName: string) {
    const extensionPath = extensionContext ? extensionContext.extensionPath : __dirname;

    // Read HTML template
    const htmlTemplatePath = path.join(extensionPath, 'scripts', 'dependency', 'views', 'graph-view.html');
    let htmlTemplate = fs.readFileSync(htmlTemplatePath, 'utf8');

    // Read TypeScript script
    const scriptPath = path.join(extensionPath, 'scripts', 'dependency', 'views', 'graph-view-script.js');
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


// ES exports
export {
    setWebviewExtensionContext,
    getNodeDisplayName,
    createWebviewFromData,
    handleGraphWebviewMessage,
    buildPRContextObject,
    createPRGraphWebview,
    generatePRGraphWebviewHtml,
    generateFilteredGraphWebviewHtml,
    createFileGraphWebview,
    generateFileGraphWebviewHtml
};
