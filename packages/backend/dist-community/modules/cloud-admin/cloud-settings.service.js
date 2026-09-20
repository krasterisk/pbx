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
exports.CloudSettingsService = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const cloud_setting_model_1 = require("./cloud-setting.model");
const SELLER_KEY_PREFIX = 'billing.seller.';
const KEY_MAP = {
    name: 'billing.seller.name',
    inn: 'billing.seller.inn',
    kpp: 'billing.seller.kpp',
    ogrn: 'billing.seller.ogrn',
    address: 'billing.seller.address',
    bankName: 'billing.bank.name',
    bankBik: 'billing.bank.bik',
    bankAccount: 'billing.bank.account',
    corrAccount: 'billing.bank.corr_account',
    serviceDescription: 'billing.service.description',
    serviceCode: 'billing.service.code',
};
let CloudSettingsService = class CloudSettingsService {
    settingModel;
    constructor(settingModel) {
        this.settingModel = settingModel;
    }
    // ─── Helpers ──────────────────────────────────────────────────────────────
    async get(key) {
        const row = await this.settingModel.findOne({ where: { key } });
        return row?.value ?? null;
    }
    async set(key, value, description) {
        await this.settingModel.upsert({ key, value, description: description ?? null });
    }
    // ─── Seller Info ──────────────────────────────────────────────────────────
    async getSellerInfo() {
        const rows = await this.settingModel.findAll({
            where: { key: Object.values(KEY_MAP) },
        });
        const map = new Map(rows.map((r) => [r.key, r.value ?? '']));
        const result = {};
        for (const [field, key] of Object.entries(KEY_MAP)) {
            result[field] = map.get(key) ?? '';
        }
        return result;
    }
    async updateSellerInfo(partial) {
        for (const [field, value] of Object.entries(partial)) {
            const key = KEY_MAP[field];
            if (key && value !== undefined) {
                await this.set(key, value);
            }
        }
        return this.getSellerInfo();
    }
};
exports.CloudSettingsService = CloudSettingsService;
exports.CloudSettingsService = CloudSettingsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, sequelize_1.InjectModel)(cloud_setting_model_1.CloudSetting)),
    __metadata("design:paramtypes", [Object])
], CloudSettingsService);
//# sourceMappingURL=cloud-settings.service.js.map