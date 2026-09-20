"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var AutodialCampaignsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutodialCampaignsService = exports.AUTODIAL_ACTIVE_STATUSES = void 0;
exports.isTerminalDisposition = isTerminalDisposition;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const sequelize_2 = require("sequelize");
const sequelize_3 = require("@nestjs/sequelize");
const shared_1 = require("@krasterisk/shared");
const ac_campaign_model_1 = require("./models/ac-campaign.model");
const ac_schedule_model_1 = require("./models/ac-schedule.model");
const ac_task_model_1 = require("./models/ac-task.model");
const ac_contact_phone_model_1 = require("./models/ac-contact-phone.model");
const ac_dnc_model_1 = require("./models/ac-dnc.model");
const ps_endpoint_model_1 = require("../endpoints/ps-endpoint.model");
const queue_model_1 = require("../queues/queue.model");
const autodial_bases_service_1 = require("./autodial-bases.service");
const directories_service_1 = require("../directories/directories.service");
const autodial_dialplan_service_1 = require("./autodial-dialplan.service");
const autodial_campaign_defaults_1 = require("./autodial-campaign.defaults");
/** Statuses from which the pacer may pick tasks. */
exports.AUTODIAL_ACTIVE_STATUSES = ["running"];
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
function isSupportedTimeZone(timeZone) {
    try {
        Intl.DateTimeFormat("en-US", { timeZone });
        return true;
    }
    catch {
        return false;
    }
}
let AutodialCampaignsService = AutodialCampaignsService_1 = class AutodialCampaignsService {
    campaignModel;
    scheduleModel;
    taskModel;
    phoneModel;
    dncModel;
    endpointModel;
    queueModel;
    sequelize;
    basesService;
    directoriesService;
    dialplanService;
    logger = new common_1.Logger(AutodialCampaignsService_1.name);
    constructor(campaignModel, scheduleModel, taskModel, phoneModel, dncModel, endpointModel, queueModel, sequelize, basesService, directoriesService, dialplanService) {
        this.campaignModel = campaignModel;
        this.scheduleModel = scheduleModel;
        this.taskModel = taskModel;
        this.phoneModel = phoneModel;
        this.dncModel = dncModel;
        this.endpointModel = endpointModel;
        this.queueModel = queueModel;
        this.sequelize = sequelize;
        this.basesService = basesService;
        this.directoriesService = directoriesService;
        this.dialplanService = dialplanService;
    }
    async findAll(userUid) {
        const rows = await this.campaignModel.findAll({
            where: { user_uid: userUid },
            order: [["uid", "DESC"]],
        });
        const counters = await this.taskCounters(userUid, rows.map((r) => r.uid));
        const schedules = await this.schedulesFor(rows.map((r) => r.uid));
        return rows.map((r) => this.toDto(r, schedules.get(r.uid) ?? [], counters.get(r.uid)));
    }
    async findOne(userUid, uid) {
        const row = await this.getOrThrow(userUid, uid);
        const counters = await this.taskCounters(userUid, [uid]);
        const schedules = await this.schedulesFor([uid]);
        return this.toDto(row, schedules.get(uid) ?? [], counters.get(uid));
    }
    async create(userUid, dto) {
        const trunkPool = toAutodialTrunkPool(dto.trunk_pool ?? []);
        const base = await this.basesService.findOne(userUid, dto.base_uid);
        await this.assertTrunkPoolConfig(userUid, base.fields ?? [], trunkPool);
        this.assertScenario(dto.dial_mode ?? "progressive", dto.queue_names, dto.scenario_actions);
        await this.assertQueueReferences(userUid, dto.queue_names, dto.scenario_actions);
        await this.assertExtensionReferences(userUid, dto.scenario_actions);
        const row = await this.sequelize.transaction(async (transaction) => {
            const created = await this.campaignModel.create({
                user_uid: userUid,
                name: dto.name.trim(),
                status: "draft",
                dial_mode: dto.dial_mode ?? "progressive",
                base_uid: dto.base_uid,
                pacing: (0, autodial_campaign_defaults_1.normalizeAutodialPacing)(dto.pacing),
                retry: (0, autodial_campaign_defaults_1.normalizeAutodialRetry)(dto.retry),
                trunk_pool: dto.trunk_pool == null ? (0, autodial_campaign_defaults_1.defaultAutodialTrunkPool)() : trunkPool,
                cid_policy: dto.cid_policy ?? (0, autodial_campaign_defaults_1.defaultAutodialCidPolicy)(),
                queue_names: dto.queue_names ?? [],
                scenario_actions: (dto.scenario_actions ?? []),
                amd: dto.amd ?? (0, autodial_campaign_defaults_1.defaultAutodialAmd)(),
                success_min_sec: dto.success_min_sec ?? 15,
                dial_timeout_sec: dto.dial_timeout_sec ?? 45,
                revision: 1,
            }, { transaction });
            if (dto.schedules !== undefined) {
                await this.replaceSchedules(userUid, created.uid, dto.schedules, transaction);
            }
            return created;
        });
        await this.dialplanService.applyCampaign(row);
        return this.findOne(userUid, row.uid);
    }
    async update(userUid, uid, dto) {
        const trunkPool = dto.trunk_pool == null ? undefined : toAutodialTrunkPool(dto.trunk_pool);
        const row = await this.sequelize.transaction(async (transaction) => {
            const locked = await this.getOrThrow(userUid, uid, transaction);
            if (dto.expected_revision !== locked.revision) {
                throw new common_1.ConflictException({
                    code: "AC_CAMPAIGN_REVISION_CONFLICT",
                    message: "Campaign changed. Reload before saving.",
                });
            }
            if (dto.base_uid != null && dto.base_uid !== locked.base_uid) {
                await this.basesService.findOne(userUid, dto.base_uid);
                if (locked.status === "running") {
                    throw new common_1.BadRequestException({
                        code: "AC_CAMPAIGN_RUNNING",
                        message: "Cannot switch base while the campaign is running",
                    });
                }
            }
            this.assertScenario(dto.dial_mode ?? locked.dial_mode, dto.queue_names ?? locked.queue_names, dto.scenario_actions ?? locked.scenario_actions);
            await this.assertQueueReferences(userUid, dto.queue_names ?? locked.queue_names, dto.scenario_actions ?? locked.scenario_actions);
            await this.assertExtensionReferences(userUid, dto.scenario_actions ?? locked.scenario_actions);
            if (trunkPool != null) {
                const base = await this.basesService.findOne(userUid, dto.base_uid ?? locked.base_uid);
                await this.assertTrunkPoolConfig(userUid, base.fields ?? [], trunkPool);
            }
            const patch = { revision: locked.revision + 1 };
            if (dto.name != null)
                patch.name = dto.name.trim();
            if (dto.dial_mode != null)
                patch.dial_mode = dto.dial_mode;
            if (dto.base_uid != null)
                patch.base_uid = dto.base_uid;
            if (dto.pacing != null)
                patch.pacing = (0, autodial_campaign_defaults_1.normalizeAutodialPacing)(dto.pacing);
            if (dto.retry != null)
                patch.retry = (0, autodial_campaign_defaults_1.normalizeAutodialRetry)(dto.retry);
            if (trunkPool != null)
                patch.trunk_pool = trunkPool;
            if (dto.cid_policy != null)
                patch.cid_policy = dto.cid_policy;
            if (dto.queue_names != null)
                patch.queue_names = dto.queue_names;
            if (dto.scenario_actions != null) {
                patch.scenario_actions = dto.scenario_actions;
            }
            if (dto.amd != null)
                patch.amd = dto.amd;
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
    async remove(userUid, uid) {
        const row = await this.getOrThrow(userUid, uid);
        if (row.status === "running") {
            throw new common_1.BadRequestException({
                code: "AC_CAMPAIGN_RUNNING",
                message: "Stop the campaign before deleting it",
            });
        }
        const activeTasks = await this.taskModel.count({
            where: {
                campaign_uid: uid,
                user_uid: userUid,
                status: { [sequelize_2.Op.in]: ["leased", "dialing"] },
            },
        });
        if (activeTasks) {
            throw new common_1.BadRequestException({
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
    async start(userUid, uid, dto = {}) {
        const row = await this.getOrThrow(userUid, uid);
        if (!row.trunk_pool?.length) {
            throw new common_1.BadRequestException({
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
            throw new common_1.ServiceUnavailableException({
                code: "AC_DIALPLAN_APPLY_FAILED",
                message: "Campaign dialplan could not be applied. No calls were started.",
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
    async pause(userUid, uid) {
        const row = await this.getOrThrow(userUid, uid);
        await row.update({ status: "paused" });
        return this.findOne(userUid, uid);
    }
    async resume(userUid, uid) {
        const row = await this.getOrThrow(userUid, uid);
        if (row.status !== "paused" && row.status !== "scheduled") {
            throw new common_1.BadRequestException({
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
            throw new common_1.ServiceUnavailableException({
                code: "AC_DIALPLAN_APPLY_FAILED",
                message: "Campaign dialplan could not be applied. No calls were started.",
            });
        }
        await row.update({ status: "running" });
        return this.findOne(userUid, uid);
    }
    /** Stop new leasing while in-flight calls complete normally. */
    async stop(userUid, uid) {
        const row = await this.getOrThrow(userUid, uid);
        await row.update({ status: "stopped" });
        await this.taskModel.update({ leased_by: null, leased_at: null, status: "pending" }, {
            where: {
                campaign_uid: uid,
                user_uid: userUid,
                status: "leased",
            },
        });
        return this.findOne(userUid, uid);
    }
    /**
     * One row per (campaign, contact, phone). Numbers already on a DNC list, and
     * contacts already carrying a task, are skipped. Runs as a single INSERT..SELECT
     * so a million-row base does not travel through Node.
     */
    async generateTasks(userUid, campaign, dto) {
        const dispositions = dto.include_dispositions ?? [];
        if (dispositions.length) {
            // Re-arm existing tasks whose last outcome matches the selection.
            await this.taskModel.update({
                status: "pending",
                attempt_count: 0,
                next_attempt_at: null,
                leased_by: null,
                leased_at: null,
            }, {
                where: {
                    campaign_uid: campaign.uid,
                    user_uid: userUid,
                    last_disposition: {
                        [sequelize_2.Op.in]: dispositions,
                    },
                },
            });
        }
        const [inserted] = await this.sequelize.query(`INSERT INTO ac_tasks
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
                        OR (d.scope = 'base' AND d.scope_uid = :baseUid)))`, {
            replacements: {
                userUid,
                campaignUid: campaign.uid,
                baseUid: campaign.base_uid,
            },
            type: sequelize_2.QueryTypes.INSERT,
        });
        return typeof inserted === "number" ? inserted : 0;
    }
    // ── schedules ─────────────────────────────────────────────────────
    async replaceSchedules(userUid, campaignUid, drafts, transaction) {
        for (const draft of drafts) {
            if (!TIME_RE.test(draft.time_from) || !TIME_RE.test(draft.time_to)) {
                throw new common_1.BadRequestException({
                    code: "AC_SCHEDULE_TIME",
                    message: "time_from/time_to must be HH:MM",
                });
            }
            if (draft.time_from >= draft.time_to) {
                throw new common_1.BadRequestException({
                    code: "AC_SCHEDULE_RANGE",
                    message: "time_from must be earlier than time_to",
                });
            }
            if (draft.kind === "weekly" &&
                (draft.weekday == null || draft.weekday < 0 || draft.weekday > 6)) {
                throw new common_1.BadRequestException({
                    code: "AC_SCHEDULE_WEEKDAY",
                    message: "weekly schedule requires weekday 0..6",
                });
            }
            const timezone = draft.timezone?.trim();
            if (!timezone || !isSupportedTimeZone(timezone)) {
                throw new common_1.BadRequestException({
                    code: "AC_SCHEDULE_TIMEZONE",
                    message: "timezone must be a supported IANA time zone",
                });
            }
        }
        await this.scheduleModel.destroy({
            where: { campaign_uid: campaignUid },
            transaction,
        });
        if (!drafts.length)
            return;
        await this.scheduleModel.bulkCreate(drafts.map((d) => ({
            campaign_uid: campaignUid,
            kind: d.kind,
            weekday: d.kind === "weekly" ? (d.weekday ?? null) : null,
            time_from: d.time_from,
            time_to: d.time_to,
            timezone: d.timezone.trim(),
            date_from: d.date_from ?? null,
            date_to: d.date_to ?? null,
            enabled: d.enabled ?? true,
        })), { transaction });
    }
    async schedulesFor(campaignUids) {
        const out = new Map();
        if (!campaignUids.length)
            return out;
        const rows = await this.scheduleModel.findAll({
            where: { campaign_uid: { [sequelize_2.Op.in]: campaignUids } },
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
    async getOrThrow(userUid, uid, transaction) {
        const row = await this.campaignModel.findOne({
            where: { uid, user_uid: userUid },
            ...(transaction ? { transaction, lock: transaction.LOCK.UPDATE } : {}),
        });
        if (!row) {
            throw new common_1.NotFoundException({
                code: "AC_CAMPAIGN_NOT_FOUND",
                message: "Campaign not found",
            });
        }
        return row;
    }
    async taskCounters(userUid, campaignUids) {
        const out = new Map();
        if (!campaignUids.length)
            return out;
        const rows = (await this.taskModel.findAll({
            attributes: [
                "campaign_uid",
                "status",
                [this.sequelize.fn("COUNT", this.sequelize.col("uid")), "cnt"],
            ],
            where: { user_uid: userUid, campaign_uid: { [sequelize_2.Op.in]: campaignUids } },
            group: ["campaign_uid", "status"],
            raw: true,
        }));
        for (const r of rows) {
            const acc = out.get(r.campaign_uid) ?? { total: 0, pending: 0, done: 0 };
            const cnt = Number(r.cnt) || 0;
            acc.total += cnt;
            if (r.status === "completed" || r.status === "cancelled")
                acc.done += cnt;
            else
                acc.pending += cnt;
            out.set(r.campaign_uid, acc);
        }
        return out;
    }
    /**
     * Agentless campaigns must not end on a queue and operator-backed modes must
     * reach one, otherwise the pacer would reserve agents nobody hands calls to.
     */
    assertScenario(dialMode, queueNames, actions) {
        const list = (Array.isArray(actions) ? actions : []);
        this.assertScenarioCapabilities(list);
        const enabled = list.filter((action) => action && action.enabled !== false);
        const hasQueue = enabled.some((a) => a.type === "toqueue");
        if (dialMode === "agentless") {
            if (hasQueue) {
                throw new common_1.BadRequestException({
                    code: "AC_AGENTLESS_QUEUE",
                    message: "Agentless campaign scenario must not contain a toqueue step",
                });
            }
            return;
        }
        if (enabled.length && !hasQueue) {
            throw new common_1.BadRequestException({
                code: "AC_NO_QUEUE_STEP",
                message: `${dialMode} campaign scenario must end with a toqueue step`,
            });
        }
        if (hasQueue && !queueNames?.length) {
            const inlineQueue = enabled.some((action) => {
                if (action?.type !== "toqueue")
                    return false;
                const params = action.params;
                const target = params?.target;
                return Boolean(params?.queue
                    || (target?.source === "fixed" && String(target.value ?? "").trim()));
            });
            if (!inlineQueue) {
                throw new common_1.BadRequestException({
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
    async assertTrunkPoolConfig(userUid, baseFields, pool) {
        const ids = [...new Set(pool.map((item) => item?.trunk_id?.trim()).filter(Boolean))];
        if (ids.length !== pool.length) {
            throw new common_1.BadRequestException({
                code: "AC_TRUNK_INVALID",
                message: "Each campaign trunk needs a unique id",
            });
        }
        if (ids.length) {
            const owned = await this.endpointModel.findAll({
                attributes: ["id"],
                where: { id: { [sequelize_2.Op.in]: ids }, tenantid: String(userUid) },
            });
            if (owned.length !== ids.length) {
                throw new common_1.BadRequestException({
                    code: "AC_TRUNK_NOT_FOUND",
                    message: "Campaign trunk is unavailable for this organization",
                });
            }
        }
        for (const item of pool) {
            const source = item.caller_id_source;
            if (!source)
                continue;
            if (source.mode === "static")
                continue;
            if (source.mode === "pool") {
                const numbers = Array.isArray(source.numbers)
                    ? source.numbers.map((value) => value.trim()).filter(Boolean)
                    : [];
                if (!numbers.length
                    || new Set(numbers).size !== numbers.length
                    || !["random", "round_robin"].includes(source.pick)) {
                    throw new common_1.BadRequestException({
                        code: "AC_CALLER_ID_SOURCE_INVALID",
                        message: "Caller ID pool needs unique numbers and a pick mode",
                    });
                }
                continue;
            }
            const key = source.key;
            if (!Number.isInteger(source.directory_uid) ||
                !Number.isInteger(source.value_field_uid) ||
                key?.source !== "autodial_field" ||
                !key.field_key?.trim() ||
                source.on_missing !== "fallback") {
                throw new common_1.BadRequestException({
                    code: "AC_CALLER_ID_SOURCE_INVALID",
                    message: "Directory Caller ID needs a directory, value field and contact key",
                });
            }
            if (!baseFields.some((field) => field.key === key.field_key)) {
                throw new common_1.BadRequestException({
                    code: "AC_CALLER_ID_DIRECTORY_INVALID",
                    message: "Caller ID directory key is not a field of this campaign base",
                });
            }
            const directory = await this.directoriesService.findOne(source.directory_uid, userUid);
            const valueField = directory.fields?.find((field) => field.uid === source.value_field_uid);
            if (!valueField || !["phone", "string"].includes(valueField.type)) {
                throw new common_1.BadRequestException({
                    code: "AC_CALLER_ID_DIRECTORY_INVALID",
                    message: "Caller ID value field must be a phone or text field of the directory",
                });
            }
        }
    }
    async assertStoredTrunkPoolConfig(userUid, baseUid, pool) {
        if (!hasDirectoryCallerIdSource(pool)) {
            return this.assertTrunkPoolConfig(userUid, [], pool);
        }
        const base = await this.basesService.findOne(userUid, baseUid);
        return this.assertTrunkPoolConfig(userUid, base.fields ?? [], pool);
    }
    async assertQueueReferences(userUid, queueNames, actions) {
        const names = new Set((queueNames ?? []).map((name) => name.trim()).filter(Boolean));
        for (const action of (actions ?? [])) {
            if (action?.type !== "toqueue" || action.enabled === false)
                continue;
            const params = (action.params ?? {});
            const target = params.target;
            const name = String(params.queue ?? params.queue_name
                ?? (target?.source === "fixed" ? target.value : "") ?? "").trim();
            if (name)
                names.add(name);
        }
        if (!names.size)
            return;
        const owned = await this.queueModel.findAll({
            attributes: ["name"],
            where: { name: { [sequelize_2.Op.in]: [...names] }, user_uid: userUid },
        });
        if (owned.length !== names.size) {
            throw new common_1.BadRequestException({
                code: "AC_QUEUE_NOT_FOUND",
                message: "Campaign queue is unavailable for this organization",
            });
        }
    }
    async assertExtensionReferences(userUid, actions) {
        const ids = new Set();
        for (const action of (actions ?? [])) {
            if (action?.type !== "toexten" || action.enabled === false)
                continue;
            const params = (action.params ?? {});
            const target = params.target;
            const id = String(params.exten ?? params.extension
                ?? (target?.source === "fixed" ? target.value : "") ?? "").trim();
            if (id)
                ids.add(id);
        }
        if (!ids.size)
            return;
        const owned = await this.endpointModel.findAll({
            attributes: ["id"],
            where: { id: { [sequelize_2.Op.in]: [...ids] }, tenantid: String(userUid) },
        });
        if (owned.length !== ids.size) {
            throw new common_1.BadRequestException({
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
    assertScenarioCapabilities(actions) {
        for (const action of actions) {
            if (!action || action.enabled === false)
                continue;
            if (!AUTODIAL_SUPPORTED_ACTIONS.has(action.type)) {
                throw new common_1.BadRequestException({
                    code: "AC_SCENARIO_UNSUPPORTED_ACTION",
                    message: `Autodial does not support scenario step ${action.type}`,
                });
            }
            if (hasScenarioCondition(action.condition)) {
                throw new common_1.BadRequestException({
                    code: "AC_SCENARIO_CONDITION_UNSUPPORTED",
                    message: "Autodial does not support conditional scenario steps yet",
                });
            }
            if (action.type === "toqueue" || action.type === "toexten") {
                const target = action.params?.target;
                if (target != null
                    && (typeof target !== "object"
                        || target.source !== "fixed")) {
                    throw new common_1.BadRequestException({
                        code: "AC_SCENARIO_TARGET_UNSUPPORTED",
                        message: "Autodial supports only a fixed target for this scenario step",
                    });
                }
            }
        }
    }
    toDto(row, schedules, counters) {
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
};
exports.AutodialCampaignsService = AutodialCampaignsService;
exports.AutodialCampaignsService = AutodialCampaignsService = AutodialCampaignsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, sequelize_1.InjectModel)(ac_campaign_model_1.AcCampaign)),
    __param(1, (0, sequelize_1.InjectModel)(ac_schedule_model_1.AcSchedule)),
    __param(2, (0, sequelize_1.InjectModel)(ac_task_model_1.AcTask)),
    __param(3, (0, sequelize_1.InjectModel)(ac_contact_phone_model_1.AcContactPhone)),
    __param(4, (0, sequelize_1.InjectModel)(ac_dnc_model_1.AcDnc)),
    __param(5, (0, sequelize_1.InjectModel)(ps_endpoint_model_1.PsEndpoint)),
    __param(6, (0, sequelize_1.InjectModel)(queue_model_1.Queue)),
    __param(7, (0, sequelize_3.InjectConnection)()),
    __metadata("design:paramtypes", [Object, Object, Object, Object, Object, Object, Object, Function, autodial_bases_service_1.AutodialBasesService,
        directories_service_1.DirectoriesService,
        autodial_dialplan_service_1.AutodialDialplanService])
], AutodialCampaignsService);
/** Exported for the pacer: dispositions that never get re-dialed automatically. */
function isTerminalDisposition(d) {
    return shared_1.AUTODIAL_TERMINAL_DISPOSITIONS.includes(d);
}
function hasScenarioCondition(condition) {
    if (!condition || typeof condition !== "object")
        return false;
    return Object.values(condition).some((value) => {
        if (Array.isArray(value))
            return value.length > 0;
        return value != null && value !== "";
    });
}
/**
 * DTOs intentionally permit a union-shaped source while class-validator checks
 * its individual fields. Convert the transport shape once after those checks
 * instead of leaking DTO-only optional properties into persisted JSON.
 */
function toAutodialTrunkPool(input) {
    return input.map((raw) => {
        const item = raw;
        const source = item.caller_id_source;
        return {
            trunk_id: String(item.trunk_id ?? ""),
            ...(typeof item.caller_id === "string" ? { caller_id: item.caller_id } : {}),
            ...(typeof item.weight === "number" ? { weight: item.weight } : {}),
            ...(typeof item.max_channels === "number" ? { max_channels: item.max_channels } : {}),
            ...(source ? { caller_id_source: source } : {}),
        };
    });
}
function hasDirectoryCallerIdSource(pool) {
    return pool.some((item) => item.caller_id_source?.mode === "directory");
}
//# sourceMappingURL=autodial-campaigns.service.js.map