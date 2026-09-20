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
exports.ConferenceInviteService = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const ami_service_1 = require("../ami/ami.service");
const endpoint_ids_util_1 = require("../endpoints/endpoint-ids.util");
const ps_endpoint_model_1 = require("../endpoints/ps-endpoint.model");
const logger_service_1 = require("../logger/logger.service");
const conference_dialplan_util_1 = require("./conference-dialplan.util");
const conference_roles_util_1 = require("./conference-roles.util");
const conference_rooms_service_1 = require("./conference-rooms.service");
const conference_rooms_service_2 = require("./conference-rooms.service");
const conference_state_service_1 = require("./conference-state.service");
let ConferenceInviteService = class ConferenceInviteService {
    roomsService;
    amiService;
    loggerService;
    endpointModel;
    stateService;
    constructor(roomsService, amiService, loggerService, endpointModel, stateService) {
        this.roomsService = roomsService;
        this.amiService = amiService;
        this.loggerService = loggerService;
        this.endpointModel = endpointModel;
        this.stateService = stateService;
    }
    async invite(roomUid, user, dto) {
        await this.roomsService.assertLiveRoomAccess(roomUid, user);
        const room = (await this.roomsService.findOne(roomUid, user.vpbx_user_uid));
        if (dto.kind === 'internal') {
            return this.inviteInternal(room, user, dto.target);
        }
        return this.inviteExternal(room, user, dto.target);
    }
    async inviteInternal(room, user, target) {
        const raw = String(target ?? '');
        if (/gst/i.test(raw)) {
            throw new common_1.BadRequestException('Guest endpoints cannot be invited');
        }
        const exten = raw.trim();
        if (!/^\d+$/.test(exten)) {
            throw new common_1.BadRequestException('Internal invite target must be an extension');
        }
        const vpbx = user.vpbx_user_uid;
        const primaryId = (0, endpoint_ids_util_1.buildSipId)(vpbx, exten);
        const companionId = (0, endpoint_ids_util_1.buildWebrtcSipId)(vpbx, exten);
        const primary = await this.endpointModel.findOne({ where: { id: primaryId } });
        const sipId = primary
            ? primaryId
            : (await this.endpointModel.findOne({ where: { id: companionId } }))
                ? companionId
                : null;
        if (!sipId) {
            throw new common_1.NotFoundException(`Endpoint ${exten} not found`);
        }
        if (sipId.startsWith('gst')) {
            throw new common_1.BadRequestException('Guest endpoints cannot be invited');
        }
        const channel = `PJSIP/${sipId}`;
        await this.originateIntoRoom(room, channel);
        await this.loggerService.logAction(user.sub, 'conference.invite.internal', 'conference_room', room.uid, vpbx, target);
        return { accepted: true };
    }
    async inviteExternal(room, user, target) {
        await this.assertCanInviteExternal(room, user);
        const digits = (target || '').replace(/[^\d+*#]/g, '');
        if (!digits) {
            throw new common_1.BadRequestException('Target is required');
        }
        const vpbx = user.vpbx_user_uid;
        const channel = `Local/${digits}@from-internal${vpbx}`;
        await this.originateIntoRoom(room, channel);
        await this.loggerService.logAction(user.sub, 'conference.invite.external', 'conference_room', room.uid, vpbx, target);
        return { accepted: true };
    }
    async assertCanInviteExternal(room, user) {
        if (room.invite_external_scope === 'anyone') {
            return;
        }
        const callerRef = await this.roomsService.resolveCallerRef(user);
        if (!callerRef) {
            throw (0, conference_rooms_service_1.conferenceRoomHttpError)(common_1.HttpStatus.FORBIDDEN, 'CONFERENCE_INVITE_EXTERNAL_FORBIDDEN', 'External invite is not allowed for this role');
        }
        const rows = await this.roomsService.getRoomModerators(room.uid, user.vpbx_user_uid);
        const ownerRef = rows.find((row) => row.role === 'owner')?.endpointRef ?? null;
        const moderatorRefs = rows
            .filter((row) => row.role === 'moderator')
            .map((row) => row.endpointRef);
        const role = (0, conference_roles_util_1.resolveRoleForCaller)(callerRef, {
            ownerRef,
            moderatorRefs,
            liveGrants: this.stateService.getLiveGrants(room.uid),
        });
        if (room.invite_external_scope === 'owner' && role !== 'owner') {
            throw (0, conference_rooms_service_1.conferenceRoomHttpError)(common_1.HttpStatus.FORBIDDEN, 'CONFERENCE_INVITE_EXTERNAL_FORBIDDEN', 'External invite is not allowed for this role');
        }
        if (room.invite_external_scope === 'moderator' &&
            role !== 'owner' &&
            role !== 'moderator') {
            throw (0, conference_rooms_service_1.conferenceRoomHttpError)(common_1.HttpStatus.FORBIDDEN, 'CONFERENCE_INVITE_EXTERNAL_FORBIDDEN', 'External invite is not allowed for this role');
        }
    }
    async originateIntoRoom(room, channel) {
        try {
            await this.amiService.originate(channel, `"${room.name}" <${room.number}>`, (0, conference_dialplan_util_1.conferenceRoomContextName)(room.uid), 's', '1');
        }
        catch {
            throw (0, conference_rooms_service_1.conferenceRoomHttpError)(common_1.HttpStatus.BAD_GATEWAY, 'CONFERENCE_INVITE_FAILED', 'Failed to originate invite');
        }
    }
};
exports.ConferenceInviteService = ConferenceInviteService;
exports.ConferenceInviteService = ConferenceInviteService = __decorate([
    (0, common_1.Injectable)(),
    __param(3, (0, sequelize_1.InjectModel)(ps_endpoint_model_1.PsEndpoint)),
    __metadata("design:paramtypes", [conference_rooms_service_2.ConferenceRoomsService,
        ami_service_1.AmiService,
        logger_service_1.LoggerService, Object, conference_state_service_1.ConferenceStateService])
], ConferenceInviteService);
//# sourceMappingURL=conference-invite.service.js.map