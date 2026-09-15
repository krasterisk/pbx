/**
 * Spike 002, step 0 — can the realtime schema even express a multi-stream endpoint?
 *
 * Asterisk SFU requires max_video_streams > 1 on the PJSIP endpoint. The project
 * provisions endpoints through realtime (ps_endpoints), and NAT_PROFILES.webrtc
 * never sets that option — so before building anything, check whether the column
 * exists in the live schema at all.
 *
 * Read-only.
 *
 * Run: node .planning/spikes/002-confbridge-sfu-video-grid/check-schema.js
 */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');

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

(async () => {
  const conn = await mysql.createConnection({
    host: env.DB_HOST,
    port: Number(env.DB_PORT || 3306),
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
  });

  console.log(`\n=== Spike 002 / step 0: realtime schema @ ${env.DB_HOST}/${env.DB_NAME} ===\n`);

  const [cols] = await conn.query(
    `SELECT COLUMN_NAME, COLUMN_TYPE FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'ps_endpoints'
       AND COLUMN_NAME IN ('max_video_streams','max_audio_streams','webrtc','allow','bundle','rtcp_mux','ice_support','dtls_auto_generate_cert')
     ORDER BY COLUMN_NAME`,
    [env.DB_NAME],
  );
  console.log('Relevant ps_endpoints columns:');
  if (!cols.length) console.log('  (none of them exist!)');
  for (const c of cols) console.log(`  ${c.COLUMN_NAME.padEnd(26)} ${c.COLUMN_TYPE}`);

  const [webrtcEps] = await conn.query(
    `SELECT id, allow, max_audio_streams, max_video_streams FROM ps_endpoints WHERE webrtc = 'yes' LIMIT 5`,
  ).catch(() => [[]]);
  console.log('\nExisting webrtc endpoints (sample):');
  if (!webrtcEps.length) console.log('  (none)');
  for (const e of webrtcEps) {
    console.log(`  ${e.id} | allow=${e.allow} | audio=${e.max_audio_streams} | video=${e.max_video_streams}`);
  }

  const [tables] = await conn.query(
    `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN ('ps_endpoints','ps_auths','ps_aors')`,
    [env.DB_NAME],
  );
  console.log(`\nRealtime tables present: ${tables.map((t) => t.TABLE_NAME).join(', ') || 'none'}`);

  await conn.end();
  console.log('');
})();
