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
exports.ConferenceGuestTokenGuard = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const conference_rooms_service_1 = require("./conference-rooms.service");
const conference_guest_token_model_1 = require("./models/conference-guest-token.model");
const conference_room_model_1 = require("./models/conference-room.model");
/**
 * Opaque guest-token gate for /conferences/guest/:token.
 * req.user is the six guest keys only — never sub/level (Pitfall 5).
 */
let ConferenceGuestTokenGuard = class ConferenceGuestTokenGuard {
    tokenModel;
    roomModel;
    constructor(tokenModel, roomModel) {
        this.tokenModel = tokenModel;
        this.roomModel = roomModel;
    }
    async canActivate(context) {
        const req = context.switchToHttp().getRequest();
        const token = req.params?.token;
        if (!token || typeof token !== 'string') {
            throw (0, conference_rooms_service_1.conferenceRoomHttpError)(common_1.HttpStatus.UNAUTHORIZED, 'CONFERENCE_GUEST_TOKEN_INVALID', 'Guest token invalid');
        }
        const row = await this.tokenModel.findOne({ where: { token } });
        if (!row) {
            throw (0, conference_rooms_service_1.conferenceRoomHttpError)(common_1.HttpStatus.UNAUTHORIZED, 'CONFERENCE_GUEST_TOKEN_INVALID', 'Guest token invalid');
        }
        if (row.revoked_at != null) {
            throw (0, conference_rooms_service_1.conferenceRoomHttpError)(common_1.HttpStatus.UNAUTHORIZED, 'CONFERENCE_GUEST_TOKEN_REVOKED', 'Guest token revoked');
        }
        if (row.expires_at != null && row.expires_at < new Date()) {
            throw (0, conference_rooms_service_1.conferenceRoomHttpError)(common_1.HttpStatus.UNAUTHORIZED, 'CONFERENCE_GUEST_TOKEN_EXPIRED', 'Guest token expired');
        }
        const room = await this.roomModel.findOne({ where: { uid: row.room_uid } });
        if (!room) {
            throw (0, conference_rooms_service_1.conferenceRoomHttpError)(common_1.HttpStatus.UNAUTHORIZED, 'CONFERENCE_GUEST_TOKEN_INVALID', 'Guest token invalid');
        }
        req.user = {
            isGuest: true,
            roomUid: row.room_uid,
            guestTokenUid: row.uid,
            tokenKind: row.kind,
            inviteName: row.invite_name,
            guestVpbxUserUid: room.user_uid,
        };
        row.update({ last_used_at: new Date() }).catch(() => undefined);
        return true;
    }
};
exports.ConferenceGuestTokenGuard = ConferenceGuestTokenGuard;
exports.ConferenceGuestTokenGuard = ConferenceGuestTokenGuard = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, sequelize_1.InjectModel)(conference_guest_token_model_1.ConferenceGuestToken)),
    __param(1, (0, sequelize_1.InjectModel)(conference_room_model_1.ConferenceRoom)),
    __metadata("design:paramtypes", [Object, Object])
], ConferenceGuestTokenGuard);
//# sourceMappingURL=conference-guest-token.guard.js.map