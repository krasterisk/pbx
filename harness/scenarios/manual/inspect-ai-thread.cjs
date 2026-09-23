const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const mysql = require('mysql2/promise');

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

function request(method, pathname, token) {
  const url = new URL(`http://127.0.0.1:5010${pathname}`);
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method,
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
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
  const admin = users[0];
  const token = mint(admin);
  const thread = await request('GET', `/api/ai-chat/threads/${process.argv[2] || 151}`, token);
  const pending = await request('GET', '/api/ai-chat/proposals/pending', token);
  const pendingRows = Array.isArray(pending.json) ? pending.json : [];
  const compactPending = pendingRows.map((row) => ({
    proposalId: row.proposalId,
    entityLabel: row.entityLabel,
    status: row.status,
    summary: row.summary,
    after: row.after,
  }));
  const timeline = (thread.json?.timeline || []).map((item) => ({
    role: item.role,
    kind: item.kind,
    name: item.name,
    proposalId: item.proposalId,
    text: String(item.content || item.text || item.summary || '').slice(0, 240),
  }));
  console.log(JSON.stringify({ threadStatus: thread.status, timeline, cards: thread.json?.cards, pending: compactPending }, null, 2));
  await db.end();
})().catch((err) => {
  console.error(err.stack || err);
  process.exit(1);
});
