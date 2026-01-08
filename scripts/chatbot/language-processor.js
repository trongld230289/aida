const { franc } = require('franc');
const { aidaLogging } = require('../settings');

class LanguageProcessor {
  constructor() {
    this.patterns = new Map();
    this.loadPatterns();
  }

  loadPatterns() {
    try {
      // Load pattern files
      this.patterns.set('en', require('./patterns/en-patterns'));
      this.patterns.set('vi', require('./patterns/vi-patterns'));
      this.patterns.set('universal', require('./patterns/universal-patterns'));
    } catch (error) {
      aidaLogging('Failed to load some pattern files:', error.message);
      // Fallback patterns
      this.patterns.set('universal', {
        CONTEXT_REQUIRED: [/\b(this|current)\s+(code|function)/i],
        NO_CONTEXT: [/^(hello|hi)$/i],
        CONTEXT_KEYWORDS: ['this', 'current'],
        GENERAL_KEYWORDS: ['hello', 'hi']
      });
    }
  }

  detectLanguage(text) {
    if (!text || typeof text !== 'string') return 'en';

    try {
      // Use franc for accurate language detection
      const langCode = franc(text);

      // Map franc codes to our codes
      const langMap = {
        'eng': 'en',
        'vie': 'vi',
        'cmn': 'zh',
        'jpn': 'ja',
        'fra': 'fr',
        'deu': 'de',
        'spa': 'es',
        'ita': 'it',
        'por': 'pt',
        'rus': 'ru',
        'und': 'en' // undefined defaults to English
      };

      const detectedLang = langMap[langCode] || 'en';

      // Fallback for Vietnamese if franc doesn't detect it properly
      if (detectedLang === 'en') {
        const vietnameseChars = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;
        const vietnameseWords = /\b(là|của|này|đó|và|có|không|được|cho|từ|với|về|trong|trên|dưới|giữa|sau|trước|khi|nếu|thì|mà|để|sẽ|đã|đang|code|function|hàm|sửa|tối|ưu|giải|thích|cái|đoạn|phần)\b/i;

        if (vietnameseChars.test(text) || vietnameseWords.test(text)) {
          return 'vi';
        }
      }

      return detectedLang;
    } catch (error) {
      aidaLogging('Language detection error:', error.message);
      // Fallback to simple detection
      const vietnameseChars = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;
      return vietnameseChars.test(text) ? 'vi' : 'en';
    }
  }

  getPatterns(language) {
    return this.patterns.get(language) || this.patterns.get('en') || {
      CONTEXT_REQUIRED: [],
      NO_CONTEXT: []
    };
  }

  checkPatterns(text, language) {
    if (!text || typeof text !== 'string') {
      return { needsContext: null, matched: null };
    }

    const patterns = this.getPatterns(language);
    const universal = this.patterns.get('universal');

    // Combine language-specific and universal patterns
    const contextRequiredPatterns = [
      ...(patterns.CONTEXT_REQUIRED || []),
      ...(universal ? universal.CONTEXT_REQUIRED || [] : [])
    ];

    const noContextPatterns = [
      ...(patterns.NO_CONTEXT || []),
      ...(universal ? universal.NO_CONTEXT || [] : [])
    ];

    // Check context required patterns first (higher priority)
    for (const pattern of contextRequiredPatterns) {
      try {
        if (pattern.test(text)) {
          return {
            needsContext: true,
            matched: pattern.toString(),
            confidence: 90
          };
        }
      } catch (error) {
        aidaLogging('Invalid regex pattern:', pattern, error.message);
      }
    }

    // Check no context patterns
    for (const pattern of noContextPatterns) {
      try {
        if (pattern.test(text)) {
          return {
            needsContext: false,
            matched: pattern.toString(),
            confidence: 85
          };
        }
      } catch (error) {
        aidaLogging('Invalid regex pattern:', pattern, error.message);
      }
    }

    return { needsContext: null, matched: null, confidence: 0 };
  }

  /**
   * Check if text contains contextual keywords
   */
  hasContextualKeywords(text) {
    const universal = this.patterns.get('universal');
    if (!universal || !universal.CONTEXT_KEYWORDS) return false;

    const textLower = text.toLowerCase();
    return universal.CONTEXT_KEYWORDS.some(keyword =>
      textLower.includes(keyword.toLowerCase())
    );
  }

  /**
   * Check if text contains general keywords
   */
  hasGeneralKeywords(text) {
    const universal = this.patterns.get('universal');
    if (!universal || !universal.GENERAL_KEYWORDS) return false;

    const textLower = text.toLowerCase();
    return universal.GENERAL_KEYWORDS.some(keyword =>
      textLower.includes(keyword.toLowerCase())
    );
  }

  /**
   * Get keyword scores for text
   */
  getKeywordScores(text) {
    const contextKeywords = this.hasContextualKeywords(text);
    const generalKeywords = this.hasGeneralKeywords(text);

    return {
      contextual: contextKeywords ? 1 : 0,
      general: generalKeywords ? 1 : 0
    };
  }
}

module.exports = LanguageProcessor;