const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const mysql = require('mysql2/promise');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../../..');
const API = process.env.HARNESS_API_URL || 'http://127.0.0.1:5010';
const CAMPAIGN_NAME = 'MCP-Live-20260921';
const EVIDENCE = path.join(ROOT, '.planning/evidence/autodial-mcp-live-2026-09-21.json');

for (const line of fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/)) {
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

function request(method, pathname, { token, body, timeoutMs = 15000 } = {}) {
  const url = new URL(`${API}${pathname}`);
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
            json = raw ? JSON.parse(raw) : null;
          } catch {
            json = null;
          }
          resolve({ status: res.statusCode, json, raw });
        });
      },
    );
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`timeout ${pathname}`));
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function streamMessage(token, body, timeoutMs = 120000) {
  const url = new URL(`${API}/api/ai-chat/message`);
  const payload = Buffer.from(JSON.stringify(body));
  return new Promise((resolve, reject) => {
    const events = [];
    let buffer = '';
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
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
              /* keep text */
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
  const admin = users[0];
  const token = mint(admin);

  const provider = await request('PUT', '/api/ai-chat/default-provider', {
    token,
    body: { providerUid: 16 },
  });
  const thread = await request('POST', '/api/ai-chat/threads', { token, body: {} });
  const chat = await streamMessage(token, {
    threadUid: thread.json.uid,
    locale: 'ru',
    message:
      `Кампания автообзвона «${CAMPAIGN_NAME}» — изолированный loopback-тест, не боевой обзвон. ` +
      'Через update_autodial_campaign поставь dial_timeout_sec=18 и success_min_sec=10. Кампанию не запускай.',
  });

  const eventNames = chat.events.map((e) => e.name).filter(Boolean);
  const errors = chat.events.filter((e) => e.name === 'error').map((e) => e.data);
  const proposals = chat.events
    .map((e) => e.data)
    .filter((d) => d && typeof d === 'object' && (d.proposalId || d.entityType === 'autodial_campaign'));

  let applied = null;
  const pending = await request('GET', '/api/ai-chat/proposals/pending', { token });
  const pendingRows = Array.isArray(pending.json) ? pending.json : [];
  const target = pendingRows.find(
    (row) =>
      row.entityLabel === CAMPAIGN_NAME ||
      JSON.stringify(row.summary || []).includes('dial_timeout') ||
      JSON.stringify(row.after || {}).includes('"dial_timeout_sec":18'),
  ) || pendingRows[0];
  if (target?.proposalId) {
    applied = await request('POST', `/api/ai-chat/proposals/${target.proposalId}/apply`, {
      token,
      body: {},
    });
  }

  const snapshot = await request('POST', '/api/mcp', {
    token,
    body: {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: 'get_autodial_campaign', arguments: { name: CAMPAIGN_NAME } },
    },
  });
  let campaign = null;
  try {
    campaign = JSON.parse(snapshot.json?.result?.content?.[0]?.text || '{}').campaign;
  } catch {
    campaign = snapshot.json;
  }

  const out = {
    provider: { status: provider.status, json: provider.json },
    threadUid: thread.json?.uid,
    chatStatus: chat.status,
    eventNames,
    errors,
    proposalHints: proposals.slice(0, 3),
    pendingCount: pendingRows.length,
    applied: applied && { status: applied.status, ok: applied.json?.ok, error: applied.json?.error || applied.json?.reason },
    campaign: campaign && {
      uid: campaign.uid,
      dial_timeout_sec: campaign.dial_timeout_sec,
      success_min_sec: campaign.success_min_sec,
      revision: campaign.revision,
      amd: campaign.amd,
    },
  };
  let evidence = {};
  try {
    evidence = JSON.parse(fs.readFileSync(EVIDENCE, 'utf8'));
  } catch {
    evidence = {};
  }
  evidence.chatLive = out;
  evidence.at = new Date().toISOString();
  fs.writeFileSync(EVIDENCE, JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(out, null, 2));
})().catch((err) => {
  console.error(err.stack || err);
  process.exit(1);
});
