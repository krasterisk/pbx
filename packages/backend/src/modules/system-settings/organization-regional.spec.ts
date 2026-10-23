import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { validate } from 'class-validator';
import { OrganizationRegionalDto } from './organization-regional.dto';
import { SystemSettingsService } from './system-settings.service';
import type { JwtPayloadUser } from '../auth/auth.service';

describe('combined organization regional settings', () => {
  const user = { sub: 7, level: 1, vpbx_user_uid: 42 } as JwtPayloadUser;
  const values = { timezone: 'Asia/Krasnoyarsk', weekStart: 'sunday' as const };
  function fixture(cloud = false) {
    const tx = {}, query = jest.fn().mockResolvedValue(cloud ? [{ timezone: 'UTC' }] : []);
    const upsert = jest.fn().mockResolvedValue(undefined), audit = { create: jest.fn() };
    const transaction = jest.fn(async work => work(tx));
    const service = new SystemSettingsService({ sequelize: { query, transaction, getDialect: () => 'mysql' }, upsert } as never, { get: () => 'UTC' } as never, audit as never);
    return { service, query, upsert, audit, transaction, tx };
  }
  it('validates both required fields and requires a tenant administrator before SQL', async () => {
    const f = fixture();
    for (const invalid of [{ ...values, timezone: 'bad/zone' }, { ...values, weekStart: 'tuesday' }, { timezone: 'UTC' }, { weekStart: 'monday' }]) {
      expect((await validate(Object.assign(new OrganizationRegionalDto(), invalid))).length).toBeGreaterThan(0);
      await expect(f.service.setOrganizationRegional(user, invalid as never)).rejects.toThrow(BadRequestException);
    }
    await expect(f.service.setOrganizationRegional({ ...user, level: 2 }, values)).rejects.toThrow(ForbiddenException);
    await expect(f.service.setOrganizationRegional({ ...user, vpbx_user_uid: -1 }, values)).rejects.toThrow(ForbiddenException);
    expect(f.query).not.toHaveBeenCalled(); expect(f.transaction).not.toHaveBeenCalled();
  });
  it('persists box timezone, week policy and audit in one tenant-bound transaction', async () => {
    const f = fixture();
    await expect(f.service.setOrganizationRegional({ ...user, vpbx_user_uid: 0 }, values)).resolves.toEqual({ ...values, canEdit: true });
    expect(f.transaction).toHaveBeenCalledTimes(1);
    expect(f.upsert).toHaveBeenCalledWith(expect.objectContaining({ key: 'organization.timezone.0', value: values.timezone }), { transaction: f.tx });
    expect(f.upsert).toHaveBeenCalledWith(expect.objectContaining({ key: 'organization.weekStart.0', value: 'sunday' }), { transaction: f.tx });
    expect(f.audit.create).toHaveBeenCalledWith(expect.objectContaining({ user_uid: 0, action: 'organization_regional_update', details: JSON.stringify(values) }), { transaction: f.tx });
  });
  it('uses the cloud tenant timezone with the same transaction as its week policy', async () => {
    const f = fixture(true);
    await f.service.setOrganizationRegional(user, values);
    expect(f.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE tenants'), { replacements: { tenant: 42, timezone: values.timezone }, transaction: f.tx });
    expect(f.upsert).toHaveBeenCalledTimes(1);
    expect(f.upsert).toHaveBeenCalledWith(expect.objectContaining({ key: 'organization.weekStart.42' }), { transaction: f.tx });
  });
  it('propagates write and audit failures to the transaction, without reporting success', async () => {
    for (const failing of ['week', 'audit']) {
      const f = fixture();
      if (failing === 'week') f.upsert.mockImplementation(async row => { if (row.key.includes('weekStart')) throw new Error('write failed'); });
      else f.audit.create.mockRejectedValue(new Error('write failed'));
      await expect(f.service.setOrganizationRegional(user, values)).rejects.toThrow('write failed');
      if (failing === 'week') expect(f.audit.create).not.toHaveBeenCalled();
    }
  });
  it('reads both values from the authenticated tenant, without hiding database failures', async () => {
    const f = fixture();
    await expect(f.service.organizationRegional(user)).resolves.toEqual({ timezone: 'UTC', weekStart: 'monday', canEdit: true });
    f.query.mockRejectedValue(new Error('offline'));
    await expect(f.service.organizationRegional(user)).rejects.toThrow('offline');
  });
});
