import { Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
} from '@nestjs/websockets';
import type { Namespace, Socket } from 'socket.io';
import type { Subscription } from 'rxjs';
import type { JwtPayloadUser } from '../auth/auth.service';
import { requireJwtSecret } from '../auth/jwt-secret';
import { CallCenterEventsService } from './callcenter-events.service';

type StreamClient = {
  subscription?: Subscription;
  expires: ReturnType<typeof setTimeout>;
};

/** WebSocket streams do not occupy the browser's six HTTP/1.1 request slots. */
@WebSocketGateway({ namespace: '/callcenter-events', cors: { origin: false } })
export class CallCenterEventsGateway
  implements
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnModuleDestroy
{
  private readonly logger = new Logger(CallCenterEventsGateway.name);
  private readonly clients = new Map<Socket, StreamClient>();

  constructor(
    private readonly config: ConfigService,
    private readonly events: CallCenterEventsService,
  ) {}

  afterInit(server: Namespace) {
    this.logger.log('Call center WebSocket event transport ready');
    // Authenticate before admitting the socket or subscribing to any tenant data.
    server.use((socket, next) => {
      try {
        const token = socket.handshake.auth?.token;
        if (typeof token !== 'string' || !token || token.length > 8192)
          throw new Error('Invalid token');
        const user = new JwtService().verify<JwtPayloadUser & { exp?: number }>(
          token,
          {
            secret: requireJwtSecret(this.config),
            issuer: 'krasterisk-v4',
            audience: 'krasterisk-v4-client',
          },
        );
        if (!user.sub || user.level === undefined || !user.exp)
          throw new Error('Invalid token payload');
        socket.data.callCenterUser = user;
        next();
      } catch {
        next(new Error('Unauthorized'));
      }
    });
  }

  handleConnection(socket: Socket) {
    const user = socket.data.callCenterUser as
      | (JwtPayloadUser & { exp: number })
      | undefined;
    if (!user || user.exp * 1000 <= Date.now()) {
      socket.disconnect(true);
      return;
    }
    const client: StreamClient = {
      expires: setTimeout(
        () => socket.disconnect(true),
        Math.min(user.exp * 1000 - Date.now(), 2_147_483_647),
      ),
    };
    this.clients.set(socket, client);
    this.logger.debug(`WebSocket stream opened; clients=${this.clients.size}`);
    try {
      client.subscription = this.events.events(user).subscribe({
        next: (event) =>
          socket.emit('cc:event', { type: event.type, data: event.data }),
        error: () => {
          this.logger.warn(
            'Call center event stream failed; disconnecting client',
          );
          this.handleDisconnect(socket);
          socket.disconnect(true);
        },
      });
      // A synchronous stream error may run before subscribe returns.
      if (!this.clients.has(socket)) client.subscription.unsubscribe();
    } catch {
      this.handleDisconnect(socket);
      socket.disconnect(true);
    }
  }

  handleDisconnect(socket: Socket) {
    const client = this.clients.get(socket);
    if (!client) return;
    this.clients.delete(socket);
    this.logger.debug(`WebSocket stream closed; clients=${this.clients.size}`);
    clearTimeout(client.expires);
    client.subscription?.unsubscribe();
  }

  onModuleDestroy() {
    for (const socket of this.clients.keys()) {
      this.handleDisconnect(socket);
      socket.disconnect(true);
    }
  }
}
