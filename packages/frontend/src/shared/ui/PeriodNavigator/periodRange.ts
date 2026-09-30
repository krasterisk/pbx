export type PeriodUnit = 'day' | 'week' | 'month' | 'year' | 'custom';

export interface PeriodSelection {
  unit: PeriodUnit;
  /** Calendar day that anchors the window, YYYY-MM-DD in Europe/Moscow. */
  anchor: string;
  customFrom?: string;
  customTo?: string;
}

const MOSCOW_OFFSET_MS = 3 * 60 * 60 * 1000;

export interface ResolvedPeriod {
  from: string;
  to: string;
  startDate: string;
  endDate: string;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function moscowToday(now = new Date()): string {
  const shifted = new Date(now.getTime() + MOSCOW_OFFSET_MS);
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
}

function parseYmd(value: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

function formatYmd(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

function moscowInstant(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day) - MOSCOW_OFFSET_MS);
}

export function addCalendarDays(value: string, days: number): string {
  const parsed = parseYmd(value);
  if (!parsed) return value;
  const next = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day + days));
  return formatYmd(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate());
}

function weekdayMondayIndex(value: string): number {
  const parsed = parseYmd(value);
  if (!parsed) return 0;
  const utc = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day));
  return (utc.getUTCDay() + 6) % 7;
}

export function startOfUnit(value: string, unit: Exclude<PeriodUnit, 'custom'>): string {
  const parsed = parseYmd(value);
  if (!parsed) return value;
  if (unit === 'day') return value;
  if (unit === 'week') return addCalendarDays(value, -weekdayMondayIndex(value));
  if (unit === 'month') return formatYmd(parsed.year, parsed.month, 1);
  return formatYmd(parsed.year, 1, 1);
}

function addMonths(value: string, months: number): string {
  const parsed = parseYmd(value);
  if (!parsed) return value;
  const next = new Date(Date.UTC(parsed.year, parsed.month - 1 + months, 1));
  return formatYmd(next.getUTCFullYear(), next.getUTCMonth() + 1, 1);
}

export function currentPeriod(unit: Exclude<PeriodUnit, 'custom'>, now = new Date()): PeriodSelection {
  const today = moscowToday(now);
  return { unit, anchor: startOfUnit(today, unit) };
}

export function resolvePeriod(selection: PeriodSelection): ResolvedPeriod {
  if (selection.unit === 'custom') {
    const from = selection.customFrom && parseYmd(selection.customFrom) ? selection.customFrom : selection.anchor;
    const rawTo = selection.customTo && parseYmd(selection.customTo) ? selection.customTo : from;
    const startDate = from <= rawTo ? from : rawTo;
    const endDate = from <= rawTo ? rawTo : from;
    const end = parseYmd(endDate)!;
    const to = new Date(moscowInstant(end.year, end.month, end.day).getTime() + 24 * 60 * 60 * 1000 - 1);
    return { from: moscowInstant(parseYmd(startDate)!.year, parseYmd(startDate)!.month, parseYmd(startDate)!.day).toISOString(), to: to.toISOString(), startDate, endDate };
  }
  const anchor = startOfUnit(selection.anchor, selection.unit);
  const parsed = parseYmd(anchor)!;
  const start = moscowInstant(parsed.year, parsed.month, parsed.day);
  const nextStart = selection.unit === 'day'
    ? addCalendarDays(anchor, 1)
    : selection.unit === 'week'
      ? addCalendarDays(anchor, 7)
      : selection.unit === 'month'
        ? addMonths(anchor, 1)
        : formatYmd(parsed.year + 1, 1, 1);
  const next = parseYmd(nextStart)!;
  const to = new Date(moscowInstant(next.year, next.month, next.day).getTime() - 1);
  const endDate = addCalendarDays(nextStart, -1);
  return { from: start.toISOString(), to: to.toISOString(), startDate: anchor, endDate };
}

export function shiftPeriod(selection: PeriodSelection, direction: -1 | 1): PeriodSelection {
  if (selection.unit === 'custom') {
    const resolved = resolvePeriod(selection);
    const span = Math.max(1, Math.round((Date.parse(resolved.to) - Date.parse(resolved.from)) / 86400000));
    return {
      ...selection,
      customFrom: addCalendarDays(resolved.startDate, direction * span),
      customTo: addCalendarDays(resolved.endDate, direction * span),
    };
  }
  const anchor = startOfUnit(selection.anchor, selection.unit);
  const parsed = parseYmd(anchor);
  if (!parsed) return selection;
  const next = selection.unit === 'day'
    ? addCalendarDays(anchor, direction)
    : selection.unit === 'week'
      ? addCalendarDays(anchor, direction * 7)
      : selection.unit === 'month'
        ? addMonths(anchor, direction)
        : formatYmd(parsed.year + direction, 1, 1);
  return { ...selection, anchor: next };
}

export function canShiftForward(selection: PeriodSelection, now = new Date()): boolean {
  const shifted = shiftPeriod(selection, 1);
  return resolvePeriod(shifted).startDate <= moscowToday(now);
}

export function formatPeriodLabel(selection: PeriodSelection, locale: string): string {
  const resolved = resolvePeriod(selection);
  const format = (value: string, options: Intl.DateTimeFormatOptions) => {
    const parsed = parseYmd(value);
    if (!parsed) return value;
    return new Intl.DateTimeFormat(locale, { timeZone: 'Europe/Moscow', ...options })
      .format(moscowInstant(parsed.year, parsed.month, parsed.day));
  };
  if (selection.unit === 'year') return format(resolved.startDate, { year: 'numeric' });
  if (selection.unit === 'month') return format(resolved.startDate, { month: 'long', year: 'numeric' });
  if (resolved.startDate === resolved.endDate) {
    return format(resolved.startDate, { day: 'numeric', month: 'short', year: 'numeric' });
  }
  return `${format(resolved.startDate, { day: 'numeric', month: 'short' })} – ${format(resolved.endDate, { day: 'numeric', month: 'short', year: 'numeric' })}`;
}
