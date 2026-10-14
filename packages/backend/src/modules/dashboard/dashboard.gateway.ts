import { OnModuleDestroy, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayInit } from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import type { Namespace, Socket } from 'socket.io';
import type { JwtPayloadUser } from '../auth/auth.service';
import { requireJwtSecret } from '../auth/jwt-secret';
import { DashboardAccessService } from './dashboard-access.service';
import { DashboardReadStore } from './dashboard-read-store.service';

@WebSocketGateway({ namespace: '/pbx-dashboard', cors: { origin: false } })
export class DashboardGateway implements OnGatewayConnection, OnGatewayInit, OnModuleDestroy {
  @WebSocketServer() server!: Namespace;
  private timer: ReturnType<typeof setInterval> | null = null;
  private busy = false;
  private version = '0';
  constructor(private readonly config: ConfigService, private readonly access: DashboardAccessService, private readonly store: DashboardReadStore) {}
  async handleConnection(socket: Socket) {
    try {
      const token = socket.handshake.auth?.token;
      if (typeof token !== 'string' || token.length > 8192) throw new UnauthorizedException();
      const user = new JwtService().verify<JwtPayloadUser & { exp?: number }>(token, {
        secret: requireJwtSecret(this.config), issuer: 'krasterisk-v4', audience: 'krasterisk-v4-client',
      });
      const context = await this.access.resolve(user);
      socket.data.dashboardUser = user;
      socket.data.permissions = context.permissionVersion;
      socket.data.checkedAt = Date.now();
      this.notify(socket);
    } catch { socket.disconnect(true); }
  }
  private notify(socket: Socket): void {
    const version = this.version + ':' + socket.data.permissions;
    if (socket.data.dashboardVersion === version) return;
    socket.data.dashboardVersion = version;
    socket.emit('dashboard.version', { version });
  }
  afterInit() {
    this.timer = setInterval(() => void this.tick(), 5000);
    this.timer.unref();
  }
  private async tick() {
    if (this.busy || !this.server?.sockets) return;
    this.busy = true;
    try {
      // One small source-version read for the namespace. No AMI or personal data.
      try {
        const rows = await this.store.select<{ updated_at: number }>(
          `SELECT updated_at FROM dashboard_live_state WHERE node_id = :node
           UNION ALL SELECT updated_at FROM dashboard_checkpoints WHERE source_key IN (:sources)
           UNION ALL SELECT MAX(sampled_at) AS updated_at FROM dashboard_system_samples`,
          { node: this.store.nodeId, sources: [`cdr:${this.store.nodeId}`, `projection:${this.store.nodeId}`] },
        );
        this.version = String(Math.max(0, ...rows.map(row => Number(row.updated_at) || 0)));
      } catch { /* Keep the last version while the source is unavailable. */ }
      const sockets = [...this.server.sockets.values()];
      for (let i = 0; i < sockets.length; i += 25) {
        await Promise.all(sockets.slice(i, i + 25).map(async socket => {
          const user = socket.data.dashboardUser as (JwtPayloadUser & { exp?: number }) | undefined;
          if (!user) return;
          if (user.exp && user.exp * 1000 <= Date.now()) { socket.disconnect(true); return; }
          if (Date.now() - Number(socket.data.checkedAt) >= 30000) {
            try {
              const context = await this.access.resolve(user);
              socket.data.permissions = context.permissionVersion;
              socket.data.checkedAt = Date.now();
            } catch { socket.disconnect(true); return; }
          }
          this.notify(socket);
        }));
      }
    } finally { this.busy = false; }
  }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }
}
