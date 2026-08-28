import { matchesAsteriskPattern } from './directory-pattern.util';

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
