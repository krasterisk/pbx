import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/sequelize';
import { Op, col, fn } from 'sequelize';
import {
  addQueueCall,
  buildQueueMetricsView,
  emptyQueueTotals,
  isQueueCallRow,
  mergeQueueTotals,
  shiftDateKey,
  zonedDateKey,
  zonedDayWindow,
  zonedParts,
  type QueueTotals,
} from '@krasterisk/shared';
import { CcQueueCall } from './models/queue-call.model';
import { CcIntervalQueueStats } from './models/interval-queue-stats.model';
import { CallCenterMetricsConfigService } from './callcenter-metrics-config.service';
import { queueTotalsFromAggRow, queueTotalsToAggColumns } from './callcenter-agg-row.util';

export const INTERVAL_MINUTES = 15;
export const INTERVAL_MS = INTERVAL_MINUTES * 60_000;
/** The live refresh re-aggregates this many hours back (late history flushes, reconciler backfill). */
export const RECENT_WINDOW_HOURS = 3;
/** On boot, rebuild this far back so a long outage leaves no hole in today's chart. */
export const BOOT_BACKFILL_HOURS = 36;
export const REFRESH_INTERVAL_MS = 60_000;
export const ALLOWED_GRANULARITY_MIN = [15, 30, 60] as const;
export type IntervalGranularity = (typeof ALLOWED_GRANULARITY_MIN)[number];
export const MAX_INTERVAL_DAYS = 14;
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

export interface QueueIntervalPoint {
  /** ISO UTC instant of the bucket start (local quarter / half / full hour of the tenant). */
  start: string;
  offered: number;
  answered: number;
  abandoned: number;
  shortAbandoned: number;
  transferred: number;
  sla: number;
  asr: number;
  asa: number;
  aht: number;
  abandonRate: number;
  maxWait: number;
  /** Running totals from the beginning of the requested range. */
  cumulativeOffered: number;
  cumulativeSla: number;
}

/** Service level of one queue over the last half hour and over the half hour before it. */
export interface QueueRecentSla {
  queueName: string;
  /** Calls offered in the last half hour (the quarter in progress plus the one before it). */
  offered: number;
  /** `null` when the window has no countable traffic: no verdict, not 0 %. */
  sla: number | null;
  previousSla: number | null;
}

export interface QueueIntervalResult {
  timezone: string;
  granularityMin: IntervalGranularity;
  from: string;
  to: string;
  rows: QueueIntervalPoint[];
  /** Same range one week earlier, aligned index-by-index with `rows`. */
  previous?: QueueIntervalPoint[];
}

export interface QueueIntervalQuery {
  /** Tenant-local `YYYY-MM-DD`; both default to the tenant's current local day. */
  dateFrom?: string;
  dateTo?: string;
  granularityMin?: number;
  queueName?: string;
  compare?: 'weekAgo';
}

/** One stored quarter-hour bucket of one queue, as additive dictionary totals. */
export interface IntervalBucket {
  startMs: number;
  queueName: string;
  totals: QueueTotals;
}

export function intervalBucketStartMs(ms: number): number {
  return Math.floor(ms / INTERVAL_MS) * INTERVAL_MS;
}

/**
 * 15-minute queue aggregates (cc-analytics C1): incremental refresh, catch-up on boot, recompute
 * on demand (rollup / reconciler pass their already loaded rows), and the read side that folds
 * buckets into 15 / 30 / 60-minute points in the tenant timezone.
 */
@Injectable()
export class CallCenterIntervalService implements OnModuleInit {
  private readonly logger = new Logger(CallCenterIntervalService.name);
  private refreshing = false;
  private lastRefreshMs: number | null = null;

  /** Epoch ms of the last successful refresh pass; `null` until the first one (dashboard staleness). */
  get lastRefreshAt(): number | null {
    return this.lastRefreshMs;
  }

  constructor(
    @InjectModel(CcQueueCall) private readonly queueCallModel: typeof CcQueueCall,
    @InjectModel(CcIntervalQueueStats) private readonly intervalModel: typeof CcIntervalQueueStats,
    private readonly config: CallCenterMetricsConfigService,
  ) {}

  onModuleInit(): void {
    const timer = setTimeout(() => {
      void this.refreshRecent(BOOT_BACKFILL_HOURS);
    }, 2_000);
    timer.unref?.();
  }

  // ─── Write side ──────────────────────────────────────────────────────────

  /**
   * Rebuild the buckets of one tenant inside [from, to). Buckets that no longer have any queue
   * call are removed, so the table never keeps ghosts of deleted rows.
   * `rows` lets the day rollup reuse the rows it already loaded.
   */
  async recomputeRange(
    userUid: number,
    from: Date,
    to: Date,
    rows?: ReadonlyArray<CcQueueCall>,
  ): Promise<number> {
    const fromMs = intervalBucketStartMs(from.getTime());
    const toMs = Math.ceil(to.getTime() / INTERVAL_MS) * INTERVAL_MS;
    if (!(toMs > fromMs)) return 0;

    const source =
      rows ??
      (await this.queueCallModel.findAll({
        where: { user_uid: userUid, created_at: { [Op.gte]: new Date(fromMs), [Op.lt]: new Date(toMs) } },
      }));

    const tenant = await this.config.getTenantConfig(userUid);
    const slaByQueue = new Map<string, number>();
    const buckets = new Map<string, { startMs: number; queue: string; sla: number; totals: QueueTotals }>();

    for (const row of source) {
      if (!isQueueCallRow(row) || !row.created_at) continue;
      const startMs = intervalBucketStartMs(new Date(row.created_at).getTime());
      if (startMs < fromMs || startMs >= toMs) continue;

      let sla = slaByQueue.get(row.queue_name);
      if (sla === undefined) {
        sla = await this.config.getSlaThreshold(userUid, row.queue_name, tenant.defaultSlaSec);
        slaByQueue.set(row.queue_name, sla);
      }
      const key = `${startMs}|${row.queue_name}`;
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = { startMs, queue: row.queue_name, sla, totals: emptyQueueTotals() };
        buckets.set(key, bucket);
      }
      addQueueCall(bucket.totals, row, { slaThresholdSec: sla, shortAbandonSec: tenant.shortAbandonSec });
    }

    const existing = await this.intervalModel.findAll({
      attributes: ['uid', 'interval_start', 'queue_name'],
      where: { user_uid: userUid, interval_start: { [Op.gte]: new Date(fromMs), [Op.lt]: new Date(toMs) } },
    });
    const staleIds = existing
      .filter((e) => !buckets.has(`${new Date(e.interval_start).getTime()}|${e.queue_name}`))
      .map((e) => e.uid);
    if (staleIds.length > 0) {
      await this.intervalModel.destroy({ where: { uid: { [Op.in]: staleIds } } });
    }

    const now = new Date();
    for (const bucket of buckets.values()) {
      await this.intervalModel.upsert(
        {
          user_uid: userUid,
          interval_start: new Date(bucket.startMs),
          queue_name: bucket.queue,
          sla_threshold_sec: bucket.sla,
          ...queueTotalsToAggColumns(bucket.totals),
          created_at: now,
          updated_at: now,
        },
        { conflictFields: ['vpbx_user_uid', 'interval_start', 'queue_name'] },
      );
    }
    return buckets.size;
  }

  /** Re-aggregate the last `hours` for every tenant that wrote queue calls in that window. */
  @Interval('cc-interval-refresh', REFRESH_INTERVAL_MS)
  async refreshRecent(hours: number = RECENT_WINDOW_HOURS): Promise<void> {
    if (this.refreshing) return;
    this.refreshing = true;
    try {
      const now = Date.now();
      const from = new Date(now - hours * 3_600_000);
      const to = new Date(now + INTERVAL_MS);
      const tenants = (await this.queueCallModel.findAll({
        attributes: [[fn('DISTINCT', col('vpbx_user_uid')), 'user_uid']],
        where: { created_at: { [Op.gte]: from } },
        raw: true,
      })) as unknown as Array<{ user_uid: number | string }>;
      for (const uid of new Set(tenants.map((t) => Number(t.user_uid)).filter(Number.isFinite))) {
        await this.recomputeRange(uid, from, to);
      }
      this.lastRefreshMs = Date.now();
    } catch (err) {
      this.logger.error(`[interval] refresh failed: ${(err as Error).message}`);
    } finally {
      this.refreshing = false;
    }
  }

  // ─── Read side ───────────────────────────────────────────────────────────

  /** Stored buckets of [from, to) for one tenant, optionally limited to exact queue names. */
  async loadBuckets(
    userUid: number,
    from: Date,
    to: Date,
    queueNames?: readonly string[],
  ): Promise<IntervalBucket[]> {
    const rows = await this.intervalModel.findAll({
      where: {
        user_uid: userUid,
        interval_start: { [Op.gte]: from, [Op.lt]: to },
        ...(queueNames && queueNames.length > 0 ? { queue_name: { [Op.in]: [...queueNames] } } : {}),
      },
    });
    return rows.map((row) => ({
      startMs: new Date(row.interval_start).getTime(),
      queueName: row.queue_name,
      totals: queueTotalsFromAggRow(row),
    }));
  }

  /** Distinct queue names that have buckets in [from, to) - the dashboard queue filter options. */
  async listQueueNames(userUid: number, from: Date, to: Date): Promise<string[]> {
    const rows = (await this.intervalModel.findAll({
      attributes: [[fn('DISTINCT', col('queue_name')), 'queue_name']],
      where: { user_uid: userUid, interval_start: { [Op.gte]: from, [Op.lt]: to } },
      raw: true,
    })) as unknown as Array<{ queue_name: string }>;
    return rows.map((r) => r.queue_name).filter(Boolean);
  }

  /**
   * "Is it getting better or worse right now": per queue, SLA of the last two quarter hours against
   * the two before them. Uses the stored buckets only, so it is as fresh as the minute refresh job.
   */
  async getRecentQueueSla(userUid: number, nowMs: number = Date.now()): Promise<QueueRecentSla[]> {
    const lastFrom = Math.floor(nowMs / INTERVAL_MS) * INTERVAL_MS - INTERVAL_MS;
    const previousFrom = lastFrom - 2 * INTERVAL_MS;
    const buckets = await this.loadBuckets(userUid, new Date(previousFrom), new Date(nowMs + INTERVAL_MS));

    const last = new Map<string, QueueTotals>();
    const before = new Map<string, QueueTotals>();
    const add = (map: Map<string, QueueTotals>, name: string, totals: QueueTotals) => {
      const sum = map.get(name) ?? emptyQueueTotals();
      mergeQueueTotals(sum, totals);
      map.set(name, sum);
    };
    for (const b of buckets) add(b.startMs >= lastFrom ? last : before, b.queueName, b.totals);

    const verdict = (totals: QueueTotals | undefined): number | null =>
      totals && totals.offered - totals.shortAbandoned > 0 ? buildQueueMetricsView(totals).sla : null;

    return [...new Set([...last.keys(), ...before.keys()])]
      .sort((a, b) => a.localeCompare(b))
      .map((queueName) => ({
        queueName,
        offered: last.get(queueName)?.offered ?? 0,
        sla: verdict(last.get(queueName)),
        previousSla: verdict(before.get(queueName)),
      }));
  }

  async getQueueIntervals(userUid: number, query: QueueIntervalQuery): Promise<QueueIntervalResult> {
    const { timezone } = await this.config.getTenantConfig(userUid);
    const today = zonedDateKey(new Date(), timezone);
    const dateFrom = query.dateFrom ?? query.dateTo ?? today;
    const dateTo = query.dateTo ?? query.dateFrom ?? today;
    if (!DATE_KEY.test(dateFrom) || !DATE_KEY.test(dateTo) || dateFrom > dateTo) {
      throw new BadRequestException('dateFrom/dateTo must be YYYY-MM-DD and dateFrom <= dateTo');
    }
    const granularity = (query.granularityMin ?? INTERVAL_MINUTES) as IntervalGranularity;
    if (!ALLOWED_GRANULARITY_MIN.includes(granularity)) {
      throw new BadRequestException(`granularityMin must be one of ${ALLOWED_GRANULARITY_MIN.join(', ')}`);
    }
    if (shiftDateKey(dateFrom, MAX_INTERVAL_DAYS) <= dateTo) {
      throw new BadRequestException(`Interval range is limited to ${MAX_INTERVAL_DAYS} days`);
    }

    const from = zonedDayWindow(dateFrom, timezone).from;
    const to = zonedDayWindow(dateTo, timezone).to;

    const rows = await this.buildSeries(userUid, timezone, granularity, from, to, query.queueName, true);
    const result: QueueIntervalResult = {
      timezone,
      granularityMin: granularity,
      from: from.toISOString(),
      to: to.toISOString(),
      rows,
    };

    if (query.compare === 'weekAgo') {
      const weekMs = 7 * 24 * 3_600_000;
      const previous = await this.buildSeries(
        userUid,
        timezone,
        granularity,
        new Date(from.getTime() - weekMs),
        new Date(to.getTime() - weekMs),
        query.queueName,
        false,
      );
      result.previous = previous.slice(0, rows.length);
    }
    return result;
  }

  /** Fold stored 15-minute buckets into local `granularity` points, gap-filled and with running totals. */
  private async buildSeries(
    userUid: number,
    timezone: string,
    granularity: IntervalGranularity,
    from: Date,
    to: Date,
    queueName: string | undefined,
    trimToNow: boolean,
  ): Promise<QueueIntervalPoint[]> {
    const stored = await this.intervalModel.findAll({
      where: {
        user_uid: userUid,
        interval_start: { [Op.gte]: from, [Op.lt]: to },
        ...(queueName ? { queue_name: queueName } : {}),
      },
    });

    const foldCache = new Map<number, number>();
    const fold = (startMs: number): number => {
      let folded = foldCache.get(startMs);
      if (folded === undefined) {
        folded = foldStartMs(startMs, timezone, granularity);
        foldCache.set(startMs, folded);
      }
      return folded;
    };

    const byPoint = new Map<number, QueueTotals>();
    for (const row of stored) {
      const key = fold(new Date(row.interval_start).getTime());
      const totals = byPoint.get(key) ?? emptyQueueTotals();
      mergeQueueTotals(totals, queueTotalsFromAggRow(row));
      byPoint.set(key, totals);
    }

    const end = trimToNow ? Math.min(to.getTime(), Date.now()) : to.getTime();
    const stepMs = granularity * 60_000;
    const points: QueueIntervalPoint[] = [];
    const running = emptyQueueTotals();
    for (let s = fold(from.getTime()); s < end; s += stepMs) {
      const totals = byPoint.get(s) ?? emptyQueueTotals();
      mergeQueueTotals(running, totals);
      const view = buildQueueMetricsView(totals);
      const cumulative = buildQueueMetricsView(running);
      points.push({
        start: new Date(s).toISOString(),
        offered: view.offered,
        answered: view.answered,
        abandoned: view.abandoned,
        shortAbandoned: view.shortAbandoned,
        transferred: view.transferred,
        sla: view.sla,
        asr: view.asr,
        asa: Math.round(view.asa),
        aht: Math.round(view.aht),
        abandonRate: view.abandonRate,
        maxWait: view.maxWait,
        cumulativeOffered: cumulative.offered,
        cumulativeSla: cumulative.sla,
      });
      if (points.length > (MAX_INTERVAL_DAYS * 24 * 60) / granularity + 2) break;
    }
    return points;
  }
}

/** Start (UTC ms) of the tenant-local `granularity` bucket that contains a quarter-hour bucket start. */
export function foldStartMs(startMs: number, timezone: string, granularity: number): number {
  if (granularity <= INTERVAL_MINUTES) return startMs;
  const [, , , hour, minute] = zonedParts(new Date(startMs), timezone);
  const minuteOfDay = hour * 60 + minute;
  return startMs - (minuteOfDay % granularity) * 60_000;
}
