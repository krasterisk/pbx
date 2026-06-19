import { Sequelize } from 'sequelize';
import * as dotenv from 'dotenv';
import * as path from 'path';

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

  const [columns] = await sequelize.query(
    `SHOW COLUMNS FROM service_requests LIKE 'production_comment'`,
  );

  if ((columns as any[]).length > 0) {
    console.log('[migration] production_comment column already exists');
  } else {
    console.log('[migration] Adding production_comment column to service_requests...');
    await sequelize.query(
      `ALTER TABLE service_requests ADD COLUMN production_comment TEXT NULL AFTER comment`,
    );
    console.log('[migration] production_comment column added');
  }

  await sequelize.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
