"use strict";
/**
 * Dialer KPI formulas. Kept pure so the definitions are testable and identical
 * between the live monitor and the reports.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeAutodialKpi = computeAutodialKpi;
exports.emptyAutodialKpi = emptyAutodialKpi;
function ratio(numerator, denominator) {
    if (!denominator)
        return 0;
    return numerator / denominator;
}
function pct(numerator, denominator) {
    return Math.round(ratio(numerator, denominator) * 1000) / 10;
}
function computeAutodialKpi(input) {
    return {
        contact_rate: pct(input.answered, input.dials),
        rpc: pct(input.success, input.dials),
        asr: pct(input.answered, input.dials),
        aht: Math.round(ratio(input.talkSecSum, input.answered)),
        acd: Math.round(ratio(input.billsecSum, input.dials)),
        abandon_rate: pct(input.abandoned, input.answered),
        list_penetration: pct(input.contactsAttempted, input.contactsTotal),
        dials_per_contact: Math.round(ratio(input.dials, input.contactsReached) * 100) / 100,
        calls_per_hour: Math.round(ratio(input.dials, input.activeSec / 3600) * 10) / 10,
    };
}
function emptyAutodialKpi() {
    return computeAutodialKpi({
        dials: 0,
        answered: 0,
        success: 0,
        short: 0,
        abandoned: 0,
        talkSecSum: 0,
        billsecSum: 0,
        contactsReached: 0,
        contactsTotal: 0,
        contactsAttempted: 0,
        activeSec: 0,
    });
}
//# sourceMappingURL=autodial-metrics.util.js.map