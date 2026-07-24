/**
 * Call Center Metrics Engine — in-memory accumulators + §4.6 formulas.
 *
 * Real-time metrics read ONLY from memory (never DB in hot path).
 * restoreToday() rebuilds "today" accumulators from cc_queue_calls on startup (D-06).
 */
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { CcQueueCall } from './models/queue-call.model';
import { CcMissedCall } from './models/missed-call.model';
import { Queue } from '../queues/queue.model';
import type { AgentStatus } from './callcenter-state.service';

/** Industry-standard 80/20 default; tenant-level cc_settings override in 07-05. */
export const DEFAULT_SLA_THRESHOLD_SEC = 20;

export interface QueueAccumulator {
  offered: number;
  answered: number;
  answeredInSl: number;
  abandoned: number;
  sumWaitAnswered: number;
  sumTalkAnswered: number;
  sumWrapupAnswered: number;
}

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
  /** Restored from cc_queue_calls on startup — calendar-day counters. */
  sinceMidnight: KpiCounters;
}

export interface QueueMetrics {
  sla: number;
  asr: number;
  aht: number;
  asa: number;
  abandonRate: number;
  offered: number;
  answered: number;
  abandoned: number;
}

export interface TenantQueueMetrics extends QueueMetrics {
  queueName: string;
}

interface AgentStatusTrack {
  lastStatus: AgentStatus;
  lastReadyEnter: number | null;
}

@Injectable()
export class CallCenterMetricsService implements OnModuleInit {
  private readonly logger = new Logger(CallCenterMetricsService.name);

  private readonly queueAccumulators = new Map<string, QueueAccumulator>();
  private readonly agentAccumulators = new Map<string, AgentAccumulator>();
  private readonly slaThresholdCache = new Map<string, number>();
  private readonly agentStatusTracks = new Map<string, AgentStatusTrack>();

  /**
   * Dual shift/day answered·made·missed counters (D-11/D-12/D-31/D-32).
   * Key = `${userUid}:${agentInterface}` (agent-level) OR
   *       `${userUid}:${agentInterface}:${queueName}` (per-queue personal stats).
   */
  private readonly kpiAccumulators = new Map<string, KpiAccumulator>();

  constructor(
    @InjectModel(CcQueueCall) private readonly queueCallModel: typeof CcQueueCall,
    @InjectModel(CcMissedCall) private readonly missedCallModel: typeof CcMissedCall,
    @InjectModel(Queue) private readonly queueModel: typeof Queue,
  ) {}

  onModuleInit(): void {
    setTimeout(() => {
      void this.restoreToday();
    }, 500);
  }

  // ─── Formula methods (CALLCENTER_MODULE_PLAN §4.6) ───────────────────────

  computeSla(acc: QueueAccumulator): number {
    if (acc.offered === 0) return 0;
    return this.round1(acc.answeredInSl / acc.offered * 100);
  }

  computeAsr(acc: QueueAccumulator): number {
    if (acc.offered === 0) return 0;
    return this.round1(acc.answered / acc.offered * 100);
  }

  computeAht(acc: QueueAccumulator): number {
    if (acc.answered === 0) return 0;
    return this.round1((acc.sumTalkAnswered + acc.sumWrapupAnswered) / acc.answered);
  }

  computeAsa(acc: QueueAccumulator): number {
    if (acc.answered === 0) return 0;
    return this.round1(acc.sumWaitAnswered / acc.answered);
  }

  computeAbandonRate(acc: QueueAccumulator): number {
    if (acc.offered === 0) return 0;
    return this.round1(acc.abandoned / acc.offered * 100);
  }

  computeOccupancy(agentAcc: AgentAccumulator): number {
    const denom = agentAcc.talkSeconds + agentAcc.wrapupSeconds + agentAcc.idleSeconds;
    if (denom === 0) return 0;
    return this.round1((agentAcc.talkSeconds + agentAcc.wrapupSeconds) / denom * 100);
  }

  // ─── SLA threshold (D-07) ────────────────────────────────────────────────

  /** Sync read from cache; falls back to DEFAULT until ensureSlaThreshold populates cache. */
  getSlaThresholdSync(userUid: number, queueName: string): number {
    return this.slaThresholdCache.get(this.queueKey(userUid, queueName)) ?? DEFAULT_SLA_THRESHOLD_SEC;
  }

  async resolveSlaThreshold(userUid: number, queueName: string): Promise<number> {
    const key = this.queueKey(userUid, queueName);
    const cached = this.slaThresholdCache.get(key);
    if (cached !== undefined) return cached;

    const row = await this.queueModel.findOne({
      where: { name: queueName, user_uid: userUid },
      attributes: ['servicelevel'],
    });
    const level = row?.servicelevel;
    const threshold = level && level > 0 ? level : DEFAULT_SLA_THRESHOLD_SEC;
    this.slaThresholdCache.set(key, threshold);
    return threshold;
  }

  private async ensureSlaThreshold(userUid: number, queueName: string): Promise<void> {
    if (this.slaThresholdCache.has(this.queueKey(userUid, queueName))) return;
    await this.resolveSlaThreshold(userUid, queueName);
  }

  // ─── Public getters (in-memory only) ─────────────────────────────────────

  getQueueMetrics(userUid: number, queueName: string): QueueMetrics {
    const acc = this.queueAccumulators.get(this.queueKey(userUid, queueName)) ?? this.emptyQueueAcc();
    return this.buildQueueMetrics(acc);
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
          ...this.buildQueueMetrics(acc),
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
    const threshold = this.getSlaThresholdSync(userUid, queueName);
    this.accumulateQueueRow(userUid, queueName, 'answered', waitSec, talkSec, wrapupSec, threshold);

    if (agentInterface) {
      const agentAcc = this.getOrCreateAgentAcc(userUid, agentInterface);
      agentAcc.talkSeconds += talkSec;
      agentAcc.wrapupSeconds += wrapupSec;
      this.bumpKpi(userUid, agentInterface, 'answered', queueName);
    }

    void this.ensureSlaThreshold(userUid, queueName);
  }

  recordAbandoned(userUid: number, queueName: string): void {
    this.accumulateQueueRow(userUid, queueName, 'abandoned', 0, 0, 0, 0);
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
   * Personal/direct missed call — outbound dial that didn't answer, or a
   * direct inbound ring the agent never picked up (D-08/D-12). In-queue
   * Ring-No-Answer must never flow through here (D-10/D-20) — callers use
   * recordAbandoned for that.
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

  // ─── Restore from history (D-06) ─────────────────────────────────────────

  async restoreToday(): Promise<void> {
    try {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);

      const rows = await this.queueCallModel.findAll({
        where: { created_at: { [Op.gte]: startOfToday } },
      });

      this.queueAccumulators.clear();
      this.agentAccumulators.clear();
      this.agentStatusTracks.clear();
      this.kpiAccumulators.clear();

      const thresholdPromises = new Map<string, Promise<number>>();

      for (const row of rows) {
        const userUid = row.user_uid;
        const queueName = row.queue_name;
        const cacheKey = this.queueKey(userUid, queueName);

        if (!thresholdPromises.has(cacheKey)) {
          thresholdPromises.set(cacheKey, this.resolveSlaThreshold(userUid, queueName));
        }
        const threshold = await thresholdPromises.get(cacheKey)!;

        this.accumulateQueueRow(
          userUid,
          queueName,
          row.disposition,
          row.wait_time,
          row.talk_time,
          row.wrapup_time,
          threshold,
        );

        if (row.agent_interface) {
          // D-34/D-35: rows may now carry non-queue direction (outbound/personal/internal).
          // Missing direction defaults to 'inbound' — matches the column's DB default and
          // keeps pre-existing rows/tests (which never set it) behaving exactly as before.
          const direction = row.direction || 'inbound';
          if (this.isAnsweredDisposition(row.disposition)) {
            const agentAcc = this.getOrCreateAgentAcc(userUid, row.agent_interface);
            agentAcc.talkSeconds += row.talk_time;
            agentAcc.wrapupSeconds += row.wrapup_time;
            if (direction === 'outbound') {
              this.restoreKpi(userUid, row.agent_interface, 'made');
            } else {
              this.restoreKpi(userUid, row.agent_interface, 'answered', queueName);
            }
          } else if (row.disposition === 'abandoned' && direction !== 'inbound') {
            // Personal/outbound miss only — in-queue Ring-No-Answer (direction 'inbound')
            // must never be restored as a personal missed call (D-10/D-20).
            this.restoreKpi(userUid, row.agent_interface, 'missed');
          }
        }
        // idleSeconds NOT restored — accumulates from module start only (Occupancy partial after restart).
      }

      // Personal missed-call worklist rows (direct:<interface>) — day KPI after restart.
      const personalMissed = await this.missedCallModel.findAll({
        where: {
          created_at: { [Op.gte]: startOfToday },
          personal: true,
        },
      });
      for (const row of personalMissed) {
        const q = row.queue_name || '';
        if (!q.startsWith('direct:')) continue;
        const agentInterface = q.slice('direct:'.length);
        if (!agentInterface) continue;
        this.restoreKpi(row.user_uid, agentInterface, 'missed');
      }

      this.logger.log(
        `Metrics restoreToday: ${rows.length} cc_queue_calls + ${personalMissed.length} personal missed`,
      );
    } catch (err: any) {
      this.logger.error(`Metrics restoreToday failed: ${err.message}`);
    }
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

  private emptyQueueAcc(): QueueAccumulator {
    return {
      offered: 0,
      answered: 0,
      answeredInSl: 0,
      abandoned: 0,
      sumWaitAnswered: 0,
      sumTalkAnswered: 0,
      sumWrapupAnswered: 0,
    };
  }

  private emptyAgentAcc(): AgentAccumulator {
    return { talkSeconds: 0, wrapupSeconds: 0, idleSeconds: 0 };
  }

  private getOrCreateQueueAcc(userUid: number, queueName: string): QueueAccumulator {
    const key = this.queueKey(userUid, queueName);
    let acc = this.queueAccumulators.get(key);
    if (!acc) {
      acc = this.emptyQueueAcc();
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

  private isAnsweredDisposition(disposition: string): boolean {
    return disposition === 'answered' || disposition === 'transferred';
  }

  private isAbandonedDisposition(disposition: string): boolean {
    return disposition === 'abandoned' || disposition === 'timeout';
  }

  private accumulateQueueRow(
    userUid: number,
    queueName: string,
    disposition: string,
    waitSec: number,
    talkSec: number,
    wrapupSec: number,
    slaThreshold: number,
  ): void {
    const acc = this.getOrCreateQueueAcc(userUid, queueName);
    acc.offered++;

    if (this.isAnsweredDisposition(disposition)) {
      acc.answered++;
      acc.sumWaitAnswered += waitSec;
      acc.sumTalkAnswered += talkSec;
      acc.sumWrapupAnswered += wrapupSec;
      if (waitSec <= slaThreshold) {
        acc.answeredInSl++;
      }
    } else if (this.isAbandonedDisposition(disposition)) {
      acc.abandoned++;
    }
  }

  private buildQueueMetrics(acc: QueueAccumulator): QueueMetrics {
    return {
      sla: this.computeSla(acc),
      asr: this.computeAsr(acc),
      aht: this.computeAht(acc),
      asa: this.computeAsa(acc),
      abandonRate: this.computeAbandonRate(acc),
      offered: acc.offered,
      answered: acc.answered,
      abandoned: acc.abandoned,
    };
  }

  private round1(value: number): number {
    return Math.round(value * 10) / 10;
  }
}
