import {
  AGENT_HOTKEY_ACTIONS,
  DEFAULT_AGENT_HOTKEYS,
  describeHotkey,
  eventToHotkey,
  findHotkeyAction,
  matchHotkey,
  normalizeHotkey,
  resolveAgentHotkeys,
  validateHotkeyMap,
  type HotkeyEventLike,
} from './hotkeys';

const ev = (over: Partial<HotkeyEventLike>): HotkeyEventLike => ({
  code: 'KeyA',
  key: 'a',
  altKey: false,
  shiftKey: false,
  ctrlKey: false,
  metaKey: false,
  ...over,
});

describe('callcenter-hotkeys (U2.4 / U5.6)', () => {
  it('default set is valid, has no Alt+D/E/F and covers every action', () => {
    expect(validateHotkeyMap({ ...DEFAULT_AGENT_HOTKEYS }).valid).toBe(true);
    expect(Object.keys(DEFAULT_AGENT_HOTKEYS).sort()).toEqual([...AGENT_HOTKEY_ACTIONS].sort());
    const combos = Object.values(DEFAULT_AGENT_HOTKEYS);
    for (const reserved of ['Alt+KeyD', 'Alt+KeyE', 'Alt+KeyF']) {
      expect(combos).not.toContain(reserved);
    }
  });

  it('matches by KeyboardEvent.code, so the Russian layout (key = "ф") still works', () => {
    expect(matchHotkey(ev({ code: 'KeyA', key: 'ф', altKey: true }), 'Alt+KeyA')).toBe(true);
    expect(matchHotkey(ev({ code: 'KeyB', key: 'и', altKey: true }), 'Alt+KeyA')).toBe(false);
  });

  it('ignores AltGr (Ctrl+Alt), Ctrl/Meta chords, key repeat and lone modifiers', () => {
    expect(matchHotkey(ev({ altKey: true, ctrlKey: true }), 'Alt+KeyA')).toBe(false);
    expect(matchHotkey(ev({ altKey: true, metaKey: true }), 'Alt+KeyA')).toBe(false);
    expect(matchHotkey(ev({ altKey: true, repeat: true }), 'Alt+KeyA')).toBe(false);
    expect(eventToHotkey(ev({ code: 'AltLeft', altKey: true }))).toBeNull();
  });

  it('help combo also matches the "?" character', () => {
    expect(matchHotkey(ev({ code: 'Slash', key: '?', shiftKey: true }), 'Shift+Slash')).toBe(true);
    expect(matchHotkey(ev({ code: 'Digit7', key: '?', shiftKey: true }), 'Shift+Slash')).toBe(true);
    expect(matchHotkey(ev({ code: 'Digit7', key: '/', shiftKey: true }), 'Shift+Slash')).toBe(false);
  });

  it('normalises modifier order and rejects bad formats', () => {
    expect(normalizeHotkey('Shift+Alt+KeyA')).toBe('Alt+Shift+KeyA');
    expect(normalizeHotkey('Alt+a')).toBeNull();
    expect(normalizeHotkey('KeyA')).toBeNull();
    expect(normalizeHotkey('Ctrl+KeyA')).toBeNull();
  });

  it('rejects reserved combos, duplicates, unknown actions and combos without Alt', () => {
    const res = validateHotkeyMap({
      answer: 'Alt+KeyD',
      hangup: 'Alt+F4',
      mute: 'Alt+KeyM',
      hold: 'Alt+KeyM',
      transfer: 'KeyT',
      bogus: 'Alt+KeyZ',
    });
    expect(res.valid).toBe(false);
    const byAction = Object.fromEntries(res.issues.map((i) => [i.action, i.code]));
    expect(byAction).toEqual({
      answer: 'reserved',
      hangup: 'reserved',
      hold: 'duplicate',
      transfer: 'format',
      bogus: 'unknown_action',
    });
  });

  it('resolveAgentHotkeys: null -> defaults, valid override wins, invalid override is ignored', () => {
    expect(resolveAgentHotkeys(null)).toEqual(DEFAULT_AGENT_HOTKEYS);
    expect(resolveAgentHotkeys({ answer: 'Alt+KeyY' }).answer).toBe('Alt+KeyY');
    const withBad = resolveAgentHotkeys({ answer: 'Alt+KeyD', hangup: 'Alt+KeyJ' });
    expect(withBad.answer).toBe(DEFAULT_AGENT_HOTKEYS.answer);
    expect(withBad.hangup).toBe('Alt+KeyJ');
    // collides with default "mute" (Alt+KeyM) -> whole override falls back safely
    const collide = resolveAgentHotkeys({ answer: 'Alt+KeyM' });
    expect(validateHotkeyMap(collide).valid).toBe(true);
  });

  it('findHotkeyAction resolves the action for an event', () => {
    expect(findHotkeyAction(ev({ code: 'KeyW', key: 'ц', altKey: true }), DEFAULT_AGENT_HOTKEYS)).toBe(
      'finishWrapup',
    );
    expect(findHotkeyAction(ev({ code: 'KeyQ', altKey: true }), DEFAULT_AGENT_HOTKEYS)).toBeNull();
  });

  it('describeHotkey is human readable', () => {
    expect(describeHotkey('Alt+KeyA')).toBe('Alt+A');
    expect(describeHotkey('Shift+Slash')).toBe('Shift+/');
  });
});
