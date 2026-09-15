/**
 * Spike 002 — live AMI event tap.
 *
 * Asterisk will not hand us a SIP trace over AMI (pjsip history needs DEVMODE, and the
 * CLI logger writes to console). Security events plus channel/ConfBridge events are the
 * next best witness: they show whether a request was even seen, and where it stopped.
 *
 * Run: node .planning/spikes/002-confbridge-sfu-video-grid/watch-events.js [seconds]
 */

const fs = require('fs');
const path = require('path');
const AsteriskManager = require('asterisk-manager');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const OUT_DIR = path.join(__dirname, 'results');
const SECONDS = Number(process.argv[2] || 45);

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

// Everything interesting for this spike: auth outcomes, channel lifecycle, conference state
const INTERESTING = /^(challengesent|successfulauth|invalidaccountid|invalidpassword|challengeresponsefailed|failedacl|sessionlimit|newchannel|newstate|hangup|confbridge|varset|softhangup)/i;
const captured = [];

(async () => {
  const ami = await new Promise((resolve, reject) => {
    const a = new AsteriskManager(Number(env.AMI_PORT), env.AMI_HOST, env.AMI_LOGIN, env.AMI_SECRET, true);
    const t = setTimeout(() => reject(new Error('AMI connect timeout')), 10000);
    a.on('connect', () => { clearTimeout(t); resolve(a); });
    a.on('error', (e) => { clearTimeout(t); reject(e); });
  });

  console.log(`\n=== watching AMI events for ${SECONDS}s (filter: auth / channel / confbridge) ===\n`);

  ami.on('managerevent', (evt) => {
    const name = String(evt.event || '');
    if (!INTERESTING.test(name)) return;
    // VarSet is noisy — keep only conference-related variables
    if (/^varset$/i.test(name) && !/CONFBRIDGE|BRIDGEPEER/i.test(JSON.stringify(evt))) return;

    const stamp = new Date().toISOString().slice(11, 23);
    captured.push({ t: stamp, ...evt });
    const detail = [evt.accountid, evt.channel, evt.conference, evt.exten, evt.context, evt.channelstatedesc, evt.cause]
      .filter(Boolean).join(' | ');
    console.log(`${stamp}  ${name.padEnd(22)} ${detail}`);
  });

  setTimeout(() => {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    const file = path.join(OUT_DIR, `events-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    fs.writeFileSync(file, JSON.stringify(captured, null, 2));
    console.log(`\n${captured.length} events → ${path.relative(REPO_ROOT, file)}\n`);
    ami.disconnect();
    process.exit(0);
  }, SECONDS * 1000);
})().catch((e) => { console.error(e.message); process.exit(1); });
