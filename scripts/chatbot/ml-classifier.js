const natural = require('natural');
const stringSimilarity = require('string-similarity');
const { aidaLogging } = require('../settings');

class MLClassifier {
  constructor() {
    // Initialize Naive Bayes classifier
    this.classifier = new natural.BayesClassifier();
    this.trained = false;
    this.initializeTrainingData();
    
    // Keep existing keyword arrays for fallback
    this.contextKeywords = [
      // English context keywords
      'explain', 'fix', 'debug', 'refactor', 'optimize', 'test', 'document',
      'this', 'here', 'current', 'above', 'below', 'analyze', 'review',
      'trace', 'comment', 'improve', 'check', 'examine', 'validate',
      
      // Vietnamese context keywords
      'giải thích', 'sửa', 'tối ưu', 'kiểm tra', 'này', 'đây', 'hiện tại',
      'phân tích', 'xem xét', 'cải thiện', 'debug', 'refactor', 'cái',
      'đoạn', 'phần', 'dòng', 'function', 'hàm', 'lớp', 'method'
    ];
    
    this.noContextKeywords = [
      // English general keywords
      'hello', 'hi', 'thanks', 'bye', 'how are you', 'what is',
      'best practices', 'concept', 'theory', 'general', 'tutorial',
      'guide', 'introduction', 'difference', 'comparison', 'overview',
      
      // Vietnamese general keywords
      'chào', 'cảm ơn', 'tạm biệt', 'khái niệm', 'lý thuyết',
      'chung', 'tổng quát', 'hướng dẫn', 'giới thiệu', 'sự khác biệt',
      'so sánh', 'tổng quan', 'thực hành tốt'
    ];
  }

  initializeTrainingData() {
    try {
      // Training data - Context Required
      const contextRequired = [
        'explain this function',
        'what does this do',
        'fix this bug',
        'debug this code',
        'refactor this method',
        'optimize this',
        'this is broken',
        'error here',
        'why does this fail',
        'add comments to this',
        'analyze this code',
        'review this implementation',
        'trace through this',
        'document this function',
        'giải thích cái này',
        'sửa lỗi này',
        'debug đoạn này',
        'tối ưu function này',
        'kiểm tra code này',
        'phân tích đoạn này',
        'xem xét cái này',
        'làm gì ở đây',
        'tại sao lỗi',
        'có vấn đề gì'
      ];

      // Training data - No Context
      const noContext = [
        'hello',
        'hi there',
        'how are you',
        'what is javascript',
        'explain oop concepts',
        'best practices for react',
        'how to create api',
        'thanks',
        'goodbye',
        'what can you do',
        'help me understand',
        'tutorial for beginners',
        'what is the difference',
        'pros and cons',
        'chào bạn',
        'cảm ơn',
        'tạm biệt',
        'javascript là gì',
        'khái niệm oop',
        'thực hành tốt nhất',
        'làm sao để tạo',
        'hướng dẫn cho người mới',
        'sự khác biệt',
        'ưu nhược điểm'
      ];

      // Add training documents
      contextRequired.forEach(text => {
        this.classifier.addDocument(text, 'needs_context');
      });

      noContext.forEach(text => {
        this.classifier.addDocument(text, 'no_context');
      });

      // Train the classifier
      this.classifier.train();
      this.trained = true;
      
      aidaLogging('✅ ML Classifier trained with', contextRequired.length + noContext.length, 'examples');
    } catch (error) {
      console.warn('❌ Failed to train ML classifier:', error.message);
      this.trained = false;
    }
  }

  classify(text) {
    if (!text || typeof text !== 'string') {
      return { label: 'unknown', confidence: 0 };
    }

    try {
      if (this.trained) {
        // Use trained Bayes classifier
        const classifications = this.classifier.getClassifications(text);
        return {
          label: classifications[0].label,
          confidence: classifications[0].value,
          method: 'bayes'
        };
      } else {
        // Fallback to rule-based classification
        return this.fallbackClassify(text);
      }
    } catch (error) {
      console.warn('ML classification error:', error.message);
      return this.fallbackClassify(text);
    }
  }

  fallbackClassify(text) {
    const textLower = text.toLowerCase().trim();
    
    // Calculate scores using multiple methods
    const patternScore = this.calculatePatternScore(textLower);
    const keywordScore = this.calculateKeywordScore(textLower);
    const lengthScore = this.calculateLengthScore(textLower);
    const structureScore = this.calculateStructureScore(textLower);

    // Combine scores with weights
    const weights = {
      pattern: 0.4,
      keyword: 0.3,
      length: 0.2,
      structure: 0.1
    };

    const contextScore = 
      patternScore.context * weights.pattern +
      keywordScore.context * weights.keyword +
      lengthScore.context * weights.length +
      structureScore.context * weights.structure;

    const noContextScore = 
      patternScore.noContext * weights.pattern +
      keywordScore.noContext * weights.keyword +
      lengthScore.noContext * weights.length +
      structureScore.noContext * weights.structure;

    // Determine classification
    const needsContext = contextScore > noContextScore;
    const confidence = Math.abs(contextScore - noContextScore) / Math.max(contextScore + noContextScore, 1);

    return {
      label: needsContext ? 'needs_context' : 'no_context',
      confidence: Math.min(confidence, 1.0),
      method: 'fallback',
      scores: {
        context: contextScore,
        noContext: noContextScore,
        pattern: patternScore,
        keyword: keywordScore,
        length: lengthScore,
        structure: structureScore
      }
    };
  }

  calculatePatternScore(text) {
    let contextScore = 0;
    let noContextScore = 0;

    // Check context patterns
    for (const pattern of this.contextPatterns) {
      if (pattern.test(text)) {
        contextScore += 1;
      }
    }

    // Check no-context patterns
    for (const pattern of this.noContextPatterns) {
      if (pattern.test(text)) {
        noContextScore += 1;
      }
    }

    // Normalize scores
    const maxPatterns = Math.max(this.contextPatterns.length, this.noContextPatterns.length);
    return {
      context: contextScore / maxPatterns,
      noContext: noContextScore / maxPatterns
    };
  }

  calculateKeywordScore(text) {
    const words = text.split(/\s+/);
    let contextCount = 0;
    let noContextCount = 0;

    // Count context keywords
    this.contextKeywords.forEach(keyword => {
      if (text.includes(keyword.toLowerCase())) {
        contextCount++;
      }
    });

    // Count no-context keywords
    this.noContextKeywords.forEach(keyword => {
      if (text.includes(keyword.toLowerCase())) {
        noContextCount++;
      }
    });

    // Normalize by total words
    const totalWords = Math.max(words.length, 1);
    return {
      context: contextCount / totalWords,
      noContext: noContextCount / totalWords
    };
  }

  calculateLengthScore(text) {
    const length = text.length;
    
    // Short messages are often contextual (e.g., "fix this")
    // Very long messages are often general explanations
    let contextScore = 0;
    let noContextScore = 0;

    if (length < 20) {
      contextScore = 0.7; // Short messages likely contextual
    } else if (length < 50) {
      contextScore = 0.5; // Medium messages could be either
      noContextScore = 0.3;
    } else if (length < 100) {
      contextScore = 0.3;
      noContextScore = 0.5; // Longer messages often general
    } else {
      noContextScore = 0.8; // Very long messages usually general
    }

    return {
      context: contextScore,
      noContext: noContextScore
    };
  }

  calculateStructureScore(text) {
    let contextScore = 0;
    let noContextScore = 0;

    // Question marks might indicate general questions
    if (text.includes('?')) {
      if (text.match(/what\s+is|how\s+to|why\s+does.*in\s+general/i)) {
        noContextScore += 0.3;
      } else if (text.match(/what\s+does\s+this|why\s+is\s+this/i)) {
        contextScore += 0.5;
      }
    }

    // Exclamation marks often in greetings
    if (text.includes('!')) {
      if (text.match(/^(hello|hi|thanks)/i)) {
        noContextScore += 0.4;
      }
    }

    // Demonstrative pronouns indicate context
    if (text.match(/\b(this|that|these|those|here|there|này|đây|đó|kia)\b/i)) {
      contextScore += 0.6;
    }

    // Commands or imperatives often contextual
    if (text.match(/^(fix|explain|debug|refactor|optimize|sửa|giải thích)/i)) {
      contextScore += 0.5;
    }

    return {
      context: Math.min(contextScore, 1.0),
      noContext: Math.min(noContextScore, 1.0)
    };
  }

  /**
   * Get similarity score between text and a set of reference patterns
   * Now uses string-similarity library for better accuracy
   */
  getSimilarityScore(text, referenceTexts) {
    if (!referenceTexts || referenceTexts.length === 0) return 0;

    try {
      // Use string-similarity library for more accurate results
      const similarities = referenceTexts.map(ref => 
        stringSimilarity.compareTwoStrings(text.toLowerCase(), ref.toLowerCase())
      );
      
      return Math.max(...similarities);
    } catch (error) {
      console.warn('String similarity error:', error.message);
      // Fallback to Jaccard similarity
      const textWords = text.toLowerCase().split(/\s+/);
      let maxSimilarity = 0;

      referenceTexts.forEach(reference => {
        const refWords = reference.toLowerCase().split(/\s+/);
        const similarity = this.calculateJaccardSimilarity(textWords, refWords);
        if (similarity > maxSimilarity) {
          maxSimilarity = similarity;
        }
      });

      return maxSimilarity;
    }
  }

  /**
   * Calculate Jaccard similarity between two sets of words
   */
  calculateJaccardSimilarity(words1, words2) {
    const set1 = new Set(words1);
    const set2 = new Set(words2);
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
  }

  /**
   * Train classifier with additional examples (for future enhancement)
   */
  addTrainingExample(text, label) {
    // Store training examples for potential future model improvement
    if (!this.trainingData) {
      this.trainingData = [];
    }
    
    this.trainingData.push({ text, label, timestamp: Date.now() });
    
    // Limit training data size
    if (this.trainingData.length > 1000) {
      this.trainingData = this.trainingData.slice(-500);
    }
  }

  /**
   * Get classification statistics
   */
  getStats() {
    return {
      contextKeywordsCount: this.contextKeywords.length,
      noContextKeywordsCount: this.noContextKeywords.length,
      contextPatternsCount: this.contextPatterns.length,
      noContextPatternsCount: this.noContextPatterns.length,
      trainingDataSize: this.trainingData ? this.trainingData.length : 0
    };
  }
}

module.exports = MLClassifier;
