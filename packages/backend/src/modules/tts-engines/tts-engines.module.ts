import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { ConfigModule } from '@nestjs/config';
import { TtsEngine } from './tts-engine.model';
import { TtsEnginesService } from './tts-engines.service';
import { TtsEnginesController } from './tts-engines.controller';
import { TtsEnginesPublicController } from './tts-engines-public.controller';
import { AiPlatformModule } from '../ai-platform/ai-platform.module';
import { TtsEnginesAiAdapter } from './tts-engines-ai.adapter';

@Module({
  imports: [SequelizeModule.forFeature([TtsEngine]), ConfigModule, AiPlatformModule],
  controllers: [TtsEnginesController, TtsEnginesPublicController],
  providers: [TtsEnginesService, TtsEnginesAiAdapter],
  exports: [TtsEnginesService],
})
export class TtsEnginesModule {}
