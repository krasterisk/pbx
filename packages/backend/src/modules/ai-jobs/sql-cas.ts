export type SqlDialect = 'mysql' | 'postgres';

/** One winner for compare-and-swap UPDATE. PostgreSQL uses RETURNING; MySQL uses affectedRows. */
export function casWon(dialect: SqlDialect, result: unknown): boolean {
  if (dialect === 'postgres') {
    return Array.isArray(result) && result.length === 1;
  }
  const rows = (result as { affectedRows?: number } | null)?.affectedRows;
  return Number(rows) === 1;
}

export function stageClaimSql(dialect: SqlDialect): string {
  const set = `SET state = 'leased', version = version + 1, fence = fence + 1,
    lease_owner = :owner, lease_until = :until, updated_at = :now`;
  const where = `WHERE id = :id AND version = :version AND vpbx_user_uid = :tenant
    AND (state = 'pending' OR (state = 'leased' AND (lease_until IS NULL OR lease_until < :now)))`;
  return dialect === 'postgres'
    ? `UPDATE ai_job_stages ${set} ${where} RETURNING id`
    : `UPDATE ai_job_stages ${set} ${where}`;
}

export function outboxClaimSql(dialect: SqlDialect): string {
  const set = `SET lease_owner = :owner, lease_until = :until, fence = fence + 1,
    version = version + 1, attempts = attempts + 1`;
  const where = `WHERE id = :id AND delivered_at IS NULL AND version = :version
    AND (lease_until IS NULL OR lease_until < :now)`;
  return dialect === 'postgres'
    ? `UPDATE ai_outbox ${set} ${where} RETURNING id`
    : `UPDATE ai_outbox ${set} ${where}`;
}
