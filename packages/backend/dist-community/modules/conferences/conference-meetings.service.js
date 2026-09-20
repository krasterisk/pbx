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
exports.ConferenceMeetingsService = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const cdr_service_1 = require("../reports/cdr/cdr.service");
const conference_rooms_service_1 = require("./conference-rooms.service");
const conference_state_service_1 = require("./conference-state.service");
const conference_meeting_model_1 = require("./models/conference-meeting.model");
const conference_meeting_participant_model_1 = require("./models/conference-meeting-participant.model");
function amiString(evt, ...names) {
    const lower = new Map();
    for (const [key, value] of Object.entries(evt ?? {})) {
        lower.set(key.toLowerCase(), value);
    }
    for (const name of names) {
        const value = lower.get(name.toLowerCase());
        if (value != null && String(value).trim() !== '')
            return String(value);
    }
    return '';
}
let ConferenceMeetingsService = class ConferenceMeetingsService {
    meetings;
    participants;
    roomsService;
    stateService;
    cdrService;
    roomTails = new Map();
    constructor(meetings, participants, roomsService, stateService, cdrService) {
        this.meetings = meetings;
        this.participants = participants;
        this.roomsService = roomsService;
        this.stateService = stateService;
        this.cdrService = cdrService;
    }
    async currentMeeting(roomUid) {
        return this.meetings.findOne({
            where: { room_uid: roomUid, ended_at: null },
        });
    }
    async getByRoom(roomUid, meetingUid) {
        const meeting = await this.meetings.findOne({
            where: { uid: meetingUid, room_uid: roomUid },
        });
        if (!meeting) {
            throw new common_1.NotFoundException('Conference meeting not found');
        }
        return meeting;
    }
    async beginMeeting(roomUid, vpbx, evt) {
        const room = await this.roomsService.findOne(roomUid, vpbx);
        return this.enqueue(roomUid, async () => {
            let meeting = await this.currentMeeting(roomUid);
            const isFirstJoin = !meeting;
            if (!meeting) {
                meeting = await this.meetings.create({
                    room_uid: roomUid,
                    started_at: new Date(),
                    ended_at: null,
                    has_recording: false,
                    recording_file_rel: null,
                });
            }
            const callerIdNum = amiString(evt, 'CallerIDNum');
            const channel = amiString(evt, 'Channel');
            const uniqueid = amiString(evt, 'Uniqueid', 'uniqueid') || null;
            const live = this.stateService?.findLiveParticipant(roomUid, callerIdNum || channel);
            const role = live?.role ?? 'participant';
            await this.participants.create({
                meeting_uid: meeting.uid,
                display_name: callerIdNum || 'Participant',
                role,
                is_guest: false,
                joined_at: new Date(),
                left_at: null,
                uniqueid,
                caller_id_num: callerIdNum || null,
                channel: channel || null,
            });
            return { meeting, room, isFirstJoin };
        });
    }
    async markParticipantLeft(roomUid, keys) {
        return this.enqueue(roomUid, async () => {
            const meeting = await this.currentMeeting(roomUid);
            if (!meeting)
                return;
            const rows = await this.participants.findAll({
                where: { meeting_uid: meeting.uid },
            });
            const uniqueid = keys.uniqueid?.trim() || '';
            const channel = keys.channel?.trim() || '';
            const callerIdNum = keys.callerIdNum?.trim() || '';
            for (const row of rows) {
                if (row.left_at)
                    continue;
                const rowUnique = String(row.uniqueid ?? '').trim();
                const rowChannel = String(row.channel ?? '').trim();
                const rowCaller = String(row.caller_id_num ?? '').trim();
                if ((uniqueid && rowUnique === uniqueid) ||
                    (channel && rowChannel === channel) ||
                    (callerIdNum && rowCaller === callerIdNum)) {
                    await row.update({ left_at: new Date() });
                }
            }
        });
    }
    async listParticipantUniqueids(meetingUid) {
        const parts = await this.participants.findAll({
            where: { meeting_uid: meetingUid },
        });
        return parts
            .map((row) => String(row.uniqueid ?? '').trim())
            .filter(Boolean);
    }
    async listByRoom(roomUid, vpbx) {
        await this.roomsService.findOne(roomUid, vpbx);
        const meetings = await this.meetings.findAll({
            where: { room_uid: roomUid },
            order: [['uid', 'DESC']],
        });
        const result = [];
        for (const meeting of meetings) {
            const parts = await this.participants.findAll({
                where: { meeting_uid: meeting.uid },
            });
            result.push({
                uid: meeting.uid,
                room_uid: meeting.room_uid,
                started_at: meeting.started_at,
                ended_at: meeting.ended_at,
                has_recording: meeting.has_recording,
                recording_file_rel: meeting.recording_file_rel,
                participants: parts.map((row) => ({
                    display_name: row.display_name,
                    role: row.role,
                    joined_at: row.joined_at,
                    left_at: row.left_at,
                    caller_id_num: row.caller_id_num,
                })),
            });
        }
        return result;
    }
    async findRecordingsByUniqueids(vpbx, uniqueids, viewerUserId) {
        const found = [];
        for (const raw of uniqueids) {
            const id = String(raw ?? '').trim();
            if (!id)
                continue;
            if (this.cdrService) {
                try {
                    await this.cdrService.findByUniqueid(vpbx, id, viewerUserId);
                }
                catch {
                    continue;
                }
            }
            const parts = await this.participants.findAll({ where: { uniqueid: id } });
            for (const part of parts) {
                const meeting = await this.meetings.findOne({ where: { uid: part.meeting_uid } });
                if (!meeting || (!meeting.has_recording && !meeting.recording_file_rel))
                    continue;
                try {
                    await this.roomsService.findOne(meeting.room_uid, vpbx);
                }
                catch {
                    continue;
                }
                found.push({
                    uniqueid: id,
                    meetingUid: meeting.uid,
                    roomUid: meeting.room_uid,
                    playPath: `/conferences/${meeting.room_uid}/meetings/${meeting.uid}/play`,
                });
                break;
            }
        }
        return found;
    }
    async endMeeting(roomUid) {
        return this.enqueue(roomUid, async () => {
            const open = await this.currentMeeting(roomUid);
            if (open) {
                if (!open.ended_at) {
                    await open.update({ ended_at: new Date() });
                }
                return open;
            }
            return this.meetings.findOne({
                where: { room_uid: roomUid },
                order: [['uid', 'DESC']],
            });
        });
    }
    enqueue(roomUid, fn) {
        const prev = this.roomTails.get(roomUid) ?? Promise.resolve();
        const next = prev.catch(() => undefined).then(fn);
        this.roomTails.set(roomUid, next);
        return next;
    }
};
exports.ConferenceMeetingsService = ConferenceMeetingsService;
exports.ConferenceMeetingsService = ConferenceMeetingsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, sequelize_1.InjectModel)(conference_meeting_model_1.ConferenceMeeting)),
    __param(1, (0, sequelize_1.InjectModel)(conference_meeting_participant_model_1.ConferenceMeetingParticipant)),
    __param(3, (0, common_1.Optional)()),
    __param(4, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [Object, Object, conference_rooms_service_1.ConferenceRoomsService,
        conference_state_service_1.ConferenceStateService,
        cdr_service_1.CdrService])
], ConferenceMeetingsService);
//# sourceMappingURL=conference-meetings.service.js.map