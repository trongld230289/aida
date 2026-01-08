// Language and Framework Detection for Cross-Platform Reviews
// Supports: VS Code file review, GitHub, Azure DevOps, GitLab PR analysis
// Centralized detection logic for consistent framework/language identification

const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { aidaLogging } = require('./settings');

let _ops = null;

// VS Code Language Detection Engine
async function detectWithVSCode(filename, content) {
  try {
    if (!_ops) {
      const { ModelOperations } = await import("@vscode/vscode-languagedetection");
      _ops = await ModelOperations.create();
    }
    const res = await _ops.detectLanguage(filename, content ?? "");
    const id = res?.[0]?.languageId;
    return id ? (VS_ID_MAP[id] ?? id) : null;
  } catch {
    return null;
  }
}

// VS Code Language ID Mapping
const VS_ID_MAP = {
  'typescript': 'typescript',
  'javascript': 'javascript', 
  'csharp': 'csharp',
  'python': 'python',
  'rust': 'rust',
  'go': 'go',
  'html': 'html',
  'css': 'css',
  'scss': 'scss',
  'json': 'json',
  'php': 'php'
};

// Simple Extension Mapping (Fallback)
const SIMPLE_EXT_MAP = {
  '.ts': 'typescript',
  '.js': 'javascript',
  '.mjs': 'javascript',
  '.cs': 'csharp',
  '.py': 'python',
  '.rs': 'rust',
  '.go': 'go',
  '.html': 'html',
  '.css': 'css',
  '.scss': 'scss',
  '.json': 'json',
  '.jsx': 'react',
  '.tsx': 'react',
  '.vue': 'vue',
  '.php': 'php'
};

// Framework Detection Patterns
const FRAMEWORK_PATTERNS = {
  // Angular Detection
  angular: {
    files: ['angular.json', 'ng-package.json'],
    dependencies: ['@angular/core', '@angular/common'],
    patterns: ['@Component', '@Injectable', '@NgModule', 'AngularModule', 'OnInit', 'OnDestroy', 'ViewChild', 'FormGroup', 'FormControl', '.component.ts', '.component.html', 'selector:', 'templateUrl:', 'styleUrls:']
  },
  
  // React Detection
  react: {
    files: ['src/index.js', 'src/App.js', 'src/App.tsx', 'public/index.html', 'src/components/App.js'], 
    dependencies: ['react', 'react-dom', '@types/react', 'create-react-app'],
    patterns: ['useState', 'useEffect', 'JSX.Element', 'React.Component', 'ReactDOM.render', 'import React']
  },
  
  // Vue Detection
  vue: {
    files: ['vue.config.js', 'nuxt.config.js'],
    dependencies: ['vue', '@vue/cli', 'nuxt'],
    patterns: ['<template>', '<script setup>', 'defineComponent']
  },
  
  // Express Detection
  express: {
    files: ['server.js', 'app.js', 'index.js'], // Only specific server files, not generic package.json
    dependencies: ['express', '@types/express'],
    patterns: ['app.listen', 'express()', 'req.params']
  },
  
  // NestJS Detection
  nestjs: {
    files: ['nest-cli.json', 'package.json'],
    dependencies: ['@nestjs/core', '@nestjs/common'],
    patterns: ['@Controller', '@Injectable', '@Module']
  },
  
  // NodeJS Detection
  nodejs: {
    files: ['package.json', 'server.js', 'index.js'],
    dependencies: ['express', 'fastify', 'koa', 'hapi'],
    patterns: ['require(', 'module.exports', 'process.env', '__dirname', '__filename']
  },

  // PHP Detection
  php: {
    files: ['composer.json', 'index.php', 'config.php'],
    dependencies: ['laravel/framework', 'symfony/symfony', 'codeigniter/framework'],
    patterns: ['<?php', 'namespace', 'use ', 'class ', 'function ', '$_GET', '$_POST', 'echo ', 'require_once']
  }
};

// Extract file extension
function ext(filename) {
  const match = filename.match(/\.([^.]+)$/);
  return match ? `.${match[1].toLowerCase()}` : '';
}

// Check if file should be ignored
function ignore(path) {
  const ignorePaths = [
    'node_modules', 'dist', 'build', '.git', 
    'coverage', '.nyc_output', 'logs'
  ];
  return ignorePaths.some(p => path.includes(p));
}

// Extract added lines from patch for ML analysis
function addedSampleFromPatch(patch) {
  const lines = patch.split('\n').filter(line => line.startsWith('+'));
  return lines.slice(0, 20).join('\n'); // First 20 added lines
}

// Fallback detection using enry-style extension mapping
function detectWithEnryFromContent(filename, content) {
  try {
    return SIMPLE_EXT_MAP[ext(filename)] ?? null;
  } catch {
    return null;
  }
}

// Main Language Detection API
async function detectPrimaryLanguage(files, opts = {}) {
  const prefer = opts.prefer ?? "vscode";
  const w = opts.weighting ?? "additions";
  const minPatch = opts.minPatchForML ?? 64;

  const scores = {};

  for (const f of files) {
    if (ignore(f.path)) continue;
    
    const weight = w === "additions" ? (f.additions || 0)
                 : w === "net" ? (f.additions || 0) - (f.deletions || 0)
                               : (f.additions || 0) + (f.deletions || 0);
    
    if (weight <= 0) continue;

    let lang = null;

    if (prefer === "vscode") {
      // Try VS Code detection with patch content
      if (f.patch && f.patch.length >= minPatch) {
        lang = await detectWithVSCode(f.path, addedSampleFromPatch(f.patch));
      }
      // Try VS Code detection with raw content
      if (!lang && f.rawContentSample) {
        lang = await detectWithVSCode(f.path, f.rawContentSample);
      }
      // Fallback to extension mapping
      if (!lang && f.rawContentSample) {
        lang = detectWithEnryFromContent(f.path, f.rawContentSample);
      }
    } else {
      // Prefer extension-based detection
      if (f.rawContentSample) {
        lang = detectWithEnryFromContent(f.path, f.rawContentSample);
      }
      if (!lang && f.patch && f.patch.length >= minPatch) {
        lang = await detectWithVSCode(f.path, addedSampleFromPatch(f.patch));
      }
    }

    // Final fallback to extension mapping
    if (!lang) {
      lang = SIMPLE_EXT_MAP[ext(f.path)] ?? null;
    }

    if (lang) {
      scores[lang] = (scores[lang] ?? 0) + weight;
    }
  }

  const primary = Object.entries(scores).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  return { primary, breakdown: scores };
}

// Framework Detection from PR Files
async function detectFramework(files, primaryLang) {
  const filePaths = files.map(f => f.path.toLowerCase());
  const allContent = files.map(f => f.rawContentSample || f.patch || '').join('\n');

  // First priority: Check for framework-specific files (only for unique framework files)
  for (const [framework, config] of Object.entries(FRAMEWORK_PATTERNS)) {
    // Only check for unique framework files (not generic files like package.json, index.js)
    const uniqueFrameworkFiles = config.files.filter(file => 
      !['package.json', 'index.js', 'app.js', 'server.js'].includes(file.toLowerCase())
    );
    
    if (uniqueFrameworkFiles.length > 0) {
      const hasFrameworkFiles = uniqueFrameworkFiles.some(file => 
        filePaths.some(path => path === file.toLowerCase() || path.endsWith('/' + file.toLowerCase()))
      );

      if (hasFrameworkFiles) {
        aidaLogging(`🎯 Framework detected by unique files: ${framework} (matched file: ${uniqueFrameworkFiles.find(f => filePaths.some(p => p === f.toLowerCase() || p.endsWith('/' + f.toLowerCase())))})`);
        return framework;
      }
    }
  }

  // Second priority: Check for dependencies in package.json content
  const packageJsonFile = files.find(f => f.path.toLowerCase().includes('package.json'));
  aidaLogging('🔍 DEBUG: packageJsonFile found:', !!packageJsonFile);
  
  if (packageJsonFile) {
    aidaLogging('🔍 DEBUG: packageJsonFile path:', packageJsonFile.path);
    aidaLogging('🔍 DEBUG: packageJsonFile rawContentSample:', !!packageJsonFile.rawContentSample);
    aidaLogging('🔍 DEBUG: packageJsonFile content preview:', packageJsonFile.rawContentSample?.substring(0, 200));
  }
  
  if (packageJsonFile && packageJsonFile.rawContentSample) {
    try {
      const packageContent = JSON.parse(packageJsonFile.rawContentSample);
      aidaLogging('🔍 DEBUG: parsed package.json:', {
        name: packageContent.name,
        hasDependencies: !!packageContent.dependencies,
        hasDevDependencies: !!packageContent.devDependencies,
        dependenciesKeys: Object.keys(packageContent.dependencies || {}),
        devDependenciesKeys: Object.keys(packageContent.devDependencies || {})
      });
      
      // Special case: Check if it's a library FIRST (before framework detection)
      const isLibrary = packageContent.name && 
                       (!packageContent.dependencies || Object.keys(packageContent.dependencies).length === 0) &&
                       (!packageContent.devDependencies || Object.keys(packageContent.devDependencies).length === 0);
      
      if (isLibrary) {
        aidaLogging(`📚 Detected as JavaScript library: ${packageContent.name}`);
        return null; // Return null to use language template instead
      }

      const allDeps = {
        ...packageContent.dependencies,
        ...packageContent.devDependencies,
        ...packageContent.peerDependencies
      };

      // Then check for framework dependencies
      for (const [framework, config] of Object.entries(FRAMEWORK_PATTERNS)) {
        const matchedDeps = config.dependencies.filter(dep => allDeps && allDeps.hasOwnProperty(dep));
        
        if (matchedDeps.length > 0) {
          aidaLogging(`🎯 Framework detected by dependencies: ${framework} (found: ${matchedDeps.join(', ')})`);
          return framework;
        }
      }

    } catch (error) {
      aidaLogging('⚠️ Could not parse package.json for framework detection:', error.message);
    }
  }

  // Third priority: Check for framework patterns in content (LOWER confidence)
  aidaLogging('🔍 DEBUG: Starting content pattern detection...');
  aidaLogging('🔍 DEBUG: primaryLang:', primaryLang);
  aidaLogging('🔍 DEBUG: allContent length:', allContent.length);
  aidaLogging('🔍 DEBUG: allContent sample:', allContent.substring(0, 500));
  
  for (const [framework, config] of Object.entries(FRAMEWORK_PATTERNS)) {
    // Require multiple patterns for content-based detection (reduce false positives)
    const matchedPatterns = config.patterns.filter(pattern =>
      allContent.includes(pattern)
    );

    aidaLogging(`🔍 DEBUG: ${framework} patterns:`, config.patterns);
    aidaLogging(`🔍 DEBUG: ${framework} matched patterns (${matchedPatterns.length}):`, matchedPatterns);
    aidaLogging(`🔍 DEBUG: ${framework} compatible with ${primaryLang}:`, isCompatibleLanguage(framework, primaryLang));

    // Require at least 2 patterns for framework detection via content
    if (matchedPatterns.length >= 2 && isCompatibleLanguage(framework, primaryLang)) {
      aidaLogging(`🎯 Framework detected by patterns (${matchedPatterns.length}): ${framework}`);
      return framework;
    }
  }

  aidaLogging('🤷 No framework detected - using language template');
  return null;
}

// Check if framework is compatible with detected language
function isCompatibleLanguage(framework, language) {
  const compatibility = {
    angular: ['typescript', 'javascript'],
    react: ['typescript', 'javascript'],
    vue: ['typescript', 'javascript'], 
    express: ['typescript', 'javascript'],
    nestjs: ['typescript'],
    nodejs: ['typescript', 'javascript'],
    php: ['php']
  };

  return compatibility[framework]?.includes(language) ?? false;
}

/**
 * Find nearest project root from a file path
 * Walks up the directory tree looking for project indicators
 * @param {string} filePath - Full path to the file being reviewed
 * @returns {string} - Path to the nearest project root
 */
function findNearestProjectRoot(filePath) {
    // Project indicators in order of priority
    const projectIndicators = [
        'angular.json',        // Angular project
        'package.json',        // Node.js project
        'pyproject.toml',      // Python project
        'requirements.txt',    // Python project
        'Cargo.toml',          // Rust project
        'go.mod',              // Go project
        '.git',                // Git repository
        'tsconfig.json',       // TypeScript project
        'composer.json'        // PHP project
    ];
    
    let currentDir = path.dirname(filePath);
    const rootDir = path.parse(currentDir).root;
    
    while (currentDir !== rootDir) {
        // Check for any project indicator
        for (const indicator of projectIndicators) {
            const indicatorPath = path.join(currentDir, indicator);
            if (fs.existsSync(indicatorPath)) {
                aidaLogging(`🎯 Found project root at: ${currentDir} (indicator: ${indicator})`);
                return currentDir;
            }
        }
        
        // Move up one directory
        const parentDir = path.dirname(currentDir);
        if (parentDir === currentDir) break; // Reached filesystem root
        currentDir = parentDir;
    }
    
    // Fallback to file's directory
    aidaLogging(`⚠️ No project root found, using file directory: ${path.dirname(filePath)}`);
    return path.dirname(filePath);
}

/**
 * Single File Detection - Use workspace detection for consistency
 * Used for: @review-file individual file analysis
 * @param {string} filePath - Path to the file
 * @returns {Promise<object>} - Detection result with framework, confidence, etc.
 */
async function autoDetectLanguage(filePath) {
    try {
        // Get workspace folder path
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            // No workspace - fallback to simple extension detection
            const ext = path.extname(filePath).toLowerCase();
            const languageMap = {
                '.ts': 'TypeScript',
                '.js': 'JavaScript',
                '.tsx': 'React',
                '.jsx': 'React',
                '.py': 'Python',
                '.cs': 'CSharp',
                '.java': 'Java',
                '.go': 'Go',
                '.rs': 'Rust'
            };
            
            const language = languageMap[ext] || 'General';
            return {
                detected: language,
                type: language === 'General' ? 'fallback' : 'language',
                confidence: 'medium',
                reason: `${language} file extension detected (no workspace)`,
                templatePath: language === 'General' ? 'review-code/fallback' : `review-code/languages/${language.toLowerCase()}`
            };
        }

        // Use workspace detection for consistency
        const workspacePath = workspaceFolder.uri.fsPath;
        const detection = await autoDetectWorkspace(workspacePath, filePath);
        
        return detection;
        
    } catch (error) {
        aidaLogging('Single file detection error:', error);
        return {
            detected: 'General (fallback)',
            type: 'fallback',
            confidence: 'low',
            reason: 'Detection error occurred',
            templatePath: 'review-code/fallback'
        };
    }
}

/**
 * Workspace Detection - Comprehensive project-level framework detection
 * Used for: @review-changes workspace analysis
 * @param {string} workspacePath - Root workspace path
 * @param {string} targetFilePath - File being reviewed (optional)
 * @returns {Promise<object>} - Detection result with template info
 */
async function autoDetectWorkspace(workspacePath, targetFilePath = null) {
    const detectionResult = {
        type: 'fallback',
        detected: 'general',
        templatePath: 'review-code/fallback',
        confidence: 'low',
        reason: 'Default fallback',
        templateType: null
    };

    try {
        // PHASE 1: Framework Detection (Priority 1) - All map to languages path
        aidaLogging('🔍 Phase 1: Framework Detection');
        
        // If we have a target file, find the nearest project root from that file
        let searchPath = workspacePath;
        if (targetFilePath) {
            searchPath = findNearestProjectRoot(targetFilePath);
            aidaLogging(`🔍 Searching from file location: ${searchPath}`);
        }
        
        // Angular Detection - Check from searchPath
        const angularConfig = path.join(searchPath, 'angular.json');
        const packageJson = path.join(searchPath, 'package.json');
        
        if (fs.existsSync(angularConfig)) {
            aidaLogging(`✅ Angular detected: angular.json found at ${searchPath}`);
            return {
                ...detectionResult,
                type: 'language',
                detected: 'Angular',
                templatePath: 'review-code/languages/angular',
                confidence: 'high',
                reason: `angular.json configuration file found at ${searchPath}`
            };
        }
        
        // If no target file provided, fallback to checking subdirectories
        if (!targetFilePath) {
            try {
                const subdirs = fs.readdirSync(workspacePath, { withFileTypes: true })
                    .filter(dirent => dirent.isDirectory())
                    .map(dirent => dirent.name);
                    
                for (const subdir of subdirs) {
                    const subAngularConfig = path.join(workspacePath, subdir, 'angular.json');
                    if (fs.existsSync(subAngularConfig)) {
                        aidaLogging(`✅ Angular detected: angular.json found in subdirectory ${subdir}`);
                        return {
                            ...detectionResult,
                            type: 'language',
                            detected: 'Angular',
                            templatePath: 'review-code/languages/angular',
                            confidence: 'high',
                            reason: `angular.json configuration file found in ${subdir} subdirectory`
                        };
                    }
                }
            } catch (error) {
                aidaLogging('⚠️ Error checking subdirectories for Angular:', error.message);
            }
        }

        // React Detection (package.json based) - Use searchPath
        const packageJsonPath = path.join(searchPath, 'package.json');
        if (fs.existsSync(packageJsonPath)) {
            const packageContent = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            
            // React Framework
            if (packageContent.dependencies?.react || packageContent.devDependencies?.react) {
                aidaLogging('✅ React detected: react dependency found');
                return {
                    ...detectionResult,
                    type: 'language',
                    detected: 'React',
                    templatePath: 'review-code/languages/react',
                    confidence: 'high',
                    reason: 'React dependency found in package.json'
                };
            }

            // Vue Framework
            if (packageContent.dependencies?.vue || packageContent.devDependencies?.vue || 
                packageContent.dependencies?.['@vue/core']) {
                aidaLogging('✅ Vue detected: vue dependency found');
                return {
                    ...detectionResult,
                    type: 'language',
                    detected: 'Vue',
                    templatePath: 'review-code/languages/vue',
                    confidence: 'high',
                    reason: 'Vue dependency found in package.json'
                };
            }

            // Express Framework
            if (packageContent.dependencies?.express || packageContent.devDependencies?.express) {
                aidaLogging('✅ Express detected: express dependency found');
                return {
                    ...detectionResult,
                    type: 'language',
                    detected: 'Express',
                    templatePath: 'review-code/languages/express',
                    confidence: 'high',
                    reason: 'Express dependency found in package.json'
                };
            }

            // NestJS Framework
            if (packageContent.dependencies?.['@nestjs/core'] || 
                packageContent.devDependencies?.['@nestjs/core'] ||
                packageContent.dependencies?.['@nestjs/common']) {
                aidaLogging('✅ NestJS detected: @nestjs dependency found');
                return {
                    ...detectionResult,
                    type: 'language',
                    detected: 'NestJS',
                    templatePath: 'review-code/languages/nestjs',
                    confidence: 'high',
                    reason: 'NestJS dependency found in package.json'
                };
            }
            
            // NodeJS Framework
            if (packageContent.dependencies?.fastify || packageContent.dependencies?.koa ||
                packageContent.dependencies?.hapi) {
                aidaLogging('✅ NodeJS detected: Node.js framework dependency found');
                return {
                    ...detectionResult,
                    type: 'language',
                    detected: 'NodeJS',
                    templatePath: 'review-code/languages/nodejs',
                    confidence: 'high',
                    reason: 'Node.js framework dependency found in package.json'
                };
            }
        }

        // PHASE 2: Language Detection (Priority 2) - Use searchPath
        aidaLogging('🔍 Phase 2: Language Detection');

        // TypeScript Detection
        const tsConfigPath = path.join(searchPath, 'tsconfig.json');
        if (fs.existsSync(tsConfigPath) || 
            (targetFilePath && targetFilePath.endsWith('.ts'))) {
            aidaLogging('✅ TypeScript detected');
            return {
                ...detectionResult,
                type: 'language',
                detected: 'TypeScript',
                templatePath: 'review-code/languages/typescript',
                confidence: 'high',
                reason: 'tsconfig.json or .ts file found'
            };
        }

        // JavaScript Detection
        if (fs.existsSync(packageJsonPath) || 
            (targetFilePath && targetFilePath.endsWith('.js'))) {
            aidaLogging('✅ JavaScript detected');
            return {
                ...detectionResult,
                type: 'language',
                detected: 'JavaScript',
                templatePath: 'review-code/languages/javascript',
                confidence: 'medium',
                reason: 'package.json or .js file found'
            };
        }

        // Python Detection
        const pythonFiles = ['requirements.txt', 'pyproject.toml', 'setup.py'];
        for (const pythonFile of pythonFiles) {
            if (fs.existsSync(path.join(searchPath, pythonFile))) {
                aidaLogging('✅ Python detected');
                return {
                    ...detectionResult,
                    type: 'language',
                    detected: 'Python',
                    templatePath: 'review-code/languages/python',
                    confidence: 'high',
                    reason: `${pythonFile} found`
                };
            }
        }

        // C# Detection
        if (targetFilePath && targetFilePath.endsWith('.cs')) {
            aidaLogging('✅ C# detected');
            return {
                ...detectionResult,
                type: 'language',
                detected: 'CSharp',
                templatePath: 'review-code/languages/csharp',
                confidence: 'high',
                reason: '.cs file found'
            };
        }

        // Java Detection
        if (targetFilePath && targetFilePath.endsWith('.java')) {
            aidaLogging('✅ Java detected');
            return {
                ...detectionResult,
                type: 'language',
                detected: 'Java',
                templatePath: 'review-code/languages/java',
                confidence: 'high',
                reason: '.java file found'
            };
        }

        // Go Detection
        if (fs.existsSync(path.join(searchPath, 'go.mod')) ||
            (targetFilePath && targetFilePath.endsWith('.go'))) {
            aidaLogging('✅ Go detected');
            return {
                ...detectionResult,
                type: 'language',
                detected: 'Go',
                templatePath: 'review-code/languages/go',
                confidence: 'high',
                reason: 'go.mod or .go file found'
            };
        }

        // Rust Detection
        if (fs.existsSync(path.join(searchPath, 'Cargo.toml')) ||
            (targetFilePath && targetFilePath.endsWith('.rs'))) {
            aidaLogging('✅ Rust detected');
            return {
                ...detectionResult,
                type: 'language',
                detected: 'Rust',
                templatePath: 'review-code/languages/rust',
                confidence: 'high',
                reason: 'Cargo.toml or .rs file found'
            };
        }

        aidaLogging('⚠️ No specific framework or language detected, using fallback');
        return detectionResult;

    } catch (error) {
        aidaLogging('Detection error:', error);
        return detectionResult;
    }
}

/**
 * Get review template with framework detection
 * @param {string} templateType - Template type (review-file, review-changes, etc.)
 * @param {string} filePath - Path to file being reviewed
 * @returns {object} - Template content with detection info
 */
function getReviewTemplateWithDetection(templateType, filePath) {
    const detection = autoDetectLanguage(filePath);
    
    // Try framework-specific template first
    const templatePaths = [
        path.join(global.extensionPath, 'templates', detection.templatePath, `${templateType}.md`),
        path.join(global.extensionPath, 'templates', `${templateType}.md`)
    ];
    
    for (const templatePath of templatePaths) {
        if (fs.existsSync(templatePath)) {
            const content = fs.readFileSync(templatePath, 'utf8');
            return {
                content,
                detection,
                templatePath: templatePath,
                source: detection.detected
            };
        }
    }
    
    // Final fallback
    throw new Error(`Template not found: ${templateType}`);
}

/**
 * Display detection information in review output
 * @param {object} stream - Chat stream for output
 * @param {object} detection - Detection result
 * @param {string} templateType - Type of template being used
 */
function displayDetectionInfo(stream, detection, templateType) {
    // Detection header
    stream.markdown(`## 🎯 Auto-Detection Results\n\n`);
    
    // Framework/Language detection - All show as Language now
    if (detection.type === 'language') {
        stream.markdown(`**Language Detection:** ${detection.detected} ✅\n`);
    } else {
        stream.markdown(`**Detection:** ${detection.detected} (${detection.type}) ⚠️\n`);
    }
    
    // Template info
     // Add template used information
    if (detection.templateSource && detection.templatePath) {
        stream.markdown(`**Template used:** ${detection.templateSource}/${detection.templatePath}\n`);
    }
    stream.markdown(`**Review Template:** \`${templateType}\`\n`);
    // stream.markdown(`**Template Path:** \`${detection.templatePath}/${templateType}\`\n`);
    stream.markdown(`**Confidence:** ${detection.confidence} (${detection.reason})\n\n`);
    
   
    // Show appropriate icon and message
    const detectionEmoji = {
        'language': '💻', 
        'fallback': '📋'
    };
    
    const emoji = detectionEmoji[detection.type] || '📋';
    stream.markdown(`${emoji} **Using ${detection.detected}-specific review template**\n\n`);
    stream.markdown(`---\n\n`);
}

/**
 * Get programming language identifier from file extension
 * @param {string} ext - File extension (with or without dot)
 * @returns {string} - Language identifier for syntax highlighting
 */
function getLanguageFromExtension(ext) {
    const languageMap = {
        '.ts': 'typescript',
        '.js': 'javascript',
        '.html': 'html',
        '.css': 'css',
        '.scss': 'scss',
        '.json': 'json',
        '.md': 'markdown',
        '.py': 'python',
        '.java': 'java',
        '.cs': 'csharp'
    };
    return languageMap[ext] || 'text';
}

// Export all functions for use in other modules
module.exports = {
    // VS Code Detection
    detectWithVSCode,
    
    // Single File Detection (for @review-file)
    autoDetectLanguage,
    getReviewTemplateWithDetection,
    displayDetectionInfo,
    getLanguageFromExtension,
    
    // Workspace Detection (for @review-changes)  
    autoDetectWorkspace,
    
    // PR Detection (for @review-pr)
    detectPrimaryLanguage,
    detectFramework,
    mapToTemplatePath,
    detectFromPRFiles,
    
    // Utility Functions
    ext,
    ignore,
    addedSampleFromPatch,
    detectWithEnryFromContent,
    isCompatibleLanguage
};

// Map detection results to template paths - All go to languages now
function mapToTemplatePath(primaryLang, framework, breakdown) {
  // Priority: Framework-specific > Language-specific > Fallback
  // But all templates are now in languages folder
  
  if (framework && FRAMEWORK_PATTERNS[framework]) {
    return {
      type: 'language', // Changed from 'framework' to 'language'
      name: framework,
      path: `review-code/languages/${framework}`, // Changed from frameworks to languages
      confidence: 'high',
      source: 'framework-detection'
    };
  }

  if (primaryLang && primaryLang !== 'unknown') {
    return {
      type: 'language', 
      name: primaryLang,
      path: `review-code/languages/${primaryLang}`,
      confidence: 'medium',
      source: 'language-detection'
    };
  }

  return {
    type: 'fallback',
    name: 'generic',
    path: 'review-code/fallback',
    confidence: 'low',
    source: 'fallback'
  };
}

// Main PR Detection API
async function detectFromPRFiles(prFiles) {
  try {
    // Convert PR files to detection format
    const files = prFiles.map(f => ({
      path: f.path,
      rawContentSample: f.content,
      patch: f.patch,
      additions: (f.patch?.match(/^\+/gm) || []).length,
      deletions: (f.patch?.match(/^-/gm) || []).length
    }));

    // Detect primary language
    const detection = await detectPrimaryLanguage(files, {
      prefer: "vscode",
      weighting: "additions", 
      minPatchForML: 64
    });

    // Detect framework
    const framework = await detectFramework(files, detection.primary);

    // Map to template path
    const template = mapToTemplatePath(detection.primary, framework, detection.breakdown);

    return {
      language: detection.primary,
      framework,
      breakdown: detection.breakdown,
      template,
      confidence: template.confidence,
      debugInfo: {
        totalFiles: files.length,
        analyzedFiles: files.filter(f => !ignore(f.path)).length,
        languageScores: detection.breakdown
      }
    };

  } catch (error) {
    aidaLogging('PR Detection Error:', error);
    return {
      language: null,
      framework: null,
      breakdown: {},
      template: {
        type: 'fallback',
        name: 'generic', 
        path: 'fallback',
        confidence: 'unknown',
        source: 'error-fallback'
      },
      confidence: 'unknown',
      error: error.message
    };
  }
}
