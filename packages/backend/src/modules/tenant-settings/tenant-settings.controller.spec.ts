import { ForbiddenException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/sequelize';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { ROLES_KEY } from '../auth/roles.decorator';
import { UserLevel } from '../users/user.model';
import { LoggerService } from '../logger/logger.service';
import { SystemSettingsController } from '../system-settings/system-settings.controller';
import { TenantSetting } from './tenant-setting.model';
import { TenantSettingsController } from './tenant-settings.controller';
import { TenantSettingsService } from './tenant-settings.service';

function httpCtx(user?: { level?: UserLevel; vpbx_user_uid?: number; sub?: number }) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
    getHandler: () => ({}),
    getClass: () => SystemSettingsController,
  } as any;
}

describe('TenantSettingsController (D-19)', () => {
  let service: { getAll: jest.Mock; setMany: jest.Mock };
  let logger: { logAction: jest.Mock };
  let controller: TenantSettingsController;

  beforeEach(() => {
    service = {
      getAll: jest.fn().mockResolvedValue({
        'routes.show_raw_dialplan': true,
        'routes.show_flowchart': true,
      }),
      setMany: jest.fn().mockResolvedValue({
        'routes.show_raw_dialplan': true,
        'routes.show_flowchart': true,
      }),
    };
    logger = { logAction: jest.fn() };
    controller = new TenantSettingsController(service as any, logger as any);
  });

  it('GET returns 200-shaped settings for a non-ADMIN tenant from JWT', async () => {
    const result = await controller.getAll({ user: { sub: 7, vpbx_user_uid: 42, level: UserLevel.OPERATOR } } as any);

    expect(service.getAll).toHaveBeenCalledWith(42);
    expect(result['routes.show_raw_dialplan']).toBe(true);
  });

  it('PUT writes JWT tenant and ignores vpbx_user_uid from the body', async () => {
    await controller.setMany(
      { settings: { 'routes.show_raw_dialplan': true }, vpbx_user_uid: 999 } as any,
      { user: { sub: 7, vpbx_user_uid: 42, level: UserLevel.OPERATOR } } as any,
    );

    expect(service.setMany).toHaveBeenCalledWith(42, { 'routes.show_raw_dialplan': true });
    expect(service.setMany).not.toHaveBeenCalledWith(999, expect.anything());
    expect(logger.logAction).toHaveBeenCalledWith(
      7,
      'update',
      'tenant_settings',
      null,
      42,
      expect.stringContaining('routes.show_raw_dialplan'),
    );
  });

  it('is guarded by JwtAuthGuard and is not ADMIN-only', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, TenantSettingsController) ?? [];
    expect(guards).toEqual(expect.arrayContaining([JwtAuthGuard]));
    expect(Reflect.getMetadata(ROLES_KEY, TenantSettingsController)).toBeUndefined();
    expect(Reflect.getMetadata(ROLES_KEY, TenantSettingsController.prototype.getAll)).toBeUndefined();
    expect(Reflect.getMetadata(ROLES_KEY, TenantSettingsController.prototype.setMany)).toBeUndefined();
  });

  it('JwtAuthGuard does not grant access without a token (401 in runtime)', async () => {
    const guard = new JwtAuthGuard();
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => ({ headers: {}, user: undefined }),
      }),
      getHandler: () => TenantSettingsController.prototype.getAll,
      getClass: () => TenantSettingsController,
    } as any;

    let granted = false;
    try {
      granted = (await Promise.resolve(guard.canActivate(ctx))) === true;
    } catch {
      granted = false;
    }
    expect(granted).toBe(false);
  });

  it('GET /system-settings still forbids a non-ADMIN JWT (regression)', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, SystemSettingsController);
    expect(roles).toEqual(expect.arrayContaining([UserLevel.ADMIN]));

    const guard = new RolesGuard(new Reflector());
    expect(() => guard.canActivate(httpCtx({ level: UserLevel.OPERATOR, vpbx_user_uid: 42 }))).toThrow(
      ForbiddenException,
    );
  });

  it('Test.createTestingModule resolves TenantSetting without error', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [TenantSettingsController],
      providers: [
        TenantSettingsService,
        { provide: getModelToken(TenantSetting), useValue: { findAll: jest.fn().mockResolvedValue([]), upsert: jest.fn() } },
        { provide: LoggerService, useValue: { logAction: jest.fn() } },
      ],
    }).compile();

    expect(moduleRef.get(TenantSettingsController)).toBeDefined();
    expect(moduleRef.get(TenantSettingsService)).toBeDefined();
    await moduleRef.close();
  });
});
