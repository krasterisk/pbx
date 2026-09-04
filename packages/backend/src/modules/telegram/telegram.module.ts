import { Module } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { TelegramAiAdapter } from './telegram-ai.adapter';
import { AiPlatformModule } from '../ai-platform/ai-platform.module';

@Module({
  imports: [AiPlatformModule],
  providers: [TelegramService, TelegramAiAdapter],
  exports: [TelegramService],
})
export class TelegramModule {}
