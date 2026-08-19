/**
 * D-22: step-condition sources beyond DIALSTATUS.
 * One table per source — generator, DTO, and UI presets (12-08) all import these.
 */

export const CONDITION_SOURCES = [
  'dialstatus',
  'queuestatus',
  'device_state',
  'variable',
  'http_result',
] as const;

export type ConditionSourceKind = (typeof CONDITION_SOURCES)[number];

/**
 * Full Asterisk DIALSTATUS set (not only the six common UI presets).
 * Must stay aligned with Wave 0 characterization and existing saved routes.
 */
export const DIALSTATUS_VALUES = [
  'CHANUNAVAIL',
  'CONGESTION',
  'BUSY',
  'NOANSWER',
  'ANSWER',
  'CANCEL',
  'DONTCALL',
  'TORTURE',
  'INVALIDARGS',
] as const;

export type DialstatusValue = (typeof DIALSTATUS_VALUES)[number];

/** D-22: exact QUEUESTATUS set — do not add values. */
export const QUEUESTATUS_VALUES = [
  'TIMEOUT',
  'FULL',
  'JOINEMPTY',
  'LEAVEEMPTY',
  'CONTINUE',
] as const;

export type QueuestatusValue = (typeof QUEUESTATUS_VALUES)[number];

/** Asterisk DEVICE_STATE() return values. */
export const DEVICE_STATE_VALUES = [
  'UNKNOWN',
  'NOT_INUSE',
  'INUSE',
  'BUSY',
  'INVALID',
  'UNAVAILABLE',
  'RINGING',
  'RINGINUSE',
  'ONHOLD',
] as const;

export type DeviceStateValue = (typeof DEVICE_STATE_VALUES)[number];

export const CONDITION_OPS = ['eq', 'ne', 'gt', 'lt', 'matches'] as const;
export type ConditionOp = (typeof CONDITION_OPS)[number];

/**
 * Channel variable written by the D-47 HTTP action (plan 12-16).
 * Condition source `http_result` MUST read this exact name.
 */
export const HTTP_RESULT_VAR = 'KRSK_HTTP_RESULT';

/** Asterisk channel-variable name: letters, digits, underscore, and function parens. */
export const CONDITION_VAR_NAME_RE = /^[A-Za-z_][A-Za-z0-9_()]*$/;

/**
 * Device argument for DEVICE_STATE(tech/resource) — not a free string.
 * Examples: PJSIP/e101_42, SIP/alice, Custom:busy
 */
export const CONDITION_DEVICE_RE = /^[A-Za-z][A-Za-z0-9_]*[:/][A-Za-z0-9_./@-]+$/;

export type ConditionSource =
  | { source: 'dialstatus'; values: DialstatusValue[] }
  | { source: 'queuestatus'; values: QueuestatusValue[] }
  | { source: 'device_state'; device: string; values: DeviceStateValue[] }
  | { source: 'variable'; name: string; op: ConditionOp; value: string }
  | { source: 'http_result'; op: ConditionOp; value: string };

export function assertNeverCondition(x: never): never {
  throw new Error(`Unexpected condition source: ${JSON.stringify(x)}`);
}
