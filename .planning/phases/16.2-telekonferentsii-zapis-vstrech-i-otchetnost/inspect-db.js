/**
 * Phase 16.2 lab inspect — rooms / meetings / records path. No secrets printed.
 */
const path = require('path');
const {
  loadEnv,
  dbConn,
} = require('../16-modul-telekonferentsiy-confbridge-webrtc/uat-live-lib');

(async () => {
  const env = loadEnv();
  console.log('AMI_HOST', env.AMI_HOST, 'AMI_PORT', env.AMI_PORT);
  console.log('DB_HOST', env.DB_HOST, 'DB_NAME', env.DB_NAME);
  const conn = await dbConn(env);
  const [rooms] = await conn.query(
    `SELECT uid, vpbx_user_uid, number, name, record_mode
     FROM conference_rooms ORDER BY uid DESC LIMIT 20`,
  );
  console.log('rooms', JSON.stringify(rooms, null, 2));
  const [meetTbl] = await conn.query(`SHOW TABLES LIKE 'conference_meetings'`);
  console.log('meetings_table', meetTbl.length);
  if (meetTbl.length) {
    const [meet] = await conn.query(
      `SELECT uid, room_uid, has_recording, recording_file_rel
       FROM conference_meetings ORDER BY uid DESC LIMIT 5`,
    );
    console.log('meetings', JSON.stringify(meet, null, 2));
  }
  const [users] = await conn.query(
    `SELECT uniqueid, vpbx_user_uid FROM users
     WHERE vpbx_user_uid > 0 ORDER BY uniqueid ASC LIMIT 5`,
  );
  console.log('users', JSON.stringify(users));
  const [tables] = await conn.query(`SHOW TABLES`);
  const names = tables.map((r) => Object.values(r)[0]);
  const interesting = names.filter((n) => /setting|config|record/i.test(n));
  console.log('setting_tables', interesting);
  for (const table of interesting) {
    try {
      const [cols] = await conn.query(`SHOW COLUMNS FROM \`${table}\``);
      const colNames = cols.map((c) => c.Field);
      console.log(`table ${table} cols`, colNames.join(','));
      if (colNames.some((c) => /record|path|key/i.test(c))) {
        const [rows] = await conn.query(`SELECT * FROM \`${table}\` LIMIT 30`);
        for (const row of rows) {
          const safe = {};
          for (const [k, v] of Object.entries(row)) {
            if (/secret|password|token/i.test(k)) continue;
            if (/record|path|key|name|value/i.test(k)) safe[k] = v;
          }
          if (Object.keys(safe).length) console.log(' cfg', safe);
        }
      }
    } catch (e) {
      console.log('table_err', table, e.message);
    }
  }
  await conn.end();
})().catch((e) => {
  console.error('DBERR', e.message);
  process.exit(1);
});
