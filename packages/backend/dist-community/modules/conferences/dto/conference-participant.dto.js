"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ANONYMOUS_DISPLAY_NAME = exports.DISPLAY_NAME_MAX_LENGTH = void 0;
exports.truncateDisplayName = truncateDisplayName;
exports.toConferenceParticipantDto = toConferenceParticipantDto;
exports.toConferenceRoomStateDto = toConferenceRoomStateDto;
exports.DISPLAY_NAME_MAX_LENGTH = 64;
exports.ANONYMOUS_DISPLAY_NAME = 'Participant';
function truncateDisplayName(value) {
    return [...value].slice(0, exports.DISPLAY_NAME_MAX_LENGTH).join('');
}
function toConferenceParticipantDto(state) {
    const callerIdNum = String(state.callerIdNum ?? '').trim();
    const overlay = String(state.displayName ?? '').trim();
    const givenName = String(state.callerIdName ?? '').trim();
    const displayName = truncateDisplayName(overlay || givenName || callerIdNum || exports.ANONYMOUS_DISPLAY_NAME);
    return {
        ref: callerIdNum || exports.ANONYMOUS_DISPLAY_NAME.toLowerCase(),
        displayName,
        role: state.role,
        speaking: Boolean(state.talking),
        muted: Boolean(state.muted),
        video: Boolean(state.video),
    };
}
function toConferenceRoomStateDto(room) {
    return {
        participants: (room.participants ?? []).map((item) => toConferenceParticipantDto(item)),
        waitingForModerator: Boolean(room.waitingForModerator),
        recording: Boolean(room.recording),
    };
}
//# sourceMappingURL=conference-participant.dto.js.map