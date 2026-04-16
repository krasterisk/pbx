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
import { SemanticRouterService } from './services/semantic-router.service';
import { SlotExtractorService } from './services/slot-extractor.service';
import { TtsCacheService } from './services/tts-cache.service';
import { AriModule } from '../ari/ari.module';
// STT/TTS Providers (Phase 1)
import { YandexStreamingSttProvider } from './providers/yandex-streaming-stt.provider';
import { YandexStreamingTtsProvider } from './providers/yandex-streaming-tts.provider';
import { CustomHttpSttProvider } from './providers/custom-http-stt.provider';
import { SttProviderFactory, TtsProviderFactory } from './providers/provider-factory';
// STT/TTS Engine models (for provider factory to resolve engine config)
import { SttEngine } from '../stt-engines/stt-engine.model';
import { TtsEngine } from '../tts-engines/tts-engine.model';

@Module({
  imports: [
    ConfigModule,
    SequelizeModule.forFeature([
      VoiceRobot,
      VoiceRobotKeywordGroup,
      VoiceRobotKeyword,
      VoiceRobotLog,
      SttEngine,
      TtsEngine,
    ]),
    AriModule,
  ],
  controllers: [VoiceRobotsController],
  providers: [
    VoiceRobotsService,
    // Audio pipeline
    SileroVadProvider,
    RtpUdpServerService,
    StreamAudioService,
    AudioService,
    // Legacy STT (fallback stub — will be replaced by provider factory)
    StreamingSttService,
    // Keyword matching
    KeywordMatcherService,
    SemanticRouterService,
    SlotExtractorService,
    // STT Providers
    YandexStreamingSttProvider,
    CustomHttpSttProvider,
    SttProviderFactory,
    // TTS Providers
    YandexStreamingTtsProvider,
    TtsProviderFactory,
    TtsCacheService,
  ],
  exports: [VoiceRobotsService],
})
export class VoiceRobotsModule {}
