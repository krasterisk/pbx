"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.integrationKeyDigest = integrationKeyDigest;
exports.generateIntegrationKey = generateIntegrationKey;
exports.compareIntegrationKey = compareIntegrationKey;
const node_crypto_1 = require("node:crypto");
const canonicalPart = (value, bytes) => /^[A-Za-z0-9_-]+$/.test(value)
    && Buffer.from(value, 'base64url').length === bytes
    && Buffer.from(value, 'base64url').toString('base64url') === value;
/** Version and NUL delimiters are part of the stored digest domain. */
function integrationKeyDigest(selector, secret) {
    return (0, node_crypto_1.createHash)('sha256')
        .update('krint_v1\0', 'utf8').update(selector, 'ascii')
        .update('\0', 'utf8').update(secret, 'ascii').digest();
}
function generateIntegrationKey() {
    const selector = (0, node_crypto_1.randomBytes)(16).toString('base64url');
    const secret = (0, node_crypto_1.randomBytes)(32).toString('base64url');
    return {
        selector, secret, token: `krint_v1_${selector}_${secret}`,
        digest: integrationKeyDigest(selector, secret),
    };
}
function compareIntegrationKey(selector, secret, storedDigest) {
    const shapeValid = canonicalPart(selector, 16) && canonicalPart(secret, 32);
    const actual = shapeValid ? integrationKeyDigest(selector, secret) : Buffer.alloc(32);
    const expected = Buffer.isBuffer(storedDigest) && storedDigest.length === 32
        ? storedDigest : Buffer.alloc(32);
    // Run the same fixed-size comparison for absent selectors and bad digests.
    const equal = (0, node_crypto_1.timingSafeEqual)(actual, expected);
    return shapeValid && Buffer.isBuffer(storedDigest) && storedDigest.length === 32 && equal;
}
//# sourceMappingURL=integration-key.crypto.js.map