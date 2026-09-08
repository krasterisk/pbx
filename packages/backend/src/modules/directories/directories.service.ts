import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import { UniqueConstraintError, type Transaction } from 'sequelize';
import type {
  DirectoryFieldType,
  DirectoryKeyNormalization,
  DirectoryLookupStatus,
  DirectoryMatchKind,
  IDirectory,
  IDirectoryCsvError,
  IDirectoryCsvImportResult,
  IDirectoryField,
  IDirectoryRecord,
} from '@krasterisk/shared';
import {
  DIRECTORY_CSV_DELIMITER,
  DIRECTORY_CSV_IGNORED_COLUMNS,
  DIRECTORY_CSV_MAX_BYTES,
  DIRECTORY_CSV_RESERVED_COLUMNS,
} from '@krasterisk/shared';
import { Directory } from './directory.model';
import { DirectoryField } from './directory-field.model';
import { DirectoryRecord } from './directory-record.model';
import { RouteDirectoryBinding } from './route-directory-binding.model';
import { Route } from '../routes/route.model';
import {
  CreateDirectoryDto,
  DirectoryFieldDto,
  DirectoryRecordDto,
  UpdateDirectoryDto,
} from './dto/directory.dto';
import { normalizeDirectoryKey } from './directory-normalization.util';
import {
  compareAsteriskExten,
  isAsteriskPattern,
  pickBestAsteriskMatch,
} from './directory-pattern.util';
import {
  collectDirectoryReferences,
  type DirectoryReference,
} from './directory-reference.util';

const RESERVED_CSV_HEADERS = DIRECTORY_CSV_RESERVED_COLUMNS;

export interface DirectoryLookupRequest {
  directoryUid: number;
  userUid: number;
  key: string;
  fieldUids: number[];
}

export interface DirectoryLookupResult {
  status: DirectoryLookupStatus;
  matchKind?: DirectoryMatchKind;
  values: string[];
}

export type DirectoryCsvImportResult = IDirectoryCsvImportResult;

@Injectable()
export class DirectoriesService {
  constructor(
    @InjectModel(Directory) private readonly directoryModel: typeof Directory,
    @InjectModel(DirectoryField) private readonly fieldModel: typeof DirectoryField,
    @InjectModel(DirectoryRecord) private readonly recordModel: typeof DirectoryRecord,
    @InjectModel(RouteDirectoryBinding) private readonly bindingModel: typeof RouteDirectoryBinding,
    @InjectModel(Route) private readonly routeModel: typeof Route,
    private readonly sequelize: Sequelize,
  ) {}

  async findAll(userUid: number): Promise<IDirectory[]> {
    const rows = await this.directoryModel.findAll({
      where: { user_uid: userUid },
      include: [
        { model: DirectoryField, as: 'fields' },
        { model: DirectoryRecord, as: 'records' },
      ],
      order: [['uid', 'DESC']],
    });
    return rows.map((row) => this.toManagement(row));
  }

  async findOne(uid: number, userUid: number): Promise<IDirectory> {
    return this.toManagement(await this.loadOwned(uid, userUid));
  }

  async create(dto: CreateDirectoryDto, userUid: number): Promise<IDirectory> {
    const data = { ...dto } as CreateDirectoryDto & { user_uid?: number };
    delete data.user_uid;
    this.assertFieldKeys(data.fields);

    const clash = await this.directoryModel.findOne({
      where: { user_uid: userUid, name: data.name },
    });
    if (clash) throw new ConflictException('Directory name already exists');

    try {
      const uid = await this.sequelize.transaction(async (transaction) => {
        const directory = await this.directoryModel.create(
          {
            name: data.name,
            description: data.description ?? '',
            key_normalization: data.key_normalization,
            lookup_field_uid: null,
            revision: 0,
            user_uid: userUid,
          },
          { transaction },
        );

        const fields = await this.syncFields(directory.uid, data.fields, [], userUid, transaction);
        const lookup = fields.find((field) => field.key === data.lookupFieldKey);
        if (!lookup) {
          throw new BadRequestException('lookupFieldKey does not match a field');
        }
        await directory.update({ lookup_field_uid: lookup.uid }, { transaction });

        if (data.records?.length) {
          await this.writeRecords(
            directory.uid,
            data.records,
            fields,
            lookup,
            data.key_normalization,
            [],
            transaction,
          );
        }
        return directory.uid;
      });
      return this.findOne(uid, userUid);
    } catch (err) {
      this.rethrowWriteError(err);
    }
  }

  async update(uid: number, dto: UpdateDirectoryDto, userUid: number): Promise<IDirectory> {
    const data = { ...dto } as UpdateDirectoryDto & { user_uid?: number };
    delete data.user_uid;
    if (data.fields) this.assertFieldKeys(data.fields);

    const directory = await this.loadOwned(uid, userUid);

    if (data.name && data.name !== directory.name) {
      const clash = await this.directoryModel.findOne({
        where: { user_uid: userUid, name: data.name },
      });
      if (clash && clash.uid !== uid) {
        throw new ConflictException('Directory name already exists');
      }
    }

    try {
      await this.sequelize.transaction(async (transaction) => {
        const existingFields = await this.fieldModel.findAll({
          where: { directory_uid: uid },
          transaction,
        });

        const fields = data.fields
          ? await this.syncFields(uid, data.fields, existingFields, userUid, transaction)
          : existingFields;

        const lookupKey = data.lookupFieldKey
          ?? fields.find((field) => field.uid === directory.lookup_field_uid)?.key;
        if (!lookupKey) {
          throw new BadRequestException('Directory must have a lookup field');
        }
        const lookup = fields.find((field) => field.key === lookupKey);
        if (!lookup) {
          throw new BadRequestException('lookupFieldKey does not match a field');
        }

        const prevMode = directory.key_normalization;
        const nextMode = data.key_normalization ?? prevMode;
        const normalizationChanged =
          data.key_normalization !== undefined && data.key_normalization !== prevMode;

        await directory.update(
          {
            ...(data.name !== undefined ? { name: data.name } : {}),
            ...(data.description !== undefined ? { description: data.description } : {}),
            ...(data.key_normalization !== undefined
              ? { key_normalization: data.key_normalization }
              : {}),
            lookup_field_uid: lookup.uid,
            revision: (directory.revision ?? 0) + 1,
          },
          { transaction },
        );

        if (data.records) {
          await this.recordModel.destroy({ where: { directory_uid: uid }, transaction });
          await this.writeRecords(
            uid,
            data.records,
            fields,
            lookup,
            nextMode,
            [],
            transaction,
          );
        } else if (normalizationChanged) {
          await this.reindexExactKeys(uid, nextMode, transaction);
        }
      });
    } catch (err) {
      this.rethrowWriteError(err);
    }

    return this.findOne(uid, userUid);
  }

  async remove(uid: number, userUid: number): Promise<void> {
    const directory = await this.loadOwned(uid, userUid);
    const references = await this.findReferences(uid, undefined, userUid);
    if (references.length) {
      throw new ConflictException({
        message: 'Directory is referenced and cannot be deleted',
        references,
      });
    }
    await directory.destroy();
  }

  /**
   * Replaces every record of the directory with the CSV contents.
   * The whole file is parsed and validated first, so a rejected file leaves
   * the stored records and the revision untouched.
   */
  async importCsv(uid: number, csv: string, userUid: number): Promise<DirectoryCsvImportResult> {
    const directory = await this.loadOwned(uid, userUid);
    const fields = await this.fieldModel.findAll({ where: { directory_uid: uid } });
    const lookup = fields.find((field) => field.uid === directory.lookup_field_uid);
    if (!lookup) {
      throw new BadRequestException('Directory must have a lookup field');
    }

    const text = typeof csv === 'string' ? csv : '';
    if (Buffer.byteLength(text, 'utf8') > DIRECTORY_CSV_MAX_BYTES) {
      throw csvBadRequest([
        {
          row: 0,
          code: 'file_too_large',
          message: `CSV must not exceed ${DIRECTORY_CSV_MAX_BYTES} bytes`,
        },
      ]);
    }

    const rows = parseCsvRows(text);
    if (!rows.length) {
      throw csvBadRequest([{ row: 0, code: 'empty_file', message: 'CSV is empty' }]);
    }

    const headers = rows[0].cells.map((header) => header.trim());
    const headerErrors = collectCsvHeaderErrors(headers, fields, lookup.key);
    if (headerErrors.length) throw csvBadRequest(headerErrors);

    const index = new Map(headers.map((header, i) => [header, i]));
    const fieldByKey = new Map(fields.map((field) => [field.key, field]));
    const errors: IDirectoryCsvError[] = [];
    const records: DirectoryRecordDto[] = [];
    const seenKeys = new Set<string>();

    for (let i = 1; i < rows.length; i++) {
      const { cells, line } = rows[i];
      if (cells.every((cell) => cell.trim() === '')) continue;

      const record = this.readCsvRecord(cells, line, index, fields, errors);
      if (!record) continue;

      try {
        const prepared = this.prepareRecord(record, fieldByKey, lookup, directory.key_normalization);
        const dupeKey = `${prepared.match_kind}\0${prepared.normalized_lookup_value}`;
        if (seenKeys.has(dupeKey)) {
          errors.push({
            row: line,
            column: lookup.key,
            code: 'duplicate_key',
            message: `Duplicate lookup value "${prepared.lookup_value}"`,
          });
          continue;
        }
        seenKeys.add(dupeKey);
      } catch (err) {
        errors.push({
          row: line,
          code: 'invalid_pattern',
          message: err instanceof Error ? err.message : 'Invalid record',
        });
        continue;
      }

      records.push(record);
    }

    if (errors.length) throw csvBadRequest(errors);

    const replaced = await this.sequelize.transaction(async (transaction) => {
      const removed = await this.recordModel.destroy({
        where: { directory_uid: uid },
        transaction,
      });
      await this.writeRecords(
        uid,
        records,
        fields,
        lookup,
        directory.key_normalization,
        [],
        transaction,
      );
      await directory.update({ revision: (directory.revision ?? 0) + 1 }, { transaction });
      return removed;
    });

    return { imported: records.length, replaced, errors: [] };
  }

  async exportCsv(uid: number, userUid: number): Promise<string> {
    const directory = await this.findOne(uid, userUid);
    const fields = [...(directory.fields ?? [])].sort((a, b) => a.position - b.position);
    const header = [...fields.map((field) => field.key), ...RESERVED_CSV_HEADERS];
    const rows: string[][] = [header];
    const records = [...(directory.records ?? [])].sort((a, b) =>
      compareAsteriskExten(a.lookup_value, b.lookup_value)
      || a.lookup_value.localeCompare(b.lookup_value),
    );
    for (const record of records) {
      rows.push([
        ...fields.map((field) => csvCell(record.values?.[field.key])),
        record.comment ?? '',
      ]);
    }
    return writeCsvRows(rows);
  }

  private readCsvRecord(
    cells: string[],
    line: number,
    index: Map<string, number>,
    fields: DirectoryField[],
    errors: IDirectoryCsvError[],
  ): DirectoryRecordDto | null {
    const before = errors.length;

    const values: Record<string, string | number | boolean> = {};
    for (const field of fields) {
      const col = index.get(field.key);
      if (col == null) continue;
      const raw = cells[col] ?? '';
      if (raw.trim() === '') {
        if (field.required) {
          errors.push({
            row: line,
            column: field.key,
            code: 'required_empty',
            message: `Column "${field.key}" must not be empty`,
          });
        }
        continue;
      }
      const coerced = coerceCsvValue(field, raw);
      if (coerced.error) {
        errors.push({ row: line, column: field.key, ...coerced.error });
        continue;
      }
      values[field.key] = coerced.value!;
    }

    if (errors.length !== before) return null;

    const commentCol = index.get('comment');
    return {
      values,
      comment: commentCol == null ? '' : (cells[commentCol] ?? ''),
    };
  }

  async lookup(request: DirectoryLookupRequest): Promise<DirectoryLookupResult> {
    const directory = await this.directoryModel.findOne({
      where: { uid: request.directoryUid, user_uid: request.userUid },
      include: [{ model: DirectoryField, as: 'fields' }],
    });
    if (!directory) return { status: 'NOT_FOUND', values: [] };

    const ownedUids = new Set((directory.fields ?? []).map((field) => field.uid));
    for (const fieldUid of request.fieldUids) {
      if (!ownedUids.has(fieldUid)) {
        throw new BadRequestException('Field does not belong to this directory');
      }
    }

    const normalized = normalizeDirectoryKey(request.key, directory.key_normalization);
    let record = await this.recordModel.findOne({
      where: {
        directory_uid: directory.uid,
        match_kind: 'exact',
        normalized_lookup_value: normalized,
      },
    });
    let matchKind: DirectoryMatchKind = 'exact';

    if (!record) {
      const lookupField = (directory.fields ?? []).find(
        (field) => field.uid === directory.lookup_field_uid,
      );
      if (lookupField?.type === 'phone') {
        const patterns = await this.recordModel.findAll({
          where: { directory_uid: directory.uid, match_kind: 'asterisk_pattern' },
        });
        record = pickBestAsteriskMatch(patterns, (item) => item.lookup_value, normalized) ?? null;
        matchKind = 'asterisk_pattern';
      }
    }

    if (!record) return { status: 'NOT_FOUND', values: [] };

    return {
      status: 'FOUND',
      matchKind,
      values: request.fieldUids.map((fieldUid) => {
        const raw = record!.values?.[String(fieldUid)];
        return raw == null ? '' : String(raw);
      }),
    };
  }

  async findReferences(
    directoryUid: number,
    fieldUid: number | undefined,
    userUid: number,
  ): Promise<DirectoryReference[]> {
    const [bindings, routes] = await Promise.all([
      this.bindingModel.findAll({ where: { user_uid: userUid } }),
      this.routeModel.findAll({ where: { user_uid: userUid } }),
    ]);
    return collectDirectoryReferences(directoryUid, fieldUid, bindings, routes);
  }

  private async loadOwned(uid: number, userUid: number): Promise<Directory> {
    const directory = await this.directoryModel.findOne({
      where: { uid, user_uid: userUid },
      include: [
        { model: DirectoryField, as: 'fields' },
        { model: DirectoryRecord, as: 'records' },
      ],
    });
    if (!directory) throw new NotFoundException('Directory not found');
    return directory;
  }

  private toManagement(directory: Directory): IDirectory {
    const plain = toPlain(directory);
    const fields = [...(directory.fields ?? [])]
      .map((field) => toPlain(field) as unknown as IDirectoryField)
      .sort((a, b) => a.position - b.position);
    const keyByUid = new Map(fields.map((field) => [field.uid, field.key]));
    const lookupKey = directory.lookup_field_uid != null
      ? keyByUid.get(directory.lookup_field_uid)
      : undefined;

    const records = (directory.records ?? []).map((record) => {
      const recPlain = toPlain(record) as unknown as IDirectoryRecord;
      const values: Record<string, unknown> = {};
      for (const [uidKey, value] of Object.entries(record.values ?? {})) {
        const key = keyByUid.get(Number(uidKey));
        if (key) values[key] = value;
      }
      if (lookupKey && values[lookupKey] == null) {
        values[lookupKey] = record.lookup_value;
      }
      return { ...recPlain, values };
    });

    return {
      ...(plain as unknown as IDirectory),
      fields,
      records,
    };
  }

  private assertFieldKeys(fields: DirectoryFieldDto[]): void {
    if (!fields.length) {
      throw new BadRequestException('Directory must have at least one field');
    }
    const keys = fields.map((field) => field.key);
    if (new Set(keys).size !== keys.length) {
      throw new BadRequestException('Field keys must be unique');
    }
  }

  private async syncFields(
    directoryUid: number,
    incoming: DirectoryFieldDto[],
    existing: DirectoryField[],
    userUid: number,
    transaction: Transaction,
  ): Promise<DirectoryField[]> {
    const incomingKeys = new Set(incoming.map((field) => field.key));
    const byKey = new Map(existing.map((field) => [field.key, field]));

    for (const prev of existing) {
      if (incomingKeys.has(prev.key)) continue;
      const references = await this.findReferences(directoryUid, prev.uid, userUid);
      if (references.length) {
        throw new ConflictException({
          message: 'Field is referenced and cannot be deleted',
          references,
        });
      }
      await prev.destroy({ transaction });
    }

    const result: DirectoryField[] = [];
    for (const field of incoming) {
      const prev = byKey.get(field.key);
      if (prev) {
        await prev.update(
          {
            label: field.label,
            type: field.type,
            required: field.required,
            position: field.position,
          },
          { transaction },
        );
        result.push(prev);
      } else {
        result.push(await this.fieldModel.create(
          {
            directory_uid: directoryUid,
            key: field.key,
            label: field.label,
            type: field.type,
            required: field.required,
            position: field.position,
          },
          { transaction },
        ));
      }
    }
    return result;
  }

  private async reindexExactKeys(
    directoryUid: number,
    nextMode: DirectoryKeyNormalization,
    transaction: Transaction,
  ): Promise<void> {
    const rows = await this.recordModel.findAll({
      where: { directory_uid: directoryUid },
      transaction,
    });

    const seen = new Set<string>();
    for (const row of rows) {
      if (row.match_kind === 'asterisk_pattern') continue;
      const nextNormalized = normalizeDirectoryKey(row.lookup_value, nextMode);
      if (seen.has(nextNormalized)) {
        throw new ConflictException('Duplicate directory record key');
      }
      seen.add(nextNormalized);
      await row.update({ normalized_lookup_value: nextNormalized }, { transaction });
    }
  }

  private async writeRecords(
    directoryUid: number,
    records: DirectoryRecordDto[],
    fields: DirectoryField[],
    lookup: DirectoryField,
    keyNormalization: DirectoryKeyNormalization,
    existing: Array<Pick<DirectoryRecord, 'normalized_lookup_value' | 'match_kind'>>,
    transaction: Transaction,
  ): Promise<void> {
    const fieldByKey = new Map(fields.map((field) => [field.key, field]));
    const seen = new Set(
      existing.map((row) => `${row.match_kind}\0${row.normalized_lookup_value}`),
    );

    for (const record of records) {
      const prepared = this.prepareRecord(record, fieldByKey, lookup, keyNormalization);
      const dupeKey = `${prepared.match_kind}\0${prepared.normalized_lookup_value}`;
      if (seen.has(dupeKey)) {
        throw new ConflictException('Duplicate directory record key');
      }
      seen.add(dupeKey);

      await this.recordModel.create(
        {
          directory_uid: directoryUid,
          lookup_value: prepared.lookup_value,
          normalized_lookup_value: prepared.normalized_lookup_value,
          match_kind: prepared.match_kind,
          priority: prepared.priority,
          values: prepared.values,
          comment: prepared.comment,
        },
        { transaction },
      );
    }
  }

  private prepareRecord(
    record: DirectoryRecordDto,
    fieldByKey: Map<string, DirectoryField>,
    lookup: DirectoryField,
    keyNormalization: DirectoryKeyNormalization,
  ): {
    lookup_value: string;
    normalized_lookup_value: string;
    match_kind: DirectoryMatchKind;
    priority: number;
    values: Record<string, string | number | boolean>;
    comment: string;
  } {
    const rawLookup = record.values?.[lookup.key];
    if (rawLookup == null || rawLookup === '') {
      throw new BadRequestException('Record is missing the lookup field value');
    }

    const lookupValue = String(rawLookup).trim();
    const matchKind: DirectoryMatchKind = isAsteriskPattern(lookupValue)
      ? 'asterisk_pattern'
      : 'exact';
    let normalized = lookupValue;
    if (matchKind === 'asterisk_pattern') {
      if (lookup.type !== 'phone') {
        throw new BadRequestException('Pattern matching is only allowed for a phone lookup field');
      }
      assertAsteriskPattern(lookupValue);
    } else {
      normalized = normalizeDirectoryKey(lookupValue, keyNormalization);
    }

    const values: Record<string, string | number | boolean> = {};
    for (const [key, raw] of Object.entries(record.values ?? {})) {
      const field = fieldByKey.get(key);
      if (!field) {
        throw new BadRequestException(`Unknown record field "${key}"`);
      }
      values[String(field.uid)] = this.validateRecordValue(field, raw);
    }

    for (const field of fieldByKey.values()) {
      if (field.required && values[String(field.uid)] === undefined) {
        throw new BadRequestException(`Missing required field "${field.key}"`);
      }
    }

    values[String(lookup.uid)] = matchKind === 'asterisk_pattern'
      ? lookupValue
      : this.validateRecordValue(lookup, rawLookup);

    return {
      lookup_value: lookupValue,
      normalized_lookup_value: normalized,
      match_kind: matchKind,
      priority: 1,
      values,
      comment: record.comment ?? '',
    };
  }

  private validateRecordValue(
    field: DirectoryField,
    value: unknown,
  ): string | number | boolean {
    switch (field.type as DirectoryFieldType) {
      case 'boolean':
        if (typeof value !== 'boolean') {
          throw new BadRequestException(`Field "${field.key}" must be a boolean`);
        }
        return value;
      case 'number':
        if (typeof value !== 'number' || Number.isNaN(value)) {
          throw new BadRequestException(`Field "${field.key}" must be a number`);
        }
        return value;
      case 'phone':
      case 'string':
        if (typeof value !== 'string') {
          throw new BadRequestException(`Field "${field.key}" must be a string`);
        }
        return value;
      default:
        throw new BadRequestException(`Unsupported field type "${field.type}"`);
    }
  }

  private rethrowWriteError(err: unknown): never {
    if (err instanceof UniqueConstraintError) {
      throw new ConflictException('Duplicate directory value');
    }
    throw err;
  }
}

function toPlain<T extends { toJSON?: () => unknown }>(row: T): Record<string, unknown> {
  if (typeof row.toJSON === 'function') {
    return { ...(row.toJSON() as object) };
  }
  return { ...(row as object) };
}

function assertAsteriskPattern(pattern: string): void {
  if (!pattern.startsWith('_') || pattern.length < 2) {
    throw new BadRequestException('Asterisk pattern must start with _');
  }
  let depth = 0;
  for (const ch of pattern) {
    if (ch === '[') depth += 1;
    if (ch === ']') depth -= 1;
    if (depth < 0) {
      throw new BadRequestException('Invalid asterisk pattern');
    }
  }
  if (depth !== 0) {
    throw new BadRequestException('Invalid asterisk pattern');
  }
}

function csvBadRequest(errors: IDirectoryCsvError[]): BadRequestException {
  return new BadRequestException({
    message: errors[0]?.message ?? 'Invalid CSV',
    code: 'csv_invalid',
    errors,
  });
}

function collectCsvHeaderErrors(
  headers: string[],
  fields: DirectoryField[],
  lookupKey: string,
): IDirectoryCsvError[] {
  const errors: IDirectoryCsvError[] = [];
  const allowed = new Set<string>([
    ...fields.map((field) => field.key),
    ...RESERVED_CSV_HEADERS,
    ...DIRECTORY_CSV_IGNORED_COLUMNS,
  ]);
  const seen = new Set<string>();

  for (const header of headers) {
    if (!header) continue;
    if (seen.has(header)) {
      errors.push({
        row: 1,
        column: header,
        code: 'duplicate_column',
        message: `Duplicate CSV column "${header}"`,
      });
      continue;
    }
    seen.add(header);
    if (!allowed.has(header)) {
      errors.push({
        row: 1,
        column: header,
        code: 'unknown_column',
        message: `Unknown CSV column "${header}"`,
      });
    }
  }

  const required = new Set<string>([
    lookupKey,
    ...fields.filter((field) => field.required).map((field) => field.key),
  ]);
  for (const column of required) {
    if (seen.has(column)) continue;
    errors.push({
      row: 1,
      column,
      code: 'missing_column',
      message: `CSV must include the "${column}" column`,
    });
  }

  return errors;
}

/** CSV cells stay raw text so leading zeros, a leading plus and dates survive. */
function coerceCsvValue(
  field: DirectoryField,
  raw: string,
): { value?: string | number | boolean; error?: Pick<IDirectoryCsvError, 'code' | 'message'> } {
  if (field.type === 'boolean') {
    const normalized = raw.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1') return { value: true };
    if (normalized === 'false' || normalized === '0') return { value: false };
    return {
      error: {
        code: 'invalid_boolean',
        message: `Column "${field.key}" must be true, false, 1 or 0`,
      },
    };
  }
  if (field.type === 'number') {
    const parsed = Number(raw.trim());
    if (!Number.isFinite(parsed)) {
      return {
        error: { code: 'invalid_number', message: `Column "${field.key}" must be a number` },
      };
    }
    return { value: parsed };
  }
  return { value: raw };
}

function csvCell(value: unknown): string {
  if (value == null) return '';
  return String(value);
}

interface CsvRow {
  cells: string[];
  /** Physical 1-based line where the row starts. */
  line: number;
}

function detectCsvDelimiter(text: string): string {
  let inQuotes = false;
  let semicolons = 0;
  let commas = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        i += 1;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }
    if (inQuotes) continue;
    if (ch === '\n' || ch === '\r') break;
    if (ch === ';') semicolons += 1;
    if (ch === ',') commas += 1;
  }
  return commas > semicolons ? ',' : DIRECTORY_CSV_DELIMITER;
}

/**
 * RFC 4180 reader that keeps every cell as text and reports the physical line
 * of each row so quoted newlines do not shift error positions.
 */
function parseCsvRows(csv: string): CsvRow[] {
  const text = csv.charCodeAt(0) === 0xfeff ? csv.slice(1) : csv;
  const delimiter = detectCsvDelimiter(text);
  const rows: CsvRow[] = [];
  let cells: string[] = [];
  let cell = '';
  let line = 1;
  let rowLine = 1;
  let inQuotes = false;

  const endRow = (): void => {
    cells.push(cell);
    rows.push({ cells, line: rowLine });
    cells = [];
    cell = '';
    line += 1;
    rowLine = line;
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
          continue;
        }
        inQuotes = false;
        continue;
      }
      if (ch === '\n') line += 1;
      cell += ch;
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
    if (ch === '\r') {
      if (text[i + 1] === '\n') i += 1;
      endRow();
      continue;
    }
    if (ch === '\n') {
      endRow();
      continue;
    }
    cell += ch;
  }

  if (cell !== '' || cells.length > 0) {
    cells.push(cell);
    rows.push({ cells, line: rowLine });
  }

  return rows;
}

function escapeCsvCell(value: string): string {
  return /["\r\n]/.test(value) || value.includes(DIRECTORY_CSV_DELIMITER)
    ? `"${value.replace(/"/g, '""')}"`
    : value;
}

/** UTF-8 BOM plus a fixed delimiter keeps Excel RU from mangling the export. */
function writeCsvRows(rows: string[][]): string {
  const body = rows
    .map((row) => row.map(escapeCsvCell).join(DIRECTORY_CSV_DELIMITER))
    .join('\r\n');
  return `\ufeff${body}\r\n`;
}
