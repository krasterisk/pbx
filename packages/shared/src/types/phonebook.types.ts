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

/** When a binding's policy activates: on the matched entry, or on no match (whitelist-style). */
export type PhonebookMatchMode = 'on_match' | 'on_no_match';

/**
 * Behavior preset for a route<->phonebook binding.
 * - set_name: CALLERID(name) = PB_<var_key>
 * - set_number: CALLERID(num) = PB_<var_key> or a fixed value
 * - blacklist: Hangup()
 * - whitelist: Hangup() (UI forces match_mode=on_no_match)
 * - redirect: Goto(target_context, PB_<var_key> or fixed_exten, 1)
 * - vars_only: PB_* vars are set, no further action
 * - custom: renders binding.actions via AsteriskDialplanUtils.actionToDialplan
 */
export type PhonebookBehaviorType =
  | 'set_name'
  | 'set_number'
  | 'blacklist'
  | 'whitelist'
  | 'redirect'
  | 'vars_only'
  | 'custom';

export interface IPhonebookBehaviorParams {
  /** Var key to read from the matched entry (e.g. "name", "clid", "redirect") */
  var_key?: string;
  /** Fixed value to use instead of a var key (set_number) */
  fixed?: string;
  /** Fixed extension to redirect to instead of a var key (redirect) */
  fixed_exten?: string;
  /** Target context for redirect (defaults to the tenanted context of the owning route) */
  target_context?: string;
}

/**
 * Route Phonebook — a named collection of phone numbers.
 *
 * Pure data (D-04): behavior lives on the binding, not on the phonebook itself.
 * A phonebook is reused across many bindings, each with its own match_mode/behavior (D-02).
 */
export interface IRoutePhonebook {
  uid: number;
  /** Display name (e.g. "Blacklist", "VIP-клиенты") */
  name: string;
  /** Optional description */
  description?: string;
  /** Owner user (vpbx_user_uid) */
  user_uid: number;
  created_at?: string;
  updated_at?: string;
  entries?: IPhonebookEntry[];
}

/**
 * Route <-> Phonebook binding (D-05): connects a route to a phonebook with
 * an ordered policy (match_mode + behavior). One phonebook can be bound to
 * many routes, each with different behavior (D-02, D-03).
 */
export interface IRoutePhonebookBinding {
  uid?: number;
  route_uid?: number;
  phonebook_uid: number;
  /** Order within the route's binding chain — lower runs first */
  position: number;
  match_mode: PhonebookMatchMode;
  behavior_type: PhonebookBehaviorType;
  behavior_params?: IPhonebookBehaviorParams | null;
  /** Dialplan actions rendered when behavior_type = 'custom' */
  actions?: IRouteAction[] | null;
  /** Populated on read for display (name, description) */
  phonebook?: IRoutePhonebook;
}

/**
 * DTO for creating/updating a phonebook via API.
 */
export interface ICreatePhonebookDto {
  name: string;
  description?: string;
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
