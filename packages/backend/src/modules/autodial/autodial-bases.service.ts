import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import { Op } from 'sequelize';
import type {
  AutodialFieldType,
  IAutodialBase,
  IAutodialContact,
} from '@krasterisk/shared';
import { AcBase } from './models/ac-base.model';
import { AcBaseField } from './models/ac-base-field.model';
import { AcContact } from './models/ac-contact.model';
import { AcContactPhone } from './models/ac-contact-phone.model';
import { fieldKeyToVarName, normalizeAutodialPhone } from './autodial-phone.util';
import type {
  CreateAutodialBaseDto,
  CreateAutodialContactDto,
  UpdateAutodialBaseDto,
  UpdateAutodialContactDto,
} from './dto/autodial-base.dto';

@Injectable()
export class AutodialBasesService {
  private readonly logger = new Logger(AutodialBasesService.name);

  constructor(
    @InjectModel(AcBase) private readonly baseModel: typeof AcBase,
    @InjectModel(AcBaseField) private readonly fieldModel: typeof AcBaseField,
    @InjectModel(AcContact) private readonly contactModel: typeof AcContact,
    @InjectModel(AcContactPhone) private readonly phoneModel: typeof AcContactPhone,
    private readonly sequelize: Sequelize,
  ) {}

  async findAll(userUid: number): Promise<IAutodialBase[]> {
    const rows = await this.baseModel.findAll({
      where: { user_uid: userUid },
      include: [{ model: AcBaseField, as: 'fields' }],
      order: [['name', 'ASC'], [{ model: AcBaseField, as: 'fields' }, 'position', 'ASC']],
    });
    const counts = await this.contactModel.findAll({
      attributes: [
        'base_uid',
        [this.sequelize.fn('COUNT', this.sequelize.col('uid')), 'cnt'],
      ],
      where: { user_uid: userUid },
      group: ['base_uid'],
      raw: true,
    }) as unknown as Array<{ base_uid: number; cnt: string }>;
    const countMap = new Map(counts.map((c) => [c.base_uid, Number(c.cnt)]));
    return rows.map((r) => this.toBaseDto(r, countMap.get(r.uid) ?? 0));
  }

  async findOne(userUid: number, uid: number): Promise<IAutodialBase> {
    const row = await this.loadBase(userUid, uid);
    const contact_count = await this.contactModel.count({
      where: { base_uid: uid, user_uid: userUid },
    });
    return this.toBaseDto(row, contact_count);
  }

  async create(userUid: number, dto: CreateAutodialBaseDto): Promise<IAutodialBase> {
    this.assertFields(dto.fields);
    return this.sequelize.transaction(async (transaction) => {
      try {
        const base = await this.baseModel.create(
          {
            user_uid: userUid,
            name: dto.name.trim(),
            description: dto.description?.trim() ?? '',
            dedup_policy: dto.dedup_policy ?? 'phone',
            phone_normalization: dto.phone_normalization ?? 'ru_8_to_7',
            revision: 0,
          },
          { transaction },
        );
        await this.replaceFields(base.uid, dto.fields, transaction);
        const full = await this.baseModel.findByPk(base.uid, {
          include: [{ model: AcBaseField, as: 'fields' }],
          transaction,
        });
        return this.toBaseDto(full!, 0);
      } catch (e: unknown) {
        if ((e as { name?: string }).name === 'SequelizeUniqueConstraintError') {
          throw new ConflictException({ code: 'AC_BASE_NAME_EXISTS', message: 'Base name already exists' });
        }
        throw e;
      }
    });
  }

  async update(userUid: number, uid: number, dto: UpdateAutodialBaseDto): Promise<IAutodialBase> {
    const base = await this.loadBase(userUid, uid);
    if (dto.fields) this.assertFields(dto.fields);
    return this.sequelize.transaction(async (transaction) => {
      await base.update(
        {
          ...(dto.name != null ? { name: dto.name.trim() } : {}),
          ...(dto.description != null ? { description: dto.description.trim() } : {}),
          ...(dto.dedup_policy != null ? { dedup_policy: dto.dedup_policy } : {}),
          ...(dto.phone_normalization != null
            ? { phone_normalization: dto.phone_normalization }
            : {}),
          revision: (base.revision ?? 0) + 1,
        },
        { transaction },
      );
      if (dto.fields) {
        await this.replaceFields(uid, dto.fields, transaction);
      }
      const full = await this.baseModel.findByPk(uid, {
        include: [{ model: AcBaseField, as: 'fields' }],
        transaction,
      });
      const contact_count = await this.contactModel.count({
        where: { base_uid: uid, user_uid: userUid },
        transaction,
      });
      return this.toBaseDto(full!, contact_count);
    });
  }

  async remove(userUid: number, uid: number): Promise<void> {
    const base = await this.loadBase(userUid, uid);
    await base.destroy();
  }

  async listContacts(
    userUid: number,
    baseUid: number,
    opts: { page?: number; pageSize?: number; q?: string } = {},
  ): Promise<{ items: IAutodialContact[]; total: number }> {
    await this.loadBase(userUid, baseUid);
    const page = Math.max(1, opts.page ?? 1);
    const pageSize = Math.min(200, Math.max(1, opts.pageSize ?? 50));
    const where: Record<string, unknown> = { base_uid: baseUid, user_uid: userUid };
    if (opts.q?.trim()) {
      where[Op.or as unknown as string] = [
        { external_id: { [Op.like]: `%${opts.q.trim()}%` } },
        { comment: { [Op.like]: `%${opts.q.trim()}%` } },
      ];
    }
    const { rows, count } = await this.contactModel.findAndCountAll({
      where,
      include: [{ model: AcContactPhone, as: 'phones' }],
      order: [['uid', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });
    const fields = await this.fieldModel.findAll({ where: { base_uid: baseUid } });
    return {
      items: rows.map((r) => this.toContactDto(r, fields)),
      total: count,
    };
  }

  async createContact(
    userUid: number,
    baseUid: number,
    dto: CreateAutodialContactDto,
  ): Promise<IAutodialContact> {
    const base = await this.loadBase(userUid, baseUid);
    const fields = base.fields ?? [];
    return this.sequelize.transaction(async (transaction) => {
      const prepared = this.prepareContact(fields, dto, base.phone_normalization);
      const contact = await this.contactModel.create(
        {
          base_uid: baseUid,
          user_uid: userUid,
          external_id: prepared.external_id,
          values: prepared.values,
          comment: dto.comment?.trim() ?? '',
        },
        { transaction },
      );
      await this.writePhones(contact.uid, baseUid, prepared.phones, transaction);
      const full = await this.contactModel.findByPk(contact.uid, {
        include: [{ model: AcContactPhone, as: 'phones' }],
        transaction,
      });
      return this.toContactDto(full!, fields);
    });
  }

  async updateContact(
    userUid: number,
    baseUid: number,
    contactUid: number,
    dto: UpdateAutodialContactDto,
  ): Promise<IAutodialContact> {
    const base = await this.loadBase(userUid, baseUid);
    const fields = base.fields ?? [];
    const contact = await this.contactModel.findOne({
      where: { uid: contactUid, base_uid: baseUid, user_uid: userUid },
      include: [{ model: AcContactPhone, as: 'phones' }],
    });
    if (!contact) throw new NotFoundException({ code: 'AC_CONTACT_NOT_FOUND', message: 'Contact not found' });

    return this.sequelize.transaction(async (transaction) => {
      const merged = {
        external_id: dto.external_id !== undefined ? dto.external_id : contact.external_id,
        values: dto.values ?? this.valuesByKey(contact.values, fields),
        phones: dto.phones ?? (contact.phones ?? []).map((p) => ({
          raw: p.raw,
          is_primary: p.is_primary,
          tz_offset_min: p.tz_offset_min,
        })),
        comment: dto.comment ?? contact.comment,
      };
      const prepared = this.prepareContact(fields, merged as CreateAutodialContactDto, base.phone_normalization);
      await contact.update(
        {
          external_id: prepared.external_id,
          values: prepared.values,
          comment: merged.comment?.trim() ?? '',
        },
        { transaction },
      );
      await this.phoneModel.destroy({ where: { contact_uid: contactUid }, transaction });
      await this.writePhones(contactUid, baseUid, prepared.phones, transaction);
      const full = await this.contactModel.findByPk(contactUid, {
        include: [{ model: AcContactPhone, as: 'phones' }],
        transaction,
      });
      return this.toContactDto(full!, fields);
    });
  }

  async deleteContact(userUid: number, baseUid: number, contactUid: number): Promise<void> {
    await this.loadBase(userUid, baseUid);
    const n = await this.contactModel.destroy({
      where: { uid: contactUid, base_uid: baseUid, user_uid: userUid },
    });
    if (!n) throw new NotFoundException({ code: 'AC_CONTACT_NOT_FOUND', message: 'Contact not found' });
  }

  // ── helpers ───────────────────────────────────────────────────────

  private async loadBase(userUid: number, uid: number): Promise<AcBase> {
    const row = await this.baseModel.findOne({
      where: { uid, user_uid: userUid },
      include: [{ model: AcBaseField, as: 'fields' }],
      order: [[{ model: AcBaseField, as: 'fields' }, 'position', 'ASC']],
    });
    if (!row) throw new NotFoundException({ code: 'AC_BASE_NOT_FOUND', message: 'Base not found' });
    return row;
  }

  private assertFields(fields: CreateAutodialBaseDto['fields']): void {
    if (!fields?.length) {
      throw new BadRequestException({ code: 'AC_FIELDS_REQUIRED', message: 'At least one field required' });
    }
    const keys = new Set<string>();
    let phoneCount = 0;
    for (const f of fields) {
      if (keys.has(f.key)) {
        throw new BadRequestException({ code: 'AC_FIELD_DUP', message: `Duplicate field key ${f.key}` });
      }
      keys.add(f.key);
      if (f.is_phone || f.type === 'phone') phoneCount += 1;
    }
    if (phoneCount < 1) {
      throw new BadRequestException({
        code: 'AC_PHONE_FIELD_REQUIRED',
        message: 'At least one phone field is required',
      });
    }
  }

  private async replaceFields(
    baseUid: number,
    fields: CreateAutodialBaseDto['fields'],
    transaction: import('sequelize').Transaction,
  ): Promise<void> {
    await this.fieldModel.destroy({ where: { base_uid: baseUid }, transaction });
    await this.fieldModel.bulkCreate(
      fields.map((f, i) => ({
        base_uid: baseUid,
        key: f.key,
        label: f.label,
        type: f.type as AutodialFieldType,
        required: f.required ?? false,
        position: f.position ?? i,
        is_phone: f.is_phone ?? f.type === 'phone',
        var_name: f.var_name?.trim() || fieldKeyToVarName(f.key),
        enum_values: f.enum_values ?? null,
      })),
      { transaction },
    );
  }

  private prepareContact(
    fields: AcBaseField[],
    dto: CreateAutodialContactDto,
    phoneNorm: AcBase['phone_normalization'],
  ): {
    external_id: string | null;
    values: Record<string, string | number | boolean>;
    phones: Array<{ raw: string; normalized: string; is_primary: boolean; tz_offset_min: number; position: number }>;
  } {
    if (!dto.phones?.length) {
      throw new BadRequestException({ code: 'AC_PHONES_REQUIRED', message: 'At least one phone required' });
    }
    const byKey = new Map(fields.map((f) => [f.key, f]));
    const values: Record<string, string | number | boolean> = {};
    for (const [key, raw] of Object.entries(dto.values ?? {})) {
      const field = byKey.get(key);
      if (!field) {
        throw new BadRequestException({ code: 'AC_UNKNOWN_FIELD', message: `Unknown field ${key}` });
      }
      values[String(field.uid)] = this.coerceValue(field, raw);
    }
    for (const field of fields) {
      if (field.required && values[String(field.uid)] === undefined) {
        throw new BadRequestException({
          code: 'AC_REQUIRED_FIELD',
          message: `Missing required field ${field.key}`,
        });
      }
    }
    const phones = dto.phones.map((p, i) => {
      const normalized = normalizeAutodialPhone(p.raw, phoneNorm);
      if (!normalized) {
        throw new BadRequestException({ code: 'AC_INVALID_PHONE', message: `Invalid phone: ${p.raw}` });
      }
      return {
        raw: p.raw.trim(),
        normalized,
        is_primary: p.is_primary ?? i === 0,
        tz_offset_min: p.tz_offset_min ?? 180,
        position: i,
      };
    });
    if (!phones.some((p) => p.is_primary)) phones[0].is_primary = true;
    return {
      external_id: dto.external_id?.trim() || null,
      values,
      phones,
    };
  }

  private coerceValue(
    field: AcBaseField,
    raw: string | number | boolean,
  ): string | number | boolean {
    switch (field.type) {
      case 'boolean':
        if (typeof raw === 'boolean') return raw;
        if (raw === '1' || raw === 'true' || raw === 'yes') return true;
        if (raw === '0' || raw === 'false' || raw === 'no') return false;
        throw new BadRequestException({ code: 'AC_INVALID_BOOL', message: `Invalid boolean for ${field.key}` });
      case 'number':
      case 'money': {
        const n = typeof raw === 'number' ? raw : Number(String(raw).replace(',', '.'));
        if (Number.isNaN(n)) {
          throw new BadRequestException({ code: 'AC_INVALID_NUMBER', message: `Invalid number for ${field.key}` });
        }
        return n;
      }
      default:
        return String(raw);
    }
  }

  private async writePhones(
    contactUid: number,
    baseUid: number,
    phones: Array<{ raw: string; normalized: string; is_primary: boolean; tz_offset_min: number; position: number }>,
    transaction: import('sequelize').Transaction,
  ): Promise<void> {
    await this.phoneModel.bulkCreate(
      phones.map((p) => ({
        contact_uid: contactUid,
        base_uid: baseUid,
        ...p,
      })),
      { transaction },
    );
  }

  private valuesByKey(
    values: Record<string, string | number | boolean>,
    fields: AcBaseField[],
  ): Record<string, string | number | boolean> {
    const byUid = new Map(fields.map((f) => [String(f.uid), f.key]));
    const out: Record<string, string | number | boolean> = {};
    for (const [uid, v] of Object.entries(values ?? {})) {
      const key = byUid.get(uid);
      if (key) out[key] = v;
    }
    return out;
  }

  private toBaseDto(row: AcBase, contact_count: number): IAutodialBase {
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

  toContactDto(row: AcContact, fields: AcBaseField[]): IAutodialContact {
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
}
