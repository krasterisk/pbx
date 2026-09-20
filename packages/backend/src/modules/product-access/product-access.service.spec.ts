import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { canonicalJson } from './license-verifier';
import { ProductAccessService } from './product-access.service';

const now = new Date('2026-09-18T12:00:00.000Z');

function fixture(mode: 'BOX' | 'CLOUD' | 'OPENSOURCE' = 'BOX') {
  const keys = generateKeyPairSync('ed25519');
  const payload = {
    version: 1, licenseId: '00000000-0000-4000-8000-000000000001',
    issuer: 'test-issuer', keyId: 'key-1', installationId: 'installation-1',
    tenantUid: 0, revision: 1,
    notBefore: '2026-01-01T00:00:00.000Z', expiresAt: '2030-01-01T00:00:00.000Z',
    graceSeconds: 0, products: [{ code: 'speech_analytics', limits: { jobs_per_month: 100 } }],
  };
  const signed = (patch: Record<string, unknown> = {}) => {
    const bytes = Buffer.from(canonicalJson({ ...payload, ...patch }));
    return { payload: bytes.toString('base64url'), signature: sign(null, bytes, keys.privateKey).toString('base64url') };
  };
  const tenant = { id: 10, vpbx_user_uid: 0, status: 'active', trial_ends_at: null };
  const tenants = { findOne: jest.fn().mockResolvedValue(tenant) };
  const tenantModules = { findAll: jest.fn().mockResolvedValue([]) };
  const activations = { findOne: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({}) };
  const documents = {
    findOne: jest.fn().mockResolvedValue(null), findByPk: jest.fn().mockResolvedValue(null),
    create: jest.fn(async (row) => row), update: jest.fn().mockResolvedValue([1]),
  };
  const bindings = {
    findOne: jest.fn().mockResolvedValue(null), findAll: jest.fn().mockResolvedValue([]),
    destroy: jest.fn().mockResolvedValue(0), bulkCreate: jest.fn().mockResolvedValue([]),
  };
  const actionLogs = { create: jest.fn().mockResolvedValue({}) };
  const entitlements = { findOne: jest.fn().mockResolvedValue(null) };
  const snapshots = { findOne: jest.fn().mockResolvedValue(null) };
  const config = { get: jest.fn((name: string, fallback?: string) => ({
    DEPLOYMENT_MODE: mode, AI_LICENSE_ISSUER: 'test-issuer',
    AI_LICENSE_INSTALLATION_ID: 'installation-1',
    AI_LICENSE_PUBLIC_KEYS_JSON: JSON.stringify({ 'key-1': keys.publicKey.export({ type: 'spki', format: 'pem' }) }),
  })[name] ?? fallback) };
  const transaction = { LOCK: { UPDATE: 'UPDATE' } };
  const sequelize = { transaction: jest.fn(async (callback) => callback(transaction)) };
  const service = new ProductAccessService(
    tenants as any, tenantModules as any, activations as any, documents as any,
    bindings as any, actionLogs as any, entitlements as any, snapshots as any,
    config as any, sequelize as any,
  );
  return { service, signed, tenantModules, activations, documents, bindings, actionLogs, entitlements, snapshots, sequelize, config };
}

describe('ProductAccessService', () => {
  it('keeps BOX and CLOUD grants disabled until a separate activation exists', async () => {
    const box = fixture();
    expect(await box.service.decide(0, 'speech_analytics', now)).toMatchObject({
      allowed: false, reason: 'license_invalid',
    });
    const cloud = fixture('CLOUD');
    cloud.tenantModules.findAll.mockResolvedValue([{ module_code: 'speech_analytics', status: 'active' }]);
    expect(await cloud.service.decide(0, 'speech_analytics', now)).toMatchObject({
      allowed: false, reason: 'product_disabled', source: 'cloud_entitlement',
    });
    expect(cloud.tenantModules.findAll).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenant_id: 10, module_code: ['speech_analytics', 'cc_ai_voice'] },
    }));
  });

  it('imports a verified tenant-zero license atomically without a balance lookup or payload audit', async () => {
    const f = fixture();
    const result = await f.service.importLicense(0, f.signed(), 77, false, now);
    expect(result).toMatchObject({ revision: 1, products: ['speech_analytics'], unchanged: false });
    expect(f.documents.create).toHaveBeenCalledWith(expect.objectContaining({
      user_uid: 0, revision: 1, max_observed_at: now,
    }), expect.objectContaining({ transaction: expect.anything() }));
    expect(f.bindings.bulkCreate).toHaveBeenCalledWith([
      expect.objectContaining({ user_uid: 0, product: 'speech_analytics' }),
    ], expect.objectContaining({ transaction: expect.anything() }));
    const audit = f.actionLogs.create.mock.calls[0][0];
    expect(audit.details).not.toContain(f.signed().payload);
    expect(audit.details).toContain(result.digest);
  });

  it('admits only the bound product after activation and rejects a rolled-back clock', async () => {
    const f = fixture();
    const envelope = f.signed();
    const digest = createHash('sha256').update(Buffer.from(envelope.payload, 'base64url')).digest('hex');
    f.activations.findOne.mockResolvedValue({ enabled: true });
    f.bindings.findOne.mockResolvedValue({ user_uid: 0, product: 'speech_analytics', document_uid: 'doc-1', revision: 1 });
    f.documents.findByPk.mockResolvedValue({
      uid: 'doc-1', user_uid: 0, revision: 1,
      license_id: '00000000-0000-4000-8000-000000000001', installation_id: 'installation-1',
      payload_bytes: Buffer.from(envelope.payload, 'base64url'),
      signature_bytes: Buffer.from(envelope.signature, 'base64url'), digest_sha256: digest,
      max_observed_at: new Date('2026-09-18T11:00:00.000Z'),
    });
    expect(await f.service.decide(0, 'speech_analytics', now)).toMatchObject({
      allowed: true, source: 'local_license', limits: { jobs_per_month: 100 },
    });
    expect(f.documents.update).toHaveBeenCalled();
    expect(await f.service.decide(0, 'ai_voice_robots', now)).toMatchObject({
      allowed: false, reason: 'license_invalid',
    });
    f.documents.findByPk.mockResolvedValue({
      uid: 'doc-1', user_uid: 0, revision: 1,
      max_observed_at: new Date('2026-09-19T00:00:00.000Z'),
    });
    expect(await f.service.decide(0, 'speech_analytics', now)).toMatchObject({
      allowed: false, reason: 'license_invalid',
    });
  });

  it('rejects foreign tenant, downgrade, conflicting revision and clock rollback', async () => {
    const f = fixture();
    await expect(f.service.importLicense(1, f.signed(), 77, false, now)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'license_tenant_mismatch' }),
    });
    f.documents.findOne.mockResolvedValue({
      uid: 'existing', user_uid: 0, license_id: '00000000-0000-4000-8000-000000000001',
      revision: 2, digest_sha256: 'other', max_observed_at: now,
    });
    await expect(f.service.importLicense(0, f.signed(), 77, false, now)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'license_revision_downgrade' }),
    });
    f.documents.findOne.mockResolvedValue({
      uid: 'existing', user_uid: 0, license_id: '00000000-0000-4000-8000-000000000001',
      revision: 1, digest_sha256: 'other', max_observed_at: now,
    });
    await expect(f.service.importLicense(0, f.signed(), 77, false, now)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'license_revision_conflict' }),
    });
    // A matching signed revision cannot be re-imported under a rolled-back clock.
    const digest = createHash('sha256')
      .update(Buffer.from(f.signed().payload, 'base64url')).digest('hex');
    f.documents.findOne.mockResolvedValue({
      uid: 'existing', user_uid: 0, license_id: '00000000-0000-4000-8000-000000000001',
      revision: 1, digest_sha256: digest,
      max_observed_at: new Date('2026-09-19T00:00:00.000Z'),
    });
    await expect(f.service.importLicense(0, f.signed(), 77, false, now)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'license_clock_rollback' }),
    });
  });

  it('never creates activation from an unentitled request and permits idempotent OFF', async () => {
    const f = fixture('CLOUD');
    await expect(f.service.setActivation(0, 'speech_analytics', true, 77, now)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'not_entitled' }),
    });
    expect(f.activations.create).not.toHaveBeenCalled();
    expect(await f.service.setActivation(0, 'speech_analytics', false, 77, now))
      .toEqual({ product: 'speech_analytics', enabled: false, revision: 0 });
  });

  it('denies processing when a SKU grant exists but activation is still off', async () => {
    const f = fixture('CLOUD');
    f.entitlements.findOne.mockResolvedValue({
      product: 'speech_analytics', status: 'trial',
      trial_ends_at: new Date('2026-10-01T00:00:00.000Z'),
      policy_digest: 'dd'.repeat(32),
    });
    f.snapshots.findOne.mockResolvedValue({
      concurrent_jobs: '2', concurrent_sessions: '1', storage_bytes: '100',
      audio_ms: '10', provider_tokens: '5',
    });
    expect(await f.service.decide(0, 'speech_analytics', now)).toMatchObject({
      allowed: false, reason: 'product_disabled',
      limits: { concurrent_jobs: 2, audio_ms: 10 },
    });
  });

  it('renews by replacing bindings and accepts a rotated signing key', async () => {
    const f = fixture();
    const first = await f.service.importLicense(0, f.signed(), 77, false, now);
    expect(first.unchanged).toBe(false);
    f.documents.findOne.mockResolvedValue({
      uid: 'doc-1', user_uid: 0, license_id: first.licenseId, revision: 1,
      digest_sha256: first.digest, max_observed_at: now,
    });
    f.bindings.findAll.mockResolvedValue([{
      user_uid: 0, product: 'speech_analytics', document_uid: 'doc-1', revision: 1,
    }]);
    const renewed = await f.service.importLicense(0, f.signed({ revision: 2 }), 77, true, now);
    expect(renewed.revision).toBe(2);
    expect(renewed.unchanged).toBe(false);
    expect(f.bindings.destroy).toHaveBeenCalled();

    const rotated = fixture();
    const keys = generateKeyPairSync('ed25519');
    const pem = keys.publicKey.export({ type: 'spki', format: 'pem' }).toString();
    rotated.config.get.mockImplementation((name: string, fallback?: string) => ({
      DEPLOYMENT_MODE: 'BOX', AI_LICENSE_ISSUER: 'test-issuer',
      AI_LICENSE_INSTALLATION_ID: 'installation-1',
      AI_LICENSE_PUBLIC_KEYS_JSON: JSON.stringify({ 'key-1': pem, 'key-2': pem }),
    })[name] ?? fallback);
    const bytes = Buffer.from(canonicalJson({
      version: 1, licenseId: '00000000-0000-4000-8000-000000000001',
      issuer: 'test-issuer', keyId: 'key-2', installationId: 'installation-1',
      tenantUid: 0, revision: 1,
      notBefore: '2026-01-01T00:00:00.000Z', expiresAt: '2030-01-01T00:00:00.000Z',
      graceSeconds: 0, products: [{ code: 'speech_analytics', limits: { jobs_per_month: 100 } }],
    }));
    await expect(rotated.service.importLicense(0, {
      payload: bytes.toString('base64url'),
      signature: sign(null, bytes, keys.privateKey).toString('base64url'),
    }, 77, false, now)).resolves.toMatchObject({ revision: 1, unchanged: false });
  });
});
