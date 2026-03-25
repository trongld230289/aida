/**
 * @module ml-classifier
 * @description Naive Bayes + fallback classifier for context detection.
 * Uses `natural` for NLP classification, `string-similarity` for fuzzy matching.
 * Migrated to TypeScript in Phase 4.2. Fixed missing contextPatterns initialization.
 */

import { aidaLogging } from '../core/settings';
import { toError } from '../core/error-utils';
import * as stringSimilarity from 'string-similarity';
import * as natural from 'natural';

// CJS modules

// -- Interfaces --------------------------------------------------

export interface IClassificationResult {
    label: string;
    confidence: number;
    method?: string;
    scores?: Record<string, any>;
}

export interface IScorePair {
    context: number;
    noContext: number;
}

export interface ITrainingExample {
    text: string;
    label: string;
    timestamp: number;
}

// -- Class -------------------------------------------------------

class MLClassifier {
    classifier: Record<string, any>;
    trained: boolean;
    contextKeywords: string[];
    noContextKeywords: string[];
    trainingData: ITrainingExample[];

    /** Regex patterns for context-required detection */
    contextPatterns: RegExp[];

    noContextPatterns: RegExp[];

    constructor() {
        this.classifier = new natural.BayesClassifier();
        this.trained = false;
        this.trainingData = [];

        // Initialize pattern arrays (were missing in original JS)
        this.contextPatterns = [
            /\b(this|these|that)\s+(code|function|method|class|file|error|bug)/i,
            /\b(fix|debug|refactor|optimize|explain|analyze)\s+(this|it|here)/i,
            /\b(s?a|gi?i thï¿½ch|t?i uu|ki?m tra|phï¿½n tï¿½ch)\s+(cï¿½i|do?n|ph?n|nï¿½y)/i,
            /^(fix|debug|explain|s?a|gi?i thï¿½ch)\b/i,
        ];

        this.noContextPatterns = [
            /^(hello|hi|hey|thanks|bye|chï¿½o|c?m on|t?m bi?t)/i,
            /\b(what is|how to|best practices|concept|tutorial)\b/i,
            /\b(khï¿½i ni?m|lï¿½ thuy?t|hu?ng d?n|t?ng quan)\b/i,
        ];

        this.initializeTrainingData();

        this.contextKeywords = [
      // English context keywords
      'explain', 'fix', 'debug', 'refactor', 'optimize', 'test', 'document',
      'this', 'here', 'current', 'above', 'below', 'analyze', 'review',
      'trace', 'comment', 'improve', 'check', 'examine', 'validate',
      
      // Vietnamese context keywords
      'gi?i thï¿½ch', 's?a', 't?i uu', 'ki?m tra', 'nï¿½y', 'dï¿½y', 'hi?n t?i',
      'phï¿½n tï¿½ch', 'xem xï¿½t', 'c?i thi?n', 'debug', 'refactor', 'cï¿½i',
      'do?n', 'ph?n', 'dï¿½ng', 'function', 'hï¿½m', 'l?p', 'method'
    ];
    
    this.noContextKeywords = [
      // English general keywords
      'hello', 'hi', 'thanks', 'bye', 'how are you', 'what is',
      'best practices', 'concept', 'theory', 'general', 'tutorial',
      'guide', 'introduction', 'difference', 'comparison', 'overview',
      
      // Vietnamese general keywords
      'chï¿½o', 'c?m on', 't?m bi?t', 'khï¿½i ni?m', 'lï¿½ thuy?t',
      'chung', 't?ng quï¿½t', 'hu?ng d?n', 'gi?i thi?u', 's? khï¿½c bi?t',
      'so sï¿½nh', 't?ng quan', 'th?c hï¿½nh t?t'
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
        'gi?i thï¿½ch cï¿½i nï¿½y',
        's?a l?i nï¿½y',
        'debug do?n nï¿½y',
        't?i uu function nï¿½y',
        'ki?m tra code nï¿½y',
        'phï¿½n tï¿½ch do?n nï¿½y',
        'xem xï¿½t cï¿½i nï¿½y',
        'lï¿½m gï¿½ ? dï¿½y',
        't?i sao l?i',
        'cï¿½ v?n d? gï¿½'
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
        'chï¿½o b?n',
        'c?m on',
        't?m bi?t',
        'javascript lï¿½ gï¿½',
        'khï¿½i ni?m oop',
        'th?c hï¿½nh t?t nh?t',
        'lï¿½m sao d? t?o',
        'hu?ng d?n cho ngu?i m?i',
        's? khï¿½c bi?t',
        'uu nhu?c di?m'
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
      
      aidaLogging('? ML Classifier trained with', contextRequired.length + noContext.length, 'examples');
    } catch (_error: unknown) {
      const error = toError(_error);
      aidaLogging('? Failed to train ML classifier:', error.message);
      this.trained = false;
    }
  }

  classify(text: string) {
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
    } catch (_error: unknown) {
      const error = toError(_error);
      aidaLogging('ML classification error:', error.message);
      return this.fallbackClassify(text);
    }
  }

  fallbackClassify(text: string) {
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

  calculatePatternScore(text: string) {
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

  calculateKeywordScore(text: string) {
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

  calculateLengthScore(text: string) {
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

  calculateStructureScore(text: string) {
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
    if (text.match(/\b(this|that|these|those|here|there|nï¿½y|dï¿½y|dï¿½|kia)\b/i)) {
      contextScore += 0.6;
    }

    // Commands or imperatives often contextual
    if (text.match(/^(fix|explain|debug|refactor|optimize|s?a|gi?i thï¿½ch)/i)) {
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
  getSimilarityScore(text: string, referenceTexts: string[]) {
    if (!referenceTexts || referenceTexts.length === 0) return 0;

    try {
      // Use string-similarity library for more accurate results
      const similarities = referenceTexts.map((ref: string) => 
        stringSimilarity.compareTwoStrings(text.toLowerCase(), ref.toLowerCase())
      );
      
      return Math.max(...similarities);
    } catch (_error: unknown) {
      const error = toError(_error);
      aidaLogging('String similarity error:', error.message);
      // Fallback to Jaccard similarity
      const textWords = text.toLowerCase().split(/\s+/);
      let maxSimilarity = 0;

      referenceTexts.forEach((reference: string) => {
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
  calculateJaccardSimilarity(words1: string[], words2: string[]) {
    const set1 = new Set(words1);
    const set2 = new Set(words2);
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
  }

  /**
   * Train classifier with additional examples (for future enhancement)
   */
  addTrainingExample(text: string, label: string) {
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

// -- Dual exports ------------------------------------------------

export default MLClassifier;
export { MLClassifier };
