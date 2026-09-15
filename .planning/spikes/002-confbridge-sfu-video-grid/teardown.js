/**
 * Spike 002 — undo everything provision.js and the probes created on the test PBX.
 *
 * Removes: realtime endpoints/auths/aors, the dialplan context, and the static
 * confbridge.conf profile. Safe to run repeatedly.
 *
 * Run: node .planning/spikes/002-confbridge-sfu-video-grid/teardown.js
 */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const AsteriskManager = require('asterisk-manager');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const USERS = ['spike002a', 'spike002b'];
const CONTEXT = 'spike002';
const PROFILE = 'spike_sfu_bridge';
const DIALPLAN_FILE = `krasterisk/routes/extensions_${CONTEXT}.conf`;

function loadEnv() {
  const raw = fs.readFileSync(path.join(REPO_ROOT, '.env'), 'utf8');
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return env;
}
const env = loadEnv();

function connectAmi() {
  return new Promise((resolve, reject) => {
    const a = new AsteriskManager(Number(env.AMI_PORT), env.AMI_HOST, env.AMI_LOGIN, env.AMI_SECRET, false);
    const t = setTimeout(() => reject(new Error('AMI connect timeout')), 10000);
    a.on('connect', () => { clearTimeout(t); resolve(a); });
    a.on('error', (e) => { clearTimeout(t); reject(e); });
  });
}
function amiAction(ami, action) {
  return new Promise((resolve, reject) => {
    ami.action(action, (err, res) => {
      if (err && err.response !== 'Success') return reject(new Error(err.message || JSON.stringify(err)));
      resolve(err && err.response === 'Success' ? err : res);
    });
  });
}
const normalize = (r) => {
  const o = r?.output ?? r?.content ?? r?.message ?? r;
  return Array.isArray(o) ? o.join('\n') : String(o ?? '');
};

(async () => {
  console.log('\n=== Spike 002 / teardown ===\n');

  const conn = await mysql.createConnection({
    host: env.DB_HOST, port: Number(env.DB_PORT || 3306),
    user: env.DB_USER, password: env.DB_PASSWORD, database: env.DB_NAME,
  });
  for (const table of ['ps_endpoints', 'ps_auths', 'ps_aors']) {
    const [r] = await conn.query(`DELETE FROM ${table} WHERE id IN (?, ?)`, USERS);
    console.log(`  ✓ ${table}: ${r.affectedRows} rows removed`);
  }
  await conn.query('DELETE FROM ps_contacts WHERE endpoint IN (?, ?)', USERS).catch(() => {});
  await conn.end();

  const ami = await connectAmi();

  for (const [file, cat] of [[DIALPLAN_FILE, CONTEXT], ['confbridge.conf', PROFILE]]) {
    try {
      await amiAction(ami, {
        action: 'UpdateConfig', srcfilename: file, dstfilename: file, reload: 'no',
        'Action-000000': 'DelCat', 'Cat-000000': cat,
      });
      console.log(`  ✓ ${file}: [${cat}] removed`);
    } catch (e) {
      console.log(`  · ${file}: [${cat}] — ${e.message}`);
    }
  }

  console.log(`  ... ${normalize(await amiAction(ami, { action: 'Command', command: 'dialplan reload' }))}`.trim());
  console.log(`  ... ${normalize(await amiAction(ami, { action: 'Command', command: 'module reload app_confbridge.so' }))}`.trim());

  ami.disconnect();
  console.log('\nDone. The test PBX is back to its pre-spike state.\n');
  process.exit(0);
})().catch((e) => { console.error(`\n✗ ${e.message}\n`); process.exit(1); });
