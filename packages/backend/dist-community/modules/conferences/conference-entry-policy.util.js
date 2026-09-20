"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.conferenceEntryPolicy = conferenceEntryPolicy;
function isFilledFlag(value) {
    return value === true || value === 1;
}
function normalizePin(pin) {
    return String(pin ?? '').trim();
}
/**
 * Translate room entry settings into decisions. No I/O, no exceptions, no dialplan.
 * Strictness only raises wait/PIN requirements; a filled wait_marked/end_marked column still applies.
 */
function conferenceEntryPolicy(room) {
    const strictness = room.entry_strictness ?? 'token_name';
    const requiresPin = strictness === 'token_name_pin' || strictness === 'token_name_pin_moderator';
    const pin = normalizePin(room.pin);
    const requiresWaitMarked = strictness === 'token_name_pin_moderator' || isFilledFlag(room.wait_marked);
    const requiresEndMarked = isFilledFlag(room.end_marked);
    return {
        requiresPin,
        pin,
        requiresWaitMarked,
        requiresEndMarked,
        pinRequiredButMissing: requiresPin && pin.length === 0,
    };
}
//# sourceMappingURL=conference-entry-policy.util.js.map