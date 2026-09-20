'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { GenericContainer, Wait } = require('testcontainers');
const { resolveDatabaseConfig } = require('../../packages/backend/src/database/database-config.cjs');
const { connectAdapter } = require('../../packages/backend/database/migration-adapter.cjs');
const { runMigrations, loadMigrations } = require('../../packages/backend/database/migration-runner.cjs');
const { writeCdr, writeQueueLog, writeCel, isUniqueViolation } = require('../../packages/backend/src/modules/asterisk-odbc/asterisk-odbc-writer.cjs');
const { applyLiveCharge } = require('./live-charge.cjs');
const images = require('./images.json');

const selected = process.argv.slice(2).filter(value => ['mysql', 'postgres'].includes(value));
if (process.argv.slice(2).some(value => !['mysql', 'postgres'].includes(value))) {
  throw new Error('Usage: node harness/database/run-db03.cjs [mysql|postgres]');
}

function sqlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function interpolate(sql, params, dialect) {
  if (dialect === 'postgres') {
    return sql.replace(/\$(\d+)/g, (_, index) => {
      const value = params[Number(index) - 1];
      return value == null ? 'NULL' : (typeof value === 'number' ? String(value) : sqlString(value));
    });
  }
  let cursor = 0;
  return sql.replace(/\?/g, () => {
    const value = params[cursor++];
    return value == null ? 'NULL' : (typeof value === 'number' ? String(value) : sqlString(value));
  });
}

for (const dialect of selected.length ? [...new Set(selected)] : ['mysql', 'postgres']) {
  const postgres = dialect === 'postgres';
  test(`${dialect}: DB-03 writer + live charge (${images[dialect]})`, { timeout: 720000 }, async t => {
    const password = crypto.randomBytes(24).toString('hex');
    const dbPort = postgres ? 5432 : 3306;
    const db = await new GenericContainer(images[dialect])
      .withEnvironment(postgres
        ? { POSTGRES_PASSWORD: password, POSTGRES_DB: 'krasterisk_db03' }
        : { MYSQL_ROOT_PASSWORD: password, MYSQL_ROOT_HOST: '%', MYSQL_DATABASE: 'krasterisk_db03' })
      .withExposedPorts(dbPort)
      .withWaitStrategy(Wait.forLogMessage(postgres ? /database system is ready to accept connections/ : /ready for connections/, 2))
      .withStartupTimeout(180000)
      .start();
    let adapter;
    t.after(async () => {
      try { if (adapter) await adapter.close(); } finally { await db.stop(); }
    });
    const environment = {
      DB_DIALECT: dialect, DB_HOST: db.getHost(), DB_PORT: String(db.getMappedPort(dbPort)),
      DB_USER: postgres ? 'postgres' : 'root', DB_PASSWORD: password, DB_NAME: 'krasterisk_db03',
    };
    const config = resolveDatabaseConfig(environment, { requireExplicitConnection: true });
    const deadline = performance.now() + 60000;
    for (;;) {
      try { adapter = await connectAdapter(config); break; }
      catch (error) {
        if (performance.now() >= deadline) throw error;
        await new Promise(resolve => setTimeout(resolve, 400));
      }
    }
    const applied = await runMigrations({ config, migrations: loadMigrations(dialect) });
    assert.equal(applied.schemaVersion, '0020-ai-sku-catalog.sql');
    const exec = async (sql, params) => {
      try {
        await adapter.query(interpolate(sql, params, dialect));
      } catch (error) {
        if (isUniqueViolation(error)) throw error;
        const wrapped = new Error(error instanceof Error ? error.message : String(error));
        if (error && typeof error === 'object' && 'code' in error) wrapped.code = error.code;
        throw wrapped;
      }
    };

    await t.test('queue_log and cel exist; cdr is not recreated', async () => {
      const tables = await adapter.tables();
      assert.ok(tables.includes('queue_log'));
      assert.ok(tables.includes('cel'));
      assert.ok(tables.includes('cdr'));
    });

    await t.test('portable CDR/queue_log/CEL writer is unique on replay', async () => {
      const cdr = {
        uniqueid: '1760000000.91', linkedid: '1760000000.91', calldate: '2026-09-20 11:00:00',
        src: '100', dst: 's', dcontext: 'krasterisk-ai-generated', disposition: 'ANSWERED',
        record: '8/calls/20260920/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', vpbx_user_uid: 8,
        clid: '"lab" <100>', channel: 'Local/s@krasterisk-ai-generated-0001;2',
      };
      assert.equal(await writeCdr(exec, dialect, cdr), 'inserted');
      assert.equal(await writeCdr(exec, dialect, cdr), 'replayed');
      const cdrRows = await adapter.query("SELECT uniqueid, record FROM cdr WHERE uniqueid='1760000000.91'");
      assert.equal(cdrRows.length, 1);
      assert.equal(cdrRows[0].record, '8/calls/20260920/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee');

      const ql = {
        time: '2026-09-20 11:00:01', callid: '1760000000.91', queuename: 'sales',
        agent: 'NONE', event: 'ENTERQUEUE', data1: '100',
      };
      assert.equal(await writeQueueLog(exec, dialect, ql), 'inserted');
      assert.equal(await writeQueueLog(exec, dialect, ql), 'replayed');
      const qlRows = await adapter.query("SELECT callid, event FROM queue_log WHERE callid='1760000000.91'");
      assert.equal(qlRows.length, 1);

      const cel = {
        eventtype: 'CHAN_START', eventtime: '2026-09-20 11:00:00', uniqueid: '1760000000.91',
        linkedid: '1760000000.91', channame: 'Local/s@krasterisk-ai-generated-0001;2', context: 'krasterisk-ai-generated',
      };
      assert.equal(await writeCel(exec, dialect, cel), 'inserted');
      assert.equal(await writeCel(exec, dialect, cel), 'replayed');
      const celRows = await adapter.query("SELECT uniqueid, eventtype FROM cel WHERE uniqueid='1760000000.91'");
      assert.equal(celRows.length, 1);
    });

    await t.test('BillingBalanceService.charge operationKey is unique and does not double-debit', async () => {
      await adapter.query(`INSERT INTO billing_balances (tenant_id, balance_kopecks, credit_limit_kopecks, currency, is_blocked, updated_at)
        VALUES (90001, 10000, 0, 'RUB', ${postgres ? 'FALSE' : '0'}, CURRENT_TIMESTAMP)`);
      const first = await applyLiveCharge(adapter, dialect, {
        tenantId: 90001, amountKopecks: 250, operationKey: 'ai-usage:db03-res-1', description: 'lab charge',
      });
      assert.equal(first.replay, false);
      assert.equal(first.balanceKopecks, 9750);
      const second = await applyLiveCharge(adapter, dialect, {
        tenantId: 90001, amountKopecks: 250, operationKey: 'ai-usage:db03-res-1', description: 'lab charge',
      });
      assert.equal(second.replay, true);
      assert.equal(second.balanceKopecks, 9750);
      const txs = await adapter.query("SELECT amount_kopecks, external_id FROM billing_transactions WHERE tenant_id=90001");
      assert.equal(txs.length, 1);
      assert.equal(Number(txs[0].amount_kopecks), 250);
    });
  });
}
