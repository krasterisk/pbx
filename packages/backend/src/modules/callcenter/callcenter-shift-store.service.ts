/**
 * Debounced write-through of agent status / queues into open cc_agent_sessions.
 * Subscribes to in-memory agentUpdate events so setAgent call sites stay untouched.
 */
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Subscription } from 'rxjs';
import { CallCenterStateService } from './callcenter-state.service';
import { CcAgentSession } from './models/agent-session.model';

const DEBOUNCE_MS = 1000;

@Injectable()
export class CallCenterShiftStoreService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CallCenterShiftStoreService.name);
  private sub: Subscription | null = null;
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(
    private readonly stateService: CallCenterStateService,
    @InjectModel(CcAgentSession) private readonly sessionModel: typeof CcAgentSession,
  ) {}

  onModuleInit(): void {
    this.sub = this.stateService.getAllEventStream().subscribe((event) => {
      if (event.type !== 'agentUpdate') return;
      const data = event.data;
      if (!data || data.removed) return;
      const userId = Number(data.userId || 0);
      if (!userId) return;
      const iface = String(data.interface || '');
      if (!iface) return;
      this.schedulePersist(userId, iface, data);
    });
  }

  onModuleDestroy(): void {
    this.sub?.unsubscribe();
    this.sub = null;
    for (const t of this.timers.values()) clearTimeout(t);
    this.timers.clear();
  }

  private schedulePersist(userId: number, iface: string, data: any): void {
    const key = `${userId}:${iface}`;
    const prev = this.timers.get(key);
    if (prev) clearTimeout(prev);
    this.timers.set(
      key,
      setTimeout(() => {
        this.timers.delete(key);
        void this.persist(userId, iface, data);
      }, DEBOUNCE_MS),
    );
  }

  private async persist(userId: number, iface: string, data: any): Promise<void> {
    try {
      const patch: Record<string, unknown> = {
        last_status: data.status || null,
        pause_reason: data.pauseReason || null,
        last_status_origin: data.statusOrigin || null,
      };
      // Only advance last_status_at from a real server stamp — never Date.now()
      // fallback (that rewrote overnight timers after every agentUpdate).
      if (data.statusSince) {
        patch.last_status_at = new Date(data.statusSince);
      }
      if (Array.isArray(data.queues)) {
        patch.queues_snapshot = data.queues;
      }
      const [n] = await this.sessionModel.update(patch, {
        where: {
          user_id: userId,
          agent_interface: iface,
          logout_time: null,
        },
      });
      if (!n) {
        // Interface may have drifted (twin) — update by user_id only.
        await this.sessionModel.update(patch, {
          where: { user_id: userId, logout_time: null },
        });
      }
    } catch (err: any) {
      this.logger.warn(`shift snapshot persist failed: ${err?.message || err}`);
    }
  }
}
