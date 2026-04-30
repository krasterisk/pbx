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
  private connecting = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = 5000; // starts at 5s
  private readonly MAX_RECONNECT_DELAY = 60000; // max 60s
  private readonly BASE_RECONNECT_DELAY = 5000;
  private destroyed = false;

  constructor(
    private readonly config: ConfigService,
    private readonly gateway: AmiGateway,
  ) {}

  onModuleInit() {
    this.connect();
  }

  onModuleDestroy() {
    this.destroyed = true;
    this.cancelReconnect();
    this.disconnect();
  }

  private cancelReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private scheduleReconnect() {
    if (this.destroyed) return;
    this.cancelReconnect();

    this.logger.warn(`AMI connection closed, reconnecting in ${this.reconnectDelay / 1000}s...`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, this.reconnectDelay);

    // Exponential backoff: 5s → 10s → 20s → 40s → 60s (cap)
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.MAX_RECONNECT_DELAY);
  }

  private cleanupAmi() {
    if (this.ami) {
      try {
        this.ami.removeAllListeners();
        this.ami.disconnect();
      } catch {
        // ignore cleanup errors
      }
      this.ami = null;
    }
    this.connected = false;
    this.connecting = false;
  }

  private connect() {
    if (this.destroyed || this.connecting) return;

    const host = this.config.get('AMI_HOST', '127.0.0.1');
    const port = Number(this.config.get('AMI_PORT', 5038));
    const login = this.config.get('AMI_LOGIN', 'krasterisk');
    const secret = this.config.get('AMI_SECRET', '');

    if (!secret) {
      this.logger.warn('AMI_SECRET not configured, skipping AMI connection');
      return;
    }

    // Clean up any previous instance before creating a new one
    this.cleanupAmi();
    this.connecting = true;

    try {
      this.ami = new AsteriskManager(port, host, login, secret, true);

      this.ami.on('connect', () => {
        this.connected = true;
        this.connecting = false;
        this.reconnectDelay = this.BASE_RECONNECT_DELAY; // reset backoff on success
        this.logger.log(`✅ Connected to AMI at ${host}:${port}`);
      });

      this.ami.on('close', () => {
        this.connected = false;
        this.connecting = false;
        // Don't call connect() directly — use scheduled reconnect with backoff.
        // keepConnected() is NOT used because it creates its own uncontrolled retry loop.
        if (!this.destroyed) {
          this.scheduleReconnect();
        }
      });

      this.ami.on('error', (err: any) => {
        this.logger.error(`AMI error: ${err.message}`);
        // error alone doesn't trigger reconnect; the subsequent 'close' event will
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

      // NOTE: keepConnected() removed — it caused uncontrolled reconnection storms.
      // Reconnection is now managed manually via scheduleReconnect() with exponential backoff.
    } catch (error) {
      this.connecting = false;
      this.logger.error(`Failed to connect to AMI: ${error}`);
      this.scheduleReconnect();
    }
  }

  private disconnect() {
    this.cancelReconnect();
    this.cleanupAmi();
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

  // --- Trunk Management (PJSIP Registration) ---

  /** Register a specific outbound registration by name */
  async pjsipRegister(registrationName: string): Promise<any> {
    return this.action({ action: 'PJSIPRegister', registration: registrationName });
  }

  /** Unregister a specific outbound registration by name */
  async pjsipUnregister(registrationName: string): Promise<any> {
    return this.action({ action: 'PJSIPUnregister', registration: registrationName });
  }

  /**
   * List all outbound PJSIP registrations and their statuses.
   * PJSIPShowRegistrationsOutbound is an event-list command:
   * it returns Success immediately, then sends individual
   * OutboundRegistrationDetail events, ending with
   * OutboundRegistrationDetailComplete.
   */
  async pjsipShowRegistrations(): Promise<{ events: any[] }> {
    return new Promise((resolve, reject) => {
      if (!this.connected) {
        reject(new Error('AMI not connected'));
        return;
      }

      const events: any[] = [];
      const actionId = String(Date.now()) + String(Math.random()).slice(2, 6);
      let settled = false;

      const finish = () => {
        if (settled) return;
        settled = true;
        this.ami.removeListener('rawevent', handler);
        resolve({ events });
      };

      const handler = (evt: any) => {
        if (evt.actionid !== actionId) return;
        if (evt.event === 'OutboundRegistrationDetail') {
          events.push(evt);
        }
        if (evt.event === 'OutboundRegistrationDetailComplete') {
          finish();
        }
      };

      this.ami.on('rawevent', handler);

      // Timeout safety — if Complete event never arrives
      const timer = setTimeout(finish, 5000);

      this.ami.action(
        { action: 'PJSIPShowRegistrationsOutbound', actionid: actionId },
        (err: any, _res: any) => {
          if (err) {
            clearTimeout(timer);
            settled = true;
            this.ami.removeListener('rawevent', handler);
            reject(err);
          }
        },
      );

      // Clear timeout when finished cleanly
      const origFinish = finish;
      const wrappedFinish = () => { clearTimeout(timer); origFinish(); };
      // Override finish reference for the handler's Complete event
      Object.defineProperty(handler, '_finish', { value: wrappedFinish });
    });
  }

  /** Reload a specific Asterisk module (e.g. res_pjsip_endpoint_identifier_ip.so) */
  async moduleReload(moduleName: string): Promise<any> {
    return this.action({ action: 'ModuleLoad', module: moduleName, loadtype: 'reload' });
  }
}
