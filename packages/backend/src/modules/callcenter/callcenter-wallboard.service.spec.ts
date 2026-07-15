import { UnauthorizedException, NotFoundException } from '@nestjs/common';
import { CallCenterWallboardService } from './callcenter-wallboard.service';
import { DisplayTokenGuard } from './guards/display-token.guard';

describe('CallCenterWallboardService', () => {
  let service: CallCenterWallboardService;
  let displayTokenModel: {
    create: jest.Mock;
    findAll: jest.Mock;
    findOne: jest.Mock;
  };
  let alertConfigModel: {
    findOne: jest.Mock;
    create: jest.Mock;
  };
  let notificationsService: {
    findOne: jest.Mock;
  };

  beforeEach(() => {
    displayTokenModel = {
      create: jest.fn().mockImplementation((data) => Promise.resolve({ ...data, uid: 1 })),
      findAll: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
    };
    alertConfigModel = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((data) => Promise.resolve(data)),
    };
    notificationsService = {
      findOne: jest.fn().mockResolvedValue({ uid: 10 }),
    };
    service = new CallCenterWallboardService(
      displayTokenModel as any,
      alertConfigModel as any,
      notificationsService as any,
    );
  });

  describe('generateToken', () => {
    it('creates a 64-char hex token with user_uid/created_by from args (not dto)', async () => {
      const dto = {
        label: 'Lobby TV',
        // Poison fields — must be ignored if somehow present
        user_uid: 999,
        token: 'injected',
        created_by: 999,
      } as any;

      const result = await service.generateToken(42, 7, dto);

      expect(displayTokenModel.create).toHaveBeenCalledTimes(1);
      const created = displayTokenModel.create.mock.calls[0][0];
      expect(created.user_uid).toBe(42);
      expect(created.created_by).toBe(7);
      expect(created.token).toMatch(/^[a-f0-9]{64}$/);
      expect(created.token).not.toBe('injected');
      expect(created.label).toBe('Lobby TV');
      expect(created.expires_at).toBeNull();
      expect(result.token).toMatch(/^[a-f0-9]{64}$/);
    });

    it('sets expires_at in the future when expires_in_days is provided', async () => {
      const before = Date.now();
      await service.generateToken(1, 2, { expires_in_days: 7 });
      const created = displayTokenModel.create.mock.calls[0][0];
      expect(created.expires_at).toBeInstanceOf(Date);
      expect(created.expires_at.getTime()).toBeGreaterThan(before);
      expect(created.expires_at.getTime()).toBeLessThanOrEqual(before + 8 * 24 * 60 * 60 * 1000);
    });
  });

  describe('revokeToken', () => {
    it('throws NotFoundException for another tenant', async () => {
      displayTokenModel.findOne.mockResolvedValue(null);

      await expect(service.revokeToken(1, 99)).rejects.toThrow(NotFoundException);
      expect(displayTokenModel.findOne).toHaveBeenCalledWith({
        where: { uid: 99, user_uid: 1 },
      });
    });

    it('sets revoked_at on matching tenant token', async () => {
      const row = {
        uid: 5,
        user_uid: 1,
        update: jest.fn().mockResolvedValue(undefined),
      };
      displayTokenModel.findOne.mockResolvedValue(row);

      const result = await service.revokeToken(1, 5);

      expect(row.update).toHaveBeenCalledWith(
        expect.objectContaining({ revoked_at: expect.any(Date) }),
      );
      expect(result).toEqual({ success: true });
    });
  });

  describe('updateAlertConfig', () => {
    it('throws when integration_uid belongs to another tenant', async () => {
      notificationsService.findOne.mockRejectedValue(new NotFoundException());

      await expect(
        service.updateAlertConfig(1, { integration_uid: 99 }),
      ).rejects.toThrow(NotFoundException);
      expect(notificationsService.findOne).toHaveBeenCalledWith(99, 1);
    });
  });
});

describe('DisplayTokenGuard', () => {
  let guard: DisplayTokenGuard;
  let displayTokenModel: { findOne: jest.Mock };

  const makeContext = (token?: string) => {
    const req: any = {
      query: token !== undefined ? { token } : {},
      user: undefined,
    };
    return {
      req,
      context: {
        switchToHttp: () => ({
          getRequest: () => req,
        }),
      } as any,
    };
  };

  beforeEach(() => {
    displayTokenModel = { findOne: jest.fn() };
    guard = new DisplayTokenGuard(displayTokenModel as any);
  });

  it('throws UnauthorizedException when token is revoked', async () => {
    displayTokenModel.findOne.mockResolvedValue({
      user_uid: 5,
      revoked_at: new Date(),
      expires_at: null,
      update: jest.fn().mockResolvedValue(undefined),
    });
    const { context } = makeContext('abc');

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('sets req.user without level/id for an active token', async () => {
    displayTokenModel.findOne.mockResolvedValue({
      user_uid: 12,
      revoked_at: null,
      expires_at: null,
      update: jest.fn().mockResolvedValue(undefined),
    });
    const { req, context } = makeContext('deadbeef'.repeat(8));

    const ok = await guard.canActivate(context);

    expect(ok).toBe(true);
    expect(req.user.isDisplayToken).toBe(true);
    expect(req.user.vpbx_user_uid).toBe(12);
    expect(req.user.level).toBeUndefined();
    expect(req.user.id).toBeUndefined();
  });

  it('throws UnauthorizedException when token is expired', async () => {
    displayTokenModel.findOne.mockResolvedValue({
      user_uid: 1,
      revoked_at: null,
      expires_at: new Date(Date.now() - 60_000),
      update: jest.fn().mockResolvedValue(undefined),
    });
    const { context } = makeContext('expired-token');

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });
});
