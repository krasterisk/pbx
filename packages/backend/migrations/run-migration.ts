/**
 * Migration runner — applies SQL migration files against the MySQL database.
 * Usage: npx ts-node packages/backend/migrations/run-migration.ts
 */
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function main() {
  const envPath = path.resolve(__dirname, '../../../.env');
  const envContent = fs.readFileSync(envPath, 'utf8');
  const env: Record<string, string> = {};
  envContent.split('\n').forEach((line: string) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      env[trimmed.slice(0, eqIdx)] = trimmed.slice(eqIdx + 1);
    }
  });

  const connection = await mysql.createConnection({
    host: env.DB_HOST || 'localhost',
    port: Number(env.DB_PORT) || 3306,
    user: env.DB_USER || 'krasterisk',
    password: env.DB_PASSWORD || '',
    database: env.DB_NAME || 'krasterisk',
    multipleStatements: true,
  });

  console.log('Connected to MySQL');

  const targetFile = process.argv[2] || '001_create_routes_tables.sql';
  const sqlFile = path.resolve(__dirname, targetFile);
  const sql = fs.readFileSync(sqlFile, 'utf8');

  console.log(`Running migration: ${targetFile}`);
  await connection.query(sql);
  console.log('✅ Migration applied successfully!');

  await connection.end();
}

main().catch((err: any) => {
  console.error('❌ Migration failed:', err.message || err);
  process.exit(1);
});
