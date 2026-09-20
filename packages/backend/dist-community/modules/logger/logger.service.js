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
exports.LoggerService = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const sequelize_2 = require("sequelize");
const action_log_model_1 = require("./action-log.model");
const telegram_service_1 = require("../telegram/telegram.service");
let LoggerService = class LoggerService {
    actionLogModel;
    telegramService;
    constructor(actionLogModel, telegramService) {
        this.actionLogModel = actionLogModel;
        this.telegramService = telegramService;
    }
    async logAction(userId, action, entityType, entityId, vpbxUserUid, details, status = 'success') {
        try {
            await this.actionLogModel.create({
                user_id: userId,
                action,
                entity_type: entityType,
                entity_id: entityId,
                user_uid: vpbxUserUid,
                details: details || null,
                status,
            });
            // Format telegram message
            const emoji = action === 'create' || action === 'register' ? '✅'
                : action === 'delete' || action === 'bulk_delete' ? '❌'
                    : action === 'login' ? '🔑'
                        : status === 'error' ? '⚠️'
                            : '📝';
            const tgMessage = `<code>${emoji} ${action}</code>\n<b>User:</b> ${userId}\n<b>Tenant:</b> ${vpbxUserUid}\n<b>Entity:</b> ${entityType} (ID: ${entityId || 'N/A'})\n<b>Status:</b> ${status}\n<b>Details:</b> ${details || '-'}`;
            await this.telegramService.sendMessage(tgMessage, { parse_mode: 'HTML' });
        }
        catch (e) {
            console.error('Failed to log action:', e);
        }
    }
    async getLogs(userUid, filters = {}) {
        const { action, entity_type, status, dateFrom, dateTo, page = 1, limit = 50 } = filters;
        const where = { user_uid: userUid };
        if (action)
            where['action'] = action;
        if (entity_type)
            where['entity_type'] = entity_type;
        if (status)
            where['status'] = status;
        if (dateFrom || dateTo) {
            where['created_at'] = {};
            if (dateFrom)
                where['created_at'][sequelize_2.Op.gte] = new Date(dateFrom);
            if (dateTo) {
                const to = new Date(dateTo);
                to.setHours(23, 59, 59, 999);
                where['created_at'][sequelize_2.Op.lte] = to;
            }
        }
        const { count, rows } = await this.actionLogModel.findAndCountAll({
            where,
            order: [['created_at', 'DESC']],
            limit: Math.min(limit, 200),
            offset: (page - 1) * limit,
        });
        return { total: count, page, limit, items: rows };
    }
    async getStats(userUid) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const [total, todayCount, errorCount] = await Promise.all([
            this.actionLogModel.count({ where: { user_uid: userUid } }),
            this.actionLogModel.count({ where: { user_uid: userUid, created_at: { [sequelize_2.Op.gte]: today } } }),
            this.actionLogModel.count({ where: { user_uid: userUid, status: 'error' } }),
        ]);
        return { total, today: todayCount, errors: errorCount };
    }
};
exports.LoggerService = LoggerService;
exports.LoggerService = LoggerService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, sequelize_1.InjectModel)(action_log_model_1.ActionLog)),
    __metadata("design:paramtypes", [Object, telegram_service_1.TelegramService])
], LoggerService);
//# sourceMappingURL=logger.service.js.map