'use strict';
const http = require('node:http');
const dns = require('node:dns').promises;
const net = require('node:net');
const os = require('node:os');

function assertMcpDestination(url) {
  const parsed = new URL(url);
  const host = parsed.hostname.toLowerCase();
  if (['localhost', '::1'].includes(host)) throw new Error('ssrf_denied');
  if (net.isIP(host) && isPrivateIp(host)) throw new Error('ssrf_denied');
  if (host.endsWith('.local')) throw new Error('ssrf_denied');
  return parsed;
}

function isPrivateIp(host) {
  if (host.startsWith('10.') || host.startsWith('192.168.') || host.startsWith('127.') || host.startsWith('169.254.')) {
    return true;
  }
  const parts = host.split('.').map(Number);
  return parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31;
}

async function resolveDenied(url) {
  const parsed = assertMcpDestination(url);
  const records = await dns.lookup(parsed.hostname, { all: true }).catch(() => []);
  for (const record of records) {
    if (isPrivateIp(record.address)) throw new Error('ssrf_denied');
  }
  return parsed;
}

function handleMcpJsonRpc(request, principal) {
  if (request.method === 'sampling/createMessage' || request.method === 'roots/list') {
    return { jsonrpc: '2.0', id: request.id, error: { code: -32601, message: 'method_not_allowed' } };
  }
  if (principal === 'phone' && request.method === 'admin.mutate_pbx') {
    throw new Error('phone_principal_denied');
  }
  if (request.method === 'tools/call' && request.params?.name === 'kb.search') {
    const query = String(request.params.arguments?.query || '');
    return { jsonrpc: '2.0', id: request.id, result: { hits: retrieve(query) } };
  }
  return { jsonrpc: '2.0', id: request.id, error: { code: -32601, message: 'unknown' } };
}

const TOPICS = [
  'overtime-policy', 'vacation-balance', 'sick-leave', 'remote-work', 'password-reset',
  'vpn-access', 'invoice-status', 'delivery-window', 'return-period', 'warranty-claim',
  'opening-hours', 'parking-permit', 'meeting-room', 'visitor-badge', 'fire-drill',
  'salary-date', 'tax-form', 'benefits-dental', 'hardware-laptop', 'software-license',
  'shift-swap', 'on-call-rota', 'escalation-path', 'sla-priority', 'refund-policy',
  'shipping-cost', 'language-pack', 'data-retention', 'access-review', 'incident-severity',
];
const chunks = TOPICS.map((topic, index) => ({
  id: `doc-${index + 1}`,
  text: `Handbook section ${topic} keyword ${topic}-token explains the official rule for ${topic.replace(/-/g, ' ')}.`,
}));

function retrieve(query) {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  return chunks
    .map(chunk => ({
      id: chunk.id,
      score: terms.filter(term => chunk.text.toLowerCase().includes(term)).length,
    }))
    .filter(row => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

function recallAtK(relevant, ranked, k) {
  const top = new Set(ranked.slice(0, k).map(row => row.id));
  return relevant.filter(id => top.has(id)).length / Math.max(relevant.length, 1);
}

const items = [
  ...TOPICS.map((topic, index) => ({ query: `${topic}-token`, relevant: [`doc-${index + 1}`], answerable: true })),
  ...Array.from({ length: 15 }, (_, index) => ({ query: `unanswerable-term-${index + 1}-zxq`, relevant: [], answerable: false })),
];

const server = http.createServer((req, res) => {
  if (req.method !== 'POST' || req.url !== '/mcp') {
    res.writeHead(404); res.end(); return;
  }
  const chunksBuf = [];
  req.on('data', part => chunksBuf.push(part));
  req.on('end', () => {
    const body = JSON.parse(Buffer.concat(chunksBuf).toString('utf8'));
    const principal = String(req.headers['x-principal'] || 'service');
    try {
      const payload = handleMcpJsonRpc(body, principal);
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(payload));
    } catch (error) {
      res.writeHead(403, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: String(error.message || error) }));
    }
  });
});

server.listen(0, '127.0.0.1', async () => {
  const { port } = server.address();
  const url = `http://127.0.0.1:${port}/mcp`;
  let ssrfDenied = false;
  try { await resolveDenied('http://127.0.0.1/mcp'); } catch { ssrfDenied = true; }
  const rpc = (method, params, principal) => new Promise((resolve, reject) => {
    const req = http.request(url, { method: 'POST', headers: { 'content-type': 'application/json', 'x-principal': principal || 'service' } }, (res) => {
      const buf = [];
      res.on('data', part => buf.push(part));
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(Buffer.concat(buf).toString('utf8')) }));
    });
    req.on('error', reject);
    req.end(JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }));
  });
  const phone = await rpc('admin.mutate_pbx', {}, 'phone');
  const sampling = await rpc('sampling/createMessage', {});
  const recalls = [];
  for (const item of items.filter(row => row.answerable)) {
    const result = await rpc('tools/call', { name: 'kb.search', arguments: { query: item.query } });
    recalls.push(recallAtK(item.relevant, result.body.result.hits, 5));
  }
  const mean = recalls.reduce((sum, value) => sum + value, 0) / recalls.length;
  const unanswerable = [];
  for (const item of items.filter(row => !row.answerable)) {
    const result = await rpc('tools/call', { name: 'kb.search', arguments: { query: item.query } });
    unanswerable.push((result.body.result.hits || []).length);
  }
  const digest = {
    host: os.hostname(),
    port,
    ssrfDenied,
    phoneDenied: phone.status === 403,
    samplingDenied: Boolean(sampling.body.error),
    recallAt5: Number(mean.toFixed(4)),
    answerable: 30,
    unanswerableEmpty: unanswerable.every(count => count === 0),
    profile: 'lexical_fallback',
  };
  process.stdout.write(JSON.stringify(digest) + '\n');
  server.close();
  if (!digest.ssrfDenied || !digest.phoneDenied || digest.recallAt5 < 0.85 || !digest.unanswerableEmpty) {
    process.exit(2);
  }
});
