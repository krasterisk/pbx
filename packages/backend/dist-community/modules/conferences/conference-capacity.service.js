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
var ConferenceCapacityService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConferenceCapacityService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const conference_capacity_util_1 = require("./conference-capacity.util");
const conference_rooms_service_1 = require("./conference-rooms.service");
const conference_state_service_1 = require("./conference-state.service");
const DEFAULT_UPLINK_KBPS = 100000;
let ConferenceCapacityService = ConferenceCapacityService_1 = class ConferenceCapacityService {
    stateService;
    roomsService;
    logger = new common_1.Logger(ConferenceCapacityService_1.name);
    running = false;
    lastApplied = new Map();
    constructor(stateService, roomsService) {
        this.stateService = stateService;
        this.roomsService = roomsService;
    }
    uplinkKbps() {
        const raw = Number(process.env.CONFERENCE_UPLINK_KBPS);
        if (Number.isFinite(raw) && raw > 0)
            return raw;
        return DEFAULT_UPLINK_KBPS;
    }
    capacityForRoom(room) {
        const used = this.stateService
            .getActiveRoomUids()
            .reduce((sum, uid) => sum + (0, conference_capacity_util_1.streamsForParticipants)(this.stateService.getSnapshot(uid).participants.length), 0);
        const remaining = Math.floor(this.uplinkKbps() / conference_capacity_util_1.STREAM_KBPS) - used;
        const nThis = this.stateService.getSnapshot(room.uid).participants.length;
        const serverMax = (0, conference_capacity_util_1.maxParticipantsForBudget)(remaining + (0, conference_capacity_util_1.streamsForParticipants)(nThis));
        return (0, conference_capacity_util_1.effectiveMax)(room.tariff_max_participants, serverMax);
    }
    async tick() {
        if (this.running)
            return;
        this.running = true;
        try {
            await this.runOnce();
        }
        catch (err) {
            this.logger.warn(`conference capacity tick failed: ${err?.message || err}`);
        }
        finally {
            this.running = false;
        }
    }
    async runOnce() {
        if (!this.roomsService)
            return;
        const roomUids = this.stateService.getActiveRoomUids();
        for (const roomUid of roomUids) {
            const identity = this.stateService.getRoomIdentity(roomUid);
            if (!identity)
                continue;
            try {
                const room = await this.roomsService.findOne(roomUid, identity.vpbx);
                const n = this.capacityForRoom(room);
                if (this.lastApplied.get(roomUid) === n)
                    continue;
                await this.roomsService.reapplyDialplan(room, n);
                this.lastApplied.set(roomUid, n);
            }
            catch (err) {
                this.logger.error(`capacity reapply failed room=${roomUid}: ${err?.message || err}`);
            }
        }
    }
};
exports.ConferenceCapacityService = ConferenceCapacityService;
__decorate([
    (0, schedule_1.Cron)('*/30 * * * * *'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ConferenceCapacityService.prototype, "tick", null);
exports.ConferenceCapacityService = ConferenceCapacityService = ConferenceCapacityService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Optional)()),
    __param(1, (0, common_1.Inject)((0, common_1.forwardRef)(() => conference_rooms_service_1.ConferenceRoomsService))),
    __metadata("design:paramtypes", [conference_state_service_1.ConferenceStateService,
        conference_rooms_service_1.ConferenceRoomsService])
], ConferenceCapacityService);
//# sourceMappingURL=conference-capacity.service.js.map