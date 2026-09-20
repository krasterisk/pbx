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
exports.AiChatSettingsService = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const ai_chat_settings_model_1 = require("./ai-chat-settings.model");
/**
 * AiChatSettingsService — per-tenant AI Chat settings (D-25).
 *
 * `confirm_destructive` gates destructive AI tool calls (D-20) — default OFF:
 * a tenant with no row in `ai_chat_settings` gets confirmDestructive=false,
 * matching the locked "default OFF" decision without requiring a seed row.
 */
let AiChatSettingsService = class AiChatSettingsService {
    model;
    constructor(model) {
        this.model = model;
    }
    async getSettings(vpbxUserUid) {
        const row = await this.model.findOne({ where: { user_uid: vpbxUserUid } });
        return {
            confirmDestructive: !!row?.confirm_destructive,
            seeAllThreads: await this.getSeeAllThreads(vpbxUserUid),
        };
    }
    async getDefaultProviderUid(tenantUid) {
        const row = await this.model.findOne({ where: { user_uid: tenantUid } });
        const raw = row?.settings?.defaultProviderUid;
        return typeof raw === 'number' && raw > 0 ? raw : null;
    }
    async setDefaultProviderUid(tenantUid, providerUid) {
        const [row] = await this.model.findOrCreate({
            where: { user_uid: tenantUid },
            defaults: { user_uid: tenantUid, confirm_destructive: 0, settings: {} },
        });
        const next = { ...(row.settings ?? {}), defaultProviderUid: providerUid };
        await row.update({ settings: next });
        return providerUid;
    }
    async getSeeAllThreads(tenantUid) {
        const row = await this.model.findOne({ where: { user_uid: tenantUid } });
        return row?.settings?.adminSeesAllThreads === true;
    }
    async setSeeAllThreads(tenantUid, enabled) {
        const [row] = await this.model.findOrCreate({
            where: { user_uid: tenantUid },
            defaults: { user_uid: tenantUid, confirm_destructive: 0, settings: {} },
        });
        const next = { ...(row.settings ?? {}), adminSeesAllThreads: enabled };
        await row.update({ settings: next });
        return enabled;
    }
    async updateSettings(vpbxUserUid, partial) {
        const [row] = await this.model.findOrCreate({
            where: { user_uid: vpbxUserUid },
            defaults: { user_uid: vpbxUserUid, confirm_destructive: 0 },
        });
        if (partial.confirmDestructive !== undefined) {
            await row.update({ confirm_destructive: partial.confirmDestructive ? 1 : 0 });
        }
        if (partial.seeAllThreads !== undefined) {
            await this.setSeeAllThreads(vpbxUserUid, partial.seeAllThreads);
        }
        return {
            confirmDestructive: !!row.confirm_destructive,
            seeAllThreads: await this.getSeeAllThreads(vpbxUserUid),
        };
    }
};
exports.AiChatSettingsService = AiChatSettingsService;
exports.AiChatSettingsService = AiChatSettingsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, sequelize_1.InjectModel)(ai_chat_settings_model_1.AiChatSettings)),
    __metadata("design:paramtypes", [Object])
], AiChatSettingsService);
//# sourceMappingURL=ai-chat-settings.service.js.map