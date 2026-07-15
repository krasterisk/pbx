import {
  CallCenterSettingsService,
  DEFAULT_OPERATOR_SETTINGS,
  DEFAULT_ALERT_THRESHOLDS,
  sanitizeAlertThresholds,
} from './callcenter-settings.service';

describe('CallCenterSettingsService', () => {
  let service: CallCenterSettingsService;
  let operatorModel: {
    findOne: jest.Mock;
    create: jest.Mock;
  };
  let ccSettingsModel: {
    findOne: jest.Mock;
    create: jest.Mock;
  };

  beforeEach(() => {
    operatorModel = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((data) => Promise.resolve(data)),
    };
    ccSettingsModel = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((data) => Promise.resolve(data)),
    };
    service = new CallCenterSettingsService(
      operatorModel as any,
      ccSettingsModel as any,
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
});
