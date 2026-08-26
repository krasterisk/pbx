import type { ActionType } from './route.types';

export type DialplanTerminal = 'always' | 'conditional' | 'never';
export type DialplanHost = 'route' | 'phonebook' | 'ivr';
export type DialplanFamily = 'address' | 'media' | 'control' | 'integration';

export interface IDialplanActionMeta {
  terminal: DialplanTerminal;
  allowedIn: ReadonlyArray<DialplanHost>;
  family: DialplanFamily;
}

const ALL_HOSTS: ReadonlyArray<DialplanHost> = ['route', 'phonebook', 'ivr'];
const ROUTE_ONLY: ReadonlyArray<DialplanHost> = ['route'];

/**
 * Single source of truth for terminal / per-host / family flags (D-24).
 * Frontend registry (12-07) and unreachable-tail warning (12-06) MUST read this
 * table instead of duplicating it.
 */
export const DIALPLAN_ACTION_META: Record<ActionType, IDialplanActionMeta> = {
  totrunk: { terminal: 'conditional', allowedIn: ALL_HOSTS, family: 'address' },
  toexten: { terminal: 'conditional', allowedIn: ALL_HOSTS, family: 'address' },
  toqueue: { terminal: 'conditional', allowedIn: ALL_HOSTS, family: 'address' },
  togroup: { terminal: 'conditional', allowedIn: ALL_HOSTS, family: 'address' },
  tolist: { terminal: 'conditional', allowedIn: ALL_HOSTS, family: 'address' },
  toivr: { terminal: 'always', allowedIn: ALL_HOSTS, family: 'address' },
  toroute: { terminal: 'always', allowedIn: ALL_HOSTS, family: 'address' },
  playback: { terminal: 'conditional', allowedIn: ALL_HOSTS, family: 'media' },
  notify: { terminal: 'never', allowedIn: ALL_HOSTS, family: 'integration' },
  callerid: { terminal: 'never', allowedIn: ALL_HOSTS, family: 'control' },
  voicemail: { terminal: 'conditional', allowedIn: ALL_HOSTS, family: 'address' },
  text2speech: { terminal: 'never', allowedIn: ALL_HOSTS, family: 'media' },
  voicerobot: { terminal: 'conditional', allowedIn: ALL_HOSTS, family: 'media' },
  webhook: { terminal: 'never', allowedIn: ALL_HOSTS, family: 'control' },
  confbridge: { terminal: 'conditional', allowedIn: ALL_HOSTS, family: 'address' },
  cmd: { terminal: 'never', allowedIn: ROUTE_ONLY, family: 'control' },
  label: { terminal: 'never', allowedIn: ALL_HOSTS, family: 'control' },
  // Conditional, not 'always': a goto with a condition and no else-label falls
  // through, so marking it terminal would flag reachable steps as unreachable.
  goto: { terminal: 'conditional', allowedIn: ALL_HOSTS, family: 'control' },
  schedule: { terminal: 'never', allowedIn: ALL_HOSTS, family: 'control' },
  http_request: { terminal: 'never', allowedIn: ALL_HOSTS, family: 'integration' },
  collect_input: { terminal: 'never', allowedIn: ALL_HOSTS, family: 'control' },
  hangup: { terminal: 'always', allowedIn: ALL_HOSTS, family: 'control' },
};
