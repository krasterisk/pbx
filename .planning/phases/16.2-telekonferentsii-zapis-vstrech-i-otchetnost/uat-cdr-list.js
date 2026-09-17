const {
  loadEnv,
  loadJwt,
  tokenFor,
  requestJson,
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
  const list = await requestJson('GET', '/api/reports/cdr?search=16921&limit=10&offset=0', {
    token,
    port: 5010,
  });
  console.log('status', list.status);
  const rows = list.json?.rows || list.json?.data?.rows || [];
  console.log(
    'count',
    list.json?.count ?? list.json?.data?.count,
    'n',
    rows.length,
    'first',
    JSON.stringify(rows[0] || list.json, null, 2).slice(0, 800),
  );
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
