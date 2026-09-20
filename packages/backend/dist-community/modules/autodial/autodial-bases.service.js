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
var AutodialBasesService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutodialBasesService = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const sequelize_typescript_1 = require("sequelize-typescript");
const sequelize_2 = require("sequelize");
const ac_base_model_1 = require("./models/ac-base.model");
const ac_base_field_model_1 = require("./models/ac-base-field.model");
const ac_contact_model_1 = require("./models/ac-contact.model");
const ac_contact_phone_model_1 = require("./models/ac-contact-phone.model");
const ac_campaign_model_1 = require("./models/ac-campaign.model");
const ac_import_profile_model_1 = require("./models/ac-import-profile.model");
const ac_task_model_1 = require("./models/ac-task.model");
const autodial_phone_util_1 = require("./autodial-phone.util");
const autodial_contact_util_1 = require("./autodial-contact.util");
let AutodialBasesService = AutodialBasesService_1 = class AutodialBasesService {
    baseModel;
    fieldModel;
    contactModel;
    phoneModel;
    sequelize;
    taskModel;
    campaignModel;
    profileModel;
    logger = new common_1.Logger(AutodialBasesService_1.name);
    constructor(baseModel, fieldModel, contactModel, phoneModel, sequelize, taskModel, campaignModel, profileModel) {
        this.baseModel = baseModel;
        this.fieldModel = fieldModel;
        this.contactModel = contactModel;
        this.phoneModel = phoneModel;
        this.sequelize = sequelize;
        this.taskModel = taskModel;
        this.campaignModel = campaignModel;
        this.profileModel = profileModel;
    }
    async findAll(userUid) {
        const rows = await this.baseModel.findAll({
            where: { user_uid: userUid },
            include: [{ model: ac_base_field_model_1.AcBaseField, as: 'fields' }],
            order: [['name', 'ASC'], [{ model: ac_base_field_model_1.AcBaseField, as: 'fields' }, 'position', 'ASC']],
        });
        const counts = await this.contactModel.findAll({
            attributes: [
                'base_uid',
                [this.sequelize.fn('COUNT', this.sequelize.col('uid')), 'cnt'],
            ],
            where: { user_uid: userUid },
            group: ['base_uid'],
            raw: true,
        });
        const countMap = new Map(counts.map((c) => [c.base_uid, Number(c.cnt)]));
        return rows.map((r) => this.toBaseDto(r, countMap.get(r.uid) ?? 0));
    }
    async findOne(userUid, uid) {
        const row = await this.loadBase(userUid, uid);
        const contact_count = await this.contactModel.count({
            where: { base_uid: uid, user_uid: userUid },
        });
        return this.toBaseDto(row, contact_count);
    }
    async create(userUid, dto) {
        this.assertFields(dto.fields);
        return this.sequelize.transaction(async (transaction) => {
            try {
                const base = await this.baseModel.create({
                    user_uid: userUid,
                    name: dto.name.trim(),
                    description: dto.description?.trim() ?? '',
                    dedup_policy: dto.dedup_policy ?? 'phone',
                    phone_normalization: dto.phone_normalization ?? 'ru_8_to_7',
                    revision: 0,
                }, { transaction });
                await this.replaceFields(base.uid, dto.fields, transaction);
                const full = await this.baseModel.findByPk(base.uid, {
                    include: [{ model: ac_base_field_model_1.AcBaseField, as: 'fields' }],
                    transaction,
                });
                return this.toBaseDto(full, 0);
            }
            catch (e) {
                if (e.name === 'SequelizeUniqueConstraintError') {
                    throw new common_1.ConflictException({ code: 'AC_BASE_NAME_EXISTS', message: 'Base name already exists' });
                }
                throw e;
            }
        });
    }
    async update(userUid, uid, dto) {
        if (dto.fields)
            this.assertFields(dto.fields);
        return this.sequelize.transaction(async (transaction) => {
            const base = await this.lockBase(userUid, uid, transaction);
            if (dto.revision !== undefined && dto.revision !== base.revision) {
                throw new common_1.ConflictException({ code: 'AC_REVISION_CONFLICT', message: 'Base changed. Reload before saving.' });
            }
            if (dto.phone_normalization && dto.phone_normalization !== base.phone_normalization
                && await this.contactModel.count({ where: { base_uid: uid }, transaction })) {
                throw new common_1.ConflictException({ code: 'AC_BASE_IN_USE', message: 'Phone normalization requires an explicit data migration.' });
            }
            await base.update({
                ...(dto.name != null ? { name: dto.name.trim() } : {}),
                ...(dto.description != null ? { description: dto.description.trim() } : {}),
                ...(dto.dedup_policy != null ? { dedup_policy: dto.dedup_policy } : {}),
                ...(dto.phone_normalization != null
                    ? { phone_normalization: dto.phone_normalization }
                    : {}),
                revision: (base.revision ?? 0) + 1,
            }, { transaction });
            if (dto.fields) {
                await this.replaceFields(uid, dto.fields, transaction);
            }
            const full = await this.baseModel.findByPk(uid, {
                include: [{ model: ac_base_field_model_1.AcBaseField, as: 'fields' }],
                transaction,
            });
            const contact_count = await this.contactModel.count({
                where: { base_uid: uid, user_uid: userUid },
                transaction,
            });
            return this.toBaseDto(full, contact_count);
        });
    }
    async remove(userUid, uid) {
        await this.sequelize.transaction(async (transaction) => {
            const base = await this.lockBase(userUid, uid, transaction);
            await this.assertBaseReplaceable(userUid, uid, transaction);
            // The versioned schema deliberately uses NO ACTION foreign keys. Remove
            // dependent rows explicitly so deleting an unused base works on both
            // MySQL and PostgreSQL without relying on implicit cascades.
            await this.phoneModel.destroy({ where: { base_uid: uid }, transaction });
            await this.contactModel.destroy({ where: { base_uid: uid, user_uid: userUid }, transaction });
            await this.fieldModel.destroy({ where: { base_uid: uid }, transaction });
            await this.profileModel.destroy({ where: { base_uid: uid, user_uid: userUid }, transaction });
            await this.sequelize.query('DELETE FROM ac_import_runs WHERE base_uid = :baseUid AND vpbx_user_uid = :userUid', { replacements: { baseUid: uid, userUid }, transaction });
            await this.sequelize.query("DELETE FROM ac_dnc WHERE scope = 'base' AND scope_uid = :baseUid AND vpbx_user_uid = :userUid", { replacements: { baseUid: uid, userUid }, transaction });
            await base.destroy({ transaction });
        });
    }
    async listContacts(userUid, baseUid, opts = {}) {
        await this.loadBase(userUid, baseUid);
        const page = Number.isSafeInteger(opts.page) ? Math.max(1, opts.page) : 1;
        const pageSize = Number.isSafeInteger(opts.pageSize) ? Math.min(200, Math.max(1, opts.pageSize)) : 50;
        const where = { base_uid: baseUid, user_uid: userUid };
        if (opts.q?.trim()) {
            where[sequelize_2.Op.or] = [
                { external_id: { [sequelize_2.Op.like]: `%${opts.q.trim()}%` } },
                { comment: { [sequelize_2.Op.like]: `%${opts.q.trim()}%` } },
            ];
        }
        const { rows, count } = await this.contactModel.findAndCountAll({
            where,
            include: [{ model: ac_contact_phone_model_1.AcContactPhone, as: 'phones' }],
            distinct: true,
            order: [['uid', 'DESC']],
            limit: pageSize,
            offset: (page - 1) * pageSize,
        });
        const fields = await this.fieldModel.findAll({ where: { base_uid: baseUid } });
        return {
            items: rows.map((r) => this.toContactDto(r, fields)),
            total: count,
            page,
            page_size: pageSize,
        };
    }
    async findContact(userUid, baseUid, contactUid) {
        const base = await this.loadBase(userUid, baseUid);
        const contact = await this.contactModel.findOne({
            where: { uid: contactUid, base_uid: baseUid, user_uid: userUid },
            include: [{ model: ac_contact_phone_model_1.AcContactPhone, as: 'phones' }],
        });
        if (!contact)
            throw new common_1.NotFoundException({ code: 'AC_CONTACT_NOT_FOUND', message: 'Contact not found' });
        return this.toContactDto(contact, base.fields ?? []);
    }
    async createContact(userUid, baseUid, dto) {
        return this.sequelize.transaction(async (transaction) => {
            const base = await this.lockBase(userUid, baseUid, transaction);
            const fields = base.fields ?? [];
            if (dto.phones?.some((phone) => phone.uid !== undefined)) {
                throw new common_1.BadRequestException({ code: 'AC_PHONE_UID', message: 'New phones must not supply UID' });
            }
            const prepared = (0, autodial_contact_util_1.prepareAutodialContact)(fields, dto, base.phone_normalization);
            const contact = await this.contactModel.create({
                base_uid: baseUid,
                user_uid: userUid,
                external_id: prepared.external_id,
                values: prepared.values,
                comment: dto.comment?.trim() ?? '',
            }, { transaction });
            await this.writePhones(contact.uid, baseUid, prepared.phones, transaction);
            await base.increment('revision', { transaction });
            const full = await this.contactModel.findByPk(contact.uid, {
                include: [{ model: ac_contact_phone_model_1.AcContactPhone, as: 'phones' }],
                transaction,
            });
            return this.toContactDto(full, fields);
        });
    }
    async updateContact(userUid, baseUid, contactUid, dto) {
        return this.sequelize.transaction(async (transaction) => {
            const base = await this.lockBase(userUid, baseUid, transaction);
            const fields = base.fields ?? [];
            const contact = await this.contactModel.findOne({
                where: { uid: contactUid, base_uid: baseUid, user_uid: userUid },
                include: [{ model: ac_contact_phone_model_1.AcContactPhone, as: 'phones' }],
                transaction,
            });
            if (!contact)
                throw new common_1.NotFoundException({ code: 'AC_CONTACT_NOT_FOUND', message: 'Contact not found' });
            const merged = {
                external_id: dto.external_id !== undefined ? dto.external_id : contact.external_id,
                values: dto.values ?? this.valuesByKey(contact.values, fields),
                phones: dto.phones ?? (contact.phones ?? []).map((p) => ({
                    uid: p.uid,
                    raw: p.raw,
                    is_primary: p.is_primary,
                    tz_offset_min: p.tz_offset_min,
                })),
                comment: dto.comment ?? contact.comment,
            };
            const prepared = (0, autodial_contact_util_1.prepareAutodialContact)(fields, merged, base.phone_normalization);
            await contact.update({
                external_id: prepared.external_id,
                values: prepared.values,
                comment: merged.comment?.trim() ?? '',
            }, { transaction });
            await this.syncPhones(userUid, baseUid, contactUid, contact.phones ?? [], prepared.phones, transaction);
            await base.increment('revision', { transaction });
            const full = await this.contactModel.findByPk(contactUid, {
                include: [{ model: ac_contact_phone_model_1.AcContactPhone, as: 'phones' }],
                transaction,
            });
            return this.toContactDto(full, fields);
        });
    }
    async deleteContact(userUid, baseUid, contactUid) {
        await this.sequelize.transaction(async (transaction) => {
            const base = await this.lockBase(userUid, baseUid, transaction);
            if (await this.taskModel.count({ where: { user_uid: userUid, contact_uid: contactUid }, transaction })) {
                throw new common_1.ConflictException({ code: 'AC_CONTACT_IN_USE', message: 'Contact has campaign tasks or call history.' });
            }
            const n = await this.contactModel.destroy({
                where: { uid: contactUid, base_uid: baseUid, user_uid: userUid }, transaction,
            });
            if (!n)
                throw new common_1.NotFoundException({ code: 'AC_CONTACT_NOT_FOUND', message: 'Contact not found' });
            await base.increment('revision', { transaction });
        });
    }
    /** All base/contact/import writers serialize through this row lock. */
    async lockBase(userUid, baseUid, transaction) {
        const base = await this.baseModel.findOne({
            where: { uid: baseUid, user_uid: userUid }, transaction, lock: transaction.LOCK.UPDATE,
        });
        if (!base)
            throw new common_1.NotFoundException({ code: 'AC_BASE_NOT_FOUND', message: 'Base not found' });
        base.fields = await this.fieldModel.findAll({ where: { base_uid: baseUid }, transaction });
        return base;
    }
    async assertBaseReplaceable(userUid, baseUid, transaction) {
        if (await this.campaignModel.count({ where: { user_uid: userUid, base_uid: baseUid }, transaction })) {
            throw new common_1.ConflictException({ code: 'AC_BASE_IN_USE', message: 'A campaign references this base.' });
        }
        // A campaign may have switched bases in an older version. Preserve its history too.
        const [rows] = await this.sequelize.query('SELECT t.uid FROM ac_tasks t JOIN ac_contacts c ON c.uid = t.contact_uid WHERE c.base_uid = :baseUid LIMIT 1', { replacements: { baseUid }, transaction });
        if (rows.length)
            throw new common_1.ConflictException({ code: 'AC_BASE_IN_USE', message: 'Base has campaign tasks or call history.' });
    }
    // ── helpers ───────────────────────────────────────────────────────
    async loadBase(userUid, uid) {
        const row = await this.baseModel.findOne({
            where: { uid, user_uid: userUid },
            include: [{ model: ac_base_field_model_1.AcBaseField, as: 'fields' }],
            order: [[{ model: ac_base_field_model_1.AcBaseField, as: 'fields' }, 'position', 'ASC']],
        });
        if (!row)
            throw new common_1.NotFoundException({ code: 'AC_BASE_NOT_FOUND', message: 'Base not found' });
        return row;
    }
    assertFields(fields) {
        if (!fields?.length) {
            throw new common_1.BadRequestException({ code: 'AC_FIELDS_REQUIRED', message: 'At least one field required' });
        }
        const keys = new Set();
        let phoneCount = 0;
        for (const f of fields) {
            if (keys.has(f.key)) {
                throw new common_1.BadRequestException({ code: 'AC_FIELD_DUP', message: `Duplicate field key ${f.key}` });
            }
            keys.add(f.key);
            if (f.is_phone || f.type === 'phone')
                phoneCount += 1;
        }
        if (phoneCount < 1) {
            throw new common_1.BadRequestException({
                code: 'AC_PHONE_FIELD_REQUIRED',
                message: 'At least one phone field is required',
            });
        }
    }
    async replaceFields(baseUid, fields, transaction) {
        const existing = await this.fieldModel.findAll({ where: { base_uid: baseUid }, transaction });
        const byUid = new Map(existing.map((field) => [field.uid, field]));
        const byKey = new Map(existing.map((field) => [field.key, field]));
        const retained = new Set();
        const planned = fields.map((field, position) => {
            const previous = field.uid !== undefined ? byUid.get(field.uid) : byKey.get(field.key);
            if (field.uid !== undefined && !previous) {
                throw new common_1.BadRequestException({ code: 'AC_FIELD_UID', message: 'Field does not belong to this base.' });
            }
            if (previous && retained.has(previous.uid)) {
                throw new common_1.BadRequestException({ code: 'AC_FIELD_DUP', message: 'Duplicate field UID.' });
            }
            if (previous)
                retained.add(previous.uid);
            const keyOwner = byKey.get(field.key);
            if (keyOwner && keyOwner.uid !== previous?.uid) {
                throw new common_1.ConflictException({ code: 'AC_FIELD_KEY_IN_USE', message: 'A different field owns this key.' });
            }
            return {
                previous,
                data: {
                    base_uid: baseUid, key: field.key, label: field.label, type: field.type,
                    required: field.required ?? false, position: field.position ?? position,
                    is_phone: field.is_phone === true || field.type === 'phone',
                    var_name: field.var_name?.trim() || (0, autodial_phone_util_1.fieldKeyToVarName)(field.key),
                    enum_values: field.type === 'enum' ? field.enum_values ?? [] : null,
                },
            };
        });
        const removed = existing.filter((field) => !retained.has(field.uid));
        const incompatible = removed.length > 0 || planned.some(({ previous, data }) => previous && (previous.type !== data.type || previous.is_phone !== data.is_phone
            || JSON.stringify(previous.enum_values ?? []) !== JSON.stringify(data.enum_values ?? [])
            || (!previous.required && data.required))) || planned.some(({ previous, data }) => !previous && data.required && !data.is_phone);
        if (incompatible && await this.contactModel.count({ where: { base_uid: baseUid }, transaction })) {
            throw new common_1.ConflictException({ code: 'AC_SCHEMA_IN_USE', message: 'Changing a populated schema requires an explicit migration.' });
        }
        const changesReferences = removed.length > 0 || planned.some(({ previous, data }) => previous && (previous.key !== data.key || previous.var_name !== data.var_name || previous.type !== data.type));
        if (changesReferences && (await this.campaignModel.count({ where: { base_uid: baseUid }, transaction })
            || await this.profileModel.count({ where: { base_uid: baseUid }, transaction }))) {
            throw new common_1.ConflictException({ code: 'AC_FIELD_IN_USE', message: 'Campaigns or import profiles reference this schema.' });
        }
        if (removed.length) {
            await this.fieldModel.destroy({ where: { base_uid: baseUid, uid: removed.map((field) => field.uid) }, transaction });
        }
        for (const { previous, data } of planned) {
            if (previous)
                await previous.update(data, { transaction });
            else
                await this.fieldModel.create(data, { transaction });
        }
    }
    async syncPhones(userUid, baseUid, contactUid, existing, phones, transaction) {
        const remaining = new Map(existing.map((phone) => [phone.uid, phone]));
        const planned = phones.map((phone) => {
            // Legacy clients have no UID: match by normalized identity, never position.
            const previous = phone.uid !== undefined
                ? remaining.get(phone.uid)
                : [...remaining.values()].find((candidate) => candidate.normalized === phone.normalized);
            if (phone.uid !== undefined && !previous) {
                throw new common_1.BadRequestException({ code: 'AC_PHONE_UID', message: 'Unknown or repeated phone UID.' });
            }
            if (previous)
                remaining.delete(previous.uid);
            return { previous, phone };
        });
        const changed = [
            ...remaining.keys(),
            ...planned.filter(({ previous, phone }) => previous && previous.normalized !== phone.normalized)
                .map(({ previous }) => previous.uid),
        ];
        if (changed.length && await this.taskModel.count({
            where: { user_uid: userUid, phone_uid: changed }, transaction,
        })) {
            throw new common_1.ConflictException({ code: 'AC_PHONE_IN_USE', message: 'A number with campaign tasks cannot be removed or replaced.' });
        }
        if (remaining.size) {
            await this.phoneModel.destroy({ where: { contact_uid: contactUid, uid: [...remaining.keys()] }, transaction });
        }
        for (const { previous, phone } of planned) {
            const { uid: _uid, ...data } = phone;
            if (previous)
                await previous.update(data, { transaction });
            else
                await this.phoneModel.create({ ...data, contact_uid: contactUid, base_uid: baseUid }, { transaction });
        }
    }
    async writePhones(contactUid, baseUid, phones, transaction) {
        await this.phoneModel.bulkCreate(phones.map((p) => ({
            contact_uid: contactUid,
            base_uid: baseUid,
            ...p,
        })), { transaction });
    }
    valuesByKey(values, fields) {
        const byUid = new Map(fields.map((f) => [String(f.uid), f.key]));
        const out = {};
        for (const [uid, v] of Object.entries(values ?? {})) {
            const key = byUid.get(uid);
            if (key)
                out[key] = v;
        }
        return out;
    }
    toBaseDto(row, contact_count) {
        return {
            uid: row.uid,
            user_uid: row.user_uid,
            name: row.name,
            description: row.description,
            dedup_policy: row.dedup_policy,
            phone_normalization: row.phone_normalization,
            revision: row.revision,
            contact_count,
            fields: (row.fields ?? [])
                .slice()
                .sort((a, b) => a.position - b.position)
                .map((f) => ({
                uid: f.uid,
                base_uid: f.base_uid,
                key: f.key,
                label: f.label,
                type: f.type,
                required: f.required,
                position: f.position,
                is_phone: f.is_phone,
                var_name: f.var_name,
                enum_values: f.enum_values,
            })),
            created_at: row.created_at?.toISOString?.() ?? undefined,
            updated_at: row.updated_at?.toISOString?.() ?? undefined,
        };
    }
    toContactDto(row, fields) {
        return {
            uid: row.uid,
            base_uid: row.base_uid,
            external_id: row.external_id,
            values: this.valuesByKey(row.values, fields),
            comment: row.comment,
            phones: (row.phones ?? [])
                .slice()
                .sort((a, b) => a.position - b.position)
                .map((p) => ({
                uid: p.uid,
                contact_uid: p.contact_uid,
                raw: p.raw,
                normalized: p.normalized,
                position: p.position,
                is_primary: p.is_primary,
                tz_offset_min: p.tz_offset_min,
            })),
            created_at: row.created_at?.toISOString?.() ?? undefined,
            updated_at: row.updated_at?.toISOString?.() ?? undefined,
        };
    }
};
exports.AutodialBasesService = AutodialBasesService;
exports.AutodialBasesService = AutodialBasesService = AutodialBasesService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, sequelize_1.InjectModel)(ac_base_model_1.AcBase)),
    __param(1, (0, sequelize_1.InjectModel)(ac_base_field_model_1.AcBaseField)),
    __param(2, (0, sequelize_1.InjectModel)(ac_contact_model_1.AcContact)),
    __param(3, (0, sequelize_1.InjectModel)(ac_contact_phone_model_1.AcContactPhone)),
    __param(5, (0, sequelize_1.InjectModel)(ac_task_model_1.AcTask)),
    __param(6, (0, sequelize_1.InjectModel)(ac_campaign_model_1.AcCampaign)),
    __param(7, (0, sequelize_1.InjectModel)(ac_import_profile_model_1.AcImportProfile)),
    __metadata("design:paramtypes", [Object, Object, Object, Object, sequelize_typescript_1.Sequelize, Object, Object, Object])
], AutodialBasesService);
//# sourceMappingURL=autodial-bases.service.js.map