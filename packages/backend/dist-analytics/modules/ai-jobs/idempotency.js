"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.digestIdempotencyKey = digestIdempotencyKey;
exports.canonicalRequestHash = canonicalRequestHash;
const node_crypto_1 = require("node:crypto");
const PRINTABLE_ASCII = /^[\x20-\x7E]{1,128}$/;
function digestIdempotencyKey(key) {
    if (!PRINTABLE_ASCII.test(key)) {
        throw Object.assign(new Error('Idempotency-Key must be 1..128 ASCII characters'), { code: 'idempotency_key_invalid' });
    }
    return (0, node_crypto_1.createHash)('sha256').update(key, 'ascii').digest();
}
function canonicalRequestHash(fields) {
    const keys = Object.keys(fields).sort();
    const canonical = JSON.stringify(keys.map(key => [key, fields[key]]));
    return (0, node_crypto_1.createHash)('sha256').update(canonical).digest('hex');
}
//# sourceMappingURL=idempotency.js.map