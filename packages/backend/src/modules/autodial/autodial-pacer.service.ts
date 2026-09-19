import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { randomUUID } from 'crypto';
import type { IAutodialSchedule } from '@krasterisk/shared';
import { AmiService } from '../ami/ami.service';
import { AriConnectionService } from '../ari/ari-connection.service';
import { CallCenterStateService } from '../callcenter/callcenter-state.service';
import { PsEndpoint } from '../endpoints/ps-endpoint.model';
import { AcCampaign } from './models/ac-campaign.model';
import { AcSchedule } from './models/ac-schedule.model';
import { AcTask } from './models/ac-task.model';
import { AutodialStateService } from './autodial-state.service';
import { AutodialOriginatorService } from './autodial-originator.service';
import { computeAutodialCapacity, effectivePacing } from './autodial-capacity.util';
import { campaignWindowOpen } from './autodial-schedule.util';
import {
  computeOverDialFactor,
  defaultAutodialPredictive,
} from './autodial-predictive.util';
import {
  countChannelsByTrunk,
  resolveTrunkChannelLimit,
} from './autodial-trunk-occupancy.util';

const TICK_MS = 1000;
/** A lease older than this is considered lost and is swept back to pending. */
const LEASE_TTL_MS = 120_000;
/** Give AMI a moment to repopulate queue state before trusting agent counts. */
const WARMUP_MS = 30_000;

/**
 * Ticks once a second, computes capacity per running campaign, leases that many
 * tasks and hands them to the originator.
 *
 * Leasing is a conditional UPDATE per task so two backend instances (or two
 * overlapping ticks) can never take the same row, and every query is scoped by
 * tenant so one busy tenant cannot starve the others.
 */
@Injectable()
export class AutodialPacerService implements OnApplicationShutdown {
  private readonly logger = new Logger(AutodialPacerService.name);
  private readonly leaseId = `pacer-${process.pid}-${randomUUID().slice(0, 8)}`;
  private readonly startedAt = Date.now();
  private timer: NodeJS.Timeout | null = null;
  private ticking = false;
  private ariDown = false;
  /** First-class trunk limits (`device_state_busy_at`), refreshed each tick. */
  private trunkLimits = new Map<string, number>();
  /** Live PJSIP occupancy from CoreShowChannels; falls back to autodial state. */
  private liveTrunkChannels = new Map<string, number>();
  private trunkPictureFresh = false;

  constructor(
    @InjectModel(AcCampaign) private readonly campaignModel: typeof AcCampaign,
    @InjectModel(AcSchedule) private readonly scheduleModel: typeof AcSchedule,
    @InjectModel(AcTask) private readonly taskModel: typeof AcTask,
    @InjectModel(PsEndpoint) private readonly endpointModel: typeof PsEndpoint,
    private readonly ami: AmiService,
    private readonly ariConnection: AriConnectionService,
    private readonly ccState: CallCenterStateService,
    private readonly state: AutodialStateService,
    private readonly originator: AutodialOriginatorService,
  ) {
    this.timer = setInterval(() => void this.tick(), TICK_MS);
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  @OnEvent('ari.connection')
  onAriConnection(payload: { connected: boolean }): void {
    this.ariDown = !payload.connected;
    if (this.ariDown) {
      this.logger.warn('ARI disconnected — autodial pacing suspended');
    }
  }

  async tick(): Promise<void> {
    if (this.ticking) return;
    this.ticking = true;
    try {
      await this.sweepStaleLeases();
      // Without ARI events an originated call is a black box: never dial blind.
      if (this.ariDown || !this.ariConnection.isConnected()) return;

      const campaigns = await this.campaignModel.findAll({ where: { status: 'running' } });
      if (!campaigns.length) return;

      await this.refreshTrunkPicture(campaigns);
      const schedules = await this.schedulesByCampaign(campaigns.map((c) => c.uid));
      const now = new Date();
      const degraded = Date.now() - this.startedAt < WARMUP_MS;

      for (const campaign of campaigns) {
        try {
          await this.paceCampaign(campaign, schedules.get(campaign.uid) ?? [], now, degraded);
        } catch (e) {
          this.logger.error(
            `Pacing campaign ${campaign.uid} failed: ${(e as Error).message}`,
          );
        }
      }
    } catch (e) {
      this.logger.error(`Autodial pacer tick failed: ${(e as Error).message}`);
    } finally {
      this.ticking = false;
    }
  }

  private async paceCampaign(
    campaign: AcCampaign,
    schedules: IAutodialSchedule[],
    now: Date,
    degraded: boolean,
  ): Promise<void> {
    if (!campaignWindowOpen(schedules, now)) {
      this.state.setPacing(campaign.user_uid, campaign.uid, {
        capacity: 0,
        limitedBy: 'schedule',
        status: campaign.status,
      });
      return;
    }

    const initialAvailableTrunks = this.availableTrunkIds(campaign);
    if (initialAvailableTrunks != null && !initialAvailableTrunks.size) {
      this.state.setPacing(campaign.user_uid, campaign.uid, {
        capacity: 0,
        limitedBy: 'trunk_channels',
        status: campaign.status,
      });
      return;
    }

    const pacing = effectivePacing(campaign.dial_mode, campaign.pacing);
    const overDial = this.overDialFor(campaign, degraded);
    const result = computeAutodialCapacity({
      dialMode: campaign.dial_mode,
      pacing,
      activeChannels: this.state.activeChannels(campaign.uid),
      reserved: this.state.reservedFor(campaign.uid),
      availableAgents: this.availableAgents(campaign),
      freeTrunkChannels: this.freeTrunkChannels(campaign),
      tenantActiveChannels: this.state.tenantActiveChannels(campaign.user_uid),
      tenantReservedChannels: this.state.tenantReservedChannels(campaign.user_uid),
      degraded,
      overDial,
    });

    this.state.setPacing(campaign.user_uid, campaign.uid, {
      capacity: result.capacity,
      limitedBy: result.limitedBy,
      status: campaign.status,
      ...(overDial != null
        ? { overDial, abandonPct: round1(this.state.abandonPct(campaign.uid)) }
        : {}),
    });
    if (result.slots <= 0) return;

    const tasks = await this.leaseTasks(campaign, result.slots, now);
    for (const task of tasks) {
      // The reservation only covers the gap between deciding to dial and the
      // channel appearing in live state; after that activeChannels accounts
      // for it, so it is always released once originate() returns.
      this.state.reserve(campaign.user_uid, campaign.uid, 1);
      try {
        await this.originator.originate(
          task,
          campaign,
          this.availableTrunkIds(campaign) ?? undefined,
          this.leaseId,
        );
      } catch (e) {
        this.logger.error(`Originate threw for task ${task.uid}: ${(e as Error).message}`);
      } finally {
        this.state.release(campaign.user_uid, campaign.uid, 1);
      }
    }
  }

  /**
   * Conditional-UPDATE lease, one row at a time. `leased_by IS NULL` in the
   * WHERE clause is what makes it race-safe without a transaction.
   */
  private async leaseTasks(
    campaign: AcCampaign,
    limit: number,
    now: Date,
  ): Promise<AcTask[]> {
    const candidates = await this.taskModel.findAll({
      where: {
        user_uid: campaign.user_uid,
        campaign_uid: campaign.uid,
        status: 'pending',
        leased_by: null,
        [Op.or]: [{ next_attempt_at: null }, { next_attempt_at: { [Op.lte]: now } }],
      },
      order: [
        ['priority', 'DESC'],
        ['uid', 'ASC'],
      ],
      limit: limit * 2,
    });

    const leased: AcTask[] = [];
    for (const candidate of candidates) {
      if (leased.length >= limit) break;
      const [affected] = await this.taskModel.update(
        { status: 'leased', leased_by: this.leaseId, leased_at: now },
        {
          where: {
            uid: candidate.uid,
            user_uid: campaign.user_uid,
            status: 'pending',
            leased_by: null,
          },
        },
      );
      if (affected > 0) {
        await candidate.reload();
        leased.push(candidate);
      }
    }
    return leased;
  }

  /** Only unstarted leases expire. Dialing tasks may have live channels. */
  private async sweepStaleLeases(): Promise<void> {
    const cutoff = new Date(Date.now() - LEASE_TTL_MS);
    const [affected] = await this.taskModel.update(
      { status: 'pending', leased_by: null, leased_at: null },
      {
        where: {
          status: 'leased',
          leased_at: { [Op.lt]: cutoff },
        },
      },
    );
    if (affected > 0) {
      this.logger.warn(`Swept ${affected} stale autodial lease(s)`);
    }
  }

  /**
   * Predictive over-dial for this tick, or undefined for every other mode.
   * While agent state is warming up the factor stays where it was instead of
   * ratcheting up on evidence the pacer is not yet allowed to trust.
   */
  private overDialFor(campaign: AcCampaign, degraded: boolean): number | undefined {
    if (campaign.dial_mode !== 'predictive') return undefined;
    const previous = this.state.overDialFor(campaign.uid);
    if (degraded) return previous;
    return computeOverDialFactor({
      config: campaign.pacing?.predictive ?? defaultAutodialPredictive(),
      observation: this.state.observation(campaign.uid),
      previous,
    });
  }

  private availableAgents(campaign: AcCampaign): number {
    const names = new Set<string>(campaign.queue_names ?? []);
    for (const provider of campaign.pacing?.providers ?? []) {
      if (provider.type === 'queue_agents') {
        for (const n of provider.queue_names ?? []) names.add(n);
      }
    }
    if (!names.size) return 0;
    // Queue aggregates count the same READY operator once per membership. A
    // campaign can use several queues, but one operator can take only one call.
    const unique = new Set<string>();
    for (const agent of this.ccState.getAllAgents(campaign.user_uid)) {
      if (agent.status !== 'READY' || !agent.queues.some((name) => names.has(name))) continue;
      unique.add(agent.userId > 0 ? `user:${agent.userId}` : `interface:${agent.interface}`);
    }
    return unique.size;
  }

  /**
   * Free channels across the campaign's trunks. Campaign override wins; otherwise
   * the first-class trunk limit (`device_state_busy_at`) is inherited. Returns
   * null when no trunk declares a limit, which drops the provider instead of
   * blocking the campaign.
   */
  private freeTrunkChannels(campaign: AcCampaign): number | null {
    let free = 0;
    let anyLimit = false;
    const seen = new Set<string>();
    const trunks = (campaign.trunk_pool ?? []).filter((trunk) => {
      if (!trunk.trunk_id || seen.has(trunk.trunk_id)) return false;
      seen.add(trunk.trunk_id);
      return true;
    });
    for (const trunk of trunks) {
      const limit = resolveTrunkChannelLimit(
        trunk.max_channels,
        this.trunkLimits.get(trunk.trunk_id),
      );
      // An unlimited trunk keeps the aggregate provider unbounded. Selection is
      // still filtered per trunk below, so a saturated finite peer is not used.
      if (limit <= 0) return null;
    }
    for (const trunk of trunks) {
      const limit = resolveTrunkChannelLimit(
        trunk.max_channels,
        this.trunkLimits.get(trunk.trunk_id),
      );
      anyLimit = true;
      if (!this.trunkPictureFresh) return 0;
      const live = this.liveTrunkChannels.get(trunk.trunk_id);
      const used = Math.max(live ?? 0, this.state.trunkActiveChannels(campaign.user_uid, trunk.trunk_id));
      free += Math.max(0, limit - used);
    }
    return anyLimit ? free : null;
  }

  /**
   * Finite trunks are eligible only when their live snapshot is fresh and has
   * room. Unlimited trunks remain usable during a degraded finite snapshot;
   * they have no occupancy limit to fail closed against.
   */
  private availableTrunkIds(campaign: AcCampaign): Set<string> | null {
    const available = new Set<string>();
    let hasFiniteLimit = false;
    const seen = new Set<string>();

    for (const trunk of campaign.trunk_pool ?? []) {
      if (!trunk.trunk_id || seen.has(trunk.trunk_id)) continue;
      seen.add(trunk.trunk_id);
      const limit = resolveTrunkChannelLimit(
        trunk.max_channels,
        this.trunkLimits.get(trunk.trunk_id),
      );
      if (limit <= 0) {
        available.add(trunk.trunk_id);
        continue;
      }

      hasFiniteLimit = true;
      if (!this.trunkPictureFresh) continue;
      const live = this.liveTrunkChannels.get(trunk.trunk_id);
      const used = Math.max(
        live ?? 0,
        this.state.trunkActiveChannels(campaign.user_uid, trunk.trunk_id),
      );
      if (used < limit) available.add(trunk.trunk_id);
    }

    return hasFiniteLimit ? available : null;
  }

  /**
   * One AMI + one DB read per tick for every trunk currently in a running
   * campaign. CoreShowChannels is the only picture that includes non-autodial
   * traffic on the same endpoint.
   */
  private async refreshTrunkPicture(campaigns: AcCampaign[]): Promise<void> {
    const ids = new Set<string>();
    for (const campaign of campaigns) {
      for (const trunk of campaign.trunk_pool ?? []) {
        if (trunk.trunk_id) ids.add(trunk.trunk_id);
      }
    }
    if (!ids.size) {
      this.trunkLimits.clear();
      this.liveTrunkChannels.clear();
      this.trunkPictureFresh = false;
      return;
    }

    const endpoints = await this.endpointModel.findAll({
      where: { id: { [Op.in]: [...ids] } },
      attributes: ['id', 'device_state_busy_at'],
    });
    this.trunkLimits = new Map(
      endpoints.map((row) => [row.id, Number(row.device_state_busy_at) || 0]),
    );

    try {
      const { events } = await this.ami.getActiveChannels();
      this.liveTrunkChannels = countChannelsByTrunk(
        (events ?? []) as Array<{ event?: string; channel?: string; Channel?: string }>,
        [...ids],
      );
      this.trunkPictureFresh = true;
    } catch (e) {
      this.trunkPictureFresh = false;
      this.logger.warn(`CoreShowChannels occupancy failed: ${(e as Error).message}`);
    }
  }

  private async schedulesByCampaign(
    campaignUids: number[],
  ): Promise<Map<number, IAutodialSchedule[]>> {
    const out = new Map<number, IAutodialSchedule[]>();
    const rows = await this.scheduleModel.findAll({
      // Disabled rows are needed by campaignWindowOpen(): no rows means
      // unrestricted calling, while configured-but-all-disabled means closed.
      where: { campaign_uid: { [Op.in]: campaignUids } },
    });
    for (const r of rows) {
      const list = out.get(r.campaign_uid) ?? [];
      list.push({
        uid: r.uid,
        campaign_uid: r.campaign_uid,
        kind: r.kind,
        weekday: r.weekday,
        time_from: r.time_from,
        time_to: r.time_to,
        timezone: r.timezone,
        date_from: r.date_from,
        date_to: r.date_to,
        enabled: r.enabled,
      });
      out.set(r.campaign_uid, list);
    }
    return out;
  }
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
