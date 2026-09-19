import { TenantContextResolver } from './tenant-context.resolver';

const now = new Date('2026-09-18T12:00:00.000Z');
const claims = { sub: 7, level: 1, role: 0, vpbx_user_uid: 0, iat: Math.floor(now.getTime() / 1000) };

function fixture() {
  const users = { findOne: jest.fn().mockResolvedValue({
    uniqueid: 7, level: 1, role: 0, vpbx_user_uid: 0,
    isActivated: true, activationCode: null,
    updatedAt: new Date('2026-09-18T11:00:00.000Z'),
  }) };
  const tenants = { findOne: jest.fn().mockResolvedValue({
    vpbx_user_uid: 0, status: 'active', trial_ends_at: null,
  }) };
  return { resolver: new TenantContextResolver(users as any, tenants as any), users, tenants };
}

describe('TenantContextResolver', () => {
  it('builds immutable tenant-zero context from fresh user and tenant rows', async () => {
    const f = fixture();
    const context = await f.resolver.fromUserClaims(claims, 'request-1', now);
    expect(context).toMatchObject({
      tenantUid: 0, principalId: 'user:7', principalKind: 'user', requestId: 'request-1',
    });
    expect(Object.isFrozen(context)).toBe(true);
    expect(f.users.findOne).toHaveBeenCalledWith(expect.objectContaining({ where: { uniqueid: 7 } }));
    expect(f.tenants.findOne).toHaveBeenCalledWith(expect.objectContaining({ where: { vpbx_user_uid: 0 } }));
  });

  it('rejects revoked membership, stale JWT and suspended tenant', async () => {
    const f = fixture();
    f.users.findOne.mockResolvedValueOnce(null);
    await expect(f.resolver.fromUserClaims(claims, 'r', now)).rejects.toThrow();
    await expect(f.resolver.fromUserClaims({ ...claims, vpbx_user_uid: 42 }, 'r', now))
      .rejects.toThrow();
    f.users.findOne.mockResolvedValueOnce({
      uniqueid: 7, level: 1, role: 0, vpbx_user_uid: 0, isActivated: true,
      updatedAt: new Date('2026-09-18T12:01:00.000Z'),
    });
    await expect(f.resolver.fromUserClaims(claims, 'r', now)).rejects.toThrow();
    f.tenants.findOne.mockResolvedValueOnce({ vpbx_user_uid: 0, status: 'suspended' });
    await expect(f.resolver.fromUserClaims(claims, 'r', now)).rejects.toThrow();
  });

  it('requires a separate audited platform target and rejects expired trial', async () => {
    const f = fixture();
    await expect(f.resolver.fromUserClaims({ ...claims, level: 0 }, 'r', now)).rejects.toThrow();
    f.tenants.findOne.mockResolvedValueOnce({
      vpbx_user_uid: 0, status: 'trial', trial_ends_at: now,
    });
    await expect(f.resolver.fromUserClaims(claims, 'r', now)).rejects.toThrow();
  });
});
