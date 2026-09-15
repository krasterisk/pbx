/**
 * Spike 004, step 1 — one labelled measurement of the live server.
 *
 * D-19 asks what to compute a room's remaining capacity from. Before any number
 * can be trusted, the readings themselves have to be chosen: this collects the
 * candidates in one shot so consecutive runs can be differenced.
 *
 * Deliberately records both sides of the same moment:
 *   - what the box has left (RAM, swap)
 *   - what Asterisk is struggling with (taskprocessor backlog and latency)
 *   - what the media plane actually carries (channels, streams, per-channel RTP)
 *
 * Run: node .planning/spikes/004-room-capacity/measure.js <label>
 */

const fs = require('fs');
const path = require('path');
const AsteriskManager = require('asterisk-manager');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const LABEL = process.argv[2] || 'unlabelled';

function loadEnv() {
  const raw = fs.readFileSync(path.join(REPO_ROOT, '.env'), 'utf8');
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return env;
}
const env = loadEnv();

function connectAmi() {
  return new Promise((resolve, reject) => {
    const ami = new AsteriskManager(Number(env.AMI_PORT), env.AMI_HOST, env.AMI_LOGIN, env.AMI_SECRET, false);
    const timer = setTimeout(() => reject(new Error('AMI connect timeout')), 10000);
    ami.on('connect', () => { clearTimeout(timer); resolve(ami); });
    ami.on('error', (e) => { clearTimeout(timer); reject(e); });
  });
}

function amiAction(ami, action) {
  return new Promise((resolve, reject) => {
    ami.action(action, (err, res) => {
      if (err && err.response !== 'Success') return reject(new Error(err.message || JSON.stringify(err)));
      resolve(err && err.response === 'Success' ? err : res);
    });
  });
}

const norm = (r) => {
  const out = r?.output ?? r?.content ?? r?.message ?? r;
  return Array.isArray(out) ? out.join('\n') : String(out ?? '');
};
const cmd = async (ami, command) => norm(await amiAction(ami, { action: 'Command', command }));

const num = (text, re) => Number((text.match(re) || [])[1] || 0);

/** Taskprocessor backlog is Asterisk's own distress signal, ahead of any RAM number. */
function parseTaskprocessors(text) {
  let queued = 0; let maxDepth = 0; let busy = 0; let worstLatency = 0; let worst = null;
  for (const line of text.split('\n')) {
    const m = line.match(/^(\S+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*$/);
    if (!m) continue;
    const [, name, , inQueue, depth, , , , highTime] = m;
    queued += Number(inQueue);
    if (Number(inQueue) > 0) busy += 1;
    if (Number(depth) > maxDepth) maxDepth = Number(depth);
    if (Number(highTime) > worstLatency) { worstLatency = Number(highTime); worst = name; }
  }
  return { queued, maxDepth, busyProcessors: busy, worstLatencyUs: worstLatency, worstProcessor: worst };
}

/** Per-channel RTP as the server sees it — the browser only knows its own end. */
function parseChannelStats(text) {
  const rows = [];
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*(\S+\/\S+)\s+(\S+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+\.?\d*)\s+(\d+\.?\d*)\s+(\d+)\s+(\d+)\s+(\d+\.?\d*)\s+(\d+\.?\d*)/);
    if (!m) continue;
    rows.push({
      channel: m[1],
      rxCount: Number(m[3]), rxLost: Number(m[5]), rxJitter: Number(m[6]),
      txCount: Number(m[8]), txLost: Number(m[9]),
    });
  }
  return rows;
}

(async () => {
  const ami = await connectAmi();

  const [sysinfo, taskproc, channels, stats, confbridges] = await Promise.all([
    cmd(ami, 'core show sysinfo'),
    cmd(ami, 'core show taskprocessors'),
    cmd(ami, 'core show channels'),
    cmd(ami, 'pjsip show channelstats'),
    cmd(ami, 'confbridge list'),
  ]);
  ami.disconnect();

  const channelRows = channels.split('\n').filter((l) => /^(PJSIP|CBAnn)\//.test(l.trim()));
  const snapshot = {
    label: LABEL,
    at: new Date().toISOString(),
    memory: {
      freeRamKiB: num(sysinfo, /Free RAM:\s+(\d+)/),
      bufferRamKiB: num(sysinfo, /Buffer RAM:\s+(\d+)/),
      freeSwapKiB: num(sysinfo, /Free Swap Space:\s+(\d+)/),
      totalRamKiB: num(sysinfo, /Total RAM:\s+(\d+)/),
      processes: num(sysinfo, /Number of Processes:\s+(\d+)/),
    },
    load: parseTaskprocessors(taskproc),
    channels: {
      total: num(channels, /(\d+) active channels/),
      calls: num(channels, /(\d+) active calls/),
      pjsip: channelRows.filter((l) => l.startsWith('PJSIP/')).length,
      announcers: channelRows.filter((l) => l.startsWith('CBAnn/')).length,
    },
    rtp: parseChannelStats(stats),
    confbridgeRaw: confbridges.trim(),
  };

  const dir = path.join(__dirname, 'results');
  fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(path.join(dir, 'measurements.jsonl'), `${JSON.stringify(snapshot)}\n`);

  const m = snapshot.memory;
  const l = snapshot.load;
  console.log(`\n[${LABEL}]`);
  console.log(`  RAM свободно   ${(m.freeRamKiB / 1024).toFixed(0)} МиБ (+буфер ${(m.bufferRamKiB / 1024).toFixed(0)}), swap свободно ${(m.freeSwapKiB / 1024).toFixed(0)} МиБ`);
  console.log(`  каналы         ${snapshot.channels.pjsip} PJSIP + ${snapshot.channels.announcers} объявлений, звонков ${snapshot.channels.calls}`);
  console.log(`  очереди        в очереди ${l.queued}, пик глубины ${l.maxDepth}, занятых обработчиков ${l.busyProcessors}`);
  console.log(`  худшая задержка ${(l.worstLatencyUs / 1000).toFixed(0)} мс (${l.worstProcessor})`);
  if (snapshot.rtp.length) {
    const lost = snapshot.rtp.reduce((s, r) => s + r.rxLost + r.txLost, 0);
    console.log(`  RTP            потоков ${snapshot.rtp.length}, суммарно потеряно ${lost}`);
  }
  console.log();
  process.exit(0);
})().catch((e) => { console.error(`\n! ${e.message}\n`); process.exit(1); });
