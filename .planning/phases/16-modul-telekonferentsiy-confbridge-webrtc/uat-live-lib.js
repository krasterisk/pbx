const fs = require('fs');
const path = require('path');
const http = require('http');
const mysql = require('mysql2/promise');
const AsteriskManager = require('asterisk-manager');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const RESULTS_DIR = path.join(__dirname, 'results');
const PORT = Number(process.env.BACKEND_UAT_PORT || 5010);

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

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitFor(label, fn, timeoutMs = 25000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const hit = await fn();
    if (hit) return hit;
    await sleep(300);
  }
  throw new Error(`timeout waiting for ${label}`);
}

function connectAmi(env) {
  return new Promise((resolve, reject) => {
    const ami = new AsteriskManager(
      Number(env.AMI_PORT),
      env.AMI_HOST,
      env.AMI_LOGIN,
      env.AMI_SECRET,
      true,
    );
    const timer = setTimeout(() => reject(new Error('AMI connect timeout')), 10000);
    ami.on('connect', () => {
      clearTimeout(timer);
      resolve(ami);
    });
    ami.on('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
  });
}

function amiAction(ami, action) {
  return new Promise((resolve, reject) => {
    ami.action(action, (err, res) => {
      const payload = err && (err.response === 'Success' || err.response === 'Follows') ? err : res;
      if (err && !payload) return reject(new Error(err.message || JSON.stringify(err)));
      resolve(payload ?? res ?? err);
    });
  });
}

function normalize(res) {
  const out = res?.output ?? res?.content ?? res?.message ?? res;
  return Array.isArray(out) ? out.join('\n') : String(out ?? '');
}

const cmd = async (ami, command) => normalize(await amiAction(ami, { action: 'Command', command }));

function requestJson(method, urlPath, { token, body, port } = {}) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        host: '127.0.0.1',
        port: port || PORT,
        path: urlPath,
        method,
        headers: {
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(payload
            ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
            : {}),
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let json = null;
          try {
            json = text ? JSON.parse(text) : null;
          } catch {
            json = { raw: text };
          }
          resolve({ status: res.statusCode, json, text });
        });
      },
    );
    req.on('error', reject);
    req.setTimeout(20000, () => req.destroy(new Error(`timeout ${method} ${urlPath}`)));
    if (payload) req.write(payload);
    req.end();
  });
}

function loadJwt() {
  for (const candidate of [
    path.join(REPO_ROOT, 'node_modules', 'jsonwebtoken'),
    path.join(REPO_ROOT, 'packages', 'backend', 'node_modules', 'jsonwebtoken'),
  ]) {
    try {
      return require(candidate);
    } catch {
      /* next */
    }
  }
  return require('jsonwebtoken');
}

function tokenFor(jwt, user, tenant, env) {
  return jwt.sign(
    {
      sub: user.uniqueid,
      login: user.login,
      name: user.name,
      level: user.level,
      role: user.role ?? 0,
      vpbx_user_uid: tenant,
    },
    env.JWT_SECRET,
    { expiresIn: '1h' },
  );
}

function dbConn(env) {
  return mysql.createConnection({
    host: env.DB_HOST,
    port: Number(env.DB_PORT || 3306),
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
  });
}

async function firstTenantUser(env) {
  const conn = await dbConn(env);
  const [users] = await conn.query(
    `SELECT uniqueid, login, name, level, role, vpbx_user_uid
     FROM users WHERE vpbx_user_uid > 0 ORDER BY uniqueid ASC LIMIT 1`,
  );
  await conn.end();
  if (!users.length) throw new Error('no tenant user');
  const user = users[0];
  return { user, tenant: Number(user.vpbx_user_uid) };
}

async function twoTenantUsers(env) {
  const conn = await dbConn(env);
  const [users] = await conn.query(
    `SELECT uniqueid, login, name, level, role, vpbx_user_uid
     FROM users ORDER BY uniqueid ASC`,
  );
  await conn.end();
  const tenants = users.filter((u) => Number(u.vpbx_user_uid) > 0);
  const others = users.filter((u) => Number(u.uniqueid) !== Number(tenants[0]?.uniqueid));
  const byTenant = new Map();
  for (const user of tenants) {
    const tenant = Number(user.vpbx_user_uid);
    const list = byTenant.get(tenant) || [];
    list.push(user);
    byTenant.set(tenant, list);
  }
  for (const [tenant, list] of byTenant) {
    const uniq = [];
    const seen = new Set();
    for (const item of list) {
      if (seen.has(item.uniqueid)) continue;
      seen.add(item.uniqueid);
      uniq.push(item);
    }
    if (uniq.length >= 2) return { tenant, creator: uniq[0], visitor: uniq[1] };
  }
  if (tenants.length && others.length) {
    return { tenant: Number(tenants[0].vpbx_user_uid), creator: tenants[0], visitor: others[0] };
  }
  throw new Error('need a tenant room owner and a second portal user for D-17');
}

async function ensureBackend() {
  const health = await requestJson('GET', '/api/health');
  if (health.status !== 200) throw new Error(`backend :${PORT} not healthy ${health.status}`);
}

async function createRoom(token, number, name) {
  const created = await requestJson('POST', '/api/conferences', {
    token,
    body: { number, name },
  });
  if (created.status >= 400 || !created.json?.uid) {
    throw new Error(`create failed ${created.status} ${created.text}`);
  }
  return created.json;
}

async function deleteRoom(token, uid) {
  const del = await requestJson('DELETE', `/api/conferences/${uid}`, { token });
  if (del.status >= 400) throw new Error(`cleanup failed ${del.status} ${del.text}`);
}

async function hangupLocals(ami, conference) {
  const live = (await cmd(ami, 'core show channels concise'))
    .split(/\r?\n/)
    .map((l) => l.split('!')[0])
    .filter((ch) => ch && /Local\//.test(ch));
  for (const ch of live) await cmd(ami, `channel request hangup ${ch}`).catch(() => {});
  if (conference) await cmd(ami, `confbridge kick ${conference} all`).catch(() => {});
}

function openSse(urlPath, token, onEvent, port) {
  const req = http.request(
    {
      host: '127.0.0.1',
      port: port || PORT,
      path: `${urlPath}?token=${encodeURIComponent(token)}`,
      method: 'GET',
      headers: { Accept: 'text/event-stream' },
    },
    (res) => {
      let buf = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        buf += chunk;
        let sep;
        while ((sep = buf.indexOf('\n\n')) !== -1) {
          const block = buf.slice(0, sep);
          buf = buf.slice(sep + 2);
          const event = { type: 'message', data: '' };
          for (const line of block.split(/\r?\n/)) {
            if (line.startsWith('event:')) event.type = line.slice(6).trim();
            else if (line.startsWith('data:')) event.data += line.slice(5).trim();
          }
          if (event.type === 'heartbeat' || !event.data) {
            onEvent({ type: event.type || 'heartbeat', data: event.data || null });
            continue;
          }
          let parsed = event.data;
          try {
            parsed = JSON.parse(event.data);
          } catch {
            /* keep */
          }
          onEvent({ type: event.type, data: parsed });
        }
      });
    },
  );
  req.on('error', (e) => onEvent({ type: 'error', data: e.message }));
  req.end();
  return () => req.destroy();
}

function writeResult(name, payload) {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  const out = path.join(RESULTS_DIR, `${name}-${Date.now()}.json`);
  fs.writeFileSync(out, JSON.stringify(payload, null, 2));
  return out;
}

module.exports = {
  REPO_ROOT,
  RESULTS_DIR,
  PORT,
  loadEnv,
  sleep,
  waitFor,
  connectAmi,
  amiAction,
  cmd,
  requestJson,
  loadJwt,
  tokenFor,
  dbConn,
  firstTenantUser,
  twoTenantUsers,
  ensureBackend,
  createRoom,
  deleteRoom,
  hangupLocals,
  openSse,
  writeResult,
};
