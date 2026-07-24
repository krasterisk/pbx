import { BadRequestException } from '@nestjs/common';
import { CallCenterReportsService } from './callcenter-reports.service';
import { DEFAULT_SLA_THRESHOLD_SEC } from '../callcenter-metrics.service';

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
  let queueModel: { findOne: jest.Mock };
  let rollupService: { resolveAggregationSource: jest.Mock };

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
    queueModel = { findOne: jest.fn().mockResolvedValue({ servicelevel: 20 }) };
    rollupService = { resolveAggregationSource: jest.fn().mockReturnValue('raw') };

    service = new CallCenterReportsService(
      queueCallModel as any,
      dailyQueueModel as any,
      dailyAgentModel as any,
      agentEventModel as any,
      sessionModel as any,
      missedCallModel as any,
      pauseReasonModel as any,
      queueModel as any,
      rollupService as any,
    );
  });

  describe('getQueueSummary (raw + SLA)', () => {
    it('aggregates raw calls with per-queue SLA threshold', async () => {
      queueModel.findOne.mockResolvedValue({ servicelevel: 20 });
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

    it('falls back to DEFAULT_SLA_THRESHOLD_SEC when queue has no servicelevel', async () => {
      queueModel.findOne.mockResolvedValue({ servicelevel: null });
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

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
