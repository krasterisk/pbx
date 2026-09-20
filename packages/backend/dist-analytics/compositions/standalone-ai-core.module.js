"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var StandaloneAiCoreModule_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.StandaloneAiCoreModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const sequelize_1 = require("@nestjs/sequelize");
const database_config_cjs_1 = require("../database/database-config.cjs");
const schema_readiness_cjs_1 = require("../database/schema-readiness.cjs");
const user_model_1 = require("../modules/users/user.model");
const user_session_model_1 = require("../modules/auth/user-session.model");
const tenant_model_1 = require("../modules/cloud-admin/tenant.model");
const tenant_module_model_1 = require("../modules/cloud-admin/tenant-module.model");
const module_registry_model_1 = require("../modules/cloud-admin/module-registry.model");
const cloud_setting_model_1 = require("../modules/cloud-admin/cloud-setting.model");
const hub_module_model_1 = require("../modules/cloud-admin/models/hub-module.model");
const hub_module_page_model_1 = require("../modules/cloud-admin/models/hub-module-page.model");
const action_log_model_1 = require("../modules/logger/action-log.model");
const role_model_1 = require("../modules/roles/role.model");
const ai_provider_model_1 = require("../modules/ai-connectivity/ai-provider.model");
const ai_connectivity_module_1 = require("../modules/ai-connectivity/ai-connectivity.module");
const tenant_identity_module_1 = require("../modules/tenant-identity/tenant-identity.module");
const integration_credentials_module_1 = require("../modules/integration-credentials/integration-credentials.module");
const standalone_identity_module_1 = require("../modules/standalone-identity/standalone-identity.module");
const integration_credential_models_1 = require("../modules/integration-credentials/integration-credential.models");
const product_activation_model_1 = require("../modules/product-access/product-activation.model");
const local_license_document_model_1 = require("../modules/product-access/local-license-document.model");
const local_license_binding_model_1 = require("../modules/product-access/local-license-binding.model");
const ai_provider_revision_model_1 = require("../modules/ai-connectivity/ai-provider-revision.model");
const ai_job_models_1 = require("../modules/ai-jobs/ai-job.models");
const media_asset_models_1 = require("../modules/media-assets/media-asset.models");
const usage_models_1 = require("../modules/ai-usage/usage.models");
const capture_models_1 = require("../modules/recording-capture/capture.models");
const speech_analytics_models_1 = require("../modules/speech-analytics/speech-analytics.models");
const webhook_models_1 = require("../modules/integration-delivery/webhook.models");
const ai_voice_models_1 = require("../modules/ai-voice/ai-voice.models");
const metric_models_1 = require("../modules/speech-analytics/metrics/metric.models");
const reporting_models_1 = require("../modules/speech-analytics/reporting/reporting.models");
const sip_models_1 = require("../modules/ai-voice/sip.models");
const tool_models_1 = require("../modules/ai-tool-connectivity/tool.models");
const knowledge_models_1 = require("../modules/knowledge/knowledge.models");
const ai_agent_model_1 = require("../modules/ai-agents/models/ai-agent.model");
/** Explicit profile descriptor; no runtime import(pathFromEnv) or PBX module. */
let StandaloneAiCoreModule = StandaloneAiCoreModule_1 = class StandaloneAiCoreModule {
    static forProfile(profile) {
        return {
            module: StandaloneAiCoreModule_1,
            imports: [
                config_1.ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
                sequelize_1.SequelizeModule.forRootAsync({
                    useFactory: async () => {
                        if (process.env.DB_SCHEMA_PROFILE !== profile) {
                            throw new Error(`${profile} API requires matching DB_SCHEMA_PROFILE`);
                        }
                        await (0, schema_readiness_cjs_1.checkSchemaReadiness)(process.env);
                        return {
                            ...(0, database_config_cjs_1.resolveDatabaseConfig)(process.env),
                            models: [
                                user_model_1.User, user_session_model_1.UserSession, tenant_model_1.Tenant, tenant_module_model_1.TenantModule, module_registry_model_1.ModuleRegistry,
                                cloud_setting_model_1.CloudSetting, hub_module_model_1.HubModule, hub_module_page_model_1.HubModulePage, action_log_model_1.ActionLog, role_model_1.Role, ai_provider_model_1.CcAiProvider,
                                integration_credential_models_1.IntegrationPrincipal, integration_credential_models_1.IntegrationCredential, integration_credential_models_1.IntegrationGrant,
                                integration_credential_models_1.IntegrationAudit, integration_credential_models_1.IntegrationCommand, integration_credential_models_1.IntegrationAuthLimit,
                                product_activation_model_1.ProductActivation, local_license_document_model_1.LocalLicenseDocument, local_license_binding_model_1.LocalLicenseBinding,
                                ai_provider_revision_model_1.AiProviderRevision, media_asset_models_1.AiMediaAsset, media_asset_models_1.AiUpload, ai_job_models_1.AiIdempotency, ai_job_models_1.AiJob,
                                ai_job_models_1.AiJobStage, ai_job_models_1.AiProviderOperation, ai_job_models_1.AiOutbox, ai_job_models_1.AiJobEvent,
                                usage_models_1.AiQuotaCounter, usage_models_1.AiPriceRevision, usage_models_1.AiUsageReservation, usage_models_1.AiUsageEvent, usage_models_1.AiUsageLedger,
                                usage_models_1.AiTrialPolicySnapshot, usage_models_1.AiSkuRevision, usage_models_1.AiSkuOffer, usage_models_1.AiSkuEntitlement,
                                capture_models_1.AiCaptureNodeBinding, capture_models_1.AiCaptureIntent, capture_models_1.AiCaptureSegment, capture_models_1.AiCaptureReceipt,
                                speech_analytics_models_1.SaProject, speech_analytics_models_1.SaProjectVersion, speech_analytics_models_1.SaProjectMember, speech_analytics_models_1.SaRecording, speech_analytics_models_1.SaAnalysisRun,
                                speech_analytics_models_1.SaTranscript, speech_analytics_models_1.SaTranscriptSegment, speech_analytics_models_1.SaResult,
                                webhook_models_1.AiWebhookEndpoint, webhook_models_1.AiWebhookDelivery, webhook_models_1.AiWebhookAttempt,
                                ai_agent_model_1.CcAiAgent, ai_voice_models_1.AiRobotDraft, ai_voice_models_1.AiRobotVersion, ai_voice_models_1.AiRobotDeployment,
                                ai_voice_models_1.AiVoiceSession, ai_voice_models_1.AiVoiceTurn, ai_voice_models_1.AiVoiceEvent, ai_voice_models_1.AiCallControlOperation, ai_voice_models_1.AiVoiceTicket,
                                metric_models_1.SaMetricDefinition, metric_models_1.SaMetricRevision, metric_models_1.SaProjectVersionMetric, metric_models_1.SaMetricValue,
                                metric_models_1.SaHumanReview, metric_models_1.SaTranscriptCorrection,
                                reporting_models_1.SaReportDefinition, reporting_models_1.SaReportRun, reporting_models_1.SaReportSnapshotItem, reporting_models_1.SaReportSchedule,
                                reporting_models_1.SaBudgetPolicy, reporting_models_1.SaBulkReanalysisBatch, reporting_models_1.SaBulkReanalysisItem,
                                reporting_models_1.SaTenantCapturePolicy, reporting_models_1.SaRecordingRelation,
                                sip_models_1.AiSipConnection, sip_models_1.AiSipConfigRevision, sip_models_1.AiSipDidBinding, sip_models_1.AiVoiceInvocation,
                                tool_models_1.AiBusinessConnection, tool_models_1.AiToolRevision, tool_models_1.AiRobotToolBinding,
                                knowledge_models_1.KbBase, knowledge_models_1.KbDocument, knowledge_models_1.KbDocumentRevision, knowledge_models_1.KbChunk, knowledge_models_1.KbEmbeddingRevision,
                                knowledge_models_1.KbRelease, knowledge_models_1.KbReleaseMember, knowledge_models_1.KbAccessBinding,
                            ],
                            synchronize: false,
                            autoLoadModels: false,
                        };
                    },
                }),
                tenant_identity_module_1.TenantIdentityModule,
                standalone_identity_module_1.StandaloneIdentityModule,
                ai_connectivity_module_1.AiConnectivityModule,
                integration_credentials_module_1.IntegrationCredentialsModule,
            ],
        };
    }
};
exports.StandaloneAiCoreModule = StandaloneAiCoreModule;
exports.StandaloneAiCoreModule = StandaloneAiCoreModule = StandaloneAiCoreModule_1 = __decorate([
    (0, common_1.Module)({})
], StandaloneAiCoreModule);
//# sourceMappingURL=standalone-ai-core.module.js.map