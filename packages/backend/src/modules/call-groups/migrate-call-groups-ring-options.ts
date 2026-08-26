/**
 * D-34: add per-group ring options with defaults matching current behaviour.
 *
 * Columns: confirm_external, confirm_digit, skip_busy, greeting_prompt, moh_class,
 * use_moh_instead_of_ringback, dial_options.
 *
 * Live ALTER is not run by the executor (same as migrate-call-groups-exten).
 * Run twice on the target DB after review:
 *   npx ts-node src/modules/call-groups/migrate-call-groups-ring-options.ts
 */
import { Sequelize } from 'sequelize-typescript';
import { DataTypes, QueryInterface, type ModelAttributeColumnOptions } from 'sequelize';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../../../../.env') });

export const CALL_GROUPS_TABLE = 'call_groups';

export interface RingOptionColumn {
  name: string;
  definition: ModelAttributeColumnOptions;
}

export const RING_OPTION_COLUMNS: RingOptionColumn[] = [
  {
    name: 'confirm_external',
    definition: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  },
  {
    name: 'confirm_digit',
    definition: { type: DataTypes.STRING(1), allowNull: false, defaultValue: '1' },
  },
  {
    name: 'skip_busy',
    definition: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  },
  {
    name: 'greeting_prompt',
    definition: { type: DataTypes.STRING(128), allowNull: true },
  },
  {
    name: 'moh_class',
    definition: { type: DataTypes.STRING(64), allowNull: true },
  },
  {
    name: 'use_moh_instead_of_ringback',
    definition: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  },
  {
    name: 'dial_options',
    definition: { type: DataTypes.STRING(64), allowNull: false, defaultValue: 'tT' },
  },
];

export interface MigrateRingOptionsReport {
  applied: string[];
  already: string[];
}

export async function runCallGroupsRingOptionsMigrate(
  qi: QueryInterface,
  log: (msg: string) => void = console.log,
): Promise<MigrateRingOptionsReport> {
  const described = (await qi.describeTable(CALL_GROUPS_TABLE)) as Record<string, unknown>;
  const applied: string[] = [];
  const already: string[] = [];

  for (const col of RING_OPTION_COLUMNS) {
    if (described[col.name]) {
      already.push(col.name);
      log(`[migration] addColumn ${col.name}: already applied`);
      continue;
    }
    await qi.addColumn(CALL_GROUPS_TABLE, col.name, col.definition);
    described[col.name] = col.definition;
    applied.push(col.name);
    log(`[migration] addColumn ${col.name}: applied`);
  }

  if (applied.length === 0) {
    log('[migration] all ring-option columns already exist');
  }

  return { applied, already };
}

async function main(): Promise<void> {
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
    const qi = sequelize.getQueryInterface();
    const report = await runCallGroupsRingOptionsMigrate(qi);
    console.log(
      `[migration] call_groups ring options complete. applied=${report.applied.length} already=${report.already.length}`,
    );
  } finally {
    await sequelize.close();
  }
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
