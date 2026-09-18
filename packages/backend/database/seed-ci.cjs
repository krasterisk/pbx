// Explicitly opt-in fixture for a disposable CI database; never modifies an existing account.
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
async function main() {
  if (process.env.CI !== 'true' || !/^krasterisk_ci(?:_[a-z0-9]+)?$/.test(process.env.DB_NAME || '')) {
    throw new Error('CI fixture requires CI=true and DB_NAME=krasterisk_ci[_suffix]');
  }
  const db = await mysql.createConnection({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 3306),
    socketPath: process.env.DB_SOCKET || undefined,
    user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME });
  try {
    const [rows] = await db.query('SELECT uniqueid FROM users WHERE login = ?', ['admin']);
    if (rows.length) throw new Error('Refusing to overwrite existing admin');
    await db.query('INSERT INTO users (uniqueid, login, name, passwd, level, vpbx_user_uid, isActivated, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())',
      [58, 'admin', 'CI admin', await bcrypt.hash('admin', 10), 1, 0, true]);
  } finally { await db.end(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
