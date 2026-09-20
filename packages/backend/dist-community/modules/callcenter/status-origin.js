"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PANEL_PAUSE_AUTHORITY_ORIGINS = void 0;
exports.isTrustedPanelPauseOrigin = isTrustedPanelPauseOrigin;
exports.canPanelOverrideAsteriskPause = canPanelOverrideAsteriskPause;
/** Origins that may drive QueuePause to match panel READY / PAUSED / OUTBOUND_WORK. */
exports.PANEL_PAUSE_AUTHORITY_ORIGINS = new Set([
    'manual',
    'policy',
    'login',
    'restore',
]);
function isTrustedPanelPauseOrigin(origin) {
    if (!origin)
        return false;
    return exports.PANEL_PAUSE_AUTHORITY_ORIGINS.has(origin);
}
/**
 * Convincing check: panel READY/PAUSED/OUTBOUND_WORK may override Asterisk only when
 * provenance is trusted and the status itself looks intentional (not a ghost).
 */
function canPanelOverrideAsteriskPause(opts) {
    const status = opts.status;
    if (status !== 'READY' && status !== 'PAUSED' && status !== 'OUTBOUND_WORK') {
        return false;
    }
    let origin = opts.statusOrigin;
    if (!isTrustedPanelPauseOrigin(origin)) {
        // After Nest restart RAM may lack origin — accept session snapshot if it
        // matches the live status and was itself trusted.
        if (opts.sessionStatus === status
            && isTrustedPanelPauseOrigin(opts.sessionStatusOrigin)) {
            origin = opts.sessionStatusOrigin;
        }
        else {
            return false;
        }
    }
    if (status === 'PAUSED') {
        const reason = String(opts.pauseReason || '').trim();
        // Manual / supervisor / catalog reason, or auto_pause:* / outbound_work codes.
        if (!reason)
            return false;
    }
    if (status === 'OUTBOUND_WORK') {
        const reason = String(opts.pauseReason || '').trim();
        if (reason && reason !== 'outbound_work')
            return false;
    }
    return isTrustedPanelPauseOrigin(origin);
}
//# sourceMappingURL=status-origin.js.map