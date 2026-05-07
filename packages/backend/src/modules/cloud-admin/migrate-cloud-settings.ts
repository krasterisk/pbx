import { Sequelize, DataTypes } from 'sequelize';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../../../../.env') });

async function main() {
  const sequelize = new Sequelize({
    dialect: 'mysql',
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    logging: console.log,
  });

  const qi = sequelize.getQueryInterface();

  console.log('[migration] Creating cloud_settings...');
  await qi.createTable('cloud_settings', {
    id:          { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    key:         { type: DataTypes.STRING(128), allowNull: false, unique: true },
    value:       { type: DataTypes.TEXT, allowNull: true },
    description: { type: DataTypes.STRING(255), allowNull: true },
    created_at:  { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updated_at:  { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  }, { ifNotExists: true } as any);

  console.log('[migration] cloud_settings created ✅');
  await sequelize.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
