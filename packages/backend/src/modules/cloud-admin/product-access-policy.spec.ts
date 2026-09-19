import { resolveProductAccess, type ProductAccessInput } from './product-access-policy';

const now = new Date('2026-09-18T12:00:00.000Z');
const base: ProductAccessInput = {
  product: 'speech_analytics', deploymentMode: 'CLOUD',
  tenant: { status: 'active' },
  grants: [{ module_code: 'cc_ai_voice', status: 'active' }],
  activationEnabled: true, packageInstalled: true, now,
};

describe('AI product policy', () => {
  it('maps only the legacy analytics code', () => {
    expect(resolveProductAccess(base)).toMatchObject({ allowed: true, source: 'legacy_mapping' });
    expect(resolveProductAccess({ ...base, product: 'ai_voice_robots' })).toMatchObject({
      allowed: false, reason: 'not_entitled',
    });
  });

  it('explicit deny beats a legacy grant', () => {
    expect(resolveProductAccess({ ...base, grants: [
      ...base.grants, { module_code: 'speech_analytics', status: 'inactive' },
    ] })).toMatchObject({ allowed: false, reason: 'not_entitled', source: 'cloud_entitlement' });
  });

  it('uses a single clock for tenant trials and module expiry', () => {
    expect(resolveProductAccess({ ...base, tenant: { status: 'trial', trial_ends_at: now } }))
      .toMatchObject({ allowed: false, reason: 'tenant_inactive' });
    expect(resolveProductAccess({ ...base, tenant: { status: 'trial', trial_ends_at: null } }))
      .toMatchObject({ allowed: false, reason: 'tenant_inactive' });
    expect(resolveProductAccess({ ...base, grants: [{
      module_code: 'speech_analytics', status: 'active', expires_at: now,
    }] })).toMatchObject({ allowed: false, reason: 'entitlement_expired' });
  });

  it('rejects suspended tenants, BOX grants and missing activation', () => {
    expect(resolveProductAccess({ ...base, tenant: { status: 'suspended' } }).allowed).toBe(false);
    expect(resolveProductAccess({ ...base, deploymentMode: 'BOX' }).reason).toBe('license_invalid');
    expect(resolveProductAccess({ ...base, activationEnabled: false }).reason).toBe('product_disabled');
  });

  it('admits only an activated BOX product with a verified local grant', () => {
    const localLicense = { expiresAt: '2030-01-01T00:00:00.000Z', limits: { sessions: 2 } };
    expect(resolveProductAccess({ ...base, deploymentMode: 'BOX', localLicense })).toMatchObject({
      allowed: true, source: 'local_license', limits: { sessions: 2 },
    });
    expect(resolveProductAccess({ ...base, deploymentMode: 'BOX', localLicense, activationEnabled: false }))
      .toMatchObject({ allowed: false, reason: 'product_disabled' });
  });
});
