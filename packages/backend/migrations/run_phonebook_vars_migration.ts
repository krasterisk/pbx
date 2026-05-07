/**
 * Migration script: Phonebook universal vars
 * Adds `comment` and `vars` JSON columns, migrates data, drops old columns.
 *
 * Run: npx ts-node packages/backend/migrations/run_phonebook_vars_migration.ts
 */
import { Sequelize } from 'sequelize-typescript';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

async function run() {
  const sequelize = new Sequelize({
    dialect: (process.env.DB_DIALECT as any) || 'mysql',
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '3306', 10),
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    logging: console.log,
  });

  try {
    await sequelize.authenticate();
    console.log('✅ Connected to database');

    const qi = sequelize.getQueryInterface();

    // Check if migration already applied (comment column exists)
    const tableDesc = await qi.describeTable('route_phonebook_entries') as Record<string, any>;
    if (tableDesc.comment) {
      console.log('⚠️  Migration already applied (comment column exists). Skipping.');
      await sequelize.close();
      return;
    }

    console.log('\n📋 Current table structure:', Object.keys(tableDesc).join(', '));

    // Step 1: Add new columns
    console.log('\n🔄 Step 1: Adding comment and vars columns...');
    await sequelize.query(`
      ALTER TABLE route_phonebook_entries
        ADD COLUMN comment VARCHAR(255) DEFAULT '' AFTER number,
        ADD COLUMN vars JSON DEFAULT NULL AFTER comment
    `);
    console.log('✅ Columns added');

    // Step 2: Migrate data from old fields
    console.log('\n🔄 Step 2: Migrating data from label/dialto fields into vars...');
    await sequelize.query(`
      UPDATE route_phonebook_entries
      SET
        comment = COALESCE(label, ''),
        vars = CASE
          WHEN (label IS NOT NULL AND label != '') OR dialto_exten IS NOT NULL OR dialto_context IS NOT NULL
          THEN JSON_OBJECT(
            'name', COALESCE(label, ''),
            'dialto_exten', COALESCE(dialto_exten, ''),
            'dialto_context', COALESCE(dialto_context, '')
          )
          ELSE NULL
        END
    `);

    // Step 3: Clean up empty values
    console.log('\n🔄 Step 3: Cleaning up empty values in vars...');
    await sequelize.query(`
      UPDATE route_phonebook_entries
      SET vars = JSON_REMOVE(vars, '$.name')
      WHERE vars IS NOT NULL AND JSON_UNQUOTE(JSON_EXTRACT(vars, '$.name')) = ''
    `);
    await sequelize.query(`
      UPDATE route_phonebook_entries
      SET vars = JSON_REMOVE(vars, '$.dialto_exten')
      WHERE vars IS NOT NULL AND JSON_UNQUOTE(JSON_EXTRACT(vars, '$.dialto_exten')) = ''
    `);
    await sequelize.query(`
      UPDATE route_phonebook_entries
      SET vars = JSON_REMOVE(vars, '$.dialto_context')
      WHERE vars IS NOT NULL AND JSON_UNQUOTE(JSON_EXTRACT(vars, '$.dialto_context')) = ''
    `);
    await sequelize.query(`
      UPDATE route_phonebook_entries
      SET vars = NULL
      WHERE vars = JSON_OBJECT()
    `);
    console.log('✅ Cleaned up');

    // Step 4: Show migrated data
    const [rows] = await sequelize.query('SELECT uid, number, comment, vars FROM route_phonebook_entries LIMIT 10');
    console.log('\n📊 Sample migrated data:', JSON.stringify(rows, null, 2));

    // Step 5: Drop old columns
    console.log('\n🔄 Step 5: Dropping old columns (label, dialto_context, dialto_exten)...');
    await sequelize.query(`
      ALTER TABLE route_phonebook_entries
        DROP COLUMN label,
        DROP COLUMN dialto_context,
        DROP COLUMN dialto_exten
    `);
    console.log('✅ Old columns dropped');

    // Verify final structure
    const finalDesc = await qi.describeTable('route_phonebook_entries') as Record<string, any>;
    console.log('\n📋 Final table structure:', Object.keys(finalDesc).join(', '));

    console.log('\n✅ Migration completed successfully!');
  } catch (err) {
    console.error('\n❌ Migration failed:', err);
  } finally {
    await sequelize.close();
  }
}

run();
