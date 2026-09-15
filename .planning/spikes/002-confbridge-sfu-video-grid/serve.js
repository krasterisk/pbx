/**
 * Spike 002, step 2 — local dev server for the browser client.
 *
 * Serves on http://localhost:8002 (a secure context, so getUserMedia works without TLS).
 * Bundles sip.js from node_modules on first start so the spike tests the exact version
 * the product uses (0.21.2), not a CDN build.
 *
 * Endpoints:
 *   GET  /config  → wss url, sip domain, spike credentials (kept out of the HTML)
 *   POST /log     → forensic event log from a browser tab, saved to results/
 *
 * Run: node .planning/spikes/002-confbridge-sfu-video-grid/serve.js
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const { execFileSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const PUBLIC_DIR = path.join(__dirname, 'public');
const OUT_DIR = path.join(__dirname, 'results');
const BUNDLE = path.join(PUBLIC_DIR, 'sip.bundle.js');
// Windows reserves scattered port ranges (Hyper-V/WinNAT), so fall forward until one binds
const PORT_CANDIDATES = [8002, 8102, 8402, 9002, 5502, 3002];

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

if (!fs.existsSync(BUNDLE)) {
  console.log('Bundling sip.js from node_modules ...');
  const esbuild = path.join(REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'esbuild.cmd' : 'esbuild');
  execFileSync(esbuild, [
    path.join(REPO_ROOT, 'node_modules', 'sip.js', 'lib', 'index.js'),
    '--bundle', '--format=iife', '--global-name=SIP', `--outfile=${BUNDLE}`,
  ], { stdio: 'inherit', shell: process.platform === 'win32' });
  console.log('  ✓ public/sip.bundle.js\n');
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css' };

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');

  if (url.pathname === '/config') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({
      wss: env.ASTERISK_WSS_URL,
      domain: env.SIP_DOMAIN,
      password: 'Sp1ke002Secret', // matches provision.js
      target: '9001',
    }));
    return;
  }

  if (url.pathname === '/log' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      fs.mkdirSync(OUT_DIR, { recursive: true });
      const name = `session-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      fs.writeFileSync(path.join(OUT_DIR, name), body);
      console.log(`  ✓ log saved: results/${name} (${(body.length / 1024).toFixed(1)} KiB)`);
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ saved: name }));
    });
    return;
  }

  const file = path.join(PUBLIC_DIR, url.pathname === '/' ? 'index.html' : url.pathname.slice(1));
  if (!file.startsWith(PUBLIC_DIR) || !fs.existsSync(file)) {
    res.writeHead(404); res.end('not found'); return;
  }
  res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

function listen(queue) {
  const port = queue.shift();
  if (!port) { console.error('No free port among candidates'); process.exit(1); }
  server.once('error', (e) => {
    if (e.code === 'EACCES' || e.code === 'EADDRINUSE') {
      console.log(`  port ${port} unavailable (${e.code}), trying next ...`);
      listen(queue);
    } else { throw e; }
  });
  server.listen(port, '127.0.0.1');
}

// registered once: a per-attempt callback would fire for every failed attempt too
server.on('listening', () => {
  const bound = server.address().port;
  console.log(`\n=== Spike 002 client ===\n`);
  console.log(`  Вкладка A: http://localhost:${bound}/?user=spike002a`);
  console.log(`  Вкладка B: http://localhost:${bound}/?user=spike002b`);
  console.log(`\n  Asterisk: ${env.ASTERISK_WSS_URL}\n`);
});

listen([...PORT_CANDIDATES]);
