/**
 * Fresh-development schema + built-in seed for route_templates (D-33).
 * CREATE TABLE IF NOT EXISTS only — never DROP.
 *
 * Run: npx ts-node -r tsconfig-paths/register src/modules/route-templates/setup-route-templates-schema.ts
 * (from packages/backend)
 */

import { BUILTIN_ROUTE_TEMPLATES } from './builtin-route-templates';

export const ROUTE_TEMPLATE_SCHEMA_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS \`route_templates\` (
    \`uid\` INT NOT NULL AUTO_INCREMENT,
    \`name\` VARCHAR(255) NOT NULL,
    \`description\` VARCHAR(512) NOT NULL DEFAULT '',
    \`actions\` JSON NOT NULL,
    \`slots\` JSON NOT NULL,
    \`vpbx_user_uid\` INT NULL,
    \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
    \`updated_at\` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (\`uid\`),
    UNIQUE KEY \`uq_route_templates_tenant_name\` (\`vpbx_user_uid\`, \`name\`),
    KEY \`idx_route_templates_vpbx_user_uid\` (\`vpbx_user_uid\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
];

export function builtInSeedStatements(): string[] {
  return BUILTIN_ROUTE_TEMPLATES.map((seed) => {
    const name = seed.name.replace(/'/g, "''");
    const description = seed.description.replace(/'/g, "''");
    const actions = JSON.stringify(seed.actions).replace(/\\/g, '\\\\').replace(/'/g, "''");
    const slots = JSON.stringify(seed.slots).replace(/\\/g, '\\\\').replace(/'/g, "''");
    return (
      `INSERT INTO \`route_templates\` (\`name\`, \`description\`, \`actions\`, \`slots\`, \`vpbx_user_uid\`) ` +
      `SELECT '${name}', '${description}', '${actions}', '${slots}', NULL ` +
      `FROM DUAL WHERE NOT EXISTS (` +
      `SELECT 1 FROM \`route_templates\` WHERE \`vpbx_user_uid\` IS NULL AND \`name\` = '${name}'` +
      `)`
    );
  });
}

export async function setupRouteTemplatesSchema(sequelize: {
  query: (sql: string) => Promise<unknown>;
  getQueryInterface?: () => { sequelize?: { query: (sql: string) => Promise<unknown> } };
}): Promise<void> {
  const qi = sequelize.getQueryInterface?.();
  const exec = qi?.sequelize?.query ?? sequelize.query;
  const target = qi?.sequelize ?? sequelize;
  for (const statement of [...ROUTE_TEMPLATE_SCHEMA_STATEMENTS, ...builtInSeedStatements()]) {
    await exec.call(target, statement);
  }
}

async function main(): Promise<void> {
  const path = await import('path');
  const dotenv = await import('dotenv');
  dotenv.config({ path: path.resolve(__dirname, '../../../../../.env') });

  const { Sequelize } = await import('sequelize-typescript');
  const sequelize = new Sequelize({
    dialect: 'mysql',
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    username: process.env.DB_USER || 'krasterisk',
    password: process.env.DB_PASSWORD || process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'krasterisk',
    logging: console.log,
  });

  await setupRouteTemplatesSchema(sequelize);
  await sequelize.close();
  console.log('[route-templates] schema setup complete');
}

const isDirectRun =
  typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module;
if (isDirectRun) {
  main().catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
}
