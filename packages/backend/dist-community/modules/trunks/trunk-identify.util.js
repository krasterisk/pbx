"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseIdentifyMatches = parseIdentifyMatches;
exports.normalizeIdentifyMatch = normalizeIdentifyMatch;
exports.identifyNeedsSrvLookup = identifyNeedsSrvLookup;
exports.identifyRowId = identifyRowId;
/** Split matchIp / host into Asterisk `ps_endpoint_id_ips.match` values. */
function parseIdentifyMatches(raw) {
    if (!raw)
        return [];
    const seen = new Set();
    const out = [];
    for (const part of raw.split(/[\s,;]+/)) {
        const match = normalizeIdentifyMatch(part);
        if (!match || seen.has(match))
            continue;
        seen.add(match);
        out.push(match);
    }
    return out;
}
function normalizeIdentifyMatch(value) {
    let v = value.trim().replace(/^sip:/i, '');
    if (!v)
        return '';
    if (v.startsWith('[')) {
        const end = v.indexOf(']');
        return end === -1 ? v : v.slice(1, end);
    }
    if (v.includes('/'))
        return v;
    const hostPort = v.match(/^([\w.-]+):(\d+)$/);
    if (hostPort)
        return hostPort[1];
    return v;
}
function identifyNeedsSrvLookup(match) {
    return /[a-zA-Z]/.test(match);
}
function identifyRowId(trunkId, index) {
    const suffix = index === 0 ? '_identify' : `_identify_${index}`;
    const id = `${trunkId}${suffix}`;
    return id.length <= 40 ? id : `${trunkId.slice(0, 40 - suffix.length)}${suffix}`;
}
//# sourceMappingURL=trunk-identify.util.js.map