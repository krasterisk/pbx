/**
 * Temporary PBX-side PJSIP loopback for the opt-in autodial campaign live gate.
 *
 * It deliberately writes only rows named below and refuses replacement.  The
 * campaign itself runs against the disposable versioned DB; these rows live in
 * the PBX's Realtime DB because that is what Asterisk reads at call time.
 */
const fs = require('node:fs');
const path = require('node:path');
const mysql = require('mysql2/promise');

const ID = 't_codex_ci_ac20260918_2';
const IDENTIFY_ID = `${ID}_ip`;
const CONTEXT = 'codex-ac-campaign-loop-20260918-2';
const action = process.argv[2];

if (process.env.AC_LIVE_GATE_ALLOWED !== '1' || !['check', 'create', 'delete'].includes(action)) {
  throw new Error('Set AC_LIVE_GATE_ALLOWED=1 and use check, create or delete');
}

for (const line of fs.readFileSync(path.resolve(__dirname, '../../../.env'), 'utf8').split(/\r?\n/)) {
  const match = line.match(/^([A-Z_]+)=(.*)$/);
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
}

if (!process.env.DB_NAME || process.env.DB_NAME === 'krasterisk_ci_ac20260918z') {
  throw new Error('Expected the PBX Realtime DB, not the disposable campaign fixture');
}

async function main() {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    connectTimeout: 5000,
  });
  try {
    const [[endpoint]] = await db.query('SELECT COUNT(*) AS count FROM ps_endpoints WHERE id = ?', [ID]);
    const [[aor]] = await db.query('SELECT COUNT(*) AS count FROM ps_aors WHERE id = ?', [ID]);
    const [[identify]] = await db.query('SELECT COUNT(*) AS count FROM ps_endpoint_id_ips WHERE id = ?', [IDENTIFY_ID]);
    if (action === 'check') {
      const [[sameHost]] = await db.query('SELECT COUNT(*) AS count FROM ps_endpoint_id_ips WHERE `match` = ?', ['127.0.0.1']);
      console.log(JSON.stringify({ action, endpoint: endpoint.count, aor: aor.count, identify: identify.count, loopbackIpMatches: sameHost.count, context: CONTEXT }));
      return;
    }
    if (action === 'create') {
      if (endpoint.count || aor.count || identify.count) throw new Error('Refusing to replace an existing loopback fixture row');
      await db.beginTransaction();
      try {
        await db.query('INSERT INTO ps_aors (id, contact, qualify_frequency) VALUES (?, ?, ?)', [ID, 'sip:127.0.0.1:5060', 0]);
        await db.query(
          'INSERT INTO ps_endpoints (id, tenantid, aors, context, disallow, allow, direct_media, identify_by, send_pai, send_rpid) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [ID, '2', ID, CONTEXT, 'all', 'ulaw', 'no', 'ip', 'yes', 'yes'],
        );
        await db.query('INSERT INTO ps_endpoint_id_ips (id, endpoint, `match`, type) VALUES (?, ?, ?, ?)', [IDENTIFY_ID, ID, '127.0.0.1', 'identify']);
        await db.commit();
      } catch (error) {
        await db.rollback();
        throw error;
      }
      console.log(JSON.stringify({ action, created: ID, context: CONTEXT }));
      return;
    }
    await db.beginTransaction();
    try {
      await db.query('DELETE FROM ps_endpoint_id_ips WHERE id = ? AND endpoint = ?', [IDENTIFY_ID, ID]);
      await db.query('DELETE FROM ps_endpoints WHERE id = ? AND tenantid = ?', [ID, '2']);
      await db.query('DELETE FROM ps_aors WHERE id = ?', [ID]);
      await db.commit();
    } catch (error) {
      await db.rollback();
      throw error;
    }
    console.log(JSON.stringify({ action, removed: ID }));
  } finally {
    await db.end();
  }
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
