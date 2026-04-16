import { KeywordMatcherService } from './keyword-matcher.service';
import { SemanticRouterService } from './semantic-router.service';
import { VoiceRobotKeyword } from '../keyword.model';

/**
 * Unit tests for KeywordMatcherService.
 *
 * Tests the Levenshtein matching tier (synchronous, no model required).
 * Semantic matching is tested via integration tests with the embedding model.
 */
describe('KeywordMatcherService', () => {
  let service: KeywordMatcherService;
  let mockSemanticRouter: jest.Mocked<SemanticRouterService>;

  // Helper: create a minimal keyword-like object for testing
  const createKeyword = (
    uid: number,
    keywords: string,
    synonyms: string[] = [],
    negativeKeywords: string[] = [],
  ): VoiceRobotKeyword => ({
    uid,
    keywords,
    synonyms,
    negative_keywords: negativeKeywords,
    group_id: 1,
    actions: null,
    bot_action: null,
    priority: 0,
    comment: null,
    user_uid: 1,
  } as unknown as VoiceRobotKeyword);

  beforeEach(() => {
    mockSemanticRouter = {
      isAvailable: false, // Disable semantic matching for pure Levenshtein tests
      findBestMatch: jest.fn(),
      matchesNegative: jest.fn(),
      cacheKeywordEmbeddings: jest.fn(),
    } as unknown as jest.Mocked<SemanticRouterService>;

    service = new KeywordMatcherService(mockSemanticRouter);
  });

  // ─── Basic Matching ──────────────────────────────────────

  describe('Levenshtein matching (short text)', () => {
    it('should match exact single word', async () => {
      const keywords = [createKeyword(1, 'помощь')];
      const result = await service.match('помощь', keywords);

      expect(result).not.toBeNull();
      expect(result!.keyword.uid).toBe(1);
      expect(result!.confidence).toBeGreaterThanOrEqual(0.9);
      expect(result!.method).toBe('levenshtein');
    });

    it('should match with minor typo', async () => {
      const keywords = [createKeyword(1, 'помощь')];
      const result = await service.match('помащь', keywords);

      expect(result).not.toBeNull();
      expect(result!.keyword.uid).toBe(1);
      expect(result!.confidence).toBeGreaterThanOrEqual(0.7);
    });

    it('should match two-word phrase', async () => {
      const keywords = [createKeyword(1, 'подключить тариф')];
      const result = await service.match('подключить тариф', keywords);

      expect(result).not.toBeNull();
      expect(result!.keyword.uid).toBe(1);
      expect(result!.confidence).toBeGreaterThanOrEqual(0.9);
    });

    it('should prefer higher confidence match', async () => {
      const keywords = [
        createKeyword(1, 'помощь'),
        createKeyword(2, 'помощъ'), // intentional similar
      ];
      const result = await service.match('помощь', keywords);

      expect(result).not.toBeNull();
      expect(result!.keyword.uid).toBe(1); // exact match wins
      expect(result!.confidence).toBe(1.0);
    });

    it('should match synonyms', async () => {
      const keywords = [createKeyword(1, 'подключить тариф', ['активировать план', 'включить пакет'])];
      const result = await service.match('включить пакет', keywords);

      expect(result).not.toBeNull();
      expect(result!.keyword.uid).toBe(1);
      expect(result!.matchedPhrase).toBe('включить пакет');
    });
  });

  // ─── Edge Cases ──────────────────────────────────────────

  describe('edge cases', () => {
    it('should return null for empty input', async () => {
      const keywords = [createKeyword(1, 'помощь')];
      const result = await service.match('', keywords);
      expect(result).toBeNull();
    });

    it('should return null for whitespace-only input', async () => {
      const keywords = [createKeyword(1, 'помощь')];
      const result = await service.match('   ', keywords);
      expect(result).toBeNull();
    });

    it('should return null when no keywords', async () => {
      const result = await service.match('помощь', []);
      expect(result).toBeNull();
    });

    it('should return null when confidence below threshold', async () => {
      const keywords = [createKeyword(1, 'бухгалтерия')];
      const result = await service.match('абвгдеж', keywords, [], 0.7);
      expect(result).toBeNull();
    });

    it('should normalize ё → е', async () => {
      const keywords = [createKeyword(1, 'подключение')];
      const result = await service.match('подключёние', keywords);

      expect(result).not.toBeNull();
      expect(result!.keyword.uid).toBe(1);
    });

    it('should strip punctuation', async () => {
      const keywords = [createKeyword(1, 'помощь')];
      const result = await service.match('помощь!', keywords);

      expect(result).not.toBeNull();
      expect(result!.keyword.uid).toBe(1);
    });
  });

  // ─── Synchronous Matching ────────────────────────────────

  describe('matchSync', () => {
    it('should match without async', () => {
      const keywords = [createKeyword(1, 'оператор')];
      const result = service.matchSync('оператор', keywords);

      expect(result).not.toBeNull();
      expect(result!.keyword.uid).toBe(1);
      expect(result!.method).toBe('levenshtein');
    });

    it('should return null for no match', () => {
      const keywords = [createKeyword(1, 'бухгалтерия')];
      const result = service.matchSync('абвгдеж', keywords);
      expect(result).toBeNull();
    });
  });

  // ─── Negative Keywords ───────────────────────────────────

  describe('negative keywords', () => {
    it('should suppress match when semantic router detects negative', async () => {
      // Enable semantic router for negative check
      mockSemanticRouter.isAvailable = true;
      mockSemanticRouter.matchesNegative.mockResolvedValue(true);

      const keywords = [createKeyword(1, 'подключить тариф')];
      const result = await service.match(
        'подключить тариф',
        keywords,
        ['отключить', 'отменить'],
      );

      // Match should be suppressed
      expect(result).toBeNull();
      expect(mockSemanticRouter.matchesNegative).toHaveBeenCalled();
    });

    it('should allow match when no negative detected', async () => {
      mockSemanticRouter.isAvailable = true;
      mockSemanticRouter.matchesNegative.mockResolvedValue(false);

      const keywords = [createKeyword(1, 'подключить тариф')];
      const result = await service.match(
        'подключить тариф',
        keywords,
        ['отключить'],
      );

      expect(result).not.toBeNull();
      expect(result!.keyword.uid).toBe(1);
    });

    it('should skip negative check when no negative phrases provided', async () => {
      mockSemanticRouter.isAvailable = true;

      const keywords = [createKeyword(1, 'помощь')];
      const result = await service.match('помощь', keywords, []);

      expect(result).not.toBeNull();
      expect(mockSemanticRouter.matchesNegative).not.toHaveBeenCalled();
    });
  });

  // ─── Semantic Matching (with mocked router) ──────────────

  describe('semantic matching (long utterance)', () => {
    it('should use semantic matching for >2 word text', async () => {
      mockSemanticRouter.isAvailable = true;
      mockSemanticRouter.findBestMatch.mockResolvedValue({
        phrase: 'помощь специалиста',
        similarity: 0.85,
      });

      const keywords = [createKeyword(1, 'помощь специалиста')];
      const result = await service.match(
        'мне нужна помощь специалиста пожалуйста',
        keywords,
      );

      expect(result).not.toBeNull();
      expect(result!.method).toBe('semantic');
      expect(result!.confidence).toBe(0.85);
      expect(mockSemanticRouter.findBestMatch).toHaveBeenCalled();
    });

    it('should fallback to Levenshtein if semantic returns null', async () => {
      mockSemanticRouter.isAvailable = true;
      mockSemanticRouter.findBestMatch.mockResolvedValue(null);

      const keywords = [createKeyword(1, 'подключить тариф')];
      const result = await service.match(
        'хочу подключить новый тариф',
        keywords,
      );

      // Should fall back to Levenshtein
      if (result) {
        expect(result.method).toBe('levenshtein');
      }
    });
  });
});
