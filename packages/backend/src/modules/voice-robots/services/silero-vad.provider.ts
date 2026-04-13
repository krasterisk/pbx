import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { IVadProvider, VadConfig, VadResult } from '../interfaces/vad-provider.interface';

/**
 * Silero VAD Provider.
 *
 * Uses onnxruntime-node for per-frame voice activity detection.
 * Runs on CPU, ~50 MB RAM, ~1-2ms per frame.
 *
 * Input: Float32Array frame with 256 samples @ 8kHz (32ms per frame).
 * Model: Silero VAD v6 ONNX.
 *
 * Implements IVadProvider interface for pluggable replacement.
 */
@Injectable()
export class SileroVadProvider implements IVadProvider, OnModuleInit, OnModuleDestroy {
  readonly name = 'silero';
  private readonly logger = new Logger(SileroVadProvider.name);

  private ort: any = null;
  private onnxSession: any = null;
  private _sr: any = null; // ONNX tensor: sample rate
  private _h: any = null;  // ONNX tensor: hidden state (LSTM)
  private _c: any = null;  // ONNX tensor: cell state (LSTM)
  private config: VadConfig;
  private initialized = false;

  // Frame accumulator — Silero needs exactly 256 samples per frame @ 8kHz
  private static readonly FRAME_SIZE = 256;
  private frameAccumulator = new Float32Array(0);

  async onModuleInit(): Promise<void> {
    await this.init({
      threshold: 0.5,
      silenceDurationMs: 2000,
      prefixPaddingMs: 300,
      minSpeechDurationMs: 300,
    });
  }

  onModuleDestroy(): void {
    this.destroy();
  }

  async init(config: VadConfig): Promise<void> {
    this.config = config;

    try {
      this.ort = require('onnxruntime-node');

      // Resolve model path — try local first, then package
      let modelPath: string;
      try {
        modelPath = require.resolve('@ricky0123/vad-node/dist/silero_vad.onnx');
      } catch {
        const path = require('path');
        modelPath = path.join(process.cwd(), 'models', 'silero_vad.onnx');
      }

      this.onnxSession = await this.ort.InferenceSession.create(modelPath);
      this.resetOnnxState();

      this.initialized = true;
      this.logger.log(
        `Silero VAD initialized (threshold: ${config.threshold}, frame: ${SileroVadProvider.FRAME_SIZE} @ 8kHz)`,
      );
    } catch (err: any) {
      this.logger.warn(
        `Silero VAD not initialized — onnxruntime-node or model not found: ${err.message}`,
      );
      this.logger.warn(
        `Voice Robots will run without VAD. Install: npm i onnxruntime-node @ricky0123/vad-node`,
      );
    }
  }

  /**
   * Process a Float32Array frame through VAD.
   * Handles frame accumulation internally (RTP gives ~160 samples, Silero needs 256).
   */
  async processFrame(frame: Float32Array): Promise<VadResult> {
    if (!this.initialized || !this.onnxSession) {
      return { isSpeech: false, probability: 0 };
    }

    // Accumulate frames until we have enough for a Silero frame
    const combined = new Float32Array(this.frameAccumulator.length + frame.length);
    combined.set(this.frameAccumulator, 0);
    combined.set(frame, this.frameAccumulator.length);
    this.frameAccumulator = combined;

    let maxProbability = 0;

    // Process all complete 256-sample frames in the accumulator
    while (this.frameAccumulator.length >= SileroVadProvider.FRAME_SIZE) {
      const vadFrame = this.frameAccumulator.slice(0, SileroVadProvider.FRAME_SIZE);
      this.frameAccumulator = this.frameAccumulator.slice(SileroVadProvider.FRAME_SIZE);

      const probability = await this.runOnnxFrame(vadFrame);
      if (probability > maxProbability) {
        maxProbability = probability;
      }
    }

    return {
      isSpeech: maxProbability >= this.config.threshold,
      probability: maxProbability,
    };
  }

  reset(): void {
    this.resetOnnxState();
    this.frameAccumulator = new Float32Array(0);
  }

  destroy(): void {
    this.onnxSession = null;
    this.ort = null;
    this.initialized = false;
    this.frameAccumulator = new Float32Array(0);
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

    // Update LSTM hidden/cell state for next frame
    this._h = result.hn;
    this._c = result.cn;

    return result.output.data[0] as number;
  }

  /**
   * Reset ONNX LSTM internal state.
   */
  private resetOnnxState(): void {
    if (!this.ort) return;
    const Tensor = this.ort.Tensor;

    this._sr = new Tensor('int64', BigInt64Array.from([BigInt(8000)]), []);
    this._h = new Tensor('float32', new Float32Array(2 * 64).fill(0), [2, 1, 64]);
    this._c = new Tensor('float32', new Float32Array(2 * 64).fill(0), [2, 1, 64]);
  }
}
