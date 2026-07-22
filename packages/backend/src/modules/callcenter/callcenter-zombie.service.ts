/**
 * Zombie-call reconciler (D-27/D-28).
 *
 * Periodically diffs the in-memory CallCenterStateService active-call set
 * against a live CoreShowChannels poll. A call becomes a *candidate* zombie
 * once none of its known Asterisk channels (callerChannel/agentChannel)
 * appear in CoreShowChannels for longer than ZOMBIE_GRACE_PERIOD_MS.
 *
 * This service only FLAGS candidates — it never auto-hangs a channel. The
 * actual destructive reset stays operator-triggered (D-27,
 * CallCenterService.resetZombieCall), exactly like agentHangup already
 * requires an explicit self-serve action.
 *
 * Threshold: fixed conservative 10-minute floor. [ASSUMED — no live-Asterisk
 * -verified heuristic exists in this repo yet; see 09-RESEARCH.md Pitfall 3 /
 * Open Question #2. Flagged for the 09-VALIDATION manual check.]
 * Polling cadence: 45s (within the plan's 30-60s window).
 */
import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { AmiService } from '../ami/ami.service';
import { CallCenterStateService } from './callcenter-state.service';

/** [ASSUMED] conservative fixed floor — document any future tenant-configurable override here. */
export const ZOMBIE_GRACE_PERIOD_MS = 10 * 60 * 1000;
export const ZOMBIE_POLL_INTERVAL_MS = 45 * 1000;

@Injectable()
export class CallCenterZombieService {
  private readonly logger = new Logger(CallCenterZombieService.name);

  /** uniqueid -> epoch ms of the first poll where none of its channels were live. */
  private readonly missingSince = new Map<string, number>();

  constructor(
    private readonly amiService: AmiService,
    private readonly stateService: CallCenterStateService,
  ) {}

  @Interval(ZOMBIE_POLL_INTERVAL_MS)
  async poll(): Promise<void> {
    try {
      await this.checkOnce();
    } catch (err: any) {
      this.logger.warn(`[zombie] poll failed: ${err.message}`);
    }
  }

  /** One reconciliation pass — extracted from poll() so specs can drive it without timers. */
  async checkOnce(): Promise<void> {
    if (!this.amiService.isConnected()) return;

    const { events } = await this.amiService.getActiveChannels();
    const liveChannels = new Set<string>();
    for (const evt of events || []) {
      if (evt?.channel) liveChannels.add(evt.channel);
    }

    const now = Date.now();
    const calls = this.stateService.getAllCallsGlobal();
    const stillTracked = new Set<string>();

    for (const call of calls) {
      stillTracked.add(call.uniqueid);
      const channels = [call.callerChannel, call.agentChannel].filter(Boolean) as string[];
      // No known channel yet (still WAITING) — nothing to verify against CoreShowChannels.
      const anyLive = channels.length === 0 || channels.some((ch) => liveChannels.has(ch));

      if (anyLive) {
        this.missingSince.delete(call.uniqueid);
        if (call.zombieCandidate) {
          this.stateService.setCall(call.uniqueid, { zombieCandidate: false });
        }
        continue;
      }

      const firstMissingAt = this.missingSince.get(call.uniqueid);
      if (firstMissingAt == null) {
        this.missingSince.set(call.uniqueid, now);
        continue;
      }

      if (!call.zombieCandidate && now - firstMissingAt >= ZOMBIE_GRACE_PERIOD_MS) {
        this.stateService.setCall(call.uniqueid, { zombieCandidate: true });
        this.logger.warn(
          `[zombie] flagged candidate uniqueid=${call.uniqueid} channels=${channels.join(',')}`,
        );
      }
    }

    // Drop bookkeeping for calls already removed from state (normal Hangup/AgentComplete cleanup).
    for (const uid of this.missingSince.keys()) {
      if (!stillTracked.has(uid)) this.missingSince.delete(uid);
    }
  }
}
