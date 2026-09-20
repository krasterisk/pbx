"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var AutodialStateService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutodialStateService = void 0;
const common_1 = require("@nestjs/common");
const rxjs_1 = require("rxjs");
const autodial_predictive_util_1 = require("./autodial-predictive.util");
/**
 * In-memory live state for the dialer, mirroring the CallCenterStateService
 * pattern. Everything here is rebuildable: on restart the reconciler closes
 * orphaned attempts and the pacer warms up from an empty picture.
 */
let AutodialStateService = AutodialStateService_1 = class AutodialStateService {
    logger = new common_1.Logger(AutodialStateService_1.name);
    channels = new Map();
    runtimes = new Map();
    streams = new Map();
    /** Rolling abandon window per campaign, read by the predictive controller. */
    observations = new Map();
    // ── channels ──────────────────────────────────────────────────────
    addChannel(channel) {
        this.channels.set(channel.channelId, channel);
        const runtime = this.ensureRuntime(channel.userUid, channel.campaignUid);
        runtime.dials += 1;
        this.emit(channel.userUid, { type: 'channel_started', channel });
    }
    markAnswered(channelId) {
        const channel = this.channels.get(channelId);
        if (!channel || channel.answeredAt)
            return channel;
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
    removeChannel(channelId, disposition) {
        const channel = this.channels.get(channelId);
        if (!channel)
            return undefined;
        this.channels.delete(channelId);
        const runtime = this.ensureRuntime(channel.userUid, channel.campaignUid);
        if (disposition === 'success')
            runtime.success += 1;
        this.emit(channel.userUid, {
            type: 'channel_ended',
            channelId,
            campaignUid: channel.campaignUid,
            disposition,
        });
        return channel;
    }
    getChannel(channelId) {
        return this.channels.get(channelId);
    }
    activeChannels(campaignUid) {
        let n = 0;
        for (const c of this.channels.values())
            if (c.campaignUid === campaignUid)
                n += 1;
        return n;
    }
    tenantActiveChannels(userUid) {
        let n = 0;
        for (const c of this.channels.values())
            if (c.userUid === userUid)
                n += 1;
        return n;
    }
    /** Live channels using a given trunk, for the trunk_channels provider. */
    trunkActiveChannels(userUid, trunkId) {
        let n = 0;
        for (const c of this.channels.values()) {
            if (c.userUid === userUid && c.trunkId === trunkId)
                n += 1;
        }
        return n;
    }
    listChannels(userUid) {
        return [...this.channels.values()].filter((c) => c.userUid === userUid);
    }
    // ── reservations ──────────────────────────────────────────────────
    /**
     * Held between "the pacer decided to dial" and "the channel exists", so two
     * ticks cannot hand the same agent two calls.
     */
    reserve(userUid, campaignUid, count) {
        const runtime = this.ensureRuntime(userUid, campaignUid);
        runtime.reserved += count;
    }
    release(userUid, campaignUid, count = 1) {
        const runtime = this.ensureRuntime(userUid, campaignUid);
        runtime.reserved = Math.max(0, runtime.reserved - count);
    }
    reservedFor(campaignUid) {
        return this.runtimes.get(campaignUid)?.reserved ?? 0;
    }
    tenantReservedChannels(userUid) {
        let count = 0;
        for (const runtime of this.runtimes.values()) {
            if (runtime.userUid === userUid)
                count += runtime.reserved;
        }
        return count;
    }
    // ── runtime / stats ───────────────────────────────────────────────
    ensureRuntime(userUid, campaignUid) {
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
    setPacing(userUid, campaignUid, data) {
        const runtime = this.ensureRuntime(userUid, campaignUid);
        const changed = runtime.capacity !== data.capacity
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
    recordAnsweredOutcome(campaignUid, abandoned) {
        const current = this.observations.get(campaignUid) ?? { answered: 0, abandoned: 0 };
        this.observations.set(campaignUid, (0, autodial_predictive_util_1.pushObservation)(current, abandoned));
    }
    observation(campaignUid) {
        return this.observations.get(campaignUid) ?? { answered: 0, abandoned: 0 };
    }
    abandonPct(campaignUid) {
        return (0, autodial_predictive_util_1.observedAbandonPct)(this.observation(campaignUid));
    }
    /** Last multiplier the controller settled on; 1 means no over-dial yet. */
    overDialFor(campaignUid) {
        return this.runtimes.get(campaignUid)?.overDial ?? 1;
    }
    listRuntimes(userUid) {
        return [...this.runtimes.values()].filter((r) => r.userUid === userUid);
    }
    /** Counters are per reporting day; the rollup job owns the durable history. */
    resetDailyCounters() {
        for (const runtime of this.runtimes.values()) {
            runtime.dials = 0;
            runtime.answered = 0;
            runtime.success = 0;
        }
    }
    dropCampaign(campaignUid) {
        this.runtimes.delete(campaignUid);
        this.observations.delete(campaignUid);
        for (const [id, c] of this.channels) {
            if (c.campaignUid === campaignUid)
                this.channels.delete(id);
        }
    }
    // ── SSE ───────────────────────────────────────────────────────────
    stream(userUid) {
        return this.tenantStream(userUid).asObservable();
    }
    snapshot(userUid) {
        return {
            type: 'snapshot',
            campaigns: this.listRuntimes(userUid),
            channels: this.listChannels(userUid),
        };
    }
    tenantStream(userUid) {
        let subject = this.streams.get(userUid);
        if (!subject) {
            subject = new rxjs_1.Subject();
            this.streams.set(userUid, subject);
        }
        return subject;
    }
    emit(userUid, event) {
        const subject = this.streams.get(userUid);
        if (!subject || subject.observed === false)
            return;
        try {
            subject.next(event);
        }
        catch (e) {
            this.logger.warn(`Autodial SSE emit failed: ${e.message}`);
        }
    }
};
exports.AutodialStateService = AutodialStateService;
exports.AutodialStateService = AutodialStateService = AutodialStateService_1 = __decorate([
    (0, common_1.Injectable)()
], AutodialStateService);
//# sourceMappingURL=autodial-state.service.js.map