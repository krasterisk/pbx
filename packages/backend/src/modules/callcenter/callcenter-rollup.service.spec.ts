import { CallCenterRollupService, RAW_MAX_DAYS } from './callcenter-rollup.service';

describe('CallCenterRollupService', () => {
  let service: CallCenterRollupService;
  let findAll: jest.Mock;
  let queueUpsert: jest.Mock;
  let agentUpsert: jest.Mock;

  beforeEach(() => {
    findAll = jest.fn().mockResolvedValue([]);
    queueUpsert = jest.fn().mockResolvedValue([{}, true]);
    agentUpsert = jest.fn().mockResolvedValue([{}, true]);
    service = new CallCenterRollupService(
      { findAll } as any,
      { upsert: queueUpsert } as any,
      { upsert: agentUpsert } as any,
    );
  });

  it('recomputeDay groups fixtures and upserts queue aggregates', async () => {
    const day = new Date('2026-07-14T12:00:00');
    findAll.mockResolvedValue([
      {
        user_uid: 1,
        queue_name: 'sales',
        disposition: 'answered',
        wait_time: 10,
        talk_time: 60,
        hold_time: 5,
        wrapup_time: 15,
        agent_interface: 'PJSIP/100',
        agent_user_uid: 10,
      },
      {
        user_uid: 1,
        queue_name: 'sales',
        disposition: 'abandoned',
        wait_time: 40,
        talk_time: 0,
        hold_time: 0,
        wrapup_time: 0,
        agent_interface: '',
        agent_user_uid: null,
      },
      {
        user_uid: 1,
        queue_name: 'sales',
        disposition: 'answered',
        wait_time: 25,
        talk_time: 40,
        hold_time: 0,
        wrapup_time: 10,
        agent_interface: 'PJSIP/100',
        agent_user_uid: 10,
      },
    ]);

    await service.recomputeDay(day);

    expect(queueUpsert).toHaveBeenCalledTimes(1);
    expect(queueUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_uid: 1,
        queue_name: 'sales',
        stat_date: '2026-07-14',
        total_calls: 3,
        answered_calls: 2,
        abandoned_calls: 1,
        sla_met_calls: 1, // wait 10 ≤ 20; wait 25 > 20
        avg_wait_sec: 18, // round((10+25)/2)
        avg_talk_sec: 50,
        max_wait_sec: 40,
        total_talk_sec: 100,
      }),
    );
    expect(agentUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_uid: 1,
        agent_interface: 'PJSIP/100',
        calls_handled: 2,
        total_talk_sec: 100,
        total_wrapup_sec: 25,
      }),
    );
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
    findAll.mockResolvedValue([
      {
        user_uid: 2,
        queue_name: 'support',
        disposition: 'answered',
        wait_time: 5,
        talk_time: 30,
        hold_time: 0,
        wrapup_time: 0,
        agent_interface: 'PJSIP/200',
        agent_user_uid: 20,
      },
    ]);
    const day = new Date('2026-07-10T08:00:00');
    await service.recomputeDay(day);
    await service.recomputeDay(day);
    expect(queueUpsert).toHaveBeenCalledTimes(2);
    expect(agentUpsert).toHaveBeenCalledTimes(2);
    // Never create/destroy — only upsert
    expect((service as any).dailyQueueModel.create).toBeUndefined();
  });

  it('nightlyRollup skips when already running', async () => {
    (service as any).running = true;
    const spy = jest.spyOn(service, 'recomputeDay').mockResolvedValue(undefined);
    await service.nightlyRollup();
    expect(spy).not.toHaveBeenCalled();
  });
});
