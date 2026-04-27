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

  /**
   * Minimal universal stop-words — language particles that carry no search value
   * in ANY domain. Domain-specific stop-words are computed automatically per list.
   */
  private static readonly UNIVERSAL_STOP_WORDS = new Set([
    // Prepositions / particles
    'в', 'на', 'по', 'с', 'к', 'о', 'у', 'из', 'за', 'от', 'до', 'для', 'при', 'без',
    'над', 'под', 'про', 'между', 'через', 'около',
    // Pronouns / misc
    'и', 'а', 'но', 'или', 'не', 'ни', 'да', 'это', 'то', 'что', 'как',
    'мне', 'мой', 'мои', 'моя', 'все', 'вся', 'вот', 'там', 'тут', 'где',
    'еще', 'ещё', 'уже', 'тоже', 'также',
    // Common speech prefixes — people say "город Красноярск", "район Советский"
    // These are conversational filler, not search-relevant in any domain
    'город', 'район', 'улица', 'деревня', 'село', 'поселок', 'посёлок',
    'проспект', 'переулок', 'площадь', 'набережная',
    'область', 'край', 'округ',
    'номер', 'вопрос', 'подскажите', 'скажите', 'пожалуйста',
  ]);

  /**
   * Auto-computed per-list stop-words cache: listId → Set of words
   * Words appearing in >50% of rows in a given list are stop-words FOR THAT LIST.
   */
  private readonly listStopWordsCache = new Map<number, Set<string>>();

  /** Document frequency threshold: words in >50% of rows are stop-words */
  private static readonly DF_STOP_THRESHOLD = 0.5;

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

    // Fast check: if first and last row are cached, assume all are cached (O(1) instead of O(n))
    if (list.rows.length > 0) {
      const firstKey = this.cacheKey(list.uid, 0);
      const lastKey = this.cacheKey(list.uid, list.rows.length - 1);
      if (this.rowEmbeddingCache.has(firstKey) && this.rowEmbeddingCache.has(lastKey)) {
        return; // Already fully cached
      }
    }

    // Detect answer-like columns to exclude from embeddings.
    // The searchable column with the longest avg text is likely the "answer" field
    // (e.g., full office schedule) — embedding it dilutes the search key quality.
    const answerCols = this.detectAnswerColumns(list);

    const startTime = Date.now();
    let cached = 0;

    for (let i = 0; i < list.rows.length; i++) {
      const key = this.cacheKey(list.uid, i);
      if (this.rowEmbeddingCache.has(key)) continue;

      const searchText = this.buildSearchText(list.columns, list.rows[i], answerCols);
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
    threshold: number = 0.65,
  ): Promise<DataListSearchResult | null> {
    if (!list.rows || list.rows.length === 0) return null;

    const normalizedQuery = this.normalize(query);
    const queryWords = this.tokenize(normalizedQuery);
    if (queryWords.length === 0) return null;

    // Filter out stop-words (universal + per-list auto-computed), keep at least 1 word
    const listStopWords = this.getListStopWords(list);
    const meaningfulWords = queryWords.filter(w =>
      !DataListSearchService.UNIVERSAL_STOP_WORDS.has(w) && !listStopWords.has(w),
    );
    const searchWords = meaningfulWords.length > 0 ? meaningfulWords : queryWords;

    const isShort = searchWords.length <= DataListSearchService.SHORT_QUERY_MAX_WORDS;

    // ─── Strategy: fuzzy first, semantic only if needed ───
    let fuzzyResult: DataListSearchResult | null = null;
    let semanticResult: DataListSearchResult | null = null;

    // 1. Fuzzy match (fast, good for short/exact queries)
    fuzzyResult = this.fuzzySearch(searchWords, list, returnField, threshold);

    // 2. Semantic match — only if fuzzy didn't find a strong match
    //    (avoids expensive embedding preload for obvious matches)
    const SKIP_SEMANTIC_THRESHOLD = 0.85;
    if (this.semanticRouter.isAvailable && (!fuzzyResult || fuzzyResult.confidence < SKIP_SEMANTIC_THRESHOLD)) {
      semanticResult = await this.semanticSearch(normalizedQuery, list, returnField, threshold);
    }

    // Pick the best result by confidence
    let result: DataListSearchResult | null = null;
    if (fuzzyResult && semanticResult) {
      // For short queries, prefer fuzzy unless semantic is significantly better
      if (isShort) {
        result = semanticResult.confidence > fuzzyResult.confidence + 0.15
          ? semanticResult : fuzzyResult;
      } else {
        result = semanticResult.confidence > fuzzyResult.confidence
          ? semanticResult : fuzzyResult;
      }
    } else {
      result = fuzzyResult || semanticResult;
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
    this.listStopWordsCache.delete(listId);
  }

  /**
   * Clear all cached embeddings.
   */
  clearAllCache(): void {
    this.rowEmbeddingCache.clear();
    this.listStopWordsCache.clear();
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

      // Check each searchable column individually
      for (const colKey of searchableKeys) {
        const cellValue = row[colKey];
        if (!cellValue) continue;

        const normalizedCell = this.normalize(cellValue);
        const cellWords = this.tokenize(normalizedCell);
        if (cellWords.length === 0) continue;

        let confidence = this.calculateFuzzyConfidence(queryWords, cellWords);

        // Boost: if all query words are substring-contained in cell text
        const queryJoined = queryWords.join(' ');
        if (normalizedCell.includes(queryJoined)) {
          confidence = Math.max(confidence, 0.95); // near-exact containment
        }

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
    // Use same threshold as fuzzy — no reduction; false positives are worse than misses
    const semanticThreshold = threshold;

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
    const semanticThreshold = threshold;

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

  // ─── Per-List Stop-Words ───────────────────────────────

  /**
   * Get (or compute & cache) stop-words specific to a data list.
   * Words that appear in >50% of searchable rows are considered stop-words
   * because they don't help discriminate between rows.
   *
   * Example: in a list of city offices, "офис" appears in every row → auto stop-word.
   * In a list of tariff plans, "тариф" appears in every row → auto stop-word.
   */
  private getListStopWords(list: VoiceRobotDataList): Set<string> {
    if (this.listStopWordsCache.has(list.uid)) {
      return this.listStopWordsCache.get(list.uid)!;
    }

    const stopWords = new Set<string>();
    const rowCount = list.rows.length;
    if (rowCount < 2) {
      this.listStopWordsCache.set(list.uid, stopWords);
      return stopWords;
    }

    // Count document frequency of each word across searchable columns
    const wordDocFreq = new Map<string, number>();

    for (const row of list.rows) {
      const searchText = this.buildSearchText(list.columns, row);
      const words = new Set(this.tokenize(this.normalize(searchText))); // unique per row
      for (const word of words) {
        if (word.length < 2) continue; // skip single chars
        wordDocFreq.set(word, (wordDocFreq.get(word) || 0) + 1);
      }
    }

    // Words appearing in >50% of rows are stop-words for this list
    const threshold = rowCount * DataListSearchService.DF_STOP_THRESHOLD;
    for (const [word, freq] of wordDocFreq) {
      if (freq > threshold) {
        stopWords.add(word);
      }
    }

    if (stopWords.size > 0) {
      this.logger.debug(
        `[DataListSearch] Auto stop-words for "${list.name}": [${Array.from(stopWords).join(', ')}]`,
      );
    }

    this.listStopWordsCache.set(list.uid, stopWords);
    return stopWords;
  }

  /**
   * Detect which searchable columns are likely "answer" fields.
   * Heuristic: if a searchable column has 3x+ longer average text than others,
   * it's probably an answer/response field (e.g., full office schedule).
   *
   * These columns should be excluded from embeddings to avoid diluting
   * the search key vectors.
   */
  private detectAnswerColumns(list: VoiceRobotDataList): Set<string> {
    const excludeKeys = new Set<string>();
    const searchableCols = list.columns.filter(col => col.searchable);
    if (searchableCols.length <= 1) return excludeKeys; // Only 1 searchable col — keep it

    // Calculate average text length per searchable column
    const avgLengths: { key: string; avg: number }[] = [];
    for (const col of searchableCols) {
      let totalLen = 0;
      for (const row of list.rows) {
        totalLen += (row[col.key] || '').length;
      }
      avgLengths.push({ key: col.key, avg: list.rows.length > 0 ? totalLen / list.rows.length : 0 });
    }

    // Find the shortest avg (the "key" column) and flag columns 3x+ longer
    const minAvg = Math.min(...avgLengths.map(a => a.avg));
    if (minAvg === 0) return excludeKeys;

    for (const { key, avg } of avgLengths) {
      if (avg > minAvg * 3 && avg > 50) { // Must be 3x longer AND > 50 chars avg
        excludeKeys.add(key);
        this.logger.debug(
          `[DataListSearch] Excluding column "${key}" from embeddings ` +
          `(avg ${avg.toFixed(0)} chars vs min ${minAvg.toFixed(0)} — likely answer field)`,
        );
      }
    }

    return excludeKeys;
  }

  // ─── Utility Methods ──────────────────────────────────

  /**
   * Build search text from searchable columns of a row.
   * EXCLUDES the returnField column — it contains answer data
   * that would pollute embeddings and fuzzy matching.
   *
   * Example: for a city offices list with columns [city(searchable), answer(searchable)]:
   * - Before: "Красноярск Офис компании находится по адресу..." (embedded together)
   * - After:  "Красноярск" (only the search key is embedded)
   */
  private buildSearchText(
    columns: IDataListColumn[],
    row: Record<string, string>,
    excludeKeys?: Set<string>,
  ): string {
    return columns
      .filter(col => col.searchable && (!excludeKeys || !excludeKeys.has(col.key)))
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
