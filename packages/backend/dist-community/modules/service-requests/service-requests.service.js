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
var ServiceRequestsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServiceRequestsService = void 0;
exports.buildCallReceivedAtRange = buildCallReceivedAtRange;
exports.normalizeQueryFilterValues = normalizeQueryFilterValues;
exports.parseCsvFilter = parseCsvFilter;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const service_request_model_1 = require("./service-request.model");
const sequelize_2 = require("sequelize");
const sms_service_1 = require("../sms/sms.service");
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
/** Normalize YYYY-MM-DD query param to MySQL DATETIME start/end of day. */
function buildCallReceivedAtRange(dateFrom, dateTo) {
    const range = {};
    if (dateFrom) {
        const from = dateFrom.slice(0, 10);
        if (DATE_ONLY_RE.test(from)) {
            range[sequelize_2.Op.gte] = `${from} 00:00:00`;
        }
    }
    if (dateTo) {
        const to = dateTo.slice(0, 10);
        if (DATE_ONLY_RE.test(to)) {
            range[sequelize_2.Op.lte] = `${to} 23:59:59`;
        }
    }
    return Object.getOwnPropertySymbols(range).length > 0 ? range : null;
}
/** Parse repeated or single query filter values (values may contain commas). */
function normalizeQueryFilterValues(value) {
    if (value == null)
        return undefined;
    const items = (Array.isArray(value) ? value : [value])
        .map((s) => String(s).trim())
        .filter(Boolean);
    return items.length > 0 ? items : undefined;
}
/** @deprecated Use repeated query params via normalizeQueryFilterValues */
function parseCsvFilter(value) {
    if (!value?.trim())
        return undefined;
    const items = value.split(',').map((s) => s.trim()).filter(Boolean);
    return items.length > 0 ? items : undefined;
}
function applyInFilter(where, field, values) {
    if (!values?.length)
        return;
    where[field] = values.length === 1 ? values[0] : { [sequelize_2.Op.in]: values };
}
/**
 * ServiceRequestsService — CRUD-сервис для обращений клиентов.
 *
 * Все операции фильтруются по user_uid (tenant isolation).
 */
let ServiceRequestsService = ServiceRequestsService_1 = class ServiceRequestsService {
    model;
    smsService;
    logger = new common_1.Logger(ServiceRequestsService_1.name);
    constructor(model, smsService) {
        this.model = model;
        this.smsService = smsService;
    }
    /** Получить все обращения тенанта (с пагинацией) */
    async findAll(userUid, options) {
        const where = { user_uid: userUid };
        applyInFilter(where, 'request_status', normalizeQueryFilterValues(options?.status));
        applyInFilter(where, 'district', normalizeQueryFilterValues(options?.district));
        applyInFilter(where, 'topic', normalizeQueryFilterValues(options?.topic));
        applyInFilter(where, 'territorial_zone', normalizeQueryFilterValues(options?.territorial_zone));
        const callReceivedAtRange = buildCallReceivedAtRange(options?.dateFrom, options?.dateTo);
        if (callReceivedAtRange) {
            where.call_received_at = callReceivedAtRange;
        }
        if (options?.search) {
            where[sequelize_2.Op.or] = [
                { counterparty_name: { [sequelize_2.Op.like]: `%${options.search}%` } },
                { phone: { [sequelize_2.Op.like]: `%${options.search}%` } },
                { account_or_inn: { [sequelize_2.Op.like]: `%${options.search}%` } },
                { request_number: { [sequelize_2.Op.like]: `%${options.search}%` } },
                { address: { [sequelize_2.Op.like]: `%${options.search}%` } },
            ];
        }
        return this.model.findAndCountAll({
            where,
            order: [['call_received_at', 'DESC']],
            limit: options?.limit || 50,
            offset: options?.offset || 0,
        });
    }
    /** Получить одно обращение */
    async findOne(userUid, uid) {
        return this.model.findOne({ where: { uid, user_uid: userUid } });
    }
    /** Создать обращение */
    async create(userUid, data) {
        // Генерируем номер заявки если не указан
        if (!data.request_number) {
            data.request_number = await this.generateRequestNumber(userUid);
        }
        const sendSms = data.send_sms;
        delete data.send_sms;
        // Автоматически ставим текущую дату, если не указана (создание из веб-интерфейса)
        if (!data.call_received_at) {
            data.call_received_at = new Date();
        }
        const record = await this.model.create({ ...data, user_uid: userUid });
        // Отправка СМС если чекбокс активен и есть ответ по срокам
        if (sendSms && record.schedule_comment) {
            const smsText = `По вашему обращению № ${record.request_number}, сообщаем: ${record.schedule_comment}`;
            if (record.phone) {
                this.logger.log(`[Create] Initiating SMS sending to ${record.phone} with text: "${smsText}"`);
                const result = await this.smsService.sendSms(record.phone, smsText);
                this.logger.log(`[Create] SMS Result: ${JSON.stringify(result)}`);
                await record.update({ sms_status: result.success ? 'sent' : 'failed' });
            }
            else {
                this.logger.warn(`[Create] Requested SMS sending but NO PHONE number is provided in record ${record.uid}`);
            }
        }
        return record;
    }
    /** Обновить обращение */
    async update(userUid, uid, data) {
        const record = await this.model.findOne({ where: { uid, user_uid: userUid } });
        if (!record)
            return null;
        const sendSms = data.send_sms;
        delete data.send_sms;
        await record.update(data);
        await record.reload();
        // Отправка СМС если чекбокс активен и есть ответ по срокам
        if (sendSms && record.schedule_comment) {
            const smsText = `По вашему обращению № ${record.request_number}, сообщаем: ${record.schedule_comment}`;
            if (record.phone) {
                this.logger.log(`[Update] Initiating SMS sending to ${record.phone} with text: "${smsText}"`);
                const result = await this.smsService.sendSms(record.phone, smsText);
                this.logger.log(`[Update] SMS Result: ${JSON.stringify(result)}`);
                await record.update({ sms_status: result.success ? 'sent' : 'failed' });
            }
            else {
                this.logger.warn(`[Update] Requested SMS sending but NO PHONE number is provided in record ${record.uid}`);
            }
        }
        return record;
    }
    /** Удалить обращение */
    async remove(userUid, uid) {
        const deleted = await this.model.destroy({ where: { uid, user_uid: userUid } });
        return deleted > 0;
    }
    /** Получить статистику по статусам */
    async getStatusStats(userUid) {
        const results = await this.model.findAll({
            where: { user_uid: userUid },
            attributes: [
                'request_status',
                [this.model.sequelize.fn('COUNT', '*'), 'count'],
            ],
            group: ['request_status'],
            raw: true,
        });
        const stats = {};
        for (const row of results) {
            stats[row.request_status] = parseInt(row.count, 10);
        }
        return stats;
    }
    /** Генерация номера заявки: SR-{tenantId}-{YYMMDD}-{seq} */
    async generateRequestNumber(userUid) {
        const now = new Date();
        const dateStr = now.toISOString().slice(2, 10).replace(/-/g, '');
        const prefix = `КЦ-${dateStr}`;
        // Найти последний номер с таким префиксом
        const last = await this.model.findOne({
            where: {
                user_uid: userUid,
                request_number: { [sequelize_2.Op.like]: `${prefix}-%` },
            },
            order: [['uid', 'DESC']],
        });
        let seq = 1;
        if (last?.request_number) {
            const parts = last.request_number.split('-');
            seq = (parseInt(parts[parts.length - 1], 10) || 0) + 1;
        }
        return `${prefix}-${String(seq).padStart(4, '0')}`;
    }
};
exports.ServiceRequestsService = ServiceRequestsService;
exports.ServiceRequestsService = ServiceRequestsService = ServiceRequestsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, sequelize_1.InjectModel)(service_request_model_1.ServiceRequest)),
    __metadata("design:paramtypes", [Object, sms_service_1.SmsService])
], ServiceRequestsService);
//# sourceMappingURL=service-requests.service.js.map