import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

/**
 * Semantic Router Service — NLU via Vector Embeddings.
 *
 * Uses @huggingface/transformers with the Nomic Embed Text v1.5 model
 * to compute sentence embeddings and match caller utterances against
 * keyword phrases via cosine similarity.
 *
 * Architecture:
 * - Model: nomic-ai/nomic-embed-text-v1.5 (ONNX, quantized INT8, ~150MB)
 * - Matryoshka Representation Learning: truncate 768-dim → 128-dim
 * - CPU-only inference (~10-20ms per embedding)
 * - Embedding cache: keyword phrases are pre-computed and cached in RAM
 *
 * The service is used by KeywordMatcherService as a "long utterance"
 * fallback when Levenshtein-based word matching is insufficient.
 *
 * @see https://huggingface.co/nomic-ai/nomic-embed-text-v1.5
 */
@Injectable()
export class SemanticRouterService implements OnModuleInit {
  private readonly logger = new Logger(SemanticRouterService.name);

  private pipeline: any = null;
  private initialized = false;

  /** Embedding dimension (Matryoshka truncation — 256 dims balances quality vs memory) */
  private static readonly EMBED_DIM = 256;

  /** Model name */
  private static readonly MODEL = 'nomic-ai/nomic-embed-text-v1.5';

  /** Cache: keyword phrase text → normalized embedding vector */
  private readonly embeddingCache = new Map<string, Float32Array>();

  async onModuleInit(): Promise<void> {
    try {
      // Dynamic import — @huggingface/transformers is ESM-only
      const { pipeline: createPipeline } = await import('@huggingface/transformers');

      this.logger.log(`Loading embedding model: ${SemanticRouterService.MODEL}...`);

      this.pipeline = await createPipeline(
        'feature-extraction',
        SemanticRouterService.MODEL,
        {
          // Use quantized ONNX model for CPU
          dtype: 'q8', // INT8 quantization
          device: 'cpu',
        },
      );

      this.initialized = true;
      this.logger.log(
        `Semantic Router initialized (model: ${SemanticRouterService.MODEL}, dim: ${SemanticRouterService.EMBED_DIM})`,
      );
    } catch (err: any) {
      this.logger.warn(
        `Semantic Router not initialized — falling back to Levenshtein only: ${err.message}`,
      );
    }
  }

  /**
   * Whether the semantic router is available.
   * If false, KeywordMatcherService should skip semantic matching.
   */
  get isAvailable(): boolean {
    return this.initialized;
  }

  /**
   * Compute embedding for a text string.
   * Returns a normalized Float32Array of dimension EMBED_DIM.
   *
   * Uses "search_query:" prefix for queries and "search_document:" for docs,
   * following Nomic's recommended usage.
   */
  async embed(text: string, isQuery: boolean = true): Promise<Float32Array> {
    if (!this.pipeline) {
      throw new Error('SemanticRouterService not initialized');
    }

    // Nomic v1.5 uses task-specific prefixes
    const prefixedText = isQuery
      ? `search_query: ${text}`
      : `search_document: ${text}`;

    const output = await this.pipeline(prefixedText, {
      pooling: 'mean',
      normalize: true,
    });

    // Get raw Float32 data and truncate to EMBED_DIM (Matryoshka)
    const fullEmbed: Float32Array = output.data instanceof Float32Array
      ? output.data
      : new Float32Array(output.data);

    const truncated = fullEmbed.slice(0, SemanticRouterService.EMBED_DIM);

    // Re-normalize after truncation
    return this.normalizeVector(truncated);
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

      const similarity = this.cosineSimilarity(queryEmbed, cached);

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

      const similarity = this.cosineSimilarity(queryEmbed, cached);
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

  // ─── Math utilities ─────────────────────────────────────

  /**
   * Cosine similarity between two vectors.
   * Assumes inputs are already normalized (dot product = cosine similarity).
   */
  private cosineSimilarity(a: Float32Array, b: Float32Array): number {
    const len = Math.min(a.length, b.length);
    let dot = 0;
    for (let i = 0; i < len; i++) {
      dot += a[i] * b[i];
    }
    return dot;
  }

  /**
   * L2-normalize a vector in-place.
   */
  private normalizeVector(vec: Float32Array): Float32Array {
    let norm = 0;
    for (let i = 0; i < vec.length; i++) {
      norm += vec[i] * vec[i];
    }
    norm = Math.sqrt(norm);

    if (norm > 0) {
      for (let i = 0; i < vec.length; i++) {
        vec[i] /= norm;
      }
    }

    return vec;
  }
}
