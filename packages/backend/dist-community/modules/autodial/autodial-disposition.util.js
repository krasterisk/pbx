"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dispositionFromHangupCause = dispositionFromHangupCause;
exports.dispositionFromAnsweredCall = dispositionFromAnsweredCall;
exports.isTerminalDisposition = isTerminalDisposition;
exports.decideRetry = decideRetry;
const shared_1 = require("@krasterisk/shared");
/**
 * Map an Asterisk hangup cause to a disposition for a call that was never
 * answered. Cause numbers follow Q.850 as reported by ARI ChannelDestroyed.
 */
function dispositionFromHangupCause(cause) {
    switch (cause) {
        case 16: // Normal clearing — nobody picked up before we tore it down
        case 19: // No answer from user
        case 18: // No user responding
            return 'no_answer';
        case 17: // User busy
            return 'busy';
        case 34: // No circuit available
        case 42: // Switching equipment congestion
        case 44: // Requested channel not available
            return 'congestion';
        case 1: // Unallocated number
        case 2: // No route to specified transit network
        case 3: // No route to destination
        case 22: // Number changed
        case 28: // Invalid number format
            return 'invalid_number';
        case 21: // Call rejected
        case 27: // Destination out of order
            return 'failed';
        default:
            return 'failed';
    }
}
/**
 * Answered calls are judged by talk time: anything below `success_min_sec` is
 * `answered_short`, which is retryable, unlike `success`.
 */
function dispositionFromAnsweredCall(params) {
    if (params.amdResult && params.amdResult.toUpperCase() === 'MACHINE') {
        return 'amd_machine';
    }
    return params.billsec >= params.successMinSec ? 'success' : 'answered_short';
}
function isTerminalDisposition(d) {
    return shared_1.AUTODIAL_TERMINAL_DISPOSITIONS.includes(d);
}
/**
 * Decide whether a task gets another attempt. Exhausting `max_attempts` is
 * recorded as `max_attempts` rather than the last transient cause, so reports
 * can tell "we gave up" from "the line was busy once".
 */
function decideRetry(params) {
    const { disposition, attemptCount, retry, now } = params;
    if (isTerminalDisposition(disposition)) {
        return { retry: false, disposition };
    }
    if (attemptCount >= Math.max(1, retry.max_attempts)) {
        return { retry: false, disposition: 'max_attempts' };
    }
    const intervalSec = retry.intervals_sec?.[disposition] ?? retry.default_interval_sec ?? 3600;
    return {
        retry: true,
        disposition,
        nextAttemptAt: new Date(now.getTime() + Math.max(0, intervalSec) * 1000),
    };
}
//# sourceMappingURL=autodial-disposition.util.js.map