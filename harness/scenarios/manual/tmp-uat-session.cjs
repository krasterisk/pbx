const crypto = require('node:crypto');
const fs = require('node:fs');
const mysql = require('mysql2/promise');

for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
}

function mint(user) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const body = Buffer.from(
    JSON.stringify({
      sub: user.uniqueid,
      login: user.login,
      name: user.name,
      level: user.level,
      role: user.role ?? 0,
      vpbx_user_uid: user.vpbx_user_uid,
      iat: now,
      exp: now + 7200,
      iss: 'krasterisk-v4',
      aud: 'krasterisk-v4-client',
    }),
  ).toString('base64url');
  const sig = crypto
    .createHmac('sha256', process.env.JWT_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');
  return `${header}.${body}.${sig}`;
}

(async () => {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
  const [users] = await db.query(
    "SELECT uniqueid, login, name, level, role, vpbx_user_uid FROM users WHERE login = 'admin' ORDER BY uniqueid ASC LIMIT 1",
  );
  const [tasks] = await db.query(
    'SELECT uid, campaign_uid, status, last_disposition, attempt_count, leased_by FROM ac_tasks WHERE campaign_uid IN (2,3) ORDER BY uid',
  );
  const [attempts] = await db.query(
    'SELECT uid, campaign_uid, task_uid, attempt_no, disposition, hangup_cause, answered_at, started_at, channel_id FROM ac_attempts WHERE campaign_uid IN (2,3) ORDER BY uid DESC LIMIT 20',
  );
  await db.end();
  const user = users[0];
  const token = mint(user);
  const session = {
    token,
    user: {
      uniqueid: user.uniqueid,
      login: user.login,
      name: user.name,
      level: user.level,
      role: user.role ?? 0,
      exten: '',
      vpbx_user_uid: user.vpbx_user_uid,
    },
  };
  fs.writeFileSync('tmp-uat-session.json', JSON.stringify(session));
  console.log(JSON.stringify({ user, tasks, attempts }, null, 2));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
