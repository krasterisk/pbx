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
var CallCenterZombieService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CallCenterZombieService = exports.ZOMBIE_POLL_INTERVAL_MS = exports.ZOMBIE_GRACE_PERIOD_MS = void 0;
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
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const ami_service_1 = require("../ami/ami.service");
const callcenter_state_service_1 = require("./callcenter-state.service");
/** [ASSUMED] conservative fixed floor — document any future tenant-configurable override here. */
exports.ZOMBIE_GRACE_PERIOD_MS = 10 * 60 * 1000;
exports.ZOMBIE_POLL_INTERVAL_MS = 45 * 1000;
let CallCenterZombieService = CallCenterZombieService_1 = class CallCenterZombieService {
    amiService;
    stateService;
    logger = new common_1.Logger(CallCenterZombieService_1.name);
    /** uniqueid -> epoch ms of the first poll where none of its channels were live. */
    missingSince = new Map();
    constructor(amiService, stateService) {
        this.amiService = amiService;
        this.stateService = stateService;
    }
    async poll() {
        try {
            await this.checkOnce();
        }
        catch (err) {
            this.logger.warn(`[zombie] poll failed: ${err.message}`);
        }
    }
    /** One reconciliation pass — extracted from poll() so specs can drive it without timers. */
    async checkOnce() {
        if (!this.amiService.isConnected())
            return;
        const { events } = await this.amiService.getActiveChannels();
        const liveChannels = new Set();
        for (const evt of events || []) {
            if (evt?.channel)
                liveChannels.add(evt.channel);
        }
        const now = Date.now();
        const calls = this.stateService.getAllCallsGlobal();
        const stillTracked = new Set();
        for (const call of calls) {
            stillTracked.add(call.uniqueid);
            const channels = [call.callerChannel, call.agentChannel].filter(Boolean);
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
            if (!call.zombieCandidate && now - firstMissingAt >= exports.ZOMBIE_GRACE_PERIOD_MS) {
                this.stateService.setCall(call.uniqueid, { zombieCandidate: true });
                this.logger.warn(`[zombie] flagged candidate uniqueid=${call.uniqueid} channels=${channels.join(',')}`);
            }
        }
        // Drop bookkeeping for calls already removed from state (normal Hangup/AgentComplete cleanup).
        for (const uid of this.missingSince.keys()) {
            if (!stillTracked.has(uid))
                this.missingSince.delete(uid);
        }
    }
};
exports.CallCenterZombieService = CallCenterZombieService;
__decorate([
    (0, schedule_1.Interval)(exports.ZOMBIE_POLL_INTERVAL_MS),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], CallCenterZombieService.prototype, "poll", null);
exports.CallCenterZombieService = CallCenterZombieService = CallCenterZombieService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [ami_service_1.AmiService,
        callcenter_state_service_1.CallCenterStateService])
], CallCenterZombieService);
//# sourceMappingURL=callcenter-zombie.service.js.map