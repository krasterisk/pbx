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
exports.PickupGroupsService = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const pickup_group_model_1 = require("./pickup-group.model");
let PickupGroupsService = class PickupGroupsService {
    pickupGroupModel;
    constructor(pickupGroupModel) {
        this.pickupGroupModel = pickupGroupModel;
    }
    async findAll(userUid) {
        return this.pickupGroupModel.findAll({
            where: { user_uid: userUid },
            order: [['uid', 'ASC']],
        });
    }
    generateSlug(name) {
        // Basic transliteration/slugification for Asterisk compatibility
        const translit = {
            'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo', 'ж': 'zh',
            'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o',
            'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'ts',
            'ч': 'ch', 'ш': 'sh', 'щ': 'sch', 'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
        };
        return name.toLowerCase()
            .split('')
            .map(char => translit[char] || char)
            .join('')
            .replace(/[^a-z0-9_-]/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '');
    }
    async create(name, userUid) {
        const rawSlug = this.generateSlug(name) || `group_${Date.now()}`;
        const slug = `t${userUid}_${rawSlug}`;
        // Check if exists
        const exists = await this.pickupGroupModel.findOne({
            where: { slug, user_uid: userUid }
        });
        if (exists) {
            throw new common_1.ConflictException(`Group with computed slug ${slug} already exists`);
        }
        return this.pickupGroupModel.create({
            name,
            slug,
            user_uid: userUid,
        });
    }
    async remove(uid, userUid) {
        await this.pickupGroupModel.destroy({
            where: { uid, user_uid: userUid }
        });
    }
};
exports.PickupGroupsService = PickupGroupsService;
exports.PickupGroupsService = PickupGroupsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, sequelize_1.InjectModel)(pickup_group_model_1.PickupGroup)),
    __metadata("design:paramtypes", [Object])
], PickupGroupsService);
//# sourceMappingURL=pickup-groups.service.js.map