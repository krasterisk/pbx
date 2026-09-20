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
exports.ConferenceEphemeralService = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const sequelize_2 = require("sequelize");
const dialplan_target_util_1 = require("../../shared/utils/dialplan-target.util");
const conference_dialplan_util_1 = require("./conference-dialplan.util");
const conference_rooms_service_1 = require("./conference-rooms.service");
const conference_state_service_1 = require("./conference-state.service");
const conference_meeting_model_1 = require("./models/conference-meeting.model");
const conference_room_model_1 = require("./models/conference-room.model");
let ConferenceEphemeralService = class ConferenceEphemeralService {
    roomsService;
    roomModel;
    meetingModel;
    stateService;
    constructor(roomsService, roomModel, meetingModel, stateService) {
        this.roomsService = roomsService;
        this.roomModel = roomModel;
        this.meetingModel = meetingModel;
        this.stateService = stateService;
    }
    async ensureRoomForCall(uniqueid, vpbx, createdBy = null) {
        const number = String(uniqueid ?? '')
            .replace(/\D/g, '')
            .slice(0, 32);
        if (!number) {
            throw (0, conference_rooms_service_1.conferenceRoomHttpError)(common_1.HttpStatus.BAD_REQUEST, 'CONFERENCE_NUMBER_INVALID', 'Conference uniqueid must contain at least one digit', { uniqueid: String(uniqueid ?? '') });
        }
        const existing = await this.roomModel.findOne({
            where: { user_uid: vpbx, number },
        });
        if (existing)
            return this.toHandle(existing, vpbx);
        try {
            const room = await this.roomsService.create({
                number,
                name: number,
                kind: 'ephemeral',
                entry_strictness: 'token_name',
            }, vpbx, createdBy);
            return this.toHandle(room, vpbx);
        }
        catch (e) {
            if (this.isNumberTaken(e)) {
                const raced = await this.roomModel.findOne({
                    where: { user_uid: vpbx, number },
                });
                if (raced)
                    return this.toHandle(raced, vpbx);
            }
            throw e;
        }
    }
    async collectIfEmpty(roomUid) {
        const room = await this.roomModel.findOne({ where: { uid: roomUid } });
        if (!room || room.kind !== 'ephemeral')
            return;
        if (this.stateService.getSnapshot(roomUid).participants.length > 0)
            return;
        const journalCount = await this.meetingModel.count({ where: { room_uid: roomUid } });
        if (journalCount > 0)
            return;
        await this.roomsService.remove(roomUid, room.user_uid);
    }
    toHandle(room, vpbx) {
        return {
            roomUid: room.uid,
            contextName: (0, conference_dialplan_util_1.conferenceRoomContextName)(room.uid),
            asteriskName: (0, dialplan_target_util_1.normalizeTarget)('conference', { source: 'fixed', value: room.number }, vpbx),
        };
    }
    isNumberTaken(e) {
        if (e instanceof sequelize_2.UniqueConstraintError)
            return true;
        if (e?.name === 'SequelizeUniqueConstraintError')
            return true;
        if (e instanceof common_1.HttpException) {
            const body = e.getResponse();
            return typeof body === 'object' && body !== null && body.code === 'CONFERENCE_NUMBER_TAKEN';
        }
        return false;
    }
};
exports.ConferenceEphemeralService = ConferenceEphemeralService;
exports.ConferenceEphemeralService = ConferenceEphemeralService = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, sequelize_1.InjectModel)(conference_room_model_1.ConferenceRoom)),
    __param(2, (0, sequelize_1.InjectModel)(conference_meeting_model_1.ConferenceMeeting)),
    __metadata("design:paramtypes", [conference_rooms_service_1.ConferenceRoomsService, Object, Object, conference_state_service_1.ConferenceStateService])
], ConferenceEphemeralService);
//# sourceMappingURL=conference-ephemeral.service.js.map