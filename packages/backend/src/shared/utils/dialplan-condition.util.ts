/**
 * D-43: single place that turns a step condition into a dialplan expression
 * and wraps every generated line. Branches of actionToDialplan must not
 * concatenate ExecIf themselves.
 */

const VALID_DIALSTATUSES = [
  'CHANUNAVAIL', 'CONGESTION', 'BUSY', 'NOANSWER', 'ANSWER',
  'CANCEL', 'DONTCALL', 'TORTURE', 'INVALIDARGS',
];

const PRIORITY_PREFIX = /^(same => [^,]+,)(.*)$/;

export function isLegacyInvalidDialstatus(condition: { dialstatus?: unknown } | undefined): string | null {
  if (!condition) return null;
  if (Array.isArray(condition.dialstatus)) return null;
  if (typeof condition.dialstatus === 'string' && condition.dialstatus
      && !VALID_DIALSTATUSES.includes(condition.dialstatus)) {
    return condition.dialstatus;
  }
  return null;
}

export function buildConditionExpr(condition: { dialstatus?: string | string[] } | undefined | unknown): string {
  const cond = (condition ?? {}) as { dialstatus?: string | string[] };
  const statuses: string[] = Array.isArray(cond.dialstatus)
    ? cond.dialstatus
    : cond.dialstatus ? [cond.dialstatus] : [];
  const valid = statuses.filter((s) => VALID_DIALSTATUSES.includes(s));
  if (!valid.length) return '';
  return valid.map((s) => `"\${DIALSTATUS}" = "${s}"`).join(' | ');
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
