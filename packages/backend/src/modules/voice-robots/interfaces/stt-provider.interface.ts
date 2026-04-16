import { EventEmitter } from 'events';

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

/**
 * Batch STT Provider — sends complete audio buffer, gets full text back.
 * Used with VAD-first approach (collect speech → send to STT).
 */
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

/**
 * Active gRPC/WebSocket STT stream handle.
 * Returned by ISttStreamingProvider.createStream().
 */
export interface SttStream {
  /**
   * Write PCM16 8kHz mono audio chunk to the stream.
   * Called for every RTP packet (160 samples = 20ms).
   */
  write(pcm16: Buffer): void;

  /**
   * Close the stream (no more audio will be sent).
   */
  end(): void;

  /**
   * Event emitter for streaming results.
   *
   * Events:
   * - 'partial' (text: string) — intermediate transcription (changes as more audio arrives)
   * - 'final'   (text: string) — confirmed transcription for a completed utterance
   * - 'eou'     ()             — end of utterance detected by provider (e.g. Yandex EOU classifier)
   * - 'error'   (err: Error)   — stream error
   * - 'end'     ()             — stream closed by server
   */
  events: EventEmitter;
}

/**
 * Streaming STT Provider — bidirectional stream.
 * Audio is sent in real-time, partial/final transcriptions received asynchronously.
 *
 * Used for low-latency recognition (Yandex SpeechKit gRPC v3, Google Cloud STT, etc.)
 *
 * Lifecycle:
 * 1. createStream() → SttStream (opens gRPC/WS connection, sends session_options)
 * 2. Loop: stream.write(pcm16) for each RTP packet
 * 3. Listen: stream.events.on('final', text => matchKeywords(text))
 * 4. stream.end() when session ends
 */
export interface ISttStreamingProvider {
  /** Provider name for logging */
  readonly name: string;

  /**
   * Create a new streaming recognition session.
   *
   * @param token API key or IAM token
   * @param settings Provider-specific settings (folder_id, model, eou_sensitivity, etc.)
   * @param language Language code (e.g. 'ru-RU')
   */
  createStream(
    token: string,
    settings: Record<string, any>,
    language: string,
  ): SttStream;
}
