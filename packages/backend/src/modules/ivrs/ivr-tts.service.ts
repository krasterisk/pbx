import { Injectable, Logger } from '@nestjs/common';
import type { IIvrPhraseTtsSettings } from '@krasterisk/shared';
import { TtsEngine } from '../tts-engines/tts-engine.model';
import { TtsEnginesService } from '../tts-engines/tts-engines.service';
import { YandexStreamingTtsProvider } from '../voice-robots/providers/yandex-streaming-tts.provider';
import { IvrTtsGoogleProvider } from './ivr-tts-google.provider';
import { IvrTtsCustomProvider } from './ivr-tts-custom.provider';
import { mergePhraseSettings } from './ivr-tts-settings.util';
import { pcm16ToWav } from './ivr-pcm-wav.util';

@Injectable()
export class IvrTtsService {
  private readonly logger = new Logger(IvrTtsService.name);

  constructor(
    private readonly ttsEnginesService: TtsEnginesService,
    private readonly yandexTts: YandexStreamingTtsProvider,
    private readonly googleTts: IvrTtsGoogleProvider,
    private readonly customTts: IvrTtsCustomProvider,
  ) {}

  async loadEngine(engineUid: number, vpbxUserUid: number): Promise<TtsEngine> {
    return this.ttsEnginesService.findOne(engineUid, vpbxUserUid);
  }

  async synthesizeToBuffer(
    engine: TtsEngine,
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
