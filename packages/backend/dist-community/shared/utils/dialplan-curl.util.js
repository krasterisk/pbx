"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CURL_TIMEOUT_SEC = void 0;
exports.encodeCurlPayloadValue = encodeCurlPayloadValue;
exports.extractCurlInvocation = extractCurlInvocation;
exports.decodeCurlPostData = decodeCurlPostData;
exports.buildCurlCall = buildCurlCall;
const shared_1 = require("@krasterisk/shared");
exports.CURL_TIMEOUT_SEC = 5;
const ASTERISK_VAR = /^\$\{[A-Za-z0-9_().]+\}$/;
const DIALPLAN_UNSAFE = /[(),?\[\]{}$\\";\n\r]/g;
function sanitizeDialplanInput(input) {
    if (!input)
        return '';
    return input.replace(DIALPLAN_UNSAFE, '').trim();
}
function resolveBaseUrl(ctx) {
    return (ctx.baseUrl
        || process.env.DIALPLAN_BACKEND_URL
        || `http://127.0.0.1:${process.env.BACKEND_PORT || 5010}/api`);
}
function resolveApiKey(ctx) {
    return ctx.apiKey ?? process.env.DIALPLAN_API_KEY ?? '';
}
function encodeCurlPayloadValue(value) {
    if (ASTERISK_VAR.test(value)) {
        return `\${URIENCODE(${value})}`;
    }
    return encodeURIComponent(value);
}
function extractCurlInvocation(dialplan) {
    const start = dialplan.indexOf('${CURL(');
    if (start < 0)
        return '';
    let depth = 0;
    for (let i = start + 2; i < dialplan.length; i++) {
        const ch = dialplan[i];
        if (ch === '(')
            depth += 1;
        else if (ch === ')') {
            depth -= 1;
            if (depth === 0 && dialplan[i + 1] === '}') {
                return dialplan.slice(start, i + 2);
            }
        }
    }
    return '';
}
function decodeCurlPostData(curlInvocation) {
    const inner = curlInvocation.replace(/^\$\{CURL\(/, '').replace(/\)\}$/, '');
    const comma = inner.indexOf(',');
    const post = comma === -1 ? '' : inner.slice(comma + 1);
    const out = {};
    for (const part of post.split('&')) {
        if (!part)
            continue;
        const eq = part.indexOf('=');
        const rawKey = eq === -1 ? part : part.slice(0, eq);
        const rawVal = eq === -1 ? '' : part.slice(eq + 1);
        const key = decodeURIComponent(rawKey);
        if (ASTERISK_VAR.test(rawVal) || rawVal.startsWith('${URIENCODE(')) {
            out[key] = rawVal;
        }
        else {
            out[key] = decodeURIComponent(rawVal);
        }
    }
    return out;
}
/**
 * Build a timed CURL() assignment for an internal dialplan endpoint.
 * Result is stored in HTTP_RESULT_VAR (ConditionSource `http_result`).
 */
function buildCurlCall(path, payload, ctx = {}) {
    const resultVar = ctx.resultVar ?? shared_1.HTTP_RESULT_VAR;
    const timeoutSec = ctx.timeoutSec ?? exports.CURL_TIMEOUT_SEC;
    const safePath = path.replace(/^\/+/, '').replace(/[^a-z0-9/-]/gi, '');
    const endpoint = (ctx.endpoint ?? `internal/dialplan/${safePath}`)
        .replace(/^\/+/, '')
        .replace(/[^a-z0-9/-]/gi, '');
    const url = `${resolveBaseUrl(ctx)}/${endpoint}`;
    const parts = [];
    for (const [rawKey, rawVal] of Object.entries(payload)) {
        if (rawKey === 'api_key')
            continue;
        const key = sanitizeDialplanInput(rawKey);
        if (!key)
            continue;
        const encoded = encodeCurlPayloadValue(String(rawVal ?? ''));
        const safeEncoded = ASTERISK_VAR.test(String(rawVal ?? '')) || encoded.startsWith('${URIENCODE(')
            ? encoded
            : sanitizeDialplanInput(encoded);
        parts.push(`${key}=${safeEncoded}`);
    }
    if (ctx.vpbxUserUid != null) {
        parts.push(`vpbx_user_uid=${encodeURIComponent(String(ctx.vpbxUserUid))}`);
    }
    const apiKey = resolveApiKey(ctx);
    if (apiKey) {
        parts.push(`api_key=${encodeURIComponent(apiKey)}`);
    }
    return [
        `Set(CURLOPT(httptimeout)=${timeoutSec})`,
        `Set(${resultVar}=\${CURL(${url},${parts.join('&')})})`,
    ].join('\nsame => n,');
}
//# sourceMappingURL=dialplan-curl.util.js.map