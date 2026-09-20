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
var AutodialReportsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutodialReportsService = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const sequelize_2 = require("sequelize");
const sequelize_3 = require("@nestjs/sequelize");
const ac_attempt_model_1 = require("./models/ac-attempt.model");
const ac_campaign_model_1 = require("./models/ac-campaign.model");
const ac_task_model_1 = require("./models/ac-task.model");
const ac_contact_model_1 = require("./models/ac-contact.model");
const ac_daily_campaign_stats_model_1 = require("./models/ac-daily-campaign-stats.model");
const autodial_state_service_1 = require("./autodial-state.service");
const autodial_metrics_util_1 = require("./autodial-metrics.util");
const csv_exporter_1 = require("../callcenter/reports/exporters/csv-exporter");
const xlsx_exporter_1 = require("../callcenter/reports/exporters/xlsx-exporter");
const SUMMARY_COLUMNS = [
    { key: 'campaign_name', header: 'Кампания' },
    { key: 'dials', header: 'Наборов' },
    { key: 'answered', header: 'Отвечено' },
    { key: 'success', header: 'Успешно' },
    { key: 'short', header: 'Короткие' },
    { key: 'no_answer', header: 'Не ответили' },
    { key: 'busy', header: 'Занято' },
    { key: 'amd', header: 'Автоответчик' },
    { key: 'failed', header: 'Ошибки' },
    { key: 'contact_rate', header: 'Contact rate, %' },
    { key: 'rpc', header: 'RPC, %' },
    { key: 'aht', header: 'AHT, с' },
    { key: 'acd', header: 'ACD, с' },
    { key: 'calls_per_hour', header: 'Звонков/час' },
];
const DETAIL_COLUMNS = [
    { key: 'campaign_uid', header: 'Кампания' },
    { key: 'task_uid', header: 'Задача' },
    { key: 'attempt_no', header: 'Попытка' },
    { key: 'started_at', header: 'Начало' },
    { key: 'answered_at', header: 'Ответ' },
    { key: 'ended_at', header: 'Завершение' },
    { key: 'duration', header: 'Длительность, с' },
    { key: 'billsec', header: 'Разговор, с' },
    { key: 'disposition', header: 'Статус' },
    { key: 'hangup_cause', header: 'Причина' },
    { key: 'trunk_id', header: 'Транк' },
    { key: 'caller_id', header: 'CallerID' },
    { key: 'queue_name', header: 'Очередь' },
    { key: 'agent_interface', header: 'Оператор' },
    { key: 'amd_result', header: 'AMD' },
];
const DETAIL_ROW_LIMIT = 50_000;
/**
 * Reporting reads from `ac_attempts` for ranges that include today and from the
 * nightly `ac_daily_campaign_stats` rollup for closed days, so a long history
 * never scans the attempt table.
 */
let AutodialReportsService = AutodialReportsService_1 = class AutodialReportsService {
    attemptModel;
    campaignModel;
    taskModel;
    contactModel;
    dailyModel;
    sequelize;
    state;
    logger = new common_1.Logger(AutodialReportsService_1.name);
    constructor(attemptModel, campaignModel, taskModel, contactModel, dailyModel, sequelize, state) {
        this.attemptModel = attemptModel;
        this.campaignModel = campaignModel;
        this.taskModel = taskModel;
        this.contactModel = contactModel;
        this.dailyModel = dailyModel;
        this.sequelize = sequelize;
        this.state = state;
    }
    /** Live monitor payload: durable task counts plus in-memory channel counts. */
    async liveStats(userUid) {
        const campaigns = await this.campaignModel.findAll({
            where: { user_uid: userUid },
            attributes: ['uid', 'status'],
        });
        if (!campaigns.length)
            return [];
        const taskCounts = await this.taskStatusCounts(userUid, campaigns.map((c) => c.uid));
        return campaigns.map((campaign) => {
            const runtime = this.state.ensureRuntime(userUid, campaign.uid);
            const counts = taskCounts.get(campaign.uid) ?? { total: 0, pending: 0, done: 0 };
            return {
                campaign_uid: campaign.uid,
                status: campaign.status,
                active_channels: this.state.activeChannels(campaign.uid),
                reserved: runtime.reserved,
                capacity: runtime.capacity,
                dials_today: runtime.dials,
                answered_today: runtime.answered,
                success_today: runtime.success,
                contact_rate: runtime.dials ? Math.round((runtime.answered / runtime.dials) * 1000) / 10 : 0,
                asr: runtime.dials ? Math.round((runtime.answered / runtime.dials) * 1000) / 10 : 0,
                tasks_pending: counts.pending,
                tasks_done: counts.done,
                tasks_total: counts.total,
            };
        });
    }
    async summary(userUid, range) {
        const campaigns = await this.campaignsFor(userUid, range.campaignUids);
        if (!campaigns.size)
            return [];
        const rows = (await this.sequelize.query(`SELECT campaign_uid,
              COUNT(*)                                                    AS dials,
              SUM(answered_at IS NOT NULL)                                AS answered,
              SUM(disposition = 'success')                                AS success,
              SUM(disposition = 'answered_short')                         AS short_calls,
              SUM(disposition = 'no_answer')                              AS no_answer,
              SUM(disposition = 'busy')                                   AS busy,
              SUM(disposition IN ('amd_machine','voicemail'))              AS amd,
              SUM(disposition IN ('failed','congestion','invalid_number')) AS failed,
              COALESCE(SUM(talk_sec), 0)                                  AS talk_sec_sum,
              COALESCE(SUM(billsec), 0)                                   AS billsec_sum,
              COUNT(DISTINCT CASE WHEN answered_at IS NOT NULL THEN task_uid END) AS reached,
              COUNT(DISTINCT task_uid)                                    AS attempted,
              TIMESTAMPDIFF(SECOND, MIN(started_at), MAX(COALESCE(ended_at, started_at))) AS active_sec
         FROM ac_attempts
        WHERE vpbx_user_uid = :userUid
          AND campaign_uid IN (:campaignUids)
          AND started_at >= :from
          AND started_at < :to
        GROUP BY campaign_uid`, {
            replacements: {
                userUid,
                campaignUids: [...campaigns.keys()],
                from: range.from,
                to: this.exclusiveEnd(range.to),
            },
            type: sequelize_2.QueryTypes.SELECT,
        }));
        const contactTotals = await this.contactTotals(userUid, campaigns);
        return rows.map((raw) => {
            const campaignUid = Number(raw.campaign_uid);
            const dials = num(raw.dials);
            const answered = num(raw.answered);
            const success = num(raw.success);
            const short = num(raw.short_calls);
            return {
                campaign_uid: campaignUid,
                campaign_name: campaigns.get(campaignUid)?.name ?? `#${campaignUid}`,
                dials,
                answered,
                success,
                short,
                no_answer: num(raw.no_answer),
                busy: num(raw.busy),
                amd: num(raw.amd),
                failed: num(raw.failed),
                talk_sec_sum: num(raw.talk_sec_sum),
                billsec_sum: num(raw.billsec_sum),
                kpi: (0, autodial_metrics_util_1.computeAutodialKpi)({
                    dials,
                    answered,
                    success,
                    short,
                    // Answered but never handed to an agent — the dialer's own abandons.
                    abandoned: Math.max(0, answered - success - short),
                    talkSecSum: num(raw.talk_sec_sum),
                    billsecSum: num(raw.billsec_sum),
                    contactsReached: num(raw.reached),
                    contactsTotal: contactTotals.get(campaignUid) ?? 0,
                    contactsAttempted: num(raw.attempted),
                    activeSec: Math.max(0, num(raw.active_sec)),
                }),
            };
        });
    }
    /** Daily series for the charts, served from the rollup table. */
    async daily(userUid, range) {
        const where = {
            user_uid: userUid,
            day: { [sequelize_2.Op.gte]: range.from, [sequelize_2.Op.lte]: range.to },
        };
        if (range.campaignUids?.length) {
            where.campaign_uid = { [sequelize_2.Op.in]: range.campaignUids };
        }
        return this.dailyModel.findAll({
            where,
            order: [
                ['day', 'ASC'],
                ['campaign_uid', 'ASC'],
            ],
        });
    }
    async detail(userUid, range) {
        const where = {
            user_uid: userUid,
            started_at: { [sequelize_2.Op.gte]: range.from, [sequelize_2.Op.lt]: this.exclusiveEnd(range.to) },
        };
        if (range.campaignUids?.length) {
            where.campaign_uid = { [sequelize_2.Op.in]: range.campaignUids };
        }
        const rows = await this.attemptModel.findAll({
            where,
            order: [['uid', 'DESC']],
            limit: DETAIL_ROW_LIMIT,
        });
        return rows.map((r) => ({
            attempt_uid: r.uid,
            campaign_uid: r.campaign_uid,
            task_uid: r.task_uid,
            attempt_no: r.attempt_no,
            started_at: r.started_at.toISOString(),
            answered_at: r.answered_at?.toISOString() ?? null,
            ended_at: r.ended_at?.toISOString() ?? null,
            duration: r.duration,
            billsec: r.billsec,
            disposition: r.disposition,
            hangup_cause: r.hangup_cause,
            trunk_id: r.trunk_id,
            caller_id: r.caller_id,
            queue_name: r.queue_name,
            agent_interface: r.agent_interface,
            amd_result: r.amd_result,
        }));
    }
    // ── export ────────────────────────────────────────────────────────
    async exportSummary(userUid, range, format) {
        const rows = (await this.summary(userUid, range)).map((r) => ({
            ...r,
            ...r.kpi,
            kpi: undefined,
        }));
        return this.export('autodial-summary', SUMMARY_COLUMNS, rows, format);
    }
    async exportDetail(userUid, range, format) {
        const rows = await this.detail(userUid, range);
        return this.export('autodial-detail', DETAIL_COLUMNS, rows, format);
    }
    async export(name, columns, rows, format) {
        if (format === 'xlsx') {
            return {
                body: await (0, xlsx_exporter_1.buildReportXlsx)(name, columns, rows),
                contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                filename: `${name}.xlsx`,
            };
        }
        return {
            body: (0, csv_exporter_1.buildReportCsv)(columns, rows),
            contentType: 'text/csv; charset=utf-8',
            filename: `${name}.csv`,
        };
    }
    // ── helpers ───────────────────────────────────────────────────────
    async campaignsFor(userUid, campaignUids) {
        const where = { user_uid: userUid };
        if (campaignUids?.length)
            where.uid = { [sequelize_2.Op.in]: campaignUids };
        const rows = await this.campaignModel.findAll({
            where,
            attributes: ['uid', 'name', 'base_uid'],
        });
        return new Map(rows.map((r) => [r.uid, { name: r.name, base_uid: r.base_uid }]));
    }
    async contactTotals(userUid, campaigns) {
        const out = new Map();
        const byBase = new Map();
        for (const [campaignUid, { base_uid }] of campaigns) {
            let total = byBase.get(base_uid);
            if (total == null) {
                total = await this.contactModel.count({
                    where: { base_uid, user_uid: userUid },
                });
                byBase.set(base_uid, total);
            }
            out.set(campaignUid, total);
        }
        return out;
    }
    async taskStatusCounts(userUid, campaignUids) {
        const out = new Map();
        const rows = (await this.taskModel.findAll({
            attributes: [
                'campaign_uid',
                'status',
                [this.sequelize.fn('COUNT', this.sequelize.col('uid')), 'cnt'],
            ],
            where: { user_uid: userUid, campaign_uid: { [sequelize_2.Op.in]: campaignUids } },
            group: ['campaign_uid', 'status'],
            raw: true,
        }));
        for (const r of rows) {
            const acc = out.get(r.campaign_uid) ?? { total: 0, pending: 0, done: 0 };
            const cnt = Number(r.cnt) || 0;
            acc.total += cnt;
            if (r.status === 'completed' || r.status === 'cancelled')
                acc.done += cnt;
            else
                acc.pending += cnt;
            out.set(r.campaign_uid, acc);
        }
        return out;
    }
    /** Callers pass an inclusive date; SQL wants an exclusive upper bound. */
    exclusiveEnd(to) {
        return /^\d{4}-\d{2}-\d{2}$/.test(to) ? `${to} 23:59:59` : to;
    }
};
exports.AutodialReportsService = AutodialReportsService;
exports.AutodialReportsService = AutodialReportsService = AutodialReportsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, sequelize_1.InjectModel)(ac_attempt_model_1.AcAttempt)),
    __param(1, (0, sequelize_1.InjectModel)(ac_campaign_model_1.AcCampaign)),
    __param(2, (0, sequelize_1.InjectModel)(ac_task_model_1.AcTask)),
    __param(3, (0, sequelize_1.InjectModel)(ac_contact_model_1.AcContact)),
    __param(4, (0, sequelize_1.InjectModel)(ac_daily_campaign_stats_model_1.AcDailyCampaignStats)),
    __param(5, (0, sequelize_3.InjectConnection)()),
    __metadata("design:paramtypes", [Object, Object, Object, Object, Object, Function, autodial_state_service_1.AutodialStateService])
], AutodialReportsService);
function num(value) {
    const n = Number(value ?? 0);
    return Number.isFinite(n) ? n : 0;
}
//# sourceMappingURL=autodial-reports.service.js.map