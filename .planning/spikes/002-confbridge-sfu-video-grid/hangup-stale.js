/**
 * Spike 002 — reap spike channels left behind by page reloads.
 *
 * Reloading a tab kills the WebSocket without sending BYE, so Asterisk keeps the
 * channel in the conference. Those dead members still occupy SFU stream slots, and
 * live participants end up receiving nothing — which is exactly how this script came
 * to exist. Touches only PJSIP/spike002* channels.
 *
 * Run: node .planning/spikes/002-confbridge-sfu-video-grid/hangup-stale.js
 */

const fs = require('fs');
const path = require('path');
const AsteriskManager = require('asterisk-manager');

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
  const ami = await new Promise((resolve, reject) => {
    const a = new AsteriskManager(Number(env.AMI_PORT), env.AMI_HOST, env.AMI_LOGIN, env.AMI_SECRET, false);
    const t = setTimeout(() => reject(new Error('AMI connect timeout')), 10000);
    a.on('connect', () => { clearTimeout(t); resolve(a); });
    a.on('error', (e) => { clearTimeout(t); reject(e); });
  });

  const run = (action) => new Promise((resolve) => {
    ami.action(action, (err, res) => {
      const r = err && err.response !== 'Success' ? { output: `ERROR: ${err.message}` } : (err?.response === 'Success' ? err : res);
      const o = r?.output ?? r?.content ?? r?.message ?? r;
      resolve(Array.isArray(o) ? o.join('\n') : String(o ?? ''));
    });
  });

  const list = await run({ action: 'Command', command: 'core show channels' });
  const channels = list.split('\n')
    .map((l) => (l.match(/^(PJSIP\/spike002\S+)/) || [])[1])
    .filter(Boolean);

  console.log(`\nFound ${channels.length} spike channels\n`);
  for (const channel of channels) {
    await run({ action: 'Hangup', channel });
    console.log(`  ✓ hung up ${channel}`);
  }

  ami.disconnect();
  console.log('');
  process.exit(0);
})().catch((e) => { console.error(e.message); process.exit(1); });
