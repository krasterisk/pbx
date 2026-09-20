"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveIvrTimeouts = resolveIvrTimeouts;
const DEFAULT_WAIT_EXTEN = 10;
const DEFAULT_RESPONSE = 10;
const DEFAULT_DIGIT = 5;
function parsePositiveSeconds(raw, fallback) {
    if (raw == null || raw === '')
        return fallback;
    const n = parseInt(String(raw), 10);
    return Number.isFinite(n) && n > 0 ? n : fallback;
}
function resolveIvrTimeouts(ivr) {
    const waitExten = parsePositiveSeconds(ivr.timeout, DEFAULT_WAIT_EXTEN);
    const response = ivr.timeout_response != null && ivr.timeout_response !== ''
        ? parsePositiveSeconds(ivr.timeout_response, waitExten)
        : waitExten;
    const digit = ivr.timeout_digit != null && ivr.timeout_digit !== ''
        ? parsePositiveSeconds(ivr.timeout_digit, DEFAULT_DIGIT)
        : DEFAULT_DIGIT;
    return { waitExten, response, digit };
}
//# sourceMappingURL=ivr-timeouts.util.js.map