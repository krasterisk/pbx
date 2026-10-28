'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { Server } = require('socket.io');
const { io } = require('socket.io-client');
const { createStandWebServer } = require('./stand-web.cjs');
const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));

test('stand proxy preserves HTTP auth, streams SSE and forwards authenticated websocket upgrades', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-stand-web-'));
  const upstream = http.createServer((req, res) => {
    if (req.url === '/api/events') { res.writeHead(200, { 'Content-Type': 'text/event-stream' }); res.write('event: heartbeat\ndata: 1\n\n'); return; }
    res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ authorization: req.headers.authorization || null }));
  });
  const socketServer = new Server(upstream);
  const namespace = socketServer.of('/callcenter-events');
  namespace.use((socket, next) => next(socket.handshake.auth.token === 'fixture-token' ? undefined : Error('Unauthorized')));
  namespace.on('connection', socket => socket.emit('cc:event', { type: 'heartbeat', data: '1' }));
  const backendPort = await listen(upstream);
  fs.writeFileSync(path.join(root, 'index.html'), '<main>stand fixture</main>');
  const web = createStandWebServer({ root, backendHost: '127.0.0.1', backendPort });
  const port = await listen(web.server);
  t.after(async () => { await web.close(); await new Promise(resolve => socketServer.close(resolve)); upstream.closeAllConnections(); assert.equal(path.dirname(path.resolve(root)), path.resolve(os.tmpdir())); assert.ok(path.basename(root).startsWith('cc-stand-web-')); fs.rmSync(root, { recursive: true, force: true }); });
  assert.equal(await (await fetch(`http://127.0.0.1:${port}/callcenter/supervisor`)).text(), '<main>stand fixture</main>');
  assert.equal((await fetch(`http://127.0.0.1:${port}/assets/missing.js`)).status, 404);
  assert.deepEqual(await (await fetch(`http://127.0.0.1:${port}/api/health`, { headers: { Authorization: 'Bearer fixture-token' } })).json(), { authorization: 'Bearer fixture-token' });
  const abort = new AbortController();
  const events = await fetch(`http://127.0.0.1:${port}/api/events`, { signal: abort.signal });
  assert.match(new TextDecoder().decode((await events.body.getReader().read()).value), /data: 1/); abort.abort();
  const client = io(`http://127.0.0.1:${port}/callcenter-events`, { transports: ['websocket'], auth: { token: 'fixture-token' }, autoConnect: false, reconnection: false });
  t.after(() => client.disconnect());
  const message = await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(Error('WebSocket proxy timeout')), 3000); client.once('cc:event', data => { clearTimeout(timer); resolve(data); }); client.once('connect_error', reject); client.connect(); });
  assert.deepEqual(message, { type: 'heartbeat', data: '1' });
  assert.equal(web.metrics.upgrades, 1);
});
