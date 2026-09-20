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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConferenceModerationService = void 0;
const common_1 = require("@nestjs/common");
const ami_service_1 = require("../ami/ami.service");
const logger_service_1 = require("../logger/logger.service");
const dialplan_target_util_1 = require("../../shared/utils/dialplan-target.util");
const conference_roles_util_1 = require("./conference-roles.util");
const conference_rooms_service_1 = require("./conference-rooms.service");
const conference_state_service_1 = require("./conference-state.service");
let ConferenceModerationService = class ConferenceModerationService {
    roomsService;
    stateService;
    amiService;
    loggerService;
    constructor(roomsService, stateService, amiService, loggerService) {
        this.roomsService = roomsService;
        this.stateService = stateService;
        this.amiService = amiService;
        this.loggerService = loggerService;
    }
    async muteParticipant(roomUid, participantRef, user) {
        await this.assertCanModerate(roomUid, user, 'moderator');
        await this.runAmi(roomUid, participantRef, user, 'ConfbridgeMute');
    }
    async unmuteParticipant(roomUid, participantRef, user) {
        await this.assertCanModerate(roomUid, user, 'moderator');
        await this.runAmi(roomUid, participantRef, user, 'ConfbridgeUnmute');
    }
    async kickParticipant(roomUid, participantRef, user) {
        await this.assertCanModerate(roomUid, user, 'moderator');
        await this.runAmi(roomUid, participantRef, user, 'ConfbridgeKick');
        await this.loggerService.logAction(user.sub, 'conference_kick', 'conference_room', roomUid, user.vpbx_user_uid, `ref=${participantRef}`);
    }
    async grantRole(roomUid, participantRef, role, user) {
        await this.assertCanModerate(roomUid, user, 'owner');
        this.requireParticipant(roomUid, participantRef);
        this.stateService.grantRole(roomUid, participantRef, role);
        await this.loggerService.logAction(user.sub, 'conference_grant_role', 'conference_room', roomUid, user.vpbx_user_uid, `ref=${participantRef} role=${role}`);
    }
    async revokeRole(roomUid, participantRef, user) {
        await this.assertCanModerate(roomUid, user, 'owner');
        this.requireParticipant(roomUid, participantRef);
        this.stateService.revokeRole(roomUid, participantRef);
    }
    async assertCanModerate(roomUid, user, required) {
        const callerRef = await this.roomsService.resolveCallerRef(user);
        if (!callerRef) {
            throw new common_1.ForbiddenException('Caller identity is not a room participant number');
        }
        const rows = await this.roomsService.getRoomModerators(roomUid, user.vpbx_user_uid);
        const ownerRef = rows.find((row) => row.role === 'owner')?.endpointRef ?? null;
        const moderatorRefs = rows
            .filter((row) => row.role === 'moderator')
            .map((row) => row.endpointRef);
        const role = (0, conference_roles_util_1.resolveRoleForCaller)(callerRef, {
            ownerRef,
            moderatorRefs,
            liveGrants: this.stateService.getLiveGrants(roomUid),
        });
        if (required === 'owner' && role !== 'owner') {
            throw new common_1.ForbiddenException('Owner role required');
        }
        if (required === 'moderator' && role !== 'owner' && role !== 'moderator') {
            throw new common_1.ForbiddenException('Moderator role required');
        }
    }
    requireParticipant(roomUid, participantRef) {
        const participant = this.stateService.findLiveParticipant(roomUid, participantRef);
        if (!participant) {
            throw new common_1.NotFoundException(`Participant ${participantRef} is not in the room`);
        }
        return participant;
    }
    async runAmi(roomUid, participantRef, user, action) {
        const participant = this.requireParticipant(roomUid, participantRef);
        const room = await this.roomsService.findOne(roomUid, user.vpbx_user_uid);
        const conference = (0, dialplan_target_util_1.normalizeTarget)('conference', { source: 'fixed', value: String(room.number) }, user.vpbx_user_uid);
        await this.amiService.action({
            action,
            conference,
            channel: participant.channel,
        });
    }
};
exports.ConferenceModerationService = ConferenceModerationService;
exports.ConferenceModerationService = ConferenceModerationService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [conference_rooms_service_1.ConferenceRoomsService,
        conference_state_service_1.ConferenceStateService,
        ami_service_1.AmiService,
        logger_service_1.LoggerService])
], ConferenceModerationService);
//# sourceMappingURL=conference-moderation.service.js.map