import type { IRouteAction } from './route.types';

/**
 * A single entry (phone number) within a route phonebook.
 *
 * `vars` contains arbitrary key-value pairs that become
 * `PB_<key>` Asterisk channel variables when CallerID matches.
 */
export interface IPhonebookEntry {
  uid: number;
  phonebook_uid: number;
  /** Phone number or pattern (e.g. "+79001234567", "8800*", "_X.") */
  number: string;
  /** UI-only description (not passed to dialplan) */
  comment?: string;
  /** Arbitrary key-value pairs → PB_<key> channel variables */
  vars?: Record<string, string>;
  created_at?: string;
}

/**
 * Route Phonebook — a named collection of phone numbers
 * with associated dialplan actions and optional inversion logic.
 *
 * When a route references this phonebook, the dialplan generates:
 *   Gosub(phonebook_check_${uid}_${vpbx},s,1)
 *
 * Inside the sub-context:
 *   - CURL lookup checks if CallerID matches an entry
 *   - If match → set PB_<key> vars from entry, then execute actions[]
 *   - If invert=true → execute actions[] on NON-match instead
 *   - Gosub always returns to the calling context via Return()
 *     unless an action explicitly does Hangup/Goto
 */
export interface IRoutePhonebook {
  uid: number;
  /** Display name (e.g. "Blacklist", "VIP-клиенты") */
  name: string;
  /** Optional description */
  description?: string;
  /**
   * When true, actions execute on CallerID NOT in the list.
   * Useful for whitelist mode ("block everyone except VIP").
   */
  invert: boolean;
  /** Dialplan actions to execute on match (or non-match if inverted) */
  actions: IRouteAction[];
  /** Owner user (vpbx_user_uid) */
  user_uid: number;
  created_at?: string;
  updated_at?: string;
}

/**
 * DTO for creating/updating a phonebook via API.
 */
export interface ICreatePhonebookDto {
  name: string;
  description?: string;
  invert?: boolean;
  actions?: IRouteAction[];
  /** Entries to create along with the phonebook */
  entries?: Array<{ number: string; comment?: string; vars?: Record<string, string> }>;
}

/**
 * DTO for CSV import of entries.
 */
export interface IPhonebookCsvImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}
