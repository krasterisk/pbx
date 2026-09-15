/**
 * Spike 004, step 2 — push the room until something bends.
 *
 * Browser tabs are the honest participant but the wrong load generator: each one
 * costs a VP8 encoder on this machine, so the laptop saturates before the server
 * does. The SIP probe is the opposite — it receives and counts, costing almost
 * nothing locally, while making the server do the expensive half: forwarding a
 * copy of every sender's video to every receiver.
 *
 * K probes against S senders = K*S forwarded video streams plus K audio transcodes.
 *
 * Run: node .planning/spikes/004-room-capacity/load.js <probes> <seconds>
 */

const { spawn } = require('node:child_process');
const path = require('node:path');

const PROBES = Number(process.argv[2] || 6);
const SECONDS = Number(process.argv[3] || 40);
const PROBE = path.join(__dirname, '..', '003-hybrid-web-and-sip-peer', 'sip-probe.js');
const MEASURE = path.join(__dirname, 'measure.js');

const run = (script, args) => new Promise((resolve) => {
  const child = spawn(process.execPath, [script, ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '';
  child.stdout.on('data', (d) => { out += d; });
  child.stderr.on('data', (d) => { out += d; });
  child.on('close', (code) => resolve({ code, out }));
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  console.log(`\n=== нагрузка: ${PROBES} зондов на ${SECONDS} c ===\n`);

  const probes = [];
  for (let i = 0; i < PROBES; i++) {
    probes.push(run(PROBE, ['9004', String(SECONDS)]));
    await sleep(700); // staggered: a thundering herd of INVITEs measures the wrong thing
  }

  await sleep(8000);
  console.log((await run(MEASURE, [`load-${PROBES}probes`])).out);
  await sleep(Math.max(0, SECONDS * 1000 - 20000));
  console.log((await run(MEASURE, [`load-${PROBES}probes-late`])).out);

  const results = await Promise.all(probes);

  let withVideo = 0; let totalStreams = 0; let totalPackets = 0;
  for (const r of results) {
    const lines = r.out.split('\n').filter((l) => /^\s+video\s+порт/.test(l));
    const active = lines.filter((l) => !/пакетов\s+0\s/.test(l));
    if (active.length) withVideo += 1;
    totalStreams += active.length;
    for (const l of active) totalPackets += Number((l.match(/пакетов\s+(\d+)/) || [])[1] || 0);
  }

  console.log('=== итог нагрузки ===');
  console.log(`  зондов:                 ${PROBES}`);
  console.log(`  получили хоть какое-то видео: ${withVideo}`);
  console.log(`  живых видеопотоков:     ${totalStreams}`);
  console.log(`  видеопакетов принято:   ${totalPackets}\n`);

  console.log((await run(MEASURE, ['after-load'])).out);
  process.exit(0);
})();
