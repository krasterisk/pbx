import { BadRequestException } from '@nestjs/common';
import { CallCenterReportsService, queueNameWhere } from './callcenter-reports.service';
import { Op } from 'sequelize';
import { DEFAULT_SLA_THRESHOLD_SEC } from '../callcenter-metrics.service';
import { CC_REPORT_IDS } from './callcenter-reports.types';
import { REPORT_COLUMN_SPECS, typeReportColumns } from './callcenter-report-columns';

describe('CallCenterReportsService', () => {
  let service: CallCenterReportsService;
  let queueCallModel: {
    findAll: jest.Mock;
    findAndCountAll: jest.Mock;
  };
  let dailyQueueModel: { findAll: jest.Mock };
  let dailyAgentModel: { findAll: jest.Mock };
  let agentEventModel: { findAll: jest.Mock };
  let sessionModel: { findAll: jest.Mock };
  let missedCallModel: { findAll: jest.Mock };
  let pauseReasonModel: { findAll: jest.Mock };
  let rollupService: { resolveAggregationSource: jest.Mock };
  let tenantConfig: { timezone: string; shortAbandonSec: number; defaultSlaSec: number };
  let slaByQueue: Record<string, number>;
  let config: { getTenantConfig: jest.Mock; getSlaThreshold: jest.Mock };

  beforeEach(() => {
    queueCallModel = {
      findAll: jest.fn().mockResolvedValue([]),
      findAndCountAll: jest.fn().mockResolvedValue({ rows: [], count: 0 }),
    };
    dailyQueueModel = { findAll: jest.fn().mockResolvedValue([]) };
    dailyAgentModel = { findAll: jest.fn().mockResolvedValue([]) };
    agentEventModel = { findAll: jest.fn().mockResolvedValue([]) };
    sessionModel = { findAll: jest.fn().mockResolvedValue([]) };
    missedCallModel = { findAll: jest.fn().mockResolvedValue([]) };
    pauseReasonModel = { findAll: jest.fn().mockResolvedValue([]) };
    rollupService = { resolveAggregationSource: jest.fn().mockReturnValue('raw') };
    tenantConfig = { timezone: 'UTC', shortAbandonSec: 5, defaultSlaSec: DEFAULT_SLA_THRESHOLD_SEC };
    slaByQueue = {};
    config = {
      getTenantConfig: jest.fn(async () => tenantConfig),
      getSlaThreshold: jest.fn(
        async (_uid: number, queue: string, tenantDefault?: number) =>
          slaByQueue[queue] ?? tenantDefault ?? DEFAULT_SLA_THRESHOLD_SEC,
      ),
    };

    service = new CallCenterReportsService(
      queueCallModel as any,
      dailyQueueModel as any,
      dailyAgentModel as any,
      agentEventModel as any,
      sessionModel as any,
      missedCallModel as any,
      pauseReasonModel as any,
      rollupService as any,
      config as any,
    );
  });

  it('exposes tenant timezone and exact period bounds to every report consumer', async () => {
    tenantConfig.timezone = 'Asia/Krasnoyarsk';
    const result = await service.runReport('call-detail', 7, { dateFrom: '2026-10-16', dateTo: '2026-10-16' });
    expect(result).toMatchObject({ timezone: 'Asia/Krasnoyarsk', periodStart: '2026-10-15T17:00:00.000Z' });
    expect(result.generatedAt).toBeDefined();
  });
  it('does not present historical abandoned queue wait as conversation hold', async () => {
    queueCallModel.findAndCountAll.mockResolvedValue({ count: 1, rows: [{ disposition: 'abandoned', wait_time: 179, hold_time: 179 }] });
    const result = await service.getCallDetail(7, { dateFrom: '2026-10-16', dateTo: '2026-10-16' });
    expect(result.rows[0]).toMatchObject({ waitTime: 179, holdTime: 0 });
  });
  it('applies the selected operator to hourly heatmap data', async () => {
    await service.getHourlyHeatmap(7, { dateFrom: '2026-10-16', dateTo: '2026-10-16', agentInterface: 'PJSIP/e202_7' });
    expect(queueCallModel.findAll.mock.calls[0][0].where).toMatchObject({ user_uid: 7, agent_interface: 'PJSIP/e202_7' });
  });
  it('includes the full last day for date-only report bounds', () => {
    expect(service.parseAndClampPeriod('2026-09-17', '2026-09-18')).toEqual({
      from: new Date('2026-09-17T00:00:00.000Z'),
      to: new Date('2026-09-18T23:59:59.999Z'),
    });
  });

  describe('getQueueSummary (raw + SLA)', () => {
    it('aggregates raw calls with per-queue SLA threshold', async () => {
      slaByQueue = { sales: 20 };
      queueCallModel.findAll.mockResolvedValue([
        {
          queue_name: 'sales',
          disposition: 'answered',
          wait_time: 10,
          talk_time: 60,
          wrapup_time: 15,
          hold_time: 0,
        },
        {
          queue_name: 'sales',
          disposition: 'answered',
          wait_time: 25,
          talk_time: 40,
          wrapup_time: 10,
          hold_time: 0,
        },
        {
          queue_name: 'sales',
          disposition: 'abandoned',
          wait_time: 40,
          talk_time: 0,
          wrapup_time: 0,
          hold_time: 0,
        },
      ]);

      const result = await service.getQueueSummary(7, {
        dateFrom: '2026-07-01T00:00:00.000Z',
        dateTo: '2026-07-10T00:00:00.000Z',
      });

      expect(rollupService.resolveAggregationSource).toHaveBeenCalled();
      expect(queueCallModel.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ user_uid: 7 }),
        }),
      );
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]).toMatchObject({
        queueName: 'sales',
        totalCalls: 3,
        answeredCalls: 2,
        abandonedCalls: 1,
        slaPct: round1((1 / 3) * 100), // wait 10 ≤ 20; 25 > 20
        asrPct: round1((2 / 3) * 100),
        abandonPct: round1((1 / 3) * 100),
      });
      expect(result.source).toBe('raw');
    });

    it('falls back to the tenant default SLA when the queue has no servicelevel', async () => {
      queueCallModel.findAll.mockResolvedValue([
        {
          queue_name: 'q1',
          disposition: 'answered',
          wait_time: DEFAULT_SLA_THRESHOLD_SEC,
          talk_time: 30,
          wrapup_time: 0,
          hold_time: 0,
        },
      ]);

      const result = await service.getQueueSummary(1, {
        dateFrom: '2026-07-01',
        dateTo: '2026-07-02',
      });
      expect(result.rows[0].slaPct).toBe(100);
    });
  });

  describe('getQueueSummary (metrics dictionary)', () => {
    const row = (partial: Record<string, unknown>) => ({
      queue_name: 'sales',
      direction: 'inbound',
      disposition: 'answered',
      wait_time: 0,
      talk_time: 0,
      wrapup_time: 0,
      hold_time: 0,
      ...partial,
    });

    it('asks only for inbound rows of real queues', async () => {
      await service.getQueueSummary(7, { dateFrom: '2026-07-01', dateTo: '2026-07-02' });
      const { where } = queueCallModel.findAll.mock.calls[0][0];
      expect(where.direction).toBe('inbound');
      expect(where.queue_name).toBeDefined();
    });

    it('never aggregates direct:* rows even if they reach the service', async () => {
      queueCallModel.findAll.mockResolvedValue([
        row({ wait_time: 3, talk_time: 20 }),
        row({ queue_name: 'direct:PJSIP/100', direction: 'personal', talk_time: 99 }),
        row({ queue_name: 'direct:PJSIP/100', direction: 'inbound', disposition: 'abandoned', wait_time: 80 }),
      ]);
      const result = await service.getQueueSummary(7, { dateFrom: '2026-07-01', dateTo: '2026-07-02' });
      expect(result.rows.map((r) => r.queueName)).toEqual(['sales']);
      expect(result.rows[0]).toMatchObject({ totalCalls: 1, answeredCalls: 1, abandonedCalls: 0 });
    });

    it('treats transferred as handled and drops short abandons from the rate denominator', async () => {
      queueCallModel.findAll.mockResolvedValue([
        row({ disposition: 'transferred', wait_time: 4, talk_time: 20 }),
        row({ disposition: 'abandoned', wait_time: 3 }), // short abandon (<= 5s)
        row({ disposition: 'abandoned', wait_time: 30 }),
        row({ disposition: 'answered', wait_time: 10, talk_time: 40, wrapup_time: 20 }),
      ]);
      const result = await service.getQueueSummary(7, { dateFrom: '2026-07-01', dateTo: '2026-07-02' });
      expect(result.rows[0]).toMatchObject({
        totalCalls: 4,
        answeredCalls: 2,
        transferredCalls: 1,
        abandonedCalls: 1,
        shortAbandonedCalls: 1,
        abandonPct: round1((1 / 3) * 100), // effective offered = 4 - 1 short
        asrPct: round1((2 / 3) * 100),
        slaPct: round1((2 / 3) * 100), // both handled within 20s
        ahtSec: 40, // (20 + 40 + 20) / 2, hold never added
      });
    });

    it('merges rollup v2 sums and matches the raw result for the same data', async () => {
      rollupService.resolveAggregationSource.mockReturnValue('rollup');
      dailyQueueModel.findAll.mockResolvedValue([
        {
          queue_name: 'sales', rollup_version: 2, total_calls: 4, answered_calls: 2, abandoned_calls: 1,
          short_abandoned_calls: 1, transferred_calls: 1, sla_met_calls: 2, avg_wait_sec: 7,
          total_wait_sec: 14, total_talk_sec: 60, total_wrapup_sec: 20, total_hold_sec: 0, max_wait_sec: 30,
        },
        {
          queue_name: 'sales', rollup_version: 2, total_calls: 2, answered_calls: 2, abandoned_calls: 0,
          short_abandoned_calls: 0, transferred_calls: 0, sla_met_calls: 1, avg_wait_sec: 15,
          total_wait_sec: 30, total_talk_sec: 100, total_wrapup_sec: 0, total_hold_sec: 0, max_wait_sec: 25,
        },
      ]);
      const result = await service.getQueueSummary(7, { dateFrom: '2026-07-01', dateTo: '2026-07-02' });
      expect(result.source).toBe('rollup');
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]).toMatchObject({
        totalCalls: 6,
        answeredCalls: 4,
        abandonedCalls: 1,
        shortAbandonedCalls: 1,
        transferredCalls: 1,
        maxWaitSec: 30,
        asaSec: 11, // (14 + 30) / 4
        ahtSec: 45, // (160 + 20) / 4
        slaPct: round1((3 / 5) * 100), // effective offered = 6 - 1
      });
    });
  });

  describe('getOperatorStats (handled calls, clipped sessions)', () => {
    it('counts only handled inbound/personal calls and keeps hold out of handle time', async () => {
      queueCallModel.findAll.mockResolvedValue([
        { disposition: 'answered', agent_interface: 'PJSIP/101', agent_user_uid: 42, talk_time: 60, hold_time: 20, wrapup_time: 10 },
        { disposition: 'transferred', agent_interface: 'PJSIP/101', agent_user_uid: 42, talk_time: 30, hold_time: 0, wrapup_time: 0 },
      ]);
      const result = await service.getOperatorStats(7, { dateFrom: '2026-07-15', dateTo: '2026-07-15' });
      const { where } = queueCallModel.findAll.mock.calls[0][0];
      expect(where.disposition).toBeDefined();
      expect(where.direction).toBeDefined();
      expect(result.rows[0]).toMatchObject({
        agentInterface: 'PJSIP/101',
        callsHandled: 2,
        totalTalkSec: 90,
        totalHoldSec: 20,
        totalWrapupSec: 10,
        avgHandleSec: 50, // (90 + 10) / 2
        ahtSec: 50,
      });
    });

    it('clips a session that crosses the period start instead of using stored totals', async () => {
      sessionModel.findAll.mockResolvedValue([
        {
          uid: 5,
          agent_interface: 'PJSIP/101',
          user_id: 42,
          login_time: new Date('2026-07-14T22:00:00.000Z'),
          logout_time: new Date('2026-07-15T06:00:00.000Z'),
          total_pause_time: 9999,
          total_idle_time: 9999,
        },
      ]);
      agentEventModel.findAll.mockResolvedValue([
        { session_id: 5, user_id: 42, event_type: 'READY', created_at: new Date('2026-07-14T22:00:00.000Z'), reason: '', duration: 0 },
        { session_id: 5, user_id: 42, event_type: 'PAUSE', created_at: new Date('2026-07-15T00:30:00.000Z'), reason: 'lunch', duration: 0 },
        { session_id: 5, user_id: 42, event_type: 'READY', created_at: new Date('2026-07-15T01:00:00.000Z'), reason: '', duration: 0 },
      ]);
      const result = await service.getOperatorStats(7, {
        dateFrom: '2026-07-15T00:00:00.000Z',
        dateTo: '2026-07-15T23:59:59.000Z',
      });
      expect(result.rows[0]).toMatchObject({
        agentInterface: 'PJSIP/101',
        loggedInSec: 6 * 3600,
        totalPauseSec: 1800,
        totalIdleSec: 1800 + 5 * 3600, // 00:00-00:30 and 01:00-06:00
      });
    });

    it('uses stored session totals when the session is fully inside the period', async () => {
      sessionModel.findAll.mockResolvedValue([
        {
          uid: 6,
          agent_interface: 'PJSIP/102',
          user_id: 43,
          login_time: new Date('2026-07-15T08:00:00.000Z'),
          logout_time: new Date('2026-07-15T12:00:00.000Z'),
          total_pause_time: 600,
          total_idle_time: 3000,
        },
      ]);
      const result = await service.getOperatorStats(7, {
        dateFrom: '2026-07-15T00:00:00.000Z',
        dateTo: '2026-07-15T23:59:59.000Z',
      });
      expect(agentEventModel.findAll).not.toHaveBeenCalled();
      expect(result.rows[0]).toMatchObject({ loggedInSec: 4 * 3600, totalPauseSec: 600, totalIdleSec: 3000 });
    });
  });

  describe('tenant timezone', () => {
    it('treats date-only bounds as whole local days of the tenant', async () => {
      tenantConfig.timezone = 'Asia/Tokyo'; // UTC+9
      await service.getQueueSummary(7, { dateFrom: '2026-07-15', dateTo: '2026-07-15' });
      const { where } = queueCallModel.findAll.mock.calls[0][0];
      const syms = Object.getOwnPropertySymbols(where.created_at);
      const bounds = Object.fromEntries(syms.map((s) => [s.description, where.created_at[s]])) as Record<string, Date>;
      expect(bounds.gte.toISOString()).toBe('2026-07-14T15:00:00.000Z');
      expect(bounds.lte.toISOString()).toBe('2026-07-15T14:59:59.999Z');
    });
  });

  describe('tenant isolation', () => {
    it('always filters queue-summary by user_uid from method param', async () => {
      await service.getQueueSummary(42, {
        dateFrom: '2026-07-01',
        dateTo: '2026-07-02',
      });
      expect(queueCallModel.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ user_uid: 42 }),
        }),
      );
    });

    it('always filters call-detail by user_uid', async () => {
      await service.getCallDetail(99, {
        dateFrom: '2026-07-01',
        dateTo: '2026-07-02',
        page: 1,
        pageSize: 10,
      });
      expect(queueCallModel.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ user_uid: 99 }),
        }),
      );
    });
  });

  describe('getCallDetail pagination', () => {
    it('applies page/pageSize limit and offset', async () => {
      queueCallModel.findAndCountAll.mockResolvedValue({
        rows: [
          {
            call_uniqueid: 'u1',
            queue_name: 'sales',
            agent_interface: 'PJSIP/101',
            caller_id_num: '7900',
            caller_id_name: '',
            enter_time: null,
            answer_time: null,
            end_time: null,
            wait_time: 5,
            talk_time: 20,
            hold_time: 0,
            wrapup_time: 0,
            disposition: 'answered',
          },
        ],
        count: 25,
      });

      const result = await service.getCallDetail(1, {
        dateFrom: '2026-07-01',
        dateTo: '2026-07-02',
        page: 2,
        pageSize: 10,
      });

      expect(queueCallModel.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 10,
          offset: 10,
        }),
      );
      expect(result.total).toBe(25);
      expect(result.page).toBe(2);
      expect(result.pageSize).toBe(10);
      expect(result.rows).toHaveLength(1);
    });
  });

  describe('getPauseReport', () => {
    it('derives pause duration from adjacent events when duration is 0', async () => {
      sessionModel.findAll.mockResolvedValue([
        { uid: 5, agent_interface: 'PJSIP/101', user_id: 42 },
      ]);
      const t0 = new Date('2026-07-15T09:00:00.000Z');
      const t1 = new Date('2026-07-15T09:10:00.000Z');
      const t2 = new Date('2026-07-15T09:25:00.000Z');
      agentEventModel.findAll.mockResolvedValue([
        { session_id: 5, user_id: 42, event_type: 'READY', created_at: t0, reason: '', duration: 0 },
        { session_id: 5, user_id: 42, event_type: 'PAUSE', created_at: t1, reason: 'lunch', duration: 0 },
        { session_id: 5, user_id: 42, event_type: 'READY', created_at: t2, reason: '', duration: 0 },
      ]);
      pauseReasonModel.findAll.mockResolvedValue([
        { name: 'lunch', is_paid: false },
      ]);

      const result = await service.getPauseReport(3, {
        dateFrom: '2026-07-15T00:00:00.000Z',
        dateTo: '2026-07-15T23:59:59.000Z',
      });

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]).toMatchObject({
        agentInterface: 'PJSIP/101',
        pauseReason: 'lunch',
        pauseCount: 1,
        totalPauseSec: 900,
        isPaid: false,
      });
    });
  });

  describe('getPauseReport, pause without an end event', () => {
    const query = { dateFrom: '2026-07-01T00:00:00.000Z', dateTo: '2026-07-31T23:59:59.000Z' };
    const pause = { session_id: 5, user_id: 42, event_type: 'PAUSE', created_at: new Date('2026-07-15T09:10:00.000Z'), reason: 'Forced by supervisor', duration: 0 };

    it('ends at the logout of a closed shift instead of running to the end of the report', async () => {
      sessionModel.findAll.mockResolvedValue([
        { uid: 5, agent_interface: 'PJSIP/101', user_id: 42, logout_time: new Date('2026-07-15T09:30:00.000Z') },
      ]);
      agentEventModel.findAll.mockResolvedValue([pause]);
      const result = await service.getPauseReport(3, query);
      expect(result.rows[0]).toMatchObject({ pauseCount: 1, totalPauseSec: 1200 });
    });

    it('still runs to the end of the period while the shift is open', async () => {
      sessionModel.findAll.mockResolvedValue([
        { uid: 5, agent_interface: 'PJSIP/101', user_id: 42, logout_time: null },
      ]);
      agentEventModel.findAll.mockResolvedValue([pause]);
      const result = await service.getPauseReport(3, query);
      const expected = (new Date(query.dateTo).getTime() - pause.created_at.getTime()) / 1000;
      expect(Math.abs(result.rows[0].totalPauseSec - Math.min(expected, (Date.now() - pause.created_at.getTime()) / 1000))).toBeLessThanOrEqual(2);
    });

    it('does not let a later event stretch a pause past the logout', async () => {
      sessionModel.findAll.mockResolvedValue([
        { uid: 5, agent_interface: 'PJSIP/101', user_id: 42, logout_time: new Date('2026-07-15T09:20:00.000Z') },
      ]);
      agentEventModel.findAll.mockResolvedValue([
        pause,
        { session_id: 5, user_id: 42, event_type: 'READY', created_at: new Date('2026-07-16T09:00:00.000Z'), reason: '', duration: 0 },
      ]);
      const result = await service.getPauseReport(3, query);
      expect(result.rows[0].totalPauseSec).toBe(600);
    });
  });

  describe('getAgentTimeline segments', () => {
    it('builds contiguous segments from cc_agent_events', async () => {
      sessionModel.findAll.mockResolvedValue([{ uid: 5 }]);
      const t0 = new Date('2026-07-15T09:00:00.000Z');
      const t1 = new Date('2026-07-15T09:10:00.000Z');
      const t2 = new Date('2026-07-15T09:15:00.000Z');
      agentEventModel.findAll.mockResolvedValue([
        { event_type: 'READY', created_at: t0, reason: '' },
        { event_type: 'PAUSE', created_at: t1, reason: 'lunch' },
        { event_type: 'READY', created_at: t2, reason: '' },
      ]);

      const result = await service.getAgentTimeline(3, {
        dateFrom: '2026-07-15T00:00:00.000Z',
        dateTo: '2026-07-15T23:59:59.000Z',
        agentInterface: 'PJSIP/101',
      });

      expect(agentEventModel.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ user_uid: 3 }),
        }),
      );
      expect(result.rows[0].segments).toHaveLength(3);
      expect(result.rows[0].segments[0]).toMatchObject({
        state: 'READY',
        durationSec: 600,
      });
      expect(result.rows[0].segments[1]).toMatchObject({
        state: 'PAUSED',
        reason: 'lunch',
        durationSec: 300,
      });
    });

    it('maps DIALING/CONSULT/ACW journal events to their own timeline states (D-09/D-13)', async () => {
      sessionModel.findAll.mockResolvedValue([{ uid: 5 }]);
      const t0 = new Date('2026-07-15T09:00:00.000Z');
      const t1 = new Date('2026-07-15T09:00:20.000Z');
      const t2 = new Date('2026-07-15T09:01:00.000Z');
      agentEventModel.findAll.mockResolvedValue([
        { event_type: 'DIALING', created_at: t0, reason: '' },
        { event_type: 'CONSULT', created_at: t1, reason: '' },
        { event_type: 'ACW', created_at: t2, reason: '' },
      ]);

      const result = await service.getAgentTimeline(3, {
        dateFrom: '2026-07-15T00:00:00.000Z',
        dateTo: '2026-07-15T23:59:59.000Z',
        agentInterface: 'PJSIP/101',
      });

      expect(result.rows[0].segments.map((s: any) => s.state)).toEqual(['DIALING', 'CONSULT', 'ACW']);
    });

    it('requires agentInterface', async () => {
      await expect(
        service.getAgentTimeline(1, {
          dateFrom: '2026-07-15',
          dateTo: '2026-07-15',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('runReport whitelist', () => {
    it('rejects unknown reportId with 400', async () => {
      await expect(
        service.runReport('not-a-report', 1, {
          dateFrom: '2026-07-01',
          dateTo: '2026-07-02',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('dispatches known reportId', async () => {
      const spy = jest.spyOn(service, 'getQueueSummary').mockResolvedValue({
        reportId: 'queue-summary',
        columns: [],
        rows: [],
      });
      await service.runReport('queue-summary', 1, {
        dateFrom: '2026-07-01',
        dateTo: '2026-07-02',
      });
      expect(spy).toHaveBeenCalled();
    });
  });

  describe('typed columns (cc-ux U3.3)', () => {
    it('gives every column of every report a type, an i18n labelKey and a catalog spec', async () => {
      for (const id of CC_REPORT_IDS) {
        const result = await service.runReport(id, 1, {
          dateFrom: '2026-07-01',
          dateTo: '2026-07-02',
          ...(!['queue-summary', 'missed-callback'].includes(id) ? { agentInterface: 'PJSIP/101' } : {}),
        });
        expect(result.columns.length).toBeGreaterThan(0);
        const specKeys = Object.keys(REPORT_COLUMN_SPECS[id]);
        for (const col of result.columns) {
          expect(col.type).toBeDefined();
          expect(col.labelKey).toBe(`callcenter.reports.col.${id === 'missed-callback' && col.key === 'holdTime' ? 'waitTime' : col.key}`);
          expect(specKeys).toContain(col.key);
        }
      }
    });

    it('weighted totals point at columns of the same report', () => {
      for (const id of CC_REPORT_IDS) {
        const keys = Object.keys(REPORT_COLUMN_SPECS[id]);
        for (const [key, spec] of Object.entries(REPORT_COLUMN_SPECS[id])) {
          if (spec.total === 'weighted') {
            expect({ id, key, weight: spec.weightKey && keys.includes(spec.weightKey) }).toEqual({
              id,
              key,
              weight: true,
            });
            if (spec.weightMinusKey) expect(keys).toContain(spec.weightMinusKey);
          }
        }
      }
    });

    it('marks rates as percent and durations as duration', () => {
      const queue = typeReportColumns('queue-summary', [
        { key: 'slaPct', header: 'SLA %' },
        { key: 'ahtSec', header: 'AHT (sec)' },
        { key: 'queueName', header: 'Queue' },
      ]);
      expect(queue.map((c) => c.type)).toEqual(['percent', 'duration', 'queue']);
      expect(queue[0]).toMatchObject({ total: 'weighted', weightKey: 'totalCalls', weightMinusKey: 'shortAbandonedCalls' });
    });
  });
});

describe('report exporters', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { buildReportCsv } = require('./exporters/csv-exporter') as typeof import('./exporters/csv-exporter');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { buildReportXlsx } = require('./exporters/xlsx-exporter') as typeof import('./exporters/xlsx-exporter');

  it('CSV: BOM + semicolon delimiter + escaped quotes', () => {
    const csv = buildReportCsv(
      [
        { key: 'name', header: 'Name' },
        { key: 'note', header: 'Note' },
      ],
      [{ name: 'A', note: 'say "hi"' }],
    );
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('"Name";"Note"');
    expect(csv).toContain('"say ""hi"""');
  });

  it('XLSX: Buffer with expected header structure (not byte snapshot)', async () => {
    const buf = await buildReportXlsx(
      'Queue Summary',
      [
        { key: 'queue', header: 'Queue' },
        { key: 'sla', header: 'SLA %' },
      ],
      [{ queue: 'sales', sla: 80 }],
    );
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(100);
    expect(buf[0]).toBe(0x50);
    expect(buf[1]).toBe(0x4b);
  });
});

describe('queueNameWhere', () => {
  it('is unset for an empty filter, a string for one queue and IN for several', () => {
    expect(queueNameWhere(undefined)).toBeUndefined();
    expect(queueNameWhere(' sales ')).toBe('sales');
    expect(queueNameWhere('sales,support,sales')).toEqual({ [Op.in]: ['sales', 'support'] });
  });
});

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
