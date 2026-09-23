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
  const [attempts] = await db.query(
    "UPDATE ac_attempts SET disposition = 'failed', hangup_cause = 'stale_after_restart', ended_at = NOW() WHERE campaign_uid IN (2,3) AND disposition = 'dialing'",
  );
  const [tasks] = await db.query(
    "UPDATE ac_tasks SET status = 'pending', last_disposition = 'failed', leased_by = NULL, leased_at = NULL, next_attempt_at = NULL WHERE campaign_uid IN (2,3) AND status IN ('dialing','leased','completed') AND last_disposition IN ('failed','dialing','max_attempts','no_answer','answered_short')",
  );
  const [campaigns] = await db.query(
    "UPDATE ac_campaigns SET pacer_owner = NULL, pacer_heartbeat_at = NULL WHERE uid IN (2,3)",
  );
  await db.end();
  console.log(JSON.stringify({ attempts, tasks, campaigns }, null, 2));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
