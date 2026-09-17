/**
 * Phase 16 UAT Test 6 — D-06 precision: uid INT max is decimal, no e+.
 *
 *   BACKEND_UAT_PORT=5010 node .../uat-test-6-precision.js
 */
const { spawnSync } = require('child_process');
const path = require('path');
const {
  REPO_ROOT,
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

const ROOM_NUMBER = process.env.UAT6_ROOM_NUMBER || '16896';

(async () => {
  console.log('\n=== UAT 16 Test 6 D-06 precision ===\n');

  const jestRun = spawnSync(
    'npx',
    ['jest', 'src/modules/conferences/conference-spine.spec.ts', '-t', 'INT max', '--no-coverage'],
    {
      cwd: path.join(REPO_ROOT, 'packages', 'backend'),
      encoding: 'utf8',
      shell: true,
    },
  );
  const jestOut = `${jestRun.stdout || ''}\n${jestRun.stderr || ''}`;
  if (jestRun.status !== 0) {
    throw new Error(`jest INT max failed:\n${jestOut.slice(-2000)}`);
  }
  if (!/conf16896_2147483647/.test(jestOut) && !/PASS/.test(jestOut)) {
    throw new Error(`jest did not confirm INT max name:\n${jestOut.slice(-1500)}`);
  }
  console.log('  ✓ normalizeTarget(16896, 2147483647) → conf16896_2147483647');

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

  const room = await createRoom(token, ROOM_NUMBER, 'UAT 16 Test 6');
  const expected = `conf${ROOM_NUMBER}_${tenant}`;
  if (/e\+/i.test(expected) || /[, ]/.test(String(tenant))) {
    throw new Error(`tenant interpolation used scientific notation: ${expected}`);
  }
  console.log(`  ✓ live name ${expected} (tenant ${tenant} decimal)`);

  const ami = await connectAmi(env);
  const plan = await cmd(ami, `dialplan show s@krsk-conf-${room.uid}`);
  if (!plan.includes(`ConfBridge(${expected}`)) {
    throw new Error(`dialplan missing ConfBridge(${expected}):\n${plan}`);
  }
  if (/e\+/i.test(plan)) {
    throw new Error(`dialplan contains scientific notation:\n${plan}`);
  }
  console.log(`  ✓ published dialplan ConfBridge(${expected})`);

  await deleteRoom(token, room.uid);
  ami.disconnect();

  const out = writeResult('uat-test-6', {
    ok: true,
    intMax: 'conf16896_2147483647',
    liveConference: expected,
    roomUid: room.uid,
  });
  console.log(`\nPASS Test 6  ${out}\n`);
})().catch((e) => {
  console.error(`\n✗ ${e.message}\n`);
  process.exit(1);
});
