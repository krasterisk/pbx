/**
 * OPT-IN ONLY — SQL assertion helper (D-H02).
 *
 * Use ONLY for Asterisk/CC side-effects that have no public API assertion path.
 * Uses parameterized queries via mysql2 execute() — never string concatenation.
 * Prefer API + SSE + UI assertions for all standard scenarios.
 */
import mysql from 'mysql2/promise';

export interface SqlConnectionConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

function connectionConfig(): SqlConnectionConfig {
  return {
    host: process.env.DB_HOST ?? '127.0.0.1',
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER ?? 'root',
    password: process.env.DB_PASS ?? 'krasterisk',
    database: process.env.DB_NAME ?? 'krasterisk',
  };
}

/** Parameterized query helper — mysql2 placeholders only, no string concat (T-11-07-02). */
export async function querySql<T extends mysql.RowDataPacket[]>(
  sql: string,
  params: unknown[] = [],
): Promise<T> {
  const cfg = connectionConfig();
  const conn = await mysql.createConnection({
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    password: cfg.password,
    database: cfg.database,
  });

  try {
    const [rows] = await conn.execute<T>(sql, params);
    return rows;
  } finally {
    await conn.end();
  }
}

/** Assert row count for CC side-effect checks — opt-in scenarios only. */
export async function assertSqlRowCount(
  sql: string,
  params: unknown[],
  expected: number,
): Promise<void> {
  const rows = await querySql<mysql.RowDataPacket[]>(sql, params);
  const actual = rows.length;
  if (actual !== expected) {
    throw new Error(`SQL row count mismatch: expected ${expected}, got ${actual}\nSQL: ${sql}`);
  }
}
