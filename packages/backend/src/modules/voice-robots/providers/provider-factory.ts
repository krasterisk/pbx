import { Injectable, Logger } from '@nestjs/common';
import { SttEngine } from '../../stt-engines/stt-engine.model';
import { TtsEngine } from '../../tts-engines/tts-engine.model';
import { YandexStreamingSttProvider } from './yandex-streaming-stt.provider';
import { YandexStreamingTtsProvider } from './yandex-streaming-tts.provider';
import { CustomHttpSttProvider } from './custom-http-stt.provider';
import { ISttStreamingProvider, ISttProvider, SttStream, SttResult } from '../interfaces/stt-provider.interface';
import { ITtsStreamingProvider } from '../interfaces/tts-provider.interface';

/**
 * STT Provider Factory.
 *
 * Routes STT requests to the appropriate provider based on engine type:
 * - 'yandex' → YandexStreamingSttProvider (gRPC bidirectional stream)
 * - 'custom' → CustomHttpSttProvider (HTTP REST batch mode)
 * - 'google' → Reserved for future Google Cloud STT integration
 *
 * Supports both streaming and batch modes:
 * - Streaming: createStream() for real-time gRPC bidirectional recognition
 * - Batch: transcribe() for REST-based providers
 */
@Injectable()
export class SttProviderFactory {
  private readonly logger = new Logger(SttProviderFactory.name);

  constructor(
    private readonly yandexStt: YandexStreamingSttProvider,
    private readonly customStt: CustomHttpSttProvider,
  ) {}

  /**
   * Check if the engine supports streaming mode.
   */
  isStreamingSupported(engine: SttEngine): boolean {
    return engine.type === 'yandex'; // Google will be added later
  }

  /**
   * Create a streaming STT session (for gRPC-capable engines).
   * Throws if the engine doesn't support streaming.
   */
  createStream(engine: SttEngine, language: string): SttStream {
    switch (engine.type) {
      case 'yandex':
        return this.yandexStt.createStream(
          engine.token,
          engine.settings || {},
          language,
        );

      default:
        throw new Error(`Streaming STT not supported for engine type: ${engine.type}`);
    }
  }

  /**
   * Batch transcribe (for REST-based engines or engines without streaming).
   */
  async transcribe(engine: SttEngine, audioBuffer: Buffer, language: string): Promise<SttResult> {
    switch (engine.type) {
      case 'custom':
        return this.customStt.transcribeWithEngine(
          audioBuffer,
          language,
          engine.custom_url || '',
          engine.token,
          engine.auth_mode,
          engine.custom_headers,
          engine.settings,
        );

      case 'yandex':
        // Yandex also supports batch via file recognition,
        // but for simplicity, we fall back to streaming with accumulation
        this.logger.warn('Yandex STT used in batch mode — consider switching to streaming for lower latency');
        return this.transcribeViaTempStream(engine, audioBuffer, language);

      default:
        this.logger.error(`Unknown STT engine type: ${engine.type}`);
        return { text: '', language };
    }
  }

  /**
   * Fallback: transcribe via a temporary streaming session.
   * Opens a stream, writes all audio, waits for final text, closes.
   */
  private transcribeViaTempStream(engine: SttEngine, audioBuffer: Buffer, language: string): Promise<SttResult> {
    return new Promise((resolve) => {
      const stream = this.createStream(engine, language);
      let finalText = '';
      const timeout = setTimeout(() => {
        stream.end();
        resolve({ text: finalText, language });
      }, 10000); // 10s safety timeout

      stream.events.on('final', (text: string) => {
        finalText = text;
      });

      stream.events.on('eou', () => {
        clearTimeout(timeout);
        stream.end();
        resolve({ text: finalText, language });
      });

      stream.events.on('error', () => {
        clearTimeout(timeout);
        resolve({ text: finalText, language });
      });

      stream.events.on('end', () => {
        clearTimeout(timeout);
        resolve({ text: finalText, language });
      });

      // Write all audio at once
      stream.write(audioBuffer);

      // Signal end of audio after a small delay
      setTimeout(() => stream.end(), 500);
    });
  }
}

/**
 * TTS Provider Factory.
 *
 * Routes TTS requests to the appropriate provider based on engine type:
 * - 'yandex' → YandexStreamingTtsProvider (gRPC server stream)
 * - 'custom' → Reserved for custom REST-based TTS
 * - 'google' → Reserved for future Google Cloud TTS integration
 */
@Injectable()
export class TtsProviderFactory {
  private readonly logger = new Logger(TtsProviderFactory.name);

  constructor(
    private readonly yandexTts: YandexStreamingTtsProvider,
  ) {}

  /**
   * Get the streaming TTS provider for an engine.
   */
  getStreamingProvider(engine: TtsEngine): ITtsStreamingProvider | null {
    switch (engine.type) {
      case 'yandex':
        return this.yandexTts;

      default:
        this.logger.warn(`No streaming TTS provider for engine type: ${engine.type}`);
        return null;
    }
  }

  /**
   * Synthesize text using the appropriate engine.
   * Streams PCM16 chunks to the callback as they arrive.
   */
  async synthesize(
    engine: TtsEngine,
    text: string,
    onChunk: (pcm16: Buffer) => void,
    signal?: AbortSignal,
  ): Promise<void> {
    switch (engine.type) {
      case 'yandex':
        return this.yandexTts.synthesizeStream(
          text,
          engine.token,
          engine.settings || {},
          onChunk,
          signal,
        );

      default:
        this.logger.error(`No TTS provider for engine type: ${engine.type}`);
        throw new Error(`Unsupported TTS engine type: ${engine.type}`);
    }
  }

  /**
   * Batch synthesize: accumulates all streaming chunks into a single PCM16 buffer.
   * Used by batch/cache mode (TtsCacheService) where the full audio is needed at once.
   *
   * @param engine TTS engine configuration
   * @param text Text to synthesize
   * @returns Complete PCM16 audio buffer (LINEAR16, engine's native sample rate)
   */
  async synthesizeBatch(engine: TtsEngine, text: string): Promise<Buffer> {
    const chunks: Buffer[] = [];
    await this.synthesize(engine, text, (pcm16) => chunks.push(pcm16));
    return Buffer.concat(chunks);
  }
}
