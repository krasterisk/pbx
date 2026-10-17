import { describe, expect, it } from 'vitest';
import type { CcDashboardLosses } from '@krasterisk/shared';
import { buildLossesView } from './lossesView';

const losses = (partial: Partial<CcDashboardLosses> = {}): CcDashboardLosses => ({
  total: 20,
  previousTotal: 25,
  recoveredByAgent: 10,
  recoveredWithin15: 5,
  recoveredWithin60: 8,
  clientCalledBack: 2,
  pending: 8,
  waitBuckets: { upTo5: 2, upTo20: 8, upTo60: 6, over60: 4 },
  ...partial,
});

describe('buildLossesView', () => {
  it('turns recovery counts into shares of the lost calls', () => {
    const v = buildLossesView(losses());
    expect(v).toMatchObject({ total: 20, within15Pct: 25, within60Pct: 40, pending: 8, recoveredByAgent: 10, clientCalledBack: 2 });
  });

  it('lists the wait buckets in order with their share', () => {
    const v = buildLossesView(losses());
    expect(v.buckets.map((b) => [b.id, b.count, b.pct])).toEqual([
      ['upTo5', 2, 10],
      ['upTo20', 8, 40],
      ['upTo60', 6, 30],
      ['over60', 4, 20],
    ]);
  });

  it('fewer losses than before is an improvement, more is not', () => {
    expect(buildLossesView(losses()).delta).toMatchObject({ abs: -5, trend: 'down', tone: 'success' });
    expect(buildLossesView(losses({ total: 30 })).delta).toMatchObject({ trend: 'up', tone: 'destructive' });
  });

  it('has no delta without a comparison and no share without losses', () => {
    expect(buildLossesView(losses({ previousTotal: null })).delta).toBeNull();
    const none = buildLossesView(
      losses({ total: 0, previousTotal: 0, recoveredByAgent: 0, recoveredWithin15: 0, recoveredWithin60: 0, clientCalledBack: 0, pending: 0, waitBuckets: { upTo5: 0, upTo20: 0, upTo60: 0, over60: 0 } }),
    );
    expect(none.within15Pct).toBeNull();
    expect(none.within60Pct).toBeNull();
    expect(none.buckets.every((b) => b.pct === 0)).toBe(true);
  });
});
