export type ConferenceRole = 'owner' | 'moderator' | 'participant';

export const CONFBRIDGE_ROLE_FLAGS: Record<ConferenceRole, { admin: boolean; marked: boolean }> = {
  owner: { admin: true, marked: true },
  moderator: { admin: true, marked: true },
  participant: { admin: false, marked: false },
};

export interface ConfbridgeFlagEvent {
  Admin?: string;
  MarkedUser?: string;
}

export interface ConferenceCallerRights {
  ownerRef: string | null;
  moderatorRefs: string[];
  liveGrants?: Array<{ participantRef: string; role: ConferenceRole }>;
}

function isYes(value: unknown): boolean {
  return String(value ?? '').toLowerCase() === 'yes';
}

/**
 * Role from ConfBridge event flags only. Owner and moderator share the same
 * admin/marked pair, so this never returns `owner`.
 */
export function roleFromConfbridgeFlags(evt: ConfbridgeFlagEvent): ConferenceRole {
  if (isYes(evt.Admin) && isYes(evt.MarkedUser)) return 'moderator';
  if (isYes(evt.Admin) || isYes(evt.MarkedUser)) return 'moderator';
  return 'participant';
}

/**
 * Server-side role from caller identity and room settings.
 * Owner wins over a simultaneous moderator listing and over a live grant.
 * A live grant may raise a participant, never lower an owner.
 */
export function resolveRoleForCaller(
  callerRef: string,
  settings: ConferenceCallerRights,
): ConferenceRole {
  if (callerRef && settings.ownerRef && callerRef === settings.ownerRef) {
    return 'owner';
  }
  const live = settings.liveGrants?.find((grant) => grant.participantRef === callerRef);
  if (live?.role === 'owner') return 'owner';
  if (callerRef && settings.moderatorRefs.includes(callerRef)) return 'moderator';
  if (live?.role === 'moderator') return 'moderator';
  return 'participant';
}
