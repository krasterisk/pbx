/**
 * D-15: Auto-pause rule engine (RONA + configurable missed_count/idle_time/
 * status_duration rules), evaluated from the existing AMI state-update path
 * (CallCenterAmiService.handleCallerAbandon/handleAgentStatusEvent/handleDialEnd/
 * handleAgentHangup call sites — RESEARCH Pitfall 7). Rules are modelled as one
 * typed union stored as JSON on cc_settings.autopause_rules — no per-type columns,
 * so a new rule type never needs a migration. Pausing reuses the exact
 * queuePause + stateService.setAgent mechanics as CallCenterService.supervisorForcePause
 * (no forked pause path).
 */
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { AmiService } from '../ami/ami.service';
import { CallCenterStateService, AgentStatus } from './callcenter-state.service';
import { CallCenterMetricsService } from './callcenter-metrics.service';
import { CcSettings } from './models/cc-settings.model';
import { AutoPauseRule } from './models/cc-permissions.types';

@Injectable()
export class CallCenterAutoPauseService {
  private readonly logger = new Logger(CallCenterAutoPauseService.name);

  /** Consecutive-miss streak per agent (D-15 missed_count) — resets on any answered call or on firing. */
  private readonly missedCounts = new Map<string, number>();

  /** When the agent entered its current status (D-15 status_duration), per agent. */
  private readonly statusEnteredAt = new Map<string, { status: AgentStatus; at: number }>();

  constructor(
    private readonly amiService: AmiService,
    private readonly stateService: CallCenterStateService,
    private readonly metricsService: CallCenterMetricsService,
    @InjectModel(CcSettings) private readonly settingsModel: typeof CcSettings,
  ) {}

  private agentKey(userUid: number, agentInterface: string): string {
    return `${userUid}:${agentInterface}`;
  }

  private async getRules(userUid: number): Promise<AutoPauseRule[]> {
    try {
      const settings = await this.settingsModel.findOne({ where: { user_uid: userUid } });
      return (settings as any)?.autopause_rules ?? [];
    } catch (err: any) {
      this.logger.warn(`Failed to load autopause_rules for tenant ${userUid}: ${err.message}`);
      return [];
    }
  }

  /** Same mechanics as CallCenterService.supervisorForcePause — never fork the pause path. */
  private async pauseAgent(
    userUid: number,
    agentInterface: string,
    queues: string[],
    reason: string,
  ): Promise<void> {
    for (const q of queues) {
      try {
        await this.amiService.queuePause(q, agentInterface, true, reason);
      } catch (err: any) {
        this.logger.warn(`Auto-pause failed for ${agentInterface} in ${q}: ${err.message}`);
      }
    }
    this.stateService.setAgent(userUid, agentInterface, { status: 'PAUSED', pauseReason: reason });
    this.metricsService.recordAgentStatus(userUid, agentInterface, 'PAUSED');
    this.logger.log(`Auto-paused ${agentInterface} (tenant ${userUid}): ${reason}`);
  }

  /**
   * RONA (D-15): fixed, always-on trigger — agents still RINGING in the queue
   * when the caller abandoned did not answer in time.
   */
  async evaluateRonaOnAbandon(userUid: number, queueName: string): Promise<void> {
    const agents = this.stateService
      .getAllAgents(userUid)
      .filter((a) => a.status === 'RINGING' && a.queues.includes(queueName));

    for (const agent of agents) {
      await this.pauseAgent(userUid, agent.interface, agent.queues, 'RONA (ring-no-answer)');
    }
  }

  /** missed_count rule (D-15): configurable threshold on consecutive misses. */
  async evaluateOnMissed(userUid: number, agentInterface: string, queues: string[]): Promise<void> {
    const key = this.agentKey(userUid, agentInterface);
    const count = (this.missedCounts.get(key) ?? 0) + 1;
    this.missedCounts.set(key, count);

    const rules = await this.getRules(userUid);
    const rule = rules.find(
      (r): r is Extract<AutoPauseRule, { type: 'missed_count' }> => r.type === 'missed_count',
    );
    if (rule && count >= rule.threshold) {
      this.missedCounts.set(key, 0);
      await this.pauseAgent(userUid, agentInterface, queues, `Auto-pause: ${rule.threshold} missed calls`);
    }
  }

  /**
   * idle_time / status_duration rules (D-15): evaluated on every status
   * transition — mirrors the AMI event cadence, no separate polling timer.
   */
  async evaluateOnStatusEvent(
    userUid: number,
    agentInterface: string,
    status: AgentStatus,
    queues: string[],
    lastCallTime?: Date,
  ): Promise<void> {
    const key = this.agentKey(userUid, agentInterface);

    // Any live call resets the missed-count streak.
    if (status === 'IN_CALL') {
      this.missedCounts.set(key, 0);
    }

    const prev = this.statusEnteredAt.get(key);
    if (!prev || prev.status !== status) {
      this.statusEnteredAt.set(key, { status, at: Date.now() });
    }

    const rules = await this.getRules(userUid);

    if (status === 'READY' && lastCallTime) {
      const idleRule = rules.find(
        (r): r is Extract<AutoPauseRule, { type: 'idle_time' }> => r.type === 'idle_time',
      );
      if (idleRule) {
        const idleSec = (Date.now() - lastCallTime.getTime()) / 1000;
        if (idleSec >= idleRule.thresholdSec) {
          await this.pauseAgent(userUid, agentInterface, queues, `Auto-pause: idle ${idleRule.thresholdSec}s`);
          return;
        }
      }
    }

    const durationRule = rules.find(
      (r): r is Extract<AutoPauseRule, { type: 'status_duration' }> =>
        r.type === 'status_duration' && r.status === status,
    );
    if (durationRule) {
      const enteredAt = this.statusEnteredAt.get(key)?.at ?? Date.now();
      const durationSec = (Date.now() - enteredAt) / 1000;
      if (durationSec >= durationRule.thresholdSec) {
        await this.pauseAgent(userUid, agentInterface, queues, `Auto-pause: ${status} > ${durationRule.thresholdSec}s`);
      }
    }
  }
}
