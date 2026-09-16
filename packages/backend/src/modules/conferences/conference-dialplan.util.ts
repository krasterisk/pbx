import { AsteriskDialplanUtils } from '../../shared/utils/dialplan.util';
import { normalizeTarget } from '../../shared/utils/dialplan-target.util';
import type { GeneratedDialplanCategory } from '../call-groups/call-group-dialplan.util';

export const CONFBRIDGE_BRIDGE_PROFILE = 'krsk_conf_sfu';

/** Shared platform codec list — used by static profile bootstrap and later provisioning. */
export const CONFERENCE_PLATFORM_CODECS: string[] = ['opus', 'ulaw', 'vp8'];

export function conferenceRoomContextName(roomUid: number): string {
  return `krsk-conf-${roomUid}`;
}

export function conferenceMaskContextName(vpbx: number): string {
  return `krsk-conf-mask-${vpbx}`;
}

const MASK_INDEX_NUMBER = /^\d{1,32}$/;
const MASK_NOT_FOUND_EXTEN = 'not-found';

function maskIndexNumber(raw: string): string | null {
  const number = AsteriskDialplanUtils.sanitizeDialplanInput(raw);
  return MASK_INDEX_NUMBER.test(number) ? number : null;
}

/**
 * Tenant mask-index: resolve a dialed room number to krsk-conf-{uid}.
 * Numbers stay strings (007 stays 007). Invalid numbers are skipped silently.
 */
export function generateConferenceMaskIndex(
  rooms: Array<{ uid: number; number: string }>,
  vpbx: number,
): GeneratedDialplanCategory {
  const name = conferenceMaskContextName(vpbx);
  const entries = rooms
    .map((room) => {
      const number = maskIndexNumber(room.number);
      return number ? { uid: room.uid, number } : null;
    })
    .filter((entry): entry is { uid: number; number: string } => entry !== null)
    .sort((a, b) => a.uid - b.uid);

  const lines: string[] = [];
  for (const room of entries) {
    const ctx = conferenceRoomContextName(room.uid);
    lines.push(
      `exten => ${room.number},1,GotoIf($["\${DIALPLAN_EXISTS(${ctx},s,1)}" = "1"]?${ctx},s,1:${MASK_NOT_FOUND_EXTEN},1)`,
    );
  }
  lines.push(`exten => _X.,1,Goto(${MASK_NOT_FOUND_EXTEN},1)`);
  lines.push(`exten => i,1,Goto(${MASK_NOT_FOUND_EXTEN},1)`);
  lines.push(`exten => ${MASK_NOT_FOUND_EXTEN},1,NoOp(Conference room not found)`);
  lines.push('same => n,Playback(invalid)');
  lines.push('same => n,Hangup()');
  return { name, lines };
}

export interface ConferenceDialplanRoom {
  uid: number;
  number: string;
  name?: string | null;
  pin?: string | null;
  wait_marked?: boolean | number | null;
  end_marked?: boolean | number | null;
  musiconhold?: string | null;
  announce_join_leave?: boolean | number | null;
  tariff_max_participants?: number | null;
  record_mode?: string | null;
}

function isFilledFlag(value: boolean | number | null | undefined): boolean {
  return value === true || value === 1;
}

function filledText(value: string | null | undefined): string {
  return AsteriskDialplanUtils.sanitizeDialplanInput(value ?? '');
}

/**
 * Emit tenant room settings as CONFBRIDGE() overrides.
 * Order is fixed so two calls with the same room produce identical lines.
 * Never emits video_mode (Pitfall 1 — only the static template may set it).
 */
function emitFilledSettings(room: ConferenceDialplanRoom): string[] {
  const lines: string[] = [];
  const maxMembers = room.tariff_max_participants;
  if (typeof maxMembers === 'number' && Number.isFinite(maxMembers) && maxMembers > 0) {
    lines.push(`same => n,Set(CONFBRIDGE(bridge,max_members)=${Math.trunc(maxMembers)})`);
  }
  if (room.record_mode && room.record_mode !== 'off') {
    const mode = filledText(room.record_mode);
    if (mode) {
      lines.push(`same => n,Set(CONFBRIDGE(bridge,record_conference)=${mode === 'auto' || mode === 'both' ? 'yes' : mode})`);
    }
  }
  const pin = filledText(room.pin ?? undefined);
  if (pin) {
    lines.push(`same => n,Set(CONFBRIDGE(user,pin)=${pin})`);
  }
  if (isFilledFlag(room.wait_marked)) {
    lines.push('same => n,Set(CONFBRIDGE(user,wait_marked)=yes)');
  }
  if (isFilledFlag(room.end_marked)) {
    lines.push('same => n,Set(CONFBRIDGE(user,end_marked)=yes)');
  }
  const moh = filledText(room.musiconhold ?? undefined);
  if (moh) {
    lines.push(`same => n,Set(CONFBRIDGE(user,music_on_hold_class)=${moh})`);
  }
  if (isFilledFlag(room.announce_join_leave)) {
    lines.push('same => n,Set(CONFBRIDGE(user,announce_join_leave)=yes)');
  }
  return lines;
}

export function generateConferenceDialplan(
  room: ConferenceDialplanRoom,
  vpbx: number,
): GeneratedDialplanCategory {
  const name = conferenceRoomContextName(room.uid);
  const conference = normalizeTarget('conference', { source: 'fixed', value: room.number }, vpbx);
  const label = filledText(room.name) || conference;
  const lines: string[] = [
    `[${name}]`,
    `exten => s,1,NoOp(Conference room ${conference} ${label})`,
    'same => n,Answer()',
    `same => n,Set(CONFBRIDGE(bridge,template)=${CONFBRIDGE_BRIDGE_PROFILE})`,
    ...emitFilledSettings(room),
    `same => n,ConfBridge(${conference},${CONFBRIDGE_BRIDGE_PROFILE})`,
    'same => n,Hangup()',
  ];
  return { name, lines };
}
