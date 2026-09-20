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
exports.ConferenceModerationController = void 0;
const common_1 = require("@nestjs/common");
const class_validator_1 = require("class-validator");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const conference_moderation_service_1 = require("./conference-moderation.service");
const conference_rooms_service_1 = require("./conference-rooms.service");
class GrantConferenceRoleDto {
    role;
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['moderator']),
    __metadata("design:type", String)
], GrantConferenceRoleDto.prototype, "role", void 0);
let ConferenceModerationController = class ConferenceModerationController {
    roomsService;
    moderationService;
    constructor(roomsService, moderationService) {
        this.roomsService = roomsService;
        this.moderationService = moderationService;
    }
    async mute(roomUid, ref, req) {
        await this.roomsService.assertLiveRoomAccess(roomUid, req.user);
        return this.moderationService.muteParticipant(roomUid, ref, req.user);
    }
    async unmute(roomUid, ref, req) {
        await this.roomsService.assertLiveRoomAccess(roomUid, req.user);
        return this.moderationService.unmuteParticipant(roomUid, ref, req.user);
    }
    async kick(roomUid, ref, req) {
        await this.roomsService.assertLiveRoomAccess(roomUid, req.user);
        return this.moderationService.kickParticipant(roomUid, ref, req.user);
    }
    async grantRole(roomUid, ref, dto, req) {
        await this.roomsService.assertLiveRoomAccess(roomUid, req.user);
        return this.moderationService.grantRole(roomUid, ref, dto?.role ?? 'moderator', req.user);
    }
    async revokeRole(roomUid, ref, req) {
        await this.roomsService.assertLiveRoomAccess(roomUid, req.user);
        return this.moderationService.revokeRole(roomUid, ref, req.user);
    }
};
exports.ConferenceModerationController = ConferenceModerationController;
__decorate([
    (0, common_1.Post)(':room_uid/participants/:ref/mute'),
    __param(0, (0, common_1.Param)('room_uid', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Param)('ref')),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String, Object]),
    __metadata("design:returntype", Promise)
], ConferenceModerationController.prototype, "mute", null);
__decorate([
    (0, common_1.Post)(':room_uid/participants/:ref/unmute'),
    __param(0, (0, common_1.Param)('room_uid', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Param)('ref')),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String, Object]),
    __metadata("design:returntype", Promise)
], ConferenceModerationController.prototype, "unmute", null);
__decorate([
    (0, common_1.Post)(':room_uid/participants/:ref/kick'),
    __param(0, (0, common_1.Param)('room_uid', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Param)('ref')),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String, Object]),
    __metadata("design:returntype", Promise)
], ConferenceModerationController.prototype, "kick", null);
__decorate([
    (0, common_1.Post)(':room_uid/participants/:ref/role'),
    __param(0, (0, common_1.Param)('room_uid', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Param)('ref')),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String, GrantConferenceRoleDto, Object]),
    __metadata("design:returntype", Promise)
], ConferenceModerationController.prototype, "grantRole", null);
__decorate([
    (0, common_1.Delete)(':room_uid/participants/:ref/role'),
    __param(0, (0, common_1.Param)('room_uid', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Param)('ref')),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String, Object]),
    __metadata("design:returntype", Promise)
], ConferenceModerationController.prototype, "revokeRole", null);
exports.ConferenceModerationController = ConferenceModerationController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('conferences'),
    __metadata("design:paramtypes", [conference_rooms_service_1.ConferenceRoomsService,
        conference_moderation_service_1.ConferenceModerationService])
], ConferenceModerationController);
//# sourceMappingURL=conference-moderation.controller.js.map