import {
  CallCenterSettingsService,
  DEFAULT_OPERATOR_SETTINGS,
  DEFAULT_ALERT_THRESHOLDS,
  sanitizeAlertThresholds,
  sanitizeNotificationMatrix,
} from './callcenter-settings.service';
import { UserLevel } from '../users/user.model';
import { SAFE_DEFAULT_PERMISSIONS } from './callcenter-permissions.service';

describe('CallCenterSettingsService', () => {
  let service: CallCenterSettingsService;
  let operatorModel: {
    findOne: jest.Mock;
    create: jest.Mock;
    findAll: jest.Mock;
  };
  let ccSettingsModel: {
    findOne: jest.Mock;
    create: jest.Mock;
  };
  let userModel: {
    findOne: jest.Mock;
    findAll: jest.Mock;
  };
  let permissionsService: {
    getEffective: jest.Mock;
  };

  beforeEach(() => {
    operatorModel = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((data) => Promise.resolve(data)),
      findAll: jest.fn().mockResolvedValue([]),
    };
    ccSettingsModel = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((data) => Promise.resolve(data)),
    };
    userModel = {
      findOne: jest.fn().mockResolvedValue(null),
      findAll: jest.fn().mockResolvedValue([]),
    };
    permissionsService = {
      getEffective: jest.fn().mockResolvedValue({ ...SAFE_DEFAULT_PERMISSIONS }),
    };
    service = new CallCenterSettingsService(
      operatorModel as any,
      ccSettingsModel as any,
      userModel as any,
      permissionsService as any,
    );
  });

  describe('getOperatorSettings', () => {
    it('returns defaults and does NOT create a row when missing', async () => {
      const result = await service.getOperatorSettings(7, 42);

      expect(operatorModel.findOne).toHaveBeenCalledWith({
        where: { user_uid: 7, operator_user_id: 42 },
      });
      expect(operatorModel.create).not.toHaveBeenCalled();
      expect(result).toMatchObject({
        ...DEFAULT_OPERATOR_SETTINGS,
        operator_user_id: 42,
        user_uid: 7,
      });
    });

    it('scopes findOne by user_uid (tenant)', async () => {
      await service.getOperatorSettings(99, 1);
      expect(operatorModel.findOne.mock.calls[0][0].where.user_uid).toBe(99);
    });
  });

  describe('updateOperatorSettings', () => {
    it('creates row with user_uid/operator_user_id from args, ignoring dto spoof', async () => {
      const dto = {
        pickup_enabled: true,
        auto_answer: true,
        // Spoofed IDOR fields — must be ignored
        operator_user_id: 999,
        user_uid: 888,
        vpbx_user_uid: 888,
      } as any;

      await service.updateOperatorSettings(7, 42, dto);

      expect(operatorModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          user_uid: 7,
          operator_user_id: 42,
          pickup_enabled: true,
          auto_answer: true,
        }),
      );
      const created = operatorModel.create.mock.calls[0][0];
      expect(created.user_uid).not.toBe(888);
      expect(created.operator_user_id).not.toBe(999);
    });

    it('scopes findOne by user_uid before update', async () => {
      const row = { update: jest.fn().mockResolvedValue(undefined) };
      operatorModel.findOne.mockResolvedValue(row);

      await service.updateOperatorSettings(7, 42, { volume: 50 });

      expect(operatorModel.findOne).toHaveBeenCalledWith({
        where: { user_uid: 7, operator_user_id: 42 },
      });
      expect(row.update).toHaveBeenCalledWith(
        expect.objectContaining({ volume: 50 }),
      );
      expect(operatorModel.create).not.toHaveBeenCalled();
    });
  });

  describe('getTenantSettings', () => {
    it('returns defaults when no row and scopes by user_uid', async () => {
      const result = await service.getTenantSettings(7);

      expect(ccSettingsModel.findOne).toHaveBeenCalledWith({
        where: { user_uid: 7 },
      });
      expect(result).toMatchObject({
        default_sla_threshold: 20,
        alert_sound_enabled: true,
        user_uid: 7,
      });
      expect(result.alert_thresholds).toEqual(DEFAULT_ALERT_THRESHOLDS);
    });
  });

  describe('updateTenantSettings', () => {
    it('discards unknown alert_thresholds keys (whitelist)', async () => {
      await service.updateTenantSettings(7, {
        alert_thresholds: {
          max_wait_sec: 60,
          evil: 'x',
          hack: 123,
        },
      });

      const created = ccSettingsModel.create.mock.calls[0][0];
      expect(created.alert_thresholds).toEqual(
        expect.objectContaining({ max_wait_sec: 60 }),
      );
      expect(created.alert_thresholds).not.toHaveProperty('evil');
      expect(created.alert_thresholds).not.toHaveProperty('hack');
      expect(created.user_uid).toBe(7);
    });

    it('scopes findOne by user_uid', async () => {
      await service.updateTenantSettings(55, { default_sla_threshold: 25 });
      expect(ccSettingsModel.findOne).toHaveBeenCalledWith({
        where: { user_uid: 55 },
      });
    });
  });

  describe('sanitizeAlertThresholds', () => {
    it('keeps only whitelist keys and coerces numbers', () => {
      const out = sanitizeAlertThresholds({
        max_wait_sec: '45',
        abandon_rate_pct: 12,
        evil: 'nope',
      } as any);
      expect(out.max_wait_sec).toBe(45);
      expect(out.abandon_rate_pct).toBe(12);
      expect(out).not.toHaveProperty('evil');
    });
  });

  describe('sanitizeNotificationMatrix', () => {
    it('keeps only known events and known channels', () => {
      const out = sanitizeNotificationMatrix({
        incoming_call: ['sound', 'popup', 'evil-channel'],
        evil_event: ['sound'],
      } as any);
      expect(out.incoming_call).toEqual(['sound', 'popup']);
      expect(out).not.toHaveProperty('evil_event');
    });
  });

  describe('getOperatorUiCustomization / updateOperatorUiCustomization (D-05/D-06)', () => {
    it('merges tenant defaults with the per-operator override on read', async () => {
      ccSettingsModel.findOne.mockResolvedValue({
        ui_visibility_defaults: { coworkers: true, queues: false },
      });
      operatorModel.findOne.mockResolvedValue({
        ui_visibility: { queues: true },
        softphone_placement: 'bottom-left',
      });

      const result = await service.getOperatorUiCustomization(7, 42);

      expect(result.ui_visibility).toEqual({ coworkers: true, queues: true });
      expect(result.softphone_placement).toBe('bottom-left');
    });

    it('rejects a locked ui_visibility key on write, keeping the previous value', async () => {
      ccSettingsModel.findOne.mockResolvedValue({
        ui_visibility_locks: { queues: true },
      });
      const row = {
        ui_visibility: { queues: false, coworkers: false },
        update: jest.fn().mockResolvedValue(undefined),
      };
      operatorModel.findOne.mockResolvedValue(row);

      await service.updateOperatorUiCustomization(7, 42, {
        ui_visibility: { queues: true, coworkers: true },
      });

      const patch = row.update.mock.calls[0][0];
      // queues is locked -> must not flip to true; coworkers is unlocked -> applies
      expect(patch.ui_visibility.queues).toBe(false);
      expect(patch.ui_visibility.coworkers).toBe(true);
    });

    it('rejects a locked softphone_placement write', async () => {
      ccSettingsModel.findOne.mockResolvedValue({
        ui_visibility_locks: { softphone_placement: true },
      });
      const row = { softphone_placement: 'bottom-right', update: jest.fn().mockResolvedValue(undefined) };
      operatorModel.findOne.mockResolvedValue(row);

      await service.updateOperatorUiCustomization(7, 42, { softphone_placement: 'hidden' });

      const patch = row.update.mock.calls[0][0];
      expect(patch.softphone_placement).toBeUndefined();
    });

    it('forces a locked key back to the tenant default on read and surfaces locks (09-14)', async () => {
      ccSettingsModel.findOne.mockResolvedValue({
        ui_visibility_defaults: { coworkers: true, queues: false },
        ui_visibility_locks: { queues: true },
      });
      operatorModel.findOne.mockResolvedValue({
        // Stale override predating the lock - read must not surface it.
        ui_visibility: { queues: true },
        softphone_placement: 'bottom-left',
      });

      const result = await service.getOperatorUiCustomization(7, 42);

      expect(result.ui_visibility).toEqual({ coworkers: true, queues: false });
      expect(result.locks).toEqual({ queues: true });
    });
  });

  describe('getOperatorPermissions / updateOperatorPermissions (D-38/D-06/D-39)', () => {
    it('getOperatorPermissions delegates entirely to PermissionsService.getEffective', async () => {
      const perms = { ...SAFE_DEFAULT_PERMISSIONS, can_spy: true };
      permissionsService.getEffective.mockResolvedValue(perms);

      const result = await service.getOperatorPermissions(7, 42);

      expect(permissionsService.getEffective).toHaveBeenCalledWith(7, 42);
      expect(result).toBe(perms);
    });

    it('rejects a locked right on write (does not include it in the persisted patch)', async () => {
      userModel.findOne.mockResolvedValue({
        getDataValue: (k: string) => (k === 'level' ? UserLevel.OPERATOR : undefined),
      });
      ccSettingsModel.findOne.mockResolvedValue({
        permission_locks: { [UserLevel.OPERATOR]: { can_spy: true } },
      });
      const row = { update: jest.fn().mockResolvedValue(undefined) };
      operatorModel.findOne.mockResolvedValue(row);

      await service.updateOperatorPermissions(7, 42, { can_spy: true, spyable: false });

      const patch = row.update.mock.calls[0][0];
      expect(patch).not.toHaveProperty('can_spy'); // locked -> ignored
      expect(patch.spyable).toBe(false); // unlocked -> applies
      expect(permissionsService.getEffective).toHaveBeenCalledWith(7, 42);
    });

    it('rejects a locked spy_modes write', async () => {
      userModel.findOne.mockResolvedValue({
        getDataValue: (k: string) => (k === 'level' ? UserLevel.OPERATOR : undefined),
      });
      ccSettingsModel.findOne.mockResolvedValue({
        permission_locks: { [UserLevel.OPERATOR]: { spy_modes: true } },
      });
      const row = { update: jest.fn().mockResolvedValue(undefined) };
      operatorModel.findOne.mockResolvedValue(row);

      await service.updateOperatorPermissions(7, 42, { spy_modes: ['whisper', 'barge'] });

      const patch = row.update.mock.calls[0][0];
      expect(patch).not.toHaveProperty('spy_modes');
    });
  });

  describe('getPermissionsMatrix (D-40)', () => {
    it('returns one row per tenant operator with effective rights, delegating the merge', async () => {
      userModel.findAll.mockResolvedValue([
        {
          getDataValue: (k: string) =>
            ({ uniqueid: 42, name: 'Alice', login: 'alice', level: UserLevel.OPERATOR } as any)[k],
        },
        {
          getDataValue: (k: string) =>
            ({ uniqueid: 43, name: 'Bob', login: 'bob', level: UserLevel.SUPERVISOR } as any)[k],
        },
      ]);
      permissionsService.getEffective
        .mockResolvedValueOnce({ ...SAFE_DEFAULT_PERMISSIONS, can_spy: false })
        .mockResolvedValueOnce({ ...SAFE_DEFAULT_PERMISSIONS, can_spy: true });

      const rows = await service.getPermissionsMatrix(7);

      expect(userModel.findAll).toHaveBeenCalledWith({ where: { vpbx_user_uid: 7 } });
      expect(rows).toHaveLength(2);
      expect(rows[0]).toMatchObject({ operator_user_id: 42, name: 'Alice', level: UserLevel.OPERATOR });
      expect(rows[1]).toMatchObject({ operator_user_id: 43, name: 'Bob', level: UserLevel.SUPERVISOR });
      expect(permissionsService.getEffective).toHaveBeenNthCalledWith(1, 7, 42);
      expect(permissionsService.getEffective).toHaveBeenNthCalledWith(2, 7, 43);
    });
  });

  describe('getOperatorNotifications / updateOperatorNotifications (D-41/D-43)', () => {
    it('read forces a locked event to the tenant default and returns { matrix, locks, defaults } (09-14)', async () => {
      ccSettingsModel.findOne.mockResolvedValue({
        notification_locks: { sla_threshold: ['sound'] },
        notification_defaults: { sla_threshold: ['sound', 'popup'], incoming_call: ['sound'] },
      });
      operatorModel.findOne.mockResolvedValue({
        // Stale override predating the lock - read must not surface it.
        notification_matrix: { sla_threshold: [], incoming_call: ['popup'] },
      });

      const result = await service.getOperatorNotifications(7, 42);

      expect(result.matrix.sla_threshold).toEqual(['sound', 'popup']);
      expect(result.matrix.incoming_call).toEqual(['popup']);
      expect(result.locks).toEqual({ sla_threshold: ['sound'] });
      expect(result.defaults.sla_threshold).toEqual(['sound', 'popup']);
    });

    it('a locked event keeps the tenant default channel set, ignoring the operator request', async () => {
      ccSettingsModel.findOne.mockResolvedValue({
        notification_locks: { sla_threshold: ['sound'] },
        notification_defaults: { sla_threshold: ['sound', 'popup'] },
      });
      const row = { notification_matrix: {}, update: jest.fn().mockResolvedValue(undefined) };
      operatorModel.findOne.mockResolvedValue(row);

      await service.updateOperatorNotifications(7, 42, {
        notification_matrix: { sla_threshold: [], incoming_call: ['sound'] },
      });

      const patch = row.update.mock.calls[0][0];
      // sla_threshold is locked -> forced to tenant default, not the requested empty array
      expect(patch.notification_matrix.sla_threshold).toEqual(['sound', 'popup']);
      // incoming_call is unlocked -> operator request applies
      expect(patch.notification_matrix.incoming_call).toEqual(['sound']);
    });
  });

  describe('tenant role defaults (D-39/D-43)', () => {
    it('updateTenantPermissionsDefaults whitelists UserLevel keys and PermissionSet fields', async () => {
      await service.updateTenantPermissionsDefaults(7, {
        role_permission_defaults: {
          [UserLevel.OPERATOR]: { can_spy: true, evil_field: 'x' },
          '999': { can_spy: true }, // not a real UserLevel -> discarded
        } as any,
      });

      const created = ccSettingsModel.create.mock.calls[0][0];
      expect(created.role_permission_defaults[UserLevel.OPERATOR]).toEqual({ can_spy: true });
      expect(created.role_permission_defaults).not.toHaveProperty('999');
    });

    it('updateTenantUiDefaults coerces values to booleans', async () => {
      await service.updateTenantUiDefaults(7, {
        ui_visibility_defaults: { coworkers: 1, queues: 0 } as any,
      });

      const created = ccSettingsModel.create.mock.calls[0][0];
      expect(created.ui_visibility_defaults).toEqual({ coworkers: true, queues: false });
    });

    it('updateTenantNotificationDefaults whitelists events/channels', async () => {
      await service.updateTenantNotificationDefaults(7, {
        notification_defaults: { incoming_call: ['sound', 'evil'] } as any,
      });

      const created = ccSettingsModel.create.mock.calls[0][0];
      expect(created.notification_defaults.incoming_call).toEqual(['sound']);
    });
  });
});
