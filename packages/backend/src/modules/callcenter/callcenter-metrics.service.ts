/**
 * Call Center Metrics Engine — in-memory accumulators over the shared metrics dictionary.
 *
 * Real-time metrics read ONLY from memory (never DB in hot path).
 * restoreToday() rebuilds period accumulators from cc_queue_calls on startup
 * and at each reporting-day boundary (tenant-timezone midnight or business EOD).
 *
 * Rules (cc-analytics phase A, packages/shared/callcenter-metrics):
 * - only inbound rows of real queues feed queue aggregates (`direct:*`/outbound are separate);
 * - handled = answered + transferred; short abandons are excluded from rate denominators;
 * - Ring-No-Answer lives in cc_agent_offers (agent attempts), never in queue aggregates.
 */
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import {
  DEFAULT_SLA_THRESHOLD_SEC,
  addQueueCall,
  buildQueueMetricsView,
  computeAbandonRate,
  computeAht,
  computeAnswerRate,
  computeAsa,
  computeOccupancy,
  computeSla,
  emptyQueueTotals,
  isAbandonedDisposition,
  isHandledDisposition,
  isQueueCallRow,
  type MetricsConfig,
  type QueueMetricsView,
  type QueueTotals,
} from '@krasterisk/shared';
import { CcQueueCall } from './models/queue-call.model';
import { CcMissedCall } from './models/missed-call.model';
import { CcAgentOffer } from './models/agent-offer.model';
import { CcAgentSession } from './models/agent-session.model';
import { CcAgentEvent } from './models/agent-event.model';
import { readySecondsInWindow } from './callcenter-agent-timeline.util';
import type { AgentStatus } from './callcenter-state.service';
import type { ShiftPolicy } from './models/shift-policy.types';
import {
  startOfCalendarDay,
  startOfReportingDay,
} from './kpi-reporting-window.util';
import { sanitizeShiftPolicy } from './callcenter-settings.service';
import { CallCenterMetricsConfigService, type TenantConfigEntry } from './callcenter-metrics-config.service';

export { DEFAULT_SLA_THRESHOLD_SEC };

/** Additive per-queue totals from the shared dictionary. */
export type QueueAccumulator = QueueTotals;

export interface AgentAccumulator {
  talkSeconds: number;
  wrapupSeconds: number;
  idleSeconds: number;
}

/** Dual shift/day answered·made·missed counters (D-11/D-12/D-31/D-32). */
export interface KpiCounters {
  answered: number;
  made: number;
  missed: number;
}

export interface KpiAccumulator {
  /** Reset on agentLogin — current-shift counters. */
  sinceLogin: KpiCounters;
  /** Restored from cc_queue_calls — reporting-day counters (tenant day or business EOD). */
  sinceMidnight: KpiCounters;
}

export type QueueMetrics = QueueMetricsView;

export interface TenantQueueMetrics extends QueueMetrics {
  queueName: string;
}

interface AgentStatusTrack {
  lastStatus: AgentStatus;
  lastReadyEnter: number | null;
}

/** Row shape the restore paths read (works for Sequelize instances and raw rows). */
type HistoryRow = Pick<
  CcQueueCall,
  | 'user_uid' | 'queue_name' | 'agent_interface' | 'disposition' | 'direction'
  | 'wait_time' | 'talk_time' | 'hold_time' | 'wrapup_time' | 'call_uniqueid' | 'created_at'
>;

@Injectable()
export class CallCenterMetricsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CallCenterMetricsService.name);

  private readonly queueAccumulators = new Map<string, QueueAccumulator>();
  private readonly agentAccumulators = new Map<string, AgentAccumulator>();
  private readonly agentStatusTracks = new Map<string, AgentStatusTrack>();

  /**
   * Dual shift/day answered·made·missed counters (D-11/D-12/D-31/D-32).
   * Key = `${userUid}:${agentInterface}` (agent-level) OR
   *       `${userUid}:${agentInterface}:${queueName}` (per-queue personal stats).
   */
  private readonly kpiAccumulators = new Map<string, KpiAccumulator>();

  /** Per-tenant reporting-window start used for the last restore (rollover detection). */
  private readonly periodStartByTenant = new Map<number, number>();
  private rolloverTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    @InjectModel(CcQueueCall) private readonly queueCallModel: typeof CcQueueCall,
    @InjectModel(CcMissedCall) private readonly missedCallModel: typeof CcMissedCall,
    @InjectModel(CcAgentOffer) private readonly offerModel: typeof CcAgentOffer,
    private readonly config: CallCenterMetricsConfigService,
    @InjectModel(CcAgentSession) private readonly sessionModel: typeof CcAgentSession,
    @InjectModel(CcAgentEvent) private readonly agentEventModel: typeof CcAgentEvent,
  ) {}

  onModuleInit(): void {
    setTimeout(() => {
      void this.restoreToday();
    }, 500);
    // Detect calendar / business-day boundary without waiting for Nest restart.
    this.rolloverTimer = setInterval(() => {
      void this.ensureReportingWindows();
    }, 60_000);
    if (typeof this.rolloverTimer === 'object' && 'unref' in this.rolloverTimer) {
      this.rolloverTimer.unref?.();
    }
  }

  onModuleDestroy(): void {
    if (this.rolloverTimer) {
      clearInterval(this.rolloverTimer);
      this.rolloverTimer = null;
    }
  }

  // ─── Formula methods — thin wrappers over the shared dictionary ──────────

  computeSla(acc: QueueAccumulator): number {
    return computeSla(acc);
  }

  /** Answer rate: handled / (offered − short abandons). */
  computeAsr(acc: QueueAccumulator): number {
    return computeAnswerRate(acc);
  }

  computeAht(acc: QueueAccumulator): number {
    return computeAht(acc);
  }

  computeAsa(acc: QueueAccumulator): number {
    return computeAsa(acc);
  }

  computeAbandonRate(acc: QueueAccumulator): number {
    return computeAbandonRate(acc);
  }

  computeOccupancy(agentAcc: AgentAccumulator): number {
    return computeOccupancy({
      talkSec: agentAcc.talkSeconds,
      wrapupSec: agentAcc.wrapupSeconds,
      idleSec: agentAcc.idleSeconds,
    });
  }

  // ─── SLA threshold (D-07) — delegated to the shared tenant config ────────

  /** Sync read from cache; falls back to the tenant default until a value is cached. */
  getSlaThresholdSync(userUid: number, queueName: string): number {
    return this.config.peekSlaThreshold(userUid, queueName);
  }

  resolveSlaThreshold(userUid: number, queueName: string): Promise<number> {
    return this.config.getSlaThreshold(userUid, queueName);
  }

  private metricsConfigSync(userUid: number, queueName: string): MetricsConfig {
    return {
      slaThresholdSec: this.config.peekSlaThreshold(userUid, queueName),
      shortAbandonSec: this.config.peekTenantConfig(userUid).shortAbandonSec,
    };
  }

  // ─── Public getters (in-memory only) ─────────────────────────────────────

  getQueueMetrics(userUid: number, queueName: string): QueueMetrics {
    const acc = this.queueAccumulators.get(this.queueKey(userUid, queueName)) ?? emptyQueueTotals();
    return buildQueueMetricsView(acc);
  }

  getAgentOccupancy(userUid: number, agentInterface: string): number {
    const acc = this.agentAccumulators.get(this.agentKey(userUid, agentInterface)) ?? this.emptyAgentAcc();
    return this.computeOccupancy(acc);
  }

  /** Dual shift/day answered·made·missed for an agent, across all queues (D-11/D-12). */
  getAgentKpi(userUid: number, agentInterface: string): KpiAccumulator {
    const acc = this.kpiAccumulators.get(this.agentKey(userUid, agentInterface));
    return acc ? this.cloneKpiAcc(acc) : this.emptyKpiAcc();
  }

  /** Dual shift/day answered·made·missed for an agent within one queue (D-31/D-32). */
  getAgentQueueKpi(userUid: number, agentInterface: string, queueName: string): KpiAccumulator {
    const acc = this.kpiAccumulators.get(this.agentQueueKey(userUid, agentInterface, queueName));
    return acc ? this.cloneKpiAcc(acc) : this.emptyKpiAcc();
  }

  /** Same as getAgentQueueKpi, batched across every queue the agent belongs to (Queues tab, D-31/D-32). */
  getAgentQueuesKpi(
    userUid: number,
    agentInterface: string,
    queueNames: string[],
  ): Record<string, KpiAccumulator> {
    const result: Record<string, KpiAccumulator> = {};
    for (const queueName of queueNames) {
      result[queueName] = this.getAgentQueueKpi(userUid, agentInterface, queueName);
    }
    return result;
  }

  getTenantQueueMetrics(userUid: number): TenantQueueMetrics[] {
    const prefix = `${userUid}:`;
    const result: TenantQueueMetrics[] = [];
    for (const [key, acc] of this.queueAccumulators) {
      if (key.startsWith(prefix)) {
        result.push({
          queueName: key.slice(prefix.length),
          ...buildQueueMetricsView(acc),
        });
      }
    }
    return result;
  }

  // ─── Mutations (sync — no DB in hot path) ────────────────────────────────

  recordAnswered(
    userUid: number,
    queueName: string,
    agentInterface: string,
    waitSec: number,
    talkSec: number,
    wrapupSec: number,
  ): void {
    this.accumulateQueueRow(
      userUid,
      queueName,
      { disposition: 'answered', wait_time: waitSec, talk_time: talkSec, wrapup_time: wrapupSec },
    );

    if (agentInterface) {
      const agentAcc = this.getOrCreateAgentAcc(userUid, agentInterface);
      agentAcc.talkSeconds += talkSec;
      agentAcc.wrapupSeconds += wrapupSec;
      this.bumpKpi(userUid, agentInterface, 'answered', queueName);
    }

    // Warm the per-queue SLA threshold for the next call.
    void this.config.getSlaThreshold(userUid, queueName).catch(() => undefined);
  }

  /** Caller abandoned / queue timeout. `waitSec` decides short-abandon classification. */
  recordAbandoned(userUid: number, queueName: string, waitSec = 0): void {
    this.accumulateQueueRow(userUid, queueName, { disposition: 'abandoned', wait_time: waitSec });
  }

  /** Personal/direct inbound answered (not a queue call) — shift KPI only. */
  recordAnsweredDirect(userUid: number, agentInterface: string): void {
    this.bumpKpi(userUid, agentInterface, 'answered');
  }

  /** Outbound/personal dial answered (D-08/D-11) — never a queue metric (Pitfall 1). */
  recordMade(userUid: number, agentInterface: string, queueName?: string): void {
    this.bumpKpi(userUid, agentInterface, 'made', queueName);
  }

  /**
   * Agent-level miss — an outbound dial that didn't answer, a direct inbound ring the agent
   * never picked up (D-08/D-12), or a queue Ring-No-Answer attempt (counted for the agent only;
   * it never enters queue aggregates and is stored in cc_agent_offers).
   */
  recordMissed(userUid: number, agentInterface: string, queueName?: string): void {
    this.bumpKpi(userUid, agentInterface, 'missed', queueName);
  }

  /** Reset the current-shift KPI counters on agentLogin; sinceMidnight is untouched (D-11). */
  resetKpiSinceLogin(userUid: number, agentInterface: string): void {
    const prefix = this.agentKey(userUid, agentInterface);
    for (const [key, acc] of this.kpiAccumulators) {
      if (key === prefix || key.startsWith(`${prefix}:`)) {
        acc.sinceLogin = this.emptyKpiCounters();
      }
    }
  }

  /**
   * Rebuild sinceLogin from cc_queue_calls + cc_agent_offers for an open shift (F5 / Nest restart).
   * Journal already persists those rows — shift KPI must match after memory loss.
   * sinceMidnight is left untouched (still owned by restoreToday).
   */
  async rebuildSinceLoginFromHistory(opts: {
    userUid: number;
    agentInterface: string;
    operatorUserId: number;
    loginTime: Date;
  }): Promise<KpiCounters> {
    const sinceLogin = this.emptyKpiCounters();
    if (!opts.agentInterface || !opts.operatorUserId || !opts.loginTime) {
      return sinceLogin;
    }

    try {
      const rows = await this.queueCallModel.findAll({
        where: {
          user_uid: opts.userUid,
          agent_user_uid: opts.operatorUserId,
          created_at: { [Op.gte]: opts.loginTime },
        },
      });

      for (const row of rows) {
        const kind = this.agentKpiKind(row);
        if (kind) sinceLogin[kind]++;
      }

      // Queue Ring-No-Answer attempts are agent misses, stored apart from queue calls.
      const offers = await this.offerModel.findAll({
        where: {
          user_uid: opts.userUid,
          agent_user_uid: opts.operatorUserId,
          offered_at: { [Op.gte]: opts.loginTime },
        },
      });
      sinceLogin.missed += offers.length;

      const acc = this.getOrCreateKpiAcc(this.agentKey(opts.userUid, opts.agentInterface));
      acc.sinceLogin = { ...sinceLogin };
      return { ...sinceLogin };
    } catch (err: any) {
      this.logger.warn(`rebuildSinceLoginFromHistory failed: ${err.message}`);
      return sinceLogin;
    }
  }

  /**
   * Track READY idle time for Occupancy.
   * Only time in READY counts toward idleSeconds (pause excluded).
   */
  recordAgentStatus(userUid: number, agentInterface: string, status: AgentStatus): void {
    if (!agentInterface) return;

    const key = this.agentKey(userUid, agentInterface);
    const now = Date.now();
    let track = this.agentStatusTracks.get(key);

    if (!track) {
      track = { lastStatus: status, lastReadyEnter: status === 'READY' ? now : null };
      this.agentStatusTracks.set(key, track);
      return;
    }

    if (track.lastStatus === 'READY' && status !== 'READY' && track.lastReadyEnter !== null) {
      const agentAcc = this.getOrCreateAgentAcc(userUid, agentInterface);
      agentAcc.idleSeconds += Math.max(0, Math.round((now - track.lastReadyEnter) / 1000));
      track.lastReadyEnter = null;
    }

    if (status === 'READY' && track.lastStatus !== 'READY') {
      track.lastReadyEnter = now;
    }

    track.lastStatus = status;
  }

  /**
   * Agent ring-no-answer offers (cc_agent_offers) shaped like operator/supervisor journal rows.
   * RNA no longer lives in cc_queue_calls (the call itself is later answered or abandoned);
   * the journals still need to show that an operator missed a ring.
   * `uid` is negative so it can never collide with a cc_queue_calls uid.
   */
  async listAgentOfferJournalRows(
    userUid: number,
    agentUserIds: number[],
    since: Date,
    limit: number,
  ): Promise<Array<{
    uid: number;
    callUniqueid: string;
    queueName: string;
    callerIdNum: string | null;
    callerIdName: string | null;
    direction: 'inbound';
    callType: 'rna';
    disposition: 'timeout';
    transferDestination: null;
    handledByName: null;
    handledByExten: null;
    enterTime: Date;
    answerTime: null;
    endTime: Date;
    waitTime: number;
    talkTime: number;
    agentUserId: number | null;
  }>> {
    if (agentUserIds.length === 0) return [];
    const offers = await this.offerModel.findAll({
      where: {
        user_uid: userUid,
        agent_user_uid: { [Op.in]: agentUserIds },
        offered_at: { [Op.gte]: since },
      },
      order: [['offered_at', 'DESC']],
      limit,
    });
    return offers.map((o) => {
      const offeredAt = o.getDataValue('offered_at') as Date;
      const ring = Number(o.getDataValue('ring_time')) || 0;
      return {
        uid: -Number(o.getDataValue('uid')),
        callUniqueid: o.getDataValue('call_uniqueid') as string,
        queueName: o.getDataValue('queue_name') as string,
        callerIdNum: (o.getDataValue('caller_id_num') as string | null) ?? null,
        callerIdName: null,
        direction: 'inbound' as const,
        callType: 'rna' as const,
        disposition: 'timeout' as const,
        transferDestination: null,
        handledByName: null,
        handledByExten: null,
        enterTime: offeredAt,
        answerTime: null,
        endTime: new Date(offeredAt.getTime() + ring),
        waitTime: Math.round(ring / 1000),
        talkTime: 0,
        agentUserId: (o.getDataValue('agent_user_uid') as number | null) ?? null,
      };
    });
  }

  // ─── Restore from history (D-06) ─────────────────────────────────────────

  async restoreToday(): Promise<void> {
    try {
      const now = new Date();
      const tenantConfigs = await this.config.loadAll();
      const tenantStarts = new Map<number, Date>();
      const resolveStart = (userUid: number): Date => {
        let start = tenantStarts.get(userUid);
        if (!start) {
          const entry = tenantConfigs.get(userUid);
          const timezone = entry?.config.timezone ?? this.config.peekTenantConfig(userUid).timezone;
          start = startOfReportingDay(this.shiftPolicyOf(entry), now, timezone);
          tenantStarts.set(userUid, start);
        }
        return start;
      };

      // Earliest possible start among known tenants (fallback: 36 h to catch overnight business days).
      let queryStart: Date;
      if (tenantConfigs.size > 0) {
        // Never query later than the server-local midnight (covers tenants unknown to the config).
        queryStart = startOfCalendarDay(now);
        for (const uid of tenantConfigs.keys()) {
          const s = resolveStart(uid);
          if (s.getTime() < queryStart.getTime()) queryStart = s;
        }
      } else {
        queryStart = new Date(now.getTime() - 36 * 60 * 60 * 1000);
      }

      const rows = await this.queueCallModel.findAll({
        where: { created_at: { [Op.gte]: queryStart } },
      });

      this.queueAccumulators.clear();
      this.agentAccumulators.clear();
      this.agentStatusTracks.clear();
      this.kpiAccumulators.clear();
      this.periodStartByTenant.clear();

      const configCache = new Map<string, Promise<MetricsConfig>>();
      const metricsConfigFor = (userUid: number, queueName: string): Promise<MetricsConfig> => {
        const cacheKey = this.queueKey(userUid, queueName);
        let pending = configCache.get(cacheKey);
        if (!pending) {
          pending = this.config.getMetricsConfig(userUid, queueName);
          configCache.set(cacheKey, pending);
        }
        return pending;
      };

      let appliedRows = 0;
      let queueRows = 0;
      // call_uniqueids of non-queue misses already counted from history (dedup vs cc_missed_calls).
      const directMissedUids = new Set<string>();

      for (const row of rows as HistoryRow[]) {
        const userUid = row.user_uid;
        const periodStart = resolveStart(userUid);
        const createdAt = row.created_at ? new Date(row.created_at).getTime() : 0;
        if (createdAt && createdAt < periodStart.getTime()) continue;
        appliedRows++;

        const queueName = row.queue_name;
        const isQueue = isQueueCallRow(row);

        if (isQueue) {
          queueRows++;
          const cfg = await metricsConfigFor(userUid, queueName);
          addQueueCall(this.getOrCreateQueueAcc(userUid, queueName), row, cfg);
        }

        if (!row.agent_interface) continue;

        const kind = this.agentKpiKind(row);
        if (isHandledDisposition(row.disposition)) {
          // Occupancy counts agent work on every direction.
          const agentAcc = this.getOrCreateAgentAcc(userUid, row.agent_interface);
          agentAcc.talkSeconds += row.talk_time;
          agentAcc.wrapupSeconds += row.wrapup_time;
        }
        if (kind) {
          this.restoreKpi(userUid, row.agent_interface, kind, isQueue ? queueName : undefined);
          if (kind === 'missed' && row.call_uniqueid) directMissedUids.add(`${userUid}:${row.call_uniqueid}`);
        }
      }

      // Queue Ring-No-Answer attempts → agent missed KPI (never queue aggregates).
      const offers = await this.offerModel.findAll({
        where: { offered_at: { [Op.gte]: queryStart } },
      });
      let appliedOffers = 0;
      for (const offer of offers) {
        const periodStart = resolveStart(offer.user_uid);
        const offeredAt = offer.offered_at ? new Date(offer.offered_at).getTime() : 0;
        if (offeredAt && offeredAt < periodStart.getTime()) continue;
        if (!offer.agent_interface) continue;
        appliedOffers++;
        this.restoreKpi(offer.user_uid, offer.agent_interface, 'missed', offer.queue_name);
      }

      // Personal missed-call worklist rows (direct:<interface>) not already counted from history.
      const personalMissed = await this.missedCallModel.findAll({
        where: {
          created_at: { [Op.gte]: queryStart },
          personal: true,
        },
      });
      let appliedMissed = 0;
      for (const row of personalMissed) {
        const periodStart = resolveStart(row.user_uid);
        const createdAt = row.created_at ? new Date(row.created_at).getTime() : 0;
        if (createdAt && createdAt < periodStart.getTime()) continue;
        const q = row.queue_name || '';
        if (!q.startsWith('direct:')) continue;
        const agentInterface = q.slice('direct:'.length);
        if (!agentInterface) continue;
        if (row.call_uniqueid && directMissedUids.has(`${row.user_uid}:${row.call_uniqueid}`)) continue;
        appliedMissed++;
        this.restoreKpi(row.user_uid, agentInterface, 'missed');
      }

      // Occupancy needs READY time too: rebuild it from the agent journal (A7).
      const restoredIdleAgents = await this.restoreIdleSeconds(now, queryStart, resolveStart);

      for (const [uid, start] of tenantStarts) {
        this.periodStartByTenant.set(uid, start.getTime());
      }
      // Tenants with no history still need a marker so rollover can detect midnight.
      for (const uid of tenantConfigs.keys()) {
        if (!this.periodStartByTenant.has(uid)) {
          this.periodStartByTenant.set(uid, resolveStart(uid).getTime());
        }
      }

      this.logger.log(
        `Metrics restoreToday: ${appliedRows}/${rows.length} cc_queue_calls (${queueRows} queue) + ${appliedOffers} RNA offers + ${appliedMissed} personal missed, idle restored for ${restoredIdleAgents} agents`,
      );
    } catch (err: any) {
      this.logger.error(`Metrics restoreToday failed: ${err.message}`);
    }
  }

  /**
   * Rebuild READY (idle) seconds of the reporting day from cc_agent_sessions + cc_agent_events, so
   * Occupancy survives a restart / day rollover instead of restarting from zero idle.
   * Sessions that cross the day start are clipped; an open session also restores its live status
   * track so the READY time keeps accumulating from "now".
   * Returns how many agents received idle time. Never throws: a failure leaves idle at 0.
   */
  private async restoreIdleSeconds(
    now: Date,
    queryStart: Date,
    resolveStart: (userUid: number) => Date,
  ): Promise<number> {
    try {
      const sessions = await this.sessionModel.findAll({
        where: {
          login_time: { [Op.lte]: now },
          [Op.or]: [{ logout_time: null }, { logout_time: { [Op.gte]: queryStart } }],
        },
      });
      if (sessions.length === 0) return 0;

      const events = await this.agentEventModel.findAll({
        where: { session_id: { [Op.in]: sessions.map((s) => s.uid) } },
        order: [['created_at', 'ASC']],
      });
      const bySession = new Map<number, CcAgentEvent[]>();
      for (const ev of events) {
        const list = bySession.get(ev.session_id) ?? [];
        list.push(ev);
        bySession.set(ev.session_id, list);
      }

      const restored = new Set<string>();
      for (const session of sessions) {
        if (!session.agent_interface) continue;
        const userUid = session.user_uid;
        const sessionEnd = session.logout_time ? new Date(session.logout_time) : now;
        const { readySec, endState } = readySecondsInWindow(
          bySession.get(session.uid) ?? [],
          sessionEnd,
          resolveStart(userUid),
          now,
        );
        const key = this.agentKey(userUid, session.agent_interface);
        if (readySec > 0) {
          this.getOrCreateAgentAcc(userUid, session.agent_interface).idleSeconds += readySec;
          restored.add(key);
        }
        if (!session.logout_time && endState) {
          // Open session: continue the live READY clock from now (the elapsed part is added above).
          const lastStatus: AgentStatus = endState === 'HOLD' ? 'IN_CALL' : endState;
          this.agentStatusTracks.set(key, {
            lastStatus,
            lastReadyEnter: endState === 'READY' ? now.getTime() : null,
          });
        }
      }
      return restored.size;
    } catch (err: any) {
      this.logger.warn(`Metrics restoreIdleSeconds failed: ${err.message}`);
      return 0;
    }
  }

  /** If any tenant crossed its reporting boundary, rebuild period accumulators. */
  async ensureReportingWindows(now: Date = new Date()): Promise<boolean> {
    try {
      const tenantConfigs = await this.config.loadAll();
      const uids = new Set<number>([
        ...tenantConfigs.keys(),
        ...this.periodStartByTenant.keys(),
      ]);
      // Also watch tenants that have live accumulators but no settings row yet.
      for (const key of this.queueAccumulators.keys()) {
        const uid = Number(key.split(':')[0]);
        if (Number.isFinite(uid)) uids.add(uid);
      }

      let needsRestore = false;
      for (const uid of uids) {
        const entry = tenantConfigs.get(uid);
        const timezone = entry?.config.timezone ?? this.config.peekTenantConfig(uid).timezone;
        const expected = startOfReportingDay(this.shiftPolicyOf(entry), now, timezone).getTime();
        const current = this.periodStartByTenant.get(uid);
        if (current === undefined || current !== expected) {
          needsRestore = true;
          break;
        }
      }
      if (!needsRestore) return false;
      this.logger.log('Reporting-day boundary crossed — restoring period metrics');
      await this.restoreToday();
      return true;
    } catch (err: any) {
      this.logger.warn(`ensureReportingWindows failed: ${err.message}`);
      return false;
    }
  }

  /** Tenants without a cc_settings row use calendar days (null policy); others sanitize their stored policy. */
  private shiftPolicyOf(entry: TenantConfigEntry | undefined): ShiftPolicy | null {
    if (!entry?.hasSettings) return null;
    return sanitizeShiftPolicy(entry.rawShiftPolicy ?? null);
  }

  // ─── Private helpers ─────────────────────────────────────────────────────

  private queueKey(userUid: number, queueName: string): string {
    return `${userUid}:${queueName}`;
  }

  private agentKey(userUid: number, agentInterface: string): string {
    return `${userUid}:${agentInterface}`;
  }

  private agentQueueKey(userUid: number, agentInterface: string, queueName: string): string {
    return `${this.agentKey(userUid, agentInterface)}:${queueName}`;
  }

  /**
   * Which agent KPI counter a history row feeds.
   * - handled outbound/internal → made; handled inbound/personal → answered
   * - unanswered NON-queue rows (outbound no-answer, direct ring miss) → missed
   * - unanswered rows of real queues are caller outcomes (queue abandon), not agent misses;
   *   agent-level queue misses come from cc_agent_offers.
   */
  private agentKpiKind(row: Pick<CcQueueCall, 'queue_name' | 'direction' | 'disposition'>): keyof KpiCounters | null {
    const direction = row.direction || 'inbound';
    if (isHandledDisposition(row.disposition)) {
      return direction === 'outbound' || direction === 'internal' ? 'made' : 'answered';
    }
    if (isAbandonedDisposition(row.disposition) && !isQueueCallRow(row)) return 'missed';
    return null;
  }

  private emptyKpiCounters(): KpiCounters {
    return { answered: 0, made: 0, missed: 0 };
  }

  private emptyKpiAcc(): KpiAccumulator {
    return { sinceLogin: this.emptyKpiCounters(), sinceMidnight: this.emptyKpiCounters() };
  }

  private cloneKpiAcc(acc: KpiAccumulator): KpiAccumulator {
    return { sinceLogin: { ...acc.sinceLogin }, sinceMidnight: { ...acc.sinceMidnight } };
  }

  private getOrCreateKpiAcc(key: string): KpiAccumulator {
    let acc = this.kpiAccumulators.get(key);
    if (!acc) {
      acc = this.emptyKpiAcc();
      this.kpiAccumulators.set(key, acc);
    }
    return acc;
  }

  /** Apply a delta to one KPI counter. `dayOnly` is used by restoreToday (sinceLogin resets per-session only). */
  private applyKpiDelta(
    userUid: number,
    agentInterface: string,
    kind: keyof KpiCounters,
    scope: 'both' | 'dayOnly',
    queueName?: string,
  ): void {
    if (!agentInterface) return;
    const acc = this.getOrCreateKpiAcc(this.agentKey(userUid, agentInterface));
    if (scope === 'both') acc.sinceLogin[kind]++;
    acc.sinceMidnight[kind]++;
    if (queueName) {
      const qAcc = this.getOrCreateKpiAcc(this.agentQueueKey(userUid, agentInterface, queueName));
      if (scope === 'both') qAcc.sinceLogin[kind]++;
      qAcc.sinceMidnight[kind]++;
    }
  }

  private bumpKpi(userUid: number, agentInterface: string, kind: keyof KpiCounters, queueName?: string): void {
    this.applyKpiDelta(userUid, agentInterface, kind, 'both', queueName);
  }

  /** Rebuild-from-history variant (restoreToday) — only affects sinceMidnight. */
  private restoreKpi(userUid: number, agentInterface: string, kind: keyof KpiCounters, queueName?: string): void {
    this.applyKpiDelta(userUid, agentInterface, kind, 'dayOnly', queueName);
  }

  private emptyAgentAcc(): AgentAccumulator {
    return { talkSeconds: 0, wrapupSeconds: 0, idleSeconds: 0 };
  }

  private getOrCreateQueueAcc(userUid: number, queueName: string): QueueAccumulator {
    const key = this.queueKey(userUid, queueName);
    let acc = this.queueAccumulators.get(key);
    if (!acc) {
      acc = emptyQueueTotals();
      this.queueAccumulators.set(key, acc);
    }
    return acc;
  }

  private getOrCreateAgentAcc(userUid: number, agentInterface: string): AgentAccumulator {
    const key = this.agentKey(userUid, agentInterface);
    let acc = this.agentAccumulators.get(key);
    if (!acc) {
      acc = this.emptyAgentAcc();
      this.agentAccumulators.set(key, acc);
    }
    return acc;
  }

  private accumulateQueueRow(
    userUid: number,
    queueName: string,
    row: Pick<CcQueueCall, 'disposition'> & Partial<Pick<CcQueueCall, 'wait_time' | 'talk_time' | 'wrapup_time' | 'hold_time'>>,
  ): void {
    addQueueCall(
      this.getOrCreateQueueAcc(userUid, queueName),
      row,
      this.metricsConfigSync(userUid, queueName),
    );
  }
}
