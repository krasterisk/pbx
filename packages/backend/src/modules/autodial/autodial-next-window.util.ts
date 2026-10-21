import { shiftDateKey, type IAutodialSchedule } from '@krasterisk/shared';
import { campaignWindowOpen, parseHhMm, scheduleAllows, subscriberHoursAllowForSchedules, subscriberLocalNow, zonedNow } from './autodial-schedule.util';

/** Candidate boundaries, rather than a minute-by-minute scan of a year. */
export function nextAutodialWindow(schedules: IAutodialSchedule[], now: Date, phoneOffset?: number): Date | null {
  const allows = (at: Date) => campaignWindowOpen(schedules, at)
    && (phoneOffset === undefined || subscriberHoursAllowForSchedules(phoneOffset, at, schedules));
  if (allows(now)) return now;
  const candidates = new Set<number>();
  const offsets = new Map<string, number>();
  const transitions = new Map<string, number[]>();
  const zoneOffset = (stamp: number, zone: string) => {
    const key = `${zone}:${stamp}`;
    if (!offsets.has(key)) {
      const local = zonedNow(new Date(stamp), zone);
      offsets.set(key, local.weekday < 0 ? NaN : Date.parse(`${local.date}T00:00:00Z`) + local.minutes * 60000 - stamp);
    }
    return offsets.get(key)!;
  };
  const zoneTransitions = (zone: string, date: string, end?: string | null) => {
    const key = `${zone}:${date}:${end ?? ''}`;
    if (transitions.has(key)) return transitions.get(key)!;
    const result: number[] = [], first = Date.parse(`${date}T00:00:00Z`);
    const last = Math.min(first + 370 * 86400000, end ? Date.parse(`${end}T00:00:00Z`) + 2 * 86400000 : Infinity);
    for (let left = first; left < last; left += 7 * 86400000) {
      const right = Math.min(last, left + 7 * 86400000), before = zoneOffset(left, zone);
      if (before === zoneOffset(right, zone)) continue;
      let lo = left, hi = right;
      while (hi - lo > 60000) {
        const mid = Math.floor((lo + hi) / 120000) * 60000;
        if (zoneOffset(mid, zone) === before) lo = mid; else hi = mid;
      }
      result.push(hi); candidates.add(hi);
    }
    transitions.set(key, result); return result;
  };
  for (const row of schedules.filter((item) => item.enabled)) {
    const minute = parseHhMm(row.time_from);
    const clock = zonedNow(now, row.timezone);
    if (minute === null || clock.weekday < 0) continue;
    for (const subscriber of phoneOffset === undefined ? [false] : [false, true]) {
      const local = subscriber ? subscriberLocalNow(phoneOffset!, now) : clock;
      const start = row.date_from && row.date_from > local.date ? row.date_from : local.date;
      const dates = new Set(Array.from({ length: 8 }, (_, day) => shiftDateKey(start, day)));
      // A fixed subscriber clock can cease to overlap an IANA window until a
      // later DST transition. Include the following weekly cycle at each
      // transition during the next year, rather than returning a false "never".
      for (const stamp of zoneTransitions(row.timezone, start, row.kind === 'one_off' ? row.date_from : row.date_to)) {
        const transitionDate = (subscriber ? subscriberLocalNow(phoneOffset!, new Date(stamp)) : zonedNow(new Date(stamp), row.timezone)).date;
        for (let day = 0; day < 8; day++) dates.add(shiftDateKey(transitionDate, day));
      }
      for (const date of dates) {
        if (date < start || (row.kind === 'one_off' ? date !== row.date_from : Boolean(row.date_to && date > row.date_to))) continue;
        if (row.kind === 'weekly' && row.weekday != null && row.weekday !== new Date(`${date}T12:00:00Z`).getUTCDay()) continue;
        const civil = Date.parse(`${date}T00:00:00Z`) + minute * 60000;
        if (!Number.isFinite(civil)) continue;
        if (subscriber) { candidates.add(civil - phoneOffset! * 60000); continue; }
        const left = civil - 36 * 3600000, right = civil + 36 * 3600000;
        const possibleOffsets = new Set([zoneOffset(left, row.timezone), zoneOffset(civil, row.timezone), zoneOffset(right, row.timezone)]);
        for (const offset of possibleOffsets) {
          if (!Number.isFinite(offset)) continue;
          const stamp = civil - offset, candidate = zonedNow(new Date(stamp), row.timezone);
          // Both occurrences of an autumn hour are valid candidates; a missing
          // spring clock time is never silently converted to another time.
          if (candidate.date === date && candidate.minutes === minute) candidates.add(stamp);
        }
        if (zoneOffset(left, row.timezone) !== zoneOffset(right, row.timezone)) {
          let lo = left, hi = right; const before = zoneOffset(left, row.timezone);
          while (hi - lo > 60000) {
            const mid = Math.floor((lo + hi) / 120000) * 60000;
            if (zoneOffset(mid, row.timezone) === before) lo = mid; else hi = mid;
          }
          // A window starting inside the missing hour can open at the DST
          // transition, provided the ordinary runtime predicate admits it.
          if (scheduleAllows(row, new Date(hi))) candidates.add(hi);
        }
      }
    }
  }
  for (const stamp of [...candidates].filter((value) => value >= now.getTime()).sort((a, b) => a - b)) {
    const at = new Date(stamp); if (allows(at)) return at;
  }
  return null;
}
