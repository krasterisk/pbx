/** Read-only aggregate preflight before starting another autodial runtime. */
const fs = require('node:fs');
const path = require('node:path');
const mysql = require('mysql2/promise');

for (const line of fs.readFileSync(path.resolve(__dirname, '../../../.env'), 'utf8').split(/\r?\n/)) {
  const match = line.match(/^([A-Z_]+)=(.*)$/);
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
}

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    connectTimeout: 5000,
  });
  try {
    const [campaigns] = await connection.query(
      'SELECT status, COUNT(*) AS count FROM ac_campaigns GROUP BY status ORDER BY status',
    );
    const [tasks] = await connection.query(
      "SELECT status, COUNT(*) AS count FROM ac_tasks WHERE status IN ('leased', 'dialing') GROUP BY status ORDER BY status",
    );
    const [attempts] = await connection.query(
      "SELECT COUNT(*) AS count FROM ac_attempts WHERE disposition = 'dialing'",
    );
    const [stalePhones] = await connection.query(
      'SELECT t.uid, t.campaign_uid FROM ac_tasks t LEFT JOIN ac_contact_phones p ON p.uid = t.phone_uid AND p.contact_uid = t.contact_uid AND p.base_uid = (SELECT c.base_uid FROM ac_campaigns c WHERE c.uid = t.campaign_uid AND c.vpbx_user_uid = t.vpbx_user_uid) WHERE t.status IN (\'pending\', \'leased\', \'dialing\') AND p.uid IS NULL ORDER BY t.uid LIMIT 20',
    );
    const [orphanAttempts] = await connection.query(
      'SELECT COUNT(*) AS count FROM ac_attempts a LEFT JOIN ac_campaigns c ON c.uid = a.campaign_uid AND c.vpbx_user_uid = a.vpbx_user_uid LEFT JOIN ac_tasks t ON t.uid = a.task_uid AND t.vpbx_user_uid = a.vpbx_user_uid WHERE c.uid IS NULL OR t.uid IS NULL',
    );
    const [scheduleRows] = await connection.query(
      'SELECT s.uid, s.campaign_uid, s.timezone FROM ac_schedules s JOIN ac_campaigns c ON c.uid = s.campaign_uid ORDER BY s.uid',
    );
    const invalidTimezones = scheduleRows
      .filter((row) => {
        try { new Intl.DateTimeFormat('en', { timeZone: row.timezone }); return false; }
        catch { return true; }
      })
      .slice(0, 20)
      .map(({ uid, campaign_uid }) => ({ uid, campaign_uid }));
    console.log(JSON.stringify({
      campaigns,
      activeTasks: tasks,
      openAttempts: attempts[0]?.count ?? 0,
      staleActivePhoneRefs: stalePhones,
      orphanAttemptCount: orphanAttempts[0]?.count ?? 0,
      invalidTimezones,
      resultLimit: 20,
    }));
  } finally {
    await connection.end();
  }
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
