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
exports.AutodialDncService = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const sequelize_2 = require("sequelize");
const ac_dnc_model_1 = require("./models/ac-dnc.model");
const ac_base_model_1 = require("./models/ac-base.model");
const ac_campaign_model_1 = require("./models/ac-campaign.model");
const autodial_phone_util_1 = require("./autodial-phone.util");
let AutodialDncService = class AutodialDncService {
    dncModel;
    baseModel;
    campaignModel;
    constructor(dncModel, baseModel, campaignModel) {
        this.dncModel = dncModel;
        this.baseModel = baseModel;
        this.campaignModel = campaignModel;
    }
    async findAll(userUid) {
        const rows = await this.dncModel.findAll({
            where: { user_uid: userUid },
            order: [['uid', 'DESC']],
        });
        return rows.map((r) => this.toDto(r));
    }
    async create(userUid, dto) {
        await this.assertScope(userUid, dto.scope, dto.scope_uid);
        const normalized = (0, autodial_phone_util_1.normalizeAutodialPhone)(dto.normalized_phone);
        if (!normalized) {
            throw new common_1.BadRequestException({ code: 'AC_DNC_INVALID_PHONE', message: 'Invalid phone' });
        }
        const row = await this.dncModel.create({
            user_uid: userUid,
            scope: dto.scope,
            scope_uid: dto.scope_uid ?? null,
            normalized_phone: normalized,
            reason: dto.reason?.trim() ?? '',
            source: dto.source?.trim() ?? 'manual',
            expires_at: dto.expires_at ? new Date(dto.expires_at) : null,
        });
        return this.toDto(row);
    }
    async remove(userUid, uid) {
        const deleted = await this.dncModel.destroy({ where: { uid, user_uid: userUid } });
        if (!deleted) {
            throw new common_1.NotFoundException({ code: 'AC_DNC_NOT_FOUND', message: 'DNC entry not found' });
        }
    }
    async isBlocked(userUid, phone, scope = {}) {
        const normalized = (0, autodial_phone_util_1.normalizeAutodialPhone)(phone);
        if (!normalized)
            return false;
        const now = new Date();
        const orScopes = [{ scope: 'global', scope_uid: null }];
        if (scope.campaignUid != null) {
            orScopes.push({ scope: 'campaign', scope_uid: scope.campaignUid });
        }
        if (scope.baseUid != null) {
            orScopes.push({ scope: 'base', scope_uid: scope.baseUid });
        }
        const hit = await this.dncModel.findOne({
            where: {
                user_uid: userUid,
                normalized_phone: { [sequelize_2.Op.in]: dncPhoneVariants(phone, normalized) },
                [sequelize_2.Op.and]: [
                    { [sequelize_2.Op.or]: orScopes },
                    { [sequelize_2.Op.or]: [{ expires_at: null }, { expires_at: { [sequelize_2.Op.gt]: now } }] },
                ],
            },
        });
        return !!hit;
    }
    async assertScope(userUid, scope, scopeUid) {
        if (scope === 'global' && scopeUid != null) {
            throw new common_1.BadRequestException({ code: 'AC_DNC_SCOPE', message: 'global scope must not have scope_uid' });
        }
        if (scope !== 'global' && (scopeUid == null || scopeUid <= 0)) {
            throw new common_1.BadRequestException({ code: 'AC_DNC_SCOPE', message: 'scope_uid required for campaign/base scope' });
        }
        if (scope === 'global')
            return;
        const query = {
            where: { uid: scopeUid, user_uid: userUid },
            attributes: ['uid'],
        };
        const row = scope === 'base'
            ? await this.baseModel.findOne(query)
            : await this.campaignModel.findOne(query);
        if (!row) {
            throw new common_1.NotFoundException({
                code: 'AC_DNC_SCOPE_NOT_FOUND',
                message: 'DNC scope not found',
            });
        }
    }
    toDto(row) {
        return {
            uid: row.uid,
            user_uid: row.user_uid,
            scope: row.scope,
            scope_uid: row.scope_uid,
            normalized_phone: row.normalized_phone,
            reason: row.reason,
            source: row.source,
            expires_at: row.expires_at?.toISOString() ?? null,
        };
    }
};
exports.AutodialDncService = AutodialDncService;
exports.AutodialDncService = AutodialDncService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, sequelize_1.InjectModel)(ac_dnc_model_1.AcDnc)),
    __param(1, (0, sequelize_1.InjectModel)(ac_base_model_1.AcBase)),
    __param(2, (0, sequelize_1.InjectModel)(ac_campaign_model_1.AcCampaign)),
    __metadata("design:paramtypes", [Object, Object, Object])
], AutodialDncService);
/**
 * New DNC entries use the same canonical form as dialable contact phones. The
 * digit-only variant keeps existing rows created by earlier versions effective
 * until a deliberate data migration is performed.
 */
function dncPhoneVariants(phone, normalized) {
    const digits = (0, autodial_phone_util_1.normalizeAutodialPhone)(phone, 'digits');
    const variants = new Set([normalized, digits]);
    if (/^7\d{10}$/.test(normalized)) {
        variants.add(`8${normalized.slice(1)}`);
    }
    return [...variants].filter(Boolean);
}
//# sourceMappingURL=autodial-dnc.service.js.map