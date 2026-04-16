import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { IVadProvider, VadConfig, VadResult } from '../interfaces/vad-provider.interface';

/**
 * Per-session VAD instance with isolated LSTM state.
 *
 * Each VoiceRobotSession creates its own VadSessionInstance
 * to prevent cross-session LSTM state contamination.
 *
 * CRITICAL FIX: The previous implementation shared _h/_c across all
 * concurrent sessions, causing false VAD triggers under load (≥2 calls).
 */
export class VadSessionInstance {
  private _sr: any;
  private _h: any;
  private _c: any;
  private frameAccumulator = new Float32Array(0);
  private destroyed = false;

  private static readonly FRAME_SIZE = 256;

  constructor(
    private readonly ort: any,
    private readonly onnxSession: any,
    private readonly threshold: number,
  ) {
    this.resetState();
  }

  /**
   * Process a Float32Array frame through VAD.
   * Handles frame accumulation internally (RTP gives ~160 samples, Silero needs 256).
   */
  async processFrame(frame: Float32Array): Promise<VadResult> {
    if (this.destroyed || !this.onnxSession) {
      return { isSpeech: false, probability: 0 };
    }

    // Accumulate frames until we have enough for a Silero frame
    const combined = new Float32Array(this.frameAccumulator.length + frame.length);
    combined.set(this.frameAccumulator, 0);
    combined.set(frame, this.frameAccumulator.length);
    this.frameAccumulator = combined;

    let maxProbability = 0;

    // Process all complete 256-sample frames in the accumulator
    while (this.frameAccumulator.length >= VadSessionInstance.FRAME_SIZE) {
      const vadFrame = this.frameAccumulator.slice(0, VadSessionInstance.FRAME_SIZE);
      this.frameAccumulator = this.frameAccumulator.slice(VadSessionInstance.FRAME_SIZE);

      const probability = await this.runOnnxFrame(vadFrame);
      if (probability > maxProbability) {
        maxProbability = probability;
      }
    }

    return {
      isSpeech: maxProbability >= this.threshold,
      probability: maxProbability,
    };
  }

  /**
   * Run a single 256-sample frame through ONNX Silero VAD.
   * Returns speech probability [0..1].
   */
  private async runOnnxFrame(frame: Float32Array): Promise<number> {
    const Tensor = this.ort.Tensor;

    const inputTensor = new Tensor('float32', frame, [1, frame.length]);

    const feeds = {
      input: inputTensor,
      sr: this._sr,
      h: this._h,
      c: this._c,
    };

    const result = await this.onnxSession.run(feeds);

    // Update LSTM hidden/cell state for next frame (isolated per session)
    this._h = result.hn;
    this._c = result.cn;

    return result.output.data[0] as number;
  }

  /**
   * Reset ONNX LSTM internal state.
   */
  resetState(): void {
    if (!this.ort) return;
    const Tensor = this.ort.Tensor;

    this._sr = new Tensor('int64', BigInt64Array.from([BigInt(8000)]), []);
    this._h = new Tensor('float32', new Float32Array(2 * 64).fill(0), [2, 1, 64]);
    this._c = new Tensor('float32', new Float32Array(2 * 64).fill(0), [2, 1, 64]);
  }

  /**
   * Cleanup resources. Must be called when session ends.
   */
  destroy(): void {
    this.destroyed = true;
    this._h = null;
    this._c = null;
    this._sr = null;
    this.frameAccumulator = new Float32Array(0);
  }
}

/**
 * Silero VAD Provider — Factory Pattern.
 *
 * The ONNX model is loaded ONCE at module init (singleton).
 * Each call session gets an isolated VadSessionInstance via createSessionInstance().
 *
 * Uses onnxruntime-node for per-frame voice activity detection.
 * Runs on CPU, ~50 MB RAM for the shared model, ~1-2ms per frame.
 *
 * Input: Float32Array frame with 256 samples @ 8kHz (32ms per frame).
 * Model: Silero VAD v6 ONNX.
 */
@Injectable()
export class SileroVadProvider implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SileroVadProvider.name);

  private ort: any = null;
  private modelPath: string | null = null;
  private initialized = false;
  private config: VadConfig;

  async onModuleInit(): Promise<void> {
    this.config = {
      threshold: 0.5,
      silenceDurationMs: 2000,
      prefixPaddingMs: 300,
      minSpeechDurationMs: 300,
    };

    try {
      this.ort = require('onnxruntime-node');

      // Resolve model path — try package first, then local
      try {
        this.modelPath = require.resolve('@ricky0123/vad-node/dist/silero_vad.onnx');
      } catch {
        const path = require('path');
        this.modelPath = path.join(process.cwd(), 'models', 'silero_vad.onnx');
      }

      // Verify model is loadable by creating a test session
      const testSession = await this.ort.InferenceSession.create(this.modelPath);
      // Release the test session immediately
      testSession.release?.();

      this.initialized = true;
      this.logger.log(
        `Silero VAD factory initialized (model: ${this.modelPath}, threshold: ${this.config.threshold})`,
      );
    } catch (err: any) {
      this.logger.warn(
        `Silero VAD not initialized — onnxruntime-node or model not found: ${err.message}`,
      );
      this.logger.warn(
        `Voice Robots will run without VAD. Ensure 'silero_vad.onnx' (v6) is placed in the 'models' directory.`,
      );
    }
  }

  onModuleDestroy(): void {
    this.ort = null;
    this.modelPath = null;
    this.initialized = false;
  }

  /**
   * Whether the VAD provider is available.
   */
  get isAvailable(): boolean {
    return this.initialized;
  }

  /**
   * Create an isolated VAD session instance for a specific call.
   *
   * Each session gets its own ONNX InferenceSession and LSTM state (_h, _c).
   * This prevents cross-session state contamination under concurrent load.
   *
   * The returned instance MUST be destroyed when the call session ends
   * to release ONNX resources.
   */
  async createSessionInstance(): Promise<VadSessionInstance> {
    if (!this.initialized || !this.ort || !this.modelPath) {
      throw new Error('SileroVadProvider not initialized');
    }

    const onnxSession = await this.ort.InferenceSession.create(this.modelPath);
    return new VadSessionInstance(this.ort, onnxSession, this.config.threshold);
  }

  /**
   * Get the default VAD config.
   */
  getDefaultConfig(): VadConfig {
    return { ...this.config };
  }
}
