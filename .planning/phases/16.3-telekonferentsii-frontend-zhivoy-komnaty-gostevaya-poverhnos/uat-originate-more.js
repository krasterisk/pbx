const {
  loadEnv,
  connectAmi,
  amiAction,
  cmd,
} = require('../16-modul-telekonferentsiy-confbridge-webrtc/uat-live-lib');

const N = Number(process.env.UAT163_ORIGINATE || 11);
const CONTEXT = 'krsk-conf-15';
const CONFERENCE = 'conf163652348_0';
const OFFSET = Number(process.env.UAT163_OFFSET || 2);

(async () => {
  const env = loadEnv();
  const ami = await connectAmi(env);
  for (let i = 0; i < N; i += 1) {
    await amiAction(ami, {
      action: 'Originate',
      channel: `Local/s@${CONTEXT}`,
      application: 'Wait',
      data: '180',
      async: 'true',
      callerid: `UAT Tile ${OFFSET + i} <16${String(OFFSET + i).padStart(2, '0')}>`,
    });
  }
  await new Promise((r) => setTimeout(r, 2500));
  const list = await cmd(ami, `confbridge list ${CONFERENCE}`);
  const count = (list.match(/Local\//g) || []).length;
  ami.disconnect();
  console.log(JSON.stringify({ requested: N, liveLocals: count }));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
