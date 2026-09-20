import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  cosineSimilarity,
  getSharedNomicEmbedder,
  NOMIC_EMBED_DIM,
  NOMIC_MODEL,
  type TextEmbedder,
} from '../../embeddings/nomic-embed';

/**
 * Semantic Router Service — NLU via Vector Embeddings.
 *
 * Shares the nomic-ai/nomic-embed-text-v1.5 ONNX embedder with knowledge retrieval
 * (`modules/embeddings/nomic-embed.ts`) so the robot keyword matcher and KB index
 * use one model, one dimension (256, Matryoshka), and one process-wide load.
 */
@Injectable()
export class SemanticRouterService implements OnModuleInit {
  private readonly logger = new Logger(SemanticRouterService.name);
  private embedder: TextEmbedder | null = null;
  private initialized = false;
  private readonly embeddingCache = new Map<string, Float32Array>();

  onModuleInit(): void {
    setTimeout(() => this.loadModel(), 0);
  }

  private async loadModel(): Promise<void> {
    try {
      this.logger.log(`Loading embedding model: ${NOMIC_MODEL}...`);
      this.embedder = await getSharedNomicEmbedder();
      this.initialized = Boolean(this.embedder);
      if (this.embedder) {
        this.logger.log(`Semantic Router initialized (model: ${NOMIC_MODEL}, dim: ${NOMIC_EMBED_DIM})`);
      } else {
        this.logger.warn('Semantic Router not initialized — falling back to Levenshtein only');
      }
    } catch (err: any) {
      this.logger.warn(
        `Semantic Router not initialized — falling back to Levenshtein only: ${err.message}`,
      );
    }
  }

  get isAvailable(): boolean {
    return this.initialized;
  }

  async embed(text: string, isQuery: boolean = true): Promise<Float32Array> {
    if (!this.embedder) {
      throw new Error('SemanticRouterService not initialized');
    }
    return this.embedder.embed(text, isQuery);
  }

  /**
   * Pre-compute and cache embeddings for keyword phrases.
   * Should be called when a robot's keywords are loaded or updated.
   *
   * @param phrases Map of phrase text → unique identifier
   */
  async cacheKeywordEmbeddings(phrases: string[]): Promise<void> {
    if (!this.initialized) return;

    const startTime = Date.now();
    let cached = 0;

    for (const phrase of phrases) {
      const key = phrase.toLowerCase().trim();
      if (this.embeddingCache.has(key)) continue;

      try {
        const embedding = await this.embed(phrase, false); // "search_document:" prefix
        this.embeddingCache.set(key, embedding);
        cached++;
      } catch (err: any) {
        this.logger.warn(`Failed to embed phrase "${phrase}": ${err.message}`);
      }
    }

    const elapsed = Date.now() - startTime;
    if (cached > 0) {
      this.logger.log(`Cached ${cached} keyword embeddings in ${elapsed}ms (total: ${this.embeddingCache.size})`);
    }
  }

  /**
   * Find the best semantic match for user text among cached keyword phrases.
   *
   * @param text User's spoken text (from STT)
   * @param candidatePhrases List of keyword phrases to match against (must be pre-cached)
   * @param threshold Minimum cosine similarity to consider a match (default: 0.5)
   * @returns Best match with similarity score, or null if below threshold
   */
  async findBestMatch(
    text: string,
    candidatePhrases: string[],
    threshold: number = 0.5,
  ): Promise<{ phrase: string; similarity: number } | null> {
    if (!this.initialized) return null;

    const queryEmbed = await this.embed(text, true);

    let bestPhrase: string | null = null;
    let bestSimilarity = 0;

    for (const phrase of candidatePhrases) {
      const key = phrase.toLowerCase().trim();
      const cached = this.embeddingCache.get(key);
      if (!cached) continue;

      const similarity = cosineSimilarity(queryEmbed, cached);

      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestPhrase = phrase;
      }
    }

    if (bestPhrase && bestSimilarity >= threshold) {
      return { phrase: bestPhrase, similarity: bestSimilarity };
    }

    return null;
  }

  /**
   * Check if text matches any negative keywords (anti-patterns).
   * Returns true if the text is semantically similar to a negative keyword.
   *
   * Used to prevent false positives: if a phrase is close to both positive
   * and negative keywords, the negative match takes priority.
   *
   * @param text User's spoken text
   * @param negativePhrases List of negative keyword phrases (pre-cached)
   * @param threshold Minimum similarity to consider a negative match
   */
  async matchesNegative(
    text: string,
    negativePhrases: string[],
    threshold: number = 0.7,
  ): Promise<boolean> {
    if (!this.initialized || negativePhrases.length === 0) return false;

    const queryEmbed = await this.embed(text, true);

    for (const phrase of negativePhrases) {
      const key = phrase.toLowerCase().trim();
      const cached = this.embeddingCache.get(key);
      if (!cached) continue;

      const similarity = cosineSimilarity(queryEmbed, cached);
      if (similarity >= threshold) {
        this.logger.debug(`Negative match: "${text}" ≈ "${phrase}" (${similarity.toFixed(3)})`);
        return true;
      }
    }

    return false;
  }

  /**
   * Clear cached embeddings (e.g. when keyword config changes).
   */
  clearCache(): void {
    this.embeddingCache.clear();
  }

  /**
   * Remove specific phrases from cache.
   */
  removeCachedPhrases(phrases: string[]): void {
    for (const phrase of phrases) {
      this.embeddingCache.delete(phrase.toLowerCase().trim());
    }
  }
}
