import {
  CallCenterMetricsService,
  DEFAULT_SLA_THRESHOLD_SEC,
  QueueAccumulator,
  AgentAccumulator,
} from './callcenter-metrics.service';

describe('CallCenterMetricsService', () => {
  let service: CallCenterMetricsService;
  let queueCallModel: { findAll: jest.Mock };
  let missedCallModel: { findAll: jest.Mock };
  let queueModel: { findOne: jest.Mock };

  beforeEach(() => {
    queueCallModel = { findAll: jest.fn().mockResolvedValue([]) };
    missedCallModel = { findAll: jest.fn().mockResolvedValue([]) };
    queueModel = { findOne: jest.fn().mockResolvedValue(null) };
    service = new CallCenterMetricsService(
      queueCallModel as any,
      missedCallModel as any,
      queueModel as any,
    );
  });

  describe('formula methods', () => {
    const acc: QueueAccumulator = {
      offered: 10,
      answered: 8,
      answeredInSl: 7,
      abandoned: 2,
      sumWaitAnswered: 80,
      sumTalkAnswered: 400,
      sumWrapupAnswered: 80,
    };

    it('computes SLA/ASR/AHT/ASA/Abandon against manual calculation', () => {
      expect(service.computeSla(acc)).toBe(70); // 7/10*100
      expect(service.computeAsr(acc)).toBe(80); // 8/10*100
      expect(service.computeAht(acc)).toBe(60); // (400+80)/8
      expect(service.computeAsa(acc)).toBe(10); // 80/8
      expect(service.computeAbandonRate(acc)).toBe(20); // 2/10*100
    });

    it('returns 0 when offered or answered is zero', () => {
      const empty = {
        offered: 0,
        answered: 0,
        answeredInSl: 0,
        abandoned: 0,
        sumWaitAnswered: 0,
        sumTalkAnswered: 0,
        sumWrapupAnswered: 0,
      };
      expect(service.computeSla(empty)).toBe(0);
      expect(service.computeAsr(empty)).toBe(0);
      expect(service.computeAht(empty)).toBe(0);
      expect(service.computeAsa(empty)).toBe(0);
      expect(service.computeAbandonRate(empty)).toBe(0);
    });

    it('computes Occupancy', () => {
      const agentAcc: AgentAccumulator = { talkSeconds: 300, wrapupSeconds: 60, idleSeconds: 240 };
      // (300+60)/(300+60+240)*100 = 60
      expect(service.computeOccupancy(agentAcc)).toBe(60);
    });
  });

  describe('answeredInSl threshold', () => {
    beforeEach(() => {
      service['slaThresholdCache'].set('1:q_sales', 20);
    });

    it('counts answered call within SLA threshold', () => {
      service.recordAnswered(1, 'q_sales', 'PJSIP/a1', 15, 120, 10);
      const m = service.getQueueMetrics(1, 'q_sales');
      expect(m.answered).toBe(1);
      expect(m.sla).toBe(100);
    });

    it('excludes answered call beyond SLA threshold', () => {
      service.recordAnswered(1, 'q_sales', 'PJSIP/a1', 25, 120, 10);
      const m = service.getQueueMetrics(1, 'q_sales');
      expect(m.answered).toBe(1);
      expect(m.sla).toBe(0);
    });
  });

  describe('resolveSlaThreshold', () => {
    it('returns queue servicelevel when set', async () => {
      queueModel.findOne.mockResolvedValue({ servicelevel: 30 });
      const threshold = await service.resolveSlaThreshold(5, 'q_support');
      expect(threshold).toBe(30);
      expect(queueModel.findOne).toHaveBeenCalledWith({
        where: { name: 'q_support', user_uid: 5 },
        attributes: ['servicelevel'],
      });
    });

    it('falls back to DEFAULT_SLA_THRESHOLD_SEC when null/0', async () => {
      queueModel.findOne.mockResolvedValue({ servicelevel: null });
      expect(await service.resolveSlaThreshold(5, 'q_support')).toBe(DEFAULT_SLA_THRESHOLD_SEC);

      queueModel.findOne.mockResolvedValue({ servicelevel: 0 });
      expect(await service.resolveSlaThreshold(5, 'q_other')).toBe(DEFAULT_SLA_THRESHOLD_SEC);
    });

    it('uses cache on second call', async () => {
      queueModel.findOne.mockResolvedValue({ servicelevel: 45 });
      await service.resolveSlaThreshold(1, 'q1');
      await service.resolveSlaThreshold(1, 'q1');
      expect(queueModel.findOne).toHaveBeenCalledTimes(1);
    });
  });

  describe('tenant isolation', () => {
    beforeEach(() => {
      service['slaThresholdCache'].set('100:shared_q', 20);
      service['slaThresholdCache'].set('200:shared_q', 20);
    });

    it('keeps accumulators independent per tenant', () => {
      service.recordAnswered(100, 'shared_q', 'PJSIP/a1', 10, 60, 5);
      service.recordAnswered(100, 'shared_q', 'PJSIP/a1', 10, 60, 5);
      service.recordAbandoned(200, 'shared_q');

      expect(service.getQueueMetrics(100, 'shared_q').offered).toBe(2);
      expect(service.getQueueMetrics(100, 'shared_q').answered).toBe(2);
      expect(service.getQueueMetrics(200, 'shared_q').offered).toBe(1);
      expect(service.getQueueMetrics(200, 'shared_q').abandoned).toBe(1);
    });
  });

  describe('restoreToday', () => {
    it('rebuilds metrics from cc_queue_calls and isolates tenants', async () => {
      queueModel.findOne.mockImplementation(({ where }: any) => {
        if (where.user_uid === 1) return Promise.resolve({ servicelevel: 20 });
        if (where.user_uid === 2) return Promise.resolve({ servicelevel: 20 });
        return Promise.resolve(null);
      });

      queueCallModel.findAll.mockResolvedValue([
        {
          user_uid: 1,
          queue_name: 'q_a',
          disposition: 'answered',
          wait_time: 10,
          talk_time: 100,
          wrapup_time: 20,
          agent_interface: 'PJSIP/op1',
        },
        {
          user_uid: 1,
          queue_name: 'q_a',
          disposition: 'answered',
          wait_time: 30,
          talk_time: 80,
          wrapup_time: 10,
          agent_interface: 'PJSIP/op1',
        },
        {
          user_uid: 1,
          queue_name: 'q_a',
          disposition: 'abandoned',
          wait_time: 45,
          talk_time: 0,
          wrapup_time: 0,
          agent_interface: '',
        },
        {
          user_uid: 2,
          queue_name: 'q_a',
          disposition: 'answered',
          wait_time: 5,
          talk_time: 50,
          wrapup_time: 5,
          agent_interface: 'PJSIP/op2',
        },
      ]);

      await service.restoreToday();

      const tenant1 = service.getQueueMetrics(1, 'q_a');
      expect(tenant1.offered).toBe(3);
      expect(tenant1.answered).toBe(2);
      expect(tenant1.abandoned).toBe(1);
      expect(tenant1.asa).toBe(20); // (10+30)/2
      expect(tenant1.aht).toBe(105); // (100+20+80+10)/2 = 105
      expect(tenant1.sla).toBe(33.3); // 1 of 3 in SL (wait 10 <= 20)

      const tenant2 = service.getQueueMetrics(2, 'q_a');
      expect(tenant2.offered).toBe(1);
      expect(tenant2.answered).toBe(1);
      expect(tenant2.sla).toBe(100);
    });
  });

  describe('dual shift/day answered·made·missed counters (D-11/D-12/D-31/D-32)', () => {
    beforeEach(() => {
      service['slaThresholdCache'].set('1:q_sales', 20);
    });

    it('recordAnswered bumps both sinceLogin and sinceMidnight answered, agent-level and per-queue', () => {
      service.recordAnswered(1, 'q_sales', 'PJSIP/a1', 10, 60, 5);

      const agentKpi = service.getAgentKpi(1, 'PJSIP/a1');
      expect(agentKpi.sinceLogin.answered).toBe(1);
      expect(agentKpi.sinceMidnight.answered).toBe(1);

      const queueKpi = service.getAgentQueueKpi(1, 'PJSIP/a1', 'q_sales');
      expect(queueKpi.sinceLogin.answered).toBe(1);
      expect(queueKpi.sinceMidnight.answered).toBe(1);
    });

    it('recordMade/recordMissed bump the agent-level counters', () => {
      service.recordMade(1, 'PJSIP/a1');
      service.recordMade(1, 'PJSIP/a1');
      service.recordMissed(1, 'PJSIP/a1');

      const kpi = service.getAgentKpi(1, 'PJSIP/a1');
      expect(kpi.sinceLogin.made).toBe(2);
      expect(kpi.sinceLogin.missed).toBe(1);
      expect(kpi.sinceMidnight.made).toBe(2);
      expect(kpi.sinceMidnight.missed).toBe(1);
    });

    it('recordMade/recordMissed with a queueName also bump the per-queue counters', () => {
      service.recordMade(1, 'PJSIP/a1', 'q_sales');
      service.recordMissed(1, 'PJSIP/a1', 'q_sales');

      const queueKpi = service.getAgentQueueKpi(1, 'PJSIP/a1', 'q_sales');
      expect(queueKpi.sinceLogin.made).toBe(1);
      expect(queueKpi.sinceLogin.missed).toBe(1);

      // agent-level counters unaffected by queue-only lookups being separate keys
      const agentKpi = service.getAgentKpi(1, 'PJSIP/a1');
      expect(agentKpi.sinceLogin.made).toBe(1);
      expect(agentKpi.sinceLogin.missed).toBe(1);
    });

    it('resetKpiSinceLogin zeroes sinceLogin but preserves sinceMidnight, agent + per-queue', () => {
      service.recordAnswered(1, 'q_sales', 'PJSIP/a1', 10, 60, 5);
      service.recordMade(1, 'PJSIP/a1', 'q_sales');

      service.resetKpiSinceLogin(1, 'PJSIP/a1');

      const agentKpi = service.getAgentKpi(1, 'PJSIP/a1');
      expect(agentKpi.sinceLogin).toEqual({ answered: 0, made: 0, missed: 0 });
      expect(agentKpi.sinceMidnight.answered).toBe(1);

      const queueKpi = service.getAgentQueueKpi(1, 'PJSIP/a1', 'q_sales');
      expect(queueKpi.sinceLogin).toEqual({ answered: 0, made: 0, missed: 0 });
      expect(queueKpi.sinceMidnight.made).toBe(1);
    });

    it('resetKpiSinceLogin does not clobber a different agent with a similar interface prefix', () => {
      service.recordMade(1, 'PJSIP/a1');
      service.recordMade(1, 'PJSIP/a10');

      service.resetKpiSinceLogin(1, 'PJSIP/a1');

      expect(service.getAgentKpi(1, 'PJSIP/a1').sinceLogin.made).toBe(0);
      expect(service.getAgentKpi(1, 'PJSIP/a10').sinceLogin.made).toBe(1);
    });

    it('keeps agent-level and per-queue counters isolated per tenant', () => {
      service.recordMade(1, 'PJSIP/a1', 'q_sales');
      service.recordMade(2, 'PJSIP/a1', 'q_sales');

      expect(service.getAgentQueueKpi(1, 'PJSIP/a1', 'q_sales').sinceLogin.made).toBe(1);
      expect(service.getAgentQueueKpi(2, 'PJSIP/a1', 'q_sales').sinceLogin.made).toBe(1);
    });

    it('getAgentQueuesKpi batches getAgentQueueKpi across every queue name given', () => {
      service.recordMade(1, 'PJSIP/a1', 'q_sales');
      service.recordAnswered(1, 'q_support', 'PJSIP/a1', 5, 30, 0);

      const result = service.getAgentQueuesKpi(1, 'PJSIP/a1', ['q_sales', 'q_support', 'q_empty']);

      expect(result.q_sales.sinceLogin.made).toBe(1);
      expect(result.q_support.sinceLogin.answered).toBe(1);
      expect(result.q_empty).toEqual({
        sinceLogin: { answered: 0, made: 0, missed: 0 },
        sinceMidnight: { answered: 0, made: 0, missed: 0 },
      });
    });
  });

  describe('restoreToday KPI rebuild (D-11/D-12 day counter)', () => {
    it('rebuilds sinceMidnight answered from answered/transferred cc_queue_calls rows, never sinceLogin', async () => {
      queueModel.findOne.mockResolvedValue({ servicelevel: 20 });
      queueCallModel.findAll.mockResolvedValue([
        {
          user_uid: 1,
          queue_name: 'q_a',
          disposition: 'answered',
          wait_time: 10,
          talk_time: 100,
          wrapup_time: 20,
          agent_interface: 'PJSIP/op1',
        },
        {
          user_uid: 1,
          queue_name: 'q_a',
          disposition: 'transferred',
          wait_time: 5,
          talk_time: 50,
          wrapup_time: 0,
          agent_interface: 'PJSIP/op1',
        },
      ]);

      await service.restoreToday();

      const kpi = service.getAgentKpi(1, 'PJSIP/op1');
      expect(kpi.sinceMidnight.answered).toBe(2);
      expect(kpi.sinceLogin.answered).toBe(0);

      const queueKpi = service.getAgentQueueKpi(1, 'PJSIP/op1', 'q_a');
      expect(queueKpi.sinceMidnight.answered).toBe(2);
    });

    it('does not count in-queue abandoned rows as a personal missed (D-10/D-20)', async () => {
      queueModel.findOne.mockResolvedValue({ servicelevel: 20 });
      queueCallModel.findAll.mockResolvedValue([
        {
          user_uid: 1,
          queue_name: 'q_a',
          disposition: 'abandoned',
          wait_time: 45,
          talk_time: 0,
          wrapup_time: 0,
          agent_interface: '',
        },
      ]);

      await service.restoreToday();

      expect(service.getAgentKpi(1, 'PJSIP/op1').sinceMidnight.missed).toBe(0);
    });
  });

  describe('recordAgentStatus occupancy', () => {
    it('accumulates idle seconds while READY', () => {
      jest.useFakeTimers();
      const base = Date.now();
      jest.setSystemTime(base);

      service.recordAgentStatus(1, 'PJSIP/a1', 'READY');
      jest.setSystemTime(base + 120_000);
      service.recordAgentStatus(1, 'PJSIP/a1', 'IN_CALL');

      expect(service.getAgentOccupancy(1, 'PJSIP/a1')).toBe(0); // no talk yet

      service.recordAnswered(1, 'q1', 'PJSIP/a1', 5, 60, 0);
      const occ = service.getAgentOccupancy(1, 'PJSIP/a1');
      // talk 60 / (talk 60 + idle 120) = 33.3%
      expect(occ).toBe(33.3);

      jest.useRealTimers();
    });
  });
});
