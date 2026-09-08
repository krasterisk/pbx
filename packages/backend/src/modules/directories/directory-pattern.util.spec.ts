import {
  compareAsteriskExten,
  isAsteriskPattern,
  matchesAsteriskPattern,
  pickBestAsteriskMatch,
} from './directory-pattern.util';

describe('matchesAsteriskPattern', () => {
  it('matches _1XX against 123', () => {
    expect(matchesAsteriskPattern('_1XX', '123')).toBe(true);
  });

  it('rejects _NXX against 123', () => {
    expect(matchesAsteriskPattern('_NXX', '123')).toBe(false);
  });

  it('matches _[34]X. against 3123', () => {
    expect(matchesAsteriskPattern('_[34]X.', '3123')).toBe(true);
  });

  it('rejects an unclosed bracket pattern', () => {
    expect(matchesAsteriskPattern('_[34', '3123')).toBe(false);
  });
});

describe('compareAsteriskExten', () => {
  it('treats a leading underscore as a pattern', () => {
    expect(isAsteriskPattern('_7900XXXXXXX')).toBe(true);
    expect(isAsteriskPattern('79001234567')).toBe(false);
  });

  it('ranks an exact exten ahead of any pattern', () => {
    expect(compareAsteriskExten('79001234567', '_79001234567')).toBeLessThan(0);
    expect(compareAsteriskExten('_79001234567', '79001234567')).toBeGreaterThan(0);
  });

  it('picks the narrower CallerID range the way Asterisk does', () => {
    // First differing token: '1' is more specific than X.
    expect(compareAsteriskExten('_7900123XXXX', '_7900XXXXXXX')).toBeLessThan(0);
  });

  it('compares left to right, not by wildcard count', () => {
    // Asterisk comment in pbx.c: 1XXXXX beats X11111 because '1' beats 'X'.
    expect(compareAsteriskExten('_1XXXXX', '_X11111')).toBeLessThan(0);
  });

  it('ranks N ahead of Z ahead of X', () => {
    expect(compareAsteriskExten('_NXX', '_ZXX')).toBeLessThan(0);
    expect(compareAsteriskExten('_ZXX', '_XXX')).toBeLessThan(0);
  });

  it('ranks a smaller character class ahead of a larger one', () => {
    expect(compareAsteriskExten('_[5-9]X', '_[2-8]X')).toBeLessThan(0);
  });

  it('treats identical pattern text as equal', () => {
    expect(compareAsteriskExten('_7900XXXXXXX', '_7900XXXXXXX')).toBe(0);
  });
});

describe('pickBestAsteriskMatch', () => {
  it('returns the most specific matching pattern for a typical CallerID list', () => {
    const rows = [
      { name: 'Иван', pattern: '79001234568' },
      { name: 'Билайн', pattern: '_7900123XXXX' },
      { name: 'Ростелеком', pattern: '_7900XXXXXXX' },
    ];

    expect(
      pickBestAsteriskMatch(rows, (row) => row.pattern, '79001234567')?.name,
    ).toBe('Билайн');
    expect(
      pickBestAsteriskMatch(rows, (row) => row.pattern, '79001234568')?.name,
    ).toBe('Иван');
    expect(
      pickBestAsteriskMatch(rows, (row) => row.pattern, '79009999999')?.name,
    ).toBe('Ростелеком');
  });
});
