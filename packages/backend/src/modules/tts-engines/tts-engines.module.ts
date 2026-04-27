import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { ConfigModule } from '@nestjs/config';
import { TtsEngine } from './tts-engine.model';
import { TtsEnginesService } from './tts-engines.service';
import { TtsEnginesController } from './tts-engines.controller';
import { TtsEnginesPublicController } from './tts-engines-public.controller';

@Module({
  imports: [SequelizeModule.forFeature([TtsEngine]), ConfigModule],
  controllers: [TtsEnginesController, TtsEnginesPublicController],
  providers: [TtsEnginesService],
  exports: [TtsEnginesService],
})
export class TtsEnginesModule {}
