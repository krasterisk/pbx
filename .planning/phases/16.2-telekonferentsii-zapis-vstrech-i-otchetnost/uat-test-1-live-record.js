/**
 * Phase 16.2 UAT Test 1 — live ConfbridgeStartRecord writes one WAV
 * at {records_base_path}/{vpbx}/conferences/{room_uid}/{meeting_uid}.wav
 *
 * Uses leftover Phase 16 dialplan on the lab PBX (krsk-conf-8 → conf16897_348)
 * because remote Nest is still pre-16.2 and local Nest is not serving AMI.
 * AMI credentials come from repo .env; disk proof is via SSH.
 *
 *   node .planning/phases/16.2-telekonferentsii-zapis-vstrech-i-otchetnost/uat-test-1-live-record.js
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  loadEnv,
  sleep,
  waitFor,
  connectAmi,
  amiAction,
  cmd,
  hangupLocals,
  writeResult,
} = require('../16-modul-telekonferentsiy-confbridge-webrtc/uat-live-lib');

const SSH_KEY = process.env.UAT_SSH_KEY || path.join(os.homedir(), '.ssh', 'krasterisk_ipbx_agent');
const SSH_HOST = process.env.UAT_SSH_HOST || 'root@ipbx.krasterisk.ru';
const ROOM_CTX = process.env.UAT162_ROOM_CTX || 'krsk-conf-8';
const CONFERENCE = process.env.UAT162_CONFERENCE || 'conf16897_348';
const VPBX = Number(process.env.UAT162_VPBX || 348);
const ROOM_UID = Number(process.env.UAT162_ROOM_UID || 8);
const MEETING_UID = Number(process.env.UAT162_MEETING_UID || 900162001);
const RECORDS_BASE = '/usr/records';

function posixJoin(...parts) {
  return parts
    .map((p, i) => {
      const s = String(p).replace(/\\/g, '/');
      if (i === 0) return s.replace(/\/+$/, '');
      return s.replace(/^\/+|\/+$/g, '');
    })
    .filter(Boolean)
    .join('/');
}

function ssh(remoteCmd) {
  const args = [
    '-i',
    SSH_KEY,
    '-o',
    'IdentitiesOnly=yes',
    '-o',
    'StrictHostKeyChecking=accept-new',
    '-o',
    'ConnectTimeout=15',
    SSH_HOST,
    remoteCmd,
  ];
  const res = spawnSync('ssh', args, { encoding: 'utf8' });
  if (res.status !== 0) {
    throw new Error(`ssh failed (${res.status}): ${(res.stderr || res.stdout || '').trim()}`);
  }
  return (res.stdout || '').trim();
}

(async () => {
  const env = loadEnv();
  const rel = `${VPBX}/conferences/${ROOM_UID}/${MEETING_UID}.wav`;
  const recordFile = posixJoin(RECORDS_BASE, rel);
  const dir = posixJoin(RECORDS_BASE, String(VPBX), 'conferences', String(ROOM_UID));
  const report = {
    started: new Date().toISOString(),
    host: env.AMI_HOST,
    conference: CONFERENCE,
    roomCtx: ROOM_CTX,
    vpbx: VPBX,
    roomUid: ROOM_UID,
    meetingUid: MEETING_UID,
    recordFile,
    rel,
    startRecord: null,
    stopRecord: null,
    file: null,
    header: null,
    ok: false,
  };

  console.log(`\n=== UAT 16.2 Test 1 @ ${env.AMI_HOST} ===`);
  console.log(`  recordFile ${recordFile}`);

  if (path.sep === '\\' && recordFile.includes('\\')) {
    throw new Error('recordFile must stay POSIX; got backslash');
  }

  ssh(`mkdir -p ${dir} && chmod 755 ${dir} && rm -f ${recordFile}`);
  console.log(`  ✓ mkdir ${dir}`);

  const ami = await connectAmi(env);
  console.log('  ✓ AMI connected');

  const joined = [];
  const onEvt = (evt) => {
    const ev = String(evt?.event || evt?.Event || '');
    if (/^confbridge/i.test(ev)) {
      joined.push({
        event: ev,
        conference: evt.conference || evt.Conference,
        channel: evt.channel || evt.Channel,
      });
    }
  };
  ami.on('managerevent', onEvt);

  await hangupLocals(ami, CONFERENCE);
  await sleep(400);

  await amiAction(ami, {
    action: 'Originate',
    channel: `Local/s@${ROOM_CTX}`,
    application: 'Wait',
    data: '25',
    timeout: 15000,
    callerid: 'uat162 <16001>',
    async: 'true',
  });

  const list = await waitFor(
    `ConfBridge ${CONFERENCE} member`,
    async () => {
      const named = await cmd(ami, `confbridge list ${CONFERENCE}`);
      const all = await cmd(ami, 'confbridge list');
      const channels = await cmd(ami, 'core show channels concise');
      const hasMember =
        /Local\//i.test(named) ||
        new RegExp(`^${CONFERENCE}\\s+\\d+`, 'm').test(all) ||
        all.includes(CONFERENCE);
      return hasMember ? { named, all, channels } : null;
    },
    20000,
  );
  console.log(`  ✓ joined ${CONFERENCE}`);
  console.log(`    list: ${String(list.named).replace(/\s+/g, ' ').slice(0, 240)}`);

  await sleep(800);
  const start = await amiAction(ami, {
    action: 'ConfbridgeStartRecord',
    conference: CONFERENCE,
    recordFile,
  });
  report.startRecord = {
    response: start?.response || start?.Response,
    message: start?.message || start?.Message,
    output: start?.output || start?.Output || null,
  };
  const startOk = /success/i.test(String(report.startRecord.response || ''));
  if (!startOk && !/already recording/i.test(String(report.startRecord.message || ''))) {
    const all = await cmd(ami, 'confbridge list');
    const channels = await cmd(ami, 'core show channels concise');
    throw new Error(
      `StartRecord failed: ${JSON.stringify(report.startRecord)} list=${all.slice(0, 400)} ch=${channels.slice(0, 400)}`,
    );
  }
  console.log(`  ✓ ConfbridgeStartRecord ${report.startRecord.response}`);

  await waitFor(
    `WAV ${recordFile}`,
    () => {
      try {
        const stat = ssh(`if [ -f ${recordFile} ]; then stat -c '%s %F' ${recordFile}; else echo MISSING; fi`);
        if (stat && !/^MISSING/.test(stat)) {
          const size = Number(String(stat).split(/\s+/)[0]);
          return size > 0 ? stat : null;
        }
      } catch {
        /* retry */
      }
      return null;
    },
    15000,
  );

  await sleep(2500);
  const statAfter = ssh(`stat -c '%s %F %n' ${recordFile}`);
  const hex = ssh(`xxd -l 12 -p ${recordFile}`);
  report.file = { stat: statAfter, hex };
  report.header = hex;
  const size = Number(String(statAfter).split(/\s+/)[0]);
  const isRiff = /^52494646/i.test(hex) && /57415645/i.test(hex);
  if (size < 44 || !isRiff) {
    throw new Error(`not a growing WAV: ${statAfter} hex=${hex}`);
  }
  console.log(`  ✓ WAV ${statAfter} RIFF/WAVE`);

  const stop = await amiAction(ami, {
    action: 'ConfbridgeStopRecord',
    conference: CONFERENCE,
  });
  report.stopRecord = {
    response: stop?.response || stop?.Response,
    message: stop?.message || stop?.Message,
  };
  console.log(`  ✓ ConfbridgeStopRecord ${report.stopRecord.response}`);

  await hangupLocals(ami, CONFERENCE);
  ami.removeListener('managerevent', onEvt);
  ami.disconnect();

  const finalStat = ssh(`stat -c '%s %F' ${recordFile}`);
  const others = ssh(
    `find ${dir} -maxdepth 1 -type f -name '*.wav' | wc -l`,
  );
  report.file.finalStat = finalStat;
  report.file.wavCountInDir = Number(others);
  report.amiEvents = joined.slice(0, 8);
  if (Number(others) !== 1) {
    throw new Error(`expected exactly one wav in ${dir}, got ${others}`);
  }

  report.ok = true;
  report.finished = new Date().toISOString();
  const out = writeResult('uat-test-1-live-record', report);
  console.log(`\nPASS Test 1  ${recordFile}`);
  console.log(`  ${finalStat}`);
  console.log(`  ${out}\n`);
})().catch((e) => {
  console.error(`\n✗ ${e.message}\n`);
  try {
    const env = loadEnv();
    connectAmi(env)
      .then(async (ami) => {
        await hangupLocals(ami, CONFERENCE);
        ami.disconnect();
      })
      .catch(() => {});
  } catch {
    /* ignore */
  }
  process.exit(1);
});
