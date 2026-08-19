import { parseOptions, serializeOptions } from './dialplan-options.util';

describe('parseOptions / serializeOptions (D-27)', () => {
  it.each([
    'tT',
    'U(sub-x)',
    'L(60000:30000:10000)',
    'nU(a,b)M(c)',
    'zzz',
    '',
  ])('round-trips %j', (s) => {
    expect(serializeOptions(parseOptions(s))).toBe(s);
  });

  it('keeps unknown single-letter flags', () => {
    const parsed = parseOptions('tX');
    expect(parsed.tokens).toEqual(['t', 'X']);
    expect(serializeOptions(parsed)).toBe('tX');
  });

  it('keeps parameterized U/L in original order', () => {
    expect(parseOptions('tTU(x)L(1:2:3)m').tokens).toEqual(['t', 'T', 'U(x)', 'L(1:2:3)', 'm']);
  });
});
