/**
 * STT (Speech-to-Text) provider interface.
 * Providers: Yandex SpeechKit, Google Cloud STT, Whisper, Vosk.
 */

export interface SttResult {
  /** Transcribed text */
  text: string;
  /** Audio duration in seconds (if available) */
  duration?: number;
  /** Detected language (if available) */
  language?: string;
  /** Raw provider response JSON (for logging) */
  rawJson?: any;
}

export interface ISttProvider {
  /** Provider name for logging */
  readonly name: string;

  /**
   * Transcribe a complete audio buffer (batch mode).
   * Used after VAD collects a full speech segment.
   * @param audioBuffer PCM16 8kHz mono audio
   * @param language Language hint (e.g. 'ru-RU', 'en-US')
   */
  transcribe(audioBuffer: Buffer, language?: string): Promise<SttResult>;
}
