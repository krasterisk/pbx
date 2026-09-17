/**
 * Phase 16 UAT Test 11 — D-08 two creates leave both numbers in mask-index.
 *
 *   BACKEND_UAT_PORT=5010 node .../uat-test-11-mask-two-creates.js
 */
const {
  loadEnv,
  connectAmi,
  cmd,
  loadJwt,
  tokenFor,
  firstTenantUser,
  ensureBackend,
  createRoom,
  deleteRoom,
  dbConn,
  writeResult,
} = require('./uat-live-lib');

const ROOM_A = process.env.UAT11_ROOM_A || '16902';
const ROOM_B = process.env.UAT11_ROOM_B || '16903';

(async () => {
  console.log('\n=== UAT 16 Test 11 D-08 two creates mask-index ===\n');
  const env = loadEnv();
  await ensureBackend();
  const jwt = loadJwt();
  const { user, tenant } = await firstTenantUser(env);
  const token = tokenFor(jwt, user, tenant, env);
  const conn = await dbConn(env);
  await conn.query(`DELETE FROM conference_rooms WHERE vpbx_user_uid = ? AND number IN (?, ?)`, [
    tenant,
    ROOM_A,
    ROOM_B,
  ]);
  await conn.end();

  const a = await createRoom(token, ROOM_A, 'UAT 16 Test 11 A');
  console.log(`  ✓ created ${ROOM_A} uid=${a.uid}`);
  const b = await createRoom(token, ROOM_B, 'UAT 16 Test 11 B');
  console.log(`  ✓ created ${ROOM_B} uid=${b.uid}`);

  const mask = `krsk-conf-mask-${tenant}`;
  const ami = await connectAmi(env);
  const planA = await cmd(ami, `dialplan show ${ROOM_A}@${mask}`);
  const planB = await cmd(ami, `dialplan show ${ROOM_B}@${mask}`);
  if (!planA.includes(`krsk-conf-${a.uid},s,1`)) {
    throw new Error(`mask-index lost ${ROOM_A} → krsk-conf-${a.uid}:\n${planA}`);
  }
  if (!planB.includes(`krsk-conf-${b.uid},s,1`)) {
    throw new Error(`mask-index lost ${ROOM_B} → krsk-conf-${b.uid}:\n${planB}`);
  }
  const full = await cmd(ami, `dialplan show ${mask}`);
  if (!full.includes(ROOM_A) || !full.includes(ROOM_B)) {
    throw new Error(`full mask-index missing a number:\n${full}`);
  }
  console.log(`  ✓ last mask-index ${mask} contains ${ROOM_A} and ${ROOM_B}`);

  await deleteRoom(token, a.uid);
  await deleteRoom(token, b.uid);
  ami.disconnect();

  const out = writeResult('uat-test-11', {
    ok: true,
    tenant,
    rooms: [
      { uid: a.uid, number: ROOM_A },
      { uid: b.uid, number: ROOM_B },
    ],
  });
  console.log(`\nPASS Test 11  ${out}\n`);
})().catch((e) => {
  console.error(`\n✗ ${e.message}\n`);
  process.exit(1);
});
