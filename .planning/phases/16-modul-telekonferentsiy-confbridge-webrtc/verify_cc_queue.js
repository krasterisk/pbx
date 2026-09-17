#!/usr/bin/env node
/**
 * Live add/remove verification against the process on :5010.
 * Reads secrets on the server only; never prints them.
 */
const fs = require('fs');
const { execSync, spawnSync } = require('child_process');
const path = require('path');

const ENV_PATH = fs.existsSync('/var/www/pbx/.env.production')
  ? '/var/www/pbx/.env.production'
  : '/var/www/pbx/packages/backend/.env';
const API = 'http://127.0.0.1:5010/api';
const IFACE = 'PJSIP/e201_0';

function parseEnv(file) {
  const buf = fs.readFileSync(file);
  let text;
  if (buf[0] === 0xFF && buf[1] === 0xFE) text = buf.toString('utf16le');
  else if (buf[0] === 0xFE && buf[1] === 0xFF) text = buf.swap16().toString('utf16le');
  else text = buf.toString('utf8').replace(/^\uFEFF/, '');
  const out = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\0/g, '').trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    let v = line.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[line.slice(0, eq).trim()] = v;
  }
  return out;
}

function queueHas(queue, iface) {
  const text = execSync(`asterisk -rx "queue show ${queue}"`, { encoding: 'utf8' });
  return text.includes(iface);
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function http(method, url, token, body) {
  const args = [
    '-sS', '-X', method, url,
    '-H', `Authorization: Bearer ${token}`,
    '-H', 'Content-Type: application/json',
    '-w', '\n%{http_code}',
  ];
  if (body !== undefined) args.push('-d', JSON.stringify(body));
  const r = spawnSync('curl', args, { encoding: 'utf8' });
  if (r.status !== 0) {
    throw new Error(`curl ${url} failed: ${r.stderr || r.stdout}`);
  }
  const text = (r.stdout || '').replace(/\r/g, '');
  const nl = text.lastIndexOf('\n');
  const payload = nl >= 0 ? text.slice(0, nl) : text;
  const code = Number(nl >= 0 ? text.slice(nl + 1) : '0');
  let json = null;
  try { json = payload ? JSON.parse(payload) : null; } catch { json = { raw: payload }; }
  return { code, json, payload };
}

function isOkHttp(code) {
  return code === 200 || code === 201;
}

function requireOk(label, res, pred) {
  const ok = pred(res);
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label} HTTP ${res.code} ${JSON.stringify(res.json)}`);
  if (!ok) throw new Error(`failed: ${label}`);
}

async function main() {
  const env = parseEnv(ENV_PATH);
  const roots = ['/var/www/pbx/packages/backend', '/var/www/pbx'];
  const jwtMod = require(require.resolve('jsonwebtoken', { paths: roots }));
  const dialect = String(env.DB_DIALECT || 'mysql').toLowerCase();
  const db = {
    host: env.DB_HOST || '127.0.0.1',
    port: Number(env.DB_PORT || (dialect === 'postgres' ? 5432 : 3306)),
    user: env.DB_USERNAME || env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_DATABASE || env.DB_NAME,
  };
  let u;
  if (dialect === 'postgres' || dialect === 'postgresql') {
    const { Client } = require(require.resolve('pg', { paths: roots }));
    const client = new Client(db);
    await client.connect();
    const userRes = await client.query(
      `SELECT uniqueid, login, name, level, role, vpbx_user_uid
       FROM users
       WHERE level IN (0, 1, 3)
       ORDER BY level ASC, uniqueid ASC
       LIMIT 1`,
    );
    await client.end();
    u = userRes.rows[0];
  } else {
    const mysql = require(require.resolve('mysql2/promise', { paths: roots }));
    const conn = await mysql.createConnection(db);
    const [rows] = await conn.query(
      `SELECT uniqueid, login, name, level, role, vpbx_user_uid
       FROM users
       WHERE level IN (0, 1, 3)
       ORDER BY level ASC, uniqueid ASC
       LIMIT 1`,
    );
    await conn.end();
    u = rows[0];
  }
  if (!u) throw new Error('no supervisor user');
  const token = jwtMod.sign({
    sub: Number(u.uniqueid),
    login: u.login,
    name: u.name || u.login,
    level: Number(u.level),
    role: Number(u.role || 0),
    vpbx_user_uid: Number(u.vpbx_user_uid ?? u.uniqueid),
  }, env.JWT_SECRET, { expiresIn: '15m' });

  console.log(`user=${u.login} level=${u.level} uid=${u.uniqueid} tenant=${u.vpbx_user_uid}`);
  console.log(`before q700=${queueHas('q700_0', IFACE)} q701=${queueHas('q701_0', IFACE)}`);

  const rec = http('POST', `${API}/callcenter/supervisor/reconcile-queues`, token, { agentInterface: IFACE });
  requireOk('reconcile', rec, (r) => isOkHttp(r.code) && Array.isArray(r.json?.queues));
  console.log(`reconcile queues=${JSON.stringify(rec.json.queues)}`);

  const addExist = http('POST', `${API}/callcenter/supervisor/queue-add`, token, {
    agentInterface: IFACE,
    queue: 'q701_0',
    penalty: 0,
  });
  requireOk('add-already-there', addExist, (r) =>
    isOkHttp(r.code) && r.json?.success === true && Array.isArray(r.json.queues) && r.json.queues.includes('q701_0'));

  const rmShift = http('POST', `${API}/callcenter/supervisor/queue-remove`, token, {
    agentInterface: IFACE,
    queue: 'q700_0',
  });
  requireOk('remove-q700', rmShift, (r) => isOkHttp(r.code) && r.json?.success === true);
  sleep(800);
  if (queueHas('q700_0', IFACE)) throw new Error('q700_0 still has member after remove');
  console.log('PASS asterisk q700_0 empty after remove');

  const addShift = http('POST', `${API}/callcenter/supervisor/queue-add`, token, {
    agentInterface: IFACE,
    queue: 'q700_0',
    penalty: 0,
  });
  requireOk('readd-q700', addShift, (r) =>
    isOkHttp(r.code) && r.json?.success === true && Array.isArray(r.json.queues) && r.json.queues.includes('q700_0'));
  sleep(800);
  if (!queueHas('q700_0', IFACE)) throw new Error('q700_0 missing member after add');
  console.log('PASS asterisk q700_0 has member after add');

  const rmRt = http('POST', `${API}/callcenter/supervisor/queue-remove`, token, {
    agentInterface: IFACE,
    queue: 'q701_0',
  });
  requireOk('remove-q701', rmRt, (r) => isOkHttp(r.code) && r.json?.success === true);
  sleep(1200);
  if (queueHas('q701_0', IFACE)) throw new Error('q701_0 still has member after realtime+AMI remove');
  console.log('PASS asterisk q701_0 empty after remove');

  const addRt = http('POST', `${API}/callcenter/supervisor/queue-add`, token, {
    agentInterface: IFACE,
    queue: 'q701_0',
    penalty: 0,
  });
  requireOk('readd-q701', addRt, (r) =>
    isOkHttp(r.code) && r.json?.success === true && r.json.queues.includes('q701_0'));
  sleep(800);
  if (!queueHas('q701_0', IFACE)) throw new Error('q701_0 missing after re-add');
  console.log('PASS asterisk q701_0 has member after re-add');

  const rmRt2 = http('POST', `${API}/callcenter/supervisor/queue-remove`, token, {
    agentInterface: IFACE,
    queue: 'q701_0',
  });
  requireOk('remove-q701-dynamic', rmRt2, (r) => isOkHttp(r.code) && r.json?.success === true);
  sleep(800);
  if (queueHas('q701_0', IFACE)) throw new Error('q701_0 still present after dynamic remove');
  console.log('PASS asterisk q701_0 empty after dynamic remove');

  const addRt2 = http('POST', `${API}/callcenter/supervisor/queue-add`, token, {
    agentInterface: IFACE,
    queue: 'q701_0',
    penalty: 0,
  });
  requireOk('restore-q701', addRt2, (r) =>
    isOkHttp(r.code) && r.json?.success === true && r.json.queues.includes('q701_0'));
  sleep(800);
  if (!queueHas('q701_0', IFACE)) throw new Error('q701_0 missing after restore add');
  console.log('PASS asterisk q701_0 restored as dynamic');

  const rec2 = http('POST', `${API}/callcenter/supervisor/reconcile-queues`, token, { agentInterface: IFACE });
  requireOk('reconcile-final', rec2, (r) => isOkHttp(r.code) && Array.isArray(r.json?.queues));
  console.log(`final queues=${JSON.stringify(rec2.json.queues)}`);
  console.log(`final asterisk q700=${queueHas('q700_0', IFACE)} q701=${queueHas('q701_0', IFACE)}`);
  console.log('ALL LIVE CHECKS PASSED');
}

main().catch((err) => {
  console.error('VERIFY FAILED', err && err.message ? err.message : err);
  process.exit(1);
});
