/**
 * VAD (Voice Activity Detection) provider interface.
 * Allows swapping VAD implementations (Silero, WebRTC VAD, cloud-based).
 */

export interface VadConfig {
  /** Speech probability threshold (0.0–1.0). Default: 0.5 */
  threshold: number;
  /** Silence duration (ms) to determine end-of-speech. Default: 2000 */
  silenceDurationMs: number;
  /** Audio buffer before speech_start event (ms). Default: 300 */
  prefixPaddingMs: number;
  /** Minimum speech duration (ms) to accept. Default: 300 */
  minSpeechDurationMs: number;
}

export interface VadResult {
  /** Whether speech is detected in this frame */
  isSpeech: boolean;
  /** Speech probability (0.0–1.0) */
  probability: number;
}

export interface IVadProvider {
  /** Provider name for logging */
  readonly name: string;

  /** Initialize VAD with config */
  init(config: VadConfig): Promise<void>;

  /** Process a Float32Array audio frame. Returns speech detection result. */
  processFrame(frame: Float32Array): Promise<VadResult>;

  /** Reset internal state (call between utterances) */
  reset(): void;

  /** Cleanup resources */
  destroy(): void;
}
