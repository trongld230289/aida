import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

import { aidaLogging } from '../core/settings';
import { buildDependencyPRAnalysisPrompt, buildDependencyNodeAnalysisPrompt } from '../core/prompts';
import { trackEvent } from '../tracking/usage-tracking';
import { TrackingEvent, TrackingSource, getIdeAiProvider } from '../tracking/tracking-enums';
import { SymbolAnalyzer } from './graph/symbol-analyzer';
import { toError } from '../core/error-utils';
import { AssetLoaderFactory } from './graph/asset-loader-factory';
import { executeAIReview, getUnifiedModel } from '../review/review-common';

// Module-level state
let extensionContext: vscode.ExtensionContext | null = null;

/**
 * Set the extension context for AI analysis service
 */
function setAiExtensionContext(ctx: vscode.ExtensionContext | null) {
    extensionContext = ctx;
}

/**
 * Build complete selected node object with all CSS/HTML assets
 */
async function buildSelectedNodeObject(nodeId: string, graph: Record<string, any>, panel: vscode.WebviewPanel) {
    try {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath;
        if (!workspaceRoot) {
            aidaLogging('No workspace root found');
            return;
        }

        const selectedNode = graph.nodes.find((n: Record<string, any>) => n.id === nodeId);
        if (!selectedNode) {
            aidaLogging('Node not found:', nodeId);
            return;
        }

        // Helper function to load assets for a node
        const loadNodeAssets = async (node: Record<string, any>) => {
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
            // \u{1F525} REFACTORED: Use AssetLoaderStrategy pattern instead of hardcoded if/else
            const assetLoader = AssetLoaderFactory.getLoader(fileName);

            if (assetLoader) {
                const assets = await assetLoader.loadAssets(absolutePath, fileContent, workspaceRoot);
                Object.assign(result, assets);
            }

            return result;
        };

        // Build dependencies array
        const dependencies = [];
        const dependencyEdges = graph.edges.filter((edge: Record<string, any>) => {
            const sourceId = edge.source.id || edge.source;
            return sourceId === nodeId;
        });

        for (const edge of dependencyEdges) {
            const targetId = edge.target.id || edge.target;
            const targetNode = graph.nodes.find((n: Record<string, any>) => n.id === targetId);
            if (targetNode) {
                const assets = await loadNodeAssets(targetNode);
                dependencies.push(assets);
            }
        }

        // Build dependents array
        const dependents = [];
        const dependentEdges = graph.edges.filter((edge: Record<string, any>) => {
            const targetId = edge.target.id || edge.target;
            return targetId === nodeId;
        });

        for (const edge of dependentEdges) {
            const sourceId = edge.source.id || edge.source;
            const sourceNode = graph.nodes.find((n: Record<string, any>) => n.id === sourceId);
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

        aidaLogging('\n\u{1F3AF} Selected Node Object:', JSON.stringify(selectedNodeObject, null, 2));

        // Send to AI for analysis
        await analyzeImpactWithAI(selectedNodeObject, panel);

        return selectedNodeObject;

    } catch (error: unknown) {
        aidaLogging('\u274C Error building selected node object:', error);
        return null;
    }
}

/**
 * Analyze impact with AI using selected node data or PR context
 */
async function analyzeImpactWithAI(data: Record<string, any>, _originalPanel: vscode.WebviewPanel) {
    // Track AI analysis button click
    const eventName = data.isPRAnalysis ? TrackingEvent.ANALYZE_DEPENDENCY_AI_PR : TrackingEvent.ANALYZE_DEPENDENCY_AI_NODE;
    void trackEvent(eventName, {
        aiProvider: getIdeAiProvider(),
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
    const formatMarkdown = (text: string) => {
        if (!text) return '';
        // Remove markdown code blocks if present
        return text.replace(/```html/g, '').replace(/```/g, '');
    };

    // Helper to generate HTML from template
    const getHtml = (content: string) => {
        const basePath = extensionContext ? extensionContext.extensionPath : __dirname;
        const templatePath = path.join(basePath, 'scripts', 'dependency', 'templates', 'ai-analysis.html');
        const html = fs.readFileSync(templatePath, 'utf8');
        return html
            .replace(/\{\{FILE_NAME\}\}/g, data.fileName)
            .replace(/\{\{CONTENT\}\}/g, content);
    };

    // Set initial loading state
    analysisPanel.webview.html = getHtml('<div class="loading">\u{1F916} Analyzing impact... Please wait...</div>');

    try {
        // Import review-common for executeAIReview and getUnifiedModel
        let prompt = '';

        if (data.isPRAnalysis) {
            prompt = buildDependencyPRAnalysisPrompt(data);
        } else {
            prompt = buildDependencyNodeAnalysisPrompt(data);
        }

        aidaLogging('\u{1F916} Sending to AI for analysis...');
        aidaLogging('\u{1F4CB} Prompt:', prompt);

        // Create a stream object to collect AI response
        let aiResponse = '';
        const mockStream = {
            markdown: (text: string) => {
                // Strip markdown formatting and accumulate response
                aiResponse += text;
            },
            progress: (text: string) => {
                aidaLogging('Progress:', text);
            }
        };

        // Get current selected model using getUnifiedModel (same as review-changes)
        // Pass global.aidaExtensionContext to respect AIDA Chatbot model selection
        const model = await getUnifiedModel(mockStream as unknown as vscode.ChatResponseStream, null, (global as any).aidaExtensionContext, null);

        // Use executeAIReview which handles both Copilot and API key modes
        const success = await executeAIReview(prompt, model, mockStream as unknown as vscode.ChatResponseStream, 'Impact Analysis', 0, null, null);

        if (success) {
            aidaLogging('\u2705 AI Response received, length:', aiResponse.length);

            // Clean up the response - remove markdown decorations that we added
            const cleanResponse = aiResponse
                .replace(/^[\s\S]*?---\s*/, '') // Remove everything up to and including the first separator
                .replace(/\s*---\s*$/, '') // Remove trailing separator
                .replace(/\u{1F916} \*\*Streaming.*?\*\*.*?\n\n/gsu, '') // Remove streaming header
                .replace(/\n\n---\n\n\u{1F4CA} \*\*Token Usage Summary:\*\*[\s\S]*$/gu, '') // Remove token stats section
                .replace(/\u{1F4B0} \*\*Cost.*?\*\*[\s\S]*$/gu, '') // Remove cost footer
                .trim();

            // Update panel with result
            analysisPanel.webview.html = getHtml(formatMarkdown(cleanResponse));

        } else {
            throw new Error('AI analysis failed');
        }

    } catch (_error: unknown) {
        const error = toError(_error);
        aidaLogging('\u274C Error analyzing with AI:', error);
        analysisPanel.webview.html = getHtml(`<div style="color: #f48771;">\u274C Error: ${error.message}</div>`);
    }
}

/**
 * Open Deep Impact Analysis Webview
 * @param {string} nodeId - The node ID from graph
 * @param {object} graph - Optional: The full graph data for consistent dependency/dependent lookup
 */
async function openImpactAnalysisWebview(nodeId: string, graph: Record<string, any> | null = null) {
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
        const htmlPath = path.join(extensionPath, 'scripts', 'dependency', 'views', 'impact-analysis.html');
        const htmlContent = fs.readFileSync(htmlPath, 'utf8');
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
            } catch (_error: unknown) {
                const error = toError(_error);
                aidaLogging('Impact analysis error:', error);
                panel.webview.postMessage({
                    command: 'error',
                    error: error.message
                });
            }
        };

        // Start analysis immediately
        await runAnalysis();

    } catch (_error: unknown) {
        const error = toError(_error);
        aidaLogging('Error opening impact analysis:', error);
        vscode.window.showErrorMessage(`Failed to open impact analysis: ${error.message}`);
    }
}

// ES exports
export { setAiExtensionContext, buildSelectedNodeObject, analyzeImpactWithAI, openImpactAnalysisWebview };
