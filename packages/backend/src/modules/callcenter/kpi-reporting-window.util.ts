/**
 * Reporting-day window for supervisor queue KPIs (SLA / ASA / abandoned).
 *
 * ShiftPolicy.eod_time is an auto-close clock, not a KPI window by itself.
 * When close_at_eod is true, the same wall clock is reused as the business-day
 * boundary so "today" matches the operational day the janitor closes against.
 * Otherwise the window is a calendar day starting at local midnight.
 */
import { shiftDateKey, zonedMidnight, zonedParts } from '@krasterisk/shared';
import { DEFAULT_SHIFT_POLICY, type ShiftPolicy } from './models/shift-policy.types';

export type KpiReportingMode = 'calendar_day' | 'business_day';

export interface KpiReportingWindow {
  mode: KpiReportingMode;
  /** Inclusive start of the current reporting period (local server TZ). */
  start: Date;
  /** HH:MM boundary used for business_day (or '00:00' for calendar). */
  boundaryTime: string;
}

function parseHhMm(raw: string | undefined | null): { h: number; m: number } | null {
  const s = String(raw || '').trim();
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min) || h > 23 || min > 59) return null;
  return { h, m: min };
}

export function resolveKpiReportingMode(policy: Partial<ShiftPolicy> | null | undefined): KpiReportingMode {
  if (policy?.close_at_eod) {
    const t = parseHhMm(policy.eod_time);
    // 00:00 EOD is equivalent to calendar midnight.
    if (t && !(t.h === 0 && t.m === 0)) return 'business_day';
  }
  return 'calendar_day';
}

/**
 * Midnight of the calendar day containing `now`.
 * With `timezone` (tenant zone, cc-analytics A5) the day is local to that zone;
 * without it the legacy server-local day is used.
 */
export function startOfCalendarDay(now: Date = new Date(), timezone?: string): Date {
  if (timezone) {
    const [y, m, d] = zonedParts(now, timezone);
    return zonedMidnight(y, m, d, timezone);
  }
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Start of the current reporting day for a tenant.
 * business_day: last occurrence of eod_time at or before `now`.
 * calendar_day: local midnight.
 */
export function startOfReportingDay(
  policy: Partial<ShiftPolicy> | null | undefined,
  now: Date = new Date(),
  timezone?: string,
): Date {
  const mode = resolveKpiReportingMode(policy);
  if (mode === 'calendar_day') return startOfCalendarDay(now, timezone);

  const parsed = parseHhMm(policy?.eod_time) ?? parseHhMm(DEFAULT_SHIFT_POLICY.eod_time)!;
  if (timezone) {
    // Boundary = local midnight + HH:MM (off by at most the DST shift on a transition day).
    const [y, m, d] = zonedParts(now, timezone);
    const offsetMs = (parsed.h * 60 + parsed.m) * 60_000;
    const today = zonedMidnight(y, m, d, timezone).getTime() + offsetMs;
    if (now.getTime() >= today) return new Date(today);
    const prevKey = shiftDateKey(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`, -1);
    const [py, pm, pd] = prevKey.split('-').map(Number);
    return new Date(zonedMidnight(py, pm, pd, timezone).getTime() + offsetMs);
  }
  const boundary = new Date(now);
  boundary.setHours(parsed.h, parsed.m, 0, 0);
  if (now.getTime() < boundary.getTime()) {
    boundary.setDate(boundary.getDate() - 1);
  }
  return boundary;
}

export function describeKpiReportingWindow(
  policy: Partial<ShiftPolicy> | null | undefined,
  now: Date = new Date(),
  timezone?: string,
): KpiReportingWindow {
  const mode = resolveKpiReportingMode(policy);
  const start = startOfReportingDay(policy, now, timezone);
  const boundaryTime = mode === 'business_day'
    ? (parseHhMm(policy?.eod_time) ? String(policy!.eod_time).trim() : DEFAULT_SHIFT_POLICY.eod_time)
    : '00:00';
  return { mode, start, boundaryTime };
}
