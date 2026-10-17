import { BadRequestException } from '@nestjs/common';
import { emptyQueueTotals, type QueueTotals } from '@krasterisk/shared';
import type { IntervalBucket } from '../callcenter-interval.service';
import { CallCenterDashboardService, DASHBOARD_STALE_AFTER_MS, parseQueueFilter } from './callcenter-dashboard.service';

// 2026-07-15 12:00Z = 19:00 Wednesday in Asia/Bangkok (UTC+7).
const NOW = new Date('2026-07-15T12:00:00.000Z');
const TZ = 'Asia/Bangkok';

/** Totals of `handled` answered calls (all within SLA unless `late`) and `abandoned` real abandons. */
function totals(p: Partial<QueueTotals> & { late?: number } = {}): QueueTotals {
  const { late = 0, ...rest } = p;
  const handled = rest.handled ?? 0;
  return {
    ...emptyQueueTotals(),
    offered: (rest.offered ?? handled + (rest.abandoned ?? 0) + (rest.shortAbandoned ?? 0)),
    handled,
    handledInSl: handled - late,
    sumWaitHandled: handled * 10,
    sumTalkHandled: handled * 100,
    sumWrapupHandled: handled * 20,
    ...rest,
  };
}

const bucket = (iso: string, queueName: string, t: QueueTotals): IntervalBucket => ({
  startMs: Date.parse(iso),
  queueName,
  totals: t,
});

const LOSSES = {
  total: 10,
  previousTotal: 8,
  recoveredByAgent: 4,
  recoveredWithin15: 2,
  recoveredWithin60: 3,
  clientCalledBack: 1,
  pending: 5,
  waitBuckets: { upTo5: 1, upTo20: 4, upTo60: 3, over60: 2 },
};

const PAUSES = {
  count: 3,
  totalSec: 1800,
  paidSec: 900,
  unpaidSec: 600,
  unknownSec: 300,
  reasons: [{ reason: 'Lunch', count: 1, totalSec: 900, isPaid: false }],
  previousTotalSec: 1500,
};

const OPERATORS = { evaluated: 5, medianAhtSec: 200, medianPauseSharePct: 10, outliers: [] };

describe('parseQueueFilter', () => {
  it('trims, drops empties and de-duplicates', () => {
    expect(parseQueueFilter(' sales, support ,,sales')).toEqual(['sales', 'support']);
    expect(parseQueueFilter(undefined)).toEqual([]);
    expect(parseQueueFilter('')).toEqual([]);
  });

  it('bounds the number and the length of names', () => {
    expect(() => parseQueueFilter(Array.from({ length: 51 }, (_, i) => `q${i}`).join(','))).toThrow(BadRequestException);
    expect(() => parseQueueFilter('x'.repeat(65))).toThrow(BadRequestException);
  });
});

describe('CallCenterDashboardService', () => {
  let service: CallCenterDashboardService;
  let stored: IntervalBucket[];
  let lastRefreshAt: number | null;
  let snapshot: { queues: any[]; calls: any[]; agents: any[] };
  let losses: { getLosses: jest.Mock };
  let pauses: { getPauses: jest.Mock };
  let operators: { getDeviations: jest.Mock };
  let intervals: { loadBuckets: jest.Mock; listQueueNames: jest.Mock; lastRefreshAt: number | null };

  beforeEach(() => {
    jest.useFakeTimers({ now: NOW, doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
    stored = [];
    lastRefreshAt = NOW.getTime() - 30_000;
    snapshot = { queues: [], calls: [], agents: [] };
    intervals = {
      loadBuckets: jest.fn(async (_uid: number, from: Date, to: Date, queues?: string[]) =>
        stored.filter(
          (b) =>
            b.startMs >= +from &&
            b.startMs < +to &&
            (!queues || queues.length === 0 || queues.includes(b.queueName)),
        ),
      ),
      listQueueNames: jest.fn(async (_uid: number, from: Date, to: Date) => [
        ...new Set(stored.filter((b) => b.startMs >= +from && b.startMs < +to).map((b) => b.queueName)),
      ]),
      get lastRefreshAt() {
        return lastRefreshAt;
      },
    };
    const config = { getTenantConfig: jest.fn(async () => ({ timezone: TZ, shortAbandonSec: 5, defaultSlaSec: 20 })) };
    const state = { getSnapshot: jest.fn(() => snapshot) };
    losses = { getLosses: jest.fn(async () => LOSSES) };
    pauses = { getPauses: jest.fn(async () => PAUSES) };
    operators = { getDeviations: jest.fn(async () => OPERATORS) };
    service = new CallCenterDashboardService(intervals as any, config as any, state as any, losses as any, pauses as any, operators as any);
  });

  afterEach(() => jest.useRealTimers());

  describe('today', () => {
    beforeEach(() => {
      stored = [
        // today (local 09:00-ish)
        bucket('2026-07-15T02:00:00Z', 'sales', totals({ handled: 8, late: 2, abandoned: 1, shortAbandoned: 1 })),
        bucket('2026-07-15T02:45:00Z', 'support', totals({ handled: 2 })),
        // same weekday a week earlier, within the same elapsed 19 hours
        bucket('2026-07-08T02:00:00Z', 'sales', totals({ handled: 4 })),
        // a week earlier but AFTER the elapsed time (local 20:00) - must be excluded from the comparison
        bucket('2026-07-08T13:00:00Z', 'sales', totals({ handled: 50 })),
      ];
    });

    it('builds service KPIs with the comparison of the same elapsed time', async () => {
      const res = await service.getOverview(1, { period: 'today' });

      expect(res.version).toBe(1);
      expect(res.period).toMatchObject({ preset: 'today', dateFrom: '2026-07-15', includesToday: true });
      expect(res.service.source.state).toBe('ok');
      const { current, previous } = res.service.data!;
      // offered 12 (10 sales + 2 support), 1 short abandon → effective 11, in SL 8 → 72.7 %
      expect(current).toMatchObject({ offered: 12, handled: 10, abandoned: 1, shortAbandoned: 1, sla: 72.7, asa: 10, aht: 120 });
      expect(previous).toMatchObject({ offered: 4, handled: 4, sla: 100 });
    });

    it('draws half-hour points trimmed to now and aligns the previous week index by index', async () => {
      const { series } = await service.getOverview(1, { period: 'today' });
      const s = series.data!;
      expect(s.granularity).toBe('halfHour');
      // local midnight (17:00Z) → now (12:00Z) = 19 h = 38 half hours
      expect(s.points).toHaveLength(38);
      expect(s.points[0].at).toBe('2026-07-14T17:00:00.000Z');
      expect(s.previous).toHaveLength(38);
      const at0900 = s.points.findIndex((p) => p.at === '2026-07-15T02:00:00.000Z');
      expect(s.points[at0900]).toMatchObject({ offered: 10, handled: 8, hasTraffic: true });
      expect(s.points[at0900].cumulativeSla).toBe(66.7); // 6 in SL / (10 offered - 1 short abandon)
      expect(s.previous![at0900]).toMatchObject({ offered: 4 });
      expect(s.points[0]).toMatchObject({ offered: 0, hasTraffic: false });
      expect(s.points.at(-1)!.cumulativeSla).toBe(72.7);
    });

    it('sorts the queue table by worst service and compares each queue with its previous value', async () => {
      const { queueTable } = await service.getOverview(1, { period: 'today' });
      const rows = queueTable.data!;
      expect(rows.map((r) => r.queueName)).toEqual(['sales', 'support']); // sales SLA 66.7 < support 100
      expect(rows[0].current).toMatchObject({ offered: 10, sla: 66.7 });
      expect(rows[0].previous).toMatchObject({ offered: 4 });
      expect(rows[1].previous).toMatchObject({ offered: 0 }); // no calls last week, not "missing"
    });

    it('puts queues without countable traffic after those with a verdict', async () => {
      stored.push(bucket('2026-07-15T03:00:00Z', 'ghost', totals({ shortAbandoned: 3 })));
      const rows = (await service.getOverview(1, { period: 'today' })).queueTable.data!;
      expect(rows.map((r) => r.queueName)).toEqual(['sales', 'support', 'ghost']);
    });

    it('has no comparison when compare is off', async () => {
      const res = await service.getOverview(1, { period: 'today', compare: false });
      expect(res.service.data!.previous).toBeNull();
      expect(res.series.data!.previous).toBeNull();
      expect(res.queueTable.data![0].previous).toBeNull();
      expect(res.period.previous).toBeNull();
    });
  });

  describe('multi-day periods', () => {
    it('draws one point per local day and files a bucket after local midnight under the right day', async () => {
      stored = [
        // 18:00Z on the 14th is 01:00 on the 15th in Bangkok
        bucket('2026-07-14T18:00:00Z', 'sales', totals({ handled: 3 })),
        bucket('2026-07-14T10:00:00Z', 'sales', totals({ handled: 1 })), // 17:00 on the 14th
      ];
      const s = (await service.getOverview(1, { period: '7d' })).series.data!;
      expect(s.granularity).toBe('day');
      expect(s.points).toHaveLength(7);
      expect(s.points[0].at).toBe('2026-07-08T17:00:00.000Z'); // local 07-09
      const day14 = s.points.find((p) => p.at === '2026-07-13T17:00:00.000Z')!;
      const day15 = s.points.find((p) => p.at === '2026-07-14T17:00:00.000Z')!;
      expect(day14.offered).toBe(1);
      expect(day15.offered).toBe(3);
      expect(s.previous).toHaveLength(7);
    });

    it('a closed period (yesterday) has no "now" strip and no staleness', async () => {
      lastRefreshAt = NOW.getTime() - 10 * DASHBOARD_STALE_AFTER_MS;
      const res = await service.getOverview(1, { period: 'yesterday' });
      expect(res.now).toBeNull();
      expect(res.service.source.state).toBe('ok');
      expect(res.series.data!.points).toHaveLength(48);
    });
  });

  describe('now strip', () => {
    // Mid-bucket: the 12:00 bucket is in progress, so "last 30 minutes" = the 11:45 and 12:00 buckets.
    const T = new Date('2026-07-15T12:07:00.000Z');

    beforeEach(() => {
      jest.setSystemTime(T);
      lastRefreshAt = T.getTime() - 30_000;
      snapshot = {
        queues: [{ name: 'sales' }, { name: 'support' }, { name: 'idle-queue' }],
        calls: [
          { status: 'WAITING', queue: 'Sales', enterTime: new Date(T.getTime() - 95_000) },
          { status: 'WAITING', queue: 'support', enterTime: new Date(T.getTime() - 20_000) },
          { status: 'TALKING', queue: 'sales', enterTime: new Date(T.getTime() - 500_000) },
        ],
        agents: [
          { status: 'READY', queues: ['sales'] },
          { status: 'READY', queues: ['support'] },
          { status: 'IN_CALL', queues: ['sales'] },
          { status: 'RINGING', queues: ['sales', 'support'] },
          { status: 'PAUSED', queues: ['support'] },
          { status: 'WRAPUP', queues: ['sales'] },
          { status: 'OFFLINE', queues: ['sales'] },
        ],
      };
      stored = [
        bucket('2026-07-15T11:30:00Z', 'sales', totals({ handled: 5, late: 1 })), // before the last two buckets
        bucket('2026-07-15T11:45:00Z', 'sales', totals({ handled: 3, late: 1 })),
        bucket('2026-07-15T12:00:00Z', 'sales', totals({ handled: 1 })), // bucket in progress
      ];
    });

    it('reports waiting, the longest wait, agent states and the SLA of the last 30 minutes', async () => {
      const res = await service.getOverview(1, { period: 'today' });
      expect(res.now!.source.state).toBe('ok');
      expect(res.now!.data).toEqual({
        waiting: 2,
        longestWaitSec: 95,
        agents: { ready: 2, busy: 2, paused: 1, wrapup: 1, offline: 1 },
        slaLast30: 75, // buckets 11:45 + 12:00: 4 handled, 3 in SL (11:30 is older than 30 min)
        offeredLast30: 4,
      });
    });

    it('limits the strip to the queue filter, case-insensitively', async () => {
      const res = await service.getOverview(1, { period: 'today', queues: 'sales' });
      expect(res.now!.data).toMatchObject({
        waiting: 1,
        longestWaitSec: 95,
        agents: { ready: 1, busy: 2, paused: 0, wrapup: 1, offline: 1 },
      });
    });

    it('has no SLA when nothing was offered recently', async () => {
      stored = [];
      const res = await service.getOverview(1, { period: 'today' });
      expect(res.now!.data).toMatchObject({ slaLast30: null, offeredLast30: 0 });
    });
  });

  describe('filters, sources and failures', () => {
    it('passes the queue filter to the store and still offers every queue in the filter options', async () => {
      stored = [
        bucket('2026-07-15T02:00:00Z', 'sales', totals({ handled: 1 })),
        bucket('2026-07-15T02:00:00Z', 'support', totals({ handled: 1 })),
      ];
      snapshot.queues = [{ name: 'billing' }];
      const res = await service.getOverview(1, { period: 'today', queues: 'sales' });
      expect(intervals.loadBuckets).toHaveBeenCalledWith(1, expect.any(Date), expect.any(Date), ['sales']);
      expect(res.queues).toEqual(['sales']);
      expect(res.availableQueues).toEqual(['billing', 'sales', 'support']);
      expect(res.service.data!.current.offered).toBe(1);
    });

    it('flags today as stale when the minute refresh has not run for a while', async () => {
      lastRefreshAt = NOW.getTime() - DASHBOARD_STALE_AFTER_MS - 1;
      const res = await service.getOverview(1, { period: 'today' });
      expect(res.service.source).toMatchObject({ state: 'stale', message: 'refresh_lagging' });
      expect(res.service.data).not.toBeNull(); // stale data is still shown, only labelled
    });

    it('reports an error source with no data - not zeros - when the store fails, and still answers', async () => {
      intervals.loadBuckets.mockRejectedValue(new Error('db down'));
      const res = await service.getOverview(1, { period: 'today' });
      for (const s of [res.service, res.series, res.queueTable, res.now!]) {
        expect(s.source).toMatchObject({ state: 'error', message: 'intervals_unavailable' });
        expect(s.data).toBeNull();
      }
      expect(res.period.preset).toBe('today');
    });

    it('rejects an invalid custom period with 400', async () => {
      await expect(service.getOverview(1, { period: 'custom', from: '2026-07-10' })).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.getOverview(1, { period: 'custom', from: '2026-05-01', to: '2026-07-10' })).rejects.toBeInstanceOf(BadRequestException);
    });

    it('defaults to today with comparison on', async () => {
      const res = await service.getOverview(1, {});
      expect(res.period).toMatchObject({ preset: 'today' });
      expect(res.period.previous).not.toBeNull();
    });
  });

  describe('losses section', () => {
    it('asks for the period, its comparison window and the queue filter', async () => {
      const res = await service.getOverview(1, { period: 'today', queues: 'sales' });
      expect(res.losses).toEqual({ source: expect.objectContaining({ state: 'ok' }), data: LOSSES });
      const [uid, window, previous, queues] = losses.getLosses.mock.calls[0];
      expect(uid).toBe(1);
      expect(window.from.toISOString()).toBe('2026-07-14T17:00:00.000Z');
      expect(window.to.toISOString()).toBe(NOW.toISOString());
      expect(previous).not.toBeNull();
      expect(queues).toEqual(['sales']);
    });

    it('passes no comparison window when compare is off', async () => {
      await service.getOverview(1, { period: 'today', compare: false });
      expect(losses.getLosses.mock.calls[0][2]).toBeNull();
    });

    it('reports its own error and leaves the other sections alone', async () => {
      losses.getLosses.mockRejectedValueOnce(new Error('boom'));
      stored = [bucket('2026-07-15T02:00:00Z', 'sales', totals({ handled: 3 }))];
      const res = await service.getOverview(1, { period: 'today' });
      expect(res.losses).toEqual({ source: { state: 'error', updatedAt: null, message: 'losses_unavailable' }, data: null });
      expect(res.service.data!.current.handled).toBe(3);
    });

    it('still builds when the interval aggregates are down', async () => {
      intervals.loadBuckets.mockRejectedValueOnce(new Error('db down'));
      const res = await service.getOverview(1, { period: 'today' });
      expect(res.service.data).toBeNull();
      expect(res.losses.data).toEqual(LOSSES);
    });
  });


  describe('pauses section', () => {
    it('asks for the period and its comparison window, not for a queue', async () => {
      const res = await service.getOverview(1, { period: 'today', queues: 'sales' });
      expect(res.pauses).toEqual({ source: expect.objectContaining({ state: 'ok' }), data: PAUSES });
      const [uid, window, previous] = pauses.getPauses.mock.calls[0];
      expect(uid).toBe(1);
      expect(window.from.toISOString()).toBe('2026-07-14T17:00:00.000Z');
      expect(previous).not.toBeNull();
    });

    it('reports its own error and leaves the other sections alone', async () => {
      pauses.getPauses.mockRejectedValueOnce(new Error('boom'));
      stored = [bucket('2026-07-15T02:00:00Z', 'sales', totals({ handled: 3 }))];
      const res = await service.getOverview(1, { period: 'today' });
      expect(res.pauses).toEqual({ source: { state: 'error', updatedAt: null, message: 'pauses_unavailable' }, data: null });
      expect(res.service.data!.current.handled).toBe(3);
      expect(res.losses.data).toEqual(LOSSES);
    });
  });


  describe('operators section', () => {
    it('asks for the period window', async () => {
      const res = await service.getOverview(1, { period: 'today' });
      expect(res.operators).toEqual({ source: expect.objectContaining({ state: 'ok' }), data: OPERATORS });
      const [uid, window] = operators.getDeviations.mock.calls[0];
      expect(uid).toBe(1);
      expect(window.from.toISOString()).toBe('2026-07-14T17:00:00.000Z');
    });

    it('reports its own error and leaves the other sections alone', async () => {
      operators.getDeviations.mockRejectedValueOnce(new Error('boom'));
      const res = await service.getOverview(1, { period: 'today' });
      expect(res.operators).toEqual({ source: { state: 'error', updatedAt: null, message: 'operators_unavailable' }, data: null });
      expect(res.pauses.data).toEqual(PAUSES);
    });
  });

});
