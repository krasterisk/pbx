import { describe, it, expect } from 'vitest';
import { resolveKpiValue, resolveKpiTriple } from './kpiDisplay';

describe('kpiDisplay', () => {
  it('resolves shift / day / both for a single counter', () => {
    expect(resolveKpiValue(3, 5, 'shift')).toBe('3');
    expect(resolveKpiValue(3, 5, 'day')).toBe('5');
    expect(resolveKpiValue(3, 5, 'both')).toBe('3 · 5');
  });

  it('resolves a full answered/made/missed/total triple', () => {
    const out = resolveKpiTriple(
      { answered: 3, made: 1, missed: 2 },
      { answered: 10, made: 4, missed: 7 },
      'both',
    );
    expect(out.answered).toBe('3 · 10');
    expect(out.made).toBe('1 · 4');
    expect(out.missed).toBe('2 · 7');
    expect(out.total).toBe('4 · 14');
  });
});
