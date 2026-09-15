/**
 * Spike 002 — live peek at what Asterisk thinks is going on.
 *
 * Usage: node .planning/spikes/002-confbridge-sfu-video-grid/peek.js [extra CLI command ...]
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

const DEFAULT_COMMANDS = [
  'core show channels',
  'confbridge list',
  'pjsip show contacts',
  'pjsip show aor spike002a',
];

(async () => {
  const ami = await new Promise((resolve, reject) => {
    const a = new AsteriskManager(Number(env.AMI_PORT), env.AMI_HOST, env.AMI_LOGIN, env.AMI_SECRET, false);
    const t = setTimeout(() => reject(new Error('AMI connect timeout')), 10000);
    a.on('connect', () => { clearTimeout(t); resolve(a); });
    a.on('error', (e) => { clearTimeout(t); reject(e); });
  });

  const commands = process.argv.length > 2 ? [process.argv.slice(2).join(' ')] : DEFAULT_COMMANDS;

  for (const command of commands) {
    const out = await new Promise((resolve) => {
      ami.action({ action: 'Command', command }, (err, res) => {
        const r = err && err.response !== 'Success' ? { output: `ERROR: ${err.message}` } : (err?.response === 'Success' ? err : res);
        const o = r?.output ?? r?.content ?? r?.message ?? r;
        resolve(Array.isArray(o) ? o.join('\n') : String(o ?? ''));
      });
    });
    console.log(`\n=== ${command} ===\n${out}`);
  }

  ami.disconnect();
  process.exit(0);
})().catch((e) => { console.error(e.message); process.exit(1); });
