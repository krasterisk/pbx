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
var AutodialReconcilerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutodialReconcilerService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const sequelize_1 = require("@nestjs/sequelize");
const sequelize_2 = require("sequelize");
const cdr_model_1 = require("../reports/cdr/cdr.model");
const ac_attempt_model_1 = require("./models/ac-attempt.model");
const ac_campaign_model_1 = require("./models/ac-campaign.model");
const autodial_attempt_service_1 = require("./autodial-attempt.service");
const autodial_state_service_1 = require("./autodial-state.service");
const autodial_disposition_util_1 = require("./autodial-disposition.util");
/**
 * Third and last line of defence for attempt outcomes, after ARI events and the
 * dialplan hangup handler: any attempt still `dialing` well past its dial
 * timeout gets closed from CDR, or marked failed if CDR has nothing either.
 *
 * Without this, a backend restart mid-call leaves the task stuck forever —
 * exactly the bug the existing callback-requests module suffers from.
 */
let AutodialReconcilerService = class AutodialReconcilerService {
    static { AutodialReconcilerService_1 = this; }
    attemptModel;
    campaignModel;
    cdrModel;
    attempts;
    state;
    logger = new common_1.Logger(AutodialReconcilerService_1.name);
    /** Generous margin over the longest plausible dial + talk time. */
    static STALE_AFTER_MS = 6 * 60 * 60 * 1000;
    constructor(attemptModel, campaignModel, cdrModel, attempts, state) {
        this.attemptModel = attemptModel;
        this.campaignModel = campaignModel;
        this.cdrModel = cdrModel;
        this.attempts = attempts;
        this.state = state;
    }
    async reconcileStale() {
        try {
            const cutoff = new Date(Date.now() - AutodialReconcilerService_1.STALE_AFTER_MS);
            const stale = await this.attempts.findStaleAttempts(cutoff);
            if (!stale.length)
                return;
            for (const attempt of stale) {
                // A channel still in live state is a long call, not a lost one.
                if (attempt.channel_id && this.state.getChannel(attempt.channel_id))
                    continue;
                await this.closeFromCdr(attempt);
            }
            this.logger.log(`Reconciled ${stale.length} stale autodial attempt(s)`);
        }
        catch (e) {
            this.logger.error(`Autodial reconcile failed: ${e.message}`);
        }
    }
    async closeFromCdr(attempt) {
        const cdr = await this.findCdr(attempt);
        if (!cdr) {
            await this.attempts.finalize({
                attemptUid: attempt.uid,
                disposition: 'failed',
                hangupCause: 'reconciled_no_cdr',
            });
            return;
        }
        const campaign = await this.campaignModel.findByPk(attempt.campaign_uid, {
            attributes: ['success_min_sec'],
        });
        const disposition = cdr.billsec > 0
            ? (0, autodial_disposition_util_1.dispositionFromAnsweredCall)({
                billsec: cdr.billsec,
                successMinSec: campaign?.success_min_sec ?? 15,
                amdResult: attempt.amd_result,
            })
            : cdrDispositionToAutodial(cdr.disposition);
        await this.attempts.finalize({
            attemptUid: attempt.uid,
            disposition,
            hangupCause: `cdr:${cdr.disposition}`,
            billsec: cdr.billsec,
            duration: cdr.duration,
            talkSec: cdr.billsec,
            uniqueid: cdr.uniqueid,
            linkedid: cdr.linkedid,
            answeredAt: cdr.billsec > 0 ? attempt.started_at : null,
        });
    }
    /**
     * Match on uniqueid/linkedid when the dialplan reported them, otherwise fall
     * back to the channel name Asterisk derives from our ARI channel id.
     */
    async findCdr(attempt) {
        if (attempt.uniqueid) {
            const byId = await this.cdrModel.findOne({ where: { uniqueid: attempt.uniqueid } });
            if (byId)
                return byId;
        }
        if (attempt.linkedid) {
            const byLinked = await this.cdrModel.findOne({
                where: { linkedid: attempt.linkedid },
                order: [['calldate', 'ASC']],
            });
            if (byLinked)
                return byLinked;
        }
        if (!attempt.channel_id)
            return null;
        return this.cdrModel.findOne({
            where: { channel: { [sequelize_2.Op.like]: `%${attempt.channel_id}%` } },
        });
    }
};
exports.AutodialReconcilerService = AutodialReconcilerService;
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_10_MINUTES),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AutodialReconcilerService.prototype, "reconcileStale", null);
exports.AutodialReconcilerService = AutodialReconcilerService = AutodialReconcilerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, sequelize_1.InjectModel)(ac_attempt_model_1.AcAttempt)),
    __param(1, (0, sequelize_1.InjectModel)(ac_campaign_model_1.AcCampaign)),
    __param(2, (0, sequelize_1.InjectModel)(cdr_model_1.Cdr)),
    __metadata("design:paramtypes", [Object, Object, Object, autodial_attempt_service_1.AutodialAttemptService,
        autodial_state_service_1.AutodialStateService])
], AutodialReconcilerService);
function cdrDispositionToAutodial(disposition) {
    switch (disposition?.toUpperCase()) {
        case 'ANSWERED':
            return 'answered_short';
        case 'BUSY':
            return 'busy';
        case 'NO ANSWER':
        case 'NOANSWER':
            return 'no_answer';
        case 'CONGESTION':
            return 'congestion';
        default:
            return 'failed';
    }
}
//# sourceMappingURL=autodial-reconciler.service.js.map