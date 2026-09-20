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
var AutodialOriginatorService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutodialOriginatorService = void 0;
const common_1 = require("@nestjs/common");
const event_emitter_1 = require("@nestjs/event-emitter");
const sequelize_1 = require("@nestjs/sequelize");
const ari_http_client_service_1 = require("../ari/ari-http-client.service");
const directories_service_1 = require("../directories/directories.service");
const ac_campaign_model_1 = require("./models/ac-campaign.model");
const ac_contact_model_1 = require("./models/ac-contact.model");
const ac_contact_phone_model_1 = require("./models/ac-contact-phone.model");
const ac_base_field_model_1 = require("./models/ac-base-field.model");
const ac_task_model_1 = require("./models/ac-task.model");
const autodial_attempt_service_1 = require("./autodial-attempt.service");
const autodial_dnc_service_1 = require("./autodial-dnc.service");
const autodial_state_service_1 = require("./autodial-state.service");
const autodial_phone_util_1 = require("./autodial-phone.util");
const autodial_dialplan_util_1 = require("./autodial-dialplan.util");
const autodial_trunk_util_1 = require("./autodial-trunk.util");
const autodial_contact_variables_util_1 = require("./autodial-contact-variables.util");
const autodial_disposition_util_1 = require("./autodial-disposition.util");
/**
 * Originates calls over ARI and turns ARI channel events into dispositions.
 *
 * The channel id is ours (`ac-{campaign}-{task}-{attempt}`), which is the whole
 * reason for choosing ARI over AMI Originate: correlation needs no guessing.
 */
let AutodialOriginatorService = AutodialOriginatorService_1 = class AutodialOriginatorService {
    ari;
    campaignModel;
    contactModel;
    phoneModel;
    fieldModel;
    taskModel;
    attempts;
    dnc;
    directories;
    state;
    logger = new common_1.Logger(AutodialOriginatorService_1.name);
    /** channelId → attempt uid, so events do not need a DB round trip */
    attemptByChannel = new Map();
    /** A channel may surface both StasisStart and ChannelStateChange(Up). */
    handedOffChannels = new Set();
    constructor(ari, campaignModel, contactModel, phoneModel, fieldModel, taskModel, attempts, dnc, directories, state) {
        this.ari = ari;
        this.campaignModel = campaignModel;
        this.contactModel = contactModel;
        this.phoneModel = phoneModel;
        this.fieldModel = fieldModel;
        this.taskModel = taskModel;
        this.attempts = attempts;
        this.dnc = dnc;
        this.directories = directories;
        this.state = state;
    }
    /**
     * Dial one leased task. Returns false when the task could not be dialed at
     * all, so the pacer can release the reservation immediately.
     */
    async originate(task, campaign, allowedTrunkIds, leaseId) {
        const phone = await this.phoneModel.findOne({
            where: { uid: task.phone_uid, base_uid: campaign.base_uid },
        });
        if (!phone?.normalized) {
            await this.failTask(task, 'invalid_number', 'no normalized phone');
            return false;
        }
        // Tasks can have been generated before an operator adds this number to DNC.
        // Re-check immediately before creating an attempt; calls already handed to
        // ARI are deliberately not interrupted by a later DNC change.
        if (await this.dnc.isBlocked(campaign.user_uid, phone.normalized, {
            campaignUid: campaign.uid,
            baseUid: campaign.base_uid,
        })) {
            await this.failTask(task, 'dnc', 'blocked by dnc');
            return false;
        }
        const target = (0, autodial_trunk_util_1.selectAutodialTrunk)(campaign.trunk_pool, campaign.cid_policy, phone.normalized, task.uid + task.attempt_count, allowedTrunkIds);
        if (!target) {
            await this.failTask(task, 'failed', 'no trunk in pool');
            return false;
        }
        const attemptNo = task.attempt_count + 1;
        const channelId = (0, autodial_phone_util_1.buildAutodialChannelId)(campaign.uid, task.uid, attemptNo);
        const { variables, contactValues } = await this.buildChannelVariables(task, campaign, phone.normalized);
        const callerId = await this.resolveCallerId(target, campaign, contactValues);
        // A pacer can lose a stale lease while it is resolving DNC, directories or
        // caller ID. Re-check ownership immediately before opening the call. This
        // is deliberately conditional: another worker may now own the task.
        if (leaseId && task.leased_by !== leaseId)
            return false;
        const attemptInput = {
            userUid: campaign.user_uid,
            taskUid: task.uid,
            campaignUid: campaign.uid,
            attemptNo,
            channelId,
            trunkId: target.trunkId,
            callerId,
        };
        const attempt = leaseId
            ? await this.attempts.claimAndOpenAttempt({ ...attemptInput, leaseId })
            : await this.attempts.openAttempt(attemptInput);
        if (!attempt)
            return false;
        if (!leaseId) {
            await task.update({ status: 'dialing', attempt_count: attemptNo, last_disposition: 'dialing' });
        }
        // Register durable and in-memory correlation before the first ARI request.
        // Originate can emit channel events before its HTTP response resolves.
        this.attemptByChannel.set(channelId, attempt.uid);
        this.state.addChannel({
            channelId,
            campaignUid: campaign.uid,
            taskUid: task.uid,
            attemptUid: attempt.uid,
            attemptNo,
            userUid: campaign.user_uid,
            number: phone.normalized,
            trunkId: target.trunkId,
            startedAt: Date.now(),
            answeredAt: null,
        });
        try {
            await this.ari.originateChannel({
                endpoint: target.endpoint,
                app: this.ari.getAutodialAppName(),
                appArgs: `autodial-v1,${campaign.uid},${task.uid}`,
                channelId,
                ...(callerId ? { callerId } : {}),
                timeout: campaign.dial_timeout_sec,
                variables: {
                    ...variables,
                    KRSK_AC_TASK: String(task.uid),
                    KRSK_AC_ATTEMPT: String(attempt.uid),
                    KRSK_AC_CAMPAIGN: String(campaign.uid),
                },
            });
            return true;
        }
        catch (e) {
            const message = e.message;
            this.logger.error(`Originate failed for task ${task.uid}: ${message}`);
            this.attemptByChannel.delete(channelId);
            this.state.removeChannel(channelId, 'failed');
            await this.attempts.finalize({
                attemptUid: attempt.uid,
                disposition: 'failed',
                hangupCause: message.slice(0, 64),
            });
            return false;
        }
    }
    // ── ARI events ────────────────────────────────────────────────────
    async onChannelStateChange(event) {
        const channelId = event.channel?.id;
        if (!channelId || !channelId.startsWith('ac-'))
            return;
        if (event.channel?.state !== 'Up')
            return;
        await this.handOffAnsweredChannel(channelId);
    }
    async onStasisStart(event) {
        const channelId = event.channel?.id;
        if (!channelId || !channelId.startsWith('ac-'))
            return;
        const parsed = (0, autodial_phone_util_1.parseAutodialChannelId)(channelId);
        if (!parsed)
            return;
        if (event.channel?.state === 'Up') {
            await this.handOffAnsweredChannel(channelId, parsed.campaignUid);
        }
    }
    async onChannelDestroyed(event) {
        const channelId = event.channel?.id;
        if (!channelId || !channelId.startsWith('ac-'))
            return;
        const live = this.state.getChannel(channelId);
        const persisted = live || this.attemptByChannel.has(channelId)
            ? null
            : await this.attempts.findOpenByChannelId(channelId);
        const attemptUid = this.attemptByChannel.get(channelId)
            ?? live?.attemptUid
            ?? persisted?.uid;
        this.attemptByChannel.delete(channelId);
        this.handedOffChannels.delete(channelId);
        const cause = Number(event.cause ?? 0);
        const answeredAt = live?.answeredAt
            ? new Date(live.answeredAt)
            : persisted?.answered_at ?? null;
        const billsec = answeredAt ? Math.round((Date.now() - answeredAt.getTime()) / 1000) : 0;
        let disposition = (0, autodial_disposition_util_1.dispositionFromHangupCause)(cause);
        if (answeredAt) {
            const campaignUid = live?.campaignUid ?? persisted?.campaign_uid;
            const campaign = campaignUid != null
                ? await this.campaignModel.findByPk(campaignUid, { attributes: ['success_min_sec'] })
                : null;
            disposition = (0, autodial_disposition_util_1.dispositionFromAnsweredCall)({
                billsec,
                successMinSec: campaign?.success_min_sec ?? 15,
            });
        }
        this.state.removeChannel(channelId, disposition);
        if (attemptUid == null)
            return;
        await this.attempts.finalize({
            attemptUid,
            disposition,
            hangupCause: event.cause_txt ?? String(cause),
            billsec,
            answeredAt,
        });
    }
    /**
     * Contact fields as inheritable channel variables. `__` prefix so Local and
     * queue-member child channels see the same data the scenario reads.
     */
    async buildChannelVariables(task, campaign, number) {
        const vars = { KRSK_AC_NUMBER: number };
        const [contact, fields] = await Promise.all([
            this.contactModel.findOne({
                where: { uid: task.contact_uid, base_uid: campaign.base_uid },
            }),
            this.fieldModel.findAll({ where: { base_uid: campaign.base_uid } }),
        ]);
        if (!contact)
            return { variables: vars, contactValues: {} };
        Object.assign(vars, (0, autodial_contact_variables_util_1.autodialContactVariables)(fields, contact.values ?? {}, number));
        return { variables: vars, contactValues: contact.values ?? {} };
    }
    /**
     * Directory Caller ID is deliberately resolved in the dialer, not in a
     * generated dialplan. The key is an explicit outbound contact field, and a
     * failed lookup falls back to the configured per-trunk/legacy value so a
     * temporary directory issue cannot silently drop a queued call.
     */
    async resolveCallerId(target, campaign, contactValues) {
        const source = target.callerIdSource;
        if (source?.mode !== 'directory')
            return target.callerId;
        const lookupValue = String(contactValues[source.key.field_key] ?? '').trim();
        if (!lookupValue)
            return target.callerId;
        try {
            const result = await this.directories.lookup({
                directoryUid: source.directory_uid,
                userUid: campaign.user_uid,
                key: lookupValue,
                fieldUids: [source.value_field_uid],
            });
            const resolved = result.status === 'FOUND' ? result.values[0]?.trim() : '';
            return resolved || target.callerId;
        }
        catch (error) {
            this.logger.warn(`Caller ID directory lookup failed for campaign ${campaign.uid}: ${error.message}`);
            return target.callerId;
        }
    }
    async failTask(task, disposition, reason) {
        this.logger.warn(`Task ${task.uid} not dialable: ${reason}`);
        await task.update({
            status: 'completed',
            last_disposition: disposition,
            last_cause: reason.slice(0, 64),
            leased_by: null,
            leased_at: null,
        });
    }
    /**
     * StasisStart at channel creation is not an answer. The scenario only starts
     * after ARI reports `Up`; duplicate Up/Stasis events are collapsed here.
     */
    async handOffAnsweredChannel(channelId, parsedCampaignUid) {
        const parsed = parsedCampaignUid == null ? (0, autodial_phone_util_1.parseAutodialChannelId)(channelId) : null;
        const campaignUid = parsedCampaignUid ?? parsed?.campaignUid;
        if (campaignUid == null || this.handedOffChannels.has(channelId))
            return;
        this.handedOffChannels.add(channelId);
        this.state.markAnswered(channelId);
        try {
            await this.attempts.markAnswered(channelId, new Date());
            await this.ari.continueInDialplan(channelId, (0, autodial_dialplan_util_1.autodialCampaignContextName)(campaignUid), 's', 1);
        }
        catch (e) {
            // A later event may retry the handoff; never mark this call answered a
            // second time because AutodialStateService makes that transition idempotent.
            this.handedOffChannels.delete(channelId);
            this.logger.error(`continueInDialplan failed for ${channelId}: ${e.message}`);
        }
    }
    /** Exposed for the reconciler: forget cached mappings for a closed channel. */
    forgetChannel(channelId) {
        this.attemptByChannel.delete(channelId);
    }
    /** Look up the attempt a channel belongs to (used by the internal endpoint). */
    attemptUidFor(channelId) {
        return this.attemptByChannel.get(channelId);
    }
};
exports.AutodialOriginatorService = AutodialOriginatorService;
__decorate([
    (0, event_emitter_1.OnEvent)('ari.ChannelStateChange'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AutodialOriginatorService.prototype, "onChannelStateChange", null);
__decorate([
    (0, event_emitter_1.OnEvent)('ari.StasisStart'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AutodialOriginatorService.prototype, "onStasisStart", null);
__decorate([
    (0, event_emitter_1.OnEvent)('ari.ChannelDestroyed'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AutodialOriginatorService.prototype, "onChannelDestroyed", null);
exports.AutodialOriginatorService = AutodialOriginatorService = AutodialOriginatorService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, sequelize_1.InjectModel)(ac_campaign_model_1.AcCampaign)),
    __param(2, (0, sequelize_1.InjectModel)(ac_contact_model_1.AcContact)),
    __param(3, (0, sequelize_1.InjectModel)(ac_contact_phone_model_1.AcContactPhone)),
    __param(4, (0, sequelize_1.InjectModel)(ac_base_field_model_1.AcBaseField)),
    __param(5, (0, sequelize_1.InjectModel)(ac_task_model_1.AcTask)),
    __metadata("design:paramtypes", [ari_http_client_service_1.AriHttpClientService, Object, Object, Object, Object, Object, autodial_attempt_service_1.AutodialAttemptService,
        autodial_dnc_service_1.AutodialDncService,
        directories_service_1.DirectoriesService,
        autodial_state_service_1.AutodialStateService])
], AutodialOriginatorService);
//# sourceMappingURL=autodial-originator.service.js.map