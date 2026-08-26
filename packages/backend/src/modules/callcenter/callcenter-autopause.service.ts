/**
 * D-15: Auto-pause rule engine (RONA + configurable missed_count/idle_time/
 * status_duration rules). Evaluated from AMI state-update paths; time-based
 * rules (idle_time / status_duration) schedule real timers because AMI does
 * not re-emit the same status while an agent sits idle — waiting for a second
 * identical status event never fires in production.
 *
 * Master switch `autopause_enabled` gates the whole engine (RONA included).
 * Pausing reuses queuePause + stateService.setAgent (supervisorForcePause path).
 */
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { AmiService } from '../ami/ami.service';
import { CallCenterStateService, AgentStatus } from './callcenter-state.service';
import { CallCenterMetricsService } from './callcenter-metrics.service';
import { CcSettings } from './models/cc-settings.model';
import { CcAgentEvent } from './models/agent-event.model';
import { CcAgentSession } from './models/agent-session.model';
import { AutoPauseRule } from './models/cc-permissions.types';

/** Stable pause-reason codes stored in AgentState / cc_agent_events (UI localizes). */
export const AUTO_PAUSE_REASON = {
  RONA: 'auto_pause:rona',
  missed: (count: number) => `auto_pause:missed:${count}`,
  idle: (sec: number) => `auto_pause:idle:${sec}`,
  status: (status: string, sec: number) => `auto_pause:status:${status}:${sec}`,
} as const;

@Injectable()
export class CallCenterAutoPauseService implements OnModuleDestroy {
  private readonly logger = new Logger(CallCenterAutoPauseService.name);

  /** Consecutive-miss streak per agent (D-15 missed_count) — resets on any answered call or on firing. */
  private readonly missedCounts = new Map<string, number>();

  /** When the agent entered its current status (D-15 status_duration), per agent. */
  private readonly statusEnteredAt = new Map<string, { status: AgentStatus; at: number }>();

  /** Pending idle_time / status_duration timers keyed by agentKey. */
  private readonly pendingTimers = new Map<string, ReturnType<typeof setTimeout>>();

  /**
   * Open PAUSE events are journaled in cc_agent_events; duration is filled
   * when the agent leaves pause via CallCenterAmiService.endTimedStatus
   * (DB fallback for rows not tracked in AMI's in-memory journal map).
   */

  constructor(
    private readonly amiService: AmiService,
    private readonly stateService: CallCenterStateService,
    private readonly metricsService: CallCenterMetricsService,
    @InjectModel(CcSettings) private readonly settingsModel: typeof CcSettings,
    @InjectModel(CcAgentEvent) private readonly agentEventModel: typeof CcAgentEvent,
    @InjectModel(CcAgentSession) private readonly sessionModel: typeof CcAgentSession,
  ) {}

  onModuleDestroy(): void {
    for (const handle of this.pendingTimers.values()) {
      clearTimeout(handle);
    }
    this.pendingTimers.clear();
  }

  private agentKey(userUid: number, agentInterface: string): string {
    return `${userUid}:${agentInterface}`;
  }

  private clearTimer(key: string): void {
    const handle = this.pendingTimers.get(key);
    if (handle) {
      clearTimeout(handle);
      this.pendingTimers.delete(key);
    }
  }

  /**
   * Load tenant auto-pause config. Missing/null `autopause_enabled` → true
   * (preserves prior always-on RONA for rows created before the column existed).
   */
  private async getConfig(userUid: number): Promise<{ enabled: boolean; rules: AutoPauseRule[] }> {
    try {
      const settings = await this.settingsModel.findOne({ where: { user_uid: userUid } });
      const enabled = (settings as { autopause_enabled?: boolean | null } | null)?.autopause_enabled;
      return {
        enabled: enabled !== false,
        rules: (settings as { autopause_rules?: AutoPauseRule[] | null } | null)?.autopause_rules ?? [],
      };
    } catch (err: any) {
      this.logger.warn(`Failed to load autopause config for tenant ${userUid}: ${err.message}`);
      return { enabled: true, rules: [] };
    }
  }

  /** Same mechanics as CallCenterService.supervisorForcePause — never fork the pause path. */
  private async pauseAgent(
    userUid: number,
    agentInterface: string,
    queues: string[],
    reason: string,
  ): Promise<void> {
    this.clearTimer(this.agentKey(userUid, agentInterface));
    for (const q of queues) {
      try {
        await this.amiService.queuePause(q, agentInterface, true, reason);
      } catch (err: any) {
        this.logger.warn(`Auto-pause failed for ${agentInterface} in ${q}: ${err.message}`);
      }
    }
    this.stateService.setAgent(userUid, agentInterface, {
      status: 'PAUSED',
      pauseReason: reason,
      statusOrigin: 'policy',
      dialTarget: undefined,
      peerNumber: '',
    });
    this.metricsService.recordAgentStatus(userUid, agentInterface, 'PAUSED');
    await this.journalAutoPause(userUid, agentInterface, reason);
    this.logger.log(`Auto-paused ${agentInterface} (tenant ${userUid}): ${reason}`);
  }

  /** Persist PAUSE event so pause-report / timeline include auto-pauses. */
  private async journalAutoPause(
    userUid: number,
    agentInterface: string,
    reason: string,
  ): Promise<void> {
    const agent = this.stateService.getAgent(userUid, agentInterface);
    if (!agent?.userId) return;
    try {
      const session = await this.sessionModel.findOne({
        where: {
          user_id: agent.userId,
          agent_interface: agentInterface,
          logout_time: null,
        },
        order: [['login_time', 'DESC']],
      });
      if (!session) return;
      const sessionId = session.getDataValue('uid') as number;
      const row = await this.agentEventModel.create({
        session_id: sessionId,
        user_id: agent.userId,
        event_type: 'PAUSE',
        reason,
        call_uniqueid: '',
        caller_id: '',
        queue_name: '',
        duration: 0,
        user_uid: userUid,
      } as any);
      void row;
    } catch (err: any) {
      this.logger.warn(`Failed to journal auto-pause: ${err.message}`);
    }
  }

  /**
   * Schedule a one-shot pause. Cleared on any later status event for this agent.
   * `stillValid` re-checks live state when the timer fires (agent may have moved on).
   */
  private schedulePause(
    key: string,
    delayMs: number,
    stillValid: () => boolean,
    fire: () => Promise<void>,
  ): void {
    this.clearTimer(key);
    const run = () => {
      this.pendingTimers.delete(key);
      if (!stillValid()) return;
      void fire();
    };
    if (delayMs <= 0) {
      run();
      return;
    }
    const handle = setTimeout(run, delayMs);
    this.pendingTimers.set(key, handle);
  }

  /**
   * RONA for a specific agent after AgentRingNoAnswer (or abandon while ringing).
   * Does not require live status === RINGING — QueueMemberStatus often clears
   * RINGING to READY before our async evaluate runs.
   *
   * If a `missed_count` rule is configured, that threshold owns queue-miss
   * pausing — skip fixed RONA-at-1.
   */
  async evaluateRonaForAgent(
    userUid: number,
    agentInterface: string,
    queues: string[],
  ): Promise<void> {
    const { enabled, rules } = await this.getConfig(userUid);
    if (!enabled) return;
    if (rules.some((r) => r.type === 'missed_count')) return;

    await this.pauseAgent(userUid, agentInterface, queues, AUTO_PAUSE_REASON.RONA);
  }

  /**
   * RONA (D-15): agents still RINGING in the queue when the caller abandoned.
   * Prefer evaluateRonaForAgent from AgentRingNoAnswer (more reliable).
   */
  async evaluateRonaOnAbandon(userUid: number, queueName: string): Promise<void> {
    const { enabled, rules } = await this.getConfig(userUid);
    if (!enabled) return;
    if (rules.some((r) => r.type === 'missed_count')) return;

    const agents = this.stateService
      .getAllAgents(userUid)
      .filter((a) => a.status === 'RINGING' && a.queues.includes(queueName));

    for (const agent of agents) {
      await this.pauseAgent(userUid, agent.interface, agent.queues, AUTO_PAUSE_REASON.RONA);
    }
  }

  /** missed_count rule (D-15): configurable threshold on consecutive misses. */
  async evaluateOnMissed(userUid: number, agentInterface: string, queues: string[]): Promise<void> {
    const { enabled, rules } = await this.getConfig(userUid);
    if (!enabled) return;

    const key = this.agentKey(userUid, agentInterface);
    const count = (this.missedCounts.get(key) ?? 0) + 1;
    this.missedCounts.set(key, count);

    const rule = rules.find(
      (r): r is Extract<AutoPauseRule, { type: 'missed_count' }> => r.type === 'missed_count',
    );
    if (rule && count >= rule.threshold) {
      this.missedCounts.set(key, 0);
      await this.pauseAgent(
        userUid,
        agentInterface,
        queues,
        AUTO_PAUSE_REASON.missed(rule.threshold),
      );
    }
  }

  /**
   * idle_time / status_duration (D-15): on status change, schedule a timer for the
   * configured threshold. AMI does not re-emit the same status while the agent sits
   * in it — a second evaluate with elapsed wall-clock never arrives in production.
   */
  async evaluateOnStatusEvent(
    userUid: number,
    agentInterface: string,
    status: AgentStatus,
    queues: string[],
    lastCallTime?: Date,
  ): Promise<void> {
    const { enabled, rules } = await this.getConfig(userUid);
    const key = this.agentKey(userUid, agentInterface);

    // Any live call resets the missed-count streak (even when auto-pause is off).
    if (status === 'IN_CALL') {
      this.missedCounts.set(key, 0);
    }

    const prev = this.statusEnteredAt.get(key);
    const statusChanged = !prev || prev.status !== status;
    if (statusChanged) {
      this.statusEnteredAt.set(key, { status, at: Date.now() });
    }

    // Always cancel prior schedule on every status event (including same-status refresh).
    this.clearTimer(key);

    if (!enabled) return;

    const stillThisAgent = (expected: AgentStatus): boolean => {
      const agent = this.stateService.getAgent(userUid, agentInterface);
      return agent?.status === expected;
    };

    if (status === 'READY') {
      const idleRule = rules.find(
        (r): r is Extract<AutoPauseRule, { type: 'idle_time' }> => r.type === 'idle_time',
      );
      if (idleRule) {
        const since = lastCallTime?.getTime() ?? Date.now();
        const elapsedMs = Date.now() - since;
        const delayMs = idleRule.thresholdSec * 1000 - elapsedMs;
        this.schedulePause(
          key,
          delayMs,
          () => stillThisAgent('READY'),
          () =>
            this.pauseAgent(
              userUid,
              agentInterface,
              queues,
              AUTO_PAUSE_REASON.idle(idleRule.thresholdSec),
            ),
        );
        return;
      }
    }

    const durationRule = rules.find(
      (r): r is Extract<AutoPauseRule, { type: 'status_duration' }> =>
        r.type === 'status_duration' && r.status === status,
    );
    if (durationRule) {
      const enteredAt = this.statusEnteredAt.get(key)?.at ?? Date.now();
      const elapsedMs = Date.now() - enteredAt;
      const delayMs = durationRule.thresholdSec * 1000 - elapsedMs;
      this.schedulePause(
        key,
        delayMs,
        () => stillThisAgent(status),
        () =>
          this.pauseAgent(
            userUid,
            agentInterface,
            queues,
            AUTO_PAUSE_REASON.status(status, durationRule.thresholdSec),
          ),
      );
    }
  }
}
