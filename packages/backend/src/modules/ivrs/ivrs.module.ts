import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { ConfigModule } from '@nestjs/config';
import { Ivr } from './ivr.model';
import { TtsEngine } from '../tts-engines/tts-engine.model';
import { TtsEnginesModule } from '../tts-engines/tts-engines.module';
import { AmiModule } from '../ami/ami.module';
import { RouteReferencesModule } from '../route-references/route-references.module';
import { ContextsModule } from '../contexts/contexts.module';
import { EndpointsModule } from '../endpoints/endpoints.module';
import { QueuesModule } from '../queues/queues.module';
import { AiPlatformModule } from '../ai-platform/ai-platform.module';
import { IvrsController } from './ivrs.controller';
import { IvrsInternalController } from './ivrs-internal.controller';
import { IvrsService } from './ivrs.service';
import { IvrsAiAdapter } from './ivrs-ai.adapter';
import { IvrTtsService } from './ivr-tts.service';
import { IvrTtsGoogleProvider } from './ivr-tts-google.provider';
import { IvrTtsCustomProvider } from './ivr-tts-custom.provider';
import { IvrTtsCacheService } from './ivr-tts-cache.service';
import { YandexStreamingTtsProvider } from '../voice-robots/providers/yandex-streaming-tts.provider';

@Module({
  imports: [
    ConfigModule,
    SequelizeModule.forFeature([Ivr, TtsEngine]),
    TtsEnginesModule,
    AmiModule,
    RouteReferencesModule,
    ContextsModule,
    EndpointsModule,
    QueuesModule,
    AiPlatformModule,
  ],
  controllers: [IvrsController, IvrsInternalController],
  providers: [
    IvrsService,
    IvrsAiAdapter,
    IvrTtsService,
    IvrTtsGoogleProvider,
    IvrTtsCustomProvider,
    IvrTtsCacheService,
    YandexStreamingTtsProvider,
  ],
  exports: [IvrsService, IvrTtsService, IvrTtsCacheService],
})
export class IvrsModule {}
