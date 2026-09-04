import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { NumberList } from './number-list.model';
import { NumbersService } from './numbers.service';
import { NumbersController } from './numbers.controller';
import { NumbersAiAdapter } from './numbers-ai.adapter';
import { LoggerModule } from '../logger/logger.module';
import { AiPlatformModule } from '../ai-platform/ai-platform.module';
import { RoutesModule } from '../routes/routes.module';

@Module({
  imports: [SequelizeModule.forFeature([NumberList]), LoggerModule, AiPlatformModule, RoutesModule],
  providers: [NumbersService, NumbersAiAdapter],
  controllers: [NumbersController],
  exports: [NumbersService],
})
export class NumbersModule {}
