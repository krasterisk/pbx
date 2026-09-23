import { resolveTenantIdFromJwt } from './tenant-binding';

describe('resolveTenantIdFromJwt', () => {
  it('uses a positive JWT tenant_id without looking up vpbx', async () => {
    const findByVpbxUid = jest.fn();
    await expect(resolveTenantIdFromJwt({ tenant_id: 9, vpbx_user_uid: 42 }, findByVpbxUid))
      .resolves.toBe(9);
    expect(findByVpbxUid).not.toHaveBeenCalled();
  });

  it('ignores tenant_id 0 and resolves tenants.id via vpbx_user_uid', async () => {
    const findByVpbxUid = jest.fn().mockResolvedValue({ id: 3 });
    await expect(resolveTenantIdFromJwt({ tenant_id: 0, vpbx_user_uid: 8 }, findByVpbxUid))
      .resolves.toBe(3);
    expect(findByVpbxUid).toHaveBeenCalledWith(8);
  });

  it('returns null when vpbx_user_uid 0 has no tenants row', async () => {
    const findByVpbxUid = jest.fn().mockResolvedValue(null);
    await expect(resolveTenantIdFromJwt({ vpbx_user_uid: 0 }, findByVpbxUid))
      .resolves.toBeNull();
  });

  it('returns null when the cabinet row is missing', async () => {
    const findByVpbxUid = jest.fn().mockResolvedValue(null);
    await expect(resolveTenantIdFromJwt({ vpbx_user_uid: 42 }, findByVpbxUid))
      .resolves.toBeNull();
  });

  it('rejects a missing or negative vpbx binding', async () => {
    const findByVpbxUid = jest.fn();
    await expect(resolveTenantIdFromJwt({}, findByVpbxUid)).resolves.toBeNull();
    await expect(resolveTenantIdFromJwt({ vpbx_user_uid: -1 }, findByVpbxUid)).resolves.toBeNull();
    expect(findByVpbxUid).not.toHaveBeenCalled();
  });
});
