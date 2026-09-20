'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  DIALECT_SWITCH_MESSAGE,
  FIXTURE_PROVIDER_SECRET,
  generateDisposableKey,
  encryptSecret,
  decryptSecret,
  readRestoredCredential,
  assertSameEngine,
  assertNoLiveSecrets,
  assertKeySidecarPresent,
  assertInvariantsMatch,
  writePack,
  readManifest,
  main,
} = require('./backup-restore.cjs');

function tempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test('DBR-07 dialect switch is a documented refusal, not a migration', () => {
  assert.throws(
    () => assertSameEngine({ dialect: 'mysql', profile: 'analytics-api' }, {
      DB_DIALECT: 'postgres', DB_SCHEMA_PROFILE: 'analytics-api',
    }),
    new RegExp(DIALECT_SWITCH_MESSAGE.replace(/[()]/g, '\\$&')),
  );
  assert.throws(
    () => assertSameEngine({ dialect: 'mysql', profile: 'analytics-api' }, {
      DB_DIALECT: 'mysql', DB_SCHEMA_PROFILE: 'robot-api',
    }),
    /schema profile mismatch/,
  );
  assert.doesNotThrow(() => assertSameEngine({ dialect: 'postgres', profile: 'analytics-api' }, {
    DB_DIALECT: 'postgres', DB_SCHEMA_PROFILE: 'analytics-api',
  }));
});

test('missing encryption key fail-closed and does not return empty secrets', () => {
  const secret = generateDisposableKey();
  const blob = encryptSecret(FIXTURE_PROVIDER_SECRET, { CC_AI_KEY_SECRET: secret });
  assert.match(blob, /^v2:primary:/);
  assert.equal(decryptSecret(blob, { CC_AI_KEY_SECRET: secret }), FIXTURE_PROVIDER_SECRET);
  assert.throws(() => decryptSecret(blob, {}), /AI_PROVIDER_KEY_UNAVAILABLE/);
  assert.throws(() => readRestoredCredential('', { CC_AI_KEY_SECRET: secret }), /AI_PROVIDER_KEY_UNAVAILABLE/);
  assert.throws(() => decryptSecret(blob, { CC_AI_KEY_SECRET: `${secret}wrong` }));
  let leaked = 'not-thrown';
  try {
    leaked = readRestoredCredential(blob, {});
  } catch (error) {
    assert.match(error.message, /AI_PROVIDER_KEY_UNAVAILABLE/);
    leaked = error.message;
  }
  assert.notEqual(leaked, '');
  assert.notEqual(leaked, FIXTURE_PROVIDER_SECRET);
});

test('pack keeps ciphertext and object fixtures; live secrets stay out', () => {
  const dir = tempDir('krasterisk-i2-unit-');
  const objects = path.join(dir, 'src-objects');
  fs.mkdirSync(path.join(objects, 'i2'), { recursive: true });
  fs.writeFileSync(path.join(objects, 'i2', 'asset.bin'), Buffer.from('I2-RESTORE-FIXTURE'));
  const pack = path.join(dir, 'pack');
  const secret = generateDisposableKey();
  writePack(pack, {
    manifest: {
      version: 1,
      dialect: 'mysql',
      profile: 'analytics-api',
      schemaVersion: '0020-ai-sku-catalog.sql',
      invariants: { schemaVersion: '0020-ai-sku-catalog.sql', ledgerSum: '8', jobIds: ['job'], assetIds: ['asset'], licenseBindings: ['1:speech_analytics:doc'] },
      keySidecar: 'encryption.key',
    },
    sql: "SET FOREIGN_KEY_CHECKS=0;\nINSERT INTO cc_ai_providers (encrypted_api_key) VALUES ('v2:primary:AAAA');\n",
    objectsDir: objects,
    encryptionKey: secret,
  });
  const manifest = readManifest(pack);
  assert.equal(manifest.dialect, 'mysql');
  assert.equal(fs.existsSync(path.join(pack, 'encryption.key')), true);
  assert.equal(fs.existsSync(path.join(pack, 'objects', 'i2', 'asset.bin')), true);
  assert.doesNotMatch(fs.readFileSync(path.join(pack, 'data.sql'), 'utf8'), new RegExp(FIXTURE_PROVIDER_SECRET));
  assert.throws(() => assertNoLiveSecrets(pack, { AI_PUBLISHER_PRIVATE_KEY: 'v2:primary:AAAA' }), /live secret/);
  assert.equal(assertKeySidecarPresent(pack), secret);
  const missing = path.join(dir, 'empty');
  fs.mkdirSync(missing);
  assert.throws(() => assertKeySidecarPresent(missing), /AI_PROVIDER_KEY_UNAVAILABLE/);
});

test('plaintext provider token is refused in the SQL dump', () => {
  const dir = tempDir('krasterisk-i2-plain-');
  assert.throws(() => writePack(dir, {
    manifest: { dialect: 'mysql' },
    sql: `INSERT INTO cc_ai_providers (encrypted_api_key) VALUES ('${FIXTURE_PROVIDER_SECRET}')`,
    encryptionKey: generateDisposableKey(),
  }), /live secret|plaintext/i);
});

test('invariants compare schema, ledger, jobs, assets, licenses', () => {
  const expected = {
    schemaVersion: '0020-ai-sku-catalog.sql',
    ledgerSum: '8',
    jobIds: ['aaaaaaaa-0000-4000-8000-000000000021'],
    assetIds: ['aaaaaaaa-0000-4000-8000-000000000022'],
    licenseBindings: ['2:speech_analytics:aaaaaaaa-0000-4000-8000-000000000025'],
  };
  assert.doesNotThrow(() => assertInvariantsMatch(expected, { ...expected }));
  assert.throws(() => assertInvariantsMatch(expected, { ...expected, ledgerSum: '0' }), /invariants mismatch/);
});

test('backup-restore refuses --rollback', async () => {
  await assert.rejects(main(['--rollback']), /Automatic rollback/);
});
