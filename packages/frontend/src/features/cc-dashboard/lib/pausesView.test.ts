import { describe, expect, it } from 'vitest';
import type { CcDashboardPauses } from '@krasterisk/shared';
import { buildPausesView, formatHoursMinutes, MAX_PAUSE_ROWS } from './pausesView';

const pauses = (partial: Partial<CcDashboardPauses> = {}): CcDashboardPauses => ({
  count: 4,
  totalSec: 4000,
  paidSec: 1000,
  unpaidSec: 2400,
  unknownSec: 600,
  reasons: [
    { reason: 'Lunch', count: 2, totalSec: 2400, isPaid: false },
    { reason: 'Training', count: 1, totalSec: 1000, isPaid: true },
    { reason: '(none)', count: 1, totalSec: 600, isPaid: null },
  ],
  previousTotalSec: 5000,
  ...partial,
});

describe('formatHoursMinutes', () => {
  it('shows minutes under an hour and pads minutes after it', () => {
    expect(formatHoursMinutes(0, 'h', 'min')).toBe('0 min');
    expect(formatHoursMinutes(45 * 60, 'h', 'min')).toBe('45 min');
    expect(formatHoursMinutes(3900, 'h', 'min')).toBe('1 h 05 min');
    expect(formatHoursMinutes(-5, 'h', 'min')).toBe('0 min');
  });
});

describe('buildPausesView', () => {
  it('gives each reason its share of the pause time', () => {
    const v = buildPausesView(pauses());
    expect(v.rows.map((r) => [r.reason, r.pct])).toEqual([['Lunch', 60], ['Training', 25], ['(none)', 15]]);
  });

  it('less pause time than before is an improvement; no comparison means no delta', () => {
    expect(buildPausesView(pauses()).delta).toMatchObject({ trend: 'down', tone: 'success' });
    expect(buildPausesView(pauses({ previousTotalSec: null })).delta).toBeNull();
  });

  it('folds the long tail of reasons into one "other" row', () => {
    const reasons = Array.from({ length: MAX_PAUSE_ROWS + 3 }, (_, i) => ({ reason: `r${i}`, count: 1, totalSec: 100, isPaid: true }));
    const v = buildPausesView(pauses({ reasons, totalSec: reasons.length * 100 }));
    expect(v.rows).toHaveLength(MAX_PAUSE_ROWS + 1);
    expect(v.rows.at(-1)).toMatchObject({ isOther: true, count: 3, totalSec: 300 });
  });

  it('has no rows and no division by zero without pauses', () => {
    const v = buildPausesView(pauses({ count: 0, totalSec: 0, paidSec: 0, unpaidSec: 0, unknownSec: 0, reasons: [], previousTotalSec: 0 }));
    expect(v.rows).toEqual([]);
  });
});
