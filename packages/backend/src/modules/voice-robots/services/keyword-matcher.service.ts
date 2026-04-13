import { Injectable, Logger } from '@nestjs/common';
import { distance } from 'fastest-levenshtein';
import { VoiceRobotKeyword } from '../keyword.model';

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
}

/**
 * Keyword Matcher Service — Per-Word Fuzzy Matching.
 *
 * Fixed from phrase-level Levenshtein to word-level:
 * - Split recognized text into individual words
 * - For each keyword phrase, check if all words appear in the text (fuzzy)
 * - Returns the best match above the threshold
 *
 * This approach handles:
 * - "Да, я хочу подключить тариф" → matches keyword "подключить тариф"
 * - "Ну, в общем, мне нужна помощь" → matches "помощь"
 * - Typos in STT: "подклучить" → matches "подключить" (Levenshtein ≤ 1)
 */
@Injectable()
export class KeywordMatcherService {
  private readonly logger = new Logger(KeywordMatcherService.name);

  /**
   * Match recognized text against a list of keywords.
   * Returns the best match or null if no match found.
   *
   * @param text - The STT-recognized text
   * @param keywords - Database keyword entries with phrases
   */
  match(text: string, keywords: VoiceRobotKeyword[]): MatchResult | null {
    const normalizedText = this.normalize(text);
    const textWords = this.tokenize(normalizedText);

    if (textWords.length === 0) return null;

    let bestMatch: MatchResult | null = null;
    let bestConfidence = 0;

    for (const keyword of keywords) {
      // Keywords text field contains the primary trigger phrase
      if (!keyword.keywords) continue;

      // Each keyword can have multiple trigger phrases (e.g. "да", "конечно", "согласен")
      const phrases = this.getKeywordPhrases(keyword);

      for (const phrase of phrases) {
        const phraseWords = this.tokenize(this.normalize(phrase));
        if (phraseWords.length === 0) continue;

        const confidence = this.calculateWordMatchConfidence(textWords, phraseWords);
        const threshold = 0.7; // Default threshold (configurable in the future)

        if (confidence >= threshold && confidence > bestConfidence) {
          bestConfidence = confidence;
          bestMatch = {
            keyword,
            confidence,
            matchedPhrase: phrase,
            matchedWordCount: phraseWords.length,
          };
        }
      }
    }

    return bestMatch;
  }

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
   * Uses keyword.phrase as primary, and keyword.synonyms array if available.
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
