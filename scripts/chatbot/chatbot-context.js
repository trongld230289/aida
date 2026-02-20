/**
 * @module chatbot-context
 * @description Context and multimodal analysis methods for CopilotSidebarChat
 * Extracted from chatbot-sidebar.js during Phase 3 refactoring.
 * 
 * Uses mixin pattern: methods are mixed into CopilotSidebarChat.prototype
 * so `this` refers to the CopilotSidebarChat instance at runtime.
 */

const vscode = require('vscode');
const { aidaLogging } = require('../core/settings');

/**
 * Context/multimodal methods mixed into CopilotSidebarChat.prototype.
 */
const contextMethods = {
/**
 * Get current file context for Agent
 */
async getCurrentFileContext() {
    try {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) {
            return {
                hasFile: false,
                message: "No file is currently open"
            };
        }

        const document = activeEditor.document;
        const filePath = document.uri.fsPath;
        const fileName = document.fileName;
        const fileContent = document.getText();
        const languageId = document.languageId;
        const lineCount = document.lineCount;

        // Get basic file analysis
        const analysis = this.analyzeFileContent(fileContent, languageId);

        return {
            hasFile: true,
            filePath,
            fileName,
            languageId,
            lineCount,
            fileSize: Buffer.byteLength(fileContent, 'utf8'),
            content: fileContent,
            analysis,
            summary: `${fileName} (${languageId}, ${lineCount} lines)`
        };
    } catch (error) {
        return {
            hasFile: false,
            error: error.message
        };
    }
},

/**
 * Analyze file content to understand structure
 */
analyzeFileContent(content, languageId) {
    const analysis = {
        type: languageId,
        structure: {}
    };

    try {
        if (languageId === 'typescript' || languageId === 'javascript') {
            // Analyze TypeScript/JavaScript
            analysis.structure = {
                classes: (content.match(/class\s+(\w+)/g) || []).map(m => m.replace('class ', '')),
                functions: (content.match(/function\s+(\w+)/g) || []).map(m => m.replace('function ', '')),
                methods: (content.match(/(\w+)\s*\([^)]*\)\s*{/g) || []).map(m => m.split('(')[0].trim()),
                imports: (content.match(/import.*from\s+['"]([^'"]+)['"]/g) || []),
                exports: (content.match(/export\s+(class|function|const|let|var)\s+(\w+)/g) || [])
            };

            // Check if it's Angular component
            if (content.includes('@Component')) {
                analysis.framework = 'angular';
                analysis.componentType = 'component';
                const selectorMatch = content.match(/selector:\s*['"]([^'"]+)['"]/);
                if (selectorMatch) analysis.selector = selectorMatch[1];
            }

            // Check if it's Angular service  
            if (content.includes('@Injectable')) {
                analysis.framework = 'angular';
                analysis.componentType = 'service';
            }

            // Check if it's Angular module
            if (content.includes('@NgModule')) {
                analysis.framework = 'angular';
                analysis.componentType = 'module';
            }

        } else if (languageId === 'html') {
            // Analyze HTML
            analysis.structure = {
                elements: (content.match(/<(\w+)/g) || []).map(m => m.replace('<', '')),
                angularDirectives: (content.match(/\*ng\w+/g) || []),
                interpolations: (content.match(/\{\{[^}]+\}\}/g) || [])
            };

        } else if (languageId === 'scss' || languageId === 'css') {
            // Analyze CSS/SCSS
            analysis.structure = {
                selectors: (content.match(/[.#]?[\w-]+\s*{/g) || []).map(m => m.replace(/\s*{/, '')),
                variables: (content.match(/\$[\w-]+:/g) || []),
                mixins: (content.match(/@mixin\s+(\w+)/g) || [])
            };
        }

    } catch (error) {
        analysis.error = `Analysis failed: ${error.message}`;
    }

    return analysis;
},

/**
 * Multimodal context decision (Hybrid approach like GitHub Copilot)
 * Step 1: Fast rule-based pre-filtering (90% cases)
 * Step 2: LLM semantic analysis for complex cases (10% cases)
 */
makeMultimodalContextDecision(userMessage, images, currentFileContext, contextDecision, semanticDecision) {
    const hasImages = images && images.length > 0;
    const hasCurrentFile = currentFileContext && currentFileContext.hasFile;

    aidaLogging(`🔍 Hybrid analysis: ${images.length} image(s) + ${hasCurrentFile ? 'current file' : 'no file'}`);

    // Step 1: Fast rule-based decision (primary)
    const ruleDecision = this.makeRuleBasedDecision(userMessage, images, currentFileContext);

    // Step 2: Check if we need semantic analysis (secondary)
    if (this.needsSemanticAnalysis(ruleDecision, userMessage, hasImages, hasCurrentFile)) {
        aidaLogging(`🧠 Complex case detected - using semantic analysis`);
        const semanticDecision = this.contextEngine.shouldIncludeContext(userMessage, currentFileContext);
        return this.combineDecisions(ruleDecision, semanticDecision, userMessage, currentFileContext, images);
    }

    aidaLogging(`⚡ Rule-based decision: ${ruleDecision.reason}`);
    return ruleDecision;
},

/**
 * Fast rule-based decision (GitHub Copilot style)
 * Handles 90% of common cases in milliseconds
 */
makeRuleBasedDecision(userMessage, images, currentFileContext) {
    const hasImages = images && images.length > 0;
    const hasCurrentFile = currentFileContext && currentFileContext.hasFile;
    const text = userMessage.toLowerCase();

    // Rule 1: No images - use file context if available
    if (!hasImages) {
        return {
            shouldInclude: hasCurrentFile,
            reason: hasCurrentFile ? 'Rule: No images, include current file' : 'Rule: No images, no current file',
            enhancedMessage: hasCurrentFile ? this.enhanceMessageWithContext(userMessage, currentFileContext, { shouldInclude: true }) : userMessage,
            confidence: 0.9
        };
    }

    // Rule 2: Only images, no current file
    if (hasImages && !hasCurrentFile) {
        return {
            shouldInclude: false,
            reason: 'Rule: Only images, no current file available',
            enhancedMessage: userMessage,
            confidence: 0.95
        };
    }

    // Rule 3: Images + current file - check explicit file references
    if (hasImages && hasCurrentFile) {
        const explicitFileRef = text.includes('current file') || text.includes('this file') ||
            text.includes('open file') || text.includes('file này') ||
            text.includes('tệp này') || text.includes('current code');

        if (explicitFileRef) {
            return {
                shouldInclude: true,
                reason: 'Rule: Explicit file reference with images',
                enhancedMessage: this.createMultimodalEnhancedMessage(userMessage, currentFileContext, images),
                confidence: 0.9
            };
        }

        // Default: Images priority, file as background
        return {
            shouldInclude: true,
            reason: 'Rule: Images with file background context',
            enhancedMessage: this.createImageFocusedEnhancedMessage(userMessage, currentFileContext, images),
            confidence: 0.7 // Lower confidence - might need semantic analysis
        };
    }

    // Fallback
    return {
        shouldInclude: false,
        reason: 'Rule: Default fallback',
        enhancedMessage: userMessage,
        confidence: 0.5
    };
},

/**
 * Determine if semantic analysis is needed (GitHub Copilot strategy)
 * Only for complex/ambiguous cases where rules aren't sufficient
 */
needsSemanticAnalysis(ruleDecision, userMessage, hasImages, hasCurrentFile) {
    // Low confidence from rules
    if (ruleDecision.confidence < 0.8) {
        return true;
    }

    // Complex multimodal scenario
    if (hasImages && hasCurrentFile) {
        const text = userMessage.toLowerCase();

        // Ambiguous references that need semantic analysis
        const ambiguousTerms = ['này', 'this', 'it', 'code', 'function', 'component', 'làm gì', 'how'];
        const hasAmbiguous = ambiguousTerms.some(term => text.includes(term));

        if (hasAmbiguous && !text.includes('current file') && !text.includes('image')) {
            return true;
        }
    }

    // Cross-reference analysis needed
    const needsCrossRef = userMessage.length > 100 || // Complex question
        userMessage.includes('compare') ||
        userMessage.includes('difference') ||
        userMessage.includes('so sánh') ||
        userMessage.includes('khác nhau');

    return needsCrossRef;
},

/**
 * Combine rule-based and semantic decisions (hybrid)
 */
combineDecisions(ruleDecision, semanticDecision, userMessage, currentFileContext, images) {
    const hasImages = images && images.length > 0;

    // If semantic analysis strongly disagrees with rules
    if (Math.abs(semanticDecision.confidence - ruleDecision.confidence) > 0.3) {
        // Use higher confidence decision
        if (semanticDecision.confidence > ruleDecision.confidence) {
            return {
                shouldInclude: semanticDecision.shouldInclude,
                reason: `Hybrid: Semantic override (confidence: ${semanticDecision.confidence.toFixed(2)}) - ${semanticDecision.reason}`,
                enhancedMessage: hasImages ?
                    this.createMultimodalEnhancedMessage(userMessage, currentFileContext, images) :
                    this.enhanceMessageWithContext(userMessage, currentFileContext, semanticDecision)
            };
        }
    }

    // Combine insights from both
    return {
        shouldInclude: ruleDecision.shouldInclude,
        reason: `Hybrid: Rule-based confirmed by semantic analysis - ${ruleDecision.reason}`,
        enhancedMessage: ruleDecision.enhancedMessage
    };
},

/**
 * Create enhanced message for multimodal context (image + current file)
 */
createMultimodalEnhancedMessage(userMessage, currentFileContext, images) {
    return `${userMessage}

**Multimodal Context Analysis:**
🖼️ **Images**: ${images.length} image(s) attached
📁 **Current File**: ${currentFileContext.fileName} (${currentFileContext.languageId})
- Lines: ${currentFileContext.lineCount}
- Summary: ${currentFileContext.summary}

**Instructions**: Please analyze both the attached image(s) and the current file context. If the user asks about "file này" or "this file", determine whether they're referring to the code in the image or the current open file, and provide appropriate analysis.

**Current File Content (for reference):**
\`\`\`${currentFileContext.languageId}
${currentFileContext.content.substring(0, 1000)}${currentFileContext.content.length > 1000 ? '...' : ''}
\`\`\``;
},

/**
 * Create enhanced message focused on images with file as background
 */
createImageFocusedEnhancedMessage(userMessage, currentFileContext, images) {
    return `${userMessage}

**Context**: You have ${images.length} image(s) to analyze. Current file (${currentFileContext.fileName}) is available as background context if relevant.

**Background File Info**: ${currentFileContext.summary}`;
},

/**
 * Helper method: Enhance message with intelligent context
 */
enhanceMessageWithContext(userMessage, currentFileContext, contextDecision) {
    if (!currentFileContext || !currentFileContext.hasFile) {
        return userMessage;
    }

    // Create context-aware enhancement based on intent and confidence
    let enhancedMessage = userMessage;

    if (contextDecision.confidence > 0.8) {
        // High confidence - include detailed context
        enhancedMessage = `${userMessage}

**Current File Context (High Relevance - ${(contextDecision.confidence * 100).toFixed(1)}%):**
- File: ${currentFileContext.fileName} (${currentFileContext.languageId})
- Lines: ${currentFileContext.lineCount}
- Intent: ${contextDecision.intent}
- Context: ${currentFileContext.summary}

**Analysis Reasoning:** ${contextDecision.reasoning.join(', ')}`;
    } else if (contextDecision.confidence > 0.6) {
        // Medium confidence - include basic context
        enhancedMessage = `${userMessage}

**Current File Context:**
File: ${currentFileContext.fileName} (${currentFileContext.languageId}) - ${currentFileContext.lineCount} lines
Summary: ${currentFileContext.summary}`;
    } else {
        // Low confidence - minimal context
        enhancedMessage = `${userMessage}

**Note:** Working with ${currentFileContext.fileName} (${currentFileContext.languageId})`;
    }

    aidaLogging(`🧠 Enhanced message with ${contextDecision.confidence > 0.8 ? 'detailed' : contextDecision.confidence > 0.6 ? 'basic' : 'minimal'} context`);
    return enhancedMessage;
},

/**
 * Helper method: Fallback context decision for when context engine fails
 */
basicContextDecision(userMessage, currentFileContext) {
    const text = userMessage.toLowerCase();

    // Enhanced pattern matching with better Vietnamese support
    const hasFileReference = text.includes('this file') ||
        text.includes('current file') ||
        text.includes('file này') ||
        text.includes('tệp này') ||
        text.includes('code này') ||
        text.includes('component này') ||
        text.includes('file nay') ||  // Without diacritics
        text.includes('code nay');

    const hasCodeAction = text.includes('analyze') ||
        text.includes('review') ||
        text.includes('refactor') ||
        text.includes('explain') ||
        text.includes('làm gì') ||
        text.includes('lam gi') ||  // Without diacritics
        text.includes('chức năng') ||
        text.includes('chuc nang') || // Without diacritics
        text.includes('tìm gọn') ||
        text.includes('tim gon') || // Without diacritics
        text.includes('xem') ||
        text.includes('đọc') ||
        text.includes('doc') || // Without diacritics
        text.includes('kiểm tra') ||
        text.includes('kiem tra') || // Without diacritics
        text.includes('phân tích') ||
        text.includes('phan tich') || // Without diacritics
        text.includes('help') ||
        text.includes('giúp') ||
        text.includes('giup') || // Without diacritics
        text.includes('about') ||
        text.includes('về') ||  // About in Vietnamese
        text.includes('vậy') || // Question ending particle
        text.includes('thế'); // Alternative question particle

    // More inclusive logic - if user mentions file operations AND has active file
    const shouldInclude = (hasFileReference || hasCodeAction) && currentFileContext?.hasFile;

    aidaLogging(`🔍 Basic context decision: fileRef=${hasFileReference}, codeAction=${hasCodeAction}, hasFile=${!!currentFileContext?.hasFile}, result=${shouldInclude}`);

    return {
        shouldInclude: shouldInclude,
        confidence: shouldInclude ? 0.7 : 0.3, // Higher confidence for fallback
        reasoning: [`Fallback pattern matching: fileRef=${hasFileReference}, codeAction=${hasCodeAction}, hasFile=${!!currentFileContext?.hasFile}`],
        intent: hasCodeAction ? 'code_analysis' : 'general'
    };
}
};

module.exports = { contextMethods };
