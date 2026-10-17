import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import { Op, Transaction, QueryTypes } from 'sequelize';
import { autodialFieldsSchema } from '@krasterisk/shared';
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
  validateFields(fields: CreateAutodialBaseDto['fields']): void { this.assertFields(fields); }
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
      await this.sequelize.query('DELETE FROM ac_field_archive WHERE base_uid = :baseUid AND vpbx_user_uid = :userUid',
        { replacements: { baseUid: uid, userUid }, transaction });
      await this.sequelize.query(
        "DELETE FROM ac_dnc WHERE scope = 'base' AND scope_uid = :baseUid AND vpbx_user_uid = :userUid",
        { replacements: { baseUid: uid, userUid }, transaction },
      );
      await base.destroy({ transaction });
    });
  }

  /** Copy a report selection atomically, including scoped exclusions. No tasks are copied. */
  async cloneContacts(userUid: number, sourceUid: number, contactUids: number[], name: string,
    revision: number, campaignUid: number): Promise<IAutodialBase> {
    const ids = [...new Set(contactUids)];
    if (!name.trim() || name.trim().length > 128 || !ids.length || ids.length > 5000
      || ids.some((id) => !Number.isSafeInteger(id) || id <= 0)) throw new BadRequestException({ code: 'AC_SELECTION_INVALID' });
    return this.sequelize.transaction(async (transaction) => {
      const source = await this.lockBase(userUid, sourceUid, transaction);
      if (source.revision !== revision) throw new ConflictException({ code: 'AC_REVISION_CONFLICT' });
      if (!await this.campaignModel.findOne({ where: { uid: campaignUid, base_uid: sourceUid, user_uid: userUid }, transaction }))
        throw new NotFoundException({ code: 'AC_CAMPAIGN_NOT_FOUND' });
      const base = await this.baseModel.create({ user_uid: userUid, name: name.trim(), description: source.description,
        phone_normalization: source.phone_normalization, dedup_policy: source.dedup_policy, revision: 1 }, { transaction });
      await this.replaceFields(base.uid, (source.fields ?? []).map((field) => ({ key: field.key, label: field.label,
        type: field.type, required: field.required, position: field.position, is_phone: field.is_phone,
        var_name: field.var_name, enum_values: field.enum_values ?? undefined, format: field.format })), transaction);
      const fields = await this.fieldModel.findAll({ where: { base_uid: base.uid }, transaction });
      const newFields = new Map(fields.map((field) => [field.key, String(field.uid)]));
      for (let offset = 0; offset < ids.length; offset += 100) {
        const chunk = ids.slice(offset, offset + 100);
        const contacts = await this.contactModel.findAll({ where: { uid: chunk, base_uid: sourceUid, user_uid: userUid },
          include: [{ model: AcContactPhone, as: 'phones' }], transaction });
        if (contacts.length !== chunk.length) throw new ConflictException({ code: 'AC_SELECTION_CHANGED' });
        for (const contact of contacts) {
          const values: AcContact['values'] = {};
          for (const field of source.fields ?? []) {
            const value = contact.values[String(field.uid)] ?? contact.values[field.key];
            if (value !== undefined) values[newFields.get(field.key)!] = value;
          }
          const copy = await this.contactModel.create({ user_uid: userUid, base_uid: base.uid, values,
            external_id: contact.external_id, comment: contact.comment }, { transaction });
          await this.phoneModel.bulkCreate((contact.phones ?? []).map((phone) => ({ contact_uid: copy.uid, base_uid: base.uid,
            raw: phone.raw, normalized: phone.normalized, canonical_phone: phone.canonical_phone, position: phone.position,
            is_primary: phone.is_primary, tz_offset_min: phone.tz_offset_min })), { transaction });
        }
      }
      // Merge base/campaign bans conservatively: a permanent ban wins, otherwise the latest expiry.
      // Global bans remain tenant-wide; copying a selection must never bypass a scoped ban.
      await this.sequelize.query(`INSERT INTO ac_dnc
        (vpbx_user_uid, scope, scope_uid, normalized_phone, reason, source, expires_at, created_at)
        SELECT :userUid, 'base', :newBase, normalized_phone, MIN(reason), 'report-selection',
          CASE WHEN COUNT(*) > COUNT(expires_at) THEN NULL ELSE MAX(expires_at) END, CURRENT_TIMESTAMP
        FROM ac_dnc WHERE vpbx_user_uid = :userUid AND
          ((scope = 'base' AND scope_uid = :sourceUid) OR (scope = 'campaign' AND scope_uid = :campaignUid))
          AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP) GROUP BY normalized_phone`,
        { replacements: { userUid, newBase: base.uid, sourceUid, campaignUid }, transaction, type: QueryTypes.INSERT });
      base.fields = fields;
      return this.toBaseDto(base, ids.length);
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
    const base = await this.loadBase(userUid, baseUid);
    const page = Number.isSafeInteger(opts.page) ? Math.max(1, opts.page!) : 1;
    const pageSize = Number.isSafeInteger(opts.pageSize) ? Math.min(200, Math.max(1, opts.pageSize!)) : 50;
    const where: Record<string, unknown> = { base_uid: baseUid, user_uid: userUid };
    if (opts.q?.trim()) {
      const values = this.sequelize.getDialect() === 'postgres' ? 'CAST(c."values" AS TEXT)' : 'CAST(c.`values` AS CHAR)';
      const clause = `FROM ac_contacts c WHERE c.vpbx_user_uid = :userUid AND c.base_uid = :baseUid
        AND (c.external_id LIKE :pattern OR c.comment LIKE :pattern OR ${values} LIKE :pattern OR EXISTS
          (SELECT 1 FROM ac_contact_phones p WHERE p.contact_uid = c.uid AND p.base_uid = c.base_uid AND (p.normalized LIKE :pattern OR p.raw LIKE :pattern)))`;
      const replacements = { userUid, baseUid, pattern: `%${opts.q.trim().slice(0, 128)}%`, limit: pageSize, offset: (page - 1) * pageSize };
      const [count] = await this.sequelize.query<{ count: number | string }>(`SELECT COUNT(*) AS count ${clause}`, { replacements, type: QueryTypes.SELECT });
      const ids = await this.sequelize.query<{ uid: number }>(`SELECT c.uid ${clause} ORDER BY c.uid DESC LIMIT :limit OFFSET :offset`, { replacements, type: QueryTypes.SELECT });
      const rows = ids.length ? await this.contactModel.findAll({ where: { uid: { [Op.in]: ids.map((row) => row.uid) }, base_uid: baseUid, user_uid: userUid },
        include: [{ model: AcContactPhone, as: 'phones' }], order: [['uid', 'DESC']] }) : [];
      return { items: rows.map((row) => this.toContactDto(row, base.fields ?? [])), total: Number(count?.count ?? 0), page, page_size: pageSize };
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

  async findContacts(userUid: number, baseUid: number, ids: number[]): Promise<IAutodialContact[]> {
    const base = await this.loadBase(userUid, baseUid);
    if (!ids.length) return [];
    const contacts = await this.contactModel.findAll({
      where: { user_uid: userUid, base_uid: baseUid, uid: { [Op.in]: ids } },
      include: [{ model: AcContactPhone, as: 'phones' }],
    });
    return contacts.map((r) => this.toContactDto(r, base.fields ?? []));
  }

  /** All ingestion paths lock the base, so concurrent writers share this policy. */
  private async assertContactUnique(
    base: AcBase,
    prepared: ReturnType<typeof prepareAutodialContact>,
    transaction: Transaction,
    excludeContactUid?: number,
  ): Promise<void> {
    if (base.dedup_policy === 'phone') {
      const duplicate = await this.phoneModel.findOne({
        where: {
          base_uid: base.uid,
          normalized: { [Op.in]: prepared.phones.map((phone) => phone.normalized) },
          ...(excludeContactUid === undefined ? {} : { contact_uid: { [Op.ne]: excludeContactUid } }),
        }, transaction,
      });
      if (duplicate) throw new ConflictException({ code: 'AC_DUPLICATE_PHONE', field: 'phones', message: 'Phone already exists in this base' });
    }
    if (base.dedup_policy === 'external_id' && prepared.external_id) {
      const duplicate = await this.contactModel.findOne({
        where: {
          base_uid: base.uid, user_uid: base.user_uid, external_id: prepared.external_id,
          ...(excludeContactUid === undefined ? {} : { uid: { [Op.ne]: excludeContactUid } }),
        }, transaction,
      });
      if (duplicate) throw new ConflictException({ code: 'AC_DUPLICATE_EXTERNAL_ID', field: 'external_id', message: 'External ID already exists in this base' });
    }
  }

  async createContact(
    userUid: number,
    baseUid: number,
    dto: CreateAutodialContactDto,
  ): Promise<IAutodialContact> {
    return (await this.createContacts(userUid, baseUid, [dto]))[0];
  }

  async createContacts(userUid: number, baseUid: number, contacts: CreateAutodialContactDto[], expectedRevision?: number): Promise<IAutodialContact[]> {
    return this.writeContactBatch(userUid, baseUid, contacts, false, expectedRevision);
  }

  async upsertContacts(userUid: number, baseUid: number, contacts: CreateAutodialContactDto[], expectedRevision?: number, transaction?: Transaction) {
    return this.writeContactBatch(userUid, baseUid, contacts, true, expectedRevision, transaction);
  }

  private async writeContactBatch(userUid: number, baseUid: number, contacts: CreateAutodialContactDto[], upsert: boolean,
    expectedRevision?: number, existingTransaction?: Transaction): Promise<IAutodialContact[]> {
    if (!contacts.length || contacts.length > 100) throw new BadRequestException({ code: 'AC_CONTACT_BATCH_SIZE' });
    const write = async (transaction: Transaction) => {
      const base = await this.lockBase(userUid, baseUid, transaction);
      if (expectedRevision !== undefined && base.revision !== expectedRevision) throw new ConflictException({ code: 'AC_REVISION_CONFLICT' });
      const fields = base.fields ?? [];
      const result: IAutodialContact[] = [];
      const seen = new Set<string>();
      for (const dto of contacts) {
      if (dto.phones?.some((phone) => phone.uid !== undefined)) {
        throw new BadRequestException({ code: 'AC_PHONE_UID', message: 'New phones must not supply UID' });
      }
      const prepared = prepareAutodialContact(fields, dto, base.phone_normalization);
      if (upsert && (!prepared.external_id || seen.has(prepared.external_id))) throw new BadRequestException({ code: 'AC_EXTERNAL_ID_REQUIRED_UNIQUE' });
      if (prepared.external_id) seen.add(prepared.external_id);
      const matches = upsert ? await this.contactModel.findAll({ where: { user_uid: userUid, base_uid: baseUid,
        external_id: prepared.external_id }, include: [{ model: AcContactPhone, as: 'phones' }], limit: 2, transaction }) : [];
      if (matches.length > 1) throw new ConflictException({ code: 'AC_EXTERNAL_ID_AMBIGUOUS' });
      const previous = matches[0];
      await this.assertContactUnique(base, prepared, transaction, previous?.uid);
      const data =
        {
          base_uid: baseUid,
          user_uid: userUid,
          external_id: prepared.external_id,
          values: prepared.values,
          comment: dto.comment?.trim() ?? '',
        };
      const contact = previous ? await previous.update(data, { transaction }) : await this.contactModel.create(data, { transaction });
      if (previous) await this.syncPhones(userUid, baseUid, contact.uid, previous.phones ?? [], prepared.phones, transaction);
      else await this.writePhones(contact.uid, baseUid, prepared.phones, transaction);
      const full = await this.contactModel.findByPk(contact.uid, {
        include: [{ model: AcContactPhone, as: 'phones' }],
        transaction,
      });
      result.push(this.toContactDto(full!, fields));
      }
      await base.increment('revision', { transaction });
      return result;
    };
    return existingTransaction ? write(existingTransaction) : this.sequelize.transaction(write);
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
      await this.assertContactUnique(base, prepared, transaction, contactUid);
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
    const parsed = autodialFieldsSchema.safeParse(fields.map((f) => ({ uid: f.uid, key: f.key, label: f.label,
      type: f.type, required: f.required, position: f.position, is_phone: f.is_phone,
      var_name: f.var_name, enum_values: f.enum_values, format: f.format })));
    if (!parsed.success) throw new BadRequestException({ code: 'AC_FIELD_INVALID', message: parsed.error.issues[0].message, field: parsed.error.issues[0].path.join('.') });
    const keys = new Set<string>();
    let phoneCount = 0;
    const variables = new Set<string>();
    for (const f of fields) {
      if (keys.has(f.key)) {
        throw new BadRequestException({ code: 'AC_FIELD_DUP', message: `Duplicate field key ${f.key}` });
      }
      keys.add(f.key);
      const variable = f.var_name?.trim() || fieldKeyToVarName(f.key);
      if (variables.has(variable)) throw new BadRequestException({ code: 'AC_FIELD_VAR_DUP', message: `Duplicate variable ${variable}` });
      variables.add(variable);
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
    migration = false,
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
          format: field.format ?? null,
        },
      };
    });
    const removed = existing.filter((field) => !retained.has(field.uid));
    const incompatible = removed.length > 0 || planned.some(({ previous, data }) => previous && (
      previous.type !== data.type || previous.is_phone !== data.is_phone
      || (previous.enum_values ?? []).some((value) => !(data.enum_values ?? []).includes(value))
      || (!previous.required && data.required)
    )) || planned.some(({ previous, data }) => !previous && data.required && !data.is_phone);
    if (!migration && incompatible && await this.contactModel.count({ where: { base_uid: baseUid }, transaction })) {
      throw new ConflictException({ code: 'AC_SCHEMA_IN_USE', message: 'Changing a populated schema requires an explicit migration.' });
    }
    const changesReferences = removed.length > 0 || planned.some(({ previous, data }) => previous && (
      previous.key !== data.key || previous.var_name !== data.var_name || previous.type !== data.type
    ));
    if (!migration && changesReferences && (
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

  /** Called only by the revision-checked schema migration transaction. */
  async replaceMigratedFields(baseUid: number, fields: CreateAutodialBaseDto['fields'], transaction: Transaction) {
    this.assertFields(fields);
    await this.replaceFields(baseUid, fields, transaction, true);
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
          format: f.format ?? null,
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
