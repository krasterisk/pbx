/**
 * Asterisk dialplan pattern matching and specificity.
 *
 * Source: asterisk/main/pbx.c — `_extension_match_core`, `ext_cmp`,
 * `ext_cmp_pattern`, `ext_cmp_pattern_pos`.
 *
 * A value that does not start with `_` is an exact exten. A leading `_`
 * starts a pattern. Among matching patterns Asterisk walks left to right
 * and picks the more specific token at the first difference:
 * a literal beats N/Z/X, a smaller character class beats a larger one,
 * and `.` / `!` are the least specific. `_1XXXXX` therefore beats
 * `_X11111` even though the latter has fewer wildcards overall.
 *
 *   X  — digit 0-9
 *   Z  — digit 1-9
 *   N  — digit 2-9
 *   .  — one or more of any character
 *   !  — zero or more of any character
 */

export function isAsteriskPattern(value: string): boolean {
  return value.startsWith('_');
}

export function matchesAsteriskPattern(pattern: string, value: string): boolean {
  if (!isAsteriskPattern(pattern)) {
    return pattern === value;
  }

  const regex = asteriskPatternToRegex(pattern);
  if (!regex) return false;

  return regex.test(value);
}

/**
 * Sort key used by Asterisk when several extens could match.
 * Negative means `left` is more specific (or a non-pattern vs a pattern).
 */
export function compareAsteriskExten(left: string, right: string): number {
  if (!isAsteriskPattern(left)) {
    if (isAsteriskPattern(right)) return -1;
    return left < right ? -1 : left > right ? 1 : 0;
  }
  if (!isAsteriskPattern(right)) return 1;
  return compareAsteriskPattern(left.slice(1), right.slice(1));
}

export function pickBestAsteriskMatch<T>(
  items: T[],
  getPattern: (item: T) => string,
  value: string,
): T | undefined {
  const matched = items.filter((item) => matchesAsteriskPattern(getPattern(item), value));
  if (!matched.length) return undefined;
  matched.sort((a, b) => compareAsteriskExten(getPattern(a), getPattern(b)));
  return matched[0];
}

function asteriskPatternToRegex(pattern: string): RegExp | null {
  try {
    const body = pattern.substring(1);
    let regexStr = '^';
    let i = 0;

    while (i < body.length) {
      const ch = body[i];
      switch (ch) {
        case 'X':
        case 'x':
          regexStr += '[0-9]';
          break;
        case 'Z':
        case 'z':
          regexStr += '[1-9]';
          break;
        case 'N':
        case 'n':
          regexStr += '[2-9]';
          break;
        case '.':
          regexStr += '.+';
          break;
        case '!':
          regexStr += '.*';
          break;
        case '[': {
          const closeBracket = body.indexOf(']', i);
          if (closeBracket === -1) return null;
          regexStr += body.substring(i, closeBracket + 1);
          i = closeBracket;
          break;
        }
        default:
          regexStr += ch.replace(/[.*+?^${}()|\\]/g, '\\$&');
      }
      i++;
    }

    regexStr += '$';
    return new RegExp(regexStr);
  } catch {
    return null;
  }
}

const BITS_PER = 8;
const SCORE_END = 0x30000;

function compareAsteriskPattern(left: string, right: string): number {
  let leftIndex = 0;
  let rightIndex = 0;

  for (;;) {
    const leftPos = patternPos(left, leftIndex);
    const rightPos = patternPos(right, rightIndex);
    let cmp = leftPos.score - rightPos.score;
    if (!cmp) {
      // Asterisk memcmp's the right set against the left set when scores tie.
      cmp = compareBits(rightPos.bits, leftPos.bits);
    }
    if (cmp) return cmp < 0 ? -1 : 1;
    if (leftPos.next == null && rightPos.next == null) return 0;
    leftIndex = leftPos.next ?? left.length + 1;
    rightIndex = rightPos.next ?? right.length + 1;
  }
}

function patternPos(
  pattern: string,
  start: number,
): { score: number; bits: Uint8Array; next: number | null } {
  const bits = new Uint8Array(32);
  let i = start;

  for (;;) {
    while (i < pattern.length && pattern[i] === '-') i += 1;
    if (i >= pattern.length) {
      return { score: SCORE_END, bits, next: null };
    }

    const ch = pattern[i];
    i += 1;
    const upper = ch.toUpperCase();

    if (upper === 'N') {
      bits[6] = 0x3f;
      bits[7] = 0xc0;
      return { score: 0x0800 | '2'.charCodeAt(0), bits, next: i };
    }
    if (upper === 'X') {
      bits[6] = 0xff;
      bits[7] = 0xc0;
      return { score: 0x0a00 | '0'.charCodeAt(0), bits, next: i };
    }
    if (upper === 'Z') {
      bits[6] = 0x7f;
      bits[7] = 0xc0;
      return { score: 0x0900 | '1'.charCodeAt(0), bits, next: i };
    }
    if (ch === '.') return { score: 0x18000, bits, next: i };
    if (ch === '!') return { score: 0x28000, bits, next: i };

    if (ch === '[') {
      const end = pattern.indexOf(']', i);
      if (end === -1) return { score: 0x40000, bits, next: i };

      let count = 0;
      let cmin = 0xff;
      let cursor = i;
      while (cursor < end) {
        let from = pattern.charCodeAt(cursor);
        let to = from;
        if (cursor + 2 < end && pattern[cursor + 1] === '-') {
          to = pattern.charCodeAt(cursor + 2);
          cursor += 3;
        } else {
          cursor += 1;
        }
        if (from < cmin) cmin = from;
        for (let code = from; code <= to; code++) {
          const mask = 1 << ((BITS_PER - 1) - (code % BITS_PER));
          const bucket = Math.floor(code / BITS_PER);
          if (!(bits[bucket] & mask)) {
            bits[bucket] |= mask;
            count += 0x100;
          }
        }
      }

      if (count === 0) {
        i = end + 1;
        continue;
      }
      return { score: count | cmin, bits, next: end + 1 };
    }

    const code = ch.charCodeAt(0);
    bits[Math.floor(code / BITS_PER)] = 1 << ((BITS_PER - 1) - (code % BITS_PER));
    return { score: 0x0100 | code, bits, next: i };
  }
}

function compareBits(left: Uint8Array, right: Uint8Array): number {
  for (let i = 0; i < left.length; i++) {
    if (left[i] !== right[i]) return left[i] - right[i];
  }
  return 0;
}
