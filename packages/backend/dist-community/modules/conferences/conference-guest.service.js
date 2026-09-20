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
var ConferenceGuestService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConferenceGuestService = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const crypto = __importStar(require("crypto"));
const sequelize_2 = require("sequelize");
const ami_service_1 = require("../ami/ami.service");
const endpoints_service_1 = require("../endpoints/endpoints.service");
const dialplan_target_util_1 = require("../../shared/utils/dialplan-target.util");
const conference_capacity_service_1 = require("./conference-capacity.service");
const conference_dialplan_util_1 = require("./conference-dialplan.util");
const conference_entry_policy_util_1 = require("./conference-entry-policy.util");
const conference_rooms_service_1 = require("./conference-rooms.service");
const conference_rooms_service_2 = require("./conference-rooms.service");
const conference_state_service_1 = require("./conference-state.service");
const conference_telemetry_service_1 = require("./conference-telemetry.service");
const conference_participant_dto_1 = require("./dto/conference-participant.dto");
const conference_guest_token_model_1 = require("./models/conference-guest-token.model");
let ConferenceGuestService = ConferenceGuestService_1 = class ConferenceGuestService {
    roomsService;
    stateService;
    endpointsService;
    tokenModel;
    capacityService;
    telemetryService;
    amiService;
    logger = new common_1.Logger(ConferenceGuestService_1.name);
    constructor(roomsService, stateService, endpointsService, tokenModel, capacityService, telemetryService, amiService) {
        this.roomsService = roomsService;
        this.stateService = stateService;
        this.endpointsService = endpointsService;
        this.tokenModel = tokenModel;
        this.capacityService = capacityService;
        this.telemetryService = telemetryService;
        this.amiService = amiService;
    }
    async createToken(roomUid, vpbx, dto) {
        await this.roomsService.findOne(roomUid, vpbx);
        if (dto.kind === 'named_invite' && !String(dto.inviteName ?? '').trim()) {
            throw new common_1.HttpException({ message: 'Invite name is required' }, common_1.HttpStatus.BAD_REQUEST);
        }
        const token = crypto.randomBytes(32).toString('hex');
        const expires_at = dto.ttlSec != null ? new Date(Date.now() + dto.ttlSec * 1000) : null;
        return this.tokenModel.create({
            room_uid: roomUid,
            token,
            kind: dto.kind,
            invite_name: dto.kind === 'named_invite' ? String(dto.inviteName).trim() : null,
            expires_at,
        });
    }
    async listTokens(roomUid, vpbx) {
        await this.roomsService.findOne(roomUid, vpbx);
        return this.tokenModel.findAll({
            where: { room_uid: roomUid },
            order: [
                ['created_at', 'ASC'],
                ['uid', 'ASC'],
            ],
        });
    }
    async getMeta(user) {
        const room = await this.roomsService.findOne(user.roomUid, user.guestVpbxUserUid);
        const policy = (0, conference_entry_policy_util_1.conferenceEntryPolicy)(room);
        const snapshot = this.stateService.getSnapshot(user.roomUid);
        const live = (0, conference_participant_dto_1.toConferenceRoomStateDto)(snapshot);
        const startedAt = snapshot.participants.length > 0
            ? new Date(Math.min(...snapshot.participants.map((p) => p.joinedAt))).toISOString()
            : null;
        return {
            name: room.name,
            entry_strictness: room.entry_strictness,
            requiresPin: policy.requiresPin,
            ...live,
            startedAt,
        };
    }
    async join(user, dto = {}) {
        const room = await this.roomsService.findOne(user.roomUid, user.guestVpbxUserUid);
        const policy = (0, conference_entry_policy_util_1.conferenceEntryPolicy)(room);
        if (policy.requiresPin) {
            const pin = String(dto.pin ?? '').trim();
            if (!pin) {
                throw (0, conference_rooms_service_1.conferenceRoomHttpError)(common_1.HttpStatus.BAD_REQUEST, 'CONFERENCE_PIN_REQUIRED', 'Conference PIN is required');
            }
            if (pin !== policy.pin) {
                throw (0, conference_rooms_service_1.conferenceRoomHttpError)(common_1.HttpStatus.BAD_REQUEST, 'CONFERENCE_PIN_WRONG', 'Conference PIN is wrong');
            }
        }
        const nThis = this.stateService.getSnapshot(room.uid).participants.length;
        const max = this.capacityService.capacityForRoom(room);
        const adminBypass = user.role === 'owner' || user.role === 'moderator';
        if (!adminBypass && nThis + 1 > max) {
            throw (0, conference_rooms_service_1.conferenceRoomHttpError)(common_1.HttpStatus.CONFLICT, 'CONFERENCE_ROOM_FULL', 'Conference room is full');
        }
        const sequelize = this.tokenModel.sequelize;
        if (sequelize?.transaction) {
            return sequelize.transaction((transaction) => this.admitLocked(user, dto, room, max, transaction));
        }
        return this.admitLocked(user, dto, room, max, null);
    }
    async revoke(roomUid, tokenUid, vpbx) {
        const room = await this.roomsService.findOne(roomUid, vpbx);
        const token = await this.tokenModel.findOne({
            where: { uid: tokenUid, room_uid: roomUid },
        });
        if (!token) {
            throw (0, conference_rooms_service_1.conferenceRoomHttpError)(common_1.HttpStatus.NOT_FOUND, 'CONFERENCE_GUEST_TOKEN_INVALID', 'Guest token not found', { tokenUid });
        }
        await token.update({ revoked_at: new Date() });
        const sipId = token.sip_id;
        if (!sipId)
            return;
        const conference = (0, dialplan_target_util_1.normalizeTarget)('conference', { source: 'fixed', value: String(room.number) }, vpbx);
        const channels = await this.resolveGuestChannels(roomUid, sipId);
        await this.kickGuestChannels(conference, channels);
        try {
            await this.endpointsService.destroyEphemeralGuestEndpoint(sipId, vpbx);
        }
        catch (err) {
            this.logger.warn(`destroyEphemeralGuestEndpoint failed during revoke: ${err?.message || err}`);
        }
        await token.update({ sip_id: null });
    }
    async leave(user) {
        const token = await this.tokenModel.findByPk(user.guestTokenUid);
        if (!token) {
            throw (0, conference_rooms_service_1.conferenceRoomHttpError)(common_1.HttpStatus.UNAUTHORIZED, 'CONFERENCE_GUEST_TOKEN_INVALID', 'Guest token invalid');
        }
        const sipId = token.sip_id;
        if (!sipId)
            return;
        try {
            await this.endpointsService.destroyEphemeralGuestEndpoint(sipId, user.guestVpbxUserUid);
        }
        catch (err) {
            this.logger.warn(`destroyEphemeralGuestEndpoint failed during leave: ${err?.message || err}`);
        }
        await token.update({ sip_id: null });
    }
    async setDisplayName(user, dto) {
        const token = await this.tokenModel.findByPk(user.guestTokenUid);
        if (!token) {
            throw (0, conference_rooms_service_1.conferenceRoomHttpError)(common_1.HttpStatus.UNAUTHORIZED, 'CONFERENCE_GUEST_TOKEN_INVALID', 'Guest token invalid');
        }
        const displayName = (0, conference_participant_dto_1.truncateDisplayName)(String(dto.displayName ?? '').trim());
        if (!displayName) {
            throw (0, conference_rooms_service_1.conferenceRoomHttpError)(common_1.HttpStatus.BAD_REQUEST, 'CONFERENCE_DISPLAY_NAME_REQUIRED', 'Display name is required');
        }
        await token.update({ display_name: displayName });
        if (token.sip_id) {
            this.stateService.rememberDisplayName(user.roomUid, token.sip_id, displayName);
            this.stateService.setDisplayName(user.roomUid, token.sip_id, displayName);
        }
    }
    async ingestTelemetry(user, raw) {
        const token = await this.tokenModel.findByPk(user.guestTokenUid);
        if (!token) {
            throw (0, conference_rooms_service_1.conferenceRoomHttpError)(common_1.HttpStatus.UNAUTHORIZED, 'CONFERENCE_GUEST_TOKEN_INVALID', 'Guest token invalid');
        }
        const ref = token.sip_id;
        if (!ref)
            return {};
        return this.telemetryService.ingest(user.roomUid, ref, raw ?? {});
    }
    async admitLocked(user, dto, room, max, transaction) {
        const token = await this.tokenModel.findByPk(user.guestTokenUid, {
            ...(transaction ? { transaction, lock: sequelize_2.Transaction.LOCK.UPDATE } : {}),
        });
        this.assertTokenLive(token);
        const requested = String(dto.displayName ?? '').trim();
        const saved = String(token.display_name ?? '').trim();
        if (!requested && !saved) {
            throw (0, conference_rooms_service_1.conferenceRoomHttpError)(common_1.HttpStatus.BAD_REQUEST, 'CONFERENCE_DISPLAY_NAME_REQUIRED', 'Display name is required');
        }
        const displayName = (0, conference_participant_dto_1.truncateDisplayName)(requested || saved);
        const password = this.endpointsService.generateSipPassword();
        const sipId = `gst${crypto.randomBytes(4).toString('hex')}`;
        if (token.sip_id) {
            await this.endpointsService.destroyEphemeralGuestEndpoint(token.sip_id, user.guestVpbxUserUid);
        }
        await this.endpointsService.createEphemeralGuestEndpoint({
            sipId,
            password,
            context: (0, conference_dialplan_util_1.conferenceRoomContextName)(room.uid),
            vpbx: user.guestVpbxUserUid,
            maxVideoStreams: max,
        });
        const payload = { sip_id: sipId, display_name: displayName };
        if (transaction) {
            await token.update(payload, { transaction });
        }
        else {
            await token.update(payload);
        }
        this.stateService.rememberDisplayName(room.uid, sipId, displayName);
        return {
            sipId,
            password,
            sipDomain: process.env.SIP_DOMAIN || null,
            roomUid: room.uid,
        };
    }
    assertTokenLive(token) {
        if (!token) {
            throw (0, conference_rooms_service_1.conferenceRoomHttpError)(common_1.HttpStatus.UNAUTHORIZED, 'CONFERENCE_GUEST_TOKEN_INVALID', 'Guest token invalid');
        }
        if (token.revoked_at != null) {
            throw (0, conference_rooms_service_1.conferenceRoomHttpError)(common_1.HttpStatus.UNAUTHORIZED, 'CONFERENCE_GUEST_TOKEN_REVOKED', 'Guest token revoked');
        }
        if (token.expires_at != null && token.expires_at < new Date()) {
            throw (0, conference_rooms_service_1.conferenceRoomHttpError)(common_1.HttpStatus.UNAUTHORIZED, 'CONFERENCE_GUEST_TOKEN_EXPIRED', 'Guest token expired');
        }
    }
    async resolveGuestChannels(roomUid, sipId) {
        const live = this.stateService.findLiveParticipant(roomUid, sipId)?.channel;
        if (live)
            return [live];
        if (!this.amiService?.getActiveChannels)
            return [];
        try {
            const { events } = await this.amiService.getActiveChannels();
            const prefix = `PJSIP/${sipId}`;
            return [...new Set(events
                    .map((evt) => String(evt.channel || evt.Channel || ''))
                    .filter((ch) => ch === prefix || ch.startsWith(`${prefix}-`)))];
        }
        catch (err) {
            this.logger.warn(`getActiveChannels during revoke failed: ${err?.message || err}`);
            return [];
        }
    }
    async kickGuestChannels(conference, channels) {
        if (!this.amiService || channels.length === 0)
            return;
        for (const channel of channels) {
            try {
                await this.amiService.action({
                    action: 'ConfbridgeKick',
                    conference,
                    channel,
                });
            }
            catch (err) {
                this.logger.warn(`ConfbridgeKick failed during revoke: ${err?.message || err}`);
                try {
                    await this.amiService.hangup(channel);
                }
                catch (hangErr) {
                    this.logger.warn(`Hangup after Kick failed: ${hangErr?.message || hangErr}`);
                }
            }
        }
    }
};
exports.ConferenceGuestService = ConferenceGuestService;
exports.ConferenceGuestService = ConferenceGuestService = ConferenceGuestService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)((0, common_1.forwardRef)(() => conference_rooms_service_2.ConferenceRoomsService))),
    __param(3, (0, sequelize_1.InjectModel)(conference_guest_token_model_1.ConferenceGuestToken)),
    __param(4, (0, common_1.Inject)((0, common_1.forwardRef)(() => conference_capacity_service_1.ConferenceCapacityService))),
    __metadata("design:paramtypes", [conference_rooms_service_2.ConferenceRoomsService,
        conference_state_service_1.ConferenceStateService,
        endpoints_service_1.EndpointsService, Object, conference_capacity_service_1.ConferenceCapacityService,
        conference_telemetry_service_1.ConferenceTelemetryService,
        ami_service_1.AmiService])
], ConferenceGuestService);
//# sourceMappingURL=conference-guest.service.js.map