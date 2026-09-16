/**
 * Fresh-development schema setup for conferences.
 * CREATE TABLE IF NOT EXISTS only — never DROP.
 *
 * Run: npm run db:setup:conferences -w @krasterisk/backend
 */

export const CONFERENCE_SCHEMA_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS \`conference_rooms\` (
    \`uid\` INT NOT NULL AUTO_INCREMENT,
    \`vpbx_user_uid\` INT NOT NULL,
    \`number\` VARCHAR(32) NOT NULL,
    \`name\` VARCHAR(255) NOT NULL,
    \`kind\` ENUM('permanent','ephemeral') NOT NULL DEFAULT 'permanent',
    \`entry_strictness\` ENUM('token_name','token_name_pin','token_name_pin_moderator') NOT NULL DEFAULT 'token_name',
    \`pin\` VARCHAR(32) NULL,
    \`wait_marked\` TINYINT(1) NOT NULL DEFAULT 0,
    \`end_marked\` TINYINT(1) NOT NULL DEFAULT 0,
    \`record_mode\` ENUM('off','auto','button','both') NOT NULL DEFAULT 'off',
    \`notify_recording\` TINYINT(1) NOT NULL DEFAULT 1,
    \`invite_external_scope\` ENUM('owner','moderator','anyone') NOT NULL DEFAULT 'owner',
    \`tariff_max_participants\` INT NULL,
    \`musiconhold\` VARCHAR(128) NULL,
    \`announce_join_leave\` TINYINT(1) NOT NULL DEFAULT 0,
    \`created_by\` INT NULL,
    \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
    \`updated_at\` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (\`uid\`),
    UNIQUE KEY \`uniq_room_number_per_tenant\` (\`vpbx_user_uid\`, \`number\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS \`conference_room_moderators\` (
    \`uid\` INT NOT NULL AUTO_INCREMENT,
    \`room_uid\` INT NOT NULL,
    \`endpoint_ref\` VARCHAR(64) NOT NULL,
    \`role\` ENUM('owner','moderator') NOT NULL DEFAULT 'moderator',
    PRIMARY KEY (\`uid\`),
    CONSTRAINT \`fk_conference_room_moderators_room\`
      FOREIGN KEY (\`room_uid\`) REFERENCES \`conference_rooms\` (\`uid\`) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS \`conference_guest_tokens\` (
    \`uid\` INT NOT NULL AUTO_INCREMENT,
    \`room_uid\` INT NOT NULL,
    \`token\` VARCHAR(64) NOT NULL,
    \`kind\` ENUM('shared_link','named_invite') NOT NULL,
    \`invite_name\` VARCHAR(255) NULL,
    \`display_name\` VARCHAR(64) NULL,
    \`sip_id\` VARCHAR(64) NULL,
    \`expires_at\` DATETIME NULL,
    \`revoked_at\` DATETIME NULL,
    \`last_used_at\` DATETIME NULL,
    \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (\`uid\`),
    UNIQUE KEY \`uniq_token\` (\`token\`),
    CONSTRAINT \`fk_conference_guest_tokens_room\`
      FOREIGN KEY (\`room_uid\`) REFERENCES \`conference_rooms\` (\`uid\`) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS \`conference_meetings\` (
    \`uid\` INT NOT NULL AUTO_INCREMENT,
    \`room_uid\` INT NOT NULL,
    \`started_at\` DATETIME NOT NULL,
    \`ended_at\` DATETIME NULL,
    \`has_recording\` TINYINT(1) NOT NULL DEFAULT 0,
    \`recording_file_rel\` VARCHAR(512) NULL,
    PRIMARY KEY (\`uid\`),
    CONSTRAINT \`fk_conference_meetings_room\`
      FOREIGN KEY (\`room_uid\`) REFERENCES \`conference_rooms\` (\`uid\`) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS \`conference_meeting_participants\` (
    \`uid\` INT NOT NULL AUTO_INCREMENT,
    \`meeting_uid\` INT NOT NULL,
    \`display_name\` VARCHAR(255) NOT NULL,
    \`role\` ENUM('owner','moderator','participant') NOT NULL DEFAULT 'participant',
    \`is_guest\` TINYINT(1) NOT NULL DEFAULT 0,
    \`joined_at\` DATETIME NOT NULL,
    \`left_at\` DATETIME NULL,
    PRIMARY KEY (\`uid\`),
    CONSTRAINT \`fk_conference_meeting_participants_meeting\`
      FOREIGN KEY (\`meeting_uid\`) REFERENCES \`conference_meetings\` (\`uid\`) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
];

async function alterIdempotent(
  exec: (sql: string) => Promise<unknown>,
  label: string,
  sql: string,
): Promise<void> {
  try {
    await exec(sql);
    console.log(`[conferences] ${label}: applied`);
  } catch (err: any) {
    const msg = String(err?.message || err);
    if (
      msg.includes('Duplicate column name')
      || msg.includes('already exists')
      || msg.includes('Duplicate')
      || msg.includes('check that column/key exists')
      || msg.includes("Can't DROP")
      || msg.includes('Unknown column')
    ) {
      console.log(`[conferences] ${label}: already applied / absent — ok`);
      return;
    }
    throw err;
  }
}

export async function setupConferencesSchema(sequelize: {
  query: (sql: string) => Promise<unknown>;
  getQueryInterface?: () => { sequelize?: { query: (sql: string) => Promise<unknown> } };
}): Promise<void> {
  const qi = sequelize.getQueryInterface?.();
  const target = qi?.sequelize ?? sequelize;
  const exec = (sql: string) => (qi?.sequelize?.query ?? sequelize.query).call(target, sql);
  for (const statement of CONFERENCE_SCHEMA_STATEMENTS) {
    await exec(statement);
  }
  await alterIdempotent(
    exec,
    'conference_room_moderators.role',
    `ALTER TABLE \`conference_room_moderators\` ADD COLUMN \`role\` ENUM('owner','moderator') NOT NULL DEFAULT 'moderator'`,
  );
  await alterIdempotent(
    exec,
    'conference_guest_tokens.display_name',
    `ALTER TABLE \`conference_guest_tokens\` ADD COLUMN \`display_name\` VARCHAR(64) NULL`,
  );
  await alterIdempotent(
    exec,
    'conference_guest_tokens.sip_id',
    `ALTER TABLE \`conference_guest_tokens\` ADD COLUMN \`sip_id\` VARCHAR(64) NULL`,
  );
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

  await setupConferencesSchema(sequelize);
  await sequelize.close();
  console.log('[conferences] schema setup complete');
}

const isDirectRun =
  typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module;
if (isDirectRun) {
  main().catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
}
