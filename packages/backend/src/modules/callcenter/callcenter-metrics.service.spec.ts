import { emptyQueueTotals, type QueueTotals } from '@krasterisk/shared';
import {
  CallCenterMetricsService,
  DEFAULT_SLA_THRESHOLD_SEC,
  QueueAccumulator,
  AgentAccumulator,
} from './callcenter-metrics.service';

const LOCAL_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

function totals(partial: Partial<QueueTotals>): QueueAccumulator {
  return { ...emptyQueueTotals(), ...partial };
}

describe('CallCenterMetricsService', () => {
  let service: CallCenterMetricsService;
  let queueCallModel: { findAll: jest.Mock };
  let missedCallModel: { findAll: jest.Mock };
  let offerModel: { findAll: jest.Mock };
  let sessionModel: { findAll: jest.Mock };
  let agentEventModel: { findAll: jest.Mock };
  let config: {
    loadAll: jest.Mock;
    peekTenantConfig: jest.Mock;
    peekSlaThreshold: jest.Mock;
    getSlaThreshold: jest.Mock;
    getMetricsConfig: jest.Mock;
  };
  let tenantConfig: { timezone: string; shortAbandonSec: number; defaultSlaSec: number };
  let slaByQueue: Record<string, number>;
  let tenants: Map<number, unknown>;

  beforeEach(() => {
    queueCallModel = { findAll: jest.fn().mockResolvedValue([]) };
    missedCallModel = { findAll: jest.fn().mockResolvedValue([]) };
    offerModel = { findAll: jest.fn().mockResolvedValue([]) };
    sessionModel = { findAll: jest.fn().mockResolvedValue([]) };
    agentEventModel = { findAll: jest.fn().mockResolvedValue([]) };
    tenantConfig = { timezone: LOCAL_TZ, shortAbandonSec: 5, defaultSlaSec: DEFAULT_SLA_THRESHOLD_SEC };
    slaByQueue = {};
    tenants = new Map();
    config = {
      loadAll: jest.fn(async () => tenants),
      peekTenantConfig: jest.fn(() => tenantConfig),
      peekSlaThreshold: jest.fn(
        (uid: number, queue: string) => slaByQueue[`${uid}:${queue}`] ?? slaByQueue[queue] ?? tenantConfig.defaultSlaSec,
      ),
      getSlaThreshold: jest.fn(
        async (uid: number, queue: string) => slaByQueue[`${uid}:${queue}`] ?? slaByQueue[queue] ?? tenantConfig.defaultSlaSec,
      ),
      getMetricsConfig: jest.fn(async (uid: number, queue: string) => ({
        slaThresholdSec: slaByQueue[`${uid}:${queue}`] ?? slaByQueue[queue] ?? tenantConfig.defaultSlaSec,
        shortAbandonSec: tenantConfig.shortAbandonSec,
      })),
    };
    service = new CallCenterMetricsService(
      queueCallModel as any,
      missedCallModel as any,
      offerModel as any,
      config as any,
      sessionModel as any,
      agentEventModel as any,
    );
  });

  describe('formula methods', () => {
    const acc = totals({
      offered: 10,
      handled: 8,
      handledInSl: 7,
      abandoned: 2,
      sumWaitHandled: 80,
      sumTalkHandled: 400,
      sumWrapupHandled: 80,
    });

    it('computes SLA/ASR/AHT/ASA/Abandon against manual calculation', () => {
      expect(service.computeSla(acc)).toBe(70); // 7/10*100
      expect(service.computeAsr(acc)).toBe(80); // 8/10*100
      expect(service.computeAht(acc)).toBe(60); // (400+80)/8
      expect(service.computeAsa(acc)).toBe(10); // 80/8
      expect(service.computeAbandonRate(acc)).toBe(20); // 2/10*100
    });

    it('excludes short abandons from the denominator of every rate', () => {
      const withShort = totals({
        offered: 10,
        handled: 7,
        handledInSl: 7,
        abandoned: 1,
        shortAbandoned: 2,
        sumWaitHandled: 70,
      });
      // effective offered = 10 - 2 = 8
      expect(service.computeSla(withShort)).toBe(87.5);
      expect(service.computeAsr(withShort)).toBe(87.5);
      expect(service.computeAbandonRate(withShort)).toBe(12.5);
    });

    it('returns 0 when offered or answered is zero', () => {
      const empty = emptyQueueTotals();
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

  describe('handled-in-SLA threshold', () => {
    beforeEach(() => {
      slaByQueue = { q_sales: 20 };
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

    it('uses the per-queue service level, not a global threshold', () => {
      slaByQueue = { q_sales: 60 };
      service.recordAnswered(1, 'q_sales', 'PJSIP/a1', 45, 120, 10);
      expect(service.getQueueMetrics(1, 'q_sales').sla).toBe(100);
    });
  });

  describe('SLA threshold delegation', () => {
    it('resolveSlaThreshold delegates to the shared tenant config', async () => {
      slaByQueue = { q_support: 30 };
      expect(await service.resolveSlaThreshold(5, 'q_support')).toBe(30);
      expect(config.getSlaThreshold).toHaveBeenCalledWith(5, 'q_support');
    });
  });

  describe('live short abandon (R2)', () => {
    it('excludes a quick hang-up from SLA and abandon rate but still counts it as offered', () => {
      slaByQueue = { q_sales: 20 };
      service.recordAnswered(1, 'q_sales', 'PJSIP/a1', 10, 60, 0);
      service.recordAbandoned(1, 'q_sales', 3); // short (<= 5s)
      const m = service.getQueueMetrics(1, 'q_sales');
      expect(m.offered).toBe(2);
      expect(m.shortAbandoned).toBe(1);
      expect(m.abandoned).toBe(0);
      expect(m.sla).toBe(100);
      expect(m.abandonRate).toBe(0);
    });

    it('keeps a long abandon in the abandon rate', () => {
      service.recordAnswered(1, 'q_sales', 'PJSIP/a1', 10, 60, 0);
      service.recordAbandoned(1, 'q_sales', 30);
      const m = service.getQueueMetrics(1, 'q_sales');
      expect(m.abandoned).toBe(1);
      expect(m.abandonRate).toBe(50);
      expect(m.sla).toBe(50);
    });

    it('counts every abandon when the tenant disables the short-abandon window', () => {
      tenantConfig.shortAbandonSec = 0;
      service.recordAbandoned(1, 'q_sales', 1);
      const m = service.getQueueMetrics(1, 'q_sales');
      expect(m.abandoned).toBe(1);
      expect(m.shortAbandoned).toBe(0);
    });
  });

  describe('tenant isolation', () => {
    it('keeps accumulators independent per tenant', () => {
      service.recordAnswered(100, 'shared_q', 'PJSIP/a1', 10, 60, 5);
      service.recordAnswered(100, 'shared_q', 'PJSIP/a1', 10, 60, 5);
      service.recordAbandoned(200, 'shared_q', 30);

      expect(service.getQueueMetrics(100, 'shared_q').offered).toBe(2);
      expect(service.getQueueMetrics(100, 'shared_q').answered).toBe(2);
      expect(service.getQueueMetrics(200, 'shared_q').offered).toBe(1);
      expect(service.getQueueMetrics(200, 'shared_q').abandoned).toBe(1);
    });
  });

  describe('restoreToday', () => {
    it('rebuilds metrics from cc_queue_calls and isolates tenants', async () => {
      queueCallModel.findAll.mockResolvedValue([
        { user_uid: 1, queue_name: 'q_a', disposition: 'answered', wait_time: 10, talk_time: 100, wrapup_time: 20, agent_interface: 'PJSIP/op1' },
        { user_uid: 1, queue_name: 'q_a', disposition: 'answered', wait_time: 30, talk_time: 80, wrapup_time: 10, agent_interface: 'PJSIP/op1' },
        { user_uid: 1, queue_name: 'q_a', disposition: 'abandoned', wait_time: 45, talk_time: 0, wrapup_time: 0, agent_interface: '' },
        { user_uid: 2, queue_name: 'q_a', disposition: 'answered', wait_time: 5, talk_time: 50, wrapup_time: 5, agent_interface: 'PJSIP/op2' },
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

    it('applies the short-abandon rule and keeps transferred inside handled', async () => {
      queueCallModel.findAll.mockResolvedValue([
        { user_uid: 1, queue_name: 'q_a', disposition: 'transferred', wait_time: 4, talk_time: 20, wrapup_time: 0, agent_interface: 'PJSIP/op1' },
        { user_uid: 1, queue_name: 'q_a', disposition: 'abandoned', wait_time: 3, agent_interface: '' }, // short
        { user_uid: 1, queue_name: 'q_a', disposition: 'abandoned', wait_time: 30, agent_interface: '' },
        { user_uid: 1, queue_name: 'q_a', disposition: 'timeout', wait_time: 40, agent_interface: '' }, // EXITWITHTIMEOUT
      ]);

      await service.restoreToday();

      const m = service.getQueueMetrics(1, 'q_a');
      expect(m.offered).toBe(4);
      expect(m.answered).toBe(1);
      expect(m.transferred).toBe(1);
      expect(m.shortAbandoned).toBe(1);
      expect(m.abandoned).toBe(2);
      expect(m.abandonRate).toBe(round1((2 / 3) * 100));
      expect(m.sla).toBe(round1((1 / 3) * 100));
    });

    it('keeps direct:* / outbound rows out of queue aggregates', async () => {
      queueCallModel.findAll.mockResolvedValue([
        { user_uid: 1, queue_name: 'q_a', disposition: 'answered', wait_time: 2, talk_time: 10, wrapup_time: 0, agent_interface: 'PJSIP/op1', direction: 'inbound' },
        { user_uid: 1, queue_name: 'direct:PJSIP/op1', disposition: 'answered', wait_time: 0, talk_time: 99, wrapup_time: 0, agent_interface: 'PJSIP/op1', direction: 'personal' },
        { user_uid: 1, queue_name: 'direct:PJSIP/op1', disposition: 'abandoned', wait_time: 60, agent_interface: 'PJSIP/op1', direction: 'outbound' },
      ]);

      await service.restoreToday();

      expect(service.getQueueMetrics(1, 'q_a').offered).toBe(1);
      expect(service.getQueueMetrics(1, 'direct:PJSIP/op1').offered).toBe(0);
      expect(service.getTenantQueueMetrics(1).map((m) => m.queueName)).toEqual(['q_a']);
    });

    it('filters rows by business-day EOD boundary per tenant', async () => {
      tenants.set(1, {
        config: { ...tenantConfig },
        rawShiftPolicy: { close_at_eod: true, eod_time: '08:00' },
        hasSettings: true,
      });

      const now = new Date();
      // Force "after 08:00 today" — use relative stamps.
      const afterBoundary = new Date();
      afterBoundary.setHours(10, 0, 0, 0);
      if (now.getHours() < 8) {
        // Test runs before 08:00: business day started yesterday 08:00
        afterBoundary.setDate(afterBoundary.getDate() - 1);
        afterBoundary.setHours(10, 0, 0, 0);
      }
      const beforeBoundary = new Date(afterBoundary);
      beforeBoundary.setDate(beforeBoundary.getDate() - 1);
      beforeBoundary.setHours(7, 0, 0, 0);

      queueCallModel.findAll.mockResolvedValue([
        { user_uid: 1, queue_name: 'q_a', disposition: 'answered', wait_time: 5, talk_time: 30, wrapup_time: 0, agent_interface: 'PJSIP/op1', created_at: beforeBoundary },
        { user_uid: 1, queue_name: 'q_a', disposition: 'answered', wait_time: 5, talk_time: 40, wrapup_time: 0, agent_interface: 'PJSIP/op1', created_at: afterBoundary },
      ]);

      await service.restoreToday();
      const m = service.getQueueMetrics(1, 'q_a');
      expect(m.offered).toBe(1);
      expect(m.answered).toBe(1);
    });

    it('ensureReportingWindows restores when period start changes', async () => {
      await service.restoreToday();
      service['periodStartByTenant'].set(0, Date.now() - 86_400_000);
      const spy = jest.spyOn(service, 'restoreToday');
      const changed = await service.ensureReportingWindows(new Date());
      expect(changed).toBe(true);
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  describe('dual shift/day answered·made·missed counters (D-11/D-12/D-31/D-32)', () => {
    beforeEach(() => {
      slaByQueue = { q_sales: 20 };
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

    it('a ring-no-answer miss never enters the queue aggregates', () => {
      service.recordMissed(1, 'PJSIP/a1', 'q_sales');
      expect(service.getQueueMetrics(1, 'q_sales').offered).toBe(0);
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
      queueCallModel.findAll.mockResolvedValue([
        { user_uid: 1, queue_name: 'q_a', disposition: 'answered', wait_time: 10, talk_time: 100, wrapup_time: 20, agent_interface: 'PJSIP/op1' },
        { user_uid: 1, queue_name: 'q_a', disposition: 'transferred', wait_time: 5, talk_time: 50, wrapup_time: 0, agent_interface: 'PJSIP/op1' },
      ]);

      await service.restoreToday();

      const kpi = service.getAgentKpi(1, 'PJSIP/op1');
      expect(kpi.sinceMidnight.answered).toBe(2);
      expect(kpi.sinceLogin.answered).toBe(0);

      const queueKpi = service.getAgentQueueKpi(1, 'PJSIP/op1', 'q_a');
      expect(queueKpi.sinceMidnight.answered).toBe(2);
    });

    it('counts internal answered as made (softphone internal dial), not answered', async () => {
      queueCallModel.findAll.mockResolvedValue([
        { user_uid: 1, queue_name: 'direct:PJSIP/ew112_0', disposition: 'answered', wait_time: 0, talk_time: 12, wrapup_time: 0, agent_interface: 'PJSIP/ew112_0', direction: 'internal' },
        { user_uid: 1, queue_name: 'direct:PJSIP/ew112_0', disposition: 'answered', wait_time: 0, talk_time: 8, wrapup_time: 0, agent_interface: 'PJSIP/ew112_0', direction: 'outbound' },
      ]);

      await service.restoreToday();

      const kpi = service.getAgentKpi(1, 'PJSIP/ew112_0');
      expect(kpi.sinceMidnight.made).toBe(2);
      expect(kpi.sinceMidnight.answered).toBe(0);
    });

    it('does not count queue-abandoned rows without agent_interface as operator missed (D-10 worklist)', async () => {
      queueCallModel.findAll.mockResolvedValue([
        { user_uid: 1, queue_name: 'q_a', disposition: 'abandoned', wait_time: 45, talk_time: 0, wrapup_time: 0, agent_interface: '' },
      ]);

      await service.restoreToday();

      expect(service.getAgentKpi(1, 'PJSIP/op1').sinceMidnight.missed).toBe(0);
    });

    it('restores operator missed KPI from cc_agent_offers (RNA), not from queue rows', async () => {
      offerModel.findAll.mockResolvedValue([
        { user_uid: 1, queue_name: 'q_a', agent_interface: 'PJSIP/op1', offered_at: new Date(), outcome: 'rna' },
      ]);

      await service.restoreToday();

      expect(service.getAgentKpi(1, 'PJSIP/op1').sinceMidnight.missed).toBe(1);
      expect(service.getAgentQueueKpi(1, 'PJSIP/op1', 'q_a').sinceMidnight.missed).toBe(1);
      // An RNA attempt is not a call: the queue itself saw nothing.
      expect(service.getQueueMetrics(1, 'q_a').offered).toBe(0);
    });

    it('a queue call that timed out never becomes an operator miss, even with an agent_interface', async () => {
      queueCallModel.findAll.mockResolvedValue([
        { user_uid: 1, queue_name: 'q_a', disposition: 'timeout', wait_time: 15, talk_time: 0, wrapup_time: 0, agent_interface: 'PJSIP/op1', direction: 'inbound' },
      ]);

      await service.restoreToday();

      expect(service.getAgentKpi(1, 'PJSIP/op1').sinceMidnight.missed).toBe(0);
      expect(service.getQueueMetrics(1, 'q_a').abandoned).toBe(1);
    });

    it('counts an unanswered direct ring once even if both history and cc_missed_calls have it', async () => {
      queueCallModel.findAll.mockResolvedValue([
        { user_uid: 1, queue_name: 'direct:PJSIP/op1', disposition: 'abandoned', wait_time: 12, agent_interface: 'PJSIP/op1', direction: 'personal', call_uniqueid: 'U-1' },
      ]);
      missedCallModel.findAll.mockResolvedValue([
        { user_uid: 1, queue_name: 'direct:PJSIP/op1', call_uniqueid: 'U-1', personal: true, created_at: new Date() },
        { user_uid: 1, queue_name: 'direct:PJSIP/op1', call_uniqueid: 'U-2', personal: true, created_at: new Date() },
      ]);

      await service.restoreToday();

      // U-1 from history, U-2 only from the worklist: 2 misses, not 3.
      expect(service.getAgentKpi(1, 'PJSIP/op1').sinceMidnight.missed).toBe(2);
    });
  });

  describe('rebuildSinceLoginFromHistory', () => {
    it('rehydrates sinceLogin made/answered/missed from shift history rows and offers', async () => {
      const loginTime = new Date('2026-07-27T05:00:00Z');
      queueCallModel.findAll.mockResolvedValue([
        { queue_name: 'direct:PJSIP/ew112_0', direction: 'outbound', disposition: 'answered' },
        { queue_name: 'direct:PJSIP/ew112_0', direction: 'internal', disposition: 'answered' },
        { queue_name: 'q_a', direction: 'inbound', disposition: 'answered' },
        { queue_name: 'direct:PJSIP/ew112_0', direction: 'personal', disposition: 'answered' },
        { queue_name: 'direct:PJSIP/ew112_0', direction: 'outbound', disposition: 'timeout' }, // unanswered dial → missed
        { queue_name: 'q_a', direction: 'inbound', disposition: 'abandoned' }, // caller outcome, not an agent miss
      ]);
      offerModel.findAll.mockResolvedValue([{ agent_user_uid: 58 }]); // one RNA attempt

      const counters = await service.rebuildSinceLoginFromHistory({
        userUid: 0,
        agentInterface: 'PJSIP/ew112_0',
        operatorUserId: 58,
        loginTime,
      });

      expect(counters).toEqual({ answered: 2, made: 2, missed: 2 });
      expect(service.getAgentKpi(0, 'PJSIP/ew112_0').sinceLogin).toEqual({
        answered: 2, made: 2, missed: 2,
      });
      expect(queueCallModel.findAll).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          user_uid: 0,
          agent_user_uid: 58,
        }),
      }));
      expect(offerModel.findAll).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ user_uid: 0, agent_user_uid: 58 }),
      }));
    });
  });

  describe('listAgentOfferJournalRows', () => {
    it('shapes RNA offers like journal rows with a negative uid and tenant scoping', async () => {
      const offeredAt = new Date('2026-07-15T10:00:00.000Z');
      offerModel.findAll.mockResolvedValue([
        {
          getDataValue: (k: string) =>
            ({
              uid: 7, call_uniqueid: 'U-1', queue_name: 'q_a', caller_id_num: '7900',
              offered_at: offeredAt, ring_time: 15000, agent_user_uid: 42,
            } as Record<string, unknown>)[k],
        },
      ]);

      const rows = await service.listAgentOfferJournalRows(3, [42], new Date('2026-07-15T00:00:00.000Z'), 50);

      expect(offerModel.findAll).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ user_uid: 3 }),
        limit: 50,
      }));
      expect(rows).toEqual([
        expect.objectContaining({
          uid: -7,
          callUniqueid: 'U-1',
          queueName: 'q_a',
          callType: 'rna',
          disposition: 'timeout',
          direction: 'inbound',
          waitTime: 15,
          talkTime: 0,
          agentUserId: 42,
        }),
      ]);
    });

    it('does not query when there are no agents', async () => {
      expect(await service.listAgentOfferJournalRows(3, [], new Date(), 10)).toEqual([]);
      expect(offerModel.findAll).not.toHaveBeenCalled();
    });
  });

  describe('occupancy restore from the agent journal (A7)', () => {
    const NOW = new Date('2026-07-15T12:00:00.000Z');
    const ev = (session_id: number, event_type: string, iso: string) => ({
      session_id,
      event_type,
      created_at: new Date(iso),
    });

    beforeEach(() => {
      jest.useFakeTimers({ now: NOW, doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
      tenantConfig.timezone = 'UTC';
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('restores READY seconds so occupancy survives a restart', async () => {
      queueCallModel.findAll.mockResolvedValue([
        { user_uid: 1, queue_name: 'q_a', disposition: 'answered', wait_time: 5, talk_time: 600, wrapup_time: 0, agent_interface: 'PJSIP/a1' },
      ]);
      sessionModel.findAll.mockResolvedValue([
        { uid: 5, user_uid: 1, agent_interface: 'PJSIP/a1', login_time: new Date('2026-07-15T10:00:00.000Z'), logout_time: null },
      ]);
      agentEventModel.findAll.mockResolvedValue([
        ev(5, 'LOGIN', '2026-07-15T10:00:00.000Z'),
        ev(5, 'CALL_START', '2026-07-15T11:00:00.000Z'),
        ev(5, 'CALL_END', '2026-07-15T11:10:00.000Z'),
      ]);

      await service.restoreToday();

      // READY 10:00-11:00 and 11:10-12:00 = 6600 s idle, 600 s talk.
      expect(service.getAgentOccupancy(1, 'PJSIP/a1')).toBe(round1((600 / (600 + 6600)) * 100));
    });

    it('keeps accumulating READY time for an open session after the restore', async () => {
      sessionModel.findAll.mockResolvedValue([
        { uid: 5, user_uid: 1, agent_interface: 'PJSIP/a1', login_time: new Date('2026-07-15T11:00:00.000Z'), logout_time: null },
      ]);
      agentEventModel.findAll.mockResolvedValue([ev(5, 'LOGIN', '2026-07-15T11:00:00.000Z')]);
      await service.restoreToday(); // 3600 s idle restored, agent is READY now

      jest.setSystemTime(new Date(NOW.getTime() + 60_000));
      service.recordAgentStatus(1, 'PJSIP/a1', 'IN_CALL'); // +60 s of READY
      service.recordAnswered(1, 'q_a', 'PJSIP/a1', 5, 3660, 0);

      expect(service.getAgentOccupancy(1, 'PJSIP/a1')).toBe(round1((3660 / (3660 + 3660)) * 100));
    });

    it('clips a night shift at the start of the reporting day', async () => {
      sessionModel.findAll.mockResolvedValue([
        {
          uid: 6, user_uid: 1, agent_interface: 'PJSIP/a2',
          login_time: new Date('2026-07-14T22:00:00.000Z'), logout_time: new Date('2026-07-15T03:00:00.000Z'),
        },
      ]);
      agentEventModel.findAll.mockResolvedValue([
        ev(6, 'LOGIN', '2026-07-14T22:00:00.000Z'),
        ev(6, 'PAUSE', '2026-07-15T02:00:00.000Z'),
        ev(6, 'LOGOUT', '2026-07-15T03:00:00.000Z'),
      ]);
      queueCallModel.findAll.mockResolvedValue([
        { user_uid: 1, queue_name: 'q_a', disposition: 'answered', wait_time: 5, talk_time: 3600, wrapup_time: 0, agent_interface: 'PJSIP/a2' },
      ]);

      await service.restoreToday();

      // Only 00:00-02:00 (7200 s) of the READY time belongs to today.
      expect(service.getAgentOccupancy(1, 'PJSIP/a2')).toBe(round1((3600 / (3600 + 7200)) * 100));
    });

    it('does not restore a live track for a closed session', async () => {
      sessionModel.findAll.mockResolvedValue([
        {
          uid: 7, user_uid: 1, agent_interface: 'PJSIP/a3',
          login_time: new Date('2026-07-15T08:00:00.000Z'), logout_time: new Date('2026-07-15T09:00:00.000Z'),
        },
      ]);
      agentEventModel.findAll.mockResolvedValue([ev(7, 'LOGIN', '2026-07-15T08:00:00.000Z'), ev(7, 'LOGOUT', '2026-07-15T09:00:00.000Z')]);

      await service.restoreToday();

      expect(service['agentStatusTracks'].has('1:PJSIP/a3')).toBe(false);
    });

    it('a failing journal read does not break the queue restore', async () => {
      queueCallModel.findAll.mockResolvedValue([
        { user_uid: 1, queue_name: 'q_a', disposition: 'answered', wait_time: 5, talk_time: 30, wrapup_time: 0, agent_interface: 'PJSIP/a1' },
      ]);
      sessionModel.findAll.mockRejectedValue(new Error('journal down'));

      await service.restoreToday();

      expect(service.getQueueMetrics(1, 'q_a').answered).toBe(1);
      expect(service.getAgentOccupancy(1, 'PJSIP/a1')).toBe(100); // talk only, no idle known
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

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
