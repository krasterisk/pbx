import type { IAutodialSchedule } from '@krasterisk/shared';

/**
 * Wall-clock time in a named IANA zone, derived via Intl so DST is handled by
 * the platform rather than by a hand-kept offset table.
 */
export interface ZonedNow {
  /** 0 = Sunday .. 6 = Saturday, matching IAutodialSchedule.weekday */
  weekday: number;
  /** Minutes since local midnight */
  minutes: number;
  /** Local date as YYYY-MM-DD */
  date: string;
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};
const zoneFormatters = new Map<string, Intl.DateTimeFormat>();

export function zonedNow(now: Date, timezone: string): ZonedNow {
  let parts: Intl.DateTimeFormatPart[];
  try {
    let formatter = zoneFormatters.get(timezone);
    if (!formatter) {
      if (zoneFormatters.size >= 128) zoneFormatters.clear();
      formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'short',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      });
      zoneFormatters.set(timezone, formatter);
    }
    parts = formatter.formatToParts(now);
  } catch {
    // Unknown zone: fail closed. Substituting UTC would dial at the wrong
    // local time (B03). scheduleAllows treats weekday < 0 as closed.
    return { weekday: -1, minutes: Number.NaN, date: '' };
  }

  const get = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? '';

  // Intl renders midnight as "24" in some ICU versions under hour12: false.
  const hour = Number(get('hour')) % 24;
  return {
    weekday: WEEKDAY_INDEX[get('weekday')] ?? 0,
    minutes: hour * 60 + Number(get('minute')),
    date: `${get('year')}-${get('month')}-${get('day')}`,
  };
}

export function parseHhMm(value: string): number | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** An overnight window belongs to its start day, including the after-midnight part. */
function rowAllowsLocal(schedule: IAutodialSchedule, local: ZonedNow): boolean {
  if (!schedule.enabled || local.weekday < 0 || !Number.isFinite(local.minutes) || !local.date) return false;
  const from = parseHhMm(schedule.time_from), to = parseHhMm(schedule.time_to);
  if (from === null || to === null || from === to) return false;
  const overnight = from > to;
  if (overnight ? local.minutes < from && local.minutes >= to : local.minutes < from || local.minutes >= to) return false;
  const previousDay = overnight && local.minutes < to;
  const weekday = previousDay ? (local.weekday + 6) % 7 : local.weekday;
  const date = previousDay ? new Date(Date.parse(`${local.date}T12:00:00Z`) - 86400000).toISOString().slice(0, 10) : local.date;
  if (schedule.kind === 'weekly' && schedule.weekday != null && schedule.weekday !== weekday) return false;
  if (schedule.kind === 'one_off') return Boolean(schedule.date_from && date === schedule.date_from);
  return !(schedule.date_from && date < schedule.date_from || schedule.date_to && date > schedule.date_to);
}

/** Does a single schedule row admit dialing at `now`? */
export function scheduleAllows(schedule: IAutodialSchedule, now: Date): boolean {
  return rowAllowsLocal(schedule, zonedNow(now, schedule.timezone));
}

/**
 * A campaign without schedules dials around the clock. Once it has at least
 * one schedule row, an enabled row must match before a new attempt can start.
 * This deliberately fails closed when an operator disables every row.
 */
export function campaignWindowOpen(schedules: IAutodialSchedule[], now: Date): boolean {
  if (schedules.length === 0) return true;
  return schedules.some((schedule) => scheduleAllows(schedule, now));
}

/**
 * Subscriber-local hours check for one phone. `tz_offset_min` is a fixed offset
 * captured at import time — the number's own region, not the tenant's.
 */
export function subscriberHoursAllow(
  tzOffsetMin: number,
  now: Date,
  allowedFrom: string,
  allowedTo: string,
): boolean {
  const from = parseHhMm(allowedFrom);
  const to = parseHhMm(allowedTo);
  if (from == null || to == null || from >= to) return true;
  const localMinutes =
    (((now.getUTCHours() * 60 + now.getUTCMinutes() + tzOffsetMin) % 1440) + 1440) % 1440;
  return localMinutes >= from && localMinutes < to;
}

export interface SubscriberLocalNow {
  weekday: number;
  minutes: number;
  date: string;
}

/** Wall clock for a stored fixed offset (import-time, not IANA/DST). */
export function subscriberLocalNow(tzOffsetMin: number, now: Date): SubscriberLocalNow {
  const shifted = new Date(now.getTime() + tzOffsetMin * 60_000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const d = String(shifted.getUTCDate()).padStart(2, '0');
  return {
    weekday: shifted.getUTCDay(),
    minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
    date: `${y}-${m}-${d}`,
  };
}

function subscriberRowAllows(
  schedule: IAutodialSchedule,
  tzOffsetMin: number,
  now: Date,
): boolean {
  return rowAllowsLocal(schedule, subscriberLocalNow(tzOffsetMin, now));
}

/**
 * Last-mile subscriber hours. The allowed clock interval is the campaign's
 * own enabled schedule windows — not a hardcoded 09:00-20:00 (B04).
 * No schedule rows means 24/7: there is no subscriber-hour limit to apply.
 */
export function subscriberHoursAllowForSchedules(
  tzOffsetMin: number,
  now: Date,
  schedules: IAutodialSchedule[],
): boolean {
  const enabled = schedules.filter((row) => row.enabled);
  if (enabled.length === 0) return true;
  return enabled.some((row) => subscriberRowAllows(row, tzOffsetMin, now));
}
