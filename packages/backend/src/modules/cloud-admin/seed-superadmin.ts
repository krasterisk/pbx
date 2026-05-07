/**
 * Seed script: создаёт первого SuperAdmin (level=0).
 * Запуск: npx ts-node --project packages/backend/tsconfig.json packages/backend/src/modules/cloud-admin/seed-superadmin.ts
 */
import * as path from 'path';
import * as dotenv from 'dotenv';
import * as bcrypt from 'bcrypt';
import { Sequelize } from 'sequelize';

dotenv.config({ path: path.resolve(__dirname, '../../../../../.env') });

const LOGIN    = 'superadmin';
const PASSWORD = 'KrAdmin2026!';
const NAME     = 'Super Administrator';
const EMAIL    = 'admin@krasterisk.ru';

async function main() {
  const sequelize = new Sequelize({
    dialect: 'mysql',
    host:     process.env.DB_HOST,
    port:     Number(process.env.DB_PORT) || 3306,
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    logging:  false,
  });

  await sequelize.authenticate();
  console.log('✅ DB connected');

  // Проверяем, нет ли уже superadmin
  const [existing]: any = await sequelize.query(
    `SELECT uniqueid, login, level FROM users WHERE login = ? OR level = 0 LIMIT 1`,
    { replacements: [LOGIN] }
  );

  if (existing.length > 0) {
    const u = existing[0];
    console.log(`⚠️  SuperAdmin уже существует:`);
    console.log(`   ID: ${u.uniqueid}  Login: ${u.login}  Level: ${u.level}`);
    console.log(`   Обновляю level=0 и пароль...`);

    const hash = await bcrypt.hash(PASSWORD, 12);
    await sequelize.query(
      `UPDATE users SET level = 0, passwd = ?, vpbx_user_uid = uniqueid, name = ? WHERE uniqueid = ?`,
      { replacements: [hash, NAME, u.uniqueid] }
    );
    console.log(`✅ Пользователь обновлён.`);
  } else {
    const hash = await bcrypt.hash(PASSWORD, 12);
    await sequelize.query(
      `INSERT INTO users (login, name, passwd, email, level, vpbx_user_uid, isActivated)
       VALUES (?, ?, ?, ?, 0, 0, 1)`,
      { replacements: [LOGIN, NAME, hash, EMAIL] }
    );

    // vpbx_user_uid = собственный uniqueid (SuperAdmin не привязан к тенанту)
    const [rows]: any = await sequelize.query(
      `SELECT uniqueid FROM users WHERE login = ? LIMIT 1`,
      { replacements: [LOGIN] }
    );
    // Для SuperAdmin vpbx_user_uid = 0 (платформенный уровень)
    console.log(`✅ SuperAdmin создан (ID: ${rows[0]?.uniqueid})`);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  ДАННЫЕ ДЛЯ ВХОДА');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  Login:    ${LOGIN}`);
  console.log(`  Password: ${PASSWORD}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  ⚠️  Смените пароль после первого входа!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  await sequelize.close();
}

main().catch((e) => { console.error('❌ Error:', e.message); process.exit(1); });
