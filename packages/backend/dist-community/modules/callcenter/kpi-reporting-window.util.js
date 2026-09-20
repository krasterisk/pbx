"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveKpiReportingMode = resolveKpiReportingMode;
exports.startOfCalendarDay = startOfCalendarDay;
exports.startOfReportingDay = startOfReportingDay;
exports.describeKpiReportingWindow = describeKpiReportingWindow;
/**
 * Reporting-day window for supervisor queue KPIs (SLA / ASA / abandoned).
 *
 * ShiftPolicy.eod_time is an auto-close clock, not a KPI window by itself.
 * When close_at_eod is true, the same wall clock is reused as the business-day
 * boundary so "today" matches the operational day the janitor closes against.
 * Otherwise the window is a calendar day starting at local midnight.
 */
const shift_policy_types_1 = require("./models/shift-policy.types");
function parseHhMm(raw) {
    const s = String(raw || '').trim();
    const m = /^(\d{1,2}):(\d{2})$/.exec(s);
    if (!m)
        return null;
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (!Number.isFinite(h) || !Number.isFinite(min) || h > 23 || min > 59)
        return null;
    return { h, m: min };
}
function resolveKpiReportingMode(policy) {
    if (policy?.close_at_eod) {
        const t = parseHhMm(policy.eod_time);
        // 00:00 EOD is equivalent to calendar midnight.
        if (t && !(t.h === 0 && t.m === 0))
            return 'business_day';
    }
    return 'calendar_day';
}
/** Local midnight of the calendar day containing `now`. */
function startOfCalendarDay(now = new Date()) {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d;
}
/**
 * Start of the current reporting day for a tenant.
 * business_day: last occurrence of eod_time at or before `now`.
 * calendar_day: local midnight.
 */
function startOfReportingDay(policy, now = new Date()) {
    const mode = resolveKpiReportingMode(policy);
    if (mode === 'calendar_day')
        return startOfCalendarDay(now);
    const parsed = parseHhMm(policy?.eod_time) ?? parseHhMm(shift_policy_types_1.DEFAULT_SHIFT_POLICY.eod_time);
    const boundary = new Date(now);
    boundary.setHours(parsed.h, parsed.m, 0, 0);
    if (now.getTime() < boundary.getTime()) {
        boundary.setDate(boundary.getDate() - 1);
    }
    return boundary;
}
function describeKpiReportingWindow(policy, now = new Date()) {
    const mode = resolveKpiReportingMode(policy);
    const start = startOfReportingDay(policy, now);
    const boundaryTime = mode === 'business_day'
        ? (parseHhMm(policy?.eod_time) ? String(policy.eod_time).trim() : shift_policy_types_1.DEFAULT_SHIFT_POLICY.eod_time)
        : '00:00';
    return { mode, start, boundaryTime };
}
//# sourceMappingURL=kpi-reporting-window.util.js.map