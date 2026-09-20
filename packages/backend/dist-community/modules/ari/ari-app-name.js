"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_AUTODIAL_ARI_APP_NAME = exports.DEFAULT_ARI_APP_NAME = void 0;
exports.resolveAriAppName = resolveAriAppName;
exports.resolveAutodialAriAppName = resolveAutodialAriAppName;
exports.resolveAriApplicationNames = resolveAriApplicationNames;
/** Legacy scripted-robot Stasis application (override with ARI_APP_NAME). */
exports.DEFAULT_ARI_APP_NAME = 'krasterisk_voicerobots';
/** Dedicated Stasis application for autodial lifecycle events. */
exports.DEFAULT_AUTODIAL_ARI_APP_NAME = 'krasterisk_autodial';
/**
 * Stasis app name from env or ConfigService.
 * Only [A-Za-z0-9_-] — empty / invalid falls back to the default.
 */
function resolveAriAppName(raw) {
    const name = (raw ?? process.env.ARI_APP_NAME ?? '').trim();
    return sanitizeAriAppName(name, exports.DEFAULT_ARI_APP_NAME);
}
function resolveAutodialAriAppName(raw) {
    const name = (raw ?? process.env.ARI_AUTODIAL_APP_NAME ?? '').trim();
    return sanitizeAriAppName(name, exports.DEFAULT_AUTODIAL_ARI_APP_NAME);
}
/**
 * Resolve the applications served by this process. Asterisk allows one
 * WebSocket subscriber per Stasis application, so silently sharing a name
 * would make ownership dependent on connection order.
 */
function resolveAriApplicationNames(input) {
    const names = {
        scriptedVoiceRobots: resolveAriAppName(input?.scriptedVoiceRobots),
        autodial: resolveAutodialAriAppName(input?.autodial),
    };
    if (names.scriptedVoiceRobots === names.autodial) {
        throw new Error('ARI scripted-robot and autodial application names must differ');
    }
    return names;
}
function sanitizeAriAppName(name, fallback) {
    const sanitized = name.replace(/[^A-Za-z0-9_-]/g, '');
    return sanitized || fallback;
}
//# sourceMappingURL=ari-app-name.js.map