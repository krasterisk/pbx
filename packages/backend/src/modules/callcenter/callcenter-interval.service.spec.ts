import { BadRequestException } from '@nestjs/common';
import { Op } from 'sequelize';
import {
  CallCenterIntervalService,
  foldStartMs,
  intervalBucketStartMs,
  MAX_INTERVAL_DAYS,
} from './callcenter-interval.service';

type Row = Record<string, any>;

const NOW = new Date('2026-07-15T12:00:00.000Z');
const SLA: Record<string, number> = { sales: 20, support: 60 };

let seq = 0;
function call(iso: string, partial: Row = {}): Row {
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
    created_at: new Date(iso),
    ...partial,
  };
}

/** The Sequelize `where` clauses the interval service uses. */
function matches(row: Row, where: Row = {}): boolean {
  for (const [key, cond] of Object.entries(where)) {
    const value = row[key];
    if (cond && typeof cond === 'object' && !(cond instanceof Date)) {
      const c = cond as Record<symbol, any>;
      if (c[Op.gte] !== undefined && !(+value >= +c[Op.gte])) return false;
      if (c[Op.lt] !== undefined && !(+value < +c[Op.lt])) return false;
      if (c[Op.in] !== undefined && !c[Op.in].includes(value)) return false;
    } else if (value !== cond) {
      return false;
    }
  }
  return true;
}

describe('CallCenterIntervalService', () => {
  let service: CallCenterIntervalService;
  let calls: Row[];
  let tenantRows: Array<{ user_uid: number }>;
  let store: Row[];
  let nextUid: number;
  let queueCallModel: { findAll: jest.Mock };
  let intervalModel: { findAll: jest.Mock; upsert: jest.Mock; destroy: jest.Mock };
  let tenant: { timezone: string; shortAbandonSec: number; defaultSlaSec: number };

  const point = (rows: Array<{ start: string }>, iso: string) => rows.find((r) => r.start === iso);

  beforeEach(() => {
    jest.useFakeTimers({ now: NOW, doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
    calls = [];
    tenantRows = [{ user_uid: 1 }];
    store = [];
    nextUid = 1;
    tenant = { timezone: 'UTC', shortAbandonSec: 5, defaultSlaSec: 20 };

    queueCallModel = {
      findAll: jest.fn(async (opts: Row) => (opts.attributes ? tenantRows : calls.filter((r) => matches(r, opts.where)))),
    };
    intervalModel = {
      findAll: jest.fn(async (opts: Row) => store.filter((r) => matches(r, opts.where)).map((r) => ({ ...r }))),
      upsert: jest.fn(async (row: Row) => {
        const i = store.findIndex(
          (r) => r.user_uid === row.user_uid && +r.interval_start === +row.interval_start && r.queue_name === row.queue_name,
        );
        if (i >= 0) store[i] = { ...store[i], ...row };
        else store.push({ uid: nextUid++, ...row });
        return [{}, true];
      }),
      destroy: jest.fn(async (opts: Row) => {
        for (const id of opts.where.uid[Op.in]) {
          const i = store.findIndex((r) => r.uid === id);
          if (i >= 0) store.splice(i, 1);
        }
      }),
    };
    const config = {
      getTenantConfig: jest.fn(async () => tenant),
      getSlaThreshold: jest.fn(async (_uid: number, queue: string, d?: number) => SLA[queue] ?? d ?? 20),
    };
    service = new CallCenterIntervalService(queueCallModel as any, intervalModel as any, config as any);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('bucket helpers', () => {
    it('aligns to UTC quarter hours', () => {
      expect(intervalBucketStartMs(Date.parse('2026-07-15T02:14:59.999Z'))).toBe(Date.parse('2026-07-15T02:00:00.000Z'));
      expect(intervalBucketStartMs(Date.parse('2026-07-15T02:15:00.000Z'))).toBe(Date.parse('2026-07-15T02:15:00.000Z'));
    });

    it('folds into tenant-local half hours and hours, including a +05:45 zone', () => {
      const t = (iso: string) => Date.parse(iso);
      // Bangkok UTC+7: 02:20Z is 09:20 local → hour bucket 09:00 = 02:00Z, half-hour bucket 09:00.
      expect(foldStartMs(t('2026-07-15T02:15:00Z'), 'Asia/Bangkok', 60)).toBe(t('2026-07-15T02:00:00Z'));
      expect(foldStartMs(t('2026-07-15T02:45:00Z'), 'Asia/Bangkok', 30)).toBe(t('2026-07-15T02:30:00Z'));
      // Kathmandu UTC+5:45: 06:30Z is 12:15 local → hour bucket 12:00 local = 06:15Z.
      expect(foldStartMs(t('2026-07-15T06:30:00Z'), 'Asia/Kathmandu', 60)).toBe(t('2026-07-15T06:15:00Z'));
      expect(foldStartMs(t('2026-07-15T06:30:00Z'), 'Asia/Kathmandu', 15)).toBe(t('2026-07-15T06:30:00Z'));
    });
  });

  describe('recomputeRange', () => {
    const FROM = new Date('2026-07-15T00:00:00.000Z');
    const TO = new Date('2026-07-16T00:00:00.000Z');

    it('writes additive per-queue quarter-hour buckets with the queue SLA and short-abandon rules', async () => {
      calls = [
        call('2026-07-15T02:05:00Z', { wait_time: 10, talk_time: 60, hold_time: 5, wrapup_time: 15 }),
        call('2026-07-15T02:14:00Z', { wait_time: 25, talk_time: 40, wrapup_time: 10 }),
        call('2026-07-15T02:20:00Z', { disposition: 'abandoned', wait_time: 40 }),
        call('2026-07-15T02:21:00Z', { disposition: 'abandoned', wait_time: 3 }),
        call('2026-07-15T02:10:00Z', { queue_name: 'support', wait_time: 45, talk_time: 100 }),
      ];

      const written = await service.recomputeRange(1, FROM, TO);

      expect(written).toBe(3);
      const sales0200 = store.find((r) => r.queue_name === 'sales' && +r.interval_start === Date.parse('2026-07-15T02:00:00Z'));
      expect(sales0200).toMatchObject({
        user_uid: 1,
        total_calls: 2,
        answered_calls: 2,
        abandoned_calls: 0,
        sla_met_calls: 1,
        sla_threshold_sec: 20,
        total_wait_sec: 35,
        total_talk_sec: 100,
        total_hold_sec: 5,
        total_wrapup_sec: 25,
        max_wait_sec: 25,
      });
      const sales0215 = store.find((r) => r.queue_name === 'sales' && +r.interval_start === Date.parse('2026-07-15T02:15:00Z'));
      expect(sales0215).toMatchObject({ total_calls: 2, abandoned_calls: 1, short_abandoned_calls: 1, answered_calls: 0, max_wait_sec: 40 });
      const support = store.find((r) => r.queue_name === 'support');
      expect(support).toMatchObject({ sla_threshold_sec: 60, sla_met_calls: 1 });
      expect(intervalModel.upsert).toHaveBeenCalledWith(
        expect.any(Object),
        { conflictFields: ['vpbx_user_uid', 'interval_start', 'queue_name'] },
      );
    });

    it('keeps direct:*, outbound and personal rows out of the buckets', async () => {
      calls = [
        call('2026-07-15T02:05:00Z', { queue_name: 'direct:PJSIP/100', direction: 'personal', talk_time: 90 }),
        call('2026-07-15T02:06:00Z', { queue_name: 'direct:PJSIP/100', direction: 'outbound', talk_time: 70 }),
        call('2026-07-15T02:07:00Z', { talk_time: 30 }),
      ];
      await service.recomputeRange(1, FROM, TO);
      expect(store).toHaveLength(1);
      expect(store[0]).toMatchObject({ queue_name: 'sales', total_calls: 1 });
    });

    it('is idempotent: a second run updates the same buckets instead of duplicating them', async () => {
      calls = [call('2026-07-15T02:05:00Z', { wait_time: 5, talk_time: 30 })];
      await service.recomputeRange(1, FROM, TO);
      await service.recomputeRange(1, FROM, TO);
      expect(store).toHaveLength(1);
    });

    it('removes buckets that no longer have any queue call (no ghosts)', async () => {
      calls = [call('2026-07-15T02:05:00Z'), call('2026-07-15T05:05:00Z')];
      await service.recomputeRange(1, FROM, TO);
      expect(store).toHaveLength(2);

      calls = [calls[0]];
      await service.recomputeRange(1, FROM, TO);
      expect(store).toHaveLength(1);
      expect(+store[0].interval_start).toBe(Date.parse('2026-07-15T02:00:00Z'));
      expect(intervalModel.destroy).toHaveBeenCalledTimes(1);
    });

    it('uses the rows it is given and ignores rows outside the window', async () => {
      const given = [call('2026-07-15T02:05:00Z'), call('2026-07-17T02:05:00Z')];
      await service.recomputeRange(1, FROM, TO, given as any);
      expect(queueCallModel.findAll).not.toHaveBeenCalled();
      expect(store).toHaveLength(1);
    });

    it('leaves other tenants untouched', async () => {
      store.push({
        uid: 99, user_uid: 2, interval_start: new Date('2026-07-15T02:00:00Z'), queue_name: 'other', total_calls: 5,
      });
      calls = [];
      await service.recomputeRange(1, FROM, TO);
      expect(store.map((r) => r.uid)).toEqual([99]);
    });

    it('an empty or inverted window is a no-op', async () => {
      expect(await service.recomputeRange(1, TO, FROM)).toBe(0);
      expect(intervalModel.upsert).not.toHaveBeenCalled();
    });
  });

  describe('loadBuckets / listQueueNames (dashboard read side)', () => {
    beforeEach(async () => {
      calls = [
        call('2026-07-15T02:05:00Z', { wait_time: 10, talk_time: 60 }),
        call('2026-07-15T02:06:00Z', { queue_name: 'support', wait_time: 5, talk_time: 20 }),
        call('2026-07-16T02:06:00Z', { queue_name: 'support' }),
      ];
      await service.recomputeRange(1, new Date('2026-07-15T00:00:00Z'), new Date('2026-07-17T00:00:00Z'));
    });

    it('returns additive totals of the window, limited to the named queues', async () => {
      const all = await service.loadBuckets(1, new Date('2026-07-15T00:00:00Z'), new Date('2026-07-16T00:00:00Z'));
      expect(all.map((b) => b.queueName).sort()).toEqual(['sales', 'support']);
      const sales = all.find((b) => b.queueName === 'sales')!;
      expect(sales.startMs).toBe(Date.parse('2026-07-15T02:00:00Z'));
      expect(sales.totals).toMatchObject({ offered: 1, handled: 1, sumWaitHandled: 10, sumTalkHandled: 60 });

      const onlySupport = await service.loadBuckets(1, new Date('2026-07-15T00:00:00Z'), new Date('2026-07-17T00:00:00Z'), ['support']);
      expect(onlySupport).toHaveLength(2);
      expect(onlySupport.every((b) => b.queueName === 'support')).toBe(true);
    });

    it('lists the distinct queue names of a window', async () => {
      queueCallModel.findAll.mockClear();
      intervalModel.findAll.mockImplementationOnce(async () => [{ queue_name: 'sales' }, { queue_name: 'support' }, { queue_name: '' }]);
      expect(await service.listQueueNames(1, new Date('2026-07-15T00:00:00Z'), new Date('2026-07-16T00:00:00Z'))).toEqual(['sales', 'support']);
    });
  });

  describe('lastRefreshAt', () => {
    it('is null until a refresh pass completes, then the time it finished', async () => {
      expect(service.lastRefreshAt).toBeNull();
      jest.spyOn(service, 'recomputeRange').mockResolvedValue(0);
      await service.refreshRecent();
      expect(service.lastRefreshAt).toBe(NOW.getTime());
    });

    it('keeps the previous value when a pass fails', async () => {
      jest.spyOn(service, 'recomputeRange').mockRejectedValue(new Error('db down'));
      await service.refreshRecent();
      expect(service.lastRefreshAt).toBeNull();
    });
  });

  describe('refreshRecent', () => {
    it('re-aggregates the recent window for every tenant that wrote queue calls', async () => {
      tenantRows = [{ user_uid: 1 }, { user_uid: 2 }];
      const spy = jest.spyOn(service, 'recomputeRange').mockResolvedValue(0);

      await service.refreshRecent();

      expect(spy).toHaveBeenCalledTimes(2);
      const [uid, from, to] = spy.mock.calls[0];
      expect(uid).toBe(1);
      expect(NOW.getTime() - (from as Date).getTime()).toBe(3 * 3_600_000);
      expect((to as Date).getTime()).toBeGreaterThan(NOW.getTime());
    });

    it('does not overlap itself and survives a failing tenant', async () => {
      const spy = jest.spyOn(service, 'recomputeRange').mockRejectedValue(new Error('db down'));
      await expect(service.refreshRecent()).resolves.toBeUndefined();
      expect(spy).toHaveBeenCalledTimes(1);

      (service as any).refreshing = true;
      await service.refreshRecent();
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe('getQueueIntervals (Asia/Bangkok, UTC+7)', () => {
    beforeEach(async () => {
      tenant.timezone = 'Asia/Bangkok';
      calls = [
        call('2026-07-15T02:05:00Z', { wait_time: 10, talk_time: 60, wrapup_time: 15 }), // local 09:05
        call('2026-07-15T02:20:00Z', { wait_time: 25, talk_time: 40, wrapup_time: 10 }),
        call('2026-07-15T02:10:00Z', { queue_name: 'support', wait_time: 45, talk_time: 100 }),
        call('2026-07-15T03:40:00Z', { disposition: 'abandoned', wait_time: 40 }), // local 10:40
        call('2026-07-15T03:41:00Z', { disposition: 'abandoned', wait_time: 3 }),
      ];
      await service.recomputeRange(1, new Date('2026-07-14T17:00:00Z'), new Date('2026-07-15T17:00:00Z'));
    });

    const today = { dateFrom: '2026-07-15', dateTo: '2026-07-15' };

    it('returns the local day trimmed to "now", gap-filled, one point per quarter hour', async () => {
      const res = await service.getQueueIntervals(1, today);
      expect(res.timezone).toBe('Asia/Bangkok');
      expect(res.from).toBe('2026-07-14T17:00:00.000Z');
      // 17:00Z (local midnight) → 12:00Z (now) = 19 h = 76 quarter hours.
      expect(res.rows).toHaveLength(76);
      expect(res.rows[0].start).toBe('2026-07-14T17:00:00.000Z');
      expect(res.rows.at(-1)!.start).toBe('2026-07-15T11:45:00.000Z');
      expect(point(res.rows, '2026-07-15T02:00:00.000Z')).toMatchObject({ offered: 2, answered: 2 });
      expect(point(res.rows, '2026-07-15T08:00:00.000Z')).toMatchObject({ offered: 0, answered: 0, sla: 0, cumulativeOffered: 5 });
    });

    it('folds into local hours with the dictionary formulas and running SLA', async () => {
      const res = await service.getQueueIntervals(1, { ...today, granularityMin: 60 });
      expect(res.granularityMin).toBe(60);
      expect(res.rows).toHaveLength(19);

      // local 09:00 hour: sales w10 (SL ok), sales w25 (late), support w45 (SL 60 ok)
      expect(point(res.rows, '2026-07-15T02:00:00.000Z')).toMatchObject({
        offered: 3,
        answered: 3,
        sla: 66.7,
        asa: 27, // (10 + 25 + 45) / 3
        aht: 75, // (60+15 + 40+10 + 100) / 3 rounded
        cumulativeOffered: 3,
        cumulativeSla: 66.7,
      });
      // local 10:00 hour: one abandon, one short abandon (excluded from the denominator)
      expect(point(res.rows, '2026-07-15T03:00:00.000Z')).toMatchObject({
        offered: 2,
        abandoned: 1,
        shortAbandoned: 1,
        sla: 0,
        abandonRate: 100,
        cumulativeOffered: 5,
        cumulativeSla: 50, // 2 in SL / (3 + 1) effective offered
      });
    });

    it('the sum of the points equals the whole range (day == sum of its intervals)', async () => {
      const res = await service.getQueueIntervals(1, { ...today, granularityMin: 30 });
      const sum = (key: 'offered' | 'answered' | 'abandoned' | 'shortAbandoned') =>
        res.rows.reduce((acc, r) => acc + r[key], 0);
      expect(sum('offered')).toBe(5);
      expect(sum('answered')).toBe(3);
      expect(sum('abandoned')).toBe(1);
      expect(sum('shortAbandoned')).toBe(1);
      expect(res.rows.at(-1)!.cumulativeSla).toBe(50);
    });

    it('filters by queue', async () => {
      const res = await service.getQueueIntervals(1, { ...today, granularityMin: 60, queueName: 'sales' });
      expect(point(res.rows, '2026-07-15T02:00:00.000Z')).toMatchObject({ offered: 2, sla: 50 });
    });

    it('adds the same range one week earlier, aligned index by index', async () => {
      calls = [call('2026-07-08T02:05:00Z', { wait_time: 5, talk_time: 30 })];
      await service.recomputeRange(1, new Date('2026-07-07T17:00:00Z'), new Date('2026-07-08T17:00:00Z'));

      const res = await service.getQueueIntervals(1, { ...today, granularityMin: 60, compare: 'weekAgo' });
      expect(res.previous).toHaveLength(res.rows.length);
      expect(res.previous![0].start).toBe('2026-07-07T17:00:00.000Z');
      expect(point(res.previous!, '2026-07-08T02:00:00.000Z')).toMatchObject({ offered: 1, answered: 1, sla: 100 });
    });

    it('defaults to the tenant-local current day when no dates are given', async () => {
      // 12:00Z is already 19:00 on 2026-07-15 in Bangkok; at 20:00Z it is 03:00 on the 16th.
      const res = await service.getQueueIntervals(1, { granularityMin: 60 });
      expect(res.from).toBe('2026-07-14T17:00:00.000Z');
      jest.setSystemTime(new Date('2026-07-15T20:00:00.000Z'));
      const next = await service.getQueueIntervals(1, { granularityMin: 60 });
      expect(next.from).toBe('2026-07-15T17:00:00.000Z');
    });

    it('a past day is not trimmed', async () => {
      const res = await service.getQueueIntervals(1, { dateFrom: '2026-07-14', dateTo: '2026-07-14', granularityMin: 60 });
      expect(res.rows).toHaveLength(24);
    });

    it('rejects malformed, inverted and oversized ranges and unsupported granularity', async () => {
      await expect(service.getQueueIntervals(1, { dateFrom: 'x', dateTo: '2026-07-15' })).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.getQueueIntervals(1, { dateFrom: '2026-07-16', dateTo: '2026-07-15' })).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.getQueueIntervals(1, { ...today, granularityMin: 45 })).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.getQueueIntervals(1, { dateFrom: '2026-06-01', dateTo: `2026-06-${String(1 + MAX_INTERVAL_DAYS).padStart(2, '0')}` }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
