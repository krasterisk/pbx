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
exports.NumbersService = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const number_list_model_1 = require("./number-list.model");
let NumbersService = class NumbersService {
    numberListModel;
    constructor(numberListModel) {
        this.numberListModel = numberListModel;
    }
    async findAll(vpbxUserUid) {
        return this.numberListModel.findAll({ where: { user_uid: vpbxUserUid } });
    }
    async findById(id, vpbxUserUid) {
        return this.numberListModel.findOne({ where: { id, user_uid: vpbxUserUid } });
    }
    async create(data) {
        return this.numberListModel.create(data);
    }
    async update(id, vpbxUserUid, data) {
        const item = await this.numberListModel.findOne({ where: { id, user_uid: vpbxUserUid } });
        if (!item)
            return null;
        return item.update(data);
    }
    async delete(id, vpbxUserUid) {
        const deleted = await this.numberListModel.destroy({ where: { id, user_uid: vpbxUserUid } });
        return deleted > 0;
    }
    async bulkDelete(ids, vpbxUserUid) {
        return this.numberListModel.destroy({ where: { id: ids, user_uid: vpbxUserUid } });
    }
};
exports.NumbersService = NumbersService;
exports.NumbersService = NumbersService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, sequelize_1.InjectModel)(number_list_model_1.NumberList)),
    __metadata("design:paramtypes", [Object])
], NumbersService);
//# sourceMappingURL=numbers.service.js.map