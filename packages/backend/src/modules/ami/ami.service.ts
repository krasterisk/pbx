import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AmiGateway } from './ami.gateway';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const AsteriskManager = require('asterisk-manager');

@Injectable()
export class AmiService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AmiService.name);
  private ami: any;
  private connected = false;

  constructor(
    private readonly config: ConfigService,
    private readonly gateway: AmiGateway,
  ) {}

  onModuleInit() {
    this.connect();
  }

  onModuleDestroy() {
    this.disconnect();
  }

  private connect() {
    const host = this.config.get('AMI_HOST', '127.0.0.1');
    const port = Number(this.config.get('AMI_PORT', 5038));
    const login = this.config.get('AMI_LOGIN', 'krasterisk');
    const secret = this.config.get('AMI_SECRET', '');

    if (!secret) {
      this.logger.warn('AMI_SECRET not configured, skipping AMI connection');
      return;
    }

    try {
      this.ami = new AsteriskManager(port, host, login, secret, true);

      this.ami.on('connect', () => {
        this.connected = true;
        this.logger.log(`✅ Connected to AMI at ${host}:${port}`);
      });

      this.ami.on('close', () => {
        this.connected = false;
        this.logger.warn('AMI connection closed, reconnecting in 5s...');
        setTimeout(() => this.connect(), 5000);
      });

      this.ami.on('error', (err: any) => {
        this.logger.error(`AMI error: ${err.message}`);
      });

      // Real-time events → WebSocket
      this.ami.on('peerstatus', (evt: any) => {
        this.gateway.emitPeerStatus({
          peer: evt.peer,
          status: evt.peerstatus,
          address: evt.address || '',
        });
      });

      this.ami.on('queuememberstatus', (evt: any) => {
        this.gateway.emitAgentStatus({
          queue: evt.queue,
          member: evt.membername || evt.interface,
          status: evt.status,
          paused: evt.paused,
          callsTaken: evt.callstaken,
        });
      });

      this.ami.on('newchannel', (evt: any) => {
        this.gateway.emitNewChannel({
          channel: evt.channel,
          calleridnum: evt.calleridnum,
          calleridname: evt.calleridname,
          exten: evt.exten,
          context: evt.context,
          uniqueid: evt.uniqueid,
        });
      });

      this.ami.on('hangup', (evt: any) => {
        this.gateway.emitHangup({
          channel: evt.channel,
          uniqueid: evt.uniqueid,
          cause: evt.cause,
        });
      });

      this.ami.keepConnected();
    } catch (error) {
      this.logger.error(`Failed to connect to AMI: ${error}`);
    }
  }

  private disconnect() {
    if (this.ami) {
      this.ami.disconnect();
      this.connected = false;
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  // --- AMI Commands ---

  async action(action: Record<string, any>): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.connected) {
        reject(new Error('AMI not connected'));
        return;
      }
      this.ami.action(action, (err: any, res: any) => {
        if (err) reject(err);
        else resolve(res);
      });
    });
  }

  async sipReload(): Promise<any> {
    return this.action({ action: 'Command', command: 'sip reload' });
  }

  async pjsipReload(): Promise<any> {
    return this.action({ action: 'Command', command: 'pjsip reload' });
  }

  async originate(channel: string, callerid: string, context: string, exten: string, priority = '1'): Promise<any> {
    return this.action({
      action: 'Originate',
      channel,
      callerid,
      context,
      exten,
      priority,
      async: 'true',
    });
  }

  async hangup(channel: string): Promise<any> {
    return this.action({ action: 'Hangup', channel });
  }

  async getActiveChannels(): Promise<any> {
    return this.action({ action: 'CoreShowChannels' });
  }

  async getPeerStatus(peer: string): Promise<any> {
    return this.action({ action: 'SIPpeerstatus', peer });
  }

  async queueAdd(queue: string, iface: string, penalty?: number): Promise<any> {
    return this.action({
      action: 'QueueAdd',
      queue,
      interface: iface,
      penalty: penalty || 0,
    });
  }

  async queueRemove(queue: string, iface: string): Promise<any> {
    return this.action({
      action: 'QueueRemove',
      queue,
      interface: iface,
    });
  }

  async queuePause(queue: string, iface: string, paused: boolean, reason?: string): Promise<any> {
    return this.action({
      action: 'QueuePause',
      queue,
      interface: iface,
      paused: paused ? 'true' : 'false',
      reason: reason || '',
    });
  }

  async queueStatus(queue?: string): Promise<any> {
    const params: any = { action: 'QueueStatus' };
    if (queue) params.queue = queue;
    return this.action(params);
  }

  async dbPut(family: string, key: string, val: string): Promise<any> {
    return this.action({ action: 'DBPut', family, key, val });
  }

  async dbGet(family: string, key: string): Promise<any> {
    return this.action({ action: 'DBGet', family, key });
  }

  async dbDel(family: string, key: string): Promise<any> {
    return this.action({ action: 'DBDel', family, key });
  }

  async command(cmd: string): Promise<any> {
    return this.action({ action: 'Command', command: cmd });
  }
}
