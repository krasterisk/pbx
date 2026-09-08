/**
 * Fresh-development schema setup for directories.
 * CREATE TABLE IF NOT EXISTS only — never DROP.
 *
 * Run: npm run db:setup:directories -w @krasterisk/backend
 */

export const DIRECTORY_SCHEMA_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS \`directories\` (
    \`uid\` INT NOT NULL AUTO_INCREMENT,
    \`user_uid\` INT NOT NULL,
    \`name\` VARCHAR(255) NOT NULL,
    \`description\` VARCHAR(255) NOT NULL DEFAULT '',
    \`lookup_field_uid\` INT NULL,
    \`key_normalization\` VARCHAR(16) NOT NULL DEFAULT 'none',
    \`revision\` INT NOT NULL DEFAULT 0,
    \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
    \`updated_at\` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (\`uid\`),
    UNIQUE KEY \`uq_directories_tenant_name\` (\`user_uid\`, \`name\`),
    KEY \`idx_directories_user_uid\` (\`user_uid\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS \`directory_fields\` (
    \`uid\` INT NOT NULL AUTO_INCREMENT,
    \`directory_uid\` INT NOT NULL,
    \`key\` VARCHAR(64) NOT NULL,
    \`label\` VARCHAR(255) NOT NULL,
    \`type\` VARCHAR(16) NOT NULL,
    \`required\` TINYINT(1) NOT NULL DEFAULT 0,
    \`position\` INT NOT NULL DEFAULT 0,
    PRIMARY KEY (\`uid\`),
    UNIQUE KEY \`uq_directory_fields_key\` (\`directory_uid\`, \`key\`),
    CONSTRAINT \`fk_directory_fields_directory\`
      FOREIGN KEY (\`directory_uid\`) REFERENCES \`directories\` (\`uid\`) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS \`directory_records\` (
    \`uid\` INT NOT NULL AUTO_INCREMENT,
    \`directory_uid\` INT NOT NULL,
    \`lookup_value\` VARCHAR(255) NOT NULL,
    \`normalized_lookup_value\` VARCHAR(255) NOT NULL,
    \`match_kind\` VARCHAR(24) NOT NULL,
    \`priority\` INT NOT NULL,
    \`values\` JSON NOT NULL,
    \`comment\` VARCHAR(255) NOT NULL DEFAULT '',
    \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
    \`updated_at\` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (\`uid\`),
    UNIQUE KEY \`uq_directory_exact_key\` (\`directory_uid\`, \`normalized_lookup_value\`, \`match_kind\`),
    KEY \`idx_directory_patterns\` (\`directory_uid\`, \`match_kind\`, \`priority\`),
    CONSTRAINT \`fk_directory_records_directory\`
      FOREIGN KEY (\`directory_uid\`) REFERENCES \`directories\` (\`uid\`) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS \`route_directory_bindings\` (
    \`uid\` INT NOT NULL AUTO_INCREMENT,
    \`route_uid\` INT NOT NULL,
    \`directory_uid\` INT NOT NULL,
    \`position\` INT NOT NULL DEFAULT 0,
    \`key_source\` JSON NOT NULL,
    \`match_mode\` VARCHAR(16) NOT NULL DEFAULT 'on_match',
    \`behavior_type\` VARCHAR(32) NOT NULL,
    \`behavior_params\` JSON NULL,
    \`actions\` JSON NULL,
    \`user_uid\` INT NOT NULL,
    PRIMARY KEY (\`uid\`),
    KEY \`idx_rdb_user_uid\` (\`user_uid\`),
    CONSTRAINT \`fk_rdb_directory\`
      FOREIGN KEY (\`directory_uid\`) REFERENCES \`directories\` (\`uid\`) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
];

export async function setupDirectoriesSchema(sequelize: {
  query: (sql: string) => Promise<unknown>;
  getQueryInterface?: () => { sequelize?: { query: (sql: string) => Promise<unknown> } };
}): Promise<void> {
  const qi = sequelize.getQueryInterface?.();
  const exec = qi?.sequelize?.query ?? sequelize.query;
  for (const statement of DIRECTORY_SCHEMA_STATEMENTS) {
    await exec.call(qi?.sequelize ?? sequelize, statement);
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

  await setupDirectoriesSchema(sequelize);
  await sequelize.close();
  console.log('[directories] schema setup complete');
}

const isDirectRun =
  typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module;
if (isDirectRun) {
  main().catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
}
