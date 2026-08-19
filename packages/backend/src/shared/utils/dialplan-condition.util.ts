/**
 * D-43 / D-22: turn a step condition into a dialplan expression
 * and wrap every generated line. Branches of actionToDialplan must not
 * concatenate ExecIf themselves.
 */

import {
  CONDITION_DEVICE_RE,
  CONDITION_OPS,
  CONDITION_VAR_NAME_RE,
  DIALSTATUS_VALUES,
  DEVICE_STATE_VALUES,
  HTTP_RESULT_VAR,
  QUEUESTATUS_VALUES,
  assertNeverCondition,
  type ConditionOp,
  type ConditionSource,
  type ConditionSourceKind,
} from '@krasterisk/shared';

const VALID_DIALSTATUSES: readonly string[] = DIALSTATUS_VALUES;

const PRIORITY_PREFIX = /^(same => [^,]+,)(.*)$/;

const SANITIZE_DP = /[(),?\[\]{}$\\";\n\r]/g;

function sanitizeDialplanValue(input?: string): string {
  if (!input) return '';
  return input.replace(SANITIZE_DP, '').trim();
}

export function isLegacyInvalidDialstatus(condition: { dialstatus?: unknown } | undefined): string | null {
  if (!condition) return null;
  if (Array.isArray(condition.dialstatus)) return null;
  if (typeof condition.dialstatus === 'string' && condition.dialstatus
      && !VALID_DIALSTATUSES.includes(condition.dialstatus)) {
    return condition.dialstatus;
  }
  return null;
}

function orJoinEq(channelExpr: string, values: string[]): string {
  if (!values.length) return '';
  return values.map((s) => `"${channelExpr}" = "${s}"`).join(' | ');
}

function buildDialstatusExpr(dialstatus: unknown): string {
  const statuses: string[] = Array.isArray(dialstatus)
    ? dialstatus
    : typeof dialstatus === 'string' && dialstatus ? [dialstatus] : [];
  const valid = statuses.filter((s) => VALID_DIALSTATUSES.includes(s));
  return orJoinEq('${DIALSTATUS}', valid);
}

function buildOpExpr(channelExpr: string, op: unknown, rawValue: unknown): string {
  const operator = (CONDITION_OPS as readonly string[]).includes(op as string)
    ? (op as ConditionOp)
    : 'eq';
  const value = sanitizeDialplanValue(String(rawValue ?? ''));
  if (!value && operator !== 'eq' && operator !== 'ne') return '';
  switch (operator) {
    case 'eq':
      return `"${channelExpr}" = "${value}"`;
    case 'ne':
      return `"${channelExpr}" != "${value}"`;
    case 'gt':
      return `${channelExpr} > ${value}`;
    case 'lt':
      return `${channelExpr} < ${value}`;
    case 'matches':
      return `"${channelExpr}" : "${value}"`;
    default:
      return assertNeverCondition(operator);
  }
}

function isConditionSourceKind(value: unknown): value is ConditionSourceKind {
  return value === 'dialstatus'
    || value === 'queuestatus'
    || value === 'device_state'
    || value === 'variable'
    || value === 'http_result';
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string');
  if (typeof value === 'string' && value) return [value];
  return [];
}

function buildFromSource(cond: ConditionSource): string {
  switch (cond.source) {
    case 'dialstatus':
      return buildDialstatusExpr(cond.values);
    case 'queuestatus': {
      const valid = asStringArray(cond.values).filter((s) =>
        (QUEUESTATUS_VALUES as readonly string[]).includes(s),
      );
      return orJoinEq('${QUEUESTATUS}', valid);
    }
    case 'device_state': {
      const device = String(cond.device ?? '');
      if (!CONDITION_DEVICE_RE.test(device)) return '';
      const valid = asStringArray(cond.values).filter((s) =>
        (DEVICE_STATE_VALUES as readonly string[]).includes(s),
      );
      if (!valid.length) return '';
      return orJoinEq(`\${DEVICE_STATE(${device})}`, valid);
    }
    case 'variable': {
      const name = String(cond.name ?? '');
      if (!CONDITION_VAR_NAME_RE.test(name)) return '';
      return buildOpExpr(`\${${name}}`, cond.op, cond.value);
    }
    case 'http_result':
      return buildOpExpr(`\${${HTTP_RESULT_VAR}}`, cond.op, cond.value);
    default:
      return assertNeverCondition(cond);
  }
}

export function buildConditionExpr(condition: { dialstatus?: string | string[] } | undefined | unknown): string {
  if (!condition || typeof condition !== 'object') return '';
  const cond = condition as {
    source?: unknown;
    values?: unknown;
    device?: unknown;
    name?: unknown;
    op?: unknown;
    value?: unknown;
    dialstatus?: string | string[];
  };

  if (isConditionSourceKind(cond.source)) {
    return buildFromSource(cond as ConditionSource);
  }

  return buildDialstatusExpr(cond.dialstatus);
}

export function wrapEachLine(expr: string, dp: string): string {
  if (!expr || !dp) return dp;
  return dp
    .split('\n')
    .filter((line) => line.length > 0)
    .map((line) => wrapOneLine(expr, line))
    .join('\n');
}

function wrapOneLine(expr: string, line: string): string {
  const m = line.match(PRIORITY_PREFIX);
  const prefix = m ? m[1] : '';
  const app = m ? m[2] : line;
  return `${prefix}${wrapApp(expr, app)}`;
}

function wrapApp(expr: string, app: string): string {
  const goto = app.match(/^Goto\((.*)\)$/);
  if (goto) return `GotoIf($[${expr}]?${goto[1]})`;

  const gotoIf = app.match(/^GotoIf\(\$\[(.*)\]\?(.*)\)$/);
  if (gotoIf) return `GotoIf($[(${expr}) & (${gotoIf[1]})]?${gotoIf[2]})`;

  return `ExecIf($[${expr}]?${app})`;
}
