'use strict';
const http = require('node:http');
const net = require('node:net');
const fs = require('node:fs');
const path = require('node:path');

/** Static stand frontend plus streaming HTTP and Socket.IO upgrade forwarding. */
function createStandWebServer({ root, backendHost = 'backend', backendPort = 5010 }) {
  root = path.resolve(root);
  if (!/^[a-zA-Z0-9_.-]+$/.test(backendHost) || !Number.isInteger(backendPort) || backendPort < 1 || backendPort > 65535) throw Error('Invalid backend address');
  const sockets = new Set();
  const tunnels = new Set();
  const metrics = { requests: 0, upgrades: 0, upstreamErrors: 0, responses: {} };
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };
  const server = http.createServer((req, res) => {
    metrics.requests++;
    res.once('finish', () => { metrics.responses[res.statusCode] = (metrics.responses[res.statusCode] || 0) + 1; });
    if (req.url.startsWith('/api/') || req.url.startsWith('/socket.io/')) {
      const upstream = http.request({ hostname: backendHost, port: backendPort, path: req.url, method: req.method, headers: req.headers }, response => {
        res.writeHead(response.statusCode, response.headers);
        response.pipe(res);
      });
      upstream.once('socket', socket => socket.setNoDelay(true));
      upstream.once('error', () => {
        metrics.upstreamErrors++;
        if (!res.headersSent) { res.writeHead(502); res.end('Backend unavailable'); }
        else res.destroy();
      });
      res.once('close', () => upstream.destroy());
      req.pipe(upstream);
      return;
    }
    let file;
    try { file = path.resolve(root, '.' + decodeURIComponent(req.url.split('?')[0])); }
    catch { res.writeHead(400); res.end(); return; }
    if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
    try {
      if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
        if (path.extname(file) || file.startsWith(path.join(root, 'assets') + path.sep)) { res.writeHead(404); res.end(); return; }
        file = path.join(root, 'index.html');
      }
      res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
      res.setHeader('Cache-Control', file.endsWith('index.html') || !file.includes(path.sep + 'assets' + path.sep) ? 'no-store' : 'public, max-age=31536000, immutable');
      const stream = fs.createReadStream(file);
      stream.once('error', () => { if (!res.headersSent) res.writeHead(404); res.end(); });
      stream.pipe(res);
    } catch { res.writeHead(400); res.end(); }
  });
  server.on('connection', socket => { sockets.add(socket); socket.setNoDelay(true); socket.once('close', () => sockets.delete(socket)); });
  server.on('upgrade', (req, socket, head) => {
    if (!req.url.startsWith('/socket.io/')) { socket.destroy(); return; }
    metrics.upgrades++;
    const upstream = net.connect({ host: backendHost, port: backendPort });
    tunnels.add(upstream);
    upstream.setNoDelay(true);
    upstream.setTimeout(5000, () => upstream.destroy());
    upstream.once('connect', () => {
      upstream.setTimeout(0);
      upstream.write(`${req.method} ${req.url} HTTP/${req.httpVersion}\r\n`);
      for (let i = 0; i < req.rawHeaders.length; i += 2) upstream.write(req.rawHeaders[i] + ': ' + req.rawHeaders[i + 1] + '\r\n');
      upstream.write('\r\n');
      if (head.length) upstream.write(head);
      socket.pipe(upstream).pipe(socket);
    });
    upstream.once('error', () => { metrics.upstreamErrors++; socket.destroy(); });
    socket.once('error', () => upstream.destroy());
    socket.once('close', () => upstream.destroy());
    upstream.once('close', () => { tunnels.delete(upstream); socket.destroy(); });
  });
  const close = () => new Promise(resolve => { for (const socket of sockets) socket.destroy(); for (const socket of tunnels) socket.destroy(); server.close(resolve); });
  return { server, close, metrics, activeTunnels: () => tunnels.size };
}

if (require.main === module) {
  const web = createStandWebServer({ root: process.env.WEB_ROOT || '/app/packages/frontend/dist', backendHost: process.env.BACKEND_HOST || 'backend', backendPort: Number(process.env.BACKEND_PORT || 5010) });
  const timer = setInterval(() => console.info(JSON.stringify({ type: 'stand-web-metrics', at: Date.now(), ...web.metrics, activeTunnels: web.activeTunnels() })), 10000);
  web.server.listen(Number(process.env.PORT || 8080), '0.0.0.0');
  for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => { clearInterval(timer); void web.close().then(() => process.exit(0)); });
}
module.exports = { createStandWebServer };
