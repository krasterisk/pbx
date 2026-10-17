import { describe, expect, it } from 'vitest';
import { pauseLimitState } from './pauseLimit';

describe('pauseLimitState (U2.7)', () => {
  it('has no limit when max_duration is 0 or missing', () => {
    expect(pauseLimitState(999, 0).level).toBe('none');
    expect(pauseLimitState(999, undefined).level).toBe('none');
  });

  it('is ok until one minute before the limit', () => {
    expect(pauseLimitState(0, 10).level).toBe('ok');
    expect(pauseLimitState(8 * 60 + 59, 10).level).toBe('ok');
  });

  it('warns at 9:01 of a 10 minute limit (and from 9:00)', () => {
    expect(pauseLimitState(9 * 60 + 1, 10)).toMatchObject({ level: 'warn', remainingSec: 59 });
    expect(pauseLimitState(9 * 60, 10).level).toBe('warn');
    expect(pauseLimitState(10 * 60, 10).level).toBe('warn');
  });

  it('is over the limit at 10:30 with +0:30', () => {
    expect(pauseLimitState(10 * 60 + 30, 10)).toMatchObject({ level: 'over', overSec: 30, remainingSec: 0 });
  });
});
