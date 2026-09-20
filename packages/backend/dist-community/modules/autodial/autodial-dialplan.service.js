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
var AutodialDialplanService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutodialDialplanService = void 0;
const common_1 = require("@nestjs/common");
const dialplan_apply_service_1 = require("../ami/dialplan-apply.service");
const ami_service_1 = require("../ami/ami.service");
const autodial_dialplan_util_1 = require("./autodial-dialplan.util");
/**
 * Writes campaign contexts into krasterisk/autodial/ac_{vpbx}.conf.
 *
 * Ops prerequisite: AMI CreateConfig cannot create parent directories, so
 * `krasterisk/autodial` must be mkdir'd under AST_CONFIG_DIR once.
 */
let AutodialDialplanService = AutodialDialplanService_1 = class AutodialDialplanService {
    dialplanApply;
    ami;
    logger = new common_1.Logger(AutodialDialplanService_1.name);
    constructor(dialplanApply, ami) {
        this.dialplanApply = dialplanApply;
        this.ami = ami;
    }
    /** Check PBX capability before a campaign can start using AMD. */
    async assertAmdReady(campaign) {
        if (!campaign.amd?.enabled)
            return;
        if (campaign.amd.on_machine === 'voicemail') {
            throw new common_1.BadRequestException({
                code: 'AC_AMD_MESSAGE_NOT_CONFIGURED',
                message: 'A message recording must be configured before voicemail mode can be used.',
            });
        }
        let response;
        try {
            response = await this.ami.command('module show like app_amd');
        }
        catch {
            throw new common_1.ServiceUnavailableException({ code: 'AC_AMD_UNAVAILABLE', message: 'AMD capability could not be verified.' });
        }
        const value = response;
        const output = Array.isArray(value?.output)
            ? value.output.join('\n')
            : String(value?.output ?? value?.content ?? (typeof response === 'string' ? response : ''));
        if (!/^app_amd\.so\s+.*\bRunning\b/im.test(output)) {
            throw new common_1.ServiceUnavailableException({ code: 'AC_AMD_UNAVAILABLE', message: 'Asterisk AMD application is not loaded.' });
        }
    }
    /** Regenerate one campaign context plus the shared finalize handler. */
    async applyCampaign(campaign) {
        const vpbx = campaign.user_uid;
        const category = (0, autodial_dialplan_util_1.withMachineTail)((0, autodial_dialplan_util_1.generateAutodialCampaignDialplan)({
            uid: campaign.uid,
            name: campaign.name,
            amd: campaign.amd,
            queue_names: campaign.queue_names ?? [],
            scenario_actions: campaign.scenario_actions ?? [],
        }, vpbx), campaign.amd, vpbx);
        try {
            await this.dialplanApply.applyCategories((0, autodial_dialplan_util_1.autodialConfigFile)(vpbx), [category, (0, autodial_dialplan_util_1.generateAutodialFinalizeContext)(vpbx)], { reload: true });
            this.logger.log(`Applied autodial dialplan for campaign ${campaign.uid} (tenant ${vpbx})`);
            return true;
        }
        catch (e) {
            // Same contract as routes/conferences: DB is saved, dialplan may lag.
            this.logger.error(`Autodial dialplan apply failed for campaign ${campaign.uid}: ${e.message}. DB saved — re-save to retry.`);
            return false;
        }
    }
    /** Drop a campaign context when the campaign is deleted. */
    async removeCampaign(campaign) {
        try {
            await this.dialplanApply.deleteCategories((0, autodial_dialplan_util_1.autodialConfigFile)(campaign.user_uid), [(0, autodial_dialplan_util_1.autodialCampaignContextName)(campaign.uid)], { reload: true });
        }
        catch (e) {
            this.logger.error(`Autodial dialplan delete failed for campaign ${campaign.uid}: ${e.message}`);
        }
    }
};
exports.AutodialDialplanService = AutodialDialplanService;
exports.AutodialDialplanService = AutodialDialplanService = AutodialDialplanService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [dialplan_apply_service_1.DialplanApplyService,
        ami_service_1.AmiService])
], AutodialDialplanService);
//# sourceMappingURL=autodial-dialplan.service.js.map