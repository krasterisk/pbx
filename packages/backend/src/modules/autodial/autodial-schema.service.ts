import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import { Op, QueryTypes, Transaction } from 'sequelize';
import { createHash } from 'node:crypto';
import { autodialSchemaMigrationSchema, type IAutodialBase, type IAutodialBaseField } from '@krasterisk/shared';
import type { z } from 'zod';
import { AcBase } from './models/ac-base.model';
import { AcBaseField } from './models/ac-base-field.model';
import { AcContact } from './models/ac-contact.model';
import { AcCampaign } from './models/ac-campaign.model';
import { AcImportProfile } from './models/ac-import-profile.model';
import { AutodialBasesService } from './autodial-bases.service';
import { autodialSqlDate } from './autodial-sql-time.util';
import { autodialFieldReferenced, convertAutodialSchemaValues, planAutodialFields, rewriteAutodialFieldReferences } from './autodial-schema.util';

type MigrationInput = z.infer<typeof autodialSchemaMigrationSchema>;
type FieldPlan = ReturnType<typeof planAutodialFields>;

@Injectable()
export class AutodialSchemaService {
  constructor(@InjectConnection() private readonly db: Sequelize,
    @InjectModel(AcBase) private readonly baseModel: typeof AcBase,
    @InjectModel(AcBaseField) private readonly fields: typeof AcBaseField,
    @InjectModel(AcContact) private readonly contacts: typeof AcContact,
    @InjectModel(AcCampaign) private readonly campaigns: typeof AcCampaign,
    @InjectModel(AcImportProfile) private readonly profiles: typeof AcImportProfile,
    private readonly bases: AutodialBasesService) {}

  private parse(input: unknown): MigrationInput {
    const parsed = autodialSchemaMigrationSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException({ code: 'AC_SCHEMA_INPUT', message: parsed.error.issues[0].message });
    return parsed.data;
  }
  private async references(userUid: number, baseUid: number, transaction?: Transaction) {
    const [campaigns, profiles] = await Promise.all([
      this.campaigns.findAll({ where: { user_uid: userUid, base_uid: baseUid }, transaction }),
      this.profiles.findAll({ where: { user_uid: userUid, base_uid: baseUid }, transaction }),
    ]);
    return { campaigns, profiles };
  }
  private fieldUsage(field: IAutodialBaseField, refs: Awaited<ReturnType<AutodialSchemaService['references']>>) {
    return [
      ...refs.campaigns.filter((campaign) => autodialFieldReferenced([campaign.scenario_actions, campaign.cid_policy, campaign.trunk_pool], field))
        .map((campaign) => ({ kind: 'campaign' as const, uid: campaign.uid, name: campaign.name })),
      ...refs.profiles.filter((profile) => profile.column_map.some((column) => column.field_key === field.key))
        .map((profile) => ({ kind: 'import_profile' as const, uid: profile.uid, name: profile.name })),
    ];
  }
  async usage(userUid: number, baseUid: number) {
    const base = await this.bases.findOne(userUid, baseUid);
    const refs = await this.references(userUid, baseUid);
    return { base_uid: baseUid, revision: base.revision, contact_count: base.contact_count,
      fields: base.fields.map((field) => ({ uid: field.uid, key: field.key, var_name: field.var_name, used_by: this.fieldUsage(field, refs) })) };
  }
  private hash(userUid: number, baseUid: number, revision: number, input: MigrationInput, plan: FieldPlan) {
    return createHash('sha256').update(JSON.stringify({ userUid, baseUid, revision, fields: plan.fields,
      defaults: input.defaults ?? {}, invalid_optional_policy: input.invalid_optional_policy })).digest('hex');
  }
  private checkRevision(base: Pick<IAutodialBase, 'revision'>, input: MigrationInput) {
    if (base.revision !== input.expected_revision) throw new ConflictException({ code: 'AC_REVISION_CONFLICT' });
  }
  private blockers(plan: FieldPlan, refs: Awaited<ReturnType<AutodialSchemaService['references']>>) {
    const blocked = plan.removed.flatMap((field) => {
      const usage = this.fieldUsage(field, refs);
      return usage.length ? [{ field: field.key, code: 'AC_FIELD_IN_USE', used_by: usage }] : [];
    });
    if (refs.campaigns.some((campaign) => ['running', 'paused'].includes(campaign.status))) blocked.push({ field: '', code: 'AC_SCHEMA_ACTIVE', used_by: [] });
    return blocked;
  }
  private async scan(userUid: number, baseUid: number, old: IAutodialBaseField[], plan: FieldPlan, input: MigrationInput,
    transaction?: Transaction, consume?: (rows: AcContact[], converted: ReturnType<typeof convertAutodialSchemaValues>[]) => Promise<void>) {
    let cursor = 0, scanned = 0, errorCount = 0, archivedValues = 0;
    const errors: Array<{ contact_uid: number; field: string; code: string }> = [];
    const sample: Array<{ contact_uid: number; before: Record<string, unknown>; after: Record<string, unknown> }> = [];
    for (;;) {
      const rows = await this.contacts.findAll({ where: { user_uid: userUid, base_uid: baseUid, uid: { [Op.gt]: cursor } }, order: [['uid', 'ASC']], limit: 200, transaction });
      if (!rows.length) break;
      const converted = rows.map((row) => convertAutodialSchemaValues(row.values ?? {}, old, plan, input.defaults, input.invalid_optional_policy));
      for (let index = 0; index < rows.length; index++) {
        const result = converted[index], row = rows[index];
        scanned++; errorCount += result.errors.length; archivedValues += result.archives.length;
        if (errors.length < 100) errors.push(...result.errors.slice(0, 100 - errors.length).map((error) => ({ contact_uid: row.uid, ...error })));
        if (sample.length < 20 && (result.archives.length || plan.fields.some((field) => !field.uid && result.valuesByKey[field.key] !== undefined))) sample.push({ contact_uid: row.uid,
          before: Object.fromEntries(old.filter((field) => !field.is_phone).map((field) => [field.key, row.values?.[String(field.uid)]])), after: result.valuesByKey });
      }
      if (consume) await consume(rows, converted);
      cursor = rows[rows.length - 1].uid;
    }
    return { scanned_contacts: scanned, error_count: errorCount, errors, archived_values: archivedValues, sample };
  }
  async preview(userUid: number, baseUid: number, raw: unknown) {
    const input = this.parse(raw), base = await this.bases.findOne(userUid, baseUid);
    this.checkRevision(base, input);
    const plan = planAutodialFields(base.fields, input.fields), refs = await this.references(userUid, baseUid);
    const blockers = this.blockers(plan, refs);
    const result = await this.scan(userUid, baseUid, base.fields, plan, input);
    this.checkRevision(await this.bases.findOne(userUid, baseUid), input);
    return { base_uid: baseUid, expected_revision: base.revision, preview_hash: this.hash(userUid, baseUid, base.revision, input, plan),
      ...result, blockers, ready: !blockers.length && !result.error_count, removed_fields: plan.removed.map((field) => field.key),
      renames: plan.renames, affected_campaigns: refs.campaigns.map((campaign) => ({ uid: campaign.uid, name: campaign.name })) };
  }

  async apply(userUid: number, actorUid: number | undefined, baseUid: number, raw: unknown) {
    const input = this.parse(raw);
    if (!input.preview_hash) throw new BadRequestException({ code: 'AC_SCHEMA_PREVIEW_REQUIRED' });
    await this.db.transaction(async (transaction) => {
      const locked = await this.baseModel.findOne({ where: { user_uid: userUid, uid: baseUid }, transaction, lock: transaction.LOCK.UPDATE });
      if (!locked) throw new BadRequestException({ code: 'AC_BASE_NOT_FOUND' });
      this.checkRevision(locked, input);
      const old = (await this.fields.findAll({ where: { base_uid: baseUid }, transaction })).map((field) => field.toJSON() as IAutodialBaseField);
      const plan = planAutodialFields(old, input.fields), refs = await this.references(userUid, baseUid, transaction);
      if (input.preview_hash !== this.hash(userUid, baseUid, locked.revision, input, plan)) throw new ConflictException({ code: 'AC_SCHEMA_PREVIEW_STALE' });
      const blockers = this.blockers(plan, refs);
      if (blockers.length) throw new ConflictException({ code: blockers[0].code, blockers });
      const validation = await this.scan(userUid, baseUid, old, plan, input, transaction);
      if (validation.error_count) throw new ConflictException({ code: 'AC_SCHEMA_CONVERSION_ERRORS', ...validation });
      await this.bases.replaceMigratedFields(baseUid, plan.fields.map((field) => ({ ...field, enum_values: field.enum_values ?? undefined })), transaction);
      const newFields = await this.fields.findAll({ where: { base_uid: baseUid }, transaction });
      const nextRevision = locked.revision + 1;
      await this.scan(userUid, baseUid, old, plan, input, transaction, async (rows, converted) => {
        const archives = converted.flatMap((result, index) => result.archives.map((item) => ({ ...item, contactUid: rows[index].uid })));
        for (let offset = 0; offset < archives.length; offset += 25) {
          const batch = archives.slice(offset, offset + 25);
          const replacements: Record<string, unknown> = { userUid, baseUid, revision: nextRevision, actorUid: actorUid ?? null, now: autodialSqlDate(new Date(), this.db) };
          const json = (name: string) => this.db.getDialect() === 'postgres' ? `CAST(:${name} AS JSONB)` : `:${name}`;
          const values = batch.map((item, index) => {
            replacements[`contact${index}`] = item.contactUid; replacements[`field${index}`] = item.field.uid;
            replacements[`snapshot${index}`] = JSON.stringify(item.field); replacements[`value${index}`] = JSON.stringify(item.value);
            return `(:userUid,:baseUid,:contact${index},:field${index},:revision,:actorUid,${json(`snapshot${index}`)},${json(`value${index}`)},:now)`;
          });
          await this.db.query(`INSERT INTO ac_field_archive (vpbx_user_uid,base_uid,contact_uid,field_uid,base_revision,actor_uid,field_snapshot,archived_value,created_at) VALUES ${values.join(',')}`,
            { replacements, transaction, type: QueryTypes.INSERT });
        }
        const updated = rows.map((row, index) => {
          const values = { ...row.values };
          for (const removed of plan.removed) delete values[String(removed.uid)];
          for (const field of newFields) {
            if (field.is_phone) continue;
            delete values[String(field.uid)];
            const value = converted[index].valuesByKey[field.key];
            if (value !== undefined) values[String(field.uid)] = value;
          }
          return { ...row.toJSON(), values, updated_at: new Date() };
        });
        for (let offset = 0; offset < updated.length; offset += 50) await this.contacts.bulkCreate(updated.slice(offset, offset + 50), { updateOnDuplicate: ['values', 'updated_at'], transaction });
      });
      for (const campaign of refs.campaigns) {
        const patch = { scenario_actions: rewriteAutodialFieldReferences(campaign.scenario_actions, plan.renames),
          cid_policy: rewriteAutodialFieldReferences(campaign.cid_policy, plan.renames), trunk_pool: rewriteAutodialFieldReferences(campaign.trunk_pool, plan.renames) };
        if (plan.renames.length) await campaign.update({ ...patch, revision: campaign.revision + 1, apply_error: 'AC_SCHEMA_REQUIRES_APPLY' }, { transaction });
        await this.db.query(`INSERT INTO ac_campaign_events (vpbx_user_uid,campaign_uid,event_type,tour_no,revision,payload,created_at)
          VALUES (:userUid,:uid,'base_schema_migrated',:tourNo,:revision,:payload,:now)`,
        { replacements: { userUid, uid: campaign.uid, tourNo: campaign.tour_no, revision: campaign.revision,
          payload: JSON.stringify({ base_uid: baseUid, base_revision: nextRevision, actor_uid: actorUid ?? null }), now: autodialSqlDate(new Date(), this.db) }, transaction, type: QueryTypes.INSERT });
      }
      for (const profile of refs.profiles) {
        const columnMap = profile.column_map.map((column) => ({ ...column,
          field_key: plan.renames.find((rename) => rename.oldKey === column.field_key)?.key ?? column.field_key }));
        if (plan.renames.length) await profile.update({ column_map: columnMap }, { transaction });
      }
      await locked.update({ revision: nextRevision }, { transaction });
    });
    return this.bases.findOne(userUid, baseUid);
  }
}
