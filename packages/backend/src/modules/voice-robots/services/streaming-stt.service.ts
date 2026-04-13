import { Injectable, Logger } from '@nestjs/common';
import { ISttProvider, SttResult } from '../interfaces/stt-provider.interface';

/**
 * STT (Speech-to-Text) service.
 *
 * Implements ISttProvider interface. Supports pluggable providers
 * via HTTP REST API (compatible with Yandex SpeechKit, Google Cloud STT,
 * OpenAI Whisper, and self-hosted Vosk/faster-whisper).
 *
 * Currently a functional stub with configurable backend URL.
 * To enable real STT, configure the stt_engines table with a valid API endpoint.
 */
@Injectable()
export class StreamingSttService implements ISttProvider {
  readonly name = 'generic-rest-stt';
  private readonly logger = new Logger(StreamingSttService.name);

  /**
   * Transcribe audio buffer to text.
   *
   * @param audioBuffer PCM16 8kHz mono audio
   * @param language Language hint (e.g. 'ru-RU')
   */
  async transcribe(audioBuffer: Buffer, language?: string): Promise<SttResult> {
    this.logger.debug(
      `[STT] Transcribe request: ${audioBuffer.length} bytes, language: ${language || 'auto'}`,
    );

    // TODO: When STT engine is configured, send audio via HTTP POST:
    //
    // const response = await axios.post(sttEngine.api_url, audioBuffer, {
    //   headers: {
    //     'Content-Type': 'audio/pcm',
    //     'Authorization': `Bearer ${sttEngine.api_key}`,
    //     'X-Sample-Rate': '8000',
    //     'X-Language': language || 'ru-RU',
    //   },
    // });
    // return { text: response.data.text, rawJson: response.data };

    // Stub: return empty result (no STT engine configured)
    this.logger.warn(
      '[STT] No STT engine configured. Returning empty result. ' +
      'Configure stt_engines table for real transcription.',
    );

    return {
      text: '',
      duration: audioBuffer.length / (8000 * 2), // PCM16 @ 8kHz
      language: language || 'ru-RU',
    };
  }
}
