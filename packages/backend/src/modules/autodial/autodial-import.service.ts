import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import type { Transaction } from 'sequelize';
import type {
  AutodialDedupPolicy,
  IAutodialColumnMap,
  IAutodialImportProfile,
  IAutodialImportRun,
} from '@krasterisk/shared';
import * as ExcelJS from 'exceljs';
import { AcBase } from './models/ac-base.model';
import { AcBaseField } from './models/ac-base-field.model';
import { AcContact } from './models/ac-contact.model';
import { AcContactPhone } from './models/ac-contact-phone.model';
import { AcImportProfile } from './models/ac-import-profile.model';
import { AcImportRun } from './models/ac-import-run.model';
import { AutodialBasesService } from './autodial-bases.service';
import { normalizeAutodialPhone } from './autodial-phone.util';
import { coerceAutodialValue, prepareAutodialContact } from './autodial-contact.util';

export interface ImportPreviewResult {
  headers: string[];
  sample_rows: string[][];
  delimiter: string;
  total_rows: number;
}

export interface ImportExecuteResult {
  imported: number;
  skipped: number;
  errors: Array<{ row: number; code: string; message: string; field?: string; values?: string[] }>;
  headers?: string[];
  rejected_rows?: Array<{ row: number; code: string; message: string; field?: string; values?: string[] }>;
  warnings: Array<{ row: number; field: string; value: string; code: string }>;
  run: IAutodialImportRun;
}

export interface ImportValidationResult {
  base_revision: number; total_rows: number; valid: number; skipped: number; ready: boolean;
  headers: string[]; errors: ImportExecuteResult['errors']; warnings: ImportExecuteResult['warnings'];
  rejected_rows: NonNullable<ImportExecuteResult['rejected_rows']>;
}
export interface AutodialImportOptions {
  buffer: Buffer; filename: string; source: 'csv' | 'xlsx'; profileUid?: number;
  column_map?: IAutodialColumnMap[]; delimiter?: string; has_header?: boolean;
  dedup_policy?: AutodialDedupPolicy; replace?: boolean; expected_revision?: number;
  invalid_optional_policy?: 'reject' | 'omit'; validation_only?: boolean;
  /** Internal durable-job transaction, never accepted from HTTP input. */
  transaction?: Transaction;
}

@Injectable()
export class AutodialImportService {
  private readonly logger = new Logger(AutodialImportService.name);

  constructor(
    @InjectModel(AcBase) private readonly baseModel: typeof AcBase,
    @InjectModel(AcBaseField) private readonly fieldModel: typeof AcBaseField,
    @InjectModel(AcContact) private readonly contactModel: typeof AcContact,
    @InjectModel(AcContactPhone) private readonly phoneModel: typeof AcContactPhone,
    @InjectModel(AcImportProfile) private readonly profileModel: typeof AcImportProfile,
    @InjectModel(AcImportRun) private readonly runModel: typeof AcImportRun,
    private readonly basesService: AutodialBasesService,
    private readonly sequelize: Sequelize,
  ) {}

  async listRuns(userUid: number, baseUid: number): Promise<IAutodialImportRun[]> {
    await this.assertBase(userUid, baseUid);
    const rows = await this.runModel.findAll({ where: { base_uid: baseUid, user_uid: userUid },
      order: [['uid', 'DESC']], limit: 100 });
    return rows.map((row) => ({ ...this.toRunDto(row),
      errors: (row.errors ?? []).slice(0, 20).map(({ row: line, code }) => ({ row: line, code, message: code })),
    }));
  }

  async listProfiles(userUid: number, baseUid: number): Promise<IAutodialImportProfile[]> {
    await this.assertBase(userUid, baseUid);
    const rows = await this.profileModel.findAll({
      where: { base_uid: baseUid, user_uid: userUid },
      order: [['name', 'ASC']],
    });
    return rows.map((r) => this.toProfileDto(r));
  }

  async upsertProfile(
    userUid: number,
    baseUid: number,
    body: {
      uid?: number;
      name: string;
      source?: 'csv' | 'xlsx';
      delimiter?: string;
      encoding?: string;
      has_header?: boolean;
      column_map: IAutodialColumnMap[];
      dedup_policy?: AutodialDedupPolicy;
    },
  ): Promise<IAutodialImportProfile> {
    await this.assertBase(userUid, baseUid);
    if (!body.column_map?.length) {
      throw new BadRequestException({ code: 'AC_COLUMN_MAP_REQUIRED', message: 'column_map required' });
    }
    if (body.uid) {
      const existing = await this.profileModel.findOne({
        where: { uid: body.uid, base_uid: baseUid, user_uid: userUid },
      });
      if (!existing) throw new NotFoundException({ code: 'AC_PROFILE_NOT_FOUND', message: 'Profile not found' });
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

  async deleteProfile(userUid: number, baseUid: number, profileUid: number): Promise<void> {
    const n = await this.profileModel.destroy({
      where: { uid: profileUid, base_uid: baseUid, user_uid: userUid },
    });
    if (!n) throw new NotFoundException({ code: 'AC_PROFILE_NOT_FOUND', message: 'Profile not found' });
  }

  async previewCsv(buffer: Buffer, options: { delimiter?: string; has_header?: boolean } = {}): Promise<ImportPreviewResult> {
    const text = this.decodeText(buffer);
    const delimiter = options.delimiter || this.detectDelimiter(text);
    const rows = this.parseCsv(text, delimiter);
    if (!rows.length) {
      throw new BadRequestException({ code: 'AC_CSV_EMPTY', message: 'Empty CSV' });
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

  async previewXlsx(buffer: Buffer, options: { has_header?: boolean } = {}): Promise<ImportPreviewResult> {
    const rows = await this.readAllXlsx(buffer);
    if (!rows.length) throw new BadRequestException({ code: 'AC_XLSX_EMPTY', message: 'Empty sheet' });
    return {
      headers: options.has_header === false ? rows[0].map((_, i) => String(i)) : rows[0],
      sample_rows: (options.has_header === false ? rows : rows.slice(1)).slice(0, 5),
      delimiter: '',
      total_rows: Math.max(0, rows.length - (options.has_header === false ? 0 : 1)),
    };
  }

  async importFile(userUid: number, baseUid: number, opts: AutodialImportOptions & { validation_only: true }): Promise<ImportValidationResult>;
  async importFile(userUid: number, baseUid: number, opts: AutodialImportOptions): Promise<ImportExecuteResult>;
  async importFile(
    userUid: number,
    baseUid: number,
    opts: AutodialImportOptions,
  ): Promise<ImportExecuteResult | ImportValidationResult> {
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
      if (!profile) throw new NotFoundException({ code: 'AC_PROFILE_NOT_FOUND', message: 'Profile not found' });
      columnMap = opts.column_map ?? profile.column_map;
      delimiter = opts.delimiter ?? profile.delimiter;
      hasHeader = opts.has_header ?? profile.has_header;
      dedup = opts.dedup_policy ?? profile.dedup_policy;
      profileUid = profile.uid;
    }
    if (!columnMap?.length) {
      throw new BadRequestException({ code: 'AC_COLUMN_MAP_REQUIRED', message: 'column_map or profile required' });
    }

    let table: string[][];
    if (opts.source === 'xlsx') {
      table = await this.readAllXlsx(opts.buffer);
    } else {
      const text = this.decodeText(opts.buffer);
      table = this.parseCsv(text, delimiter);
    }
    if (!table.length) {
      throw new BadRequestException({ code: 'AC_IMPORT_EMPTY', message: 'No rows' });
    }
    const headers = hasHeader ? table[0] : table[0].map((_, i) => String(i));
    const dataRows = hasHeader ? table.slice(1) : table;

    const errors: ImportExecuteResult['errors'] = [];
    const warnings: ImportExecuteResult['warnings'] = [];
    const prepared: Array<{
      external_id: string | null;
      values: Record<string, string | number | boolean>;
      phones: Array<{ raw: string; normalized: string; canonical_phone: string; is_primary: boolean; tz_offset_min: number; position: number }>;
      comment: string;
      source_row: number;
    }> = [];

    const seenPhones = new Set<string>();
    const seenExternal = new Set<string>();

    for (let i = 0; i < dataRows.length; i++) {
      const rowNum = i + (hasHeader ? 2 : 1);
      const cells = dataRows[i];
      try {
        const mapped = this.mapRow(headers, cells, columnMap, fields, base.phone_normalization, opts.invalid_optional_policy);
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
        warnings.push(...mapped.warnings.map((warning) => ({ row: rowNum, ...warning })));
        prepared.push({ ...mapped, source_row: rowNum });
      } catch (e) {
        const response = (e as { response?: { code?: unknown; field?: unknown } })?.response;
        // Keep the stable row_invalid code; expose only structured validation
        // metadata, never arbitrary exception text or stack traces.
        const reason = typeof response?.code === 'string' && /^AC_[A-Z_]+$/.test(response.code)
          ? response.code : 'row_invalid';
        const field = typeof response?.field === 'string'
          && (fields.some((item) => item.key === response.field) || ['__phone', 'phones'].includes(response.field))
          ? response.field : undefined;
        errors.push({
          row: rowNum,
          code: 'row_invalid',
          message: reason,
          ...(field ? { field } : {}),
        });
      }
    }

    for (const error of errors) error.values = dataRows[error.row - (hasHeader ? 2 : 1)];
    if (!prepared.length && !opts.validation_only) {
      throw new BadRequestException({ code: 'AC_IMPORT_NO_VALID_ROWS', message: 'No valid rows. Existing contacts were not changed.', errors });
    }
    if (opts.replace && errors.length && !opts.validation_only) {
      throw new BadRequestException({ code: 'AC_IMPORT_REPLACE_ERRORS', message: 'Fix all invalid or duplicate rows before replacing contacts.', errors });
    }
    const write = async (transaction: Transaction) => {
      const lockedBase = await this.basesService.lockBase(userUid, baseUid, transaction);
      if (lockedBase.revision !== base.revision
        || (opts.expected_revision !== undefined && lockedBase.revision !== opts.expected_revision)
        || (opts.replace && opts.expected_revision === undefined)) {
        throw new ConflictException({ code: 'AC_REVISION_CONFLICT', message: 'Preview the current base before importing.' });
      }
      let skipped = 0;
      const existingRejected: NonNullable<ImportExecuteResult['rejected_rows']> = [];
      if (opts.replace) {
        await this.basesService.assertBaseReplaceable(userUid, baseUid, transaction);
        if (!opts.validation_only) {
          await this.phoneModel.destroy({ where: { base_uid: baseUid }, transaction });
          await this.contactModel.destroy({ where: { base_uid: baseUid, user_uid: userUid }, transaction });
        }
      } else if (dedup === 'phone') {
        const existing = await this.phoneModel.findAll({
          where: { base_uid: baseUid },
          attributes: ['normalized'],
          transaction,
        });
        const existSet = new Set(existing.map((p) => p.normalized));
        const filtered = prepared.filter((p) => !p.phones.some((ph) => existSet.has(ph.normalized)));
        for (const item of prepared.filter((p) => p.phones.some((ph) => existSet.has(ph.normalized)))) existingRejected.push({ row: item.source_row,
          code: 'existing_duplicate_phone', message: 'existing_duplicate_phone', values: dataRows[item.source_row - (hasHeader ? 2 : 1)] });
        skipped += prepared.length - filtered.length;
        prepared.length = 0;
        prepared.push(...filtered);
      } else if (dedup === 'external_id') {
        const existing = await this.contactModel.findAll({
          where: { base_uid: baseUid, user_uid: userUid }, attributes: ['external_id'], transaction,
        });
        const ids = new Set(existing.map((contact) => contact.external_id).filter(Boolean));
        const filtered = prepared.filter((contact) => !contact.external_id || !ids.has(contact.external_id));
        for (const item of prepared.filter((contact) => contact.external_id && ids.has(contact.external_id))) existingRejected.push({ row: item.source_row,
          code: 'existing_duplicate_external_id', message: 'existing_duplicate_external_id', values: dataRows[item.source_row - (hasHeader ? 2 : 1)] });
        skipped += prepared.length - filtered.length;
        prepared.length = 0;
        prepared.push(...filtered);
      }

      if (opts.validation_only) return { base_revision: lockedBase.revision, total_rows: dataRows.length, valid: prepared.length,
        skipped: skipped + errors.length, ready: prepared.length > 0 && (!opts.replace || !errors.length), headers, errors, warnings,
        rejected_rows: [...errors, ...existingRejected].sort((a, b) => a.row - b.row) };
      for (const item of prepared) {
        const contact = await this.contactModel.create(
          {
            base_uid: baseUid,
            user_uid: userUid,
            external_id: item.external_id,
            values: item.values,
            comment: item.comment,
          },
          { transaction },
        );
        await this.phoneModel.bulkCreate(
          item.phones.map((p) => ({
            contact_uid: contact.uid,
            base_uid: baseUid,
            ...p,
          })),
          { transaction },
        );
      }

      await lockedBase.increment('revision', { transaction });

      const run = await this.runModel.create(
        {
          base_uid: baseUid,
          user_uid: userUid,
          profile_uid: profileUid,
          filename: opts.filename,
          total_rows: dataRows.length,
          imported: prepared.length,
          skipped: skipped + errors.length,
          errors: errors.slice(0, 200),
        },
        { transaction },
      );

      return {
        imported: prepared.length,
        skipped: skipped + errors.length,
        errors,
        warnings,
        headers,
        rejected_rows: [...errors, ...existingRejected].sort((a, b) => a.row - b.row),
        run: this.toRunDto(run),
      };
    };
    const result = opts.transaction ? await write(opts.transaction) : await this.sequelize.transaction(write);

    if ('imported' in result) this.logger.log(`Import base=${baseUid} imported=${result.imported} skipped=${result.skipped} errors=${errors.length}`);
    return result;
  }

  async rejectedFile(userUid: number, baseUid: number, opts: AutodialImportOptions): Promise<Buffer> {
    const validation = await this.importFile(userUid, baseUid, { ...opts, validation_only: true });
    const workbook = new ExcelJS.Workbook(); workbook.creator = 'Krasterisk';
    const sheet = workbook.addWorksheet('Rejected');
    sheet.addRow(['source_row', 'reason', ...validation.headers]);
    for (const row of validation.rejected_rows) sheet.addRow([String(row.row), row.code, ...(row.values ?? [])]);
    sheet.eachRow((row) => row.eachCell((cell) => { cell.numFmt = '@'; }));
    sheet.getRow(1).font = { bold: true }; sheet.views = [{ state: 'frozen', ySplit: 1 }];
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  // ── private ───────────────────────────────────────────────────────

  private async assertBase(userUid: number, baseUid: number): Promise<AcBase> {
    const base = await this.baseModel.findOne({ where: { uid: baseUid, user_uid: userUid } });
    if (!base) throw new NotFoundException({ code: 'AC_BASE_NOT_FOUND', message: 'Base not found' });
    return base;
  }

  private mapRow(
    headers: string[],
    cells: string[],
    columnMap: IAutodialColumnMap[],
    fields: AcBaseField[],
    phoneNorm: AcBase['phone_normalization'],
    invalidOptionalPolicy: 'reject' | 'omit' = 'reject',
  ) {
    const byHeader = new Map(headers.map((h, i) => [h, cells[i] ?? '']));
    const byIndex = new Map(headers.map((_, i) => [String(i), cells[i] ?? '']));
    const fieldByKey = new Map(fields.map((f) => [f.key, f]));
    const values: Record<string, string | number | boolean> = {};
    const phones: Array<{
      raw: string;
      normalized: string;
      canonical_phone: string;
      is_primary: boolean;
      tz_offset_min: number;
      position: number;
    }> = [];
    let external_id: string | null = null;
    let tz = 180;
    let comment = '';
    const warnings: Array<{ field: string; value: string; code: string }> = [];

    for (const m of columnMap) {
      if (m.column_index === undefined && headers.filter((header) => header === m.column).length > 1) {
        throw new BadRequestException({ code: 'AC_AMBIGUOUS_COLUMN', message: 'Select an explicit column index.' });
      }
      if (m.column_index !== undefined && (!Number.isInteger(m.column_index) || m.column_index < 0 || m.column_index >= headers.length)) {
        throw new BadRequestException({ code: 'AC_INVALID_COLUMN', message: 'Invalid column index.' });
      }
      const raw = m.column_index !== undefined ? cells[m.column_index] ?? '' : byHeader.get(m.column) ?? byIndex.get(m.column) ?? '';
      const field = fieldByKey.get(m.field_key);
      // Split before phone_normalize; otherwise separators disappear and two
      // destinations become one incorrect dialable number.
      if (m.field_key === '__phone' || field?.is_phone || field?.type === 'phone') {
        for (const part of raw.split(/[,;\n\r|]+/).map((value) => value.trim()).filter(Boolean)) {
          const normalized = normalizeAutodialPhone(part, phoneNorm);
          if (!normalized || !/^[+\d\s().-]+$/.test(part)) {
            throw new BadRequestException({ code: 'AC_INVALID_PHONE', field: m.field_key, message: 'Invalid mapped phone.' });
          }
          if (phones.some((phone) => phone.normalized === normalized)) continue;
          phones.push({ raw: part, normalized, canonical_phone: normalizeAutodialPhone(part), is_primary: phones.length === 0, tz_offset_min: tz, position: phones.length });
        }
        continue;
      }
      const transformed = this.applyTransform(raw, m.transform, phoneNorm);
      if (m.field_key === '__external_id') {
        external_id = transformed || null;
        continue;
      }
      if (m.field_key === '__tz_offset') {
        if (!transformed.trim()) continue;
        const n = Number(transformed);
        if (!Number.isInteger(n) || n < -720 || n > 840) {
          throw new BadRequestException({ code: 'AC_INVALID_TIMEZONE_OFFSET', message: 'Invalid phone timezone offset.' });
        }
        tz = n;
        continue;
      }
      if (m.field_key === '__comment') {
        comment = transformed;
        continue;
      }
      if (!field) throw new BadRequestException({ code: 'AC_UNKNOWN_FIELD', message: 'Unknown field.' });
      if (transformed !== '') {
        try {
          coerceAutodialValue(field, transformed);
        } catch (error) {
          if (field.required || invalidOptionalPolicy !== 'omit') throw error;
          warnings.push({ field: field.key, value: raw,
            code: (error as { response?: { code?: string } }).response?.code ?? 'AC_INVALID_VALUE' });
          continue;
        }
      }
      values[field.key] = transformed;
    }

    for (const p of phones) p.tz_offset_min = tz;
    return { ...prepareAutodialContact(fields, { external_id, values, phones }, phoneNorm), comment, warnings };
  }

  private applyTransform(
    value: string,
    transform?: IAutodialColumnMap['transform'],
    phoneNorm: AcBase['phone_normalization'] = 'ru_8_to_7',
  ): string {
    const v = value?.trim() ?? '';
    switch (transform) {
      case 'trim':
        return v;
      case 'phone_normalize':
        return normalizeAutodialPhone(v, phoneNorm);
      case 'date_iso': {
        const local = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(v);
        if (local) return `${local[3]}-${local[2]}-${local[1]}`;
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

  private decodeText(buffer: Buffer): string {
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    } catch {
      return new TextDecoder('windows-1251').decode(buffer);
    }
  }

  private detectDelimiter(text: string): string {
    const first = text.split(/\r?\n/)[0] ?? '';
    const semis = (first.match(/;/g) ?? []).length;
    const commas = (first.match(/,/g) ?? []).length;
    return commas > semis ? ',' : ';';
  }

  private parseCsv(text: string, delimiter: string): string[][] {
    if (![',', ';', '\t', '|'].includes(delimiter)) {
      throw new BadRequestException({ code: 'AC_INVALID_DELIMITER', message: 'Unsupported delimiter.' });
    }
    const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
    const rows: string[][] = [];
    let cells: string[] = [];
    let cell = '';
    let inQuotes = false;
    for (let i = 0; i < src.length; i++) {
      const ch = src[i];
      if (inQuotes) {
        if (ch === '"') {
          if (src[i + 1] === '"') {
            cell += '"';
            i += 1;
          } else {
            inQuotes = false;
          }
        } else {
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
      if (ch === '\r') continue;
      cell += ch;
    }
    if (inQuotes) throw new BadRequestException({ code: 'AC_INVALID_CSV', message: 'Unclosed CSV quote.' });
    if (cell.length || cells.length) {
      cells.push(cell);
      rows.push(cells);
    }
    return rows.filter((r) => r.some((c) => c.trim() !== ''));
  }

  private async readAllXlsx(buffer: Buffer): Promise<string[][]> {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    const sheet = wb.worksheets[0];
    if (!sheet) throw new BadRequestException({ code: 'AC_XLSX_EMPTY', message: 'Empty workbook.' });
    const rows: string[][] = [];
    sheet.eachRow({ includeEmpty: false }, (row) => {
      const cells: string[] = [];
      row.eachCell({ includeEmpty: true }, (cell, col) => {
        // Cached formula results are data; never evaluate spreadsheet formulas.
        const value = cell.value && typeof cell.value === 'object' && 'result' in cell.value ? cell.value.result : cell.value;
        cells[col - 1] = value instanceof Date ? value.toISOString().slice(0, 10)
          : typeof value === 'number' && /^0+$/.test(cell.numFmt) ? String(value).padStart(cell.numFmt.length, '0')
          : cell.text?.trim() ?? '';
      });
      rows.push(cells.map((c) => c ?? ''));
    });
    return rows;
  }

  private toProfileDto(r: AcImportProfile): IAutodialImportProfile {
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

  private toRunDto(r: AcImportRun): IAutodialImportRun {
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
}
