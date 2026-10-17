import { describe, expect, it } from 'vitest';
import type { QueueIntervalPoint, QueueIntervalsResult } from '@/shared/api/endpoints/callCenterReportsApi';
import { buildIntradayChartData, formatIntervalLabel, hasIntradayTraffic, summarizeIntraday } from './intradayChartData';

const point = (start: string, partial: Partial<QueueIntervalPoint> = {}): QueueIntervalPoint => ({
  start,
  offered: 0,
  answered: 0,
  abandoned: 0,
  shortAbandoned: 0,
  transferred: 0,
  sla: 0,
  asr: 0,
  asa: 0,
  aht: 0,
  abandonRate: 0,
  maxWait: 0,
  cumulativeOffered: 0,
  cumulativeSla: 0,
  ...partial,
});

const result = (rows: QueueIntervalPoint[], extra: Partial<QueueIntervalsResult> = {}): QueueIntervalsResult => ({
  timezone: 'Asia/Bangkok',
  granularityMin: 60,
  from: rows[0]?.start ?? '',
  to: '',
  rows,
  ...extra,
});

describe('formatIntervalLabel', () => {
  it('renders in the tenant timezone, not the browser one', () => {
    expect(formatIntervalLabel('2026-07-15T02:00:00.000Z', 'Asia/Bangkok')).toBe('09:00');
    expect(formatIntervalLabel('2026-07-15T06:15:00.000Z', 'Asia/Kathmandu')).toBe('12:00');
    expect(formatIntervalLabel('2026-07-15T00:00:00.000Z', 'UTC')).toBe('00:00');
  });

  it('falls back to UTC for an unknown timezone and to empty for a bad instant', () => {
    expect(formatIntervalLabel('2026-07-15T02:00:00.000Z', 'Not/AZone')).toBe('02:00');
    expect(formatIntervalLabel('garbage', 'UTC')).toBe('');
  });
});

describe('buildIntradayChartData', () => {
  it('is empty without data', () => {
    expect(buildIntradayChartData(undefined)).toEqual([]);
  });

  it('keeps the SLA line empty until the first call and maps counts', () => {
    const data = buildIntradayChartData(
      result([
        point('2026-07-15T01:00:00.000Z'),
        point('2026-07-15T02:00:00.000Z', {
          offered: 3, answered: 2, abandoned: 1, shortAbandoned: 0, cumulativeOffered: 3, cumulativeSla: 66.7,
        }),
      ]),
    );
    expect(data[0]).toMatchObject({ label: '08:00', cumulativeSla: null, previousOffered: null });
    expect(data[1]).toMatchObject({ label: '09:00', answered: 2, abandoned: 1, cumulativeSla: 66.7 });
  });

  it('aligns the week-ago overlay by index and treats a missing point as zero', () => {
    const rows = [point('2026-07-15T01:00:00.000Z'), point('2026-07-15T02:00:00.000Z')];
    const data = buildIntradayChartData(result(rows, { previous: [point('2026-07-08T01:00:00.000Z', { offered: 4 })] }));
    expect(data.map((d) => d.previousOffered)).toEqual([4, 0]);
  });
});

describe('summarizeIntraday / hasIntradayTraffic', () => {
  it('has no traffic and no peak for an empty day', () => {
    const rows = [point('2026-07-15T01:00:00.000Z')];
    expect(hasIntradayTraffic(rows)).toBe(false);
    expect(hasIntradayTraffic(undefined)).toBe(false);
    expect(summarizeIntraday(rows)).toEqual({ offered: 0, answered: 0, abandoned: 0, sla: null, peak: null });
  });

  it('totals the day, takes the running SLA of the last point and the first busiest interval', () => {
    const rows = [
      point('2026-07-15T01:00:00.000Z', { offered: 5, answered: 4, abandoned: 1, cumulativeOffered: 5, cumulativeSla: 80 }),
      point('2026-07-15T02:00:00.000Z', { offered: 5, answered: 5, cumulativeOffered: 10, cumulativeSla: 90 }),
      point('2026-07-15T03:00:00.000Z', { cumulativeOffered: 10, cumulativeSla: 90 }),
    ];
    expect(hasIntradayTraffic(rows)).toBe(true);
    expect(summarizeIntraday(rows)).toEqual({
      offered: 10,
      answered: 9,
      abandoned: 1,
      sla: 90,
      peak: { at: '2026-07-15T01:00:00.000Z', offered: 5 },
    });
  });
});
