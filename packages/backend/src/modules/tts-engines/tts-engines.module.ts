import { Module } from '@nestjs/common';
import { AiConnectivityModule } from '../ai-connectivity/ai-connectivity.module';
import { AiPlatformModule } from '../ai-platform/ai-platform.module';
import { TtsEnginesAiAdapter } from './tts-engines-ai.adapter';

/** Chat catalog for capability `tts`. Rows live in cc_ai_providers. */
@Module({
  imports: [AiConnectivityModule, AiPlatformModule],
  providers: [TtsEnginesAiAdapter],
})
export class TtsEnginesModule {}
