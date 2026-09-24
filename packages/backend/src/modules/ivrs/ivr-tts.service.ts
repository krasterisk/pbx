import { Injectable, Logger } from '@nestjs/common';
import type { IIvrPhraseTtsSettings } from '@krasterisk/shared';
import { AiProvidersService } from '../ai-connectivity/ai-providers.service';
import type { SpeechEngineConfig } from '../ai-connectivity/speech-engine';
import { YandexStreamingTtsProvider } from '../voice-robots/providers/yandex-streaming-tts.provider';
import { IvrTtsGoogleProvider } from './ivr-tts-google.provider';
import { IvrTtsCustomProvider } from './ivr-tts-custom.provider';
import { mergePhraseSettings } from './ivr-tts-settings.util';
import { pcm16ToWav } from './ivr-pcm-wav.util';

@Injectable()
export class IvrTtsService {
  private readonly logger = new Logger(IvrTtsService.name);

  constructor(
    private readonly providers: AiProvidersService,
    private readonly yandexTts: YandexStreamingTtsProvider,
    private readonly googleTts: IvrTtsGoogleProvider,
    private readonly customTts: IvrTtsCustomProvider,
  ) {}

  async loadEngine(engineUid: number, vpbxUserUid: number): Promise<SpeechEngineConfig> {
    return this.providers.loadSpeechEngine(vpbxUserUid, engineUid, 'tts');
  }

  async synthesizeToBuffer(
    engine: SpeechEngineConfig,
    text: string,
    phraseSettings?: IIvrPhraseTtsSettings,
  ): Promise<Buffer> {
    const merged = mergePhraseSettings(engine.type, engine.settings, phraseSettings);
    const trimmed = text?.trim();
    if (!trimmed) {
      throw new Error('TTS text is empty');
    }

    switch (engine.type) {
      case 'yandex':
        return this.synthesizeYandex(engine.token, trimmed, merged);
      case 'google':
        return this.googleTts.synthesize(engine.token, trimmed, merged);
      case 'custom':
        return this.customTts.synthesize(
          engine.custom_url || '',
          trimmed,
          engine.token,
          engine.auth_mode,
          engine.custom_headers,
          merged,
        );
      default:
        throw new Error(`Unsupported TTS engine type: ${engine.type}`);
    }
  }

  private async synthesizeYandex(
    token: string,
    text: string,
    settings: Record<string, any>,
  ): Promise<Buffer> {
    const chunks: Buffer[] = [];
    await this.yandexTts.synthesizeStream(
      text,
      token,
      settings,
      (chunk) => chunks.push(chunk),
    );
    const pcm = Buffer.concat(chunks);
    if (!pcm.length) {
      throw new Error('Yandex TTS returned no audio');
    }
    return pcm16ToWav(pcm, 8000, 1);
  }
}
