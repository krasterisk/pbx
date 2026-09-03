import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { VoicemailMessage } from './voicemail-message.model';
import { VoicemailService } from './voicemail.service';
import { VoicemailDialplanController } from './voicemail-dialplan.controller';
import { VoicemailController } from './voicemail.controller';

@Module({
  imports: [SequelizeModule.forFeature([VoicemailMessage])],
  controllers: [VoicemailDialplanController, VoicemailController],
  providers: [VoicemailService],
  exports: [VoicemailService],
})
export class VoicemailModule {}
