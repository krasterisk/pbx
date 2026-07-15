import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { AmiModule } from '../ami/ami.module';
import { CallCenterStateService } from './callcenter-state.service';
import { CallCenterAmiService } from './callcenter-ami.service';
import { CallCenterService } from './callcenter.service';
import { CallCenterHistoryWriterService } from './callcenter-history-writer.service';
import { CallCenterMetricsService } from './callcenter-metrics.service';
import { CallCenterRollupService } from './callcenter-rollup.service';
import { CallCenterQueueLogReconcilerService } from './callcenter-queuelog-reconciler.service';
import { CallCenterController } from './callcenter.controller';
import { CallCenterSseController } from './callcenter-sse.controller';
import { CallCenterSettingsController } from './callcenter-settings.controller';
import { CallCenterSettingsService } from './callcenter-settings.service';
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
import { CcCardTemplate } from './models/card-template.model';
import { CcCardField } from './models/card-field.model';
import { CcCardData } from './models/card-data.model';
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
      CcCardTemplate,
      CcCardField,
      CcCardData,
      Queue,           // for tenant resolution from queue names
      User,            // for agent display names
      PhonebookEntry,  // Client Card sidebar lookup
      RoutePhonebook,  // Client Card sidebar lookup
      ServiceRequest,  // Client Card sidebar — linked service requests
    ]),
    AmiModule,
  ],
  providers: [
    CallCenterStateService,
    CallCenterHistoryWriterService,
    CallCenterMetricsService,
    CallCenterRollupService,
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
    CallCenterService,
    CallCenterSettingsService,
  ],
  controllers: [
    CallCenterController,
    CallCenterSseController,
    CallCenterSettingsController,
  ],
  exports: [
    CallCenterStateService,
    CallCenterMetricsService,
    CallCenterRollupService,
    CallCenterQueueLogReconcilerService,
    CallCenterAmiService, // exported so AmiService can resolve it via ModuleRef
    CallCenterService,
    CallCenterSettingsService,
  ],
})
export class CallCenterModule {}
