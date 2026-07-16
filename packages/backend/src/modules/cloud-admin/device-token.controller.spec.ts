import {
  BadRequestException,
  NotImplementedException,
  UnauthorizedException,
} from '@nestjs/common';
import { DeviceTokenController } from './device-token.controller';

/**
 * Wave 0 Nyquist gate for NAV-12 / D-32.
 *
 * GREEN skeleton stub in plan 08-13.
 * Owning plan for full register/persist: 08-11.
 *
 * Contract:
 * - JWT-bound: req.user required (no anonymous register)
 * - body: { token: string, platform?: string }
 */
describe('DeviceTokenController', () => {
  let controller: DeviceTokenController;

  beforeEach(() => {
    controller = new DeviceTokenController();
  });

  it('rejects unauthenticated requests (no JWT user)', async () => {
    await expect(
      controller.register({ token: 'fcm-abc' }, { user: undefined }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects missing token in body', async () => {
    await expect(
      controller.register({} as { token: string }, { user: { uniqueid: 1 } }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects empty token string', async () => {
    await expect(
      controller.register({ token: '   ' }, { user: { uniqueid: 1 } }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('Wave 0 stub throws NotImplemented after validation (full impl: 08-11)', async () => {
    await expect(
      controller.register(
        { token: 'fcm-device-token', platform: 'android' },
        { user: { uniqueid: 7, vpbx_user_uid: 100 } },
      ),
    ).rejects.toBeInstanceOf(NotImplementedException);
  });

  describe('persist contract (owned by 08-11)', () => {
    it.todo('stores token bound to authenticated user/tenant');
  });
});
