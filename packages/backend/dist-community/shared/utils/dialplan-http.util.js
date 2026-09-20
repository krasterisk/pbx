"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ALLOWED_HTTP_HEADER_KEYS = exports.HTTP_STATUS_VAR = exports.HTTP_REQUEST_DEFAULT_TIMEOUT = void 0;
exports.assertSafeHttpUrl = assertSafeHttpUrl;
exports.emitHttpRequest = emitHttpRequest;
exports.pickAllowedHttpHeaders = pickAllowedHttpHeaders;
const shared_1 = require("@krasterisk/shared");
const dialplan_curl_util_1 = require("./dialplan-curl.util");
exports.HTTP_REQUEST_DEFAULT_TIMEOUT = 5;
exports.HTTP_STATUS_VAR = 'KRSK_HTTP_STATUS';
exports.ALLOWED_HTTP_HEADER_KEYS = [
    'Accept',
    'Content-Type',
    'Authorization',
    'X-Request-Id',
];
const DIALPLAN_UNSAFE = /[(),?\[\]{}$\\";\n\r]/g;
function sanitizeDialplanInput(input) {
    if (!input)
        return '';
    return input.replace(DIALPLAN_UNSAFE, '').trim();
}
function allowlistHosts() {
    const raw = process.env.DIALPLAN_HTTP_INTERNAL_HOSTS ?? '';
    return new Set(raw.split(',').map((h) => h.trim().toLowerCase()).filter(Boolean));
}
function ipv4ToInt(parts) {
    return ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
}
function parseIpv4(host) {
    const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
    if (!m)
        return null;
    const parts = m.slice(1).map((n) => Number(n));
    if (parts.some((n) => n > 255))
        return null;
    return parts;
}
function isPrivateIpv4(parts) {
    const n = ipv4ToInt(parts);
    const inRange = (base, mask) => (n & mask) === base;
    return (inRange(ipv4ToInt([10, 0, 0, 0]), ipv4ToInt([255, 0, 0, 0]))
        || inRange(ipv4ToInt([172, 16, 0, 0]), ipv4ToInt([255, 240, 0, 0]))
        || inRange(ipv4ToInt([192, 168, 0, 0]), ipv4ToInt([255, 255, 0, 0]))
        || inRange(ipv4ToInt([127, 0, 0, 0]), ipv4ToInt([255, 0, 0, 0]))
        || inRange(ipv4ToInt([169, 254, 0, 0]), ipv4ToInt([255, 255, 0, 0]))
        || inRange(ipv4ToInt([0, 0, 0, 0]), ipv4ToInt([255, 0, 0, 0])));
}
function isBlockedIpv6(host) {
    const h = host.toLowerCase().replace(/^\[|\]$/g, '');
    if (h === '::1' || h === '0:0:0:0:0:0:0:1')
        return true;
    if (h.startsWith('fe80:') || h.startsWith('feb'))
        return true;
    if (h.startsWith('fc') || h.startsWith('fd'))
        return true;
    if (h.startsWith('::ffff:')) {
        const mapped = h.slice('::ffff:'.length);
        const parts = parseIpv4(mapped);
        return !parts || isPrivateIpv4(parts);
    }
    return false;
}
function assertSafeHttpUrl(raw) {
    let parsed;
    try {
        parsed = new URL(raw);
    }
    catch {
        throw new Error('invalid HTTP URL');
    }
    const protocol = parsed.protocol.toLowerCase();
    const host = parsed.hostname.toLowerCase();
    if (protocol !== 'https:' && protocol !== 'http:') {
        throw new Error('HTTP URL scheme must be https');
    }
    if (protocol === 'http:' && !allowlistHosts().has(host)) {
        throw new Error('http is only allowed for configured internal hosts');
    }
    if (host === 'localhost' || host.endsWith('.localhost') || host === 'metadata.google.internal') {
        throw new Error('HTTP URL host is not allowed');
    }
    const ipv4 = parseIpv4(host);
    if (ipv4 && isPrivateIpv4(ipv4)) {
        throw new Error('HTTP URL must not target a private or metadata address');
    }
    if (host.includes(':') && isBlockedIpv6(host)) {
        throw new Error('HTTP URL must not target a private or metadata address');
    }
}
function emitHttpRequest(params, ctx = {}) {
    const url = String(params.url ?? '');
    assertSafeHttpUrl(url);
    const timeout = Number(params.timeout);
    const seconds = Number.isFinite(timeout) && timeout > 0
        ? Math.min(Math.floor(timeout), 60)
        : exports.HTTP_REQUEST_DEFAULT_TIMEOUT;
    const method = params.method === 'POST' ? 'POST' : 'GET';
    const safeUrl = sanitizeDialplanInput(url);
    const payload = {
        url: safeUrl,
        method,
        timeout: String(seconds),
        route_uid: '${HH_ROUTE_UID}',
    };
    if (ctx.actionId) {
        payload.action_id = sanitizeDialplanInput(ctx.actionId);
    }
    if (method === 'POST') {
        payload.body = sanitizeDialplanInput(params.body);
    }
    const curl = (0, dialplan_curl_util_1.buildCurlCall)('http-request', payload, {
        ...ctx.curlCtx,
        timeoutSec: seconds,
    });
    const lines = [
        curl,
        `ExecIf($["\${${shared_1.HTTP_RESULT_VAR}}" = ""]?Set(${exports.HTTP_STATUS_VAR}=timeout))`,
        `ExecIf($["\${${shared_1.HTTP_RESULT_VAR}}" != ""]?Set(${exports.HTTP_STATUS_VAR}=ok))`,
    ];
    return lines.join('\nsame => n,');
}
function pickAllowedHttpHeaders(headers) {
    if (!headers || typeof headers !== 'object')
        return {};
    const out = {};
    for (const [key, value] of Object.entries(headers)) {
        if (!exports.ALLOWED_HTTP_HEADER_KEYS.includes(key))
            continue;
        out[key] = String(value ?? '');
    }
    return out;
}
//# sourceMappingURL=dialplan-http.util.js.map