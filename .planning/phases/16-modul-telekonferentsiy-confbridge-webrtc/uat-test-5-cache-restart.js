/**
 * Phase 16 UAT Test 5 — join after backend restart without GET /conferences.
 *
 * Create the room on CREATE_PORT (warm). Observe on OBSERVE_PORT (cold cache,
 * never listed). Originate first, then open SSE on the observer.
 *
 *   BACKEND_CREATE_PORT=5010 BACKEND_OBSERVE_PORT=5099 node .../uat-test-5-cache-restart.js
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const mysql = require('mysql2/promise');
const AsteriskManager = require('asterisk-manager');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const CREATE_PORT = Number(process.env.BACKEND_CREATE_PORT || 5010);
const OBSERVE_PORT = Number(process.env.BACKEND_OBSERVE_PORT || 5099);
const ROOM_NUMBER = process.env.UAT5_ROOM_NUMBER || '16895';
const RESULTS_DIR = path.join(__dirname, 'results');

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
const env = loadEnv();

function connectAmi() {
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

function requestJson(port, method, urlPath, { token, body } = {}) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
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

function openSse(port, urlPath, token, onEvent) {
  const req = http.request(
    {
      host: '127.0.0.1',
      port,
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
          if (event.type === 'heartbeat' || !event.data) continue;
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

(async () => {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  console.log(
    `\n=== UAT 16 Test 5 create:${CREATE_PORT} observe:${OBSERVE_PORT} @ ${env.AMI_HOST} ===\n`,
  );

  const existingUid = Number(process.env.UAT5_ROOM_UID || 0);
  if (!existingUid) {
    const createHealth = await requestJson(CREATE_PORT, 'GET', '/api/health');
    if (createHealth.status !== 200) throw new Error(`create backend ${CREATE_PORT} down`);
    if (CREATE_PORT === OBSERVE_PORT) {
      throw new Error('CREATE_PORT and OBSERVE_PORT must differ unless UAT5_ROOM_UID is set');
    }
  }
  const observeHealth = await requestJson(OBSERVE_PORT, 'GET', '/api/health');
  if (observeHealth.status !== 200) throw new Error(`observe backend ${OBSERVE_PORT} down`);
  console.log('  ✓ observer healthy');

  const jwt = loadJwt();
  const conn = await mysql.createConnection({
    host: env.DB_HOST,
    port: Number(env.DB_PORT || 3306),
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
  });
  const [users] = await conn.query(
    `SELECT uniqueid, login, name, level, role, vpbx_user_uid
     FROM users WHERE vpbx_user_uid > 0 ORDER BY uniqueid ASC LIMIT 1`,
  );
  if (!users.length) throw new Error('no tenant user');
  const user = users[0];
  const tenant = Number(user.vpbx_user_uid);
  const token = jwt.sign(
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
  if (!existingUid) {
    await conn.query(`DELETE FROM conference_rooms WHERE vpbx_user_uid = ? AND number = ?`, [
      tenant,
      ROOM_NUMBER,
    ]);
  }
  await conn.end();

  let room;
  if (existingUid) {
    room = { uid: existingUid, number: ROOM_NUMBER };
    console.log(`  ✓ using existing room ${existingUid} (no create, observer cache stays cold)`);
  } else {
    const created = await requestJson(CREATE_PORT, 'POST', '/api/conferences', {
      token,
      body: { number: ROOM_NUMBER, name: 'UAT 16 Test 5' },
    });
    if (created.status >= 400 || !created.json?.uid) {
      throw new Error(`create failed ${created.status} ${created.text}`);
    }
    room = created.json;
    console.log(`  ✓ room ${room.uid} created on :${CREATE_PORT}`);
  }
  const conference = `conf${ROOM_NUMBER}_${tenant}`;
  const roomCtx = `krsk-conf-${room.uid}`;

  const ami = await connectAmi();
  await sleep(800);
  await amiAction(ami, {
    action: 'Originate',
    channel: `Local/s@${roomCtx}`,
    application: 'Wait',
    data: '25',
    timeout: 15000,
    callerid: 'uat5 <16005>',
    async: 'true',
  });
  await waitFor('asterisk conference', async () => {
    const list = await cmd(ami, 'confbridge list');
    return list.includes(conference) ? list : null;
  });
  console.log(`  ✓ join in Asterisk ${conference} (observer still has no GET /conferences for this room)`);

  const events = [];
  const closeSse = openSse(
    OBSERVE_PORT,
    `/api/conferences/${room.uid}/events`,
    token,
    (evt) => events.push(evt),
  );

  const first = await waitFor('observer SSE snapshot with participant', () => {
    const hit = events.find(
      (e) => e.data && Array.isArray(e.data.participants) && e.data.participants.length >= 1,
    );
    return hit || null;
  });
  if (first.type !== 'fullSnapshot' && first.type !== 'participantJoin') {
    throw new Error(`unexpected first populated event ${first.type}`);
  }
  console.log(
    `  ✓ observer SSE ${first.type} participants=${first.data.participants.length} without prior GET /conferences on :${OBSERVE_PORT}`,
  );

  const live = (await cmd(ami, 'core show channels concise'))
    .split(/\r?\n/)
    .map((l) => l.split('!')[0])
    .filter((ch) => ch && /Local\//.test(ch));
  for (const ch of live) await cmd(ami, `channel request hangup ${ch}`).catch(() => {});
  await cmd(ami, `confbridge kick ${conference} all`).catch(() => {});
  closeSse();
  const del = await requestJson(OBSERVE_PORT, 'DELETE', `/api/conferences/${room.uid}`, { token });
  if (del.status >= 400) throw new Error(`cleanup failed ${del.status} ${del.text}`);
  ami.disconnect();

  const out = path.join(RESULTS_DIR, `uat-test-5-${Date.now()}.json`);
  fs.writeFileSync(
    out,
    JSON.stringify(
      {
        ok: true,
        roomUid: room.uid,
        conference,
        createPort: CREATE_PORT,
        observePort: OBSERVE_PORT,
        firstPopulatedType: first.type,
        participants: first.data.participants.length,
        eventTypes: events.map((e) => e.type),
      },
      null,
      2,
    ),
  );
  console.log(`\nPASS Test 5  ${out}\n`);
  process.exit(0);
})().catch((e) => {
  console.error(`\n✗ ${e.message}\n`);
  process.exit(1);
});
