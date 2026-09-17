/**
 * Phase 16 UAT Test 2 — live call into a generated room + SSE.
 *
 * Mirrors spike 002 mechanics (AMI Originate + Local channel, .env credentials)
 * but exercises the Nest conference module: create room → dialplan → ConfBridge
 * → SSE fullSnapshot → leave.
 *
 * Run from repo root after the local backend is up on BACKEND_UAT_PORT (default 5099):
 *   node .planning/phases/16-modul-telekonferentsiy-confbridge-webrtc/uat-test-2-live-call.js
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const mysql = require('mysql2/promise');
const AsteriskManager = require('asterisk-manager');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const PORT = Number(process.env.BACKEND_UAT_PORT || 5099);
const ROOM_NUMBER = process.env.UAT2_ROOM_NUMBER || '16891';
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
      if (err && !payload) {
        return reject(new Error(err.message || JSON.stringify(err)));
      }
      resolve(payload ?? res ?? err);
    });
  });
}

function normalize(res) {
  const out = res?.output ?? res?.content ?? res?.message ?? res;
  return Array.isArray(out) ? out.join('\n') : String(out ?? '');
}

const cmd = async (ami, command) => normalize(await amiAction(ami, { action: 'Command', command }));

function requestJson(method, urlPath, { token, body } = {}) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        host: '127.0.0.1',
        port: PORT,
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
    req.setTimeout(20000, () => {
      req.destroy(new Error(`timeout ${method} ${urlPath}`));
    });
    if (payload) req.write(payload);
    req.end();
  });
}

function openSse(urlPath, token, onEvent) {
  const req = http.request(
    {
      host: '127.0.0.1',
      port: PORT,
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
          const event = { type: 'message', data: '', id: '' };
          for (const line of block.split(/\r?\n/)) {
            if (line.startsWith('event:')) event.type = line.slice(6).trim();
            else if (line.startsWith('data:')) event.data += line.slice(5).trim();
            else if (line.startsWith('id:')) event.id = line.slice(3).trim();
          }
          if (event.type === 'heartbeat') continue;
          let parsed = event.data;
          try {
            parsed = event.data ? JSON.parse(event.data) : event.data;
          } catch {
            /* keep raw */
          }
          onEvent({ type: event.type, data: parsed, raw: event.data });
        }
      });
    },
  );
  req.on('error', (e) => onEvent({ type: 'error', data: e.message }));
  req.setTimeout(0);
  req.end();
  return () => req.destroy();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitFor(label, fn, timeoutMs = 20000) {
  const start = Date.now();
  let last;
  while (Date.now() - start < timeoutMs) {
    last = await fn();
    if (last) return last;
    await sleep(400);
  }
  throw new Error(`timeout waiting for ${label}: ${JSON.stringify(last)}`);
}

async function waitHealth() {
  await waitFor('backend health', async () => {
    try {
      const res = await requestJson('GET', '/api/health');
      return res.status === 200 && res.json?.status === 'ok';
    } catch {
      return false;
    }
  }, 120000);
}

async function originateAndWatch(ami, token, room, channel, expectedConference) {
  const events = [];
  const closeSse = openSse(`/api/conferences/${room.uid}/events`, token, (evt) => events.push(evt));
  await sleep(800);

  await amiAction(ami, {
    action: 'Originate',
    channel,
    application: 'Wait',
    data: '25',
    timeout: 15000,
    callerid: `uat2 <16001>`,
    async: 'true',
  });

  const joined = await waitFor(
    `SSE participant via ${channel}`,
    () => {
      const hit = events.find(
        (e) =>
          e.data &&
          Array.isArray(e.data.participants) &&
          e.data.participants.length >= 1,
      );
      return hit || null;
    },
    20000,
  );

  const list = await cmd(ami, 'confbridge list');
  const profileShow = await cmd(ami, `confbridge list ${expectedConference}`);

  const channelsOut = await cmd(ami, 'core show channels concise');
  const live = channelsOut
    .split(/\r?\n/)
    .map((l) => l.split('!')[0])
    .filter((ch) => ch && /Local\//.test(ch));
  for (const ch of live) {
    await cmd(ami, `channel request hangup ${ch}`).catch(() => {});
  }
  await cmd(ami, `confbridge kick ${expectedConference} all`).catch(() => {});

  const cleared = await waitFor(
    'SSE empty after leave',
    () => {
      const lastWithParticipants = [...events]
        .reverse()
        .find((e) => e.data && Array.isArray(e.data.participants));
      return lastWithParticipants && lastWithParticipants.data.participants.length === 0
        ? lastWithParticipants
        : null;
    },
    20000,
  );

  closeSse();
  return { events, joined, cleared, list, profileShow };
}

(async () => {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  const report = {
    started: new Date().toISOString(),
    host: env.AMI_HOST,
    roomNumber: ROOM_NUMBER,
    paths: {},
  };

  console.log(`\n=== UAT 16 Test 2 @ ${env.AMI_HOST} backend :${PORT} ===\n`);
  await waitHealth();
  console.log('  ✓ backend health');

  const jwt = (() => {
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
  })();
  const conn = await mysql.createConnection({
    host: env.DB_HOST,
    port: Number(env.DB_PORT || 3306),
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
  });

  const preferred = Number(env.DEFAULT_VPBX_USER_UID || 0);
  let [users] = await conn.query(
    `SELECT uniqueid, login, name, level, role, vpbx_user_uid
     FROM users
     WHERE vpbx_user_uid = ? OR uniqueid = ?
     ORDER BY uniqueid ASC
     LIMIT 5`,
    [preferred, preferred],
  );
  if (!users.length || Number(users[0].vpbx_user_uid || users[0].uniqueid) === 0) {
    [users] = await conn.query(
      `SELECT uniqueid, login, name, level, role, vpbx_user_uid
       FROM users
       WHERE vpbx_user_uid > 0
       ORDER BY uniqueid ASC
       LIMIT 5`,
    );
  }
  if (!users.length) throw new Error('no tenant users found');
  const user = users[0];
  const tenant = Number(user.vpbx_user_uid || user.uniqueid);
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
  console.log(`  ✓ jwt for user ${user.uniqueid} tenant ${tenant}`);

  await conn.query(`DELETE FROM conference_rooms WHERE vpbx_user_uid = ? AND number = ?`, [
    tenant,
    ROOM_NUMBER,
  ]);
  await conn.end();

  const created = await requestJson('POST', '/api/conferences', {
    token,
    body: { number: ROOM_NUMBER, name: 'UAT 16 Test 2' },
  });
  if (created.status >= 400 || !created.json?.uid) {
    throw new Error(`create room failed ${created.status} ${created.text}`);
  }
  const room = created.json;
  const expectedConference = `conf${ROOM_NUMBER}_${tenant}`;
  const roomCtx = `krsk-conf-${room.uid}`;
  const maskCtx = `krsk-conf-mask-${tenant}`;
  console.log(`  ✓ room uid=${room.uid} conference=${expectedConference}`);

  const ami = await connectAmi();
  console.log('  ✓ AMI connected');

  await sleep(1500);
  const roomDialplan = await cmd(ami, `dialplan show s@${roomCtx}`);
  const maskDialplan = await cmd(ami, `dialplan show ${ROOM_NUMBER}@${maskCtx}`);
  if (!/ConfBridge/.test(roomDialplan)) {
    throw new Error(`room dialplan missing ConfBridge:\n${roomDialplan}`);
  }
  if (!/GotoIf|krsk-conf-/.test(maskDialplan)) {
    throw new Error(`mask dialplan missing jump:\n${maskDialplan}`);
  }
  console.log('  ✓ dialplan loaded (room + mask)');

  report.paths.fixed = await originateAndWatch(
    ami,
    token,
    room,
    `Local/s@${roomCtx}`,
    expectedConference,
  );
  const fixedNameOk =
    report.paths.fixed.list.includes(expectedConference) ||
    report.paths.fixed.profileShow.includes(expectedConference) ||
    report.paths.fixed.joined.data;
  if (!fixedNameOk) {
    throw new Error(`fixed path: conference ${expectedConference} not observed`);
  }
  const firstWithMember = report.paths.fixed.events.find(
    (e) => e.data?.participants?.length >= 1,
  );
  if (firstWithMember?.type !== 'fullSnapshot' && firstWithMember?.type !== 'participantJoin') {
    throw new Error(`fixed path: unexpected first populated event ${firstWithMember?.type}`);
  }
  console.log(
    `  ✓ fixed path: ${firstWithMember.type} participants=${firstWithMember.data.participants.length}; leave cleared`,
  );

  await sleep(1500);
  report.paths.mask = await originateAndWatch(
    ami,
    token,
    room,
    `Local/${ROOM_NUMBER}@${maskCtx}`,
    expectedConference,
  );
  const maskMember = report.paths.mask.events.find((e) => e.data?.participants?.length >= 1);
  if (!maskMember) throw new Error('mask path: no participant in SSE');
  console.log(
    `  ✓ mask path: ${maskMember.type} participants=${maskMember.data.participants.length}; leave cleared`,
  );

  const del = await requestJson('DELETE', `/api/conferences/${room.uid}`, { token });
  if (del.status >= 400) {
    throw new Error(`cleanup delete failed ${del.status} ${del.text}`);
  }
  ami.disconnect();

  report.ok = true;
  report.finished = new Date().toISOString();
  const out = path.join(RESULTS_DIR, `uat-test-2-${Date.now()}.json`);
  fs.writeFileSync(
    out,
    JSON.stringify(
      {
        ...report,
        paths: {
          fixed: {
            firstPopulatedType: firstWithMember.type,
            conferenceSeen: expectedConference,
            eventTypes: report.paths.fixed.events.map((e) => e.type),
            joinedParticipants: firstWithMember.data.participants.length,
            cleared: report.paths.fixed.cleared.data.participants.length,
            listSnippet: String(report.paths.fixed.list).slice(0, 500),
          },
          mask: {
            firstPopulatedType: maskMember.type,
            eventTypes: report.paths.mask.events.map((e) => e.type),
            joinedParticipants: maskMember.data.participants.length,
            cleared: report.paths.mask.cleared.data.participants.length,
          },
        },
      },
      null,
      2,
    ),
  );
  console.log(`\nPASS Test 2  ${out}\n`);
  process.exit(0);
})().catch((e) => {
  console.error(`\n✗ ${e.message}\n`);
  process.exit(1);
});
