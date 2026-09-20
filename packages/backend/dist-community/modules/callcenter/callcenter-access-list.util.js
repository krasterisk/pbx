"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeAccessToken = normalizeAccessToken;
exports.normalizeAccessTokenSet = normalizeAccessTokenSet;
exports.accessTokenMatches = accessTokenMatches;
exports.isUnrestrictedAccessList = isUnrestrictedAccessList;
exports.parsePositiveIdList = parsePositiveIdList;
exports.hasOperatorUserIdsKey = hasOperatorUserIdsKey;
exports.isRawOperatorDisplayName = isRawOperatorDisplayName;
exports.operatorDisplayName = operatorDisplayName;
exports.preferHumanOperatorName = preferHumanOperatorName;
/**
 * Flexible access-list token matching for queues / operators.
 * Tokens may be short numbers ("201", "700"), SIP ids ("e201_0"),
 * interfaces ("PJSIP/e201_0"), or queue names ("q700_0").
 */
const endpoint_ids_util_1 = require("../endpoints/endpoint-ids.util");
function normalizeAccessToken(raw) {
    if (raw == null)
        return '';
    let s = String(raw).trim();
    if (!s)
        return '';
    if (s.includes('/')) {
        s = (0, endpoint_ids_util_1.interfaceToExtension)(s);
    }
    else if (/^e(w)?.+_\d+$/i.test(s)) {
        s = (0, endpoint_ids_util_1.extractExtension)(s);
    }
    else {
        const q = s.match(/^q(.+)_\d+$/i);
        if (q)
            s = q[1];
    }
    return s.toLowerCase();
}
/** Build a set of normalized tokens from a JSON array (ignores non-strings). */
function normalizeAccessTokenSet(raw) {
    const out = new Set();
    if (!Array.isArray(raw))
        return out;
    for (const item of raw) {
        const n = normalizeAccessToken(item);
        if (n)
            out.add(n);
    }
    return out;
}
function accessTokenMatches(haystack, candidate) {
    const n = normalizeAccessToken(candidate);
    if (!n)
        return false;
    return haystack.has(n);
}
function isUnrestrictedAccessList(tokens) {
    if (tokens == null)
        return true;
    if (Array.isArray(tokens))
        return tokens.length === 0;
    return tokens.size === 0;
}
/** Positive integer ids from a JSON array (numbers or numeric strings). */
function parsePositiveIdList(raw) {
    if (!Array.isArray(raw))
        return [];
    const out = [];
    const seen = new Set();
    for (const item of raw) {
        const n = typeof item === 'number' ? item : (typeof item === 'string' && /^\d+$/.test(item.trim()) ? Number(item.trim()) : NaN);
        if (!Number.isInteger(n) || n <= 0 || seen.has(n))
            continue;
        seen.add(n);
        out.push(n);
    }
    return out;
}
function hasOperatorUserIdsKey(blob) {
    return Boolean(blob && typeof blob === 'object' && !Array.isArray(blob) && Object.prototype.hasOwnProperty.call(blob, 'operatorUserIds'));
}
/** True when a label is a SIP interface / tenant id / bare extension (not a person name). */
function isRawOperatorDisplayName(name, exten) {
    const n = String(name || '').trim();
    if (!n)
        return true;
    if (/^(PJSIP|SIP)\//i.test(n))
        return true;
    if (/^e(w)?.+_\d+$/i.test(n))
        return true;
    if (/^q.+_\d+$/i.test(n))
        return true;
    const ext = normalizeAccessToken(exten ?? '') || normalizeAccessToken(n);
    if (ext && n.toLowerCase() === ext)
        return true;
    return false;
}
/** Prefer a human name; fall back to normalized extension. */
function operatorDisplayName(name, exten) {
    const ext = normalizeAccessToken(exten) || String(exten || '').trim();
    if (!isRawOperatorDisplayName(name, ext))
        return String(name).trim();
    return ext;
}
/** Prefer a human label when merging candidates; fall back to normalized extension. */
function preferHumanOperatorName(current, incoming, exten) {
    const key = normalizeAccessToken(exten) || String(exten || '').trim();
    if (!isRawOperatorDisplayName(incoming, key))
        return String(incoming).trim();
    if (!isRawOperatorDisplayName(current, key))
        return String(current).trim();
    return key;
}
//# sourceMappingURL=callcenter-access-list.util.js.map