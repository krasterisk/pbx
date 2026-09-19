"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.canonicalJson = canonicalJson;
exports.verifySignedLicense = verifySignedLicense;
const node_crypto_1 = require("node:crypto");
const common_1 = require("@nestjs/common");
const product_access_policy_1 = require("../cloud-admin/product-access-policy");
const fail = (code) => {
    throw new common_1.BadRequestException({ code });
};
function record(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function exactKeys(value, keys) {
    const actual = Object.keys(value).sort();
    const expected = [...keys].sort();
    return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}
/** Canonical representation of parsed JSON; schema validation restricts keys. */
function canonicalJson(value) {
    if (Array.isArray(value))
        return `[${value.map(canonicalJson).join(',')}]`;
    if (record(value)) {
        return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
    }
    return JSON.stringify(value);
}
function base64url(value, maxBytes) {
    if (typeof value !== 'string' || value.length === 0 || value.length > maxBytes * 2
        || !/^[A-Za-z0-9_-]+$/.test(value))
        fail('license_encoding_invalid');
    const bytes = Buffer.from(value, 'base64url');
    if (bytes.length === 0 || bytes.length > maxBytes || bytes.toString('base64url') !== value) {
        fail('license_encoding_invalid');
    }
    return bytes;
}
function utcInstant(value) {
    return typeof value === 'string'
        && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
        && Number.isFinite(Date.parse(value))
        && new Date(value).toISOString() === value;
}
function parsePayload(value) {
    const keys = [
        'version', 'licenseId', 'issuer', 'keyId', 'installationId', 'tenantUid',
        'revision', 'notBefore', 'expiresAt', 'graceSeconds', 'products',
    ];
    if (!record(value) || !exactKeys(value, keys))
        fail('license_schema_invalid');
    const p = value;
    if (p.version !== 1
        || typeof p.licenseId !== 'string'
        || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(p.licenseId)
        || typeof p.issuer !== 'string' || p.issuer.length < 1 || p.issuer.length > 128
        || typeof p.keyId !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(p.keyId)
        || typeof p.installationId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(p.installationId)
        || !Number.isSafeInteger(p.tenantUid) || p.tenantUid < 0
        || !Number.isSafeInteger(p.revision) || p.revision < 1
        || !utcInstant(p.notBefore) || !utcInstant(p.expiresAt)
        || p.expiresAt <= p.notBefore || p.graceSeconds !== 0
        || !Array.isArray(p.products) || p.products.length < 1 || p.products.length > 2) {
        fail('license_schema_invalid');
    }
    let previous = '';
    for (const product of p.products) {
        if (!record(product) || !exactKeys(product, ['code', 'limits'])
            || typeof product.code !== 'string' || !(0, product_access_policy_1.isAiProductCode)(product.code)
            || product.code <= previous || !record(product.limits))
            fail('license_schema_invalid');
        const item = product;
        previous = item.code;
        const limits = item.limits;
        if (Object.keys(limits).length > 20 || Object.entries(limits).some(([key, limit]) => !/^[a-z][a-z0-9_]{0,63}$/.test(key)
            || !Number.isSafeInteger(limit) || limit < 0))
            fail('license_schema_invalid');
    }
    return p;
}
function verifySignedLicense(envelope, trust, now) {
    if (!record(envelope) || !exactKeys(envelope, ['payload', 'signature'])) {
        fail('license_encoding_invalid');
    }
    const encoded = envelope;
    const payloadBytes = base64url(encoded.payload, 16 * 1024);
    const signatureBytes = base64url(encoded.signature, 64);
    if (signatureBytes.length !== 64)
        fail('license_signature_invalid');
    let json;
    let decoded = '';
    try {
        decoded = new TextDecoder('utf-8', { fatal: true }).decode(payloadBytes);
        json = JSON.parse(decoded);
    }
    catch {
        fail('license_encoding_invalid');
    }
    try {
        if (canonicalJson(json) !== decoded)
            fail('license_encoding_invalid');
    }
    catch {
        fail('license_encoding_invalid');
    }
    const payload = parsePayload(json);
    if (!trust.issuer || !trust.installationId || payload.issuer !== trust.issuer
        || payload.installationId !== trust.installationId)
        fail('license_binding_invalid');
    const pem = Object.prototype.hasOwnProperty.call(trust.publicKeys, payload.keyId)
        ? trust.publicKeys[payload.keyId] : undefined;
    if (!pem)
        fail('license_key_unknown');
    let valid = false;
    try {
        const key = (0, node_crypto_1.createPublicKey)(pem);
        valid = key.asymmetricKeyType === 'ed25519'
            && (0, node_crypto_1.verify)(null, payloadBytes, key, signatureBytes);
    }
    catch { /* Invalid trusted key configuration fails closed. */ }
    if (!valid)
        fail('license_signature_invalid');
    const instant = now.getTime();
    if (!Number.isFinite(instant) || instant < Date.parse(payload.notBefore)) {
        fail('license_not_yet_valid');
    }
    if (instant >= Date.parse(payload.expiresAt))
        fail('license_expired');
    return {
        payload, payloadBytes, signatureBytes,
        digest: (0, node_crypto_1.createHash)('sha256').update(payloadBytes).digest('hex'),
    };
}
//# sourceMappingURL=license-verifier.js.map