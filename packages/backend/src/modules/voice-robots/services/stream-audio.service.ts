import { Injectable, Logger } from '@nestjs/common';
import * as dgram from 'dgram';

/**
 * RTP audio sender for streaming TTS/greeting audio back to Asterisk.
 *
 * Each active call gets a StreamState with its own buffer queue,
 * sequence numbers, and AbortController for barge-in interrupt.
 *
 * Ported from aiPBX streamAudio.service.ts.
 */

interface StreamState {
  bufferQueue: Buffer[];
  isProcessing: boolean;
  seq: number;
  timestamp: number;
  abortController: AbortController;
  targetAddress: string;
  targetPort: number;
}

@Injectable()
export class StreamAudioService {
  private readonly logger = new Logger(StreamAudioService.name);
  private readonly streams = new Map<string, StreamState>();
  private readonly RTP_SSRC = Math.floor(Math.random() * 0xffffffff);
  private readonly server: dgram.Socket;

  /** A-law payload type in RTP header */
  private static readonly PAYLOAD_TYPE_ALAW = 0x08;
  /** 160 bytes alaw = 20ms of audio @ 8kHz */
  private static readonly PACKET_SIZE = 160;
  /** RTP packet interval in milliseconds */
  private static readonly PACKET_DURATION_MS = 20;

  constructor() {
    this.server = dgram.createSocket('udp4');
  }

  /**
   * Initialize a stream for a given session (channel).
   * Must be called before streamAudio().
   */
  addStream(sessionId: string, targetAddress: string, targetPort: number): void {
    if (this.streams.has(sessionId)) return;

    this.streams.set(sessionId, {
      bufferQueue: [],
      isProcessing: false,
      seq: Math.floor(Math.random() * 65535),
      timestamp: 0,
      abortController: new AbortController(),
      targetAddress,
      targetPort,
    });

    this.logger.log(`Stream ${sessionId} initialized → ${targetAddress}:${targetPort}`);
  }

  /**
   * Remove and cleanup a stream.
   */
  removeStream(sessionId: string): void {
    const state = this.streams.get(sessionId);
    if (state) {
      state.abortController.abort();
      this.streams.delete(sessionId);
      this.logger.log(`Stream ${sessionId} removed`);
    }
  }

  /**
   * Interrupt current playback (barge-in).
   * Clears the audio queue and creates a fresh AbortController.
   */
  interruptStream(sessionId: string): void {
    const state = this.streams.get(sessionId);
    if (state) {
      state.abortController.abort();
      state.bufferQueue.length = 0;
      state.abortController = new AbortController();
      state.isProcessing = false;
      this.logger.log(`Stream ${sessionId} interrupted`);
    }
  }

  /**
   * Queue an A-law audio buffer for RTP transmission.
   * The buffer will be split into 160-byte packets and sent at 20ms intervals.
   */
  async streamAudio(sessionId: string, alawBuffer: Buffer): Promise<void> {
    const state = this.streams.get(sessionId);
    if (!state) {
      this.logger.warn(`Stream ${sessionId} not found`);
      return;
    }

    state.bufferQueue.push(alawBuffer);

    if (!state.isProcessing) {
      state.isProcessing = true;
      // Await actual playback completion so callers (speakBatch) can
      // correctly track when audio finishes playing over RTP.
      await this.processQueue(sessionId, state);
    } else {
      // Another processQueue loop is already running.
      // Return a promise that resolves when the queue drains.
      return new Promise<void>((resolve) => {
        const check = () => {
          if (!state.isProcessing || state.abortController.signal.aborted) {
            resolve();
          } else {
            setTimeout(check, 50);
          }
        };
        setTimeout(check, 50);
      });
    }
  }

  /**
   * Process the buffer queue sequentially.
   */
  private async processQueue(sessionId: string, state: StreamState): Promise<void> {
    const { abortController } = state;

    while (state.bufferQueue.length > 0 && !abortController.signal.aborted) {
      const buffer = state.bufferQueue.shift()!;
      await this.sendBuffer(sessionId, buffer, abortController);
    }

    state.isProcessing = false;
  }

  /**
   * Send a single buffer as a sequence of RTP packets with timing control.
   */
  private sendBuffer(
    sessionId: string,
    buffer: Buffer,
    abortController: AbortController,
  ): Promise<void> {
    return new Promise<void>((resolve) => {
      if (abortController.signal.aborted) return resolve();

      let offset = 0;
      const startTime = Date.now();

      const sendNextPacket = () => {
        if (abortController.signal.aborted || offset >= buffer.length) {
          return resolve();
        }

        const chunk = buffer.subarray(
          offset,
          offset + StreamAudioService.PACKET_SIZE,
        );
        this.sendRtpPacket(sessionId, chunk);

        offset += StreamAudioService.PACKET_SIZE;

        const nextPacketTime =
          startTime +
          (offset / StreamAudioService.PACKET_SIZE) *
            StreamAudioService.PACKET_DURATION_MS;
        const delay = Math.max(0, nextPacketTime - Date.now());

        setTimeout(sendNextPacket, delay);
      };

      sendNextPacket();
    });
  }

  /**
   * Build and send a single RTP packet.
   */
  private sendRtpPacket(sessionId: string, chunk: Buffer): void {
    const state = this.streams.get(sessionId);
    if (!state) return;

    const rtpPacket = this.buildRTPPacket(
      chunk,
      state.seq,
      state.timestamp,
      this.RTP_SSRC,
      StreamAudioService.PAYLOAD_TYPE_ALAW,
    );

    state.seq = (state.seq + 1) & 0xffff;
    state.timestamp += StreamAudioService.PACKET_SIZE;

    this.server.send(
      rtpPacket,
      state.targetPort,
      state.targetAddress,
      (err) => {
        if (err) this.logger.error(`Send RTP error [${sessionId}]: ${err}`);
      },
    );
  }

  /**
   * Construct a standard RTP packet header (12 bytes) + payload.
   */
  private buildRTPPacket(
    payload: Buffer,
    seq: number,
    timestamp: number,
    ssrc: number,
    payloadType: number,
  ): Buffer {
    const header = Buffer.alloc(12);
    header.writeUInt8(0x80, 0); // Version=2, P=0, X=0, CC=0
    header.writeUInt8(payloadType, 1);
    header.writeUInt16BE(seq, 2);
    header.writeUInt32BE(timestamp, 4);
    header.writeUInt32BE(ssrc, 8);
    return Buffer.concat([header, payload]);
  }
}
