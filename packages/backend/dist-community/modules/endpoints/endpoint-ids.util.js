"use strict";
/**
 * SIP endpoint ID helpers.
 *
 * Primary:  e{extension}_{tenant}   e.g. e110_0
 * WebRTC:   ew{extension}_{tenant}  e.g. ew110_0
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildSipId = buildSipId;
exports.buildWebrtcSipId = buildWebrtcSipId;
exports.isWebrtcCompanion = isWebrtcCompanion;
exports.extractExtension = extractExtension;
exports.companionIdOf = companionIdOf;
exports.primaryIdOf = primaryIdOf;
exports.interfaceToExtension = interfaceToExtension;
/** Matches e110_0 or ew110_0; group1 = optional "w", group2 = extension, group3 = tenant */
const SIP_ID_RE = /^e(w?)(.+)_(\d+)$/;
const PRIMARY_ID_RE = /^e(?!w)(.+)_(\d+)$/;
function buildSipId(vpbxUserUid, extension) {
    return `e${extension}_${vpbxUserUid}`;
}
function buildWebrtcSipId(vpbxUserUid, extension) {
    return `ew${extension}_${vpbxUserUid}`;
}
function isWebrtcCompanion(sipId) {
    return /^ew.+_\d+$/.test(sipId);
}
/** Extract user-facing extension: e110_0 / ew110_0 → "110" */
function extractExtension(sipId) {
    const match = sipId.match(SIP_ID_RE);
    return match ? match[2] : sipId;
}
function companionIdOf(primaryId) {
    const match = primaryId.match(PRIMARY_ID_RE);
    if (!match)
        return null;
    return `ew${match[1]}_${match[2]}`;
}
function primaryIdOf(companionId) {
    const match = companionId.match(/^ew(.+)_(\d+)$/);
    if (!match)
        return null;
    return `e${match[1]}_${match[2]}`;
}
/**
 * Asterisk queue/agent interface → dialable extension.
 * PJSIP/ew110_0 → "110", PJSIP/e110_0 → "110"
 */
function interfaceToExtension(iface) {
    const id = iface.includes('/') ? iface.split('/').pop() || iface : iface;
    return extractExtension(id);
}
//# sourceMappingURL=endpoint-ids.util.js.map