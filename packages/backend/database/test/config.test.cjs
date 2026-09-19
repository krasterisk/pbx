'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { EventEmitter } = require('node:events');
const path = require('node:path');
const tls = require('node:tls');
const { resolveDatabaseConfig, toDriverConfig } = require('../../src/database/database-config.cjs');

test('legacy application defaults and dialect-specific default ports', () => {
  const mysql = resolveDatabaseConfig({});
  assert.equal(mysql.dialect, 'mysql');
  assert.equal(mysql.port, 3306);
  assert.equal(mysql.host, 'localhost');
  assert.equal(mysql.username, 'krasterisk');
  assert.equal(mysql.password, '');
  assert.equal(mysql.database, 'krasterisk');
  assert.equal(resolveDatabaseConfig({ DB_DIALECT: 'postgres', DB_PASSWORD: 'test-password' }).port, 5432);
  assert.equal(resolveDatabaseConfig({ DB_DIALECT: 'postgres', DB_PASSWORD: 'test-password', DB_PORT: '3307' }).port, 3307);
});

for (const input of [
  { DB_DIALECT: 'sqlite' }, { DB_DIALECT: '' }, { DB_PORT: '' },
  { DB_PORT: '0' }, { DB_PORT: '65536' }, { DB_PORT: '12.3' }, { DB_PORT: '1e3' },
  { DB_HOST: '' }, { DB_USER: '' }, { DB_NAME: '' }, { DB_PASSWORD: null },
  { DB_DIALECT: 'postgres', DB_PASSWORD: '' }, { DB_DIALECT: 'postgres' },
  { DB_SSL: 'yes' }, { DB_SSL_CA: 'certificate' },
  { DB_TIMEZONE: "UTC'; SELECT secret" }, { DB_TIMEZONE: '+14:30' },
  { DB_POOL_MIN: '6' }, { DB_POOL_MAX: '0' }, { DB_CONNECT_TIMEOUT_MS: '-1' },
  { DB_DIALECT: 'mysql', DB_STATEMENT_TIMEOUT_MS: '50' },
  { DB_DIALECT: 'postgres', DB_SOCKET: '/tmp/mysql.sock' },
]) {
  test(`invalid config rejects ${Object.keys(input).join('/')}`, () => assert.throws(() => resolveDatabaseConfig(input), /Invalid database configuration/));
}

test('CLI requires explicit connection fields, including intentionally empty password', () => {
  const complete = { DB_HOST: '127.0.0.1', DB_USER: 'test', DB_PASSWORD: '', DB_NAME: 'test' };
  assert.doesNotThrow(() => resolveDatabaseConfig(complete, { requireExplicitConnection: true }));
  for (const key of Object.keys(complete)) {
    const partial = { ...complete };
    delete partial[key];
    assert.throws(() => resolveDatabaseConfig(partial, { requireExplicitConnection: true }), new RegExp(key));
  }
});

test('TLS, socket and timeout options stay in their driver dialect', () => {
  const common = { DB_SSL: 'true', DB_SSL_CA: 'test CA', DB_CONNECT_TIMEOUT_MS: '1234' };
  const mysql = toDriverConfig(resolveDatabaseConfig({ ...common, DB_SOCKET: '/tmp/mysql.sock' }));
  const pg = toDriverConfig(resolveDatabaseConfig({ ...common, DB_DIALECT: 'postgres', DB_PASSWORD: 'test-password', DB_STATEMENT_TIMEOUT_MS: '500', DB_IDLE_TRANSACTION_TIMEOUT_MS: '600' }));
  assert.deepEqual(mysql.ssl, { rejectUnauthorized: true, verifyIdentity: true, ca: 'test CA' });
  assert.deepEqual(pg.ssl, { rejectUnauthorized: true, ca: 'test CA' });
  assert.equal(mysql.connectTimeout, 1234);
  assert.equal(mysql.connectionTimeoutMillis, undefined);
  assert.equal(mysql.socketPath, '/tmp/mysql.sock');
  assert.equal(pg.connectionTimeoutMillis, 1234);
  assert.equal(pg.connectTimeout, undefined);
  assert.equal(pg.socketPath, undefined);
  assert.equal(pg.statement_timeout, 500);
  assert.equal(pg.idle_in_transaction_session_timeout, 600);
  assert.equal(pg.timezone, undefined);
});

test('PostgreSQL config cannot inherit ambient TLS mode or password', () => {
  const { Client } = require('pg');
  const previousSslMode = process.env.PGSSLMODE;
  const previousPassword = process.env.PGPASSWORD;
  process.env.PGSSLMODE = 'no-verify';
  process.env.PGPASSWORD = 'ambient-password';
  try {
    const config = toDriverConfig(resolveDatabaseConfig({ DB_DIALECT: 'postgres', DB_PASSWORD: 'configured-password' }));
    const client = new Client(config);
    assert.equal(client.connectionParameters.ssl, false);
    assert.equal(client.connectionParameters.password, 'configured-password');
    assert.throws(() => resolveDatabaseConfig({ DB_DIALECT: 'postgres', DB_PASSWORD: '' }), /DB_PASSWORD/);
  } finally {
    if (previousSslMode === undefined) delete process.env.PGSSLMODE;
    else process.env.PGSSLMODE = previousSslMode;
    if (previousPassword === undefined) delete process.env.PGPASSWORD;
    else process.env.PGPASSWORD = previousPassword;
  }
});

test('mysql2 TLS connection rejects a trusted certificate for another host', () => {
  const BaseConnection = require(path.join(path.dirname(require.resolve('mysql2')), 'lib/base/connection.js'));
  const originalConnect = tls.connect;
  let options;
  tls.connect = (value) => {
    options = value;
    return new EventEmitter();
  };
  try {
    const config = toDriverConfig(resolveDatabaseConfig({ DB_SSL: 'true', DB_HOST: 'db.example.test' }));
    BaseConnection.prototype.startTLS.call({ config, stream: new EventEmitter() }, () => {});
    const wrongHost = { subject: { CN: 'unrelated.example.test' }, subjectaltname: 'DNS:unrelated.example.test' };
    assert.ok(options.checkServerIdentity('db.example.test', wrongHost));
  } finally {
    tls.connect = originalConnect;
  }
});

test('bad values do not leak credentials in configuration errors', () => {
  assert.throws(() => resolveDatabaseConfig({ DB_PORT: 'secret-password' }), error => !error.message.includes('secret-password'));
});

test('import has no connection, filesystem reads or logging side effects', () => {
  const modulePath = require.resolve('../../src/database/database-config.cjs');
  const result = spawnSync(process.execPath, ['-e', `
    const Module = require('node:module');
    const original = Module._load;
    Module._load = function (id, ...rest) {
      if (['pg', 'mysql2', 'mysql2/promise', 'dotenv', 'node:fs', 'fs'].includes(id)) throw new Error('Unexpected I/O dependency');
      return original.call(this, id, ...rest);
    };
    require(${JSON.stringify(modulePath)});
  `], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr, '');
});
