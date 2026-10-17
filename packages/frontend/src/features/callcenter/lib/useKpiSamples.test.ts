import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { sameKpiSnapshot, useKpiSamples, type KpiSnapshot } from './useKpiSamples';

const base: KpiSnapshot = {
  waiting: 1,
  talking: 2,
  freeAgents: 3,
  sla: 90,
  avgWait: 10,
  abandoned: 0,
};

describe('useKpiSamples', () => {
  it('records the first snapshot and skips identical values', () => {
    const { result, rerender } = renderHook(
      ({ kpis }) => useKpiSamples(kpis),
      { initialProps: { kpis: base } },
    );
    expect(result.current).toHaveLength(1);
    expect(result.current[0].waiting).toBe(1);

    rerender({ kpis: { ...base } });
    expect(result.current).toHaveLength(1);

    rerender({ kpis: { ...base, waiting: 4 } });
    expect(result.current).toHaveLength(2);
    expect(result.current[1].waiting).toBe(4);
  });

  it('sameKpiSnapshot compares numeric fields only', () => {
    expect(sameKpiSnapshot(base, { ...base })).toBe(true);
    expect(sameKpiSnapshot(base, { ...base, sla: 80 })).toBe(false);
  });

  it('records totalAgents as its own series, independent from freeAgents', () => {
    const { result, rerender } = renderHook(
      ({ kpis }) => useKpiSamples(kpis),
      { initialProps: { kpis: { ...base, totalAgents: 10 } } },
    );
    rerender({ kpis: { ...base, totalAgents: 12 } });
    expect(result.current.map((s) => s.totalAgents)).toEqual([10, 12]);
    expect(result.current.map((s) => s.freeAgents)).toEqual([3, 3]);
    expect(sameKpiSnapshot({ ...base, totalAgents: 10 }, { ...base, totalAgents: 12 })).toBe(false);
  });
});
