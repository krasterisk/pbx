const mysql = require('mysql2/promise');

(async () => {
  const conn = await mysql.createConnection({
    host: 'ipbx.krasterisk.ru',
    port: 3306,
    user: 'krasterisk',
    password: 'gfhjkm',
    database: 'krasterisk',
  });

  // 1. Create queue_table if not exists (Asterisk Realtime)
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS queue_table (
      name VARCHAR(128) NOT NULL PRIMARY KEY,
      musiconhold VARCHAR(128) DEFAULT NULL,
      announce VARCHAR(128) DEFAULT NULL,
      context VARCHAR(128) DEFAULT NULL,
      timeout INT DEFAULT NULL,
      strategy VARCHAR(128) DEFAULT NULL,
      retry INT DEFAULT NULL,
      wrapuptime INT DEFAULT NULL,
      maxlen INT DEFAULT NULL,
      servicelevel INT DEFAULT NULL,
      weight INT DEFAULT NULL,
      joinempty VARCHAR(128) DEFAULT NULL,
      leavewhenempty VARCHAR(128) DEFAULT NULL,
      ringinuse TINYINT(1) DEFAULT NULL,
      announce_frequency INT DEFAULT NULL,
      announce_holdtime VARCHAR(128) DEFAULT NULL,
      announce_round_seconds INT DEFAULT NULL,
      periodic_announce VARCHAR(50) DEFAULT NULL,
      periodic_announce_frequency INT DEFAULT NULL,
      queue_youarenext VARCHAR(128) DEFAULT NULL,
      queue_thereare VARCHAR(128) DEFAULT NULL,
      queue_callswaiting VARCHAR(128) DEFAULT NULL,
      queue_holdtime VARCHAR(128) DEFAULT NULL,
      queue_minutes VARCHAR(128) DEFAULT NULL,
      queue_seconds VARCHAR(128) DEFAULT NULL,
      queue_lessthan VARCHAR(128) DEFAULT NULL,
      queue_thankyou VARCHAR(128) DEFAULT NULL,
      queue_reporthold VARCHAR(128) DEFAULT NULL,
      monitor_format VARCHAR(128) DEFAULT NULL,
      monitor_join TINYINT(1) DEFAULT NULL,
      memberdelay INT DEFAULT NULL,
      timeoutrestart TINYINT(1) DEFAULT NULL,
      reportholdtime TINYINT(1) DEFAULT NULL,
      eventmemberstatus TINYINT(1) DEFAULT NULL,
      eventwhencalled TINYINT(1) DEFAULT NULL,
      setinterfacevar TINYINT(1) DEFAULT NULL,
      min_announce_frequency INT DEFAULT NULL,
      announce_position VARCHAR(128) DEFAULT NULL,
      announce_position_limit INT DEFAULT NULL,
      autofill VARCHAR(10) DEFAULT NULL,
      setqueueentryvar TINYINT(1) DEFAULT NULL,
      setqueuevar TINYINT(1) DEFAULT NULL,
      display_name VARCHAR(255) DEFAULT NULL,
      vpbx_user_uid INT NOT NULL DEFAULT 0
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  console.log('✅ queue_table created (or already exists)');

  // 2. Create queue_member_table if not exists
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS queue_member_table (
      uniqueid INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      membername VARCHAR(40) DEFAULT NULL,
      queue_name VARCHAR(128) NOT NULL,
      interface VARCHAR(128) NOT NULL,
      penalty INT DEFAULT 0,
      paused INT DEFAULT 0,
      wrapuptime INT DEFAULT NULL,
      state_interface VARCHAR(128) DEFAULT NULL,
      vpbx_user_uid INT NOT NULL DEFAULT 0
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  console.log('✅ queue_member_table created (or already exists)');

  await conn.end();
  console.log('Done!');
})();
