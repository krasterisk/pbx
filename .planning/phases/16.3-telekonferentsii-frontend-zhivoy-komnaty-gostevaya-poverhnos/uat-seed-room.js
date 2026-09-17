/**
 * Phase 16.3 UAT — login, create room + guest token, probe AI tools + hub seed.
 *   node .planning/phases/16.3-telekonferentsii-frontend-zhivoy-komnaty-gostevaya-poverhnos/uat-seed-room.js
 */
const fs = require('fs');
const http = require('http');
const path = require('path');
const {
  loadEnv,
  loadJwt,
  tokenFor,
  requestJson,
  createRoom,
} = require('../16-modul-telekonferentsiy-confbridge-webrtc/uat-live-lib');

const RESULTS = path.join(__dirname, 'results');

function write(name, data) {
  fs.mkdirSync(RESULTS, { recursive: true });
  const file = path.join(RESULTS, name);
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
  return file;
}

(async () => {
  const env = loadEnv();
  const jwt = loadJwt();
  const user = { uniqueid: 58, login: 'admin', name: 'admin', level: 1, role: 40 };
  const token = tokenFor(jwt, user, 0, env);

  const login = await requestJson('POST', '/api/auth/login', {
    body: { login: 'admin', password: 'admin' },
  });

  const rooms = await requestJson('GET', '/api/conferences', { token });
  const number = `163${Date.now().toString().slice(-6)}`;
  const room = await createRoom(token, number, `UAT 16.3 ${number}`);
  const guest = await requestJson('POST', `/api/conferences/${room.uid}/guest-tokens`, {
    token,
    body: { label: 'uat-16.3' },
  });

  const hub = await requestJson('GET', '/api/hub-modules', { token }).catch(() => ({
    status: 'no-hub-modules',
  }));
  const hubAlt = await requestJson('GET', '/api/modules/hub', { token }).catch(() => null);
  const hubMine = await requestJson('GET', '/api/my-modules', { token }).catch(() => null);

  const tools = await requestJson('GET', '/api/ai-chat/tools', { token }).catch(() => null);
  const adapters = await requestJson('GET', '/api/ai-platform/adapters', { token }).catch(() => null);

  const out = {
    started: new Date().toISOString(),
    loginStatus: login.status,
    loginOk: Boolean(login.json?.accessToken || login.json?.token),
    roomsStatus: rooms.status,
    roomCount: Array.isArray(rooms.json) ? rooms.json.length : rooms.json,
    room: { uid: room.uid, number: room.number, name: room.name },
    guestStatus: guest.status,
    guestToken: guest.json?.token || guest.json?.guest_token || guest.json,
    hub: { hub: hub.status, hubAlt: hubAlt?.status, hubMine: hubMine?.status },
    hubBodies: {
      hub: hub.json && JSON.stringify(hub.json).slice(0, 400),
      hubAlt: hubAlt?.json && JSON.stringify(hubAlt.json).slice(0, 400),
      hubMine: hubMine?.json && JSON.stringify(hubMine.json).slice(0, 400),
    },
    ai: {
      tools: tools?.status,
      adapters: adapters?.status,
      toolNames: Array.isArray(tools?.json)
        ? tools.json.map((t) => t.name || t)
        : tools?.json,
    },
  };
  const file = write(`uat-seed-${Date.now()}.json`, out);
  console.log(JSON.stringify({ file, ...out }, null, 2));
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
