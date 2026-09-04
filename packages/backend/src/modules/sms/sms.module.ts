import { Module } from '@nestjs/common';
import { SmsService } from './sms.service';
import { SmsAiAdapter } from './sms-ai.adapter';
import { AiPlatformModule } from '../ai-platform/ai-platform.module';

@Module({
  imports: [AiPlatformModule],
  providers: [SmsService, SmsAiAdapter],
  exports: [SmsService],
})
export class SmsModule {}
