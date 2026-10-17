/**
 * Tenant-timezone day boundaries (cc-analytics A5). Pure Intl, no dependencies.
 * Rollup day keys, report windows and "today" must all use the tenant zone, not the server zone.
 */

export function isValidTimezone(value: unknown): value is string {
  if (typeof value !== 'string' || !value) return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

/** [year, month(1-12), day, hour, minute, second] of `date` as seen in `timezone`. */
export function zonedParts(date: Date, timezone: string): [number, number, number, number, number, number] {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const pick = (type: string): number => Number(parts.find((p) => p.type === type)?.value);
  return [pick('year'), pick('month'), pick('day'), pick('hour'), pick('minute'), pick('second')];
}

/** UTC instant of local 00:00 for the given calendar date in `timezone` (DST-safe). */
export function zonedMidnight(year: number, month: number, day: number, timezone: string): Date {
  const target = Date.UTC(year, month - 1, day);
  let instant = target;
  for (let i = 0; i < 4; i++) {
    const p = zonedParts(new Date(instant), timezone);
    const represented = Date.UTC(p[0], p[1] - 1, p[2], p[3], p[4], p[5]);
    const shift = target - represented;
    instant += shift;
    if (!shift) break;
  }
  return new Date(instant);
}

const pad = (n: number): string => String(n).padStart(2, '0');

/** `YYYY-MM-DD` of `date` in `timezone`. */
export function zonedDateKey(date: Date, timezone: string): string {
  const [y, m, d] = zonedParts(date, timezone);
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** Shift a `YYYY-MM-DD` key by whole calendar days. */
export function shiftDateKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const shifted = new Date(Date.UTC(y, m - 1, d + days));
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
}

/** Half-open UTC window [from, to) for one local calendar day. */
export function zonedDayWindow(dateKey: string, timezone: string): { from: Date; to: Date } {
  const [y, m, d] = dateKey.split('-').map(Number);
  const next = shiftDateKey(dateKey, 1).split('-').map(Number);
  return {
    from: zonedMidnight(y, m, d, timezone),
    to: zonedMidnight(next[0], next[1], next[2], timezone),
  };
}
