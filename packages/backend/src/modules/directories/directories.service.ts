import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import { UniqueConstraintError, type Transaction } from 'sequelize';
import ExcelJS from 'exceljs';
import { Readable } from 'stream';
import type {
  DirectoryFieldType,
  DirectoryKeyNormalization,
  DirectoryLookupStatus,
  DirectoryMatchKind,
  IDirectory,
  IDirectoryField,
  IDirectoryRecord,
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
import { matchesAsteriskPattern } from './directory-pattern.util';
import {
  collectDirectoryReferences,
  type DirectoryReference,
} from './directory-reference.util';

const RESERVED_CSV_HEADERS = ['comment', 'match_kind', 'priority'] as const;

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

export interface DirectoryCsvImportResult {
  imported: number;
}

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

  async importCsv(uid: number, csv: string, userUid: number): Promise<DirectoryCsvImportResult> {
    const directory = await this.loadOwned(uid, userUid);
    const fields = await this.fieldModel.findAll({ where: { directory_uid: uid } });
    const lookup = fields.find((field) => field.uid === directory.lookup_field_uid);
    if (!lookup) {
      throw new BadRequestException('Directory must have a lookup field');
    }

    const rows = await readCsvRows(csv);
    if (rows.length === 0) return { imported: 0 };

    const headers = rows[0].map((header) => header.trim());
    this.assertCsvHeaders(headers, fields, lookup.key);

    const index = new Map(headers.map((header, i) => [header, i]));
    const existing = await this.recordModel.findAll({ where: { directory_uid: uid } });
    const records: DirectoryRecordDto[] = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.every((cell) => String(cell ?? '').trim() === '')) continue;

      const matchKind = String(row[index.get('match_kind')!] ?? '').trim() as DirectoryMatchKind;
      if (matchKind !== 'exact' && matchKind !== 'asterisk_pattern') {
        throw new BadRequestException(`Invalid match_kind on CSV row ${i + 1}`);
      }
      const priority = Number(row[index.get('priority')!]);
      if (!Number.isInteger(priority) || priority < 1) {
        throw new BadRequestException(`Invalid priority on CSV row ${i + 1}`);
      }

      const values: Record<string, string | number | boolean> = {};
      for (const field of fields) {
        const col = index.get(field.key);
        if (col == null) {
          if (field.required) {
            throw new BadRequestException(`CSV is missing required field "${field.key}"`);
          }
          continue;
        }
        const raw = row[col] ?? '';
        if (String(raw).trim() === '' && !field.required) continue;
        values[field.key] = coerceCsvValue(field, raw, i + 1);
      }

      const commentCol = index.get('comment');
      records.push({
        match_kind: matchKind,
        priority,
        values,
        comment: commentCol == null ? '' : String(row[commentCol] ?? ''),
      });
    }

    await this.sequelize.transaction(async (transaction) => {
      await this.writeRecords(
        uid,
        records,
        fields,
        lookup,
        directory.key_normalization,
        existing,
        transaction,
      );
      await directory.update({ revision: (directory.revision ?? 0) + 1 }, { transaction });
    });

    return { imported: records.length };
  }

  async exportCsv(uid: number, userUid: number): Promise<string> {
    const directory = await this.findOne(uid, userUid);
    const fields = [...(directory.fields ?? [])].sort((a, b) => a.position - b.position);
    const header = [...fields.map((field) => field.key), ...RESERVED_CSV_HEADERS];
    const rows: Array<Array<string | number | boolean>> = [header];
    for (const record of directory.records ?? []) {
      rows.push([
        ...fields.map((field) => (record.values?.[field.key] as string | number | boolean | undefined) ?? ''),
        record.comment ?? '',
        record.match_kind,
        record.priority,
      ]);
    }
    return writeCsvRows(rows);
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
          order: [['priority', 'ASC'], ['uid', 'ASC']],
        });
        record = patterns.find((item) =>
          matchesAsteriskPattern(item.lookup_value, normalized),
        ) ?? null;
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
    if (record.priority < 1 || !Number.isInteger(record.priority)) {
      throw new BadRequestException('Record priority must be a positive integer');
    }

    const rawLookup = record.values?.[lookup.key];
    if (rawLookup == null || rawLookup === '') {
      throw new BadRequestException('Record is missing the lookup field value');
    }

    let lookupValue = String(rawLookup).trim();
    let normalized = lookupValue;
    if (record.match_kind === 'asterisk_pattern') {
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

    values[String(lookup.uid)] = record.match_kind === 'asterisk_pattern'
      ? lookupValue
      : this.validateRecordValue(lookup, rawLookup);

    return {
      lookup_value: lookupValue,
      normalized_lookup_value: normalized,
      match_kind: record.match_kind,
      priority: record.priority,
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

  private assertCsvHeaders(
    headers: string[],
    fields: DirectoryField[],
    lookupKey: string,
  ): void {
    const allowed = new Set<string>([...fields.map((field) => field.key), ...RESERVED_CSV_HEADERS]);
    const seen = new Set<string>();
    for (const header of headers) {
      if (!header) continue;
      if (seen.has(header)) {
        throw new BadRequestException('Duplicate CSV header');
      }
      seen.add(header);
      if (!allowed.has(header)) {
        throw new BadRequestException(`Unknown CSV header "${header}"`);
      }
    }
    if (!seen.has('match_kind') || !seen.has('priority')) {
      throw new BadRequestException('CSV must include match_kind and priority');
    }
    if (!seen.has(lookupKey)) {
      throw new BadRequestException('CSV must include the lookup field column');
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

function coerceCsvValue(
  field: DirectoryField,
  raw: unknown,
  rowNumber: number,
): string | number | boolean {
  const text = String(raw ?? '');
  if (field.type === 'boolean') {
    const normalized = text.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1') return true;
    if (normalized === 'false' || normalized === '0') return false;
    throw new BadRequestException(`Field "${field.key}" must be a boolean on CSV row ${rowNumber}`);
  }
  if (field.type === 'number') {
    const parsed = Number(text);
    if (!Number.isFinite(parsed)) {
      throw new BadRequestException(`Field "${field.key}" must be a number on CSV row ${rowNumber}`);
    }
    return parsed;
  }
  return text;
}

async function readCsvRows(csv: string): Promise<string[][]> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = await workbook.csv.read(Readable.from([csv]));
  const rows: string[][] = [];
  worksheet.eachRow((row) => {
    const values = row.values as unknown[];
    rows.push(values.slice(1).map((cell) => (cell == null ? '' : String(cell))));
  });
  return rows;
}

async function writeCsvRows(rows: Array<Array<string | number | boolean>>): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('directory');
  for (const row of rows) {
    sheet.addRow(row);
  }
  const buffer = await workbook.csv.writeBuffer();
  return Buffer.from(buffer).toString('utf8');
}
