/**
 * Spike 003 — a third web participant.
 *
 * Two participants prove the mechanism; they do not prove a grid. Three is the
 * smallest number at which "everyone sees everyone" says more than "the call
 * connected", and the difference decides whether the layout in D-24 is real.
 *
 * Run: node .planning/spikes/003-hybrid-web-and-sip-peer/add-web-endpoint.js [id]
 */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const TEMPLATE = 'spike002a';
const USER = process.argv[2] || 'spike002c';

function loadEnv() {
  const raw = fs.readFileSync(path.join(REPO_ROOT, '.env'), 'utf8');
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return env;
}
const env = loadEnv();

async function cloneRow(conn, table, templateId, newId, overrides) {
  const [rows] = await conn.query(`SELECT * FROM ${table} WHERE id = ?`, [templateId]);
  if (!rows.length) throw new Error(`${table}: template row ${templateId} not found`);
  const row = { ...rows[0], ...overrides, id: newId };
  await conn.query(`DELETE FROM ${table} WHERE id = ?`, [newId]);
  const cols = Object.keys(row);
  await conn.query(
    `INSERT INTO ${table} (${cols.map((c) => `\`${c}\``).join(',')}) VALUES (${cols.map(() => '?').join(',')})`,
    cols.map((c) => row[c]),
  );
}

(async () => {
  const conn = await mysql.createConnection({
    host: env.DB_HOST, port: Number(env.DB_PORT || 3306),
    user: env.DB_USER, password: env.DB_PASSWORD, database: env.DB_NAME,
  });
  await cloneRow(conn, 'ps_aors', TEMPLATE, USER, { max_contacts: 1, remove_existing: 'yes' });
  await cloneRow(conn, 'ps_auths', TEMPLATE, USER, { username: USER, password: 'Sp1ke002Secret' });
  await cloneRow(conn, 'ps_endpoints', TEMPLATE, USER, {
    auth: USER, aors: USER, callerid: `${USER} <${USER}>`, max_video_streams: 10,
  });
  await conn.end();
  console.log(`\n  OK ${USER} cloned from ${TEMPLATE} (max_video_streams=10)\n`);
  process.exit(0);
})().catch((e) => { console.error(`\n! ${e.message}\n`); process.exit(1); });
