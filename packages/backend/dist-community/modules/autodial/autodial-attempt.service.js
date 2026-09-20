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
var AutodialAttemptService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutodialAttemptService = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const sequelize_2 = require("sequelize");
const ac_attempt_model_1 = require("./models/ac-attempt.model");
const ac_task_model_1 = require("./models/ac-task.model");
const ac_campaign_model_1 = require("./models/ac-campaign.model");
const autodial_disposition_util_1 = require("./autodial-disposition.util");
const autodial_predictive_util_1 = require("./autodial-predictive.util");
const autodial_state_service_1 = require("./autodial-state.service");
/**
 * Owns the write side of an attempt: opening a row before the channel exists,
 * then closing it and scheduling (or not) the next try.
 */
let AutodialAttemptService = AutodialAttemptService_1 = class AutodialAttemptService {
    attemptModel;
    taskModel;
    campaignModel;
    state;
    logger = new common_1.Logger(AutodialAttemptService_1.name);
    constructor(attemptModel, taskModel, campaignModel, state) {
        this.attemptModel = attemptModel;
        this.taskModel = taskModel;
        this.campaignModel = campaignModel;
        this.state = state;
    }
    /**
     * Persisted before the ARI call so a crash between origination and the first
     * event still leaves a row the reconciler can close.
     */
    async openAttempt(params) {
        return this.attemptModel.create({
            user_uid: params.userUid,
            task_uid: params.taskUid,
            campaign_uid: params.campaignUid,
            attempt_no: params.attemptNo,
            started_at: new Date(),
            disposition: 'dialing',
            channel_id: params.channelId,
            trunk_id: params.trunkId,
            caller_id: params.callerId,
        });
    }
    /**
     * Close the attempt and re-arm or retire the task. Idempotent: a second call
     * for an already-closed attempt is ignored, because ARI ChannelDestroyed and
     * the dialplan hangup handler both report the same call.
     */
    async finalize(input) {
        const attempt = await this.attemptModel.findByPk(input.attemptUid);
        if (!attempt) {
            this.logger.warn(`finalize: attempt ${input.attemptUid} not found`);
            return;
        }
        const now = new Date();
        const disposition = attempt.amd_result === 'MACHINE' ? 'amd_machine' : input.disposition;
        const patch = {
            ended_at: now,
            disposition,
            duration: input.duration ?? Math.round((now.getTime() - attempt.started_at.getTime()) / 1000),
        };
        if (input.answeredAt !== undefined)
            patch.answered_at = input.answeredAt;
        if (input.hangupCause !== undefined)
            patch.hangup_cause = input.hangupCause;
        if (input.billsec !== undefined)
            patch.billsec = input.billsec;
        if (input.amdResult !== undefined)
            patch.amd_result = input.amdResult;
        if (input.queueName !== undefined)
            patch.queue_name = input.queueName;
        if (input.agentInterface !== undefined)
            patch.agent_interface = input.agentInterface;
        if (input.talkSec !== undefined)
            patch.talk_sec = input.talkSec;
        if (input.uniqueid !== undefined)
            patch.uniqueid = input.uniqueid;
        if (input.linkedid !== undefined)
            patch.linkedid = input.linkedid;
        if (input.scenarioResult !== undefined)
            patch.scenario_result = input.scenarioResult;
        // ARI destroy and the dialplan hangup handler can race. Only the request
        // that atomically moves `dialing` to a terminal disposition advances task.
        const [updated] = await this.attemptModel.update(patch, {
            where: { uid: attempt.uid, disposition: 'dialing' },
        });
        if (!updated)
            return;
        this.recordPredictiveOutcome(attempt, { ...input, disposition });
        await this.advanceTask(attempt.task_uid, disposition, input.hangupCause ?? null);
    }
    /**
     * Mark a confirmed AMD machine result while the channel is still alive. The
     * machine dialplan tail invokes this before Hangup so the ARI finalizer can
     * atomically retain the correct terminal disposition.
     */
    async markAmdMachine(attemptUid) {
        await this.attemptModel.update({ amd_result: 'MACHINE' }, { where: { uid: attemptUid, disposition: 'dialing' } });
    }
    /** Persist answer evidence so a replacement worker can classify Destroy. */
    async markAnswered(channelId, answeredAt) {
        await this.attemptModel.update({ answered_at: answeredAt }, { where: { channel_id: channelId, disposition: 'dialing', answered_at: null } });
    }
    async findOpenByChannelId(channelId) {
        return this.attemptModel.findOne({
            where: { channel_id: channelId, disposition: 'dialing' },
        });
    }
    /**
     * Atomically fence a leased task before ARI receives an originate request.
     * A competing worker can only proceed when it still owns `leased_by`; the
     * attempt and the `dialing` state are committed together, so a crash cannot
     * leave either a live attempt without a task transition or vice versa.
     */
    async claimAndOpenAttempt(params) {
        const sequelize = this.taskModel.sequelize;
        if (!sequelize)
            throw new Error('Autodial task model is not connected to Sequelize');
        return sequelize.transaction(async (transaction) => {
            const [claimed] = await this.taskModel.update({
                status: 'dialing',
                attempt_count: params.attemptNo,
                last_disposition: 'dialing',
            }, {
                where: {
                    uid: params.taskUid,
                    user_uid: params.userUid,
                    status: 'leased',
                    leased_by: params.leaseId,
                },
                transaction,
            });
            if (!claimed)
                return null;
            return this.attemptModel.create({
                user_uid: params.userUid,
                task_uid: params.taskUid,
                campaign_uid: params.campaignUid,
                attempt_no: params.attemptNo,
                started_at: new Date(),
                disposition: 'dialing',
                channel_id: params.channelId,
                trunk_id: params.trunkId,
                caller_id: params.callerId,
            }, { transaction });
        });
    }
    /**
     * Feed the predictive controller. The hangup handler normally reports the
     * answering agent before ARI destroys the channel, but if that report is
     * late the call counts as abandoned — a bias that slows dialing down rather
     * than speeding it up, which is the safe direction for abandon rate.
     */
    recordPredictiveOutcome(attempt, input) {
        const answered = Boolean(input.answeredAt ?? attempt.answered_at);
        if (!answered)
            return;
        const abandoned = (0, autodial_predictive_util_1.isAbandonedOutcome)({
            answered,
            agentInterface: input.agentInterface ?? attempt.agent_interface,
            disposition: input.disposition,
        });
        this.state.recordAnsweredOutcome(attempt.campaign_uid, abandoned);
    }
    /** Enrich an attempt with post-answer data reported by the dialplan. */
    async applyScenarioResult(attemptUid, data) {
        const attempt = await this.attemptModel.findByPk(attemptUid);
        if (!attempt)
            return;
        await attempt.update({
            amd_result: data.amdResult ?? attempt.amd_result,
            queue_name: data.queueName ?? attempt.queue_name,
            agent_interface: data.agentInterface ?? attempt.agent_interface,
            billsec: data.billsec ?? attempt.billsec,
            talk_sec: data.talkSec ?? attempt.talk_sec,
            uniqueid: data.uniqueid ?? attempt.uniqueid,
            linkedid: data.linkedid ?? attempt.linkedid,
            scenario_result: data.scenarioResult ?? attempt.scenario_result,
        });
    }
    async advanceTask(taskUid, disposition, cause) {
        const task = await this.taskModel.findByPk(taskUid);
        if (!task)
            return;
        const retryConfig = await this.retryConfigFor(task.campaign_uid);
        const decision = (0, autodial_disposition_util_1.decideRetry)({
            disposition,
            attemptCount: task.attempt_count,
            retry: retryConfig,
            now: new Date(),
        });
        await task.update({
            status: decision.retry ? 'pending' : 'completed',
            last_disposition: decision.disposition,
            last_cause: cause,
            next_attempt_at: decision.nextAttemptAt ?? null,
            leased_by: null,
            leased_at: null,
        });
    }
    async retryConfigFor(campaignUid) {
        const campaign = await this.campaignModel.findByPk(campaignUid, { attributes: ['retry'] });
        return (campaign?.retry ?? { max_attempts: 3, default_interval_sec: 3600, intervals_sec: {} });
    }
    /** Attempts still marked `dialing` past the cutoff — a crash or a lost event. */
    async findStaleAttempts(olderThan) {
        return this.attemptModel.findAll({
            where: { disposition: 'dialing', started_at: { [sequelize_2.Op.lt]: olderThan } },
            limit: 500,
        });
    }
};
exports.AutodialAttemptService = AutodialAttemptService;
exports.AutodialAttemptService = AutodialAttemptService = AutodialAttemptService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, sequelize_1.InjectModel)(ac_attempt_model_1.AcAttempt)),
    __param(1, (0, sequelize_1.InjectModel)(ac_task_model_1.AcTask)),
    __param(2, (0, sequelize_1.InjectModel)(ac_campaign_model_1.AcCampaign)),
    __metadata("design:paramtypes", [Object, Object, Object, autodial_state_service_1.AutodialStateService])
], AutodialAttemptService);
//# sourceMappingURL=autodial-attempt.service.js.map