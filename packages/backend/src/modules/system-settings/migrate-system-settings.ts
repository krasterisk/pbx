import { Sequelize, DataTypes } from 'sequelize';
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

  const qi = sequelize.getQueryInterface();

  console.log('[migration] Creating system_settings...');
  await qi.createTable(
    'system_settings',
    {
      uid: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      key: { type: DataTypes.STRING(128), allowNull: false, unique: true },
      value: { type: DataTypes.TEXT, allowNull: true },
      category: { type: DataTypes.STRING(64), allowNull: false, defaultValue: 'general' },
      updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    },
    { ifNotExists: true } as any,
  );

  console.log('[migration] system_settings created');
  await sequelize.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
