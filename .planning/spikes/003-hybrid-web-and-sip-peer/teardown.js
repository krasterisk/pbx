/**
 * Spike 003 — undo. Idempotent, safe to run twice.
 *
 * Removes the classic endpoint and the third web participant. The room, the
 * dialplan and the two original web endpoints belong to spike 002 and are left
 * alone — run that spike's teardown for those.
 */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const AsteriskManager = require('asterisk-manager');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const USERS = ['spike003p', 'spike002c'];

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

function connectAmi() {
  return new Promise((resolve, reject) => {
    const ami = new AsteriskManager(Number(env.AMI_PORT), env.AMI_HOST, env.AMI_LOGIN, env.AMI_SECRET, false);
    const timer = setTimeout(() => reject(new Error('AMI connect timeout')), 10000);
    ami.on('connect', () => { clearTimeout(timer); resolve(ami); });
    ami.on('error', (e) => { clearTimeout(timer); reject(e); });
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

const norm = (r) => {
  const out = r?.output ?? r?.content ?? r?.message ?? r;
  return Array.isArray(out) ? out.join('\n') : String(out ?? '');
};

(async () => {
  const ami = await connectAmi();

  const channels = norm(await amiAction(ami, { action: 'Command', command: 'core show channels' }));
  for (const line of channels.split('\n')) {
    const m = line.match(/^(PJSIP\/(?:spike003p|spike002c)-\S+)/);
    if (m) {
      await amiAction(ami, { action: 'Hangup', channel: m[1] }).catch(() => {});
      console.log(`  hung up ${m[1]}`);
    }
  }

  const conn = await mysql.createConnection({
    host: env.DB_HOST, port: Number(env.DB_PORT || 3306),
    user: env.DB_USER, password: env.DB_PASSWORD, database: env.DB_NAME,
  });
  for (const user of USERS) {
    for (const table of ['ps_endpoints', 'ps_auths', 'ps_aors']) {
      await conn.query(`DELETE FROM ${table} WHERE id = ?`, [user]);
    }
    console.log(`  removed ${user}`);
  }
  await conn.end();

  await amiAction(ami, { action: 'Command', command: 'pjsip reload' });
  ami.disconnect();
  console.log('\nspike 003 torn down\n');
  process.exit(0);
})().catch((e) => { console.error(`\n! ${e.message}\n`); process.exit(1); });
