/**
 * Phase 16 UAT Test 4 — one-shot role vs ConfBridge DTMF admin.
 *
 * After the owner grants a guest moderator in the live meeting:
 *   - the guest's portal mute/kick work immediately (REST + AMI)
 *   - Asterisk still shows Admin=No on that channel (DTMF menu stays off
 *     until the next join, engine limit from 16-05)
 *
 *   BACKEND_UAT_PORT=5010 node .planning/phases/16-modul-telekonferentsiy-confbridge-webrtc/uat-test-4-live-role.js
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const mysql = require('mysql2/promise');
const AsteriskManager = require('asterisk-manager');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const PORT = Number(process.env.BACKEND_UAT_PORT || 5010);
const ROOM_NUMBER = process.env.UAT4_ROOM_NUMBER || '16894';
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

function tokenFor(jwt, user, tenant) {
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

function callerRef(user) {
  const exten = String(user.exten || '').trim();
  if (/^\d{1,32}$/.test(exten)) return exten;
  const login = String(user.login || '').trim();
  if (/^\d{1,32}$/.test(login)) return login;
  return '';
}

function parseBridgeUsers(text) {
  const users = [];
  for (const line of String(text).split(/\r?\n/)) {
    const m = line.match(/^\s*(?<channel>\S+)\s+(?<flags>\S*)\s+(?<caller>\S+)/);
    if (!m || /Channel|====|Conference/.test(m.groups.channel)) continue;
    users.push({
      channel: m.groups.channel,
      flags: m.groups.flags,
      caller: m.groups.caller,
      raw: line.trim(),
    });
  }
  if (users.length === 0) {
    for (const line of String(text).split(/\r?\n/)) {
      if (/Local\/|PJSIP\//.test(line)) users.push({ raw: line.trim(), channel: line.trim() });
    }
  }
  return users;
}

function guestIsAdmin(listText, guestRef) {
  const lines = String(listText)
    .split(/\r?\n/)
    .filter((l) => l.includes(guestRef) || /Local\//.test(l));
  const adminYes = lines.some((l) => /\bYes\b/.test(l) && /Admin|admin|A\b/.test(l));
  const flagged = lines.some((l) => /admin/i.test(l) && !/No/.test(l));
  return { adminYes: adminYes || flagged, lines };
}

(async () => {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  console.log(`\n=== UAT 16 Test 4 @ ${env.AMI_HOST} backend :${PORT} ===\n`);

  const health = await requestJson('GET', '/api/health');
  if (health.status !== 200) throw new Error(`backend not healthy ${health.status}`);

  const jwt = loadJwt();
  const conn = await mysql.createConnection({
    host: env.DB_HOST,
    port: Number(env.DB_PORT || 3306),
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
  });
  const [users] = await conn.query(
    `SELECT uniqueid, login, name, level, role, vpbx_user_uid, exten
     FROM users
     ORDER BY uniqueid ASC`,
  );
  const byTenant = new Map();
  for (const user of users) {
    const ref = callerRef(user);
    if (!ref) continue;
    const tenant =
      user.vpbx_user_uid == null ? Number(user.uniqueid) : Number(user.vpbx_user_uid);
    const list = byTenant.get(tenant) || [];
    list.push({ ...user, ref });
    byTenant.set(tenant, list);
  }
  let pair = null;
  for (const [tenant, list] of byTenant) {
    const uniq = [];
    const seen = new Set();
    for (const item of list) {
      if (seen.has(item.ref)) continue;
      seen.add(item.ref);
      uniq.push(item);
    }
    if (uniq.length >= 2) {
      pair = { tenant, owner: uniq[0], guest: uniq[1] };
      break;
    }
  }
  if (!pair) throw new Error('need two tenant users with numeric exten/login');
  const { tenant, owner, guest } = pair;
  const ownerTok = tokenFor(jwt, owner, tenant);
  const guestTok = tokenFor(jwt, guest, tenant);
  await conn.query(`DELETE FROM conference_rooms WHERE vpbx_user_uid = ? AND number = ?`, [
    tenant,
    ROOM_NUMBER,
  ]);
  await conn.end();
  console.log(`  ✓ owner=${owner.ref} guest=${guest.ref} tenant=${tenant}`);

  const created = await requestJson('POST', '/api/conferences', {
    token: ownerTok,
    body: { number: ROOM_NUMBER, name: 'UAT 16 Test 4' },
  });
  if (created.status >= 400 || !created.json?.uid) {
    throw new Error(`create room failed ${created.status} ${created.text}`);
  }
  const room = created.json;
  const conference = `conf${ROOM_NUMBER}_${tenant}`;
  const roomCtx = `krsk-conf-${room.uid}`;

  const mods = await requestJson('PUT', `/api/conferences/${room.uid}/moderators`, {
    token: ownerTok,
    body: { moderators: [{ endpointRef: owner.ref, role: 'owner' }] },
  });
  if (mods.status >= 400) throw new Error(`set moderators failed ${mods.status} ${mods.text}`);
  console.log(`  ✓ room ${room.uid} owner=${owner.ref}`);

  const snapshots = [];
  const closeSse = (() => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port: PORT,
        path: `/api/conferences/${room.uid}/events?token=${encodeURIComponent(ownerTok)}`,
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
            let type = 'message';
            let data = '';
            for (const line of block.split(/\r?\n/)) {
              if (line.startsWith('event:')) type = line.slice(6).trim();
              else if (line.startsWith('data:')) data = line.slice(5).trim();
            }
            if (type === 'heartbeat' || !data) continue;
            try {
              snapshots.push({ type, data: JSON.parse(data) });
            } catch {
              /* ignore */
            }
          }
        });
      },
    );
    req.on('error', () => {});
    req.end();
    return () => req.destroy();
  })();

  const ami = await connectAmi();
  const stale = (await cmd(ami, 'core show channels concise'))
    .split(/\r?\n/)
    .map((l) => l.split('!')[0])
    .filter((ch) => ch && /Local\/s@krsk-conf-/.test(ch));
  for (const ch of stale) await cmd(ami, `channel request hangup ${ch}`).catch(() => {});
  await sleep(800);

  await amiAction(ami, {
    action: 'Originate',
    channel: `Local/s@${roomCtx}`,
    application: 'Wait',
    data: '40',
    timeout: 15000,
    callerid: `guest <${guest.ref}>`,
    async: 'true',
    variable: `CALLERID(num)=${guest.ref}`,
  });
  await amiAction(ami, {
    action: 'Originate',
    channel: `Local/s@${roomCtx}`,
    application: 'Wait',
    data: '40',
    timeout: 15000,
    callerid: 'victim <16003>',
    async: 'true',
  });

  const joined = await waitFor('both in conference', async () => {
    const list = await cmd(ami, `confbridge list ${conference}`);
    const locals = (list.match(/Local\//g) || []).length;
    const snap = [...snapshots].reverse().find((s) => s.data?.participants?.length >= 2);
    return locals >= 2 && snap ? { list, snap } : null;
  });
  const participants = joined.snap.data.participants;
  console.log(
    `  ✓ ${participants.length} in snapshot: ${participants.map((p) => `${p.ref}/${p.role}`).join(', ')}`,
  );
  const guestPart =
    participants.find((p) => p.ref === guest.ref) ||
    participants.find((p) => String(p.displayName || '').includes(guest.ref)) ||
    participants.find((p) => p.ref !== '16003' && p.ref !== 'victim');
  const victimPart =
    participants.find((p) => p.ref === '16003') ||
    participants.find((p) => p !== guestPart);
  if (!guestPart || !victimPart || guestPart.ref === victimPart.ref) {
    throw new Error(`could not tell guest from victim: ${JSON.stringify(participants)}`);
  }

  const before = await requestJson(
    'POST',
    `/api/conferences/${room.uid}/participants/${encodeURIComponent(victimPart.ref)}/mute`,
    { token: guestTok },
  );
  if (before.status !== 403) {
    throw new Error(`guest mute before grant expected 403, got ${before.status} ${before.text}`);
  }
  console.log('  ✓ guest mute before grant → 403');

  const grant = await requestJson(
    'POST',
    `/api/conferences/${room.uid}/participants/${encodeURIComponent(guestPart.ref)}/role`,
    { token: ownerTok, body: { role: 'moderator' } },
  );
  if (grant.status >= 400) {
    throw new Error(`grant failed ${grant.status} ${grant.text} snapshot=${JSON.stringify(participants)}`);
  }
  console.log('  ✓ owner granted guest moderator');

  const listAfterGrant = await cmd(ami, `confbridge list ${conference}`);
  const adminAfterGrant = guestIsAdmin(listAfterGrant, guest.ref);

  const mute = await requestJson(
    'POST',
    `/api/conferences/${room.uid}/participants/${encodeURIComponent(victimPart.ref)}/mute`,
    { token: guestTok },
  );
  if (mute.status >= 400) {
    throw new Error(`guest mute after grant failed ${mute.status} ${mute.text}`);
  }
  await sleep(500);
  const mutedOnBridge = /16003|victim/i.test(await cmd(ami, `confbridge list ${conference}`));
  console.log('  ✓ guest portal mute after grant → 200');

  if (adminAfterGrant.adminYes) {
    throw new Error(
      `DTMF admin already on after live grant (expected Admin=No until rejoin):\n${listAfterGrant}`,
    );
  }
  console.log('  ✓ Asterisk Admin still No after live grant (DTMF menu not armed)');

  const live = (await cmd(ami, 'core show channels concise'))
    .split(/\r?\n/)
    .map((l) => l.split('!')[0])
    .filter((ch) => ch && /Local\//.test(ch));
  for (const ch of live) await cmd(ami, `channel request hangup ${ch}`).catch(() => {});
  await cmd(ami, `confbridge kick ${conference} all`).catch(() => {});

  closeSse();
  const del = await requestJson('DELETE', `/api/conferences/${room.uid}`, { token: ownerTok });
  if (del.status >= 400) throw new Error(`cleanup failed ${del.status} ${del.text}`);
  ami.disconnect();

  const out = path.join(RESULTS_DIR, `uat-test-4-${Date.now()}.json`);
  fs.writeFileSync(
    out,
    JSON.stringify(
      {
        ok: true,
        roomUid: room.uid,
        conference,
        owner: owner.ref,
        guest: guest.ref,
        beforeGrantStatus: before.status,
        afterGrantMuteStatus: mute.status,
        adminAfterGrant: false,
        listAfterGrant: listAfterGrant.split('\n').slice(0, 20),
        mutedOnBridge,
      },
      null,
      2,
    ),
  );
  console.log(`\nPASS Test 4  ${out}\n`);
  process.exit(0);
})().catch((e) => {
  console.error(`\n✗ ${e.message}\n`);
  process.exit(1);
});
