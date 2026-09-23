/**
 * Fresh-development schema for Autodial (Автообзвон).
 * CREATE TABLE IF NOT EXISTS only — never DROP.
 *
 * Run: npm run db:setup:autodial -w @krasterisk/backend
 */

export const AUTODIAL_SCHEMA_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS \`ac_bases\` (
    \`uid\` INT NOT NULL AUTO_INCREMENT,
    \`vpbx_user_uid\` INT NOT NULL,
    \`name\` VARCHAR(255) NOT NULL,
    \`description\` VARCHAR(512) NOT NULL DEFAULT '',
    \`dedup_policy\` VARCHAR(16) NOT NULL DEFAULT 'phone',
    \`phone_normalization\` VARCHAR(16) NOT NULL DEFAULT 'ru_8_to_7',
    \`revision\` INT NOT NULL DEFAULT 0,
    \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
    \`updated_at\` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (\`uid\`),
    UNIQUE KEY \`uq_ac_bases_tenant_name\` (\`vpbx_user_uid\`, \`name\`),
    KEY \`idx_ac_bases_tenant\` (\`vpbx_user_uid\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS \`ac_base_fields\` (
    \`uid\` INT NOT NULL AUTO_INCREMENT,
    \`base_uid\` INT NOT NULL,
    \`key\` VARCHAR(64) NOT NULL,
    \`label\` VARCHAR(255) NOT NULL,
    \`type\` VARCHAR(16) NOT NULL,
    \`required\` TINYINT(1) NOT NULL DEFAULT 0,
    \`position\` INT NOT NULL DEFAULT 0,
    \`is_phone\` TINYINT(1) NOT NULL DEFAULT 0,
    \`var_name\` VARCHAR(64) NOT NULL DEFAULT '',
    \`enum_values\` JSON NULL,
    PRIMARY KEY (\`uid\`),
    UNIQUE KEY \`uq_ac_base_fields_key\` (\`base_uid\`, \`key\`),
    CONSTRAINT \`fk_ac_base_fields_base\`
      FOREIGN KEY (\`base_uid\`) REFERENCES \`ac_bases\` (\`uid\`) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS \`ac_contacts\` (
    \`uid\` INT NOT NULL AUTO_INCREMENT,
    \`base_uid\` INT NOT NULL,
    \`vpbx_user_uid\` INT NOT NULL,
    \`external_id\` VARCHAR(128) NULL,
    \`values\` JSON NOT NULL,
    \`comment\` VARCHAR(512) NOT NULL DEFAULT '',
    \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
    \`updated_at\` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (\`uid\`),
    KEY \`idx_ac_contacts_base\` (\`base_uid\`),
    KEY \`idx_ac_contacts_external\` (\`base_uid\`, \`external_id\`),
    CONSTRAINT \`fk_ac_contacts_base\`
      FOREIGN KEY (\`base_uid\`) REFERENCES \`ac_bases\` (\`uid\`) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS \`ac_contact_phones\` (
    \`uid\` INT NOT NULL AUTO_INCREMENT,
    \`contact_uid\` INT NOT NULL,
    \`base_uid\` INT NOT NULL,
    \`raw\` VARCHAR(64) NOT NULL,
    \`normalized\` VARCHAR(64) NOT NULL,
    \`position\` INT NOT NULL DEFAULT 0,
    \`is_primary\` TINYINT(1) NOT NULL DEFAULT 0,
    \`tz_offset_min\` INT NOT NULL DEFAULT 180,
    PRIMARY KEY (\`uid\`),
    KEY \`idx_ac_phones_normalized\` (\`base_uid\`, \`normalized\`),
    KEY \`idx_ac_phones_contact\` (\`contact_uid\`),
    CONSTRAINT \`fk_ac_phones_contact\`
      FOREIGN KEY (\`contact_uid\`) REFERENCES \`ac_contacts\` (\`uid\`) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS \`ac_import_profiles\` (
    \`uid\` INT NOT NULL AUTO_INCREMENT,
    \`base_uid\` INT NOT NULL,
    \`vpbx_user_uid\` INT NOT NULL,
    \`name\` VARCHAR(255) NOT NULL,
    \`source\` VARCHAR(8) NOT NULL DEFAULT 'csv',
    \`delimiter\` VARCHAR(4) NOT NULL DEFAULT ';',
    \`encoding\` VARCHAR(32) NOT NULL DEFAULT 'utf-8',
    \`has_header\` TINYINT(1) NOT NULL DEFAULT 1,
    \`column_map\` JSON NOT NULL,
    \`dedup_policy\` VARCHAR(16) NOT NULL DEFAULT 'phone',
    \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
    \`updated_at\` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (\`uid\`),
    KEY \`idx_ac_import_profiles_base\` (\`base_uid\`),
    CONSTRAINT \`fk_ac_import_profiles_base\`
      FOREIGN KEY (\`base_uid\`) REFERENCES \`ac_bases\` (\`uid\`) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS \`ac_import_runs\` (
    \`uid\` INT NOT NULL AUTO_INCREMENT,
    \`base_uid\` INT NOT NULL,
    \`vpbx_user_uid\` INT NOT NULL,
    \`profile_uid\` INT NULL,
    \`filename\` VARCHAR(512) NOT NULL DEFAULT '',
    \`total_rows\` INT NOT NULL DEFAULT 0,
    \`imported\` INT NOT NULL DEFAULT 0,
    \`skipped\` INT NOT NULL DEFAULT 0,
    \`errors\` JSON NULL,
    \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (\`uid\`),
    KEY \`idx_ac_import_runs_base\` (\`base_uid\`),
    CONSTRAINT \`fk_ac_import_runs_base\`
      FOREIGN KEY (\`base_uid\`) REFERENCES \`ac_bases\` (\`uid\`) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS \`ac_campaigns\` (
    \`uid\` INT NOT NULL AUTO_INCREMENT,
    \`vpbx_user_uid\` INT NOT NULL,
    \`name\` VARCHAR(255) NOT NULL,
    \`status\` VARCHAR(16) NOT NULL DEFAULT 'draft',
    \`dial_mode\` VARCHAR(16) NOT NULL DEFAULT 'progressive',
    \`base_uid\` INT NOT NULL,
    \`pacing\` JSON NOT NULL,
    \`retry\` JSON NOT NULL,
    \`trunk_pool\` JSON NOT NULL,
    \`cid_policy\` JSON NOT NULL,
    \`queue_names\` JSON NOT NULL,
    \`scenario_actions\` JSON NOT NULL,
    \`amd\` JSON NOT NULL,
    \`success_min_sec\` INT NOT NULL DEFAULT 15,
    \`dial_timeout_sec\` INT NOT NULL DEFAULT 45,
    \`revision\` INT NOT NULL DEFAULT 0,
    \`applied_revision\` INT NULL,
    \`apply_error\` VARCHAR(255) NULL,
    \`pacer_owner\` VARCHAR(64) NULL,
    \`pacer_heartbeat_at\` DATETIME NULL,
    \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
    \`updated_at\` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (\`uid\`),
    UNIQUE KEY \`uq_ac_campaigns_tenant_name\` (\`vpbx_user_uid\`, \`name\`),
    KEY \`idx_ac_campaigns_status\` (\`vpbx_user_uid\`, \`status\`),
    CONSTRAINT \`fk_ac_campaigns_base\`
      FOREIGN KEY (\`base_uid\`) REFERENCES \`ac_bases\` (\`uid\`) ON DELETE RESTRICT
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS \`ac_schedules\` (
    \`uid\` INT NOT NULL AUTO_INCREMENT,
    \`campaign_uid\` INT NOT NULL,
    \`kind\` VARCHAR(16) NOT NULL DEFAULT 'weekly',
    \`weekday\` TINYINT NULL,
    \`time_from\` VARCHAR(5) NOT NULL DEFAULT '09:00',
    \`time_to\` VARCHAR(5) NOT NULL DEFAULT '21:00',
    \`timezone\` VARCHAR(64) NOT NULL DEFAULT 'Europe/Moscow',
    \`date_from\` DATE NULL,
    \`date_to\` DATE NULL,
    \`enabled\` TINYINT(1) NOT NULL DEFAULT 1,
    PRIMARY KEY (\`uid\`),
    KEY \`idx_ac_schedules_campaign\` (\`campaign_uid\`),
    CONSTRAINT \`fk_ac_schedules_campaign\`
      FOREIGN KEY (\`campaign_uid\`) REFERENCES \`ac_campaigns\` (\`uid\`) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS \`ac_dnc\` (
    \`uid\` INT NOT NULL AUTO_INCREMENT,
    \`vpbx_user_uid\` INT NOT NULL,
    \`scope\` VARCHAR(16) NOT NULL DEFAULT 'global',
    \`scope_uid\` INT NULL,
    \`normalized_phone\` VARCHAR(64) NOT NULL,
    \`reason\` VARCHAR(255) NOT NULL DEFAULT '',
    \`source\` VARCHAR(64) NOT NULL DEFAULT 'manual',
    \`expires_at\` DATETIME NULL,
    \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (\`uid\`),
    UNIQUE KEY \`uq_ac_dnc\` (\`vpbx_user_uid\`, \`scope\`, \`scope_uid\`, \`normalized_phone\`),
    KEY \`idx_ac_dnc_phone\` (\`vpbx_user_uid\`, \`normalized_phone\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS \`ac_tasks\` (
    \`uid\` INT NOT NULL AUTO_INCREMENT,
    \`vpbx_user_uid\` INT NOT NULL,
    \`campaign_uid\` INT NOT NULL,
    \`contact_uid\` INT NOT NULL,
    \`phone_uid\` INT NOT NULL,
    \`status\` VARCHAR(16) NOT NULL DEFAULT 'pending',
    \`attempt_count\` INT NOT NULL DEFAULT 0,
    \`next_attempt_at\` DATETIME NULL,
    \`last_disposition\` VARCHAR(24) NOT NULL DEFAULT 'new',
    \`last_cause\` VARCHAR(64) NULL,
    \`leased_by\` VARCHAR(64) NULL,
    \`leased_at\` DATETIME NULL,
    \`priority\` INT NOT NULL DEFAULT 0,
    \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
    \`updated_at\` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (\`uid\`),
    KEY \`idx_ac_tasks_scan\` (\`vpbx_user_uid\`, \`campaign_uid\`, \`status\`, \`next_attempt_at\`),
    KEY \`idx_ac_tasks_contact\` (\`campaign_uid\`, \`contact_uid\`),
    CONSTRAINT \`fk_ac_tasks_campaign\`
      FOREIGN KEY (\`campaign_uid\`) REFERENCES \`ac_campaigns\` (\`uid\`) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS \`ac_attempts\` (
    \`uid\` INT NOT NULL AUTO_INCREMENT,
    \`vpbx_user_uid\` INT NOT NULL,
    \`task_uid\` INT NOT NULL,
    \`campaign_uid\` INT NOT NULL,
    \`attempt_no\` INT NOT NULL DEFAULT 1,
    \`started_at\` DATETIME NOT NULL,
    \`answered_at\` DATETIME NULL,
    \`ended_at\` DATETIME NULL,
    \`duration\` INT NOT NULL DEFAULT 0,
    \`billsec\` INT NOT NULL DEFAULT 0,
    \`disposition\` VARCHAR(24) NOT NULL DEFAULT 'dialing',
    \`hangup_cause\` VARCHAR(64) NULL,
    \`trunk_id\` VARCHAR(128) NULL,
    \`caller_id\` VARCHAR(64) NULL,
    \`channel_id\` VARCHAR(128) NULL,
    \`uniqueid\` VARCHAR(64) NULL,
    \`linkedid\` VARCHAR(64) NULL,
    \`amd_result\` VARCHAR(32) NULL,
    \`queue_name\` VARCHAR(128) NULL,
    \`agent_interface\` VARCHAR(128) NULL,
    \`talk_sec\` INT NOT NULL DEFAULT 0,
    \`scenario_result\` JSON NULL,
    PRIMARY KEY (\`uid\`),
    UNIQUE KEY \`uq_ac_attempts_channel\` (\`channel_id\`),
    KEY \`idx_ac_attempts_campaign\` (\`campaign_uid\`, \`started_at\`),
    KEY \`idx_ac_attempts_task\` (\`task_uid\`),
    CONSTRAINT \`fk_ac_attempts_task\`
      FOREIGN KEY (\`task_uid\`) REFERENCES \`ac_tasks\` (\`uid\`) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS \`ac_daily_campaign_stats\` (
    \`uid\` INT NOT NULL AUTO_INCREMENT,
    \`vpbx_user_uid\` INT NOT NULL,
    \`campaign_uid\` INT NOT NULL,
    \`day\` DATE NOT NULL,
    \`dials\` INT NOT NULL DEFAULT 0,
    \`answered\` INT NOT NULL DEFAULT 0,
    \`success\` INT NOT NULL DEFAULT 0,
    \`short\` INT NOT NULL DEFAULT 0,
    \`no_answer\` INT NOT NULL DEFAULT 0,
    \`busy\` INT NOT NULL DEFAULT 0,
    \`amd\` INT NOT NULL DEFAULT 0,
    \`failed\` INT NOT NULL DEFAULT 0,
    \`talk_sec_sum\` INT NOT NULL DEFAULT 0,
    \`billsec_sum\` INT NOT NULL DEFAULT 0,
    PRIMARY KEY (\`uid\`),
    UNIQUE KEY \`uq_ac_daily\` (\`campaign_uid\`, \`day\`),
    KEY \`idx_ac_daily_tenant\` (\`vpbx_user_uid\`, \`day\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS \`ac_channel_reservations\` (
    \`uid\` INT NOT NULL AUTO_INCREMENT,
    \`vpbx_user_uid\` INT NOT NULL,
    \`campaign_uid\` INT NOT NULL,
    \`task_uid\` INT NOT NULL,
    \`trunk_id\` VARCHAR(128) NOT NULL,
    \`owner\` VARCHAR(64) NOT NULL,
    \`expires_at\` DATETIME NOT NULL,
    \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (\`uid\`),
    UNIQUE KEY \`uq_ac_res_task\` (\`task_uid\`),
    KEY \`idx_ac_res_trunk\` (\`vpbx_user_uid\`, \`trunk_id\`, \`expires_at\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
];

export async function setupAutodialSchema(sequelize: {
  query: (sql: string) => Promise<unknown>;
  getQueryInterface?: () => { sequelize?: { query: (sql: string) => Promise<unknown> } };
}): Promise<void> {
  const qi = sequelize.getQueryInterface?.();
  const target = qi?.sequelize ?? sequelize;
  const exec = (sql: string) => (qi?.sequelize?.query ?? sequelize.query).call(target, sql);
  for (const statement of AUTODIAL_SCHEMA_STATEMENTS) {
    await exec(statement);
    console.log('[autodial-schema] OK:', statement.slice(0, 60).replace(/\s+/g, ' '), '…');
  }
  await alterIdempotent(
    exec,
    'ac_campaigns.applied_revision',
    'ALTER TABLE `ac_campaigns` ADD COLUMN `applied_revision` INT NULL',
  );
  await alterIdempotent(
    exec,
    'ac_campaigns.apply_error',
    'ALTER TABLE `ac_campaigns` ADD COLUMN `apply_error` VARCHAR(255) NULL',
  );
  await alterIdempotent(
    exec,
    'ac_campaigns.pacer_owner',
    'ALTER TABLE `ac_campaigns` ADD COLUMN `pacer_owner` VARCHAR(64) NULL',
  );
  await alterIdempotent(
    exec,
    'ac_campaigns.pacer_heartbeat_at',
    'ALTER TABLE `ac_campaigns` ADD COLUMN `pacer_heartbeat_at` DATETIME NULL',
  );
  try {
    await exec(
      'UPDATE `ac_campaigns` SET `applied_revision` = `revision` WHERE `applied_revision` IS NULL',
    );
  } catch (err: unknown) {
    console.log('[autodial-schema] applied_revision backfill skipped:', String(err));
  }
  console.log('[autodial-schema] All tables ready');
}

async function alterIdempotent(
  exec: (sql: string) => Promise<unknown>,
  label: string,
  sql: string,
): Promise<void> {
  try {
    await exec(sql);
    console.log(`[autodial-schema] ${label}: applied`);
  } catch (err: unknown) {
    const msg = String((err as { message?: string })?.message || err);
    if (msg.includes('Duplicate column name') || msg.includes('Duplicate')) {
      console.log(`[autodial-schema] ${label}: already applied — ok`);
      return;
    }
    throw err;
  }
}

async function main(): Promise<void> {
  const path = await import('path');
  const dotenv = await import('dotenv');
  dotenv.config({ path: path.resolve(__dirname, '../../../../../.env') });

  const { Sequelize } = await import('sequelize');
  const sequelize = new Sequelize({
    dialect: 'mysql',
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    username: process.env.DB_USER || 'krasterisk',
    password: process.env.DB_PASSWORD || process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'krasterisk',
    logging: false,
  });
  try {
    await setupAutodialSchema(sequelize);
  } finally {
    await sequelize.close();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
