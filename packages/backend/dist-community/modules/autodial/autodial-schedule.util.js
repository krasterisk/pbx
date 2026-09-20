"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.zonedNow = zonedNow;
exports.parseHhMm = parseHhMm;
exports.scheduleAllows = scheduleAllows;
exports.campaignWindowOpen = campaignWindowOpen;
exports.subscriberHoursAllow = subscriberHoursAllow;
const WEEKDAY_INDEX = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
};
function zonedNow(now, timezone) {
    let parts;
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
    }
    catch {
        // Unknown zone: fall back to UTC rather than blocking the whole campaign.
        return zonedNow(now, 'UTC');
    }
    const get = (type) => parts.find((p) => p.type === type)?.value ?? '';
    // Intl renders midnight as "24" in some ICU versions under hour12: false.
    const hour = Number(get('hour')) % 24;
    return {
        weekday: WEEKDAY_INDEX[get('weekday')] ?? 0,
        minutes: hour * 60 + Number(get('minute')),
        date: `${get('year')}-${get('month')}-${get('day')}`,
    };
}
function parseHhMm(value) {
    const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
    if (!m)
        return null;
    return Number(m[1]) * 60 + Number(m[2]);
}
/** Does a single schedule row admit dialing at `now`? */
function scheduleAllows(schedule, now) {
    if (!schedule.enabled)
        return false;
    const from = parseHhMm(schedule.time_from);
    const to = parseHhMm(schedule.time_to);
    if (from == null || to == null || from >= to)
        return false;
    const local = zonedNow(now, schedule.timezone);
    if (schedule.kind === 'weekly' && schedule.weekday != null && schedule.weekday !== local.weekday) {
        return false;
    }
    if (schedule.date_from && local.date < schedule.date_from)
        return false;
    if (schedule.date_to && local.date > schedule.date_to)
        return false;
    return local.minutes >= from && local.minutes < to;
}
/**
 * A campaign without schedules dials around the clock. Once it has at least
 * one schedule row, an enabled row must match before a new attempt can start.
 * This deliberately fails closed when an operator disables every row.
 */
function campaignWindowOpen(schedules, now) {
    if (schedules.length === 0)
        return true;
    return schedules.some((schedule) => scheduleAllows(schedule, now));
}
/**
 * Subscriber-local hours check for one phone. `tz_offset_min` is a fixed offset
 * captured at import time — the number's own region, not the tenant's.
 */
function subscriberHoursAllow(tzOffsetMin, now, allowedFrom, allowedTo) {
    const from = parseHhMm(allowedFrom);
    const to = parseHhMm(allowedTo);
    if (from == null || to == null || from >= to)
        return true;
    const localMinutes = (((now.getUTCHours() * 60 + now.getUTCMinutes() + tzOffsetMin) % 1440) + 1440) % 1440;
    return localMinutes >= from && localMinutes < to;
}
//# sourceMappingURL=autodial-schedule.util.js.map