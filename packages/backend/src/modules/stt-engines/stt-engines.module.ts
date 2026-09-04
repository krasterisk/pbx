import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { ConfigModule } from '@nestjs/config';
import { SttEngine } from './stt-engine.model';
import { SttEnginesService } from './stt-engines.service';
import { SttEnginesController } from './stt-engines.controller';
import { SttEnginesPublicController } from './stt-engines-public.controller';
import { AiPlatformModule } from '../ai-platform/ai-platform.module';
import { SttEnginesAiAdapter } from './stt-engines-ai.adapter';

@Module({
  imports: [SequelizeModule.forFeature([SttEngine]), ConfigModule, AiPlatformModule],
  controllers: [SttEnginesController, SttEnginesPublicController],
  providers: [SttEnginesService, SttEnginesAiAdapter],
  exports: [SttEnginesService],
})
export class SttEnginesModule {}
