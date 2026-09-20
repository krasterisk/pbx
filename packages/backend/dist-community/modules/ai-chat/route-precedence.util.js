"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isCatchAllPattern = isCatchAllPattern;
exports.isEmergencyPattern = isEmergencyPattern;
exports.isSpecificNumericPattern = isSpecificNumericPattern;
exports.checkRoutePrecedence = checkRoutePrecedence;
exports.patternsFromProposal = patternsFromProposal;
const EMERGENCY_NUMBERS = new Set(['101', '102', '103', '104', '110', '112', '911', '999']);
/**
 * Catch-all: a pattern that accepts any remaining digits without a literal prefix.
 * `_X.`, `_N.`, `_Z!` are catch-alls; `_2XX` and exact `112` are not.
 */
function isCatchAllPattern(pattern) {
    const body = pattern.startsWith('_') ? pattern.slice(1) : pattern;
    if (!/[.!]$/.test(body))
        return false;
    return !/^\d/.test(body);
}
function isEmergencyPattern(pattern) {
    const body = pattern.startsWith('_') ? pattern.slice(1) : pattern;
    const digits = body.replace(/\D/g, '');
    if (EMERGENCY_NUMBERS.has(body) || EMERGENCY_NUMBERS.has(digits))
        return true;
    return digits.length >= 2 && digits.length <= 3 && EMERGENCY_NUMBERS.has(digits);
}
function isSpecificNumericPattern(pattern) {
    if (isEmergencyPattern(pattern))
        return true;
    if (isCatchAllPattern(pattern))
        return false;
    const body = pattern.startsWith('_') ? pattern.slice(1) : pattern;
    return /^\d/.test(body) || /^\d+$/.test(pattern);
}
function checkRoutePrecedence(patterns) {
    for (let i = 0; i < patterns.length; i += 1) {
        const current = patterns[i];
        if (!isCatchAllPattern(current))
            continue;
        for (let j = i + 1; j < patterns.length; j += 1) {
            const later = patterns[j];
            if (isEmergencyPattern(later) || isSpecificNumericPattern(later)) {
                return { safe: false, catchAll: current, shadowed: later };
            }
        }
    }
    return { safe: true };
}
function patternsFromProposal(row) {
    const after = row.after_json ?? {};
    if (Array.isArray(after.patterns))
        return after.patterns.map(String);
    const payload = row.apply_payload ?? {};
    const args = (payload.args ?? {});
    if (Array.isArray(args.patterns))
        return args.patterns.map(String);
    if (typeof args.pattern === 'string')
        return [args.pattern];
    if (typeof after.pattern === 'string')
        return [after.pattern];
    return [];
}
//# sourceMappingURL=route-precedence.util.js.map