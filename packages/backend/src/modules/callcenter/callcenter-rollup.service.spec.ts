import { CallCenterRollupService, RAW_MAX_DAYS, ROLLUP_VERSION } from './callcenter-rollup.service';

type Row = Record<string, unknown>;

function call(partial: Row): Row {
  return {
    user_uid: 1,
    queue_name: 'sales',
    direction: 'inbound',
    disposition: 'answered',
    wait_time: 0,
    talk_time: 0,
    hold_time: 0,
    wrapup_time: 0,
    agent_interface: '',
    agent_user_uid: null,
    ...partial,
  };
}

describe('CallCenterRollupService', () => {
  let service: CallCenterRollupService;
  let rows: Row[];
  let tenantRows: Array<{ user_uid: number }>;
  let findAll: jest.Mock;
  let queueUpsert: jest.Mock;
  let agentUpsert: jest.Mock;
  let tenantConfig: { timezone: string; shortAbandonSec: number; defaultSlaSec: number };
  let slaByQueue: Record<string, number>;
  let intervalService: { recomputeRange: jest.Mock };

  beforeEach(() => {
    rows = [];
    tenantRows = [{ user_uid: 1 }];
    tenantConfig = { timezone: 'UTC', shortAbandonSec: 5, defaultSlaSec: 20 };
    slaByQueue = {};
    intervalService = { recomputeRange: jest.fn().mockResolvedValue(0) };
    // First findAll (with `attributes`) lists tenants, the other loads the tenant's day rows.
    findAll = jest.fn(async (opts: { attributes?: unknown }) => (opts.attributes ? tenantRows : rows));
    queueUpsert = jest.fn().mockResolvedValue([{}, true]);
    agentUpsert = jest.fn().mockResolvedValue([{}, true]);
    const config = {
      getTenantConfig: jest.fn(async () => tenantConfig),
      getSlaThreshold: jest.fn(
        async (_uid: number, queue: string, tenantDefault?: number) =>
          slaByQueue[queue] ?? tenantDefault ?? 20,
      ),
    };
    service = new CallCenterRollupService(
      { findAll } as any,
      { upsert: queueUpsert } as any,
      { upsert: agentUpsert } as any,
      config as any,
      intervalService as any,
    );
  });

  it('recomputeDay groups fixtures and upserts additive v2 queue aggregates', async () => {
    rows = [
      call({ wait_time: 10, talk_time: 60, hold_time: 5, wrapup_time: 15, agent_interface: 'PJSIP/100', agent_user_uid: 10 }),
      call({ disposition: 'abandoned', wait_time: 40 }),
      call({ wait_time: 25, talk_time: 40, wrapup_time: 10, agent_interface: 'PJSIP/100', agent_user_uid: 10 }),
    ];

    await service.recomputeDay('2026-07-14');

    expect(queueUpsert).toHaveBeenCalledTimes(1);
    expect(queueUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_uid: 1,
        queue_name: 'sales',
        stat_date: '2026-07-14',
        total_calls: 3,
        answered_calls: 2,
        abandoned_calls: 1,
        short_abandoned_calls: 0,
        transferred_calls: 0,
        sla_met_calls: 1, // wait 10 <= 20; wait 25 > 20
        sla_threshold_sec: 20,
        avg_wait_sec: 18, // round((10+25)/2)
        avg_talk_sec: 50,
        max_wait_sec: 40,
        total_talk_sec: 100,
        total_wait_sec: 35,
        total_hold_sec: 5,
        total_wrapup_sec: 25,
        rollup_version: ROLLUP_VERSION,
      }),
      { conflictFields: ['vpbx_user_uid', 'stat_date', 'queue_name'] },
    );
    expect(agentUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_uid: 1,
        agent_interface: 'PJSIP/100',
        calls_handled: 2,
        total_talk_sec: 100,
        total_wrapup_sec: 25,
        avg_handle_sec: 63, // talk + wrapup only; talk already includes hold
      }),
      { conflictFields: ['vpbx_user_uid', 'stat_date', 'agent_interface'] },
    );
  });

  it('keeps direct:* and outbound rows out of queue aggregates', async () => {
    rows = [
      call({ wait_time: 3, talk_time: 30, agent_interface: 'PJSIP/100' }),
      call({ queue_name: 'direct:PJSIP/100', direction: 'personal', talk_time: 99, agent_interface: 'PJSIP/100' }),
      call({ queue_name: 'direct:PJSIP/100', direction: 'outbound', talk_time: 99, agent_interface: 'PJSIP/100' }),
      call({ queue_name: 'direct:PJSIP/100', direction: 'outbound', disposition: 'abandoned', wait_time: 50 }),
    ];

    await service.recomputeDay('2026-07-14');

    expect(queueUpsert).toHaveBeenCalledTimes(1);
    expect(queueUpsert.mock.calls[0][0]).toEqual(
      expect.objectContaining({ queue_name: 'sales', total_calls: 1, abandoned_calls: 0 }),
    );
    // Outbound is "made", not "handled"; personal inbound still counts for the agent.
    expect(agentUpsert).toHaveBeenCalledTimes(1);
    expect(agentUpsert.mock.calls[0][0]).toEqual(
      expect.objectContaining({ calls_handled: 2, total_talk_sec: 129 }),
    );
  });

  it('counts transferred as handled and excludes short abandons from the abandoned column', async () => {
    rows = [
      call({ disposition: 'transferred', wait_time: 4, talk_time: 20, agent_interface: 'PJSIP/100' }),
      call({ disposition: 'abandoned', wait_time: 3 }), // short abandon (<= 5s)
      call({ disposition: 'abandoned', wait_time: 6 }),
      call({ disposition: 'timeout', wait_time: 30 }), // EXITWITHTIMEOUT counts as abandoned
    ];

    await service.recomputeDay('2026-07-14');

    expect(queueUpsert.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        total_calls: 4,
        answered_calls: 1,
        transferred_calls: 1,
        abandoned_calls: 2,
        short_abandoned_calls: 1,
      }),
    );
  });

  it('disables the short-abandon exclusion when the tenant sets 0', async () => {
    tenantConfig.shortAbandonSec = 0;
    rows = [call({ disposition: 'abandoned', wait_time: 1 })];

    await service.recomputeDay('2026-07-14');

    expect(queueUpsert.mock.calls[0][0]).toEqual(
      expect.objectContaining({ abandoned_calls: 1, short_abandoned_calls: 0 }),
    );
  });

  it('applies the per-queue service level and stores it on the row', async () => {
    slaByQueue = { sales: 60 };
    rows = [call({ wait_time: 45, talk_time: 10, agent_interface: 'PJSIP/100' })];

    await service.recomputeDay('2026-07-14');

    expect(queueUpsert.mock.calls[0][0]).toEqual(
      expect.objectContaining({ sla_threshold_sec: 60, sla_met_calls: 1 }),
    );
  });

  it('builds the day window in the tenant timezone', async () => {
    tenantConfig.timezone = 'Asia/Tokyo'; // UTC+9, no DST
    await service.recomputeDay('2026-07-14');

    const dayQuery = findAll.mock.calls.find(([opts]) => !opts.attributes)![0];
    const { gte, lt } = Object.getOwnPropertySymbols(dayQuery.where.created_at).reduce(
      (acc, sym) => ({ ...acc, [sym.description!]: dayQuery.where.created_at[sym] }),
      {} as Record<string, Date>,
    );
    expect(gte.toISOString()).toBe('2026-07-13T15:00:00.000Z');
    expect(lt.toISOString()).toBe('2026-07-14T15:00:00.000Z');
  });

  it('recomputes only the given tenant on the reconciler path (no tenant scan)', async () => {
    rows = [call({ user_uid: 9, wait_time: 1, talk_time: 5, agent_interface: 'PJSIP/100' })];

    await service.recomputeDay('2026-07-14', 9);

    expect(findAll.mock.calls.every(([opts]) => !opts.attributes)).toBe(true);
    expect(queueUpsert.mock.calls[0][0]).toEqual(expect.objectContaining({ user_uid: 9 }));
  });

  it('resolveAggregationSource returns raw ≤90d and rollup >90d', () => {
    const start = new Date('2026-01-01T00:00:00');
    const d30 = new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);
    const d90 = new Date(start.getTime() + RAW_MAX_DAYS * 24 * 60 * 60 * 1000);
    const d200 = new Date(start.getTime() + 200 * 24 * 60 * 60 * 1000);

    expect(service.resolveAggregationSource(start, d30)).toBe('raw');
    expect(service.resolveAggregationSource(start, d90)).toBe('raw');
    expect(service.resolveAggregationSource(start, d200)).toBe('rollup');
  });

  it('repeated recomputeDay uses upsert (no create/delete)', async () => {
    rows = [call({ user_uid: 1, queue_name: 'support', wait_time: 5, talk_time: 30, agent_interface: 'PJSIP/200', agent_user_uid: 20 })];
    await service.recomputeDay('2026-07-10');
    await service.recomputeDay('2026-07-10');
    expect(queueUpsert).toHaveBeenCalledTimes(2);
    expect(agentUpsert).toHaveBeenCalledTimes(2);
    // Never create/destroy — only upsert
    expect((service as any).dailyQueueModel.create).toBeUndefined();
  });

  it('rebuilds the 15-minute buckets of the same tenant day from the rows it already loaded', async () => {
    rows = [call({ wait_time: 5, talk_time: 30 })];
    await service.recomputeDay('2026-07-14');

    expect(intervalService.recomputeRange).toHaveBeenCalledTimes(1);
    const [uid, from, to, passedRows] = intervalService.recomputeRange.mock.calls[0];
    expect(uid).toBe(1);
    expect(from).toEqual(new Date('2026-07-14T00:00:00.000Z'));
    expect(to).toEqual(new Date('2026-07-15T00:00:00.000Z'));
    expect(passedRows).toBe(rows);
  });

  it('a failing interval rebuild never breaks the daily rollup', async () => {
    rows = [call({ wait_time: 5, talk_time: 30 })];
    intervalService.recomputeRange.mockRejectedValue(new Error('interval table missing'));

    await expect(service.recomputeDay('2026-07-14')).resolves.toBeUndefined();
    expect(queueUpsert).toHaveBeenCalledTimes(1);
  });

  it('nightlyRollup skips when already running', async () => {
    (service as any).running = true;
    const spy = jest.spyOn(service, 'recomputeDay').mockResolvedValue(undefined);
    await service.nightlyRollup();
    expect(spy).not.toHaveBeenCalled();
  });

  it('nightlyRollup recomputes the previous two days as date keys', async () => {
    const spy = jest.spyOn(service, 'recomputeDay').mockResolvedValue(undefined);
    await service.nightlyRollup();
    expect(spy).toHaveBeenCalledTimes(2);
    for (const [key] of spy.mock.calls) {
      expect(key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});
