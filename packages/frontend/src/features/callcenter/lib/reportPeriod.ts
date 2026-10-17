/**
 * Report period math (cc-ux U3.1): the same presets as the dashboard plus "back / forward" over the
 * length of the current range. Everything is a `YYYY-MM-DD` key; the server reads the keys as whole days
 * of the tenant time zone, so no instants are built here.
 */
export type ReportPeriodPreset = 'today' | 'yesterday' | '7d' | '30d' | 'custom';

export const REPORT_PERIOD_PRESETS: readonly ReportPeriodPreset[] = ['today', 'yesterday', '7d', '30d', 'custom'];

export interface DateRange {
  from: string;
  to: string;
}

const pad = (n: number) => String(n).padStart(2, '0');

export function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayKey(now: Date = new Date()): string {
  return toDateKey(now);
}

export function addDays(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number);
  // Noon avoids a DST edge shifting the date.
  const date = new Date(y, m - 1, d + days, 12);
  return toDateKey(date);
}

/** Inclusive number of days of a range. */
export function rangeDays(range: DateRange): number {
  const [fy, fm, fd] = range.from.split('-').map(Number);
  const [ty, tm, td] = range.to.split('-').map(Number);
  const from = Date.UTC(fy, fm - 1, fd);
  const to = Date.UTC(ty, tm - 1, td);
  return Math.max(1, Math.round((to - from) / 86_400_000) + 1);
}

export function presetRange(preset: Exclude<ReportPeriodPreset, 'custom'>, today: string = todayKey()): DateRange {
  switch (preset) {
    case 'today':
      return { from: today, to: today };
    case 'yesterday': {
      const y = addDays(today, -1);
      return { from: y, to: y };
    }
    case '7d':
      return { from: addDays(today, -6), to: today };
    case '30d':
      return { from: addDays(today, -29), to: today };
  }
}

/** Which preset a range is, `custom` when none matches (so a link with arbitrary dates still reads right). */
export function detectPreset(range: DateRange, today: string = todayKey()): ReportPeriodPreset {
  for (const preset of ['today', 'yesterday', '7d', '30d'] as const) {
    const candidate = presetRange(preset, today);
    if (candidate.from === range.from && candidate.to === range.to) return preset;
  }
  return 'custom';
}

/** Moves the range by its own length; the forward end is capped at today. */
export function shiftRange(range: DateRange, direction: -1 | 1): DateRange {
  const span = rangeDays(range);
  return {
    from: addDays(range.from, direction * span),
    to: addDays(range.to, direction * span),
  };
}

export function canShiftForward(range: DateRange, today: string = todayKey()): boolean {
  return range.to < today;
}
