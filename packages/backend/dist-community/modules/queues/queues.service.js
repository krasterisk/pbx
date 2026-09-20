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
var QueuesService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueuesService = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const sequelize_typescript_1 = require("sequelize-typescript");
const queue_model_1 = require("./queue.model");
const queue_member_model_1 = require("./queue-member.model");
const ami_service_1 = require("../ami/ami.service");
const endpoint_ids_util_1 = require("../endpoints/endpoint-ids.util");
const route_references_service_1 = require("../route-references/route-references.service");
const dialplan_util_1 = require("../../shared/utils/dialplan.util");
const queue_dialplan_util_1 = require("./queue-dialplan.util");
let QueuesService = QueuesService_1 = class QueuesService {
    queueModel;
    memberModel;
    sequelize;
    amiService;
    routeReferencesService;
    logger = new common_1.Logger(QueuesService_1.name);
    constructor(queueModel, memberModel, sequelize, amiService, routeReferencesService) {
        this.queueModel = queueModel;
        this.memberModel = memberModel;
        this.sequelize = sequelize;
        this.amiService = amiService;
        this.routeReferencesService = routeReferencesService;
    }
    /** Build globally unique queue name: q{exten}_{vpbxUserUid} */
    buildQueueName(vpbxUserUid, exten) {
        return `q${exten}_${vpbxUserUid}`;
    }
    /** Extract user-facing extension number from queue name */
    extractExten(queueName) {
        // q700_42 → "700"
        const match = queueName.match(/^q(.+)_\d+$/);
        return match ? match[1] : queueName;
    }
    /**
     * Queue members must use tenant SIP ids (PJSIP/e101_0), not bare PJSIP/101.
     * Legacy bare extensions are rewritten on save.
     */
    normalizeMemberInterface(iface, vpbxUserUid) {
        const raw = String(iface || '').trim();
        if (!raw)
            return raw;
        if (/^Local\//i.test(raw))
            return raw;
        const m = raw.match(/^(PJSIP|SIP)\/(.+)$/i);
        if (!m)
            return raw;
        const id = m[2].trim();
        if (/^e(w)?.+_\d+$/i.test(id))
            return `PJSIP/${id}`;
        if (/^\d+$/.test(id))
            return `PJSIP/${(0, endpoint_ids_util_1.buildSipId)(vpbxUserUid, id)}`;
        return `PJSIP/${id}`;
    }
    /** D-38: Queue.context breakout for DTMF-while-waiting when policy allows. */
    applyCallbackBreakoutContext(data, vpbxUserUid) {
        if (data.context)
            return;
        if ((0, queue_dialplan_util_1.wantsCallbackDtmf)(dialplan_util_1.AsteriskDialplanUtils.callbackPolicy)
            && dialplan_util_1.AsteriskDialplanUtils.hasCallbackStep) {
            data.context = (0, queue_dialplan_util_1.callbackDtmfContextName)(vpbxUserUid);
        }
    }
    mapMembersForSave(members, queueName, vpbxUserUid) {
        if (!members?.length)
            return [];
        return members.map((m) => ({
            ...m,
            interface: this.normalizeMemberInterface(m.interface, vpbxUserUid),
            queue_name: queueName,
            user_uid: vpbxUserUid,
        }));
    }
    async findAll(vpbxUserUid) {
        const queues = await this.queueModel.findAll({
            where: { user_uid: vpbxUserUid },
            order: [['name', 'ASC']],
        });
        // Attach member count for each queue
        const result = [];
        for (const q of queues) {
            const queueName = q.getDataValue('name');
            const memberCount = await this.memberModel.count({
                where: { queue_name: queueName, user_uid: vpbxUserUid },
            });
            result.push({
                ...q.toJSON(),
                exten: this.extractExten(queueName),
                memberCount,
            });
        }
        return result;
    }
    async findOne(name, vpbxUserUid) {
        const queue = await this.queueModel.findOne({
            where: { name, user_uid: vpbxUserUid },
        });
        if (!queue)
            throw new common_1.NotFoundException(`Queue "${name}" not found`);
        const members = await this.memberModel.findAll({
            where: { queue_name: name, user_uid: vpbxUserUid },
            order: [['penalty', 'ASC'], ['uniqueid', 'ASC']],
        });
        return {
            ...queue.toJSON(),
            exten: this.extractExten(queue.getDataValue('name')),
            members: members.map(m => m.toJSON()),
        };
    }
    async create(dto, vpbxUserUid) {
        const queueName = this.buildQueueName(vpbxUserUid, dto.exten);
        // Check for duplicate name
        const existing = await this.queueModel.findOne({
            where: { name: queueName, user_uid: vpbxUserUid },
        });
        if (existing)
            throw new common_1.ConflictException(`Queue with extension "${dto.exten}" already exists`);
        const transaction = await this.sequelize.transaction();
        try {
            // Extract members and advanced before creating queue
            const { members, advanced, exten, ...queueData } = dto;
            // Merge advanced fields into queue data
            const fullData = {
                ...queueData,
                ...(advanced || {}),
                name: queueName,
                user_uid: vpbxUserUid,
            };
            this.applyCallbackBreakoutContext(fullData, vpbxUserUid);
            const queue = await this.queueModel.create(fullData, { transaction });
            // Create members
            if (members?.length) {
                await this.memberModel.bulkCreate(this.mapMembersForSave(members, queueName, vpbxUserUid), { transaction });
            }
            await transaction.commit();
            await this.reloadQueues();
            this.logger.log(`Queue "${dto.exten}" (${queueName}) created with ${members?.length || 0} members`);
            return this.findOne(queueName, vpbxUserUid);
        }
        catch (e) {
            await transaction.rollback();
            throw e;
        }
    }
    async update(name, dto, vpbxUserUid) {
        const queue = await this.queueModel.findOne({
            where: { name, user_uid: vpbxUserUid },
        });
        if (!queue)
            throw new common_1.NotFoundException(`Queue "${name}" not found`);
        const transaction = await this.sequelize.transaction();
        try {
            const { members, advanced, exten, ...queueData } = dto;
            const newQueueName = exten ? this.buildQueueName(vpbxUserUid, exten) : name;
            const isRenaming = newQueueName !== name;
            if (isRenaming) {
                const existing = await this.queueModel.findOne({
                    where: { name: newQueueName, user_uid: vpbxUserUid },
                });
                if (existing) {
                    throw new common_1.ConflictException(`Queue with extension "${exten}" already exists`);
                }
            }
            // Merge advanced fields
            const updateData = {
                ...queueData,
                ...(advanced || {}),
                ...(isRenaming ? { name: newQueueName } : {}),
            };
            // Remove undefined values
            Object.keys(updateData).forEach(k => {
                if (updateData[k] === undefined)
                    delete updateData[k];
            });
            this.applyCallbackBreakoutContext(updateData, vpbxUserUid);
            await queue.update(updateData, { transaction });
            // Sync members if provided
            if (members !== undefined) {
                await this.memberModel.destroy({
                    where: { queue_name: name, user_uid: vpbxUserUid },
                    transaction,
                });
                if (members.length) {
                    await this.memberModel.bulkCreate(this.mapMembersForSave(members, newQueueName, vpbxUserUid), { transaction });
                }
            }
            else if (isRenaming) {
                // If members weren't passed but queue was renamed, we must manually update queue_name on existing members
                await this.memberModel.update({ queue_name: newQueueName }, { where: { queue_name: name, user_uid: vpbxUserUid }, transaction });
            }
            await transaction.commit();
            await this.reloadQueues();
            this.logger.log(`Queue "${name}" updated${isRenaming ? ` and renamed to "${newQueueName}"` : ''}`);
            return this.findOne(newQueueName, vpbxUserUid);
        }
        catch (e) {
            await transaction.rollback();
            throw e;
        }
    }
    async remove(name, vpbxUserUid) {
        const queue = await this.queueModel.findOne({
            where: { name, user_uid: vpbxUserUid },
        });
        if (!queue)
            throw new common_1.NotFoundException(`Queue "${name}" not found`);
        const exten = this.extractExten(name);
        await this.routeReferencesService.assertNotReferenced('queue', [name, exten, `q${exten}`], vpbxUserUid, 'Queue is referenced and cannot be deleted');
        const transaction = await this.sequelize.transaction();
        try {
            await this.memberModel.destroy({
                where: { queue_name: name, user_uid: vpbxUserUid },
                transaction,
            });
            await queue.destroy({ transaction });
            await transaction.commit();
            await this.reloadQueues();
            this.logger.log(`Queue "${name}" deleted`);
            return { success: true };
        }
        catch (e) {
            await transaction.rollback();
            throw e;
        }
    }
    async reloadQueues() {
        try {
            await this.amiService.command('queue reload all');
        }
        catch (e) {
            this.logger.warn(`Queue reload failed: ${e}`);
        }
    }
};
exports.QueuesService = QueuesService;
exports.QueuesService = QueuesService = QueuesService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, sequelize_1.InjectModel)(queue_model_1.Queue)),
    __param(1, (0, sequelize_1.InjectModel)(queue_member_model_1.QueueMember)),
    __metadata("design:paramtypes", [Object, Object, sequelize_typescript_1.Sequelize,
        ami_service_1.AmiService,
        route_references_service_1.RouteReferencesService])
], QueuesService);
//# sourceMappingURL=queues.service.js.map