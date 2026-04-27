import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { ConfigModule } from '@nestjs/config';
import { SttEngine } from './stt-engine.model';
import { SttEnginesService } from './stt-engines.service';
import { SttEnginesController } from './stt-engines.controller';
import { SttEnginesPublicController } from './stt-engines-public.controller';

@Module({
  imports: [SequelizeModule.forFeature([SttEngine]), ConfigModule],
  controllers: [SttEnginesController, SttEnginesPublicController],
  providers: [SttEnginesService],
  exports: [SttEnginesService],
})
export class SttEnginesModule {}
