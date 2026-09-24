import { Module } from '@nestjs/common';
import { AiConnectivityModule } from '../ai-connectivity/ai-connectivity.module';
import { AiPlatformModule } from '../ai-platform/ai-platform.module';
import { SttEnginesAiAdapter } from './stt-engines-ai.adapter';

/** Chat catalog for capability `stt`. Rows live in cc_ai_providers. */
@Module({
  imports: [AiConnectivityModule, AiPlatformModule],
  providers: [SttEnginesAiAdapter],
})
export class SttEnginesModule {}
