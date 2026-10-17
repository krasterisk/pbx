import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/sequelize';
import { Interval } from '@nestjs/schedule';
import { Sequelize } from 'sequelize-typescript';
import { QueryTypes, Transaction } from 'sequelize';
import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { AutodialBasesService } from './autodial-bases.service';
import { AutodialImportService } from './autodial-import.service';
import { AutodialDncService } from './autodial-dnc.service';
import { AutodialIntegrationKeyService, type AutodialKeyActor } from '../autodial-integration/autodial-integration-key.service';
import { autodialSqlDate } from './autodial-sql-time.util';

const contact = z.strictObject({ external_id: z.string().trim().min(1).max(128),
  values: z.record(z.string().max(64), z.union([z.string().max(10000), z.number().finite(), z.boolean()])),
  phones: z.array(z.strictObject({ raw: z.string().min(1).max(64), is_primary: z.boolean().optional(), tz_offset_min: z.number().int().min(-720).max(840).optional() })).min(1).max(10),
  comment: z.string().max(512).optional() });
export const autodialCrmBulkSchema = z.strictObject({ expected_revision: z.number().int().nonnegative().optional(), contacts: z.array(contact).min(1).max(100) });
const bulkSchema = autodialCrmBulkSchema;
export const autodialCrmImportSchema = z.strictObject({ filename: z.string().min(1).max(255), source: z.enum(['csv', 'xlsx']),
  content_base64: z.string().min(4).max(6000000).regex(/^[A-Za-z0-9+/]*={0,2}$/),
  expected_revision: z.number().int().nonnegative(), profile_uid: z.number().int().positive().optional(),
  column_map: z.array(z.strictObject({ column: z.string().max(255), column_index: z.number().int().nonnegative().optional(),
    field_key: z.string().min(1).max(64), transform: z.enum(['trim', 'phone_normalize', 'date_iso', 'money_cents']).optional() })).min(1).max(100).optional(),
  delimiter: z.string().length(1).optional(), has_header: z.boolean().optional(),
  dedup_policy: z.enum(['phone', 'external_id', 'none']).optional() });
const importSchema = autodialCrmImportSchema;
export const autodialCrmDncSchema = z.strictObject({ scope: z.enum(['global', 'base', 'campaign']), scope_uid: z.number().int().positive().optional(),
  phones: z.array(z.string().min(3).max(64)).min(1).max(100), reason: z.string().max(255).optional(), expires_at: z.iso.datetime().optional() });
const parseJson = <T>(value: T | string): T => typeof value === 'string' ? JSON.parse(value) : value;

@Injectable()
export class AutodialCrmService {
  private working = false;
  constructor(@InjectConnection() private readonly db: Sequelize, private readonly bases: AutodialBasesService,
    private readonly importer: AutodialImportService, private readonly dnc: AutodialDncService,
    private readonly keys: AutodialIntegrationKeyService) {}

  private parse<S extends z.ZodType>(schema: S, raw: unknown): z.output<S> {
    const parsed = schema.safeParse(raw); if (!parsed.success) throw new BadRequestException({ code: 'AC_API_INPUT', issues: parsed.error.issues.map((issue) => ({ path: issue.path.join('.'), code: issue.code })) });
    return parsed.data;
  }

  private async command<T>(actor: AutodialKeyActor, requestId: unknown, input: unknown,
    scope: 'autodial:contacts:write' | 'autodial:imports:write' | 'autodial:dnc:write', write: (tx: Transaction) => Promise<T>): Promise<T> {
    if (typeof requestId !== 'string' || !/^[A-Za-z0-9._:-]{8,128}$/.test(requestId)) throw new BadRequestException({ code: 'AC_API_IDEMPOTENCY_REQUIRED' });
    const canonical = JSON.stringify(input, (_key, value: unknown) => value && typeof value === 'object' && !Array.isArray(value)
      ? Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right))) : value);
    const hash = createHash('sha256').update(canonical).digest('hex');
    return this.db.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED }, async (transaction) => {
      await this.db.query('SELECT uid FROM ac_integration_keys WHERE uid = :key AND vpbx_user_uid = :tenant FOR UPDATE',
        { replacements: { key: actor.integration_key_uid, tenant: actor.vpbx_user_uid }, transaction, type: QueryTypes.SELECT });
      await this.keys.assertActive(actor.integration_key_uid, actor.vpbx_user_uid, scope, transaction);
      const [prior] = await this.db.query<{ request_hash: string; response: T | string }>(`SELECT request_hash, response FROM ac_integration_commands
        WHERE vpbx_user_uid = :tenant AND key_uid = :key AND request_id = :request`,
        { replacements: { tenant: actor.vpbx_user_uid, key: actor.integration_key_uid, request: requestId }, transaction, type: QueryTypes.SELECT });
      if (prior) {
        if (prior.request_hash !== hash) throw new ConflictException({ code: 'AC_API_IDEMPOTENCY_CONFLICT' });
        return parseJson(prior.response);
      }
      const response = await write(transaction);
      await this.db.query(`INSERT INTO ac_integration_commands (vpbx_user_uid, key_uid, request_id, request_hash, response, created_at)
        VALUES (:tenant, :key, :request, :hash, :response, :now)`, { replacements: { tenant: actor.vpbx_user_uid,
          key: actor.integration_key_uid, request: requestId, hash, response: JSON.stringify(response), now: autodialSqlDate(new Date(), this.db) }, transaction });
      return response;
    });
  }

  async upsert(actor: AutodialKeyActor, baseUid: number, requestId: unknown, raw: unknown) {
    const input = this.parse(bulkSchema, raw);
    return this.command(actor, requestId, ['upsert', baseUid, input], 'autodial:contacts:write', async (tx) => {
      const contacts = await this.bases.upsertContacts(actor.vpbx_user_uid, baseUid, input.contacts, input.expected_revision, tx);
      return { contacts: contacts.map((row) => ({ uid: row.uid, external_id: row.external_id })) };
    });
  }

  async enqueueImport(actor: AutodialKeyActor, baseUid: number, requestId: unknown, raw: unknown) {
    const input = this.parse(importSchema, raw);
    const buffer = Buffer.from(input.content_base64, 'base64');
    if (buffer.length > 4000000 || buffer.toString('base64') !== input.content_base64) throw new BadRequestException({ code: 'AC_API_FILE_INVALID' });
    return this.command(actor, requestId, ['import', baseUid, input], 'autodial:imports:write', async (transaction) => {
      const base = await this.bases.lockBase(actor.vpbx_user_uid, baseUid, transaction);
      if (base.revision !== input.expected_revision) throw new ConflictException({ code: 'AC_REVISION_CONFLICT' });
      const pending = await this.db.query("SELECT uid FROM ac_import_jobs WHERE key_uid = :key AND vpbx_user_uid = :tenant AND status = 'pending' LIMIT 10",
        { replacements: { key: actor.integration_key_uid, tenant: actor.vpbx_user_uid }, transaction, type: QueryTypes.SELECT });
      if (pending.length >= 10) throw new BadRequestException({ code: 'AC_API_JOB_LIMIT' });
      const uid = randomUUID();
      await this.db.query(`INSERT INTO ac_import_jobs (uid, vpbx_user_uid, key_uid, base_uid, payload, created_at)
        VALUES (:uid, :tenant, :key, :base, :payload, :now)`, { replacements: { uid, tenant: actor.vpbx_user_uid,
          key: actor.integration_key_uid, base: baseUid, payload: JSON.stringify(input), now: autodialSqlDate(new Date(), this.db) }, transaction });
      return { uid, status: 'pending' };
    });
  }

  async job(actor: AutodialKeyActor, uid: string) {
    if (!z.uuid().safeParse(uid).success) throw new BadRequestException({ code: 'AC_API_INPUT' });
    const [job] = await this.db.query<{ uid: string; status: string; result: unknown; error: string | null }>(`SELECT uid, status, result, error, created_at, completed_at
      FROM ac_import_jobs WHERE uid = :uid AND vpbx_user_uid = :tenant AND key_uid = :key`,
      { replacements: { uid, tenant: actor.vpbx_user_uid, key: actor.integration_key_uid }, type: QueryTypes.SELECT });
    if (!job) throw new NotFoundException({ code: 'AC_API_JOB_NOT_FOUND' });
    return { ...job, result: typeof job.result === 'string' ? parseJson(job.result) : job.result };
  }

  @Interval(2000)
  async processNextImport(): Promise<void> {
    if (this.working) return; this.working = true;
    try {
      await this.db.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED }, async (transaction) => {
        const [job] = await this.db.query<{ uid: string; vpbx_user_uid: number; key_uid: string; base_uid: number; payload: z.infer<typeof importSchema> | string }>(
          "SELECT * FROM ac_import_jobs WHERE status = 'pending' ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED", { transaction, type: QueryTypes.SELECT });
        if (!job) return;
        try {
          await this.keys.assertActive(job.key_uid, job.vpbx_user_uid, 'autodial:imports:write', transaction);
          const input = this.parse(importSchema, parseJson(job.payload));
          // Import writes and job result commit together; a crash leaves a pending job, never a half-import.
          const result = await this.importer.importFile(job.vpbx_user_uid, job.base_uid, { ...input,
            buffer: Buffer.from(input.content_base64, 'base64'), profileUid: input.profile_uid, replace: false, transaction });
          await this.db.query("UPDATE ac_import_jobs SET status = 'succeeded', result = :result, payload = :empty, completed_at = :now WHERE uid = :uid",
            { replacements: { uid: job.uid, result: JSON.stringify({ imported: result.imported, skipped: result.skipped, errors: result.errors.map(({ row, code }) => ({ row, code })), run: result.run }),
              empty: '{}', now: autodialSqlDate(new Date(), this.db) }, transaction });
        } catch (error) {
          // Roll back the import's writes before recording a failure in a separate transaction.
          throw Object.assign(new Error('Import job failed'), { jobUid: job.uid, code: (error as { response?: { code?: string } }).response?.code ?? 'AC_IMPORT_FAILED' });
        }
      });
    } catch (error) {
      const failure = error as { jobUid?: string; code?: string };
      if (failure.jobUid) await this.db.query("UPDATE ac_import_jobs SET status = 'failed', error = :error, payload = :empty, completed_at = :now WHERE uid = :uid AND status = 'pending'",
        { replacements: { uid: failure.jobUid, error: String(failure.code ?? 'AC_IMPORT_FAILED').slice(0, 128), empty: '{}', now: autodialSqlDate(new Date(), this.db) } });
      // Missing migrations/temporary connection loss leave durable work pending; no payload goes to logs.
    } finally { this.working = false; }
  }

  async dncBulk(actor: AutodialKeyActor, requestId: unknown, raw: unknown) {
    const input = this.parse(autodialCrmDncSchema, raw);
    return this.command(actor, requestId, ['dnc', input], 'autodial:dnc:write', (transaction) => this.dnc.createBulk(actor.vpbx_user_uid, input, transaction));
  }

  async results(actor: AutodialKeyActor, baseUid: number, externalId: string) {
    if (!externalId || externalId.length > 128) throw new BadRequestException({ code: 'AC_API_INPUT' });
    await this.bases.findOne(actor.vpbx_user_uid, baseUid);
    return this.db.query(`SELECT c.external_id, a.uid AS attempt_uid, a.campaign_uid, a.attempt_no, a.started_at, a.ended_at,
      a.disposition, a.talk_sec, a.scenario_result FROM ac_contacts c JOIN ac_tasks t ON t.contact_uid = c.uid AND t.vpbx_user_uid = c.vpbx_user_uid
      JOIN ac_attempts a ON a.task_uid = t.uid AND a.vpbx_user_uid = c.vpbx_user_uid
      WHERE c.vpbx_user_uid = :tenant AND c.base_uid = :base AND c.external_id = :external ORDER BY a.uid DESC LIMIT 1000`,
      { replacements: { tenant: actor.vpbx_user_uid, base: baseUid, external: externalId }, type: QueryTypes.SELECT });
  }
}
