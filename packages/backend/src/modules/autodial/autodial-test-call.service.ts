import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException, Optional, ServiceUnavailableException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/sequelize';
import { OnEvent } from '@nestjs/event-emitter';
import { Interval } from '@nestjs/schedule';
import { QueryTypes, Transaction } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { AriHttpClientService } from '../ari/ari-http-client.service';
import { DialplanApplyService } from '../ami/dialplan-apply.service';
import { AutodialCampaignsService } from './autodial-campaigns.service';
import { AutodialBasesService } from './autodial-bases.service';
import { AutodialPreflightService } from './autodial-preflight.service';
import { generateAutodialCampaignDialplan } from './autodial-dialplan.util';
import { autodialContactVariables } from './autodial-contact-variables.util';
import { autodialSqlDate } from './autodial-sql-time.util';
import { autodialTestSnapshot, readAutodialTestJson, SAFE_TEST_ACTIONS } from './autodial-test-snapshot.util';
import { AutodialDialplanService } from './autodial-dialplan.service';

const requestSchema = z.strictObject({ contact_uid: z.number().int().positive(), expected_revision: z.number().int().nonnegative(),
  idempotency_key: z.string().regex(/^[A-Za-z0-9_-]{8,80}$/) });
interface TestCall { uid: string; vpbx_user_uid: number; actor_uid: number; campaign_uid: number; contact_uid: number; revision: number; endpoint: string; status: string; created_at: Date; ended_at?: Date | null; deadline_at?: Date | null; snapshot_json?: unknown; result_json?: unknown }

@Injectable()
export class AutodialTestCallService {
  private readonly logger = new Logger(AutodialTestCallService.name);
  private sweeping = false;
  constructor(@InjectConnection() private readonly db: Sequelize,
    private readonly campaigns: AutodialCampaignsService, private readonly bases: AutodialBasesService,
    private readonly preflight: AutodialPreflightService, private readonly ari: AriHttpClientService,
    private readonly writer: DialplanApplyService,
    @Optional() private readonly dialplan?: AutodialDialplanService) {}

  private context(uid: string) { return `krsk-ac-test-${uid.replace(/-/g, '')}`; }
  private file(tenant: number) { return `krasterisk/autodial/ac_test_${tenant}.conf`; }

  async reconcile(userUid: number, actorUid: number, campaignUid: number, key: string) {
    if (typeof key !== 'string' || !/^[A-Za-z0-9_-]{8,80}$/.test(key)) throw new BadRequestException({ code: 'AC_TEST_INPUT' });
    const rows = await this.db.query<{ uid: string }>(`SELECT uid FROM ac_test_calls
      WHERE vpbx_user_uid = :userUid AND actor_uid = :actorUid AND campaign_uid = :campaignUid AND idempotency_key = :key`,
    { replacements: { userUid, actorUid, campaignUid, key }, type: QueryTypes.SELECT });
    // Unknown does not prove rejection: the original admission can still be in flight.
    return rows[0] ? { status: 'admitted' as const, test: await this.status(userUid, actorUid, campaignUid, rows[0].uid) }
      : { status: 'unknown' as const };
  }

  async latest(userUid: number, actorUid: number, campaignUid: number) {
    await this.campaigns.findOne(userUid, campaignUid);
    const rows = await this.db.query<{ uid: string }>(`SELECT uid FROM ac_test_calls
      WHERE vpbx_user_uid = :userUid AND actor_uid = :actorUid AND campaign_uid = :campaignUid
      ORDER BY created_at DESC, uid DESC LIMIT 1`,
    { replacements: { userUid, actorUid, campaignUid }, type: QueryTypes.SELECT });
    return rows[0] ? this.status(userUid, actorUid, campaignUid, rows[0].uid) : null;
  }

  async status(userUid: number, actorUid: number, campaignUid: number, uid: string) {
    if (!/^[a-f0-9-]{36}$/.test(uid)) throw new NotFoundException({ code: 'AC_TEST_NOT_FOUND' });
    const rows = await this.db.query<TestCall>(`SELECT * FROM ac_test_calls
      WHERE uid = :uid AND vpbx_user_uid = :userUid AND actor_uid = :actorUid AND campaign_uid = :campaignUid`,
    { replacements: { uid, userUid, actorUid, campaignUid }, type: QueryTypes.SELECT });
    const row = rows[0];
    if (!row) throw new NotFoundException({ code: 'AC_TEST_NOT_FOUND' });
    return { uid: row.uid, status: row.status, revision: row.revision, contact_uid: row.contact_uid, endpoint: row.endpoint,
      created_at: row.created_at, deadline_at: row.deadline_at ?? null, ended_at: row.ended_at ?? null,
      remaining_sec: ['ended', 'failed', 'expired'].includes(row.status) ? 0
        : row.deadline_at ? Math.max(0, Math.floor((new Date(row.deadline_at).getTime() - Date.now()) / 1000)) : null,
      snapshot: readAutodialTestJson(row.snapshot_json), result: readAutodialTestJson(row.result_json) };
  }

  async call(userUid: number, actorUid: number, campaignUid: number, input: unknown) {
    const parsed = requestSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException({ code: 'AC_TEST_INPUT', message: 'Contact, revision and request key required; destination is selected by the server' });
    if (!Number.isSafeInteger(actorUid) || actorUid <= 0) throw new ForbiddenException({ code: 'AC_TEST_USER_REQUIRED' });
    const data = parsed.data;
    const campaign = await this.campaigns.findOne(userUid, campaignUid);
    if (campaign.revision !== data.expected_revision) throw new ConflictException({ code: 'AC_CAMPAIGN_REVISION_CONFLICT' });
    await this.preflight.validateDraft(userUid, campaign);
    const [base, contact] = await Promise.all([this.bases.findOne(userUid, campaign.base_uid), this.bases.findContact(userUid, campaign.base_uid, data.contact_uid)]);
    const values = Object.fromEntries(base.fields.map((field) => [String(field.uid), contact.values[field.key]]).filter(([, value]) => value !== undefined));
    const variables = autodialContactVariables(base.fields, values, contact.phones[0]?.normalized ?? '', true);
    const snapshot = autodialTestSnapshot(campaign.revision, campaign.scenario_actions, variables, campaign.business_goal ?? 'custom', campaign.user_uid);
    const admitted = await this.db.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED }, async (transaction) => {
      const users = await this.db.query<{ exten: string }>('SELECT exten FROM users WHERE uniqueid = :actorUid AND vpbx_user_uid = :userUid FOR UPDATE',
        { replacements: { userUid, actorUid }, transaction, type: QueryTypes.SELECT });
      const extension = String(users[0]?.exten ?? '');
      if (!/^\d{1,16}$/.test(extension)) throw new ForbiddenException({ code: 'AC_TEST_EXTENSION_REQUIRED', message: 'Configure an internal extension for your own user' });
      const previous = await this.db.query<TestCall>('SELECT * FROM ac_test_calls WHERE vpbx_user_uid = :userUid AND actor_uid = :actorUid AND idempotency_key = :key',
        { replacements: { userUid, actorUid, key: data.idempotency_key }, transaction, type: QueryTypes.SELECT });
      if (previous[0]) {
        if (previous[0].campaign_uid !== campaignUid || previous[0].contact_uid !== data.contact_uid || previous[0].revision !== data.expected_revision) throw new ConflictException({ code: 'AC_TEST_IDEMPOTENCY_CONFLICT' });
        return { row: previous[0], fresh: false };
      }
      const count = await this.db.query<{ count: number }>('SELECT COUNT(*) AS count FROM ac_test_calls WHERE vpbx_user_uid = :userUid AND actor_uid = :actorUid AND created_at >= :since',
        { replacements: { userUid, actorUid, since: autodialSqlDate(new Date(Date.now() - 3600000), this.db) }, transaction, type: QueryTypes.SELECT });
      if (Number(count[0]?.count) >= 5) throw new ConflictException({ code: 'AC_TEST_RATE_LIMIT', message: 'At most five test calls per user per hour' });
      const endpointIds = [`e${extension}_${userUid}`, `ew${extension}_${userUid}`];
      const endpoints = await this.db.query<{ id: string }>('SELECT id FROM ps_endpoints WHERE tenantid = :tenantId AND id IN (:ids)',
        { replacements: { tenantId: String(userUid), ids: endpointIds }, transaction, type: QueryTypes.SELECT });
      const endpoint = endpointIds.find((id) => endpoints.some((row) => row.id === id));
      if (!endpoint) throw new ForbiddenException({ code: 'AC_TEST_EXTENSION_REQUIRED', message: 'Your tenant internal endpoint is unavailable' });
      const row: TestCall = { uid: randomUUID(), vpbx_user_uid: userUid, actor_uid: actorUid, campaign_uid: campaignUid,
        contact_uid: data.contact_uid, revision: campaign.revision, endpoint, status: 'pending', created_at: new Date(),
        deadline_at: new Date(Date.now() + 120000), snapshot_json: snapshot };
      await this.db.query(`INSERT INTO ac_test_calls (uid, vpbx_user_uid, actor_uid, campaign_uid, contact_uid, revision, idempotency_key, endpoint, status, created_at, deadline_at, snapshot_json)
        VALUES (:uid, :userUid, :actorUid, :campaignUid, :contactUid, :revision, :key, :endpoint, 'pending', :now, :deadline, :snapshot)`,
      { replacements: { uid: row.uid, userUid, actorUid, campaignUid, contactUid: data.contact_uid, revision: campaign.revision,
        key: data.idempotency_key, endpoint, now: autodialSqlDate(row.created_at, this.db), deadline: autodialSqlDate(row.deadline_at!, this.db), snapshot: JSON.stringify(snapshot) }, transaction, type: QueryTypes.INSERT });
      return { row, fresh: true };
    });
    const skipped = (readAutodialTestJson(admitted.row.snapshot_json)?.skipped_steps as string[] | undefined) ?? snapshot.skipped_steps;
    if (!admitted.fresh) {
      if (['failed', 'expired'].includes(admitted.row.status)) throw new ServiceUnavailableException({ code: 'AC_TEST_FAILED', message: 'This test request has already failed; open a new test to try again' });
      return { uid: admitted.row.uid, status: admitted.row.status, endpoint: admitted.row.endpoint, skipped_steps: skipped };
    }
    const context = this.context(admitted.row.uid);
    const category = generateAutodialCampaignDialplan({ ...campaign, amd: { enabled: false, on_machine: 'continue' },
      scenario_actions: campaign.scenario_actions.map((action) => SAFE_TEST_ACTIONS.has(action.type) ? action : { ...action, type: 'hangup' as const, params: {} }),
    }, userUid);
    category.name = context;
    category.lines = category.lines.filter((line) => !line.includes('hangup_handler_push')).map((line) => line.startsWith('[') ? `[${context}]` : line);
    try {
      await this.dialplan?.prepareScenarioMedia(userUid, campaign.scenario_actions);
      const applied = await this.writer.applyCategories(this.file(userUid), [category]);
      if (!applied.success) throw new Error('Test scenario apply failed');
      if (Date.now() >= new Date(admitted.row.deadline_at!).getTime()) throw new Error('Test admission expired');
      await this.ari.originateChannel({ endpoint: `PJSIP/${admitted.row.endpoint}`, app: this.ari.getAutodialAppName(),
        appArgs: 'autodial-test', channelId: `actest-${admitted.row.uid}`, callerId: 'Autodial test', timeout: 30,
        variables: { ...variables, __KRSK_AC_TEST_UID: admitted.row.uid } });
      return { uid: admitted.row.uid, status: 'dialled', endpoint: admitted.row.endpoint, skipped_steps: skipped };
    } catch {
      await this.finish(admitted.row, 'failed');
      throw new ServiceUnavailableException({ code: 'AC_TEST_FAILED', message: 'Internal test call could not be placed; campaign contacts were not dialled' });
    }
  }

  @OnEvent('ari.StasisStart')
  async onAnswer(event: { channel?: { id?: string; state?: string } }) {
    const id = event.channel?.id;
    if (!id?.startsWith('actest-') || event.channel?.state !== 'Up') return;
    const row = await this.find(id.slice(7));
    if (!row || row.status !== 'pending') return;
    const [, count] = await this.db.query("UPDATE ac_test_calls SET status = 'answered', result_json = :result WHERE uid = :uid AND status = 'pending'", { replacements: { uid: row.uid, result: JSON.stringify({ answered_at: new Date().toISOString(), delivery: 'not_observed' }) }, type: QueryTypes.UPDATE });
    if (!count) return;
    try {
      const remaining = Math.floor((new Date(row.deadline_at ?? new Date(row.created_at).getTime() + 120000).getTime() - Date.now()) / 1000);
      if (remaining <= 0) { await this.ari.hangupChannel(id).catch(() => undefined); await this.finish(row, 'expired'); return; }
      await this.ari.setChannelVar(id, 'TIMEOUT(absolute)', String(remaining));
      await this.ari.continueInDialplan(id, this.context(row.uid), 's', 1);
    }
    catch { await this.ari.hangupChannel(id).catch(() => undefined); await this.finish(row, 'failed'); }
  }

  @OnEvent('ari.ChannelDestroyed')
  async onEnd(event: { channel?: { id?: string }; cause?: number; cause_txt?: string }) {
    const id = event.channel?.id;
    if (!id?.startsWith('actest-')) return;
    const row = await this.find(id.slice(7));
    if (row) await this.finish(row, 'ended', { cause: event.cause ?? null, reason: event.cause_txt ?? null });
  }

  private async find(uid: string) {
    if (!/^[a-f0-9-]{36}$/.test(uid)) return null;
    return (await this.db.query<TestCall>('SELECT * FROM ac_test_calls WHERE uid = :uid', { replacements: { uid }, type: QueryTypes.SELECT }))[0] ?? null;
  }
  private async finish(row: TestCall, status: string, termination?: Record<string, unknown>) {
    await this.db.transaction(async (transaction) => {
      const rows = await this.db.query<TestCall>('SELECT * FROM ac_test_calls WHERE uid = :uid FOR UPDATE',
        { replacements: { uid: row.uid }, transaction, type: QueryTypes.SELECT });
      const current = rows[0];
      if (!current || ['ended', 'failed', 'expired'].includes(current.status)) return;
      const existing = readAutodialTestJson(current.result_json);
      const result = { ...existing, ended_at: new Date().toISOString(),
        answered: current.status === 'answered', delivery: existing?.delivery ?? 'not_observed', ...(termination ? { termination } : {}) };
      await this.db.query('UPDATE ac_test_calls SET status = :status, ended_at = :now, result_json = :result WHERE uid = :uid',
        { replacements: { uid: row.uid, status, now: autodialSqlDate(new Date(), this.db), result: JSON.stringify(result) }, transaction, type: QueryTypes.UPDATE });
    });
    try {
      await this.writer.deleteCategories(this.file(row.vpbx_user_uid), [this.context(row.uid)]);
      await this.db.query('UPDATE ac_test_calls SET cleanup_done = :done WHERE uid = :uid', { replacements: { uid: row.uid, done: true }, type: QueryTypes.UPDATE });
    } catch { this.logger.warn(`Test context cleanup deferred: ${row.uid}`); }
  }

  @Interval(10000)
  async sweep() {
    if (this.sweeping) return; this.sweeping = true;
    try {
      const rows = await this.db.query<TestCall>(`SELECT * FROM ac_test_calls WHERE cleanup_done = :no
        AND (status IN ('ended', 'failed', 'expired') OR deadline_at <= :now OR (deadline_at IS NULL AND created_at < :cutoff)) ORDER BY created_at LIMIT 50`,
      { replacements: { no: false, now: autodialSqlDate(new Date(), this.db), cutoff: autodialSqlDate(new Date(Date.now() - 120000), this.db) }, type: QueryTypes.SELECT });
      for (const row of rows) {
        await this.ari.hangupChannel(`actest-${row.uid}`).catch(() => undefined);
        await this.finish(row, ['ended', 'failed'].includes(row.status) ? row.status : 'expired');
      }
    } finally { this.sweeping = false; }
  }
}
