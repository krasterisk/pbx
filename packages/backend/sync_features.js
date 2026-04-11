const mysql = require('mysql2/promise');
require('dotenv').config({ path: '../../.env' });

async function run() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'ipbx.krasterisk.ru',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'gfhjkm',
    database: process.env.DB_NAME || 'krasterisk',
    multipleStatements: true
  });

  const alterStmts = [
    "ALTER TABLE ps_endpoints ADD COLUMN department VARCHAR(255) DEFAULT ''",
    "ALTER TABLE ps_endpoints ADD COLUMN provision_enabled TINYINT(1) DEFAULT 0",
    "ALTER TABLE ps_endpoints ADD COLUMN mac_address VARCHAR(100) DEFAULT ''",
    "ALTER TABLE ps_endpoints ADD COLUMN provision_template_id INT DEFAULT NULL",
    "ALTER TABLE ps_endpoints ADD COLUMN pv_vars TEXT"
  ];

  for (let stmt of alterStmts) {
    try {
      await connection.query(stmt);
      console.log('Success:', stmt);
    } catch(e) {
      if (!e.message.includes('Duplicate column name')) {
         console.error('Error on ', stmt, e.message);
      } else {
         console.log('Skipped (already exists):', stmt);
      }
    }
  }

  const createPickup = "CREATE TABLE IF NOT EXISTS pickup_groups (" +
      "uid INT AUTO_INCREMENT PRIMARY KEY," +
      "name VARCHAR(128) NOT NULL," +
      "slug VARCHAR(128) NOT NULL," +
      "user_uid INT NOT NULL DEFAULT 0" +
    ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;";
  await connection.query(createPickup);
  console.log('Created pickup_groups');

  const createProv = "CREATE TABLE IF NOT EXISTS provision_templates (" +
      "uid INT AUTO_INCREMENT PRIMARY KEY," +
      "name VARCHAR(128) NOT NULL," +
      "vendor VARCHAR(64) DEFAULT ''," +
      "model VARCHAR(64) DEFAULT ''," +
      "content TEXT," +
      "user_uid INT NOT NULL DEFAULT 0" +
    ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;";
  await connection.query(createProv);
  console.log('Created provision_templates');

  await connection.end();
}
run();
