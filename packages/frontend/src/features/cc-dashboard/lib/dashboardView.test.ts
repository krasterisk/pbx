import { describe, expect, it } from 'vitest';
import type { CcDashboardSeries, CcDashboardSeriesPoint } from '@krasterisk/shared';
import { seriesPointLabel, sparkValues, toBadgeSource, toChartPoints, worstSource } from './dashboardView';

const point = (at: string, partial: Partial<CcDashboardSeriesPoint> = {}): CcDashboardSeriesPoint => ({
  at,
  offered: 0,
  handled: 0,
  abandoned: 0,
  shortAbandoned: 0,
  sla: 0,
  abandonRate: 0,
  asa: 0,
  aht: 0,
  cumulativeSla: 0,
  hasTraffic: false,
  ...partial,
});

const series = (points: CcDashboardSeriesPoint[], extra: Partial<CcDashboardSeries> = {}): CcDashboardSeries => ({
  granularity: 'halfHour',
  points,
  previous: null,
  ...extra,
});

describe('seriesPointLabel', () => {
  it('uses the tenant timezone: HH:mm for half hours, DD.MM for days', () => {
    expect(seriesPointLabel('2026-07-15T02:30:00.000Z', 'Asia/Bangkok', 'halfHour')).toBe('09:30');
    expect(seriesPointLabel('2026-07-14T17:00:00.000Z', 'Asia/Bangkok', 'day')).toBe('15.07');
    expect(seriesPointLabel('2026-07-14T17:00:00.000Z', 'UTC', 'day')).toBe('14.07');
  });

  it('is empty for a bad instant and falls back to UTC for an unknown zone', () => {
    expect(seriesPointLabel('nope', 'UTC', 'day')).toBe('');
    expect(seriesPointLabel('2026-07-14T17:00:00.000Z', 'Not/AZone', 'day')).toBe('14.07');
  });
});

describe('toChartPoints', () => {
  it('maps handled to answered, keeps the SLA line empty before the first call and aligns previous offered', () => {
    const s = series(
      [
        point('2026-07-15T01:00:00.000Z'),
        point('2026-07-15T01:30:00.000Z', { offered: 4, handled: 3, abandoned: 1, cumulativeSla: 75, hasTraffic: true }),
      ],
      { previous: [point('2026-07-08T01:00:00.000Z', { offered: 2 })] },
    );
    const data = toChartPoints(s, 'Asia/Bangkok');
    expect(data[0]).toMatchObject({ label: '08:00', cumulativeSla: null, previousOffered: 2 });
    expect(data[1]).toMatchObject({ label: '08:30', answered: 3, abandoned: 1, cumulativeSla: 75, previousOffered: 0 });
  });

  it('has no previous overlay when comparison is off', () => {
    expect(toChartPoints(series([point('2026-07-15T01:00:00.000Z')]), 'UTC')[0].previousOffered).toBeNull();
  });

  it('uses per-day bucket SLA instead of running cumulative SLA when granularity is day (U4.4)', () => {
    const daily = series(
      [
        point('2026-07-15T00:00:00.000Z', { offered: 10, handled: 9, sla: 90, cumulativeSla: 90 }),
        point('2026-07-16T00:00:00.000Z', { offered: 10, handled: 4, sla: 40, cumulativeSla: 65 }),
        point('2026-07-17T00:00:00.000Z', { offered: 0, handled: 0, sla: 0, cumulativeSla: 65 }),
      ],
      { granularity: 'day' },
    );
    const pts = toChartPoints(daily, 'UTC');
    expect(pts[0].cumulativeSla).toBe(90);
    expect(pts[1].cumulativeSla).toBe(40);
    expect(pts[2].cumulativeSla).toBeNull();
  });
});

describe('sparkValues', () => {
  const s = series([
    point('a', { offered: 5, handled: 4, sla: 80, abandonRate: 20, asa: 10, aht: 100 }),
    point('b'), // quiet
    point('c', { offered: 2, shortAbandoned: 2 }), // only short abandons: no verdict
    point('d', { offered: 3, handled: 3, sla: 100, abandonRate: 0, asa: 6, aht: 80 }),
  ]);

  it('keeps every point for volumes', () => {
    expect(sparkValues(s, 'offered')).toEqual([5, 0, 2, 3]);
    expect(sparkValues(s, 'handled')).toEqual([4, 0, 0, 3]);
  });

  it('skips points where a ratio or an average is meaningless', () => {
    expect(sparkValues(s, 'sla')).toEqual([80, 100]);
    expect(sparkValues(s, 'abandonRate')).toEqual([20, 0]);
    expect(sparkValues(s, 'asa')).toEqual([10, 6]);
    expect(sparkValues(s, 'aht')).toEqual([100, 80]);
  });

  it('is empty without a series', () => {
    expect(sparkValues(null, 'offered')).toEqual([]);
  });
});

describe('sources', () => {
  it('maps an error section onto the shared "unavailable" badge state', () => {
    expect(toBadgeSource({ state: 'error', updatedAt: null, message: 'intervals_unavailable' })).toEqual({
      state: 'unavailable',
      updatedAt: null,
      message: 'intervals_unavailable',
    });
    expect(toBadgeSource({ state: 'ok', updatedAt: 'x' }).state).toBe('ok');
  });

  it('picks the worst state to summarise the page', () => {
    const ok = { state: 'ok', updatedAt: null } as const;
    const stale = { state: 'stale', updatedAt: null } as const;
    const error = { state: 'error', updatedAt: null } as const;
    expect(worstSource([])).toBeNull();
    expect(worstSource([ok, stale, ok])).toBe(stale);
    expect(worstSource([stale, error, ok])).toBe(error);
  });
});
