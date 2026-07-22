/**
 * Deduplicate cc_missed_calls and add UNIQUE(call_uniqueid).
 *
 * Run from packages/backend:
 *   npx ts-node src/modules/callcenter/migrate-missed-calls-unique.ts
 */
import { Sequelize } from 'sequelize-typescript';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../../../../.env') });

async function main() {
  const sequelize = new Sequelize({
    dialect: 'mysql',
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    username: process.env.DB_USER || 'krasterisk',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'krasterisk',
    logging: console.log,
  });

  try {
    console.log('[migration] Deleting duplicate cc_missed_calls (keep lowest uid)...');
    await sequelize.query(`
      DELETE m1 FROM cc_missed_calls m1
      INNER JOIN cc_missed_calls m2
        ON m1.call_uniqueid = m2.call_uniqueid
       AND m1.uid > m2.uid
    `);

    console.log('[migration] Adding UNIQUE index on call_uniqueid...');
    try {
      await sequelize.query(`
        ALTER TABLE cc_missed_calls
        ADD UNIQUE INDEX uq_cc_missed_calls_uniqueid (call_uniqueid)
      `);
    } catch (err: any) {
      const msg = String(err?.message || err);
      if (msg.includes('Duplicate') || msg.includes('exists')) {
        console.log('[migration] Unique index already present — ok');
      } else {
        throw err;
      }
    }

    console.log('[migration] Done.');
  } finally {
    await sequelize.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
