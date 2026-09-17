/**
 * Phase 16 UAT Test 7 — D-25 codec order.
 *
 * After G-16-1, allow= is not a valid type=bridge option and is not written
 * to krsk_conf_sfu. Order is locked on CONFERENCE_PLATFORM_CODECS.
 *
 *   BACKEND_UAT_PORT=5010 node .../uat-test-7-allow-order.js
 */
const fs = require('fs');
const path = require('path');
const {
  REPO_ROOT,
  loadEnv,
  connectAmi,
  amiAction,
  cmd,
  writeResult,
} = require('./uat-live-lib');

(async () => {
  console.log('\n=== UAT 16 Test 7 D-25 codec order ===\n');

  const src = fs.readFileSync(
    path.join(REPO_ROOT, 'packages', 'backend', 'src', 'modules', 'conferences', 'conference-dialplan.util.ts'),
    'utf8',
  );
  const match = src.match(
    /export const CONFERENCE_PLATFORM_CODECS:\s*string\[\]\s*=\s*\[([^\]]+)\]/,
  );
  if (!match) throw new Error('CONFERENCE_PLATFORM_CODECS literal not found');
  const codecs = match[1]
    .split(',')
    .map((item) => item.replace(/['"\s]/g, ''))
    .filter(Boolean);
  if (codecs.join(',') !== 'opus,ulaw,vp8') {
    throw new Error(`codec order drifted: ${codecs.join(',')}`);
  }
  console.log('  ✓ CONFERENCE_PLATFORM_CODECS = opus,ulaw,vp8');

  const profileSrc = fs.readFileSync(
    path.join(
      REPO_ROOT,
      'packages',
      'backend',
      'src',
      'modules',
      'conferences',
      'confbridge-static-profile.service.ts',
    ),
    'utf8',
  );
  if (!/BRIDGE_PROFILE_LINES[\s\S]*type=bridge[\s\S]*video_mode=sfu[\s\S]*enable_events=yes/.test(profileSrc)) {
    throw new Error('static profile lines drifted');
  }
  if (/BRIDGE_PROFILE_LINES[\s\S]{0,200}allow=/.test(profileSrc)) {
    throw new Error('static profile still writes allow= (invalid on type=bridge)');
  }
  console.log('  ✓ bootstrap writes type/video_mode/enable_events, not allow=');

  const env = loadEnv();
  const ami = await connectAmi(env);
  const cli = await cmd(ami, 'confbridge show profile bridge krsk_conf_sfu');
  if (/no conference bridge profile named/i.test(cli)) {
    throw new Error(`profile missing:\n${cli}`);
  }
  if (/allow\s*=/.test(cli.toLowerCase())) {
    throw new Error(`CLI still shows allow= on bridge profile:\n${cli}`);
  }
  if (!/sfu/i.test(cli)) {
    throw new Error(`CLI missing video_mode=sfu:\n${cli}`);
  }
  console.log('  ✓ live krsk_conf_sfu loaded, no allow=, video sfu');

  const cfg = await amiAction(ami, { action: 'GetConfig', filename: 'confbridge.conf' });
  const dumped = JSON.stringify(cfg).toLowerCase();
  if (/allow\s*=/.test(dumped) && /krsk_conf_sfu/.test(dumped)) {
    const around = dumped.slice(
      Math.max(0, dumped.indexOf('krsk_conf_sfu') - 80),
      dumped.indexOf('krsk_conf_sfu') + 200,
    );
    if (/allow\s*=/.test(around)) {
      throw new Error(`GetConfig still has allow= near krsk_conf_sfu: ${around}`);
    }
  }
  console.log('  ✓ on-disk category has no stale allow=');
  ami.disconnect();

  const out = writeResult('uat-test-7', {
    ok: true,
    codecs,
    profileHasAllow: false,
    note: 'D-25 order lives on CONFERENCE_PLATFORM_CODECS; allow= is invalid on type=bridge (G-16-1)',
  });
  console.log(`\nPASS Test 7  ${out}\n`);
})().catch((e) => {
  console.error(`\n✗ ${e.message}\n`);
  process.exit(1);
});
