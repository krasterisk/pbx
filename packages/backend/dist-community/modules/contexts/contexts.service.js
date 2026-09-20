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
exports.ContextsService = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const context_model_1 = require("./context.model");
const ami_service_1 = require("../ami/ami.service");
let ContextsService = class ContextsService {
    contextModel;
    amiService;
    constructor(contextModel, amiService) {
        this.contextModel = contextModel;
        this.amiService = amiService;
    }
    buildContextName(contextName, vpbxUserUid) {
        const suffix = String(vpbxUserUid);
        return contextName.endsWith(suffix) ? contextName : `${contextName}${suffix}`;
    }
    async findAll(vpbxUserUid) {
        return this.contextModel.findAll({
            where: { user_uid: vpbxUserUid },
            order: [['name', 'ASC']],
        });
    }
    async findOne(uid, vpbxUserUid) {
        const context = await this.contextModel.findOne({
            where: { uid, user_uid: vpbxUserUid },
        });
        if (!context)
            throw new common_1.NotFoundException('Context not found');
        return context;
    }
    async create(data, vpbxUserUid) {
        const ctx = await this.contextModel.create({
            name: data.name,
            comment: data.comment ?? '',
            user_uid: vpbxUserUid,
        });
        return ctx;
    }
    async update(uid, data, vpbxUserUid) {
        const context = await this.findOne(uid, vpbxUserUid);
        await context.update({
            ...(data.name === undefined ? {} : { name: data.name }),
            ...(data.comment === undefined ? {} : { comment: data.comment }),
        });
        return context;
    }
    async remove(uid, vpbxUserUid) {
        const context = await this.findOne(uid, vpbxUserUid);
        await context.destroy();
    }
    /**
     * Ensure default contexts exist for a tenant.
     * Called when a new tenant subscribes or on first endpoint creation.
     */
    async ensureDefaults(vpbxUserUid) {
        const existing = await this.contextModel.count({ where: { user_uid: vpbxUserUid } });
        if (existing > 0)
            return;
        const defaults = [
            { name: `ctx-${vpbxUserUid}`, comment: 'Внутренний контекст' },
            { name: `ctx-${vpbxUserUid}-ext`, comment: 'Внешний контекст' },
        ];
        await this.contextModel.bulkCreate(defaults.map((d) => ({ ...d, user_uid: vpbxUserUid })), { ignoreDuplicates: true });
    }
    async bulkRemove(uids, vpbxUserUid) {
        const deleted = await this.contextModel.destroy({
            where: {
                uid: uids,
                user_uid: vpbxUserUid,
            },
        });
        return { deleted };
    }
};
exports.ContextsService = ContextsService;
exports.ContextsService = ContextsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, sequelize_1.InjectModel)(context_model_1.Context)),
    __param(1, (0, common_1.Inject)((0, common_1.forwardRef)(() => ami_service_1.AmiService))),
    __metadata("design:paramtypes", [Object, ami_service_1.AmiService])
], ContextsService);
//# sourceMappingURL=contexts.service.js.map