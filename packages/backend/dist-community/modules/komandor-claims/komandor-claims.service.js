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
var KomandorClaimsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.KomandorClaimsService = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const sequelize_2 = require("sequelize");
const komandor_claim_model_1 = require("./komandor-claim.model");
const komandor_store_model_1 = require("./komandor-store.model");
const komandor_dict_model_1 = require("./komandor-dict.model");
const sms_service_1 = require("../sms/sms.service");
const mailer_service_1 = require("../mailer/mailer.service");
const komandor_claim_notify_util_1 = require("./komandor-claim-notify.util");
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
function emailsFromPeople(people) {
    if (!Array.isArray(people))
        return [];
    return people.map((p) => (p.email || '').trim()).filter(Boolean);
}
function parseExtraEmails(raw) {
    if (!raw)
        return [];
    return raw.split(/[,;\s]+/).map((s) => s.trim()).filter((s) => s.includes('@'));
}
function collectStoreEmails(record) {
    return [
        ...emailsFromPeople(record.directors),
        ...emailsFromPeople(record.zdf),
        ...emailsFromPeople(record.extra_recipients),
        ...parseExtraEmails(record.extra_emails),
    ].filter((v, i, a) => a.indexOf(v) === i);
}
let KomandorClaimsService = KomandorClaimsService_1 = class KomandorClaimsService {
    model;
    storeModel;
    dictModel;
    smsService;
    mailer;
    logger = new common_1.Logger(KomandorClaimsService_1.name);
    constructor(model, storeModel, dictModel, smsService, mailer) {
        this.model = model;
        this.storeModel = storeModel;
        this.dictModel = dictModel;
        this.smsService = smsService;
        this.mailer = mailer;
    }
    async listStores(userUid, q) {
        const where = { is_active: 1, user_uid: { [sequelize_2.Op.in]: [userUid, 0] } };
        if (q?.trim()) {
            const like = { [sequelize_2.Op.like]: `%${q.trim()}%` };
            where[sequelize_2.Op.or] = [{ code: like }, { name: like }, { address: like }, { city: like }];
        }
        return this.storeModel.findAll({ where, order: [['code', 'ASC'], ['name', 'ASC']], limit: 200 });
    }
    async listDict(kind) {
        const where = { is_active: 1 };
        if (kind)
            where.kind = kind;
        return this.dictModel.findAll({ where, order: [['kind', 'ASC'], ['sort_order', 'ASC'], ['name', 'ASC']] });
    }
    async findAll(userUid, options) {
        const where = { user_uid: userUid };
        const statuses = this.normalizeFilter(options?.status);
        if (statuses?.length)
            where.request_status = statuses.length === 1 ? statuses[0] : { [sequelize_2.Op.in]: statuses };
        const topics = this.normalizeFilter(options?.topic);
        if (topics?.length)
            where.topic = topics.length === 1 ? topics[0] : { [sequelize_2.Op.in]: topics };
        if (options?.store?.trim()) {
            const like = { [sequelize_2.Op.like]: `%${options.store.trim()}%` };
            where[sequelize_2.Op.and] = [
                ...(where[sequelize_2.Op.and] || []),
                { [sequelize_2.Op.or]: [{ store_code: like }, { store_name: like }, { store_address: like }] },
            ];
        }
        const range = {};
        if (options?.dateFrom && DATE_ONLY_RE.test(options.dateFrom.slice(0, 10))) {
            range[sequelize_2.Op.gte] = `${options.dateFrom.slice(0, 10)} 00:00:00`;
        }
        if (options?.dateTo && DATE_ONLY_RE.test(options.dateTo.slice(0, 10))) {
            range[sequelize_2.Op.lte] = `${options.dateTo.slice(0, 10)} 23:59:59`;
        }
        if (Object.getOwnPropertySymbols(range).length)
            where.request_date = range;
        if (options?.search?.trim()) {
            const like = { [sequelize_2.Op.like]: `%${options.search.trim()}%` };
            where[sequelize_2.Op.or] = [
                { request_number: like },
                { client_phone: like },
                { client_email: like },
                { contact_info: like },
                { store_name: like },
                { store_address: like },
                { description: like },
            ];
        }
        return this.model.findAndCountAll({
            where,
            order: [['request_date', 'DESC'], ['uid', 'DESC']],
            limit: options?.limit || 50,
            offset: options?.offset || 0,
        });
    }
    async getStatusStats(userUid) {
        const rows = await this.model.findAll({
            where: { user_uid: userUid },
            attributes: ['request_status', [this.model.sequelize.fn('COUNT', this.model.sequelize.col('uid')), 'cnt']],
            group: ['request_status'],
            raw: true,
        });
        const stats = {
            new: 0, in_progress: 0, completed: 0, postponed: 0, impossible: 0,
        };
        for (const r of rows)
            stats[r.request_status] = Number(r.cnt) || 0;
        return stats;
    }
    async findOne(userUid, uid) {
        return this.model.findOne({ where: { uid, user_uid: userUid } });
    }
    async create(userUid, data) {
        const flags = this.extractFlags(data);
        if (!data.request_number)
            data.request_number = await this.generateRequestNumber(userUid);
        if (!data.request_date)
            data.request_date = new Date();
        if (data.department_note?.trim()) {
            data.department_log = [{
                    at: new Date().toISOString(),
                    author: data.operator_name || 'оператор',
                    text: data.department_note.trim(),
                }];
        }
        delete data.department_note;
        await this.applyStoreDefaults(userUid, data);
        const record = await this.model.create({ ...data, user_uid: userUid });
        await this.dispatchNotifications(record, flags);
        return record.reload();
    }
    async update(userUid, uid, data) {
        const record = await this.model.findOne({ where: { uid, user_uid: userUid } });
        if (!record)
            return null;
        const flags = this.extractFlags(data);
        if (data.department_note?.trim()) {
            const log = [...(record.department_log || [])];
            log.push({
                at: new Date().toISOString(),
                author: data.operator_name || record.operator_name || 'оператор',
                text: data.department_note.trim(),
            });
            data.department_log = log;
        }
        delete data.department_note;
        await this.applyStoreDefaults(userUid, data);
        await record.update(data);
        await record.reload();
        await this.dispatchNotifications(record, flags);
        return record.reload();
    }
    async remove(userUid, uid) {
        const deleted = await this.model.destroy({ where: { uid, user_uid: userUid } });
        return deleted > 0;
    }
    extractFlags(data) {
        const flags = {
            send_sms: !!data.send_sms,
            send_email: !!data.send_email,
            send_to_store: !!data.send_to_store,
        };
        delete data.send_sms;
        delete data.send_email;
        delete data.send_to_store;
        return flags;
    }
    async applyStoreDefaults(userUid, data) {
        if (!data.store_id)
            return;
        const store = await this.storeModel.findOne({
            where: { uid: data.store_id, user_uid: { [sequelize_2.Op.in]: [userUid, 0] } },
        });
        if (!store)
            return;
        if (!data.store_code)
            data.store_code = store.code;
        if (!data.store_name)
            data.store_name = store.name;
        if (!data.store_address)
            data.store_address = store.address;
        if (!data.directors)
            data.directors = store.directors;
        if (!data.zdf)
            data.zdf = store.zdf;
    }
    async dispatchNotifications(record, flags) {
        const clientText = (0, komandor_claim_notify_util_1.buildKomandorClientNotice)(record.request_number, record.customer_response);
        if (flags.send_sms && record.client_phone) {
            const result = await this.smsService.sendSms(record.client_phone, clientText);
            await record.update({ sms_status: result.success ? 'sent' : 'failed' });
        }
        if (flags.send_email && record.client_email) {
            const result = await this.mailer.sendNotification({
                to: record.client_email,
                subject: `Обращение ${record.request_number} — Командор`,
                text: clientText,
            });
            await record.update({ email_status: result.success ? 'sent' : 'failed' });
        }
        if (flags.send_to_store) {
            const to = collectStoreEmails(record);
            if (to.length) {
                const result = await this.mailer.sendNotification({
                    to: to.join(','),
                    subject: `Рекламация ${record.request_number} — ${record.store_name || record.store_code || 'магазин'}`,
                    text: (0, komandor_claim_notify_util_1.buildKomandorStoreEmail)(record),
                });
                await record.update({ store_email_status: result.success ? 'sent' : 'failed' });
            }
            else {
                this.logger.warn(`[Claim ${record.uid}] send_to_store but no recipient emails`);
                await record.update({ store_email_status: 'failed' });
            }
        }
    }
    async generateRequestNumber(userUid) {
        const prefix = `КМ-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}`;
        const last = await this.model.findOne({
            where: { user_uid: userUid, request_number: { [sequelize_2.Op.like]: `${prefix}-%` } },
            order: [['uid', 'DESC']],
        });
        let seq = 1;
        if (last?.request_number) {
            const parts = last.request_number.split('-');
            seq = (parseInt(parts[parts.length - 1], 10) || 0) + 1;
        }
        return `${prefix}-${String(seq).padStart(4, '0')}`;
    }
    normalizeFilter(value) {
        if (value == null)
            return undefined;
        const items = (Array.isArray(value) ? value : [value]).map((s) => String(s).trim()).filter(Boolean);
        return items.length ? items : undefined;
    }
};
exports.KomandorClaimsService = KomandorClaimsService;
exports.KomandorClaimsService = KomandorClaimsService = KomandorClaimsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, sequelize_1.InjectModel)(komandor_claim_model_1.KomandorClaim)),
    __param(1, (0, sequelize_1.InjectModel)(komandor_store_model_1.KomandorStore)),
    __param(2, (0, sequelize_1.InjectModel)(komandor_dict_model_1.KomandorDict)),
    __metadata("design:paramtypes", [Object, Object, Object, sms_service_1.SmsService,
        mailer_service_1.MailerService])
], KomandorClaimsService);
//# sourceMappingURL=komandor-claims.service.js.map