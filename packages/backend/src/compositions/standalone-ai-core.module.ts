import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SequelizeModule } from '@nestjs/sequelize';
import { resolveDatabaseConfig } from '../database/database-config.cjs';
import { checkSchemaReadiness } from '../database/schema-readiness.cjs';
import { User } from '../modules/users/user.model';
import { UserSession } from '../modules/auth/user-session.model';
import { Tenant } from '../modules/cloud-admin/tenant.model';
import { TenantModule } from '../modules/cloud-admin/tenant-module.model';
import { ModuleRegistry } from '../modules/cloud-admin/module-registry.model';
import { CloudSetting } from '../modules/cloud-admin/cloud-setting.model';
import { HubModule } from '../modules/cloud-admin/models/hub-module.model';
import { HubModulePage } from '../modules/cloud-admin/models/hub-module-page.model';
import { ActionLog } from '../modules/logger/action-log.model';
import { Role } from '../modules/roles/role.model';
import { CcAiProvider } from '../modules/ai-connectivity/ai-provider.model';
import { AiConnectivityModule } from '../modules/ai-connectivity/ai-connectivity.module';
import { TenantIdentityModule } from '../modules/tenant-identity/tenant-identity.module';
import { IntegrationCredentialsModule } from '../modules/integration-credentials/integration-credentials.module';
import { StandaloneIdentityModule } from '../modules/standalone-identity/standalone-identity.module';
import {
  IntegrationPrincipal, IntegrationCredential, IntegrationGrant, IntegrationAudit,
  IntegrationCommand, IntegrationAuthLimit,
} from '../modules/integration-credentials/integration-credential.models';
import { ProductActivation } from '../modules/product-access/product-activation.model';
import { LocalLicenseDocument } from '../modules/product-access/local-license-document.model';
import { LocalLicenseBinding } from '../modules/product-access/local-license-binding.model';
import { AiProviderRevision } from '../modules/ai-connectivity/ai-provider-revision.model';
import {
  AiJob, AiJobEvent, AiJobStage, AiIdempotency, AiOutbox, AiProviderOperation,
} from '../modules/ai-jobs/ai-job.models';
import { AiMediaAsset, AiUpload } from '../modules/media-assets/media-asset.models';
import {
  AiPriceRevision, AiQuotaCounter, AiSkuEntitlement, AiSkuOffer, AiSkuRevision,
  AiTrialPolicySnapshot, AiUsageEvent, AiUsageLedger, AiUsageReservation,
} from '../modules/ai-usage/usage.models';
import {
  AiCaptureIntent, AiCaptureNodeBinding, AiCaptureReceipt, AiCaptureSegment,
} from '../modules/recording-capture/capture.models';
import {
  SaAnalysisRun, SaProject, SaProjectMember, SaProjectVersion, SaRecording, SaResult,
  SaTranscript, SaTranscriptSegment,
} from '../modules/speech-analytics/speech-analytics.models';
import { AiWebhookAttempt, AiWebhookDelivery, AiWebhookEndpoint } from '../modules/integration-delivery/webhook.models';
import {
  AiCallControlOperation, AiRobotDeployment, AiRobotDraft, AiRobotVersion,
  AiVoiceEvent, AiVoiceSession, AiVoiceTicket, AiVoiceTurn,
} from '../modules/ai-voice/ai-voice.models';
import {
  SaHumanReview, SaMetricDefinition, SaMetricRevision, SaMetricValue,
  SaProjectVersionMetric, SaTranscriptCorrection,
} from '../modules/speech-analytics/metrics/metric.models';
import {
  SaBudgetPolicy, SaBulkReanalysisBatch, SaBulkReanalysisItem, SaRecordingRelation,
  SaReportDefinition, SaReportRun, SaReportSchedule, SaReportSnapshotItem, SaTenantCapturePolicy,
} from '../modules/speech-analytics/reporting/reporting.models';
import { AiSipConfigRevision, AiSipConnection, AiSipDidBinding, AiVoiceInvocation } from '../modules/ai-voice/sip.models';
import { AiBusinessConnection, AiRobotToolBinding, AiToolRevision } from '../modules/ai-tool-connectivity/tool.models';
import {
  KbAccessBinding, KbBase, KbChunk, KbDocument, KbDocumentRevision, KbEmbeddingRevision,
  KbRelease, KbReleaseMember,
} from '../modules/knowledge/knowledge.models';
import { CcAiAgent } from '../modules/ai-agents/models/ai-agent.model';

export type StandaloneAiProfile = 'analytics-api' | 'robot-api';

/** Explicit profile descriptor; no runtime import(pathFromEnv) or PBX module. */
@Module({})
export class StandaloneAiCoreModule {
  static forProfile(profile: StandaloneAiProfile): DynamicModule {
    return {
      module: StandaloneAiCoreModule,
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        SequelizeModule.forRootAsync({
          useFactory: async () => {
            if (process.env.DB_SCHEMA_PROFILE !== profile) {
              throw new Error(`${profile} API requires matching DB_SCHEMA_PROFILE`);
            }
            await checkSchemaReadiness(process.env);
            return {
              ...resolveDatabaseConfig(process.env),
              models: [
                User, UserSession, Tenant, TenantModule, ModuleRegistry,
                CloudSetting, HubModule, HubModulePage, ActionLog, Role, CcAiProvider,
                IntegrationPrincipal, IntegrationCredential, IntegrationGrant,
                IntegrationAudit, IntegrationCommand, IntegrationAuthLimit,
                ProductActivation, LocalLicenseDocument, LocalLicenseBinding,
                AiProviderRevision, AiMediaAsset, AiUpload, AiIdempotency, AiJob,
                AiJobStage, AiProviderOperation, AiOutbox, AiJobEvent,
                AiQuotaCounter, AiPriceRevision, AiUsageReservation, AiUsageEvent, AiUsageLedger,
                AiTrialPolicySnapshot, AiSkuRevision, AiSkuOffer, AiSkuEntitlement,
                AiCaptureNodeBinding, AiCaptureIntent, AiCaptureSegment, AiCaptureReceipt,
                SaProject, SaProjectVersion, SaProjectMember, SaRecording, SaAnalysisRun,
                SaTranscript, SaTranscriptSegment, SaResult,
                AiWebhookEndpoint, AiWebhookDelivery, AiWebhookAttempt,
                CcAiAgent, AiRobotDraft, AiRobotVersion, AiRobotDeployment,
                AiVoiceSession, AiVoiceTurn, AiVoiceEvent, AiCallControlOperation, AiVoiceTicket,
                SaMetricDefinition, SaMetricRevision, SaProjectVersionMetric, SaMetricValue,
                SaHumanReview, SaTranscriptCorrection,
                SaReportDefinition, SaReportRun, SaReportSnapshotItem, SaReportSchedule,
                SaBudgetPolicy, SaBulkReanalysisBatch, SaBulkReanalysisItem,
                SaTenantCapturePolicy, SaRecordingRelation,
                AiSipConnection, AiSipConfigRevision, AiSipDidBinding, AiVoiceInvocation,
                AiBusinessConnection, AiToolRevision, AiRobotToolBinding,
                KbBase, KbDocument, KbDocumentRevision, KbChunk, KbEmbeddingRevision,
                KbRelease, KbReleaseMember, KbAccessBinding,
              ],
              synchronize: false,
              autoLoadModels: false,
            };
          },
        }),
        TenantIdentityModule,
        StandaloneIdentityModule,
        AiConnectivityModule,
        IntegrationCredentialsModule,
      ],
    };
  }
}
