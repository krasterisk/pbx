const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const mysql = require('mysql2/promise');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../../..');
for (const line of fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/)) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
}

function mint(user) {
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
      exp: now + 3600,
      iss: 'krasterisk-v4',
      aud: 'krasterisk-v4-client',
    }),
  ).toString('base64url');
  const sig = crypto
    .createHmac('sha256', process.env.JWT_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');
  return `${header}.${body}.${sig}`;
}

function request(method, pathname, token, body) {
  const payload = body == null ? null : Buffer.from(JSON.stringify(body));
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: 5010,
        path: pathname,
        method,
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
          ...(payload
            ? { 'Content-Type': 'application/json', 'Content-Length': payload.length }
            : {}),
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          let json = null;
          try {
            json = raw ? JSON.parse(raw) : null;
          } catch {
            json = null;
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

function streamMessage(token, body, timeoutMs = 90000) {
  const payload = Buffer.from(JSON.stringify(body));
  return new Promise((resolve, reject) => {
    const events = [];
    let buffer = '';
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: 5010,
        path: '/api/ai-chat/message',
        method: 'POST',
        headers: {
          Accept: 'text/event-stream',
          'Content-Type': 'application/json',
          'Content-Length': payload.length,
          Authorization: `Bearer ${token}`,
        },
      },
      (res) => {
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          buffer += chunk;
          const parts = buffer.split('\n\n');
          buffer = parts.pop() || '';
          for (const part of parts) {
            const name = (/^event: (.+)$/m.exec(part) || [])[1];
            const dataLine = (/^data: ([\s\S]+)$/m.exec(part) || [])[1];
            let data = dataLine;
            try {
              data = JSON.parse(dataLine);
            } catch {
              /* keep */
            }
            events.push({ name, data });
          }
        });
        res.on('end', () => resolve({ status: res.statusCode, events }));
      },
    );
    req.setTimeout(timeoutMs, () => req.destroy(new Error('chat timeout')));
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function summarizeEvents(events) {
  return events.map((event) => {
    const data = event.data;
    if (!data || typeof data !== 'object') return { name: event.name, data };
    const copy = { ...data };
    if (typeof copy.content === 'string') copy.content = copy.content.slice(0, 160);
    if (typeof copy.delta === 'string') copy.delta = copy.delta.slice(0, 80);
    return { name: event.name, data: copy };
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
    "SELECT uniqueid, login, name, level, role, vpbx_user_uid FROM users WHERE login='admin' AND vpbx_user_uid=0 LIMIT 1",
  );
  const token = mint(users[0]);
  const defaultProvider = await request('GET', '/api/ai-chat/default-provider', token);
  const thread = await request('POST', '/api/ai-chat/threads', token, {});
  const chat = await streamMessage(token, {
    threadUid: thread.json.uid,
    locale: 'ru',
    message: 'Ответь одним словом: ок. Ничего не меняй в АТС.',
  });
  const [[row]] = await db.query('SELECT uid, provider_uid, title FROM ai_agent_threads WHERE uid=?', [
    thread.json.uid,
  ]);
  await db.end();
  const errors = chat.events.filter((e) => e.name === 'error').map((e) => e.data);
  console.log(
    JSON.stringify(
      {
        defaultProvider: defaultProvider.json,
        threadUid: thread.json.uid,
        threadProviderUid: row?.provider_uid ?? null,
        chatStatus: chat.status,
        eventNames: chat.events.map((e) => e.name).filter(Boolean),
        errors,
        events: summarizeEvents(chat.events).slice(0, 12),
      },
      null,
      2,
    ),
  );
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
