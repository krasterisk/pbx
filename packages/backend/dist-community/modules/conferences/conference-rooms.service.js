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
var ConferenceRoomsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConferenceRoomsService = void 0;
exports.conferenceRoomHttpError = conferenceRoomHttpError;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const sequelize_2 = require("sequelize");
const sequelize_typescript_1 = require("sequelize-typescript");
const dialplan_apply_service_1 = require("../ami/dialplan-apply.service");
const callcenter_access_list_util_1 = require("../callcenter/callcenter-access-list.util");
const logger_service_1 = require("../logger/logger.service");
const user_model_1 = require("../users/user.model");
const conference_dialplan_util_1 = require("./conference-dialplan.util");
const conference_state_service_1 = require("./conference-state.service");
const conference_guest_service_1 = require("./conference-guest.service");
const conference_participant_dto_1 = require("./dto/conference-participant.dto");
const conference_room_model_1 = require("./models/conference-room.model");
const conference_room_moderator_model_1 = require("./models/conference-room-moderator.model");
const conference_entry_policy_util_1 = require("./conference-entry-policy.util");
function conferenceRoomHttpError(status, code, message, params = {}) {
    const body = { code, message, params };
    if (status === common_1.HttpStatus.CONFLICT)
        return new common_1.ConflictException(body);
    if (status === common_1.HttpStatus.UNAUTHORIZED)
        return new common_1.UnauthorizedException(body);
    if (status === common_1.HttpStatus.BAD_REQUEST)
        return new common_1.HttpException(body, status);
    if (status === common_1.HttpStatus.NOT_FOUND)
        return new common_1.NotFoundException(body);
    return new common_1.HttpException(body, status);
}
let ConferenceRoomsService = ConferenceRoomsService_1 = class ConferenceRoomsService {
    roomModel;
    sequelize;
    dialplanApplyService;
    stateService;
    loggerService;
    moderatorModel;
    userModel;
    guestService;
    logger = new common_1.Logger(ConferenceRoomsService_1.name);
    constructor(roomModel, sequelize, dialplanApplyService, stateService, loggerService, moderatorModel, userModel, guestService) {
        this.roomModel = roomModel;
        this.sequelize = sequelize;
        this.dialplanApplyService = dialplanApplyService;
        this.stateService = stateService;
        this.loggerService = loggerService;
        this.moderatorModel = moderatorModel;
        this.userModel = userModel;
        this.guestService = guestService;
    }
    createGuestToken(roomUid, dto, vpbx) {
        return this.guestService.createToken(roomUid, vpbx, dto);
    }
    listGuestTokens(roomUid, vpbx) {
        return this.guestService.listTokens(roomUid, vpbx);
    }
    revokeGuestToken(roomUid, tokenUid, vpbx) {
        return this.guestService.revoke(roomUid, tokenUid, vpbx);
    }
    roomFile(vpbx) {
        return `krasterisk/conferences/conf_${vpbx}.conf`;
    }
    async findAll(vpbx) {
        const rooms = await this.roomModel.findAll({
            where: { user_uid: vpbx },
            order: [['uid', 'DESC']],
        });
        for (const room of rooms) {
            this.stateService.registerRoom(room);
        }
        return rooms.map((room) => room.toJSON());
    }
    async findOne(uid, vpbx) {
        const room = await this.roomModel.findOne({
            where: { uid, user_uid: vpbx },
        });
        if (!room) {
            throw conferenceRoomHttpError(common_1.HttpStatus.NOT_FOUND, 'CONFERENCE_ROOM_NOT_FOUND', `Conference room ${uid} not found`, { uid });
        }
        this.stateService.registerRoom(room);
        const snapshot = this.stateService.getSnapshot(uid);
        const live = (0, conference_participant_dto_1.toConferenceRoomStateDto)(snapshot);
        const startedAt = snapshot.participants.length > 0
            ? new Date(Math.min(...snapshot.participants.map((p) => p.joinedAt))).toISOString()
            : null;
        return {
            ...room.toJSON(),
            ...live,
            startedAt,
        };
    }
    async create(dto, vpbx, createdBy = null) {
        const data = { ...dto };
        delete data.user_uid;
        delete data.created_by;
        this.assertEntryPolicyConsistent({
            entry_strictness: dto.entry_strictness,
            pin: dto.pin,
            wait_marked: dto.wait_marked,
            end_marked: dto.end_marked,
        });
        const transaction = await this.sequelize.transaction();
        let committed = false;
        let room;
        try {
            room = await this.roomModel.create({
                ...data,
                user_uid: vpbx,
                created_by: createdBy,
            }, { transaction });
            await transaction.commit();
            committed = true;
        }
        catch (e) {
            if (!committed)
                await transaction.rollback();
            if (e instanceof sequelize_2.UniqueConstraintError ||
                e?.name === 'SequelizeUniqueConstraintError') {
                throw conferenceRoomHttpError(common_1.HttpStatus.CONFLICT, 'CONFERENCE_NUMBER_TAKEN', `Conference number "${dto.number}" is already used in this tenant`, { number: dto.number });
            }
            throw e;
        }
        this.stateService.registerRoom(room);
        try {
            await this.applyRoom(room, vpbx);
        }
        catch (e) {
            this.logger.error(`Dialplan apply failed for conference room ${room.uid} (${this.roomFile(vpbx)}); DB saved — retry/re-save may be needed: ${e?.message || e}`);
        }
        return room.toJSON ? room.toJSON() : room;
    }
    async update(uid, dto, vpbx) {
        const room = await this.roomModel.findOne({
            where: { uid, user_uid: vpbx },
        });
        if (!room) {
            throw conferenceRoomHttpError(common_1.HttpStatus.NOT_FOUND, 'CONFERENCE_ROOM_NOT_FOUND', `Conference room ${uid} not found`, { uid });
        }
        const data = { ...dto };
        delete data.user_uid;
        delete data.vpbx_user_uid;
        this.assertEntryPolicyConsistent({
            entry_strictness: dto.entry_strictness ?? room.entry_strictness,
            pin: dto.pin !== undefined ? dto.pin : room.pin,
            wait_marked: dto.wait_marked ?? room.wait_marked,
            end_marked: dto.end_marked ?? room.end_marked,
        });
        const updateData = { ...data };
        Object.keys(updateData).forEach((k) => {
            if (updateData[k] === undefined)
                delete updateData[k];
        });
        const transaction = await this.sequelize.transaction();
        let committed = false;
        try {
            if (Object.keys(updateData).length) {
                await room.update(updateData, { transaction });
            }
            await transaction.commit();
            committed = true;
        }
        catch (e) {
            if (!committed)
                await transaction.rollback();
            if (e instanceof sequelize_2.UniqueConstraintError ||
                e?.name === 'SequelizeUniqueConstraintError') {
                throw conferenceRoomHttpError(common_1.HttpStatus.CONFLICT, 'CONFERENCE_NUMBER_TAKEN', `Conference number "${dto.number}" is already used in this tenant`, { number: dto.number ?? '' });
            }
            throw e;
        }
        this.stateService.registerRoom(room);
        try {
            await this.applyRoom(room, vpbx);
        }
        catch (e) {
            this.logger.error(`Dialplan apply failed for conference room ${uid} (${this.roomFile(vpbx)}); DB saved — retry/re-save may be needed: ${e?.message || e}`);
        }
        return room.toJSON ? room.toJSON() : room;
    }
    async remove(uid, vpbx) {
        const room = await this.roomModel.findOne({
            where: { uid, user_uid: vpbx },
        });
        if (!room) {
            throw conferenceRoomHttpError(common_1.HttpStatus.NOT_FOUND, 'CONFERENCE_ROOM_NOT_FOUND', `Conference room ${uid} not found`, { uid });
        }
        const roomUid = room.uid;
        const transaction = await this.sequelize.transaction();
        let committed = false;
        try {
            await room.destroy({ transaction });
            await transaction.commit();
            committed = true;
        }
        catch (e) {
            if (!committed)
                await transaction.rollback();
            throw e;
        }
        try {
            await this.dialplanApplyService.deleteCategories(this.roomFile(vpbx), [(0, conference_dialplan_util_1.conferenceRoomContextName)(roomUid)], { reload: true });
        }
        catch (e) {
            this.logger.error(`Dialplan remove failed for conference room ${uid} (${this.roomFile(vpbx)}); DB deleted — dialplan may need cleanup: ${e?.message || e}`);
        }
        try {
            await this.dialplanApplyService.applyCategories(this.roomFile(vpbx), [await this.buildMaskIndex(vpbx)], { reload: true });
        }
        catch (e) {
            this.logger.error(`Mask-index apply failed after removing conference room ${uid} (${this.roomFile(vpbx)}); DB deleted — retry/re-save may be needed: ${e?.message || e}`);
        }
        return { success: true };
    }
    async assertLiveRoomAccess(roomUid, user) {
        const room = await this.roomModel.findOne({
            where: { uid: roomUid, user_uid: user.vpbx_user_uid },
        });
        if (!room) {
            throw conferenceRoomHttpError(common_1.HttpStatus.NOT_FOUND, 'CONFERENCE_ROOM_NOT_FOUND', `Conference room ${roomUid} not found`, { uid: roomUid });
        }
        const createdBy = room.created_by;
        if (createdBy != null && createdBy !== user.sub) {
            await this.loggerService.logAction(user.sub, 'conference_live_room_enter', 'conference_room', roomUid, user.vpbx_user_uid, `created_by=${createdBy}`);
        }
        return room.toJSON ? room.toJSON() : room;
    }
    async resolveCallerRef(user) {
        if (!this.userModel)
            return null;
        const row = await this.userModel.findOne({
            where: { uniqueid: user.sub, vpbx_user_uid: user.vpbx_user_uid },
            attributes: ['uniqueid', 'exten', 'login'],
        });
        if (!row)
            return null;
        const rawExten = row.exten ?? row.getDataValue?.('exten');
        const exten = (0, callcenter_access_list_util_1.normalizeAccessToken)(rawExten);
        if (exten)
            return exten;
        const login = String(row.login ?? row.getDataValue?.('login') ?? '');
        if (/^\d+$/.test(login))
            return login;
        return null;
    }
    async getRoomModerators(roomUid, vpbx) {
        await this.requireTenantRoom(roomUid, vpbx);
        const rows = await this.loadModeratorRows(roomUid);
        return rows.map((row) => ({
            endpointRef: String(row.endpoint_ref),
            role: row.role,
        }));
    }
    async setRoomModerators(roomUid, dto, vpbx) {
        const room = await this.requireTenantRoom(roomUid, vpbx);
        const moderators = dto.moderators ?? [];
        this.assertModeratorList(moderators);
        if (!this.moderatorModel) {
            throw new Error('ConferenceRoomModerator model is not wired');
        }
        const transaction = await this.sequelize.transaction();
        let committed = false;
        try {
            await this.moderatorModel.destroy({
                where: { room_uid: roomUid },
                transaction,
            });
            if (moderators.length) {
                await this.moderatorModel.bulkCreate(moderators.map((item) => ({
                    room_uid: roomUid,
                    endpoint_ref: item.endpointRef,
                    role: item.role,
                })), { transaction });
            }
            await transaction.commit();
            committed = true;
        }
        catch (e) {
            if (!committed)
                await transaction.rollback();
            throw e;
        }
        try {
            await this.applyRoom(room, vpbx);
        }
        catch (e) {
            this.logger.error(`Dialplan apply failed for conference room ${roomUid} (${this.roomFile(vpbx)}); DB saved — retry/re-save may be needed: ${e?.message || e}`);
        }
        return this.getRoomModerators(roomUid, vpbx);
    }
    assertEntryPolicyConsistent(nextRoomState) {
        if (!(0, conference_entry_policy_util_1.conferenceEntryPolicy)(nextRoomState).pinRequiredButMissing)
            return;
        throw conferenceRoomHttpError(common_1.HttpStatus.BAD_REQUEST, 'CONFERENCE_PIN_REQUIRED', 'Conference PIN is required for this entry strictness');
    }
    async requireTenantRoom(roomUid, vpbx) {
        const room = await this.roomModel.findOne({
            where: { uid: roomUid, user_uid: vpbx },
        });
        if (!room) {
            throw conferenceRoomHttpError(common_1.HttpStatus.NOT_FOUND, 'CONFERENCE_ROOM_NOT_FOUND', `Conference room ${roomUid} not found`, { uid: roomUid });
        }
        return room;
    }
    assertModeratorList(moderators) {
        const owners = moderators.filter((item) => item.role === 'owner');
        if (owners.length > 1) {
            throw conferenceRoomHttpError(common_1.HttpStatus.BAD_REQUEST, 'CONFERENCE_OWNER_DUPLICATE', 'A conference room can have only one owner');
        }
        const seen = new Set();
        for (const item of moderators) {
            if (seen.has(item.endpointRef)) {
                throw conferenceRoomHttpError(common_1.HttpStatus.BAD_REQUEST, 'CONFERENCE_MODERATOR_DUPLICATE', `Duplicate moderator endpoint ${item.endpointRef}`, { endpointRef: item.endpointRef });
            }
            seen.add(item.endpointRef);
        }
    }
    async loadModeratorRows(roomUid) {
        if (!this.moderatorModel?.findAll)
            return [];
        try {
            const rows = await this.moderatorModel.findAll({
                where: { room_uid: roomUid },
            });
            return rows.map((row) => ({
                endpoint_ref: row.endpoint_ref,
                role: row.role,
            }));
        }
        catch (e) {
            if (String(e?.message || e).includes('not initialized'))
                return [];
            throw e;
        }
    }
    toPermanentRights(rows) {
        return rows.map((row) => ({
            endpointRef: row.endpoint_ref,
            role: row.role,
        }));
    }
    syncRoomRights(roomUid, rights) {
        this.stateService.setRoomRights(roomUid, {
            ownerRef: rights.find((item) => item.role === 'owner')?.endpointRef ?? null,
            moderatorRefs: rights
                .filter((item) => item.role === 'moderator')
                .map((item) => item.endpointRef),
        });
    }
    async buildMaskIndex(vpbx) {
        const rooms = (await this.roomModel.findAll({
            where: { user_uid: vpbx },
            attributes: ['uid', 'number'],
        })) ?? [];
        return (0, conference_dialplan_util_1.generateConferenceMaskIndex)(rooms.map((room) => ({ uid: room.uid, number: String(room.number) })), vpbx);
    }
    async reapplyDialplan(room, effectiveMax) {
        const vpbx = Number(room.user_uid);
        const base = typeof room.toJSON === 'function'
            ? room.toJSON()
            : { ...room };
        const payload = effectiveMax === undefined
            ? room
            : { ...base, effective_max_participants: effectiveMax };
        await this.applyRoom(payload, vpbx);
    }
    async applyRoom(room, vpbx) {
        const rights = this.toPermanentRights(await this.loadModeratorRows(room.uid));
        this.syncRoomRights(room.uid, rights);
        await this.dialplanApplyService.applyCategories(this.roomFile(vpbx), [(0, conference_dialplan_util_1.generateConferenceDialplan)(room, vpbx, rights), await this.buildMaskIndex(vpbx)], { reload: true });
    }
};
exports.ConferenceRoomsService = ConferenceRoomsService;
exports.ConferenceRoomsService = ConferenceRoomsService = ConferenceRoomsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, sequelize_1.InjectModel)(conference_room_model_1.ConferenceRoom)),
    __param(5, (0, sequelize_1.InjectModel)(conference_room_moderator_model_1.ConferenceRoomModerator)),
    __param(6, (0, sequelize_1.InjectModel)(user_model_1.User)),
    __param(7, (0, common_1.Optional)()),
    __param(7, (0, common_1.Inject)((0, common_1.forwardRef)(() => conference_guest_service_1.ConferenceGuestService))),
    __metadata("design:paramtypes", [Object, sequelize_typescript_1.Sequelize,
        dialplan_apply_service_1.DialplanApplyService,
        conference_state_service_1.ConferenceStateService,
        logger_service_1.LoggerService, Object, Object, conference_guest_service_1.ConferenceGuestService])
], ConferenceRoomsService);
//# sourceMappingURL=conference-rooms.service.js.map