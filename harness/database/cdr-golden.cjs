'use strict';
// Installs deterministic CDR legs only in a disposable CI database.
const { Client } = require('pg');
const mysql = require('mysql2/promise');
const { resolveDatabaseConfig, toDriverConfig } = require('../../packages/backend/src/database/database-config.cjs');

async function main(input = process.env) {
  if (input.CI !== 'true' || !/^krasterisk_ci(?:_[a-z0-9]+)?$/.test(input.DB_NAME || '')) {
    throw new Error('CDR golden fixture requires a disposable krasterisk_ci database');
  }
  const config = resolveDatabaseConfig(input, { requireExplicitConnection: true });
  const pg = config.dialect === 'postgres';
  const db = pg ? new Client(toDriverConfig(config)) : await mysql.createConnection(toDriverConfig(config));
  if (pg) await db.connect();
  const query = async (sql, values = []) => pg ? (await db.query(sql, values)).rows : (await db.query(sql.replace(/\$\d+/g, '?'), values))[0];
  const columns = 'uniqueid, linkedid, calldate, clid, src, usrc, dst, dcontext, channel, dstchannel, lastapp, duration, billsec, disposition, vpbx_user_uid, dialednum';
  const binds = Array.from({ length: 16 }, (_, index) => `$${index + 1}`).join(', ');
  const legs = [
    ['db02-c-a1', 'db02-c-a', '2026-09-18 10:00:00', 'Звонок 😀', '101', '101', '200', 'sip-out2', 'PJSIP/e101_2-1', '', 'Dial', 10, 0, 'NO ANSWER', 2, null],
    ['db02-c-a2', 'db02-c-a', '2026-09-18 10:00:00', 'Звонок 😀', '101', '101', '201', 'sip-out2', 'PJSIP/e101_2-2', '', 'Dial', 20, 0, 'BUSY', 2, null],
    ['db02-c-a3', 'db02-c-a', '2026-09-18 10:00:05', 'Звонок 😀', '101', '101', '202', 'sip-out2', 'PJSIP/e101_2-3', 'PJSIP/e202_2-1', 'Dial', 30, 22, 'ANSWERED', 2, null],
    ['db02-c-transfer', 'db02-c-a', '2026-09-18 10:00:06', 'Звонок 😀', '101', '101', '203', 'sip-out2', '', '', 'Transferred Call', 1, 0, 'ANSWERED', 2, null],
    ['db02-c-miss', 'db02-c-m', '2026-09-18 11:00:00', 'Client', '103', '103', '204', 'sip-out2', 'PJSIP/e103_2-1', '', 'Dial', 12, 0, 'NO ANSWER', 2, 'trunk-a'],
    ['db02-c-bad', 'db02-c-invalid', 'invalid-date', 'Legacy', '104', '104', '205', 'sip-out2', 'PJSIP/e104_2-1', '', 'Dial', 5, 0, 'BUSY', 2, null],
    ['db02-c-null', 'db02-c-null', null, 'Unknown', '105', '105', '206', 'sip-out2', 'PJSIP/e105_2-1', '', 'Dial', 6, 0, 'NO ANSWER', 2, null],
    ['db02-c-b', 'db02-c-b', '2026-09-18 10:01:00', 'Other tenant', '301', '301', '201', 'sip-out3', 'PJSIP/e301_3-1', '', 'Dial', 5, 0, 'BUSY', 3, null],
    ['db02-c-zero', 'db02-c-zero', '2026-09-18 10:02:00', 'Box tenant', '100', '100', '201', 'sip-out0', 'PJSIP/e100_0-1', '', 'Dial', 5, 0, 'BUSY', 0, null],
  ];
  try {
    await query('BEGIN');
    const existing = await query("SELECT uniqueid FROM cdr WHERE uniqueid = $1", ['db02-c-a1']);
    if (existing.length) throw new Error('CDR golden fixture already installed');
    for (const leg of legs) await query(`INSERT INTO cdr (${columns}) VALUES (${binds})`, leg);
    await query('COMMIT');
    return { inserted: legs.length };
  } catch (error) {
    await query('ROLLBACK');
    throw error;
  } finally {
    await db.end();
  }
}

if (require.main === module) {
  main().then(result => console.log(JSON.stringify(result))).catch(error => { console.error(error.message); process.exitCode = 1; });
}
module.exports = { main };
