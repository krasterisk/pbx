import { Controller, Get, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SequelizeModule } from '@nestjs/sequelize';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { resolveDatabaseConfig } from '../database/database-config.cjs';
import { VoiceRobot } from '../modules/voice-robots/voice-robot.model';
import { VoiceRobotKeywordGroup } from '../modules/voice-robots/keyword-group.model';
import { VoiceRobotKeyword } from '../modules/voice-robots/keyword.model';
import { VoiceRobotLog } from '../modules/voice-robots/voice-robot-log.model';
import { VoiceRobotCdr } from '../modules/voice-robots/voice-robot-cdr.model';
import { VoiceRobotDataList } from '../modules/voice-robots/data-list.model';
import { SttEngine } from '../modules/stt-engines/stt-engine.model';
import { TtsEngine } from '../modules/tts-engines/tts-engine.model';
import { VoiceRobotsService } from '../modules/voice-robots/voice-robots.service';
import { AiProvidersService } from '../modules/ai-connectivity/ai-providers.service';
import { RouteReferencesService } from '../modules/route-references/route-references.service';
import { AriModule } from '../modules/ari/ari.module';
import { AriConnectionService } from '../modules/ari/ari-connection.service';
import { SileroVadProvider } from '../modules/voice-robots/services/silero-vad.provider';
import { StreamingSttService } from '../modules/voice-robots/services/streaming-stt.service';
import { KeywordMatcherService } from '../modules/voice-robots/services/keyword-matcher.service';
import { RtpUdpServerService } from '../modules/voice-robots/services/rtp-udp-server.service';
import { StreamAudioService } from '../modules/voice-robots/services/stream-audio.service';
import { AudioService } from '../modules/voice-robots/services/audio.service';
import { SemanticRouterService } from '../modules/voice-robots/services/semantic-router.service';
import { SlotExtractorService } from '../modules/voice-robots/services/slot-extractor.service';
import { DataListSearchService } from '../modules/voice-robots/services/data-list-search.service';
import { TtsCacheService } from '../modules/voice-robots/services/tts-cache.service';
import { YandexStreamingSttProvider } from '../modules/voice-robots/providers/yandex-streaming-stt.provider';
import { YandexStreamingTtsProvider } from '../modules/voice-robots/providers/yandex-streaming-tts.provider';
import { CustomHttpSttProvider } from '../modules/voice-robots/providers/custom-http-stt.provider';
import { SttProviderFactory, TtsProviderFactory } from '../modules/voice-robots/providers/provider-factory';
import { StandaloneRobotGuard } from './access';
import { StandaloneEnginesController, StandaloneSpeechEngines } from './engines';
import { StandaloneRobotsController } from './robots.controller';
import { StandaloneRouteReferences } from './route-references';
import { StandaloneCatalogsController } from './catalogs';
import { AiAdapterRegistryService } from '../modules/ai-platform/ai-adapter-registry.service';
import { VoiceRobotsAiAdapter } from '../modules/voice-robots/voice-robots-ai.adapter';
import { VoiceRobotConfigurationService } from '../modules/voice-robots/voice-robot-configuration.service';
import { VoiceRobotToolsService } from '../modules/voice-robots/voice-robot-tools.service';
import { RobotMcpCredentials, RobotMcpGuard, RobotMcpCredentialsController } from './mcp-credentials';
import { StandaloneRobotMcpController, StandaloneRobotMcpService } from './mcp';
import { withAppIdentity } from '../modules/health/app-identity';

export const STANDALONE_ROBOT_MODELS = [VoiceRobot, VoiceRobotKeywordGroup, VoiceRobotKeyword,
  VoiceRobotLog, VoiceRobotCdr, VoiceRobotDataList, SttEngine, TtsEngine];

@Controller('health')
class StandaloneHealthController {
  constructor(private readonly ari: AriConnectionService, private readonly vad: SileroVadProvider) {}
  @Get() health() {
    return withAppIdentity({ profile: 'v3-voice-robots', ari: this.ari.isConnected(), vad: this.vad.isAvailable });
  }
}

/** Explicit composition: no AppModule, AMI, cron jobs, schema sync or PBX provisioning. */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
    SequelizeModule.forRootAsync({ useFactory: () => ({ ...resolveDatabaseConfig(process.env),
      models: STANDALONE_ROBOT_MODELS, autoLoadModels: false, synchronize: false, logging: false,
      define: { timestamps: false, freezeTableName: true } }) }),
    SequelizeModule.forFeature(STANDALONE_ROBOT_MODELS),
    EventEmitterModule.forRoot({ wildcard: true }), AriModule,
  ],
  controllers: [StandaloneRobotsController, StandaloneCatalogsController, StandaloneEnginesController, StandaloneHealthController,
    RobotMcpCredentialsController, StandaloneRobotMcpController],
  providers: [StandaloneRobotGuard, StandaloneSpeechEngines, StandaloneRouteReferences,
    { provide: AiProvidersService, useExisting: StandaloneSpeechEngines },
    { provide: RouteReferencesService, useExisting: StandaloneRouteReferences },
    VoiceRobotsService, SileroVadProvider, RtpUdpServerService, StreamAudioService, AudioService,
    StreamingSttService, KeywordMatcherService, SemanticRouterService, SlotExtractorService,
    DataListSearchService, TtsCacheService, YandexStreamingSttProvider, CustomHttpSttProvider,
    SttProviderFactory, YandexStreamingTtsProvider, TtsProviderFactory,
    AiAdapterRegistryService, VoiceRobotsAiAdapter, VoiceRobotConfigurationService, VoiceRobotToolsService,
    RobotMcpCredentials, RobotMcpGuard, StandaloneRobotMcpService,
  ],
})
export class StandaloneVoiceRobotsModule {}
