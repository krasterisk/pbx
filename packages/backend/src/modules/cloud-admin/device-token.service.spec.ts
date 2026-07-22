import { ForbiddenException } from '@nestjs/common';
import { DeviceTokenService } from './device-token.service';

describe('DeviceTokenService', () => {
  const upsert = jest.fn().mockResolvedValue([{ id: 1 }]);
  const findByVpbxUid = jest.fn();
  let service: DeviceTokenService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DeviceTokenService(
      { upsert } as any,
      { findByVpbxUid } as any,
    );
  });

  it('uses JWT tenant_id when present', async () => {
    await service.upsertForUser({
      userUid: 7,
      tenantId: 42,
      vpbxUserUid: 100,
      token: 't',
    });
    expect(findByVpbxUid).not.toHaveBeenCalled();
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_uid: 7, tenant_id: 42, token: 't' }),
    );
  });

  it('resolves tenants.id via vpbx_user_uid', async () => {
    findByVpbxUid.mockResolvedValue({ id: 9 });
    await service.upsertForUser({
      userUid: 7,
      vpbxUserUid: 100,
      token: 't',
    });
    expect(findByVpbxUid).toHaveBeenCalledWith(100);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ tenant_id: 9 }),
    );
  });

  it('falls back to vpbx partition when no tenants row (local smoke)', async () => {
    findByVpbxUid.mockResolvedValue(null);
    await service.upsertForUser({
      userUid: 7,
      vpbxUserUid: 100,
      token: 't',
      platform: 'android',
    });
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_uid: 7, tenant_id: 100, platform: 'android' }),
    );
  });

  it('rejects when no tenant or positive vpbx/user binding', async () => {
    await expect(
      service.upsertForUser({ userUid: 0, token: 't', vpbxUserUid: 0 }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
