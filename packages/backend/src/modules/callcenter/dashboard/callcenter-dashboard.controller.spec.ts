import { ForbiddenException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UserLevel } from '../../users/user.model';
import { CallCenterDashboardController } from './callcenter-dashboard.controller';
import { DashboardOverviewQueryDto } from './dto/dashboard-overview-query.dto';

describe('CallCenterDashboardController', () => {
  const getOverview = jest.fn().mockResolvedValue({ version: 1 });
  const controller = new CallCenterDashboardController(
    { getOverview } as any,
    { resolveScope: jest.fn().mockResolvedValue({ operators: null, queues: null }) } as any,
  );

  beforeEach(() => getOverview.mockClear());

  it('takes the tenant from the JWT user and passes the query through', async () => {
    const query = { period: '7d' } as DashboardOverviewQueryDto;
    await controller.getOverview({ user: { level: UserLevel.SUPERVISOR, vpbx_user_uid: 7 } } as any, {
      ...query,
      vpbx_user_uid: 999,
    } as any);
    expect(getOverview.mock.calls[0][0]).toBe(7);
    expect(getOverview.mock.calls[0][1]).toMatchObject({ period: '7d' });
  });

  it('is forbidden for read-only users and never reaches the service', async () => {
    await expect(
      controller.getOverview({ user: { level: UserLevel.READONLY, vpbx_user_uid: 1 } } as any, {}),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(getOverview).not.toHaveBeenCalled();
  });

  describe('query validation', () => {
    const check = (raw: Record<string, unknown>) => validate(plainToInstance(DashboardOverviewQueryDto, raw));

    it('accepts the documented parameters, converting compare from the URL string', async () => {
      const dto = plainToInstance(DashboardOverviewQueryDto, {
        period: 'custom', from: '2026-07-01', to: '2026-07-03', compare: 'false', queues: 'sales,support',
      });
      expect(await validate(dto)).toHaveLength(0);
      expect(dto.compare).toBe(false);
    });

    it('accepts an empty query', async () => {
      expect(await check({})).toHaveLength(0);
    });

    it('rejects unknown presets, malformed dates and a non-boolean compare', async () => {
      expect((await check({ period: 'decade' })).length).toBeGreaterThan(0);
      expect((await check({ period: 'custom', from: '1.7.2026' })).length).toBeGreaterThan(0);
      expect((await check({ compare: 'maybe' })).length).toBeGreaterThan(0);
    });
  });
});
