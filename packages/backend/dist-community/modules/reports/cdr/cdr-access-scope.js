"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseCdrAccessBlob = parseCdrAccessBlob;
exports.isCdrUnrestricted = isCdrUnrestricted;
exports.extensionMatchSql = extensionMatchSql;
exports.queueMatchSql = queueMatchSql;
exports.buildCdrAccessClause = buildCdrAccessClause;
exports.buildCdrLinkedidAccessClause = buildCdrLinkedidAccessClause;
/**
 * CDR visibility from the access-list JSON (`numbers.cdr`).
 *
 * Empty operators+queues → unrestricted (whole tenant).
 * Otherwise the viewer sees: own extension ∪ selected operators ∪ selected queues.
 */
const callcenter_access_list_util_1 = require("../../callcenter/callcenter-access-list.util");
function parseCdrAccessBlob(raw) {
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        const obj = raw;
        return {
            operators: [...(0, callcenter_access_list_util_1.normalizeAccessTokenSet)(obj.operators)],
            queues: [...(0, callcenter_access_list_util_1.normalizeAccessTokenSet)(obj.queues)],
            operatorUserIds: (0, callcenter_access_list_util_1.parsePositiveIdList)(obj.operatorUserIds),
        };
    }
    return {
        operators: [...(0, callcenter_access_list_util_1.normalizeAccessTokenSet)(raw)],
        queues: [],
        operatorUserIds: [],
    };
}
function isCdrUnrestricted(scope) {
    return scope.operators.length === 0
        && scope.queues.length === 0
        && (scope.operatorUserIds?.length ?? 0) === 0;
}
/** SQL fragment: call matches an internal extension (src/dst/channels). */
function extensionMatchSql(alias, tenantId, ext, key) {
    const e = (0, callcenter_access_list_util_1.normalizeAccessToken)(ext);
    return {
        sql: `(${alias}.usrc = :${key} OR ${alias}.dst = :${key} OR ${alias}.dialednum = :${key}
      OR ${alias}.channel LIKE :${key}E OR ${alias}.dstchannel LIKE :${key}E
      OR ${alias}.channel LIKE :${key}Ew OR ${alias}.dstchannel LIKE :${key}Ew)`,
        replacements: {
            [key]: e,
            [`${key}E`]: `%e${e}_${tenantId}%`,
            [`${key}Ew`]: `%ew${e}_${tenantId}%`,
        },
    };
}
function queueMatchSql(alias, tenantId, queueNum, key) {
    const n = (0, callcenter_access_list_util_1.normalizeAccessToken)(queueNum);
    return {
        sql: `(${alias}.usrc = :${key} OR ${alias}.dst = :${key} OR ${alias}.dialednum = :${key}
      OR ${alias}.dst LIKE :${key}Raw OR ${alias}.channel LIKE :${key}Raw OR ${alias}.dstchannel LIKE :${key}Raw)`,
        replacements: {
            [key]: n,
            [`${key}Raw`]: `%q${n}_${tenantId}%`,
        },
    };
}
function buildCdrAccessClause(alias, tenantId, scope) {
    if (isCdrUnrestricted(scope))
        return null;
    const parts = [];
    const replacements = {};
    const extens = new Set(scope.operators);
    if (scope.ownExten)
        extens.add((0, callcenter_access_list_util_1.normalizeAccessToken)(scope.ownExten));
    let i = 0;
    for (const ext of extens) {
        const key = `accExt${i++}`;
        const m = extensionMatchSql(alias, tenantId, ext, key);
        parts.push(m.sql);
        Object.assign(replacements, m.replacements);
    }
    i = 0;
    for (const q of scope.queues) {
        const key = `accQ${i++}`;
        const m = queueMatchSql(alias, tenantId, q, key);
        parts.push(m.sql);
        Object.assign(replacements, m.replacements);
    }
    if (parts.length === 0)
        return null;
    return { sql: `(${parts.join(' OR ')})`, replacements };
}
/**
 * Keep every CDR row of a call if the current row matches OR any sibling
 * leg of the same linkedid matches. Otherwise GROUP BY linkedid would drop
 * trunk/queue legs and distort the summary.
 */
function buildCdrLinkedidAccessClause(alias, tenantId, scope) {
    const onRow = buildCdrAccessClause(alias, tenantId, scope);
    if (!onRow)
        return null;
    const onAny = buildCdrAccessClause('x', tenantId, scope);
    return {
        sql: `(${onRow.sql} OR (
      NULLIF(${alias}.linkedid, '') IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM cdr x
        WHERE x.linkedid = ${alias}.linkedid
          AND ${onAny.sql}
      )
    ))`,
        replacements: onRow.replacements,
    };
}
//# sourceMappingURL=cdr-access-scope.js.map