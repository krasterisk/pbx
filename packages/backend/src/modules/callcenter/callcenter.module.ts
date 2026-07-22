import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { ConfigModule } from '@nestjs/config';
import { AmiModule } from '../ami/ami.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MailerModule } from '../mailer/mailer.module';
import { AiPlatformModule } from '../ai-platform/ai-platform.module';
import { AriModule } from '../ari/ari.module';
import { VoiceRobotsModule } from '../voice-robots/voice-robots.module';
import { CloudAdminModule } from '../cloud-admin/cloud-admin.module';
import { LoggerModule } from '../logger/logger.module';
import { CallCenterStateService } from './callcenter-state.service';
import { CallCenterAmiService } from './callcenter-ami.service';
import { CallCenterService } from './callcenter.service';
import { CallCenterPermissionsService } from './callcenter-permissions.service';
import { CallCenterAiAdapter } from './callcenter-ai.adapter';
import { CallCenterMediaBridgeService } from './callcenter-media-bridge.service';
import { CallCenterHistoryWriterService } from './callcenter-history-writer.service';
import { CallCenterMetricsService } from './callcenter-metrics.service';
import { CallCenterRollupService } from './callcenter-rollup.service';
import { CallCenterQueueLogReconcilerService } from './callcenter-queuelog-reconciler.service';
import { CallCenterZombieService } from './callcenter-zombie.service';
import { CallCenterAutoPauseService } from './callcenter-autopause.service';
import { CallCenterController } from './callcenter.controller';
import { CallCenterSseController } from './callcenter-sse.controller';
import { CallCenterSettingsController } from './callcenter-settings.controller';
import { CallCenterCardsController } from './callcenter-cards.controller';
import { CallCenterChatController } from './callcenter-chat.controller';
import { CallCenterSettingsService } from './callcenter-settings.service';
import { CallCenterCardsService } from './callcenter-cards.service';
import { CallCenterChatService } from './callcenter-chat.service';
import { CallCenterWallboardService } from './callcenter-wallboard.service';
import { CallCenterWallboardController } from './callcenter-wallboard.controller';
import { CallCenterAlertService } from './callcenter-alert.service';
import { CallCenterReportsService } from './reports/callcenter-reports.service';
import { CallCenterReportsController } from './reports/callcenter-reports.controller';
import { CallCenterReportDeliveryService } from './reports/callcenter-report-delivery.service';
import { CallCenterReportSchedulesService } from './reports/callcenter-report-schedules.service';
import { CallCenterReportSchedulerService } from './reports/callcenter-report-scheduler.service';
import { CallCenterReportSchedulesController } from './reports/callcenter-report-schedules.controller';
import { CallCenterWebrtcController } from './callcenter-webrtc.controller';
import { DisplayTokenGuard } from './guards/display-token.guard';
import { CcPauseReason } from './models/pause-reason.model';
import { CcAgentSession } from './models/agent-session.model';
import { CcAgentEvent } from './models/agent-event.model';
import { CcAgentQueue } from './models/agent-queue.model';
import { CcMissedCall } from './models/missed-call.model';
import { CcQueueCall } from './models/queue-call.model';
import { CcDailyQueueStats } from './models/daily-queue-stats.model';
import { CcDailyAgentStats } from './models/daily-agent-stats.model';
import { CcOperatorSettings } from './models/operator-settings.model';
import { CcSettings } from './models/cc-settings.model';
import { CcDisplayToken } from './models/display-token.model';
import { CcAlertConfig } from './models/alert-config.model';
import { CcCardTemplate } from './models/card-template.model';
import { CcCardField } from './models/card-field.model';
import { CcCardData } from './models/card-data.model';
import { CcChatMessage } from './models/chat-message.model';
import { CcChatChannel } from './models/chat-channel.model';
import { CcReportSchedule } from './models/report-schedule.model';
import { Queue } from '../queues/queue.model';
import { User } from '../users/user.model';
import { PhonebookEntry } from '../phonebooks/phonebook-entry.model';
import { RoutePhonebook } from '../phonebooks/phonebook.model';
import { ServiceRequest } from '../service-requests/service-request.model';
import { FileQueueLogReader } from './queuelog/file-queue-log-reader';
import { RealtimeQueueLogReader } from './queuelog/realtime-queue-log-reader';
import { queueLogReaderProvider } from './queuelog/queue-log-reader.factory';

@Module({
  imports: [
    SequelizeModule.forFeature([
      CcPauseReason,
      CcAgentSession,
      CcAgentEvent,
      CcAgentQueue,
      CcMissedCall,
      CcQueueCall,
      CcDailyQueueStats,
      CcDailyAgentStats,
      CcOperatorSettings,
      CcSettings,
      CcDisplayToken,
      CcAlertConfig,
      CcCardTemplate,
      CcCardField,
      CcCardData,
      CcChatMessage,
      CcChatChannel,
      CcReportSchedule,
      Queue,           // for tenant resolution from queue names
      User,            // for agent display names
      PhonebookEntry,  // Client Card sidebar lookup
      RoutePhonebook,  // Client Card sidebar lookup
      ServiceRequest,  // Client Card sidebar — linked service requests
    ]),
    AmiModule,
    NotificationsModule,
    MailerModule,
    AiPlatformModule,
    AriModule,
    VoiceRobotsModule,
    CloudAdminModule,
    ConfigModule,
    LoggerModule,
  ],
  providers: [
    CallCenterStateService,
    CallCenterHistoryWriterService,
    CallCenterMetricsService,
    CallCenterRollupService,
    CallCenterAutoPauseService,
    FileQueueLogReader,
    RealtimeQueueLogReader,
    queueLogReaderProvider,
    CallCenterQueueLogReconcilerService,
    // String alias for AmiService ModuleRef.get('CallCenterQueueLogReconcilerService')
    {
      provide: 'CallCenterQueueLogReconcilerService',
      useExisting: CallCenterQueueLogReconcilerService,
    },
    CallCenterAmiService,
    // String alias for AmiService ModuleRef.get('CallCenterAmiService')
    {
      provide: 'CallCenterAmiService',
      useExisting: CallCenterAmiService,
    },
    CallCenterService,
    // String alias so CallCenterAmiService can lazily resolve CallCenterService
    // via ModuleRef (autoResolveOnAnswer, D-17) without a circular constructor
    // dependency — same pattern as the 'CallCenterAmiService' alias above.
    {
      provide: 'CallCenterService',
      useExisting: CallCenterService,
    },
    CallCenterZombieService,
    CallCenterPermissionsService,
    CallCenterAiAdapter,
    CallCenterMediaBridgeService,
    CallCenterSettingsService,
    CallCenterCardsService,
    CallCenterChatService,
    CallCenterWallboardService,
    CallCenterAlertService,
    CallCenterReportsService,
    CallCenterReportDeliveryService,
    CallCenterReportSchedulesService,
    CallCenterReportSchedulerService,
    DisplayTokenGuard,
  ],
  controllers: [
    CallCenterController,
    CallCenterSseController,
    CallCenterSettingsController,
    CallCenterCardsController,
    CallCenterChatController,
    CallCenterWallboardController,
    CallCenterReportsController,
    CallCenterReportSchedulesController,
    CallCenterWebrtcController,
  ],
  exports: [
    CallCenterStateService,
    CallCenterMetricsService,
    CallCenterRollupService,
    CallCenterQueueLogReconcilerService,
    CallCenterAmiService, // exported so AmiService can resolve it via ModuleRef
    CallCenterService,
    CallCenterPermissionsService,
    CallCenterSettingsService,
    CallCenterReportsService,
    CallCenterMediaBridgeService,
  ],
})
export class CallCenterModule {}
