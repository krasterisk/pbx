const fs = require('node:fs');
const mysql = require('mysql2/promise');

for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
}

(async () => {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
  const [campaigns] = await db.query(
    'SELECT uid, name, status, trunk_pool, cid_policy, pacer_owner, pacer_heartbeat_at, dial_timeout_sec, dial_mode, pacing FROM ac_campaigns WHERE uid IN (2,3)',
  );
  let reservations = [];
  try {
    const [rows] = await db.query(
      'SELECT * FROM ac_channel_reservations WHERE campaign_uid IN (2,3) ORDER BY uid DESC LIMIT 20',
    );
    reservations = rows;
  } catch (e) {
    reservations = { error: e.message };
  }
  const [tasks] = await db.query(
    'SELECT uid, campaign_uid, status, last_disposition, last_cause, attempt_count, leased_by, leased_at FROM ac_tasks WHERE campaign_uid IN (2,3) ORDER BY uid',
  );
  await db.end();
  console.log(JSON.stringify({ campaigns, reservations, tasks }, null, 2));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
