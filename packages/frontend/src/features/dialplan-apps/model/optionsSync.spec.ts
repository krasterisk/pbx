import { describe, it, expect } from 'vitest';
import { OPTIONS_ROUNDTRIP_STRINGS } from '@krasterisk/shared';
import { parseOptions, serializeOptions, isOptionsParseError } from './optionsSync';

describe('optionsSync', () => {
  it.each([...OPTIONS_ROUNDTRIP_STRINGS])('round-trips %j', (s) => {
    expect(serializeOptions(parseOptions(s))).toBe(s);
  });

  it('keeps U(...) M(...) L(x:y:z) in original order', () => {
    expect(parseOptions('tTU(x)L(1:2:3)m').tokens).toEqual(['t', 'T', 'U(x)', 'L(1:2:3)', 'm']);
  });

  it('flags an unclosed parenthesis as a parse error', () => {
    expect(isOptionsParseError('U(x')).toBe(true);
    expect(isOptionsParseError('tTU(sub-x)m')).toBe(false);
  });
});
