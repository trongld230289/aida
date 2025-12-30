const { LRUCache } = require('lru-cache');
const MLClassifier = require('./ml-classifier');
const LanguageProcessor = require('./language-processor');
const fs = require('fs');
const path = require('path');
const { aidaLogging } = require('../settings');

class ContextDetector {
  constructor() {
    this.mlClassifier = new MLClassifier();
    this.languageProcessor = new LanguageProcessor();
    
    // Use LRU cache for better memory management
    this.cache = new LRUCache({ 
      max: 500,           // Maximum 500 entries
      ttl: 1000 * 60 * 5  // 5 minutes TTL
    });
    
    this.performanceMetrics = {
      totalRequests: 0,
      contextIncluded: 0,
      avgConfidence: 0,
      avgProcessingTime: 0,
      cacheHits: 0
    };
  }

  /**
   * Main function to determine if content should be included
   * @param {string} message - User's message
   * @param {Object} editorContext - Editor context object
   * @param {Array} images - Array of image attachments
   * @returns {Object} Decision object with reasoning
   */
  async shouldIncludeContent(message, editorContext = {}, images = []) {
    const startTime = Date.now();
    
    // Check cache first
    const cacheKey = this._generateCacheKey(message, editorContext, images);
    if (this.cache.has(cacheKey)) {
      this.performanceMetrics.cacheHits++;
      const cachedResult = this.cache.get(cacheKey);
      this._trackRequest(cachedResult, startTime);
      return { ...cachedResult, fromCache: true };
    }

    // Initialize result
    const result = {
      includeContent: false,
      includeImages: [],  // Array of relevant image indices
      confidence: 0,
      reasons: [],
      language: 'en',
      method: 'unknown',
      debug: {},
      imageAnalysis: []  // Analysis for each image
    };

    try {
      // Step 1: Handle images if present
      if (images && images.length > 0) {
        const imageAnalysis = await this.analyzeImages(images, message, editorContext);
        result.imageAnalysis = imageAnalysis;
        result.includeImages = imageAnalysis
          .map((analysis, index) => analysis.isRelevant ? index : -1)
          .filter(index => index !== -1);
        
        // Only filter out images if:
        // 1. Message ONLY talks about images (no code/file context needed)
        // 2. AND no relevant images found
        // 3. AND no active file content that might need to be included
        const messageOnlyAboutImages = /^(this\s+)?(image|picture|screenshot|hình|ảnh|analyze this|what is this|explain this).*$/i.test(message.trim());
        const hasFileContent = editorContext.activeFile || editorContext.selectedText;
        
        if (messageOnlyAboutImages && result.includeImages.length === 0 && !hasFileContent) {
          result.includeContent = false;
          result.confidence = 85;
          result.reasons.push('Message only about images but no relevant images found and no file content');
          result.method = 'image_only_filter';
          this._setCacheValue(cacheKey, result);
          this._trackRequest(result, startTime);
          return result;
        }
        
        // If we have file content, include all images regardless of relevance
        // because images might provide additional context
        if (hasFileContent) {
          result.includeImages = images.map((_, index) => index);
          result.reasons.push('Including all images due to file context present');
        }
      }

      // Step 2: Basic validation
      if (!message || typeof message !== 'string' || message.trim().length === 0) {
        result.reasons.push('Empty or invalid message');
        this._setCacheValue(cacheKey, result);
        this._trackRequest(result, startTime);
        return result;
      }

      // Step 2: Check if file is open or text is selected
      if (!editorContext.activeFile && !editorContext.selectedText) {
        result.reasons.push('No active file or selection');
        result.confidence = 95;
        this._setCacheValue(cacheKey, result);
        this._trackRequest(result, startTime);
        return result;
      }

      // Step 3: Check for explicit selection (highest priority)
      if (editorContext.selectedText && editorContext.selectedText.trim().length > 0) {
        result.includeContent = true;
        result.confidence = 100;
        result.reasons.push('User has selected text');
        result.method = 'selection';
        this._setCacheValue(cacheKey, result);
        this._trackRequest(result, startTime);
        return result;
      }

      // Step 4: Detect language
      result.language = this.languageProcessor.detectLanguage(message);

      // Step 5: Calculate scores from different methods
      const scores = {
        patterns: this.checkPatterns(message, result.language),
        ml: this.checkML(message),
        keywords: this.checkKeywords(message),
        commands: this.checkCommands(message),
        context: this.checkContextClues(message, editorContext)
      };

      result.debug.scores = scores;

      // Step 6: Ensemble decision
      result.includeContent = this.makeEnsembleDecision(scores);
      result.confidence = this.calculateConfidence(scores);
      result.method = this.determineMethod(scores);
      result.reasons = this.collectReasons(scores);

      // Cache the result
      this._setCacheValue(cacheKey, result);
      this._trackRequest(result, startTime);

      return result;

    } catch (error) {
      console.warn('Context detection error:', error);
      result.reasons.push(`Error during analysis: ${error.message}`);
      result.confidence = 10;
      this._trackRequest(result, startTime);
      return result;
    }
  }

  checkPatterns(message, language) {
    try {
      const patternResult = this.languageProcessor.checkPatterns(message, language);
      return {
        needsContext: patternResult.needsContext,
        confidence: patternResult.confidence || (patternResult.matched ? 90 : 0),
        reason: patternResult.matched ? `Matched pattern: ${patternResult.matched}` : 'No pattern match'
      };
    } catch (error) {
      return {
        needsContext: null,
        confidence: 0,
        reason: `Pattern check error: ${error.message}`
      };
    }
  }

  checkML(message) {
    try {
      const mlResult = this.mlClassifier.classify(message);
      return {
        needsContext: mlResult.label === 'needs_context',
        confidence: Math.round(mlResult.confidence * 100),
        reason: `ML classified as: ${mlResult.label} (${Math.round(mlResult.confidence * 100)}%)`
      };
    } catch (error) {
      return {
        needsContext: null,
        confidence: 0,
        reason: `ML classification error: ${error.message}`
      };
    }
  }

  checkKeywords(message) {
    try {
      const universal = require('./patterns/universal-patterns');
      const messageLower = message.toLowerCase();
      const words = messageLower.split(/\s+/);
      
      let contextKeywords = 0;
      let generalKeywords = 0;
      
      // Count keyword matches
      words.forEach(word => {
        if (universal.CONTEXT_KEYWORDS && universal.CONTEXT_KEYWORDS.some(k => 
          word.includes(k.toLowerCase()) || k.toLowerCase().includes(word)
        )) {
          contextKeywords++;
        }
        if (universal.GENERAL_KEYWORDS && universal.GENERAL_KEYWORDS.some(k => 
          word.includes(k.toLowerCase()) || k.toLowerCase().includes(word)
        )) {
          generalKeywords++;
        }
      });
      
      const needsContext = contextKeywords > generalKeywords;
      const confidence = Math.min(Math.abs(contextKeywords - generalKeywords) * 25, 80);
      
      return {
        needsContext,
        confidence,
        reason: `Keywords: ${contextKeywords} context, ${generalKeywords} general`
      };
    } catch (error) {
      return {
        needsContext: null,
        confidence: 0,
        reason: `Keyword check error: ${error.message}`
      };
    }
  }

  checkCommands(message) {
    const commands = {
      '/explain': { score: 100, needsContext: true },
      '/fix': { score: 100, needsContext: true },
      '/test': { score: 90, needsContext: true },
      '/document': { score: 100, needsContext: true },
      '/refactor': { score: 100, needsContext: true },
      '/analyze': { score: 95, needsContext: true },
      '/review': { score: 95, needsContext: true },
      '/help': { score: 80, needsContext: false },
      '/new': { score: 70, needsContext: false },
      '/create': { score: 60, needsContext: false }
    };
    
    const firstWord = message.trim().split(' ')[0].toLowerCase();
    const command = commands[firstWord];
    
    if (command) {
      return {
        needsContext: command.needsContext,
        confidence: command.score,
        reason: `Command detected: ${firstWord} (${command.needsContext ? 'needs context' : 'no context'})`
      };
    }
    
    return {
      needsContext: null,
      confidence: 0,
      reason: 'No command detected'
    };
  }

  checkContextClues(message, editorContext) {
    let score = 0;
    const reasons = [];
    
    try {
      // Check for line numbers or specific references
      if (/\b(line|dòng)\s*\d+/i.test(message)) {
        score += 40;
        reasons.push('Contains line number reference');
      }

      // Check for numbers (could be line references)
      if (/\d+/.test(message) && !/\b(best|top|first|1st|2nd|3rd)\s*\d+/i.test(message)) {
        score += 25;
        reasons.push('Contains numbers (possible references)');
      }
      
      // Check message length (short messages often contextual)
      const length = message.trim().length;
      if (length < 15) {
        score += 30;
        reasons.push('Very short message');
      } else if (length < 30) {
        score += 20;
        reasons.push('Short message');
      } else if (length > 100) {
        score -= 15;
        reasons.push('Long message (often general)');
      }
      
      // Check for recent edits (if available)
      if (editorContext.recentlyEditedLines?.length > 0) {
        score += 25;
        reasons.push('Recent edits detected');
      }
      
      // Check for deictic words (this, that, here, etc.)
      if (/\b(this|that|here|there|it|these|those|này|đây|đó|kia|cái|đoạn)\b/i.test(message)) {
        score += 35;
        reasons.push('Contains deictic words (this, that, here, etc.)');
      }

      // Check for file type relevance
      if (editorContext.fileType) {
        const fileTypeInMessage = message.toLowerCase().includes(editorContext.fileType.toLowerCase());
        const codeTerms = /\b(function|method|class|variable|component|service|module)\b/i.test(message);
        
        if (fileTypeInMessage || codeTerms) {
          score += 20;
          reasons.push('Message relates to file type or code structure');
        }
      }

      // Check for cursor position context
      if (editorContext.cursorPosition && editorContext.cursorPosition > 0) {
        score += 10;
        reasons.push('Cursor positioned in file');
      }

      // Check for error/debugging context
      if (/\b(error|bug|issue|problem|fail|broken|not\s+work|lỗi|sai|vấn\s+đề)\b/i.test(message)) {
        score += 30;
        reasons.push('Error/debugging context detected');
      }

      return {
        needsContext: score > 50,
        confidence: Math.min(score, 90),
        reason: reasons.length > 0 ? reasons.join(', ') : 'No significant context clues'
      };

    } catch (error) {
      return {
        needsContext: null,
        confidence: 0,
        reason: `Context clues error: ${error.message}`
      };
    }
  }

  makeEnsembleDecision(scores) {
    // Weighted voting system with command priority
    const weights = {
      commands: 0.40,   // Commands have highest priority
      patterns: 0.30,   // Pattern matching
      ml: 0.20,         // ML classification
      context: 0.10,    // Context clues
      keywords: 0.05    // Keywords have lowest weight
    };
    
    let totalScore = 0;
    let totalWeight = 0;
    
    // Special handling for commands - if command is detected with high confidence, prioritize it
    if (scores.commands && scores.commands.needsContext !== null && scores.commands.confidence >= 90) {
      return scores.commands.needsContext;
    }
    
    Object.entries(scores).forEach(([method, result]) => {
      if (result.needsContext !== null && result.confidence > 0) {
        const weight = weights[method] || 0.1;
        const score = result.needsContext ? result.confidence : -result.confidence;
        totalScore += score * weight;
        totalWeight += weight;
      }
    });
    
    // Normalize and apply threshold
    const normalizedScore = totalWeight > 0 ? totalScore / totalWeight : 0;
    return normalizedScore > 15; // Lower threshold for better sensitivity
  }

  calculateConfidence(scores) {
    const confidences = Object.values(scores)
      .filter(s => s.confidence > 0)
      .map(s => s.confidence);
    
    if (confidences.length === 0) return 0;
    
    // Weighted average based on method reliability
    const weights = { patterns: 0.4, ml: 0.3, commands: 0.2, context: 0.1 };
    let weightedSum = 0;
    let totalWeight = 0;

    Object.entries(scores).forEach(([method, result]) => {
      if (result.confidence > 0) {
        const weight = weights[method] || 0.1;
        weightedSum += result.confidence * weight;
        totalWeight += weight;
      }
    });

    return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
  }

  determineMethod(scores) {
    // Find the method with highest confidence
    let bestMethod = 'unknown';
    let bestConfidence = 0;
    
    Object.entries(scores).forEach(([method, result]) => {
      if (result.confidence > bestConfidence) {
        bestMethod = method;
        bestConfidence = result.confidence;
      }
    });
    
    return bestMethod;
  }

  collectReasons(scores) {
    const reasons = [];
    
    Object.entries(scores).forEach(([method, result]) => {
      if (result.reason && result.confidence > 10) {
        reasons.push(`${method}: ${result.reason}`);
      }
    });
    
    return reasons.length > 0 ? reasons : ['No significant indicators found'];
  }

  // Cache management methods
  _generateCacheKey(message, editorContext) {
    const contextKey = JSON.stringify({
      hasFile: !!editorContext.activeFile,
      hasSelection: !!editorContext.selectedText,
      fileType: editorContext.fileType
    });
    return `${message.toLowerCase().trim()}_${contextKey}`;
  }

  _setCacheValue(key, value) {
    // LRU cache handles size management automatically
    this.cache.set(key, value);
  }

  _trackRequest(decision, startTime) {
    const processingTime = Date.now() - startTime;
    
    this.performanceMetrics.totalRequests++;
    if (decision.includeContent) this.performanceMetrics.contextIncluded++;
    
    // Update averages
    const prevTotal = this.performanceMetrics.totalRequests - 1;
    this.performanceMetrics.avgConfidence = 
      (this.performanceMetrics.avgConfidence * prevTotal + decision.confidence) 
      / this.performanceMetrics.totalRequests;
    
    this.performanceMetrics.avgProcessingTime = 
      (this.performanceMetrics.avgProcessingTime * prevTotal + processingTime) 
      / this.performanceMetrics.totalRequests;
  }

  // Performance and debugging methods
  getPerformanceReport() {
    const inclusionRate = this.performanceMetrics.totalRequests > 0 
      ? (this.performanceMetrics.contextIncluded / this.performanceMetrics.totalRequests * 100).toFixed(2)
      : '0.00';
    
    const cacheHitRate = this.performanceMetrics.totalRequests > 0
      ? (this.performanceMetrics.cacheHits / this.performanceMetrics.totalRequests * 100).toFixed(2)
      : '0.00';
    
    return {
      totalRequests: this.performanceMetrics.totalRequests,
      inclusionRate: `${inclusionRate}%`,
      cacheHitRate: `${cacheHitRate}%`,
      avgConfidence: `${this.performanceMetrics.avgConfidence.toFixed(2)}%`,
      avgProcessingTime: `${this.performanceMetrics.avgProcessingTime.toFixed(2)}ms`,
      cacheSize: this.cache.size
    };
  }

  clearCache() {
    this.cache.clear();
  }

  resetMetrics() {
    this.performanceMetrics = {
      totalRequests: 0,
      contextIncluded: 0,
      avgConfidence: 0,
      avgProcessingTime: 0,
      cacheHits: 0
    };
  }

  /**
   * Analyze images to determine relevance to current file content
   * @param {Array} images - Array of image data/paths
   * @param {string} message - User's message
   * @param {Object} editorContext - Editor context
   * @returns {Array} Analysis results for each image
   */
  async analyzeImages(images, message, editorContext) {
    const analyses = [];
    
    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      const analysis = {
        index: i,
        isRelevant: false,
        confidence: 0,
        reasons: [],
        detectedElements: [],
        extractedText: '',
        imageType: 'unknown'
      };

      try {
        // 1. Image type detection
        analysis.imageType = this.detectImageType(image);
        
        // 2. OCR Text extraction
        analysis.extractedText = await this.extractTextFromImage(image);
        
        // 3. Check for coding elements
        analysis.detectedElements = this.detectCodingElements(analysis.extractedText, image);
        
        // 4. Relevance scoring
        const relevanceScore = this.calculateImageRelevance(
          analysis, message, editorContext
        );
        
        analysis.confidence = relevanceScore.confidence;
        analysis.isRelevant = relevanceScore.confidence > 50; // Reduced threshold to 50%
        analysis.reasons = relevanceScore.reasons;
        
      } catch (error) {
        console.warn(`Image analysis failed for image ${i}:`, error.message);
        analysis.reasons.push(`Analysis failed: ${error.message}`);
      }

      analyses.push(analysis);
    }
    
    return analyses;
  }

  /**
   * Detect image type based on visual characteristics
   * @param {Object} image - Image data
   * @returns {string} Image type
   */
  detectImageType(image) {
    // Simple heuristics for image type detection
    // In a real implementation, you'd use computer vision
    
    const filename = image.name || image.path || '';
    const extension = path.extname(filename).toLowerCase();
    
    // Check filename patterns
    if (filename.includes('screenshot') || filename.includes('screen')) {
      return 'screenshot';
    }
    if (filename.includes('diagram') || filename.includes('chart')) {
      return 'diagram';
    }
    if (filename.includes('error') || filename.includes('bug')) {
      return 'error_screenshot';
    }
    if (filename.includes('ui') || filename.includes('interface')) {
      return 'ui_screenshot';
    }
    
    // Default based on extension
    switch (extension) {
      case '.png':
      case '.jpg':
      case '.jpeg':
        return 'screenshot';
      case '.svg':
        return 'diagram';
      case '.gif':
        return 'animation';
      default:
        return 'unknown';
    }
  }

  /**
   * Extract text from image using OCR
   * @param {Object} image - Image data
   * @returns {string} Extracted text
   */
  async extractTextFromImage(image) {
    try {
      // Use tesseract.js for OCR text extraction
      const { createWorker } = require('tesseract.js');
      
      let imagePath = image.path || image.data;
      
      // If image is base64 data, handle it directly
      if (typeof imagePath === 'string' && imagePath.startsWith('data:')) {
        // tesseract.js can handle base64 data URLs directly
      } else if (typeof imagePath === 'string' && !imagePath.startsWith('data:')) {
        // File path - check if file exists
        const fs = require('fs');
        if (!fs.existsSync(imagePath)) {
          console.warn('Image file not found:', imagePath);
          return this.extractTextFromFilename(image);
        }
      } else {
        // Fallback to filename-based detection
        return this.extractTextFromFilename(image);
      }

      // Initialize tesseract worker
      const worker = await createWorker('eng+vie', 1, {
        logger: m => {
          if (m.status === 'recognizing text') {
            aidaLogging(`OCR Progress: ${Math.round(m.progress * 100)}%`);
          }
        }
      });

      // Perform OCR
      const { data: { text } } = await worker.recognize(imagePath, {
        // Optimize for code/text detection
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789{}[]().,;:\'"/\\-_=+<>!@#$%^&*|`~àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđĐ \n\t',
        tessedit_pageseg_mode: '6' // Uniform block of text
      });

      await worker.terminate();
      
      // Clean and return extracted text
      const cleanedText = text
        .replace(/\n+/g, ' ')  // Replace multiple newlines with space
        .replace(/\s+/g, ' ')  // Replace multiple spaces with single space
        .trim();
        
      aidaLogging(`OCR extracted ${cleanedText.length} characters from image`);
      return cleanedText;

    } catch (error) {
      console.warn('OCR extraction failed:', error.message);
      // Fallback to filename-based detection
      return this.extractTextFromFilename(image);
    }
  }

  /**
   * Fallback text extraction from filename patterns
   * @param {Object} image - Image data
   * @returns {string} Extracted text patterns
   */
  extractTextFromFilename(image) {
    try {
      const filename = image.name || image.path || '';
      
      // Simple pattern matching based on filename
      const codePatterns = [
        'component', 'service', 'module', 'controller',
        'function', 'class', 'method', 'variable',
        'error', 'bug', 'exception', 'debug',
        'typescript', 'javascript', 'angular', 'react',
        'html', 'css', 'scss', 'json', 'interface',
        'implements', 'extends', 'import', 'export'
      ];
      
      const detectedTerms = codePatterns.filter(pattern => 
        filename.toLowerCase().includes(pattern)
      );
      
      return detectedTerms.join(' ');
    } catch (error) {
      console.warn('Filename extraction failed:', error.message);
      return '';
    }
  }

  /**
   * Detect coding elements in extracted text and image
   * @param {string} extractedText - OCR extracted text
   * @param {Object} image - Image data
   * @returns {Array} Detected elements
   */
  detectCodingElements(extractedText, image) {
    const elements = [];
    
    // Code syntax patterns
    const codePatterns = [
      { pattern: /function\s+\w+\s*\(/i, type: 'function_declaration' },
      { pattern: /class\s+\w+/i, type: 'class_declaration' },
      { pattern: /import\s+.+\s+from/i, type: 'import_statement' },
      { pattern: /export\s+(default\s+)?/i, type: 'export_statement' },
      { pattern: /\w+\s*:\s*\w+/i, type: 'type_annotation' },
      { pattern: /console\.(log|error|warn)/i, type: 'console_statement' },
      { pattern: /\.\w+\(/i, type: 'method_call' },
      { pattern: /{[\s\S]*}/i, type: 'code_block' },
      { pattern: /\/\*[\s\S]*?\*\/|\/\/.*$/m, type: 'comment' }
    ];
    
    for (const { pattern, type } of codePatterns) {
      if (pattern.test(extractedText)) {
        elements.push(type);
      }
    }
    
    // UI/Error patterns
    const uiPatterns = [
      { pattern: /error|exception|failed|undefined/i, type: 'error_message' },
      { pattern: /button|input|form|modal|dialog/i, type: 'ui_element' },
      { pattern: /\d+:\d+|\w+\.ts:\d+/i, type: 'file_reference' }
    ];
    
    for (const { pattern, type } of uiPatterns) {
      if (pattern.test(extractedText)) {
        elements.push(type);
      }
    }
    
    return [...new Set(elements)]; // Remove duplicates
  }

  /**
   * Calculate image relevance to current context
   * @param {Object} analysis - Image analysis result
   * @param {string} message - User message
   * @param {Object} editorContext - Editor context
   * @returns {Object} Relevance score and reasons
   */
  calculateImageRelevance(analysis, message, editorContext) {
    let confidence = 0;
    const reasons = [];
    
    // 1. Check if message references the image
    const messageRefersToImage = /\b(this\s+)?(image|picture|screenshot|error|bug|issue|hình|ảnh)\b/i.test(message);
    if (messageRefersToImage) {
      confidence += 30;
      reasons.push('Message explicitly references image');
    }
    
    // 2. Check for review/analysis intent with images
    const reviewIntent = /\b(review|analyze|check|fix|debug|explain|what|how|why|sao|tại sao|làm sao|giải thích)\b/i.test(message);
    if (reviewIntent) {
      confidence += 20;
      reasons.push('Message indicates review/analysis intent');
    }
    
    // 3. Check for coding elements
    if (analysis.detectedElements.length > 0) {
      confidence += 25;
      reasons.push(`Contains coding elements: ${analysis.detectedElements.join(', ')}`);
    }
    
    // 4. Check extracted text relevance to current file
    if (editorContext.activeFile && analysis.extractedText) {
      const fileName = path.basename(editorContext.activeFile);
      const fileExtension = path.extname(fileName).replace('.', '');
      
      if (analysis.extractedText.toLowerCase().includes(fileName.toLowerCase())) {
        confidence += 35;
        reasons.push('Image contains current filename');
      }
      
      if (analysis.extractedText.toLowerCase().includes(fileExtension.toLowerCase())) {
        confidence += 15;
        reasons.push(`Image contains file type: ${fileExtension}`);
      }
    }
    
    // 5. Image type relevance
    const relevantImageTypes = ['screenshot', 'error_screenshot', 'ui_screenshot', 'diagram'];
    if (relevantImageTypes.includes(analysis.imageType)) {
      confidence += 20;
      reasons.push(`Relevant image type: ${analysis.imageType}`);
    }
    
    // 6. Context-specific relevance
    if (message.includes('fix') || message.includes('debug') || message.includes('error') || message.includes('lỗi')) {
      if (analysis.imageType === 'error_screenshot' || 
          analysis.detectedElements.includes('error_message')) {
        confidence += 25;
        reasons.push('Image appears to show error/debugging context');
      }
    }
    
    // 7. Bonus for images with substantial text content
    if (analysis.extractedText.length > 50) {
      confidence += 15;
      reasons.push('Image contains substantial text content');
    }
    
    // 8. Penalty for generic/unrelated images (but less harsh)
    if (analysis.detectedElements.length === 0 && analysis.extractedText.trim().length < 10) {
      confidence -= 20; // Reduced penalty
      reasons.push('Image appears to contain minimal relevant content');
    }
    
    // 9. If we have file context, be more lenient with images
    if (editorContext.activeFile || editorContext.selectedText) {
      confidence += 10;
      reasons.push('File context present - image may provide additional context');
    }
    
    return {
      confidence: Math.max(0, Math.min(100, confidence)),
      reasons
    };
  }

  /**
   * Update cache key generation to include images
   * @param {string} message 
   * @param {Object} editorContext 
   * @param {Array} images 
   * @returns {string}
   */
  _generateCacheKey(message, editorContext, images = []) {
    const imageSignature = images.map(img => 
      `${img.name || 'unnamed'}_${img.size || 0}`
    ).join('|');
    
    return `${message}_${editorContext.activeFile || 'no-file'}_${editorContext.selectedText ? 'selected' : 'no-selection'}_${imageSignature}`;
  }
}

module.exports = ContextDetector;
