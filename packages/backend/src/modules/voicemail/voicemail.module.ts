import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { SystemSettingsModule } from '../system-settings/system-settings.module';
import { VoicemailAccessToken } from './voicemail-access-token.model';
import { VoicemailController } from './voicemail.controller';
import { VoicemailDialplanController } from './voicemail-dialplan.controller';
import { VoicemailLinkController } from './voicemail-link.controller';
import { VoicemailLinkGuard } from './voicemail-link.guard';
import { VoicemailMessage } from './voicemail-message.model';
import { VoicemailService } from './voicemail.service';

@Module({
  imports: [
    SequelizeModule.forFeature([VoicemailMessage, VoicemailAccessToken]),
    SystemSettingsModule,
  ],
  controllers: [VoicemailDialplanController, VoicemailController, VoicemailLinkController],
  providers: [VoicemailService, VoicemailLinkGuard],
  exports: [VoicemailService],
})
export class VoicemailModule {}
