import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { SttEngine } from './stt-engine.model';
import { SttEnginesService } from './stt-engines.service';
import { SttEnginesController } from './stt-engines.controller';

@Module({
  imports: [SequelizeModule.forFeature([SttEngine])],
  controllers: [SttEnginesController],
  providers: [SttEnginesService],
  exports: [SttEnginesService],
})
export class SttEnginesModule {}
