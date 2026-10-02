#!/usr/bin/env node
/**
 * Box bootstrap after migrations: admin, test SIP endpoint, queue 614,
 * route 901 into the imported robot, optional trunk/DID.
 * Then asks the API to write the dialplan over AMI.
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const bcrypt = require('bcrypt');
const { Client } = require('pg');

const env = process.env;
const client = new Client({
  host: env.DB_HOST,
  port: Number(env.DB_PORT || 5432),
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
});

async function one(sql, params) {
  const result = await client.query(sql, params);
  return result.rows[0] || null;
}

async function ensureAdmin() {
  const login = env.ADMIN_LOGIN || 'admin';
  const existing = await one('SELECT uniqueid FROM users WHERE login = $1', [login]);
  if (existing) return existing.uniqueid;
  const hash = await bcrypt.hash(env.ADMIN_PASSWORD, 12);
  const created = await one(
    `INSERT INTO users
      (login, name, passwd, email, level, "isActivated", vpbx_user_uid, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $1, 1, true, 0, NOW(), NOW())
     RETURNING uniqueid`,
    [login, 'Администратор', hash],
  );
  return created.uniqueid;
}

async function ensureContext(name) {
  const existing = await one(
    'SELECT uid FROM contexts WHERE name = $1 AND user_uid = 0',
    [name],
  );
  if (existing) return existing.uid;
  const created = await one(
    'INSERT INTO contexts (name, comment, user_uid) VALUES ($1, $2, 0) RETURNING uid',
    [name, name],
  );
  return created.uid;
}

async function ensureRoute(contextUid, name, extension, actions) {
  const existing = await one(
    'SELECT uid FROM routes WHERE context_uid = $1 AND name = $2 LIMIT 1',
    [contextUid, name],
  );
  if (existing) return existing.uid;
  const created = await one(
    `INSERT INTO routes
      (context_uid, name, extensions, priority, active, actions, user_uid, created_at, updated_at)
     VALUES ($1, $2, $3::json, 0, 1, $4::json, 0, NOW(), NOW())
     RETURNING uid`,
    [contextUid, name, JSON.stringify([extension]), JSON.stringify(actions)],
  );
  return created.uid;
}

async function ensureQueue() {
  const name = 'q701_0';
  await client.query(
    `INSERT INTO queue_table (name, strategy, timeout, maxlen, joinempty, leavewhenempty, ringinuse, autofill, display_name, vpbx_user_uid)
     VALUES ($1, 'ringall', 120, 0, 'yes', 'no', true, 'yes', 'Перевод Командор', 0)
     ON CONFLICT (name) DO NOTHING`,
    [name],
  );
}

async function ensureEndpoint() {
  const id = 'e201_0';
  const password = env.TEST_SIP_PASSWORD;
  if (!password) throw new Error('TEST_SIP_PASSWORD is empty');
  await client.query(
    `INSERT INTO ps_auths (id, auth_type, username, password, realm)
     VALUES ($1, 'userpass', $1, $2, 'asterisk')
     ON CONFLICT (id) DO NOTHING`,
    [id, password],
  );
  await client.query(
    `INSERT INTO ps_aors (id, max_contacts, remove_existing, qualify_frequency)
     VALUES ($1, 1, 'yes', 60)
     ON CONFLICT (id) DO NOTHING`,
    [id],
  );
  await client.query(
    `INSERT INTO ps_endpoints (
      id, tenantid, auth, aors, context, callerid, disallow, allow, transport,
      dtmf_mode, language, direct_media, force_rport, rewrite_contact, rtp_symmetric,
      ice_support, webrtc, identify_by
    ) VALUES (
      $1, '0', $1, $1, 'sip-out0', '"201" <201>', 'all', 'ulaw,alaw', 'transport-udp',
      'auto', 'ru', 'no', 'yes', 'yes', 'yes',
      'no', 'no', 'username'
    ) ON CONFLICT (id) DO NOTHING`,
    [id],
  );
}

async function ensureTrunk() {
  const host = (env.TRUNK_HOST || '').trim();
  if (!host) return null;
  const mode = (env.TRUNK_MODE || 'ip').trim();
  const id = 't_carrier_0';
  const port = env.TRUNK_PORT || '5060';
  const username = env.TRUNK_USERNAME || id;
  const password = env.TRUNK_PASSWORD || '';
  await client.query(
    `INSERT INTO ps_aors (id, contact, qualify_frequency)
     VALUES ($1, $2, 60)
     ON CONFLICT (id) DO NOTHING`,
    [id, `sip:${host}:${port}`],
  );
  if (mode === 'auth') {
    await client.query(
      `INSERT INTO ps_auths (id, auth_type, username, password, realm)
       VALUES ($1, 'userpass', $2, $3, 'asterisk')
       ON CONFLICT (id) DO NOTHING`,
      [id, username, password],
    );
    await client.query(
      `INSERT INTO ps_registrations (
        id, server_uri, client_uri, outbound_auth, contact_user, transport, endpoint,
        retry_interval, forbidden_retry_interval, expiration, line, type
      ) VALUES (
        $1, $2, $3, $1, $4, 'transport-udp', $1,
        60, 300, 3600, 'yes', 'registration'
      ) ON CONFLICT (id) DO NOTHING`,
      [id, `sip:${host}:${port}`, `sip:${username}@${host}:${port}`, username],
    );
  }
  await client.query(
    `INSERT INTO ps_endpoints (
      id, tenantid, auth, outbound_auth, aors, context, disallow, allow, transport,
      from_user, from_domain, identify_by, direct_media, force_rport, rewrite_contact,
      rtp_symmetric, ice_support, webrtc, dtmf_mode, language
    ) VALUES (
      $1, '0', NULL, $2, $1, 'sip-in0', 'all', 'ulaw,alaw', 'transport-udp',
      $3, $4, 'ip,username', 'no', 'yes', 'yes',
      'yes', 'no', 'no', 'auto', 'ru'
    ) ON CONFLICT (id) DO NOTHING`,
    [id, mode === 'auth' ? id : null, username, host],
  );
  const match = (env.TRUNK_MATCH || host).trim();
  await client.query(
    `INSERT INTO ps_endpoint_id_ips (id, endpoint, match, srv_lookups, type)
     VALUES ($1, $2, $3, 'no', 'identify')
     ON CONFLICT (id) DO NOTHING`,
    [`${id}_identify`, id, match],
  );
  return id;
}

async function applyDialplan(contextUids) {
  const login = await fetch('http://127.0.0.1:5010/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ login: env.ADMIN_LOGIN || 'admin', password: env.ADMIN_PASSWORD }),
  });
  if (!login.ok) throw new Error(`login failed: ${login.status} ${await login.text()}`);
  const body = await login.json();
  for (const uid of contextUids) {
    let last = '';
    for (let attempt = 1; attempt <= 12; attempt += 1) {
      const res = await fetch(`http://127.0.0.1:5010/api/routes/apply/${uid}`, {
        method: 'POST',
        headers: { authorization: `Bearer ${body.accessToken}` },
      });
      last = await res.text();
      if (res.ok) break;
      if (attempt === 12) throw new Error(`apply ${uid} failed: ${res.status} ${last}`);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}

await client.connect();
let contexts = [];
let robotUid = 0;
try {
  await client.query('BEGIN');
  await ensureAdmin();
  const robot = await one('SELECT uid FROM voice_robots WHERE name = $1 ORDER BY uid LIMIT 1', ['Командор']);
  if (!robot) throw new Error('robot Командор is not in the database');
  robotUid = robot.uid;
  const outContext = await ensureContext('sip-out');
  await ensureRoute(outContext, 'Робот Командор', env.ROBOT_EXTENSION || '901', [
    { type: 'voicerobot', params: { robot_uid: robot.uid } },
  ]);
  await ensureRoute(outContext, '614', env.TRANSFER_EXTENSION || '614', [
    { type: 'toqueue', params: { queue: env.QUEUE_EXTENSION || '701', timeout: '120', options: 'thH' } },
  ]);
  contexts = [outContext];
  const did = (env.INBOUND_DID || '').trim();
  if (did) {
    const inContext = await ensureContext('sip-in');
    await ensureRoute(inContext, `Вход ${did}`, did, [
      { type: 'voicerobot', params: { robot_uid: robot.uid } },
    ]);
    contexts.push(inContext);
  }
  await ensureQueue();
  await ensureEndpoint();
  await ensureTrunk();
  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  await client.end();
}
await applyDialplan(contexts);
process.stdout.write(`seeded robot_uid=${robotUid} contexts=${contexts.join(',')}\n`);
