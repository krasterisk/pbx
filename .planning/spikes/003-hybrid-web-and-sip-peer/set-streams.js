/**
 * Spike 003, step 1 — put a web participant into a hardware phone's position.
 *
 * A desk phone differs from a browser in two ways: it carries a single video
 * stream, and it speaks plain RTP instead of WebRTC. This step isolates the
 * first difference, because it is the cheaper of the two to falsify: if an SFU
 * conference cannot serve a single-stream participant at all, the transport
 * half never needs building.
 *
 * Run: node .planning/spikes/003-hybrid-web-and-sip-peer/set-streams.js <endpoint> <n>
 */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const AsteriskManager = require('asterisk-manager');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');

const endpoint = process.argv[2] || 'spike002b';
const streams = Number(process.argv[3] ?? 1);

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
  const conn = await mysql.createConnection({
    host: env.DB_HOST, port: Number(env.DB_PORT || 3306),
    user: env.DB_USER, password: env.DB_PASSWORD, database: env.DB_NAME,
  });
  const [res] = await conn.query('UPDATE ps_endpoints SET max_video_streams = ? WHERE id = ?', [streams, endpoint]);
  await conn.end();
  if (!res.affectedRows) throw new Error(`endpoint ${endpoint} not found in ps_endpoints`);
  console.log(`\n  OK ${endpoint}.max_video_streams = ${streams}`);

  const ami = await connectAmi();
  // Realtime rows are read per call, but sorcery may hold a cached copy.
  console.log(`  ... ${norm(await amiAction(ami, { action: 'Command', command: 'pjsip reload' })).trim()}`);

  const shown = norm(await amiAction(ami, { action: 'Command', command: `pjsip show endpoint ${endpoint}` }))
    .split('\n').filter((l) => /max_video_streams|max_audio_streams|^\s*allow|webrtc/.test(l));
  console.log(shown.map((l) => `  ${l.trim()}`).join('\n'));

  ami.disconnect();
  process.exit(0);
})().catch((e) => { console.error(`\n! ${e.message}\n`); process.exit(1); });
