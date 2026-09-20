"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CallCenterModule = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const config_1 = require("@nestjs/config");
const ami_module_1 = require("../ami/ami.module");
const notifications_module_1 = require("../notifications/notifications.module");
const mailer_module_1 = require("../mailer/mailer.module");
const ai_platform_module_1 = require("../ai-platform/ai-platform.module");
const ari_module_1 = require("../ari/ari.module");
const voice_robots_module_1 = require("../voice-robots/voice-robots.module");
const cloud_admin_module_1 = require("../cloud-admin/cloud-admin.module");
const logger_module_1 = require("../logger/logger.module");
const conferences_module_1 = require("../conferences/conferences.module");
const callcenter_state_service_1 = require("./callcenter-state.service");
const callcenter_ami_service_1 = require("./callcenter-ami.service");
const callcenter_service_1 = require("./callcenter.service");
const callcenter_permissions_service_1 = require("./callcenter-permissions.service");
const callcenter_access_list_service_1 = require("./callcenter-access-list.service");
const callcenter_ai_adapter_1 = require("./callcenter-ai.adapter");
const callcenter_media_bridge_service_1 = require("./callcenter-media-bridge.service");
const callcenter_history_writer_service_1 = require("./callcenter-history-writer.service");
const callcenter_presence_service_1 = require("./callcenter-presence.service");
const callcenter_metrics_service_1 = require("./callcenter-metrics.service");
const callcenter_rollup_service_1 = require("./callcenter-rollup.service");
const callcenter_queuelog_reconciler_service_1 = require("./callcenter-queuelog-reconciler.service");
const callcenter_zombie_service_1 = require("./callcenter-zombie.service");
const callcenter_autopause_service_1 = require("./callcenter-autopause.service");
const callcenter_shift_store_service_1 = require("./callcenter-shift-store.service");
const callcenter_shift_restore_service_1 = require("./callcenter-shift-restore.service");
const callcenter_shift_janitor_service_1 = require("./callcenter-shift-janitor.service");
const callcenter_controller_1 = require("./callcenter.controller");
const callcenter_sse_controller_1 = require("./callcenter-sse.controller");
const callcenter_settings_controller_1 = require("./callcenter-settings.controller");
const callcenter_cards_controller_1 = require("./callcenter-cards.controller");
const callcenter_chat_controller_1 = require("./callcenter-chat.controller");
const callcenter_settings_service_1 = require("./callcenter-settings.service");
const callcenter_cards_service_1 = require("./callcenter-cards.service");
const callcenter_chat_service_1 = require("./callcenter-chat.service");
const callcenter_wallboard_service_1 = require("./callcenter-wallboard.service");
const callcenter_wallboard_controller_1 = require("./callcenter-wallboard.controller");
const callcenter_alert_service_1 = require("./callcenter-alert.service");
const callcenter_reports_service_1 = require("./reports/callcenter-reports.service");
const callcenter_reports_controller_1 = require("./reports/callcenter-reports.controller");
const callcenter_report_delivery_service_1 = require("./reports/callcenter-report-delivery.service");
const callcenter_report_schedules_service_1 = require("./reports/callcenter-report-schedules.service");
const callcenter_report_scheduler_service_1 = require("./reports/callcenter-report-scheduler.service");
const callcenter_report_schedules_controller_1 = require("./reports/callcenter-report-schedules.controller");
const callcenter_webrtc_controller_1 = require("./callcenter-webrtc.controller");
const display_token_guard_1 = require("./guards/display-token.guard");
const pause_reason_model_1 = require("./models/pause-reason.model");
const agent_session_model_1 = require("./models/agent-session.model");
const agent_event_model_1 = require("./models/agent-event.model");
const agent_queue_model_1 = require("./models/agent-queue.model");
const missed_call_model_1 = require("./models/missed-call.model");
const cc_contact_model_1 = require("./models/cc-contact.model");
const queue_call_model_1 = require("./models/queue-call.model");
const daily_queue_stats_model_1 = require("./models/daily-queue-stats.model");
const daily_agent_stats_model_1 = require("./models/daily-agent-stats.model");
const operator_settings_model_1 = require("./models/operator-settings.model");
const cc_settings_model_1 = require("./models/cc-settings.model");
const display_token_model_1 = require("./models/display-token.model");
const alert_config_model_1 = require("./models/alert-config.model");
const card_template_model_1 = require("./models/card-template.model");
const card_field_model_1 = require("./models/card-field.model");
const card_data_model_1 = require("./models/card-data.model");
const chat_message_model_1 = require("./models/chat-message.model");
const chat_channel_model_1 = require("./models/chat-channel.model");
const report_schedule_model_1 = require("./models/report-schedule.model");
const queue_model_1 = require("../queues/queue.model");
const user_model_1 = require("../users/user.model");
const number_list_model_1 = require("../numbers/number-list.model");
const service_request_model_1 = require("../service-requests/service-request.model");
const ps_endpoint_model_1 = require("../endpoints/ps-endpoint.model");
const call_group_model_1 = require("../call-groups/call-group.model");
const call_group_member_model_1 = require("../call-groups/call-group-member.model");
const file_queue_log_reader_1 = require("./queuelog/file-queue-log-reader");
const realtime_queue_log_reader_1 = require("./queuelog/realtime-queue-log-reader");
const queue_log_reader_factory_1 = require("./queuelog/queue-log-reader.factory");
let CallCenterModule = class CallCenterModule {
};
exports.CallCenterModule = CallCenterModule;
exports.CallCenterModule = CallCenterModule = __decorate([
    (0, common_1.Module)({
        imports: [
            sequelize_1.SequelizeModule.forFeature([
                pause_reason_model_1.CcPauseReason,
                agent_session_model_1.CcAgentSession,
                agent_event_model_1.CcAgentEvent,
                agent_queue_model_1.CcAgentQueue,
                missed_call_model_1.CcMissedCall,
                cc_contact_model_1.CcContact,
                queue_call_model_1.CcQueueCall,
                daily_queue_stats_model_1.CcDailyQueueStats,
                daily_agent_stats_model_1.CcDailyAgentStats,
                operator_settings_model_1.CcOperatorSettings,
                cc_settings_model_1.CcSettings,
                display_token_model_1.CcDisplayToken,
                alert_config_model_1.CcAlertConfig,
                card_template_model_1.CcCardTemplate,
                card_field_model_1.CcCardField,
                card_data_model_1.CcCardData,
                chat_message_model_1.CcChatMessage,
                chat_channel_model_1.CcChatChannel,
                report_schedule_model_1.CcReportSchedule,
                queue_model_1.Queue, // for tenant resolution from queue names
                user_model_1.User, // for agent display names
                number_list_model_1.NumberList, // supervisor access lists (numbers)
                service_request_model_1.ServiceRequest, // Client Card sidebar — linked service requests
                ps_endpoint_model_1.PsEndpoint, // Transfer directory — internal endpoints (D-36)
                call_group_model_1.CallGroup, // Transfer directory — call groups (D-36)
                call_group_member_model_1.CallGroupMember, // Transfer directory — call group free-operator counts (D-36)
            ]),
            ami_module_1.AmiModule,
            notifications_module_1.NotificationsModule,
            mailer_module_1.MailerModule,
            ai_platform_module_1.AiPlatformModule,
            ari_module_1.AriModule,
            voice_robots_module_1.VoiceRobotsModule,
            cloud_admin_module_1.CloudAdminModule,
            config_1.ConfigModule,
            logger_module_1.LoggerModule,
            conferences_module_1.ConferencesModule,
        ],
        providers: [
            callcenter_state_service_1.CallCenterStateService,
            callcenter_history_writer_service_1.CallCenterHistoryWriterService,
            callcenter_presence_service_1.CallCenterPresenceService,
            // String alias for AmiService ModuleRef.get('CallCenterPresenceService')
            {
                provide: 'CallCenterPresenceService',
                useExisting: callcenter_presence_service_1.CallCenterPresenceService,
            },
            callcenter_metrics_service_1.CallCenterMetricsService,
            callcenter_rollup_service_1.CallCenterRollupService,
            callcenter_autopause_service_1.CallCenterAutoPauseService,
            file_queue_log_reader_1.FileQueueLogReader,
            realtime_queue_log_reader_1.RealtimeQueueLogReader,
            queue_log_reader_factory_1.queueLogReaderProvider,
            callcenter_queuelog_reconciler_service_1.CallCenterQueueLogReconcilerService,
            // String alias for AmiService ModuleRef.get('CallCenterQueueLogReconcilerService')
            {
                provide: 'CallCenterQueueLogReconcilerService',
                useExisting: callcenter_queuelog_reconciler_service_1.CallCenterQueueLogReconcilerService,
            },
            callcenter_ami_service_1.CallCenterAmiService,
            // String alias for AmiService ModuleRef.get('CallCenterAmiService')
            {
                provide: 'CallCenterAmiService',
                useExisting: callcenter_ami_service_1.CallCenterAmiService,
            },
            callcenter_service_1.CallCenterService,
            // String alias so CallCenterAmiService can lazily resolve CallCenterService
            // via ModuleRef (autoResolveOnAnswer, D-17) without a circular constructor
            // dependency — same pattern as the 'CallCenterAmiService' alias above.
            {
                provide: 'CallCenterService',
                useExisting: callcenter_service_1.CallCenterService,
            },
            callcenter_shift_store_service_1.CallCenterShiftStoreService,
            callcenter_shift_restore_service_1.CallCenterShiftRestoreService,
            callcenter_shift_janitor_service_1.CallCenterShiftJanitorService,
            callcenter_zombie_service_1.CallCenterZombieService,
            callcenter_permissions_service_1.CallCenterPermissionsService,
            callcenter_access_list_service_1.CallCenterAccessListService,
            callcenter_ai_adapter_1.CallCenterAiAdapter,
            callcenter_media_bridge_service_1.CallCenterMediaBridgeService,
            callcenter_settings_service_1.CallCenterSettingsService,
            callcenter_cards_service_1.CallCenterCardsService,
            callcenter_chat_service_1.CallCenterChatService,
            callcenter_wallboard_service_1.CallCenterWallboardService,
            callcenter_alert_service_1.CallCenterAlertService,
            callcenter_reports_service_1.CallCenterReportsService,
            callcenter_report_delivery_service_1.CallCenterReportDeliveryService,
            callcenter_report_schedules_service_1.CallCenterReportSchedulesService,
            callcenter_report_scheduler_service_1.CallCenterReportSchedulerService,
            display_token_guard_1.DisplayTokenGuard,
        ],
        controllers: [
            callcenter_controller_1.CallCenterController,
            callcenter_sse_controller_1.CallCenterSseController,
            callcenter_settings_controller_1.CallCenterSettingsController,
            callcenter_cards_controller_1.CallCenterCardsController,
            callcenter_chat_controller_1.CallCenterChatController,
            callcenter_wallboard_controller_1.CallCenterWallboardController,
            callcenter_reports_controller_1.CallCenterReportsController,
            callcenter_report_schedules_controller_1.CallCenterReportSchedulesController,
            callcenter_webrtc_controller_1.CallCenterWebrtcController,
        ],
        exports: [
            callcenter_state_service_1.CallCenterStateService,
            callcenter_metrics_service_1.CallCenterMetricsService,
            callcenter_rollup_service_1.CallCenterRollupService,
            callcenter_queuelog_reconciler_service_1.CallCenterQueueLogReconcilerService,
            callcenter_ami_service_1.CallCenterAmiService, // exported so AmiService can resolve it via ModuleRef
            callcenter_service_1.CallCenterService,
            callcenter_permissions_service_1.CallCenterPermissionsService,
            callcenter_settings_service_1.CallCenterSettingsService,
            callcenter_reports_service_1.CallCenterReportsService,
            callcenter_media_bridge_service_1.CallCenterMediaBridgeService,
        ],
    })
], CallCenterModule);
//# sourceMappingURL=callcenter.module.js.map