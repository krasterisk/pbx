'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const releaseName = process.env.MPBX_TEST_RELEASE || 'mpbx-r4-frontend';
if (!/^mpbx-r[0-9]+-frontend$/.test(releaseName)) throw new Error('Invalid local fixture release name');
const prefix = releaseName.replace('-frontend', '');
const root = path.resolve(__dirname, '../../artifacts', releaseName);
const requests = [];
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/index.php' || url.pathname === '/preview.php') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(fs.readFileSync(path.resolve(__dirname, '../../artifacts/' + prefix + (url.pathname === '/preview.php' ? '-integration-preview.html' : '-integration-fixture.html')))); return;
  }
  if (url.pathname.startsWith('/modules/voice-robots/api.php/')) {
    requests.push({ method: req.method, path: url.pathname });
    fs.writeFileSync(path.resolve(__dirname, '../../artifacts/' + prefix + '-local-api-requests.json'), JSON.stringify(requests, null, 2));
    res.setHeader('Content-Type', 'application/json');
    if (!url.pathname.startsWith('/modules/voice-robots/api.php/public/')) { res.statusCode = 404; res.end('{"message":"Incorrect gateway mode"}'); return; }
    if (req.method !== 'GET') { res.statusCode = 405; res.end('{"message":"Read-only local UI fixture"}'); return; }
    res.end(url.pathname.includes('/credentials') ? '{"credentials":[]}' : url.pathname.endsWith('/cdr') ? '{"rows":[],"count":0}' : url.pathname.endsWith('/cdr/stats') ? '{}' : '[]'); return;
  }
  const relative = url.pathname.replace(/^\/modules\/voice-robots\//, '');
  const file = path.resolve(root, relative);
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.statusCode = 404; res.end('Not found'); return; }
  res.setHeader('Content-Type', file.endsWith('.js') ? 'application/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.json') ? 'application/json' : 'text/html; charset=utf-8');
  res.end(fs.readFileSync(file));
});
module.exports = server;
if (require.main === module) server.listen(0, '127.0.0.1', () => {
  const url = `http://127.0.0.1:${server.address().port}/index.php?module=voice-robots#/voice-robots`;
  fs.writeFileSync(path.resolve(__dirname, '../../artifacts/' + prefix + '-local-url.txt'), url);
  console.log('Local read-only integration fixture: ' + url);
});
