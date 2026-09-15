/**
 * Spike 002, step 3 — the decisive A/B for D-02.
 *
 * Both browsers send video and neither receives any, while `confbridge list` reports
 * the room running on default_bridge (which is "no video"). Hypothesis: the dynamic
 * Set(CONFBRIDGE(bridge,video_mode)=sfu) never takes effect.
 *
 * This writes a STATIC bridge profile into confbridge.conf and exposes a second room
 * (9002) that names it explicitly. Same clients, same codecs, only the profile source
 * differs — so whatever changes is caused by the profile mechanism alone.
 *
 * Run:  node .planning/spikes/002-confbridge-sfu-video-grid/static-profile-test.js
 */

const fs = require('fs');
const path = require('path');
const AsteriskManager = require('asterisk-manager');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const PROFILE = 'spike_sfu_bridge';
const CONTEXT = 'spike002';
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
const cmd = async (ami, c) => normalize(await amiAction(ami, { action: 'Command', command: c }));

/** Writes a category of `key = value` lines (confbridge.conf style, not dialplan style). */
async function writeCategory(ami, filename, category, pairs) {
  try { await amiAction(ami, { action: 'CreateConfig', filename }); }
  catch (e) { if (!/already exists|file exists/i.test(e.message)) throw e; }

  try {
    await amiAction(ami, {
      action: 'UpdateConfig', srcfilename: filename, dstfilename: filename, reload: 'no',
      'Action-000000': 'DelCat', 'Cat-000000': category,
    });
  } catch { /* not there yet */ }

  await amiAction(ami, {
    action: 'UpdateConfig', srcfilename: filename, dstfilename: filename, reload: 'no',
    'Action-000000': 'NewCat', 'Cat-000000': category,
  });

  const batch = { action: 'UpdateConfig', srcfilename: filename, dstfilename: filename, reload: 'no' };
  pairs.forEach(([k, v], i) => {
    const p = String(i).padStart(6, '0');
    batch[`Action-${p}`] = 'Append';
    batch[`Cat-${p}`] = category;
    batch[`Var-${p}`] = k;
    batch[`Value-${p}`] = v;
  });
  await amiAction(ami, batch);
}

async function appendDialplan(ami, lines) {
  const batch = { action: 'UpdateConfig', srcfilename: DIALPLAN_FILE, dstfilename: DIALPLAN_FILE, reload: 'no' };
  lines.forEach((line, i) => {
    const p = String(i).padStart(6, '0');
    const arrow = line.indexOf('=>');
    batch[`Action-${p}`] = 'Append';
    batch[`Cat-${p}`] = CONTEXT;
    batch[`Var-${p}`] = line.substring(0, arrow).trim();
    batch[`Value-${p}`] = `> ${line.substring(arrow + 2).trim()}`;
  });
  await amiAction(ami, batch);
}

(async () => {
  const ami = await connectAmi();
  console.log('\n=== Spike 002 / static profile A/B ===\n');

  await writeCategory(ami, 'confbridge.conf', PROFILE, [
    ['type', 'bridge'],
    ['video_mode', 'sfu'],
    ['enable_events', 'yes'],
  ]);
  console.log(`  ✓ confbridge.conf [${PROFILE}] written`);

  console.log(`  ... ${await cmd(ami, 'module reload app_confbridge.so')}`.trim());

  const profile = await cmd(ami, `confbridge show profile bridge ${PROFILE}`);
  const videoMode = profile.split('\n').find((l) => /video mode/i.test(l));
  console.log(`  profile says: ${videoMode ? videoMode.trim() : 'PROFILE NOT FOUND'}`);

  // Room 9002 names the static profile; room 9001 keeps the dynamic one for comparison
  await appendDialplan(ami, [
    'exten => 9002,1,NoOp(spike002 static sfu profile)',
    'same => n,Answer()',
    `same => n,ConfBridge(conf9002_0,${PROFILE})`,
    'same => n,Hangup()',
  ]);
  console.log(`  ... ${await cmd(ami, 'dialplan reload')}`.trim());
  console.log(`\n${await cmd(ami, `dialplan show 9002@${CONTEXT}`)}`);

  ami.disconnect();
  console.log(`Dial 9002 → ConfBridge(conf9002_0,${PROFILE}) — static video_mode=sfu\n`);
  process.exit(0);
})().catch((e) => { console.error(`\n✗ ${e.message}\n`); process.exit(1); });
