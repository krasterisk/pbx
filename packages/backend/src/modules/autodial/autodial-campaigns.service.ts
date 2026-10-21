import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { Op, QueryTypes, Transaction } from "sequelize";
import type { Sequelize } from "sequelize-typescript";
import { InjectConnection } from "@nestjs/sequelize";
import { randomUUID } from 'node:crypto';
import { autodialSqlDate } from './autodial-sql-time.util';
import { parseTourDispositions, previewAutodialTour } from './autodial-tour-preview';
import { campaignWindowOpen } from './autodial-schedule.util';
import type { IAutodialBaseField } from '@krasterisk/shared';
import {
  AUTODIAL_TERMINAL_DISPOSITIONS,
  AUTODIAL_SCHEDULE_KINDS,
  AUTODIAL_SUPPORTED_ACTIONS as SUPPORTED_ACTION_TYPES,
  autodialScenarioActionSchema,
  autodialOutcomeDefinitionError,
  autodialTaskActionSchema,
  type AutodialCallerIdSource,
  type AutodialCampaignStatus,
  type AutodialDisposition,
  type IAutodialTrunkPoolItem,
  type IAutodialCampaign,
  type IAutodialCampaignContactsPage,
  type IAutodialCampaignContact,
  type IAutodialSchedule,
  type IRouteAction,
} from "@krasterisk/shared";
import { AcCampaign } from "./models/ac-campaign.model";
import { AcSchedule } from "./models/ac-schedule.model";
import { AcTask } from "./models/ac-task.model";
import { AcAttempt } from "./models/ac-attempt.model";
import { autodialExtensionTarget, autodialQueueTarget } from './autodial-target.util';
import { AcContactPhone } from "./models/ac-contact-phone.model";
import { AcDnc } from "./models/ac-dnc.model";
import { PsEndpoint } from "../endpoints/ps-endpoint.model";
import { Queue } from "../queues/queue.model";
import { AutodialBasesService } from "./autodial-bases.service";
import { DirectoriesService } from "../directories/directories.service";
import { AutodialDialplanService } from "./autodial-dialplan.service";
import {
  CreateAutodialCampaignDto,
  StartAutodialCampaignDto,
  UpdateAutodialCampaignDto,
} from "./dto/autodial-campaign.dto";
import {
  defaultAutodialAmd,
  defaultAutodialCidPolicy,
  defaultAutodialTrunkPool,
  normalizeAutodialPacing,
  normalizeAutodialRetry,
  queueNamesFromPacing,
} from "./autodial-campaign.defaults";

/** Statuses from which the pacer may pick tasks. */
export const AUTODIAL_ACTIVE_STATUSES: AutodialCampaignStatus[] = ["running"];

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const AUTODIAL_SUPPORTED_ACTIONS = new Set<string>(SUPPORTED_ACTION_TYPES);

function isSupportedTimeZone(timeZone: string): boolean {
  try {
    Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

@Injectable()
export class AutodialCampaignsService {
  private readonly logger = new Logger(AutodialCampaignsService.name);

  constructor(
    @InjectModel(AcCampaign) private readonly campaignModel: typeof AcCampaign,
    @InjectModel(AcSchedule) private readonly scheduleModel: typeof AcSchedule,
    @InjectModel(AcTask) private readonly taskModel: typeof AcTask,
    @InjectModel(AcAttempt) private readonly attemptModel: typeof AcAttempt,
    @InjectModel(AcContactPhone)
    private readonly phoneModel: typeof AcContactPhone,
    @InjectModel(AcDnc) private readonly dncModel: typeof AcDnc,
    @InjectModel(PsEndpoint) private readonly endpointModel: typeof PsEndpoint,
    @InjectModel(Queue) private readonly queueModel: typeof Queue,
    @InjectConnection() private readonly sequelize: Sequelize,
    private readonly basesService: AutodialBasesService,
    private readonly directoriesService: DirectoriesService,
    private readonly dialplanService: AutodialDialplanService,
  ) {}

  async changeContactTask(userUid: number, campaignUid: number, contactUid: number, input: unknown, actorUid?: number) {
    const parsed = autodialTaskActionSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException({ code: 'AC_TASK_ACTION_INVALID', message: 'Choose exclude or a future retry time' });
    const data = parsed.data;
    if (data.action === 'reschedule' && (!data.next_attempt_at || Date.parse(data.next_attempt_at) <= Date.now()
      || Date.parse(data.next_attempt_at) > Date.now() + 366 * 86400000)) {
      throw new BadRequestException({ code: 'AC_TASK_TIME_INVALID', message: 'Choose a future time within one year' });
    }
    return this.sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED }, async (transaction) => {
      const campaign = await this.getOrThrow(userUid, campaignUid, transaction);
      await this.basesService.findContact(userUid, campaign.base_uid, contactUid);
      const tasks = await this.taskModel.findAll({ where: { campaign_uid: campaignUid, user_uid: userUid, contact_uid: contactUid,
        ...(data.phone_uid ? { phone_uid: data.phone_uid } : {}) }, transaction, lock: transaction.LOCK.UPDATE });
      if (!tasks.length) throw new NotFoundException({ code: 'AC_TASK_NOT_FOUND', message: 'No campaign tasks for this contact' });
      if (tasks.some((t) => t.status === 'leased' || t.status === 'dialing')) throw new ConflictException({ code: 'AC_CAMPAIGN_ACTIVE_CALLS', message: 'Wait for this contact call to finish' });
      if (data.action === 'reschedule' && tasks.some((t) => t.status !== 'pending')) throw new ConflictException({ code: 'AC_TASK_NOT_PENDING', message: 'Only pending tasks can be rescheduled; select a new tour for finished tasks' });
      for (const task of tasks) await task.update(data.action === 'exclude'
        ? { status: 'cancelled', last_disposition: 'excluded', next_attempt_at: null, leased_by: null, leased_at: null }
        : { next_attempt_at: new Date(data.next_attempt_at!), last_disposition: 'callback_scheduled' }, { transaction });
      await this.recordEvent(campaign, data.action === 'exclude' ? 'contact_excluded' : 'retry_rescheduled',
        { contact_uid: contactUid, phone_uid: data.phone_uid, next_attempt_at: data.next_attempt_at, actor_uid: actorUid ?? null }, transaction);
      return { updated: tasks.length };
    });
  }

  async journal(userUid: number, uid: number, before?: number) {
    await this.getOrThrow(userUid, uid);
    return this.sequelize.query<{ uid: number; event_type: string; tour_no: number; revision: number; payload: unknown; created_at: Date }>(
      `SELECT uid, event_type, tour_no, revision, payload, created_at FROM ac_campaign_events
       WHERE vpbx_user_uid = :userUid AND campaign_uid = :uid AND (:before IS NULL OR uid < :before)
       ORDER BY uid DESC LIMIT 100`,
      { replacements: { userUid, uid, before: Number.isSafeInteger(before) && before! > 0 ? before : null }, type: QueryTypes.SELECT });
  }

  private async recordEvent(row: AcCampaign, eventType: string, payload: Record<string, unknown> = {}, transaction?: Transaction) {
    await this.sequelize.query(`INSERT INTO ac_campaign_events
      (vpbx_user_uid, campaign_uid, event_type, tour_no, revision, payload, created_at)
      VALUES (:userUid, :uid, :eventType, :tourNo, :revision, :payload, :now)`, {
      replacements: { userUid: row.user_uid, uid: row.uid, eventType, tourNo: row.tour_no ?? 0,
        revision: row.revision ?? 0, payload: JSON.stringify(payload), now: autodialSqlDate(new Date(), this.sequelize) }, transaction, type: QueryTypes.INSERT,
    });
  }

  async listContacts(userUid: number, uid: number, opts: {
    page?: number; pageSize?: number; q?: string; disposition?: string;
  } = {}): Promise<IAutodialCampaignContactsPage> {
    const campaign = await this.getOrThrow(userUid, uid);
    const page = Number.isSafeInteger(opts.page) ? Math.max(1, opts.page!) : 1;
    const pageSize = Number.isSafeInteger(opts.pageSize) ? Math.min(200, Math.max(1, opts.pageSize!)) : 25;
    const replacements = { userUid, uid, baseUid: campaign.base_uid,
      q: `%${(opts.q ?? '').trim()}%`, disposition: opts.disposition ?? '',
      limit: pageSize, offset: (page - 1) * pageSize };
    const where = `c.vpbx_user_uid = :userUid AND c.base_uid = :baseUid
      AND (c.external_id LIKE :q OR c.comment LIKE :q
        OR CAST(c.${this.sequelize.getDialect() === 'postgres' ? '"values"' : '`values`'} AS ${this.sequelize.getDialect() === 'postgres' ? 'TEXT' : 'CHAR'}) LIKE :q OR EXISTS
        (SELECT 1 FROM ac_contact_phones p WHERE p.contact_uid = c.uid
          AND (p.normalized LIKE :q OR p.raw LIKE :q)))
      AND (:disposition = '' OR EXISTS (SELECT 1 FROM ac_tasks t
        WHERE t.contact_uid = c.uid AND t.campaign_uid = :uid
          AND t.vpbx_user_uid = :userUid AND t.last_disposition = :disposition))`;
    const counts = await this.sequelize.query<{ total: number }>(
      `SELECT COUNT(*) AS total FROM ac_contacts c WHERE ${where}`,
      { replacements, type: QueryTypes.SELECT });
    const ids = await this.sequelize.query<{ uid: number }>(
      `SELECT c.uid FROM ac_contacts c WHERE ${where} ORDER BY c.uid DESC LIMIT :limit OFFSET :offset`,
      { replacements, type: QueryTypes.SELECT });
    if (!ids.length) return { items: [], total: Number(counts[0]?.total ?? 0), page, page_size: pageSize };
    const contactIds = ids.map((r) => Number(r.uid));
    const tasks = await this.taskModel.findAll({ where: {
      user_uid: userUid, campaign_uid: uid, contact_uid: { [Op.in]: contactIds },
    }, order: [['uid', 'ASC']] });
    const blocked = await this.sequelize.query<{ phone_uid: number }>(
      `SELECT p.uid AS phone_uid FROM ac_contact_phones p
       JOIN ac_contacts c ON c.uid = p.contact_uid AND c.vpbx_user_uid = :userUid AND c.base_uid = :baseUid
       WHERE p.contact_uid IN (:contactIds) AND EXISTS (SELECT 1 FROM ac_dnc d
         WHERE d.vpbx_user_uid = :userUid AND d.normalized_phone = p.canonical_phone
           AND (d.expires_at IS NULL OR d.expires_at > :now)
           AND (d.scope = 'global' OR (d.scope = 'campaign' AND d.scope_uid = :uid)
             OR (d.scope = 'base' AND d.scope_uid = :baseUid)))`,
      { replacements: { ...replacements, contactIds, now: autodialSqlDate(new Date(), this.sequelize) }, type: QueryTypes.SELECT });
    const blockedPhones = new Set(blocked.map((r) => Number(r.phone_uid)));
    const contacts = await this.basesService.findContacts(userUid, campaign.base_uid, contactIds);
    const items: IAutodialCampaignContact[] = contacts.sort((a, b) => b.uid - a.uid).map((contact) => ({
      ...contact,
      blocked_phone_uids: (contact.phones ?? []).filter((p) => blockedPhones.has(p.uid)).map((p) => p.uid),
      tasks: tasks.filter((t) => t.contact_uid === contact.uid).map((t) => ({
        uid: t.uid, phone_uid: t.phone_uid, status: t.status, attempt_count: t.attempt_count,
        last_disposition: t.last_disposition, last_cause: t.last_cause,
        next_attempt_at: t.next_attempt_at?.toISOString() ?? null, dnc: blockedPhones.has(t.phone_uid),
      })),
    }));
    return { items, total: Number(counts[0]?.total ?? 0), page, page_size: pageSize };
  }

  async findAll(userUid: number): Promise<IAutodialCampaign[]> {
    const rows = await this.campaignModel.findAll({
      where: { user_uid: userUid },
      order: [["uid", "DESC"]],
    });
    const counters = await this.taskCounters(
      userUid,
      rows.map((r) => r.uid),
    );
    const schedules = await this.schedulesFor(rows.map((r) => r.uid));
    return rows.map((r) =>
      this.toDto(r, schedules.get(r.uid) ?? [], counters.get(r.uid)),
    );
  }

  async findOne(userUid: number, uid: number): Promise<IAutodialCampaign & { schedules: IAutodialSchedule[] }> {
    const row = await this.getOrThrow(userUid, uid);
    const counters = await this.taskCounters(userUid, [uid]);
    const schedules = await this.schedulesFor([uid]);
    return this.toDto(row, schedules.get(uid) ?? [], counters.get(uid));
  }

  /** Read-only validation shared by preflight, UI and AI proposal/revalidation. */
  async validateConfiguration(userUid: number, input: {
    base_uid: number; dial_mode?: string; scenario_actions?: unknown[];
    trunk_pool?: unknown[]; pacing?: Parameters<typeof normalizeAutodialPacing>[0]; schedules?: CreateAutodialCampaignDto['schedules'];
  }, plannedBase?: { fields: IAutodialBaseField[] }): Promise<void> {
    assertAutodialSchedules(input.schedules ?? []);
    const base = plannedBase ?? await this.basesService.findOne(userUid, input.base_uid);
    const pacing = normalizeAutodialPacing(input.pacing);
    this.assertScenario(input.dial_mode ?? 'progressive', input.scenario_actions);
    await this.assertQueueReferences(userUid, queueNamesFromPacing(pacing), input.scenario_actions);
    await this.assertExtensionReferences(userUid, input.scenario_actions);
    await this.assertTrunkPoolConfig(userUid, base.fields ?? [], toAutodialTrunkPool(input.trunk_pool ?? []));
  }

  async create(
    userUid: number,
    dto: CreateAutodialCampaignDto,
    actorUid?: number,
    audit?: { source: 'ai_assistant'; threadUid?: number },
  ): Promise<IAutodialCampaign> {
    const row = await this.sequelize.transaction((transaction) => this.createInTransaction(userUid, dto, transaction, actorUid, audit));
    await this.applyAndRecord(row, row.revision);
    return this.findOne(userUid, row.uid);
  }

  async completeCreation(userUid: number, uid: number): Promise<IAutodialCampaign> {
    const row = await this.getOrThrow(userUid, uid);
    if (row.status === 'draft' && row.applied_revision !== row.revision) await this.applyAndRecord(row, row.revision);
    return this.findOne(userUid, uid);
  }

  async createInTransaction(userUid: number, dto: CreateAutodialCampaignDto, transaction: Transaction, actorUid?: number,
    audit?: { source: 'ai_assistant'; threadUid?: number }): Promise<AcCampaign> {
    const trunkPool = toAutodialTrunkPool(dto.trunk_pool ?? []);
    const base = await this.basesService.findOne(userUid, dto.base_uid);
    await this.assertTrunkPoolConfig(userUid, base.fields ?? [], trunkPool);
    const pacing = normalizeAutodialPacing(dto.pacing);
    const queueNames = queueNamesFromPacing(pacing);
    this.assertScenario(
      dto.dial_mode ?? "progressive",
      dto.scenario_actions,
    );
    await this.assertQueueReferences(userUid, queueNames, dto.scenario_actions);
    await this.assertExtensionReferences(userUid, dto.scenario_actions);

      const created = await this.campaignModel.create(
        {
          user_uid: userUid,
          name: dto.name.trim(),
          business_goal: dto.business_goal ?? 'custom',
          status: "draft",
          dial_mode: dto.dial_mode ?? "progressive",
          base_uid: dto.base_uid,
          pacing,
          retry: normalizeAutodialRetry(dto.retry),
          trunk_pool: dto.trunk_pool == null ? defaultAutodialTrunkPool() : trunkPool,
          cid_policy: dto.cid_policy ?? defaultAutodialCidPolicy(),
          queue_names: queueNames,
          scenario_actions: normalizeAutodialScenario(dto.scenario_actions ?? []),
          amd: dto.amd ?? defaultAutodialAmd(),
          success_min_sec: dto.success_min_sec ?? 15,
          dial_timeout_sec: dto.dial_timeout_sec ?? 45,
          revision: 1,
        },
        { transaction },
      );
      if (dto.schedules !== undefined) {
        await this.replaceSchedules(
          userUid,
          created.uid,
          dto.schedules,
          transaction,
        );
      }
      await this.recordEvent(created, 'created', { actor_uid: actorUid ?? null, ...(audit ? { actor_source: audit.source, thread_uid: audit.threadUid ?? null } : {}) }, transaction);
      return created;
  }

  async update(
    userUid: number,
    uid: number,
    dto: UpdateAutodialCampaignDto,
    actorUid?: number,
    audit?: { source: 'ai_assistant'; threadUid?: number },
  ): Promise<IAutodialCampaign> {
    const trunkPool = dto.trunk_pool == null ? undefined : toAutodialTrunkPool(dto.trunk_pool);
    const { row, revision } = await this.sequelize.transaction(async (transaction) => {
      const locked = await this.getOrThrow(userUid, uid, transaction);
      if (dto.expected_revision !== locked.revision) {
        throw new ConflictException({
          code: "AC_CAMPAIGN_REVISION_CONFLICT",
          message: "Campaign changed. Reload before saving.",
        });
      }
      if (dto.base_uid != null && dto.base_uid !== locked.base_uid) {
        await this.basesService.findOne(userUid, dto.base_uid);
        if (locked.status === "running" || locked.status === 'paused') {
          throw new BadRequestException({
            code: "AC_CAMPAIGN_RUNNING",
            message: "Cannot switch base while the campaign is running",
          });
        }
      }
      if (dto.dial_mode != null && dto.dial_mode !== locked.dial_mode
        && (locked.status === 'running' || locked.status === 'paused')) {
        throw new BadRequestException({ code: 'AC_CAMPAIGN_RUNNING', message: 'Stop the campaign before switching dial mode' });
      }
      const pacing = dto.pacing != null
        ? normalizeAutodialPacing(dto.pacing)
        : locked.pacing;
      const queueNames = dto.pacing != null
        ? queueNamesFromPacing(pacing)
        : (locked.queue_names ?? queueNamesFromPacing(pacing));
      this.assertScenario(
        dto.dial_mode ?? locked.dial_mode,
        dto.scenario_actions ?? locked.scenario_actions,
      );
      await this.assertQueueReferences(
        userUid,
        queueNames,
        dto.scenario_actions ?? locked.scenario_actions,
      );
      await this.assertExtensionReferences(userUid, dto.scenario_actions ?? locked.scenario_actions);
      if (trunkPool != null) {
        const base = await this.basesService.findOne(userUid, dto.base_uid ?? locked.base_uid);
        await this.assertTrunkPoolConfig(userUid, base.fields ?? [], trunkPool);
      }

      const nextRevision = locked.revision + 1;
      const patch: Partial<AcCampaign> = { revision: nextRevision };
      if (dto.business_goal !== undefined) patch.business_goal = dto.business_goal;
      if (dto.name != null) patch.name = dto.name.trim();
      if (dto.dial_mode != null) patch.dial_mode = dto.dial_mode;
      if (dto.base_uid != null) patch.base_uid = dto.base_uid;
      if (dto.pacing != null) {
        patch.pacing = pacing;
        // Snapshot stays aligned with the capacity provider when pacing changes.
        patch.queue_names = queueNames;
      }
      if (dto.retry != null) patch.retry = normalizeAutodialRetry(dto.retry);
      if (trunkPool != null) patch.trunk_pool = trunkPool;
      if (dto.cid_policy != null) patch.cid_policy = dto.cid_policy;
      if (dto.scenario_actions != null) {
        patch.scenario_actions = normalizeAutodialScenario(dto.scenario_actions);
      }
      if (dto.amd != null) patch.amd = dto.amd;
      if (dto.success_min_sec != null)
        patch.success_min_sec = dto.success_min_sec;
      if (dto.dial_timeout_sec != null)
        patch.dial_timeout_sec = dto.dial_timeout_sec;

      await locked.update(patch, { transaction });
      if (dto.schedules !== undefined) {
        await this.replaceSchedules(userUid, uid, dto.schedules, transaction);
      }
      await this.recordEvent(locked, 'configuration_updated', { fields: Object.keys(dto).filter((key) => key !== 'expected_revision'), actor_uid: actorUid ?? null,
        ...(audit ? { actor_source: audit.source, thread_uid: audit.threadUid ?? null } : {}) }, transaction);
      return { row: locked, revision: nextRevision };
    });
    await this.applyAndRecord(row, revision);
    return this.findOne(userUid, uid);
  }

  async remove(userUid: number, uid: number): Promise<void> {
    const row = await this.getOrThrow(userUid, uid);
    if (row.status === "running") {
      throw new BadRequestException({
        code: "AC_CAMPAIGN_RUNNING",
        message: "Stop the campaign before deleting it",
      });
    }
    const activeTasks = await this.taskModel.count({
      where: {
        campaign_uid: uid,
        user_uid: userUid,
        status: { [Op.in]: ["leased", "dialing"] },
      },
    });
    if (activeTasks) {
      throw new BadRequestException({
        code: "AC_CAMPAIGN_ACTIVE_CALLS",
        message: "Wait for active campaign calls to finish before deleting it",
      });
    }
    await this.dialplanService.removeCampaign(row);
    // ac_attempts.campaign_uid has no FK. Delete history with the campaign so
    // reports never keep rows pointing at a missing campaign (orphan policy).
    await this.attemptModel.destroy({
      where: { campaign_uid: uid, user_uid: userUid },
    });
    await this.taskModel.destroy({
      where: { campaign_uid: uid, user_uid: userUid },
    });
    await this.scheduleModel.destroy({ where: { campaign_uid: uid } });
    await row.destroy();
  }

  // ── lifecycle ─────────────────────────────────────────────────────

  async previewTour(userUid: number, uid: number, rawSelection?: unknown) {
    const dispositions = parseTourDispositions(rawSelection);
    const row = await this.getOrThrow(userUid, uid);
    const base = await this.basesService.findOne(userUid, row.base_uid);
    return previewAutodialTour(this.sequelize, { userUid, campaignUid: row.uid, baseUid: row.base_uid,
      campaignRevision: row.revision, baseRevision: base.revision, tourNo: row.tour_no ?? 0,
      status: row.status, dispositions });
  }

  /**
   * Generate tasks and switch to running. `include_dispositions` re-selects
   * contacts whose previous attempts ended in the given dispositions (D-19);
   * omitting it dials every contact that has no task yet.
   */
  async start(
    userUid: number,
    uid: number,
    dto: StartAutodialCampaignDto = {},
    actorUid?: number,
  ): Promise<{ campaign: IAutodialCampaign; tasks_created: number }> {
    const row = await this.getOrThrow(userUid, uid);
    if (dto.expected_revision !== undefined && dto.expected_revision !== row.revision) {
      throw new ConflictException({ code: 'AC_CAMPAIGN_REVISION_CONFLICT', message: 'Review the current campaign before starting' });
    }
      if (row.status === 'running' || row.status === 'paused' || row.status === 'scheduled') {
      throw new ConflictException({ code: 'AC_CAMPAIGN_ACTIVE', message: 'Use resume for a paused tour' });
    }
    if (dto.expected_base_revision !== undefined) {
      const base = await this.basesService.findOne(userUid, row.base_uid);
      if (base.revision !== dto.expected_base_revision) {
        throw new ConflictException({ code: 'AC_REVISION_CONFLICT', message: 'Review the current customer base before starting' });
      }
    }
    if (!row.trunk_pool?.length) {
      throw new BadRequestException({
        code: "AC_NO_TRUNK",
        message: "Configure at least one trunk before starting",
      });
    }
    this.assertScenario(row.dial_mode, row.scenario_actions);
    await this.assertQueueReferences(userUid, row.queue_names, row.scenario_actions);
    await this.assertExtensionReferences(userUid, row.scenario_actions);
    await this.assertStoredTrunkPoolConfig(userUid, row.base_uid, row.trunk_pool);
    await this.dialplanService.assertAmdReady(row);
    // Re-apply so a dialplan lost to a failed apply or an Asterisk reinstall
    // is present before the first channel lands in the context.
    if (!(await this.applyAndRecord(row, row.revision))) {
      throw new ServiceUnavailableException({
        code: "AC_DIALPLAN_APPLY_FAILED",
        message:
          "Campaign dialplan could not be applied. No calls were started.",
      });
    }

    const created = await this.sequelize.transaction(async (transaction) => {
      const locked = await this.getOrThrow(userUid, uid, transaction);
      if (locked.revision !== row.revision) throw new ConflictException({ code: 'AC_CAMPAIGN_REVISION_CONFLICT', message: 'Configuration changed while preparing the tour' });
      if (locked.status === 'running' || locked.status === 'paused' || locked.status === 'scheduled') {
        throw new ConflictException({ code: 'AC_CAMPAIGN_ACTIVE', message: 'Pause/resume an active tour instead of starting another' });
      }
      if (await this.attemptModel.count({ where: { campaign_uid: uid, user_uid: userUid, disposition: 'dialing' }, transaction })) {
        throw new ConflictException({ code: 'AC_CAMPAIGN_ACTIVE_CALLS', message: 'Wait for previous calls to finish before starting a new tour' });
      }
      if (dto.expected_base_revision !== undefined) {
        const base = await this.basesService.lockBase(userUid, locked.base_uid, transaction);
        if (base.revision !== dto.expected_base_revision) {
          throw new ConflictException({ code: 'AC_REVISION_CONFLICT', message: 'Review the current customer base before starting' });
        }
      }
      await locked.update({ tour_no: (locked.tour_no ?? 0) + 1 }, { transaction });
      const generated = await this.generateTasks(userUid, locked, dto, transaction);
      const schedules = await this.scheduleModel.findAll({ where: { campaign_uid: uid }, transaction });
      await locked.update({ status: campaignWindowOpen(schedules, new Date()) ? 'running' : 'scheduled' }, { transaction });
      await this.recordEvent(locked, 'tour_started', { include_dispositions: dto.include_dispositions ?? [], tasks_created: generated,
        max_attempts: locked.retry?.max_attempts, actor_uid: actorUid ?? null }, transaction);
      return generated;
    });
    this.logger.log(`Campaign ${uid} started, ${created} task(s) queued`);
    return {
      campaign: await this.findOne(userUid, uid),
      tasks_created: created,
    };
  }

  async pause(userUid: number, uid: number, actorUid?: number, audit?: { source: 'ai_assistant'; threadUid?: number }): Promise<IAutodialCampaign> {
    const row = await this.getOrThrow(userUid, uid);
    await row.update({ status: "paused" });
    await this.recordEvent(row, 'paused', { actor_uid: actorUid ?? null, ...(audit ? { actor_source: audit.source, thread_uid: audit.threadUid ?? null } : {}) });
    return this.findOne(userUid, uid);
  }

  async resume(userUid: number, uid: number, actorUid?: number): Promise<IAutodialCampaign> {
    const row = await this.getOrThrow(userUid, uid);
    if (row.status !== "paused" && row.status !== "scheduled") {
      throw new BadRequestException({
        code: "AC_NOT_PAUSED",
        message: "Only a paused or scheduled campaign can be resumed",
      });
    }
    this.assertScenario(row.dial_mode, row.scenario_actions);
    await this.assertQueueReferences(userUid, row.queue_names, row.scenario_actions);
    await this.assertExtensionReferences(userUid, row.scenario_actions);
    await this.assertStoredTrunkPoolConfig(userUid, row.base_uid, row.trunk_pool);
    await this.dialplanService.assertAmdReady(row);
    if (!(await this.applyAndRecord(row, row.revision))) {
      throw new ServiceUnavailableException({
        code: "AC_DIALPLAN_APPLY_FAILED",
        message:
          "Campaign dialplan could not be applied. No calls were started.",
      });
    }
    const schedules = await this.scheduleModel.findAll({ where: { campaign_uid: uid } });
    await row.update({ status: campaignWindowOpen(schedules, new Date()) ? 'running' : 'scheduled' });
    await this.recordEvent(row, 'resumed', { actor_uid: actorUid ?? null });
    return this.findOne(userUid, uid);
  }

  /** Stop new leasing while in-flight calls complete normally. */
  async stop(userUid: number, uid: number, actorUid?: number): Promise<IAutodialCampaign> {
    const row = await this.getOrThrow(userUid, uid);
    await row.update({ status: "stopped" });
    await this.taskModel.update(
      { leased_by: null, leased_at: null, status: "pending" },
      {
        where: {
          campaign_uid: uid,
          user_uid: userUid,
          status: "leased",
        },
      },
    );
    await this.recordEvent(row, 'stopped', { actor_uid: actorUid ?? null });
    return this.findOne(userUid, uid);
  }

  /**
   * One row per (campaign, contact, phone). Numbers already on a DNC list, and
   * contacts already carrying a task, are skipped. Runs as a single INSERT..SELECT
   * so a million-row base does not travel through Node.
   */
  private async generateTasks(
    userUid: number,
    campaign: AcCampaign,
    dto: StartAutodialCampaignDto,
    transaction?: Transaction,
  ): Promise<number> {
    const dispositions = dto.include_dispositions ?? [];
    if (dispositions.length) {
      // Re-arm existing tasks whose last outcome matches the selection.
      await this.taskModel.update(
        {
          status: "pending",
          tour_no: campaign.tour_no ?? 1,
          attempt_count: 0,
          next_attempt_at: null,
          leased_by: null,
          leased_at: null,
        },
        {
          where: {
            campaign_uid: campaign.uid,
            user_uid: userUid,
            last_disposition: {
              [Op.in]: dispositions as AutodialDisposition[],
            },
              status: { [Op.notIn]: ['leased', 'dialing'] },
          },
            transaction,
        },
      );
    }

    const [, affectedRows] = await this.sequelize.query(
      `INSERT INTO ac_tasks
         (vpbx_user_uid, campaign_uid, contact_uid, phone_uid, status,
          attempt_count, next_attempt_at, last_disposition, priority, tour_no, created_at, updated_at)
       SELECT :userUid, :campaignUid, p.contact_uid, p.uid, 'pending',
              0, NULL, 'new', 0, :tourNo, NOW(), NOW()
         FROM ac_contact_phones p
        WHERE p.base_uid = :baseUid
          AND p.normalized <> ''
          AND NOT EXISTS (
                SELECT 1 FROM ac_tasks t
                 WHERE t.campaign_uid = :campaignUid
                   AND t.phone_uid = p.uid)
          AND NOT EXISTS (
                SELECT 1 FROM ac_dnc d
                 WHERE d.vpbx_user_uid = :userUid
                   AND d.normalized_phone = p.canonical_phone
                   AND (d.expires_at IS NULL OR d.expires_at > NOW())
                   AND (d.scope = 'global'
                        OR (d.scope = 'campaign' AND d.scope_uid = :campaignUid)
                        OR (d.scope = 'base' AND d.scope_uid = :baseUid)))`,
      {
        replacements: {
          userUid,
          campaignUid: campaign.uid,
          baseUid: campaign.base_uid,
          tourNo: campaign.tour_no ?? 1,
        },
        transaction,
        type: QueryTypes.INSERT,
      },
    );
    return typeof affectedRows === "number" ? affectedRows : 0;
  }

  // ── schedules ─────────────────────────────────────────────────────

  private async replaceSchedules(
    userUid: number,
    campaignUid: number,
    drafts: Array<{
      kind: IAutodialSchedule["kind"];
      weekday?: number | null;
      time_from: string;
      time_to: string;
      timezone?: string;
      date_from?: string | null;
      date_to?: string | null;
      enabled?: boolean;
    }>,
    transaction?: Transaction,
  ): Promise<void> {
    assertAutodialSchedules(drafts);

    await this.scheduleModel.destroy({
      where: { campaign_uid: campaignUid },
      transaction,
    });
    if (!drafts.length) return;
    await this.scheduleModel.bulkCreate(
      drafts.map((d) => ({
        campaign_uid: campaignUid,
        kind: d.kind,
        weekday: d.kind === "weekly" ? (d.weekday ?? null) : null,
        time_from: d.time_from,
        time_to: d.time_to,
        timezone: d.timezone!.trim(),
        date_from: d.date_from ?? null,
        date_to: d.date_to ?? null,
        enabled: d.enabled ?? true,
      })) as never[],
      { transaction },
    );
  }

  private async schedulesFor(
    campaignUids: number[],
  ): Promise<Map<number, IAutodialSchedule[]>> {
    const out = new Map<number, IAutodialSchedule[]>();
    if (!campaignUids.length) return out;
    const rows = await this.scheduleModel.findAll({
      where: { campaign_uid: { [Op.in]: campaignUids } },
      order: [
        ["weekday", "ASC"],
        ["time_from", "ASC"],
      ],
    });
    for (const r of rows) {
      const list = out.get(r.campaign_uid) ?? [];
      list.push({
        uid: r.uid,
        campaign_uid: r.campaign_uid,
        kind: r.kind,
        weekday: r.weekday,
        time_from: r.time_from,
        time_to: r.time_to,
        timezone: r.timezone,
        date_from: r.date_from,
        date_to: r.date_to,
        enabled: r.enabled,
      });
      out.set(r.campaign_uid, list);
    }
    return out;
  }

  // ── helpers ───────────────────────────────────────────────────────

  async getOrThrow(
    userUid: number,
    uid: number,
    transaction?: Transaction,
  ): Promise<AcCampaign> {
    const row = await this.campaignModel.findOne({
      where: { uid, user_uid: userUid },
      ...(transaction ? { transaction, lock: transaction.LOCK.UPDATE } : {}),
    });
    if (!row) {
      throw new NotFoundException({
        code: "AC_CAMPAIGN_NOT_FOUND",
        message: "Campaign not found",
      });
    }
    return row;
  }

  private async taskCounters(
    userUid: number,
    campaignUids: number[],
  ): Promise<Map<number, { total: number; pending: number; done: number; processed?: number }>> {
    const out = new Map<
      number,
      { total: number; pending: number; done: number; processed?: number }
    >();
    if (!campaignUids.length) return out;
    const rows = (await this.taskModel.findAll({
      attributes: [
        "campaign_uid",
        "status",
        [this.sequelize.fn("COUNT", this.sequelize.col("uid")), "cnt"],
      ],
      where: { user_uid: userUid, campaign_uid: { [Op.in]: campaignUids } },
      group: ["campaign_uid", "status"],
      raw: true,
    })) as unknown as Array<{
      campaign_uid: number;
      status: string;
      cnt: number;
    }>;

    for (const r of rows) {
      const acc = out.get(r.campaign_uid) ?? { total: 0, pending: 0, done: 0 };
      const cnt = Number(r.cnt) || 0;
      acc.total += cnt;
      if (r.status === "completed" || r.status === "cancelled") acc.done += cnt;
      else acc.pending += cnt;
      out.set(r.campaign_uid, acc);
    }
    const processed = await this.sequelize.query<{ campaign_uid: number; count: number }>(
      `SELECT campaign_uid, COUNT(DISTINCT task_uid) AS count FROM ac_attempts
       WHERE vpbx_user_uid = :userUid AND campaign_uid IN (:campaignUids) AND ended_at IS NOT NULL GROUP BY campaign_uid`,
      { replacements: { userUid, campaignUids }, type: QueryTypes.SELECT });
    for (const r of processed) {
      const acc = out.get(Number(r.campaign_uid));
      if (acc) acc.processed = Number(r.count);
    }
    return out;
  }

  /**
   * Agentless campaigns must not end on a queue and operator-backed modes must
   * reach one, otherwise the pacer would reserve agents nobody hands calls to.
   */
  private assertScenario(
    dialMode: string,
    actions: unknown[] | undefined,
  ): void {
    const list = (Array.isArray(actions) ? actions : []) as IRouteAction[];
    this.assertScenarioCapabilities(list);
    const enabled = list.filter((action) => action && (action as { enabled?: boolean }).enabled !== false);
    const hasQueue = enabled.some((a) => a.type === "toqueue");
    if (dialMode === "agentless") {
      if (hasQueue) {
        throw new BadRequestException({
          code: "AC_AGENTLESS_QUEUE",
          message:
            "Agentless campaign scenario must not contain a toqueue step",
        });
      }
      return;
    }
    if (enabled.length && !hasQueue) {
      throw new BadRequestException({
        code: "AC_NO_QUEUE_STEP",
        message: `${dialMode} campaign scenario must end with a toqueue step`,
      });
    }
    if (hasQueue) {
      const inlineQueue = enabled.some(
        (action) => {
          if (action?.type !== "toqueue") return false;
          const params = action.params as Record<string, unknown>;
          const target = params?.target as { source?: unknown; value?: unknown } | undefined;
          return Boolean(
            params?.queue
            || params?.queue_name
            || (target?.source === "fixed" && String(target.value ?? "").trim()),
          );
        },
      );
      if (!inlineQueue) {
        throw new BadRequestException({
          code: "AC_NO_QUEUE",
          message: "Choose a fixed queue in the scenario To queue step",
        });
      }
    }
  }

  /**
   * Validate cross-module references where DTO decorators cannot see tenant
   * ownership or the selected campaign base. Empty pools remain valid drafts;
   * lifecycle methods reject them separately with AC_NO_TRUNK.
   */
  private async assertTrunkPoolConfig(
    userUid: number,
    baseFields: Array<{ uid: number; key: string }>,
    pool: IAutodialTrunkPoolItem[],
  ): Promise<void> {
    const ids = [...new Set(pool.map((item) => item?.trunk_id?.trim()).filter(Boolean))] as string[];
    if (ids.length !== pool.length) {
      throw new BadRequestException({
        code: "AC_TRUNK_INVALID",
        message: "Each campaign trunk needs a unique id",
      });
    }
    if (ids.length) {
      const owned = await this.endpointModel.findAll({
        attributes: ["id"],
        where: { id: { [Op.in]: ids }, tenantid: String(userUid) },
      });
      if (owned.length !== ids.length) {
        throw new BadRequestException({
          code: "AC_TRUNK_NOT_FOUND",
          message: "Campaign trunk is unavailable for this organization",
        });
      }
    }
    for (const item of pool) {
      const source = item.caller_id_source as AutodialCallerIdSource | undefined;
      if (!source) continue;
      if (source.mode === "static") continue;

      if (source.mode === "pool") {
        const numbers = Array.isArray(source.numbers)
          ? source.numbers.map((value) => value.trim()).filter(Boolean)
          : [];
        if (
          !numbers.length
          || new Set(numbers).size !== numbers.length
          || !["random", "round_robin"].includes(source.pick)
        ) {
          throw new BadRequestException({
            code: "AC_CALLER_ID_SOURCE_INVALID",
            message: "Caller ID pool needs unique numbers and a pick mode",
          });
        }
        continue;
      }

      const key = source.key;
      if (
        !Number.isInteger(source.directory_uid) ||
        !Number.isInteger(source.value_field_uid) ||
        key?.source !== "autodial_field" ||
        !key.field_key?.trim() ||
        source.on_missing !== "fallback"
      ) {
        throw new BadRequestException({
          code: "AC_CALLER_ID_SOURCE_INVALID",
          message: "Directory Caller ID needs a directory, value field and contact key",
        });
      }

      if (!baseFields.some((field) => field.key === key.field_key)) {
        throw new BadRequestException({
          code: "AC_CALLER_ID_DIRECTORY_INVALID",
          message: "Caller ID directory key is not a field of this campaign base",
        });
      }

      const directory = await this.directoriesService.findOne(source.directory_uid, userUid);
      const valueField = directory.fields?.find((field) => field.uid === source.value_field_uid);
      if (!valueField || !["phone", "string"].includes(valueField.type)) {
        throw new BadRequestException({
          code: "AC_CALLER_ID_DIRECTORY_INVALID",
          message: "Caller ID value field must be a phone or text field of the directory",
        });
      }
    }
  }

  private async assertStoredTrunkPoolConfig(
    userUid: number,
    baseUid: number,
    pool: IAutodialTrunkPoolItem[],
  ): Promise<void> {
    if (!hasDirectoryCallerIdSource(pool)) {
      return this.assertTrunkPoolConfig(userUid, [], pool);
    }
    const base = await this.basesService.findOne(userUid, baseUid);
    return this.assertTrunkPoolConfig(userUid, base.fields ?? [], pool);
  }

  private async assertQueueReferences(
    userUid: number,
    queueNames: string[] | undefined,
    actions: unknown[] | undefined,
  ): Promise<void> {
    const names = new Set((queueNames ?? []).map((name) => name.trim()).filter(Boolean));
    for (const action of (actions ?? []) as IRouteAction[]) {
      if (action?.type !== "toqueue" || (action as { enabled?: boolean }).enabled === false) continue;
      const params = (action.params ?? {}) as Record<string, unknown>;
      let name: string;
      try { name = autodialQueueTarget(params, userUid); }
      catch (error) { throw new BadRequestException({ code: (error as Error).message, message: 'Invalid tenant queue target' }); }
      if (name) names.add(name);
    }
    if (!names.size) return;
    const owned = await this.queueModel.findAll({
      attributes: ["name"],
      where: { name: { [Op.in]: [...names] }, user_uid: userUid },
    });
    if (owned.length !== names.size) {
      throw new BadRequestException({
        code: "AC_QUEUE_NOT_FOUND",
        message: "Campaign queue is unavailable for this organization",
      });
    }
  }

  private async assertExtensionReferences(
    userUid: number,
    actions: unknown[] | undefined,
  ): Promise<void> {
    const ids = new Set<string>();
    for (const action of (actions ?? []) as IRouteAction[]) {
      if (action?.type !== "toexten" || (action as { enabled?: boolean }).enabled === false) continue;
      const params = (action.params ?? {}) as Record<string, unknown>;
      let id: string;
      try { id = autodialExtensionTarget(params, userUid).id; }
      catch (error) { throw new BadRequestException({ code: (error as Error).message, message: 'Invalid tenant extension target' }); }
      if (id) ids.add(id);
    }
    if (!ids.size) return;
    const owned = await this.endpointModel.findAll({
      attributes: ["id"],
      where: { id: { [Op.in]: [...ids] }, tenantid: String(userUid) },
    });
    if (owned.length !== ids.size) {
      throw new BadRequestException({
        code: "AC_EXTENSION_NOT_FOUND",
        message: "Campaign extension is unavailable for this organization",
      });
    }
  }

  /**
   * The shared editor exposes more applications and ValueSource variants than
   * the outbound campaign compiler can safely render. Reject unsupported
   * enabled steps before save/start; legacy campaigns remain readable.
   */
  private assertScenarioCapabilities(actions: IRouteAction[]): void {
    if (actions.length > 100) throw new BadRequestException({ code: 'AC_SCENARIO_TOO_LONG', message: 'At most 100 steps are supported' });
    const ids = actions.map((action) => action?.id).filter(Boolean);
    if (new Set(ids).size !== ids.length) throw new BadRequestException({ code: 'AC_SCENARIO_DUPLICATE_ID', message: 'Scenario step IDs must be unique' });
    for (const [index, action] of actions.entries()) {
      if (!action) throw new BadRequestException({ code: 'AC_SCENARIO_INVALID_PARAMS', step_index: index, message: 'Scenario step must be an object' });
      if ((action as { enabled?: boolean }).enabled === false) continue;
      if (!AUTODIAL_SUPPORTED_ACTIONS.has(action.type)) {
        throw new BadRequestException({
          code: "AC_SCENARIO_UNSUPPORTED_ACTION",
          message: `Autodial does not support scenario step ${index + 1}: ${action.type}`,
          field: `scenario_actions.${index}.type`,
          step_index: index,
        });
      }
      if (hasScenarioCondition(action.condition)) {
        throw new BadRequestException({
          code: "AC_SCENARIO_CONDITION_UNSUPPORTED",
          message: "Autodial does not support conditional scenario steps yet",
        });
      }
      if (action.type === "toqueue" || action.type === "toexten") {
        const target = (action.params as Record<string, unknown>)?.target;
        if (
          target != null
          && (typeof target !== "object"
            || (target as { source?: unknown }).source !== "fixed")
        ) {
          throw new BadRequestException({
            code: "AC_SCENARIO_TARGET_UNSUPPORTED",
            message: "Autodial supports only a fixed target for this scenario step",
          });
        }
      }
      const parsed = autodialScenarioActionSchema.safeParse(action);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        throw new BadRequestException({ code: 'AC_SCENARIO_INVALID_PARAMS', step_index: index,
          field: `scenario_actions.${index}.${issue.path.join('.')}`, message: `Step ${index + 1}: ${issue.message}` });
      }
    }
    const outcomeError = autodialOutcomeDefinitionError(actions);
    if (outcomeError) throw new BadRequestException({ code: 'AC_SCENARIO_INVALID_PARAMS', step_index: outcomeError.index,
      field: `scenario_actions.${outcomeError.index}.${outcomeError.field}`, message: 'Outcome definitions must reference mapped codes and keep one meaning per code' });
    const enabled = actions.filter((action) => action && action.enabled !== false);
    const labels = enabled.filter((action) => action.type === 'label')
      .map((action) => String(action.params?.label_name ?? action.params?.name ?? ''));
    if (new Set(labels).size !== labels.length) throw new BadRequestException({ code: 'AC_SCENARIO_DUPLICATE_LABEL', message: 'Scenario labels must be unique' });
    for (const action of enabled.filter((action) => action.type === 'goto')) {
      const target = String(action.params?.label_name ?? action.params?.label ?? '');
      const otherwise = String(action.params?.false_label ?? '');
      if (!target || !labels.includes(target) || (otherwise && !labels.includes(otherwise))) {
        throw new BadRequestException({ code: 'AC_SCENARIO_LABEL_NOT_FOUND', message: 'Goto must reference an existing enabled label' });
      }
    }
  }

  private async applyAndRecord(row: AcCampaign, revision: number): Promise<boolean> {
    const applied = await this.dialplanService.applyCampaign(row);
    if (applied) {
      await row.update({ applied_revision: revision, apply_error: null });
    } else {
      await row.update({ apply_error: "AC_DIALPLAN_APPLY_FAILED" });
    }
    return applied;
  }

  private toDto(
    row: AcCampaign,
    schedules: IAutodialSchedule[],
    counters?: { total: number; pending: number; done: number; processed?: number },
  ): IAutodialCampaign & { schedules: IAutodialSchedule[] } {
    return {
      uid: row.uid,
      user_uid: row.user_uid,
      name: row.name,
      business_goal: row.business_goal ?? 'custom',
      status: row.status,
      dial_mode: row.dial_mode,
      base_uid: row.base_uid,
      pacing: row.pacing,
      retry: row.retry,
      trunk_pool: row.trunk_pool,
      cid_policy: row.cid_policy,
      queue_names: row.queue_names ?? [],
      scenario_actions: row.scenario_actions ?? [],
      amd: row.amd,
      success_min_sec: row.success_min_sec,
      dial_timeout_sec: row.dial_timeout_sec,
      revision: row.revision,
      applied_revision: row.applied_revision ?? null,
      apply_error: row.apply_error ?? null,
      tasks_total: counters?.total ?? 0,
      tasks_pending: counters?.pending ?? 0,
      tasks_done: counters?.done ?? 0,
      tasks_processed: counters?.processed ?? 0,
      tour_no: row.tour_no ?? 0,
      schedules,
      created_at: row.created_at?.toISOString(),
      updated_at: row.updated_at?.toISOString(),
    };
  }
}

/** Exported for the pacer: dispositions that never get re-dialed automatically. */
export function isTerminalDisposition(d: AutodialDisposition): boolean {
  return AUTODIAL_TERMINAL_DISPOSITIONS.includes(d);
}

function hasScenarioCondition(condition: unknown): boolean {
  if (!condition || typeof condition !== "object") return false;
  return Object.values(condition as Record<string, unknown>).some((value) => {
    if (Array.isArray(value)) return value.length > 0;
    return value != null && value !== "";
  });
}

function normalizeAutodialScenario(actions: unknown[]): IRouteAction[] {
  return (actions as IRouteAction[]).map((action) => ({ ...action,
    id: action.id || randomUUID(), params: action.params ?? {}, condition: hasScenarioCondition(action.condition) ? action.condition : {} }));
}

/**
 * DTOs intentionally permit a union-shaped source while class-validator checks
 * its individual fields. Convert the transport shape once after those checks
 * instead of leaking DTO-only optional properties into persisted JSON.
 */
export function toAutodialTrunkPool(input: unknown[]): IAutodialTrunkPoolItem[] {
  return input.map((raw) => {
    const item = raw as Record<string, unknown>;
    const source = item.caller_id_source as AutodialCallerIdSource | undefined;
    return {
      trunk_id: String(item.trunk_id ?? ""),
      ...(typeof item.caller_id === "string" ? { caller_id: item.caller_id } : {}),
      ...(typeof item.weight === "number" ? { weight: item.weight } : {}),
      ...(typeof item.max_channels === "number" ? { max_channels: item.max_channels } : {}),
      ...(source ? { caller_id_source: source } : {}),
    };
  });
}

function hasDirectoryCallerIdSource(pool: IAutodialTrunkPoolItem[]): boolean {
  return pool.some((item) => item.caller_id_source?.mode === "directory");
}


export function assertAutodialSchedules(drafts: Array<{ kind: string; weekday?: number | null; time_from: string; time_to: string; timezone?: string; date_from?: string | null; date_to?: string | null }>): void {
    for (const draft of drafts) {
      const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
      if (!(AUTODIAL_SCHEDULE_KINDS as readonly string[]).includes(draft.kind) || draft.date_from && !validDate(draft.date_from) || draft.date_to && !validDate(draft.date_to)
        || draft.kind === 'one_off' && !draft.date_from
        || draft.kind !== 'one_off' && draft.date_from && draft.date_to && draft.date_from > draft.date_to) {
        throw new BadRequestException({ code: 'AC_SCHEDULE_DATES', message: 'Check schedule kind and calendar date boundaries' });
      }
      if (!TIME_RE.test(draft.time_from) || !TIME_RE.test(draft.time_to)) {
        throw new BadRequestException({
          code: "AC_SCHEDULE_TIME",
          message: "time_from/time_to must be HH:MM",
        });
      }
      if (draft.time_from === draft.time_to) {
        throw new BadRequestException({
          code: "AC_SCHEDULE_RANGE",
          message: "time_from and time_to must differ; overnight windows use their start day",
        });
      }
      if (
        draft.kind === "weekly" &&
        (draft.weekday == null || draft.weekday < 0 || draft.weekday > 6)
      ) {
        throw new BadRequestException({
          code: "AC_SCHEDULE_WEEKDAY",
          message: "weekly schedule requires weekday 0..6",
        });
      }
      const timezone = draft.timezone?.trim();
      if (!timezone || !isSupportedTimeZone(timezone)) {
        throw new BadRequestException({
          code: "AC_SCHEDULE_TIMEZONE",
          message: "timezone must be a supported IANA time zone",
        });
      }
    }
}
