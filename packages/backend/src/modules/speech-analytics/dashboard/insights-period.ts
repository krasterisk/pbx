/**
 * The insight comparison window is the dashboard period and the window
 * immediately before it. Months and years stay calendar-sized. Everything
 * else shifts by the same inclusive number of Moscow days.
 */

const MOSCOW_OFFSET_MS = 3 * 60 * 60 * 1000;

export type InsightsPeriodWindow = {
  from: string;
  to: string;
  startDate: string;
  endDate: string;
  label: string;
};

function pad(value: number): string {
  return String(value).padStart(2, '0');
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

export function moscowYmd(instant: Date): string {
  const shifted = new Date(instant.getTime() + MOSCOW_OFFSET_MS);
  return formatYmd(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate());
}

function moscowStart(ymd: string): Date {
  const parsed = parseYmd(ymd);
  if (!parsed) return new Date(NaN);
  return new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day) - MOSCOW_OFFSET_MS);
}

function addCalendarDays(value: string, days: number): string {
  const parsed = parseYmd(value);
  if (!parsed) return value;
  const next = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day + days));
  return formatYmd(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate());
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function windowFromDates(startDate: string, endDate: string): InsightsPeriodWindow {
  const start = startDate <= endDate ? startDate : endDate;
  const end = startDate <= endDate ? endDate : startDate;
  const to = new Date(moscowStart(addCalendarDays(end, 1)).getTime() - 1);
  return {
    from: moscowStart(start).toISOString(),
    to: to.toISOString(),
    startDate: start,
    endDate: end,
    label: start === end ? start : `${start} - ${end}`,
  };
}

function isFullMonth(startDate: string, endDate: string): boolean {
  const start = parseYmd(startDate);
  const end = parseYmd(endDate);
  if (!start || !end) return false;
  return start.day === 1
    && start.year === end.year
    && start.month === end.month
    && end.day === lastDayOfMonth(end.year, end.month);
}

function isFullYear(startDate: string, endDate: string): boolean {
  const start = parseYmd(startDate);
  const end = parseYmd(endDate);
  if (!start || !end) return false;
  return start.month === 1 && start.day === 1
    && end.year === start.year && end.month === 12 && end.day === 31;
}

function previousDates(startDate: string, endDate: string): { startDate: string; endDate: string } {
  if (isFullMonth(startDate, endDate)) {
    const start = parseYmd(startDate)!;
    const previous = new Date(Date.UTC(start.year, start.month - 2, 1));
    const year = previous.getUTCFullYear();
    const month = previous.getUTCMonth() + 1;
    return {
      startDate: formatYmd(year, month, 1),
      endDate: formatYmd(year, month, lastDayOfMonth(year, month)),
    };
  }
  if (isFullYear(startDate, endDate)) {
    const year = parseYmd(startDate)!.year - 1;
    return { startDate: formatYmd(year, 1, 1), endDate: formatYmd(year, 12, 31) };
  }
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  const span = Math.max(0, Math.round((end - start) / 86_400_000));
  const previousEnd = addCalendarDays(startDate, -1);
  return { startDate: addCalendarDays(previousEnd, -span), endDate: previousEnd };
}

export function describeInsightsPeriod(fromIso: string, toIso: string): {
  current: InsightsPeriodWindow;
  previous: InsightsPeriodWindow;
} {
  const from = new Date(fromIso);
  const to = new Date(toIso);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from.getTime() > to.getTime()) {
    throw new Error('insights_period_invalid');
  }
  const current = windowFromDates(moscowYmd(from), moscowYmd(to));
  const shifted = previousDates(current.startDate, current.endDate);
  return { current, previous: windowFromDates(shifted.startDate, shifted.endDate) };
}
