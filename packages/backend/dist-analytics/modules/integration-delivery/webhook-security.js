"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DomainError = void 0;
exports.signEnvelope = signEnvelope;
exports.verifyEnvelope = verifyEnvelope;
exports.assertSafeWebhookUrl = assertSafeWebhookUrl;
exports.isBlockedIp = isBlockedIp;
exports.buildEnvelope = buildEnvelope;
exports.nextAttemptDelayMs = nextAttemptDelayMs;
const node_crypto_1 = require("node:crypto");
const node_net_1 = require("node:net");
class DomainError extends Error {
    code;
    status;
    constructor(code, status, message) {
        super(message ?? code);
        this.code = code;
        this.status = status;
    }
}
exports.DomainError = DomainError;
function signEnvelope(secret, timestamp, rawBody) {
    return (0, node_crypto_1.createHmac)('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
}
function verifyEnvelope(input) {
    const age = Math.abs(input.now.getTime() - Date.parse(input.timestamp));
    if (!Number.isFinite(age) || age > 5 * 60 * 1000)
        return false;
    const expected = signEnvelope(input.secret, input.timestamp, input.rawBody);
    return expected === input.signature;
}
function assertSafeWebhookUrl(raw) {
    let url;
    try {
        url = new URL(raw);
    }
    catch {
        throw new DomainError('webhook_url_invalid', 422);
    }
    if (url.protocol !== 'https:')
        throw new DomainError('webhook_https_required', 422);
    if (url.username || url.password)
        throw new DomainError('webhook_credentials_forbidden', 422);
    const host = url.hostname.toLowerCase();
    if (host === 'localhost' || host.endsWith('.local') || host === 'metadata.google.internal') {
        throw new DomainError('webhook_ssrf_denied', 422);
    }
    if ((0, node_net_1.isIP)(host) && isBlockedIp(host))
        throw new DomainError('webhook_ssrf_denied', 422);
    return url;
}
function isBlockedIp(ip) {
    if (ip === '::1' || ip === '0.0.0.0')
        return true;
    if (ip.startsWith('127.') || ip.startsWith('10.') || ip.startsWith('192.168.') || ip.startsWith('169.254.')) {
        return true;
    }
    const match = /^172\.(\d+)\./.exec(ip);
    if (match && Number(match[1]) >= 16 && Number(match[1]) <= 31)
        return true;
    if (ip.startsWith('100.64.'))
        return true;
    return false;
}
function buildEnvelope(input) {
    return { schemaVersion: 1, eventId: input.eventId ?? (0, node_crypto_1.randomUUID)(), ...input };
}
function nextAttemptDelayMs(attempt) {
    const base = Math.min(24 * 60 * 60 * 1000, 1000 * (2 ** Math.min(attempt, 8)));
    return Math.floor(base * (0.8 + Math.random() * 0.4));
}
//# sourceMappingURL=webhook-security.js.map