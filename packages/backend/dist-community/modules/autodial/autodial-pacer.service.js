"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var AutodialPacerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutodialPacerService = void 0;
const common_1 = require("@nestjs/common");
const event_emitter_1 = require("@nestjs/event-emitter");
const sequelize_1 = require("@nestjs/sequelize");
const sequelize_2 = require("sequelize");
const crypto_1 = require("crypto");
const ami_service_1 = require("../ami/ami.service");
const ari_connection_service_1 = require("../ari/ari-connection.service");
const callcenter_state_service_1 = require("../callcenter/callcenter-state.service");
const ps_endpoint_model_1 = require("../endpoints/ps-endpoint.model");
const ac_campaign_model_1 = require("./models/ac-campaign.model");
const ac_schedule_model_1 = require("./models/ac-schedule.model");
const ac_task_model_1 = require("./models/ac-task.model");
const autodial_state_service_1 = require("./autodial-state.service");
const autodial_originator_service_1 = require("./autodial-originator.service");
const autodial_capacity_util_1 = require("./autodial-capacity.util");
const autodial_schedule_util_1 = require("./autodial-schedule.util");
const autodial_predictive_util_1 = require("./autodial-predictive.util");
const autodial_trunk_occupancy_util_1 = require("./autodial-trunk-occupancy.util");
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
let AutodialPacerService = AutodialPacerService_1 = class AutodialPacerService {
    campaignModel;
    scheduleModel;
    taskModel;
    endpointModel;
    ami;
    ariConnection;
    ccState;
    state;
    originator;
    logger = new common_1.Logger(AutodialPacerService_1.name);
    leaseId = `pacer-${process.pid}-${(0, crypto_1.randomUUID)().slice(0, 8)}`;
    startedAt = Date.now();
    timer = null;
    ticking = false;
    ariDown = false;
    /** First-class trunk limits (`device_state_busy_at`), refreshed each tick. */
    trunkLimits = new Map();
    /** Live PJSIP occupancy from CoreShowChannels; falls back to autodial state. */
    liveTrunkChannels = new Map();
    trunkPictureFresh = false;
    constructor(campaignModel, scheduleModel, taskModel, endpointModel, ami, ariConnection, ccState, state, originator) {
        this.campaignModel = campaignModel;
        this.scheduleModel = scheduleModel;
        this.taskModel = taskModel;
        this.endpointModel = endpointModel;
        this.ami = ami;
        this.ariConnection = ariConnection;
        this.ccState = ccState;
        this.state = state;
        this.originator = originator;
        this.timer = setInterval(() => void this.tick(), TICK_MS);
    }
    onApplicationShutdown() {
        if (this.timer)
            clearInterval(this.timer);
        this.timer = null;
    }
    onAriConnection(payload) {
        this.ariDown = !payload.connected;
        if (this.ariDown) {
            this.logger.warn('ARI disconnected — autodial pacing suspended');
        }
    }
    async tick() {
        if (this.ticking)
            return;
        this.ticking = true;
        try {
            await this.sweepStaleLeases();
            // Without ARI events an originated call is a black box: never dial blind.
            if (this.ariDown || !this.ariConnection.isConnected())
                return;
            const campaigns = await this.campaignModel.findAll({ where: { status: 'running' } });
            if (!campaigns.length)
                return;
            await this.refreshTrunkPicture(campaigns);
            const schedules = await this.schedulesByCampaign(campaigns.map((c) => c.uid));
            const now = new Date();
            const degraded = Date.now() - this.startedAt < WARMUP_MS;
            for (const campaign of campaigns) {
                try {
                    await this.paceCampaign(campaign, schedules.get(campaign.uid) ?? [], now, degraded);
                }
                catch (e) {
                    this.logger.error(`Pacing campaign ${campaign.uid} failed: ${e.message}`);
                }
            }
        }
        catch (e) {
            this.logger.error(`Autodial pacer tick failed: ${e.message}`);
        }
        finally {
            this.ticking = false;
        }
    }
    async paceCampaign(campaign, schedules, now, degraded) {
        if (!(0, autodial_schedule_util_1.campaignWindowOpen)(schedules, now)) {
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
        const pacing = (0, autodial_capacity_util_1.effectivePacing)(campaign.dial_mode, campaign.pacing);
        const overDial = this.overDialFor(campaign, degraded);
        const result = (0, autodial_capacity_util_1.computeAutodialCapacity)({
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
        if (result.slots <= 0)
            return;
        const tasks = await this.leaseTasks(campaign, result.slots, now);
        for (const task of tasks) {
            // The reservation only covers the gap between deciding to dial and the
            // channel appearing in live state; after that activeChannels accounts
            // for it, so it is always released once originate() returns.
            this.state.reserve(campaign.user_uid, campaign.uid, 1);
            try {
                await this.originator.originate(task, campaign, this.availableTrunkIds(campaign) ?? undefined, this.leaseId);
            }
            catch (e) {
                this.logger.error(`Originate threw for task ${task.uid}: ${e.message}`);
            }
            finally {
                this.state.release(campaign.user_uid, campaign.uid, 1);
            }
        }
    }
    /**
     * Conditional-UPDATE lease, one row at a time. `leased_by IS NULL` in the
     * WHERE clause is what makes it race-safe without a transaction.
     */
    async leaseTasks(campaign, limit, now) {
        const candidates = await this.taskModel.findAll({
            where: {
                user_uid: campaign.user_uid,
                campaign_uid: campaign.uid,
                status: 'pending',
                leased_by: null,
                [sequelize_2.Op.or]: [{ next_attempt_at: null }, { next_attempt_at: { [sequelize_2.Op.lte]: now } }],
            },
            order: [
                ['priority', 'DESC'],
                ['uid', 'ASC'],
            ],
            limit: limit * 2,
        });
        const leased = [];
        for (const candidate of candidates) {
            if (leased.length >= limit)
                break;
            const [affected] = await this.taskModel.update({ status: 'leased', leased_by: this.leaseId, leased_at: now }, {
                where: {
                    uid: candidate.uid,
                    user_uid: campaign.user_uid,
                    status: 'pending',
                    leased_by: null,
                },
            });
            if (affected > 0) {
                await candidate.reload();
                leased.push(candidate);
            }
        }
        return leased;
    }
    /** Only unstarted leases expire. Dialing tasks may have live channels. */
    async sweepStaleLeases() {
        const cutoff = new Date(Date.now() - LEASE_TTL_MS);
        const [affected] = await this.taskModel.update({ status: 'pending', leased_by: null, leased_at: null }, {
            where: {
                status: 'leased',
                leased_at: { [sequelize_2.Op.lt]: cutoff },
            },
        });
        if (affected > 0) {
            this.logger.warn(`Swept ${affected} stale autodial lease(s)`);
        }
    }
    /**
     * Predictive over-dial for this tick, or undefined for every other mode.
     * While agent state is warming up the factor stays where it was instead of
     * ratcheting up on evidence the pacer is not yet allowed to trust.
     */
    overDialFor(campaign, degraded) {
        if (campaign.dial_mode !== 'predictive')
            return undefined;
        const previous = this.state.overDialFor(campaign.uid);
        if (degraded)
            return previous;
        return (0, autodial_predictive_util_1.computeOverDialFactor)({
            config: campaign.pacing?.predictive ?? (0, autodial_predictive_util_1.defaultAutodialPredictive)(),
            observation: this.state.observation(campaign.uid),
            previous,
        });
    }
    availableAgents(campaign) {
        const names = new Set(campaign.queue_names ?? []);
        for (const provider of campaign.pacing?.providers ?? []) {
            if (provider.type === 'queue_agents') {
                for (const n of provider.queue_names ?? [])
                    names.add(n);
            }
        }
        if (!names.size)
            return 0;
        // Queue aggregates count the same READY operator once per membership. A
        // campaign can use several queues, but one operator can take only one call.
        const unique = new Set();
        for (const agent of this.ccState.getAllAgents(campaign.user_uid)) {
            if (agent.status !== 'READY' || !agent.queues.some((name) => names.has(name)))
                continue;
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
    freeTrunkChannels(campaign) {
        let free = 0;
        let anyLimit = false;
        const seen = new Set();
        const trunks = (campaign.trunk_pool ?? []).filter((trunk) => {
            if (!trunk.trunk_id || seen.has(trunk.trunk_id))
                return false;
            seen.add(trunk.trunk_id);
            return true;
        });
        for (const trunk of trunks) {
            const limit = (0, autodial_trunk_occupancy_util_1.resolveTrunkChannelLimit)(trunk.max_channels, this.trunkLimits.get(trunk.trunk_id));
            // An unlimited trunk keeps the aggregate provider unbounded. Selection is
            // still filtered per trunk below, so a saturated finite peer is not used.
            if (limit <= 0)
                return null;
        }
        for (const trunk of trunks) {
            const limit = (0, autodial_trunk_occupancy_util_1.resolveTrunkChannelLimit)(trunk.max_channels, this.trunkLimits.get(trunk.trunk_id));
            anyLimit = true;
            if (!this.trunkPictureFresh)
                return 0;
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
    availableTrunkIds(campaign) {
        const available = new Set();
        let hasFiniteLimit = false;
        const seen = new Set();
        for (const trunk of campaign.trunk_pool ?? []) {
            if (!trunk.trunk_id || seen.has(trunk.trunk_id))
                continue;
            seen.add(trunk.trunk_id);
            const limit = (0, autodial_trunk_occupancy_util_1.resolveTrunkChannelLimit)(trunk.max_channels, this.trunkLimits.get(trunk.trunk_id));
            if (limit <= 0) {
                available.add(trunk.trunk_id);
                continue;
            }
            hasFiniteLimit = true;
            if (!this.trunkPictureFresh)
                continue;
            const live = this.liveTrunkChannels.get(trunk.trunk_id);
            const used = Math.max(live ?? 0, this.state.trunkActiveChannels(campaign.user_uid, trunk.trunk_id));
            if (used < limit)
                available.add(trunk.trunk_id);
        }
        return hasFiniteLimit ? available : null;
    }
    /**
     * One AMI + one DB read per tick for every trunk currently in a running
     * campaign. CoreShowChannels is the only picture that includes non-autodial
     * traffic on the same endpoint.
     */
    async refreshTrunkPicture(campaigns) {
        const ids = new Set();
        for (const campaign of campaigns) {
            for (const trunk of campaign.trunk_pool ?? []) {
                if (trunk.trunk_id)
                    ids.add(trunk.trunk_id);
            }
        }
        if (!ids.size) {
            this.trunkLimits.clear();
            this.liveTrunkChannels.clear();
            this.trunkPictureFresh = false;
            return;
        }
        const endpoints = await this.endpointModel.findAll({
            where: { id: { [sequelize_2.Op.in]: [...ids] } },
            attributes: ['id', 'device_state_busy_at'],
        });
        this.trunkLimits = new Map(endpoints.map((row) => [row.id, Number(row.device_state_busy_at) || 0]));
        try {
            const { events } = await this.ami.getActiveChannels();
            this.liveTrunkChannels = (0, autodial_trunk_occupancy_util_1.countChannelsByTrunk)((events ?? []), [...ids]);
            this.trunkPictureFresh = true;
        }
        catch (e) {
            this.trunkPictureFresh = false;
            this.logger.warn(`CoreShowChannels occupancy failed: ${e.message}`);
        }
    }
    async schedulesByCampaign(campaignUids) {
        const out = new Map();
        const rows = await this.scheduleModel.findAll({
            // Disabled rows are needed by campaignWindowOpen(): no rows means
            // unrestricted calling, while configured-but-all-disabled means closed.
            where: { campaign_uid: { [sequelize_2.Op.in]: campaignUids } },
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
};
exports.AutodialPacerService = AutodialPacerService;
__decorate([
    (0, event_emitter_1.OnEvent)('ari.connection'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AutodialPacerService.prototype, "onAriConnection", null);
exports.AutodialPacerService = AutodialPacerService = AutodialPacerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, sequelize_1.InjectModel)(ac_campaign_model_1.AcCampaign)),
    __param(1, (0, sequelize_1.InjectModel)(ac_schedule_model_1.AcSchedule)),
    __param(2, (0, sequelize_1.InjectModel)(ac_task_model_1.AcTask)),
    __param(3, (0, sequelize_1.InjectModel)(ps_endpoint_model_1.PsEndpoint)),
    __metadata("design:paramtypes", [Object, Object, Object, Object, ami_service_1.AmiService,
        ari_connection_service_1.AriConnectionService,
        callcenter_state_service_1.CallCenterStateService,
        autodial_state_service_1.AutodialStateService,
        autodial_originator_service_1.AutodialOriginatorService])
], AutodialPacerService);
function round1(value) {
    return Math.round(value * 10) / 10;
}
//# sourceMappingURL=autodial-pacer.service.js.map