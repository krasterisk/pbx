import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { ISttProvider, SttResult } from '../interfaces/stt-provider.interface';

/**
 * Custom HTTP STT Provider (REST API fallback).
 *
 * Sends PCM16 audio via HTTP POST to a user-configured STT endpoint.
 * Compatible with:
 * - Faster-Whisper Server (OpenAI API format)
 * - Vosk Server
 * - Any REST API that accepts raw audio and returns JSON with text field
 *
 * This is a batch-mode provider: collects full utterance via VAD → sends to STT.
 */
@Injectable()
export class CustomHttpSttProvider implements ISttProvider {
  readonly name = 'custom-http-stt';
  private readonly logger = new Logger(CustomHttpSttProvider.name);

  /**
   * Transcribe audio buffer via HTTP POST to the configured endpoint.
   *
   * @param audioBuffer PCM16 8kHz mono audio
   * @param language Language hint
   * @param url Custom STT endpoint URL
   * @param token Auth token (optional)
   * @param authMode Authentication mode
   * @param customHeaders Additional headers
   * @param settings Provider-specific settings
   */
  async transcribeWithEngine(
    audioBuffer: Buffer,
    language: string,
    url: string,
    token?: string,
    authMode?: string,
    customHeaders?: Record<string, string>,
    settings?: Record<string, any>,
  ): Promise<SttResult> {
    if (!url) {
      this.logger.warn('No custom STT URL configured. Returning empty result.');
      return { text: '', duration: audioBuffer.length / (8000 * 2) };
    }

    const headers: Record<string, string> = {
      'Content-Type': 'audio/pcm',
      'X-Sample-Rate': '8000',
      'X-Audio-Channels': '1',
      'X-Language': language || 'ru-RU',
      ...customHeaders,
    };

    // Authentication
    if (token) {
      switch (authMode) {
        case 'bearer':
          headers['Authorization'] = `Bearer ${token}`;
          break;
        case 'custom':
          // Custom headers already merged above
          break;
        default:
          // 'none' — no auth
          break;
      }
    }

    try {
      const startTime = Date.now();
      const response = await axios.post(url, audioBuffer, {
        headers,
        timeout: settings?.timeout_ms || 10000,
        responseType: 'json',
      });

      const elapsed = Date.now() - startTime;

      // Extract text — support multiple response formats
      let text = '';
      const data = response.data;

      if (typeof data === 'string') {
        text = data;
      } else if (data?.text) {
        // Standard format: { text: "..." }
        text = data.text;
      } else if (data?.result) {
        // Vosk format: { result: [...], text: "..." }
        text = data.text || '';
      } else if (data?.results?.[0]?.alternatives?.[0]?.transcript) {
        // Google Cloud format
        text = data.results[0].alternatives[0].transcript;
      } else if (data?.choices?.[0]?.message?.content) {
        // OpenAI Whisper API format
        text = data.choices[0].message.content;
      }

      this.logger.debug(`[Custom STT] "${text}" (${elapsed}ms)`);

      return {
        text: text.trim(),
        duration: audioBuffer.length / (8000 * 2),
        language,
        rawJson: data,
      };
    } catch (e: any) {
      this.logger.error(`Custom STT request failed: ${e.message}`);
      return {
        text: '',
        duration: audioBuffer.length / (8000 * 2),
        language,
      };
    }
  }

  /**
   * ISttProvider.transcribe — simplified interface (without engine config).
   * For use in contexts where engine config is not available.
   */
  async transcribe(audioBuffer: Buffer, language?: string): Promise<SttResult> {
    this.logger.warn('CustomHttpSttProvider.transcribe() called without engine config. Use transcribeWithEngine() instead.');
    return { text: '', duration: audioBuffer.length / (8000 * 2), language: language || 'ru-RU' };
  }
}
