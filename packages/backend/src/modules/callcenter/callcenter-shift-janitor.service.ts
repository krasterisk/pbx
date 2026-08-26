/**
 * Periodically closes open shifts per tenant shift_policy
 * (max duration / end-of-day / panel idle).
 */
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/sequelize';
import { ModuleRef } from '@nestjs/core';
import { CcAgentSession } from './models/agent-session.model';
import { CcSettings } from './models/cc-settings.model';
import {
  DEFAULT_SHIFT_POLICY,
  type ShiftCloseReason,
  type ShiftPolicy,
} from './models/shift-policy.types';
import { CallCenterSettingsService, sanitizeShiftPolicy } from './callcenter-settings.service';
import { CallCenterPresenceService } from './callcenter-presence.service';
import { interfaceToExtension } from '../endpoints/endpoint-ids.util';

@Injectable()
export class CallCenterShiftJanitorService {
  private readonly logger = new Logger(CallCenterShiftJanitorService.name);
  private running = false;

  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly settingsService: CallCenterSettingsService,
    private readonly presenceService: CallCenterPresenceService,
    @InjectModel(CcAgentSession) private readonly sessionModel: typeof CcAgentSession,
    @InjectModel(CcSettings) private readonly settingsModel: typeof CcSettings,
  ) {}

  @Cron('*/5 * * * *')
  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.runOnce();
    } catch (err: any) {
      this.logger.warn(`shift janitor failed: ${err?.message || err}`);
    } finally {
      this.running = false;
    }
  }

  async runOnce(): Promise<number> {
    const open = await this.sessionModel.findAll({
      where: { logout_time: null },
    });
    if (!open.length) return 0;

    const policyByTenant = new Map<number, ShiftPolicy>();
    let closed = 0;

    for (const session of open) {
      const tenant = Number(session.user_uid);
      let policy = policyByTenant.get(tenant);
      if (!policy) {
        const row = await this.settingsModel.findOne({ where: { user_uid: tenant } });
        policy = sanitizeShiftPolicy(
          (row?.shift_policy as unknown as Record<string, unknown>) ?? null,
          DEFAULT_SHIFT_POLICY,
        );
        policyByTenant.set(tenant, policy);
      }

      const reason = this.evaluate(session, policy, tenant);
      if (!reason) continue;

      try {
        const cc = this.moduleRef.get('CallCenterService', { strict: false }) as {
          endShift: (o: {
            userUid: number;
            userId: number;
            agentInterface?: string;
            sessionId?: number;
            reason: ShiftCloseReason;
            freeExten?: boolean;
          }) => Promise<unknown>;
        };
        await cc.endShift({
          userUid: tenant,
          userId: Number(session.user_id),
          agentInterface: session.agent_interface,
          sessionId: session.uid,
          reason,
          freeExten: policy.free_exten_on_close,
        });
        closed += 1;
      } catch (err: any) {
        this.logger.warn(
          `janitor endShift session=${session.uid}: ${err?.message || err}`,
        );
      }
    }

    if (closed > 0) {
      this.logger.log(`Shift janitor closed ${closed} session(s)`);
    }
    return closed;
  }

  private evaluate(
    session: CcAgentSession,
    policy: ShiftPolicy,
    tenant: number,
  ): ShiftCloseReason | null {
    const now = Date.now();
    const login = session.login_time
      ? new Date(session.login_time).getTime()
      : now;

    if (policy.max_duration_min > 0) {
      const maxMs = policy.max_duration_min * 60_000;
      if (now - login >= maxMs) return 'SYSTEM_MAX_DURATION';
    }

    if (policy.close_at_eod && policy.eod_time) {
      const [hh, mm] = policy.eod_time.split(':').map(Number);
      if (Number.isFinite(hh) && Number.isFinite(mm)) {
        const eod = new Date();
        eod.setHours(hh, mm, 0, 0);
        // Close if login was before today's EOD and now is past EOD.
        if (now >= eod.getTime() && login < eod.getTime()) {
          return 'SYSTEM_EOD';
        }
      }
    }

    if (policy.idle_timeout_min > 0) {
      const userId = Number(session.user_id);
      try {
        const cc = this.moduleRef.get('CallCenterService', { strict: false }) as {
          getPanelConnectionCount?: (id: number) => number;
        };
        if ((cc.getPanelConnectionCount?.(userId) || 0) > 0) {
          return null;
        }
      } catch { /* ignore */ }

      const seen = session.panel_seen_at
        ? new Date(session.panel_seen_at).getTime()
        : login;
      const idleMs = policy.idle_timeout_min * 60_000;
      if (now - seen >= idleMs) {
        if (policy.idle_requires_unregistered) {
          const ext = interfaceToExtension(session.agent_interface);
          const state = this.presenceService.getPresence(tenant, ext);
          const registered = this.isRegistered(state);
          if (registered) return null;
        }
        return 'SYSTEM_IDLE';
      }
    }

    return null;
  }

  private isRegistered(state: string | undefined): boolean {
    if (!state) return false;
    const s = state.toLowerCase();
    if (s.includes('unavailable') || s.includes('invalid') || s === '0') return false;
    if (s.includes('not in use') || s.includes('in use') || s.includes('busy') || s.includes('ring')) {
      return true;
    }
    // Numeric ExtensionState: 0=Idle often still means registered in some setups;
    // treat empty/unknown as unregistered for safety when idle_requires_unregistered.
    return s === 'not_inuse' || s === 'inuse' || s === 'busy' || s === 'ringing';
  }
}
