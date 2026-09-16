import type { TranslateFn } from '@/shared/lib/translateFn';

export type ConferenceParticipantRole = 'owner' | 'moderator' | 'participant';

const ROLE_LABEL_KEYS: Record<ConferenceParticipantRole, string> = {
  owner: 'conferences.live.roleOwner',
  moderator: 'conferences.live.roleModerator',
  participant: 'conferences.live.roleMember',
};

/** Maps a conference role to localized plain text. Never returns HTML. */
export function roleLabel(role: ConferenceParticipantRole, t: TranslateFn): string {
  const key = ROLE_LABEL_KEYS[role];
  if (!key) return '';
  return String(t(key));
}
