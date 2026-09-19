"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.encryptSecret = encryptSecret;
exports.decryptSecret = decryptSecret;
const node_crypto_1 = require("node:crypto");
const ALG = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;
const LEGACY_SALT = Buffer.from('krsk-ai-providers-v1');
const TEST_SECRET = 'krasterisk-test-provider-key-material-do-not-deploy';
function activeSecret() {
    const configured = process.env.CC_AI_KEY_SECRET;
    if (configured)
        return configured;
    if (process.env.NODE_ENV === 'test' && process.env.JEST_WORKER_ID)
        return TEST_SECRET;
    throw new Error('AI_PROVIDER_KEY_UNAVAILABLE');
}
function activeKeyId() {
    const id = process.env.CC_AI_KEY_ID || 'primary';
    if (!/^[A-Za-z0-9_-]{1,32}$/.test(id))
        throw new Error('AI_PROVIDER_KEY_ID_INVALID');
    return id;
}
function previousSecrets() {
    const raw = process.env.CC_AI_PREVIOUS_KEYS_JSON;
    if (!raw)
        return {};
    let parsed;
    try {
        parsed = JSON.parse(raw);
    }
    catch {
        throw new Error('AI_PROVIDER_KEYRING_INVALID');
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)
        || Object.entries(parsed).some(([id, value]) => !/^[A-Za-z0-9_-]{1,32}$/.test(id)
            || typeof value !== 'string' || !value)) {
        throw new Error('AI_PROVIDER_KEYRING_INVALID');
    }
    return parsed;
}
function encryptionKey(secret, id) {
    return (0, node_crypto_1.scryptSync)(secret, Buffer.from(`krsk-ai-providers-v2:${id}`), 32);
}
function decodePayload(value) {
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value))
        throw new Error('AI_PROVIDER_CIPHERTEXT_INVALID');
    const payload = Buffer.from(value, 'base64');
    if (payload.length < IV_LEN + TAG_LEN + 1)
        throw new Error('AI_PROVIDER_CIPHERTEXT_INVALID');
    return payload;
}
function decryptPayload(payload, key) {
    const iv = payload.subarray(0, IV_LEN);
    const tag = payload.subarray(IV_LEN, IV_LEN + TAG_LEN);
    const cipher = payload.subarray(IV_LEN + TAG_LEN);
    const decipher = (0, node_crypto_1.createDecipheriv)(ALG, key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(cipher), decipher.final()]).toString('utf8');
}
/** Versioned envelope; only a configured installation secret can encrypt outside tests. */
function encryptSecret(plain) {
    if (!plain)
        return '';
    const secret = activeSecret();
    if (Buffer.byteLength(secret, 'utf8') < 32)
        throw new Error('AI_PROVIDER_KEY_TOO_SHORT');
    const id = activeKeyId();
    const iv = (0, node_crypto_1.randomBytes)(IV_LEN);
    const cipher = (0, node_crypto_1.createCipheriv)(ALG, encryptionKey(secret, id), iv);
    const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    return `v2:${id}:${Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64')}`;
}
/** Legacy base64 rows remain readable with the configured legacy/current key. */
function decryptSecret(blob) {
    if (!blob)
        return '';
    const match = /^v2:([A-Za-z0-9_-]{1,32}):(.+)$/.exec(blob);
    if (match) {
        const id = match[1];
        const secret = id === activeKeyId() ? activeSecret() : previousSecrets()[id];
        if (!secret)
            throw new Error('AI_PROVIDER_KEY_UNAVAILABLE');
        return decryptPayload(decodePayload(match[2]), encryptionKey(secret, id));
    }
    if (blob.startsWith('v2:'))
        throw new Error('AI_PROVIDER_CIPHERTEXT_INVALID');
    const legacy = process.env.CC_AI_LEGACY_KEY_SECRET || activeSecret();
    return decryptPayload(decodePayload(blob), (0, node_crypto_1.scryptSync)(legacy, LEGACY_SALT, 32));
}
//# sourceMappingURL=secret-cipher.util.js.map