/**
 * Spike 003, step 2 — a classic (non-WebRTC) SIP endpoint.
 *
 * Cloned from a real tenant phone (`e1000_0`: plain UDP, no DTLS, no ICE) so the
 * transport half of the hybrid is tested against what tenants actually run, not
 * against an idealised endpoint. Video codecs and the stream budget are the only
 * deliberate departures — and how far they have to depart is the question.
 *
 * Run:  node .planning/spikes/003-hybrid-web-and-sip-peer/provision-classic.js [maxVideoStreams]
 * Undo: node .planning/spikes/003-hybrid-web-and-sip-peer/teardown.js
 */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');

const TEMPLATE = 'e1000_0'; // a real tenant desk phone
const USER = 'spike003p';
const PASSWORD = 'Sp1ke003Secret';
const CONTEXT = 'spike002'; // same dialplan the web participants dial into
const CODECS = 'ulaw,alaw,vp8';
const MAX_VIDEO_STREAMS = Number(process.argv[2] ?? 3);

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
  await cloneRow(conn, 'ps_auths', TEMPLATE, USER, { username: USER, password: PASSWORD });
  await cloneRow(conn, 'ps_endpoints', TEMPLATE, USER, {
    auth: USER,
    aors: USER,
    context: CONTEXT,
    transport: 'transport-udp',
    disallow: 'all',
    allow: CODECS,
    max_audio_streams: 1,
    max_video_streams: MAX_VIDEO_STREAMS,
    webrtc: null,
    media_encryption: 'no',
    ice_support: 'no',
    rtcp_mux: 'no',
    use_avpf: 'no',
    direct_media: 'no',
    force_rport: 'yes',
    rtp_symmetric: 'yes',
    rewrite_contact: 'yes',
    callerid: `${USER} <${USER}>`,
  });

  const [[row]] = await conn.query(
    'SELECT id, transport, allow, max_video_streams, media_encryption, ice_support, use_avpf, context FROM ps_endpoints WHERE id = ?',
    [USER],
  );
  await conn.end();

  console.log('\n=== classic endpoint provisioned ===');
  console.table([row]);
  console.log(`\npassword: ${PASSWORD}\n`);
  process.exit(0);
})().catch((e) => { console.error(`\n! ${e.message}\n`); process.exit(1); });
