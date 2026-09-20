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
var TimeGroupsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TimeGroupsService = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const time_group_model_1 = require("./time-group.model");
const dialplan_util_1 = require("../../shared/utils/dialplan.util");
let TimeGroupsService = TimeGroupsService_1 = class TimeGroupsService {
    timeGroupModel;
    logger = new common_1.Logger(TimeGroupsService_1.name);
    constructor(timeGroupModel) {
        this.timeGroupModel = timeGroupModel;
    }
    async findAll(userUid) {
        return this.timeGroupModel.findAll({
            where: { user_uid: userUid },
            order: [['uid', 'DESC']],
        });
    }
    async findOne(uid, userUid) {
        const tg = await this.timeGroupModel.findOne({
            where: { uid, user_uid: userUid },
        });
        if (!tg)
            throw new common_1.NotFoundException('Time group not found');
        return tg;
    }
    async create(data, userUid) {
        // Prevent tenant override from client
        delete data.user_uid;
        return this.timeGroupModel.create({
            ...data,
            user_uid: userUid,
        });
    }
    async update(uid, data, userUid) {
        const tg = await this.findOne(uid, userUid);
        // Prevent tenant override
        delete data.user_uid;
        await tg.update(data);
        return tg;
    }
    async remove(uid, userUid) {
        const tg = await this.findOne(uid, userUid);
        await tg.destroy();
    }
    async bulkRemove(uids, userUid) {
        const deleted = await this.timeGroupModel.destroy({
            where: { uid: uids, user_uid: userUid },
        });
        return { deleted };
    }
    /**
     * Generate Asterisk dialplan context for a time group.
     * Pattern from v3: Gosub(tgroup_<uid>,start,1) → ExecIfTime → Set(__WORKTIME_<uid>=1) → Return()
     */
    generateDialplan(timeGroup) {
        const lines = [];
        lines.push(`[tgroup_${timeGroup.uid}]`);
        lines.push(`exten => start,1,NoOp(TimeGroup: ${timeGroup.name})`);
        lines.push(`same => n,Set(__WORKTIME_${timeGroup.uid}=0)`);
        const intervals = timeGroup.intervals || [];
        for (const interval of intervals) {
            const expr = (0, dialplan_util_1.formatTimeGroupInterval)(interval);
            lines.push(`same => n,ExecIfTime(${expr}?Set(__WORKTIME_${timeGroup.uid}=1))`);
        }
        lines.push('same => n,Return()');
        return lines.join('\n');
    }
};
exports.TimeGroupsService = TimeGroupsService;
exports.TimeGroupsService = TimeGroupsService = TimeGroupsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, sequelize_1.InjectModel)(time_group_model_1.TimeGroup)),
    __metadata("design:paramtypes", [Object])
], TimeGroupsService);
//# sourceMappingURL=time-groups.service.js.map