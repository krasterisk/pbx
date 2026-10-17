/**
 * Agent workspace hotkeys (cc-ux U2.4 / U5.6).
 *
 * A combo is stored as `Alt+KeyA` / `Alt+Shift+Digit1` / `Shift+Slash`: modifiers in the fixed order
 * `Alt`, `Shift`, then a `KeyboardEvent.code`. `code` (not `key`) is used so the same combo works in
 * the Russian layout, where `key` for the A position is "ф".
 *
 * Pure TypeScript with no DOM dependency: shared by the backend DTO validation and the frontend.
 */

export const AGENT_HOTKEY_ACTIONS = [
  'answer',
  'hangup',
  'mute',
  'hold',
  'transfer',
  'pauseToggle',
  'finishWrapup',
  'help',
] as const;

export type AgentHotkeyAction = (typeof AGENT_HOTKEY_ACTIONS)[number];

export type AgentHotkeyMap = Record<AgentHotkeyAction, string>;

export const DEFAULT_AGENT_HOTKEYS: Readonly<AgentHotkeyMap> = Object.freeze({
  answer: 'Alt+KeyA',
  hangup: 'Alt+KeyH',
  mute: 'Alt+KeyM',
  hold: 'Alt+KeyU',
  transfer: 'Alt+KeyT',
  pauseToggle: 'Alt+KeyP',
  finishWrapup: 'Alt+KeyW',
  help: 'Shift+Slash',
});

export type HotkeyIssueCode = 'unknown_action' | 'format' | 'reserved' | 'duplicate';

export interface HotkeyIssue {
  action: string;
  combo: string;
  code: HotkeyIssueCode;
}

export interface HotkeyValidation {
  valid: boolean;
  issues: HotkeyIssue[];
}

/** Combos the browser or OS handles before the page sees them (Windows Chrome/Edge in particular). */
export const RESERVED_HOTKEYS: readonly string[] = [
  'Alt+KeyD', // address bar
  'Alt+KeyE', // browser menu
  'Alt+KeyF', // browser menu
  'Alt+F4',
  'Alt+Tab',
  'Alt+Space',
  'Alt+Home',
  'Alt+ArrowLeft',
  'Alt+ArrowRight',
];

const MODIFIER_CODES = new Set([
  'AltLeft',
  'AltRight',
  'ShiftLeft',
  'ShiftRight',
  'ControlLeft',
  'ControlRight',
  'MetaLeft',
  'MetaRight',
  'OSLeft',
  'OSRight',
]);

const MAIN_CODE_RE =
  /^(Key[A-Z]|Digit[0-9]|F([1-9]|1[0-2])|Slash|Comma|Period|Semicolon|Quote|Backquote|BracketLeft|BracketRight|Backslash|Minus|Equal|Space|Tab|Home|ArrowLeft|ArrowRight|ArrowUp|ArrowDown)$/;

export interface ParsedHotkey {
  alt: boolean;
  shift: boolean;
  code: string;
}

export function parseHotkey(combo: string): ParsedHotkey | null {
  if (typeof combo !== 'string') return null;
  const parts = combo.trim().split('+');
  if (parts.length < 2 || parts.length > 3) {
    return null;
  }
  const code = parts[parts.length - 1];
  if (!MAIN_CODE_RE.test(code)) return null;
  const mods = parts.slice(0, -1);
  let alt = false;
  let shift = false;
  for (const m of mods) {
    if (m === 'Alt') {
      if (alt) return null;
      alt = true;
    } else if (m === 'Shift') {
      if (shift) return null;
      shift = true;
    } else {
      return null;
    }
  }
  return { alt, shift, code };
}

export function formatHotkey(parsed: ParsedHotkey): string {
  const parts: string[] = [];
  if (parsed.alt) parts.push('Alt');
  if (parsed.shift) parts.push('Shift');
  parts.push(parsed.code);
  return parts.join('+');
}

/** Canonical spelling (`Shift+Alt+KeyA` -> `Alt+Shift+KeyA`) or `null` when the format is invalid. */
export function normalizeHotkey(combo: string): string | null {
  const parsed = parseHotkey(combo);
  return parsed ? formatHotkey(parsed) : null;
}

/** Every combo needs `Alt`; the only exception is the help combo `Shift+Slash` ("?"). */
function hasRequiredModifier(parsed: ParsedHotkey): boolean {
  return parsed.alt || (parsed.shift && parsed.code === 'Slash');
}

export function isReservedHotkey(combo: string): boolean {
  const norm = normalizeHotkey(combo);
  return norm != null && RESERVED_HOTKEYS.includes(norm);
}

export function validateHotkeyMap(map: Partial<Record<string, unknown>>): HotkeyValidation {
  const issues: HotkeyIssue[] = [];
  const seen = new Map<string, string>();

  for (const [action, raw] of Object.entries(map)) {
    const combo = typeof raw === 'string' ? raw : String(raw ?? '');
    if (!(AGENT_HOTKEY_ACTIONS as readonly string[]).includes(action)) {
      issues.push({ action, combo, code: 'unknown_action' });
      continue;
    }
    const parsed = parseHotkey(combo);
    if (!parsed || !hasRequiredModifier(parsed)) {
      issues.push({ action, combo, code: 'format' });
      continue;
    }
    const norm = formatHotkey(parsed);
    if (RESERVED_HOTKEYS.includes(norm)) {
      issues.push({ action, combo, code: 'reserved' });
      continue;
    }
    if (seen.has(norm)) {
      issues.push({ action, combo, code: 'duplicate' });
      continue;
    }
    seen.set(norm, action);
  }

  return { valid: issues.length === 0, issues };
}

/**
 * Effective map: defaults overridden by valid custom entries. Anything invalid, duplicated or reserved is ignored
 * so a bad tenant value can never break the agent workspace.
 */
export function resolveAgentHotkeys(custom: unknown): AgentHotkeyMap {
  const result: AgentHotkeyMap = { ...DEFAULT_AGENT_HOTKEYS };
  if (!custom || typeof custom !== 'object' || Array.isArray(custom)) return result;

  const candidate: Partial<AgentHotkeyMap> = {};
  for (const action of AGENT_HOTKEY_ACTIONS) {
    const raw = (custom as Record<string, unknown>)[action];
    if (typeof raw === 'string') candidate[action] = raw;
  }
  const merged: AgentHotkeyMap = { ...result, ...candidate };
  const { issues } = validateHotkeyMap(merged);
  if (issues.length === 0) {
    for (const action of AGENT_HOTKEY_ACTIONS) {
      result[action] = normalizeHotkey(merged[action]) ?? DEFAULT_AGENT_HOTKEYS[action];
    }
    return result;
  }
  // Keep only the entries that are valid on their own and do not collide with the final map.
  const bad = new Set(issues.map((i) => i.action));
  for (const action of AGENT_HOTKEY_ACTIONS) {
    if (candidate[action] != null && !bad.has(action)) {
      result[action] = normalizeHotkey(candidate[action] as string) ?? DEFAULT_AGENT_HOTKEYS[action];
    }
  }
  return validateHotkeyMap(result).valid ? result : { ...DEFAULT_AGENT_HOTKEYS };
}

export interface HotkeyEventLike {
  code: string;
  key?: string;
  altKey: boolean;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  repeat?: boolean;
}

/**
 * Canonical combo for a keyboard event, or `null` when it cannot be a hotkey:
 * a lone modifier, any Ctrl/Meta chord, and `Ctrl+Alt` (AltGr on Windows).
 */
export function eventToHotkey(e: HotkeyEventLike): string | null {
  if (e.ctrlKey || e.metaKey) return null;
  if (!e.code || MODIFIER_CODES.has(e.code)) return null;
  if (!MAIN_CODE_RE.test(e.code)) return null;
  if (!e.altKey && !e.shiftKey) return null;
  return formatHotkey({ alt: e.altKey, shift: e.shiftKey, code: e.code });
}

/** `true` when the event triggers `combo`. The "?" help combo also matches by `key` (layouts differ). */
export function matchHotkey(e: HotkeyEventLike, combo: string): boolean {
  if (e.repeat) return false;
  const norm = normalizeHotkey(combo);
  if (!norm) return false;
  if (eventToHotkey(e) === norm) return true;
  return norm === 'Shift+Slash' && !e.ctrlKey && !e.metaKey && !e.altKey && e.key === '?';
}

/** First action in the map whose combo matches the event. */
export function findHotkeyAction(
  e: HotkeyEventLike,
  map: Readonly<AgentHotkeyMap>,
): AgentHotkeyAction | null {
  for (const action of AGENT_HOTKEY_ACTIONS) {
    if (matchHotkey(e, map[action])) return action;
  }
  return null;
}

/** Human label for a combo: `Alt+KeyA` -> `Alt+A`, `Shift+Slash` -> `Shift+/`. */
export function describeHotkey(combo: string): string {
  const parsed = parseHotkey(combo);
  if (!parsed) return combo;
  const { code } = parsed;
  let label = code;
  if (/^Key[A-Z]$/.test(code)) label = code.slice(3);
  else if (/^Digit[0-9]$/.test(code)) label = code.slice(5);
  else {
    const named: Record<string, string> = {
      Slash: '/',
      Comma: ',',
      Period: '.',
      Semicolon: ';',
      Quote: "'",
      Backquote: '`',
      BracketLeft: '[',
      BracketRight: ']',
      Backslash: '\\',
      Minus: '-',
      Equal: '=',
      Space: 'Space',
      ArrowLeft: '←',
      ArrowRight: '→',
      ArrowUp: '↑',
      ArrowDown: '↓',
    };
    label = named[code] ?? code;
  }
  const parts: string[] = [];
  if (parsed.alt) parts.push('Alt');
  if (parsed.shift) parts.push('Shift');
  parts.push(label);
  return parts.join('+');
}
