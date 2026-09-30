import { describe, expect, it } from 'vitest';
import {
  canShiftForward,
  currentPeriod,
  formatPeriodLabel,
  resolvePeriod,
  shiftPeriod,
} from './periodRange';

describe('periodRange', () => {
  const now = new Date('2026-09-29T08:00:00.000Z');

  it('anchors the current month on the first Moscow day', () => {
    expect(currentPeriod('month', now)).toEqual({ unit: 'month', anchor: '2026-09-01' });
    expect(currentPeriod('week', now).anchor).toBe('2026-09-28');
  });

  it('steps a week backward and stops the next step at today', () => {
    const week = currentPeriod('week', now);
    expect(shiftPeriod(week, -1).anchor).toBe('2026-09-21');
    expect(canShiftForward(week, now)).toBe(false);
    expect(canShiftForward(shiftPeriod(week, -1), now)).toBe(true);
  });

  it('covers a custom range and shifts it by its length', () => {
    const custom = { unit: 'custom' as const, anchor: '2026-09-01', customFrom: '2026-09-10', customTo: '2026-09-12' };
    const resolved = resolvePeriod(custom);
    expect(resolved.startDate).toBe('2026-09-10');
    expect(resolved.endDate).toBe('2026-09-12');
    expect(shiftPeriod(custom, -1)).toMatchObject({ customFrom: '2026-09-07', customTo: '2026-09-09' });
    expect(formatPeriodLabel(custom, 'ru')).toContain('2026');
  });
});
