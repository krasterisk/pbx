/**
 * Asterisk dialplan pattern matching.
 *
 *   X  — any digit 0-9
 *   Z  — any digit 1-9
 *   N  — any digit 2-9
 *   .  — one or more of any character (wildcard)
 *   !  — zero or more of any character (wildcard, greedy)
 *
 * Examples:
 *   _1XX     matches 100-199
 *   _NXXX.   matches any 4+ digit number starting with 2-9
 *   _[345]X. matches numbers starting with 3, 4, or 5
 */
export function matchesAsteriskPattern(pattern: string, value: string): boolean {
  if (!pattern.startsWith('_')) {
    return pattern === value;
  }

  const regex = asteriskPatternToRegex(pattern);
  if (!regex) return false;

  return regex.test(value);
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
          regexStr += '[0-9]';
          break;
        case 'Z':
          regexStr += '[1-9]';
          break;
        case 'N':
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
