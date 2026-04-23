import { Injectable, Logger } from '@nestjs/common';
import { distance } from 'fastest-levenshtein';
import { SemanticRouterService } from './semantic-router.service';
import { VoiceRobotDataList, IDataListColumn } from '../data-list.model';

/**
 * Result of a data list search.
 */
export interface DataListSearchResult {
  /** The matched row (full record) */
  row: Record<string, string>;
  /** Index of the matched row in the data list */
  rowIndex: number;
  /** Extracted return field value */
  value: string;
  /** Confidence score (0.0–1.0) */
  confidence: number;
  /** Matching method used */
  method: 'fuzzy' | 'semantic';
}

/**
 * Data List Search Service — hybrid fuzzy + embedding search for structured data lists.
 *
 * Architecture:
 * - Reuses SemanticRouterService (nomic-embed-text-v1.5) for embedding-based search
 * - Levenshtein fuzzy matching for short queries (≤3 words)
 * - Semantic cosine similarity for longer queries
 * - Deterministic field extraction: embedding finds the ROW, config specifies the FIELD
 *
 * Performance (100 rows):
 * - Preload embeddings: ~1-2s (one-time, at session start)
 * - Query embedding: ~10-20ms
 * - Cosine similarity × 100: ~0.01ms
 * - Total per search: ~12-22ms (CPU only, no network)
 */
@Injectable()
export class DataListSearchService {
  private readonly logger = new Logger(DataListSearchService.name);

  /** Cache: `list_${listId}_row_${rowIndex}` → normalized embedding vector */
  private readonly rowEmbeddingCache = new Map<string, Float32Array>();

  /** Word count threshold: ≤ this → fuzzy, > this → semantic */
  private static readonly SHORT_QUERY_MAX_WORDS = 3;

  constructor(
    private readonly semanticRouter: SemanticRouterService,
  ) {}

  /**
   * Pre-compute and cache embeddings for all rows in a data list.
   * Should be called once when a voice robot session starts.
   *
   * Only searchable columns are included in the embedding text.
   */
  async preloadList(list: VoiceRobotDataList): Promise<void> {
    if (!this.semanticRouter.isAvailable) {
      this.logger.debug('[DataListSearch] Semantic router not available, skipping preload');
      return;
    }

    const startTime = Date.now();
    let cached = 0;

    for (let i = 0; i < list.rows.length; i++) {
      const key = this.cacheKey(list.uid, i);
      if (this.rowEmbeddingCache.has(key)) continue;

      const searchText = this.buildSearchText(list.columns, list.rows[i]);
      if (!searchText.trim()) continue;

      try {
        const embedding = await this.semanticRouter.embed(searchText, false);
        this.rowEmbeddingCache.set(key, embedding);
        cached++;
      } catch (err: any) {
        this.logger.warn(`[DataListSearch] Failed to embed row ${i} of list ${list.uid}: ${err.message}`);
      }
    }

    const elapsed = Date.now() - startTime;
    if (cached > 0) {
      this.logger.log(
        `[DataListSearch] Cached ${cached} row embeddings for list "${list.name}" (${list.uid}) in ${elapsed}ms`,
      );
    }
  }

  /**
   * Search a data list for the best matching row.
   *
   * Hybrid strategy:
   * 1. Short queries (≤3 words) → Levenshtein fuzzy match on searchable columns
   * 2. Long queries (>3 words) → Semantic embedding cosine similarity
   * 3. Fallback: if semantic returns nothing, try fuzzy
   *
   * @param query - Search text (from STT or slot value)
   * @param list - The data list to search
   * @param returnField - Column key to extract from matched row
   * @param threshold - Minimum confidence (default: 0.55)
   * @returns Match result with extracted field value, or null
   */
  async search(
    query: string,
    list: VoiceRobotDataList,
    returnField: string,
    threshold: number = 0.55,
  ): Promise<DataListSearchResult | null> {
    if (!list.rows || list.rows.length === 0) return null;

    const normalizedQuery = this.normalize(query);
    const queryWords = this.tokenize(normalizedQuery);
    if (queryWords.length === 0) return null;

    const isShort = queryWords.length <= DataListSearchService.SHORT_QUERY_MAX_WORDS;

    let result: DataListSearchResult | null = null;

    // ─── Strategy 1: Fuzzy match for short queries ───
    if (isShort || !this.semanticRouter.isAvailable) {
      result = this.fuzzySearch(queryWords, list, returnField, threshold);
    }

    // ─── Strategy 2: Semantic embedding search ───
    if (!result && this.semanticRouter.isAvailable) {
      result = await this.semanticSearch(normalizedQuery, list, returnField, threshold);
    }

    // ─── Fallback: fuzzy if semantic returned nothing ───
    if (!result && !isShort && this.semanticRouter.isAvailable) {
      result = this.fuzzySearch(queryWords, list, returnField, Math.max(threshold - 0.1, 0.4));
    }

    if (result) {
      this.logger.log(
        `[DataListSearch] Match in "${list.name}": ` +
        `query="${query}" → row[${result.rowIndex}], ` +
        `${returnField}="${result.value}", ` +
        `confidence=${result.confidence.toFixed(3)}, method=${result.method}`,
      );
    }

    return result;
  }

  /**
   * Search a data list and return ALL rows matching above threshold.
   * Used when multiMatchStrategy is 'random' to pick a random result.
   */
  async searchAll(
    query: string,
    list: VoiceRobotDataList,
    returnField: string,
    threshold: number = 0.55,
  ): Promise<DataListSearchResult[]> {
    if (!list.rows || list.rows.length === 0) return [];

    const normalizedQuery = this.normalize(query);
    const queryWords = this.tokenize(normalizedQuery);
    if (queryWords.length === 0) return [];

    const results: DataListSearchResult[] = [];
    const isShort = queryWords.length <= DataListSearchService.SHORT_QUERY_MAX_WORDS;

    // Fuzzy search all
    if (isShort || !this.semanticRouter.isAvailable) {
      results.push(...this.fuzzySearchAll(queryWords, list, returnField, threshold));
    }

    // Semantic search all (only if fuzzy found nothing)
    if (results.length === 0 && this.semanticRouter.isAvailable) {
      const semanticResults = await this.semanticSearchAll(normalizedQuery, list, returnField, threshold);
      results.push(...semanticResults);
    }

    // Deduplicate by rowIndex (prefer higher confidence)
    const byRow = new Map<number, DataListSearchResult>();
    for (const r of results) {
      const existing = byRow.get(r.rowIndex);
      if (!existing || r.confidence > existing.confidence) {
        byRow.set(r.rowIndex, r);
      }
    }

    return Array.from(byRow.values()).sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Clear cached embeddings for a specific data list.
   */
  clearListCache(listId: number): void {
    const prefix = `list_${listId}_`;
    for (const key of this.rowEmbeddingCache.keys()) {
      if (key.startsWith(prefix)) {
        this.rowEmbeddingCache.delete(key);
      }
    }
  }

  /**
   * Clear all cached embeddings.
   */
  clearAllCache(): void {
    this.rowEmbeddingCache.clear();
  }

  // ─── Fuzzy Search ──────────────────────────────────────

  /**
   * Levenshtein word-level fuzzy match across searchable columns.
   */
  private fuzzySearch(
    queryWords: string[],
    list: VoiceRobotDataList,
    returnField: string,
    threshold: number,
  ): DataListSearchResult | null {
    const searchableKeys = list.columns
      .filter(col => col.searchable)
      .map(col => col.key);

    let bestRow: Record<string, string> | null = null;
    let bestIndex = -1;
    let bestConfidence = 0;

    for (let i = 0; i < list.rows.length; i++) {
      const row = list.rows[i];

      // Check each searchable column
      for (const colKey of searchableKeys) {
        const cellValue = row[colKey];
        if (!cellValue) continue;

        const cellWords = this.tokenize(this.normalize(cellValue));
        if (cellWords.length === 0) continue;

        const confidence = this.calculateFuzzyConfidence(queryWords, cellWords);

        if (confidence > bestConfidence) {
          bestConfidence = confidence;
          bestRow = row;
          bestIndex = i;
        }
      }

      // Also check concatenated searchable text (for multi-column queries)
      const fullSearchText = this.buildSearchText(list.columns, row);
      const fullWords = this.tokenize(this.normalize(fullSearchText));
      if (fullWords.length > 0) {
        const confidence = this.calculateFuzzyConfidence(queryWords, fullWords);
        if (confidence > bestConfidence) {
          bestConfidence = confidence;
          bestRow = row;
          bestIndex = i;
        }
      }
    }

    if (bestRow && bestConfidence >= threshold) {
      return {
        row: bestRow,
        rowIndex: bestIndex,
        value: bestRow[returnField] || '',
        confidence: bestConfidence,
        method: 'fuzzy',
      };
    }

    return null;
  }

  /**
   * Fuzzy search returning ALL rows above threshold.
   */
  private fuzzySearchAll(
    queryWords: string[],
    list: VoiceRobotDataList,
    returnField: string,
    threshold: number,
  ): DataListSearchResult[] {
    const searchableKeys = list.columns
      .filter(col => col.searchable)
      .map(col => col.key);

    const results: DataListSearchResult[] = [];

    for (let i = 0; i < list.rows.length; i++) {
      const row = list.rows[i];
      let rowBestConfidence = 0;

      for (const colKey of searchableKeys) {
        const cellValue = row[colKey];
        if (!cellValue) continue;
        const cellWords = this.tokenize(this.normalize(cellValue));
        if (cellWords.length === 0) continue;
        const confidence = this.calculateFuzzyConfidence(queryWords, cellWords);
        if (confidence > rowBestConfidence) rowBestConfidence = confidence;
      }

      const fullSearchText = this.buildSearchText(list.columns, row);
      const fullWords = this.tokenize(this.normalize(fullSearchText));
      if (fullWords.length > 0) {
        const confidence = this.calculateFuzzyConfidence(queryWords, fullWords);
        if (confidence > rowBestConfidence) rowBestConfidence = confidence;
      }

      if (rowBestConfidence >= threshold) {
        results.push({
          row,
          rowIndex: i,
          value: row[returnField] || '',
          confidence: rowBestConfidence,
          method: 'fuzzy',
        });
      }
    }

    return results;
  }

  // ─── Semantic Search ───────────────────────────────────

  /**
   * Embedding cosine similarity search.
   */
  private async semanticSearch(
    query: string,
    list: VoiceRobotDataList,
    returnField: string,
    threshold: number,
  ): Promise<DataListSearchResult | null> {
    const semanticThreshold = Math.max(threshold - 0.1, 0.4);

    let queryEmbed: Float32Array;
    try {
      queryEmbed = await this.semanticRouter.embed(query, true);
    } catch {
      return null;
    }

    let bestRow: Record<string, string> | null = null;
    let bestIndex = -1;
    let bestSimilarity = 0;

    for (let i = 0; i < list.rows.length; i++) {
      const key = this.cacheKey(list.uid, i);
      const cached = this.rowEmbeddingCache.get(key);
      if (!cached) continue;

      const similarity = this.cosineSimilarity(queryEmbed, cached);
      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestRow = list.rows[i];
        bestIndex = i;
      }
    }

    if (bestRow && bestSimilarity >= semanticThreshold) {
      return {
        row: bestRow,
        rowIndex: bestIndex,
        value: bestRow[returnField] || '',
        confidence: bestSimilarity,
        method: 'semantic',
      };
    }

    return null;
  }

  /**
   * Semantic search returning ALL rows above threshold.
   */
  private async semanticSearchAll(
    query: string,
    list: VoiceRobotDataList,
    returnField: string,
    threshold: number,
  ): Promise<DataListSearchResult[]> {
    const semanticThreshold = Math.max(threshold - 0.1, 0.4);

    let queryEmbed: Float32Array;
    try {
      queryEmbed = await this.semanticRouter.embed(query, true);
    } catch {
      return [];
    }

    const results: DataListSearchResult[] = [];

    for (let i = 0; i < list.rows.length; i++) {
      const key = this.cacheKey(list.uid, i);
      const cached = this.rowEmbeddingCache.get(key);
      if (!cached) continue;

      const similarity = this.cosineSimilarity(queryEmbed, cached);
      if (similarity >= semanticThreshold) {
        results.push({
          row: list.rows[i],
          rowIndex: i,
          value: list.rows[i][returnField] || '',
          confidence: similarity,
          method: 'semantic',
        });
      }
    }

    return results;
  }

  // ─── Utility Methods ──────────────────────────────────

  /**
   * Build search text from searchable columns of a row.
   * Non-searchable columns (e.g. phone numbers) are excluded
   * to improve embedding quality.
   */
  private buildSearchText(
    columns: IDataListColumn[],
    row: Record<string, string>,
  ): string {
    return columns
      .filter(col => col.searchable)
      .map(col => row[col.key] || '')
      .filter(Boolean)
      .join(' ');
  }

  /**
   * Calculate fuzzy confidence: how many query words match cell words.
   */
  private calculateFuzzyConfidence(
    queryWords: string[],
    cellWords: string[],
  ): number {
    let matchedWords = 0;
    let totalSimilarity = 0;

    for (const qWord of queryWords) {
      let bestWordSimilarity = 0;

      for (const cWord of cellWords) {
        const similarity = this.wordSimilarity(qWord, cWord);
        if (similarity > bestWordSimilarity) {
          bestWordSimilarity = similarity;
        }
      }

      if (bestWordSimilarity >= 0.7) {
        matchedWords++;
        totalSimilarity += bestWordSimilarity;
      }
    }

    if (queryWords.length === 0) return 0;

    const wordCoverage = matchedWords / queryWords.length;
    const avgSimilarity = matchedWords > 0 ? totalSimilarity / matchedWords : 0;

    return wordCoverage * avgSimilarity;
  }

  /**
   * Levenshtein word similarity (0.0–1.0).
   */
  private wordSimilarity(a: string, b: string): number {
    if (a === b) return 1.0;
    const maxLen = Math.max(a.length, b.length);
    if (maxLen === 0) return 1.0;
    return 1.0 - distance(a, b) / maxLen;
  }

  /**
   * Cosine similarity (assumes normalized vectors → dot product).
   */
  private cosineSimilarity(a: Float32Array, b: Float32Array): number {
    const len = Math.min(a.length, b.length);
    let dot = 0;
    for (let i = 0; i < len; i++) {
      dot += a[i] * b[i];
    }
    return dot;
  }

  private normalize(text: string): string {
    return text
      .toLowerCase()
      .replace(/ё/g, 'е')
      .replace(/[^\p{L}\p{N}\s]/gu, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private tokenize(text: string): string[] {
    return text.split(' ').filter(w => w.length > 0);
  }

  private cacheKey(listId: number, rowIndex: number): string {
    return `list_${listId}_row_${rowIndex}`;
  }
}
