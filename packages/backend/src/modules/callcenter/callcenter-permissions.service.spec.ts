import { ForbiddenException } from '@nestjs/common';
import { CallCenterPermissionsService } from './callcenter-permissions.service';
import { UserLevel } from '../users/user.model';

/**
 * Unit tests for CallCenterPermissionsService — the server-authoritative
 * effective-permission resolver (D-38/D-39). Covers merge precedence, lock
 * enforcement, missing-row fallbacks, and assert()/assertSpyMode() throwing.
 */
describe('CallCenterPermissionsService', () => {
  let service: CallCenterPermissionsService;

  const userModel: any = { findOne: jest.fn() };
  const ccSettingsModel: any = { findOne: jest.fn() };
  const operatorSettingsModel: any = { findOne: jest.fn() };

  const OPERATOR_USER_ID = 42;
  const TENANT = 7;

  function mockUser(level: UserLevel) {
    userModel.findOne.mockResolvedValue({
      getDataValue: (k: string) => (k === 'level' ? level : undefined),
    });
  }

  function mockTenantSettings(
    role_permission_defaults: any = null,
    permission_locks: any = null,
  ) {
    ccSettingsModel.findOne.mockResolvedValue({
      role_permission_defaults,
      permission_locks,
    });
  }

  function mockOperatorRow(row: Record<string, any> | null) {
    if (!row) {
      operatorSettingsModel.findOne.mockResolvedValue(null);
      return;
    }
    operatorSettingsModel.findOne.mockResolvedValue({
      getDataValue: (k: string) => row[k],
    });
  }

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CallCenterPermissionsService(
      operatorSettingsModel,
      ccSettingsModel,
      userModel,
    );
  });

  describe('getEffective', () => {
    it('returns hardcoded safe defaults when both operator row and role default are missing', async () => {
      mockUser(UserLevel.OPERATOR);
      mockTenantSettings(null, null);
      mockOperatorRow(null);

      const perms = await service.getEffective(TENANT, OPERATOR_USER_ID);

      expect(perms).toEqual({
        can_spy: false,
        spyable: true,
        spy_modes: ['listen'],
        click_to_call: false,
        customize_ui: false,
      });
    });

    it('returns pure role default when operator row is missing but role default exists', async () => {
      mockUser(UserLevel.SUPERVISOR);
      mockTenantSettings({
        [UserLevel.SUPERVISOR]: { can_spy: true, spy_modes: ['listen', 'whisper', 'barge'] },
      });
      mockOperatorRow(null);

      const perms = await service.getEffective(TENANT, OPERATOR_USER_ID);

      expect(perms.can_spy).toBe(true);
      expect(perms.spy_modes).toEqual(['listen', 'whisper', 'barge']);
      // Not specified in role default → falls back to safe default
      expect(perms.click_to_call).toBe(false);
      expect(perms.spyable).toBe(true);
    });

    it('applies the per-operator override when unlocked', async () => {
      mockUser(UserLevel.OPERATOR);
      mockTenantSettings({ [UserLevel.OPERATOR]: { can_spy: false } }, null);
      mockOperatorRow({
        can_spy: true,
        spyable: false,
        click_to_call: true,
        customize_ui: true,
        spy_modes: ['listen', 'whisper'],
      });

      const perms = await service.getEffective(TENANT, OPERATOR_USER_ID);

      expect(perms.can_spy).toBe(true);
      expect(perms.spyable).toBe(false);
      expect(perms.click_to_call).toBe(true);
      expect(perms.customize_ui).toBe(true);
      expect(perms.spy_modes).toEqual(['listen', 'whisper']);
    });

    it('lock precedence: role default wins when the right is locked, ignoring the operator override', async () => {
      mockUser(UserLevel.OPERATOR);
      mockTenantSettings(
        { [UserLevel.OPERATOR]: { can_spy: false, spy_modes: ['listen'] } },
        { [UserLevel.OPERATOR]: { can_spy: true, spy_modes: true } },
      );
      mockOperatorRow({
        can_spy: true, // operator tried to self-override — must be ignored (locked)
        spyable: true,
        click_to_call: false,
        customize_ui: false,
        spy_modes: ['listen', 'whisper', 'barge'], // also locked — ignored
      });

      const perms = await service.getEffective(TENANT, OPERATOR_USER_ID);

      // can_spy is locked → role default (false) wins, not the operator's true override
      expect(perms.can_spy).toBe(false);
      // spy_modes is locked → role default (['listen']) wins
      expect(perms.spy_modes).toEqual(['listen']);
    });

    it('a right that is not locked still respects the operator override even when other rights are locked', async () => {
      mockUser(UserLevel.OPERATOR);
      mockTenantSettings(
        { [UserLevel.OPERATOR]: { can_spy: false } },
        { [UserLevel.OPERATOR]: { can_spy: true } }, // only can_spy locked
      );
      mockOperatorRow({
        can_spy: true,
        spyable: false, // not locked — override applies
        click_to_call: true,
        customize_ui: false,
        spy_modes: ['listen'],
      });

      const perms = await service.getEffective(TENANT, OPERATOR_USER_ID);

      expect(perms.can_spy).toBe(false); // locked → role default
      expect(perms.spyable).toBe(false); // unlocked → operator override applies
      expect(perms.click_to_call).toBe(true);
    });
  });

  describe('assert', () => {
    it('throws ForbiddenException when the effective right is false', async () => {
      mockUser(UserLevel.OPERATOR);
      mockTenantSettings(null, null);
      mockOperatorRow(null); // safe default can_spy=false

      await expect(service.assert(TENANT, OPERATOR_USER_ID, 'can_spy')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('resolves with the effective permission set when the right is true', async () => {
      mockUser(UserLevel.OPERATOR);
      mockTenantSettings(null, null);
      mockOperatorRow({
        can_spy: true,
        spyable: true,
        click_to_call: false,
        customize_ui: false,
        spy_modes: ['listen'],
      });

      const perms = await service.assert(TENANT, OPERATOR_USER_ID, 'can_spy');
      expect(perms.can_spy).toBe(true);
    });
  });

  describe('assertSpyMode', () => {
    it('throws ForbiddenException when mode is not in the effective spy_modes', async () => {
      mockUser(UserLevel.OPERATOR);
      mockTenantSettings(null, null);
      mockOperatorRow({
        can_spy: true,
        spyable: true,
        click_to_call: false,
        customize_ui: false,
        spy_modes: ['listen'],
      });

      await expect(
        service.assertSpyMode(TENANT, OPERATOR_USER_ID, 'whisper'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('resolves when mode is granted', async () => {
      mockUser(UserLevel.OPERATOR);
      mockTenantSettings(null, null);
      mockOperatorRow({
        can_spy: true,
        spyable: true,
        click_to_call: false,
        customize_ui: false,
        spy_modes: ['listen', 'whisper'],
      });

      await expect(
        service.assertSpyMode(TENANT, OPERATOR_USER_ID, 'whisper'),
      ).resolves.toBeDefined();
    });
  });
});
