/**
 * Таблицы рекламаций «Командор» + справочники + hub-страница.
 *
 *   npx ts-node --transpile-only src/modules/komandor-claims/migrate-komandor-claims.ts
 */
import { Sequelize } from 'sequelize';
import * as fs from 'fs';
import * as path from 'path';

const envPath = path.resolve(__dirname, '../../../../../.env');
if (fs.existsSync(envPath)) {
  for (const ln of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const t = ln.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (process.env[k] === undefined) process.env[k] = v;
  }
}

const CHANNELS = ['Телефония', 'Автоответчик', 'Email', 'Чат', 'Соцсети'];
const TOPICS = [
  '.Консультация/справочная информация',
  '.Рекламация/качество',
  '.Программа лояльности Копилка',
  '.Персонал',
  '.Прочее',
];
const SUBTOPICS: Array<[string, string]> = [
  ['.Консультация/справочная информация', '(не установлено)'],
  ['.Консультация/справочная информация', 'Прочее'],
  ['.Консультация/справочная информация', 'Вопросы от сотрудников'],
  ['.Консультация/справочная информация', 'Вопросы поставщиков/партнеров'],
  ['.Консультация/справочная информация', 'Условия возврата товара/денег'],
  ['.Консультация/справочная информация', 'Забытый товар/оставленные вещи'],
  ['.Консультация/справочная информация', 'Контакты/режим работы'],
  ['.Консультация/справочная информация', 'Наличие/стоимость товара'],
];

async function main() {
  const sequelize = new Sequelize({
    dialect: 'mysql',
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    logging: false,
  });
  await sequelize.authenticate();

  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS komandor_stores (
      uid INT NOT NULL AUTO_INCREMENT,
      code VARCHAR(32) NULL,
      name VARCHAR(255) NOT NULL,
      address VARCHAR(512) NULL,
      city VARCHAR(128) NULL,
      directors JSON NULL,
      zdf JSON NULL,
      is_active TINYINT NOT NULL DEFAULT 1,
      user_uid INT NOT NULL DEFAULT 0,
      PRIMARY KEY (uid),
      KEY idx_komandor_stores_user (user_uid, is_active)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS komandor_dict (
      uid INT NOT NULL AUTO_INCREMENT,
      kind VARCHAR(32) NOT NULL,
      name VARCHAR(255) NOT NULL,
      parent_name VARCHAR(255) NULL,
      sort_order INT NOT NULL DEFAULT 0,
      is_active TINYINT NOT NULL DEFAULT 1,
      PRIMARY KEY (uid),
      KEY idx_komandor_dict_kind (kind, is_active)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS komandor_claims (
      uid BIGINT NOT NULL AUTO_INCREMENT,
      operator_id INT NULL,
      operator_name VARCHAR(255) NULL,
      request_date DATETIME NOT NULL,
      call_uniqueid VARCHAR(128) NULL,
      request_number VARCHAR(64) NULL,
      store_id INT NULL,
      store_code VARCHAR(64) NULL,
      store_name VARCHAR(512) NULL,
      store_address VARCHAR(512) NULL,
      directors JSON NULL,
      zdf JSON NULL,
      extra_recipients JSON NULL,
      extra_emails TEXT NULL,
      channel VARCHAR(64) NULL,
      topic VARCHAR(255) NULL,
      subtopic VARCHAR(255) NULL,
      description TEXT NULL,
      contact_info TEXT NULL,
      client_phone VARCHAR(32) NULL,
      client_email VARCHAR(255) NULL,
      sentiment VARCHAR(16) NOT NULL DEFAULT 'neutral',
      department_log JSON NULL,
      customer_response TEXT NULL,
      attachment_name VARCHAR(255) NULL,
      dept_attachment_name VARCHAR(255) NULL,
      request_status VARCHAR(20) NOT NULL DEFAULT 'new',
      sms_status VARCHAR(20) NOT NULL DEFAULT 'not_sent',
      email_status VARCHAR(20) NOT NULL DEFAULT 'not_sent',
      store_email_status VARCHAR(20) NOT NULL DEFAULT 'not_sent',
      user_uid INT NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (uid),
      UNIQUE KEY uk_komandor_request_number (request_number),
      KEY idx_komandor_claims_user (user_uid, request_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  const [dictCount]: any = await sequelize.query('SELECT COUNT(*) AS c FROM komandor_dict');
  if (!Number(dictCount[0]?.c)) {
    let order = 0;
    for (const name of CHANNELS) {
      await sequelize.query(
        'INSERT INTO komandor_dict (kind, name, parent_name, sort_order) VALUES (?, ?, NULL, ?)',
        { replacements: ['channel', name, order++] },
      );
    }
    order = 0;
    for (const name of TOPICS) {
      await sequelize.query(
        'INSERT INTO komandor_dict (kind, name, parent_name, sort_order) VALUES (?, ?, NULL, ?)',
        { replacements: ['topic', name, order++] },
      );
    }
    order = 0;
    for (const [parent, name] of SUBTOPICS) {
      await sequelize.query(
        'INSERT INTO komandor_dict (kind, name, parent_name, sort_order) VALUES (?, ?, ?, ?)',
        { replacements: ['subtopic', name, parent, order++] },
      );
    }
    console.log('Seeded komandor_dict');
  }

  const [storeCount]: any = await sequelize.query('SELECT COUNT(*) AS c FROM komandor_stores');
  if (!Number(storeCount[0]?.c)) {
    await sequelize.query(
      `INSERT INTO komandor_stores (code, name, address, city, directors, zdf, user_uid)
       VALUES (?, ?, ?, ?, ?, ?, 0)`,
      {
        replacements: [
          'К-205',
          'Супермаркет Командор',
          '665824, Иркутская обл, Ангарск г, 192-й кв-л, дом № 12',
          'Ангарск',
          JSON.stringify([{ name: 'Анна Попова', email: '' }]),
          JSON.stringify([{ name: 'Светлана Макеева', email: '' }]),
        ],
      },
    );
    console.log('Seeded example store К-205');
  }

  try {
    const [hub]: any = await sequelize.query(
      `SELECT id FROM hub_module_pages WHERE hub_code='callcenter' AND page_code='komandor_claims' LIMIT 1`,
    );
    if (!hub.length) {
      await sequelize.query(
        `INSERT INTO hub_module_pages (hub_code, page_code, path, sort_order)
         VALUES ('callcenter', 'komandor_claims', '/komandor-claims', 15)`,
      );
      console.log('Inserted hub page komandor_claims');
    }
  } catch {
    console.log('hub_module_pages skip (table may be missing)');
  }

  try {
    const [mod]: any = await sequelize.query(
      `SELECT id FROM modules_registry WHERE code='komandor_claims' LIMIT 1`,
    );
    if (!mod.length) {
      await sequelize.query(
        `INSERT INTO modules_registry (code, name, category, is_core, is_paid, price_monthly)
         VALUES ('komandor_claims', 'Рекламации Командор', 'calls', 0, 1, 1500)`,
      );
      console.log('Inserted modules_registry komandor_claims');
    }
  } catch {
    console.log('modules_registry skip');
  }

  console.log('komandor claims migrate done');
  await sequelize.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
