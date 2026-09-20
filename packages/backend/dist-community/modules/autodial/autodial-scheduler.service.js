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
var AutodialSchedulerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutodialSchedulerService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const sequelize_1 = require("@nestjs/sequelize");
const sequelize_2 = require("sequelize");
const ac_campaign_model_1 = require("./models/ac-campaign.model");
const ac_schedule_model_1 = require("./models/ac-schedule.model");
const ac_task_model_1 = require("./models/ac-task.model");
const autodial_schedule_util_1 = require("./autodial-schedule.util");
/**
 * Moves campaigns in and out of `running` according to their calendar, and
 * marks a campaign `completed` once no dialable task is left.
 *
 * Only campaigns the calendar itself paused are auto-resumed: a manual pause
 * sticks until an operator resumes it.
 */
let AutodialSchedulerService = AutodialSchedulerService_1 = class AutodialSchedulerService {
    campaignModel;
    scheduleModel;
    taskModel;
    logger = new common_1.Logger(AutodialSchedulerService_1.name);
    calendarPaused = new Set();
    constructor(campaignModel, scheduleModel, taskModel) {
        this.campaignModel = campaignModel;
        this.scheduleModel = scheduleModel;
        this.taskModel = taskModel;
    }
    async tick() {
        try {
            await this.applyCalendar(new Date());
        }
        catch (e) {
            this.logger.error(`Autodial scheduler tick failed: ${e.message}`);
        }
    }
    async applyCalendar(now) {
        const campaigns = await this.campaignModel.findAll({
            where: { status: { [sequelize_2.Op.in]: ['running', 'paused', 'scheduled'] } },
        });
        if (!campaigns.length)
            return;
        const schedules = await this.schedulesByCampaign(campaigns.map((c) => c.uid));
        for (const campaign of campaigns) {
            const rows = schedules.get(campaign.uid) ?? [];
            const open = (0, autodial_schedule_util_1.campaignWindowOpen)(rows, now);
            if (campaign.status === 'running' && !open) {
                await campaign.update({ status: 'paused' });
                this.calendarPaused.add(campaign.uid);
                this.logger.log(`Campaign ${campaign.uid} paused — outside its dialing window`);
                continue;
            }
            if (campaign.status !== 'running' && open) {
                const autoResumable = campaign.status === 'scheduled' || this.calendarPaused.has(campaign.uid);
                if (autoResumable) {
                    await campaign.update({ status: 'running' });
                    this.calendarPaused.delete(campaign.uid);
                    this.logger.log(`Campaign ${campaign.uid} resumed — inside its dialing window`);
                }
                continue;
            }
            if (campaign.status === 'running') {
                await this.completeIfDrained(campaign);
            }
        }
    }
    /** A running campaign with nothing left to dial becomes `completed`. */
    async completeIfDrained(campaign) {
        const remaining = await this.taskModel.count({
            where: {
                campaign_uid: campaign.uid,
                user_uid: campaign.user_uid,
                status: { [sequelize_2.Op.in]: ['pending', 'leased', 'dialing'] },
            },
        });
        if (remaining > 0)
            return;
        const total = await this.taskModel.count({
            where: { campaign_uid: campaign.uid, user_uid: campaign.user_uid },
        });
        if (total === 0)
            return;
        await campaign.update({ status: 'completed' });
        this.calendarPaused.delete(campaign.uid);
        this.logger.log(`Campaign ${campaign.uid} completed — no tasks left`);
    }
    async schedulesByCampaign(campaignUids) {
        const out = new Map();
        const rows = await this.scheduleModel.findAll({
            where: { campaign_uid: { [sequelize_2.Op.in]: campaignUids } },
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
};
exports.AutodialSchedulerService = AutodialSchedulerService;
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_MINUTE),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AutodialSchedulerService.prototype, "tick", null);
exports.AutodialSchedulerService = AutodialSchedulerService = AutodialSchedulerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, sequelize_1.InjectModel)(ac_campaign_model_1.AcCampaign)),
    __param(1, (0, sequelize_1.InjectModel)(ac_schedule_model_1.AcSchedule)),
    __param(2, (0, sequelize_1.InjectModel)(ac_task_model_1.AcTask)),
    __metadata("design:paramtypes", [Object, Object, Object])
], AutodialSchedulerService);
//# sourceMappingURL=autodial-scheduler.service.js.map