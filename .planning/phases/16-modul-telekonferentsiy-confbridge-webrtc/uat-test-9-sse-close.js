/**
 * Phase 16 UAT Test 9 — D-35 SSE disconnect stops heartbeat and drops observers.
 *
 *   BACKEND_UAT_PORT=5010 NEST_LOG_PATH=... node .../uat-test-9-sse-close.js
 */
const fs = require('fs');
const {
  loadEnv,
  sleep,
  waitFor,
  loadJwt,
  tokenFor,
  firstTenantUser,
  ensureBackend,
  createRoom,
  deleteRoom,
  openSse,
  dbConn,
  writeResult,
} = require('./uat-live-lib');

const ROOM_NUMBER = process.env.UAT9_ROOM_NUMBER || '16898';
const NEST_LOG = process.env.NEST_LOG_PATH || '';

(async () => {
  console.log('\n=== UAT 16 Test 9 D-35 SSE close ===\n');
  const env = loadEnv();
  await ensureBackend();
  const jwt = loadJwt();
  const { user, tenant } = await firstTenantUser(env);
  const token = tokenFor(jwt, user, tenant, env);
  const conn = await dbConn(env);
  await conn.query(`DELETE FROM conference_rooms WHERE vpbx_user_uid = ? AND number = ?`, [
    tenant,
    ROOM_NUMBER,
  ]);
  await conn.end();

  const room = await createRoom(token, ROOM_NUMBER, 'UAT 16 Test 9');
  const events = [];
  const openedAt = Date.now();
  const closeSse = openSse(`/api/conferences/${room.uid}/events`, token, (evt) => events.push(evt));
  await waitFor('fullSnapshot', () => events.find((e) => e.type === 'fullSnapshot') || null);
  console.log(`  ✓ SSE opened room ${room.uid}`);
  await sleep(400);
  closeSse();
  console.log('  ✓ client destroyed SSE request');

  if (!NEST_LOG) {
    throw new Error('NEST_LOG_PATH is required to assert heartbeat finalize');
  }
  const closed = await waitFor(
    'SSE closed log',
    () => {
      const text = fs.readFileSync(NEST_LOG, 'utf8');
      const marker = `Conference SSE closed: room ${room.uid} heartbeat stopped`;
      const idx = text.lastIndexOf(marker);
      if (idx === -1) return null;
      const line = text.slice(idx, idx + 180);
      return { line, observersZero: /observers=0/.test(line) };
    },
    15000,
  );
  if (!closed.observersZero) {
    throw new Error(`heartbeat stopped but observers not 0: ${closed.line}`);
  }
  console.log(`  ✓ ${closed.line.trim()}`);

  const after = [];
  const close2 = openSse(`/api/conferences/${room.uid}/events`, token, (evt) => after.push(evt));
  await waitFor('reopen snapshot', () => after.find((e) => e.type === 'fullSnapshot') || null);
  close2();
  const reclosed = await waitFor(
    'second SSE closed',
    () => {
      const text = fs.readFileSync(NEST_LOG, 'utf8');
      const parts = text.split(`Conference SSE closed: room ${room.uid} heartbeat stopped`);
      return parts.length >= 3 ? true : null;
    },
    15000,
  );
  if (!reclosed) throw new Error('second close was not logged');
  console.log('  ✓ second subscribe/unsubscribe also dropped observers');

  await deleteRoom(token, room.uid);
  const out = writeResult('uat-test-9', {
    ok: true,
    roomUid: room.uid,
    openedAt,
    firstClose: closed.line.trim(),
    eventTypes: events.map((e) => e.type),
  });
  console.log(`\nPASS Test 9  ${out}\n`);
})().catch((e) => {
  console.error(`\n✗ ${e.message}\n`);
  process.exit(1);
});
