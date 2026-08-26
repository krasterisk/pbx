/**
 * Hydrate open cc_agent_sessions into CallCenterStateService after Nest / AMI restart.
 */
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { ModuleRef } from '@nestjs/core';
import { CallCenterStateService, type AgentStatus } from './callcenter-state.service';
import { CallCenterMetricsService } from './callcenter-metrics.service';
import { CallCenterSettingsService } from './callcenter-settings.service';
import { type AgentStatusOrigin } from './status-origin';
import { CcAgentSession } from './models/agent-session.model';
import { User } from '../users/user.model';

const TRANSIENT: AgentStatus[] = [
  'IN_CALL',
  'RINGING',
  'DIALING',
  'CONSULT',
  'WRAPUP',
  'ACW',
];

@Injectable()
export class CallCenterShiftRestoreService implements OnModuleInit {
  private readonly logger = new Logger(CallCenterShiftRestoreService.name);

  constructor(
    private readonly stateService: CallCenterStateService,
    private readonly metricsService: CallCenterMetricsService,
    private readonly settingsService: CallCenterSettingsService,
    private readonly moduleRef: ModuleRef,
    @InjectModel(CcAgentSession) private readonly sessionModel: typeof CcAgentSession,
    @InjectModel(User) private readonly userModel: typeof User,
  ) {}

  onModuleInit(): void {
    // Safety net if AMI preload never calls us (AMI down).
    setTimeout(() => {
      void this.restoreAllOpenSessions().catch((err) => {
        this.logger.warn(`Deferred shift restore failed: ${err?.message || err}`);
      });
    }, 8000);
  }

  /** Idempotent hydrate of every open session into RAM. */
  async restoreAllOpenSessions(): Promise<number> {
    const sessions = await this.sessionModel.findAll({
      where: { logout_time: null },
      order: [['login_time', 'ASC']],
    });
    let n = 0;
    for (const session of sessions) {
      try {
        await this.restoreSession(session);
        n += 1;
      } catch (err: any) {
        this.logger.warn(
          `Failed to restore session ${session.uid}: ${err?.message || err}`,
        );
      }
    }
    this.logger.log(`Shift restore: hydrated ${n}/${sessions.length} open session(s)`);
    return n;
  }

  async restoreSessionByUserId(userId: number): Promise<boolean> {
    const session = await this.sessionModel.findOne({
      where: { user_id: userId, logout_time: null },
      order: [['login_time', 'DESC']],
    });
    if (!session) return false;
    await this.restoreSession(session);
    return true;
  }

  async restoreSession(session: CcAgentSession): Promise<void> {
    const userId = Number(session.user_id);
    const stateUid = Number(session.user_uid);
    const iface = session.agent_interface;
    if (!userId || !iface) return;

    const existing =
      this.stateService.getAgent(stateUid, iface)
      || this.stateService.getAllAgentsGlobal().find(
        (a) => a.userId === userId || a.interface === iface,
      );

    const snap = (session.getDataValue('queues_snapshot') as string[] | null) || [];
    const amiQueues = existing?.queues || [];
    const queues = [...new Set([...snap, ...amiQueues])];
    // Membership gaps are healed by AMI auto QueueAdd — do not surface a detached status.

    let status = this.normalizeStatus(
      (existing?.status as AgentStatus | undefined)
      || (session.last_status as AgentStatus | null)
      || 'READY',
      existing,
    );

    // Asterisk pause takes priority over DB snapshot.
    if (existing?.status === 'PAUSED' || existing?.status === 'OUTBOUND_WORK') {
      status = existing.status;
    } else if (
      existing
      && (existing.status === 'IN_CALL' || existing.status === 'RINGING' || existing.status === 'DIALING')
    ) {
      status = existing.status;
    }

    let displayName = existing?.name || iface;
    try {
      const user = await this.userModel.findOne({ where: { uniqueid: userId } });
      if (user) {
        displayName =
          String(user.getDataValue('name') || '').trim()
          || String(user.getDataValue('login') || '').trim()
          || displayName;
      }
    } catch { /* ignore */ }

    let wrapupTimeout: number | undefined;
    let wrapupExtendStep: number | undefined;
    let wrapupAutosaveDraft: boolean | undefined;
    try {
      const settings = await this.settingsService.getOperatorSettings(stateUid, userId);
      wrapupTimeout = settings.wrapup_timeout;
      wrapupExtendStep = settings.wrapup_extend_step;
      wrapupAutosaveDraft = settings.wrapup_autosave_draft;
    } catch { /* ignore */ }

    // Never fall back to AMI preload statusSince — it is stamped at Nest boot and
    // makes the UI timer look like "a few hours" after an overnight status.
    const statusSince = session.last_status_at
      ? new Date(session.last_status_at)
      : session.login_time
        ? new Date(session.login_time)
        : new Date();

    const rawOrigin = session.last_status_origin as AgentStatusOrigin | null;
    // Legacy null → restore (pre-origin rows). Explicit ami/unknown stays untrusted.
    const statusOrigin: AgentStatusOrigin = !rawOrigin
      ? 'restore'
      : (rawOrigin as AgentStatusOrigin);

    this.stateService.setAgent(stateUid, iface, {
      userId,
      name: displayName,
      status,
      statusOrigin,
      pauseReason: session.pause_reason || existing?.pauseReason || undefined,
      queues: queues.length ? queues : (existing?.queues || []),
      loginTime: session.login_time || existing?.loginTime || new Date(),
      statusSince,
      queuesDetached: false,
      wrapupTimeout,
      wrapupExtendStep,
      wrapupAutosaveDraft,
      callsTaken: existing?.callsTaken ?? 0,
      callsMissed: existing?.callsMissed ?? 0,
      callsMade: existing?.callsMade ?? 0,
    });

    // Backfill missing snapshot so later Nest restarts keep the same clock.
    if (!session.last_status_at || !session.last_status_origin) {
      try {
        await this.sessionModel.update(
          {
            last_status: status,
            last_status_at: statusSince,
            last_status_origin: statusOrigin,
            pause_reason: session.pause_reason || existing?.pauseReason || null,
          },
          { where: { uid: session.uid, logout_time: null } },
        );
      } catch { /* ignore */ }
    }

    try {
      const rebuilt = await this.metricsService.rebuildSinceLoginFromHistory({
        userUid: stateUid,
        agentInterface: iface,
        operatorUserId: userId,
        loginTime: session.login_time instanceof Date
          ? session.login_time
          : new Date(session.login_time),
      });
      this.stateService.setAgent(stateUid, iface, {
        callsTaken: rebuilt.answered,
        callsMade: rebuilt.made,
        callsMissed: rebuilt.missed,
      });
    } catch { /* ignore */ }

    try {
      const cc = this.moduleRef.get('CallCenterService', { strict: false }) as {
        bindActiveSession?: (u: number, id: number, sid: number) => void;
      } | null;
      cc?.bindActiveSession?.(stateUid, userId, session.uid);
    } catch { /* ignore */ }
  }

  private normalizeStatus(
    status: AgentStatus,
    existing: { currentCall?: string; status?: AgentStatus } | undefined,
  ): AgentStatus {
    if (TRANSIENT.includes(status)) {
      if (existing?.currentCall) return status;
      // No live channel after restart → READY (or keep PAUSED if that was AMI).
      return 'READY';
    }
    if (status === 'OFFLINE') return 'READY';
    return status;
  }
}
