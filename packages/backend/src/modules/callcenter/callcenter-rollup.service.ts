import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { CcQueueCall } from './models/queue-call.model';
import { CcDailyQueueStats } from './models/daily-queue-stats.model';
import { CcDailyAgentStats } from './models/daily-agent-stats.model';
import { DEFAULT_SLA_THRESHOLD_SEC } from './callcenter-metrics.service';

/** Hybrid aggregation (D-08): raw cc_queue_calls for ≤ this many days; rollup beyond. */
export const RAW_MAX_DAYS = 90;

type QueueAgg = {
  user_uid: number;
  queue_name: string;
  total_calls: number;
  answered_calls: number;
  abandoned_calls: number;
  sla_met_calls: number;
  sum_wait: number;
  sum_talk: number;
  sum_hold: number;
  max_wait: number;
  answered_wait_n: number;
  answered_talk_n: number;
  answered_hold_n: number;
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
 * sla_met_calls: answered calls with wait_time ≤ DEFAULT_SLA_THRESHOLD_SEC (20).
 * Per-queue Asterisk `servicelevel` is applied in CallCenterMetricsService (07-03);
 * rollup stores a tenant-default numerator suitable for long-range trends until reports
 * refine per-queue thresholds.
 */
@Injectable()
export class CallCenterRollupService {
  private readonly logger = new Logger(CallCenterRollupService.name);
  private running = false;

  constructor(
    @InjectModel(CcQueueCall) private readonly queueCallModel: typeof CcQueueCall,
    @InjectModel(CcDailyQueueStats) private readonly dailyQueueModel: typeof CcDailyQueueStats,
    @InjectModel(CcDailyAgentStats) private readonly dailyAgentModel: typeof CcDailyAgentStats,
  ) {}

  /**
   * Recompute daily rollup rows for one calendar day (upsert by UNIQUE keys).
   * When `vpbxUserUid` is set, only that tenant is recalculated (reconciler path).
   */
  async recomputeDay(statDate: Date, vpbxUserUid?: number): Promise<void> {
    const dayStart = startOfDay(statDate);
    const dayEnd = addDays(dayStart, 1);
    const dateOnly = toDateOnly(dayStart);

    const where: Record<string, unknown> = {
      created_at: { [Op.gte]: dayStart, [Op.lt]: dayEnd },
    };
    if (vpbxUserUid != null) {
      where.user_uid = vpbxUserUid;
    }

    const rows = await this.queueCallModel.findAll({ where });
    const queueMap = new Map<string, QueueAgg>();
    const agentMap = new Map<string, AgentAgg>();

    for (const row of rows) {
      const qKey = `${row.user_uid}|${row.queue_name}`;
      let q = queueMap.get(qKey);
      if (!q) {
        q = {
          user_uid: row.user_uid,
          queue_name: row.queue_name,
          total_calls: 0,
          answered_calls: 0,
          abandoned_calls: 0,
          sla_met_calls: 0,
          sum_wait: 0,
          sum_talk: 0,
          sum_hold: 0,
          max_wait: 0,
          answered_wait_n: 0,
          answered_talk_n: 0,
          answered_hold_n: 0,
        };
        queueMap.set(qKey, q);
      }
      q.total_calls += 1;
      q.max_wait = Math.max(q.max_wait, row.wait_time ?? 0);
      if (row.disposition === 'answered') {
        q.answered_calls += 1;
        q.sum_wait += row.wait_time ?? 0;
        q.sum_talk += row.talk_time ?? 0;
        q.sum_hold += row.hold_time ?? 0;
        q.answered_wait_n += 1;
        q.answered_talk_n += 1;
        q.answered_hold_n += 1;
        if ((row.wait_time ?? 0) <= DEFAULT_SLA_THRESHOLD_SEC) {
          q.sla_met_calls += 1;
        }
      } else if (row.disposition === 'abandoned') {
        q.abandoned_calls += 1;
      }

      const iface = (row.agent_interface || '').trim();
      if (!iface || row.disposition !== 'answered') continue;
      const aKey = `${row.user_uid}|${iface}`;
      let a = agentMap.get(aKey);
      if (!a) {
        a = {
          user_uid: row.user_uid,
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
      await this.dailyQueueModel.upsert({
        user_uid: q.user_uid,
        queue_name: q.queue_name,
        stat_date: dateOnly,
        total_calls: q.total_calls,
        answered_calls: q.answered_calls,
        abandoned_calls: q.abandoned_calls,
        sla_met_calls: q.sla_met_calls,
        avg_wait_sec: q.answered_wait_n ? Math.round(q.sum_wait / q.answered_wait_n) : 0,
        avg_talk_sec: q.answered_talk_n ? Math.round(q.sum_talk / q.answered_talk_n) : 0,
        avg_hold_sec: q.answered_hold_n ? Math.round(q.sum_hold / q.answered_hold_n) : 0,
        max_wait_sec: q.max_wait,
        total_talk_sec: q.sum_talk,
      });
    }

    for (const a of agentMap.values()) {
      const handleSec = a.total_talk_sec + a.total_hold_sec + a.total_wrapup_sec;
      await this.dailyAgentModel.upsert({
        user_uid: a.user_uid,
        agent_interface: a.agent_interface,
        agent_user_uid: a.agent_user_uid,
        stat_date: dateOnly,
        calls_handled: a.calls_handled,
        total_talk_sec: a.total_talk_sec,
        total_hold_sec: a.total_hold_sec,
        total_wrapup_sec: a.total_wrapup_sec,
        avg_handle_sec: a.calls_handled ? Math.round(handleSec / a.calls_handled) : 0,
      });
    }

    this.logger.log(
      `[rollup] recomputeDay ${dateOnly}` +
        (vpbxUserUid != null ? ` tenant=${vpbxUserUid}` : '') +
        ` queues=${queueMap.size} agents=${agentMap.size} raw=${rows.length}`,
    );
  }

  /** Nightly at 00:05 — recompute yesterday for all tenants (D-08, safety margin). */
  @Cron('5 0 * * *')
  async nightlyRollup(): Promise<void> {
    if (this.running) {
      this.logger.warn('[rollup] nightlyRollup skipped — already running');
      return;
    }
    this.running = true;
    try {
      const yesterday = addDays(startOfDay(new Date()), -1);
      await this.recomputeDay(yesterday);
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

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function toDateOnly(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
