"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var AutodialImportService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutodialImportService = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const sequelize_typescript_1 = require("sequelize-typescript");
const ExcelJS = __importStar(require("exceljs"));
const ac_base_model_1 = require("./models/ac-base.model");
const ac_base_field_model_1 = require("./models/ac-base-field.model");
const ac_contact_model_1 = require("./models/ac-contact.model");
const ac_contact_phone_model_1 = require("./models/ac-contact-phone.model");
const ac_import_profile_model_1 = require("./models/ac-import-profile.model");
const ac_import_run_model_1 = require("./models/ac-import-run.model");
const autodial_bases_service_1 = require("./autodial-bases.service");
const autodial_phone_util_1 = require("./autodial-phone.util");
const autodial_contact_util_1 = require("./autodial-contact.util");
let AutodialImportService = AutodialImportService_1 = class AutodialImportService {
    baseModel;
    fieldModel;
    contactModel;
    phoneModel;
    profileModel;
    runModel;
    basesService;
    sequelize;
    logger = new common_1.Logger(AutodialImportService_1.name);
    constructor(baseModel, fieldModel, contactModel, phoneModel, profileModel, runModel, basesService, sequelize) {
        this.baseModel = baseModel;
        this.fieldModel = fieldModel;
        this.contactModel = contactModel;
        this.phoneModel = phoneModel;
        this.profileModel = profileModel;
        this.runModel = runModel;
        this.basesService = basesService;
        this.sequelize = sequelize;
    }
    async listProfiles(userUid, baseUid) {
        await this.assertBase(userUid, baseUid);
        const rows = await this.profileModel.findAll({
            where: { base_uid: baseUid, user_uid: userUid },
            order: [['name', 'ASC']],
        });
        return rows.map((r) => this.toProfileDto(r));
    }
    async upsertProfile(userUid, baseUid, body) {
        await this.assertBase(userUid, baseUid);
        if (!body.column_map?.length) {
            throw new common_1.BadRequestException({ code: 'AC_COLUMN_MAP_REQUIRED', message: 'column_map required' });
        }
        if (body.uid) {
            const existing = await this.profileModel.findOne({
                where: { uid: body.uid, base_uid: baseUid, user_uid: userUid },
            });
            if (!existing)
                throw new common_1.NotFoundException({ code: 'AC_PROFILE_NOT_FOUND', message: 'Profile not found' });
            await existing.update({
                name: body.name.trim(),
                source: body.source ?? existing.source,
                delimiter: body.delimiter ?? existing.delimiter,
                encoding: body.encoding ?? existing.encoding,
                has_header: body.has_header ?? existing.has_header,
                column_map: body.column_map,
                dedup_policy: body.dedup_policy ?? existing.dedup_policy,
            });
            return this.toProfileDto(existing);
        }
        const created = await this.profileModel.create({
            base_uid: baseUid,
            user_uid: userUid,
            name: body.name.trim(),
            source: body.source ?? 'csv',
            delimiter: body.delimiter ?? ';',
            encoding: body.encoding ?? 'utf-8',
            has_header: body.has_header ?? true,
            column_map: body.column_map,
            dedup_policy: body.dedup_policy ?? 'phone',
        });
        return this.toProfileDto(created);
    }
    async deleteProfile(userUid, baseUid, profileUid) {
        const n = await this.profileModel.destroy({
            where: { uid: profileUid, base_uid: baseUid, user_uid: userUid },
        });
        if (!n)
            throw new common_1.NotFoundException({ code: 'AC_PROFILE_NOT_FOUND', message: 'Profile not found' });
    }
    async previewCsv(buffer, options = {}) {
        const text = this.decodeText(buffer);
        const delimiter = options.delimiter || this.detectDelimiter(text);
        const rows = this.parseCsv(text, delimiter);
        if (!rows.length) {
            throw new common_1.BadRequestException({ code: 'AC_CSV_EMPTY', message: 'Empty CSV' });
        }
        const headers = options.has_header === false ? rows[0].map((_, i) => String(i)) : rows[0];
        const data = options.has_header === false ? rows : rows.slice(1);
        return {
            headers,
            sample_rows: data.slice(0, 5),
            delimiter,
            total_rows: data.length,
        };
    }
    async previewXlsx(buffer, options = {}) {
        const wb = new ExcelJS.Workbook();
        // exceljs typings accept Buffer via any
        await wb.xlsx.load(buffer);
        const sheet = wb.worksheets[0];
        if (!sheet)
            throw new common_1.BadRequestException({ code: 'AC_XLSX_EMPTY', message: 'Empty workbook' });
        const rows = [];
        sheet.eachRow({ includeEmpty: false }, (row) => {
            const cells = [];
            row.eachCell({ includeEmpty: true }, (cell, col) => {
                cells[col - 1] = cell.text?.trim() ?? '';
            });
            rows.push(cells.map((c) => c ?? ''));
        });
        if (!rows.length)
            throw new common_1.BadRequestException({ code: 'AC_XLSX_EMPTY', message: 'Empty sheet' });
        return {
            headers: options.has_header === false ? rows[0].map((_, i) => String(i)) : rows[0],
            sample_rows: (options.has_header === false ? rows : rows.slice(1)).slice(0, 5),
            delimiter: '',
            total_rows: Math.max(0, rows.length - (options.has_header === false ? 0 : 1)),
        };
    }
    async importFile(userUid, baseUid, opts) {
        const base = await this.assertBase(userUid, baseUid);
        const fields = await this.fieldModel.findAll({ where: { base_uid: baseUid } });
        let columnMap = opts.column_map;
        let delimiter = opts.delimiter ?? ';';
        let hasHeader = opts.has_header ?? true;
        let dedup = opts.dedup_policy ?? base.dedup_policy;
        let profileUid = opts.profileUid ?? null;
        if (opts.profileUid) {
            const profile = await this.profileModel.findOne({
                where: { uid: opts.profileUid, base_uid: baseUid, user_uid: userUid },
            });
            if (!profile)
                throw new common_1.NotFoundException({ code: 'AC_PROFILE_NOT_FOUND', message: 'Profile not found' });
            columnMap = opts.column_map ?? profile.column_map;
            delimiter = opts.delimiter ?? profile.delimiter;
            hasHeader = opts.has_header ?? profile.has_header;
            dedup = opts.dedup_policy ?? profile.dedup_policy;
            profileUid = profile.uid;
        }
        if (!columnMap?.length) {
            throw new common_1.BadRequestException({ code: 'AC_COLUMN_MAP_REQUIRED', message: 'column_map or profile required' });
        }
        let table;
        if (opts.source === 'xlsx') {
            table = await this.readAllXlsx(opts.buffer);
        }
        else {
            const text = this.decodeText(opts.buffer);
            table = this.parseCsv(text, delimiter);
        }
        if (!table.length) {
            throw new common_1.BadRequestException({ code: 'AC_IMPORT_EMPTY', message: 'No rows' });
        }
        const headers = hasHeader ? table[0] : table[0].map((_, i) => String(i));
        const dataRows = hasHeader ? table.slice(1) : table;
        const errors = [];
        const prepared = [];
        const seenPhones = new Set();
        const seenExternal = new Set();
        for (let i = 0; i < dataRows.length; i++) {
            const rowNum = i + (hasHeader ? 2 : 1);
            const cells = dataRows[i];
            try {
                const mapped = this.mapRow(headers, cells, columnMap, fields, base.phone_normalization);
                if (dedup === 'phone' && mapped.phones.some((p) => seenPhones.has(p.normalized))) {
                    errors.push({ row: rowNum, code: 'duplicate_phone', message: 'duplicate_phone' });
                    continue;
                }
                if (dedup === 'external_id' && mapped.external_id) {
                    if (seenExternal.has(mapped.external_id)) {
                        errors.push({ row: rowNum, code: 'duplicate_external_id', message: mapped.external_id });
                        continue;
                    }
                    seenExternal.add(mapped.external_id);
                }
                if (!mapped.phones.length) {
                    errors.push({ row: rowNum, code: 'no_phone', message: 'No phone mapped' });
                    continue;
                }
                mapped.phones.forEach((phone) => seenPhones.add(phone.normalized));
                prepared.push(mapped);
            }
            catch (e) {
                errors.push({
                    row: rowNum,
                    code: 'row_invalid',
                    message: e.response?.code ?? 'row_invalid',
                });
            }
        }
        if (!prepared.length) {
            throw new common_1.BadRequestException({ code: 'AC_IMPORT_NO_VALID_ROWS', message: 'No valid rows. Existing contacts were not changed.', errors });
        }
        if (opts.replace && errors.length) {
            throw new common_1.BadRequestException({ code: 'AC_IMPORT_REPLACE_ERRORS', message: 'Fix all invalid or duplicate rows before replacing contacts.', errors });
        }
        const result = await this.sequelize.transaction(async (transaction) => {
            const lockedBase = await this.basesService.lockBase(userUid, baseUid, transaction);
            if (lockedBase.revision !== base.revision
                || (opts.expected_revision !== undefined && lockedBase.revision !== opts.expected_revision)
                || (opts.replace && opts.expected_revision === undefined)) {
                throw new common_1.ConflictException({ code: 'AC_REVISION_CONFLICT', message: 'Preview the current base before importing.' });
            }
            let skipped = 0;
            if (opts.replace) {
                await this.basesService.assertBaseReplaceable(userUid, baseUid, transaction);
                await this.contactModel.destroy({
                    where: { base_uid: baseUid, user_uid: userUid },
                    transaction,
                });
            }
            else if (dedup === 'phone') {
                const existing = await this.phoneModel.findAll({
                    where: { base_uid: baseUid },
                    attributes: ['normalized'],
                    transaction,
                });
                const existSet = new Set(existing.map((p) => p.normalized));
                const filtered = prepared.filter((p) => !p.phones.some((ph) => existSet.has(ph.normalized)));
                skipped += prepared.length - filtered.length;
                prepared.length = 0;
                prepared.push(...filtered);
            }
            else if (dedup === 'external_id') {
                const existing = await this.contactModel.findAll({
                    where: { base_uid: baseUid, user_uid: userUid }, attributes: ['external_id'], transaction,
                });
                const ids = new Set(existing.map((contact) => contact.external_id).filter(Boolean));
                const filtered = prepared.filter((contact) => !contact.external_id || !ids.has(contact.external_id));
                skipped += prepared.length - filtered.length;
                prepared.length = 0;
                prepared.push(...filtered);
            }
            for (const item of prepared) {
                const contact = await this.contactModel.create({
                    base_uid: baseUid,
                    user_uid: userUid,
                    external_id: item.external_id,
                    values: item.values,
                    comment: item.comment,
                }, { transaction });
                await this.phoneModel.bulkCreate(item.phones.map((p) => ({
                    contact_uid: contact.uid,
                    base_uid: baseUid,
                    ...p,
                })), { transaction });
            }
            await lockedBase.increment('revision', { transaction });
            const run = await this.runModel.create({
                base_uid: baseUid,
                user_uid: userUid,
                profile_uid: profileUid,
                filename: opts.filename,
                total_rows: dataRows.length,
                imported: prepared.length,
                skipped: skipped + errors.length,
                errors: errors.slice(0, 200),
            }, { transaction });
            return {
                imported: prepared.length,
                skipped: skipped + errors.length,
                errors,
                run: this.toRunDto(run),
            };
        });
        this.logger.log(`Import base=${baseUid} imported=${result.imported} skipped=${result.skipped} errors=${errors.length}`);
        return result;
    }
    // ── private ───────────────────────────────────────────────────────
    async assertBase(userUid, baseUid) {
        const base = await this.baseModel.findOne({ where: { uid: baseUid, user_uid: userUid } });
        if (!base)
            throw new common_1.NotFoundException({ code: 'AC_BASE_NOT_FOUND', message: 'Base not found' });
        return base;
    }
    mapRow(headers, cells, columnMap, fields, phoneNorm) {
        const byHeader = new Map(headers.map((h, i) => [h, cells[i] ?? '']));
        const byIndex = new Map(headers.map((_, i) => [String(i), cells[i] ?? '']));
        const fieldByKey = new Map(fields.map((f) => [f.key, f]));
        const values = {};
        const phones = [];
        let external_id = null;
        let tz = 180;
        let comment = '';
        for (const m of columnMap) {
            if (m.column_index === undefined && headers.filter((header) => header === m.column).length > 1) {
                throw new common_1.BadRequestException({ code: 'AC_AMBIGUOUS_COLUMN', message: 'Select an explicit column index.' });
            }
            if (m.column_index !== undefined && (!Number.isInteger(m.column_index) || m.column_index < 0 || m.column_index >= headers.length)) {
                throw new common_1.BadRequestException({ code: 'AC_INVALID_COLUMN', message: 'Invalid column index.' });
            }
            const raw = m.column_index !== undefined ? cells[m.column_index] ?? '' : byHeader.get(m.column) ?? byIndex.get(m.column) ?? '';
            const transformed = this.applyTransform(raw, m.transform, phoneNorm);
            if (m.field_key === '__phone') {
                const normalized = (0, autodial_phone_util_1.normalizeAutodialPhone)(transformed, phoneNorm);
                if (raw.trim() && !normalized) {
                    throw new common_1.BadRequestException({ code: 'AC_INVALID_PHONE', message: 'Invalid mapped phone.' });
                }
                if (normalized) {
                    phones.push({
                        raw: transformed,
                        normalized,
                        is_primary: phones.length === 0,
                        tz_offset_min: tz,
                        position: phones.length,
                    });
                }
                continue;
            }
            if (m.field_key === '__external_id') {
                external_id = transformed || null;
                continue;
            }
            if (m.field_key === '__tz_offset') {
                if (!transformed.trim())
                    continue;
                const n = Number(transformed);
                if (!Number.isInteger(n) || n < -720 || n > 840) {
                    throw new common_1.BadRequestException({ code: 'AC_INVALID_TIMEZONE_OFFSET', message: 'Invalid phone timezone offset.' });
                }
                tz = n;
                continue;
            }
            if (m.field_key === '__comment') {
                comment = transformed;
                continue;
            }
            const field = fieldByKey.get(m.field_key);
            if (!field)
                throw new common_1.BadRequestException({ code: 'AC_UNKNOWN_FIELD', message: 'Unknown field.' });
            if (field.is_phone || field.type === 'phone') {
                const normalized = (0, autodial_phone_util_1.normalizeAutodialPhone)(transformed, phoneNorm);
                if (raw.trim() && !normalized) {
                    throw new common_1.BadRequestException({ code: 'AC_INVALID_PHONE', message: 'Invalid mapped phone.' });
                }
                if (normalized) {
                    phones.push({
                        raw: transformed,
                        normalized,
                        is_primary: phones.length === 0,
                        tz_offset_min: tz,
                        position: phones.length,
                    });
                }
            }
            values[field.key] = transformed;
        }
        for (const p of phones)
            p.tz_offset_min = tz;
        return { ...(0, autodial_contact_util_1.prepareAutodialContact)(fields, { external_id, values, phones }, phoneNorm), comment };
    }
    applyTransform(value, transform, phoneNorm = 'ru_8_to_7') {
        const v = value?.trim() ?? '';
        switch (transform) {
            case 'trim':
                return v;
            case 'phone_normalize':
                return (0, autodial_phone_util_1.normalizeAutodialPhone)(v, phoneNorm);
            case 'date_iso': {
                const d = new Date(v);
                return Number.isNaN(d.getTime()) ? v : d.toISOString().slice(0, 10);
            }
            case 'money_cents': {
                const n = Number(v.replace(',', '.').replace(/[^\d.-]/g, ''));
                return Number.isNaN(n) ? v : String(Math.round(n * 100));
            }
            default:
                return v;
        }
    }
    decodeText(buffer) {
        try {
            return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
        }
        catch {
            return new TextDecoder('windows-1251').decode(buffer);
        }
    }
    detectDelimiter(text) {
        const first = text.split(/\r?\n/)[0] ?? '';
        const semis = (first.match(/;/g) ?? []).length;
        const commas = (first.match(/,/g) ?? []).length;
        return commas > semis ? ',' : ';';
    }
    parseCsv(text, delimiter) {
        if (![',', ';', '\t', '|'].includes(delimiter)) {
            throw new common_1.BadRequestException({ code: 'AC_INVALID_DELIMITER', message: 'Unsupported delimiter.' });
        }
        const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
        const rows = [];
        let cells = [];
        let cell = '';
        let inQuotes = false;
        for (let i = 0; i < src.length; i++) {
            const ch = src[i];
            if (inQuotes) {
                if (ch === '"') {
                    if (src[i + 1] === '"') {
                        cell += '"';
                        i += 1;
                    }
                    else {
                        inQuotes = false;
                    }
                }
                else {
                    cell += ch;
                }
                continue;
            }
            if (ch === '"') {
                inQuotes = true;
                continue;
            }
            if (ch === delimiter) {
                cells.push(cell);
                cell = '';
                continue;
            }
            if (ch === '\n') {
                cells.push(cell);
                rows.push(cells);
                cells = [];
                cell = '';
                continue;
            }
            if (ch === '\r')
                continue;
            cell += ch;
        }
        if (inQuotes)
            throw new common_1.BadRequestException({ code: 'AC_INVALID_CSV', message: 'Unclosed CSV quote.' });
        if (cell.length || cells.length) {
            cells.push(cell);
            rows.push(cells);
        }
        return rows.filter((r) => r.some((c) => c.trim() !== ''));
    }
    async readAllXlsx(buffer) {
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(buffer);
        const sheet = wb.worksheets[0];
        if (!sheet)
            throw new common_1.BadRequestException({ code: 'AC_XLSX_EMPTY', message: 'Empty workbook.' });
        const rows = [];
        sheet.eachRow({ includeEmpty: false }, (row) => {
            const cells = [];
            row.eachCell({ includeEmpty: true }, (cell, col) => {
                cells[col - 1] = cell.text?.trim() ?? '';
            });
            rows.push(cells.map((c) => c ?? ''));
        });
        return rows;
    }
    toProfileDto(r) {
        return {
            uid: r.uid,
            base_uid: r.base_uid,
            user_uid: r.user_uid,
            name: r.name,
            source: r.source,
            delimiter: r.delimiter,
            encoding: r.encoding,
            has_header: r.has_header,
            column_map: r.column_map,
            dedup_policy: r.dedup_policy,
            created_at: r.created_at?.toISOString?.(),
            updated_at: r.updated_at?.toISOString?.(),
        };
    }
    toRunDto(r) {
        return {
            uid: r.uid,
            base_uid: r.base_uid,
            profile_uid: r.profile_uid,
            filename: r.filename,
            total_rows: r.total_rows,
            imported: r.imported,
            skipped: r.skipped,
            errors: r.errors ?? [],
            created_at: r.created_at?.toISOString?.(),
        };
    }
};
exports.AutodialImportService = AutodialImportService;
exports.AutodialImportService = AutodialImportService = AutodialImportService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, sequelize_1.InjectModel)(ac_base_model_1.AcBase)),
    __param(1, (0, sequelize_1.InjectModel)(ac_base_field_model_1.AcBaseField)),
    __param(2, (0, sequelize_1.InjectModel)(ac_contact_model_1.AcContact)),
    __param(3, (0, sequelize_1.InjectModel)(ac_contact_phone_model_1.AcContactPhone)),
    __param(4, (0, sequelize_1.InjectModel)(ac_import_profile_model_1.AcImportProfile)),
    __param(5, (0, sequelize_1.InjectModel)(ac_import_run_model_1.AcImportRun)),
    __metadata("design:paramtypes", [Object, Object, Object, Object, Object, Object, autodial_bases_service_1.AutodialBasesService,
        sequelize_typescript_1.Sequelize])
], AutodialImportService);
//# sourceMappingURL=autodial-import.service.js.map