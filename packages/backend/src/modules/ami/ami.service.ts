import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
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
    private readonly moduleRef: ModuleRef,
  ) {}

  /** Lazily resolve DialplanWebhooksService to avoid circular module dependency. */
  private getWebhooksService() {
    try {
      // strict: false searches all modules, not just AmiModule's own providers
      return this.moduleRef.get('DialplanWebhooksService', { strict: false });
    } catch {
      return null;
    }
  }

  /** Lazily resolve CallCenterAmiService to avoid circular module dependency. */
  private getCcAmiService() {
    try {
      return this.moduleRef.get('CallCenterAmiService', { strict: false });
    } catch {
      return null;
    }
  }

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
      // 5th arg = 'events' flag (AMI event filtering: true = receive all events).
      // keepConnected() is a SEPARATE method — we do NOT call it because we already
      // manage reconnection via scheduleReconnect() with exponential backoff.
      // Calling keepConnected() would create a parallel double-reconnect loop.
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

      // AgentConnect: fires when a queue member answers a queued call.
      // We use this for on_answer webhook with Queue() calls, because
      // Queue's 'gosub' parameter runs on the AGENT channel (not caller),
      // AgentConnect AMI event (Asterisk 22 docs):
      //   Channel      — agent's channel (e.g. PJSIP/101-000001)
      //   Uniqueid     — agent channel uniqueid
      //   DestChannel  — caller's channel (the one waiting in queue)
      //   DestUniqueid — caller channel uniqueid (used for CDR correlation)
      //   Interface    — queue member interface (e.g. PJSIP/e101_42)
      //   Queue        — queue name
      //   HoldTime     — seconds caller waited in queue
      //   MemberName   — queue member name
      //
      // ⚠️  NO BridgedChannel in this event (that was older AMI versions).
      // We GetVar from DestChannel to read HH_ROUTE_UID set on the caller side.
      this.ami.on('agentconnect', async (evt: any) => {
        try {
          const webhooksService = this.getWebhooksService();
          if (!webhooksService) return;

          // asterisk-manager lowercases all header names
          const callerChannel = evt.destchannel;
          const callerUniqueid = evt.destuniqueid || evt.uniqueid;
          if (!callerChannel) {
            this.logger.debug('AgentConnect: no DestChannel, skipping webhook');
            return;
          }

          // Read dialplan vars set on the caller channel by routes.service.ts
          const [routeVar, userVar] = await Promise.all([
            this.getChannelVar(callerChannel, 'HH_ROUTE_UID').catch(() => ''),
            this.getChannelVar(callerChannel, 'CDR(vpbx_user_uid)').catch(() => ''),
          ]);

          if (!routeVar || !userVar) {
            this.logger.debug(`AgentConnect: missing HH_ROUTE_UID or vpbx_user_uid on ${callerChannel}`);
            return;
          }

          await webhooksService.handleQueueAgentConnect({
            route_uid: routeVar,
            uniqueid: callerUniqueid,
            clid: evt.calleridnum || evt.callerid || '',
            member: evt.interface || evt.membername || '',
            queue: evt.queue || '',
            holdtime: evt.holdtime || '0',
            user_uid: userVar,
          });
        } catch (err: any) {
          this.logger.warn(`AgentConnect webhook error: ${err?.message}`);
        }
      });

      // ─── Call Center module event forwarding ───────────────
      // Forward AMI events to CallCenterAmiService for real-time state tracking.
      // Uses lazy ModuleRef resolution (same pattern as webhooks) to avoid circular deps.

      // QueueMemberStatus — agent status changes in queue
      this.ami.on('queuememberstatus', (evt: any) => {
        this.getCcAmiService()?.handleAgentStatusEvent(evt);
      });

      // QueueMemberAdded — agent dynamically added to queue
      this.ami.on('queuememberadded', (evt: any) => {
        this.getCcAmiService()?.handleMemberAdded(evt);
      });

      // QueueMemberRemoved — agent removed from queue
      this.ami.on('queuememberremoved', (evt: any) => {
        this.getCcAmiService()?.handleMemberRemoved(evt);
      });

      // QueueMemberPause — agent pause/unpause
      this.ami.on('queuememberpause', (evt: any) => {
        this.getCcAmiService()?.handleAgentStatusEvent(evt);
      });

      // QueueCallerJoin — caller entered queue
      this.ami.on('queuecallerjoin', (evt: any) => {
        this.getCcAmiService()?.handleCallerJoin(evt);
      });

      // QueueCallerAbandon — caller abandoned queue
      this.ami.on('queuecallerabandon', (evt: any) => {
        this.getCcAmiService()?.handleCallerAbandon(evt);
      });

      // AgentConnect — agent answered a queued call (also used by webhooks above)
      this.ami.on('agentconnect', (evt: any) => {
        this.getCcAmiService()?.handleAgentConnect(evt);
      });

      // AgentComplete — call ended after agent answered
      this.ami.on('agentcomplete', (evt: any) => {
        this.getCcAmiService()?.handleAgentComplete(evt);
      });

      // Hold / Unhold — channel placed on/off hold
      this.ami.on('hold', (evt: any) => {
        this.getCcAmiService()?.handleHold(evt);
      });

      this.ami.on('unhold', (evt: any) => {
        this.getCcAmiService()?.handleUnhold(evt);
      });

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
        if (err) {
          // asterisk-manager bug: some actions (e.g. UpdateConfig) pass
          // the success response as err instead of res
          if (err.response === 'Success') {
            resolve(err);
          } else {
            reject(err);
          }
        } else {
          resolve(res);
        }
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

  /**
   * Get the value of a channel variable via AMI GetVar.
   * Used internally to read caller-channel variables from agent-channel context (e.g. AgentConnect).
   *
   * @param channel  - Full channel name (e.g. "PJSIP/e101_42-00000001")
   * @param variable - Variable name (e.g. "HH_ROUTE_UID" or "CDR(vpbx_user_uid)")
   */
  async getChannelVar(channel: string, variable: string): Promise<string> {
    const res = await this.action({ action: 'GetVar', channel, variable });
    return res?.value || '';
  }
}
