import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
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

const requestSchema = z.strictObject({ contact_uid: z.number().int().positive(), expected_revision: z.number().int().nonnegative(),
  idempotency_key: z.string().regex(/^[A-Za-z0-9_-]{8,80}$/) });
interface TestCall { uid: string; vpbx_user_uid: number; actor_uid: number; campaign_uid: number; contact_uid: number; revision: number; endpoint: string; status: string; created_at: Date }
const SAFE_TEST_ACTIONS = new Set(['playback', 'text2speech', 'collect_input', 'label', 'goto', 'hangup']);

@Injectable()
export class AutodialTestCallService {
  private readonly logger = new Logger(AutodialTestCallService.name);
  private sweeping = false;
  constructor(@InjectConnection() private readonly db: Sequelize,
    private readonly campaigns: AutodialCampaignsService, private readonly bases: AutodialBasesService,
    private readonly preflight: AutodialPreflightService, private readonly ari: AriHttpClientService,
    private readonly writer: DialplanApplyService) {}

  private context(uid: string) { return `krsk-ac-test-${uid.replace(/-/g, '')}`; }
  private file(tenant: number) { return `krasterisk/autodial/ac_test_${tenant}.conf`; }

  async call(userUid: number, actorUid: number, campaignUid: number, input: unknown) {
    const parsed = requestSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException({ code: 'AC_TEST_INPUT', message: 'Contact, revision and request key required; destination is selected by the server' });
    if (!Number.isSafeInteger(actorUid) || actorUid <= 0) throw new ForbiddenException({ code: 'AC_TEST_USER_REQUIRED' });
    const data = parsed.data;
    const campaign = await this.campaigns.findOne(userUid, campaignUid);
    if (campaign.revision !== data.expected_revision) throw new ConflictException({ code: 'AC_CAMPAIGN_REVISION_CONFLICT' });
    await this.preflight.validateDraft(userUid, campaign);
    const [base, contact] = await Promise.all([this.bases.findOne(userUid, campaign.base_uid), this.bases.findContact(userUid, campaign.base_uid, data.contact_uid)]);
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
        contact_uid: data.contact_uid, revision: campaign.revision, endpoint, status: 'pending', created_at: new Date() };
      await this.db.query(`INSERT INTO ac_test_calls (uid, vpbx_user_uid, actor_uid, campaign_uid, contact_uid, revision, idempotency_key, endpoint, status, created_at)
        VALUES (:uid, :userUid, :actorUid, :campaignUid, :contactUid, :revision, :key, :endpoint, 'pending', :now)`,
      { replacements: { uid: row.uid, userUid, actorUid, campaignUid, contactUid: data.contact_uid, revision: campaign.revision,
        key: data.idempotency_key, endpoint, now: autodialSqlDate(row.created_at, this.db) }, transaction, type: QueryTypes.INSERT });
      return { row, fresh: true };
    });
    const skipped = campaign.scenario_actions.filter((action) => action.enabled !== false && !SAFE_TEST_ACTIONS.has(action.type)).map((action) => action.type);
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
    const values = Object.fromEntries(base.fields.map((field) => [String(field.uid), contact.values[field.key]]).filter(([, value]) => value !== undefined));
    const variables = autodialContactVariables(base.fields, values, contact.phones[0]?.normalized ?? '', true);
    try {
      const applied = await this.writer.applyCategories(this.file(userUid), [category]);
      if (!applied.success) throw new Error('Test scenario apply failed');
      await this.ari.originateChannel({ endpoint: `PJSIP/${admitted.row.endpoint}`, app: this.ari.getAutodialAppName(),
        appArgs: 'autodial-test', channelId: `actest-${admitted.row.uid}`, callerId: 'Autodial test', timeout: 30, variables });
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
    const [, count] = await this.db.query("UPDATE ac_test_calls SET status = 'answered' WHERE uid = :uid AND status = 'pending'", { replacements: { uid: row.uid }, type: QueryTypes.UPDATE });
    if (!count) return;
    try { await this.ari.continueInDialplan(id, this.context(row.uid), 's', 1); }
    catch { await this.ari.hangupChannel(id).catch(() => undefined); await this.finish(row, 'failed'); }
  }

  @OnEvent('ari.ChannelDestroyed')
  async onEnd(event: { channel?: { id?: string } }) {
    const id = event.channel?.id;
    if (!id?.startsWith('actest-')) return;
    const row = await this.find(id.slice(7));
    if (row) await this.finish(row, 'ended');
  }

  private async find(uid: string) {
    if (!/^[a-f0-9-]{36}$/.test(uid)) return null;
    return (await this.db.query<TestCall>('SELECT * FROM ac_test_calls WHERE uid = :uid', { replacements: { uid }, type: QueryTypes.SELECT }))[0] ?? null;
  }
  private async finish(row: TestCall, status: string) {
    await this.db.query('UPDATE ac_test_calls SET status = :status, ended_at = :now WHERE uid = :uid',
      { replacements: { uid: row.uid, status, now: autodialSqlDate(new Date(), this.db) }, type: QueryTypes.UPDATE });
    try {
      await this.writer.deleteCategories(this.file(row.vpbx_user_uid), [this.context(row.uid)]);
      await this.db.query('UPDATE ac_test_calls SET cleanup_done = :done WHERE uid = :uid', { replacements: { uid: row.uid, done: true }, type: QueryTypes.UPDATE });
    } catch { this.logger.warn(`Test context cleanup deferred: ${row.uid}`); }
  }

  @Interval(60000)
  async sweep() {
    if (this.sweeping) return; this.sweeping = true;
    try {
      const rows = await this.db.query<TestCall>(`SELECT * FROM ac_test_calls WHERE cleanup_done = :no
        AND (status IN ('ended', 'failed', 'expired') OR created_at < :cutoff) ORDER BY created_at LIMIT 50`,
      { replacements: { no: false, cutoff: autodialSqlDate(new Date(Date.now() - 120000), this.db) }, type: QueryTypes.SELECT });
      for (const row of rows) {
        await this.ari.hangupChannel(`actest-${row.uid}`).catch(() => undefined);
        await this.finish(row, ['ended', 'failed'].includes(row.status) ? row.status : 'expired');
      }
    } finally { this.sweeping = false; }
  }
}
