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
  const [tables] = await conn.query(
    `SHOW TABLES LIKE '%sip%'`,
  );
  const [ps] = await conn.query(
    `SELECT id, transport, context, webrtc FROM ps_endpoints LIMIT 20`,
  );
  let sip = [];
  try {
    const [rows] = await conn.query(
      `SELECT id, defaultuser, host, callerid FROM sippeers LIMIT 20`,
    );
    sip = rows;
  } catch (e) {
    sip = e.message;
  }
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
  const eps = await requestJson('GET', '/api/endpoints', { token });
  console.log(
    JSON.stringify(
      {
        tables,
        ps,
        sip,
        webrtcStatus: webrtc.status,
        webrtc: webrtc.json,
        roomPut: { status: roomPut.status, record: roomPut.json && roomPut.json.record_mode },
        guestStatus: guest.status,
        guest: guest.json,
        epsStatus: eps.status,
        epsSample: Array.isArray(eps.json)
          ? eps.json.slice(0, 8).map((e) => ({
              extension: e.extension,
              webrtc: e.webrtc,
              callerid: e.callerid,
            }))
          : eps.json,
      },
      null,
      2,
    ),
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
