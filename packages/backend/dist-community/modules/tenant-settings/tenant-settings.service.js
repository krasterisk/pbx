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
exports.TenantSettingsService = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const tenant_setting_model_1 = require("./tenant-setting.model");
const tenant_settings_keys_1 = require("./tenant-settings.keys");
let TenantSettingsService = class TenantSettingsService {
    model;
    constructor(model) {
        this.model = model;
    }
    async getAll(vpbxUserUid) {
        const rows = await this.model.findAll({ where: { vpbxUserUid } });
        const stored = new Map(rows.map((r) => [r.key, r.value]));
        const result = {};
        for (const [key, desc] of Object.entries(tenant_settings_keys_1.TENANT_SETTING_KEYS)) {
            result[key] = stored.has(key) ? this.parseValue(desc, stored.get(key) ?? null) : desc.default;
        }
        return result;
    }
    async get(vpbxUserUid, key) {
        const desc = tenant_settings_keys_1.TENANT_SETTING_KEYS[key];
        if (!desc) {
            throw new common_1.BadRequestException(`Unknown tenant setting key: ${key}`);
        }
        const row = await this.model.findOne({ where: { vpbxUserUid, key } });
        return row ? this.parseValue(desc, row.value) : desc.default;
    }
    async setMany(vpbxUserUid, patch) {
        const unknown = Object.keys(patch).filter((k) => !(k in tenant_settings_keys_1.TENANT_SETTING_KEYS));
        if (unknown.length) {
            throw new common_1.BadRequestException(`Unknown tenant setting keys: ${unknown.join(', ')}`);
        }
        for (const [key, value] of Object.entries(patch)) {
            this.assertType(key, value);
        }
        for (const [key, value] of Object.entries(patch)) {
            const desc = tenant_settings_keys_1.TENANT_SETTING_KEYS[key];
            await this.model.upsert({
                vpbxUserUid,
                key,
                value: this.serializeValue(desc, value),
                category: desc.category,
            });
        }
        return this.getAll(vpbxUserUid);
    }
    assertType(key, value) {
        const desc = tenant_settings_keys_1.TENANT_SETTING_KEYS[key];
        const ok = desc.type === 'boolean' ? typeof value === 'boolean'
            : desc.type === 'number' ? typeof value === 'number' && Number.isFinite(value)
                : desc.type === 'string' ? typeof value === 'string'
                    : desc.type === 'json' ? value !== undefined
                        : false;
        if (!ok) {
            throw new common_1.BadRequestException(`Invalid type for ${key}: expected ${desc.type}`);
        }
    }
    serializeValue(desc, value) {
        if (desc.type === 'string')
            return String(value);
        return JSON.stringify(value);
    }
    parseValue(desc, raw) {
        if (raw === null || raw === undefined)
            return desc.default;
        if (desc.type === 'string')
            return raw;
        try {
            const parsed = JSON.parse(raw);
            if (desc.type === 'boolean')
                return parsed === true || parsed === 1;
            if (desc.type === 'number')
                return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : desc.default;
            return parsed;
        }
        catch {
            if (desc.type === 'boolean')
                return raw === 'true' || raw === '1';
            if (desc.type === 'number') {
                const n = Number(raw);
                return Number.isFinite(n) ? n : desc.default;
            }
            return desc.default;
        }
    }
};
exports.TenantSettingsService = TenantSettingsService;
exports.TenantSettingsService = TenantSettingsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, sequelize_1.InjectModel)(tenant_setting_model_1.TenantSetting)),
    __metadata("design:paramtypes", [Object])
], TenantSettingsService);
//# sourceMappingURL=tenant-settings.service.js.map