const {
  loadEnv,
  loadJwt,
  tokenFor,
  requestJson,
  connectAmi,
  amiAction,
  cmd,
  hangupLocals,
} = require('../16-modul-telekonferentsiy-confbridge-webrtc/uat-live-lib');

const N = Number(process.env.UAT163_ORIGINATE || 12);
const CONTEXT = 'krsk-conf-15';
const CONFERENCE = 'conf163652348_0';

(async () => {
  const env = loadEnv();
  const jwt = loadJwt();
  const token = tokenFor(
    jwt,
    { uniqueid: 58, login: 'admin', name: 'admin', level: 1, role: 40 },
    0,
    env,
  );
  const capacity = await requestJson('GET', '/api/conferences/15/capacity', { token });
  const ami = await connectAmi(env);
  await hangupLocals(ami, CONFERENCE);
  const originated = [];
  for (let i = 0; i < N; i += 1) {
    const res = await amiAction(ami, {
      action: 'Originate',
      channel: `Local/s@${CONTEXT}`,
      application: 'Wait',
      data: '180',
      async: 'true',
      callerid: `UAT Tile ${i + 1} <16${String(i + 1).padStart(2, '0')}>`,
    });
    originated.push({ i, response: res?.response, message: res?.message });
  }
  await new Promise((r) => setTimeout(r, 2500));
  const list = await cmd(ami, `confbridge list ${CONFERENCE}`);
  const room = await requestJson('GET', '/api/conferences/15', { token });
  ami.disconnect();
  console.log(
    JSON.stringify(
      {
        capacity: capacity.json,
        originated: originated.slice(0, 3),
        originatedCount: originated.length,
        confbridge: list,
        participants: room.json?.participants,
        participantCount: room.json?.participants?.length,
      },
      null,
      2,
    ),
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
