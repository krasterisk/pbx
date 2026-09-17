const { loadEnv, connectAmi, hangupLocals } = require('./uat-live-lib');

(async () => {
  const env = loadEnv();
  const ami = await connectAmi(env);
  await hangupLocals(ami, 'conf16897_348');
  ami.disconnect();
  console.log('cleaned leftover locals');
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
