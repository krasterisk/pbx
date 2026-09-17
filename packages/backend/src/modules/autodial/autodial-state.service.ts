import { Injectable, Logger } from '@nestjs/common';
import { Subject, type Observable } from 'rxjs';
import type { AutodialCampaignStatus, AutodialDisposition } from '@krasterisk/shared';
import {
  observedAbandonPct,
  pushObservation,
  type PredictiveObservation,
} from './autodial-predictive.util';

export interface AutodialLiveChannel {
  channelId: string;
  campaignUid: number;
  taskUid: number;
  attemptUid: number;
  attemptNo: number;
  userUid: number;
  number: string;
  trunkId: string;
  startedAt: number;
  answeredAt: number | null;
}

export interface AutodialCampaignRuntime {
  campaignUid: number;
  userUid: number;
  status: AutodialCampaignStatus;
  capacity: number;
  limitedBy: string;
  reserved: number;
  dials: number;
  answered: number;
  success: number;
  /** Predictive only: current over-dial multiplier and the rate driving it */
  overDial?: number;
  abandonPct?: number;
}

export type AutodialSseEvent =
  | { type: 'snapshot'; campaigns: AutodialCampaignRuntime[]; channels: AutodialLiveChannel[] }
  | { type: 'channel_started'; channel: AutodialLiveChannel }
  | { type: 'channel_answered'; channelId: string; campaignUid: number }
  | {
      type: 'channel_ended';
      channelId: string;
      campaignUid: number;
      disposition: AutodialDisposition;
    }
  | { type: 'campaign_stats'; runtime: AutodialCampaignRuntime }
  | {
      type: 'pacer';
      campaignUid: number;
      capacity: number;
      limitedBy: string;
      reserved: number;
      overDial?: number;
      abandonPct?: number;
    };

/**
 * In-memory live state for the dialer, mirroring the CallCenterStateService
 * pattern. Everything here is rebuildable: on restart the reconciler closes
 * orphaned attempts and the pacer warms up from an empty picture.
 */
@Injectable()
export class AutodialStateService {
  private readonly logger = new Logger(AutodialStateService.name);
  private readonly channels = new Map<string, AutodialLiveChannel>();
  private readonly runtimes = new Map<number, AutodialCampaignRuntime>();
  private readonly streams = new Map<number, Subject<AutodialSseEvent>>();
  /** Rolling abandon window per campaign, read by the predictive controller. */
  private readonly observations = new Map<number, PredictiveObservation>();

  // ── channels ──────────────────────────────────────────────────────

  addChannel(channel: AutodialLiveChannel): void {
    this.channels.set(channel.channelId, channel);
    const runtime = this.ensureRuntime(channel.userUid, channel.campaignUid);
    runtime.dials += 1;
    this.emit(channel.userUid, { type: 'channel_started', channel });
  }

  markAnswered(channelId: string): AutodialLiveChannel | undefined {
    const channel = this.channels.get(channelId);
    if (!channel || channel.answeredAt) return channel;
    channel.answeredAt = Date.now();
    const runtime = this.ensureRuntime(channel.userUid, channel.campaignUid);
    runtime.answered += 1;
    this.emit(channel.userUid, {
      type: 'channel_answered',
      channelId,
      campaignUid: channel.campaignUid,
    });
    return channel;
  }

  removeChannel(channelId: string, disposition: AutodialDisposition): AutodialLiveChannel | undefined {
    const channel = this.channels.get(channelId);
    if (!channel) return undefined;
    this.channels.delete(channelId);
    const runtime = this.ensureRuntime(channel.userUid, channel.campaignUid);
    if (disposition === 'success') runtime.success += 1;
    this.emit(channel.userUid, {
      type: 'channel_ended',
      channelId,
      campaignUid: channel.campaignUid,
      disposition,
    });
    return channel;
  }

  getChannel(channelId: string): AutodialLiveChannel | undefined {
    return this.channels.get(channelId);
  }

  activeChannels(campaignUid: number): number {
    let n = 0;
    for (const c of this.channels.values()) if (c.campaignUid === campaignUid) n += 1;
    return n;
  }

  tenantActiveChannels(userUid: number): number {
    let n = 0;
    for (const c of this.channels.values()) if (c.userUid === userUid) n += 1;
    return n;
  }

  /** Live channels using a given trunk, for the trunk_channels provider. */
  trunkActiveChannels(userUid: number, trunkId: string): number {
    let n = 0;
    for (const c of this.channels.values()) {
      if (c.userUid === userUid && c.trunkId === trunkId) n += 1;
    }
    return n;
  }

  listChannels(userUid: number): AutodialLiveChannel[] {
    return [...this.channels.values()].filter((c) => c.userUid === userUid);
  }

  // ── reservations ──────────────────────────────────────────────────

  /**
   * Held between "the pacer decided to dial" and "the channel exists", so two
   * ticks cannot hand the same agent two calls.
   */
  reserve(userUid: number, campaignUid: number, count: number): void {
    const runtime = this.ensureRuntime(userUid, campaignUid);
    runtime.reserved += count;
  }

  release(userUid: number, campaignUid: number, count = 1): void {
    const runtime = this.ensureRuntime(userUid, campaignUid);
    runtime.reserved = Math.max(0, runtime.reserved - count);
  }

  reservedFor(campaignUid: number): number {
    return this.runtimes.get(campaignUid)?.reserved ?? 0;
  }

  // ── runtime / stats ───────────────────────────────────────────────

  ensureRuntime(userUid: number, campaignUid: number): AutodialCampaignRuntime {
    let runtime = this.runtimes.get(campaignUid);
    if (!runtime) {
      runtime = {
        campaignUid,
        userUid,
        status: 'draft',
        capacity: 0,
        limitedBy: 'none',
        reserved: 0,
        dials: 0,
        answered: 0,
        success: 0,
      };
      this.runtimes.set(campaignUid, runtime);
    }
    return runtime;
  }

  setPacing(
    userUid: number,
    campaignUid: number,
    data: {
      capacity: number;
      limitedBy: string;
      status: AutodialCampaignStatus;
      overDial?: number;
      abandonPct?: number;
    },
  ): void {
    const runtime = this.ensureRuntime(userUid, campaignUid);
    const changed =
      runtime.capacity !== data.capacity
      || runtime.limitedBy !== data.limitedBy
      || runtime.status !== data.status
      || runtime.overDial !== data.overDial;
    runtime.capacity = data.capacity;
    runtime.limitedBy = data.limitedBy;
    runtime.status = data.status;
    runtime.overDial = data.overDial;
    runtime.abandonPct = data.abandonPct;
    if (changed) {
      this.emit(userUid, {
        type: 'pacer',
        campaignUid,
        capacity: data.capacity,
        limitedBy: data.limitedBy,
        reserved: runtime.reserved,
        overDial: data.overDial,
        abandonPct: data.abandonPct,
      });
    }
  }

  // ── predictive observations ───────────────────────────────────────

  /**
   * One answered call's outcome for the abandon-rate controller. Only answered
   * calls enter the window: an unanswered dial says nothing about whether the
   * operator pool could have served it.
   */
  recordAnsweredOutcome(campaignUid: number, abandoned: boolean): void {
    const current = this.observations.get(campaignUid) ?? { answered: 0, abandoned: 0 };
    this.observations.set(campaignUid, pushObservation(current, abandoned));
  }

  observation(campaignUid: number): PredictiveObservation {
    return this.observations.get(campaignUid) ?? { answered: 0, abandoned: 0 };
  }

  abandonPct(campaignUid: number): number {
    return observedAbandonPct(this.observation(campaignUid));
  }

  /** Last multiplier the controller settled on; 1 means no over-dial yet. */
  overDialFor(campaignUid: number): number {
    return this.runtimes.get(campaignUid)?.overDial ?? 1;
  }

  listRuntimes(userUid: number): AutodialCampaignRuntime[] {
    return [...this.runtimes.values()].filter((r) => r.userUid === userUid);
  }

  /** Counters are per reporting day; the rollup job owns the durable history. */
  resetDailyCounters(): void {
    for (const runtime of this.runtimes.values()) {
      runtime.dials = 0;
      runtime.answered = 0;
      runtime.success = 0;
    }
  }

  dropCampaign(campaignUid: number): void {
    this.runtimes.delete(campaignUid);
    this.observations.delete(campaignUid);
    for (const [id, c] of this.channels) {
      if (c.campaignUid === campaignUid) this.channels.delete(id);
    }
  }

  // ── SSE ───────────────────────────────────────────────────────────

  stream(userUid: number): Observable<AutodialSseEvent> {
    return this.tenantStream(userUid).asObservable();
  }

  snapshot(userUid: number): AutodialSseEvent {
    return {
      type: 'snapshot',
      campaigns: this.listRuntimes(userUid),
      channels: this.listChannels(userUid),
    };
  }

  private tenantStream(userUid: number): Subject<AutodialSseEvent> {
    let subject = this.streams.get(userUid);
    if (!subject) {
      subject = new Subject<AutodialSseEvent>();
      this.streams.set(userUid, subject);
    }
    return subject;
  }

  private emit(userUid: number, event: AutodialSseEvent): void {
    const subject = this.streams.get(userUid);
    if (!subject || subject.observed === false) return;
    try {
      subject.next(event);
    } catch (e) {
      this.logger.warn(`Autodial SSE emit failed: ${(e as Error).message}`);
    }
  }
}
