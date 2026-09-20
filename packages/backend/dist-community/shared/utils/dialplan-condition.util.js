"use strict";
/**
 * D-43 / D-22: turn a step condition into a dialplan expression
 * and wrap every generated line. Branches of actionToDialplan must not
 * concatenate ExecIf themselves.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isLegacyInvalidDialstatus = isLegacyInvalidDialstatus;
exports.buildConditionExpr = buildConditionExpr;
exports.wrapEachLine = wrapEachLine;
const shared_1 = require("@krasterisk/shared");
const VALID_DIALSTATUSES = shared_1.DIALSTATUS_VALUES;
const PRIORITY_PREFIX = /^(same => [^,]+,)(.*)$/;
const SANITIZE_DP = /[(),?\[\]{}$\\";\n\r]/g;
function sanitizeDialplanValue(input) {
    if (!input)
        return '';
    return input.replace(SANITIZE_DP, '').trim();
}
function isLegacyInvalidDialstatus(condition) {
    if (!condition)
        return null;
    if (Array.isArray(condition.dialstatus))
        return null;
    if (typeof condition.dialstatus === 'string' && condition.dialstatus
        && !VALID_DIALSTATUSES.includes(condition.dialstatus)) {
        return condition.dialstatus;
    }
    return null;
}
function orJoinEq(channelExpr, values) {
    if (!values.length)
        return '';
    return values.map((s) => `"${channelExpr}" = "${s}"`).join(' | ');
}
function buildDialstatusExpr(dialstatus) {
    const statuses = Array.isArray(dialstatus)
        ? dialstatus
        : typeof dialstatus === 'string' && dialstatus ? [dialstatus] : [];
    const valid = statuses.filter((s) => VALID_DIALSTATUSES.includes(s));
    return orJoinEq('${DIALSTATUS}', valid);
}
function buildOpExpr(channelExpr, op, rawValue) {
    const operator = shared_1.CONDITION_OPS.includes(op)
        ? op
        : 'eq';
    const value = sanitizeDialplanValue(String(rawValue ?? ''));
    if (!value && operator !== 'eq' && operator !== 'ne')
        return '';
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
            return (0, shared_1.assertNeverCondition)(operator);
    }
}
function isConditionSourceKind(value) {
    return value === 'dialstatus'
        || value === 'queuestatus'
        || value === 'device_state'
        || value === 'variable'
        || value === 'http_result'
        || value === 'record_status';
}
function asStringArray(value) {
    if (Array.isArray(value))
        return value.filter((v) => typeof v === 'string');
    if (typeof value === 'string' && value)
        return [value];
    return [];
}
function buildFromSource(cond) {
    switch (cond.source) {
        case 'dialstatus':
            return buildDialstatusExpr(cond.values);
        case 'queuestatus': {
            const valid = asStringArray(cond.values).filter((s) => shared_1.QUEUESTATUS_VALUES.includes(s));
            return orJoinEq('${QUEUESTATUS}', valid);
        }
        case 'device_state': {
            const device = String(cond.device ?? '');
            if (!shared_1.CONDITION_DEVICE_RE.test(device))
                return '';
            const valid = asStringArray(cond.values).filter((s) => shared_1.DEVICE_STATE_VALUES.includes(s));
            if (!valid.length)
                return '';
            return orJoinEq(`\${DEVICE_STATE(${device})}`, valid);
        }
        case 'variable': {
            const name = String(cond.name ?? '');
            if (!shared_1.CONDITION_VAR_NAME_RE.test(name))
                return '';
            return buildOpExpr(`\${${name}}`, cond.op, cond.value);
        }
        case 'http_result':
            return buildOpExpr(`\${${shared_1.HTTP_RESULT_VAR}}`, cond.op, cond.value);
        case 'record_status': {
            const valid = asStringArray(cond.values).filter((s) => shared_1.RECORD_STATUS_VALUES.includes(s));
            return orJoinEq('${RECORD_STATUS}', valid);
        }
        default:
            return (0, shared_1.assertNeverCondition)(cond);
    }
}
function buildConditionExpr(condition) {
    if (!condition || typeof condition !== 'object')
        return '';
    const cond = condition;
    if (isConditionSourceKind(cond.source)) {
        return buildFromSource(cond);
    }
    return buildDialstatusExpr(cond.dialstatus);
}
function wrapEachLine(expr, dp) {
    if (!expr || !dp)
        return dp;
    return dp
        .split('\n')
        .filter((line) => line.length > 0)
        .map((line) => wrapOneLine(expr, line))
        .join('\n');
}
function wrapOneLine(expr, line) {
    const m = line.match(PRIORITY_PREFIX);
    const prefix = m ? m[1] : '';
    const app = m ? m[2] : line;
    return `${prefix}${wrapApp(expr, app)}`;
}
function wrapApp(expr, app) {
    const goto = app.match(/^Goto\((.*)\)$/);
    if (goto)
        return `GotoIf($[${expr}]?${goto[1]})`;
    const gotoIf = app.match(/^GotoIf\(\$\[(.*)\]\?(.*)\)$/);
    if (gotoIf)
        return `GotoIf($[(${expr}) & (${gotoIf[1]})]?${gotoIf[2]})`;
    return `ExecIf($[${expr}]?${app})`;
}
//# sourceMappingURL=dialplan-condition.util.js.map