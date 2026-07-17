import {
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { DeviceTokenController } from './device-token.controller';
import { DeviceTokenService } from './device-token.service';

/**
 * NAV-12 / D-32 — FCM device-token register (plan 08-11).
 *
 * Contract:
 * - JWT-bound: req.user.sub required (no anonymous register)
 * - body: { token: string, platform?: string }
 * - upserts token bound to user + tenant
 */
describe('DeviceTokenController', () => {
  let controller: DeviceTokenController;
  let service: { upsertForUser: jest.Mock };

  beforeEach(() => {
    service = {
      upsertForUser: jest.fn().mockResolvedValue({ id: 1 }),
    };
    controller = new DeviceTokenController(service as unknown as DeviceTokenService);
  });

  it('rejects unauthenticated requests (no JWT user)', async () => {
    await expect(
      controller.register({ token: 'fcm-abc' }, { user: undefined }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(service.upsertForUser).not.toHaveBeenCalled();
  });

  it('rejects missing token in body', async () => {
    await expect(
      controller.register({} as { token: string }, {
        user: { sub: 1, vpbx_user_uid: 100 },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects empty token string', async () => {
    await expect(
      controller.register({ token: '   ' }, {
        user: { sub: 1, vpbx_user_uid: 100 },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects token exceeding max length', async () => {
    await expect(
      controller.register(
        { token: 'x'.repeat(4097), platform: 'android' },
        { user: { sub: 7, vpbx_user_uid: 100 } },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('upserts token bound to authenticated user/tenant', async () => {
    const result = await controller.register(
      { token: 'fcm-device-token', platform: 'android' },
      { user: { sub: 7, vpbx_user_uid: 100, tenant_id: 42 } },
    );

    expect(service.upsertForUser).toHaveBeenCalledWith({
      userUid: 7,
      tenantId: 42,
      vpbxUserUid: 100,
      token: 'fcm-device-token',
      platform: 'android',
    });
    expect(result).toEqual({ ok: true });
  });
});
