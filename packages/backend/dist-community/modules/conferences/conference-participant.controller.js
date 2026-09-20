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
exports.ConferenceParticipantController = void 0;
const common_1 = require("@nestjs/common");
const class_validator_1 = require("class-validator");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const conference_rooms_service_1 = require("./conference-rooms.service");
const conference_state_service_1 = require("./conference-state.service");
const conference_display_name_dto_1 = require("./dto/conference-display-name.dto");
class SetMyVideoDto {
    enabled;
}
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], SetMyVideoDto.prototype, "enabled", void 0);
let ConferenceParticipantController = class ConferenceParticipantController {
    roomsService;
    stateService;
    constructor(roomsService, stateService) {
        this.roomsService = roomsService;
        this.stateService = stateService;
    }
    async setMyVideo(roomUid, dto, req) {
        await this.roomsService.assertLiveRoomAccess(roomUid, req.user);
        const callerRef = await this.roomsService.resolveCallerRef(req.user);
        if (!callerRef) {
            throw new common_1.NotFoundException();
        }
        const self = this.stateService.findLiveParticipant(roomUid, callerRef);
        if (!self) {
            throw new common_1.NotFoundException();
        }
        this.stateService.setVideoState(roomUid, callerRef, Boolean(dto?.enabled));
    }
    async setMyDisplayName(roomUid, dto, req) {
        await this.roomsService.assertLiveRoomAccess(roomUid, req.user);
        const callerRef = await this.roomsService.resolveCallerRef(req.user);
        if (!callerRef) {
            throw new common_1.NotFoundException();
        }
        const self = this.stateService.findLiveParticipant(roomUid, callerRef);
        if (!self) {
            throw new common_1.NotFoundException();
        }
        this.stateService.setDisplayName(roomUid, callerRef, dto.displayName);
    }
};
exports.ConferenceParticipantController = ConferenceParticipantController;
__decorate([
    (0, common_1.Post)(':room_uid/me/video'),
    __param(0, (0, common_1.Param)('room_uid', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, SetMyVideoDto, Object]),
    __metadata("design:returntype", Promise)
], ConferenceParticipantController.prototype, "setMyVideo", null);
__decorate([
    (0, common_1.Post)(':room_uid/me/display-name'),
    __param(0, (0, common_1.Param)('room_uid', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, conference_display_name_dto_1.ConferenceDisplayNameDto, Object]),
    __metadata("design:returntype", Promise)
], ConferenceParticipantController.prototype, "setMyDisplayName", null);
exports.ConferenceParticipantController = ConferenceParticipantController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('conferences'),
    __metadata("design:paramtypes", [conference_rooms_service_1.ConferenceRoomsService,
        conference_state_service_1.ConferenceStateService])
], ConferenceParticipantController);
//# sourceMappingURL=conference-participant.controller.js.map