import { ForbiddenException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UserLevel } from '../users/user.model';
import { CallCenterIntervalsController } from './callcenter-intervals.controller';
import { QueueIntervalsQueryDto } from './dto/queue-intervals-query.dto';

describe('CallCenterIntervalsController', () => {
  const getQueueIntervals = jest.fn().mockResolvedValue({ rows: [] });
  const getRecentQueueSla = jest.fn().mockResolvedValue([]);
  const controller = new CallCenterIntervalsController({ getQueueIntervals, getRecentQueueSla } as any);
  const query = { dateFrom: '2026-07-15', dateTo: '2026-07-15' } as QueueIntervalsQueryDto;

  beforeEach(() => getQueueIntervals.mockClear());

  it('reads the tenant from the JWT user, never from the query', async () => {
    await controller.getQueueIntervals({ user: { level: UserLevel.SUPERVISOR, vpbx_user_uid: 7 } } as any, {
      ...query,
      vpbx_user_uid: 999,
    } as any);
    expect(getQueueIntervals).toHaveBeenCalledWith(7, expect.objectContaining({ dateFrom: '2026-07-15' }));
    expect(getQueueIntervals.mock.calls[0][0]).toBe(7);
  });

  it('is allowed for admins and forbidden for read-only users', async () => {
    await expect(
      Promise.resolve().then(() => controller.getQueueIntervals({ user: { level: UserLevel.ADMIN, vpbx_user_uid: 1 } } as any, query)),
    ).resolves.toBeDefined();
    expect(() =>
      controller.getQueueIntervals({ user: { level: UserLevel.READONLY, vpbx_user_uid: 1 } } as any, query),
    ).toThrow(ForbiddenException);
    expect(getQueueIntervals).toHaveBeenCalledTimes(1);
  });

  describe('recent SLA', () => {
    beforeEach(() => getRecentQueueSla.mockClear());

    it('reads the tenant from the JWT user', async () => {
      await controller.getRecentQueueSla({ user: { level: UserLevel.SUPERVISOR, vpbx_user_uid: 7 } } as any);
      expect(getRecentQueueSla).toHaveBeenCalledWith(7);
    });

    it('is forbidden for read-only users', () => {
      expect(() => controller.getRecentQueueSla({ user: { level: UserLevel.READONLY, vpbx_user_uid: 1 } } as any)).toThrow(ForbiddenException);
      expect(getRecentQueueSla).not.toHaveBeenCalled();
    });
  });

  describe('query validation', () => {
    const check = (raw: Record<string, unknown>) => validate(plainToInstance(QueueIntervalsQueryDto, raw));

    it('accepts a valid query with string granularity from the URL', async () => {
      expect(await check({ dateFrom: '2026-07-15', dateTo: '2026-07-15', granularityMin: '30', compare: 'weekAgo' })).toHaveLength(0);
    });

    it('rejects bad dates, granularity and compare values', async () => {
      expect((await check({ dateFrom: '15.07.2026', dateTo: '2026-07-15' })).length).toBeGreaterThan(0);
      expect((await check({ dateFrom: '2026-07-15', dateTo: '2026-07-15', granularityMin: '10' })).length).toBeGreaterThan(0);
      expect((await check({ dateFrom: '2026-07-15', dateTo: '2026-07-15', compare: 'monthAgo' })).length).toBeGreaterThan(0);
    });
  });
});
