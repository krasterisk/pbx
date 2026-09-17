/**
 * Phase 16 UAT Test 3 — DIALPLAN_EXISTS on the tenant mask-index.
 *
 * Existing room number must jump to krsk-conf-{uid},s,1 and join ConfBridge.
 * Unknown number must hit not-found → Playback(invalid) → Hangup, no conference.
 *
 *   BACKEND_UAT_PORT=5010 node .planning/phases/16-modul-telekonferentsiy-confbridge-webrtc/uat-test-3-mask-exists.js
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const mysql = require('mysql2/promise');
const AsteriskManager = require('asterisk-manager');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const PORT = Number(process.env.BACKEND_UAT_PORT || 5010);
const ROOM_NUMBER = process.env.UAT3_ROOM_NUMBER || '16893';
const MISSING_NUMBER = process.env.UAT3_MISSING_NUMBER || '16899';
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
    req.setTimeout(20000, () => req.destroy(new Error(`timeout ${method} ${urlPath}`)));
    if (payload) req.write(payload);
    req.end();
  });
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
    await sleep(300);
  }
  throw new Error(`timeout waiting for ${label}`);
}

function attachTrace(ami) {
  const events = [];
  const push = (type, evt) => {
    events.push({
      type,
      context: String(evt.context || evt.Context || ''),
      exten: String(evt.extension || evt.exten || evt.Exten || ''),
      app: String(evt.application || evt.app || evt.Application || ''),
      appdata: String(evt.appdata || evt.AppData || ''),
      channel: String(evt.channel || evt.Channel || ''),
      conference: String(evt.conference || evt.Conference || ''),
    });
  };
  ami.on('newexten', (evt) => push('newexten', evt));
  ami.on('hangup', (evt) => push('hangup', evt));
  ami.on('confbridgejoin', (evt) => push('confbridgejoin', evt));
  ami.on('varset', (evt) => {
    const name = String(evt.variable || evt.Variable || '');
    if (name === 'DIALPLAN_EXISTS' || name.includes('CONF')) push('varset', evt);
  });
  return events;
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

(async () => {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  console.log(`\n=== UAT 16 Test 3 @ ${env.AMI_HOST} backend :${PORT} ===\n`);

  const health = await requestJson('GET', '/api/health');
  if (health.status !== 200) throw new Error(`backend not healthy ${health.status}`);
  console.log('  ✓ backend health');

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
     FROM users WHERE vpbx_user_uid > 0 ORDER BY uniqueid ASC LIMIT 5`,
  );
  if (!users.length) throw new Error('no tenant users');
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
  await conn.query(`DELETE FROM conference_rooms WHERE vpbx_user_uid = ? AND number IN (?, ?)`, [
    tenant,
    ROOM_NUMBER,
    MISSING_NUMBER,
  ]);
  await conn.end();
  console.log(`  ✓ jwt tenant ${tenant}`);

  const created = await requestJson('POST', '/api/conferences', {
    token,
    body: { number: ROOM_NUMBER, name: 'UAT 16 Test 3' },
  });
  if (created.status >= 400 || !created.json?.uid) {
    throw new Error(`create room failed ${created.status} ${created.text}`);
  }
  const room = created.json;
  const roomCtx = `krsk-conf-${room.uid}`;
  const maskCtx = `krsk-conf-mask-${tenant}`;
  const conference = `conf${ROOM_NUMBER}_${tenant}`;
  console.log(`  ✓ room uid=${room.uid} ${conference}`);

  const ami = await connectAmi();
  const events = attachTrace(ami);
  await sleep(1200);

  const existingPlan = await cmd(ami, `dialplan show ${ROOM_NUMBER}@${maskCtx}`);
  const missingPlan = await cmd(ami, `dialplan show ${MISSING_NUMBER}@${maskCtx}`);
  const notFoundPlan = await cmd(ami, `dialplan show not-found@${maskCtx}`);

  if (!existingPlan.includes('DIALPLAN_EXISTS') || !existingPlan.includes(`${roomCtx},s,1`)) {
    throw new Error(`existing number dialplan missing DIALPLAN_EXISTS → ${roomCtx}:\n${existingPlan}`);
  }
  if (!/_X\.|not-found/.test(missingPlan)) {
    throw new Error(`missing number did not match catch-all:\n${missingPlan}`);
  }
  if (!/Playback\(invalid\)/.test(notFoundPlan) || !/Hangup/.test(notFoundPlan)) {
    throw new Error(`not-found priority missing Playback/Hangup:\n${notFoundPlan}`);
  }
  console.log('  ✓ dialplan: exists jumps to room; miss → not-found Playback+Hangup');

  await amiAction(ami, {
    action: 'Originate',
    channel: `Local/${ROOM_NUMBER}@${maskCtx}`,
    application: 'Wait',
    data: '20',
    timeout: 15000,
    callerid: 'uat3exist <16001>',
    async: 'true',
  });

  await waitFor('existing number joins conference', async () => {
    const list = await cmd(ami, 'confbridge list');
    return list.includes(conference) ? list : null;
  });
  const hitRoom = events.some(
    (e) =>
      e.type === 'confbridgejoin' ||
      (e.type === 'newexten' && e.context === roomCtx && /ConfBridge/i.test(e.app)),
  );
  console.log(`  ✓ existing ${ROOM_NUMBER} → ${conference}${hitRoom ? ' (AMI join/ConfBridge seen)' : ''}`);

  const live = (await cmd(ami, 'core show channels concise'))
    .split(/\r?\n/)
    .map((l) => l.split('!')[0])
    .filter((ch) => ch && /Local\//.test(ch));
  for (const ch of live) await cmd(ami, `channel request hangup ${ch}`).catch(() => {});
  await cmd(ami, `confbridge kick ${conference} all`).catch(() => {});
  await sleep(800);

  const beforeMiss = events.length;
  await amiAction(ami, {
    action: 'Originate',
    channel: `Local/${MISSING_NUMBER}@${maskCtx}`,
    application: 'Wait',
    data: '8',
    timeout: 10000,
    callerid: 'uat3miss <16002>',
    async: 'true',
  });

  const missTrace = await waitFor('missing number Playback/Hangup', () => {
    const slice = events.slice(beforeMiss);
    const playback = slice.some(
      (e) =>
        e.type === 'newexten' &&
        /Playback/i.test(e.app) &&
        /invalid/i.test(e.appdata + e.exten + e.context),
    );
    const hangup = slice.some((e) => e.type === 'hangup');
    const notFound = slice.some(
      (e) => e.context === maskCtx && (e.exten === 'not-found' || e.exten === MISSING_NUMBER),
    );
    return playback || (hangup && notFound) ? { playback, hangup, notFound, slice } : null;
  }, 12000);

  const joinedAfterMiss = events
    .slice(beforeMiss)
    .some((e) => e.type === 'confbridgejoin' || e.conference === conference);
  const listAfter = await cmd(ami, 'confbridge list');
  if (joinedAfterMiss || listAfter.includes(conference)) {
    throw new Error(`missing number entered conference ${conference}`);
  }
  if (!missTrace.playback && !/Playback|Hangup/.test(JSON.stringify(missTrace.slice))) {
    const verbose = await cmd(ami, `dialplan show ${MISSING_NUMBER}@${maskCtx}`);
    throw new Error(
      `missing number did not show Playback/Hangup in AMI; dialplan still:\n${verbose}\n events=${JSON.stringify(missTrace.slice).slice(0, 800)}`,
    );
  }
  console.log(
    `  ✓ missing ${MISSING_NUMBER} → not-found` +
      `${missTrace.playback ? ' Playback(invalid)' : ''}` +
      `${missTrace.hangup ? ' Hangup' : ''} ; no conference`,
  );

  const leftover = (await cmd(ami, 'core show channels concise'))
    .split(/\r?\n/)
    .map((l) => l.split('!')[0])
    .filter((ch) => ch && /Local\//.test(ch));
  for (const ch of leftover) await cmd(ami, `channel request hangup ${ch}`).catch(() => {});

  const del = await requestJson('DELETE', `/api/conferences/${room.uid}`, { token });
  if (del.status >= 400) throw new Error(`cleanup failed ${del.status} ${del.text}`);
  ami.disconnect();

  const out = path.join(RESULTS_DIR, `uat-test-3-${Date.now()}.json`);
  fs.writeFileSync(
    out,
    JSON.stringify(
      {
        ok: true,
        roomUid: room.uid,
        conference,
        existingPlanSnippet: existingPlan.split('\n').slice(0, 12),
        missingPlanSnippet: missingPlan.split('\n').slice(0, 12),
        notFoundHasPlayback: /Playback\(invalid\)/.test(notFoundPlan),
        miss: { playback: missTrace.playback, hangup: missTrace.hangup },
      },
      null,
      2,
    ),
  );
  console.log(`\nPASS Test 3  ${out}\n`);
  process.exit(0);
})().catch((e) => {
  console.error(`\n✗ ${e.message}\n`);
  process.exit(1);
});
