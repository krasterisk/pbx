import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { AiAgentsModule } from '../ai-agents/ai-agents.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ReportsCdrModule } from '../reports/cdr/reports-cdr.module';
import { SttEnginesModule } from '../stt-engines/stt-engines.module';
import { SystemSettingsModule } from '../system-settings/system-settings.module';
import { VoiceRobotsModule } from '../voice-robots/voice-robots.module';
import { LlmSummaryService } from './llm-summary.service';
import { VoicemailAccessToken } from './voicemail-access-token.model';
import { VoicemailController } from './voicemail.controller';
import { VoicemailDialplanController } from './voicemail-dialplan.controller';
import { VoicemailLinkController } from './voicemail-link.controller';
import { VoicemailLinkGuard } from './voicemail-link.guard';
import { VoicemailMessage } from './voicemail-message.model';
import { VoicemailScannerService } from './voicemail-scanner.service';
import { VoicemailService } from './voicemail.service';

@Module({
  imports: [
    SequelizeModule.forFeature([VoicemailMessage, VoicemailAccessToken]),
    SystemSettingsModule,
    NotificationsModule,
    ReportsCdrModule,
    SttEnginesModule,
    VoiceRobotsModule,
    AiAgentsModule,
  ],
  controllers: [VoicemailDialplanController, VoicemailController, VoicemailLinkController],
  providers: [VoicemailService, VoicemailLinkGuard, VoicemailScannerService, LlmSummaryService],
  exports: [VoicemailService, VoicemailScannerService],
})
export class VoicemailModule {}
