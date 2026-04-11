import { Module } from '@nestjs/common';
import { LoggerService } from './logger.service';
import { TelegramModule } from '../telegram/telegram.module';

@Module({
  imports: [TelegramModule],
  providers: [LoggerService],
  exports: [LoggerService],
})
export class LoggerModule {}
