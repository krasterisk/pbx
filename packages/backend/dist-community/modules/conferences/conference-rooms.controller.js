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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConferenceRoomsController = void 0;
const common_1 = require("@nestjs/common");
const throttler_1 = require("@nestjs/throttler");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const conference_capacity_service_1 = require("./conference-capacity.service");
const conference_invite_service_1 = require("./conference-invite.service");
const conference_rooms_service_1 = require("./conference-rooms.service");
const conference_telemetry_service_1 = require("./conference-telemetry.service");
const conference_guest_token_dto_1 = require("./dto/conference-guest-token.dto");
const conference_invite_dto_1 = require("./dto/conference-invite.dto");
const create_conference_room_dto_1 = require("./dto/create-conference-room.dto");
const conference_moderator_dto_1 = require("./dto/conference-moderator.dto");
const update_conference_room_dto_1 = require("./dto/update-conference-room.dto");
let ConferenceRoomsController = class ConferenceRoomsController {
    conferenceRoomsService;
    capacityService;
    inviteService;
    telemetryService;
    constructor(conferenceRoomsService, capacityService, inviteService, telemetryService) {
        this.conferenceRoomsService = conferenceRoomsService;
        this.capacityService = capacityService;
        this.inviteService = inviteService;
        this.telemetryService = telemetryService;
    }
    findAll(req) {
        return this.conferenceRoomsService.findAll(req.user.vpbx_user_uid);
    }
    createGuestToken(uid, dto, req) {
        return this.conferenceRoomsService.createGuestToken(uid, dto, req.user.vpbx_user_uid);
    }
    listGuestTokens(uid, req) {
        return this.conferenceRoomsService.listGuestTokens(uid, req.user.vpbx_user_uid);
    }
    revokeGuestToken(uid, tokenUid, req) {
        return this.conferenceRoomsService.revokeGuestToken(uid, tokenUid, req.user.vpbx_user_uid);
    }
    invite(uid, dto, req) {
        return this.inviteService.invite(uid, req.user, dto);
    }
    async ingestTelemetry(uid, body, req) {
        await this.conferenceRoomsService.assertLiveRoomAccess(uid, req.user);
        const callerRef = await this.conferenceRoomsService.resolveCallerRef(req.user);
        if (!callerRef) {
            throw new common_1.ForbiddenException('Caller identity is not a room participant number');
        }
        return this.telemetryService.ingest(uid, callerRef, body ?? {});
    }
    async getCapacity(uid, req) {
        const room = await this.conferenceRoomsService.findOne(uid, req.user.vpbx_user_uid);
        return { maxParticipants: this.capacityService.capacityForRoom(room) };
    }
    getModerators(uid, req) {
        return this.conferenceRoomsService.getRoomModerators(uid, req.user.vpbx_user_uid);
    }
    setModerators(uid, dto, req) {
        return this.conferenceRoomsService.setRoomModerators(uid, dto, req.user.vpbx_user_uid);
    }
    findOne(uid, req) {
        return this.conferenceRoomsService.findOne(uid, req.user.vpbx_user_uid);
    }
    create(dto, req) {
        return this.conferenceRoomsService.create(dto, req.user.vpbx_user_uid, req.user.sub);
    }
    update(uid, dto, req) {
        return this.conferenceRoomsService.update(uid, dto, req.user.vpbx_user_uid);
    }
    remove(uid, req) {
        return this.conferenceRoomsService.remove(uid, req.user.vpbx_user_uid);
    }
};
exports.ConferenceRoomsController = ConferenceRoomsController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ConferenceRoomsController.prototype, "findAll", null);
__decorate([
    (0, common_1.Post)(':uid/guest-tokens'),
    __param(0, (0, common_1.Param)('uid', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, conference_guest_token_dto_1.CreateConferenceGuestTokenDto, Object]),
    __metadata("design:returntype", void 0)
], ConferenceRoomsController.prototype, "createGuestToken", null);
__decorate([
    (0, common_1.Get)(':uid/guest-tokens'),
    __param(0, (0, common_1.Param)('uid', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], ConferenceRoomsController.prototype, "listGuestTokens", null);
__decorate([
    (0, common_1.Delete)(':uid/guest-tokens/:tokenUid'),
    __param(0, (0, common_1.Param)('uid', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Param)('tokenUid', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number, Object]),
    __metadata("design:returntype", void 0)
], ConferenceRoomsController.prototype, "revokeGuestToken", null);
__decorate([
    (0, common_1.HttpCode)(common_1.HttpStatus.ACCEPTED),
    (0, common_1.Post)(':uid/invite'),
    __param(0, (0, common_1.Param)('uid', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, conference_invite_dto_1.ConferenceInviteDto, Object]),
    __metadata("design:returntype", void 0)
], ConferenceRoomsController.prototype, "invite", null);
__decorate([
    (0, throttler_1.SkipThrottle)({ default: true, global: true }),
    (0, common_1.Post)(':uid/telemetry'),
    __param(0, (0, common_1.Param)('uid', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object, Object]),
    __metadata("design:returntype", Promise)
], ConferenceRoomsController.prototype, "ingestTelemetry", null);
__decorate([
    (0, throttler_1.SkipThrottle)({ default: true, global: true }),
    (0, common_1.Get)(':uid/capacity'),
    __param(0, (0, common_1.Param)('uid', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", Promise)
], ConferenceRoomsController.prototype, "getCapacity", null);
__decorate([
    (0, common_1.Get)(':uid/moderators'),
    __param(0, (0, common_1.Param)('uid', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], ConferenceRoomsController.prototype, "getModerators", null);
__decorate([
    (0, common_1.Put)(':uid/moderators'),
    __param(0, (0, common_1.Param)('uid', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, conference_moderator_dto_1.SetConferenceModeratorsDto, Object]),
    __metadata("design:returntype", void 0)
], ConferenceRoomsController.prototype, "setModerators", null);
__decorate([
    (0, common_1.Get)(':uid'),
    __param(0, (0, common_1.Param)('uid', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], ConferenceRoomsController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_conference_room_dto_1.CreateConferenceRoomDto, Object]),
    __metadata("design:returntype", void 0)
], ConferenceRoomsController.prototype, "create", null);
__decorate([
    (0, common_1.Put)(':uid'),
    __param(0, (0, common_1.Param)('uid', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, update_conference_room_dto_1.UpdateConferenceRoomDto, Object]),
    __metadata("design:returntype", void 0)
], ConferenceRoomsController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':uid'),
    __param(0, (0, common_1.Param)('uid', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], ConferenceRoomsController.prototype, "remove", null);
exports.ConferenceRoomsController = ConferenceRoomsController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('conferences'),
    __metadata("design:paramtypes", [conference_rooms_service_1.ConferenceRoomsService,
        conference_capacity_service_1.ConferenceCapacityService,
        conference_invite_service_1.ConferenceInviteService,
        conference_telemetry_service_1.ConferenceTelemetryService])
], ConferenceRoomsController);
//# sourceMappingURL=conference-rooms.controller.js.map