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

  constructor(
    @InjectModel(CcQueueCall) private readonly queueCallModel: typeof CcQueueCall,
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
    }

    void this.ensureSlaThreshold(userUid, queueName);
  }

  recordAbandoned(userUid: number, queueName: string): void {
    this.accumulateQueueRow(userUid, queueName, 'abandoned', 0, 0, 0, 0);
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

        if (row.agent_interface && this.isAnsweredDisposition(row.disposition)) {
          const agentAcc = this.getOrCreateAgentAcc(userUid, row.agent_interface);
          agentAcc.talkSeconds += row.talk_time;
          agentAcc.wrapupSeconds += row.wrapup_time;
        }
        // idleSeconds NOT restored — accumulates from module start only (Occupancy partial after restart).
      }

      this.logger.log(`Metrics restoreToday: ${rows.length} cc_queue_calls rows loaded`);
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
