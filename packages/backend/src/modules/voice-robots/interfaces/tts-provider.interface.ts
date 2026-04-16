/**
 * TTS (Text-to-Speech) provider interface.
 * Supports both streaming providers (gRPC) and batch providers (REST).
 *
 * All providers must return PCM16 audio chunks as an async iterable
 * for streaming playback through StreamAudioService.
 */

export interface TtsOptions {
  /** Voice identifier (provider-specific: 'alena', 'filipp', 'alloy', etc.) */
  voice: string;
  /** Output sample rate. Default: 8000 (telephony) */
  sampleRate?: number;
  /** Language hint (e.g. 'ru', 'en') */
  language?: string;
  /** Speaking role/style (e.g. 'neutral', 'friendly', 'strict') */
  role?: string;
  /** Speed multiplier (1.0 = normal) */
  speed?: number;
  /** Pitch shift in Hz */
  pitchShift?: number;
}

/**
 * Batch/Streaming TTS Provider.
 * Returns PCM16 audio chunks as an async iterable for streaming playback.
 */
export interface ITtsProvider {
  /** Provider name for logging */
  readonly name: string;

  /** Native output sample rate of this provider */
  readonly outputSampleRate: number;

  /**
   * Synthesize text to PCM16 audio.
   * Returns an async iterable of PCM16 audio chunks for streaming playback.
   * @param text Text to synthesize
   * @param options Voice, sample rate, language
   * @param signal AbortSignal for interrupt support (barge-in)
   */
  synthesize(
    text: string,
    options: TtsOptions,
    signal?: AbortSignal,
  ): AsyncIterable<Buffer>;
}

/**
 * Streaming TTS Provider (gRPC server-side stream).
 *
 * Unlike ITtsProvider which buffers the full response, this provider
 * streams PCM16 chunks as they arrive from the gRPC server.
 * This reduces first-byte latency from ~1s to ~100-200ms.
 *
 * Used by: Yandex SpeechKit gRPC v3 (Synthesizer.UtteranceSynthesis)
 */
export interface ITtsStreamingProvider {
  /** Provider name for logging */
  readonly name: string;

  /**
   * Synthesize text and stream PCM16 chunks to a callback.
   *
   * @param text Text to synthesize
   * @param token API key or IAM token
   * @param settings Provider-specific settings (folder_id, voice, etc.)
   * @param onChunk Called for each PCM16 audio chunk as it arrives
   * @param signal AbortSignal for barge-in interrupt
   * @returns Promise that resolves when synthesis is complete
   */
  synthesizeStream(
    text: string,
    token: string,
    settings: Record<string, any>,
    onChunk: (pcm16: Buffer) => void,
    signal?: AbortSignal,
  ): Promise<void>;
}
