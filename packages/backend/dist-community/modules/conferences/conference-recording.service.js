"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConferenceRecordingService = void 0;
const common_1 = require("@nestjs/common");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const ami_service_1 = require("../ami/ami.service");
const logger_service_1 = require("../logger/logger.service");
const cdr_service_1 = require("../reports/cdr/cdr.service");
const system_settings_service_1 = require("../system-settings/system-settings.service");
const dialplan_target_util_1 = require("../../shared/utils/dialplan-target.util");
const conference_meetings_service_1 = require("./conference-meetings.service");
const conference_moderation_service_1 = require("./conference-moderation.service");
const conference_recording_path_util_1 = require("./conference-recording-path.util");
const conference_rooms_service_1 = require("./conference-rooms.service");
const conference_state_service_1 = require("./conference-state.service");
let ConferenceRecordingService = class ConferenceRecordingService {
    amiService;
    systemSettings;
    stateService;
    roomsService;
    meetingsService;
    loggerService;
    moderationService;
    cdrService;
    constructor(amiService, systemSettings, stateService, roomsService, meetingsService, loggerService, moderationService, cdrService) {
        this.amiService = amiService;
        this.systemSettings = systemSettings;
        this.stateService = stateService;
        this.roomsService = roomsService;
        this.meetingsService = meetingsService;
        this.loggerService = loggerService;
        this.moderationService = moderationService;
        this.cdrService = cdrService;
    }
    async startByModerator(roomUid, user, _body) {
        await this.moderationService?.assertCanModerate(roomUid, user, 'moderator');
        const room = await this.roomsService.findOne(roomUid, user.vpbx_user_uid);
        const mode = room.record_mode;
        if (mode !== 'button' && mode !== 'both') {
            throw new common_1.ForbiddenException('Recording button is not available for this room');
        }
        if (this.stateService.getSnapshot(roomUid).recording)
            return;
        let current = await this.meetingsService.currentMeeting(roomUid);
        if (!current) {
            if (!this.stateService.getRoomIdentity(roomUid)) {
                throw new common_1.NotFoundException('Conference room is not live');
            }
            const live = this.stateService.getSnapshot(roomUid).participants;
            if (live.length === 0) {
                throw new common_1.ConflictException('Conference room has no live meeting');
            }
            for (const participant of live) {
                current = (await this.meetingsService.beginMeeting(roomUid, user.vpbx_user_uid, {
                    Channel: participant.channel,
                    CallerIDNum: participant.callerIdNum,
                })).meeting;
            }
        }
        if (!current) {
            throw new common_1.ConflictException('Conference room has no live meeting');
        }
        await this.startForMeeting(room, current, user);
        await this.loggerService?.logAction(user.sub, 'conference_record_start', 'conference_room', roomUid, user.vpbx_user_uid, '');
    }
    async stopByModerator(roomUid, user) {
        await this.moderationService?.assertCanModerate(roomUid, user, 'moderator');
        await this.stopForRoom(roomUid, user);
        await this.loggerService?.logAction(user.sub, 'conference_record_stop', 'conference_room', roomUid, user.vpbx_user_uid, '');
    }
    async stopForRoom(roomUid, userLike) {
        if (!this.stateService.getSnapshot(roomUid).recording)
            return;
        const identity = this.stateService.getRoomIdentity(roomUid);
        const vpbx = userLike?.vpbx_user_uid ?? identity?.vpbx;
        const number = identity?.number;
        if (!number || vpbx == null) {
            throw new common_1.NotFoundException('Conference room is not live');
        }
        const conference = (0, dialplan_target_util_1.normalizeTarget)('conference', { source: 'fixed', value: String(number) }, vpbx);
        await this.amiService.action({
            action: 'ConfbridgeStopRecord',
            conference,
        });
        this.stateService.setRecording(roomUid, false);
    }
    async startForMeeting(room, meeting, userLike) {
        if (this.stateService.getSnapshot(room.uid).recording)
            return;
        const cfg = await this.systemSettings.getServerConfigRaw();
        const base = cfg.records_base_path || '/usr/records';
        const rel = (0, conference_recording_path_util_1.conferenceRecordingRel)(userLike.vpbx_user_uid, room.uid, meeting.uid);
        const dir = path.join(base, String(userLike.vpbx_user_uid), 'conferences', String(room.uid));
        await fs.promises.mkdir(dir, { recursive: true });
        const conference = (0, dialplan_target_util_1.normalizeTarget)('conference', { source: 'fixed', value: String(room.number) }, userLike.vpbx_user_uid);
        try {
            await this.amiService.action({
                action: 'ConfbridgeStartRecord',
                conference,
                recordFile: path.join(base, rel),
            });
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err ?? '');
            if (!/already recording/i.test(msg))
                throw err;
        }
        await meeting.update({
            recording_file_rel: rel,
            has_recording: true,
        });
        this.stateService.setRecording(room.uid, true);
    }
    async streamMeeting(roomUid, meetingUid, vpbx, req, res, viewerUserId) {
        await this.roomsService.findOne(roomUid, vpbx);
        const meeting = await this.meetingsService.getByRoom(roomUid, meetingUid);
        if (!viewerUserId || !this.cdrService) {
            throw new common_1.NotFoundException('Conference recording not found');
        }
        const uniqueids = await this.meetingsService.listParticipantUniqueids(meeting.uid);
        let visible = false;
        for (const uniqueid of uniqueids) {
            try {
                await this.cdrService.findByUniqueid(vpbx, uniqueid, viewerUserId);
                visible = true;
                break;
            }
            catch {
                // Same voicemail requireVisibleRow: hidden uniqueid is not a leak.
            }
        }
        if (!visible) {
            throw new common_1.NotFoundException('Conference recording not found');
        }
        const cfg = await this.systemSettings.getServerConfigRaw();
        const base = cfg.records_base_path || '/usr/records';
        const expected = (0, conference_recording_path_util_1.conferenceRecordingRel)(vpbx, roomUid, meetingUid);
        const stored = String(meeting.recording_file_rel ?? '');
        if (stored !== expected) {
            throw new common_1.NotFoundException('Conference recording not found');
        }
        const filePath = (0, conference_recording_path_util_1.safeConferenceRecordingPath)(base, expected);
        if (!filePath) {
            throw new common_1.NotFoundException('Conference recording not found');
        }
        await this.streamWavFile(filePath, String(meeting.uid), req, res);
    }
    async streamWavFile(filePath, uniqueid, req, res) {
        let fileSize;
        try {
            fileSize = (await fs.promises.stat(filePath)).size;
        }
        catch {
            throw new common_1.NotFoundException('Conference recording not found');
        }
        const download = req?.query?.download === '1' || req?.query?.download === 'true';
        const safeName = String(uniqueid).replace(/[^\w.-]+/g, '_');
        const disposition = download ? `attachment; filename="${safeName}.wav"` : 'inline';
        res.setHeader('Content-Type', 'audio/wav');
        res.setHeader('Content-Disposition', disposition);
        res.setHeader('Accept-Ranges', 'bytes');
        const rangeHeader = req?.headers?.range;
        if (rangeHeader) {
            const match = /^bytes=(\d*)-(\d*)$/i.exec(String(rangeHeader).trim());
            if (!match) {
                res.status(416).setHeader('Content-Range', `bytes */${fileSize}`);
                res.end();
                return;
            }
            let start;
            let end;
            if (match[1] === '' && match[2]) {
                const suffix = parseInt(match[2], 10);
                start = Math.max(fileSize - suffix, 0);
                end = fileSize - 1;
            }
            else {
                start = match[1] ? parseInt(match[1], 10) : 0;
                end = match[2] ? parseInt(match[2], 10) : fileSize - 1;
            }
            if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= fileSize) {
                res.status(416).setHeader('Content-Range', `bytes */${fileSize}`);
                res.end();
                return;
            }
            end = Math.min(end, fileSize - 1);
            const chunkSize = end - start + 1;
            res.status(206);
            res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
            res.setHeader('Content-Length', chunkSize);
            const stream = fs.createReadStream(filePath, { start, end });
            stream.on('error', () => {
                if (!res.headersSent)
                    res.status(404).end();
            });
            stream.pipe(res);
            return;
        }
        res.setHeader('Content-Length', fileSize);
        const stream = fs.createReadStream(filePath);
        stream.on('error', () => {
            if (!res.headersSent)
                res.status(404).end();
        });
        stream.pipe(res);
    }
};
exports.ConferenceRecordingService = ConferenceRecordingService;
exports.ConferenceRecordingService = ConferenceRecordingService = __decorate([
    (0, common_1.Injectable)(),
    __param(5, (0, common_1.Optional)()),
    __param(6, (0, common_1.Optional)()),
    __param(7, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [ami_service_1.AmiService,
        system_settings_service_1.SystemSettingsService,
        conference_state_service_1.ConferenceStateService,
        conference_rooms_service_1.ConferenceRoomsService,
        conference_meetings_service_1.ConferenceMeetingsService,
        logger_service_1.LoggerService,
        conference_moderation_service_1.ConferenceModerationService,
        cdr_service_1.CdrService])
], ConferenceRecordingService);
//# sourceMappingURL=conference-recording.service.js.map