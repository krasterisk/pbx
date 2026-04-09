import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/ami-events',
})
export class AmiGateway {
  private readonly logger = new Logger(AmiGateway.name);

  @WebSocketServer()
  server!: Server;

  emitPeerStatus(data: { peer: string; status: string; address: string }) {
    this.server?.emit('peerStatus', data);
  }

  emitAgentStatus(data: {
    queue: string;
    member: string;
    status: string;
    paused: string;
    callsTaken: string;
  }) {
    this.server?.emit('agentStatus', data);
  }

  emitNewChannel(data: {
    channel: string;
    calleridnum: string;
    calleridname: string;
    exten: string;
    context: string;
    uniqueid: string;
  }) {
    this.server?.emit('newChannel', data);
  }

  emitHangup(data: { channel: string; uniqueid: string; cause: string }) {
    this.server?.emit('hangup', data);
  }

  emitDashboardUpdate(data: any) {
    this.server?.emit('dashboardUpdate', data);
  }
}
