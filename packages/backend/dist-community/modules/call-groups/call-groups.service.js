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
var CallGroupsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CallGroupsService = void 0;
exports.callGroupHttpError = callGroupHttpError;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const sequelize_typescript_1 = require("sequelize-typescript");
const sequelize_2 = require("sequelize");
const call_group_model_1 = require("./call-group.model");
const call_group_member_model_1 = require("./call-group-member.model");
const dialplan_apply_service_1 = require("../ami/dialplan-apply.service");
const call_group_dialplan_util_1 = require("./call-group-dialplan.util");
const dialplan_target_util_1 = require("../../shared/utils/dialplan-target.util");
const endpoints_service_1 = require("../endpoints/endpoints.service");
const route_references_service_1 = require("../route-references/route-references.service");
function callGroupHttpError(status, code, message, params = {}) {
    const body = { code, message, params };
    if (status === common_1.HttpStatus.CONFLICT)
        return new common_1.ConflictException(body);
    if (status === common_1.HttpStatus.BAD_REQUEST)
        return new common_1.BadRequestException(body);
    if (status === common_1.HttpStatus.NOT_FOUND)
        return new common_1.NotFoundException(body);
    return new common_1.HttpException(body, status);
}
let CallGroupsService = CallGroupsService_1 = class CallGroupsService {
    groupModel;
    memberModel;
    sequelize;
    dialplanApplyService;
    endpointsService;
    routeReferencesService;
    logger = new common_1.Logger(CallGroupsService_1.name);
    constructor(groupModel, memberModel, sequelize, dialplanApplyService, endpointsService, routeReferencesService) {
        this.groupModel = groupModel;
        this.memberModel = memberModel;
        this.sequelize = sequelize;
        this.dialplanApplyService = dialplanApplyService;
        this.endpointsService = endpointsService;
        this.routeReferencesService = routeReferencesService;
    }
    groupFile(vpbx) {
        return `krasterisk/groups/group_${vpbx}.conf`;
    }
    /**
     * Tenant-unique group number must not collide with another group, a queue, or an internal.
     * Public so propose/revalidate can refuse or swap the number before Apply.
     */
    async checkExtenConflict(exten, vpbx, excludeUid) {
        const existing = await this.groupModel.findOne({
            where: {
                user_uid: vpbx,
                exten,
                ...(excludeUid !== undefined ? { uid: { [sequelize_2.Op.ne]: excludeUid } } : {}),
            },
        });
        if (existing) {
            return {
                code: 'CALL_GROUP_EXTEN_USED_BY_GROUP',
                reason: `группа «${existing.name}»`,
                params: { exten, name: existing.name, uid: existing.uid },
            };
        }
        const [queues] = await this.sequelize.query('SELECT name FROM queue_table WHERE name = :name LIMIT 1', { replacements: { name: `q${exten}_${vpbx}` } });
        if (Array.isArray(queues) && queues.length > 0) {
            return {
                code: 'CALL_GROUP_EXTEN_USED_BY_QUEUE',
                reason: 'очередь',
                params: { exten },
            };
        }
        const endpoints = await this.endpointsService.findAll(vpbx);
        if (endpoints.some((e) => String(e.extension) === exten)) {
            return {
                code: 'CALL_GROUP_EXTEN_USED_BY_ENDPOINT',
                reason: `абонент ${exten}`,
                params: { exten },
            };
        }
        return null;
    }
    /**
     * Next free group number in the product 6xxx range (D-33: `6` + 3-digit uid → 6007).
     * Not 90xx — that band was never reserved for groups.
     */
    async suggestFreeExten(vpbx) {
        for (let n = 6000; n <= 6999; n += 1) {
            const candidate = String(n);
            if (!(await this.checkExtenConflict(candidate, vpbx)))
                return candidate;
        }
        throw callGroupHttpError(common_1.HttpStatus.BAD_REQUEST, 'CALL_GROUP_EXTEN_USED_IN_TENANT', 'Нет свободного номера группы в диапазоне 6000–6999');
    }
    async assertExtenFree(exten, vpbx, excludeUid) {
        const conflict = await this.checkExtenConflict(exten, vpbx, excludeUid);
        if (!conflict)
            return;
        throw callGroupHttpError(common_1.HttpStatus.CONFLICT, conflict.code, `Номер «${exten}» уже занят: ${conflict.reason}`, conflict.params);
    }
    /**
     * Internal members must be extensions of this tenant (dialplan uses e{ext}_{vpbx}).
     * Cross-tenant IDs are impossible by construction; unknown locals are rejected.
     */
    async assertInternalMembersExist(members, vpbx) {
        if (!members?.length)
            return;
        const internals = members
            .filter((m) => m.member_type === 'internal')
            .map((m) => m.value.trim())
            .filter(Boolean);
        if (!internals.length)
            return;
        const endpoints = await this.endpointsService.findAll(vpbx);
        const known = new Set(endpoints.map((e) => String(e.extension)));
        const missing = [...new Set(internals.filter((ext) => !known.has(ext)))];
        if (missing.length) {
            throw callGroupHttpError(common_1.HttpStatus.BAD_REQUEST, 'CALL_GROUP_UNKNOWN_EXTENSIONS', `Unknown extensions for this tenant: ${missing.join(', ')}`, { extensions: missing.join(', ') });
        }
    }
    toICallGroup(group) {
        const json = group.toJSON();
        return {
            ...json,
            external_context: json.external_context ?? '',
        };
    }
    toIMembers(members) {
        return members.map((m) => m.toJSON());
    }
    async applyGroup(group, members, vpbx) {
        const webrtcExtensions = await this.endpointsService.listWebrtcEnabledExtensions(vpbx);
        const mapped = this.toICallGroup(group);
        const category = (0, call_group_dialplan_util_1.generateGroupDialplan)(mapped, this.toIMembers(members), vpbx, webrtcExtensions, {
            confirmExternal: mapped.confirmExternal,
            confirmDigit: mapped.confirmDigit,
            skipBusy: mapped.skipBusy,
            greetingPrompt: mapped.greetingPrompt,
            mohClass: mapped.mohClass,
            useMohInsteadOfRingback: mapped.useMohInsteadOfRingback,
            dialOpts: mapped.dialOptions,
        });
        await this.dialplanApplyService.applyCategories(this.groupFile(vpbx), [category, ...(category.extras ?? [])], { reload: true });
    }
    async removeGroupContext(group, vpbx) {
        const names = [
            (0, dialplan_target_util_1.normalizeTarget)('group', { source: 'fixed', value: group.exten }, vpbx),
            `group_${group.uid}_${vpbx}`,
        ];
        await this.dialplanApplyService.deleteCategories(this.groupFile(vpbx), [...new Set(names)], { reload: true });
    }
    async findAll(vpbx) {
        const groups = await this.groupModel.findAll({
            where: { user_uid: vpbx },
            order: [['uid', 'DESC']],
        });
        const result = [];
        for (const group of groups) {
            const members = await this.memberModel.findAll({
                where: { call_group_uid: group.uid, user_uid: vpbx },
                order: [['position', 'ASC'], ['uid', 'ASC']],
            });
            result.push({
                ...group.toJSON(),
                members: members.map((m) => m.toJSON()),
            });
        }
        return result;
    }
    async findOne(uid, vpbx) {
        const group = await this.groupModel.findOne({
            where: { uid, user_uid: vpbx },
        });
        if (!group) {
            throw callGroupHttpError(common_1.HttpStatus.NOT_FOUND, 'CALL_GROUP_NOT_FOUND', `Call group ${uid} not found`, { uid });
        }
        const members = await this.memberModel.findAll({
            where: { call_group_uid: uid, user_uid: vpbx },
            order: [['position', 'ASC'], ['uid', 'ASC']],
        });
        return {
            ...group.toJSON(),
            members: members.map((m) => m.toJSON()),
        };
    }
    async create(dto, vpbx) {
        if (!dto.exten) {
            throw callGroupHttpError(common_1.HttpStatus.BAD_REQUEST, 'CALL_GROUP_EXTEN_REQUIRED', 'exten is required');
        }
        const data = { ...dto };
        delete data.user_uid;
        const { members, ...groupData } = data;
        await this.assertExtenFree(dto.exten, vpbx);
        await this.assertInternalMembersExist(members, vpbx);
        const transaction = await this.sequelize.transaction();
        let committed = false;
        let group;
        let createdMembers = [];
        try {
            group = await this.groupModel.create({
                ...groupData,
                user_uid: vpbx,
            }, { transaction });
            if (members?.length) {
                createdMembers = await this.memberModel.bulkCreate(members.map((m) => ({
                    member_type: m.member_type,
                    value: m.value,
                    position: m.position,
                    ring_time: m.ring_time ?? 20,
                    call_group_uid: group.uid,
                    user_uid: vpbx,
                })), { transaction });
            }
            await transaction.commit();
            committed = true;
        }
        catch (e) {
            if (!committed)
                await transaction.rollback();
            if (e instanceof sequelize_2.UniqueConstraintError || e?.name === 'SequelizeUniqueConstraintError') {
                throw callGroupHttpError(common_1.HttpStatus.CONFLICT, 'CALL_GROUP_EXTEN_USED_IN_TENANT', `Call group extension "${dto.exten}" is already used in this tenant`, { exten: dto.exten ?? '' });
            }
            throw e;
        }
        try {
            await this.applyGroup(group, createdMembers, vpbx);
        }
        catch (e) {
            this.logger.error(`Dialplan apply failed for call group ${group.uid} (${this.groupFile(vpbx)}); DB saved — retry/re-save may be needed: ${e?.message || e}`);
        }
        this.logger.log(`Call group "${group.name}" (${group.uid}) created with ${createdMembers.length} members`);
        return this.findOne(group.uid, vpbx);
    }
    async update(uid, dto, vpbx) {
        const group = await this.groupModel.findOne({
            where: { uid, user_uid: vpbx },
        });
        if (!group) {
            throw callGroupHttpError(common_1.HttpStatus.NOT_FOUND, 'CALL_GROUP_NOT_FOUND', `Call group ${uid} not found`, { uid });
        }
        const data = { ...dto };
        delete data.user_uid;
        const { members, ...groupData } = data;
        if (dto.exten) {
            await this.assertExtenFree(dto.exten, vpbx, uid);
        }
        if (members !== undefined) {
            await this.assertInternalMembersExist(members, vpbx);
        }
        const transaction = await this.sequelize.transaction();
        let committed = false;
        let appliedMembers = [];
        try {
            const updateData = { ...groupData };
            Object.keys(updateData).forEach((k) => {
                if (updateData[k] === undefined)
                    delete updateData[k];
            });
            if (Object.keys(updateData).length) {
                await group.update(updateData, { transaction });
            }
            if (members !== undefined) {
                await this.memberModel.destroy({
                    where: { call_group_uid: uid, user_uid: vpbx },
                    transaction,
                });
                if (members.length) {
                    appliedMembers = await this.memberModel.bulkCreate(members.map((m) => ({
                        member_type: m.member_type,
                        value: m.value,
                        position: m.position,
                        ring_time: m.ring_time ?? 20,
                        call_group_uid: uid,
                        user_uid: vpbx,
                    })), { transaction });
                }
                else {
                    appliedMembers = [];
                }
            }
            else {
                appliedMembers = await this.memberModel.findAll({
                    where: { call_group_uid: uid, user_uid: vpbx },
                    transaction,
                });
            }
            await transaction.commit();
            committed = true;
        }
        catch (e) {
            if (!committed)
                await transaction.rollback();
            if (e instanceof sequelize_2.UniqueConstraintError || e?.name === 'SequelizeUniqueConstraintError') {
                throw callGroupHttpError(common_1.HttpStatus.CONFLICT, 'CALL_GROUP_EXTEN_USED_IN_TENANT', `Call group extension "${dto.exten}" is already used in this tenant`, { exten: dto.exten ?? '' });
            }
            throw e;
        }
        try {
            await this.applyGroup(group, appliedMembers, vpbx);
        }
        catch (e) {
            this.logger.error(`Dialplan apply failed for call group ${uid} (${this.groupFile(vpbx)}); DB saved — retry/re-save may be needed: ${e?.message || e}`);
        }
        this.logger.log(`Call group ${uid} updated`);
        return this.findOne(uid, vpbx);
    }
    async remove(uid, vpbx) {
        const group = await this.groupModel.findOne({
            where: { uid, user_uid: vpbx },
        });
        if (!group) {
            throw callGroupHttpError(common_1.HttpStatus.NOT_FOUND, 'CALL_GROUP_NOT_FOUND', `Call group ${uid} not found`, { uid });
        }
        await this.routeReferencesService.assertNotReferenced('group', [uid, group.exten].filter((value) => value != null && value !== ''), vpbx, 'Call group is referenced and cannot be deleted');
        const transaction = await this.sequelize.transaction();
        let committed = false;
        try {
            await this.memberModel.destroy({
                where: { call_group_uid: uid, user_uid: vpbx },
                transaction,
            });
            await group.destroy({ transaction });
            await transaction.commit();
            committed = true;
        }
        catch (e) {
            if (!committed)
                await transaction.rollback();
            throw e;
        }
        try {
            await this.removeGroupContext(group, vpbx);
        }
        catch (e) {
            this.logger.error(`Dialplan remove failed for call group ${uid} (${this.groupFile(vpbx)}); DB deleted — dialplan may need cleanup: ${e?.message || e}`);
        }
        this.logger.log(`Call group ${uid} deleted`);
        return { success: true };
    }
};
exports.CallGroupsService = CallGroupsService;
exports.CallGroupsService = CallGroupsService = CallGroupsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, sequelize_1.InjectModel)(call_group_model_1.CallGroup)),
    __param(1, (0, sequelize_1.InjectModel)(call_group_member_model_1.CallGroupMember)),
    __metadata("design:paramtypes", [Object, Object, sequelize_typescript_1.Sequelize,
        dialplan_apply_service_1.DialplanApplyService,
        endpoints_service_1.EndpointsService,
        route_references_service_1.RouteReferencesService])
], CallGroupsService);
//# sourceMappingURL=call-groups.service.js.map