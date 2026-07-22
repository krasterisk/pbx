/**
 * Phase 9 call-center-agent-panel — Wave 1 schema foundation (09-01).
 *
 * Idempotent standalone migration (pattern: migrate-missed-calls-unique.ts) — no
 * migration framework in this repo (app.module.ts: synchronize: false).
 *
 * Covers every Phase 9 wave-1 schema change so no later plan is blocked on a
 * `[BLOCKING]` schema push:
 *   1. cc_agent_events.event_type ENUM  += DIALING, CONSULT, ACW           (D-09/D-13)
 *   2. cc_missed_calls                  += client_called_back, personal   (D-16/D-17/D-19)
 *   3. cc_operator_settings             += can_spy, spyable, click_to_call,
 *                                          customize_ui, spy_modes, ui_visibility,
 *                                          softphone_placement, notification_matrix (D-38/D-41/D-43)
 *   4. cc_settings                      += role_permission_defaults, ui_visibility_defaults,
 *                                          ui_visibility_locks, notification_defaults,
 *                                          notification_locks, autopause_rules (D-15/D-39/D-43)
 *   5. cc_queue_calls                   += direction, call_type            (D-34/D-35)
 *
 * Run (automated):
 *   npx ts-node src/modules/callcenter/migrate-callcenter-phase9-schema.ts (from packages/backend)
 */
import { Sequelize } from 'sequelize-typescript';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../../../../.env') });

/** Run one ALTER TABLE, treating "already applied" errors as a no-op. */
async function alterIdempotent(sequelize: Sequelize, label: string, sql: string): Promise<void> {
  try {
    await sequelize.query(sql);
    console.log(`[migration] ${label}: applied`);
  } catch (err: any) {
    const msg = String(err?.message || err);
    if (
      msg.includes('Duplicate column name') ||
      msg.includes('Duplicate key name') ||
      msg.includes('check that column/key exists') ||
      msg.includes('already exists') ||
      msg.includes('Duplicate')
    ) {
      console.log(`[migration] ${label}: already applied — ok`);
      return;
    }
    throw err;
  }
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

  try {
    // 1. cc_agent_events — extend event_type ENUM (D-09/D-13).
    // MODIFY COLUMN is naturally idempotent (re-applying the same definition is a no-op),
    // but we still route it through the same guarded helper for consistent logging.
    await alterIdempotent(
      sequelize,
      'cc_agent_events.event_type ENUM += DIALING,CONSULT,ACW',
      `ALTER TABLE cc_agent_events
       MODIFY COLUMN event_type ENUM(
         'LOGIN','LOGOUT','READY','PAUSE',
         'CALL_START','CALL_END',
         'WRAPUP_START','WRAPUP_END',
         'HOLD','UNHOLD',
         'DIALING','CONSULT','ACW'
       ) NOT NULL`,
    );

    // 2. cc_missed_calls — grouping/callback/personal flags (D-16/D-17/D-19).
    await alterIdempotent(
      sequelize,
      'cc_missed_calls.client_called_back',
      `ALTER TABLE cc_missed_calls
       ADD COLUMN client_called_back TINYINT(1) NOT NULL DEFAULT 0`,
    );
    await alterIdempotent(
      sequelize,
      'cc_missed_calls.personal',
      `ALTER TABLE cc_missed_calls
       ADD COLUMN personal TINYINT(1) NOT NULL DEFAULT 0`,
    );

    // 3. cc_operator_settings — granular permissions + UI customization + notifications (D-38/D-41/D-43).
    await alterIdempotent(
      sequelize,
      'cc_operator_settings.can_spy',
      `ALTER TABLE cc_operator_settings
       ADD COLUMN can_spy TINYINT(1) NOT NULL DEFAULT 0`,
    );
    await alterIdempotent(
      sequelize,
      'cc_operator_settings.spyable',
      `ALTER TABLE cc_operator_settings
       ADD COLUMN spyable TINYINT(1) NOT NULL DEFAULT 1`,
    );
    await alterIdempotent(
      sequelize,
      'cc_operator_settings.click_to_call',
      `ALTER TABLE cc_operator_settings
       ADD COLUMN click_to_call TINYINT(1) NOT NULL DEFAULT 0`,
    );
    await alterIdempotent(
      sequelize,
      'cc_operator_settings.customize_ui',
      `ALTER TABLE cc_operator_settings
       ADD COLUMN customize_ui TINYINT(1) NOT NULL DEFAULT 0`,
    );
    await alterIdempotent(
      sequelize,
      'cc_operator_settings.spy_modes',
      `ALTER TABLE cc_operator_settings
       ADD COLUMN spy_modes JSON NULL`,
    );
    await alterIdempotent(
      sequelize,
      'cc_operator_settings.ui_visibility',
      `ALTER TABLE cc_operator_settings
       ADD COLUMN ui_visibility JSON NULL`,
    );
    await alterIdempotent(
      sequelize,
      'cc_operator_settings.softphone_placement',
      `ALTER TABLE cc_operator_settings
       ADD COLUMN softphone_placement VARCHAR(16) NOT NULL DEFAULT 'bottom-right'`,
    );
    await alterIdempotent(
      sequelize,
      'cc_operator_settings.notification_matrix',
      `ALTER TABLE cc_operator_settings
       ADD COLUMN notification_matrix JSON NULL`,
    );
    // Backfill spy_modes default for existing rows (JSON columns can't carry a literal
    // DEFAULT in MySQL < 8.0.13-compatible-safe form here — set explicitly instead).
    await alterIdempotent(
      sequelize,
      'cc_operator_settings.spy_modes backfill',
      `UPDATE cc_operator_settings SET spy_modes = '["listen"]' WHERE spy_modes IS NULL`,
    );

    // 4. cc_settings — role-default permissions + UI/notification defaults & locks + autopause (D-15/D-39/D-43).
    await alterIdempotent(
      sequelize,
      'cc_settings.role_permission_defaults',
      `ALTER TABLE cc_settings
       ADD COLUMN role_permission_defaults JSON NULL`,
    );
    await alterIdempotent(
      sequelize,
      'cc_settings.ui_visibility_defaults',
      `ALTER TABLE cc_settings
       ADD COLUMN ui_visibility_defaults JSON NULL`,
    );
    await alterIdempotent(
      sequelize,
      'cc_settings.ui_visibility_locks',
      `ALTER TABLE cc_settings
       ADD COLUMN ui_visibility_locks JSON NULL`,
    );
    await alterIdempotent(
      sequelize,
      'cc_settings.notification_defaults',
      `ALTER TABLE cc_settings
       ADD COLUMN notification_defaults JSON NULL`,
    );
    await alterIdempotent(
      sequelize,
      'cc_settings.notification_locks',
      `ALTER TABLE cc_settings
       ADD COLUMN notification_locks JSON NULL`,
    );
    await alterIdempotent(
      sequelize,
      'cc_settings.autopause_rules',
      `ALTER TABLE cc_settings
       ADD COLUMN autopause_rules JSON NULL`,
    );

    // 5. cc_queue_calls — direction/call_type so history covers all channels (D-34/D-35).
    await alterIdempotent(
      sequelize,
      'cc_queue_calls.direction',
      `ALTER TABLE cc_queue_calls
       ADD COLUMN direction VARCHAR(16) NOT NULL DEFAULT 'inbound'`,
    );
    await alterIdempotent(
      sequelize,
      'cc_queue_calls.call_type',
      `ALTER TABLE cc_queue_calls
       ADD COLUMN call_type VARCHAR(32) NULL DEFAULT ''`,
    );

    console.log('[migration] Phase 9 callcenter schema migration complete.');
  } finally {
    await sequelize.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
