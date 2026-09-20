"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PBX_THROTTLER_PROVIDER = exports.PBX_CORE_MODELS = exports.PBX_CORE_NEST_MODULES = void 0;
exports.createPbxSequelizeRoot = createPbxSequelizeRoot;
exports.createPbxRuntimeImports = createPbxRuntimeImports;
const config_1 = require("@nestjs/config");
const event_emitter_1 = require("@nestjs/event-emitter");
const core_1 = require("@nestjs/core");
const sequelize_1 = require("@nestjs/sequelize");
const throttler_1 = require("@nestjs/throttler");
const database_config_cjs_1 = require("../database/database-config.cjs");
const schema_readiness_cjs_1 = require("../database/schema-readiness.cjs");
const redis_module_1 = require("../modules/redis/redis.module");
const auth_module_1 = require("../modules/auth/auth.module");
const users_module_1 = require("../modules/users/users.module");
const endpoints_module_1 = require("../modules/endpoints/endpoints.module");
const contexts_module_1 = require("../modules/contexts/contexts.module");
const roles_module_1 = require("../modules/roles/roles.module");
const numbers_module_1 = require("../modules/numbers/numbers.module");
const ami_module_1 = require("../modules/ami/ami.module");
const diagnostics_module_1 = require("../modules/diagnostics/diagnostics.module");
const trunks_module_1 = require("../modules/trunks/trunks.module");
const routes_module_1 = require("../modules/routes/routes.module");
const ivrs_module_1 = require("../modules/ivrs/ivrs.module");
const prompts_module_1 = require("../modules/prompts/prompts.module");
const tts_engines_module_1 = require("../modules/tts-engines/tts-engines.module");
const stt_engines_module_1 = require("../modules/stt-engines/stt-engines.module");
const moh_module_1 = require("../modules/moh/moh.module");
const system_settings_module_1 = require("../modules/system-settings/system-settings.module");
const reports_cdr_module_1 = require("../modules/reports/cdr/reports-cdr.module");
const cdr_model_1 = require("../modules/reports/cdr/cdr.model");
const voice_robots_module_1 = require("../modules/voice-robots/voice-robots.module");
const ari_module_1 = require("../modules/ari/ari.module");
const queues_module_1 = require("../modules/queues/queues.module");
const service_requests_module_1 = require("../modules/service-requests/service-requests.module");
const komandor_claims_module_1 = require("../modules/komandor-claims/komandor-claims.module");
const komandor_claim_model_1 = require("../modules/komandor-claims/komandor-claim.model");
const komandor_store_model_1 = require("../modules/komandor-claims/komandor-store.model");
const komandor_dict_model_1 = require("../modules/komandor-claims/komandor-dict.model");
const time_groups_module_1 = require("../modules/time-groups/time-groups.module");
const directories_module_1 = require("../modules/directories/directories.module");
const route_references_module_1 = require("../modules/route-references/route-references.module");
const dialplan_dry_run_module_1 = require("../modules/dialplan-dry-run/dialplan-dry-run.module");
const route_templates_module_1 = require("../modules/route-templates/route-templates.module");
const route_template_model_1 = require("../modules/route-templates/route-template.model");
const voicemail_module_1 = require("../modules/voicemail/voicemail.module");
const callback_requests_module_1 = require("../modules/callback-requests/callback-requests.module");
const callback_request_model_1 = require("../modules/callback-requests/callback-request.model");
const call_groups_module_1 = require("../modules/call-groups/call-groups.module");
const call_group_model_1 = require("../modules/call-groups/call-group.model");
const call_group_member_model_1 = require("../modules/call-groups/call-group-member.model");
const autodial_module_1 = require("../modules/autodial/autodial.module");
const ac_base_model_1 = require("../modules/autodial/models/ac-base.model");
const ac_base_field_model_1 = require("../modules/autodial/models/ac-base-field.model");
const ac_contact_model_1 = require("../modules/autodial/models/ac-contact.model");
const ac_contact_phone_model_1 = require("../modules/autodial/models/ac-contact-phone.model");
const ac_import_profile_model_1 = require("../modules/autodial/models/ac-import-profile.model");
const ac_import_run_model_1 = require("../modules/autodial/models/ac-import-run.model");
const ac_campaign_model_1 = require("../modules/autodial/models/ac-campaign.model");
const ac_schedule_model_1 = require("../modules/autodial/models/ac-schedule.model");
const ac_dnc_model_1 = require("../modules/autodial/models/ac-dnc.model");
const ac_task_model_1 = require("../modules/autodial/models/ac-task.model");
const ac_attempt_model_1 = require("../modules/autodial/models/ac-attempt.model");
const ac_daily_campaign_stats_model_1 = require("../modules/autodial/models/ac-daily-campaign-stats.model");
const conferences_module_1 = require("../modules/conferences/conferences.module");
const conference_room_model_1 = require("../modules/conferences/models/conference-room.model");
const conference_room_moderator_model_1 = require("../modules/conferences/models/conference-room-moderator.model");
const conference_guest_token_model_1 = require("../modules/conferences/models/conference-guest-token.model");
const conference_meeting_model_1 = require("../modules/conferences/models/conference-meeting.model");
const conference_meeting_participant_model_1 = require("../modules/conferences/models/conference-meeting-participant.model");
const sms_module_1 = require("../modules/sms/sms.module");
const cloud_admin_module_1 = require("../modules/cloud-admin/cloud-admin.module");
const ai_chat_module_1 = require("../modules/ai-chat/ai-chat.module");
const agent_proposals_module_1 = require("../modules/ai-chat/agent-proposals.module");
const mcp_module_1 = require("../modules/mcp/mcp.module");
const health_module_1 = require("../modules/health/health.module");
const callcenter_module_1 = require("../modules/callcenter/callcenter.module");
const integration_credentials_module_1 = require("../modules/integration-credentials/integration-credentials.module");
const integration_credential_models_1 = require("../modules/integration-credentials/integration-credential.models");
const ai_provider_model_1 = require("../modules/ai-connectivity/ai-provider.model");
const ai_audit_log_model_1 = require("../modules/ai-chat/models/ai-audit-log.model");
const agent_thread_model_1 = require("../modules/ai-chat/models/agent-thread.model");
const agent_thread_message_model_1 = require("../modules/ai-chat/models/agent-thread-message.model");
const agent_proposal_model_1 = require("../modules/ai-chat/models/agent-proposal.model");
const agent_workflow_model_1 = require("../modules/ai-chat/models/agent-workflow.model");
const ai_chat_settings_model_1 = require("../modules/ai-chat/ai-chat-settings.model");
const pause_reason_model_1 = require("../modules/callcenter/models/pause-reason.model");
const agent_session_model_1 = require("../modules/callcenter/models/agent-session.model");
const agent_event_model_1 = require("../modules/callcenter/models/agent-event.model");
const agent_queue_model_1 = require("../modules/callcenter/models/agent-queue.model");
const missed_call_model_1 = require("../modules/callcenter/models/missed-call.model");
const cc_contact_model_1 = require("../modules/callcenter/models/cc-contact.model");
const queue_call_model_1 = require("../modules/callcenter/models/queue-call.model");
const daily_queue_stats_model_1 = require("../modules/callcenter/models/daily-queue-stats.model");
const daily_agent_stats_model_1 = require("../modules/callcenter/models/daily-agent-stats.model");
const operator_settings_model_1 = require("../modules/callcenter/models/operator-settings.model");
const cc_settings_model_1 = require("../modules/callcenter/models/cc-settings.model");
const display_token_model_1 = require("../modules/callcenter/models/display-token.model");
const alert_config_model_1 = require("../modules/callcenter/models/alert-config.model");
const chat_message_model_1 = require("../modules/callcenter/models/chat-message.model");
const chat_channel_model_1 = require("../modules/callcenter/models/chat-channel.model");
const card_template_model_1 = require("../modules/callcenter/models/card-template.model");
const card_field_model_1 = require("../modules/callcenter/models/card-field.model");
const card_data_model_1 = require("../modules/callcenter/models/card-data.model");
const report_schedule_model_1 = require("../modules/callcenter/models/report-schedule.model");
const tenant_model_1 = require("../modules/cloud-admin/tenant.model");
const module_registry_model_1 = require("../modules/cloud-admin/module-registry.model");
const tenant_module_model_1 = require("../modules/cloud-admin/tenant-module.model");
const cloud_setting_model_1 = require("../modules/cloud-admin/cloud-setting.model");
const hub_module_model_1 = require("../modules/cloud-admin/models/hub-module.model");
const hub_module_page_model_1 = require("../modules/cloud-admin/models/hub-module-page.model");
const role_start_model_1 = require("../modules/cloud-admin/models/role-start.model");
const device_token_model_1 = require("../modules/cloud-admin/models/device-token.model");
const billing_balance_model_1 = require("../modules/cloud-admin/billing/models/billing-balance.model");
const billing_transaction_model_1 = require("../modules/cloud-admin/billing/models/billing-transaction.model");
const queue_model_1 = require("../modules/queues/queue.model");
const queue_member_model_1 = require("../modules/queues/queue-member.model");
const prompt_model_1 = require("../modules/prompts/prompt.model");
const tts_engine_model_1 = require("../modules/tts-engines/tts-engine.model");
const stt_engine_model_1 = require("../modules/stt-engines/stt-engine.model");
const user_model_1 = require("../modules/users/user.model");
const ps_endpoint_model_1 = require("../modules/endpoints/ps-endpoint.model");
const ps_auth_model_1 = require("../modules/endpoints/ps-auth.model");
const ps_aor_model_1 = require("../modules/endpoints/ps-aor.model");
const ps_contact_model_1 = require("../modules/endpoints/ps-contact.model");
const context_model_1 = require("../modules/contexts/context.model");
const role_model_1 = require("../modules/roles/role.model");
const number_list_model_1 = require("../modules/numbers/number-list.model");
const action_log_model_1 = require("../modules/logger/action-log.model");
const logger_module_1 = require("../modules/logger/logger.module");
const mailer_module_1 = require("../modules/mailer/mailer.module");
const notifications_module_1 = require("../modules/notifications/notifications.module");
const dialplan_bridge_module_1 = require("../modules/dialplan-bridge/dialplan-bridge.module");
const notification_integration_model_1 = require("../modules/notifications/notification-integration.model");
const telegram_module_1 = require("../modules/telegram/telegram.module");
const user_session_model_1 = require("../modules/auth/user-session.model");
const pickup_group_model_1 = require("../modules/endpoints/pickup-group.model");
const provision_template_model_1 = require("../modules/endpoints/provision-template.model");
const ps_registration_model_1 = require("../modules/trunks/ps-registration.model");
const ps_endpoint_id_ip_model_1 = require("../modules/trunks/ps-endpoint-id-ip.model");
const route_model_1 = require("../modules/routes/route.model");
const context_include_model_1 = require("../modules/routes/context-include.model");
const webhook_failure_model_1 = require("../modules/routes/webhook-failure.model");
const ivr_model_1 = require("../modules/ivrs/ivr.model");
const moh_class_model_1 = require("../modules/moh/moh-class.model");
const moh_entry_model_1 = require("../modules/moh/moh-entry.model");
const system_setting_model_1 = require("../modules/system-settings/system-setting.model");
const tenant_settings_module_1 = require("../modules/tenant-settings/tenant-settings.module");
const tenant_setting_model_1 = require("../modules/tenant-settings/tenant-setting.model");
const voice_robot_model_1 = require("../modules/voice-robots/voice-robot.model");
const keyword_group_model_1 = require("../modules/voice-robots/keyword-group.model");
const keyword_model_1 = require("../modules/voice-robots/keyword.model");
const voice_robot_log_model_1 = require("../modules/voice-robots/voice-robot-log.model");
const voice_robot_cdr_model_1 = require("../modules/voice-robots/voice-robot-cdr.model");
const data_list_model_1 = require("../modules/voice-robots/data-list.model");
const service_request_model_1 = require("../modules/service-requests/service-request.model");
const time_group_model_1 = require("../modules/time-groups/time-group.model");
const directory_model_1 = require("../modules/directories/directory.model");
const directory_field_model_1 = require("../modules/directories/directory-field.model");
const directory_record_model_1 = require("../modules/directories/directory-record.model");
const route_directory_binding_model_1 = require("../modules/directories/route-directory-binding.model");
const voicemail_message_model_1 = require("../modules/voicemail/voicemail-message.model");
const voicemail_access_token_model_1 = require("../modules/voicemail/voicemail-access-token.model");
const cc_subject_model_1 = require("../modules/service-requests/cc-subject.model");
const cc_district_model_1 = require("../modules/service-requests/cc-district.model");
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
/** Existing open PBX nest modules. Commercial robot/analytics product modules are not listed. */
exports.PBX_CORE_NEST_MODULES = [
    redis_module_1.RedisModule, health_module_1.HealthModule, auth_module_1.AuthModule, users_module_1.UsersModule, endpoints_module_1.EndpointsModule, contexts_module_1.ContextsModule,
    roles_module_1.RolesModule, numbers_module_1.NumbersModule, ami_module_1.AmiModule, diagnostics_module_1.DiagnosticsModule, trunks_module_1.TrunksModule, routes_module_1.RoutesModule,
    ivrs_module_1.IvrsModule, prompts_module_1.PromptsModule, tts_engines_module_1.TtsEnginesModule, stt_engines_module_1.SttEnginesModule, moh_module_1.MohModule,
    system_settings_module_1.SystemSettingsModule, tenant_settings_module_1.TenantSettingsModule, voice_robots_module_1.VoiceRobotsModule, reports_cdr_module_1.ReportsCdrModule,
    ari_module_1.AriModule, queues_module_1.QueuesModule, service_requests_module_1.ServiceRequestsModule, komandor_claims_module_1.KomandorClaimsModule, sms_module_1.SmsModule,
    time_groups_module_1.TimeGroupsModule, directories_module_1.DirectoriesModule, route_references_module_1.RouteReferencesModule, dialplan_dry_run_module_1.DialplanDryRunModule,
    route_templates_module_1.RouteTemplatesModule, voicemail_module_1.VoicemailModule, callback_requests_module_1.CallbackRequestsModule, call_groups_module_1.CallGroupsModule,
    conferences_module_1.ConferencesModule, autodial_module_1.AutodialModule, logger_module_1.LoggerModule, mailer_module_1.MailerModule, notifications_module_1.NotificationsModule,
    dialplan_bridge_module_1.DialplanBridgeModule, telegram_module_1.TelegramModule, cloud_admin_module_1.CloudAdminModule, ai_chat_module_1.AiChatModule,
    agent_proposals_module_1.AgentProposalsModule, mcp_module_1.McpModule, callcenter_module_1.CallCenterModule, integration_credentials_module_1.IntegrationCredentialsModule,
];
exports.PBX_CORE_MODELS = [
    user_model_1.User, role_model_1.Role, number_list_model_1.NumberList, action_log_model_1.ActionLog, user_session_model_1.UserSession, context_model_1.Context,
    ps_endpoint_model_1.PsEndpoint, ps_auth_model_1.PsAuth, ps_aor_model_1.PsAor, ps_contact_model_1.PsContact, pickup_group_model_1.PickupGroup, provision_template_model_1.ProvisionTemplate,
    ps_registration_model_1.PsRegistration, ps_endpoint_id_ip_model_1.PsEndpointIdIp, route_model_1.Route, context_include_model_1.ContextInclude, webhook_failure_model_1.WebhookFailure, ivr_model_1.Ivr,
    prompt_model_1.Prompt, tts_engine_model_1.TtsEngine, stt_engine_model_1.SttEngine, moh_class_model_1.MohClass, moh_entry_model_1.MohEntry, system_setting_model_1.SystemSetting, tenant_setting_model_1.TenantSetting,
    cdr_model_1.Cdr, voice_robot_model_1.VoiceRobot, keyword_group_model_1.VoiceRobotKeywordGroup, keyword_model_1.VoiceRobotKeyword, voice_robot_log_model_1.VoiceRobotLog,
    voice_robot_cdr_model_1.VoiceRobotCdr, data_list_model_1.VoiceRobotDataList, queue_model_1.Queue, queue_member_model_1.QueueMember, service_request_model_1.ServiceRequest, cc_subject_model_1.CcSubject,
    cc_district_model_1.CcDistrict, komandor_claim_model_1.KomandorClaim, komandor_store_model_1.KomandorStore, komandor_dict_model_1.KomandorDict, pause_reason_model_1.CcPauseReason,
    agent_session_model_1.CcAgentSession, agent_event_model_1.CcAgentEvent, agent_queue_model_1.CcAgentQueue, missed_call_model_1.CcMissedCall, cc_contact_model_1.CcContact, queue_call_model_1.CcQueueCall,
    daily_queue_stats_model_1.CcDailyQueueStats, daily_agent_stats_model_1.CcDailyAgentStats, operator_settings_model_1.CcOperatorSettings, cc_settings_model_1.CcSettings,
    display_token_model_1.CcDisplayToken, alert_config_model_1.CcAlertConfig, chat_message_model_1.CcChatMessage, chat_channel_model_1.CcChatChannel, card_template_model_1.CcCardTemplate,
    card_field_model_1.CcCardField, card_data_model_1.CcCardData, report_schedule_model_1.CcReportSchedule, ai_provider_model_1.CcAiProvider, ai_audit_log_model_1.CcAiAuditLog,
    agent_thread_model_1.AgentThread, agent_thread_message_model_1.AgentThreadMessage, agent_proposal_model_1.AgentProposal, agent_workflow_model_1.AgentWorkflow, agent_workflow_model_1.AgentWorkflowStep,
    ai_chat_settings_model_1.AiChatSettings, time_group_model_1.TimeGroup, directory_model_1.Directory, directory_field_model_1.DirectoryField, directory_record_model_1.DirectoryRecord,
    route_directory_binding_model_1.RouteDirectoryBinding, route_template_model_1.RouteTemplate, voicemail_message_model_1.VoicemailMessage, voicemail_access_token_model_1.VoicemailAccessToken,
    callback_request_model_1.CallbackRequest, notification_integration_model_1.NotificationIntegration, call_group_model_1.CallGroup, call_group_member_model_1.CallGroupMember,
    conference_room_model_1.ConferenceRoom, conference_room_moderator_model_1.ConferenceRoomModerator, conference_guest_token_model_1.ConferenceGuestToken, conference_meeting_model_1.ConferenceMeeting,
    conference_meeting_participant_model_1.ConferenceMeetingParticipant, ac_base_model_1.AcBase, ac_base_field_model_1.AcBaseField, ac_contact_model_1.AcContact, ac_contact_phone_model_1.AcContactPhone,
    ac_import_profile_model_1.AcImportProfile, ac_import_run_model_1.AcImportRun, ac_campaign_model_1.AcCampaign, ac_schedule_model_1.AcSchedule, ac_dnc_model_1.AcDnc, ac_task_model_1.AcTask, ac_attempt_model_1.AcAttempt,
    ac_daily_campaign_stats_model_1.AcDailyCampaignStats, tenant_model_1.Tenant, module_registry_model_1.ModuleRegistry, tenant_module_model_1.TenantModule, cloud_setting_model_1.CloudSetting,
    hub_module_model_1.HubModule, hub_module_page_model_1.HubModulePage, role_start_model_1.RoleStartDefault, role_start_model_1.TenantRoleStart, device_token_model_1.DeviceToken,
    billing_balance_model_1.BillingBalance, billing_transaction_model_1.BillingTransaction, product_activation_model_1.ProductActivation, local_license_document_model_1.LocalLicenseDocument,
    local_license_binding_model_1.LocalLicenseBinding, integration_credential_models_1.IntegrationPrincipal, integration_credential_models_1.IntegrationCredential, integration_credential_models_1.IntegrationGrant,
    integration_credential_models_1.IntegrationAudit, integration_credential_models_1.IntegrationCommand, integration_credential_models_1.IntegrationAuthLimit,
    ai_provider_revision_model_1.AiProviderRevision, media_asset_models_1.AiMediaAsset, media_asset_models_1.AiUpload, ai_job_models_1.AiIdempotency, ai_job_models_1.AiJob, ai_job_models_1.AiJobStage,
    ai_job_models_1.AiProviderOperation, ai_job_models_1.AiOutbox, ai_job_models_1.AiJobEvent,
    usage_models_1.AiQuotaCounter, usage_models_1.AiPriceRevision, usage_models_1.AiUsageReservation, usage_models_1.AiUsageEvent, usage_models_1.AiUsageLedger,
    capture_models_1.AiCaptureNodeBinding, capture_models_1.AiCaptureIntent, capture_models_1.AiCaptureSegment, capture_models_1.AiCaptureReceipt,
    speech_analytics_models_1.SaProject, speech_analytics_models_1.SaProjectVersion, speech_analytics_models_1.SaProjectMember, speech_analytics_models_1.SaRecording, speech_analytics_models_1.SaAnalysisRun,
    speech_analytics_models_1.SaTranscript, speech_analytics_models_1.SaTranscriptSegment, speech_analytics_models_1.SaResult,
    webhook_models_1.AiWebhookEndpoint, webhook_models_1.AiWebhookDelivery, webhook_models_1.AiWebhookAttempt,
    ai_voice_models_1.AiRobotDraft, ai_voice_models_1.AiRobotVersion, ai_voice_models_1.AiRobotDeployment,
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
];
exports.PBX_THROTTLER_PROVIDER = { provide: core_1.APP_GUARD, useClass: throttler_1.ThrottlerGuard };
function createPbxSequelizeRoot(models) {
    return sequelize_1.SequelizeModule.forRootAsync({
        imports: [config_1.ConfigModule],
        inject: [config_1.ConfigService],
        useFactory: async () => {
            await (0, schema_readiness_cjs_1.checkSchemaReadiness)();
            return {
                ...(0, database_config_cjs_1.resolveDatabaseConfig)(process.env),
                models: [...models],
                autoLoadModels: false,
                synchronize: false,
                logging: false,
                define: { timestamps: false, freezeTableName: true },
            };
        },
    });
}
function createPbxRuntimeImports(models, extraModules = []) {
    return [
        createPbxSequelizeRoot(models),
        event_emitter_1.EventEmitterModule.forRoot({ wildcard: true }),
        throttler_1.ThrottlerModule.forRoot([{ name: 'global', ttl: 60000, limit: 60 }]),
        ...exports.PBX_CORE_NEST_MODULES,
        ...extraModules,
    ];
}
//# sourceMappingURL=pbx-core.composition.js.map