import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { ConfigModule } from '@nestjs/config';
import { VoiceRobot } from './voice-robot.model';
import { VoiceRobotKeywordGroup } from './keyword-group.model';
import { VoiceRobotKeyword } from './keyword.model';
import { VoiceRobotLog } from './voice-robot-log.model';
import { VoiceRobotsController } from './voice-robots.controller';
import { VoiceRobotsService } from './voice-robots.service';
import { SileroVadProvider } from './services/silero-vad.provider';
import { StreamingSttService } from './services/streaming-stt.service';
import { KeywordMatcherService } from './services/keyword-matcher.service';
import { RtpUdpServerService } from './services/rtp-udp-server.service';
import { StreamAudioService } from './services/stream-audio.service';
import { AudioService } from './services/audio.service';
import { AriModule } from '../ari/ari.module';

@Module({
  imports: [
    ConfigModule,
    SequelizeModule.forFeature([
      VoiceRobot,
      VoiceRobotKeywordGroup,
      VoiceRobotKeyword,
      VoiceRobotLog,
    ]),
    AriModule,
  ],
  controllers: [VoiceRobotsController],
  providers: [
    VoiceRobotsService,
    SileroVadProvider,
    StreamingSttService,
    KeywordMatcherService,
    RtpUdpServerService,
    StreamAudioService,
    AudioService,
  ],
  exports: [VoiceRobotsService],
})
export class VoiceRobotsModule {}
