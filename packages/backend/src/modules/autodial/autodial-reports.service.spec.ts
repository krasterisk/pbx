import { Op } from 'sequelize';
import { AutodialReportsService } from './autodial-reports.service';

function setup() {
  const service = Object.create(AutodialReportsService.prototype) as AutodialReportsService;
  const query = jest.fn().mockResolvedValue([]);
  const findAll = jest.fn().mockResolvedValue([]);
  service['sequelize'] = { query, fn: jest.fn(), col: jest.fn(), literal: jest.fn(), getDialect: () => 'mysql' } as never;
  service['attemptModel'] = { findAll } as never;
  service['metricsConfig'] = { getTenantConfig: jest.fn().mockResolvedValue({ timezone: 'Asia/Krasnoyarsk' }) } as never;
  return { service, query, findAll };
}

describe('Autodial durable reporting', () => {
  it('uses complete tenant days, including the final fractional second', async () => {
    const { service, findAll } = setup();
    await service.detail(7, { from: '2026-10-16', to: '2026-10-16' });
    const bounds = findAll.mock.calls[0][0].where.started_at;
    expect(bounds[Op.gte].toISOString()).toBe('2026-10-15T17:00:00.000Z');
    expect(bounds[Op.lt].toISOString()).toBe('2026-10-16T17:00:00.000Z');
  });

  it('reads daily series from attempts even when no nightly rollup exists', async () => {
    const { service, query } = setup();
    query.mockResolvedValue([{ campaign_uid: '4', day: '2026-10-16', dials: '20', answered: '10' }]);
    const rows = await service.daily(7, { from: '2026-10-16', to: '2026-10-16', campaignUids: [4] });
    expect(rows[0]).toMatchObject({ campaign_uid: 4, dials: 20, answered: 10 });
    expect(query.mock.calls[0][0]).toContain('FROM ac_attempts');
    expect(query.mock.calls[0][1].replacements).toMatchObject({ userUid: 7, campaignUids: [4], day0: '2026-10-16' });
  });

  it('rebuilds monitor totals after a fresh process starts', async () => {
    const { service, findAll } = setup();
    const runtime = { status: 'draft', dials: 0, answered: 0, success: 0, reserved: 0, capacity: 0 };
    service['campaignModel'] = { findAll: jest.fn().mockResolvedValue([{ uid: 4, status: 'stopped' }]) } as never;
    service['state'] = { ensureRuntime: () => runtime, activeChannels: () => 0 } as never;
    jest.spyOn(service as never, 'taskStatusCounts').mockResolvedValue(new Map() as never);
    findAll.mockResolvedValue([{ campaign_uid: 4, dials: '20', answered: '10', success: '3' }]);
    expect(await service.liveStats(7)).toEqual([expect.objectContaining({ status: 'stopped', dials_today: 20, answered_today: 10, success_today: 3, contact_rate: 50 })]);
    expect(runtime.status).toBe('stopped');
  });

  it.each([['2026-02-30', '2026-03-01'], ['2026-10-17', '2026-10-16'], ['2020-01-01', '2026-01-01']])(
    'rejects invalid or unbounded calendar range %s to %s', async (from, to) => {
      const { service, findAll } = setup();
      await expect(service.detail(7, { from, to })).rejects.toMatchObject({ response: { code: 'AC_REPORT_RANGE' } });
      expect(findAll).not.toHaveBeenCalled();
    },
  );
});
