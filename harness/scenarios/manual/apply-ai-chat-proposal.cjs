const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const mysql = require('mysql2/promise');
const path = require('node:path');

const EVIDENCE = path.resolve('.planning/evidence/autodial-mcp-live-2026-09-21.json');

for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
}

function mint(user) {
  const secret = process.env.JWT_SECRET;
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const body = Buffer.from(
    JSON.stringify({
      sub: user.uniqueid,
      login: user.login,
      name: user.name,
      level: user.level,
      role: user.role ?? 0,
      vpbx_user_uid: user.vpbx_user_uid,
      iat: now,
      exp: now + 7200,
      iss: 'krasterisk-v4',
      aud: 'krasterisk-v4-client',
    }),
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

function request(method, pathname, { token, body } = {}) {
  const url = new URL(`http://127.0.0.1:5010${pathname}`);
  const payload = body == null ? null : Buffer.from(JSON.stringify(body));
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method,
        headers: {
          Accept: 'application/json',
          ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': payload.length } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          let json = null;
          try {
            json = JSON.parse(raw);
          } catch {
            json = raw;
          }
          resolve({ status: res.statusCode, json });
        });
      },
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

(async () => {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
  const [users] = await db.query(
    'SELECT uniqueid, login, name, level, role, vpbx_user_uid FROM users WHERE login = ? LIMIT 1',
    ['admin'],
  );
  await db.end();
  const token = mint(users[0]);
  const rejectStale = await request('POST', '/api/ai-chat/proposals/49258bb0-0694-463e-90c9-4e08d53f7b2b/reject', {
    token,
    body: {},
  });
  const applyChat = await request('POST', '/api/ai-chat/proposals/d8ef36da-4bef-44f7-b7a8-4b7d8b245cb6/apply', {
    token,
    body: {},
  });
  const snap = await request('POST', '/api/mcp', {
    token,
    body: {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: 'get_autodial_campaign', arguments: { uid: 1 } },
    },
  });
  const campaign = JSON.parse(snap.json?.result?.content?.[0]?.text || '{}').campaign;
  const evidence = JSON.parse(fs.readFileSync(EVIDENCE, 'utf8'));
  evidence.chatApplied = {
    rejectStale: { status: rejectStale.status, json: rejectStale.json },
    apply: { status: applyChat.status, ok: applyChat.json?.ok, error: applyChat.json?.error || applyChat.json?.reason },
    campaign: {
      uid: campaign?.uid,
      dial_timeout_sec: campaign?.dial_timeout_sec,
      success_min_sec: campaign?.success_min_sec,
      revision: campaign?.revision,
    },
  };
  evidence.at = new Date().toISOString();
  fs.writeFileSync(EVIDENCE, JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence.chatApplied, null, 2));
})().catch((err) => {
  console.error(err.stack || err);
  process.exit(1);
});
