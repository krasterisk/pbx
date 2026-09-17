const http = require('http');
const fs = require('fs');
const path = require('path');
const {
  loadEnv,
  loadJwt,
  tokenFor,
  requestJson,
} = require('../16-modul-telekonferentsiy-confbridge-webrtc/uat-live-lib');

const ROOM = 14;
const MEETING = 1;
const UNIQUEID = process.env.UAT162_UNIQUEID || 'uat162play.1789555415164';
const PORT = 5010;

function requestRange(urlPath, token) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port: PORT,
        path: urlPath,
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          Range: 'bytes=0-1',
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          resolve({
            status: res.statusCode,
            type: res.headers['content-type'],
            range: res.headers['content-range'],
            length: res.headers['content-length'],
            bytes: Buffer.concat(chunks).length,
          });
        });
      },
    );
    req.on('error', reject);
    req.setTimeout(15000, () => req.destroy(new Error('timeout play')));
    req.end();
  });
}

(async () => {
  const env = loadEnv();
  const jwt = loadJwt();
  const token = tokenFor(
    jwt,
    { uniqueid: 58, login: 'admin', name: 'admin', level: 1, role: 40 },
    0,
    env,
  );
  const local = path.resolve('/usr/records', '0/conferences/14/900162002.wav');
  console.log('existsSync', fs.existsSync(local), local);

  const rec = await requestJson(
    'GET',
    `/api/conferences/recordings-by-uniqueid?uniqueids=${encodeURIComponent(UNIQUEID)}`,
    { token, port: PORT },
  );
  console.log('recordings', rec.status, JSON.stringify(rec.json));

  const meetings = await requestJson('GET', `/api/conferences/${ROOM}/meetings`, {
    token,
    port: PORT,
  });
  console.log(
    'meetings',
    meetings.status,
    JSON.stringify(
      (meetings.json || []).map((m) => ({
        uid: m.uid,
        ended_at: m.ended_at,
        rel: m.recording_file_rel,
        parts: m.participants?.length,
      })),
    ),
  );

  const play = await requestRange(
    `/api/conferences/${ROOM}/meetings/${MEETING}/play`,
    token,
  );
  console.log('play', play);
})().catch((e) => {
  console.error('VERIFYERR', e.message);
  process.exit(1);
});
