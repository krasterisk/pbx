/**
 * CDR visibility from the access-list JSON (`numbers.cdr`).
 *
 * Empty operators+queues → unrestricted (whole tenant).
 * Otherwise the viewer sees: own extension ∪ selected operators ∪ selected queues.
 */
import {
  normalizeAccessToken,
  normalizeAccessTokenSet,
  parsePositiveIdList,
} from '../../callcenter/callcenter-access-list.util';

export interface CdrAccessScope {
  operators: string[];
  queues: string[];
  ownExten: string | null;
}

export function parseCdrAccessBlob(raw: unknown): {
  operators: string[];
  queues: string[];
  operatorUserIds: number[];
} {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const obj = raw as { operators?: unknown; queues?: unknown; operatorUserIds?: unknown };
    return {
      operators: [...normalizeAccessTokenSet(obj.operators)],
      queues: [...normalizeAccessTokenSet(obj.queues)],
      operatorUserIds: parsePositiveIdList(obj.operatorUserIds),
    };
  }
  return {
    operators: [...normalizeAccessTokenSet(raw)],
    queues: [],
    operatorUserIds: [],
  };
}

export function isCdrUnrestricted(scope: Pick<CdrAccessScope, 'operators' | 'queues'> & { operatorUserIds?: number[] }): boolean {
  return scope.operators.length === 0
    && scope.queues.length === 0
    && (scope.operatorUserIds?.length ?? 0) === 0;
}

/** SQL fragment: call matches an internal extension (src/dst/channels). */
export function extensionMatchSql(
  alias: string,
  tenantId: number,
  ext: string,
  key: string,
): { sql: string; replacements: Record<string, string> } {
  const e = normalizeAccessToken(ext);
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

export function queueMatchSql(
  alias: string,
  tenantId: number,
  queueNum: string,
  key: string,
): { sql: string; replacements: Record<string, string> } {
  const n = normalizeAccessToken(queueNum);
  return {
    sql: `(${alias}.usrc = :${key} OR ${alias}.dst = :${key} OR ${alias}.dialednum = :${key}
      OR ${alias}.dst LIKE :${key}Raw OR ${alias}.channel LIKE :${key}Raw OR ${alias}.dstchannel LIKE :${key}Raw)`,
    replacements: {
      [key]: n,
      [`${key}Raw`]: `%q${n}_${tenantId}%`,
    },
  };
}

export function buildCdrAccessClause(
  alias: string,
  tenantId: number,
  scope: CdrAccessScope,
): { sql: string; replacements: Record<string, string> } | null {
  if (isCdrUnrestricted(scope)) return null;

  const parts: string[] = [];
  const replacements: Record<string, string> = {};
  const extens = new Set(scope.operators);
  if (scope.ownExten) extens.add(normalizeAccessToken(scope.ownExten));

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

  if (parts.length === 0) return null;
  return { sql: `(${parts.join(' OR ')})`, replacements };
}

/**
 * Keep every CDR row of a call if the current row matches OR any sibling
 * leg of the same linkedid matches. Otherwise GROUP BY linkedid would drop
 * trunk/queue legs and distort the summary.
 */
export function buildCdrLinkedidAccessClause(
  alias: string,
  tenantId: number,
  scope: CdrAccessScope,
): { sql: string; replacements: Record<string, string> } | null {
  const onRow = buildCdrAccessClause(alias, tenantId, scope);
  if (!onRow) return null;
  const onAny = buildCdrAccessClause('x', tenantId, scope);
  return {
    sql: `(${onRow.sql} OR (
      NULLIF(${alias}.linkedid, '') IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM cdr x
        WHERE x.linkedid = ${alias}.linkedid
          AND ${onAny!.sql}
      )
    ))`,
    replacements: onRow.replacements,
  };
}
