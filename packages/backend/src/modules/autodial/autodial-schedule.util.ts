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

export function zonedNow(now: Date, timezone: string): ZonedNow {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'short',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(now);
  } catch {
    // Unknown zone: fall back to UTC rather than blocking the whole campaign.
    return zonedNow(now, 'UTC');
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

/** Does a single schedule row admit dialing at `now`? */
export function scheduleAllows(schedule: IAutodialSchedule, now: Date): boolean {
  if (!schedule.enabled) return false;
  const from = parseHhMm(schedule.time_from);
  const to = parseHhMm(schedule.time_to);
  if (from == null || to == null || from >= to) return false;

  const local = zonedNow(now, schedule.timezone);
  if (schedule.kind === 'weekly' && schedule.weekday != null && schedule.weekday !== local.weekday) {
    return false;
  }
  if (schedule.date_from && local.date < schedule.date_from) return false;
  if (schedule.date_to && local.date > schedule.date_to) return false;
  return local.minutes >= from && local.minutes < to;
}

/**
 * A campaign without schedules dials around the clock; with schedules, any one
 * enabled row that matches opens the window.
 */
export function campaignWindowOpen(schedules: IAutodialSchedule[], now: Date): boolean {
  const enabled = schedules.filter((s) => s.enabled);
  if (!enabled.length) return true;
  return enabled.some((s) => scheduleAllows(s, now));
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
