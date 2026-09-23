const fs = require('node:fs');
const mysql = require('mysql2/promise');
const env = {};
for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match) env[match[1]] = match[2];
}
(async () => {
  const db = await mysql.createConnection({
    host: env.DB_HOST,
    port: Number(env.DB_PORT || 3306),
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
  });
  const [rows] = await db.query(
    "SELECT uid, name, vendor, endpoint, auth_type, enabled, vpbx_user_uid, capabilities, LEFT(COALESCE(encrypted_api_key,''), 6) AS key_prefix, IF(encrypted_api_key IS NULL OR encrypted_api_key = '', 0, 1) AS has_key FROM cc_ai_providers",
  );
  console.log(JSON.stringify(rows, null, 2));
  await db.end();
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
