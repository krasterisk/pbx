"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CONFERENCE_PLATFORM_CODECS = exports.CONFERENCE_RECORDING_ANNOUNCEMENT_PROMPT = exports.CONFBRIDGE_BRIDGE_PROFILE = void 0;
exports.conferenceRoomContextName = conferenceRoomContextName;
exports.conferenceMaskContextName = conferenceMaskContextName;
exports.generateConferenceMaskIndex = generateConferenceMaskIndex;
exports.generateConferenceDialplan = generateConferenceDialplan;
const dialplan_util_1 = require("../../shared/utils/dialplan.util");
const dialplan_target_util_1 = require("../../shared/utils/dialplan-target.util");
const conference_entry_policy_util_1 = require("./conference-entry-policy.util");
const conference_roles_util_1 = require("./conference-roles.util");
exports.CONFBRIDGE_BRIDGE_PROFILE = 'krsk_conf_sfu';
/** Stock sound already used by call-group confirm; join-time notice when notify_recording is on. */
exports.CONFERENCE_RECORDING_ANNOUNCEMENT_PROMPT = 'beep';
/** Shared platform codec list — used by static profile bootstrap and later provisioning. */
exports.CONFERENCE_PLATFORM_CODECS = ['opus', 'ulaw', 'vp8'];
function conferenceRoomContextName(roomUid) {
    return `krsk-conf-${roomUid}`;
}
function conferenceMaskContextName(vpbx) {
    return `krsk-conf-mask-${vpbx}`;
}
const MASK_INDEX_NUMBER = /^\d{1,32}$/;
const MASK_NOT_FOUND_EXTEN = 'not-found';
function maskIndexNumber(raw) {
    const number = dialplan_util_1.AsteriskDialplanUtils.sanitizeDialplanInput(raw);
    return MASK_INDEX_NUMBER.test(number) ? number : null;
}
/**
 * Tenant mask-index: resolve a dialed room number to krsk-conf-{uid}.
 * Numbers stay strings (007 stays 007). Invalid numbers are skipped silently.
 */
function generateConferenceMaskIndex(rooms, vpbx) {
    const name = conferenceMaskContextName(vpbx);
    const entries = rooms
        .map((room) => {
        const number = maskIndexNumber(room.number);
        return number ? { uid: room.uid, number } : null;
    })
        .filter((entry) => entry !== null)
        .sort((a, b) => a.uid - b.uid);
    const lines = [];
    for (const room of entries) {
        const ctx = conferenceRoomContextName(room.uid);
        lines.push(`exten => ${room.number},1,GotoIf($["\${DIALPLAN_EXISTS(${ctx},s,1)}" = "1"]?${ctx},s,1:${MASK_NOT_FOUND_EXTEN},1)`);
    }
    lines.push(`exten => _X.,1,Goto(${MASK_NOT_FOUND_EXTEN},1)`);
    lines.push(`exten => i,1,Goto(${MASK_NOT_FOUND_EXTEN},1)`);
    lines.push(`exten => ${MASK_NOT_FOUND_EXTEN},1,NoOp(Conference room not found)`);
    lines.push('same => n,Playback(invalid)');
    lines.push('same => n,Hangup()');
    return { name, lines };
}
function isFilledFlag(value) {
    return value === true || value === 1;
}
function filledText(value) {
    return dialplan_util_1.AsteriskDialplanUtils.sanitizeDialplanInput(value ?? '');
}
/**
 * Emit tenant room settings as CONFBRIDGE() overrides.
 * Order is fixed so two calls with the same room produce identical lines.
 * Never emits video_mode (Pitfall 1 — only the static template may set it).
 */
function emitFilledSettings(room) {
    const lines = [];
    const maxMembers = room.effective_max_participants ?? room.tariff_max_participants;
    if (typeof maxMembers === 'number' && Number.isFinite(maxMembers) && maxMembers > 0) {
        lines.push(`same => n,Set(CONFBRIDGE(bridge,max_members)=${Math.trunc(maxMembers)})`);
    }
    const policy = (0, conference_entry_policy_util_1.conferenceEntryPolicy)(room);
    const pin = policy.requiresPin ? filledText(policy.pin) : '';
    if (pin) {
        lines.push(`same => n,Set(CONFBRIDGE(user,pin)=${pin})`);
    }
    const moh = filledText(room.musiconhold ?? undefined);
    if (moh) {
        lines.push(`same => n,Set(CONFBRIDGE(user,music_on_hold_class)=${moh})`);
    }
    if (isFilledFlag(room.announce_join_leave)) {
        lines.push('same => n,Set(CONFBRIDGE(user,announce_join_leave)=yes)');
    }
    if (isFilledFlag(room.notify_recording)) {
        lines.push(`same => n,Set(CONFBRIDGE(user,announcement)=${filledText(exports.CONFERENCE_RECORDING_ANNOUNCEMENT_PROMPT)})`);
    }
    return lines;
}
function emitPermanentRights(rights) {
    if (rights.length === 0)
        return [];
    const lines = ['same => n,Set(CONF_ROLE=participant)'];
    for (const right of rights) {
        const endpointRef = dialplan_util_1.AsteriskDialplanUtils.sanitizeDialplanInput(right.endpointRef);
        if (!endpointRef)
            continue;
        lines.push(`same => n,ExecIf($["\${CALLERID(num)}" = "${endpointRef}"]?Set(CONF_ROLE=${right.role}))`);
    }
    const elevated = conference_roles_util_1.CONFBRIDGE_ROLE_FLAGS.moderator;
    if (elevated.admin) {
        lines.push('same => n,ExecIf($["${CONF_ROLE}" != "participant"]?Set(CONFBRIDGE(user,admin)=yes))');
    }
    if (elevated.marked) {
        lines.push('same => n,ExecIf($["${CONF_ROLE}" != "participant"]?Set(CONFBRIDGE(user,marked)=yes))');
    }
    return lines;
}
function emitParticipantMarkedPolicy(policy) {
    const lines = [];
    if (policy.requiresWaitMarked) {
        lines.push('same => n,ExecIf($["${CONF_ROLE}" = "participant"]?Set(CONFBRIDGE(user,wait_marked)=yes))');
    }
    if (policy.requiresEndMarked) {
        lines.push('same => n,ExecIf($["${CONF_ROLE}" = "participant"]?Set(CONFBRIDGE(user,end_marked)=yes))');
    }
    return lines;
}
function generateConferenceDialplan(room, vpbx, permanentRights = []) {
    const name = conferenceRoomContextName(room.uid);
    const conference = (0, dialplan_target_util_1.normalizeTarget)('conference', { source: 'fixed', value: room.number }, vpbx);
    const label = filledText(room.name) || conference;
    const policy = (0, conference_entry_policy_util_1.conferenceEntryPolicy)(room);
    const rightsLines = emitPermanentRights(permanentRights);
    const markedLines = emitParticipantMarkedPolicy(policy);
    const roleStarter = markedLines.length > 0 && rightsLines.length === 0
        ? ['same => n,Set(CONF_ROLE=participant)']
        : [];
    const lines = [
        `[${name}]`,
        `exten => s,1,NoOp(Conference room ${conference} ${label})`,
        'same => n,Answer()',
        `same => n,Set(CONFBRIDGE(bridge,template)=${exports.CONFBRIDGE_BRIDGE_PROFILE})`,
        ...emitFilledSettings(room),
        ...roleStarter,
        ...rightsLines,
        ...markedLines,
        `same => n,ConfBridge(${conference},${exports.CONFBRIDGE_BRIDGE_PROFILE})`,
        'same => n,Hangup()',
    ];
    return { name, lines };
}
//# sourceMappingURL=conference-dialplan.util.js.map