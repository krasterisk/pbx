import { Sequelize } from 'sequelize-typescript';
import { DataTypes, QueryInterface } from 'sequelize';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../../../../.env') });

/**
 * Phase 7 call cards migration (D-10..D-13).
 *
 * Standalone script — no migration framework (app.module.ts: synchronize: false).
 *
 * 1. CREATE cc_card_templates — template + auto_open_on + webhook integration ref.
 * 2. CREATE cc_card_fields — configurable field definitions per template.
 * 3. CREATE cc_card_data — saved card values per call.
 *
 * Run (from packages/backend):
 *   npx ts-node src/modules/callcenter/migrate-callcenter-cards-phase7.ts
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

  console.log('[migration] Creating cc_card_templates...');
  await qi.createTable('cc_card_templates', {
    uid: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING(128), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    auto_open_on: {
      type: DataTypes.ENUM('answer', 'ring', 'manual'),
      allowNull: false,
      defaultValue: 'answer',
    },
    auto_save_on_timeout: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    webhook_integration_uid: { type: DataTypes.INTEGER, allowNull: true, defaultValue: null },
    webhook_field_map: { type: DataTypes.JSON, allowNull: true, defaultValue: null },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: true },
    vpbx_user_uid: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  }, { ifNotExists: true } as any);

  try {
    await qi.addIndex('cc_card_templates', ['vpbx_user_uid'], { name: 'idx_cc_card_templates_user_uid' });
  } catch (e) {
    console.log('[migration] idx_cc_card_templates_user_uid:', (e as Error).message);
  }

  console.log('[migration] Creating cc_card_fields...');
  await qi.createTable('cc_card_fields', {
    uid: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    template_id: { type: DataTypes.INTEGER, allowNull: false },
    field_key: { type: DataTypes.STRING(64), allowNull: false },
    field_type: {
      type: DataTypes.ENUM(
        'text',
        'textarea',
        'phone',
        'email',
        'select',
        'multi_select',
        'date',
        'datetime',
        'number',
        'checkbox',
        'phonebook_lookup',
        'divider',
        'heading',
        'readonly',
      ),
      allowNull: false,
    },
    label: { type: DataTypes.STRING(128), allowNull: false },
    placeholder: { type: DataTypes.STRING(256), allowNull: true, defaultValue: '' },
    is_required: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    default_value: { type: DataTypes.STRING(256), allowNull: true, defaultValue: '' },
    options: { type: DataTypes.JSON, allowNull: true },
    depends_on: { type: DataTypes.STRING(64), allowNull: true },
    depends_values: { type: DataTypes.JSON, allowNull: true },
    sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    width: { type: DataTypes.ENUM('full', 'half'), allowNull: false, defaultValue: 'full' },
    auto_populate: { type: DataTypes.STRING(64), allowNull: true },
    vpbx_user_uid: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  }, { ifNotExists: true } as any);

  try {
    await qi.addIndex('cc_card_fields', ['template_id'], { name: 'idx_cc_card_fields_template' });
  } catch (e) {
    console.log('[migration] idx_cc_card_fields_template:', (e as Error).message);
  }

  try {
    await qi.addIndex('cc_card_fields', ['vpbx_user_uid'], { name: 'idx_cc_card_fields_user_uid' });
  } catch (e) {
    console.log('[migration] idx_cc_card_fields_user_uid:', (e as Error).message);
  }

  try {
    await sequelize.query(
      'ALTER TABLE cc_card_fields ADD CONSTRAINT fk_cc_card_fields_template FOREIGN KEY (template_id) REFERENCES cc_card_templates(uid) ON DELETE CASCADE',
    );
  } catch (e) {
    console.log('[migration] fk_cc_card_fields_template already exists or failed:', (e as Error).message);
  }

  console.log('[migration] Creating cc_card_data...');
  await qi.createTable('cc_card_data', {
    uid: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    template_id: { type: DataTypes.INTEGER, allowNull: false },
    call_uniqueid: { type: DataTypes.STRING(64), allowNull: true, defaultValue: '' },
    caller_id: { type: DataTypes.STRING(32), allowNull: true, defaultValue: '' },
    queue_name: { type: DataTypes.STRING(64), allowNull: true, defaultValue: '' },
    agent_user_uid: { type: DataTypes.INTEGER, allowNull: true },
    status: {
      type: DataTypes.ENUM('draft', 'saved', 'missed', 'callback_done'),
      allowNull: false,
      defaultValue: 'saved',
    },
    field_values: { type: DataTypes.JSON, allowNull: false },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: true },
    vpbx_user_uid: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  }, { ifNotExists: true } as any);

  try {
    await qi.addIndex('cc_card_data', ['vpbx_user_uid'], { name: 'idx_cc_card_data_user_uid' });
  } catch (e) {
    console.log('[migration] idx_cc_card_data_user_uid:', (e as Error).message);
  }

  try {
    await qi.addIndex('cc_card_data', ['call_uniqueid'], { name: 'idx_cc_card_data_call' });
  } catch (e) {
    console.log('[migration] idx_cc_card_data_call:', (e as Error).message);
  }

  try {
    await qi.addIndex('cc_card_data', ['template_id'], { name: 'idx_cc_card_data_template' });
  } catch (e) {
    console.log('[migration] idx_cc_card_data_template:', (e as Error).message);
  }

  console.log('[migration] Phase 7 call-cards migration complete.');
  await sequelize.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
