import { Op } from 'sequelize';
import { CallCenterIntervalService } from './callcenter-interval.service';
import { CallCenterMetricsService } from './callcenter-metrics.service';
import { CallCenterRollupService } from './callcenter-rollup.service';
import { CallCenterReportsService } from './reports/callcenter-reports.service';

/**
 * Golden parity (cc-analytics PLAN, phase A acceptance): one fixture must produce the same queue
 * numbers through every path that a supervisor can look at:
 *   live memory (restoreToday → wallboard / supervisor)  ==  raw queue-summary report
 *   ==  daily rollup → rollup-based queue-summary report.
 * The 15-minute interval buckets must add up to the same day (Σ intervals == day).
 * `direct:*`, outbound, personal rows and RNA attempts must never reach queue aggregates.
 */

const NOW = new Date('2026-07-15T12:00:00.000Z');
const DAY = '2026-07-15';
const SLA = { sales: 20, support: 60 } as Record<string, number>;
const TENANT = { timezone: 'UTC', shortAbandonSec: 5, defaultSlaSec: 20 };

type Row = Record<string, unknown>;

let seq = 0;
function call(partial: Row): Row {
  seq += 1;
  return {
    user_uid: 1,
    call_uniqueid: `c${seq}`,
    queue_name: 'sales',
    direction: 'inbound',
    disposition: 'answered',
    wait_time: 0,
    talk_time: 0,
    hold_time: 0,
    wrapup_time: 0,
    agent_interface: '',
    agent_user_uid: null,
    created_at: new Date('2026-07-15T09:00:00.000Z'),
    ...partial,
  };
}

const FIXTURE: Row[] = [
  // sales (SLA 20 s)
  call({ wait_time: 10, talk_time: 60, hold_time: 5, wrapup_time: 15, agent_interface: 'PJSIP/100', agent_user_uid: 10 }),
  call({ wait_time: 25, talk_time: 40, wrapup_time: 10, agent_interface: 'PJSIP/100', agent_user_uid: 10 }),
  call({ disposition: 'transferred', wait_time: 4, talk_time: 20, agent_interface: 'PJSIP/101', agent_user_uid: 11 }),
  call({ disposition: 'abandoned', wait_time: 3 }), // short abandon (<= 5 s)
  call({ disposition: 'abandoned', wait_time: 40 }),
  call({ disposition: 'timeout', wait_time: 30 }),
  // support (SLA 60 s)
  call({ queue_name: 'support', wait_time: 45, talk_time: 100, agent_interface: 'PJSIP/102', agent_user_uid: 12 }),
  // streams that are NOT queue traffic
  call({ queue_name: 'direct:PJSIP/100', direction: 'personal', wait_time: 2, talk_time: 90, agent_interface: 'PJSIP/100' }),
  call({ queue_name: 'direct:PJSIP/100', direction: 'outbound', wait_time: 1, talk_time: 70, agent_interface: 'PJSIP/100' }),
  call({ queue_name: 'direct:PJSIP/101', direction: 'personal', disposition: 'abandoned', wait_time: 12, agent_interface: 'PJSIP/101' }),
];

/** Minimal Sequelize `where` evaluation for the clauses the three services use. */
function matches(row: Row, where: Record<string, any> = {}): boolean {
  for (const [key, cond] of Object.entries(where)) {
    const value = row[key];
    if (cond && typeof cond === 'object' && !(cond instanceof Date)) {
      if (cond[Op.gte] !== undefined && !(+(value as Date) >= +cond[Op.gte])) return false;
      if (cond[Op.lte] !== undefined && !(+(value as Date) <= +cond[Op.lte])) return false;
      if (cond[Op.lt] !== undefined && !(+(value as Date) < +cond[Op.lt])) return false;
      if (cond[Op.in] !== undefined && !cond[Op.in].includes(value)) return false;
      if (cond[Op.notLike] !== undefined) {
        const prefix = String(cond[Op.notLike]).replace(/%$/, '');
        if (String(value).startsWith(prefix)) return false;
      }
    } else if (value !== cond) {
      return false;
    }
  }
  return true;
}

const METRICS = ['offered', 'answered', 'abandoned', 'shortAbandoned', 'transferred', 'sla', 'asr', 'asa', 'aht', 'abandonRate', 'maxWait'] as const;
type Snapshot = Record<(typeof METRICS)[number], number>;

describe('callcenter queue metrics parity (live == raw == rollup)', () => {
  let queueCallModel: { findAll: jest.Mock };
  let config: any;

  beforeEach(() => {
    jest.useFakeTimers({ now: NOW, doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
    queueCallModel = {
      findAll: jest.fn(async (opts: { where?: Record<string, unknown> }) =>
        FIXTURE.filter((r) => matches(r, opts?.where)),
      ),
    };
    config = {
      loadAll: jest.fn(async () => new Map()),
      peekTenantConfig: jest.fn(() => TENANT),
      peekSlaThreshold: jest.fn((_uid: number, queue: string) => SLA[queue] ?? TENANT.defaultSlaSec),
      getTenantConfig: jest.fn(async () => TENANT),
      getSlaThreshold: jest.fn(async (_uid: number, queue: string, d?: number) => SLA[queue] ?? d ?? TENANT.defaultSlaSec),
      getMetricsConfig: jest.fn(async (_uid: number, queue: string) => ({
        slaThresholdSec: SLA[queue] ?? TENANT.defaultSlaSec,
        shortAbandonSec: TENANT.shortAbandonSec,
      })),
    };
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const empty = () => ({ findAll: jest.fn().mockResolvedValue([]) });

  async function liveSnapshot(): Promise<Record<string, Snapshot>> {
    const metrics = new CallCenterMetricsService(
      queueCallModel as any,
      empty() as any,
      empty() as any,
      config,
      empty() as any,
      empty() as any,
    );
    await metrics.restoreToday();
    const out: Record<string, Snapshot> = {};
    for (const q of metrics.getTenantQueueMetrics(1)) {
      out[q.queueName] = pick(q as unknown as Record<string, number>);
    }
    return out;
  }

  function pick(view: Record<string, number>): Snapshot {
    const snap = {} as Snapshot;
    for (const key of METRICS) snap[key] = view[key];
    return snap;
  }

  /** Report rows are rounded to whole seconds for ASA/AHT; round the live view the same way. */
  function normalise(snap: Snapshot): Snapshot {
    return { ...snap, asa: Math.round(snap.asa), aht: Math.round(snap.aht) };
  }

  function reportSnapshot(rows: any[]): Record<string, Snapshot> {
    const out: Record<string, Snapshot> = {};
    for (const r of rows) {
      out[r.queueName] = {
        offered: r.totalCalls,
        answered: r.answeredCalls,
        abandoned: r.abandonedCalls,
        shortAbandoned: r.shortAbandonedCalls,
        transferred: r.transferredCalls,
        sla: r.slaPct,
        asr: r.asrPct,
        asa: r.asaSec,
        aht: r.ahtSec,
        abandonRate: r.abandonPct,
        maxWait: r.maxWaitSec,
      };
    }
    return out;
  }

  function reports(source: 'raw' | 'rollup', dailyQueueModel = empty()) {
    return new CallCenterReportsService(
      queueCallModel as any,
      dailyQueueModel as any,
      empty() as any,
      empty() as any,
      empty() as any,
      empty() as any,
      empty() as any,
      { resolveAggregationSource: jest.fn(() => source) } as any,
      config,
    );
  }

  it('produces identical queue numbers on every path and excludes non-queue traffic', async () => {
    const live = await liveSnapshot();

    const raw = reportSnapshot((await reports('raw').getQueueSummary(1, { dateFrom: DAY, dateTo: DAY })).rows);

    const queueUpsert = jest.fn().mockResolvedValue([{}, true]);
    const intervalStore: Row[] = [];
    const intervalModel = {
      findAll: jest.fn(async (opts: { where?: Record<string, unknown> }) =>
        intervalStore.filter((r) => matches(r, opts?.where)).map((r) => ({ ...r })),
      ),
      upsert: jest.fn(async (row: Row) => {
        const i = intervalStore.findIndex(
          (r) => r.user_uid === row.user_uid && +(r.interval_start as Date) === +(row.interval_start as Date) && r.queue_name === row.queue_name,
        );
        if (i >= 0) intervalStore[i] = { ...intervalStore[i], ...row };
        else intervalStore.push({ uid: intervalStore.length + 1, ...row });
        return [{}, true];
      }),
      destroy: jest.fn().mockResolvedValue(0),
    };
    const intervals = new CallCenterIntervalService(queueCallModel as any, intervalModel as any, config);
    const rollup = new CallCenterRollupService(
      queueCallModel as any,
      { upsert: queueUpsert } as any,
      { upsert: jest.fn().mockResolvedValue([{}, true]) } as any,
      config,
      intervals,
    );
    await rollup.recomputeDay(DAY, 1);
    const stored = queueUpsert.mock.calls.map(([row]) => row as Row);
    const dailyQueueModel = {
      findAll: jest.fn(async () => stored.map((r) => ({ ...r }))),
    };
    const rolled = reportSnapshot(
      (await reports('rollup', dailyQueueModel as any).getQueueSummary(1, { dateFrom: DAY, dateTo: DAY })).rows,
    );

    // Only the two real queues exist anywhere: no direct:* streams.
    expect(Object.keys(live).sort()).toEqual(['sales', 'support']);
    expect(Object.keys(raw).sort()).toEqual(['sales', 'support']);
    expect(Object.keys(rolled).sort()).toEqual(['sales', 'support']);

    for (const queue of ['sales', 'support']) {
      expect(raw[queue]).toEqual(normalise(live[queue]));
      expect(rolled[queue]).toEqual(raw[queue]);
    }

    // Σ 15-minute intervals == the day, per queue (and nothing from direct:* streams).
    for (const queue of ['sales', 'support']) {
      const series = await intervals.getQueueIntervals(1, { dateFrom: DAY, dateTo: DAY, queueName: queue });
      const sum = (key: 'offered' | 'answered' | 'abandoned' | 'shortAbandoned' | 'transferred') =>
        series.rows.reduce((acc, r) => acc + r[key], 0);
      expect(sum('offered')).toBe(raw[queue].offered);
      expect(sum('answered')).toBe(raw[queue].answered);
      expect(sum('abandoned')).toBe(raw[queue].abandoned);
      expect(sum('shortAbandoned')).toBe(raw[queue].shortAbandoned);
      expect(sum('transferred')).toBe(raw[queue].transferred);
      expect(series.rows.at(-1)!.cumulativeSla).toBe(raw[queue].sla);
    }

    // Golden values (hand-checked against the metrics dictionary).
    expect(raw.sales).toMatchObject({
      offered: 6,
      answered: 3, // answered + transferred
      abandoned: 2, // abandoned + timeout, short abandon counted separately (6 = 3 + 2 + 1)
      shortAbandoned: 1,
      sla: 40, // handled within 20 s (w10, w4) / (offered - short abandons = 5)
      transferred: 1,
      maxWait: 40,
    });
    expect(raw.support).toMatchObject({ offered: 1, answered: 1, abandoned: 0, sla: 100, maxWait: 45 });
  });
});
