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
var ConferenceStaleChannelSweeperService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConferenceStaleChannelSweeperService = exports.STALE_CHANNEL_THRESHOLD_MS = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const ami_service_1 = require("../ami/ami.service");
const dialplan_target_util_1 = require("../../shared/utils/dialplan-target.util");
const conference_state_service_1 = require("./conference-state.service");
/** Kept for callers/tests; sweeper no longer kicks solely on silence (CR-02). */
exports.STALE_CHANNEL_THRESHOLD_MS = 120_000;
function channelFromListEvent(evt) {
    const raw = evt.channel ?? evt.Channel;
    return typeof raw === 'string' ? raw.trim() : '';
}
let ConferenceStaleChannelSweeperService = ConferenceStaleChannelSweeperService_1 = class ConferenceStaleChannelSweeperService {
    stateService;
    amiService;
    logger = new common_1.Logger(ConferenceStaleChannelSweeperService_1.name);
    running = false;
    constructor(stateService, amiService) {
        this.stateService = stateService;
        this.amiService = amiService;
    }
    async tick() {
        if (this.running)
            return;
        this.running = true;
        try {
            await this.runOnce();
        }
        catch (err) {
            this.logger.warn(`stale channel sweeper failed: ${err?.message || err}`);
        }
        finally {
            this.running = false;
        }
    }
    async runOnce() {
        const roomUids = this.stateService.getActiveRoomUids();
        if (roomUids.length === 0)
            return;
        if (!this.amiService.isConnected())
            return;
        for (const roomUid of roomUids) {
            const identity = this.stateService.getRoomIdentity(roomUid);
            if (!identity)
                continue;
            const conference = (0, dialplan_target_util_1.normalizeTarget)('conference', { source: 'fixed', value: identity.number }, identity.vpbx);
            const channels = this.stateService.getLiveChannelPairs(roomUid);
            if (channels.length === 0)
                continue;
            let live;
            try {
                const listed = await this.amiService.confbridgeList(conference);
                live = new Set((listed.events ?? [])
                    .map((evt) => channelFromListEvent(evt))
                    .filter(Boolean));
            }
            catch (err) {
                this.logger.warn(`ConfbridgeList failed room=${roomUid} conference=${conference}: ${err?.message || err}`);
                continue;
            }
            for (const item of channels) {
                if (live.has(item.channel)) {
                    this.stateService.refreshSignal(item.channel);
                    continue;
                }
                try {
                    await this.stateService.handleLeave({
                        Conference: conference,
                        Channel: item.channel,
                    });
                }
                catch (err) {
                    this.logger.warn(`reconcile leave failed room=${roomUid} channel=${item.channel}: ${err?.message || err}`);
                }
            }
        }
    }
};
exports.ConferenceStaleChannelSweeperService = ConferenceStaleChannelSweeperService;
__decorate([
    (0, schedule_1.Cron)('*/1 * * * *'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ConferenceStaleChannelSweeperService.prototype, "tick", null);
exports.ConferenceStaleChannelSweeperService = ConferenceStaleChannelSweeperService = ConferenceStaleChannelSweeperService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [conference_state_service_1.ConferenceStateService,
        ami_service_1.AmiService])
], ConferenceStaleChannelSweeperService);
//# sourceMappingURL=conference-stale-channel-sweeper.service.js.map