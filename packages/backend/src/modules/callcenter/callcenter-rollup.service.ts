import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/sequelize';
import { Op, fn, col } from 'sequelize';
import {
  addQueueCall,
  emptyQueueTotals,
  isHandledDisposition,
  isQueueCallRow,
  shiftDateKey,
  zonedDayWindow,
  type QueueTotals,
} from '@krasterisk/shared';
import { CcQueueCall } from './models/queue-call.model';
import { CcDailyQueueStats } from './models/daily-queue-stats.model';
import { CcDailyAgentStats } from './models/daily-agent-stats.model';
import { CallCenterMetricsConfigService } from './callcenter-metrics-config.service';
import { CallCenterIntervalService } from './callcenter-interval.service';

/** Hybrid aggregation (D-08): raw cc_queue_calls for ≤ this many days; rollup beyond. */
export const RAW_MAX_DAYS = 90;

/** Bump when the stored meaning of daily columns changes (v2 = metrics dictionary). */
export const ROLLUP_VERSION = 2;

type QueueAgg = {
  user_uid: number;
  queue_name: string;
  slaThresholdSec: number;
  totals: QueueTotals;
};

type AgentAgg = {
  user_uid: number;
  agent_interface: string;
  agent_user_uid: number | null;
  calls_handled: number;
  total_talk_sec: number;
  total_hold_sec: number;
  total_wrapup_sec: number;
};

/**
 * Nightly rollup + hybrid source selection for reports (D-08).
 *
 * Version 2 rows follow the shared metrics dictionary and store ADDITIVE sums so ranges merge
 * without precision loss:
 * - one local calendar day per TENANT timezone (`stat_date` is the tenant-local date key);
 * - only inbound rows of real queues (`direct:*` and outbound are not queue stats);
 * - `answered_calls` = handled (answered + transferred); `abandoned_calls` excludes short abandons;
 * - `sla_met_calls` uses the per-queue servicelevel stored in `sla_threshold_sec`.
 */
@Injectable()
export class CallCenterRollupService {
  private readonly logger = new Logger(CallCenterRollupService.name);
  private running = false;

  constructor(
    @InjectModel(CcQueueCall) private readonly queueCallModel: typeof CcQueueCall,
    @InjectModel(CcDailyQueueStats) private readonly dailyQueueModel: typeof CcDailyQueueStats,
    @InjectModel(CcDailyAgentStats) private readonly dailyAgentModel: typeof CcDailyAgentStats,
    private readonly config: CallCenterMetricsConfigService,
    private readonly intervalService: CallCenterIntervalService,
  ) {}

  /**
   * Recompute daily rollup rows for one local calendar day (upsert by UNIQUE keys).
   * `statDate` is a `YYYY-MM-DD` key (preferred) or a Date (its server-local date is used).
   * When `vpbxUserUid` is set, only that tenant is recalculated (reconciler path).
   */
  async recomputeDay(statDate: Date | string, vpbxUserUid?: number): Promise<void> {
    const dateKey = typeof statDate === 'string' ? statDate : toDateOnly(statDate);
    const tenants = vpbxUserUid != null ? [vpbxUserUid] : await this.listTenantsAround(dateKey);

    for (const tenantUid of tenants) {
      await this.recomputeTenantDay(dateKey, tenantUid);
    }
  }

  private async listTenantsAround(dateKey: string): Promise<number[]> {
    // Tenant windows differ by timezone; pad the UTC probe by a day on each side.
    const from = new Date(`${shiftDateKey(dateKey, -1)}T00:00:00Z`);
    const to = new Date(`${shiftDateKey(dateKey, 2)}T00:00:00Z`);
    const rows = (await this.queueCallModel.findAll({
      attributes: [[fn('DISTINCT', col('vpbx_user_uid')), 'user_uid']],
      where: { created_at: { [Op.gte]: from, [Op.lt]: to } },
      raw: true,
    })) as unknown as Array<{ user_uid: number | string }>;
    return [...new Set(rows.map((r) => Number(r.user_uid)).filter((uid) => Number.isFinite(uid)))];
  }

  private async recomputeTenantDay(dateKey: string, tenantUid: number): Promise<void> {
    const tenantConfig = await this.config.getTenantConfig(tenantUid);
    const { from, to } = zonedDayWindow(dateKey, tenantConfig.timezone);

    const rows = await this.queueCallModel.findAll({
      where: { user_uid: tenantUid, created_at: { [Op.gte]: from, [Op.lt]: to } },
    });
    const queueMap = new Map<string, QueueAgg>();
    const agentMap = new Map<string, AgentAgg>();

    for (const row of rows) {
      if (isQueueCallRow(row)) {
        let q = queueMap.get(row.queue_name);
        if (!q) {
          q = {
            user_uid: tenantUid,
            queue_name: row.queue_name,
            slaThresholdSec: await this.config.getSlaThreshold(tenantUid, row.queue_name, tenantConfig.defaultSlaSec),
            totals: emptyQueueTotals(),
          };
          queueMap.set(row.queue_name, q);
        }
        addQueueCall(q.totals, row, {
          slaThresholdSec: q.slaThresholdSec,
          shortAbandonSec: tenantConfig.shortAbandonSec,
        });
      }

      // Agent rollup: inbound/personal handled calls only. Outbound/internal are "made", not handled.
      const iface = (row.agent_interface || '').trim();
      const direction = row.direction || 'inbound';
      if (!iface || !isHandledDisposition(row.disposition)) continue;
      if (direction === 'outbound' || direction === 'internal') continue;
      const aKey = iface;
      let a = agentMap.get(aKey);
      if (!a) {
        a = {
          user_uid: tenantUid,
          agent_interface: iface,
          agent_user_uid: row.agent_user_uid ?? null,
          calls_handled: 0,
          total_talk_sec: 0,
          total_hold_sec: 0,
          total_wrapup_sec: 0,
        };
        agentMap.set(aKey, a);
      }
      a.calls_handled += 1;
      a.total_talk_sec += row.talk_time ?? 0;
      a.total_hold_sec += row.hold_time ?? 0;
      a.total_wrapup_sec += row.wrapup_time ?? 0;
      if (row.agent_user_uid != null) a.agent_user_uid = row.agent_user_uid;
    }

    for (const q of queueMap.values()) {
      const t = q.totals;
      await this.dailyQueueModel.upsert({
        user_uid: q.user_uid,
        queue_name: q.queue_name,
        stat_date: dateKey,
        total_calls: t.offered,
        answered_calls: t.handled,
        abandoned_calls: t.abandoned,
        short_abandoned_calls: t.shortAbandoned,
        transferred_calls: t.transferred,
        sla_met_calls: t.handledInSl,
        sla_threshold_sec: q.slaThresholdSec,
        avg_wait_sec: t.handled ? Math.round(t.sumWaitHandled / t.handled) : 0,
        avg_talk_sec: t.handled ? Math.round(t.sumTalkHandled / t.handled) : 0,
        avg_hold_sec: t.handled ? Math.round(t.sumHoldHandled / t.handled) : 0,
        max_wait_sec: t.maxWait,
        total_talk_sec: t.sumTalkHandled,
        total_wait_sec: t.sumWaitHandled,
        total_hold_sec: t.sumHoldHandled,
        total_wrapup_sec: t.sumWrapupHandled,
        rollup_version: ROLLUP_VERSION,
      }, { conflictFields: ['vpbx_user_uid', 'stat_date', 'queue_name'] });
    }

    for (const a of agentMap.values()) {
      // talk_time already contains hold, so hold is not added to handle time.
      const handleSec = a.total_talk_sec + a.total_wrapup_sec;
      await this.dailyAgentModel.upsert({
        user_uid: a.user_uid,
        agent_interface: a.agent_interface,
        agent_user_uid: a.agent_user_uid,
        stat_date: dateKey,
        calls_handled: a.calls_handled,
        total_talk_sec: a.total_talk_sec,
        total_hold_sec: a.total_hold_sec,
        total_wrapup_sec: a.total_wrapup_sec,
        avg_handle_sec: a.calls_handled ? Math.round(handleSec / a.calls_handled) : 0,
      }, { conflictFields: ['vpbx_user_uid', 'stat_date', 'agent_interface'] });
    }

    // 15-minute buckets of the same day from the rows already loaded: day == sum of its intervals.
    try {
      await this.intervalService.recomputeRange(tenantUid, from, to, rows);
    } catch (err) {
      this.logger.error(`[rollup] interval rebuild ${dateKey} tenant=${tenantUid} failed: ${(err as Error).message}`);
    }

    this.logger.log(
      `[rollup] recomputeDay ${dateKey} tenant=${tenantUid} tz=${tenantConfig.timezone}` +
        ` queues=${queueMap.size} agents=${agentMap.size} raw=${rows.length}`,
    );
  }

  /**
   * Nightly at 00:05 — recompute the last two calendar days for all tenants. Tenant day
   * boundaries differ by timezone, so the second pass finalises days that were still open.
   */
  @Cron('5 0 * * *')
  async nightlyRollup(): Promise<void> {
    if (this.running) {
      this.logger.warn('[rollup] nightlyRollup skipped — already running');
      return;
    }
    this.running = true;
    try {
      const today = toDateOnly(new Date());
      await this.recomputeDay(shiftDateKey(today, -2));
      await this.recomputeDay(shiftDateKey(today, -1));
    } catch (err) {
      this.logger.error(`[rollup] nightlyRollup failed: ${(err as Error).message}`);
    } finally {
      this.running = false;
    }
  }

  /**
   * Public contract for reports (07-12): choose raw vs rollup source.
   * ≤ RAW_MAX_DAYS (90) → raw cc_queue_calls; longer → daily rollup tables.
   */
  resolveAggregationSource(periodStart: Date, periodEnd: Date): 'raw' | 'rollup' {
    const ms = periodEnd.getTime() - periodStart.getTime();
    const days = ms / (24 * 60 * 60 * 1000);
    return days <= RAW_MAX_DAYS ? 'raw' : 'rollup';
  }
}

function toDateOnly(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
