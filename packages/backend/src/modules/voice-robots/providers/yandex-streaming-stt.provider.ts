import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter } from 'events';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import * as path from 'path';
import * as fs from 'fs';
import { ISttStreamingProvider, SttStream } from '../interfaces/stt-provider.interface';

/**
 * Yandex SpeechKit Streaming STT Provider (gRPC API v3).
 *
 * Uses bidirectional gRPC stream: Recognizer.RecognizeStreaming
 * - Sends PCM16 8kHz mono audio chunks in real-time
 * - Receives partial → final → eou_update events
 *
 * Proto source: github.com/yandex-cloud/cloudapi
 * Endpoint: stt.api.cloud.yandex.net:443
 *
 * Audio format: LINEAR16_PCM, 8000 Hz, 1 channel (telephony standard)
 *
 * @see https://yandex.cloud/docs/speechkit/stt/api/streaming-examples-v3
 */
@Injectable()
export class YandexStreamingSttProvider implements ISttStreamingProvider {
  readonly name = 'yandex-stt-streaming';
  private readonly logger = new Logger(YandexStreamingSttProvider.name);

  private recognizerClient: any = null;
  private protoLoaded = false;

  private static readonly ENDPOINT = 'stt.api.cloud.yandex.net:443';

  /**
   * Lazy-initialize the gRPC client.
   * Proto files are loaded dynamically from the cloudapi directory.
   */
  private ensureClient(): void {
    if (this.protoLoaded) return;

    const protoDir = path.join(__dirname, '..', 'proto', 'cloudapi');
    const sttServiceProto = path.join(protoDir, 'yandex', 'cloud', 'ai', 'stt', 'v3', 'stt_service.proto');

    // Check if proto files exist
    if (!fs.existsSync(sttServiceProto)) {
      throw new Error(
        `Yandex Cloud proto files not found at ${protoDir}. ` +
        `Run: git clone --depth=1 https://github.com/yandex-cloud/cloudapi.git ${protoDir}`,
      );
    }

    const packageDefinition = protoLoader.loadSync(sttServiceProto, {
      includeDirs: [protoDir, path.join(protoDir, 'third_party', 'googleapis')],
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });

    const proto = grpc.loadPackageDefinition(packageDefinition) as any;
    this.recognizerClient = new proto.speechkit.stt.v3.Recognizer(
      YandexStreamingSttProvider.ENDPOINT,
      grpc.credentials.createSsl(),
    );

    this.protoLoaded = true;
    this.logger.log('Yandex STT gRPC client initialized');
  }

  /**
   * Create a new bidirectional streaming recognition session.
   *
   * @param token IAM token or API key
   * @param settings { folder_id, model, eou_sensitivity }
   * @param language Language code (e.g. 'ru-RU')
   */
  createStream(
    token: string,
    settings: Record<string, any>,
    language: string,
  ): SttStream {
    this.ensureClient();

    const metadata = new grpc.Metadata();
    metadata.add('authorization', `Bearer ${token}`);
    if (settings.folder_id) {
      metadata.add('x-folder-id', settings.folder_id);
    }

    const grpcStream = this.recognizerClient.RecognizeStreaming(metadata);
    const events = new EventEmitter();

    // Send SessionOptions as the first message
    const sessionOptions: any = {
      session_options: {
        recognition_model: {
          model: settings.model || 'general',
          audio_format: {
            raw_audio: {
              audio_encoding: 1, // LINEAR16_PCM
              sample_rate_hertz: 8000,
              audio_channel_count: 1,
            },
          },
          text_normalization: {
            text_normalization: 1, // TEXT_NORMALIZATION_ENABLED
          },
          audio_processing_type: 1, // REAL_TIME
          language_restriction: {
            restriction_type: 1, // WHITELIST
            language_code: [language || 'ru-RU'],
          },
        },
        eou_classifier: {
          default_classifier: {
            type: this.mapEouSensitivity(settings.eou_sensitivity),
          },
        },
      },
    };

    grpcStream.write(sessionOptions);
    this.logger.log(`STT stream opened (model: ${settings.model || 'general'}, lang: ${language})`);

    // Handle server responses
    grpcStream.on('data', (response: any) => {
      try {
        if (response.partial) {
          const text = response.partial.alternatives?.[0]?.text || '';
          if (text) {
            events.emit('partial', text);
          }
        }

        if (response.final) {
          const text = response.final.alternatives?.[0]?.text || '';
          if (text) {
            this.logger.debug(`[Yandex STT] Final: "${text}"`);
            events.emit('final', text);
          }
        }

        if (response.eou_update) {
          this.logger.debug(`[Yandex STT] EOU at ${response.eou_update.time_ms}ms`);
          events.emit('eou');
        }

        if (response.status_code) {
          const code = response.status_code.code_type;
          if (code === 'CLOSED' || code === 3) {
            this.logger.debug('[Yandex STT] Session closed by server');
            events.emit('end');
          }
        }
      } catch (e: any) {
        this.logger.error(`Error processing STT response: ${e.message}`);
      }
    });

    grpcStream.on('error', (err: any) => {
      // gRPC CANCELLED (code 1) is expected when we close the stream
      if (err.code !== 1) {
        this.logger.error(`STT stream error: ${err.message} (code: ${err.code})`);
        events.emit('error', err);
      }
    });

    grpcStream.on('end', () => {
      this.logger.debug('STT stream ended');
      events.emit('end');
    });

    return {
      write: (pcm16: Buffer) => {
        try {
          grpcStream.write({ chunk: { data: pcm16 } });
        } catch (e: any) {
          // Stream may be closed — ignore write errors
          this.logger.debug(`STT write error (stream may be closed): ${e.message}`);
        }
      },
      end: () => {
        try {
          grpcStream.end();
        } catch {
          // Already closed
        }
      },
      events,
    };
  }

  /**
   * Map EOU sensitivity string to proto enum value.
   */
  private mapEouSensitivity(sensitivity?: string): number {
    switch (sensitivity) {
      case 'HIGH': return 2;
      case 'DEFAULT':
      default: return 1;
    }
  }
}
