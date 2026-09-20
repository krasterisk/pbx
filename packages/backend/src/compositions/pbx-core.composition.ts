import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { APP_GUARD } from '@nestjs/core';
import { SequelizeModule } from '@nestjs/sequelize';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import type { DynamicModule, ForwardReference, Type } from '@nestjs/common';
import type { ModelCtor } from 'sequelize-typescript';
import { resolveDatabaseConfig } from '../database/database-config.cjs';
import { checkSchemaReadiness } from '../database/schema-readiness.cjs';
import { RedisModule } from '../modules/redis/redis.module';
import { AuthModule } from '../modules/auth/auth.module';
import { UsersModule } from '../modules/users/users.module';
import { EndpointsModule } from '../modules/endpoints/endpoints.module';
import { ContextsModule } from '../modules/contexts/contexts.module';
import { RolesModule } from '../modules/roles/roles.module';
import { NumbersModule } from '../modules/numbers/numbers.module';
import { AmiModule } from '../modules/ami/ami.module';
import { DiagnosticsModule } from '../modules/diagnostics/diagnostics.module';
import { TrunksModule } from '../modules/trunks/trunks.module';
import { RoutesModule } from '../modules/routes/routes.module';
import { IvrsModule } from '../modules/ivrs/ivrs.module';
import { PromptsModule } from '../modules/prompts/prompts.module';
import { TtsEnginesModule } from '../modules/tts-engines/tts-engines.module';
import { SttEnginesModule } from '../modules/stt-engines/stt-engines.module';
import { MohModule } from '../modules/moh/moh.module';
import { SystemSettingsModule } from '../modules/system-settings/system-settings.module';
import { ReportsCdrModule } from '../modules/reports/cdr/reports-cdr.module';
import { Cdr } from '../modules/reports/cdr/cdr.model';
import { VoiceRobotsModule } from '../modules/voice-robots/voice-robots.module';
import { AriModule } from '../modules/ari/ari.module';
import { QueuesModule } from '../modules/queues/queues.module';
import { ServiceRequestsModule } from '../modules/service-requests/service-requests.module';
import { KomandorClaimsModule } from '../modules/komandor-claims/komandor-claims.module';
import { KomandorClaim } from '../modules/komandor-claims/komandor-claim.model';
import { KomandorStore } from '../modules/komandor-claims/komandor-store.model';
import { KomandorDict } from '../modules/komandor-claims/komandor-dict.model';
import { TimeGroupsModule } from '../modules/time-groups/time-groups.module';
import { DirectoriesModule } from '../modules/directories/directories.module';
import { RouteReferencesModule } from '../modules/route-references/route-references.module';
import { DialplanDryRunModule } from '../modules/dialplan-dry-run/dialplan-dry-run.module';
import { RouteTemplatesModule } from '../modules/route-templates/route-templates.module';
import { RouteTemplate } from '../modules/route-templates/route-template.model';
import { VoicemailModule } from '../modules/voicemail/voicemail.module';
import { CallbackRequestsModule } from '../modules/callback-requests/callback-requests.module';
import { CallbackRequest } from '../modules/callback-requests/callback-request.model';
import { CallGroupsModule } from '../modules/call-groups/call-groups.module';
import { CallGroup } from '../modules/call-groups/call-group.model';
import { CallGroupMember } from '../modules/call-groups/call-group-member.model';
import { AutodialModule } from '../modules/autodial/autodial.module';
import { AcBase } from '../modules/autodial/models/ac-base.model';
import { AcBaseField } from '../modules/autodial/models/ac-base-field.model';
import { AcContact } from '../modules/autodial/models/ac-contact.model';
import { AcContactPhone } from '../modules/autodial/models/ac-contact-phone.model';
import { AcImportProfile } from '../modules/autodial/models/ac-import-profile.model';
import { AcImportRun } from '../modules/autodial/models/ac-import-run.model';
import { AcCampaign } from '../modules/autodial/models/ac-campaign.model';
import { AcSchedule } from '../modules/autodial/models/ac-schedule.model';
import { AcDnc } from '../modules/autodial/models/ac-dnc.model';
import { AcTask } from '../modules/autodial/models/ac-task.model';
import { AcAttempt } from '../modules/autodial/models/ac-attempt.model';
import { AcDailyCampaignStats } from '../modules/autodial/models/ac-daily-campaign-stats.model';
import { ConferencesModule } from '../modules/conferences/conferences.module';
import { ConferenceRoom } from '../modules/conferences/models/conference-room.model';
import { ConferenceRoomModerator } from '../modules/conferences/models/conference-room-moderator.model';
import { ConferenceGuestToken } from '../modules/conferences/models/conference-guest-token.model';
import { ConferenceMeeting } from '../modules/conferences/models/conference-meeting.model';
import { ConferenceMeetingParticipant } from '../modules/conferences/models/conference-meeting-participant.model';
import { SmsModule } from '../modules/sms/sms.module';
import { CloudAdminModule } from '../modules/cloud-admin/cloud-admin.module';
import { AiChatModule } from '../modules/ai-chat/ai-chat.module';
import { AgentProposalsModule } from '../modules/ai-chat/agent-proposals.module';
import { McpModule } from '../modules/mcp/mcp.module';
import { HealthModule } from '../modules/health/health.module';
import { CallCenterModule } from '../modules/callcenter/callcenter.module';
import { IntegrationCredentialsModule } from '../modules/integration-credentials/integration-credentials.module';
import {
  IntegrationPrincipal, IntegrationCredential, IntegrationGrant,
  IntegrationAudit, IntegrationCommand, IntegrationAuthLimit,
} from '../modules/integration-credentials/integration-credential.models';
import { CcAiProvider } from '../modules/ai-connectivity/ai-provider.model';
import { CcAiAuditLog } from '../modules/ai-chat/models/ai-audit-log.model';
import { AgentThread } from '../modules/ai-chat/models/agent-thread.model';
import { AgentThreadMessage } from '../modules/ai-chat/models/agent-thread-message.model';
import { AgentProposal } from '../modules/ai-chat/models/agent-proposal.model';
import { AgentWorkflow, AgentWorkflowStep } from '../modules/ai-chat/models/agent-workflow.model';
import { AiChatSettings } from '../modules/ai-chat/ai-chat-settings.model';
import { CcPauseReason } from '../modules/callcenter/models/pause-reason.model';
import { CcAgentSession } from '../modules/callcenter/models/agent-session.model';
import { CcAgentEvent } from '../modules/callcenter/models/agent-event.model';
import { CcAgentQueue } from '../modules/callcenter/models/agent-queue.model';
import { CcMissedCall } from '../modules/callcenter/models/missed-call.model';
import { CcContact } from '../modules/callcenter/models/cc-contact.model';
import { CcQueueCall } from '../modules/callcenter/models/queue-call.model';
import { CcDailyQueueStats } from '../modules/callcenter/models/daily-queue-stats.model';
import { CcDailyAgentStats } from '../modules/callcenter/models/daily-agent-stats.model';
import { CcOperatorSettings } from '../modules/callcenter/models/operator-settings.model';
import { CcSettings } from '../modules/callcenter/models/cc-settings.model';
import { CcDisplayToken } from '../modules/callcenter/models/display-token.model';
import { CcAlertConfig } from '../modules/callcenter/models/alert-config.model';
import { CcChatMessage } from '../modules/callcenter/models/chat-message.model';
import { CcChatChannel } from '../modules/callcenter/models/chat-channel.model';
import { CcCardTemplate } from '../modules/callcenter/models/card-template.model';
import { CcCardField } from '../modules/callcenter/models/card-field.model';
import { CcCardData } from '../modules/callcenter/models/card-data.model';
import { CcReportSchedule } from '../modules/callcenter/models/report-schedule.model';
import { Tenant } from '../modules/cloud-admin/tenant.model';
import { ModuleRegistry } from '../modules/cloud-admin/module-registry.model';
import { TenantModule } from '../modules/cloud-admin/tenant-module.model';
import { CloudSetting } from '../modules/cloud-admin/cloud-setting.model';
import { HubModule } from '../modules/cloud-admin/models/hub-module.model';
import { HubModulePage } from '../modules/cloud-admin/models/hub-module-page.model';
import { RoleStartDefault, TenantRoleStart } from '../modules/cloud-admin/models/role-start.model';
import { DeviceToken } from '../modules/cloud-admin/models/device-token.model';
import { BillingBalance } from '../modules/cloud-admin/billing/models/billing-balance.model';
import { BillingTransaction } from '../modules/cloud-admin/billing/models/billing-transaction.model';
import { Queue } from '../modules/queues/queue.model';
import { QueueMember } from '../modules/queues/queue-member.model';
import { Prompt } from '../modules/prompts/prompt.model';
import { TtsEngine } from '../modules/tts-engines/tts-engine.model';
import { SttEngine } from '../modules/stt-engines/stt-engine.model';
import { User } from '../modules/users/user.model';
import { PsEndpoint } from '../modules/endpoints/ps-endpoint.model';
import { PsAuth } from '../modules/endpoints/ps-auth.model';
import { PsAor } from '../modules/endpoints/ps-aor.model';
import { PsContact } from '../modules/endpoints/ps-contact.model';
import { Context } from '../modules/contexts/context.model';
import { Role } from '../modules/roles/role.model';
import { NumberList } from '../modules/numbers/number-list.model';
import { ActionLog } from '../modules/logger/action-log.model';
import { LoggerModule } from '../modules/logger/logger.module';
import { MailerModule } from '../modules/mailer/mailer.module';
import { NotificationsModule } from '../modules/notifications/notifications.module';
import { DialplanBridgeModule } from '../modules/dialplan-bridge/dialplan-bridge.module';
import { NotificationIntegration } from '../modules/notifications/notification-integration.model';
import { TelegramModule } from '../modules/telegram/telegram.module';
import { UserSession } from '../modules/auth/user-session.model';
import { PickupGroup } from '../modules/endpoints/pickup-group.model';
import { ProvisionTemplate } from '../modules/endpoints/provision-template.model';
import { PsRegistration } from '../modules/trunks/ps-registration.model';
import { PsEndpointIdIp } from '../modules/trunks/ps-endpoint-id-ip.model';
import { Route } from '../modules/routes/route.model';
import { ContextInclude } from '../modules/routes/context-include.model';
import { WebhookFailure } from '../modules/routes/webhook-failure.model';
import { Ivr } from '../modules/ivrs/ivr.model';
import { MohClass } from '../modules/moh/moh-class.model';
import { MohEntry } from '../modules/moh/moh-entry.model';
import { SystemSetting } from '../modules/system-settings/system-setting.model';
import { TenantSettingsModule } from '../modules/tenant-settings/tenant-settings.module';
import { TenantSetting } from '../modules/tenant-settings/tenant-setting.model';
import { VoiceRobot } from '../modules/voice-robots/voice-robot.model';
import { VoiceRobotKeywordGroup } from '../modules/voice-robots/keyword-group.model';
import { VoiceRobotKeyword } from '../modules/voice-robots/keyword.model';
import { VoiceRobotLog } from '../modules/voice-robots/voice-robot-log.model';
import { VoiceRobotCdr } from '../modules/voice-robots/voice-robot-cdr.model';
import { VoiceRobotDataList } from '../modules/voice-robots/data-list.model';
import { ServiceRequest } from '../modules/service-requests/service-request.model';
import { TimeGroup } from '../modules/time-groups/time-group.model';
import { Directory } from '../modules/directories/directory.model';
import { DirectoryField } from '../modules/directories/directory-field.model';
import { DirectoryRecord } from '../modules/directories/directory-record.model';
import { RouteDirectoryBinding } from '../modules/directories/route-directory-binding.model';
import { VoicemailMessage } from '../modules/voicemail/voicemail-message.model';
import { VoicemailAccessToken } from '../modules/voicemail/voicemail-access-token.model';
import { CcSubject } from '../modules/service-requests/cc-subject.model';
import { CcDistrict } from '../modules/service-requests/cc-district.model';
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

/** Existing open PBX nest modules. Commercial robot/analytics product modules are not listed. */
export const PBX_CORE_NEST_MODULES = [
  RedisModule, HealthModule, AuthModule, UsersModule, EndpointsModule, ContextsModule,
  RolesModule, NumbersModule, AmiModule, DiagnosticsModule, TrunksModule, RoutesModule,
  IvrsModule, PromptsModule, TtsEnginesModule, SttEnginesModule, MohModule,
  SystemSettingsModule, TenantSettingsModule, VoiceRobotsModule, ReportsCdrModule,
  AriModule, QueuesModule, ServiceRequestsModule, KomandorClaimsModule, SmsModule,
  TimeGroupsModule, DirectoriesModule, RouteReferencesModule, DialplanDryRunModule,
  RouteTemplatesModule, VoicemailModule, CallbackRequestsModule, CallGroupsModule,
  ConferencesModule, AutodialModule, LoggerModule, MailerModule, NotificationsModule,
  DialplanBridgeModule, TelegramModule, CloudAdminModule, AiChatModule,
  AgentProposalsModule, McpModule, CallCenterModule, IntegrationCredentialsModule,
] as const;

export const PBX_CORE_MODELS = [
  User, Role, NumberList, ActionLog, UserSession, Context,
  PsEndpoint, PsAuth, PsAor, PsContact, PickupGroup, ProvisionTemplate,
  PsRegistration, PsEndpointIdIp, Route, ContextInclude, WebhookFailure, Ivr,
  Prompt, TtsEngine, SttEngine, MohClass, MohEntry, SystemSetting, TenantSetting,
  Cdr, VoiceRobot, VoiceRobotKeywordGroup, VoiceRobotKeyword, VoiceRobotLog,
  VoiceRobotCdr, VoiceRobotDataList, Queue, QueueMember, ServiceRequest, CcSubject,
  CcDistrict, KomandorClaim, KomandorStore, KomandorDict, CcPauseReason,
  CcAgentSession, CcAgentEvent, CcAgentQueue, CcMissedCall, CcContact, CcQueueCall,
  CcDailyQueueStats, CcDailyAgentStats, CcOperatorSettings, CcSettings,
  CcDisplayToken, CcAlertConfig, CcChatMessage, CcChatChannel, CcCardTemplate,
  CcCardField, CcCardData, CcReportSchedule, CcAiProvider, CcAiAuditLog,
  AgentThread, AgentThreadMessage, AgentProposal, AgentWorkflow, AgentWorkflowStep,
  AiChatSettings, TimeGroup, Directory, DirectoryField, DirectoryRecord,
  RouteDirectoryBinding, RouteTemplate, VoicemailMessage, VoicemailAccessToken,
  CallbackRequest, NotificationIntegration, CallGroup, CallGroupMember,
  ConferenceRoom, ConferenceRoomModerator, ConferenceGuestToken, ConferenceMeeting,
  ConferenceMeetingParticipant, AcBase, AcBaseField, AcContact, AcContactPhone,
  AcImportProfile, AcImportRun, AcCampaign, AcSchedule, AcDnc, AcTask, AcAttempt,
  AcDailyCampaignStats, Tenant, ModuleRegistry, TenantModule, CloudSetting,
  HubModule, HubModulePage, RoleStartDefault, TenantRoleStart, DeviceToken,
  BillingBalance, BillingTransaction, ProductActivation, LocalLicenseDocument,
  LocalLicenseBinding, IntegrationPrincipal, IntegrationCredential, IntegrationGrant,
  IntegrationAudit, IntegrationCommand, IntegrationAuthLimit,
  AiProviderRevision, AiMediaAsset, AiUpload, AiIdempotency, AiJob, AiJobStage,
  AiProviderOperation, AiOutbox, AiJobEvent,
  AiQuotaCounter, AiPriceRevision, AiUsageReservation, AiUsageEvent, AiUsageLedger,
  AiTrialPolicySnapshot, AiSkuRevision, AiSkuOffer, AiSkuEntitlement,
  AiCaptureNodeBinding, AiCaptureIntent, AiCaptureSegment, AiCaptureReceipt,
  SaProject, SaProjectVersion, SaProjectMember, SaRecording, SaAnalysisRun,
  SaTranscript, SaTranscriptSegment, SaResult,
  AiWebhookEndpoint, AiWebhookDelivery, AiWebhookAttempt,
  AiRobotDraft, AiRobotVersion, AiRobotDeployment,
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
] as const;

export const PBX_THROTTLER_PROVIDER = { provide: APP_GUARD, useClass: ThrottlerGuard };

type NestImport = Type<unknown> | DynamicModule | Promise<DynamicModule> | ForwardReference;

export function createPbxSequelizeRoot(models: readonly unknown[]): DynamicModule {
  return SequelizeModule.forRootAsync({
    imports: [ConfigModule],
    inject: [ConfigService],
    useFactory: async () => {
      await checkSchemaReadiness();
      return {
        ...resolveDatabaseConfig(process.env),
        models: [...models] as ModelCtor[],
        autoLoadModels: false,
        synchronize: false,
        logging: false,
        define: { timestamps: false, freezeTableName: true },
      };
    },
  });
}

export function createPbxRuntimeImports(
  models: readonly unknown[], extraModules: readonly NestImport[] = [],
): NestImport[] {
  return [
    createPbxSequelizeRoot(models),
    EventEmitterModule.forRoot({ wildcard: true }),
    ThrottlerModule.forRoot([{ name: 'global', ttl: 60000, limit: 60 }]),
    ...PBX_CORE_NEST_MODULES,
    ...extraModules,
  ];
}
