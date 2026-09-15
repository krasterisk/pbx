/**
 * Spike 002, step 4 — how much of D-02 survives?
 *
 * Established so far: a static confbridge.conf profile forwards video, a dynamic
 * Set(CONFBRIDGE(bridge,video_mode)=sfu) does not. Two very different conclusions
 * follow depending on WHY, so two more rooms separate them:
 *
 *   9003 — dynamic max_members=1. If the second caller is refused, dynamic bridge
 *          profiles work in general and only video_mode is special.
 *   9004 — dynamic template=spike_sfu_bridge. If video flows here, tenant settings
 *          can still ride dynamically on top of a small set of platform templates,
 *          which keeps D-02 alive in a modified form.
 *
 * Run: node .planning/spikes/002-confbridge-sfu-video-grid/probe-dynamic-vs-template.js
 */

const fs = require('fs');
const path = require('path');
const AsteriskManager = require('asterisk-manager');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
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
  console.log('\n=== Spike 002 / dynamic vs template ===\n');

  await appendDialplan(ami, [
    'exten => 9003,1,NoOp(spike002 dynamic max_members probe)',
    'same => n,Answer()',
    'same => n,Set(CONFBRIDGE(bridge,max_members)=1)',
    'same => n,ConfBridge(conf9003_0)',
    'same => n,Hangup()',
    'exten => 9004,1,NoOp(spike002 dynamic template probe)',
    'same => n,Answer()',
    'same => n,Set(CONFBRIDGE(bridge,template)=spike_sfu_bridge)',
    'same => n,Set(CONFBRIDGE(user,announce_join_leave)=no)',
    'same => n,ConfBridge(conf9004_0)',
    'same => n,Hangup()',
  ]);

  console.log(`  ... ${await cmd(ami, 'dialplan reload')}`.trim());
  console.log(`\n${await cmd(ami, `dialplan show 9003@${CONTEXT}`)}`);
  console.log(`\n${await cmd(ami, `dialplan show 9004@${CONTEXT}`)}`);

  ami.disconnect();
  console.log('9003 = dynamic max_members=1   |   9004 = dynamic template → static sfu profile\n');
  process.exit(0);
})().catch((e) => { console.error(`\n✗ ${e.message}\n`); process.exit(1); });
