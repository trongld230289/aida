/**
 * @module business-docs
 * @description Business document management & review options
 * Extracted from review-common.js during Phase 1 refactoring
 */

const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { aidaLogging } = require('./settings');

// Lazy requires to avoid circular deps
function _getTemplateEngine() { return require('./template-engine'); }

function buildBusinessDocsContent(selectedBusinessDocs) {
    if (!selectedBusinessDocs || selectedBusinessDocs.length === 0) {
        aidaLogging('📚 No business documents selected');
        return '';
    }

    aidaLogging(`📚 Building business docs content from ${selectedBusinessDocs.length} categories...`);

    let docsContent = `## 📚 Business Rules & Documentation\n\n`;

    selectedBusinessDocs.forEach(category => {
        aidaLogging(`📁 Processing category: ${category.displayName} (${category.path})`);

        docsContent += `### ${category.displayName}\n\n`;

        try {
            // Get all markdown files in the category folder
            const files = fs.readdirSync(category.path, { withFileTypes: true })
                .filter(file => file.isFile() && file.name.endsWith('.md'))
                .map(file => ({
                    name: file.name,
                    path: path.join(category.path, file.name)
                }));

            aidaLogging(`📄 Found ${files.length} markdown files in ${category.name}`);

            files.forEach(file => {
                try {
                    const fileContent = fs.readFileSync(file.path, 'utf8');
                    const fileName = file.name.replace('.md', '').replace(/-/g, ' ');
                    const titleCase = fileName.charAt(0).toUpperCase() + fileName.slice(1);

                    docsContent += `#### ${titleCase}\n\n`;
                    docsContent += fileContent;
                    docsContent += '\n\n';

                    aidaLogging(`📄 Loaded ${file.name}: ${fileContent.substring(0, 50)}...`);
                } catch (fileError) {
                    aidaLogging(`❌ Error reading file ${file.path}:`, fileError.message);
                }
            });

        } catch (folderError) {
            aidaLogging(`❌ Error reading folder ${category.path}:`, folderError.message);
        }

        docsContent += '---\n\n';
    });

    aidaLogging(`✅ Built business docs content (${docsContent.length} chars)`);
    aidaLogging(`📄 Content preview: ${docsContent.substring(0, 100)}...`);

    return docsContent;
}

async function getBusinessDocumentFolders(workspaceFolder) {
    aidaLogging('🔍 getBusinessDocumentFolders called with workspaceFolder:', workspaceFolder?.uri?.fsPath);

    try {
        // Use the same logic as template base path resolution
        const aidaPathInfo = _getTemplateEngine().resolveAidaBasePath(workspaceFolder);
        aidaLogging(`🔍 Resolved AIDA base path: ${aidaPathInfo.basePath} (source: ${aidaPathInfo.source})`);

        // Build business docs path using the resolved AIDA base path
        const businessDocsPath = path.join(aidaPathInfo.basePath, 'business-docs');

        let actualPath = null;
        if (fs.existsSync(businessDocsPath)) {
            actualPath = businessDocsPath;
            aidaLogging('📁 Found business docs at:', businessDocsPath);
        }

        if (!actualPath) {
            aidaLogging(`📁 Business document path not found at: ${businessDocsPath}`);
            return [];
        }

        const subFolders = fs.readdirSync(actualPath, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => {
                const folderPath = path.join(actualPath, dirent.name);

                // Create dynamic relative path based on the resolved base path
                const relativePath = aidaPathInfo.source === 'config'
                    ? path.relative(workspaceFolder.uri.fsPath, folderPath).replace(/\\/g, '/')
                    : `AIDA/business-docs/${dirent.name}`;

                return {
                    name: dirent.name,
                    displayName: dirent.name.split('-').map(word =>
                        word.charAt(0).toUpperCase() + word.slice(1)
                    ).join(' '),
                    path: folderPath,
                    relativePath: relativePath,
                    basePath: actualPath,
                    workspacePath: workspaceFolder.uri.fsPath,
                    aidaBasePath: aidaPathInfo.basePath,
                    aidaSource: aidaPathInfo.source,
                    // Helper methods for getting files
                    getFiles: () => {
                        try {
                            return fs.readdirSync(folderPath, { withFileTypes: true })
                                .filter(file => file.isFile() && file.name.endsWith('.md'))
                                .map(file => {
                                    const filePath = path.join(folderPath, file.name);
                                    const fileRelativePath = aidaPathInfo.source === 'config'
                                        ? path.relative(workspaceFolder.uri.fsPath, filePath).replace(/\\/g, '/')
                                        : `AIDA/business-docs/${dirent.name}/${file.name}`;

                                    return {
                                        name: file.name,
                                        path: filePath,
                                        relativePath: fileRelativePath
                                    };
                                });
                        } catch (error) {
                            aidaLogging(`❌ Error reading files in ${folderPath}:`, error);
                            return [];
                        }
                    },
                    getMarkdownFiles: function () {
                        return this.getFiles();
                    }
                };
            });

        aidaLogging(`📚 Found ${subFolders.length} business document categories:`, subFolders.map(f => f.name));
        return subFolders;
    } catch (error) {
        aidaLogging('❌ Error scanning business documents:', error);
        return [];
    }
}

async function showReviewOptions(targetInput, stream, options = {}, reviewCallback = null) {
    const vscode = require('vscode');
    const path = require('path');

    // Add input validation
    if (!targetInput) {
        stream.markdown('❌ **No file specified for review**\n\n');
        stream.markdown('💡 **Tips:**\n');
        stream.markdown('- Open a file in the editor\n');
        stream.markdown('- Provide a specific file path\n');
        return false;
    }

    // Default options
    const config = {
        quickCommand: options.quickCommand || 'aida.confirmReviewDocs',
        enhancedCommand: options.enhancedCommand || 'aida.showEnhancedReviewOptions',
        reviewType: options.reviewType || 'Changes',
        ...options
    };

    const fileName = path.basename(targetInput);
    aidaLogging(`🔍 ${config.reviewType} review options for: ${targetInput}`);

    // First check if business documents exist before showing any options
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    let hasBusinessDocs = false;

    if (workspaceFolder) {
        try {
            const businessDocs = await getBusinessDocumentFolders(workspaceFolder);
            hasBusinessDocs = businessDocs && businessDocs.length > 0;
        } catch (error) {
            aidaLogging('❌ Error checking business documents:', error.message);
            hasBusinessDocs = false;
        }
    }

    // If no business documents, execute Quick Review immediately
    if (!hasBusinessDocs) {
        aidaLogging('📋 No business documents found - executing Quick Review automatically');
        stream.markdown('🚀 **Starting Quick Review automatically** (no business documents found)\n\n');

        // Set Quick Review mode
        global.selectedBusinessDocs = [];

        // Call review callback directly if provided
        if (reviewCallback) {
            await reviewCallback(false);
            return true; // Handled - review executed
        }

        // Otherwise show manual button
        stream.button({
            command: config.quickCommand,
            title: '🚀 Start Quick Review',
            arguments: [targetInput, config.chatCommand || 'review-changes'] // Pass chat command name
        });
        return false;
    }

    // Only show options dialog if business documents exist
    const emoji = '📋';
    stream.markdown(`# ${emoji} Review Options for \`${fileName}\`\n\n`);

    stream.markdown('**Choose how to proceed with the review:**\n\n');

    // Option 1: Quick Review (default/recommended)
    stream.markdown('### 🚀 **Quick Review** (Recommended)\n');
    stream.markdown('- Fast standard code review\n');
    stream.markdown('- Uses built-in review templates\n');
    stream.markdown('- No business document integration\n\n');

    stream.button({
        command: config.quickCommand,
        title: '🚀 Start Quick Review',
        arguments: [targetInput, config.chatCommand || 'review-changes'] // Pass chat command name
    });

    stream.markdown('\n');

    // Option 2: Enhanced Review (with business docs)
    stream.markdown('### 📚 **Enhanced Review**\n');
    stream.markdown('- Includes business rule validation\n');
    stream.markdown('- Cross-references business documents\n');
    stream.markdown('- More comprehensive analysis\n\n');

    stream.button({
        command: config.enhancedCommand,
        title: '📚 Start Enhanced Review',
        arguments: [targetInput, config.chatCommand || 'review-changes']
    });

    stream.markdown('\n\n');
    stream.markdown('💡 **Choose an option above to start the review**\n');

    return false; // Not handled - showing options dialog
}

module.exports = {
    buildBusinessDocsContent,
    getBusinessDocumentFolders,
    showReviewOptions
};
