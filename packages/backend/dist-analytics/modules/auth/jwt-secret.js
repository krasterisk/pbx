"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireJwtSecret = requireJwtSecret;
function requireJwtSecret(config) {
    const secret = config.get('JWT_SECRET');
    if (!secret || secret.trim().length < 32 || secret === 'krasterisk-v4-secret') {
        throw new Error('JWT_SECRET must be explicitly configured with at least 32 characters');
    }
    return secret;
}
//# sourceMappingURL=jwt-secret.js.map