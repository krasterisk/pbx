/**
 * Phase 16 UAT Test 10 — D-17 two admin enters write two audit rows in order.
 *
 *   BACKEND_UAT_PORT=5010 node .../uat-test-10-admin-audit.js
 */
const {
  loadEnv,
  sleep,
  waitFor,
  loadJwt,
  tokenFor,
  twoTenantUsers,
  ensureBackend,
  createRoom,
  deleteRoom,
  openSse,
  dbConn,
  writeResult,
} = require('./uat-live-lib');

const ROOM_NUMBER = process.env.UAT10_ROOM_NUMBER || '16901';

(async () => {
  console.log('\n=== UAT 16 Test 10 D-17 admin enter audit ===\n');
  const env = loadEnv();
  await ensureBackend();
  const jwt = loadJwt();
  const { tenant, creator, visitor } = await twoTenantUsers(env);
  if (Number(creator.uniqueid) === Number(visitor.uniqueid)) {
    throw new Error('creator and visitor must differ');
  }
  const creatorTok = tokenFor(jwt, creator, tenant, env);
  const visitorTok = tokenFor(jwt, visitor, tenant, env);
  const conn = await dbConn(env);
  await conn.query(`DELETE FROM conference_rooms WHERE vpbx_user_uid = ? AND number = ?`, [
    tenant,
    ROOM_NUMBER,
  ]);
  await conn.end();

  const room = await createRoom(creatorTok, ROOM_NUMBER, 'UAT 16 Test 10');
  console.log(`  ✓ room ${room.uid} created_by=${creator.uniqueid} visitor=${visitor.uniqueid}`);

  const conn2 = await dbConn(env);
  const [before] = await conn2.query(
    `SELECT id FROM action_logs
     WHERE action = 'conference_live_room_enter' AND entity_id = ?
     ORDER BY id ASC`,
    [room.uid],
  );
  const beforeIds = new Set(before.map((r) => r.id));

  const ev1 = [];
  const close1 = openSse(`/api/conferences/${room.uid}/events`, visitorTok, (e) => ev1.push(e));
  await waitFor('first enter snapshot', () => ev1.find((e) => e.type === 'fullSnapshot') || null);
  close1();
  await sleep(400);

  const ev2 = [];
  const close2 = openSse(`/api/conferences/${room.uid}/events`, visitorTok, (e) => ev2.push(e));
  await waitFor('second enter snapshot', () => ev2.find((e) => e.type === 'fullSnapshot') || null);
  close2();
  await sleep(400);

  const [rows] = await conn2.query(
    `SELECT id, user_id, action, entity_id, details, created_at
     FROM action_logs
     WHERE action = 'conference_live_room_enter' AND entity_id = ?
     ORDER BY id ASC`,
    [room.uid],
  );
  await conn2.end();
  const fresh = rows.filter((r) => !beforeIds.has(r.id));
  if (fresh.length < 2) {
    throw new Error(
      `expected 2 conference_live_room_enter rows, got ${fresh.length}: ${JSON.stringify(fresh)}`,
    );
  }
  if (Number(fresh[0].id) >= Number(fresh[1].id)) {
    throw new Error(`audit ids not increasing: ${fresh[0].id} then ${fresh[1].id}`);
  }
  if (Number(fresh[0].user_id) !== Number(visitor.uniqueid)) {
    throw new Error(`first enter user_id ${fresh[0].user_id} != visitor ${visitor.uniqueid}`);
  }
  if (Number(fresh[1].user_id) !== Number(visitor.uniqueid)) {
    throw new Error(`second enter user_id ${fresh[1].user_id} != visitor ${visitor.uniqueid}`);
  }
  const t0 = new Date(fresh[0].created_at).getTime();
  const t1 = new Date(fresh[1].created_at).getTime();
  if (t1 < t0) throw new Error(`created_at out of order ${fresh[0].created_at} → ${fresh[1].created_at}`);
  console.log(
    `  ✓ audit ${fresh[0].id}@${fresh[0].created_at} then ${fresh[1].id}@${fresh[1].created_at}`,
  );

  await deleteRoom(creatorTok, room.uid);
  const out = writeResult('uat-test-10', {
    ok: true,
    roomUid: room.uid,
    creator: creator.uniqueid,
    visitor: visitor.uniqueid,
    rows: fresh.slice(0, 2),
  });
  console.log(`\nPASS Test 10  ${out}\n`);
})().catch((e) => {
  console.error(`\n✗ ${e.message}\n`);
  process.exit(1);
});
