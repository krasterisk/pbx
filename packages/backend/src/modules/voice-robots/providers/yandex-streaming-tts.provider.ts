import { Injectable, Logger } from '@nestjs/common';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import * as path from 'path';
import * as fs from 'fs';
import { ITtsStreamingProvider } from '../interfaces/tts-provider.interface';

/**
 * Yandex SpeechKit Streaming TTS Provider (gRPC API v3).
 *
 * Uses server-side gRPC stream: Synthesizer.UtteranceSynthesis
 * - Sends text as a unary request
 * - Receives PCM16 audio chunks as a server stream
 *
 * Output: LINEAR16_PCM, 8000 Hz (telephony-optimized)
 * First-byte latency: ~100-200ms (streaming delivery)
 *
 * Proto source: github.com/yandex-cloud/cloudapi
 * Endpoint: tts.api.cloud.yandex.net:443
 *
 * @see https://yandex.cloud/docs/speechkit/tts/api/tts-v3
 */
@Injectable()
export class YandexStreamingTtsProvider implements ITtsStreamingProvider {
  readonly name = 'yandex-tts-streaming';
  private readonly logger = new Logger(YandexStreamingTtsProvider.name);

  private synthesizerClient: any = null;
  private protoLoaded = false;

  private static readonly ENDPOINT = 'tts.api.cloud.yandex.net:443';

  /**
   * Lazy-initialize the gRPC client.
   */
  private ensureClient(): void {
    if (this.protoLoaded) return;

    const protoDir = path.join(__dirname, '..', 'proto', 'cloudapi');
    const ttsServiceProto = path.join(protoDir, 'yandex', 'cloud', 'ai', 'tts', 'v3', 'tts_service.proto');

    if (!fs.existsSync(ttsServiceProto)) {
      throw new Error(
        `Yandex Cloud proto files not found at ${protoDir}. ` +
        `Run: git clone --depth=1 https://github.com/yandex-cloud/cloudapi.git ${protoDir}`,
      );
    }

    const packageDefinition = protoLoader.loadSync(ttsServiceProto, {
      includeDirs: [protoDir],
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });

    const proto = grpc.loadPackageDefinition(packageDefinition) as any;
    this.synthesizerClient = new proto.speechkit.tts.v3.Synthesizer(
      YandexStreamingTtsProvider.ENDPOINT,
      grpc.credentials.createSsl(),
    );

    this.protoLoaded = true;
    this.logger.log('Yandex TTS gRPC client initialized');
  }

  /**
   * Synthesize text and stream PCM16 8kHz chunks via callback.
   *
   * Each chunk is delivered as soon as the server produces it (~100-200ms first-byte).
   * The caller should convert PCM16 → A-law and feed to StreamAudioService for RTP delivery.
   *
   * @param text Text to synthesize
   * @param token IAM token or API key
   * @param settings { folder_id, voice, role, speed, pitch_shift }
   * @param onChunk Called for each PCM16 audio chunk
   * @param signal AbortSignal for barge-in interrupt
   */
  async synthesizeStream(
    text: string,
    token: string,
    settings: Record<string, any>,
    onChunk: (pcm16: Buffer) => void,
    signal?: AbortSignal,
  ): Promise<void> {
    this.ensureClient();

    const metadata = new grpc.Metadata();
    metadata.add('authorization', `Bearer ${token}`);
    if (settings.folder_id) {
      metadata.add('x-folder-id', settings.folder_id);
    }

    // Build hints array from settings
    const hints: any[] = [];
    if (settings.voice) {
      hints.push({ voice: settings.voice });
    }
    if (settings.speed && settings.speed !== 1.0) {
      hints.push({ speed: settings.speed });
    }
    if (settings.role) {
      hints.push({ role: settings.role });
    }
    if (settings.pitch_shift) {
      hints.push({ pitch_shift: settings.pitch_shift });
    }

    const request = {
      text: text,
      output_audio_spec: {
        raw_audio: {
          audio_encoding: 1, // LINEAR16_PCM
          sample_rate_hertz: 8000,
        },
      },
      hints: hints,
      loudness_normalization_type: 1, // MAX_PEAK
      unsafe_mode: false,
    };

    this.logger.log(`TTS synthesis: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}" (voice: ${settings.voice || 'default'})`);

    return new Promise<void>((resolve, reject) => {
      const stream = this.synthesizerClient.UtteranceSynthesis(request, metadata);

      let totalBytes = 0;
      let aborted = false;

      // Handle barge-in abort
      if (signal) {
        const onAbort = () => {
          if (!aborted) {
            aborted = true;
            stream.cancel();
            this.logger.debug('TTS stream cancelled (barge-in)');
            resolve();
          }
        };
        signal.addEventListener('abort', onAbort, { once: true });
      }

      stream.on('data', (response: any) => {
        if (aborted) return;

        if (response.audio_chunk?.data) {
          const pcm16 = Buffer.from(response.audio_chunk.data);
          totalBytes += pcm16.length;
          onChunk(pcm16);
        }
      });

      stream.on('end', () => {
        if (!aborted) {
          this.logger.debug(`TTS synthesis complete: ${totalBytes} bytes PCM16`);
          resolve();
        }
      });

      stream.on('error', (err: any) => {
        if (aborted || err.code === 1) {
          // CANCELLED — expected on barge-in
          resolve();
          return;
        }
        this.logger.error(`TTS stream error: ${err.message} (code: ${err.code})`);
        reject(err);
      });
    });
  }
}
