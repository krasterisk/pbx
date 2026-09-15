/**
 * Spike 001, iteration 2 — the parts recon.js missed.
 *
 * Two questions:
 *  1. Is the WebRTC stack actually present (SRTP, websocket transport, format
 *     attribute modules, timing source)? Without it there is no browser participant.
 *  2. Does this build know SFU video? Cheapest direct proof: create an ARI bridge
 *     of type video_sfu and read back its video_mode. Empty bridge, no channels —
 *     harmless, and deleted right after.
 *
 * Run: node .planning/spikes/001-asterisk-recon/probe-webrtc-and-sfu.js
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const AsteriskManager = require('asterisk-manager');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const OUT_DIR = path.join(__dirname, 'results');
const BRIDGE_ID = 'spike001-sfu-probe';

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

function ari(method, resource) {
  const isHttps = (env.ARI_PROTOCOL || 'http') === 'https';
  const lib = isHttps ? https : http;
  const auth = Buffer.from(`${env.ARI_USER}:${env.ARI_PASSWORD}`).toString('base64');
  return new Promise((resolve) => {
    const req = lib.request(
      {
        host: env.ARI_HOST,
        port: Number(env.ARI_PORT),
        path: `/ari/${resource}`,
        method,
        headers: { Authorization: `Basic ${auth}` },
        rejectUnauthorized: false,
        timeout: 8000,
      },
      (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          let data = null;
          try { data = body ? JSON.parse(body) : null; } catch { /* keep raw */ }
          resolve({ status: res.statusCode, data, raw: data ? undefined : body.slice(0, 400) });
        });
      },
    );
    req.on('timeout', () => { req.destroy(); resolve({ error: 'timeout after 8s' }); });
    req.on('error', (e) => resolve({ error: e.message }));
    req.end();
  });
}

const CLI_COMMANDS = [
  // WebRTC prerequisites — no SRTP, no browser participant
  'module show like res_srtp',
  'module show like res_http_websocket',
  'module show like res_pjsip_transport_websocket',
  'module show like res_rtp_asterisk',
  // video negotiation needs per-codec format attribute modules
  'module show like res_format_attr',
  // ConfBridge mixing needs a timing source
  'module show like res_timing',
  'timing test',
  // what the browser and the phones can actually agree on
  'core show codecs audio',
  'module show like codec_opus',
  'pjsip show transports',
  // user profiles: what "admin"/"marked" defaults look like today
  'confbridge show profile users',
  'confbridge show profile user default_user',
];

function normalizeOutput(res) {
  if (!res) return null;
  const out = res.output ?? res.content ?? res.message ?? res;
  if (Array.isArray(out)) return out.join('\n');
  if (typeof out === 'string') return out;
  return JSON.stringify(out);
}

function amiCommand(ami, command) {
  return new Promise((resolve) => {
    let settled = false;
    const done = (v) => { if (!settled) { settled = true; resolve(v); } };
    const timer = setTimeout(() => done({ error: 'timeout after 10s' }), 10000);
    ami.action({ action: 'Command', command }, (err, res) => {
      clearTimeout(timer);
      if (err && err.response !== 'Success') { done({ error: err.message || JSON.stringify(err) }); return; }
      done({ output: normalizeOutput(err && err.response === 'Success' ? err : res) });
    });
  });
}

function connectAmi() {
  return new Promise((resolve, reject) => {
    const ami = new AsteriskManager(Number(env.AMI_PORT), env.AMI_HOST, env.AMI_LOGIN, env.AMI_SECRET, false);
    const timer = setTimeout(() => reject(new Error('AMI connect timeout')), 10000);
    ami.on('connect', () => { clearTimeout(timer); resolve(ami); });
    ami.on('error', (e) => { clearTimeout(timer); reject(e); });
  });
}

(async () => {
  const report = { startedAt: new Date().toISOString(), target: env.AMI_HOST, cli: {}, sfuProbe: {} };
  console.log(`\n=== Spike 001 / iteration 2: WebRTC stack + SFU probe @ ${env.AMI_HOST} ===\n`);

  // --- 1. ARI video_sfu bridge probe ---
  console.log('[ARI] creating bridge type=mixing,video_sfu ...');
  report.sfuProbe.create = await ari('POST', `bridges?type=mixing,video_sfu&bridgeId=${BRIDGE_ID}&name=${BRIDGE_ID}`);
  console.log(`  status=${report.sfuProbe.create.status ?? 'ERR'} ${JSON.stringify(report.sfuProbe.create.data ?? report.sfuProbe.create.raw ?? report.sfuProbe.create.error)}`);

  if (report.sfuProbe.create.status === 200) {
    report.sfuProbe.read = await ari('GET', `bridges/${BRIDGE_ID}`);
    console.log(`[ARI] read back: ${JSON.stringify(report.sfuProbe.read.data)}`);
    report.sfuProbe.deleted = await ari('DELETE', `bridges/${BRIDGE_ID}`);
    console.log(`[ARI] cleanup: status=${report.sfuProbe.deleted.status}`);
  }

  // --- 2. AMI module/codec recon ---
  let ami;
  try {
    ami = await connectAmi();
    console.log('\n[AMI] connected');
  } catch (e) {
    console.log(`\n[AMI] ✗ ${e.message}`);
    report.amiError = e.message;
  }

  if (ami) {
    for (const cmd of CLI_COMMANDS) {
      const res = await amiCommand(ami, cmd);
      report.cli[cmd] = res;
      console.log(`  ${res.error ? '✗' : '✓'} ${cmd}${res.error ? ` — ${res.error}` : ''}`);
    }
    ami.disconnect();
  }

  const mod = (name) => {
    const out = report.cli[`module show like ${name}`]?.output || '';
    return /Running/.test(out);
  };
  report.summary = {
    sfuBridgeAccepted: report.sfuProbe.create?.status === 200,
    sfuBridgeVideoMode: report.sfuProbe.create?.data?.video_mode ?? null,
    srtp: mod('res_srtp'),
    httpWebsocket: mod('res_http_websocket'),
    pjsipWebsocketTransport: mod('res_pjsip_transport_websocket'),
    rtpAsterisk: mod('res_rtp_asterisk'),
    timing: mod('res_timing'),
    opus: mod('codec_opus'),
    formatAttrModules: (report.cli['module show like res_format_attr']?.output || '')
      .split('\n').filter((l) => /res_format_attr_\S+\.so/.test(l)).map((l) => l.trim()),
  };

  report.finishedAt = new Date().toISOString();
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, `probe-${report.startedAt.replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(file, JSON.stringify(report, null, 2));

  console.log('\n--- Summary ---');
  console.log(JSON.stringify(report.summary, null, 2));
  console.log(`\nFull report: ${path.relative(REPO_ROOT, file)}\n`);
  process.exit(0);
})();
