import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { TtsEngine } from './tts-engine.model';
import { TtsEnginesService } from './tts-engines.service';
import { TtsEnginesController } from './tts-engines.controller';

@Module({
  imports: [SequelizeModule.forFeature([TtsEngine])],
  controllers: [TtsEnginesController],
  providers: [TtsEnginesService],
  exports: [TtsEnginesService],
})
export class TtsEnginesModule {}
