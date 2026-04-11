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
    console.log('Adding activation fields to users table...');
    await connection.execute(`
      ALTER TABLE users 
      ADD COLUMN activationCode VARCHAR(50) DEFAULT NULL,
      ADD COLUMN activationExpires BIGINT DEFAULT NULL,
      ADD COLUMN isActivated BOOLEAN DEFAULT FALSE;
    `);
    console.log('Successfully added activation fields.');

  } catch (error) {
    if (error.code === 'ER_DUP_FIELDNAME') {
       console.log('Fields already exist.');
    } else {
       console.error('Migration failed:', error);
    }
  } finally {
    await connection.end();
  }
}

main().catch(console.error);
