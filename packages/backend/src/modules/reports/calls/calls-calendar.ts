import type { CallOverviewBucket, CallCalendarDay } from "@krasterisk/shared";

const HOUR = 3600000;
/** First real instant of a civil date, including a midnight gap. A skipped
 * date resolves to the next real date, so inclusive ranges lose no calls. */
export function companyDayStart(date: string, timezone: string): number {
  const target = Date.parse(`${date}T00:00:00Z`);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const civilDate = (at: number) => {
    const parts = formatter.formatToParts(at);
    return ["year", "month", "day"]
      .map((kind) => parts.find((part) => part.type === kind)!.value)
      .join("-");
  };
  let low = target - 36 * HOUR,
    high = target + 36 * HOUR;
  while (high - low > 1) {
    const mid = Math.floor((low + high) / 2);
    if (civilDate(mid) < date) low = mid;
    else high = mid;
  }
  return high;
}
export interface CalendarSlot {
  from: number;
  to: number;
  date: string;
  hour: number;
  offsetMs: number;
  key: string;
}
/** Walk real instants, preserving repeated and missing civil hours (also 30min DST).
 * SQL receives compressed offset ranges; no database timezone tables are needed.
 */
export function callsCalendar(
  period: { from: number; to: number },
  timezone: string,
) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const offset = (at: number) => {
    const parts = formatter.formatToParts(at);
    const part = (kind: string) =>
      Number(parts.find((p) => p.type === kind)!.value);
    return (
      Date.UTC(
        part("year"),
        part("month") - 1,
        part("day"),
        part("hour"),
        part("minute"),
        part("second"),
      ) -
      Math.floor(at / 1000) * 1000
    );
  };
  const slots: CalendarSlot[] = [];
  for (let from = period.from; from < period.to; ) {
    if (slots.length > 10000) throw new Error("Calendar range exceeded");
    const shift = offset(from);
    let to = Math.min(
      period.to,
      (Math.floor((from + shift) / HOUR) + 1) * HOUR - shift,
    );
    // IANA offset transitions are separated by more than an hour. Find a
    // transition inside the civil hour, instead of rounding it to a full hour.
    if (offset(to - 1) !== shift) {
      let low = from,
        high = to - 1;
      while (high - low > 1) {
        const mid = Math.floor((low + high) / 2);
        if (offset(mid) === shift) low = mid;
        else high = mid;
      }
      to = high;
    }
    const civil = new Date(from + shift);
    const localHour = Math.floor((from + shift) / HOUR);
    slots.push({
      from,
      to,
      date: civil.toISOString().slice(0, 10),
      hour: civil.getUTCHours(),
      offsetMs: shift,
      key: `${localHour}:${shift}`,
    });
    from = to;
  }
  const ranges: Array<{ to: number; offsetMs: number }> = [];
  for (const slot of slots) {
    const previous = ranges[ranges.length - 1];
    if (previous?.offsetMs === slot.offsetMs) previous.to = slot.to;
    else ranges.push({ to: slot.to, offsetMs: slot.offsetMs });
  }
  const args: Record<string, number> = {};
  const branches = ranges.map((range, i) => {
    args[`calendarEnd${i}`] = range.to;
    args[`calendarOffset${i}`] = range.offsetMs;
    return `WHEN c.started_at < :calendarEnd${i} THEN :calendarOffset${i}`;
  });
  const offsetSql = `CASE ${branches.join(" ")} ELSE 0 END`;
  return { slots, args, offsetSql };
}

export interface CalendarCounts {
  local_hour: number | string;
  utc_offset: number | string;
  total: number | string;
  human: number | string;
  missed: number | string;
  unknown: number | string;
}
export function presentCalendar(
  slots: CalendarSlot[],
  counts: CalendarCounts[],
): CallCalendarDay[] {
  const grouped = new Map(
    counts.map((row) => [
      `${Number(row.local_hour)}:${Number(row.utc_offset)}`,
      row,
    ]),
  );
  const days = new Map<string, CallCalendarDay>();
  for (const slot of slots) {
    const row = grouped.get(slot.key);
    let day = days.get(slot.date);
    if (!day) {
      day = {
        date: slot.date,
        from: new Date(slot.from).toISOString(),
        to: new Date(slot.to).toISOString(),
        total: 0,
        human: 0,
        missed: 0,
        unknown: 0,
        hours: [],
      };
      days.set(slot.date, day);
    }
    const hour = {
      from: new Date(slot.from).toISOString(),
      to: new Date(slot.to).toISOString(),
      hour: slot.hour,
      offsetMinutes: slot.offsetMs / 60000,
      total: Number(row?.total || 0),
      human: Number(row?.human || 0),
      missed: Number(row?.missed || 0),
      unknown: Number(row?.unknown || 0),
    };
    day.hours.push(hour);
    day.to = hour.to;
    for (const metric of ["total", "human", "missed", "unknown"] as const)
      day[metric] += hour[metric];
  }
  return [...days.values()];
}
export function calendarBuckets(
  days: CallCalendarDay[],
  duration: number,
): CallOverviewBucket[] {
  return duration > 3 * 86400000
    ? days.map(({ hours: _hours, date: _date, ...day }) => day)
    : days.flatMap((day) => day.hours);
}
