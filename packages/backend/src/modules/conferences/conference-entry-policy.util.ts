export type ConferenceEntryStrictness =
  | 'token_name'
  | 'token_name_pin'
  | 'token_name_pin_moderator';

export interface ConferenceEntryPolicyRoom {
  entry_strictness?: ConferenceEntryStrictness | null;
  pin?: string | null;
  wait_marked?: boolean | number | null;
  end_marked?: boolean | number | null;
}

export interface ConferenceEntryPolicy {
  requiresPin: boolean;
  pin: string;
  requiresWaitMarked: boolean;
  requiresEndMarked: boolean;
  pinRequiredButMissing: boolean;
}

function isFilledFlag(value: boolean | number | null | undefined): boolean {
  return value === true || value === 1;
}

function normalizePin(pin: string | null | undefined): string {
  return String(pin ?? '').trim();
}

/**
 * Translate room entry settings into decisions. No I/O, no exceptions, no dialplan.
 * Strictness only raises wait/PIN requirements; a filled wait_marked/end_marked column still applies.
 */
export function conferenceEntryPolicy(room: ConferenceEntryPolicyRoom): ConferenceEntryPolicy {
  const strictness = room.entry_strictness ?? 'token_name';
  const requiresPin =
    strictness === 'token_name_pin' || strictness === 'token_name_pin_moderator';
  const pin = normalizePin(room.pin);
  const requiresWaitMarked =
    strictness === 'token_name_pin_moderator' || isFilledFlag(room.wait_marked);
  const requiresEndMarked = isFilledFlag(room.end_marked);
  return {
    requiresPin,
    pin,
    requiresWaitMarked,
    requiresEndMarked,
    pinRequiredButMissing: requiresPin && pin.length === 0,
  };
}
