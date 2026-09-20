"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutodialModule = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const ai_platform_module_1 = require("../ai-platform/ai-platform.module");
const ami_module_1 = require("../ami/ami.module");
const ari_module_1 = require("../ari/ari.module");
const callcenter_module_1 = require("../callcenter/callcenter.module");
const cloud_admin_module_1 = require("../cloud-admin/cloud-admin.module");
const logger_module_1 = require("../logger/logger.module");
const reports_cdr_module_1 = require("../reports/cdr/reports-cdr.module");
const directories_module_1 = require("../directories/directories.module");
const cdr_model_1 = require("../reports/cdr/cdr.model");
const ps_endpoint_model_1 = require("../endpoints/ps-endpoint.model");
const queue_model_1 = require("../queues/queue.model");
const ac_attempt_model_1 = require("./models/ac-attempt.model");
const ac_base_field_model_1 = require("./models/ac-base-field.model");
const ac_base_model_1 = require("./models/ac-base.model");
const ac_campaign_model_1 = require("./models/ac-campaign.model");
const ac_contact_phone_model_1 = require("./models/ac-contact-phone.model");
const ac_contact_model_1 = require("./models/ac-contact.model");
const ac_daily_campaign_stats_model_1 = require("./models/ac-daily-campaign-stats.model");
const ac_dnc_model_1 = require("./models/ac-dnc.model");
const ac_import_profile_model_1 = require("./models/ac-import-profile.model");
const ac_import_run_model_1 = require("./models/ac-import-run.model");
const ac_schedule_model_1 = require("./models/ac-schedule.model");
const ac_task_model_1 = require("./models/ac-task.model");
const autodial_ai_adapter_1 = require("./autodial-ai.adapter");
const autodial_attempt_service_1 = require("./autodial-attempt.service");
const autodial_bases_controller_1 = require("./autodial-bases.controller");
const autodial_bases_service_1 = require("./autodial-bases.service");
const autodial_campaigns_controller_1 = require("./autodial-campaigns.controller");
const autodial_campaigns_service_1 = require("./autodial-campaigns.service");
const autodial_dialplan_service_1 = require("./autodial-dialplan.service");
const autodial_dnc_service_1 = require("./autodial-dnc.service");
const autodial_import_service_1 = require("./autodial-import.service");
const autodial_internal_controller_1 = require("./autodial-internal.controller");
const autodial_originator_service_1 = require("./autodial-originator.service");
const autodial_pacer_service_1 = require("./autodial-pacer.service");
const autodial_reconciler_service_1 = require("./autodial-reconciler.service");
const autodial_reports_controller_1 = require("./autodial-reports.controller");
const autodial_reports_service_1 = require("./autodial-reports.service");
const autodial_rollup_service_1 = require("./autodial-rollup.service");
const autodial_scheduler_service_1 = require("./autodial-scheduler.service");
const autodial_sse_controller_1 = require("./autodial-sse.controller");
const autodial_state_service_1 = require("./autodial-state.service");
/**
 * Autodial (Автообзвон) — commercial outbound dialer module.
 *
 * Dials over ARI rather than AMI Originate: the dialer picks the channel id, so
 * every event correlates to an attempt without guessing, and pre-answer causes
 * arrive intact.
 */
let AutodialModule = class AutodialModule {
};
exports.AutodialModule = AutodialModule;
exports.AutodialModule = AutodialModule = __decorate([
    (0, common_1.Module)({
        imports: [
            sequelize_1.SequelizeModule.forFeature([
                ac_base_model_1.AcBase,
                ac_base_field_model_1.AcBaseField,
                ac_contact_model_1.AcContact,
                ac_contact_phone_model_1.AcContactPhone,
                ac_import_profile_model_1.AcImportProfile,
                ac_import_run_model_1.AcImportRun,
                ac_campaign_model_1.AcCampaign,
                ac_schedule_model_1.AcSchedule,
                ac_dnc_model_1.AcDnc,
                ac_task_model_1.AcTask,
                ac_attempt_model_1.AcAttempt,
                ac_daily_campaign_stats_model_1.AcDailyCampaignStats,
                ps_endpoint_model_1.PsEndpoint,
                queue_model_1.Queue,
                cdr_model_1.Cdr,
            ]),
            ami_module_1.AmiModule,
            ari_module_1.AriModule,
            callcenter_module_1.CallCenterModule,
            cloud_admin_module_1.CloudAdminModule,
            ai_platform_module_1.AiPlatformModule,
            logger_module_1.LoggerModule,
            reports_cdr_module_1.ReportsCdrModule,
            directories_module_1.DirectoriesModule,
        ],
        controllers: [
            autodial_bases_controller_1.AutodialBasesController,
            autodial_campaigns_controller_1.AutodialCampaignsController,
            autodial_reports_controller_1.AutodialReportsController,
            autodial_sse_controller_1.AutodialSseController,
            autodial_internal_controller_1.AutodialInternalController,
        ],
        providers: [
            autodial_bases_service_1.AutodialBasesService,
            autodial_import_service_1.AutodialImportService,
            autodial_campaigns_service_1.AutodialCampaignsService,
            autodial_dnc_service_1.AutodialDncService,
            autodial_dialplan_service_1.AutodialDialplanService,
            autodial_scheduler_service_1.AutodialSchedulerService,
            autodial_state_service_1.AutodialStateService,
            autodial_attempt_service_1.AutodialAttemptService,
            autodial_originator_service_1.AutodialOriginatorService,
            autodial_pacer_service_1.AutodialPacerService,
            autodial_reconciler_service_1.AutodialReconcilerService,
            autodial_reports_service_1.AutodialReportsService,
            autodial_rollup_service_1.AutodialRollupService,
            autodial_ai_adapter_1.AutodialAiAdapter,
        ],
        exports: [autodial_bases_service_1.AutodialBasesService, autodial_campaigns_service_1.AutodialCampaignsService, autodial_state_service_1.AutodialStateService],
    })
], AutodialModule);
//# sourceMappingURL=autodial.module.js.map