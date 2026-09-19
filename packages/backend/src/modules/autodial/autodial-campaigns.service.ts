import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { Op, QueryTypes, type Transaction } from "sequelize";
import type { Sequelize } from "sequelize-typescript";
import { InjectConnection } from "@nestjs/sequelize";
import {
  AUTODIAL_TERMINAL_DISPOSITIONS,
  type AutodialCallerIdSource,
  type AutodialCampaignStatus,
  type AutodialDisposition,
  type IAutodialTrunkPoolItem,
  type IAutodialCampaign,
  type IAutodialSchedule,
  type IRouteAction,
} from "@krasterisk/shared";
import { AcCampaign } from "./models/ac-campaign.model";
import { AcSchedule } from "./models/ac-schedule.model";
import { AcTask } from "./models/ac-task.model";
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
} from "./autodial-campaign.defaults";

/** Statuses from which the pacer may pick tasks. */
export const AUTODIAL_ACTIVE_STATUSES: AutodialCampaignStatus[] = ["running"];

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const AUTODIAL_SUPPORTED_ACTIONS = new Set([
  "playback",
  "toqueue",
  "toexten",
  "voicerobot",
  "ai_voice_robot",
  "collect_input",
  "label",
  "goto",
  "hangup",
]);

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

  async findOne(userUid: number, uid: number): Promise<IAutodialCampaign> {
    const row = await this.getOrThrow(userUid, uid);
    const counters = await this.taskCounters(userUid, [uid]);
    const schedules = await this.schedulesFor([uid]);
    return this.toDto(row, schedules.get(uid) ?? [], counters.get(uid));
  }

  async create(
    userUid: number,
    dto: CreateAutodialCampaignDto,
  ): Promise<IAutodialCampaign> {
    const trunkPool = toAutodialTrunkPool(dto.trunk_pool ?? []);
    const base = await this.basesService.findOne(userUid, dto.base_uid);
    await this.assertTrunkPoolConfig(userUid, base.fields ?? [], trunkPool);
    this.assertScenario(
      dto.dial_mode ?? "progressive",
      dto.queue_names,
      dto.scenario_actions,
    );
    await this.assertQueueReferences(userUid, dto.queue_names, dto.scenario_actions);
    await this.assertExtensionReferences(userUid, dto.scenario_actions);

    const row = await this.sequelize.transaction(async (transaction) => {
      const created = await this.campaignModel.create(
        {
          user_uid: userUid,
          name: dto.name.trim(),
          status: "draft",
          dial_mode: dto.dial_mode ?? "progressive",
          base_uid: dto.base_uid,
          pacing: normalizeAutodialPacing(dto.pacing),
          retry: normalizeAutodialRetry(dto.retry),
          trunk_pool: dto.trunk_pool == null ? defaultAutodialTrunkPool() : trunkPool,
          cid_policy: dto.cid_policy ?? defaultAutodialCidPolicy(),
          queue_names: dto.queue_names ?? [],
          scenario_actions: (dto.scenario_actions ?? []) as IRouteAction[],
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
      return created;
    });
    await this.dialplanService.applyCampaign(row);
    return this.findOne(userUid, row.uid);
  }

  async update(
    userUid: number,
    uid: number,
    dto: UpdateAutodialCampaignDto,
  ): Promise<IAutodialCampaign> {
    const trunkPool = dto.trunk_pool == null ? undefined : toAutodialTrunkPool(dto.trunk_pool);
    const row = await this.sequelize.transaction(async (transaction) => {
      const locked = await this.getOrThrow(userUid, uid, transaction);
      if (dto.expected_revision !== locked.revision) {
        throw new ConflictException({
          code: "AC_CAMPAIGN_REVISION_CONFLICT",
          message: "Campaign changed. Reload before saving.",
        });
      }
      if (dto.base_uid != null && dto.base_uid !== locked.base_uid) {
        await this.basesService.findOne(userUid, dto.base_uid);
        if (locked.status === "running") {
          throw new BadRequestException({
            code: "AC_CAMPAIGN_RUNNING",
            message: "Cannot switch base while the campaign is running",
          });
        }
      }
      this.assertScenario(
        dto.dial_mode ?? locked.dial_mode,
        dto.queue_names ?? locked.queue_names,
        dto.scenario_actions ?? locked.scenario_actions,
      );
      await this.assertQueueReferences(
        userUid,
        dto.queue_names ?? locked.queue_names,
        dto.scenario_actions ?? locked.scenario_actions,
      );
      await this.assertExtensionReferences(userUid, dto.scenario_actions ?? locked.scenario_actions);
      if (trunkPool != null) {
        const base = await this.basesService.findOne(userUid, dto.base_uid ?? locked.base_uid);
        await this.assertTrunkPoolConfig(userUid, base.fields ?? [], trunkPool);
      }

      const patch: Partial<AcCampaign> = { revision: locked.revision + 1 };
      if (dto.name != null) patch.name = dto.name.trim();
      if (dto.dial_mode != null) patch.dial_mode = dto.dial_mode;
      if (dto.base_uid != null) patch.base_uid = dto.base_uid;
      if (dto.pacing != null)
        patch.pacing = normalizeAutodialPacing(dto.pacing);
      if (dto.retry != null) patch.retry = normalizeAutodialRetry(dto.retry);
      if (trunkPool != null) patch.trunk_pool = trunkPool;
      if (dto.cid_policy != null) patch.cid_policy = dto.cid_policy;
      if (dto.queue_names != null) patch.queue_names = dto.queue_names;
      if (dto.scenario_actions != null) {
        patch.scenario_actions = dto.scenario_actions as IRouteAction[];
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
      return locked;
    });
    await this.dialplanService.applyCampaign(row);
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
    await this.taskModel.destroy({
      where: { campaign_uid: uid, user_uid: userUid },
    });
    await this.scheduleModel.destroy({ where: { campaign_uid: uid } });
    await row.destroy();
  }

  // ── lifecycle ─────────────────────────────────────────────────────

  /**
   * Generate tasks and switch to running. `include_dispositions` re-selects
   * contacts whose previous attempts ended in the given dispositions (D-19);
   * omitting it dials every contact that has no task yet.
   */
  async start(
    userUid: number,
    uid: number,
    dto: StartAutodialCampaignDto = {},
  ): Promise<{ campaign: IAutodialCampaign; tasks_created: number }> {
    const row = await this.getOrThrow(userUid, uid);
    if (!row.trunk_pool?.length) {
      throw new BadRequestException({
        code: "AC_NO_TRUNK",
        message: "Configure at least one trunk before starting",
      });
    }
    this.assertScenario(row.dial_mode, row.queue_names, row.scenario_actions);
    await this.assertQueueReferences(userUid, row.queue_names, row.scenario_actions);
    await this.assertExtensionReferences(userUid, row.scenario_actions);
    await this.assertStoredTrunkPoolConfig(userUid, row.base_uid, row.trunk_pool);
    await this.dialplanService.assertAmdReady(row);
    // Re-apply so a dialplan lost to a failed apply or an Asterisk reinstall
    // is present before the first channel lands in the context.
    if (!(await this.dialplanService.applyCampaign(row))) {
      throw new ServiceUnavailableException({
        code: "AC_DIALPLAN_APPLY_FAILED",
        message:
          "Campaign dialplan could not be applied. No calls were started.",
      });
    }

    const created = await this.generateTasks(userUid, row, dto);
    await row.update({ status: "running" });
    this.logger.log(`Campaign ${uid} started, ${created} task(s) queued`);
    return {
      campaign: await this.findOne(userUid, uid),
      tasks_created: created,
    };
  }

  async pause(userUid: number, uid: number): Promise<IAutodialCampaign> {
    const row = await this.getOrThrow(userUid, uid);
    await row.update({ status: "paused" });
    return this.findOne(userUid, uid);
  }

  async resume(userUid: number, uid: number): Promise<IAutodialCampaign> {
    const row = await this.getOrThrow(userUid, uid);
    if (row.status !== "paused" && row.status !== "scheduled") {
      throw new BadRequestException({
        code: "AC_NOT_PAUSED",
        message: "Only a paused or scheduled campaign can be resumed",
      });
    }
    this.assertScenario(row.dial_mode, row.queue_names, row.scenario_actions);
    await this.assertQueueReferences(userUid, row.queue_names, row.scenario_actions);
    await this.assertExtensionReferences(userUid, row.scenario_actions);
    await this.assertStoredTrunkPoolConfig(userUid, row.base_uid, row.trunk_pool);
    await this.dialplanService.assertAmdReady(row);
    if (!(await this.dialplanService.applyCampaign(row))) {
      throw new ServiceUnavailableException({
        code: "AC_DIALPLAN_APPLY_FAILED",
        message:
          "Campaign dialplan could not be applied. No calls were started.",
      });
    }
    await row.update({ status: "running" });
    return this.findOne(userUid, uid);
  }

  /** Stop new leasing while in-flight calls complete normally. */
  async stop(userUid: number, uid: number): Promise<IAutodialCampaign> {
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
  ): Promise<number> {
    const dispositions = dto.include_dispositions ?? [];
    if (dispositions.length) {
      // Re-arm existing tasks whose last outcome matches the selection.
      await this.taskModel.update(
        {
          status: "pending",
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
          },
        },
      );
    }

    const [inserted] = await this.sequelize.query(
      `INSERT INTO ac_tasks
         (vpbx_user_uid, campaign_uid, contact_uid, phone_uid, status,
          attempt_count, next_attempt_at, last_disposition, priority, created_at, updated_at)
       SELECT :userUid, :campaignUid, p.contact_uid, p.uid, 'pending',
              0, NULL, 'new', 0, NOW(), NOW()
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
                   AND d.normalized_phone = p.normalized
                   AND (d.expires_at IS NULL OR d.expires_at > NOW())
                   AND (d.scope = 'global'
                        OR (d.scope = 'campaign' AND d.scope_uid = :campaignUid)
                        OR (d.scope = 'base' AND d.scope_uid = :baseUid)))`,
      {
        replacements: {
          userUid,
          campaignUid: campaign.uid,
          baseUid: campaign.base_uid,
        },
        type: QueryTypes.INSERT,
      },
    );
    return typeof inserted === "number" ? inserted : 0;
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
    for (const draft of drafts) {
      if (!TIME_RE.test(draft.time_from) || !TIME_RE.test(draft.time_to)) {
        throw new BadRequestException({
          code: "AC_SCHEDULE_TIME",
          message: "time_from/time_to must be HH:MM",
        });
      }
      if (draft.time_from >= draft.time_to) {
        throw new BadRequestException({
          code: "AC_SCHEDULE_RANGE",
          message: "time_from must be earlier than time_to",
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
  ): Promise<Map<number, { total: number; pending: number; done: number }>> {
    const out = new Map<
      number,
      { total: number; pending: number; done: number }
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
    return out;
  }

  /**
   * Agentless campaigns must not end on a queue and operator-backed modes must
   * reach one, otherwise the pacer would reserve agents nobody hands calls to.
   */
  private assertScenario(
    dialMode: string,
    queueNames: string[] | undefined,
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
    if (hasQueue && !queueNames?.length) {
      const inlineQueue = enabled.some(
        (action) => {
          if (action?.type !== "toqueue") return false;
          const params = action.params as Record<string, unknown>;
          const target = params?.target as { source?: unknown; value?: unknown } | undefined;
          return Boolean(
            params?.queue
            || (target?.source === "fixed" && String(target.value ?? "").trim()),
          );
        },
      );
      if (!inlineQueue) {
        throw new BadRequestException({
          code: "AC_NO_QUEUE",
          message: "Select at least one queue for the campaign",
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
      const target = params.target as { source?: unknown; value?: unknown } | undefined;
      const name = String(params.queue ?? params.queue_name
        ?? (target?.source === "fixed" ? target.value : "") ?? "").trim();
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
      const target = params.target as { source?: unknown; value?: unknown } | undefined;
      const id = String(params.exten ?? params.extension
        ?? (target?.source === "fixed" ? target.value : "") ?? "").trim();
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
    for (const action of actions) {
      if (!action || (action as { enabled?: boolean }).enabled === false) continue;
      if (!AUTODIAL_SUPPORTED_ACTIONS.has(action.type)) {
        throw new BadRequestException({
          code: "AC_SCENARIO_UNSUPPORTED_ACTION",
          message: `Autodial does not support scenario step ${action.type}`,
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
    }
  }

  private toDto(
    row: AcCampaign,
    schedules: IAutodialSchedule[],
    counters?: { total: number; pending: number; done: number },
  ): IAutodialCampaign & { schedules: IAutodialSchedule[] } {
    return {
      uid: row.uid,
      user_uid: row.user_uid,
      name: row.name,
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
      tasks_total: counters?.total ?? 0,
      tasks_pending: counters?.pending ?? 0,
      tasks_done: counters?.done ?? 0,
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

/**
 * DTOs intentionally permit a union-shaped source while class-validator checks
 * its individual fields. Convert the transport shape once after those checks
 * instead of leaking DTO-only optional properties into persisted JSON.
 */
function toAutodialTrunkPool(input: unknown[]): IAutodialTrunkPoolItem[] {
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
