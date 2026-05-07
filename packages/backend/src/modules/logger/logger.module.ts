import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { LoggerService } from './logger.service';
import { LoggerController } from './logger.controller';
import { ActionLog } from './action-log.model';
import { TelegramModule } from '../telegram/telegram.module';

@Module({
  imports: [
    SequelizeModule.forFeature([ActionLog]),
    TelegramModule,
  ],
  providers: [LoggerService],
  controllers: [LoggerController],
  exports: [LoggerService],
})
export class LoggerModule {}
