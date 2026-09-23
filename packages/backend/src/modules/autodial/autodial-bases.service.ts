import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import { Op, Transaction } from 'sequelize';
import type {
  IAutodialBase,
  IAutodialContact,
  IAutodialContactsPage,
} from '@krasterisk/shared';
import { AcBase } from './models/ac-base.model';
import { AcBaseField } from './models/ac-base-field.model';
import { AcContact } from './models/ac-contact.model';
import { AcContactPhone } from './models/ac-contact-phone.model';
import { AcCampaign } from './models/ac-campaign.model';
import { AcImportProfile } from './models/ac-import-profile.model';
import { AcTask } from './models/ac-task.model';
import { fieldKeyToVarName } from './autodial-phone.util';
import { prepareAutodialContact } from './autodial-contact.util';
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
    @InjectModel(AcTask) private readonly taskModel: typeof AcTask,
    @InjectModel(AcCampaign) private readonly campaignModel: typeof AcCampaign,
    @InjectModel(AcImportProfile) private readonly profileModel: typeof AcImportProfile,
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
    if (dto.fields) this.assertFields(dto.fields);
    return this.sequelize.transaction(async (transaction) => {
      const base = await this.lockBase(userUid, uid, transaction);
      if (dto.revision !== undefined && dto.revision !== base.revision) {
        throw new ConflictException({ code: 'AC_REVISION_CONFLICT', message: 'Base changed. Reload before saving.' });
      }
      if (dto.phone_normalization && dto.phone_normalization !== base.phone_normalization
        && await this.contactModel.count({ where: { base_uid: uid }, transaction })) {
        throw new ConflictException({ code: 'AC_BASE_IN_USE', message: 'Phone normalization requires an explicit data migration.' });
      }
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
      await this.sequelize.query(
        'DELETE FROM ac_import_runs WHERE base_uid = :baseUid AND vpbx_user_uid = :userUid',
        { replacements: { baseUid: uid, userUid }, transaction },
      );
      await this.sequelize.query(
        "DELETE FROM ac_dnc WHERE scope = 'base' AND scope_uid = :baseUid AND vpbx_user_uid = :userUid",
        { replacements: { baseUid: uid, userUid }, transaction },
      );
      await base.destroy({ transaction });
    });
  }

  async removeMany(
    userUid: number,
    uids: number[],
  ): Promise<{ deleted: number[]; failed: Array<{ uid: number; code: string }> }> {
    const unique = [...new Set(uids.filter((uid) => Number.isSafeInteger(uid) && uid > 0))];
    const deleted: number[] = [];
    const failed: Array<{ uid: number; code: string }> = [];
    for (const uid of unique) {
      try {
        await this.remove(userUid, uid);
        deleted.push(uid);
      } catch (err) {
        const code = (err as { response?: { code?: string } })?.response?.code
          ?? 'AC_BASE_DELETE_FAILED';
        failed.push({ uid, code });
      }
    }
    return { deleted, failed };
  }

  async listContacts(
    userUid: number,
    baseUid: number,
    opts: { page?: number; pageSize?: number; q?: string } = {},
  ): Promise<IAutodialContactsPage> {
    await this.loadBase(userUid, baseUid);
    const page = Number.isSafeInteger(opts.page) ? Math.max(1, opts.page!) : 1;
    const pageSize = Number.isSafeInteger(opts.pageSize) ? Math.min(200, Math.max(1, opts.pageSize!)) : 50;
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

  async findContact(userUid: number, baseUid: number, contactUid: number): Promise<IAutodialContact> {
    const base = await this.loadBase(userUid, baseUid);
    const contact = await this.contactModel.findOne({
      where: { uid: contactUid, base_uid: baseUid, user_uid: userUid },
      include: [{ model: AcContactPhone, as: 'phones' }],
    });
    if (!contact) throw new NotFoundException({ code: 'AC_CONTACT_NOT_FOUND', message: 'Contact not found' });
    return this.toContactDto(contact, base.fields ?? []);
  }

  async createContact(
    userUid: number,
    baseUid: number,
    dto: CreateAutodialContactDto,
  ): Promise<IAutodialContact> {
    return this.sequelize.transaction(async (transaction) => {
      const base = await this.lockBase(userUid, baseUid, transaction);
      const fields = base.fields ?? [];
      if (dto.phones?.some((phone) => phone.uid !== undefined)) {
        throw new BadRequestException({ code: 'AC_PHONE_UID', message: 'New phones must not supply UID' });
      }
      const prepared = prepareAutodialContact(fields, dto, base.phone_normalization);
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
      await base.increment('revision', { transaction });
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
    return this.sequelize.transaction(async (transaction) => {
      const base = await this.lockBase(userUid, baseUid, transaction);
      const fields = base.fields ?? [];
      const contact = await this.contactModel.findOne({
        where: { uid: contactUid, base_uid: baseUid, user_uid: userUid },
        include: [{ model: AcContactPhone, as: 'phones' }],
        transaction,
      });
      if (!contact) throw new NotFoundException({ code: 'AC_CONTACT_NOT_FOUND', message: 'Contact not found' });
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
      const prepared = prepareAutodialContact(fields, merged, base.phone_normalization);
      await contact.update(
        {
          external_id: prepared.external_id,
          values: prepared.values,
          comment: merged.comment?.trim() ?? '',
        },
        { transaction },
      );
      await this.syncPhones(userUid, baseUid, contactUid, contact.phones ?? [], prepared.phones, transaction);
      await base.increment('revision', { transaction });
      const full = await this.contactModel.findByPk(contactUid, {
        include: [{ model: AcContactPhone, as: 'phones' }],
        transaction,
      });
      return this.toContactDto(full!, fields);
    });
  }

  async deleteContact(userUid: number, baseUid: number, contactUid: number): Promise<void> {
    await this.sequelize.transaction(async (transaction) => {
      const base = await this.lockBase(userUid, baseUid, transaction);
      if (await this.taskModel.count({ where: { user_uid: userUid, contact_uid: contactUid }, transaction })) {
        throw new ConflictException({ code: 'AC_CONTACT_IN_USE', message: 'Contact has campaign tasks or call history.' });
      }
      const n = await this.contactModel.destroy({
        where: { uid: contactUid, base_uid: baseUid, user_uid: userUid }, transaction,
      });
      if (!n) throw new NotFoundException({ code: 'AC_CONTACT_NOT_FOUND', message: 'Contact not found' });
      await base.increment('revision', { transaction });
    });
  }

  /** All base/contact/import writers serialize through this row lock. */
  async lockBase(userUid: number, baseUid: number, transaction: Transaction): Promise<AcBase> {
    const base = await this.baseModel.findOne({
      where: { uid: baseUid, user_uid: userUid }, transaction, lock: transaction.LOCK.UPDATE,
    });
    if (!base) throw new NotFoundException({ code: 'AC_BASE_NOT_FOUND', message: 'Base not found' });
    base.fields = await this.fieldModel.findAll({ where: { base_uid: baseUid }, transaction });
    return base;
  }

  async assertBaseReplaceable(userUid: number, baseUid: number, transaction: Transaction): Promise<void> {
    if (await this.campaignModel.count({ where: { user_uid: userUid, base_uid: baseUid }, transaction })) {
      throw new ConflictException({ code: 'AC_BASE_IN_USE', message: 'A campaign references this base.' });
    }
    // A campaign may have switched bases in an older version. Preserve its history too.
    const [rows] = await this.sequelize.query(
      'SELECT t.uid FROM ac_tasks t JOIN ac_contacts c ON c.uid = t.contact_uid WHERE c.base_uid = :baseUid LIMIT 1',
      { replacements: { baseUid }, transaction },
    );
    if (rows.length) throw new ConflictException({ code: 'AC_BASE_IN_USE', message: 'Base has campaign tasks or call history.' });
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
    transaction: Transaction,
  ): Promise<void> {
    const existing = await this.fieldModel.findAll({ where: { base_uid: baseUid }, transaction });
    const byUid = new Map(existing.map((field) => [field.uid, field]));
    const byKey = new Map(existing.map((field) => [field.key, field]));
    const retained = new Set<number>();
    const planned = fields.map((field, position) => {
      const previous = field.uid !== undefined ? byUid.get(field.uid) : byKey.get(field.key);
      if (field.uid !== undefined && !previous) {
        throw new BadRequestException({ code: 'AC_FIELD_UID', message: 'Field does not belong to this base.' });
      }
      if (previous && retained.has(previous.uid)) {
        throw new BadRequestException({ code: 'AC_FIELD_DUP', message: 'Duplicate field UID.' });
      }
      if (previous) retained.add(previous.uid);
      const keyOwner = byKey.get(field.key);
      if (keyOwner && keyOwner.uid !== previous?.uid) {
        throw new ConflictException({ code: 'AC_FIELD_KEY_IN_USE', message: 'A different field owns this key.' });
      }
      return {
        previous,
        data: {
          base_uid: baseUid, key: field.key, label: field.label, type: field.type,
          required: field.required ?? false, position: field.position ?? position,
          is_phone: field.is_phone === true || field.type === 'phone',
          var_name: field.var_name?.trim() || fieldKeyToVarName(field.key),
          enum_values: field.type === 'enum' ? field.enum_values ?? [] : null,
        },
      };
    });
    const removed = existing.filter((field) => !retained.has(field.uid));
    const incompatible = removed.length > 0 || planned.some(({ previous, data }) => previous && (
      previous.type !== data.type || previous.is_phone !== data.is_phone
      || JSON.stringify(previous.enum_values ?? []) !== JSON.stringify(data.enum_values ?? [])
      || (!previous.required && data.required)
    )) || planned.some(({ previous, data }) => !previous && data.required && !data.is_phone);
    if (incompatible && await this.contactModel.count({ where: { base_uid: baseUid }, transaction })) {
      throw new ConflictException({ code: 'AC_SCHEMA_IN_USE', message: 'Changing a populated schema requires an explicit migration.' });
    }
    const changesReferences = removed.length > 0 || planned.some(({ previous, data }) => previous && (
      previous.key !== data.key || previous.var_name !== data.var_name || previous.type !== data.type
    ));
    if (changesReferences && (
      await this.campaignModel.count({ where: { base_uid: baseUid }, transaction })
      || await this.profileModel.count({ where: { base_uid: baseUid }, transaction })
    )) {
      throw new ConflictException({ code: 'AC_FIELD_IN_USE', message: 'Campaigns or import profiles reference this schema.' });
    }
    if (removed.length) {
      await this.fieldModel.destroy({ where: { base_uid: baseUid, uid: removed.map((field) => field.uid) }, transaction });
    }
    for (const { previous, data } of planned) {
      if (previous) await previous.update(data, { transaction });
      else await this.fieldModel.create(data, { transaction });
    }
  }

  private async syncPhones(
    userUid: number,
    baseUid: number,
    contactUid: number,
    existing: AcContactPhone[],
    phones: ReturnType<typeof prepareAutodialContact>['phones'],
    transaction: Transaction,
  ): Promise<void> {
    const remaining = new Map(existing.map((phone) => [phone.uid, phone]));
    const planned = phones.map((phone) => {
      // Legacy clients have no UID: match by normalized identity, never position.
      const previous = phone.uid !== undefined
        ? remaining.get(phone.uid)
        : [...remaining.values()].find((candidate) => candidate.normalized === phone.normalized);
      if (phone.uid !== undefined && !previous) {
        throw new BadRequestException({ code: 'AC_PHONE_UID', message: 'Unknown or repeated phone UID.' });
      }
      if (previous) remaining.delete(previous.uid);
      return { previous, phone };
    });
    const changed = [
      ...remaining.keys(),
      ...planned.filter(({ previous, phone }) => previous && previous.normalized !== phone.normalized)
        .map(({ previous }) => previous!.uid),
    ];
    if (changed.length && await this.taskModel.count({
      where: { user_uid: userUid, phone_uid: changed }, transaction,
    })) {
      throw new ConflictException({ code: 'AC_PHONE_IN_USE', message: 'A number with campaign tasks cannot be removed or replaced.' });
    }
    if (remaining.size) {
      await this.phoneModel.destroy({ where: { contact_uid: contactUid, uid: [...remaining.keys()] }, transaction });
    }
    for (const { previous, phone } of planned) {
      const { uid: _uid, ...data } = phone;
      if (previous) await previous.update(data, { transaction });
      else await this.phoneModel.create({ ...data, contact_uid: contactUid, base_uid: baseUid }, { transaction });
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
