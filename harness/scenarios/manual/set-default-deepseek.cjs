const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const mysql = require('mysql2/promise');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../../..');
const env = {};
for (const line of fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/)) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match) env[match[1]] = match[2];
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
  const sig = crypto.createHmac('sha256', env.JWT_SECRET).update(`${header}.${body}`).digest('base64url');
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

(async () => {
  const db = await mysql.createConnection({
    host: env.DB_HOST,
    port: Number(env.DB_PORT || 3306),
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
  });
  const [users] = await db.query(
    "SELECT uniqueid, login, name, level, role, vpbx_user_uid FROM users WHERE login='admin' AND vpbx_user_uid=0 LIMIT 1",
  );
  const [providers] = await db.query(
    'SELECT uid, name, vendor, endpoint, enabled, capabilities FROM cc_ai_providers WHERE vpbx_user_uid=0 ORDER BY uid',
  );
  await db.end();
  const token = mint(users[0]);
  const before = await request('GET', '/api/ai-chat/default-provider', token);
  const put = await request('PUT', '/api/ai-chat/default-provider', token, { providerUid: 59 });
  const after = await request('GET', '/api/ai-chat/default-provider', token);
  console.log(
    JSON.stringify(
      {
        providers: providers.map((p) => ({
          uid: p.uid,
          name: p.name,
          vendor: p.vendor,
          enabled: !!p.enabled,
          capabilities: p.capabilities,
        })),
        before: before.json,
        put: { status: put.status, json: put.json },
        after: after.json,
        hasLegacyEnv: Object.prototype.hasOwnProperty.call(env, 'CC_AI_LEGACY_KEY_SECRET'),
        hasKeySecret: Boolean(env.CC_AI_KEY_SECRET),
      },
      null,
      2,
    ),
  );
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
