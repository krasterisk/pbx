/**
 * Phase 16 UAT Test 8 — D-34 parallel N joins land as N participants.
 *
 *   BACKEND_UAT_PORT=5010 node .../uat-test-8-parallel-join.js
 */
const {
  loadEnv,
  sleep,
  waitFor,
  connectAmi,
  amiAction,
  cmd,
  loadJwt,
  tokenFor,
  firstTenantUser,
  ensureBackend,
  createRoom,
  deleteRoom,
  hangupLocals,
  openSse,
  dbConn,
  writeResult,
} = require('./uat-live-lib');

const ROOM_NUMBER = process.env.UAT8_ROOM_NUMBER || '16897';
const JOIN_N = Number(process.env.UAT8_N || 3);

(async () => {
  console.log(`\n=== UAT 16 Test 8 D-34 parallel ${JOIN_N} join ===\n`);
  const env = loadEnv();
  let ami;
  let token;
  let room;
  let conference;
  let closeSse = () => {};
  try {
  await ensureBackend();
  const jwt = loadJwt();
  const { user, tenant } = await firstTenantUser(env);
  token = tokenFor(jwt, user, tenant, env);
  const conn = await dbConn(env);
  await conn.query(`DELETE FROM conference_rooms WHERE vpbx_user_uid = ? AND number = ?`, [
    tenant,
    ROOM_NUMBER,
  ]);
  await conn.end();

  room = await createRoom(token, ROOM_NUMBER, 'UAT 16 Test 8');
  conference = `conf${ROOM_NUMBER}_${tenant}`;
  const roomCtx = `krsk-conf-${room.uid}`;
  console.log(`  ✓ room ${room.uid} ${conference}`);

  const events = [];
  closeSse = openSse(`/api/conferences/${room.uid}/events`, token, (evt) => events.push(evt));
  await waitFor('sse snapshot', () => events.find((e) => e.type === 'fullSnapshot') || null);

  ami = await connectAmi(env);
  await sleep(400);
  await Promise.all(
    Array.from({ length: JOIN_N }, (_, i) =>
      amiAction(ami, {
        action: 'Originate',
        channel: `Local/s@${roomCtx}`,
        application: 'Wait',
        data: '30',
        timeout: 15000,
        callerid: `uat8n${i + 1} <1608${i + 1}>`,
        async: 'true',
      }),
    ),
  );

  const snap = await waitFor(
    `${JOIN_N} participants`,
    () => {
      const hit = [...events]
        .reverse()
        .find((e) => e.data && Array.isArray(e.data.participants));
      if (!hit) return null;
      return hit.data.participants.length === JOIN_N ? hit : null;
    },
    30000,
  );
  const refs = snap.data.participants.map((p) => p.ref || p.channel || p.callerIdNum || '');
  const unique = new Set(refs);
  const list = await cmd(ami, `confbridge list ${conference}`);
  const amiMembers = list
    .split(/\r?\n/)
    .filter((line) => /Local\/|PJSIP\//.test(line));
  if (snap.data.participants.length !== JOIN_N) {
    throw new Error(`snapshot has ${snap.data.participants.length}, want ${JOIN_N}`);
  }
  if (amiMembers.length !== JOIN_N) {
    throw new Error(
      `asterisk has ${amiMembers.length} members, want ${JOIN_N}:\n${list}\nsnap=${JSON.stringify(snap.data.participants)}`,
    );
  }
  console.log(
    `  ✓ SSE participants=${JOIN_N} unique refs=${unique.size} AMI members=${amiMembers.length}`,
  );

  const out = writeResult('uat-test-8', {
    ok: true,
    roomUid: room.uid,
    conference,
    n: JOIN_N,
    refs,
    eventTypes: events.map((e) => e.type),
    confbridgeList: list.split(/\r?\n/).slice(0, 16),
  });
  console.log(`\nPASS Test 8  ${out}\n`);
  } finally {
    closeSse();
    if (ami) {
      await hangupLocals(ami, conference).catch(() => {});
      ami.disconnect();
    }
    if (token && room?.uid) await deleteRoom(token, room.uid).catch(() => {});
  }
})().catch((e) => {
  console.error(`\n✗ ${e.message}\n`);
  process.exit(1);
});
