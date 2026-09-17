const {
  loadEnv,
  loadJwt,
  tokenFor,
  requestJson,
  dbConn,
} = require('../16-modul-telekonferentsiy-confbridge-webrtc/uat-live-lib');

(async () => {
  const env = loadEnv();
  const jwt = loadJwt();
  const token = tokenFor(
    jwt,
    { uniqueid: 58, login: 'admin', name: 'admin', level: 1, role: 40 },
    0,
    env,
  );
  const conn = await dbConn(env);
  const [eps] = await conn.query(
    `SELECT uniqueid, user_uid, extension, webrtc, callerid
     FROM endpoints
     WHERE webrtc IN (1, '1', 'yes')
     ORDER BY uniqueid ASC
     LIMIT 20`,
  );
  let shiftRows = [];
  try {
    const [s] = await conn.query(
      'SELECT * FROM callcenter_agent_shifts ORDER BY uniqueid DESC LIMIT 10',
    );
    shiftRows = s;
  } catch (e) {
    shiftRows = e.message;
  }
  const [users] = await conn.query(
    `SELECT uniqueid, login, name, level, role, vpbx_user_uid
     FROM users
     ORDER BY uniqueid ASC
     LIMIT 20`,
  );
  await conn.end();
  const webrtc = await requestJson('GET', '/api/callcenter/webrtc/config', { token });
  const roomPut = await requestJson('PUT', '/api/conferences/15', {
    token,
    body: { record_mode: 'button' },
  });
  const guest = await requestJson(
    'GET',
    '/api/conferences/guest/5ee471574f659d5c94a0fd9f70af3221e921bdbc48e9b6554ae40ba596dc1d1a',
  );
  console.log(
    JSON.stringify(
      {
        endpoints: eps,
        shiftRows: Array.isArray(shiftRows)
          ? shiftRows.map((r) => ({
              uniqueid: r.uniqueid,
              sip: r.sip_id,
              user: r.user_uid,
              status: r.status,
            }))
          : shiftRows,
        users: users.slice(0, 15),
        webrtcStatus: webrtc.status,
        webrtc: webrtc.json,
        roomPut: { status: roomPut.status, record: roomPut.json && roomPut.json.record_mode },
        guestStatus: guest.status,
        guest:
          guest.json && {
            name: guest.json.name,
            number: guest.json.number,
            requiresPin: guest.json.requiresPin,
            participants: guest.json.participants,
          },
      },
      null,
      2,
    ),
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
