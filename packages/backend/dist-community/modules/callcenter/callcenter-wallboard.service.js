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
exports.CallCenterWallboardService = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const crypto_1 = require("crypto");
const display_token_model_1 = require("./models/display-token.model");
const alert_config_model_1 = require("./models/alert-config.model");
const notifications_service_1 = require("../notifications/notifications.service");
const DEFAULT_ALERT_CONFIG = {
    integration_uid: null,
    target: null,
    enabled: false,
    cooldown_sec: 300,
};
let CallCenterWallboardService = class CallCenterWallboardService {
    displayTokenModel;
    alertConfigModel;
    notificationsService;
    constructor(displayTokenModel, alertConfigModel, notificationsService) {
        this.displayTokenModel = displayTokenModel;
        this.alertConfigModel = alertConfigModel;
        this.notificationsService = notificationsService;
    }
    /**
     * Generate a high-entropy opaque display token for TV wallboard (D-26).
     * token / user_uid / created_by come from args — never from dto.
     */
    async generateToken(userUid, createdBy, dto) {
        const token = (0, crypto_1.randomBytes)(32).toString('hex');
        let expires_at = null;
        if (dto.expires_in_days != null) {
            expires_at = new Date();
            expires_at.setDate(expires_at.getDate() + dto.expires_in_days);
        }
        const row = await this.displayTokenModel.create({
            token,
            label: dto.label ?? null,
            created_by: createdBy,
            expires_at,
            user_uid: userUid,
        });
        // Return including token so supervisor can copy the URL once
        return row;
    }
    /**
     * List tokens for tenant. Full token returned intentionally so supervisor
     * can copy the wallboard URL (read-only display token, not password-class secret).
     */
    async listTokens(userUid) {
        return this.displayTokenModel.findAll({
            where: { user_uid: userUid },
            order: [['uid', 'DESC']],
        });
    }
    async revokeToken(userUid, uid) {
        const row = await this.displayTokenModel.findOne({
            where: { uid, user_uid: userUid },
        });
        if (!row) {
            throw new common_1.NotFoundException('Display token not found');
        }
        await row.update({ revoked_at: new Date() });
        return { success: true };
    }
    async getAlertConfig(userUid) {
        const row = await this.alertConfigModel.findOne({
            where: { user_uid: userUid },
        });
        if (!row) {
            return { ...DEFAULT_ALERT_CONFIG, user_uid: userUid };
        }
        return row;
    }
    async updateAlertConfig(userUid, dto) {
        if (dto.integration_uid != null) {
            // Tenant-scoped validation — throws NotFound for foreign/missing (T-07-10-06)
            await this.notificationsService.findOne(dto.integration_uid, userUid);
        }
        const existing = await this.alertConfigModel.findOne({
            where: { user_uid: userUid },
        });
        const payload = {
            integration_uid: dto.integration_uid !== undefined
                ? dto.integration_uid
                : (existing?.integration_uid ?? null),
            target: dto.target !== undefined ? dto.target : (existing?.target ?? null),
            enabled: dto.enabled !== undefined ? dto.enabled : (existing?.enabled ?? false),
            cooldown_sec: dto.cooldown_sec !== undefined
                ? dto.cooldown_sec
                : (existing?.cooldown_sec ?? 300),
            updated_at: new Date(),
        };
        if (existing) {
            await existing.update(payload);
            return existing;
        }
        return this.alertConfigModel.create({
            ...payload,
            user_uid: userUid,
        });
    }
};
exports.CallCenterWallboardService = CallCenterWallboardService;
exports.CallCenterWallboardService = CallCenterWallboardService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, sequelize_1.InjectModel)(display_token_model_1.CcDisplayToken)),
    __param(1, (0, sequelize_1.InjectModel)(alert_config_model_1.CcAlertConfig)),
    __metadata("design:paramtypes", [Object, Object, notifications_service_1.NotificationsService])
], CallCenterWallboardService);
//# sourceMappingURL=callcenter-wallboard.service.js.map