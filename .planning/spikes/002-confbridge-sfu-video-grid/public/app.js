/* Spike 002 — browser participant for a ConfBridge SFU room.
 *
 * The question this file exists to answer: can sip.js 0.21.2 (the version already
 * shipping in Phase 10) carry MULTIPLE inbound video streams, so the room renders
 * as a grid instead of a single active speaker?
 *
 * Two things are known from reading the sip.js source and had to be worked around:
 *
 *  1. Asterisk will not grow the session later — every video m-line the SFU may
 *     ever need must be in our very first offer. So extra recvonly video
 *     transceivers are added to the peer connection before sip.js builds the offer.
 *     sip.js reuses the first free one for the camera (addTrack promotes a recvonly
 *     transceiver to sendrecv) and leaves the rest alone.
 *
 *  2. sip.js aggregates inbound media into a single remoteMediaStream and, in
 *     setRemoteTrack(), STOPS and drops any previous video track when a new one
 *     arrives. That stream can therefore never hold a grid. Rendering here reads
 *     tracks straight off the ontrack event instead.
 */

const { UserAgent, Registerer, Inviter, Web } = SIP;

const params = new URLSearchParams(location.search);
const USER = params.get('user') || 'spike002a';
// 1 slot for our own camera + N inbound. Bundled pjproject caps total streams at 16.
const VIDEO_SLOTS = Number(params.get('slots') || 6);
const FAKE = params.get('fake') === '1';
const HEAVY = params.get('heavy') === '1';
const VIDEO_CODEC = (params.get('codec') || 'VP8').toUpperCase();
// 'none' keeps the browser's full codec list — kept as a switch because that is what
// produced the 37 KB INVITE that PJSIP silently discarded
const TRIM_CODECS = params.get('trim') !== '0';

const $ = (id) => document.getElementById(id);
const events = [];

// --- wire tap ---------------------------------------------------------------
// Client state and server state disagreed (sip.js reported Registered while Asterisk
// had no contact), so the SIP messages themselves are captured rather than trusted.
const sipTrace = [];
window.__sipTrace = sipTrace;
const NativeWebSocket = window.WebSocket;
window.WebSocket = function (...args) {
  const ws = new NativeWebSocket(...args);
  const record = (dir, data) => {
    if (typeof data !== 'string') return;
    sipTrace.push({ t: new Date().toISOString(), dir, first: data.split('\r\n')[0], raw: data });
  };
  const send = ws.send.bind(ws);
  ws.send = (data) => { record('out', data); return send(data); };
  ws.addEventListener('message', (e) => record('in', e.data));
  return ws;
};
window.WebSocket.prototype = NativeWebSocket.prototype;
let ua, registerer, session, cfg, localStream;
const tiles = new Map(); // mid → { el, video }

// --- forensic log ----------------------------------------------------------

function log(category, message, data) {
  const entry = { t: new Date().toISOString(), category, message, ...(data ? { data } : {}) };
  events.push(entry);
  const line = document.createElement('div');
  line.className = `log-${category}`;
  line.textContent = `${entry.t.slice(11, 23)} [${category}] ${message}`;
  $('log').appendChild(line);
  $('log').scrollTop = $('log').scrollHeight;
}

function setState(s) { $('state').textContent = s; }

$('export').onclick = async () => {
  const pc = session?.sessionDescriptionHandler?.peerConnection;
  const payload = {
    user: USER,
    videoSlots: VIDEO_SLOTS,
    exportedAt: new Date().toISOString(),
    summary: {
      events: events.length,
      videoTilesRendered: tiles.size,
      transceivers: pc ? pc.getTransceivers().map((t) => ({
        mid: t.mid, kind: t.receiver.track?.kind, direction: t.direction,
        currentDirection: t.currentDirection, trackId: t.receiver.track?.id,
        trackMuted: t.receiver.track?.muted,
      })) : null,
    },
    sdp: pc ? {
      localMLines: (pc.localDescription?.sdp.match(/^m=/gm) || []).length,
      remoteMLines: (pc.remoteDescription?.sdp.match(/^m=/gm) || []).length,
      local: pc.localDescription?.sdp,
      remote: pc.remoteDescription?.sdp,
    } : null,
    events,
    sipTrace,
  };
  const res = await fetch('/log', { method: 'POST', body: JSON.stringify(payload, null, 2) });
  const { saved } = await res.json();
  log('ui', `лог сохранён на сервере: results/${saved}`);
};

// --- video grid ------------------------------------------------------------

function addTile(mid, track) {
  if (tiles.has(mid)) {
    tiles.get(mid).video.srcObject = new MediaStream([track]);
    return;
  }
  const el = document.createElement('div');
  el.className = 'tile';
  const video = document.createElement('video');
  video.autoplay = true; video.playsInline = true;
  video.srcObject = new MediaStream([track]);
  const label = document.createElement('span');
  label.className = 'label';
  label.textContent = `удалённый · m-line ${mid}`;
  el.append(video, label);
  $('grid').appendChild(el);
  tiles.set(mid, { el, video });
  log('rtc', `видеоплитка добавлена: mid=${mid} track=${track.id.slice(0, 8)}`);
}

function refreshDiagnostics() {
  const pc = session?.sessionDescriptionHandler?.peerConnection;
  const tbody = $('diagTable').querySelector('tbody');
  if (!pc) { tbody.innerHTML = ''; return; }
  tbody.innerHTML = '';
  for (const t of pc.getTransceivers()) {
    const kind = t.receiver.track?.kind || '—';
    const live = t.currentDirection && t.currentDirection !== 'inactive';
    const row = document.createElement('tr');
    row.innerHTML = `<td>${t.mid ?? '—'}</td><td>${kind}</td><td>${t.direction}</td>` +
      `<td class="${live ? 'live' : 'idle'}">${t.currentDirection || '—'}</td>` +
      `<td class="${t.receiver.track && !t.receiver.track.muted ? 'live' : 'idle'}">` +
      `${t.receiver.track ? (t.receiver.track.muted ? 'muted' : 'flowing') : '—'}</td>`;
    tbody.appendChild(row);
  }
}
setInterval(refreshDiagnostics, 1000);

// --- media source ----------------------------------------------------------

/**
 * Synthetic participant: a canvas that paints this user's name and a running clock,
 * plus a quiet tone. Lets the grid be tested with more tabs than the machine has
 * cameras, and gives every tile a visually distinct picture.
 */
function makeSyntheticStream() {
  const canvas = Object.assign(document.createElement('canvas'), { width: 640, height: 480 });
  const ctx = canvas.getContext('2d');
  const hue = [...USER].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  setInterval(() => {
    ctx.fillStyle = `hsl(${hue} 55% 22%)`;
    ctx.fillRect(0, 0, 640, 480);
    // A near-static picture compresses to almost nothing, which makes capacity
    // measurements flattering. HEAVY sprays changing detail so the encoder has to
    // spend a camera-like bitrate.
    if (HEAVY) {
      for (let i = 0; i < 400; i++) {
        ctx.fillStyle = `hsl(${Math.random() * 360} 70% ${20 + Math.random() * 60}%)`;
        ctx.fillRect(Math.random() * 640, Math.random() * 480, 24, 24);
      }
    }
    ctx.fillStyle = `hsl(${hue} 80% 70%)`;
    ctx.font = 'bold 54px system-ui';
    ctx.fillText(USER, 40, 220);
    ctx.font = '40px ui-monospace, monospace';
    ctx.fillText(new Date().toISOString().slice(11, 23), 40, 300);
  }, HEAVY ? 33 : 100);

  const stream = canvas.captureStream(HEAVY ? 30 : 15);
  const audioCtx = new AudioContext();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  gain.gain.value = 0.02;
  osc.frequency.value = 220 + (hue % 200);
  osc.connect(gain);
  const dest = audioCtx.createMediaStreamDestination();
  gain.connect(dest);
  osc.start();
  stream.addTrack(dest.stream.getAudioTracks()[0]);
  log('ui', 'источник медиа: синтетический (канва + тон)');
  return stream;
}

function mediaStreamFactory(constraints) {
  if (FAKE) return Promise.resolve(makeSyntheticStream());
  return navigator.mediaDevices.getUserMedia(constraints).catch((e) => {
    log('err', `getUserMedia не сработал (${e.name}), падаю на синтетический источник`);
    return makeSyntheticStream();
  });
}

// --- session description handler: the multi-stream offer -------------------

function sdhFactory(sess, options) {
  const sdh = Web.defaultSessionDescriptionHandlerFactory(mediaStreamFactory)(sess, options);
  const pc = sdh.peerConnection;
  window.__pc = pc; // diagnostics hook

  // sip.js keeps exactly one remote video track: every ontrack calls stop() on the
  // previous one (session-description-handler.js:592-601), and it runs before the
  // delegate. With an SFU that kills every tile but the newest. We render straight
  // from the transceivers, so remoteMediaStream is dead weight — neutralise it.
  sdh.setRemoteTrack = function (track) {
    if (!this._remoteMediaStream.getTrackById(track.id)) this._remoteMediaStream.addTrack(track);
  };

  // recvonly, not sendrecv: addTrack only reuses a transceiver whose direction is
  // recvonly/inactive, so this is what lets sip.js put the camera on the first one.
  const audio = pc.addTransceiver('audio', { direction: 'recvonly' });
  const videos = [];
  for (let i = 0; i < VIDEO_SLOTS; i++) videos.push(pc.addTransceiver('video', { direction: 'recvonly' }));

  // Every video m-line repeats the browser's whole codec list. Six of them produced a
  // 37 KB INVITE, which PJSIP dropped without a word — no response, no channel, no event.
  // Narrowing each m-line to one codec is what keeps the offer inside the SIP message limit.
  if (TRIM_CODECS && RTCRtpReceiver.getCapabilities) {
    const pick = (kind, re) => (RTCRtpReceiver.getCapabilities(kind)?.codecs || [])
      .filter((c) => re.test(c.mimeType));
    const videoCodecs = pick('video', new RegExp(`/(${VIDEO_CODEC}|rtx)$`, 'i'));
    const audioCodecs = pick('audio', /\/(opus|PCMU|telephone-event)$/i);
    try {
      videos.forEach((t) => t.setCodecPreferences(videoCodecs));
      audio.setCodecPreferences(audioCodecs);
      log('rtc', `кодеки сужены: video=${VIDEO_CODEC}(+rtx), audio=opus/PCMU`);
    } catch (e) {
      log('err', `setCodecPreferences не сработал: ${e.message}`);
    }
  }
  log('rtc', `подготовлено m-lines: 1 audio + ${VIDEO_SLOTS} video (все recvonly до attach камеры)`);

  sdh.peerConnectionDelegate = {
    ontrack: (e) => {
      const mid = e.transceiver.mid ?? '?';
      log('rtc', `ontrack ${e.track.kind} mid=${mid} muted=${e.track.muted}`);
      if (e.track.kind === 'video') {
        addTile(mid, e.track);
        e.track.onunmute = () => log('rtc', `видео пошло: mid=${mid}`);
        e.track.onmute = () => log('rtc', `видео замолчало: mid=${mid}`);
      } else {
        $('remoteAudio').srcObject = new MediaStream([e.track]);
      }
    },
    oniceconnectionstatechange: () => log('rtc', `ICE: ${pc.iceConnectionState}`),
    onconnectionstatechange: () => log('rtc', `PC: ${pc.connectionState}`),
  };
  return sdh;
}

// --- join / leave ----------------------------------------------------------

async function join() {
  $('join').disabled = true;
  cfg = await fetch('/config').then((r) => r.json());
  log('ui', `подключаюсь как ${USER} → ${cfg.wss}`);

  ua = new UserAgent({
    uri: UserAgent.makeURI(`sip:${USER}@${cfg.domain}`),
    transportOptions: { server: cfg.wss },
    authorizationUsername: USER,
    authorizationPassword: cfg.password,
    sessionDescriptionHandlerFactory: sdhFactory,
    sessionDescriptionHandlerFactoryOptions: {
      // "balanced" (the browser default) makes Chrome offer only one audio + one
      // video track — fatal for a grid. max-bundle is mandatory here.
      peerConnectionConfiguration: { bundlePolicy: 'max-bundle', iceServers: [] },
    },
    logLevel: 'warn',
  });

  await ua.start();
  log('sip', 'transport connected');

  registerer = new Registerer(ua);
  registerer.stateChange.addListener((s) => log('sip', `registerer: ${s}`));
  // register() resolves when the request is SENT, not when it is accepted — inviting
  // on that promise fires the INVITE before Asterisk has a contact for us
  await new Promise((resolve, reject) => {
    registerer.stateChange.addListener((s) => { if (s === 'Registered') resolve(); });
    registerer.register({
      requestDelegate: {
        onReject: (r) => reject(new Error(`REGISTER отклонён: ${r.message.statusCode} ${r.message.reasonPhrase}`)),
      },
    }).catch(reject);
    setTimeout(() => reject(new Error('REGISTER: нет ответа за 10s')), 10000);
  });
  log('sip', 'регистрация подтверждена сервером');

  cfg.target = params.get('target') || cfg.target;
  const target = UserAgent.makeURI(`sip:${cfg.target}@${cfg.domain}`);
  session = new Inviter(ua, target, {
    sessionDescriptionHandlerOptions: { constraints: { audio: true, video: true } },
  });

  session.stateChange.addListener((s) => {
    log('sip', `session: ${s}`);
    setState(s);
    if (s === 'Established') {
      const pc = session.sessionDescriptionHandler.peerConnection;
      const localM = (pc.localDescription?.sdp.match(/^m=/gm) || []).length;
      const remoteM = (pc.remoteDescription?.sdp.match(/^m=/gm) || []).length;
      log('sip', `m-lines: offer=${localM}, answer=${remoteM}`);
      const sender = pc.getSenders().find((x) => x.track?.kind === 'video');
      if (sender) {
        if (HEAVY) {
          const p = sender.getParameters();
          p.encodings = [{ ...(p.encodings?.[0] || {}), maxBitrate: 800_000, maxFramerate: 30 }];
          sender.setParameters(p).then(() => log('rtc', 'поток нагружен: до 800 кбит/с, 30 к/с'))
            .catch((e) => log('err', `setParameters: ${e.message}`));
        }
        localStream = new MediaStream([sender.track]);
        $('localVideo').srcObject = localStream;
      }
      $('leave').disabled = false;
      $('cam').disabled = false;
    }
    if (s === 'Terminated') {
      $('join').disabled = false; $('leave').disabled = true; $('cam').disabled = true;
    }
  });

  await session.invite({
    requestDelegate: {
      onProgress: (r) => log('sip', `${r.message.statusCode} ${r.message.reasonPhrase}`),
      onAccept: (r) => log('sip', `${r.message.statusCode} ${r.message.reasonPhrase}`),
      onRedirect: (r) => log('err', `${r.message.statusCode} ${r.message.reasonPhrase}`),
      onReject: (r) => log('err', `отказ: ${r.message.statusCode} ${r.message.reasonPhrase}`),
      onTrying: (r) => log('sip', `${r.message.statusCode} ${r.message.reasonPhrase}`),
    },
  });
  const invite = sipTrace.find((x) => x.first.startsWith('INVITE'));
  if (invite) {
    const size = invite.raw.length;
    // measured on this build: ~10.5 KB accepted, ~37 KB silently discarded by PJSIP
    log(size > 16000 ? 'err' : 'sip', `INVITE отправлен, размер ${size} байт`);
  }
}

$('join').onclick = () => join().catch((e) => { log('err', e.message); $('join').disabled = false; });
$('leave').onclick = async () => {
  try { await session?.bye(); } catch (e) { log('err', e.message); }
  try { await registerer?.unregister(); await ua?.stop(); } catch { /* ignore */ }
  tiles.forEach(({ el }) => el.remove()); tiles.clear();
};
$('cam').onclick = () => {
  const track = localStream?.getVideoTracks()[0];
  if (!track) return;
  track.enabled = !track.enabled;
  $('cam').textContent = track.enabled ? 'Выключить камеру' : 'Включить камеру';
  log('ui', `камера ${track.enabled ? 'включена' : 'выключена'}`);
};

// Closing or reloading the tab kills the socket without a BYE, and Asterisk keeps the
// channel in the conference — dead members hold SFU slots and starve live participants.
window.addEventListener('pagehide', () => { try { session?.bye(); } catch { /* best effort */ } });

$('who').textContent = USER;
log('ui', `клиент готов, слотов под видео: ${VIDEO_SLOTS}`);
