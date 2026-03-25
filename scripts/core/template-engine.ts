/**
 * @module template-engine
 * @description Template loading, processing, and path resolution
 * Extracted from review-common.js during Phase 1 refactoring
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { aidaLogging } from './settings';
import type { ITemplateResult } from './interfaces/template.interface';
import { toError } from '../core/error-utils';
// Lazy require to break circular dep: template-engine ↔ business-docs
import type * as BusinessDocsModule from './business-docs';
function _getBusinessDocs(): typeof BusinessDocsModule { return require('./business-docs'); }

function processTemplateWithPlaceholders(templateContent: string, templateDir: string) {
    aidaLogging('🔍 DEBUG: processTemplateWithPlaceholders called');
    aidaLogging('🔍 DEBUG: Call stack:', new Error().stack?.split('\n').slice(1, 4).join('\n'));
    aidaLogging('🔍 DEBUG: templateDir =', templateDir);
    aidaLogging('🔍 DEBUG: templateContent.length =', templateContent.length);
    aidaLogging('🔍 DEBUG: contains {{REVIEW_BASE}}?', templateContent.includes('{{REVIEW_BASE}}'));

    // Check if already processed (to avoid double processing)
    if (templateContent.includes('<!-- AIDA_PROCESSED -->')) {
        aidaLogging('🔍 DEBUG: Template already processed, skipping...');
        return templateContent.replace('<!-- AIDA_PROCESSED -->\n', '');
    }

    // Check if template contains the placeholder
    if (!templateContent.includes('{{REVIEW_BASE}}')) {
        aidaLogging('🔍 DEBUG: No {{REVIEW_BASE}} placeholder found, returning original content');
        return templateContent; // No placeholders to replace
    }

    aidaLogging('🔄 Processing template with {{REVIEW_BASE}} placeholder...');

    try {
        // Try to load the review-base.md file from the same directory
        const basePath = path.join(templateDir, 'review-base.md');
        aidaLogging('🔍 DEBUG: Looking for base template at:', basePath);
        aidaLogging('🔍 DEBUG: Base template exists?', fs.existsSync(basePath));

        if (fs.existsSync(basePath)) {
            const baseContent = fs.readFileSync(basePath, 'utf8');
            aidaLogging(`✅ Loaded base template from: ${basePath}`);
            aidaLogging('🔍 DEBUG: baseContent.length =', baseContent.length);

            // Extract the Angular critical checks content (exclude header comments)
            const angularChecksContent = extractAngularChecks(baseContent);
            aidaLogging('🔍 DEBUG: angularChecksContent.length =', angularChecksContent.length);

            // Replace all occurrences of the placeholder
            const processedContent = templateContent.replace(/\{\{REVIEW_BASE\}\}/g, angularChecksContent);

            aidaLogging('✅ Template placeholder replacement completed');
            aidaLogging('🔍 DEBUG: processedContent.length =', processedContent.length);
            aidaLogging('🔍 DEBUG: Still contains {{REVIEW_BASE}}?', processedContent.includes('{{REVIEW_BASE}}'));

            return processedContent;
        } else {
            aidaLogging(`⚠️ Base template not found at: ${basePath}, using original content`);
            return templateContent;
        }
    } catch (error: unknown) {
        aidaLogging('❌ Error processing template placeholders:', error);
        return templateContent; // Return original content on error
    }
}

function extractAngularChecks(baseContent: string) {
    const lines = baseContent.split('\n');
    const startIndex = lines.findIndex((line: string) => line.includes('### 🚨 SECURITY VIOLATIONS:'));

    if (startIndex === -1) {
        aidaLogging('⚠️ Could not find Angular critical checks start marker in base template');
        return '<!-- Angular critical checks not found -->';
    }

    // Find the end of the critical checks (before final comments or end of file)
    const endMarkers = ['```', '## ', '---'];
    let endIndex = lines.length;

    for (let i = startIndex + 1; i < lines.length; i++) {
        const line = lines[i]!.trim();
        if (endMarkers.some(marker => line.startsWith(marker)) && line !== '```markdown') {
            endIndex = i;
            break;
        }
    }

    const extractedContent = lines.slice(startIndex, endIndex).join('\n').trim();
    aidaLogging(`📋 Extracted ${extractedContent.split('\n').length} lines from base template`);

    return extractedContent;
}

function getReviewTemplate(templateName: string, context: vscode.ExtensionContext | null = null) {
    // Determine template paths - workspace first, then extension fallback
    let templatePath, templateSource;

    // Always use extension templates - simplified approach
    if (context || global.extensionPath) {
        templatePath = path.join(context?.extensionPath || global.extensionPath as string, 'templates', templateName);
        templateSource = 'extension';
    } else {
        throw new Error('No extension context available');
    }

    try {
        if (fs.existsSync(templatePath)) {
            const rawContent = fs.readFileSync(templatePath, 'utf8');

            // Process template with placeholder replacement
            const templateDir = path.dirname(templatePath);
            const processedContent = processTemplateWithPlaceholders(rawContent, templateDir);

            aidaLogging(`✅ Loaded and processed template from: ${templatePath}`);

            return {
                content: processedContent,
                source: templateSource,
                path: templatePath
            };
        } else {
            throw new Error(`Template not found at: ${templatePath}`);
        }

    } catch (_error: unknown) {
        const error = toError(_error);
        aidaLogging('❌ Template loading error:', error);
        throw new Error(`Failed to load template: ${error.message}`);
    }
}

function normalizePathForDisplay(pathString: string) {
    if (!pathString || typeof pathString !== 'string') return '';
    return pathString.replace(/\\/g, '/');
}

function resolveAidaBasePath(workspaceFolder: any): { basePath: string; source: string } {
    const config = vscode.workspace.getConfiguration('aida');
    const configPath = config.get<string>('templatesBasePath', '');

    // Priority 1: User-configured path (if provided)
    if (configPath && configPath.trim()) {
        let resolvedPath = configPath.trim();

        // Support ${workspaceFolder} variable
        if (workspaceFolder) {
            resolvedPath = resolvedPath.replace(/\$\{workspaceFolder\}/g, workspaceFolder.uri.fsPath);
        }

        // Resolve relative paths
        if (!path.isAbsolute(resolvedPath) && workspaceFolder) {
            resolvedPath = path.resolve(workspaceFolder.uri.fsPath, resolvedPath);
        }

        // Check if templates folder exists
        const templatesPath = path.join(resolvedPath, 'templates');
        if (fs.existsSync(templatesPath)) {
            aidaLogging(`✅ Using configured AIDA path: ${resolvedPath}`);
            return {
                basePath: resolvedPath,
                source: 'config'
            };
        } else {
            // Auto-create AIDA structure if base path doesn't exist
            aidaLogging(`⚠️ Configured AIDA path not found: ${templatesPath}`);
            aidaLogging(`🔧 Attempting to create AIDA structure at: ${resolvedPath}`);

            try {
                // Create AIDA base directory
                if (!fs.existsSync(resolvedPath)) {
                    fs.mkdirSync(resolvedPath, { recursive: true });
                    aidaLogging(`✅ Created AIDA directory: ${resolvedPath}`);
                }

                // Create templates directory structure
                const templatesDirs = [
                    templatesPath,
                    path.join(templatesPath, 'review-code'),
                    path.join(templatesPath, 'review-code', 'languages'),
                    path.join(templatesPath, 'review-code', 'fallback')
                ];

                for (const dir of templatesDirs) {
                    if (!fs.existsSync(dir)) {
                        fs.mkdirSync(dir, { recursive: true });
                        aidaLogging(`✅ Created directory: ${dir}`);
                    }
                }

                // Copy templates from extension to AIDA folder
                const extensionTemplatesPath = path.join(global.extensionPath as any, 'templates');
                if (fs.existsSync(extensionTemplatesPath)) {
                    copyTemplatesRecursive(extensionTemplatesPath, templatesPath);
                    aidaLogging(`✅ Copied templates from extension to: ${templatesPath}`);
                }

                aidaLogging(`✅ AIDA structure created successfully at: ${resolvedPath}`);
                return {
                    basePath: resolvedPath,
                    source: 'config'
                };

            } catch (_error: unknown) {
                const error = toError(_error);
                aidaLogging(`❌ Failed to create AIDA structure: ${error.message}`);
                aidaLogging(`⚠️ Falling back to extension templates`);
            }
        }
    }

    // Priority 2: Workspace AIDA folder
    if (workspaceFolder) {
        const workspaceAidaPath = path.join(workspaceFolder.uri.fsPath, 'AIDA');
        if (fs.existsSync(workspaceAidaPath)) {
            aidaLogging(`✅ Found workspace AIDA folder: ${workspaceAidaPath}`);
            return {
                basePath: workspaceAidaPath,
                source: 'workspace'
            };
        }
    }

    // Priority 3: Extension templates (fallback)
    aidaLogging(`✅ Using extension AIDA templates`);
    return {
        basePath: global.extensionPath as string,
        source: 'extension'
    };
}

function copyTemplatesRecursive(src: string, dest: string) {
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }

    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            copyTemplatesRecursive(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
            aidaLogging(`  📄 Copied: ${entry.name}`);
        }
    }
}

async function loadTemplateWithPriority(templateType: string, detection: Record<string, any>): Promise<ITemplateResult> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

    // Resolve AIDA base path
    const { basePath, source } = resolveAidaBasePath(workspaceFolder);

    // Build template paths based on detection
    const templatePaths = [
        // Language-specific template
        path.join(basePath as any, 'templates', 'review-code', 'languages', detection.detected.toLowerCase(), templateType),
        // Fallback template
        path.join(basePath as any, 'templates', 'review-code', 'fallback', templateType),
        // Legacy path support
        path.join(basePath as any, 'templates', detection.templatePath, templateType)
    ];

    let templateContent = null;
    let usedTemplatePath = null;

    // Try each template path in order
    for (const templatePath of templatePaths) {
        aidaLogging(`🔍 Checking template: ${templatePath}`);
        if (fs.existsSync(templatePath)) {
            aidaLogging(`✅ Found template at: ${templatePath}`);
            const rawContent = fs.readFileSync(templatePath, 'utf8');

            // Process template with placeholder replacement
            templateContent = processTemplateContent(rawContent, templatePath);
            usedTemplatePath = templatePath;
            break;
        }
    }

    if (!templateContent) {
        throw new Error(`Template not found: ${templateType} for ${detection.detected}`);
    }

    // Determine display paths (use backslash for Windows consistency)
    const templatesBasePath = path.join(basePath as any, 'templates');
    const relativePath = path.relative(templatesBasePath, usedTemplatePath!);
    const pathParts = relativePath.split(path.sep);
    const templatePathDisplay = pathParts.slice(0, -1).join('\\'); // ✅ Use backslash for display

    // Source display - show relative path from workspace if config, otherwise extension
    let sourceDisplay;
    if (source === 'config' && workspaceFolder) {
        const relativeFromWorkspace = normalizePathForDisplay(path.relative(workspaceFolder.uri.fsPath, basePath as any));
        sourceDisplay = relativeFromWorkspace || 'workspace';
    } else {
        sourceDisplay = 'extension\\templates'; // ✅ Use backslash for display
    }

    aidaLogging(`✅ Loaded template from: ${sourceDisplay}/${templatePathDisplay} (${templateContent.length} chars)`);

    return {
        content: templateContent,
        templateSource: sourceDisplay,
        templatePath: templatePathDisplay,
        usedPath: usedTemplatePath!
    };
}

function loadBaseTemplate(mainTemplatePath: string, baseFileName: string) {

    try {
        // Get directory of main template
        const templateDir = path.dirname(mainTemplatePath);

        // Build base template path in same directory
        const baseTemplatePath = path.join(templateDir, baseFileName);

        aidaLogging(`🔍 Looking for base template: ${baseTemplatePath}`);

        if (fs.existsSync(baseTemplatePath)) {
            const baseContent = fs.readFileSync(baseTemplatePath, 'utf8');
            aidaLogging(`✅ Loaded base template: ${baseTemplatePath} (${baseContent.length} chars)`);
            return baseContent;
        } else {
            aidaLogging(`⚠️ Base template not found: ${baseTemplatePath}`);
            return null;
        }
    } catch (_error: unknown) {
        const error = toError(_error);
        aidaLogging(`❌ Error loading base template: ${error.message}`);
        return null;
    }
}

function processTemplateContent(content: string, mainTemplatePath: string, placeholder = '{{REVIEW_BASE}}', baseFileName = 'review-base.md') {
    aidaLogging(`🔧 Processing template placeholders for: ${placeholder}`);

    if (!content.includes(placeholder)) {
        aidaLogging(`ℹ️ No ${placeholder} placeholder found, using content as-is`);
        return content;
    }

    aidaLogging(`✅ Found ${placeholder} placeholder, loading base content...`);

    let baseContent = loadBaseTemplate(mainTemplatePath, baseFileName);

    if (baseContent) {
        // Check if we have selected business documents
        if (global.selectedBusinessDocs && (global.selectedBusinessDocs as any).length > 0) {
            aidaLogging('📚 Business documents selected, building enhanced base content...');
            const businessDocsContent = _getBusinessDocs().buildBusinessDocsContent((global as any).selectedBusinessDocs);

            if (businessDocsContent) {
                // Prepend business docs to base content
                baseContent = businessDocsContent + '\n\n' + baseContent;
                aidaLogging(`📄 Enhanced businessDocsContent preview: ${businessDocsContent}`);
            }
        } else {
            aidaLogging('📋 No business documents selected, using original base content');
        }

        const processedContent = content.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), baseContent);
        aidaLogging(`🔧 Replaced ${placeholder} with enhanced base content (final length: ${processedContent.length} chars)`);
        return processedContent;
    } else {
        aidaLogging(`⚠️ Base template not found, keeping ${placeholder} placeholder as-is`);
        return content;
    }

}

// ============================================================
// Template management functions (moved from extension.js in Phase 2)
// ============================================================

/**
 * Ensure AIDA templates exist for review commands
 * Creates template structure if AIDA folder doesn't exist
 * @param {vscode.ExtensionContext} context
 */
async function ensureAidaTemplatesForReview(context: Record<string, any>) {
    try {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            console.log('No workspace folder found, skipping template generation');
            return;
        }

        const workspaceAidaPath = path.join(workspaceFolder.uri.fsPath, 'AIDA');

        // Check if AIDA folder exists
        if (!fs.existsSync(workspaceAidaPath)) {
            console.log('🆕 AIDA folder not found - creating complete template structure...');
            const extensionTemplatesPath = path.join(context.extensionPath, 'templates');
            await createAidaTemplateStructure(extensionTemplatesPath, path.join(workspaceAidaPath, 'templates'));
            console.log('✅ AIDA templates created for review commands');
        } else {
            console.log('✅ AIDA folder exists - no action needed for review commands');
        }

    } catch (error: unknown) {
        console.error('Error ensuring AIDA templates for review:', error);
    }
}

/**
 * Handle template sync for @sync command
 * If AIDA exists: sync new language templates only
 * If AIDA doesn't exist: create complete AIDA structure
 * @param {vscode.ExtensionContext} context
 */
async function handleSyncTemplates(context: Record<string, any>) {
    try {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            console.log('No workspace folder found, skipping sync');
            return;
        }

        const extensionTemplatesPath = path.join(context.extensionPath, 'templates');
        const workspaceAidaPath = path.join(workspaceFolder.uri.fsPath, 'AIDA', 'templates');

        if (!fs.existsSync(workspaceAidaPath)) {
            console.log('🆕 AIDA not found - creating complete template structure via sync...');
            await createAidaTemplateStructure(extensionTemplatesPath, workspaceAidaPath);
        } else {
            console.log('🔄 AIDA exists - syncing new language templates...');
            await syncNewLanguageTemplates(extensionTemplatesPath, workspaceAidaPath);
        }

    } catch (error: unknown) {
        console.error('Error handling sync templates:', error);
    }
}

/**
 * Creates complete AIDA template structure in workspace
 * @param {string} sourceTemplatePath - Extension template path
 * @param {string} targetAidaPath - Target AIDA path in workspace
 */
async function createAidaTemplateStructure(sourceTemplatePath: string, targetAidaPath: string) {
    const fsPromises = fs.promises;

    try {
        // Create AIDA directory structure
        await fsPromises.mkdir(targetAidaPath, { recursive: true });

        // Copy all language templates
        const reviewCodePath = path.join(sourceTemplatePath, 'review-code');
        const targetReviewCodePath = path.join(targetAidaPath, 'review-code');

        if (fs.existsSync(reviewCodePath)) {
            await copyDirectoryAsync(reviewCodePath, targetReviewCodePath);
            console.log('✅ AIDA templates created with all available languages');
        }
    } catch (error: unknown) {
        console.error('Error creating AIDA structure:', error);
    }
}

/**
 * Syncs new language templates from extension to workspace AIDA
 * @param {string} sourceTemplatePath - Extension template path  
 * @param {string} targetAidaPath - Target AIDA path in workspace
 */
async function syncNewLanguageTemplates(sourceTemplatePath: string, targetAidaPath: string) {
    const fsPromises = fs.promises;

    try {
        const sourceLanguagesPath = path.join(sourceTemplatePath, 'review-code', 'languages');
        const targetLanguagesPath = path.join(targetAidaPath, 'review-code', 'languages');

        if (fs.existsSync(sourceLanguagesPath)) {
            const sourceLanguages = await fsPromises.readdir(sourceLanguagesPath);
            const targetLanguages = fs.existsSync(targetLanguagesPath)
                ? await fsPromises.readdir(targetLanguagesPath)
                : [];

            // Find new languages to sync
            const newLanguages = sourceLanguages.filter((lang: string) => !targetLanguages.includes(lang));

            if (newLanguages.length > 0) {
                console.log(`🔄 Syncing ${newLanguages.length} new language(s): ${newLanguages.join(', ')}`);

                for (const newLang of newLanguages) {
                    const sourceLangPath = path.join(sourceLanguagesPath, newLang);
                    const targetLangPath = path.join(targetLanguagesPath, newLang);
                    await copyDirectoryAsync(sourceLangPath, targetLangPath);
                }

                console.log('✅ New language templates synced to AIDA');
            }
        }
    } catch (error: unknown) {
        console.error('Error syncing language templates:', error);
    }
}

/**
 * Recursively copy directory (async version)
 * @param {string} source - Source directory
 * @param {string} target - Target directory
 */
async function copyDirectoryAsync(source: string, target: string) {
    const fsPromises = fs.promises;

    try {
        await fsPromises.mkdir(target, { recursive: true });
        const entries = await fsPromises.readdir(source, { withFileTypes: true });

        for (const entry of entries) {
            const sourcePath = path.join(source, entry.name);
            const targetPath = path.join(target, entry.name);

            if (entry.isDirectory()) {
                await copyDirectoryAsync(sourcePath, targetPath);
            } else {
                await fsPromises.copyFile(sourcePath, targetPath);
            }
        }
    } catch (error: unknown) {
        console.error(`Error copying directory ${source} to ${target}:`, error);
    }
}

// ES exports
export { loadTemplateWithPriority, processTemplateContent, processTemplateWithPlaceholders, extractAngularChecks, getReviewTemplate, loadBaseTemplate, resolveAidaBasePath, copyTemplatesRecursive, normalizePathForDisplay, ensureAidaTemplatesForReview, handleSyncTemplates, createAidaTemplateStructure, syncNewLanguageTemplates, copyDirectoryAsync };
