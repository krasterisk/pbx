/**
 * Spike 001 — Asterisk recon for the teleconference module.
 *
 * Asks the live test PBX what it actually is, over both control planes we might
 * build on: ARI (REST) and AMI (Command). Credentials come from the repo .env.
 *
 * Run: node .planning/spikes/001-asterisk-recon/recon.js
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const OUT_DIR = path.join(__dirname, 'results');

// --- env -------------------------------------------------------------------

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

// --- ARI -------------------------------------------------------------------

function ariGet(resource) {
  const isHttps = (env.ARI_PROTOCOL || 'http') === 'https';
  const lib = isHttps ? https : http;
  const auth = Buffer.from(`${env.ARI_USER}:${env.ARI_PASSWORD}`).toString('base64');

  return new Promise((resolve) => {
    const req = lib.request(
      {
        host: env.ARI_HOST,
        port: Number(env.ARI_PORT),
        path: `/ari/${resource}`,
        method: 'GET',
        headers: { Authorization: `Basic ${auth}` },
        rejectUnauthorized: false, // spike: test box may carry a self-signed cert
        timeout: 8000,
      },
      (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          if (res.statusCode !== 200) {
            resolve({ error: `HTTP ${res.statusCode}`, body: body.slice(0, 400) });
            return;
          }
          try {
            resolve({ data: JSON.parse(body) });
          } catch (e) {
            resolve({ error: `unparseable body: ${e.message}`, body: body.slice(0, 400) });
          }
        });
      },
    );
    req.on('timeout', () => { req.destroy(); resolve({ error: 'timeout after 8s' }); });
    req.on('error', (e) => resolve({ error: e.message }));
    req.end();
  });
}

// --- AMI -------------------------------------------------------------------

const AsteriskManager = require('asterisk-manager');

const CLI_COMMANDS = [
  // identity
  'core show version',
  'core show settings',
  // is ConfBridge even here, and what does its stock profile say about video
  'module show like confbridge',
  'confbridge show profile bridges',
  'confbridge show profile bridge default_bridge',
  'confbridge show menus',
  'confbridge list',
  // the ARI alternative for R-ENGINE
  'module show like res_ari',
  'ari show apps',
  // video: what the build knows and what the RTP layer supports
  'core show codecs video',
  'module show like res_pjsip_sdp_rtp',
  'module show like res_rtp',
  // capacity groundwork for spike 005
  'core show sysinfo',
  'core show channels count',
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
    const done = (value) => { if (!settled) { settled = true; resolve(value); } };
    const timer = setTimeout(() => done({ error: 'timeout after 10s' }), 10000);

    ami.action({ action: 'Command', command }, (err, res) => {
      clearTimeout(timer);
      // asterisk-manager quirk (mirrored in AmiService.action): success can arrive as `err`
      if (err && err.response !== 'Success') {
        done({ error: err.message || JSON.stringify(err) });
        return;
      }
      done({ output: normalizeOutput(err && err.response === 'Success' ? err : res) });
    });
  });
}

function connectAmi() {
  return new Promise((resolve, reject) => {
    // 5th arg = events flag; recon does not need the event firehose
    const ami = new AsteriskManager(
      Number(env.AMI_PORT),
      env.AMI_HOST,
      env.AMI_LOGIN,
      env.AMI_SECRET,
      false,
    );
    const timer = setTimeout(() => reject(new Error('AMI connect timeout after 10s')), 10000);
    ami.on('connect', () => { clearTimeout(timer); resolve(ami); });
    ami.on('error', (e) => { clearTimeout(timer); reject(e); });
  });
}

// --- report ----------------------------------------------------------------

function firstLine(text) {
  return (text || '').split('\n').find((l) => l.trim()) || '';
}

function summarize(report) {
  const cli = report.ami.commands || {};
  const version = firstLine(cli['core show version']?.output);
  // certified builds report as "Asterisk certified-22.8-cert2", not "Asterisk 22.8"
  const major = Number((version.match(/Asterisk (?:certified-)?(\d+)/) || [])[1] || 0);
  const confbridgeModule = cli['module show like confbridge']?.output || '';
  const videoCodecs = cli['core show codecs video']?.output || '';
  const bridgeProfile = cli['confbridge show profile bridge default_bridge']?.output || '';

  return {
    version,
    majorVersion: major || null,
    // video_mode=sfu landed in Asterisk 15
    sfuSupportedByVersion: major ? major >= 15 : null,
    appConfbridgeLoaded: /app_confbridge\.so/.test(confbridgeModule) && /Running|1 modules loaded/i.test(confbridgeModule),
    ariReachable: !report.ari.info?.error,
    ariVersion: report.ari.info?.data?.system?.version || null,
    ariModulesLoaded: (report.ari.modules?.data || [])
      .filter((m) => /^res_ari_/.test(m.name) && m.status === 'Running')
      .map((m) => m.name),
    defaultBridgeVideoMode: (bridgeProfile.match(/video mode.*$/im) || [])[0] || null,
    videoCodecsKnown: videoCodecs
      .split('\n')
      .filter((l) => /^\s*\d+\s+video/i.test(l))
      .map((l) => l.trim()),
  };
}

// --- main ------------------------------------------------------------------

(async () => {
  const report = { startedAt: new Date().toISOString(), target: env.AMI_HOST, ari: {}, ami: { commands: {} } };

  console.log(`\n=== Spike 001: Asterisk recon @ ${env.AMI_HOST} ===\n`);

  console.log('[ARI] GET /ari/asterisk/info ...');
  report.ari.info = await ariGet('asterisk/info');
  console.log(report.ari.info.error ? `  ✗ ${report.ari.info.error}` : '  ✓ ok');

  console.log('[ARI] GET /ari/asterisk/modules ...');
  report.ari.modules = await ariGet('asterisk/modules');
  console.log(report.ari.modules.error ? `  ✗ ${report.ari.modules.error}` : `  ✓ ${report.ari.modules.data.length} modules`);

  let ami;
  try {
    console.log(`[AMI] connecting to ${env.AMI_HOST}:${env.AMI_PORT} as ${env.AMI_LOGIN} ...`);
    ami = await connectAmi();
    console.log('  ✓ connected');
    report.ami.connected = true;
  } catch (e) {
    console.log(`  ✗ ${e.message}`);
    report.ami.connected = false;
    report.ami.error = e.message;
  }

  if (ami) {
    for (const cmd of CLI_COMMANDS) {
      const res = await amiCommand(ami, cmd);
      report.ami.commands[cmd] = res;
      console.log(`  ${res.error ? '✗' : '✓'} ${cmd}${res.error ? ` — ${res.error}` : ''}`);
    }
    ami.disconnect();
  }

  report.summary = summarize(report);
  report.finishedAt = new Date().toISOString();

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, `recon-${report.startedAt.replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(file, JSON.stringify(report, null, 2));

  console.log('\n--- Summary ---');
  console.log(JSON.stringify(report.summary, null, 2));
  console.log(`\nFull report: ${path.relative(REPO_ROOT, file)}\n`);

  process.exit(0);
})();
