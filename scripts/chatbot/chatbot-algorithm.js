/**
 * Advanced Chatbot Context Decision Engine
 * Uses ML/NLP algorithms to intelligently determine when to include current file context
 * Similar to GitHub Copilot's sophisticated context detection
 */

// Import the new context detector
const ContextDetector = require('./context-detector');

class ChatbotContextEngine {
    constructor() {
        this.initialized = false;
        this.semanticCache = new Map();
        this.intentPatterns = this.loadIntentPatterns();
        this.languageDetector = new LanguageDetector();
        this.semanticAnalyzer = new SemanticAnalyzer();
        this.contextScorer = new ContextRelevanceScorer();
        
        // Initialize the new context detector
        this.contextDetector = new ContextDetector();
    }

    /**
     * NEW: Enhanced shouldIncludeContent method using the new detector
     * @param {string} userMessage - User's message
     * @param {Object} editorContext - Editor context object
     * @returns {Object} Decision result with confidence score and reasoning
     */
    shouldIncludeContent(userMessage, editorContext = {}) {
        try {
            // Use the new context detector
            const decision = this.contextDetector.shouldIncludeContent(userMessage, editorContext);
            
            console.log('🔍 Context Detection Result:', {
                message: userMessage.substring(0, 50) + (userMessage.length > 50 ? '...' : ''),
                includeContent: decision.includeContent,
                confidence: decision.confidence,
                method: decision.method,
                language: decision.language,
                reasons: decision.reasons
            });
            
            return decision;
        } catch (error) {
            console.error('❌ Context detection error:', error);
            // Fallback to conservative approach
            return {
                includeContent: !!editorContext.selectedText, // Include content only if text is selected
                confidence: 50,
                reasons: ['Fallback due to error: ' + error.message],
                language: 'en',
                method: 'fallback'
            };
        }
    }

    /**
     * Get performance report from context detector
     */
    getContextDetectorReport() {
        return this.contextDetector.getPerformanceReport();
    }

    /**
     * Main decision engine - determines if current file context should be included
     * @param {string|Object} userInput - Text input or multimodal input (text + images)
     * @param {Object} currentFileContext - Current active file context
     * @param {Object} conversationHistory - Previous conversation context
     * @returns {Promise<Object>} Decision result with confidence score and reasoning
     */
    async shouldIncludeContext(userInput, currentFileContext = null, conversationHistory = []) {
        try {
            // Step 1: Multimodal Input Processing
            const processedInput = await this.processMultimodalInput(userInput);
            
            // Step 2: Intent Classification using ML
            const intentResult = await this.classifyIntent(processedInput.cleanText);
            
            // Step 3: Linguistic Pattern Analysis
            const linguisticAnalysis = this.analyzeLinguisticPatterns(processedInput.cleanText);
            
            // Step 4: Context Relevance Scoring
            const contextScore = this.calculateContextRelevance(
                processedInput.cleanText, 
                currentFileContext, 
                intentResult,
                conversationHistory
            );
            
            // Step 5: Multi-layer Decision Algorithm
            const decision = this.makeContextDecision({
                intent: intentResult,
                linguistic: linguisticAnalysis,
                contextScore: contextScore,
                hasActiveFile: !!currentFileContext?.hasFile,
                inputType: processedInput.type
            });

            return {
                shouldInclude: decision.include,
                confidence: decision.confidence,
                reasoning: decision.reasoning,
                intent: intentResult.intent,
                patterns: linguisticAnalysis.patterns,
                contextRelevance: contextScore
            };

        } catch (error) {
            console.warn('Context decision engine error:', error);
            // Fallback to conservative approach
            return this.fallbackDecision(userInput, currentFileContext);
        }
    }

    /**
     * Process multimodal input (text, images, OCR)
     */
    async processMultimodalInput(input) {
        if (typeof input === 'string') {
            return {
                type: 'text',
                originalText: input,
                cleanText: this.preprocessText(input),
                language: this.languageDetector.detect(input)
            };
        }

        // if (input.images && input.images.length > 0) {
        //     // OCR processing for images
        //     const ocrText = await this.extractTextFromImages(input.images);
        //     const combinedText = `${input.text || ''} ${ocrText}`.trim();
            
        //     return {
        //         type: 'multimodal',
        //         originalText: input.text || '',
        //         ocrText: ocrText,
        //         cleanText: this.preprocessText(combinedText),
        //         language: this.languageDetector.detect(combinedText),
        //         hasImages: true
        //     };
        // }

        return {
            type: 'text',
            originalText: input.text || input,
            cleanText: this.preprocessText(input.text || input),
            language: this.languageDetector.detect(input.text || input)
        };
    }

    /**
     * Advanced text preprocessing with OCR noise handling
     */
    preprocessText(text) {
        if (!text || typeof text !== 'string') return '';

        let processed = text;

        // 1. OCR Error Corrections
        const ocrCorrections = {
            // Common OCR mistakes
            '1ãm': 'làm',
            'c0de': 'code', 
            '5ửa': 'sửa',
            '0': 'o',
            '1': 'l',
            '5': 's',
            'rn': 'm',
            // Vietnamese OCR corrections
            'đoạn c0de': 'đoạn code',
            'fi1e': 'file',
            'th1s': 'this'
        };

        Object.entries(ocrCorrections).forEach(([error, correct]) => {
            processed = processed.replace(new RegExp(error, 'gi'), correct);
        });

        // 2. Text normalization
        processed = processed
            .toLowerCase()
            .trim()
            .replace(/[^\w\s\u00C0-\u024F\u1E00-\u1EFF]/g, ' ') // Keep Vietnamese chars
            .replace(/\s+/g, ' ');

        // 3. Handle mixed languages (Vietnamese + English)
        processed = this.normalizeMixedLanguage(processed);

        return processed;
    }

    /**
     * Intent Classification using pattern matching + semantic analysis
     */
    async classifyIntent(cleanText) {
        // Primary intent classification
        const primaryIntent = this.classifyPrimaryIntent(cleanText);
        
        // Secondary intent analysis for context needs
        const contextIntent = this.analyzeContextIntent(cleanText);
        
        // Semantic intent analysis
        const semanticIntent = await this.semanticAnalyzer.classifyIntent(cleanText);

        // Combine results with confidence weighting
        return {
            intent: primaryIntent.intent,
            confidence: (primaryIntent.confidence + contextIntent.confidence + semanticIntent.confidence) / 3,
            needsContext: contextIntent.needsContext || semanticIntent.needsContext,
            category: primaryIntent.category,
            subcategory: contextIntent.subcategory
        };
    }

    /**
     * Universal primary intent classification (language-agnostic)
     */
    classifyPrimaryIntent(text) {
        // Use semantic features instead of hard-coded patterns
        const semanticFeatures = this.extractSemanticFeatures(text);
        
        // Universal intent scoring based on semantic features
        const intentScores = {
            code_analysis: this.calculateCodeAnalysisScore(semanticFeatures, text),
            code_modification: this.calculateCodeModificationScore(semanticFeatures, text),
            code_creation: this.calculateCodeCreationScore(semanticFeatures, text),
            general_question: this.calculateGeneralQuestionScore(semanticFeatures, text)
        };

        // Find best match
        let bestMatch = { intent: 'general', confidence: 0.3, category: 'unknown' };
        
        for (const [intent, scoreData] of Object.entries(intentScores)) {
            if (scoreData.confidence > bestMatch.confidence) {
                bestMatch = {
                    intent: intent,
                    confidence: scoreData.confidence,
                    category: scoreData.category,
                    semanticBasis: scoreData.reasoning
                };
            }
        }

        return bestMatch;
    }

    /**
     * Calculate semantic score for code analysis intent
     */
    calculateCodeAnalysisScore(semanticFeatures, text) {
        let score = 0;
        const reasoning = [];

        // Universal analysis indicators
        if (semanticFeatures.hasCodeActionVerbs) {
            score += 0.4;
            reasoning.push('code action verbs detected');
        }

        if (semanticFeatures.hasCodeEntityReferences) {
            score += 0.3;
            reasoning.push('code entities referenced');
        }

        if (semanticFeatures.hasCurrentStateInquiries) {
            score += 0.3;
            reasoning.push('state inquiry patterns');
        }

        if (semanticFeatures.hasProximalReferences) {
            score += 0.2;
            reasoning.push('proximal references');
        }

        return {
            confidence: Math.min(score, 1.0),
            category: 'code_interaction',
            reasoning: reasoning
        };
    }

    /**
     * Calculate semantic score for code modification intent
     * Uses universal pattern detection instead of hard-coded keywords
     */
    calculateCodeModificationScore(semanticFeatures, text) {
        let score = 0;
        const reasoning = [];

        // Universal modification detection using semantic clustering
        const modificationIndicators = this.detectUniversalModificationPatterns(text);
        
        if (modificationIndicators.hasModificationVerbs) {
            score += 0.5;
            reasoning.push('universal modification verbs detected');
        }

        if (modificationIndicators.hasImprovementConcepts) {
            score += 0.3;
            reasoning.push('improvement concepts identified');
        }

        if (semanticFeatures.hasProximalReferences) {
            score += 0.4;
            reasoning.push('proximal reference (this/current)');
        }

        if (semanticFeatures.hasCodeEntityReferences) {
            score += 0.2;
            reasoning.push('code entities referenced');
        }

        return {
            confidence: Math.min(score, 1.0),
            category: 'code_interaction',
            reasoning: reasoning
        };
    }

    /**
     * Universal modification pattern detection (language-agnostic)
     */
    detectUniversalModificationPatterns(text) {
        const analysis = {
            hasModificationVerbs: false,
            hasImprovementConcepts: false
        };

        // Universal modification verbs using phonetic and semantic clustering
        const modificationPatterns = [
            /\b[rf][aeiou][cfp][aeiou]*[crt]\w*\b/i,      // refactor, refact, etc.
            /\b[ims][aeiou]*[pm][aeiou]*[rv]\w*\b/i,      // improve, impr, etc.
            /\b[of][aeiou]*[pt][aeiou]*[mn]\w*\b/i,       // optim, optimize, etc.
            /\b[fc][aeiou]*[xi]\w*\b/i,                   // fix, fixa, etc.
            /\b[us][aeiou]*[pd][aeiou]*[dt]\w*\b/i,       // update, updat, etc.
            /\b[cm][aeiou]*[hn][aeiou]*[gn]\w*\b/i,       // change, chang, etc.
            /\b[mns][aeiou]*[od][aeiou]*[dfy]\w*\b/i,     // modify, modif, etc.
            /\b[ce][aeiou]*[nh][aeiou]*[hn]\w*\b/i,       // enhance, enhanc, etc.
            /\b[cm][aeiou]*[ld][aeiou]*[aen]\w*\b/i,      // clean, clean, etc.
        ];

        analysis.hasModificationVerbs = modificationPatterns.some(pattern => pattern.test(text));

        // Universal improvement concepts
        const improvementConcepts = [
            /\b(better|best|improve|enhance|optim|perfect|upgrade|modern)\w*\b/i,
            /\b(quality|performance|efficiency|speed|fast|clean|neat)\w*\b/i,
            /\b(practice|standard|convention|pattern|architecture)\w*\b/i
        ];

        analysis.hasImprovementConcepts = improvementConcepts.some(pattern => pattern.test(text));

        return analysis;
    }

    /**
     * Calculate semantic score for code creation intent
     * Uses universal pattern detection instead of hard-coded keywords
     */
    calculateCodeCreationScore(semanticFeatures, text) {
        let score = 0;
        const reasoning = [];

        // Universal creation detection
        const creationIndicators = this.detectUniversalCreationPatterns(text);
        
        if (creationIndicators.hasCreationVerbs) {
            score += 0.4;
            reasoning.push('universal creation verbs detected');
        }

        if (creationIndicators.hasNewnessConcepts) {
            score += 0.3;
            reasoning.push('newness concepts identified');
        }

        if (semanticFeatures.hasCodeEntityReferences) {
            score += 0.3;
            reasoning.push('code entities for creation');
        }

        // Lower score if has proximal references (suggests modifying existing rather than creating new)
        if (semanticFeatures.hasProximalReferences) {
            score -= 0.2;
            reasoning.push('proximal reference reduces creation likelihood');
        }

        return {
            confidence: Math.max(score, 0),
            category: 'code_generation',
            reasoning: reasoning
        };
    }

    /**
     * Universal creation pattern detection (language-agnostic)
     */
    detectUniversalCreationPatterns(text) {
        const analysis = {
            hasCreationVerbs: false,
            hasNewnessConcepts: false
        };

        // Universal creation verbs using phonetic clustering
        const creationPatterns = [
            /\b[ck][aeiou]*[rt][aeiou]*[aet]\w*\b/i,      // create, creat, etc.
            /\b[gj][aeiou]*[nm][aeiou]*[rt]\w*\b/i,       // generate, gener, etc.
            /\b[m][aeiou]*[ck][aeiou]*\b/i,               // make, mak, etc.
            /\b[bv][aeiou]*[il][aeiou]*[ld]\w*\b/i,       // build, buil, etc.
            /\b[aei]*[d][aeiou]*\b/i,                     // add, ad, etc.
            /\b[wv][aeiou]*[rt][aeiou]*[t]\w*\b/i,        // write, writ, etc.
            /\b[ck][aeiou]*[nmn][aeiou]*[st]\w*\b/i,      // construct, etc.
        ];

        analysis.hasCreationVerbs = creationPatterns.some(pattern => pattern.test(text));

        // Universal newness concepts
        const newnessConcepts = [
            /\b(new|fresh|novel|original|initial|start|begin)\w*\b/i,
            /\b(first|empty|blank|zero|from.{0,10}scratch)\w*\b/i
        ];

        analysis.hasNewnessConcepts = newnessConcepts.some(pattern => pattern.test(text));

        return analysis;
    }

    /**
     * Calculate semantic score for general question intent
     * Uses universal semantic analysis instead of hard-coded keywords
     */
    calculateGeneralQuestionScore(semanticFeatures, text) {
        let score = 0;
        const reasoning = [];

        // Universal question detection using semantic analysis
        const questionIndicators = this.detectUniversalQuestionPatterns(text);
        
        if (questionIndicators.hasQuestionWords) {
            score += 0.4;
            reasoning.push('universal question words detected');
        }

        if (questionIndicators.hasHelpSeeking) {
            score += 0.3;
            reasoning.push('help-seeking patterns identified');
        }

        if (questionIndicators.hasInterrogativeStructure) {
            score += 0.2;
            reasoning.push('interrogative sentence structure');
        }

        // Lower score if has specific code references
        if (semanticFeatures.hasCodeEntityReferences && semanticFeatures.hasProximalReferences) {
            score -= 0.2;
            reasoning.push('specific code focus reduces general question likelihood');
        }

        return {
            confidence: Math.max(score, 0),
            category: 'information',
            reasoning: reasoning
        };
    }

    /**
     * Universal question pattern detection (language-agnostic)
     * Uses linguistic features that work across all languages
     */
    detectUniversalQuestionPatterns(text) {
        const analysis = {
            hasQuestionWords: false,
            hasHelpSeeking: false,
            hasInterrogativeStructure: false
        };

        // 1. Universal interrogative markers (works for most languages)
        const questionMarkers = [
            '?',           // Universal question mark
            '？',         // Full-width question mark (East Asian)
            '¿',           // Inverted question mark (Spanish)
        ];
        
        analysis.hasInterrogativeStructure = questionMarkers.some(marker => text.includes(marker));

        // 2. Universal WH-question patterns using phonetic similarity
        // These sound similar across many language families
        const whPatterns = [
            /\b[wv][hx]?[aeiou]{1,2}[tn]?\b/i,    // what, wat, vat, etc.
            /\b[hw][aeiou][wv]?\b/i,               // how, hau, etc.
            /\b[wv][hx]?[yie]{1,2}\b/i,           // why, vi, etc.
            /\b[wv][hx]?[aeiou][nr][aeiou]?\b/i   // when, wan, etc.
        ];

        analysis.hasQuestionWords = whPatterns.some(pattern => pattern.test(text));

        // 3. Universal help-seeking patterns using semantic clustering
        const helpPatterns = [
            /\b[hg][aeiou][lpr][pf]?\b/i,         // help, halp, galp, etc.
            /\b[gs][uoi][iaeo][dr][aeiou]?\b/i,   // guide, gida, etc.
            /\b[t][uio][nt][aeiou][rn]/i,         // tutorial, etc.
            /\b[aei][yie][uo]d[aeiou]\b/i         // ayuda, aide, etc.
        ];

        analysis.hasHelpSeeking = helpPatterns.some(pattern => pattern.test(text));

        // 4. Universal semantic indicators
        const semanticQuestionWords = this.detectSemanticQuestionConcepts(text);
        if (semanticQuestionWords.length > 0) {
            analysis.hasQuestionWords = true;
        }

        return analysis;
    }

    /**
     * Detect question concepts using semantic analysis (works for any language)
     */
    detectSemanticQuestionConcepts(text) {
        const concepts = [];
        
        // Universal semantic concepts that indicate questions
        const conceptPatterns = {
            // Information seeking (works across languages)
            information_seeking: /\b(inform|info|know|understand|learn|explain|clarify)\w*\b/i,
            
            // Procedural inquiry (how-to concepts)
            procedural: /\b(process|procedure|method|way|step|instruction|direction)\w*\b/i,
            
            // Causal inquiry (why concepts)
            causal: /\b(reason|cause|because|purpose|goal|objective|motivation)\w*\b/i,
            
            // Temporal inquiry (when concepts)
            temporal: /\b(time|when|schedule|moment|period|duration|timing)\w*\b/i,
            
            // Spatial inquiry (where concepts)
            spatial: /\b(place|location|position|where|site|area|region)\w*\b/i
        };

        for (const [concept, pattern] of Object.entries(conceptPatterns)) {
            if (pattern.test(text)) {
                concepts.push(concept);
            }
        }

        return concepts;
    }

    /**
     * Universal context intent analysis (language-agnostic)
     */
    analyzeContextIntent(text) {
        const semanticFeatures = this.extractSemanticFeatures(text);
        
        // Calculate universal context need scores
        const contextScores = {
            explicit_current_file: this.calculateExplicitFileScore(semanticFeatures, text),
            implicit_current_file: this.calculateImplicitFileScore(semanticFeatures, text),
            no_context_needed: this.calculateNoContextScore(semanticFeatures, text)
        };

        // Find best match
        let bestMatch = { needsContext: false, confidence: 0.4, subcategory: 'unknown' };

        for (const [category, scoreData] of Object.entries(contextScores)) {
            if (scoreData.confidence > bestMatch.confidence) {
                bestMatch = {
                    needsContext: scoreData.needsContext,
                    confidence: scoreData.confidence,
                    subcategory: scoreData.subcategory,
                    matchedPattern: category,
                    reasoning: scoreData.reasoning
                };
            }
        }

        return bestMatch;
    }

    /**
     * Calculate explicit file reference score
     */
    calculateExplicitFileScore(semanticFeatures, text) {
        let score = 0;
        const reasoning = [];

        // Universal explicit file patterns
        const explicitFilePatterns = /\b(this file|current file|this code|current code|active file|open file)\b/i;
        const explicitInOtherLangs = /\b(file này|tệp này|code này|mã này|file hiện tại|tệp hiện tại|este archivo|este código|ce fichier|ce code|diese datei|dieser code|questo file|questo codice|arquivo atual|código atual)\b/i;
        
        if (explicitFilePatterns.test(text) || explicitInOtherLangs.test(text)) {
            score += 0.8;
            reasoning.push('explicit file/code reference detected');
        }

        // Proximal + Code entity combination
        if (semanticFeatures.hasProximalReferences && semanticFeatures.hasCodeEntityReferences) {
            score += 0.4;
            reasoning.push('proximal reference with code entities');
        }

        // Action + proximal combination
        if (semanticFeatures.hasCodeActionVerbs && semanticFeatures.hasProximalReferences) {
            score += 0.3;
            reasoning.push('code action with proximal reference');
        }

        return {
            needsContext: true,
            confidence: Math.min(score, 1.0),
            subcategory: 'explicit_reference',
            reasoning: reasoning
        };
    }

    /**
     * Calculate implicit file reference score
     */
    calculateImplicitFileScore(semanticFeatures, text) {
        let score = 0;
        const reasoning = [];

        // Universal modification without creation keywords
        const modificationPatterns = /\b(refactor|improve|optimize|fix|analyze|review|explain)\b/i;
        const modificationInOtherLangs = /\b(sửa|cải thiện|tối ưu|phân tích|xem xét|giải thích|arreglar|mejorar|analizar|revisar|corriger|améliorer|analyser|réviser|reparieren|verbessern|analysieren|corrigir|melhorar|analisar)\b/i;
        const creationPatterns = /\b(create|new|generate|make|build|add)\b/i;
        const creationInOtherLangs = /\b(tạo|mới|sinh|viết|xây dựng|thêm|crear|nuevo|generar|faire|nouveau|créer|neu|erstellen|novo|criar)\b/i;

        const hasModification = modificationPatterns.test(text) || modificationInOtherLangs.test(text);
        const hasCreation = creationPatterns.test(text) || creationInOtherLangs.test(text);

        if (hasModification && !hasCreation) {
            score += 0.6;
            reasoning.push('modification without creation indicates current file');
        }

        // State inquiry patterns
        if (semanticFeatures.hasCurrentStateInquiries) {
            score += 0.4;
            reasoning.push('current state inquiry');
        }

        // Code actions without explicit targets
        if (semanticFeatures.hasCodeActionVerbs && !semanticFeatures.hasCodeEntityReferences) {
            score += 0.3;
            reasoning.push('code action without explicit target');
        }

        return {
            needsContext: true,
            confidence: Math.min(score, 1.0),
            subcategory: 'implicit_reference',
            reasoning: reasoning
        };
    }

    /**
     * Calculate no context needed score
     */
    calculateNoContextScore(semanticFeatures, text) {
        let score = 0;
        const reasoning = [];

        // Universal creation patterns
        const creationPatterns = /\b(create new|generate new|make new|build new|add new)\b/i;
        const creationInOtherLangs = /\b(tạo mới|sinh mới|viết mới|tạo ra|crear nuevo|generar nuevo|faire nouveau|créer nouveau|neues erstellen|criar novo|gerar novo)\b/i;
        
        if (creationPatterns.test(text) || creationInOtherLangs.test(text)) {
            score += 0.7;
            reasoning.push('new creation patterns detected');
        }

        // Universal help/tutorial patterns
        const helpPatterns = /\b(how to|what is|tutorial|guide|help|setup|install|config)\b/i;
        const helpInOtherLangs = /\b(như thế nào|là gì|hướng dẫn|giúp|cài đặt|thiết lập|cómo|qué es|guía|ayuda|instalación|comment|qu'est|guide|aide|installation|wie|was ist|anleitung|hilfe|installation|como|o que é|guia|ajuda|instalação)\b/i;
        
        if (helpPatterns.test(text) || helpInOtherLangs.test(text)) {
            score += 0.6;
            reasoning.push('general help/tutorial patterns');
        }

        return {
            needsContext: false,
            confidence: Math.min(score, 1.0),
            subcategory: 'standalone_task',
            reasoning: reasoning
        };
    }

    /**
     * Universal linguistic pattern analysis (language-agnostic)
     * Uses semantic feature detection instead of hard-coded patterns
     */
    analyzeLinguisticPatterns(text) {
        // Use universal semantic features instead of language-specific patterns
        const semanticFeatures = this.extractSemanticFeatures(text);
        
        const analysis = {
            patterns: {
                // Map semantic features to pattern categories
                demonstratives: semanticFeatures.hasProximalReferences ? 1 : 0,
                presentContext: semanticFeatures.hasProximalReferences ? 1 : 0, // Proximal includes current context
                contextActions: semanticFeatures.hasCodeActionVerbs ? 1 : 0,
                codeReferences: semanticFeatures.hasCodeEntityReferences ? 1 : 0,
                currentStateQuestions: semanticFeatures.hasCurrentStateInquiries ? 1 : 0
            },
            scores: {},
            totalScore: 0,
            semanticFeatures: semanticFeatures // Include raw semantic features
        };

        let totalMatches = 0;

        // Calculate scores based on semantic features
        const weights = {
            demonstratives: 0.3,
            presentContext: 0.4,
            contextActions: 0.5,
            codeReferences: 0.3,
            currentStateQuestions: 0.4
        };

        for (const [patternName, count] of Object.entries(analysis.patterns)) {
            analysis.scores[patternName] = count * (weights[patternName] || 0.2);
            totalMatches += count;
        }

        analysis.totalScore = Object.values(analysis.scores).reduce((sum, score) => sum + score, 0);
        analysis.hasStrongPatterns = totalMatches >= 2 && analysis.totalScore > 0.8;

        return analysis;
    }

    /**
     * Calculate context relevance score
     */
    calculateContextRelevance(text, currentFileContext, intentResult, conversationHistory) {
        let score = 0;

        // 1. File availability bonus
        if (currentFileContext?.hasFile) {
            score += 0.2;
            
            // 2. File type relevance
            if (intentResult.category === 'code_interaction') {
                score += 0.3;
            }
            
            // 3. File language match with intent
            const fileType = currentFileContext.languageId;
            if (this.isRelevantFileType(text, fileType)) {
                score += 0.2;
            }
        }

        // 4. Conversation context
        if (conversationHistory.length > 0) {
            const recentMessages = conversationHistory.slice(-3);
            const hasRecentFileContext = recentMessages.some(msg => 
                msg.content && msg.content.toLowerCase().includes('file')
            );
            if (hasRecentFileContext) {
                score += 0.15;
            }
        }

        // 5. Intent confidence boost
        score += intentResult.confidence * 0.15;

        return Math.min(score, 1.0); // Cap at 1.0
    }

    /**
     * Multi-layer decision algorithm
     */
    makeContextDecision(analysisData) {
        const {
            intent,
            linguistic,
            contextScore,
            hasActiveFile,
            inputType
        } = analysisData;

        let decision = {
            include: false,
            confidence: 0,
            reasoning: []
        };

        // Layer 1: Intent-based decision
        if (intent.needsContext && intent.confidence > 0.7) {
            decision.include = true;
            decision.confidence += 0.4;
            decision.reasoning.push(`Intent classification (${intent.intent}) indicates context needed`);
        }

        // Layer 2: Linguistic pattern analysis
        if (linguistic.hasStrongPatterns) {
            decision.include = true;
            decision.confidence += 0.3;
            decision.reasoning.push(`Strong linguistic patterns detected (score: ${linguistic.totalScore.toFixed(2)})`);
        }

        // Layer 3: Context relevance scoring
        if (contextScore > 0.6) {
            decision.include = true;
            decision.confidence += 0.2;
            decision.reasoning.push(`High context relevance (${(contextScore * 100).toFixed(1)}%)`);
        }

        // Layer 4: File availability check
        if (decision.include && !hasActiveFile) {
            decision.include = false;
            decision.confidence = 0.1;
            decision.reasoning = ['Context needed but no active file available'];
        }

        // Layer 5: Confidence threshold check (lowered for short questions)
        if (decision.confidence < 0.3) {
            decision.include = false;
            decision.reasoning.push('Confidence below threshold (0.3)');
        }

        // Layer 6: Override for explicit requests
        if (intent.intent === 'code_modification' && intent.confidence > 0.8) {
            decision.include = true;
            decision.confidence = Math.max(decision.confidence, 0.8);
            decision.reasoning.push('Override: Explicit code modification request');
        }

        // Layer 7: Override for Vietnamese/short file questions 
        const shortQuestionPatterns = /\b(code này|file này|làm gì|chức năng|what does|this file|this code)\b/i;
        if (shortQuestionPatterns.test(analysisData.originalText || '') && hasActiveFile && !decision.include) {
            decision.include = true;
            decision.confidence = Math.max(decision.confidence, 0.6);
            decision.reasoning.push('Override: Short file question detected');
        }

        return decision;
    }

    /**
     * Helper methods
     */
    isRelevantFileType(text, fileType) {
        const typeKeywords = {
            'typescript': ['typescript', 'angular', 'ts', 'component'],
            'javascript': ['javascript', 'js', 'react', 'vue'],
            'python': ['python', 'py', 'django', 'flask'],
            'html': ['html', 'template', 'markup'],
            'css': ['css', 'scss', 'sass', 'style']
        };

        const keywords = typeKeywords[fileType] || [];
        return keywords.some(keyword => text.toLowerCase().includes(keyword));
    }

    normalizeMixedLanguage(text) {
        // Handle Vietnamese + English mixed text
        const mixedPatterns = {
            'code nay': 'code này',
            'file nay': 'file này',
            'function nay': 'function này',
            'lam gi': 'làm gì'
        };

        let normalized = text;
        Object.entries(mixedPatterns).forEach(([mixed, correct]) => {
            normalized = normalized.replace(new RegExp(mixed, 'gi'), correct);
        });

        return normalized;
    }

    /**
     * Fallback decision for errors
     */
    fallbackDecision(userInput, currentFileContext) {
        const text = typeof userInput === 'string' ? userInput : userInput.text || '';
        const isCodeQuestion = /\b(analyze|review|refactor|fix|explain|làm gì|chức năng)\b/i.test(text);
        const hasFileReference = /\b(this|current|file|code|này)\b/i.test(text);
        
        return {
            shouldInclude: isCodeQuestion && hasFileReference && currentFileContext?.hasFile,
            confidence: 0.5,
            reasoning: ['Fallback decision based on basic patterns'],
            intent: 'unknown',
            patterns: {},
            contextRelevance: 0.5
        };
    }

    /**
     * Universal semantic-based context decision (language-agnostic)
     * Uses semantic analysis instead of hard-coded language patterns
     * @param {string} userMessage - Original user message
     * @param {Object} contextDecision - Result from context engine analysis
     * @param {Object} currentFileContext - Current file context
     * @returns {Object} Universal context decision
     */
    makeUniversalContextDecision(userMessage, contextDecision, currentFileContext) {
        try {
            // Use semantic features that work across all languages
            const semanticFeatures = this.extractSemanticFeatures(userMessage);
            
            // Universal context indicators (not language-specific)
            const universalIndicators = {
                // Demonstrative patterns (universal across languages)
                hasProximalDemonstratives: semanticFeatures.hasProximalReferences,
                
                // Action patterns (code-related verbs)
                hasCodeActions: semanticFeatures.hasCodeActionVerbs,
                
                // File/code entity references
                hasCodeEntities: semanticFeatures.hasCodeEntityReferences,
                
                // Question patterns about current state
                hasStateQuestions: semanticFeatures.hasCurrentStateInquiries,
                
                // Context confidence from engine
                engineConfidence: contextDecision?.confidence || 0
            };
            
            // Semantic scoring algorithm
            let semanticScore = 0;
            let reasoning = [];
            
            // Score universal indicators
            if (universalIndicators.hasProximalDemonstratives) {
                semanticScore += 0.3;
                reasoning.push('proximal reference detected');
            }
            
            if (universalIndicators.hasCodeActions) {
                semanticScore += 0.4;
                reasoning.push('code action verbs identified');
            }
            
            if (universalIndicators.hasCodeEntities) {
                semanticScore += 0.2;
                reasoning.push('code entities referenced');
            }
            
            if (universalIndicators.hasStateQuestions) {
                semanticScore += 0.3;
                reasoning.push('current state inquiry detected');
            }
            
            // Boost from engine confidence
            semanticScore += universalIndicators.engineConfidence * 0.3;
            
            // File availability check
            const hasActiveFile = currentFileContext?.hasFile;
            
            // Final decision
            const shouldInclude = semanticScore >= 0.6 && hasActiveFile;
            
            if (shouldInclude) {
                reasoning.push('semantic threshold met with active file');
            } else if (!hasActiveFile) {
                reasoning.push('no active file available');
            } else {
                reasoning.push('semantic confidence below threshold');
            }
            
            return {
                shouldInclude,
                confidence: Math.min(semanticScore, 1.0),
                reason: `Universal semantic analysis: ${reasoning.join(', ')}`,
                semanticScore,
                universalIndicators
            };
            
        } catch (error) {
            console.warn('Universal context decision error:', error);
            // Safe fallback
            return {
                shouldInclude: false,
                confidence: 0.1,
                reason: 'Universal analysis failed, conservative fallback',
                semanticScore: 0,
                universalIndicators: {}
            };
        }
    }

    /**
     * Extract semantic features that work across all languages
     * @param {string} text - Input text in any language
     * @returns {Object} Language-agnostic semantic features
     */
    extractSemanticFeatures(text) {
        const lowercaseText = text.toLowerCase();
        
        return {
            // Proximal reference patterns (this, that, hier, này, こ れ, 这个, etc.)
            hasProximalReferences: this.detectProximalReferences(lowercaseText),
            
            // Code action verbs (analyze, refactor, läs, phân tích, 分析, etc.)
            hasCodeActionVerbs: this.detectCodeActionVerbs(lowercaseText),
            
            // Code entity references (file, function, clase, tệp, ファイル, 文件, etc.)
            hasCodeEntityReferences: this.detectCodeEntityReferences(lowercaseText),
            
            // Current state inquiries (what does, que hace, làm gì, 何をする, 做什么, etc.)
            hasCurrentStateInquiries: this.detectCurrentStateInquiries(lowercaseText)
        };
    }

    /**
     * Detect proximal references across languages using universal linguistic features
     */
    detectProximalReferences(text) {
        // Universal proximal detection using multiple approaches
        
        // 1. Phonetic clustering (works across language families)
        const proximalPhonetic = [
            /\b[td][hx]?[aeiou][st]?\b/i,                // this, das, etc.
            /\b[td][hx]?[aeiou][sz][aeiou]\b/i,          // these, diese, etc.
            /\b[ck][aeiou][rnst]\w*\b/i,                 // current, corrente, etc.
            /\b[aei][ck][st][aeiou][vf]\w*\b/i,          // active, activ, etc.
            /\b[aou][pf][aeiou][nm]\w*\b/i,              // open, abierto, etc.
        ];

        // 2. Semantic clustering (conceptual proximity indicators)
        const proximalSemantic = [
            /\b(now|present|actual|immediate|direct)\w*\b/i,
            /\b(here|local|nearby|close|adjacent)\w*\b/i,
            /\b(focus|target|selected|chosen|picked)\w*\b/i
        ];

        // 3. Universal demonstrative patterns (works for most languages)
        const demonstrativeMarkers = [
            /\b.{0,2}[aeiou]{1,2}[yn][aeiou]{0,2}\b/i,   // này, nay, nai, etc.
            /\b.{0,2}[eo][st][aeiou]{0,2}\b/i,           // este, esta, etc.
            /\b.{0,2}[gc][e][t]?[aeiou]{0,2}\b/i,        // ce, cette, etc.
        ];

        return proximalPhonetic.some(p => p.test(text)) ||
               proximalSemantic.some(p => p.test(text)) ||
               demonstrativeMarkers.some(p => p.test(text));
    }

    /**
     * Detect code action verbs using universal linguistic patterns
     */
    detectCodeActionVerbs(text) {
        // Universal action verb detection using semantic clustering
        
        // 1. Analysis verbs (universal concept)
        const analysisVerbs = [
            /\b[aei]*[nml][aei]*[ly][aeiou]*[sz]\w*\b/i,  // analyze, analys, etc.
            /\b[rv][aei]*[vw][aei]*[w]\w*\b/i,            // review, reviw, etc.
            /\b[ce][hx]*[aei]*[ck]\w*\b/i,                // check, chek, etc.
            /\b[ei][hx]*[aei]*[mnx]\w*\b/i,               // examine, examin, etc.
        ];

        // 2. Modification verbs (universal concept)
        const modificationVerbs = [
            /\b[rf][aei]*[fct]\w*\b/i,                    // refactor, refact, etc.
            /\b[fs][aei]*[xi]\w*\b/i,                     // fix, fixa, etc.
            /\b[ims][aei]*[pm]\w*\b/i,                    // improve, impr, etc.
            /\b[ce][hx]*[aei]*[ng]\w*\b/i,                // change, chang, etc.
        ];

        // 3. Explanation verbs (universal concept)
        const explanationVerbs = [
            /\b[ei][hx]*[aei]*[xlp]\w*\b/i,               // explain, explic, etc.
            /\b[dj][aei]*[sc]\w*\b/i,                     // describe, desc, etc.
            /\b[cs][hx]*[aei]*[rwf]\w*\b/i,               // clarify, clarif, etc.
        ];

        return analysisVerbs.some(p => p.test(text)) ||
               modificationVerbs.some(p => p.test(text)) ||
               explanationVerbs.some(p => p.test(text));
    }

    /**
     * Detect code entity references using universal patterns
     */
    detectCodeEntityReferences(text) {
        // Universal code entity detection
        
        // 1. File-related terms (universal concept)
        const fileTerms = [
            /\b[fp][aei]*[li][aeiou]*\b/i,                // file, fila, etc.
            /\b[dc][aeiou]*[ckt]\w*\b/i,                  // document, doc, etc.
            /\b[sc][aei]*[rp]\w*\b/i,                     // script, scrip, etc.
        ];

        // 2. Code structure terms (universal concept)
        const codeTerms = [
            /\b[ck][aeiou]*[d][aeiou]*\b/i,               // code, codigo, etc.
            /\b[fp][aei]*[nct]\w*\b/i,                    // function, func, etc.
            /\b[ck][aei]*[ls]\w*\b/i,                     // class, clase, etc.
            /\b[cm][aei]*[mp]\w*\b/i,                     // component, comp, etc.
            /\b[mv][aei]*[th]\w*\b/i,                     // method, metod, etc.
            /\b[vw][aei]*[r]\w*\b/i,                      // variable, var, etc.
        ];

        // 3. Programming concepts (universal)
        const programmingConcepts = [
            /\b(api|interface|module|library|framework)\w*\b/i,
            /\b(object|array|string|number|boolean)\w*\b/i,
            /\b(loop|condition|statement|expression)\w*\b/i
        ];

        return fileTerms.some(p => p.test(text)) ||
               codeTerms.some(p => p.test(text)) ||
               programmingConcepts.some(p => p.test(text));
    }

    /**
     * Detect current state inquiries using universal patterns  
     */
    detectCurrentStateInquiries(text) {
        // Universal state inquiry detection
        
        // 1. State inquiry verbs (universal concept)
        const stateVerbs = [
            /\b[dw][aeiou]*[oesh]\w*\b/i,                 // does, do, what, etc.
            /\b[hw][aeiou]*[vw]\w*\b/i,                   // how, hav, etc.
            /\b[wp][aeiou]*[rk]\w*\b/i,                   // work, wirk, etc.
            /\b[fp][aei]*[nct]\w*\b/i,                    // function, func, etc.
            /\b[bh][aei]*[hv]\w*\b/i,                     // behave, behav, etc.
        ];

        // 2. Operation/activity terms (universal concept)
        const operationTerms = [
            /\b[aeo][ck]*[rst][aeiou]*[nt]\w*\b/i,        // action, aktivit, etc.
            /\b[aeo][pf]*[aeiou]*[rt]\w*\b/i,             // operation, oper, etc.
            /\b[bp][aeiou]*[rhcv]\w*\b/i,                 // process, behav, etc.
            /\b[rt][aeiou]*[sk]\w*\b/i,                   // task, taska, etc.
        ];

        // 3. Purpose/function inquiry (universal concept)
        const purposeTerms = [
            /\b[pf][aei]*[rp]\w*\b/i,                     // purpose, purp, etc.
            /\b[fg][aeiou]*[aln]\w*\b/i,                  // goal, function, etc.
            /\b[mr][aei]*[sn]\w*\b/i,                     // reason, reas, etc.
            /\b[uw][hx]*[aey]\w*\b/i,                     // why, way, etc.
        ];

        return stateVerbs.some(p => p.test(text)) ||
               operationTerms.some(p => p.test(text)) ||
               purposeTerms.some(p => p.test(text));
    }

    /**
     * OCR text extraction using Tesseract.js only
     */
    async extractTextFromImages(images) {
        if (!images || images.length === 0) return '';
        
        try {
            console.log(`🔍 Processing ${images.length} image(s) with Tesseract OCR...`);
            const extractedTexts = [];
            
            for (const image of images) {
                try {
                    const text = await this.extractWithTesseract(image);
                    
                    if (text && text.trim()) {
                        extractedTexts.push(text.trim());
                        console.log('✅ Tesseract OCR extracted:', text.substring(0, 100) + '...');
                    } else {
                        console.warn('⚠️ No text extracted from image');
                    }
                    
                } catch (ocrError) {
                    console.error('❌ OCR extraction failed for image:', ocrError.message);
                    throw new Error(`OCR not supported: ${ocrError.message}`);
                }
            }
            
            const combinedText = extractedTexts.join(' ').trim();
            console.log(`📝 Total OCR extracted: ${combinedText.length} characters from ${images.length} images`);
            
            return combinedText;
            
        } catch (error) {
            console.error('❌ OCR processing failed:', error);
            // Return error message instead of empty string
            return `[OCR Error: ${error.message}]`;
        }
    }

    /**
     * Extract text using Tesseract.js (local OCR)
     */
    async extractWithTesseract(imageData) {
        try {
            // Check if Tesseract is available
            if (typeof require !== 'undefined') {
                // Try to load Tesseract.js
                let Tesseract;
                try {
                    Tesseract = require('tesseract.js');
                } catch (requireError) {
                    throw new Error('Tesseract.js not installed. Please run: npm install tesseract.js');
                }
                
                console.log('🔄 Starting Tesseract OCR processing...');
                
                const { data: { text } } = await Tesseract.recognize(
                    imageData,
                    'eng+vie', // English + Vietnamese
                    {
                        logger: m => {
                            if (m.status === 'recognizing text') {
                                console.log(`OCR Progress: ${(m.progress * 100).toFixed(1)}%`);
                            }
                        }
                    }
                );
                
                return this.cleanOCRText(text);
            } else {
                // Browser environment
                throw new Error('OCR not supported in browser environment. Tesseract.js requires Node.js runtime');
            }
        } catch (error) {
            console.error('❌ Tesseract OCR failed:', error.message);
            throw new Error(`Tesseract OCR failed: ${error.message}`);
        }
    }

    /**
     * Clean and normalize OCR text
     */
    cleanOCRText(rawText) {
        if (!rawText) return '';
        
        let cleaned = rawText
            // Remove excessive whitespace
            .replace(/\s+/g, ' ')
            // Fix common OCR errors
            .replace(/[|]/g, 'l') // Vertical bars often misread as 'l'
            .replace(/[0]/g, 'o') // Zero often misread as 'o' in code
            .replace(/[1]/g, 'l') // 1 often misread as 'l'
            // Vietnamese character corrections
            .replace(/đ/g, 'd').replace(/Đ/g, 'D') // Sometimes OCR misses Vietnamese chars
            .trim();

        // Apply additional Vietnamese OCR corrections
        const vietnameseCorrections = {
            'duc': 'được',
            'khong': 'không', 
            'nhu': 'như',
            'thi': 'thì',
            'voi': 'với'
        };

        Object.entries(vietnameseCorrections).forEach(([wrong, correct]) => {
            const regex = new RegExp(`\\b${wrong}\\b`, 'gi');
            cleaned = cleaned.replace(regex, correct);
        });

        return cleaned;
    }

    /**
     * Load intent patterns from configuration
     */
    loadIntentPatterns() {
        return {
            codeInteraction: ['analyze', 'review', 'explain', 'refactor', 'làm gì', 'chức năng'],
            codeGeneration: ['create', 'generate', 'make', 'tạo', 'sinh'],
            generalHelp: ['help', 'how to', 'tutorial', 'giúp', 'hướng dẫn']
        };
    }
}

/**
 * Language Detection Helper
 */
class LanguageDetector {
    detect(text) {
        // Simple language detection based on character patterns
        const vietnamesePattern = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;
        const hasVietnamese = vietnamesePattern.test(text);
        const hasEnglish = /[a-zA-Z]/.test(text);
        
        if (hasVietnamese && hasEnglish) return 'mixed';
        if (hasVietnamese) return 'vietnamese';
        if (hasEnglish) return 'english';
        return 'unknown';
    }
}

/**
 * Semantic Analysis Helper
 */
class SemanticAnalyzer {
    async classifyIntent(text) {
        // Placeholder for semantic analysis
        // Would integrate with Hugging Face, OpenAI embeddings, etc.
        return {
            intent: 'general',
            confidence: 0.5,
            needsContext: false
        };
    }
}

/**
 * Context Relevance Scorer
 */
class ContextRelevanceScorer {
    calculateSimilarity(text1, text2) {
        // Placeholder for semantic similarity
        // Would use word embeddings, cosine similarity, etc.
        return 0.5;
    }
}

module.exports = { 
    ChatbotContextEngine,
    ContextDetector 
};