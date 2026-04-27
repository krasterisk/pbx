import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import WebSocket from 'ws';
import { AriHttpClientService } from './ari-http-client.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

/**
 * Manages the WebSocket connection to Asterisk ARI.
 *
 * Features (ported from aiPBX ari-connection.ts):
 * - Automatic reconnect on disconnect
 * - WebSocket heartbeat (ping/pong every 30s with 10s timeout)
 * - External channel → parent channel ID mapping for UNICASTRTP_* vars
 * - Typed event broadcasting via NestJS EventEmitter2
 */
@Injectable()
export class AriConnectionService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(AriConnectionService.name);
  private ws: WebSocket | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private isShuttingDown = false;

  // Heartbeat
  private pingInterval: NodeJS.Timeout | null = null;
  private pongTimeout: NodeJS.Timeout | null = null;
  private static readonly PING_INTERVAL_MS = 30_000;
  private static readonly PONG_TIMEOUT_MS = 10_000;

  /** Maps ExternalMedia channel IDs → primary (parent) channel IDs */
  private readonly externalToParentChannel = new Map<string, string>();

  constructor(
    private readonly configService: ConfigService,
    private readonly ariClient: AriHttpClientService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  onApplicationBootstrap() {
    this.connect();
  }

  onApplicationShutdown() {
    this.isShuttingDown = true;
    this.disconnect();
  }

  private connect() {
    if (this.isShuttingDown) return;

    const protocol = this.configService.get<string>('ARI_PROTOCOL', 'http') === 'https' ? 'wss' : 'ws';
    const host = this.configService.get<string>('ARI_HOST', 'localhost');
    const port = this.configService.get<number>('ARI_PORT', 8088);
    const username = this.configService.get<string>('ARI_USER', 'krasterisk');
    const password = this.configService.get<string>('ARI_PASSWORD', '');
    const appName = this.ariClient.getAppName();

    const wsUrl = `${protocol}://${host}:${port}/ari/events?api_key=${username}:${password}&app=${appName}&subscribeAll=true`;

    this.logger.log(`Connecting to ARI WebSocket: ${wsUrl.replace(password, '***')}`);

    this.ws = new WebSocket(wsUrl);

    this.ws!.on('open', () => {
      this.logger.log('✨ Connected to Asterisk ARI WebSocket');
      this.clearReconnectTimeout();
      this.startHeartbeat();
    });

    this.ws!.on('pong', () => {
      if (this.pongTimeout) {
        clearTimeout(this.pongTimeout);
        this.pongTimeout = null;
      }
    });

    this.ws!.on('message', (data: string) => {
      try {
        const event = JSON.parse(data.toString());
        this.handleEvent(event);
      } catch (e: any) {
        this.logger.error(`Error parsing ARI event: ${e.message}`);
      }
    });

    this.ws!.on('close', () => {
      this.logger.warn('ARI WebSocket disconnected');
      this.stopHeartbeat();

      if (this.ws) {
        this.ws.removeAllListeners();
      }

      this.scheduleReconnect();
    });

    this.ws!.on('error', (error: any) => {
      this.logger.error(`ARI WebSocket error: ${error.message}`);
      this.ws?.close();
    });
  }

  private disconnect() {
    this.stopHeartbeat();
    this.clearReconnectTimeout();

    if (this.ws) {
      const ws = this.ws;
      this.ws = null; // Prevents reconnect in 'close' handler
      ws.removeAllListeners();
      ws.close();
    }
  }

  // ─── Heartbeat ─────────────────────────────────────────

  private startHeartbeat(): void {
    this.stopHeartbeat();

    this.pingInterval = setInterval(() => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        this.stopHeartbeat();
        return;
      }

      this.pongTimeout = setTimeout(() => {
        this.logger.warn(
          `No pong received within ${AriConnectionService.PONG_TIMEOUT_MS / 1000}s — terminating dead WebSocket`,
        );
        this.ws?.terminate();
      }, AriConnectionService.PONG_TIMEOUT_MS);

      this.ws.ping();
    }, AriConnectionService.PING_INTERVAL_MS);
  }

  private stopHeartbeat(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.pongTimeout) {
      clearTimeout(this.pongTimeout);
      this.pongTimeout = null;
    }
  }

  // ─── Reconnect ─────────────────────────────────────────

  private scheduleReconnect() {
    if (this.isShuttingDown || this.reconnectTimeout) return;

    this.logger.log('Scheduling ARI WebSocket reconnect in 5 seconds...');
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.connect();
    }, 5000);
  }

  private clearReconnectTimeout() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  // ─── Event Handling ────────────────────────────────────

  /** Events to ignore — noisy on production PBX with many SIP peers */
  private static readonly IGNORED_EVENTS = new Set([
    'PeerStatusChange',
    'DeviceStateChanged',
    'ContactStatusChange',
  ]);

  private handleEvent(event: any) {
    try {
      // Skip noisy events that are irrelevant to voice robot functionality
      if (AriConnectionService.IGNORED_EVENTS.has(event.type)) {
        return;
      }

      switch (event.type) {
        case 'StasisStart':
          this.handleStasisStart(event);
          break;

        case 'StasisEnd':
          // Clean up external channel mapping
          this.cleanupExternalMapping(event.channel?.id);
          break;

        case 'ChannelVarset':
          this.handleChannelVarset(event);
          break;
      }

      // Broadcast all events to the NestJS EventEmitter system
      this.eventEmitter.emit(`ari.${event.type}`, event);

      if (event.type !== 'ChannelVarset') {
        this.logger.debug(`[ARI Event] ${event.type} on channel ${event.channel?.id}`);
      }

    } catch (err: any) {
      this.logger.error(`Error handling ARI event ${event.type}: ${err.message}`);
    }
  }

  /**
   * Handle StasisStart: detect ExternalMedia (UnicastRTP) second legs
   * and map them to their parent channel for ChannelVarset routing.
   */
  private handleStasisStart(event: any): void {
    const channelId = event.channel?.id;
    if (!channelId) return;

    // Detect UnicastRTP second leg (ExternalMedia channel entering Stasis)
    if (event.channel?.name?.startsWith('UnicastRTP/')) {
      // The 'data' field from externalMedia() is passed as args[0]
      const parentChannelId = event.args?.[0];
      if (parentChannelId) {
        this.externalToParentChannel.set(channelId, parentChannelId);
        this.logger.log(`Linked ExternalMedia ${channelId} → primary ${parentChannelId}`);
      }
      return; // Don't propagate UnicastRTP StasisStart to voice-robots
    }

    // Ignore Snoop channels
    if (event.channel?.name?.startsWith('Snoop/')) {
      return;
    }
  }

  /**
   * Handle ChannelVarset for UNICASTRTP_LOCAL_ADDRESS / UNICASTRTP_LOCAL_PORT.
   * These are set asynchronously by Asterisk after externalMedia() call.
   * We route them to the parent channel's session.
   */
  private handleChannelVarset(event: any): void {
    const channelId = event.channel?.id;
    const variable = event.variable;
    const value = event.value;

    if (variable !== 'UNICASTRTP_LOCAL_ADDRESS' && variable !== 'UNICASTRTP_LOCAL_PORT') {
      return;
    }

    this.logger.debug(`ChannelVarset: ${channelId} ${variable}=${value}`);

    // Find parent channel for this external channel
    const parentId = this.externalToParentChannel.get(channelId);
    if (parentId) {
      // Emit a specialized event with the parent channel ID
      this.eventEmitter.emit('ari.ExternalMediaRtpReady', {
        parentChannelId: parentId,
        externalChannelId: channelId,
        variable,
        value,
      });
    }
  }

  private cleanupExternalMapping(channelId: string | undefined): void {
    if (!channelId) return;
    this.externalToParentChannel.delete(channelId);
    // Also check if it's a parent channel — clean all externals pointing to it
    for (const [extId, parentId] of this.externalToParentChannel) {
      if (parentId === channelId) {
        this.externalToParentChannel.delete(extId);
      }
    }
  }

  /** Check if ARI WebSocket is connected */
  isOnline(): boolean {
    return !!this.ws && this.ws.readyState === WebSocket.OPEN;
  }
}
