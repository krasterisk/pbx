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
  // generateBindingDialplan (D-06, D-17, D-24) — per-binding dialplan generation
  // ═══════════════════════════════════════════════════════════

  describe('generateBindingDialplan', () => {
    const phonebook = {
      uid: 5,
      name: 'VIP',
      entries: [
        { vars: { name: 'A', clid: '123' } },
        { vars: { name: 'B' } },
      ],
    } as unknown as RoutePhonebook;

    const baseBinding = (overrides: Record<string, any> = {}) => ({
      uid: 42,
      behavior_type: 'set_name',
      match_mode: 'on_match',
      behavior_params: null,
      actions: null,
      ...overrides,
    }) as any;

    it('generates a pb_bind_ context with CURL lookup, GotoIf branch, and Set(PB_*) only in the match branch', () => {
      const binding = baseBinding();
      const result = service.generateBindingDialplan(binding, phonebook, 100, 'sip-in100', false);
      const joined = result.lines.join('\n');

      expect(result.name).toBe('pb_bind_42_100');
      expect(result.lines[0]).toBe('[pb_bind_42_100]');
      expect(joined).toContain('CURL(');
      expect(joined).toContain('phonebook-lookup');
      expect(joined).toContain('phonebook_uid=5');
      expect(joined).toContain('GotoIf($["${PB_MATCH}" = "1"]?act:nomatch)');
      expect(joined).toContain('n(act),NoOp');
      // Sorted var keys: clid=3, name=5
      expect(joined).toContain('Set(PB_clid=${CUT(PB_RAW,|,3)})');
      expect(joined).toContain('Set(PB_name=${CUT(PB_RAW,|,5)})');
      expect(joined).toContain('ExecIf($["${PB_name}" != ""]?Set(CALLERID(name)=${PB_name}))');
      expect(result.lines[result.lines.length - 2]).toBe('same => n,Return()');
      expect(result.lines[result.lines.length - 1]).toBe('same => n(nomatch),Return()');
    });

    it('inverts GotoIf and omits Set(PB_<key>) lines for match_mode=on_no_match (D-24)', () => {
      const binding = baseBinding({ match_mode: 'on_no_match', behavior_type: 'blacklist' });
      const result = service.generateBindingDialplan(binding, phonebook, 100, 'sip-in100', false);
      const joined = result.lines.join('\n');

      expect(joined).toContain('GotoIf($["${PB_MATCH}" = "1"]?nomatch:act)');
      expect(joined).not.toMatch(/Set\(PB_[a-z]/);
      expect(joined).toContain('Hangup()');
    });

    it('handles empty entries (no PB_<key> Set lines)', () => {
      const emptyPb = { uid: 9, name: 'Empty', entries: [] } as unknown as RoutePhonebook;
      const binding = baseBinding({ behavior_type: 'vars_only' });
      const result = service.generateBindingDialplan(binding, emptyPb, 100, 'sip-in100', false);
      const joined = result.lines.join('\n');

      expect(joined).toContain('CUT(PB_RAW,|,1)'); // PB_MATCH always parsed
      expect(joined).not.toMatch(/Set\(PB_[a-z]/);
    });

    it('handles graceful fallback when backend is unreachable (empty PB_RAW)', () => {
      const binding = baseBinding();
      const result = service.generateBindingDialplan(binding, phonebook, 100, 'sip-in100', false);
      expect(result.lines.join('\n')).toContain('GotoIf($["${PB_RAW}" = ""]?nomatch)');
    });

    describe('behavior presets', () => {
      it('set_number with a fixed value sets CALLERID(num) directly', () => {
        const binding = baseBinding({ behavior_type: 'set_number', behavior_params: { fixed: '100' } });
        const result = service.generateBindingDialplan(binding, phonebook, 100, 'sip-in100', false);
        expect(result.lines.join('\n')).toContain('Set(CALLERID(num)=100)');
      });

      it('set_number with a var_key uses ExecIf', () => {
        const binding = baseBinding({ behavior_type: 'set_number', behavior_params: { var_key: 'clid' } });
        const result = service.generateBindingDialplan(binding, phonebook, 100, 'sip-in100', false);
        expect(result.lines.join('\n')).toContain('ExecIf($["${PB_clid}" != ""]?Set(CALLERID(num)=${PB_clid}))');
      });

      it('blacklist emits Hangup()', () => {
        const binding = baseBinding({ behavior_type: 'blacklist' });
        const result = service.generateBindingDialplan(binding, phonebook, 100, 'sip-in100', false);
        expect(result.lines.join('\n')).toContain('Hangup()');
      });

      it('whitelist also emits Hangup() (UI is expected to force match_mode=on_no_match)', () => {
        const binding = baseBinding({ behavior_type: 'whitelist', match_mode: 'on_no_match' });
        const result = service.generateBindingDialplan(binding, phonebook, 100, 'sip-in100', false);
        expect(result.lines.join('\n')).toContain('Hangup()');
      });

      it('redirect with fixed_exten emits a direct Goto', () => {
        const binding = baseBinding({ behavior_type: 'redirect', behavior_params: { fixed_exten: '200' } });
        const result = service.generateBindingDialplan(binding, phonebook, 100, 'sip-in100', false);
        expect(result.lines.join('\n')).toContain('Goto(sip-in100,200,1)');
      });

      it('redirect with var_key emits ExecIf Goto against the route tenanted context', () => {
        const binding = baseBinding({ behavior_type: 'redirect', behavior_params: {} });
        const result = service.generateBindingDialplan(binding, phonebook, 100, 'sip-in100', false);
        expect(result.lines.join('\n')).toContain('ExecIf($["${PB_redirect}" != ""]?Goto(sip-in100,${PB_redirect},1))');
      });

      it('custom renders each action via actionToDialplan', () => {
        const binding = baseBinding({
          behavior_type: 'custom',
          actions: [{ id: 'a1', type: 'hangup', params: {}, condition: {} }],
        });
        const result = service.generateBindingDialplan(binding, phonebook, 100, 'sip-in100', false);
        expect(result.lines.join('\n')).toContain('Hangup()');
      });

      it('vars_only emits no behavior lines', () => {
        const binding = baseBinding({ behavior_type: 'vars_only' });
        const result = service.generateBindingDialplan(binding, phonebook, 100, 'sip-in100', false);
        const joined = result.lines.join('\n');
        // Base CURL/match/Set(PB_*) lines are always present; vars_only adds nothing beyond them.
        expect(joined).not.toContain('Hangup()');
        expect(joined).not.toContain('Goto(');
        expect(joined).not.toContain('CALLERID(name)');
      });
    });
  });
});
