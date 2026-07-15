import { Sequelize } from 'sequelize-typescript';
import { DataTypes, QueryInterface } from 'sequelize';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../../../../.env') });

/**
 * Phase 7 additive migration: queue_names on cc_card_templates (07-11).
 *
 * Run (from packages/backend):
 *   npx ts-node src/modules/callcenter/migrate-callcenter-card-queue-binding-phase7.ts
 */
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

  const qi: QueryInterface = sequelize.getQueryInterface();

  console.log('[migration] Adding queue_names to cc_card_templates...');
  try {
    await qi.addColumn(
      'cc_card_templates',
      'queue_names',
      { type: DataTypes.JSON, allowNull: true, defaultValue: null },
      { ifNotExists: true } as any,
    );
  } catch (e) {
    console.log('[migration] queue_names column:', (e as Error).message);
  }

  console.log('[migration] Phase 7 card queue-binding migration complete.');
  await sequelize.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
