"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DomainError = void 0;
exports.authorizeToolCall = authorizeToolCall;
exports.schemaDigest = schemaDigest;
exports.newToolId = newToolId;
const node_crypto_1 = require("node:crypto");
class DomainError extends Error {
    code;
    status;
    constructor(code, status, message) {
        super(message ? `${code}: ${message}` : code);
        this.code = code;
        this.status = status;
    }
}
exports.DomainError = DomainError;
function authorizeToolCall(call) {
    if (call.sideEffect === 'mutate' && call.policy === 'deny_mutate') {
        throw new DomainError('unsafe_binding', 403);
    }
    if (call.simulated)
        return { allowed: true, mode: 'simulated' };
    if (call.sideEffect === 'mutate' && call.policy === 'sandbox')
        return { allowed: true, mode: 'sandbox' };
    if (call.sideEffect === 'mutate' && call.policy !== 'approved')
        throw new DomainError('unsafe_binding', 403);
    return { allowed: true, mode: 'live' };
}
function schemaDigest(schema) {
    return (0, node_crypto_1.createHash)('sha256').update(JSON.stringify(schema)).digest('hex');
}
function newToolId() {
    return (0, node_crypto_1.randomUUID)();
}
//# sourceMappingURL=tool-gateway.js.map