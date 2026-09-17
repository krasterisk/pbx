const fs = require('fs');
const { execSync } = require('child_process');

function parseEnv(file) {
  const buf = fs.readFileSync(file);
  let text = buf.toString('utf8').replace(/^\uFEFF/, '');
  if (buf[0] === 0xFF && buf[1] === 0xFE) text = buf.toString('utf16le');
  const out = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\0/g, '').trim();
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const eq = line.indexOf('=');
    let v = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    out[line.slice(0, eq).trim()] = v;
  }
  return out;
}

async function main() {
  const env = parseEnv('/var/www/pbx/.env.production');
  const mysql = require(require.resolve('mysql2/promise', {
    paths: ['/var/www/pbx/packages/backend', '/var/www/pbx'],
  }));
  const conn = await mysql.createConnection({
    host: env.DB_HOST || '127.0.0.1',
    port: Number(env.DB_PORT || 3306),
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
  });
  const [rows] = await conn.query(
    `SELECT uniqueid, queue_name, interface, membername, penalty, paused, vpbx_user_uid
     FROM queue_members_table
     WHERE interface LIKE '%201%' OR membername LIKE '%201%'
     ORDER BY queue_name`,
  );
  console.log(JSON.stringify(rows, null, 2));
  await conn.end();
  console.log('--- queue show q701 ---');
  console.log(execSync('asterisk -rx "queue show q701_0"', { encoding: 'utf8' }));
}

main().catch((e) => { console.error(e.message || e); process.exit(1); });
