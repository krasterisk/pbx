import { DEFAULT_SLA_THRESHOLD_SEC, DEFAULT_SHORT_ABANDON_SEC } from '@krasterisk/shared';
import { CallCenterMetricsConfigService } from './callcenter-metrics-config.service';

describe('CallCenterMetricsConfigService', () => {
  let settingsModel: { findAll: jest.Mock };
  let queueModel: { findOne: jest.Mock };
  let sequelize: { query: jest.Mock };
  let env: { get: jest.Mock };
  let service: CallCenterMetricsConfigService;

  beforeEach(() => {
    settingsModel = { findAll: jest.fn().mockResolvedValue([]) };
    queueModel = { findOne: jest.fn().mockResolvedValue(null) };
    sequelize = { query: jest.fn().mockResolvedValue([]) };
    env = { get: jest.fn().mockReturnValue('UTC') };
    service = new CallCenterMetricsConfigService(
      settingsModel as any,
      queueModel as any,
      sequelize as any,
      env as any,
    );
  });

  describe('resolve SLA threshold', () => {
    it('returns queue servicelevel when set', async () => {
      queueModel.findOne.mockResolvedValue({ servicelevel: 30 });
      expect(await service.getSlaThreshold(5, 'q_support')).toBe(30);
      expect(queueModel.findOne).toHaveBeenCalledWith({
        where: { name: 'q_support', user_uid: 5 },
        attributes: ['servicelevel'],
      });
    });

    it('falls back to the tenant default when servicelevel is null/0', async () => {
      queueModel.findOne.mockResolvedValue({ servicelevel: null });
      expect(await service.getSlaThreshold(5, 'q_a', 45)).toBe(45);

      queueModel.findOne.mockResolvedValue({ servicelevel: 0 });
      expect(await service.getSlaThreshold(5, 'q_b', 45)).toBe(45);
    });

    it('falls back to DEFAULT_SLA_THRESHOLD_SEC when neither queue nor tenant specify one', async () => {
      queueModel.findOne.mockResolvedValue({ servicelevel: null });
      expect(await service.getSlaThreshold(5, 'q_a')).toBe(DEFAULT_SLA_THRESHOLD_SEC);
    });

    it('uses the tenant cc_settings default when the queue has none', async () => {
      settingsModel.findAll.mockResolvedValue([
        { user_uid: 5, default_sla_threshold: 40, short_abandon_sec: 5, shift_policy: null },
      ]);
      queueModel.findOne.mockResolvedValue(null);
      expect(await service.getSlaThreshold(5, 'q_a')).toBe(40);
    });

    it('caches per tenant and queue', async () => {
      queueModel.findOne.mockResolvedValue({ servicelevel: 45 });
      await service.getSlaThreshold(1, 'q1');
      await service.getSlaThreshold(1, 'q1');
      expect(queueModel.findOne).toHaveBeenCalledTimes(1);
      await service.getSlaThreshold(2, 'q1');
      expect(queueModel.findOne).toHaveBeenCalledTimes(2);
    });

    it('invalidate(uid) drops only that tenant so a new service level applies', async () => {
      queueModel.findOne.mockResolvedValue({ servicelevel: 10 });
      await service.getSlaThreshold(1, 'q1');
      await service.getSlaThreshold(2, 'q1');
      service.invalidate(1);

      queueModel.findOne.mockResolvedValue({ servicelevel: 25 });
      expect(await service.getSlaThreshold(1, 'q1')).toBe(25);
      expect(await service.getSlaThreshold(2, 'q1')).toBe(10);
    });

    it('peekSlaThreshold is synchronous and defaults before a value is cached', () => {
      expect(service.peekSlaThreshold(1, 'q1')).toBe(DEFAULT_SLA_THRESHOLD_SEC);
      service.primeSlaThreshold(1, 'q1', 33);
      expect(service.peekSlaThreshold(1, 'q1')).toBe(33);
    });
  });

  describe('tenant config', () => {
    it('combines cc_settings values with the tenants.timezone', async () => {
      settingsModel.findAll.mockResolvedValue([
        { user_uid: 7, default_sla_threshold: 30, short_abandon_sec: 8, shift_policy: { close_at_eod: true } },
      ]);
      sequelize.query.mockResolvedValue([{ vpbx_user_uid: 7, timezone: 'Europe/Moscow' }]);

      const cfg = await service.getTenantConfig(7);

      expect(cfg).toEqual({ timezone: 'Europe/Moscow', shortAbandonSec: 8, defaultSlaSec: 30 });
    });

    it('gives a tenant without cc_settings the documented defaults', async () => {
      sequelize.query.mockResolvedValue([{ vpbx_user_uid: 9, timezone: 'Asia/Tokyo' }]);

      const all = await service.loadAll();

      expect(all.get(9)).toMatchObject({
        hasSettings: false,
        config: { timezone: 'Asia/Tokyo', shortAbandonSec: DEFAULT_SHORT_ABANDON_SEC, defaultSlaSec: DEFAULT_SLA_THRESHOLD_SEC },
      });
    });

    it('clamps a stored short_abandon_sec outside the allowed range', async () => {
      settingsModel.findAll.mockResolvedValue([
        { user_uid: 1, default_sla_threshold: 20, short_abandon_sec: 9999, shift_policy: null },
      ]);
      expect((await service.getTenantConfig(1)).shortAbandonSec).toBeLessThanOrEqual(60);
    });

    it('falls back to the default timezone for an invalid tenant timezone', async () => {
      sequelize.query.mockResolvedValue([{ vpbx_user_uid: 3, timezone: 'Not/AZone' }]);
      expect((await service.getTenantConfig(3)).timezone).toBe('UTC');
    });

    it('uses PBX_DEFAULT_TIMEZONE for tenants without a timezone', async () => {
      env.get.mockReturnValue('Europe/Berlin');
      expect((await service.getTenantConfig(4)).timezone).toBe('Europe/Berlin');
    });

    it('ignores an invalid PBX_DEFAULT_TIMEZONE', () => {
      env.get.mockReturnValue('garbage');
      expect(service.defaultTimezone()).toBe('UTC');
    });

    it('survives a missing tenants table (box install) and a failing settings read', async () => {
      sequelize.query.mockRejectedValue(new Error('no such table: tenants'));
      settingsModel.findAll.mockRejectedValue(new Error('db down'));

      await expect(service.getTenantConfig(1)).resolves.toEqual({
        timezone: 'UTC',
        shortAbandonSec: DEFAULT_SHORT_ABANDON_SEC,
        defaultSlaSec: DEFAULT_SLA_THRESHOLD_SEC,
      });
    });

    it('caches the tenant config for a short TTL and reloads after invalidate', async () => {
      settingsModel.findAll.mockResolvedValue([
        { user_uid: 1, default_sla_threshold: 20, short_abandon_sec: 5, shift_policy: null },
      ]);
      await service.getTenantConfig(1);
      await service.getTenantConfig(1);
      expect(settingsModel.findAll).toHaveBeenCalledTimes(1);

      settingsModel.findAll.mockResolvedValue([
        { user_uid: 1, default_sla_threshold: 20, short_abandon_sec: 12, shift_policy: null },
      ]);
      service.invalidate(1);
      expect((await service.getTenantConfig(1)).shortAbandonSec).toBe(12);
    });

    it('getMetricsConfig merges tenant short-abandon with the queue SLA', async () => {
      settingsModel.findAll.mockResolvedValue([
        { user_uid: 1, default_sla_threshold: 20, short_abandon_sec: 7, shift_policy: null },
      ]);
      queueModel.findOne.mockResolvedValue({ servicelevel: 90 });

      await expect(service.getMetricsConfig(1, 'q1')).resolves.toMatchObject({
        slaThresholdSec: 90,
        shortAbandonSec: 7,
      });
    });
  });
});
