'use strict';
// Disposable MySQL/PG + local object store. Optional MinIO via --minio. Never reads DB_* / production S3.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { GenericContainer, Wait } = require('testcontainers');
const { resolveDatabaseConfig } = require('../../packages/backend/src/database/database-config.cjs');
const { connectAdapter } = require('../../packages/backend/database/migration-adapter.cjs');
const { runMigrations, loadMigrations } = require('../../packages/backend/database/migration-runner.cjs');
const images = require('./images.json');

const args = process.argv.slice(2);
const wantMinio = args.includes('--minio');
const selected = args.filter(value => ['mysql', 'postgres'].includes(value));
if (args.some(value => value !== '--minio' && !['mysql', 'postgres'].includes(value))) {
  throw new Error('Usage: node harness/database/run-d3-media.cjs [mysql|postgres] [--minio]');
}

const OBJECT_KEY = /^t[0-9]+\/[0-9a-fA-F-]{8,36}(\.part)?$/;
const STORAGE_REF = /^krs:v1:(local|s3):([0-9]+):([0-9a-fA-F-]{8,36})$/;

function assertSafeObjectKey(key) {
  if (key.includes('\0') || /[\\]/.test(key) || key.includes('..')) {
    throw Object.assign(new Error('storage key traversal is not allowed'), { code: 'storage_path_denied' });
  }
  if (key.startsWith('/') || key.startsWith('//') || /^[a-zA-Z]:/.test(key) || key.startsWith('\\\\')) {
    throw Object.assign(new Error('absolute and UNC storage keys are not allowed'), { code: 'storage_path_denied' });
  }
  if (key.includes(':')) {
    throw Object.assign(new Error('storage key traversal is not allowed'), { code: 'storage_path_denied' });
  }
  if (!OBJECT_KEY.test(key)) {
    throw Object.assign(new Error('storage key must be tenant-prefixed and server-generated'), { code: 'storage_path_denied' });
  }
  return key;
}

function pcmWav({ channels, sampleRate, samples, amplitude = 0 }) {
  const dataBytes = samples * channels * 2;
  const body = Buffer.alloc(44 + dataBytes);
  body.write('RIFF', 0);
  body.writeUInt32LE(36 + dataBytes, 4);
  body.write('WAVE', 8);
  body.write('fmt ', 12);
  body.writeUInt32LE(16, 16);
  body.writeUInt16LE(1, 20);
  body.writeUInt16LE(channels, 22);
  body.writeUInt32LE(sampleRate, 24);
  body.writeUInt32LE(sampleRate * channels * 2, 28);
  body.writeUInt16LE(channels * 2, 32);
  body.writeUInt16LE(16, 34);
  body.write('data', 36);
  body.writeUInt32LE(dataBytes, 40);
  for (let i = 0; i < samples * channels; i += 1) body.writeInt16LE(amplitude, 44 + i * 2);
  return body;
}

function probeWav(body) {
  if (body.length < 12) throw Object.assign(new Error('truncated'), { code: 'media_truncated' });
  if (body.toString('ascii', 0, 4) !== 'RIFF' || body.toString('ascii', 8, 12) !== 'WAVE') {
    throw Object.assign(new Error('unsupported'), { code: 'media_unsupported' });
  }
  const riffSize = body.readUInt32LE(4);
  if (riffSize + 8 > body.length) throw Object.assign(new Error('truncated'), { code: 'media_truncated' });
  const channels = body.readUInt16LE(22);
  const sampleRate = body.readUInt32LE(24);
  const dataBytes = body.readUInt32LE(40);
  if (channels < 1 || channels > 2) throw Object.assign(new Error('channels'), { code: 'media_channels' });
  if (dataBytes > 256 * 1024 * 1024) throw Object.assign(new Error('bomb'), { code: 'media_bomb' });
  return { container: 'wav', channels, sampleRate, lossless: true, channelRoles: 'unknown' };
}

function hmac(key, value) {
  return crypto.createHmac('sha256', key).update(value, 'utf8').digest();
}

function sha256Hex(body) {
  return crypto.createHash('sha256').update(body).digest('hex');
}

function signingKey(secret, date, region) {
  return hmac(hmac(hmac(hmac(`AWS4${secret}`, date), region), 's3'), 'aws4_request');
}

async function s3Request(config, method, pathname, body, extra = {}) {
  const url = new URL(config.endpoint);
  url.pathname = pathname;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const date = amzDate.slice(0, 8);
  const payload = body ?? Buffer.alloc(0);
  const payloadHash = sha256Hex(payload);
  const headers = {
    host: url.host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
    ...extra,
  };
  if (method !== 'GET' && method !== 'HEAD') headers['content-length'] = String(payload.length);
  const names = Object.keys(headers).map(name => name.toLowerCase()).sort();
  const canonicalHeaders = names.map(name => `${name}:${headers[name]}\n`).join('');
  const signedHeaders = names.join(';');
  const canonical = [method, url.pathname, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');
  const scope = `${date}/${config.region}/s3/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256Hex(canonical)].join('\n');
  const signature = crypto.createHmac('sha256', signingKey(config.secretKey, date, config.region))
    .update(stringToSign, 'utf8').digest('hex');
  headers.authorization = `AWS4-HMAC-SHA256 Credential=${config.accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  const response = await fetch(url, { method, headers, body });
  const buffer = Buffer.from(await response.arrayBuffer());
  const advertised = Number(response.headers.get('content-length'));
  return {
    status: response.status,
    buffer,
    contentLength: Number.isFinite(advertised) ? advertised : buffer.length,
  };
}

class LocalStore {
  constructor(root) {
    this.root = fs.realpathSync(root);
  }

  resolveSafe(key) {
    const base = key.endsWith('.part') ? key.slice(0, -'.part'.length) : key;
    assertSafeObjectKey(base);
    if (key.includes('..') || key.includes('\\') || key.includes('\0')) {
      throw Object.assign(new Error('denied'), { code: 'storage_path_denied' });
    }
    const target = path.resolve(path.join(this.root, ...key.split('/')));
    const prefix = this.root.endsWith(path.sep) ? this.root : this.root + path.sep;
    if (target !== this.root && !target.startsWith(prefix)) {
      throw Object.assign(new Error('escaped'), { code: 'storage_path_denied' });
    }
    return target;
  }

  async put(key, body) {
    const target = this.resolveSafe(key);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const handle = fs.openSync(target, 'w');
    try {
      fs.writeFileSync(handle, body);
      fs.fsyncSync(handle);
    } finally {
      fs.closeSync(handle);
    }
  }

  async get(key, range) {
    const target = this.resolveSafe(key);
    if (fs.lstatSync(target).isSymbolicLink()) {
      throw Object.assign(new Error('symlink'), { code: 'storage_path_denied' });
    }
    const body = fs.readFileSync(target);
    return range ? body.subarray(range.start, range.end + 1) : body;
  }

  async head(key) {
    try {
      const info = fs.lstatSync(this.resolveSafe(key));
      if (info.isSymbolicLink()) throw Object.assign(new Error('symlink'), { code: 'storage_path_denied' });
      return { bytes: info.size };
    } catch (error) {
      if (error.code === 'ENOENT') return null;
      throw error;
    }
  }

  async delete(key) {
    fs.rmSync(this.resolveSafe(key), { force: true });
  }

  async rename(fromKey, toKey) {
    const to = this.resolveSafe(toKey);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.renameSync(this.resolveSafe(fromKey), to);
  }
}

class S3Store {
  constructor(config) {
    this.config = config;
  }

  pathFor(key) {
    return `/${this.config.bucket}/${key}`;
  }

  async put(key, body) {
    const result = await s3Request(this.config, 'PUT', this.pathFor(key), body);
    if (result.status >= 300) throw Object.assign(new Error(`s3 put ${result.status}`), { code: 'storage_s3_failed' });
  }

  async get(key, range) {
    const extra = range ? { range: `bytes=${range.start}-${range.end}` } : {};
    const result = await s3Request(this.config, 'GET', this.pathFor(key), undefined, extra);
    if (result.status === 404) throw Object.assign(new Error('missing'), { code: 'storage_not_found' });
    if (result.status !== 200 && result.status !== 206) {
      throw Object.assign(new Error(`s3 get ${result.status}`), { code: 'storage_s3_failed' });
    }
    return result.buffer;
  }

  async head(key) {
    const result = await s3Request(this.config, 'HEAD', this.pathFor(key));
    if (result.status === 404) return null;
    if (result.status >= 300) throw Object.assign(new Error(`s3 head ${result.status}`), { code: 'storage_s3_failed' });
    return { bytes: result.contentLength };
  }

  async delete(key) {
    const result = await s3Request(this.config, 'DELETE', this.pathFor(key));
    if (result.status >= 300 && result.status !== 404) {
      throw Object.assign(new Error(`s3 delete ${result.status}`), { code: 'storage_s3_failed' });
    }
  }

  async rename(fromKey, toKey) {
    const body = await this.get(fromKey);
    await this.put(toKey, body);
    await this.delete(fromKey);
  }

  async ensureBucket() {
    const result = await s3Request(this.config, 'PUT', `/${this.config.bucket}`);
    if (result.status >= 300 && result.status !== 409) {
      throw Object.assign(new Error(`s3 bucket ${result.status} ${result.buffer.toString('utf8').slice(0, 200)}`), { code: 'storage_s3_failed' });
    }
  }
}

async function roundTrip(store, tenant, assetId, body) {
  const key = `t${tenant}/${assetId}`;
  await store.put(`${key}.part`, body);
  await store.rename(`${key}.part`, key);
  const head = await store.head(key);
  assert.equal(head.bytes, body.length);
  const slice = await store.get(key, { start: 0, end: 3 });
  assert.equal(slice.length, 4);
  return key;
}

function mayDeleteAsset({ activeJobCount, retentionAt, now, state }) {
  if (activeJobCount > 0) return false;
  if (state === 'ready' && retentionAt && retentionAt > now) return false;
  return state === 'ready' || state === 'failed' || state === 'quarantined';
}

for (const dialect of selected.length ? [...new Set(selected)] : ['mysql', 'postgres']) {
  const postgres = dialect === 'postgres';
  const label = wantMinio ? `${dialect}+minio` : dialect;
  test(`${label}: D3 media storage contracts (${images[dialect]}${wantMinio ? ` + ${images.minio}` : ''})`, { timeout: 360000 }, async t => {
    const password = crypto.randomBytes(24).toString('hex');
    const dbPort = postgres ? 5432 : 3306;
    const db = await new GenericContainer(images[dialect])
      .withEnvironment(postgres
        ? { POSTGRES_PASSWORD: password, POSTGRES_DB: 'krasterisk_d3' }
        : { MYSQL_ROOT_PASSWORD: password, MYSQL_ROOT_HOST: '%', MYSQL_DATABASE: 'krasterisk_d3' })
      .withExposedPorts(dbPort)
      .withWaitStrategy(Wait.forLogMessage(postgres ? /database system is ready to accept connections/ : /ready for connections/, 2))
      .withStartupTimeout(180000)
      .start();
    let minio;
    let adapter;
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'krasterisk-d3-fs-'));
    t.after(async () => {
      try { if (adapter) await adapter.close(); } finally {
        await Promise.allSettled([db.stop(), minio?.stop()]);
        fs.rmSync(root, { recursive: true, force: true });
      }
    });
    const environment = {
      DB_DIALECT: dialect, DB_HOST: db.getHost(), DB_PORT: String(db.getMappedPort(dbPort)),
      DB_USER: postgres ? 'postgres' : 'root', DB_PASSWORD: password, DB_NAME: 'krasterisk_d3',
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
    await runMigrations({ config, migrations: loadMigrations(dialect) });
    const local = new LocalStore(root);
    const now = 'CURRENT_TIMESTAMP';
    const shaA = 'ab'.repeat(32);
    const shaB = 'cd'.repeat(32);

    await t.test('opaque refs reject filesystem paths and traversal', () => {
      assert.match('krs:v1:local:2:aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', STORAGE_REF);
      assert.throws(() => assertSafeObjectKey('../etc/passwd'), /traversal|denied/);
      assert.throws(() => assertSafeObjectKey('C:/windows/x'), /absolute|denied/);
      assert.doesNotThrow(() => assertSafeObjectKey('t2/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'));
    });

    await t.test('probe uses bytes not MIME and rejects truncated/bomb/3-channel', () => {
      const wav = pcmWav({ channels: 1, sampleRate: 8000, samples: 80, amplitude: 1 });
      const probed = probeWav(wav);
      assert.equal(probed.container, 'wav');
      assert.equal(probed.channelRoles, 'unknown');
      const truncated = Buffer.from(wav.subarray(0, 60));
      truncated.writeUInt32LE(50_000_000, 4);
      assert.throws(() => probeWav(truncated), /truncated/);
      const bomb = Buffer.from(wav);
      bomb.writeUInt32LE(400_000_000, 40);
      assert.throws(() => probeWav(bomb), /bomb/);
      const three = Buffer.from(wav);
      three.writeUInt16LE(3, 22);
      assert.throws(() => probeWav(three), /channels/);
    });

    await t.test('local adapter fsyncs temp, atomic rename, Range, and tenant keys', async () => {
      const wav = pcmWav({ channels: 2, sampleRate: 8000, samples: 160, amplitude: 4 });
      const left = await roundTrip(local, 4, 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', wav);
      const right = await roundTrip(local, 5, 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', wav);
      assert.notEqual(left, right);
      assert.equal(sha256Hex(await local.get(left)), sha256Hex(await local.get(right)));
      assert.throws(() => local.resolveSafe('../etc/passwd'));
    });

    await t.test('SQL keeps probing after object exists and isolates checksums by tenant', async () => {
      const id1 = '11111111-1111-4111-8111-111111111111';
      const id2 = '22222222-2222-4222-8222-222222222222';
      const key1 = 'krs:v1:local:4:' + id1;
      const key2 = 'krs:v1:local:5:' + id2;
      await local.put(`t4/${id1}.part`, pcmWav({ channels: 1, sampleRate: 8000, samples: 10, amplitude: 1 }));
      await local.rename(`t4/${id1}.part`, `t4/${id1}`);
      await adapter.query(`INSERT INTO ai_media_assets
        (id, vpbx_user_uid, source_kind, storage_key, state, sha256, bytes, media_metadata, version, created_at, updated_at)
        VALUES ('${id1}', 4, 'upload', '${key1}', 'probing', '${shaA}', 64, '{}', 1, ${now}, ${now})`);
      const [row] = await adapter.query(`SELECT state FROM ai_media_assets WHERE id='${id1}'`);
      assert.equal(row.state, 'probing');
      assert.ok(await local.head(`t4/${id1}`));
      await adapter.query(`INSERT INTO ai_media_assets
        (id, vpbx_user_uid, source_kind, storage_key, state, sha256, bytes, media_metadata, version, created_at, updated_at)
        VALUES ('${id2}', 5, 'upload', '${key2}', 'ready', '${shaA}', 64, '{}', 1, ${now}, ${now})`);
      const sameHash = await adapter.query(`SELECT vpbx_user_uid AS tenant, storage_key FROM ai_media_assets WHERE sha256='${shaA}' ORDER BY vpbx_user_uid`);
      assert.equal(sameHash.length, 2);
      assert.notEqual(sameHash[0].storage_key, sameHash[1].storage_key);
      await assert.rejects(adapter.query(`INSERT INTO ai_media_assets
        (id, vpbx_user_uid, source_kind, storage_key, state, sha256, bytes, media_metadata, version, created_at, updated_at)
        VALUES ('33333333-3333-4333-8333-333333333333', 6, 'upload', '${key1}', 'ready', '${shaB}', 1, '{}', 1, ${now}, ${now})`));
    });

    await t.test('ready+outbox commit; running job holds deletion', async () => {
      const assetId = '44444444-4444-4444-8444-444444444444';
      const jobId = '55555555-5555-4555-8555-555555555555';
      const outboxId = '66666666-6666-4666-8666-666666666666';
      const ref = 'krs:v1:local:8:' + assetId;
      await adapter.query(postgres ? 'BEGIN' : 'START TRANSACTION');
      try {
        await adapter.query(`INSERT INTO ai_media_assets
          (id, vpbx_user_uid, source_kind, storage_key, state, sha256, bytes, media_metadata, version, created_at, updated_at)
          VALUES ('${assetId}', 8, 'upload', '${ref}', 'ready', '${shaB}', 32, '{}', 1, ${now}, ${now})`);
        await adapter.query(`INSERT INTO ai_outbox
          (id, vpbx_user_uid, aggregate_kind, aggregate_id, aggregate_version, event_type, schema_version, payload, available_at, fence, attempts, version, created_at)
          VALUES ('${outboxId}', 8, 'asset', '${assetId}', 1, 'asset.ready', 1, '{"schemaVersion":1,"tenantUid":8}', ${now}, 0, 0, 1, ${now})`);
        await adapter.query('COMMIT');
      } catch (error) {
        await adapter.query('ROLLBACK').catch(() => undefined);
        throw error;
      }
      await adapter.query(`INSERT INTO ai_jobs
        (id, vpbx_user_uid, product, kind, resource_kind, resource_id, state, priority, admitted_at, version, created_at, updated_at)
        VALUES ('${jobId}', 8, 'speech_analytics', 'analyze', 'asset', '${assetId}', 'running', 0, ${now}, 1, ${now}, ${now})`);
      const jobs = await adapter.query(`SELECT id FROM ai_jobs WHERE resource_id='${assetId}' AND state IN ('queued','running')`);
      assert.equal(mayDeleteAsset({
        state: 'ready', activeJobCount: jobs.length, now: new Date(), retentionAt: null,
      }), false);
      const [ready] = await adapter.query(`SELECT state FROM ai_media_assets WHERE id='${assetId}'`);
      assert.equal(ready.state, 'ready');
      assert.equal((await adapter.query(`SELECT event_type FROM ai_outbox WHERE id='${outboxId}'`))[0].event_type, 'asset.ready');
    });

    if (wantMinio) {
      minio = await new GenericContainer(images.minio)
        .withEnvironment({ MINIO_ROOT_USER: 'minioadmin', MINIO_ROOT_PASSWORD: 'minioadmin' })
        .withCommand(['server', '/data', '--console-address', ':9001'])
        .withExposedPorts(9000)
        .withWaitStrategy(Wait.forLogMessage(/API:.*/))
        .withStartupTimeout(120000)
        .start();
      const endpoint = `http://${minio.getHost()}:${minio.getMappedPort(9000)}`;
      const liveDeadline = performance.now() + 30000;
      for (;;) {
        try {
          const live = await fetch(`${endpoint}/minio/health/live`);
          if (live.ok) break;
        } catch {
          /* retry until MinIO serves the live probe */
        }
        if (performance.now() >= liveDeadline) {
          throw new Error('MinIO live probe did not become ready');
        }
        await new Promise(resolve => setTimeout(resolve, 400));
      }
      const s3 = new S3Store({
        endpoint,
        region: 'us-east-1',
        bucket: 'krasterisk-ai-media',
        accessKey: 'minioadmin',
        secretKey: 'minioadmin',
      });
      await t.test('S3-compatible adapter shares put/rename/head/range/delete', async () => {
        let lastError;
        for (let attempt = 0; attempt < 8; attempt += 1) {
          try {
            await s3.ensureBucket();
            lastError = undefined;
            break;
          } catch (error) {
            lastError = error;
            await new Promise(resolve => setTimeout(resolve, 400));
          }
        }
        if (lastError) throw lastError;
        const wav = pcmWav({ channels: 1, sampleRate: 8000, samples: 40, amplitude: 2 });
        const key = await roundTrip(s3, 9, 'bbbbbbbb-cccc-4ddd-8eee-ffffffffffff', wav);
        assert.equal((await s3.head(key)).bytes, wav.length);
        await s3.delete(key);
        assert.equal(await s3.head(key), null);
      });
    }
  });
}
