import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as dgram from 'dgram';
import { EventEmitter } from 'events';
import { AudioService } from './audio.service';

/**
 * Per-session RTP data container.
 * Holds an ephemeral UDP socket and emits decoded audio events.
 */
export class RtpSession {
  public readonly eventEmitter = new EventEmitter();
  public readonly port: number;
  private readonly socket: dgram.Socket;
  private readonly logger = new Logger(RtpSession.name);
  private closed = false;

  /** Track whether we've received at least one RTP packet (for NAT remap) */
  private rtpReceived = false;

  constructor(
    private readonly audioService: AudioService,
    socket: dgram.Socket,
    port: number,
  ) {
    this.socket = socket;
    this.port = port;

    this.socket.on('message', (msg: Buffer, rinfo: dgram.RemoteInfo) => {
      if (this.closed) return;

      if (!this.rtpReceived) {
        this.rtpReceived = true;
        this.logger.log(`First RTP packet from ${rinfo.address}:${rinfo.port} → port ${this.port}`);
      }

      try {
        // Strip RTP header (12 bytes)
        const alawPayload = this.audioService.removeRTPHeader(msg);

        // Decode to PCM16 for STT accumulation
        const pcm16 = this.audioService.decodeAlawToPcm16(alawPayload);
        this.eventEmitter.emit('audio-pcm16', pcm16);

        // Decode to Float32 for VAD inference
        const float32 = this.audioService.decodeAlawToFloat32(alawPayload);
        this.eventEmitter.emit('audio-float32', float32);

      } catch (e: any) {
        this.logger.error(`Error processing RTP packet: ${e.message}`);
      }
    });

    this.socket.on('error', (err) => {
      this.logger.error(`UDP socket error on port ${this.port}: ${err.message}`);
    });
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.eventEmitter.removeAllListeners();
    try {
      this.socket.close();
    } catch {
      // Socket may already be closed
    }
    this.logger.log(`RTP session closed on port ${this.port}`);
  }
}

/**
 * RTP UDP Server Service.
 *
 * Creates ephemeral UDP sockets for each Voice Robot call session.
 * Each session gets its own port and emits decoded audio events
 * for VAD and STT processing.
 */
@Injectable()
export class RtpUdpServerService implements OnModuleDestroy {
  private readonly logger = new Logger(RtpUdpServerService.name);
  private readonly activeSessions = new Map<number, RtpSession>();
  
  private readonly minPort: number;
  private readonly maxPort: number;
  private currentPort: number;

  constructor(
    private readonly audioService: AudioService,
    private readonly configService: ConfigService,
  ) {
    const minStr = this.configService.get<string>('RTP_MIN_PORT');
    const maxStr = this.configService.get<string>('RTP_MAX_PORT');
    this.minPort = minStr ? parseInt(minStr, 10) : 0;
    this.maxPort = maxStr ? parseInt(maxStr, 10) : 0;
    this.currentPort = this.minPort;
  }

  private getNextPort(): number {
    if (this.minPort === 0 || this.maxPort === 0 || this.minPort > this.maxPort) {
      return 0; // OS assigns an ephemeral port
    }

    // Try finding an available port in the range
    for (let i = 0; i <= (this.maxPort - this.minPort); i++) {
      const port = this.currentPort;
      this.currentPort++;
      if (this.currentPort > this.maxPort) {
        this.currentPort = this.minPort;
      }
      
      if (!this.activeSessions.has(port)) {
        return port;
      }
    }
    
    throw new Error('No available RTP ports in configured range');
  }

  /**
   * Create a new RTP session with an ephemeral UDP port.
   *
   * @returns RtpSession with port number and audio event emitter
   */
  async createSession(): Promise<RtpSession> {
    return new Promise<RtpSession>((resolve, reject) => {
      const socket = dgram.createSocket('udp4');

      socket.on('listening', () => {
        socket.removeAllListeners('error'); // remove setup error handler
        
        // Add permanent runtime error handler
        socket.on('error', (err) => {
          this.logger.error(`UDP socket runtime error: ${err.message}`);
        });

        const addr = socket.address();
        const port = addr.port;

        const session = new RtpSession(this.audioService, socket, port);
        this.activeSessions.set(port, session);

        this.logger.log(`RTP session created on port ${port}`);
        resolve(session);
      });

      const attemptBind = (attempts: number) => {
        if (attempts > 50) {
          return reject(new Error('Failed to bind UDP socket after 50 attempts'));
        }

        try {
          const portToBind = this.getNextPort();
          
          socket.once('error', (err: any) => {
            if (err.code === 'EADDRINUSE' && portToBind !== 0) {
              this.logger.warn(`Port ${portToBind} in use, trying next...`);
              attemptBind(attempts + 1);
            } else {
              this.logger.error(`Failed to bind UDP socket: ${err.message}`);
              reject(err);
            }
          });

          socket.bind(portToBind);
        } catch (e) {
          reject(e);
        }
      };

      attemptBind(0);
    });
  }

  /**
   * Close a specific RTP session by port.
   */
  closeSession(port: number): void {
    const session = this.activeSessions.get(port);
    if (session) {
      session.close();
      this.activeSessions.delete(port);
    }
  }

  /**
   * Get count of active sessions (for monitoring).
   */
  getActiveSessionCount(): number {
    return this.activeSessions.size;
  }

  onModuleDestroy() {
    this.logger.log(`Shutting down ${this.activeSessions.size} RTP sessions...`);
    for (const [port, session] of this.activeSessions) {
      session.close();
    }
    this.activeSessions.clear();
  }
}

