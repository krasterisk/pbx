import type { ConferenceRole } from '../conference-roles.util';
import type {
  ConferenceParticipantState,
  ConferenceRoomSnapshot,
} from '../conference-state.service';

export const DISPLAY_NAME_MAX_LENGTH = 64;
export const ANONYMOUS_DISPLAY_NAME = 'Participant';

export interface ConferenceParticipantDto {
  ref: string;
  displayName: string;
  role: ConferenceRole;
  speaking: boolean;
  muted: boolean;
  video: boolean;
}

export interface ConferenceRoomStateDto {
  participants: ConferenceParticipantDto[];
  waitingForModerator: boolean;
}

export type ConferenceParticipantDtoSource = ConferenceParticipantState & {
  callerIdName?: string;
  video?: boolean;
};

function truncateDisplayName(value: string): string {
  return [...value].slice(0, DISPLAY_NAME_MAX_LENGTH).join('');
}

export function toConferenceParticipantDto(
  state: ConferenceParticipantDtoSource,
): ConferenceParticipantDto {
  const callerIdNum = String(state.callerIdNum ?? '').trim();
  const givenName = String(state.callerIdName ?? '').trim();
  const displayName = truncateDisplayName(givenName || callerIdNum || ANONYMOUS_DISPLAY_NAME);
  return {
    ref: callerIdNum || ANONYMOUS_DISPLAY_NAME.toLowerCase(),
    displayName,
    role: state.role,
    speaking: Boolean(state.talking),
    muted: Boolean(state.muted),
    video: Boolean(state.video),
  };
}

export function toConferenceRoomStateDto(
  room: ConferenceRoomSnapshot,
): ConferenceRoomStateDto {
  return {
    participants: (room.participants ?? []).map((item) => toConferenceParticipantDto(item)),
    waitingForModerator: Boolean(room.waitingForModerator),
  };
}
