/**
 * Spike 003 — what a non-WebRTC endpoint looks like on this box.
 *
 * The classic half of the hybrid needs a template to clone: a plain UDP endpoint
 * with no DTLS/ICE. Reading the live config beats guessing at pjsip.conf defaults.
 */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const AsteriskManager = require('asterisk-manager');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');

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

  const [nonWebrtc] = await conn.query(
    "SELECT id, transport, webrtc, allow, max_video_streams, context, direct_media, force_rport, rtp_symmetric " +
    "FROM ps_endpoints WHERE webrtc IS NULL OR webrtc <> 'yes' LIMIT 8",
  );
  console.log('\n=== non-WebRTC endpoints (clone candidates) ===');
  console.table(nonWebrtc);

  const [webrtc] = await conn.query(
    "SELECT id, transport, webrtc FROM ps_endpoints WHERE webrtc = 'yes' LIMIT 5",
  );
  console.log('\n=== WebRTC endpoints (for contrast) ===');
  console.table(webrtc);

  await conn.end();

  const ami = await connectAmi();
  console.log('\n=== pjsip show transports ===');
  console.log(norm(await amiAction(ami, { action: 'Command', command: 'pjsip show transports' })));
  ami.disconnect();
  process.exit(0);
})().catch((e) => { console.error(`\n! ${e.message}\n`); process.exit(1); });
