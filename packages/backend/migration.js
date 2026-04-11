const mysql = require('mysql2/promise');
require('dotenv').config({ path: '../../.env' }); // relative to backend

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'ipbx.krasterisk.ru',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'gfhjkm',
    database: process.env.DB_NAME || 'krasterisk',
  });

  try {
    // 1. Rename user_uid to vpbx_user_uid in users table if it exists
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME
      FROM information_schema.columns
      WHERE table_schema = ? AND table_name = 'users' AND column_name = 'user_uid'
    `, [process.env.DB_NAME || 'krasterisk']);

    if (columns.length > 0) {
      console.log('Renaming user_uid to vpbx_user_uid in users table...');
      await connection.execute(`ALTER TABLE users CHANGE user_uid vpbx_user_uid INT DEFAULT 0;`);
      console.log('Successfully renamed user_uid.');
    } else {
      console.log('user_uid column not found in users table (might have already been renamed).');
    }

    // 2. Create action_logs table
    console.log('Creating action_logs table...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS action_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        action VARCHAR(255) NOT NULL,
        entity_type VARCHAR(255) NOT NULL,
        entity_id INT,
        details TEXT,
        vpbx_user_uid INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Successfully created action_logs table.');

  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await connection.end();
  }
}

main().catch(console.error);
