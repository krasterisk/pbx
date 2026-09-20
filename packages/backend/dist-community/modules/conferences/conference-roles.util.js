"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CONFBRIDGE_ROLE_FLAGS = void 0;
exports.roleFromConfbridgeFlags = roleFromConfbridgeFlags;
exports.resolveRoleForCaller = resolveRoleForCaller;
exports.CONFBRIDGE_ROLE_FLAGS = {
    owner: { admin: true, marked: true },
    moderator: { admin: true, marked: true },
    participant: { admin: false, marked: false },
};
function isYes(value) {
    return String(value ?? '').toLowerCase() === 'yes';
}
/**
 * Role from ConfBridge event flags only. Owner and moderator share the same
 * admin/marked pair, so this never returns `owner`.
 */
function roleFromConfbridgeFlags(evt) {
    if (isYes(evt.Admin) && isYes(evt.MarkedUser))
        return 'moderator';
    if (isYes(evt.Admin) || isYes(evt.MarkedUser))
        return 'moderator';
    return 'participant';
}
/**
 * Server-side role from caller identity and room settings.
 * Owner wins over a simultaneous moderator listing and over a live grant.
 * A live grant may raise a participant, never lower an owner.
 */
function resolveRoleForCaller(callerRef, settings) {
    if (callerRef && settings.ownerRef && callerRef === settings.ownerRef) {
        return 'owner';
    }
    const live = settings.liveGrants?.find((grant) => grant.participantRef === callerRef);
    if (live?.role === 'owner')
        return 'owner';
    if (callerRef && settings.moderatorRefs.includes(callerRef))
        return 'moderator';
    if (live?.role === 'moderator')
        return 'moderator';
    return 'participant';
}
//# sourceMappingURL=conference-roles.util.js.map