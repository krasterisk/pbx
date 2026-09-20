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
exports.ProvisionTemplatesService = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const provision_template_model_1 = require("./provision-template.model");
let ProvisionTemplatesService = class ProvisionTemplatesService {
    templateModel;
    constructor(templateModel) {
        this.templateModel = templateModel;
    }
    async findAll(userUid) {
        return this.templateModel.findAll({
            where: { user_uid: userUid },
            order: [['uid', 'ASC']],
        });
    }
    async create(data, userUid) {
        return this.templateModel.create({
            ...data,
            user_uid: userUid,
        });
    }
    async update(uid, data, userUid) {
        await this.templateModel.update(data, {
            where: { uid, user_uid: userUid }
        });
        return this.templateModel.findOne({ where: { uid } });
    }
    async remove(uid, userUid) {
        await this.templateModel.destroy({
            where: { uid, user_uid: userUid }
        });
    }
    async bulkRemove(uids, userUid) {
        const deleted = await this.templateModel.destroy({
            where: { uid: uids, user_uid: userUid },
        });
        return { deleted };
    }
};
exports.ProvisionTemplatesService = ProvisionTemplatesService;
exports.ProvisionTemplatesService = ProvisionTemplatesService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, sequelize_1.InjectModel)(provision_template_model_1.ProvisionTemplate)),
    __metadata("design:paramtypes", [Object])
], ProvisionTemplatesService);
//# sourceMappingURL=provision-templates.service.js.map