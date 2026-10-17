import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  buildQueueMetricsView,
  CC_DASHBOARD_LIMITS,
  CcDashboardPeriodError,
  emptyQueueTotals,
  mergeQueueTotals,
  resolveCcDashboardPeriod,
  shiftDateKey,
  zonedDateKey,
  zonedDayWindow,
  type CcDashboardLosses,
  type CcDashboardNow,
  type CcDashboardOperators,
  type CcDashboardPauses,
  type CcDashboardOverview,
  type CcDashboardPeriod,
  type CcDashboardQueueRow,
  type CcDashboardSection,
  type CcDashboardSeries,
  type CcDashboardSeriesGranularity,
  type CcDashboardSeriesPoint,
  type CcDashboardService as CcServiceSection,
  type CcDashboardSource,
  type CcDashboardWindow,
  type CcServiceKpis,
  type QueueMetricsView,
  type QueueTotals,
} from '@krasterisk/shared';
import { CallCenterIntervalService, foldStartMs, INTERVAL_MS, type IntervalBucket } from '../callcenter-interval.service';
import { CallCenterMetricsConfigService } from '../callcenter-metrics-config.service';
import { CallCenterStateService, type AgentStatus } from '../callcenter-state.service';
import { CallCenterLossesService } from './callcenter-losses.service';
import { CallCenterOperatorsService } from './callcenter-operators.service';
import { CallCenterPausesService } from './callcenter-pauses.service';
import type { DashboardOverviewQueryDto } from './dto/dashboard-overview-query.dto';

const HALF_HOUR_MS = 30 * 60_000;
/** The minute refresh job has not completed for this long: today's numbers may lag behind. */
export const DASHBOARD_STALE_AFTER_MS = 3 * 60_000;
const MAX_QUEUE_NAME_LENGTH = 64;

const BUSY: ReadonlySet<AgentStatus> = new Set(['IN_CALL', 'RINGING', 'DIALING', 'CONSULT', 'OUTBOUND_WORK']);
const WRAPUP: ReadonlySet<AgentStatus> = new Set(['WRAPUP', 'ACW']);

export function toServiceKpis(view: QueueMetricsView): CcServiceKpis {
  return {
    offered: view.offered,
    handled: view.answered,
    abandoned: view.abandoned,
    shortAbandoned: view.shortAbandoned,
    transferred: view.transferred,
    sla: view.sla,
    asr: view.asr,
    asa: Math.round(view.asa),
    aht: Math.round(view.aht),
    abandonRate: view.abandonRate,
    maxWait: view.maxWait,
  };
}

const kpisOf = (totals: QueueTotals): CcServiceKpis => toServiceKpis(buildQueueMetricsView(totals));

function sumTotals(buckets: readonly IntervalBucket[]): QueueTotals {
  const total = emptyQueueTotals();
  for (const bucket of buckets) mergeQueueTotals(total, bucket.totals);
  return total;
}

/** Queue names from `?queues=a,b`: trimmed, de-duplicated, bounded. */
export function parseQueueFilter(raw: string | undefined): string[] {
  if (!raw) return [];
  const names = [...new Set(raw.split(',').map((q) => q.trim()).filter(Boolean))];
  if (names.length > CC_DASHBOARD_LIMITS.maxQueues) {
    throw new BadRequestException(`At most ${CC_DASHBOARD_LIMITS.maxQueues} queues can be selected`);
  }
  if (names.some((q) => q.length > MAX_QUEUE_NAME_LENGTH)) {
    throw new BadRequestException('Queue name is too long');
  }
  return names;
}

/**
 * Management dashboard overview (cc-analytics E2): one request, sections built from the stored
 * 15-minute aggregates (C1), the live state and the shared metrics dictionary (A1). A failing
 * section reports its own source and never takes the page down.
 */
@Injectable()
export class CallCenterDashboardService {
  private readonly logger = new Logger(CallCenterDashboardService.name);

  constructor(
    private readonly intervals: CallCenterIntervalService,
    private readonly config: CallCenterMetricsConfigService,
    private readonly state: CallCenterStateService,
    private readonly lossesService: CallCenterLossesService,
    private readonly pausesService: CallCenterPausesService,
    private readonly operatorsService: CallCenterOperatorsService,
  ) {}

  async getOverview(userUid: number, query: DashboardOverviewQueryDto): Promise<CcDashboardOverview> {
    const { timezone } = await this.config.getTenantConfig(userUid);
    const now = new Date();
    const queues = parseQueueFilter(query.queues);

    let period: CcDashboardPeriod;
    try {
      period = resolveCcDashboardPeriod({
        preset: query.period ?? 'today',
        dateFrom: query.from,
        dateTo: query.to,
        compare: query.compare ?? true,
        now,
        timezone,
      });
    } catch (err) {
      if (err instanceof CcDashboardPeriodError) throw new BadRequestException(err.message);
      throw err;
    }

    const live = this.liveContext(userUid, queues);
    const lossesPromise = this.buildLosses(userUid, period, queues, now);
    const pausesPromise = this.buildPauses(userUid, period, now);
    const operatorsPromise = this.buildOperators(userUid, period, now);
    const generatedAt = now.toISOString();

    let current: IntervalBucket[] | null = null;
    let previous: IntervalBucket[] | null = null;
    let names: string[] = [];
    let loadError: string | null = null;
    try {
      const prevWindow = period.previous;
      const [cur, prev, listed] = await Promise.all([
        this.intervals.loadBuckets(userUid, new Date(period.from), new Date(period.to), queues),
        prevWindow
          ? this.intervals.loadBuckets(userUid, new Date(prevWindow.from), new Date(prevWindow.to), queues)
          : Promise.resolve(null),
        this.intervals.listQueueNames(userUid, new Date(period.from), new Date(period.to)),
      ]);
      current = cur;
      previous = prev;
      names = listed;
    } catch (err) {
      loadError = (err as Error).message;
      this.logger.error(`[dashboard] interval load failed tenant=${userUid}: ${loadError}`);
    }

    const source = this.dataSource(period, now, loadError);
    const section = <T>(build: (cur: IntervalBucket[], prev: IntervalBucket[] | null) => T): CcDashboardSection<T> => {
      if (!current) return { source, data: null };
      try {
        return { source, data: build(current, previous) };
      } catch (err) {
        this.logger.error(`[dashboard] section failed tenant=${userUid}: ${(err as Error).message}`);
        return { source: { state: 'error', updatedAt: null, message: 'section_failed' }, data: null };
      }
    };

    const available = new Set<string>(names);
    for (const q of live.queueNames) available.add(q);
    for (const q of queues) available.add(q);

    return {
      version: 1,
      generatedAt,
      period,
      queues,
      availableQueues: [...available].sort((a, b) => a.localeCompare(b)),
      now: period.includesToday
        ? section((cur) => this.buildNow(live, cur, now.getTime()))
        : null,
      service: section((cur, prev): CcServiceSection => ({
        current: kpisOf(sumTotals(cur)),
        previous: prev ? kpisOf(sumTotals(prev)) : null,
      })),
      series: section((cur, prev) => this.buildSeries(period, cur, prev)),
      queueTable: section((cur, prev) => this.buildQueueTable(cur, prev)),
      losses: await lossesPromise,
      pauses: await pausesPromise,
      operators: await operatorsPromise,
    };
  }

  // ─── Sections ────────────────────────────────────────────────────────────

  private dataSource(period: CcDashboardPeriod, now: Date, loadError: string | null): CcDashboardSource {
    if (loadError) return { state: 'error', updatedAt: null, message: 'intervals_unavailable' };
    if (!period.includesToday) return { state: 'ok', updatedAt: now.toISOString() };
    const last = this.intervals.lastRefreshAt;
    if (last !== null && now.getTime() - last > DASHBOARD_STALE_AFTER_MS) {
      return { state: 'stale', updatedAt: new Date(last).toISOString(), message: 'refresh_lagging' };
    }
    return { state: 'ok', updatedAt: new Date(last ?? now.getTime()).toISOString() };
  }

  /** Independent of the interval aggregates: it has its own source and failure. */
  private async buildLosses(
    userUid: number,
    period: CcDashboardPeriod,
    queues: readonly string[],
    now: Date,
  ): Promise<CcDashboardSection<CcDashboardLosses>> {
    try {
      const prev = period.previous;
      const data = await this.lossesService.getLosses(
        userUid,
        { from: new Date(period.from), to: new Date(period.to) },
        prev ? { from: new Date(prev.from), to: new Date(prev.to) } : null,
        queues,
      );
      return { source: { state: 'ok', updatedAt: now.toISOString() }, data };
    } catch (err) {
      this.logger.error(`[dashboard] losses failed tenant=${userUid}: ${(err as Error).message}`);
      return { source: { state: 'error', updatedAt: null, message: 'losses_unavailable' }, data: null };
    }
  }

  /** Not filtered by queue: pauses belong to the operator, not to a queue. Own source and failure. */
  private async buildPauses(
    userUid: number,
    period: CcDashboardPeriod,
    now: Date,
  ): Promise<CcDashboardSection<CcDashboardPauses>> {
    try {
      const prev = period.previous;
      const data = await this.pausesService.getPauses(
        userUid,
        { from: new Date(period.from), to: new Date(period.to) },
        prev ? { from: new Date(prev.from), to: new Date(prev.to) } : null,
      );
      return { source: { state: 'ok', updatedAt: now.toISOString() }, data };
    } catch (err) {
      this.logger.error(`[dashboard] pauses failed tenant=${userUid}: ${(err as Error).message}`);
      return { source: { state: 'error', updatedAt: null, message: 'pauses_unavailable' }, data: null };
    }
  }

  /** Per operator, not per queue: the queue filter does not apply. Own source and failure. */
  private async buildOperators(
    userUid: number,
    period: CcDashboardPeriod,
    now: Date,
  ): Promise<CcDashboardSection<CcDashboardOperators>> {
    try {
      const data = await this.operatorsService.getDeviations(userUid, {
        from: new Date(period.from),
        to: new Date(period.to),
      });
      return { source: { state: 'ok', updatedAt: now.toISOString() }, data };
    } catch (err) {
      this.logger.error(`[dashboard] operators failed tenant=${userUid}: ${(err as Error).message}`);
      return { source: { state: 'error', updatedAt: null, message: 'operators_unavailable' }, data: null };
    }
  }

  private liveContext(userUid: number, queues: readonly string[]) {
    const wanted = new Set(queues.map((q) => q.toLowerCase()));
    const inScope = (name: string) => wanted.size === 0 || wanted.has(name.toLowerCase());
    const snapshot = this.state.getSnapshot(userUid);
    return {
      queueNames: snapshot.queues.map((q) => q.name),
      calls: snapshot.calls.filter((c) => c.status === 'WAITING' && inScope(c.queue)),
      agents: snapshot.agents.filter((a) => wanted.size === 0 || a.queues.some(inScope)),
    };
  }

  private buildNow(live: ReturnType<CallCenterDashboardService['liveContext']>, current: IntervalBucket[], nowMs: number): CcDashboardNow {
    const agents = { ready: 0, busy: 0, paused: 0, wrapup: 0, offline: 0 };
    for (const agent of live.agents) {
      if (agent.status === 'READY' && agent.phoneOnline !== false) agents.ready += 1;
      else if (agent.status === 'READY' && agent.phoneOnline === false) agents.offline += 1;
      else if (agent.status === 'PAUSED') agents.paused += 1;
      else if (agent.status === 'OFFLINE') agents.offline += 1;
      else if (WRAPUP.has(agent.status)) agents.wrapup += 1;
      else if (BUSY.has(agent.status)) agents.busy += 1;
    }

    let longestWaitSec = 0;
    for (const call of live.calls) {
      const waited = Math.max(0, Math.floor((nowMs - new Date(call.enterTime).getTime()) / 1000));
      if (waited > longestWaitSec) longestWaitSec = waited;
    }

    // Two quarter-hour buckets: the one in progress and the one before it.
    const since = Math.floor(nowMs / INTERVAL_MS) * INTERVAL_MS - INTERVAL_MS;
    const recent = sumTotals(current.filter((b) => b.startMs >= since));
    return {
      waiting: live.calls.length,
      longestWaitSec,
      agents,
      slaLast30: recent.offered - recent.shortAbandoned > 0 ? buildQueueMetricsView(recent).sla : null,
      offeredLast30: recent.offered,
    };
  }

  private buildSeries(
    period: CcDashboardPeriod,
    current: IntervalBucket[],
    previous: IntervalBucket[] | null,
  ): CcDashboardSeries {
    const granularity: CcDashboardSeriesGranularity = period.days === 1 ? 'halfHour' : 'day';
    const points = this.seriesPoints(current, period, granularity, period.timezone);
    const prevPoints =
      previous && period.previous ? this.seriesPoints(previous, period.previous, granularity, period.timezone) : null;
    return {
      granularity,
      points,
      previous: prevPoints ? prevPoints.slice(0, points.length) : null,
    };
  }

  private seriesPoints(
    buckets: readonly IntervalBucket[],
    window: CcDashboardWindow,
    granularity: CcDashboardSeriesGranularity,
    tz: string,
  ): CcDashboardSeriesPoint[] {
    const fromMs = new Date(window.from).getTime();
    const toMs = new Date(window.to).getTime();

    const dayStart = new Map<string, number>();
    const startOfDay = (key: string): number => {
      let ms = dayStart.get(key);
      if (ms === undefined) {
        ms = zonedDayWindow(key, tz).from.getTime();
        dayStart.set(key, ms);
      }
      return ms;
    };
    const slotOf = (bucketMs: number): number =>
      granularity === 'halfHour'
        ? foldStartMs(bucketMs, tz, 30)
        : startOfDay(zonedDateKey(new Date(bucketMs), tz));

    const bySlot = new Map<number, QueueTotals>();
    for (const bucket of buckets) {
      const slot = slotOf(bucket.startMs);
      const totals = bySlot.get(slot) ?? emptyQueueTotals();
      mergeQueueTotals(totals, bucket.totals);
      bySlot.set(slot, totals);
    }

    const slots: number[] = [];
    if (granularity === 'halfHour') {
      for (let s = foldStartMs(fromMs, tz, 30); s < toMs; s += HALF_HOUR_MS) slots.push(s);
    } else {
      for (let key = window.dateFrom; key <= window.dateTo; key = shiftDateKey(key, 1)) {
        const s = startOfDay(key);
        if (s < toMs) slots.push(s);
      }
    }

    const running = emptyQueueTotals();
    return slots.map((slot) => {
      const totals = bySlot.get(slot) ?? emptyQueueTotals();
      mergeQueueTotals(running, totals);
      const view = buildQueueMetricsView(totals);
      return {
        at: new Date(slot).toISOString(),
        offered: view.offered,
        handled: view.answered,
        abandoned: view.abandoned,
        shortAbandoned: view.shortAbandoned,
        sla: view.sla,
        abandonRate: view.abandonRate,
        asa: Math.round(view.asa),
        aht: Math.round(view.aht),
        cumulativeSla: buildQueueMetricsView(running).sla,
        hasTraffic: view.offered > 0,
      };
    });
  }

  private buildQueueTable(current: IntervalBucket[], previous: IntervalBucket[] | null): CcDashboardQueueRow[] {
    const group = (buckets: readonly IntervalBucket[]): Map<string, QueueTotals> => {
      const map = new Map<string, QueueTotals>();
      for (const bucket of buckets) {
        const totals = map.get(bucket.queueName) ?? emptyQueueTotals();
        mergeQueueTotals(totals, bucket.totals);
        map.set(bucket.queueName, totals);
      }
      return map;
    };
    const prev = previous ? group(previous) : null;
    const rows = [...group(current)].map(([queueName, totals]) => ({
      queueName,
      totals,
      effective: totals.offered - totals.shortAbandoned,
      row: {
        queueName,
        current: kpisOf(totals),
        previous: prev ? kpisOf(prev.get(queueName) ?? emptyQueueTotals()) : null,
      } satisfies CcDashboardQueueRow,
    }));

    // Worst service first; queues without countable traffic go last (their SLA is not a verdict).
    rows.sort((a, b) => {
      if ((a.effective > 0) !== (b.effective > 0)) return a.effective > 0 ? -1 : 1;
      if (a.effective > 0) {
        return (
          a.row.current.sla - b.row.current.sla ||
          b.row.current.abandonRate - a.row.current.abandonRate ||
          a.queueName.localeCompare(b.queueName)
        );
      }
      return b.totals.offered - a.totals.offered || a.queueName.localeCompare(b.queueName);
    });
    return rows.map((r) => r.row);
  }
}
