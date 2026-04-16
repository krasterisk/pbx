import { Injectable, Logger } from '@nestjs/common';
import { distance } from 'fastest-levenshtein';
import { VoiceRobotKeyword } from '../keyword.model';
import { SemanticRouterService } from './semantic-router.service';

/**
 * Result of a keyword match attempt.
 */
export interface MatchResult {
  /** Matched keyword entity */
  keyword: VoiceRobotKeyword;
  /** Confidence score (0.0–1.0) */
  confidence: number;
  /** Which specific phrase triggered the match */
  matchedPhrase: string;
  /** Number of words matched */
  matchedWordCount: number;
  /** Matching method used */
  method: 'levenshtein' | 'semantic';
}

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
@Injectable()
export class KeywordMatcherService {
  private readonly logger = new Logger(KeywordMatcherService.name);

  /** Word count threshold: ≤ this → Levenshtein, > this → semantic */
  private static readonly SHORT_UTTERANCE_MAX_WORDS = 2;

  constructor(
    private readonly semanticRouter: SemanticRouterService,
  ) {}

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
  async match(
    text: string,
    keywords: VoiceRobotKeyword[],
    negativePhrases: string[] = [],
    threshold: number = 0.7,
  ): Promise<MatchResult | null> {
    const normalizedText = this.normalize(text);
    const textWords = this.tokenize(normalizedText);

    if (textWords.length === 0) return null;

    // Choose matching strategy based on utterance length
    const isShort = textWords.length <= KeywordMatcherService.SHORT_UTTERANCE_MAX_WORDS;

    let result: MatchResult | null = null;

    if (isShort || !this.semanticRouter.isAvailable) {
      // ─── Strategy 1: Levenshtein fuzzy word matching ───
      result = this.levenshteinMatch(textWords, keywords, threshold);
    } else {
      // ─── Strategy 2: Semantic embedding cosine similarity ───
      result = await this.semanticMatch(normalizedText, keywords, threshold);

      // Fallback to Levenshtein if semantic returned nothing
      if (!result) {
        result = this.levenshteinMatch(textWords, keywords, threshold);
      }
    }

    // ─── Negative keyword check ───
    if (result && negativePhrases.length > 0 && this.semanticRouter.isAvailable) {
      const isNegative = await this.semanticRouter.matchesNegative(
        normalizedText,
        negativePhrases,
        0.7,
      );

      if (isNegative) {
        this.logger.log(
          `[Matcher] Match "${result.matchedPhrase}" suppressed by negative keyword for text: "${text}"`,
        );
        return null;
      }
    }

    return result;
  }

  /**
   * Synchronous match — backwards-compatible with existing code that
   * doesn't await. Uses Levenshtein only (no semantic).
   */
  matchSync(text: string, keywords: VoiceRobotKeyword[], threshold: number = 0.7): MatchResult | null {
    const normalizedText = this.normalize(text);
    const textWords = this.tokenize(normalizedText);
    if (textWords.length === 0) return null;

    return this.levenshteinMatch(textWords, keywords, threshold);
  }

  /**
   * Pre-cache keyword embeddings for semantic matching.
   * Should be called when a robot session starts or keywords are updated.
   */
  async preloadEmbeddings(keywords: VoiceRobotKeyword[]): Promise<void> {
    if (!this.semanticRouter.isAvailable) return;

    const allPhrases: string[] = [];
    for (const keyword of keywords) {
      allPhrases.push(...this.getKeywordPhrases(keyword));
    }

    await this.semanticRouter.cacheKeywordEmbeddings(allPhrases);
  }

  // ─── Levenshtein matching ──────────────────────────────

  /**
   * Word-level fuzzy matching using Levenshtein distance.
   */
  private levenshteinMatch(
    textWords: string[],
    keywords: VoiceRobotKeyword[],
    threshold: number,
  ): MatchResult | null {
    let bestMatch: MatchResult | null = null;
    let bestConfidence = 0;

    for (const keyword of keywords) {
      if (!keyword.keywords) continue;

      const phrases = this.getKeywordPhrases(keyword);

      for (const phrase of phrases) {
        const phraseWords = this.tokenize(this.normalize(phrase));
        if (phraseWords.length === 0) continue;

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
  private async semanticMatch(
    text: string,
    keywords: VoiceRobotKeyword[],
    threshold: number,
  ): Promise<MatchResult | null> {
    // Collect all candidate phrases
    const phraseToKeyword = new Map<string, VoiceRobotKeyword>();
    const candidatePhrases: string[] = [];

    for (const keyword of keywords) {
      const phrases = this.getKeywordPhrases(keyword);
      for (const phrase of phrases) {
        phraseToKeyword.set(phrase, keyword);
        candidatePhrases.push(phrase);
      }
    }

    if (candidatePhrases.length === 0) return null;

    // Semantic threshold is slightly lower since cosine similarity
    // is inherently more nuanced than Levenshtein
    const semanticThreshold = Math.max(threshold - 0.15, 0.4);

    const match = await this.semanticRouter.findBestMatch(
      text,
      candidatePhrases,
      semanticThreshold,
    );

    if (!match) return null;

    const keyword = phraseToKeyword.get(match.phrase);
    if (!keyword) return null;

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
  private calculateWordMatchConfidence(
    textWords: string[],
    phraseWords: string[],
  ): number {
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

    if (phraseWords.length === 0) return 0;

    // Confidence = percentage of phrase words found * average similarity of matches
    const wordCoverage = matchedWords / phraseWords.length;
    const avgSimilarity = matchedWords > 0 ? totalSimilarity / matchedWords : 0;

    return wordCoverage * avgSimilarity;
  }

  /**
   * Calculate similarity between two words using Levenshtein distance.
   * Returns 0.0–1.0 (1.0 = exact match).
   */
  private wordSimilarity(a: string, b: string): number {
    if (a === b) return 1.0;

    const maxLen = Math.max(a.length, b.length);
    if (maxLen === 0) return 1.0;

    const dist = distance(a, b);
    return 1.0 - dist / maxLen;
  }

  /**
   * Get all trigger phrases from a keyword.
   * Uses keyword.keywords as primary, and keyword.synonyms array if available.
   */
  private getKeywordPhrases(keyword: VoiceRobotKeyword): string[] {
    const phrases: string[] = [];

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
  private normalize(text: string): string {
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
  private tokenize(text: string): string[] {
    return text.split(' ').filter((w) => w.length > 0);
  }
}
