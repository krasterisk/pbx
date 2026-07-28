import { Sequelize } from 'sequelize-typescript';
import { DataTypes, QueryInterface } from 'sequelize';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../../../../.env') });

/**
 * IVR schema cleanup / timeouts split:
 *   + timeout_response   — Asterisk TIMEOUT(response), first digit
 *   + timeout_digit      — Asterisk TIMEOUT(digit), inter-digit pause
 *   - exten              — unused; routing uses Goto(ivr_{uid}) via routes
 *
 * Existing rows: timeout_response is backfilled from timeout; timeout_digit defaults to 5.
 *
 * Run (from packages/backend):
 *   npx ts-node src/modules/ivrs/migrate-ivr-timeouts.ts
 */
async function columnExists(qi: QueryInterface, table: string, column: string): Promise<boolean> {
  const desc = await qi.describeTable(table);
  return column in desc;
}

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

  if (!(await columnExists(qi, 'ivrs', 'timeout_response'))) {
    console.log('[migration] Adding ivrs.timeout_response...');
    await qi.addColumn('ivrs', 'timeout_response', {
      type: DataTypes.STRING(255),
      allowNull: true,
    });
    await sequelize.query(
      'UPDATE ivrs SET timeout_response = timeout WHERE timeout IS NOT NULL AND timeout != \'\'',
    );
  } else {
    console.log('[migration] ivrs.timeout_response already exists — skip');
  }

  if (!(await columnExists(qi, 'ivrs', 'timeout_digit'))) {
    console.log('[migration] Adding ivrs.timeout_digit...');
    await qi.addColumn('ivrs', 'timeout_digit', {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: '5',
    });
    await sequelize.query(
      'UPDATE ivrs SET timeout_digit = \'5\' WHERE timeout_digit IS NULL OR timeout_digit = \'\'',
    );
  } else {
    console.log('[migration] ivrs.timeout_digit already exists — skip');
  }

  if (await columnExists(qi, 'ivrs', 'exten')) {
    console.log('[migration] Dropping unused ivrs.exten...');
    await qi.removeColumn('ivrs', 'exten');
  } else {
    console.log('[migration] ivrs.exten already removed — skip');
  }

  console.log('[migration] IVR schema ready (timeouts + exten drop).');
  await sequelize.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
