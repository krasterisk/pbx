/**
 * Spike 002, step 1 — provision the room and two multi-stream WebRTC endpoints.
 *
 * Deliberately uses the production mechanisms so the spike validates the real path:
 *   - endpoints go into realtime (ps_endpoints/ps_auths/ps_aors), cloned from the
 *     tenant's existing WebRTC companion so transport/NAT settings are known-good
 *   - the room is a DYNAMIC CONFBRIDGE() profile in a dialplan context written via
 *     AMI CreateConfig/UpdateConfig + `dialplan reload` — exactly D-02
 *
 * Run: node .planning/spikes/002-confbridge-sfu-video-grid/provision.js
 * Undo: node .planning/spikes/002-confbridge-sfu-video-grid/teardown.js
 */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const AsteriskManager = require('asterisk-manager');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');

// --- spike constants (hardcoded on purpose) ---
const TEMPLATE_ENDPOINT = 'ew110_0'; // known-good WebRTC companion to clone from
const USERS = ['spike002a', 'spike002b'];
const PASSWORD = 'Sp1ke002Secret';
const CONTEXT = 'spike002';
const ROOM_EXTEN = '9001';
const ROOM_NAME = 'conf9001_0'; // exercises the D-06 naming scheme conf{номер}_{uid}
const DIALPLAN_FILE = `krasterisk/routes/extensions_${CONTEXT}.conf`;
const CODECS = 'opus,ulaw,vp8,h264';
const MAX_VIDEO_STREAMS = 10;

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

// --- AMI -------------------------------------------------------------------

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
      // asterisk-manager quirk mirrored from AmiService.action
      if (err && err.response !== 'Success') return reject(new Error(err.message || JSON.stringify(err)));
      resolve(err && err.response === 'Success' ? err : res);
    });
  });
}

function normalize(res) {
  const out = res?.output ?? res?.content ?? res?.message ?? res;
  return Array.isArray(out) ? out.join('\n') : String(out ?? '');
}

const cmd = async (ami, command) => normalize(await amiAction(ami, { action: 'Command', command }));

/** Mirrors DialplanApplyService.applyCategories line splitting (Var / "> value"). */
async function applyCategory(ami, filename, category, lines) {
  try {
    await amiAction(ami, { action: 'CreateConfig', filename });
  } catch (e) {
    if (!/already exists|file exists/i.test(e.message)) throw e;
  }
  try {
    await amiAction(ami, {
      action: 'UpdateConfig', srcfilename: filename, dstfilename: filename, reload: 'no',
      'Action-000000': 'DelCat', 'Cat-000000': category,
    });
  } catch { /* category may not exist yet */ }

  await amiAction(ami, {
    action: 'UpdateConfig', srcfilename: filename, dstfilename: filename, reload: 'no',
    'Action-000000': 'NewCat', 'Cat-000000': category,
  });

  const batch = { action: 'UpdateConfig', srcfilename: filename, dstfilename: filename, reload: 'no' };
  lines.forEach((line, idx) => {
    const p = String(idx).padStart(6, '0');
    const arrow = line.indexOf('=>');
    batch[`Action-${p}`] = 'Append';
    batch[`Cat-${p}`] = category;
    batch[`Var-${p}`] = line.substring(0, arrow).trim();
    batch[`Value-${p}`] = `> ${line.substring(arrow + 2).trim()}`;
  });
  await amiAction(ami, batch);
}

// --- realtime endpoints ----------------------------------------------------

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

// --- main ------------------------------------------------------------------

(async () => {
  console.log(`\n=== Spike 002 / provision @ ${env.AMI_HOST} ===\n`);

  const conn = await mysql.createConnection({
    host: env.DB_HOST, port: Number(env.DB_PORT || 3306),
    user: env.DB_USER, password: env.DB_PASSWORD, database: env.DB_NAME,
  });

  for (const user of USERS) {
    await cloneRow(conn, 'ps_aors', TEMPLATE_ENDPOINT, user, { max_contacts: 1, remove_existing: 'yes' });
    await cloneRow(conn, 'ps_auths', TEMPLATE_ENDPOINT, user, { username: user, password: PASSWORD });
    await cloneRow(conn, 'ps_endpoints', TEMPLATE_ENDPOINT, user, {
      auth: user,
      aors: user,
      context: CONTEXT,
      disallow: 'all',
      allow: CODECS,
      max_audio_streams: 1,
      max_video_streams: MAX_VIDEO_STREAMS, // the whole point — default is 1, no grid without it
      webrtc: 'yes',
      direct_media: 'no',
      callerid: `${user} <${user}>`,
    });
    console.log(`  ✓ endpoint ${user} (allow=${CODECS}, max_video_streams=${MAX_VIDEO_STREAMS})`);
  }
  await conn.end();

  const ami = await connectAmi();
  console.log('\n  ✓ AMI connected');

  // The room: everything that matters is set as a DYNAMIC profile, no confbridge.conf
  const lines = [
    `exten => ${ROOM_EXTEN},1,NoOp(spike002 sfu grid room)`,
    'same => n,Answer()',
    'same => n,Set(CONFBRIDGE(bridge,video_mode)=sfu)',
    'same => n,Set(CONFBRIDGE(bridge,enable_events)=yes)',
    'same => n,Set(CONFBRIDGE(bridge,max_members)=10)',
    'same => n,Set(CONFBRIDGE(user,talk_detection_events)=yes)',
    'same => n,Set(CONFBRIDGE(user,announce_join_leave)=no)',
    'same => n,Set(CONFBRIDGE(user,quiet)=yes)',
    `same => n,ConfBridge(${ROOM_NAME})`,
    'same => n,Hangup()',
  ];

  await applyCategory(ami, DIALPLAN_FILE, CONTEXT, lines);
  console.log(`  ✓ dialplan written to ${DIALPLAN_FILE} [${CONTEXT}]`);

  console.log(`  ... ${await cmd(ami, 'dialplan reload')}`.trim());

  console.log('\n--- verification ---');
  console.log(await cmd(ami, `dialplan show ${ROOM_EXTEN}@${CONTEXT}`));
  for (const user of USERS) {
    const out = await cmd(ami, `pjsip show endpoint ${user}`);
    const streams = out.split('\n').filter((l) => /max_video_streams|max_audio_streams|webrtc|^\s*allow/.test(l));
    console.log(`\n[${user}]`);
    console.log(streams.map((l) => `  ${l.trim()}`).join('\n') || '  (endpoint not found!)');
  }

  ami.disconnect();
  console.log(`\nRoom ready: dial ${ROOM_EXTEN} from context ${CONTEXT} → ConfBridge(${ROOM_NAME})\n`);
  process.exit(0);
})().catch((e) => { console.error(`\n✗ ${e.message}\n`); process.exit(1); });
