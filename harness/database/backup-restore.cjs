'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { resolveDatabaseConfig } = require('../../packages/backend/src/database/database-config.cjs');
const { connectAdapter } = require('../../packages/backend/database/migration-adapter.cjs');
const { CURRENT_SCHEMA } = require('./clean-install.cjs');

const JOURNAL = 'krasterisk_schema_migrations';
const STATE = 'krasterisk_schema_state';
const FIXTURE_PROVIDER_SECRET = 'i2-disposable-provider-token-not-for-production';
const DIALECT_SWITCH_MESSAGE = 'DB_DIALECT switch does not transfer data (DBR-07). Restore on the same engine or use a reviewed cross-engine transfer.';
const LIVE_SECRET_ENV = Object.freeze([
  'AI_PUBLISHER_PRIVATE_KEY',
  'ASTERISK_AMI_PASSWORD',
  'ARI_PASSWORD',
  'AWS_SECRET_ACCESS_KEY',
]);
const JOB_ID = 'aaaaaaaa-0000-4000-8000-000000000021';
const ASSET_ID = 'aaaaaaaa-0000-4000-8000-000000000022';
const RESERVATION_ID = 'aaaaaaaa-0000-4000-8000-000000000023';
const LEDGER_ID = 'aaaaaaaa-0000-4000-8000-000000000024';
const LICENSE_UID = 'aaaaaaaa-0000-4000-8000-000000000025';
const ALG = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;

function fail(message) {
  throw new Error(message);
}

function sqlParam(adapter, n) {
  return adapter.dialect === 'postgres' ? `$${n}` : '?';
}

function generateDisposableKey() {
  return crypto.randomBytes(32).toString('hex');
}

function encryptionKey(secret, id) {
  return crypto.scryptSync(secret, Buffer.from(`krsk-ai-providers-v2:${id}`), 32);
}

function encryptSecret(plain, env = {}) {
  const secret = env.CC_AI_KEY_SECRET;
  if (!secret) fail('AI_PROVIDER_KEY_UNAVAILABLE');
  if (Buffer.byteLength(secret, 'utf8') < 32) fail('AI_PROVIDER_KEY_TOO_SHORT');
  const id = env.CC_AI_KEY_ID || 'primary';
  if (!/^[A-Za-z0-9_-]{1,32}$/.test(id)) fail('AI_PROVIDER_KEY_ID_INVALID');
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALG, encryptionKey(secret, id), iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return `v2:${id}:${Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64')}`;
}

function decryptSecret(blob, env = {}) {
  if (!blob) fail('AI_PROVIDER_KEY_UNAVAILABLE');
  const match = /^v2:([A-Za-z0-9_-]{1,32}):(.+)$/.exec(blob);
  if (!match) fail('AI_PROVIDER_CIPHERTEXT_INVALID');
  const secret = env.CC_AI_KEY_SECRET;
  if (!secret) fail('AI_PROVIDER_KEY_UNAVAILABLE');
  const payload = Buffer.from(match[2], 'base64');
  if (payload.length < IV_LEN + TAG_LEN + 1) fail('AI_PROVIDER_CIPHERTEXT_INVALID');
  const decipher = crypto.createDecipheriv(ALG, encryptionKey(secret, match[1]), payload.subarray(0, IV_LEN));
  decipher.setAuthTag(payload.subarray(IV_LEN, IV_LEN + TAG_LEN));
  return Buffer.concat([decipher.update(payload.subarray(IV_LEN + TAG_LEN)), decipher.final()]).toString('utf8');
}

function readRestoredCredential(blob, env = {}) {
  if (!blob) fail('AI_PROVIDER_KEY_UNAVAILABLE');
  return decryptSecret(blob, env);
}

function assertSameEngine(backup, env = {}) {
  const dialect = env.DB_DIALECT;
  const profile = env.DB_SCHEMA_PROFILE;
  if (!backup || !backup.dialect) fail('backup manifest is missing dialect');
  if (backup.dialect !== dialect) fail(`${DIALECT_SWITCH_MESSAGE} Backup is ${backup.dialect}; restore target is ${dialect}.`);
  if (backup.profile && profile && backup.profile !== profile) {
    fail(`schema profile mismatch: backup ${backup.profile} vs restore ${profile}`);
  }
}

function ident(dialect, name) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) fail(`refusing to quote identifier ${name}`);
  return dialect === 'postgres' ? `"${name}"` : `\`${name}\``;
}

function quoteString(value) {
  return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;
}

function sqlLiteral(dialect, value) {
  if (value === null || value === undefined) return 'NULL';
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
    const hex = Buffer.from(value).toString('hex');
    return dialect === 'postgres' ? `'\\x${hex}'::bytea` : `X'${hex}'`;
  }
  if (value instanceof Date) {
    const pad = (n) => String(n).padStart(2, '0');
    const ms = String(value.getMilliseconds()).padStart(3, '0');
    return quoteString(`${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())} ${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}.${ms}`);
  }
  if (typeof value === 'boolean') return dialect === 'postgres' ? (value ? 'TRUE' : 'FALSE') : (value ? '1' : '0');
  if (typeof value === 'bigint' || typeof value === 'number') return String(value);
  if (typeof value === 'object') return quoteString(JSON.stringify(value));
  return quoteString(value);
}

function walkFiles(dir, prefix = '') {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkFiles(full, rel));
    else out.push(rel.replaceAll('\\', '/'));
  }
  return out.sort();
}

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name);
    const dest = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(src, dest);
    else fs.copyFileSync(src, dest);
  }
}

function assertNoLiveSecrets(packDir, env = {}, extraForbidden = []) {
  const forbidden = [
    ...LIVE_SECRET_ENV.map((name) => env[name]).filter(Boolean),
    FIXTURE_PROVIDER_SECRET,
    ...extraForbidden.filter(Boolean),
  ];
  const files = walkFiles(packDir);
  for (const rel of files) {
    if (rel === 'encryption.key') continue;
    const text = fs.readFileSync(path.join(packDir, rel));
    const body = text.toString('utf8');
    for (const secret of forbidden) {
      if (secret && body.includes(secret)) fail(`refusing to copy live secret into backup pack (${rel})`);
    }
    if (/BEGIN (RSA |OPENSSH |EC )?PRIVATE KEY/.test(body)) fail(`refusing private key material in backup pack (${rel})`);
  }
}

function assertKeySidecarPresent(packDir) {
  const sidecar = path.join(packDir, 'encryption.key');
  if (!fs.existsSync(sidecar)) fail('AI_PROVIDER_KEY_UNAVAILABLE');
  const secret = fs.readFileSync(sidecar, 'utf8').trim();
  if (!secret) fail('AI_PROVIDER_KEY_UNAVAILABLE');
  return secret;
}

async function dataTables(adapter) {
  const postgres = adapter.dialect === 'postgres';
  const rows = postgres
    ? await adapter.query("SELECT table_name AS name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'")
    : await adapter.query("SELECT table_name AS name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'");
  return rows.map((row) => row.name).filter((name) => name !== JOURNAL && name !== STATE).sort();
}

async function tableColumns(adapter, table) {
  const postgres = adapter.dialect === 'postgres';
  const rows = postgres
    ? await adapter.query(
      'SELECT column_name AS name FROM information_schema.columns WHERE table_schema = \'public\' AND table_name = $1 ORDER BY ordinal_position',
      [table],
    )
    : await adapter.query(
      'SELECT column_name AS name FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? ORDER BY ordinal_position',
      [table],
    );
  return rows.map((row) => row.name || row.NAME);
}

async function collectInvariants(adapter) {
  const journal = await adapter.query(`SELECT name FROM ${JOURNAL} ORDER BY name`);
  const ledger = await adapter.query('SELECT COALESCE(SUM(units), 0) AS units FROM ai_usage_ledger');
  const jobs = await adapter.query('SELECT id FROM ai_jobs ORDER BY id');
  const assets = await adapter.query('SELECT id FROM ai_media_assets ORDER BY id');
  const licenses = await adapter.query(
    'SELECT vpbx_user_uid, product, document_uid FROM ai_local_license_bindings ORDER BY vpbx_user_uid, product',
  );
  return {
    schemaVersion: journal.at(-1)?.name || null,
    ledgerSum: String(ledger[0].units),
    jobIds: jobs.map((row) => row.id),
    assetIds: assets.map((row) => row.id),
    licenseBindings: licenses.map((row) => `${row.vpbx_user_uid}:${row.product}:${row.document_uid}`),
  };
}

function assertInvariantsMatch(expected, actual) {
  const left = JSON.stringify(expected);
  const right = JSON.stringify(actual);
  if (left !== right) fail(`restore invariants mismatch: expected ${left} got ${right}`);
}

async function dumpSql(adapter) {
  const dialect = adapter.dialect;
  const tables = await dataTables(adapter);
  const statements = [];
  if (dialect === 'postgres') statements.push("SET session_replication_role = 'replica'");
  else statements.push('SET FOREIGN_KEY_CHECKS=0');
  if (dialect === 'postgres' && tables.length) {
    statements.push(`TRUNCATE TABLE ${tables.map((table) => ident(dialect, table)).join(', ')} RESTART IDENTITY CASCADE`);
  } else {
    for (const table of tables) statements.push(`TRUNCATE TABLE ${ident(dialect, table)}`);
  }
  for (const table of tables) {
    const columns = await tableColumns(adapter, table);
    if (!columns.length) continue;
    const colSql = columns.map((name) => ident(dialect, name)).join(', ');
    const rows = await adapter.query(`SELECT ${colSql} FROM ${ident(dialect, table)}`);
    for (const row of rows) {
      const values = columns.map((name) => sqlLiteral(dialect, row[name])).join(', ');
      statements.push(`INSERT INTO ${ident(dialect, table)} (${colSql}) VALUES (${values})`);
    }
  }
  if (dialect === 'postgres') statements.push("SET session_replication_role = 'origin'");
  else statements.push('SET FOREIGN_KEY_CHECKS=1');
  return `${statements.join(';\n')};\n`;
}

function splitStatements(sql) {
  return sql.split(/;\s*\n/).map((part) => part.trim()).filter(Boolean).map((part) => (part.endsWith(';') ? part.slice(0, -1) : part));
}

async function applySql(adapter, sql) {
  for (const statement of splitStatements(sql)) {
    await adapter.query(statement);
  }
}

async function seedRestoreFixture(adapter, { tenantUid, encryptionKey: secret, objectsDir }) {
  const postgres = adapter.dialect === 'postgres';
  const now = "'2026-09-20 12:00:00.000'";
  const hash = `'${'ab'.repeat(32)}'`;
  const ciphertext = encryptSecret(FIXTURE_PROVIDER_SECRET, { CC_AI_KEY_SECRET: secret });
  await adapter.query(
    `UPDATE cc_ai_providers SET encrypted_api_key = ${sqlParam(adapter, 1)}, auth_type = ${sqlParam(adapter, 2)} WHERE vpbx_user_uid = ${sqlParam(adapter, 3)}`,
    [ciphertext, 'bearer', tenantUid],
  );
  const body = Buffer.from('I2-RESTORE-FIXTURE');
  const storageKey = `i2/tenant/${tenantUid}/${ASSET_ID}`;
  const sha = crypto.createHash('sha256').update(body).digest('hex');
  fs.mkdirSync(path.join(objectsDir, path.dirname(storageKey)), { recursive: true });
  fs.writeFileSync(path.join(objectsDir, storageKey), body);
  await adapter.query(`INSERT INTO ai_local_license_documents
    (uid, license_id, revision, vpbx_user_uid, installation_id,
     payload_bytes, signature_bytes, digest_sha256, imported_at,
     imported_by, max_observed_at)
    VALUES ('${LICENSE_UID}', '00000000-0000-4000-8000-000000000031', 1,
      ${tenantUid}, 'i2-installation', 'payload', 'signature', '${sha}',
      ${now}, 1, ${now})`);
  await adapter.query(`INSERT INTO ai_local_license_bindings
    (vpbx_user_uid, product, document_uid, revision, actor_user_id, updated_at)
    VALUES (${tenantUid}, 'speech_analytics', '${LICENSE_UID}', 1, 1, ${now})`);
  await adapter.query(`INSERT INTO ai_media_assets
    (id, vpbx_user_uid, source_kind, storage_key, state, sha256, bytes, media_metadata, version, created_at, updated_at)
    VALUES ('${ASSET_ID}', ${tenantUid}, 'upload', '${storageKey}', 'ready', '${sha}', ${body.length}, '{}', 1, ${now}, ${now})`);
  await adapter.query(`INSERT INTO ai_jobs
    (id, vpbx_user_uid, product, kind, resource_kind, resource_id, state, priority, admitted_at, version, created_at, updated_at)
    VALUES ('${JOB_ID}', ${tenantUid}, 'speech_analytics', 'analyze', 'asset', '${ASSET_ID}', 'queued', 0, ${now}, 1, ${now}, ${now})`);
  await adapter.query(`INSERT INTO ai_usage_reservations
    (id, vpbx_user_uid, job_id, owner_key, metric, period_start, held_units, settled_units, state, expires_at, version, created_at, updated_at)
    VALUES ('${RESERVATION_ID}', ${tenantUid}, '${JOB_ID}', 'job:${JOB_ID}', 'audio_ms', '2026-09-01 00:00:00.000', 8, 8, 'settled', '2026-09-21 12:00:00.000', 1, ${now}, ${now})`);
  await adapter.query(`INSERT INTO ai_usage_ledger
    (id, vpbx_user_uid, reservation_id, operation_id, entry_kind, sequence, units, amount_decimal, currency, created_at)
    VALUES ('${LEDGER_ID}', ${tenantUid}, '${RESERVATION_ID}', 'job:${JOB_ID}', 'settle', 1, 8, NULL, NULL, ${now})`);
  return {
    tenantUid,
    jobId: JOB_ID,
    assetId: ASSET_ID,
    licenseUid: LICENSE_UID,
    storageKey,
    ciphertext,
    dialect: postgres ? 'postgres' : 'mysql',
  };
}

function writePack(packDir, { manifest, sql, objectsDir, encryptionKey: secret }) {
  fs.mkdirSync(packDir, { recursive: true });
  fs.writeFileSync(path.join(packDir, 'MANIFEST.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  fs.writeFileSync(path.join(packDir, 'data.sql'), sql);
  if (objectsDir && fs.existsSync(objectsDir)) copyDir(objectsDir, path.join(packDir, 'objects'));
  if (secret) fs.writeFileSync(path.join(packDir, 'encryption.key'), `${secret}\n`);
  assertNoLiveSecrets(packDir, {}, [FIXTURE_PROVIDER_SECRET]);
}

function readManifest(packDir) {
  return JSON.parse(fs.readFileSync(path.join(packDir, 'MANIFEST.json'), 'utf8'));
}

async function backupToPack(adapter, packDir, { env, objectsDir, encryptionKey: secret }) {
  const dialect = env.DB_DIALECT;
  const profile = env.DB_SCHEMA_PROFILE;
  if (!['mysql', 'postgres'].includes(dialect)) fail('DB_DIALECT must be mysql or postgres');
  if (!secret) fail('encryption key sidecar is required; live secrets are not copied from the environment');
  const invariants = await collectInvariants(adapter);
  if (invariants.schemaVersion !== CURRENT_SCHEMA) {
    fail(`expected schema ${CURRENT_SCHEMA}, dump is ${invariants.schemaVersion}`);
  }
  const sql = await dumpSql(adapter);
  if (sql.includes(FIXTURE_PROVIDER_SECRET)) fail('SQL dump contains plaintext provider secret');
  const objectFiles = walkFiles(objectsDir).map((key) => ({
    key,
    sha256: sha256File(path.join(objectsDir, key)),
    bytes: fs.statSync(path.join(objectsDir, key)).size,
  }));
  const manifest = {
    version: 1,
    dialect,
    profile,
    schemaVersion: invariants.schemaVersion,
    createdAt: new Date().toISOString(),
    objectCount: objectFiles.length,
    objects: objectFiles,
    invariants,
    keySidecar: 'encryption.key',
    notes: 'Customer holds CC_AI_KEY_SECRET. Publisher signing keys stay with the issuer. Same-engine restore only (DBR-07).',
  };
  writePack(packDir, { manifest, sql, objectsDir, encryptionKey: secret });
  return manifest;
}

async function restoreFromPack(adapter, packDir, { env, objectsDir, requireKey = true }) {
  const manifest = readManifest(packDir);
  assertSameEngine(manifest, env);
  assertNoLiveSecrets(packDir, env, [FIXTURE_PROVIDER_SECRET]);
  if (manifest.schemaVersion !== CURRENT_SCHEMA) {
    fail(`backup schema ${manifest.schemaVersion} does not match current ${CURRENT_SCHEMA}`);
  }
  let secret = null;
  if (requireKey) secret = assertKeySidecarPresent(packDir);
  else if (fs.existsSync(path.join(packDir, 'encryption.key'))) {
    secret = fs.readFileSync(path.join(packDir, 'encryption.key'), 'utf8').trim();
  }
  const sql = fs.readFileSync(path.join(packDir, 'data.sql'), 'utf8');
  await applySql(adapter, sql);
  const packedObjects = path.join(packDir, 'objects');
  if (objectsDir) {
    fs.mkdirSync(objectsDir, { recursive: true });
    if (fs.existsSync(packedObjects)) copyDir(packedObjects, objectsDir);
  }
  const actual = await collectInvariants(adapter);
  assertInvariantsMatch(manifest.invariants, actual);
  if (objectsDir) {
    for (const object of manifest.objects || []) {
      const restored = path.join(objectsDir, object.key);
      if (!fs.existsSync(restored)) fail(`missing restored object ${object.key}`);
      if (sha256File(restored) !== object.sha256) fail(`object checksum mismatch ${object.key}`);
    }
  }
  return { manifest, secret, invariants: actual };
}

async function verifyRestoredCredential(adapter, tenantUid, env, expectedPlain = FIXTURE_PROVIDER_SECRET) {
  const rows = await adapter.query(
    `SELECT encrypted_api_key FROM cc_ai_providers WHERE vpbx_user_uid = ${sqlParam(adapter, 1)} LIMIT 1`,
    [tenantUid],
  );
  const blob = rows[0]?.encrypted_api_key;
  if (!blob || !String(blob).startsWith('v2:')) fail('restored credential is not a versioned envelope');
  if (String(blob).includes(expectedPlain)) fail('restored credential stored plaintext');
  return readRestoredCredential(blob, env);
}

async function withAdapter(env, fn) {
  const config = resolveDatabaseConfig(env, { requireExplicitConnection: true });
  const adapter = await connectAdapter(config);
  try { return await fn(adapter); } finally { await adapter.close(); }
}

async function main(args = process.argv.slice(2), env = process.env) {
  if (args.includes('--rollback')) {
    fail('Automatic rollback is not supported; restore a backup or apply a reviewed forward migration.');
  }
  const backupAt = args.includes('--backup') ? args[args.indexOf('--backup') + 1] : null;
  const restoreAt = args.includes('--restore') ? args[args.indexOf('--restore') + 1] : null;
  const objectsDir = args.includes('--objects') ? args[args.indexOf('--objects') + 1] : null;
  if (!backupAt && !restoreAt) fail('Usage: backup-restore.cjs --backup DIR|--restore DIR [--objects DIR]');
  return withAdapter(env, async (adapter) => {
    if (backupAt) {
      const secret = env.CC_AI_KEY_SECRET || fail('CC_AI_KEY_SECRET sidecar required for backup');
      return backupToPack(adapter, backupAt, { env, objectsDir, encryptionKey: secret });
    }
    return restoreFromPack(adapter, restoreAt, { env, objectsDir, requireKey: true });
  });
}

if (require.main === module) {
  main().then((result) => {
    console.log(JSON.stringify(result, null, 2));
  }).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  CURRENT_SCHEMA,
  sqlParam,
  DIALECT_SWITCH_MESSAGE,
  FIXTURE_PROVIDER_SECRET,
  JOB_ID,
  ASSET_ID,
  LICENSE_UID,
  generateDisposableKey,
  encryptSecret,
  decryptSecret,
  readRestoredCredential,
  assertSameEngine,
  assertNoLiveSecrets,
  assertKeySidecarPresent,
  collectInvariants,
  assertInvariantsMatch,
  seedRestoreFixture,
  writePack,
  readManifest,
  backupToPack,
  restoreFromPack,
  verifyRestoredCredential,
  dumpSql,
  applySql,
  main,
};
