import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import mysql from 'mysql2/promise';
import { startHarnessMysql } from '../../environment/testcontainers/mysql.js';
import { DIRECTORY_SCHEMA_STATEMENTS } from '../../../packages/backend/src/modules/directories/setup-directories-schema';

const EXPECTED_TABLES = [
  'directories',
  'directory_fields',
  'directory_records',
  'route_directory_bindings',
];

describe('directories schema setup', () => {
  let started: Awaited<ReturnType<typeof startHarnessMysql>>;
  let conn: mysql.Connection;

  beforeAll(async () => {
    started = await startHarnessMysql();
    conn = await mysql.createConnection({
      host: started.connection.host,
      port: started.connection.port,
      user: started.connection.user,
      password: started.connection.password,
      database: started.connection.database,
    });
  }, 120_000);

  afterAll(async () => {
    if (conn) await conn.end();
    if (started) await started.stop();
  });

  async function applyStatements(): Promise<void> {
    for (const statement of DIRECTORY_SCHEMA_STATEMENTS) {
      await conn.query(statement);
    }
  }

  it('creates the four tables and foreign keys idempotently', async () => {
    await applyStatements();
    await applyStatements();

    const [tables] = await conn.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME IN (?, ?, ?, ?)
       ORDER BY TABLE_NAME`,
      EXPECTED_TABLES,
    );
    const tableNames = (tables as Array<{ TABLE_NAME: string }>).map((row) => row.TABLE_NAME);
    expect(tableNames).toEqual([...EXPECTED_TABLES].sort());

    const [fks] = await conn.query(
      `SELECT TABLE_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME
       FROM information_schema.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = DATABASE()
         AND REFERENCED_TABLE_NAME IS NOT NULL
         AND TABLE_NAME IN (?, ?, ?, ?)`,
      EXPECTED_TABLES,
    );
    const fkRows = fks as Array<{
      TABLE_NAME: string;
      COLUMN_NAME: string;
      REFERENCED_TABLE_NAME: string;
    }>;

    expect(fkRows.length).toBeGreaterThanOrEqual(3);
    for (const row of fkRows) {
      expect(EXPECTED_TABLES).toContain(row.TABLE_NAME);
      expect(EXPECTED_TABLES).toContain(row.REFERENCED_TABLE_NAME);
    }
    expect(fkRows.some((row) => row.TABLE_NAME === 'directory_fields' && row.COLUMN_NAME === 'directory_uid')).toBe(true);
    expect(fkRows.some((row) => row.TABLE_NAME === 'directory_records' && row.COLUMN_NAME === 'directory_uid')).toBe(true);
    expect(fkRows.some((row) => row.TABLE_NAME === 'route_directory_bindings' && row.COLUMN_NAME === 'directory_uid')).toBe(true);
  });
});
