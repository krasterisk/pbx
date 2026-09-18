const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const mysql = require('mysql2/promise');

async function main() {
  const dir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(dir).filter(f => /^\d+.*\.sql$/.test(f)).sort();
  if (process.argv.includes('--list')) {
    files.forEach(f => console.log(f));
    return;
  }
  if (process.argv.includes('--rollback')) throw new Error('Automatic rollback is not supported; use a reviewed forward migration or restore a backup.');
  for (const name of ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME']) {
    if (process.env[name] === undefined) throw new Error(`${name} must be explicitly configured`);
  }
  const db = await mysql.createConnection({ host: process.env.DB_HOST,
    socketPath: process.env.DB_SOCKET || undefined,
    port: Number(process.env.DB_PORT || 3306), user: process.env.DB_USER,
    password: process.env.DB_PASSWORD, database: process.env.DB_NAME, multipleStatements: true });
  try {
    const [[lock]] = await db.query("SELECT GET_LOCK(CONCAT(DATABASE(), ':migrations'), 30) AS acquired");
    if (lock.acquired !== 1) throw new Error('Migration lock unavailable');
    const [tables] = await db.query('SHOW TABLES');
    const names = tables.map(t => Object.values(t)[0]);
    if (names.length && !names.includes('krasterisk_schema_migrations')) {
      throw new Error('Existing unversioned schema: baseline requires an empty database. Review and reconcile the existing schema before adopting migration history.');
    }
    await db.query('CREATE TABLE IF NOT EXISTS krasterisk_schema_migrations (name VARCHAR(255) PRIMARY KEY, checksum CHAR(64) NOT NULL, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)');
    for (const file of files) {
      const sql = fs.readFileSync(path.join(dir, file), 'utf8');
      const checksum = crypto.createHash('sha256').update(sql).digest('hex');
      const [rows] = await db.query('SELECT checksum FROM krasterisk_schema_migrations WHERE name = ?', [file]);
      if (rows.length) {
        if (rows[0].checksum !== checksum) throw new Error(`Applied migration changed: ${file}`);
        continue;
      }
      await db.query(sql);
      await db.query('INSERT INTO krasterisk_schema_migrations (name, checksum) VALUES (?, ?)', [file, checksum]);
      console.log(`Applied ${file}`);
    }
  } finally {
    await db.end(); // also releases the connection-owned migration lock
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
