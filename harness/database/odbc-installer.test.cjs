'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  ANALYTICS_ONLY_INDEPENDENT,
  generateOdbcInstall,
  loadCredentials,
  assertCdrMapping,
  assertNotLivePath,
  main,
} = require('./odbc-installer.cjs');

function writeCreds(extra = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'krasterisk-i4-cred-'));
  const file = path.join(dir, 'asterisk-odbc.credentials.json');
  fs.writeFileSync(file, `${JSON.stringify({
    dialect: 'mysql',
    host: '127.0.0.1',
    port: 3306,
    database: 'krasterisk_ci',
    appUser: 'krasterisk_app',
    appPassword: 'app-secret-not-for-odbc',
    asteriskUser: 'asterisk_odbc',
    asteriskPassword: 'odbc-secret-disposable',
    tls: false,
    cel: true,
    ...extra,
  }, null, 2)}\n`);
  return file;
}

test('installer keeps Asterisk and app users distinct and maps CDR aliases', () => {
  const creds = writeCreds();
  const parsed = loadCredentials(creds);
  assert.notEqual(parsed.asteriskUser, parsed.appUser);
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'krasterisk-i4-out-'));
  const result = generateOdbcInstall(out, parsed);
  assert.equal(result.manifest.analyticsOnlyIndependent, ANALYTICS_ONLY_INDEPENDENT);
  assert.equal(result.manifest.liveAdaptiveOdbcUntouched, true);
  assertCdrMapping(fs.readFileSync(path.join(out, 'cdr_adaptive_odbc.conf'), 'utf8'));
  const odbc = fs.readFileSync(path.join(out, 'odbc.ini'), 'utf8');
  assert.match(odbc, /asterisk_odbc/);
  assert.match(odbc, /odbc-secret-disposable/);
  assert.doesNotMatch(odbc, /krasterisk_app/);
  assert.match(fs.readFileSync(path.join(out, 'extconfig.conf'), 'utf8'), /queue_log => odbc,asterisk,queue_log/);
  assert.equal(fs.existsSync(path.join(out, 'cel_odbc.conf')), true);
});

test('same user, live paths, and live apply are refused', async () => {
  assert.throws(() => loadCredentials(writeCreds({ asteriskUser: 'krasterisk_app' })), /must differ/);
  assert.throws(() => assertNotLivePath('/etc/asterisk/res_odbc.conf'), /live Asterisk\/ODBC/);
  assert.throws(() => assertNotLivePath('/etc/odbc.ini'), /live Asterisk\/ODBC/);
  await assert.rejects(main(['--apply-live', '--generate', os.tmpdir()]), /live Adaptive ODBC/);
  await assert.rejects(main(['--from-live']), /live Adaptive ODBC/);
});

test('example templates keep placeholders and do not wait on analytics-only', () => {
  const example = fs.readFileSync(path.join(
    __dirname, '../../packages/backend/src/modules/asterisk-odbc/examples/asterisk-odbc.credentials.example.json',
  ), 'utf8');
  assert.match(example, /ASTERISK_ODBC_PASSWORD/);
  assert.match(example, /asterisk_odbc/);
  assert.equal(ANALYTICS_ONLY_INDEPENDENT, true);
  const res = fs.readFileSync(path.join(
    __dirname, '../../packages/backend/src/modules/asterisk-odbc/examples/res_odbc.conf.example',
  ), 'utf8');
  assert.match(res, /ASTERISK_ODBC_PASSWORD/);
  assert.doesNotMatch(res, /app-secret-not-for-odbc/);
});
