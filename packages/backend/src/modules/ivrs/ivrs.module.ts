import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { ConfigModule } from '@nestjs/config';
import { Ivr } from './ivr.model';
import { TtsEngine } from '../tts-engines/tts-engine.model';
import { TtsEnginesModule } from '../tts-engines/tts-engines.module';
import { AmiModule } from '../ami/ami.module';
import { IvrsController } from './ivrs.controller';
import { IvrsInternalController } from './ivrs-internal.controller';
import { IvrsService } from './ivrs.service';
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
  ],
  controllers: [IvrsController, IvrsInternalController],
  providers: [
    IvrsService,
    IvrTtsService,
    IvrTtsGoogleProvider,
    IvrTtsCustomProvider,
    IvrTtsCacheService,
    YandexStreamingTtsProvider,
  ],
  exports: [IvrsService, IvrTtsService],
})
export class IvrsModule {}
