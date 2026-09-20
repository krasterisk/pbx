"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var KeywordMatcherService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.KeywordMatcherService = void 0;
const common_1 = require("@nestjs/common");
const fastest_levenshtein_1 = require("fastest-levenshtein");
const semantic_router_service_1 = require("./semantic-router.service");
/**
 * Hybrid Keyword Matcher Service.
 *
 * Two-tier matching strategy:
 * 1. Short utterances (≤2 words) → Levenshtein fuzzy word-matching
 *    - Fast, reliable for "да", "нет", "помощь", "оператор"
 *    - O(N*M) where N = text words, M = keyword words
 *
 * 2. Long utterances (>2 words) → Semantic embedding cosine similarity
 *    - Understands meaning: "мне нужна помощь специалиста" ≈ "помощь"
 *    - Uses nomic-embed-text-v1.5 via SemanticRouterService
 *    - Falls back to Levenshtein if semantic router unavailable
 *
 * Negative keywords support:
 *    - If text semantically matches a negative keyword (>0.7), the positive
 *      match is suppressed even if confidence is high.
 */
let KeywordMatcherService = class KeywordMatcherService {
    static { KeywordMatcherService_1 = this; }
    semanticRouter;
    logger = new common_1.Logger(KeywordMatcherService_1.name);
    /** Word count threshold: ≤ this → Levenshtein, > this → semantic */
    static SHORT_UTTERANCE_MAX_WORDS = 2;
    constructor(semanticRouter) {
        this.semanticRouter = semanticRouter;
    }
    /**
     * Match recognized text against a list of keywords.
     * Returns the best match or null if no match found.
     *
     * Uses hybrid strategy: short text → Levenshtein, long text → semantic.
     *
     * @param text - The STT-recognized text
     * @param keywords - Database keyword entries with phrases
     * @param negativePhrases - Optional list of negative keyword phrases
     * @param threshold - Minimum confidence to accept match (default: 0.7)
     */
    async match(text, keywords, negativePhrases = [], threshold = 0.7) {
        const normalizedText = this.normalize(text);
        const textWords = this.tokenize(normalizedText);
        if (textWords.length === 0)
            return null;
        // Choose matching strategy based on utterance length
        const isShort = textWords.length <= KeywordMatcherService_1.SHORT_UTTERANCE_MAX_WORDS;
        let result = null;
        if (isShort || !this.semanticRouter.isAvailable) {
            // ─── Strategy 1: Levenshtein fuzzy word matching ───
            result = this.levenshteinMatch(textWords, keywords, threshold);
        }
        else {
            // ─── Strategy 2: Semantic embedding cosine similarity ───
            result = await this.semanticMatch(normalizedText, keywords, threshold);
            // Fallback to Levenshtein if semantic returned nothing
            if (!result) {
                result = this.levenshteinMatch(textWords, keywords, threshold);
            }
        }
        // ─── Negative keyword check ───
        if (result && negativePhrases.length > 0 && this.semanticRouter.isAvailable) {
            const isNegative = await this.semanticRouter.matchesNegative(normalizedText, negativePhrases, 0.7);
            if (isNegative) {
                this.logger.log(`[Matcher] Match "${result.matchedPhrase}" suppressed by negative keyword for text: "${text}"`);
                return null;
            }
        }
        return result;
    }
    /**
     * Synchronous match — backwards-compatible with existing code that
     * doesn't await. Uses Levenshtein only (no semantic).
     */
    matchSync(text, keywords, threshold = 0.7) {
        const normalizedText = this.normalize(text);
        const textWords = this.tokenize(normalizedText);
        if (textWords.length === 0)
            return null;
        return this.levenshteinMatch(textWords, keywords, threshold);
    }
    /**
     * Pre-cache keyword embeddings for semantic matching.
     * Should be called when a robot session starts or keywords are updated.
     */
    async preloadEmbeddings(keywords) {
        if (!this.semanticRouter.isAvailable)
            return;
        const allPhrases = [];
        for (const keyword of keywords) {
            allPhrases.push(...this.getKeywordPhrases(keyword));
        }
        await this.semanticRouter.cacheKeywordEmbeddings(allPhrases);
    }
    // ─── Levenshtein matching ──────────────────────────────
    /**
     * Word-level fuzzy matching using Levenshtein distance.
     */
    levenshteinMatch(textWords, keywords, threshold) {
        let bestMatch = null;
        let bestConfidence = 0;
        for (const keyword of keywords) {
            if (!keyword.keywords)
                continue;
            const phrases = this.getKeywordPhrases(keyword);
            for (const phrase of phrases) {
                const phraseWords = this.tokenize(this.normalize(phrase));
                if (phraseWords.length === 0)
                    continue;
                const confidence = this.calculateWordMatchConfidence(textWords, phraseWords);
                if (confidence >= threshold && confidence > bestConfidence) {
                    bestConfidence = confidence;
                    bestMatch = {
                        keyword,
                        confidence,
                        matchedPhrase: phrase,
                        matchedWordCount: phraseWords.length,
                        method: 'levenshtein',
                    };
                }
            }
        }
        return bestMatch;
    }
    // ─── Semantic matching ─────────────────────────────────
    /**
     * Semantic embedding cosine similarity matching.
     */
    async semanticMatch(text, keywords, threshold) {
        // Collect all candidate phrases
        const phraseToKeyword = new Map();
        const candidatePhrases = [];
        for (const keyword of keywords) {
            const phrases = this.getKeywordPhrases(keyword);
            for (const phrase of phrases) {
                phraseToKeyword.set(phrase, keyword);
                candidatePhrases.push(phrase);
            }
        }
        if (candidatePhrases.length === 0)
            return null;
        // Semantic threshold is slightly lower since cosine similarity
        // is inherently more nuanced than Levenshtein
        const semanticThreshold = Math.max(threshold - 0.15, 0.4);
        const match = await this.semanticRouter.findBestMatch(text, candidatePhrases, semanticThreshold);
        if (!match)
            return null;
        const keyword = phraseToKeyword.get(match.phrase);
        if (!keyword)
            return null;
        return {
            keyword,
            confidence: match.similarity,
            matchedPhrase: match.phrase,
            matchedWordCount: this.tokenize(match.phrase).length,
            method: 'semantic',
        };
    }
    // ─── Utility methods ───────────────────────────────────
    /**
     * Calculate confidence that all phrase words exist in the text (fuzzy).
     * Returns 0.0–1.0 based on how many phrase words were found.
     */
    calculateWordMatchConfidence(textWords, phraseWords) {
        let matchedWords = 0;
        let totalSimilarity = 0;
        for (const phraseWord of phraseWords) {
            let bestWordSimilarity = 0;
            for (const textWord of textWords) {
                const similarity = this.wordSimilarity(textWord, phraseWord);
                if (similarity > bestWordSimilarity) {
                    bestWordSimilarity = similarity;
                }
            }
            // Word is considered matched if similarity > 0.7
            if (bestWordSimilarity >= 0.7) {
                matchedWords++;
                totalSimilarity += bestWordSimilarity;
            }
        }
        if (phraseWords.length === 0)
            return 0;
        // Confidence = percentage of phrase words found * average similarity of matches
        const wordCoverage = matchedWords / phraseWords.length;
        const avgSimilarity = matchedWords > 0 ? totalSimilarity / matchedWords : 0;
        return wordCoverage * avgSimilarity;
    }
    /**
     * Calculate similarity between two words using Levenshtein distance.
     * Returns 0.0–1.0 (1.0 = exact match).
     */
    wordSimilarity(a, b) {
        if (a === b)
            return 1.0;
        const maxLen = Math.max(a.length, b.length);
        if (maxLen === 0)
            return 1.0;
        const dist = (0, fastest_levenshtein_1.distance)(a, b);
        return 1.0 - dist / maxLen;
    }
    /**
     * Get all trigger phrases from a keyword.
     * Uses keyword.keywords as primary, and keyword.synonyms array if available.
     */
    getKeywordPhrases(keyword) {
        const phrases = [];
        if (keyword.keywords) {
            phrases.push(keyword.keywords);
        }
        if (keyword.synonyms && Array.isArray(keyword.synonyms)) {
            phrases.push(...keyword.synonyms);
        }
        return phrases;
    }
    /**
     * Normalize text: lowercase, remove all non-word characters.
     */
    normalize(text) {
        return text
            .toLowerCase()
            .replace(/ё/g, 'е')
            .replace(/[^\p{L}\p{N}\s]/gu, '') // Remove all non-letter/non-number chars (Unicode-safe)
            .replace(/\s+/g, ' ')
            .trim();
    }
    /**
     * Tokenize text into individual words.
     */
    tokenize(text) {
        return text.split(' ').filter((w) => w.length > 0);
    }
};
exports.KeywordMatcherService = KeywordMatcherService;
exports.KeywordMatcherService = KeywordMatcherService = KeywordMatcherService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [semantic_router_service_1.SemanticRouterService])
], KeywordMatcherService);
//# sourceMappingURL=keyword-matcher.service.js.map