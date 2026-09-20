"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SpeechAnalyticsModule = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const ai_jobs_module_1 = require("../ai-jobs/ai-jobs.module");
const media_assets_module_1 = require("../media-assets/media-assets.module");
const product_access_core_module_1 = require("../product-access/product-access-core.module");
const integration_credentials_module_1 = require("../integration-credentials/integration-credentials.module");
const media_asset_models_1 = require("../media-assets/media-asset.models");
const integration_credential_models_1 = require("../integration-credentials/integration-credential.models");
const speech_analytics_models_1 = require("./speech-analytics.models");
const metric_models_1 = require("./metrics/metric.models");
const reporting_models_1 = require("./reporting/reporting.models");
const speech_analytics_service_1 = require("./speech-analytics.service");
const metrics_service_1 = require("./metrics/metrics.service");
const reporting_service_1 = require("./reporting/reporting.service");
const sa_project_resolver_1 = require("./sa-project.resolver");
const speech_analytics_jwt_controller_1 = require("./speech-analytics-jwt.controller");
const speech_analytics_public_controller_1 = require("./speech-analytics-public.controller");
let SpeechAnalyticsModule = class SpeechAnalyticsModule {
};
exports.SpeechAnalyticsModule = SpeechAnalyticsModule;
exports.SpeechAnalyticsModule = SpeechAnalyticsModule = __decorate([
    (0, common_1.Module)({
        imports: [
            integration_credentials_module_1.IntegrationCredentialsModule,
            product_access_core_module_1.ProductAccessCoreModule,
            ai_jobs_module_1.AiJobsModule,
            media_assets_module_1.MediaAssetsModule,
            sequelize_1.SequelizeModule.forFeature([
                speech_analytics_models_1.SaProject, speech_analytics_models_1.SaProjectVersion, speech_analytics_models_1.SaProjectMember, speech_analytics_models_1.SaRecording, speech_analytics_models_1.SaAnalysisRun,
                speech_analytics_models_1.SaTranscript, speech_analytics_models_1.SaTranscriptSegment, speech_analytics_models_1.SaResult, media_asset_models_1.AiMediaAsset, media_asset_models_1.AiUpload, integration_credential_models_1.IntegrationGrant,
                metric_models_1.SaMetricDefinition, metric_models_1.SaMetricRevision, metric_models_1.SaProjectVersionMetric, metric_models_1.SaMetricValue,
                metric_models_1.SaHumanReview, metric_models_1.SaTranscriptCorrection,
                reporting_models_1.SaReportDefinition, reporting_models_1.SaReportRun, reporting_models_1.SaReportSnapshotItem, reporting_models_1.SaReportSchedule,
                reporting_models_1.SaBudgetPolicy, reporting_models_1.SaBulkReanalysisBatch, reporting_models_1.SaBulkReanalysisItem,
                reporting_models_1.SaTenantCapturePolicy, reporting_models_1.SaRecordingRelation,
            ]),
        ],
        providers: [speech_analytics_service_1.SpeechAnalyticsService, metrics_service_1.SaMetricsService, reporting_service_1.SaReportingService, sa_project_resolver_1.SaProjectResolver],
        controllers: [speech_analytics_jwt_controller_1.SpeechAnalyticsJwtController, speech_analytics_public_controller_1.SpeechAnalyticsPublicController],
        exports: [speech_analytics_service_1.SpeechAnalyticsService, metrics_service_1.SaMetricsService, reporting_service_1.SaReportingService, sequelize_1.SequelizeModule],
    })
], SpeechAnalyticsModule);
//# sourceMappingURL=speech-analytics.module.js.map