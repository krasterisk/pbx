/**
 * Spike 003, step 3 — a desk phone made of 300 lines.
 *
 * The question is what an SFU conference offers and sends to a participant that
 * has none of WebRTC's machinery: plain RTP/AVP, one port per stream, no ICE,
 * no DTLS, no BUNDLE. A real phone would answer that question with a picture;
 * this answers it with packet counts, which is what planning actually needs.
 *
 * It deliberately says yes to everything Asterisk offers — including every video
 * m-line added by a re-INVITE — because the interesting failure is Asterisk not
 * offering, not the phone refusing. A phone that refuses is the easy case.
 *
 * Run: node .planning/spikes/003-hybrid-web-and-sip-peer/sip-probe.js [exten] [seconds]
 */

const dgram = require('node:dgram');
const crypto = require('node:crypto');
const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const EXTEN = process.argv[2] || '9004';
const SECONDS = Number(process.argv[3] || 25);
const USER = 'spike003p';
const PASSWORD = 'Sp1ke003Secret';

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
const HOST = env.AMI_HOST;
const DOMAIN = env.SIP_DOMAIN || HOST;
const SIP_PORT = 5060;

const localIp = Object.values(os.networkInterfaces()).flat()
  .find((i) => i.family === 'IPv4' && !i.internal)?.address || '127.0.0.1';

const rand = (n = 10) => crypto.randomBytes(n).toString('hex');
const md5 = (s) => crypto.createHash('md5').update(s).digest('hex');

// --- SIP plumbing ----------------------------------------------------------

const sip = dgram.createSocket('udp4');
const callId = `${rand(8)}@spike003`;
const fromTag = rand(6);
let toTag = null;
let cseq = 1;
let auth = null;
let localSipPort = 0;

const trace = [];
const log = (...a) => console.log(...a);

function authHeader(method, uri) {
  if (!auth) return null;
  const ha1 = md5(`${USER}:${auth.realm}:${PASSWORD}`);
  const ha2 = md5(`${method}:${uri}`);
  if (auth.qop) {
    const cnonce = rand(8);
    const nc = '00000001';
    const resp = md5(`${ha1}:${auth.nonce}:${nc}:${cnonce}:${auth.qop}:${ha2}`);
    return `Digest username="${USER}", realm="${auth.realm}", nonce="${auth.nonce}", uri="${uri}", `
      + `response="${resp}", algorithm=MD5, qop=${auth.qop}, nc=${nc}, cnonce="${cnonce}"`;
  }
  return `Digest username="${USER}", realm="${auth.realm}", nonce="${auth.nonce}", uri="${uri}", `
    + `response="${md5(`${ha1}:${auth.nonce}:${ha2}`)}", algorithm=MD5`;
}

function send(msg) {
  trace.push({ dir: 'out', first: msg.split('\r\n')[0], bytes: msg.length });
  sip.send(Buffer.from(msg), SIP_PORT, HOST);
}

function request(method, uri, extra = [], body = '') {
  const a = authHeader(method, uri);
  const head = [
    `${method} ${uri} SIP/2.0`,
    `Via: SIP/2.0/UDP ${localIp}:${localSipPort};branch=z9hG4bK${rand(6)};rport`,
    'Max-Forwards: 70',
    `From: <sip:${USER}@${DOMAIN}>;tag=${fromTag}`,
    `To: <sip:${EXTEN}@${DOMAIN}>${toTag ? `;tag=${toTag}` : ''}`,
    `Call-ID: ${callId}`,
    `CSeq: ${cseq} ${method}`,
    `Contact: <sip:${USER}@${localIp}:${localSipPort}>`,
    'User-Agent: gsd-spike-probe',
    ...(a ? [`Authorization: ${a}`] : []),
    ...extra,
    `Content-Length: ${Buffer.byteLength(body)}`,
    '',
    body,
  ];
  send(head.join('\r\n'));
}

function parse(raw) {
  const [head, ...rest] = raw.split('\r\n\r\n');
  const lines = head.split('\r\n');
  const headers = {};
  for (const l of lines.slice(1)) {
    const i = l.indexOf(':');
    if (i > 0) {
      const k = l.slice(0, i).trim().toLowerCase();
      headers[k] = headers[k] ? `${headers[k]},${l.slice(i + 1).trim()}` : l.slice(i + 1).trim();
    }
  }
  return { start: lines[0], headers, body: rest.join('\r\n\r\n') };
}

// --- media -----------------------------------------------------------------

/** One socket per stream: classic SIP has no BUNDLE, every m-line gets its own port. */
const media = []; // { kind, socket, port, packets, bySsrc: Map, remote }
let nextPort = 40000 + Math.floor(Math.random() * 2000) * 2;

function openStream(kind) {
  return new Promise((resolve) => {
    const socket = dgram.createSocket('udp4');
    const port = nextPort;
    nextPort += 2;
    const entry = { kind, socket, port, packets: 0, bytes: 0, bySsrc: new Map(), firstAt: null };
    socket.on('message', (buf) => {
      if (buf.length < 12) return;
      const pt = buf[1] & 0x7f;
      const ssrc = buf.readUInt32BE(8);
      entry.packets += 1;
      entry.bytes += buf.length;
      entry.firstAt ??= Date.now();
      const key = `${ssrc}/pt${pt}`;
      entry.bySsrc.set(key, (entry.bySsrc.get(key) || 0) + 1);
    });
    socket.bind(port, () => { media.push(entry); resolve(entry); });
  });
}

// Declaring every video m-line sendrecv tells the SFU we are five cameras, not one
// camera and four screens. Only the first stream is ours.
const SENDRECV_VIDEO = process.env.PROBE_ALL_SENDRECV === '1';

function buildSdp(streams) {
  let videoSeen = 0;
  const lines = [
    'v=0',
    `o=- ${Date.now()} 1 IN IP4 ${localIp}`,
    's=gsd-spike-probe',
    `c=IN IP4 ${localIp}`,
    't=0 0',
  ];
  for (const s of streams) {
    if (s.kind === 'audio') {
      lines.push(`m=audio ${s.port} RTP/AVP 0 101`);
      lines.push('a=rtpmap:0 PCMU/8000');
      lines.push('a=rtpmap:101 telephone-event/8000');
      lines.push('a=sendrecv');
    } else {
      lines.push(`m=video ${s.port} RTP/AVP 96`);
      lines.push('a=rtpmap:96 VP8/90000');
      // The first video stream is ours. It stays sendrecv for a second reason too:
      // rtp_symmetric learns our NAT mapping only from packets we send.
      const mine = videoSeen++ === 0 || SENDRECV_VIDEO;
      lines.push(mine ? 'a=sendrecv' : 'a=recvonly');
    }
  }
  return `${lines.join('\r\n')}\r\n`;
}

/** Answers an offer by accepting every m-line, allocating ports as needed. */
async function answerOffer(offer) {
  const mLines = offer.split(/\r?\n/).filter((l) => l.startsWith('m='));
  const kinds = mLines.map((l) => l.split(' ')[0].slice(2));
  const wanted = { audio: 0, video: 0 };
  for (const k of kinds) wanted[k] = (wanted[k] || 0) + 1;

  while (media.filter((m) => m.kind === 'audio').length < wanted.audio) await openStream('audio');
  while (media.filter((m) => m.kind === 'video').length < (wanted.video || 0)) await openStream('video');

  const audio = media.filter((m) => m.kind === 'audio');
  const video = media.filter((m) => m.kind === 'video');
  let ai = 0; let vi = 0;
  const ordered = kinds.map((k) => (k === 'audio' ? audio[ai++] : video[vi++])).filter(Boolean);
  return { sdp: buildSdp(ordered), mLines: kinds };
}

function remoteMedia(sdp) {
  const host = (sdp.match(/^c=IN IP4 (\S+)/m) || [])[1] || HOST;
  return sdp.split(/\r?\n/).filter((l) => l.startsWith('m=')).map((l) => {
    const [m, port] = l.split(' ');
    return { kind: m.slice(2), port: Number(port), host };
  });
}

// --- audio keepalive: makes rtp_symmetric learn our NAT mapping ------------

const punchTimers = [];
/** Keeps a NAT pinhole open on a video port so Asterisk can reach us at all. */
function punch(entry, target) {
  if (!entry || !target?.port) return;
  entry.remote = target;
  const ssrc = crypto.randomBytes(4).readUInt32BE(0);
  let seq = 0; let ts = 0;
  const send = () => {
    const h = Buffer.alloc(12);
    h[0] = 0x80; h[1] = 96;
    h.writeUInt16BE(seq++ & 0xffff, 2);
    h.writeUInt32BE((ts += 3000) >>> 0, 4);
    h.writeUInt32BE(ssrc, 8);
    // Not a decodable frame — its only job is to be a packet from our address.
    entry.socket.send(Buffer.concat([h, Buffer.from([0x10, 0x00, 0x00])]), target.port, target.host);
  };
  send(); send();
  punchTimers.push(setInterval(send, 500));
}

let rtpTimer = null;
function startAudio(target) {
  const entry = media.find((m) => m.kind === 'audio');
  if (!entry || !target || !target.port) return;
  const ssrc = crypto.randomBytes(4).readUInt32BE(0);
  let seq = 0; let ts = 0;
  const payload = Buffer.alloc(160, 0xff); // PCMU silence
  rtpTimer = setInterval(() => {
    const h = Buffer.alloc(12);
    h[0] = 0x80; h[1] = 0x00;
    h.writeUInt16BE(seq++ & 0xffff, 2);
    h.writeUInt32BE((ts += 160) >>> 0, 4);
    h.writeUInt32BE(ssrc, 8);
    entry.socket.send(Buffer.concat([h, payload]), target.port, target.host);
  }, 20);
}

// --- flow ------------------------------------------------------------------

const offers = [];
let established = false;

sip.on('message', async (buf) => {
  const raw = buf.toString();
  const msg = parse(raw);
  trace.push({ dir: 'in', first: msg.start, bytes: raw.length });

  if (msg.start.startsWith('SIP/2.0')) {
    const code = Number(msg.start.split(' ')[1]);
    const to = msg.headers.to || '';
    const tag = (to.match(/tag=([^;]+)/) || [])[1];
    if (tag) toTag = tag;

    if (code === 401 || code === 407) {
      const ch = msg.headers['www-authenticate'] || msg.headers['proxy-authenticate'] || '';
      auth = {
        realm: (ch.match(/realm="([^"]+)"/) || [])[1],
        nonce: (ch.match(/nonce="([^"]+)"/) || [])[1],
        qop: (ch.match(/qop="?([^",]+)"?/) || [])[1],
      };
      log(`  <- ${code}, повторяю с digest (realm=${auth.realm})`);
      // ACK the failure response, then re-send with credentials on a new CSeq.
      ackTo(`sip:${EXTEN}@${DOMAIN}`, true);
      toTag = null;
      cseq += 1;
      sendInvite();
      return;
    }

    if (code >= 200 && code < 300 && /INVITE/.test(msg.headers.cseq || '')) {
      if (established) { log('  <- 200 OK (на наш re-INVITE)'); return; }
      established = true;
      const rm = remoteMedia(msg.body);
      log(`  <- 200 OK; m-lines в ответе: ${rm.map((r) => `${r.kind}:${r.port}`).join(', ')}`);
      offers.push({ at: 'answer', kinds: rm.map((r) => r.kind) });
      ackTo(`sip:${USER}@${HOST}`);
      startAudio(rm.find((r) => r.kind === 'audio' && r.port));
      rm.filter((r) => r.kind === 'video').forEach((r, i) => punch(media.filter((m) => m.kind === 'video')[i], r));
      return;
    }

    if (code >= 400) log(`  <- ${msg.start}`);
    return;
  }

  // Requests from Asterisk inside the dialog.
  const method = msg.start.split(' ')[0];
  if (method === 'INVITE') {
    const kinds = msg.body.split(/\r?\n/).filter((l) => l.startsWith('m=')).map((l) => l.split(' ')[0].slice(2));
    const video = kinds.filter((k) => k === 'video').length;
    log(`  <- re-INVITE: ${kinds.length} m-lines (video: ${video})`);
    offers.push({ at: 're-invite', kinds });
    const { sdp } = await answerOffer(msg.body);
    respond(msg, 200, sdp);
    remoteMedia(msg.body).filter((r) => r.kind === 'video')
      .forEach((r, i) => punch(media.filter((m) => m.kind === 'video')[i], r));
    return;
  }
  if (method === 'BYE') {
    log('  <- BYE от Asterisk');
    respond(msg, 200);
    finish();
    return;
  }
  if (method === 'OPTIONS') respond(msg, 200);
});

function respond(msg, code, body = '') {
  const reason = { 200: 'OK', 488: 'Not Acceptable Here' }[code] || 'OK';
  const head = [
    `SIP/2.0 ${code} ${reason}`,
    `Via: ${msg.headers.via}`,
    `From: ${msg.headers.from}`,
    `To: ${msg.headers.to}${/tag=/.test(msg.headers.to) ? '' : `;tag=${fromTag}`}`,
    `Call-ID: ${msg.headers['call-id']}`,
    `CSeq: ${msg.headers.cseq}`,
    `Contact: <sip:${USER}@${localIp}:${localSipPort}>`,
    ...(body ? ['Content-Type: application/sdp'] : []),
    `Content-Length: ${Buffer.byteLength(body)}`,
    '',
    body,
  ];
  send(head.join('\r\n'));
}

function ackTo(uri, forFailure = false) {
  const head = [
    `ACK ${uri} SIP/2.0`,
    `Via: SIP/2.0/UDP ${localIp}:${localSipPort};branch=z9hG4bK${rand(6)};rport`,
    'Max-Forwards: 70',
    `From: <sip:${USER}@${DOMAIN}>;tag=${fromTag}`,
    `To: <sip:${EXTEN}@${DOMAIN}>${toTag ? `;tag=${toTag}` : ''}`,
    `Call-ID: ${callId}`,
    `CSeq: ${cseq} ACK`,
    'Content-Length: 0',
    '',
    '',
  ];
  send(head.join('\r\n'));
  if (forFailure) return;
}

function sendInvite() {
  const streams = media.filter((m) => m.kind === 'audio' || m.kind === 'video');
  request('INVITE', `sip:${EXTEN}@${DOMAIN}`, ['Content-Type: application/sdp'], buildSdp(streams));
}

function finish() {
  if (rtpTimer) clearInterval(rtpTimer);
  punchTimers.forEach(clearInterval);
  const report = {
    exten: EXTEN,
    endpoint: USER,
    localIp,
    established,
    offers,
    streams: media.map((m) => ({
      kind: m.kind,
      port: m.port,
      packets: m.packets,
      bytes: m.bytes,
      sources: Object.fromEntries(m.bySsrc),
    })),
    sip: trace,
  };
  const dir = path.join(__dirname, 'results');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `sip-probe-${EXTEN}-${Date.now()}.json`);
  fs.writeFileSync(file, JSON.stringify(report, null, 2));

  console.log('\n=== что пришло на провод ===');
  for (const m of report.streams) {
    const src = Object.entries(m.sources).map(([k, v]) => `${k}:${v}`).join(' ') || '—';
    console.log(`  ${m.kind.padEnd(5)} порт ${m.port}  пакетов ${String(m.packets).padStart(5)}  источники: ${src}`);
  }
  console.log(`\nотчёт: ${path.relative(REPO_ROOT, file)}\n`);
  process.exit(0);
}

(async () => {
  await openStream('audio');
  await openStream('video');

  sip.bind(0, async () => {
    localSipPort = sip.address().port;
    console.log(`\n=== SIP-зонд ${USER} → ${EXTEN}@${DOMAIN} (${localIp}:${localSipPort}) ===\n`);
    sendInvite();

    setTimeout(() => {
      if (!established) { console.log('\n! сессия не установилась'); return finish(); }
      console.log('\n  -> BYE');
      cseq += 1;
      request('BYE', `sip:${USER}@${HOST}`);
      setTimeout(finish, 1000);
    }, SECONDS * 1000);
  });
})();
