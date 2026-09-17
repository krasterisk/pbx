import {
  describeKpiReportingWindow,
  resolveKpiReportingMode,
  startOfCalendarDay,
  startOfReportingDay,
} from './kpi-reporting-window.util';
import type { ShiftPolicy } from './models/shift-policy.types';

describe('kpi-reporting-window.util', () => {
  const calendar: Partial<ShiftPolicy> = { close_at_eod: false, eod_time: '00:00' };
  const business: Partial<ShiftPolicy> = { close_at_eod: true, eod_time: '08:00' };

  it('uses calendar_day when EOD close is off', () => {
    expect(resolveKpiReportingMode(calendar)).toBe('calendar_day');
    expect(resolveKpiReportingMode(null)).toBe('calendar_day');
  });

  it('uses business_day when close_at_eod and eod_time is not midnight', () => {
    expect(resolveKpiReportingMode(business)).toBe('business_day');
    expect(resolveKpiReportingMode({ close_at_eod: true, eod_time: '00:00' })).toBe('calendar_day');
  });

  it('startOfCalendarDay zeroes local time', () => {
    const d = startOfCalendarDay(new Date('2026-09-16T15:45:00'));
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
  });

  it('business day after boundary starts today at eod_time', () => {
    const now = new Date(2026, 8, 16, 10, 0, 0); // Sep 16 10:00 local
    const start = startOfReportingDay(business, now);
    expect(start.getFullYear()).toBe(2026);
    expect(start.getMonth()).toBe(8);
    expect(start.getDate()).toBe(16);
    expect(start.getHours()).toBe(8);
    expect(start.getMinutes()).toBe(0);
  });

  it('business day before boundary starts yesterday at eod_time', () => {
    const now = new Date(2026, 8, 16, 6, 0, 0); // Sep 16 06:00 local
    const start = startOfReportingDay(business, now);
    expect(start.getDate()).toBe(15);
    expect(start.getHours()).toBe(8);
  });

  it('describeKpiReportingWindow exposes mode and boundary', () => {
    const w = describeKpiReportingWindow(business, new Date(2026, 8, 16, 10, 0, 0));
    expect(w.mode).toBe('business_day');
    expect(w.boundaryTime).toBe('08:00');
    expect(w.start.getHours()).toBe(8);
  });
});
