import { Module } from '@nestjs/common';
import { AriModule } from '../ari/ari.module';
import { AiVoiceModule } from './ai-voice.module';
import { AiVoiceAriListener } from './ai-voice-ari.listener';

/** PBX-only listener. Standalone robot API must not open an ARI socket. */
@Module({
  imports: [AriModule, AiVoiceModule],
  providers: [AiVoiceAriListener],
})
export class AiVoiceRuntimeModule {}
