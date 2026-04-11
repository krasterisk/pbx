const mysql = require('mysql2/promise');
require('dotenv').config({ path: '../../.env' }); // relative to backend

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'ipbx.krasterisk.ru',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'gfhjkm',
    database: process.env.DB_NAME || 'krasterisk',
  });

  const tables = ['users', 'roles', 'sippeers', 'numbers'];
  
  for (const table of tables) {
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME, DATA_TYPE, COLUMN_DEFAULT
      FROM information_schema.columns
      WHERE table_schema = ? AND table_name = ?
    `, [process.env.DB_NAME || 'krasterisk', table]);
    console.log(`\nTable: ${table}`);
    console.log(columns.map(c => `${c.COLUMN_NAME} (${c.DATA_TYPE})`).join('\n'));
  }

  await connection.end();
}

main().catch(console.error);
