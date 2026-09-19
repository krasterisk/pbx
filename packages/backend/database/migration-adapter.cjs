'use strict';
const { toDriverConfig } = require('../src/database/database-config.cjs');

const JOURNAL = 'krasterisk_schema_migrations';
const STATE = 'krasterisk_schema_state';

// All methods use one dedicated connection, including the lock and journal writes.
async function connectAdapter(config) {
  const postgres = config.dialect === 'postgres';
  let db;
  if (postgres) {
    const { Client } = require('pg');
    db = new Client(toDriverConfig(config));
    // Connection loss must reject operations without an unhandled EventEmitter error.
    db.on('error', () => {});
  } else {
    db = await require('mysql2/promise').createConnection({ ...toDriverConfig(config), multipleStatements: true });
  }
  const query = async (sql, values = []) => {
    if (postgres) return (await db.query(sql, values)).rows;
    return (await db.query(sql, values))[0];
  };
  try {
    if (postgres) {
      await db.connect();
      await query('SET search_path TO public');
      // The offset is validated by the shared resolver, never arbitrary SQL input.
      await query(`SET TIME ZONE INTERVAL '${config.timezone}' HOUR TO MINUTE`);
    } else {
      await query('SET time_zone = ?', [config.timezone]);
    }
  } catch (error) {
    await db.end().catch(() => {});
    throw error;
  }
  const param = n => postgres ? `$${n}` : '?';
  const lockKey = "IF(CHAR_LENGTH(CONCAT(DATABASE(), ':migrations')) <= 64, CONCAT(DATABASE(), ':migrations'), SHA2(CONCAT(DATABASE(), ':migrations'), 256))";
  let locked = false;
  let closed = false;
  const adapter = {
    dialect: config.dialect,
    query,
    async acquireLock(timeoutMs) {
      if (!postgres) {
        const rows = await query(`SELECT GET_LOCK(${lockKey}, ?) AS acquired`, [timeoutMs / 1000]);
        locked = Number(rows[0].acquired) === 1;
      } else {
        const deadline = performance.now() + timeoutMs;
        do {
          const rows = await query("SELECT pg_try_advisory_lock(hashtext(current_database()), hashtext('krasterisk:migrations')) AS acquired");
          locked = rows[0].acquired;
          if (locked || performance.now() >= deadline) break;
          await new Promise(resolve => setTimeout(resolve, Math.min(50, Math.max(1, deadline - performance.now()))));
        } while (true);
      }
      return locked;
    },
    async releaseLock() {
      if (!locked || closed) return;
      if (postgres) await query("SELECT pg_advisory_unlock(hashtext(current_database()), hashtext('krasterisk:migrations'))");
      else await query(`SELECT RELEASE_LOCK(${lockKey})`);
      locked = false;
    },
    async close() {
      if (closed) return;
      closed = true;
      await db.end();
    },
    async tables() {
      const rows = postgres
        ? await query("SELECT table_name AS name FROM information_schema.tables WHERE table_schema = 'public'")
        : await query('SELECT table_name AS name FROM information_schema.tables WHERE table_schema = DATABASE()');
      if (!postgres) {
        const metadata = await query('SELECT ENGINE AS storage_engine FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name IN (?, ?)', [JOURNAL, STATE]);
        if (metadata.some(row => row.storage_engine?.toLowerCase() !== 'innodb')) {
          throw Object.assign(new Error('Migration metadata must use InnoDB'), { code: 'METADATA_NOT_TRANSACTIONAL' });
        }
      }
      return rows.map(row => row.name);
    },
    async readJournal() {
      return query(`SELECT name, checksum FROM ${JOURNAL} ORDER BY name`);
    },
    async readState() {
      const columns = postgres
        ? await query("SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 AND column_name = 'profile'", [STATE])
        : await query("SELECT column_name FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = 'profile'", [STATE]);
      return columns.length
        ? query(`SELECT id, engine, profile, dirty_name, dirty_checksum FROM ${STATE}`)
        : (await query(`SELECT id, engine, dirty_name, dirty_checksum FROM ${STATE}`))
          .map(row => ({ ...row, profile: null }));
    },
    async initialize(hasJournal, profile = 'full-pbx') {
      if (!hasJournal) {
        // Matches the existing MySQL journal. Never rewrite applied rows or checksums.
        await query(`CREATE TABLE ${JOURNAL} (name VARCHAR(255) PRIMARY KEY, checksum CHAR(64) NOT NULL, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)${postgres ? '' : ' ENGINE=InnoDB'}`);
      }
      await query(`CREATE TABLE ${STATE} (id INTEGER PRIMARY KEY, engine VARCHAR(16) NOT NULL, profile VARCHAR(32) NOT NULL, dirty_name VARCHAR(255), dirty_checksum CHAR(64))${postgres ? '' : ' ENGINE=InnoDB'}`);
      await query(`INSERT INTO ${STATE} (id, engine, profile) VALUES (1, ${param(1)}, ${param(2)})`, [config.dialect, profile]);
    },
    async ensureProfile(profile) {
      // Existing journals are only full-pbx. The lock is held and inspect has
      // verified the complete legacy prefix before this additive metadata DDL.
      if (profile !== 'full-pbx') throw new Error('Unsupported legacy profile upgrade');
      await query(`ALTER TABLE ${STATE} ADD COLUMN profile VARCHAR(32) NOT NULL DEFAULT 'full-pbx'`);
    },
    async markDirty(migration) {
      await query(`UPDATE ${STATE} SET dirty_name = ${param(1)}, dirty_checksum = ${param(2)} WHERE id = 1`, [migration.id, migration.checksum]);
    },
    async apply(migration) {
      // PG DDL + journal commit together. MySQL DDL implicitly commits; its dirty
      // marker survives a partial apply. Both engines require reviewed recovery.
      try {
        if (postgres) await query('BEGIN');
        await query(migration.sql);
        if (!postgres) await query('START TRANSACTION');
        await query(`INSERT INTO ${JOURNAL} (name, checksum) VALUES (${param(1)}, ${param(2)})`, [migration.id, migration.checksum]);
        await query(`UPDATE ${STATE} SET dirty_name = NULL, dirty_checksum = NULL WHERE id = 1`);
        await query('COMMIT');
      } catch (error) {
        await query('ROLLBACK').catch(() => {});
        throw error;
      }
    },
  };
  return adapter;
}

module.exports = { connectAdapter, JOURNAL, STATE };
