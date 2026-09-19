'use strict';
// Representative, reversible index check on disposable databases only.
const assert = require('node:assert/strict');
const { Client } = require('pg');
const mysql = require('mysql2/promise');
const { resolveDatabaseConfig, toDriverConfig } = require('../../packages/backend/src/database/database-config.cjs');

async function main(input = process.env) {
  if (input.CI !== 'true' || !/^krasterisk_ci(?:_[a-z0-9]+)?$/.test(input.DB_NAME || '')) {
    throw new Error('CDR index plan requires disposable CI database');
  }
  const config = resolveDatabaseConfig(input, { requireExplicitConnection: true });
  const pg = config.dialect === 'postgres';
  const db = pg ? new Client(toDriverConfig(config)) : await mysql.createConnection(toDriverConfig(config));
  if (pg) await db.connect();
  const query = async (sql, values = []) => pg ? (await db.query(sql, values)).rows : (await db.query(sql.replace(/\$\d+/g, '?'), values))[0];
  const count = 6000;
  try {
    for (let start = 0; start < count; start += 150) {
      const values = [];
      const tuples = [];
      for (let index = start; index < Math.min(count, start + 150); index++) {
        const position = values.length;
        tuples.push(`($${position + 1}, $${position + 2}, $${position + 3}, $${position + 4})`);
        values.push(`db02-perf-${index}`, `db02-perf-call-${Math.floor(index / 2)}`,
          `2026-09-18 10:${String(index % 60).padStart(2, '0')}:00`, index % 2 ? 2 : 3);
      }
      await query(`INSERT INTO cdr (uniqueid, linkedid, calldate, vpbx_user_uid) VALUES ${tuples.join(', ')}`, values);
    }
    const sql = "SELECT uniqueid FROM cdr WHERE vpbx_user_uid = 2 AND calldate >= '2026-09-18 10:30:00' AND calldate < '2026-09-18 10:31:00' ORDER BY calldate, uniqueid LIMIT 50";
    const rows = await query(pg ? `EXPLAIN (FORMAT JSON) ${sql}` : `EXPLAIN FORMAT=JSON ${sql}`);
    const plan = pg ? rows[0]['QUERY PLAN'] : JSON.parse(rows[0].EXPLAIN);
    const indexUsed = JSON.stringify(plan).includes('idx_cdr_tenant_date');
    assert.equal(indexUsed, true, `Expected tenant/date index, plan: ${JSON.stringify(plan)}`);
    return { dialect: config.dialect, fixtureRows: count, indexUsed: 'idx_cdr_tenant_date' };
  } finally {
    try { await query("DELETE FROM cdr WHERE uniqueid LIKE 'db02-perf-%'"); } finally { await db.end(); }
  }
}

if (require.main === module) {
  main().then(result => console.log(JSON.stringify(result))).catch(error => { console.error(error.message); process.exitCode = 1; });
}
module.exports = { main };
