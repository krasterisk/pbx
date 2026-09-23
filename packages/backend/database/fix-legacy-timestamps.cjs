'use strict';
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

function loadDotEnv() {
  const file = path.join(__dirname, '../../../.env');
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const i = line.indexOf('=');
    const key = line.slice(0, i);
    if (process.env[key] === undefined) process.env[key] = line.slice(i + 1);
  }
}

(async () => {
  loadDotEnv();
  const db = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  const [cols] = await db.query('SHOW COLUMNS FROM users');
  const fields = new Set(cols.map((c) => c.Field));
  const adds = [];
  if (!fields.has('createdAt')) {
    adds.push('ADD COLUMN createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP');
  }
  if (!fields.has('updatedAt')) {
    adds.push('ADD COLUMN updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
  }
  if (!adds.length) {
    console.log('users already has createdAt/updatedAt');
  } else {
    await db.query(`ALTER TABLE users ${adds.join(', ')}`);
    console.log('users altered:', adds.join('; '));
  }

  // roles model uses default timestamps: true
  const [roleCols] = await db.query('SHOW COLUMNS FROM roles');
  const roleFields = new Set(roleCols.map((c) => c.Field));
  const roleAdds = [];
  if (!roleFields.has('createdAt')) {
    roleAdds.push('ADD COLUMN createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP');
  }
  if (!roleFields.has('updatedAt')) {
    roleAdds.push('ADD COLUMN updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
  }
  if (!roleAdds.length) {
    console.log('roles already has createdAt/updatedAt');
  } else {
    await db.query(`ALTER TABLE roles ${roleAdds.join(', ')}`);
    console.log('roles altered:', roleAdds.join('; '));
  }

  await db.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
