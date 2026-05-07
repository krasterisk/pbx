import { PhonebooksService } from './phonebooks.service';
import { PhonebookEntry } from './phonebook-entry.model';
import { RoutePhonebook } from './phonebook.model';

/**
 * Unit tests for PhonebooksService.
 *
 * Tests: Asterisk pattern matching, lookup response format,
 * CSV import parsing, var key collection, dialplan generation.
 */
describe('PhonebooksService', () => {
  let service: PhonebooksService;

  beforeEach(() => {
    // Create service with mocked models
    service = new PhonebooksService(
      {} as any, // phonebookModel
      {} as any, // entryModel
    );
  });

  // ═══════════════════════════════════════════════════════════
  // Asterisk Pattern Matching
  // ═══════════════════════════════════════════════════════════

  describe('matchAsteriskPattern', () => {
    const match = (pattern: string, number: string) =>
      (service as any).matchAsteriskPattern(pattern, number);

    // --- Exact match (no pattern) ---
    it('should exact-match when no _ prefix', () => {
      expect(match('101', '101')).toBe(true);
      expect(match('101', '102')).toBe(false);
    });

    // --- X = any digit 0-9 ---
    it('should match _1XX → 100-199', () => {
      expect(match('_1XX', '100')).toBe(true);
      expect(match('_1XX', '123')).toBe(true);
      expect(match('_1XX', '199')).toBe(true);
      expect(match('_1XX', '200')).toBe(false);
      expect(match('_1XX', '099')).toBe(false);
      expect(match('_1XX', '1234')).toBe(false); // too long
      expect(match('_1XX', '10')).toBe(false);   // too short
    });

    // --- Z = 1-9 ---
    it('should match _ZXX → 100-999', () => {
      expect(match('_ZXX', '100')).toBe(true);
      expect(match('_ZXX', '999')).toBe(true);
      expect(match('_ZXX', '000')).toBe(false); // Z excludes 0
      expect(match('_ZXX', '099')).toBe(false);
    });

    // --- N = 2-9 ---
    it('should match _NXX → 200-999', () => {
      expect(match('_NXX', '200')).toBe(true);
      expect(match('_NXX', '999')).toBe(true);
      expect(match('_NXX', '100')).toBe(false); // N excludes 1
      expect(match('_NXX', '000')).toBe(false);
    });

    // --- . = one or more of anything ---
    it('should match _7. → starts with 7, at least 2 chars', () => {
      expect(match('_7.', '71')).toBe(true);
      expect(match('_7.', '79001234567')).toBe(true);
      expect(match('_7.', '7')).toBe(false);   // . requires 1+
      expect(match('_7.', '81')).toBe(false);
    });

    // --- ! = zero or more of anything ---
    it('should match _8! → starts with 8', () => {
      expect(match('_8!', '8')).toBe(true);
      expect(match('_8!', '84951234567')).toBe(true);
      expect(match('_8!', '79001234567')).toBe(false);
    });

    // --- [ranges] ---
    it('should match _[345]XX → 300-599', () => {
      expect(match('_[345]XX', '300')).toBe(true);
      expect(match('_[345]XX', '412')).toBe(true);
      expect(match('_[345]XX', '599')).toBe(true);
      expect(match('_[345]XX', '200')).toBe(false);
      expect(match('_[345]XX', '600')).toBe(false);
    });

    it('should match _[2-5]XX → 200-599', () => {
      expect(match('_[2-5]XX', '200')).toBe(true);
      expect(match('_[2-5]XX', '399')).toBe(true);
      expect(match('_[2-5]XX', '599')).toBe(true);
      expect(match('_[2-5]XX', '100')).toBe(false);
      expect(match('_[2-5]XX', '600')).toBe(false);
    });

    // --- Complex patterns ---
    it('should match Russian mobile _7[89]XXXXXXXXX', () => {
      expect(match('_7[89]XXXXXXXXX', '79001234567')).toBe(true);
      expect(match('_7[89]XXXXXXXXX', '78001234567')).toBe(true);
      expect(match('_7[89]XXXXXXXXX', '77001234567')).toBe(false);
      expect(match('_7[89]XXXXXXXXX', '7900123456')).toBe(false);  // too short
    });

    it('should match _NXXX. for 4+ digit starting with 2-9', () => {
      expect(match('_NXXX.', '20001')).toBe(true);
      expect(match('_NXXX.', '9999')).toBe(false); // . needs 1+ after XXX, total 5+
      expect(match('_NXXX.', '99999')).toBe(true);
      expect(match('_NXXX.', '1000')).toBe(false); // N excludes 1
    });

    // --- Edge cases ---
    it('should handle literal digits in pattern', () => {
      expect(match('_8495XXXXXXX', '84951234567')).toBe(true);
      expect(match('_8495XXXXXXX', '84961234567')).toBe(false);
    });

    it('should return false for invalid pattern', () => {
      expect(match('_[unclosed', '123')).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // asteriskPatternToRegex
  // ═══════════════════════════════════════════════════════════

  describe('asteriskPatternToRegex', () => {
    const toRegex = (pattern: string) =>
      (service as any).asteriskPatternToRegex(pattern);

    it('should convert _1XX to ^1[0-9][0-9]$', () => {
      const re = toRegex('_1XX');
      expect(re).not.toBeNull();
      expect(re!.source).toBe('^1[0-9][0-9]$');
    });

    it('should convert _NXX to ^[2-9][0-9][0-9]$', () => {
      const re = toRegex('_NXX');
      expect(re).not.toBeNull();
      expect(re!.source).toBe('^[2-9][0-9][0-9]$');
    });

    it('should convert _7. to ^7.+$', () => {
      const re = toRegex('_7.');
      expect(re).not.toBeNull();
      expect(re!.source).toBe('^7.+$');
    });

    it('should convert _8! to ^8.*$', () => {
      const re = toRegex('_8!');
      expect(re).not.toBeNull();
      expect(re!.source).toBe('^8.*$');
    });

    it('should return null for unclosed bracket', () => {
      const re = toRegex('_[abc');
      expect(re).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════
  // collectAllVarKeys
  // ═══════════════════════════════════════════════════════════

  describe('collectAllVarKeys', () => {
    it('should collect unique keys sorted', () => {
      const entries = [
        { vars: { name: 'A', clid: '123' } },
        { vars: { name: 'B', dept: 'sales' } },
        { vars: null },
      ] as unknown as PhonebookEntry[];

      const keys = service.collectAllVarKeys(entries);
      expect(keys).toEqual(['clid', 'dept', 'name']);
    });

    it('should return empty for no vars', () => {
      const entries = [
        { vars: null },
        { vars: null },
      ] as unknown as PhonebookEntry[];

      expect(service.collectAllVarKeys(entries)).toEqual([]);
    });

    it('should return empty for empty entries', () => {
      expect(service.collectAllVarKeys([])).toEqual([]);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // CSV Import Parsing (via detectSeparator)
  // ═══════════════════════════════════════════════════════════

  describe('detectSeparator', () => {
    const detect = (line: string) =>
      (service as any).detectSeparator(line);

    it('should detect semicolons', () => {
      expect(detect('number;comment;name')).toBe(';');
    });

    it('should detect commas', () => {
      expect(detect('number,comment,name')).toBe(',');
    });

    it('should detect tabs', () => {
      expect(detect('number\tcomment\tname')).toBe('\t');
    });

    it('should detect pipes', () => {
      expect(detect('number|comment|name')).toBe('|');
    });

    it('should default to comma', () => {
      expect(detect('number')).toBe(',');
    });
  });

  // ═══════════════════════════════════════════════════════════
  // generateDialplan
  // ═══════════════════════════════════════════════════════════

  describe('generateDialplan', () => {
    it('should generate CURL-based dialplan with PB_* vars', () => {
      const phonebook = {
        uid: 5,
        name: 'VIP',
        invert: 0,
        actions: [
          { type: 'hangup', params: {} },
        ],
        entries: [
          { vars: { name: 'A', clid: '123' } },
          { vars: { name: 'B' } },
        ],
      } as unknown as RoutePhonebook;

      const dp = service.generateDialplan(phonebook, 100, false);

      // Check context name
      expect(dp).toContain('[phonebook_check_5_100]');
      // Check CURL call
      expect(dp).toContain('CURL(');
      expect(dp).toContain('phonebook-lookup');
      expect(dp).toContain('phonebook_uid=5');
      // Check CUT for PB_* vars
      expect(dp).toContain('Set(PB_clid=');
      expect(dp).toContain('Set(PB_name=');
      // Check CUT positions (sorted: clid=3, name=5)
      expect(dp).toContain('CUT(PB_RAW,|,3)');
      expect(dp).toContain('CUT(PB_RAW,|,5)');
      // Check match/nomatch labels
      expect(dp).toContain('n(match),NoOp');
      expect(dp).toContain('n(nomatch),Return()');
      // Check actions rendered
      expect(dp).toContain('Hangup()');
    });

    it('should invert match/nomatch when invert=1', () => {
      const phonebook = {
        uid: 1,
        name: 'Whitelist',
        invert: 1,
        actions: [],
        entries: [],
      } as unknown as RoutePhonebook;

      const dp = service.generateDialplan(phonebook, 100, false);

      // invert: match=1 should go to nomatch label
      expect(dp).toContain('= "1"]?nomatch:match');
    });

    it('should handle empty entries (no CUT lines)', () => {
      const phonebook = {
        uid: 2,
        name: 'Empty',
        invert: 0,
        actions: [],
        entries: [],
      } as unknown as RoutePhonebook;

      const dp = service.generateDialplan(phonebook, 100, false);

      // PB_MATCH CUT is always present, but no PB_<key> lines
      expect(dp).toContain('CUT(PB_RAW,|,1)'); // PB_MATCH is always parsed
      expect(dp).not.toMatch(/Set\(PB_[a-z]/); // no PB_<varname> lines
      expect(dp).toContain('Return()');
    });

    it('should handle graceful fallback when backend unreachable', () => {
      const phonebook = {
        uid: 3,
        name: 'Test',
        invert: 0,
        actions: [],
        entries: [],
      } as unknown as RoutePhonebook;

      const dp = service.generateDialplan(phonebook, 100, false);

      // Should check for empty PB_RAW
      expect(dp).toContain('GotoIf($["${PB_RAW}" = ""]?nomatch)');
    });
  });
});
