"use strict";
/**
 * Central secret / credential redaction for agent tool args and results.
 * Never accept or echo passwords, API keys, provider secrets in chat/tool payloads.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.redactSecrets = redactSecrets;
exports.assertNoSecretArgs = assertNoSecretArgs;
const SECRET_KEY = /pass(word)?|secret|api[_-]?key|token|authorization|credential|private[_-]?key|auth[_-]?trunk/i;
function redactSecrets(value) {
    return redact(value);
}
function redact(value) {
    if (Array.isArray(value))
        return value.map(redact);
    if (!value || typeof value !== 'object')
        return value;
    const out = {};
    for (const [key, child] of Object.entries(value)) {
        if (SECRET_KEY.test(key)) {
            out[key] = typeof child === 'string' && child.length === 0 ? '' : '[REDACTED]';
            continue;
        }
        out[key] = redact(child);
    }
    return out;
}
function assertNoSecretArgs(args) {
    const walk = (value, path) => {
        if (Array.isArray(value)) {
            value.forEach((item, i) => walk(item, `${path}[${i}]`));
            return;
        }
        if (!value || typeof value !== 'object')
            return;
        for (const [key, child] of Object.entries(value)) {
            if (SECRET_KEY.test(key) && child != null && child !== '') {
                throw new Error(`SECRET_ARG_FORBIDDEN:${path ? `${path}.` : ''}${key}`);
            }
            walk(child, path ? `${path}.${key}` : key);
        }
    };
    walk(args, '');
}
//# sourceMappingURL=ai-secret-redaction.js.map