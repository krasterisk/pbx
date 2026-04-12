const mysql = require('mysql2/promise');

(async () => {
  const c = await mysql.createConnection({
    host: 'ipbx.krasterisk.ru',
    user: 'krasterisk',
    password: 'gfhjkm',
    database: 'krasterisk',
  });

  // ps_registrations: add missing columns for Asterisk 22
  const alterQueries = [
    "ALTER TABLE ps_registrations ADD COLUMN line enum('yes','no') DEFAULT NULL",
    "ALTER TABLE ps_registrations ADD COLUMN endpoint varchar(40) DEFAULT NULL",
    "ALTER TABLE ps_registrations ADD COLUMN type varchar(40) DEFAULT 'registration'",
    "ALTER TABLE ps_registrations MODIFY client_uri varchar(255)",
    "ALTER TABLE ps_registrations MODIFY server_uri varchar(255)",
  ];

  for (const sql of alterQueries) {
    try {
      await c.query(sql);
      console.log('OK:', sql.substring(0, 60) + '...');
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME') {
        console.log('SKIP (exists):', sql.substring(0, 60) + '...');
      } else {
        console.error('FAIL:', e.message);
      }
    }
  }

  // ps_endpoint_id_ips: add missing columns
  const idIpQueries = [
    "ALTER TABLE ps_endpoint_id_ips ADD COLUMN srv_lookups enum('yes','no') DEFAULT NULL",
    "ALTER TABLE ps_endpoint_id_ips ADD COLUMN match_header varchar(255) DEFAULT NULL",
    "ALTER TABLE ps_endpoint_id_ips ADD COLUMN type varchar(40) DEFAULT 'identify'",
  ];

  for (const sql of idIpQueries) {
    try {
      await c.query(sql);
      console.log('OK:', sql.substring(0, 60) + '...');
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME') {
        console.log('SKIP (exists):', sql.substring(0, 60) + '...');
      } else {
        console.error('FAIL:', e.message);
      }
    }
  }

  // Verify final structure
  const [regCols] = await c.query('DESCRIBE ps_registrations');
  console.log('\n--- ps_registrations ---');
  regCols.forEach(r => console.log(`  ${r.Field} ${r.Type}`));

  const [ipCols] = await c.query('DESCRIBE ps_endpoint_id_ips');
  console.log('\n--- ps_endpoint_id_ips ---');
  ipCols.forEach(r => console.log(`  ${r.Field} ${r.Type}`));

  await c.end();
  console.log('\nDone.');
})().catch(e => console.error(e));
