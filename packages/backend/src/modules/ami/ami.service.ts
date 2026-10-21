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
  /** True after the first successful AMI connect — used to detect reconnects. */
  private hasConnectedOnce = false;
  private readonly internalObservers = new Set<(event: Record<string, any>) => void>();

  /** Server-only event bus. Never forwards raw tenant data to a public socket. */
  subscribeInternalEvents(listener: (event: Record<string, any>) => void): () => void {
    this.internalObservers.add(listener);
    return () => this.internalObservers.delete(listener);
  }

  private publishInternal(event: Record<string, any>): void {
    for (const observer of this.internalObservers) {
      try { observer(event); } catch (error) { this.logger.warn(`Internal AMI observer failed: ${error}`); }
    }
  }

  constructor(
    private readonly config: ConfigService,
    private readonly gateway: AmiGateway,
    private readonly moduleRef: ModuleRef,
  ) {}

  private warnedMissingWebhooks = false;
  private warnedMissingCcAmi = false;
  private warnedMissingCcReconciler = false;
  private warnedMissingCcPresence = false;
  private warnedMissingConferenceState = false;

  /** Lazily resolve DialplanWebhooksService to avoid circular module dependency. */
  private getWebhooksService() {
    try {
      // strict: false searches all modules, not just AmiModule's own providers
      return this.moduleRef.get('DialplanWebhooksService', { strict: false });
    } catch {
      if (!this.warnedMissingWebhooks) {
        this.warnedMissingWebhooks = true;
        this.logger.warn(
          'DialplanWebhooksService not resolvable via ModuleRef — AMI webhooks disabled',
        );
      }
      return null;
    }
  }

  /** Lazily resolve CallCenterAmiService to avoid circular module dependency. */
  private getCcAmiService() {
    try {
      return this.moduleRef.get('CallCenterAmiService', { strict: false });
    } catch {
      if (!this.warnedMissingCcAmi) {
        this.warnedMissingCcAmi = true;
        this.logger.warn(
          'CallCenterAmiService not resolvable via ModuleRef — queue SSE state disabled',
        );
      }
      return null;
    }
  }

  /** Lazily resolve CallCenterPresenceService to avoid circular module dependency. */
  private getCcPresenceService() {
    try {
      return this.moduleRef.get('CallCenterPresenceService', { strict: false });
    } catch {
      if (!this.warnedMissingCcPresence) {
        this.warnedMissingCcPresence = true;
        this.logger.warn(
          'CallCenterPresenceService not resolvable via ModuleRef — BLF presence disabled',
        );
      }
      return null;
    }
  }

  /** Lazily resolve ConferenceStateService to avoid circular module dependency. */
  private getConferenceStateService() {
    try {
      return this.moduleRef.get('ConferenceStateService', { strict: false });
    } catch {
      if (!this.warnedMissingConferenceState) {
        this.warnedMissingConferenceState = true;
        this.logger.warn(
          'ConferenceStateService not resolvable via ModuleRef — conference live state disabled',
        );
      }
      return null;
    }
  }

  /** Lazily resolve queue_log reconciler (D-05 backfill on AMI reconnect). */
  private getCcReconcilerService() {
    try {
      return this.moduleRef.get('CallCenterQueueLogReconcilerService', { strict: false });
    } catch {
      if (!this.warnedMissingCcReconciler) {
        this.warnedMissingCcReconciler = true;
        this.logger.warn(
          'CallCenterQueueLogReconcilerService not resolvable via ModuleRef — reconcile disabled',
        );
      }
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

      this.ami.on('rawevent', (event: Record<string, any>) => this.publishInternal(event));

      this.ami.on('connect', () => {
        this.connected = true;
        this.publishInternal({ event: 'DashboardConnection', connected: true });
        this.connecting = false;
        this.reconnectDelay = this.BASE_RECONNECT_DELAY; // reset backoff on success
        this.logger.log(`✅ Connected to AMI at ${host}:${port}`);

        const wasReconnect = this.hasConnectedOnce;
        this.hasConnectedOnce = true;

        // Seed BLF / SIP registration presence cache (DeviceStateChange only fires
        // on transitions otherwise — softphone badge stays red forever).
        setTimeout(() => {
          void this.collectDeviceStateList()
            .then(({ events }) => {
              const presence = this.getCcPresenceService();
              if (!presence) return;
              for (const evt of events) {
                presence.handleDeviceStateChange(evt);
              }
            })
            .catch((err: any) => {
              this.logger.warn(
                `DeviceStateList presence seed failed: ${err?.message || err}`,
              );
            });
        }, wasReconnect ? 1500 : 500);

        // On reconnect only: resync in-memory CC state (first connect is handled by
        // CallCenterAmiService.onModuleInit → initialize → loadInitialState).
        if (wasReconnect) {
          setTimeout(() => {
            const ccAmi = this.getCcAmiService();
            if (ccAmi?.loadInitialState) {
              Promise.resolve(ccAmi.loadInitialState()).catch((err: any) => {
                this.logger.warn(
                  `CC state resync after AMI reconnect failed: ${err?.message || err}`,
                );
              });
            }
            // D-05: backfill cc_queue_calls gaps from Asterisk queue_log
            const reconciler = this.getCcReconcilerService();
            if (reconciler?.reconcileRecent) {
              Promise.resolve(reconciler.reconcileRecent()).catch((err: any) => {
                this.logger.warn(
                  `CC queue_log reconcile after AMI reconnect failed: ${err?.message || err}`,
                );
              });
            }
          }, 1500);
        }
      });

      this.ami.on('close', () => {
        this.connected = false;
        this.publishInternal({ event: 'DashboardConnection', connected: false });
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

      // QueueCallerLeave — caller left queue (timeout / redirect / hangup)
      this.ami.on('queuecallerleave', (evt: any) => {
        this.getCcAmiService()?.handleCallerLeave?.(evt);
      });

      // QueueCallerAbandon — caller abandoned queue
      this.ami.on('queuecallerabandon', (evt: any) => {
        this.getCcAmiService()?.handleCallerAbandon(evt);
      });

      // AgentCalled — queue offered a call to a member (phone ringing).
      // Required so RINGING is visible for RONA / missed_count on later Abandon/RNA.
      this.ami.on('agentcalled', (evt: any) => {
        this.getCcAmiService()?.handleAgentCalled?.(evt);
      });

      // AgentRingNoAnswer — member did not answer before queue ring timeout
      this.ami.on('agentringnoanswer', (evt: any) => {
        this.getCcAmiService()?.handleAgentRingNoAnswer?.(evt);
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

      this.ami.on('parkedcall', (evt: any) => {
        this.getCcAmiService()?.handleParkedCall(evt);
      });
      this.ami.on('unparkedcall', (evt: any) => {
        this.getCcAmiService()?.handleUnParkedCall(evt);
      });

      // ─── All-channel agent-scoped events (D-08) ─────────
      // These fire for ANY channel (not just queue-tracked calls) and let
      // CallCenterAmiService resolve tenant/agent by channel name, so
      // outbound/personal/internal calls are tracked without a queue.

      // DialBegin — a dial leg started on some channel (outbound/personal dial)
      this.ami.on('dialbegin', (evt: any) => {
        this.getCcAmiService()?.handleDialBegin(evt);
      });

      // DialEnd — a dial leg finished with a DialStatus (ANSWER/BUSY/NOANSWER/…)
      this.ami.on('dialend', (evt: any) => {
        this.getCcAmiService()?.handleDialEnd(evt);
      });

      // Newchannel (CC) — additional listener alongside the WebSocket forwarder
      // above; used only to detect a personal/direct inbound ring on an
      // agent's own channel.
      this.ami.on('newchannel', (evt: any) => {
        this.getCcAmiService()?.handleNewchannel(evt);
      });
      this.ami.on('chanspystart', (evt: any) => {
        this.getCcAmiService()?.handleMonitorConnected(evt);
      });
      this.ami.on('bridgeenter', (evt: any) => {
        this.getCcAmiService()?.handlePickupBridgeEnter?.(evt);
      });
      this.ami.on('originateresponse', (evt: any) => {
        this.getCcAmiService()?.handlePickupOriginateResponse?.(evt);
      });

      // Hangup (CC) — additional listener alongside the WebSocket forwarder
      // above; releases DIALING/personal-ring/personal-call agent state that
      // AgentComplete never sees because it isn't queue-driven.
      this.ami.on('hangup', (evt: any) => {
        this.getCcAmiService()?.handleAgentHangup(evt);
      });

      // ─── BLF presence (D-36/D-37) ────────────────────────
      // DeviceState/ExtensionState are independent of the queue/agent-channel
      // events above; CallCenterPresenceService debounces and re-emits them
      // as presenceUpdate SSE deltas (D-45).
      this.ami.on('devicestatechange', (evt: any) => {
        this.getCcPresenceService()?.handleDeviceStateChange(evt);
      });

      this.ami.on('extensionstatus', (evt: any) => {
        this.getCcPresenceService()?.handleExtensionStatus(evt);
      });

      // ─── Conference ConfBridge events (D-34) ─────────────
      this.ami.on('confbridgejoin', (evt: any) => {
        this.getConferenceStateService()?.handleJoin(evt);
      });
      this.ami.on('confbridgeleave', (evt: any) => {
        this.getConferenceStateService()?.handleLeave(evt);
      });
      this.ami.on('confbridgetalking', (evt: any) => {
        this.getConferenceStateService()?.handleTalking(evt);
      });
      this.ami.on('confbridgemute', (evt: any) => {
        this.getConferenceStateService()?.handleMute(evt);
      });
      this.ami.on('confbridgeunmute', (evt: any) => {
        this.getConferenceStateService()?.handleUnmute(evt);
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

  /**
   * Resolves when AMI is up, or rejects after timeoutMs.
   * Bootstrap hooks that need GetConfig/UpdateConfig must wait — connect() is
   * async from onModuleInit and often finishes after OnApplicationBootstrap.
   */
  waitUntilConnected(timeoutMs = 30_000): Promise<void> {
    if (this.connected) return Promise.resolve();
    if (this.destroyed) {
      return Promise.reject(new Error('AMI service destroyed'));
    }
    if (!this.config.get('AMI_SECRET', '')) {
      return Promise.reject(new Error('AMI_SECRET not configured'));
    }

    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (err?: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        unsubscribe();
        if (err) reject(err);
        else resolve();
      };

      const unsubscribe = this.subscribeInternalEvents((event) => {
        if (event?.event === 'DashboardConnection' && event.connected === true) {
          finish();
        }
      });

      const timer = setTimeout(() => {
        finish(new Error(`AMI not connected within ${timeoutMs}ms`));
      }, timeoutMs);

      // connect() may have raced ahead of the subscription
      if (this.connected) finish();
    });
  }

  // --- AMI Commands ---

  async action(action: Record<string, any>): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.connected) {
        reject(new Error('AMI not connected'));
        return;
      }
      this.ami.action(action, (err: any, res: any) => {
        const reply = res ?? (typeof err === 'object' ? err : undefined);
        const status = String(reply?.response ?? reply?.Response ?? '').toLowerCase();
        if (status === 'error') { reject(reply); return; }
        if (err) {
          // asterisk-manager bug: some actions (e.g. UpdateConfig) pass
          // the success response as err instead of res
          // Asterisk 16 CLI commands use Response:Follows. The manager puts
          // that valid response in its error slot; other AMI actions must not
          // gain a blanket Follows exception.
          if (status === 'success' || (String(action.action ?? action.Action).toLowerCase() === 'command' && status === 'follows')) {
            resolve(reply);
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

  async originate(
    channel: string,
    callerid: string,
    context: string,
    exten: string,
    priority = '1',
    variable?: string,
  ): Promise<any> {
    return this.action({
      action: 'Originate',
      channel,
      callerid,
      context,
      exten,
      priority,
      async: 'true',
      ...(variable ? { variable } : {}),
    });
  }

  async hangup(channel: string): Promise<any> {
    return this.action({ action: 'Hangup', channel });
  }

  /**
   * Send an in-call DTMF digit on a live channel (Phase 10 D-32 / SIP softphone).
   * [ASSUMED — A1] PlayDTMF params `channel`/`digit` (no Duration) — verify on live
   * Asterisk during 10-09 checkpoint.
   */
  async playDtmf(channel: string, digit: string, receive = false): Promise<any> {
    return this.action({ action: 'PlayDTMF', channel, digit, ...(receive ? { receive: 'true' } : {}) });
  }

  /**
   * List all active channels via CoreShowChannels.
   * CoreShowChannels is an event-list action (Phase 9 D-27/D-28 zombie-call
   * reconciler): it resolves immediately with Success, then Asterisk emits
   * individual CoreShowChannel events, ending with CoreShowChannelsComplete —
   * same actionid/rawevent collection shape as pjsipShowRegistrations() above.
   * [ASSUMED — event/field names verified against asterisk-manager's general
   * lowercasing behavior, not a live Asterisk instance; see 09-RESEARCH.md
   * Environment Availability / 09-VALIDATION manual check.]
   */
  async getActiveChannels(): Promise<{ events: any[]; complete: boolean }> {
    return this.collectCompleteList('CoreShowChannels', ['coreshowchannel'], 'coreshowchannelscomplete');
  }

  /** Bulk inventory for the dashboard collector; no individual endpoint actions. */
  async collectDashboardEndpoints(signal?: AbortSignal): Promise<{ events: any[]; complete: boolean }> {
    return this.collectCompleteList('PJSIPShowEndpoints', ['endpointlist'], 'endpointlistcomplete', this.dashboardInventoryTimeout(), signal);
  }
  async collectDashboardContacts(signal?: AbortSignal): Promise<{ events: any[]; complete: boolean }> {
    return this.collectCompleteList('PJSIPShowContacts', ['contactlist'], 'contactlistcomplete', this.dashboardInventoryTimeout(), signal);
  }
  async collectDashboardRegistrations(signal?: AbortSignal): Promise<{ events: any[]; complete: boolean }> {
    return this.collectCompleteList('PJSIPShowRegistrationsOutbound', ['outboundregistrationdetail'], 'outboundregistrationdetailcomplete', this.dashboardInventoryTimeout(), signal);
  }
  private dashboardInventoryTimeout(): number {
    const configured = Number(this.config.get('DASHBOARD_AMI_INVENTORY_TIMEOUT_MS', 120000));
    return Number.isFinite(configured) ? Math.max(15000, Math.min(180000, configured)) : 120000;
  }

  private async collectCompleteList(action: string, rows: string[], completion: string, timeoutMs = 15000, signal?: AbortSignal): Promise<{ events: any[]; complete: boolean }> {
    if (signal?.aborted) return { events: [], complete: false };
    if (!this.connected || !this.ami) throw new Error('AMI not connected');
    const manager = this.ami;
    const actionId = `dashboard-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return new Promise((resolve, reject) => {
      const events: any[] = []; let settled = false;
      const finish = (complete: boolean, error?: any) => {
        if (settled) return;
        settled = true; clearTimeout(timer);
        manager.removeListener('rawevent', handler); manager.removeListener('close', closed);
        signal?.removeEventListener('abort', aborted);
        if (error) reject(error); else resolve({ events, complete });
      };
      const handler = (event: any) => {
        if (event.actionid !== actionId) return;
        const name = String(event.event || '').toLowerCase();
        if (name === completion) { finish(true); return; }
        if (rows.includes(name)) {
          if (events.length >= 100000) { finish(false); return; }
          events.push(event);
        }
      };
      const closed = () => finish(false); const aborted = () => finish(false);
      const timer = setTimeout(() => finish(false), timeoutMs);
      manager.on('rawevent', handler); manager.on('close', closed);
      signal?.addEventListener('abort', aborted, { once: true });
      if (signal?.aborted) { finish(false); return; }
      try {
        manager.action({ action, actionid: actionId }, (error: any, response: any) => {
          // Asterisk22 returns this terminal empty marker (without ContactListComplete)
          // for static-only AoRs: ShowContacts enumerates dynamic Sorcery contacts.
          // Only this exact action/response with no observed rows proves an empty list.
          const reply = response?.response === 'Error' ? response : error;
          if (action === 'PJSIPShowContacts' && !events.length && reply?.response === 'Error' && String(reply.message || '').trim() === 'No Contacts found') finish(true);
          else if (error && error.response !== 'Success') finish(false, error);
          else if (response?.response === 'Error') finish(false, new Error(response.message || `${action} rejected`));
        });
      } catch (error) { finish(false, error); }
    });
  }

  async getPeerStatus(peer: string): Promise<any> {
    return this.action({ action: 'SIPpeerstatus', peer });
  }

  /**
   * List ConfBridge members for one conference (CR-02 reconcile).
   * ConfbridgeList is an event-list action: ack, then ConfbridgeList rows,
   * then ConfbridgeListComplete — same rawevent shape as CoreShowChannels.
   */
  async confbridgeList(conference: string): Promise<{ events: any[] }> {
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
        clearTimeout(timer);
        this.ami.removeListener('rawevent', handler);
        resolve({ events });
      };

      const handler = (evt: any) => {
        if (evt.actionid !== actionId) return;
        if (evt.event === 'ConfbridgeList') {
          events.push(evt);
        }
        if (evt.event === 'ConfbridgeListComplete') {
          finish();
        }
      };

      this.ami.on('rawevent', handler);

      const timer = setTimeout(finish, 5000);

      this.ami.action(
        { action: 'ConfbridgeList', conference, actionid: actionId },
        (err: any, _res: any) => {
          if (!err) return;
          // asterisk-manager may surface Success as err
          if (err.response === 'Success') return;
          clearTimeout(timer);
          settled = true;
          this.ami.removeListener('rawevent', handler);
          const msg = String(err.message || err.response || '').toLowerCase();
          if (err.response === 'Error' || msg.includes('not found') || msg.includes('no such')) {
            resolve({ events: [] });
            return;
          }
          reject(err);
        },
      );
    });
  }

  // --- Call Control (D-28: park/retrieve, ConfBridge, device presence) ---

  /** Park a channel into the (optional) named parking lot. */
  async park(channel: string, parkingLot?: string, timeoutChannel?: string): Promise<any> {
    const params: any = { action: 'Park', channel };
    if (parkingLot) params.parkinglot = parkingLot;
    if (timeoutChannel) params.timeoutchannel = timeoutChannel;
    return this.action(params);
  }

  /**
   * List currently parked calls (Phase 9 D-28, ParkedCallsIndicator - 09-10).
   * Like CoreShowChannels/PJSIPShowRegistrationsOutbound, ParkedCalls is an
   * event-list action: it resolves immediately with an ack, then Asterisk
   * emits one ParkedCall event per parked call, ending with
   * ParkedCallsComplete. The original wrapper here only awaited the ack and
   * could never have returned the actual list - same defect class already
   * fixed for getActiveChannels() in 09-07 (Rule 1, in-scope: this plan's
   * ParkedCallsIndicator needs a working list right now).
   * [ASSUMED - exact ParkedCall event field names not verified against a
   * live Asterisk instance; flagged for 09-VALIDATION like the other D-28
   * AMI field-name assumptions.]
   */
  async parkedCalls(): Promise<{ events: any[] }> {
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
        clearTimeout(timer);
        this.ami.removeListener('rawevent', handler);
        resolve({ events });
      };

      const handler = (evt: any) => {
        if (evt.actionid !== actionId) return;
        if (evt.event === 'ParkedCall') {
          events.push(evt);
        }
        if (evt.event === 'ParkedCallsComplete') {
          finish();
        }
      };

      this.ami.on('rawevent', handler);

      const timer = setTimeout(finish, 5000);

      this.ami.action(
        { action: 'ParkedCalls', actionid: actionId },
        (err: any, _res: any) => {
          if (err) {
            clearTimeout(timer);
            settled = true;
            this.ami.removeListener('rawevent', handler);
            reject(err);
          }
        },
      );
    });
  }

  /**
   * Query full device presence/BLF snapshot (D-36/D-37 / SIP softphone D-35).
   * DeviceStateList resolves with Success, then Asterisk emits DeviceStateChange
   * events ending with DeviceStateListComplete — same rawevent collection shape
   * as ParkedCalls / CoreShowChannels.
   */
  async collectDeviceStateList(): Promise<{ events: any[] }> {
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
        clearTimeout(timer);
        this.ami.removeListener('rawevent', handler);
        resolve({ events });
      };

      const handler = (evt: any) => {
        const eventName = String(evt.event || '').toLowerCase();
        // Prefer ActionID match; accept events without ActionID during the window
        // (some Asterisk builds omit it on intermediate DeviceStateChange rows).
        if (evt.actionid && evt.actionid !== actionId) return;
        if (eventName === 'devicestatechange') {
          events.push(evt);
        }
        if (eventName === 'devicestatelistcomplete') {
          finish();
        }
      };

      this.ami.on('rawevent', handler);

      const timer = setTimeout(finish, 5000);

      this.ami.action(
        { action: 'DeviceStateList', actionid: actionId },
        (err: any, _res: any) => {
          if (err && err.response !== 'Success') {
            clearTimeout(timer);
            settled = true;
            this.ami.removeListener('rawevent', handler);
            reject(err);
          }
        },
      );
    });
  }

  /** Fire-and-forget DeviceStateList (legacy callers / warm-up). */
  async deviceStateList(): Promise<any> {
    return this.collectDeviceStateList();
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

  /**
   * Collect QueueMember rows until QueueStatusComplete (no fixed sleep).
   * `complete` is false only when the action timed out — callers must not
   * treat an empty list as "agent is in no queues" in that case.
   */
  async collectQueueMembers(queue?: string): Promise<{ members: any[]; complete: boolean }> {
    return new Promise((resolve, reject) => {
      if (!this.connected) {
        reject(new Error('AMI not connected'));
        return;
      }

      const members: any[] = [];
      const actionId = String(Date.now()) + String(Math.random()).slice(2, 6);
      let settled = false;
      let complete = false;

      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.ami.removeListener('rawevent', handler);
        resolve({ members, complete });
      };

      const handler = (evt: any) => {
        const eventName = String(evt.event || '').toLowerCase();
        if (evt.actionid && evt.actionid !== actionId) return;
        if (eventName === 'queuemember') {
          members.push(evt);
        }
        if (eventName === 'queuestatuscomplete') {
          complete = true;
          finish();
        }
      };

      this.ami.on('rawevent', handler);
      const timer = setTimeout(finish, 5000);

      const params: Record<string, string> = { action: 'QueueStatus', actionid: actionId };
      if (queue) params.queue = queue;
      this.ami.action(params, (err: any) => {
        if (err && err.response !== 'Success') {
          clearTimeout(timer);
          settled = true;
          this.ami.removeListener('rawevent', handler);
          reject(err);
        }
      });
    });
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

  private readonly guardedRegistrationManagers = new WeakSet<object>();
  private readonly registrationActionGuards = new WeakMap<object, () => boolean>();

  /** The manager replays held actions through its public action method after login. */
  private guardRegistrationReplay(manager: any): void {
    if (this.guardedRegistrationManagers.has(manager)) return;
    this.guardedRegistrationManagers.add(manager);
    const originalAction = manager.action.bind(manager);
    manager.action = (action: Record<string, any>, callback: any) => {
      const allowed = this.registrationActionGuards.get(callback);
      if (allowed && !allowed()) {
        callback(new Error('AMI registration request expired or disconnected'));
        return action.actionid;
      }
      return originalAction(action, callback);
    };
  }

  /** Register a specific outbound registration by name */
  async pjsipRegister(registrationName: string): Promise<any> {
    if (!/^[a-zA-Z0-9_.-]+$/.test(registrationName) || registrationName.length > 255) {
      throw new Error('Invalid registration identifier');
    }
    if (!this.connected || !this.ami) throw new Error('AMI not connected');
    const manager = this.ami;
    if (!manager.isConnected()) throw new Error('AMI not connected');
    this.guardRegistrationReplay(manager);
    const actionId = `register-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const deadline = Date.now() + 5000;
    return new Promise((resolve, reject) => {
      let settled = false;
      let responseActionId = actionId;
      let pingActionId = `${actionId}-ready`;
      const finish = (error?: Error, response?: any) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        manager.removeListener('close', closed);
        manager.removeListener(responseActionId, callback);
        manager.removeListener(pingActionId, ready);
        if (error) reject(error); else resolve(response);
      };
      const closed = () => finish(new Error('AMI disconnected during registration request'));
      const timer = setTimeout(() => finish(new Error('AMI registration timeout')), 5000);
      const callback = (error: any, response: any) => {
        if (Date.now() >= deadline) { finish(new Error('AMI registration timeout')); return; }
        // Some asterisk-manager versions put a Success response in the error slot.
        const reply = response ?? error;
        if (String(reply?.response ?? reply?.Response ?? '').toLowerCase() === 'success') finish(undefined, reply);
        else finish(new Error('AMI registration request rejected'));
      };
      const ready = (error: any, response: any) => {
        if (settled) return;
        if (Date.now() >= deadline) { finish(new Error('AMI registration timeout')); return; }
        manager.removeListener(pingActionId, ready);
        const reply = response ?? error;
        if (String(reply?.response ?? reply?.Response ?? '').toLowerCase() !== 'success') {
          finish(new Error('AMI not connected or authenticated')); return;
        }
        if (manager !== this.ami || !manager.isConnected()) { finish(new Error('AMI not connected')); return; }
        try {
          responseActionId = manager.action({ action: 'PJSIPRegister', registration: registrationName, actionid: actionId }, callback) || actionId;
        } catch { finish(new Error('AMI registration request rejected')); }
      };
      // Callback identity survives asterisk-manager's private holding queue. Even if
      // a synchronous write failure queues REGISTER, its replay after timeout is denied.
      this.registrationActionGuards.set(callback, () => !settled && Date.now() < deadline && manager === this.ami && manager.isConnected());
      manager.on('close', closed);
      try {
        // Ping is read-only and held until the manager is authenticated. Never queue
        // a mutation while login is pending; a late Ping cannot start expired work.
        pingActionId = manager.action({ action: 'Ping', actionid: pingActionId }, ready) || pingActionId;
      } catch { finish(new Error('AMI registration request rejected')); }
    });
  }

  /** Unregister a specific outbound registration by name */
  async pjsipUnregister(registrationName: string): Promise<any> {
    return this.action({ action: 'PJSIPUnregister', registration: registrationName });
  }

  /**
   * Live PJSIP endpoint reachability via PJSIPShowEndpoint (same truth as
   * `pjsip show contacts` / Contact Avail). DeviceState alone is often stale
   * or never seeded for endpoints without BLF hints — D-35 Recover needs this.
   * Returns true if any contact is Reachable/Avail, false if endpoint has no
   * reachable contact, null if AMI could not answer.
   */
  async isPjsipEndpointReachable(endpointId: string): Promise<boolean | null> {
    try {
      const { events } = await this.pjsipShowEndpoint(endpointId);
      if (!events.length) return null;

      const contacts = events.filter((evt) => {
        const name = String(evt.event || '').toLowerCase();
        return name === 'contactstatusdetail' || name === 'contactlist';
      });

      if (contacts.length > 0) {
        return contacts.some((evt) => {
          const status = String(evt.status || evt.Status || '').toLowerCase();
          return status === 'reachable' || status === 'avail' || status === 'created';
        });
      }

      // No ContactStatusDetail rows — fall back to EndpointDetail.DeviceState.
      const detail = events.find((evt) => {
        const name = String(evt.event || '').toLowerCase();
        return name === 'endpointdetail';
      });
      if (!detail) return null;
      const deviceState = String(
        detail.devicestate || detail.DeviceState || detail.state || detail.State || '',
      ).trim();
      if (!deviceState) return null;
      return !/^(unavailable|invalid|unknown|nonexistent)$/i.test(deviceState);
    } catch {
      return null;
    }
  }

  /**
   * PJSIPShowEndpoint event-list: EndpointDetail (+ ContactStatusDetail…) then
   * EndpointDetailComplete — used for SIP softphone registration badge (D-35).
   */
  async pjsipShowEndpoint(endpointId: string): Promise<{ events: any[]; complete: boolean }> {
    if (!/^[a-zA-Z0-9_.-]+$/.test(endpointId) || endpointId.length > 255) throw new Error('Invalid endpoint identifier');
    return this.collectTrunkList({ action: 'PJSIPShowEndpoint', endpoint: endpointId },
      ['endpointdetail', 'contactstatusdetail', 'contactlist', 'authdetail', 'aordetail', 'transportdetail', 'identifydetail'], 'endpointdetailcomplete');
  }

  /**
   * List all outbound PJSIP registrations and their statuses.
   * PJSIPShowRegistrationsOutbound is an event-list command:
   * it returns Success immediately, then sends individual
   * OutboundRegistrationDetail events, ending with
   * OutboundRegistrationDetailComplete.
   */
  async pjsipShowRegistrations(): Promise<{ events: any[]; complete: boolean }> {
    return this.collectTrunkList({ action: 'PJSIPShowRegistrationsOutbound' }, ['outboundregistrationdetail'], 'outboundregistrationdetailcomplete');
  }

  /** Trunk lists reject incomplete snapshots rather than presenting a partial status as current. */
  private collectTrunkList(action: Record<string, string>, rows: string[], completion: string): Promise<{ events: any[]; complete: boolean }> {
    if (!this.connected || !this.ami) return Promise.reject(new Error('AMI not connected'));
    const manager = this.ami;
    const actionId = `trunk-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return new Promise((resolve, reject) => {
      const events: any[] = [];
      let settled = false;
      let responseActionId = actionId;
      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        manager.removeListener('rawevent', handler);
        manager.removeListener('close', closed);
        manager.removeListener(responseActionId, callback);
        if (error) reject(error); else resolve({ events, complete: true });
      };
      const handler = (event: any) => {
        if ((event.actionid ?? event.ActionID) !== actionId) return;
        const name = String(event.event ?? event.Event ?? '').toLowerCase();
        if (name === completion) { finish(); return; }
        if (rows.includes(name)) {
          if (events.length >= 100000) { finish(new Error('AMI trunk list overflow')); return; }
          events.push(event);
        }
      };
      const closed = () => finish(new Error('AMI disconnected during trunk list'));
      const timer = setTimeout(() => finish(new Error('AMI trunk list timeout')), 5000);
      const callback = (error: any, response: any) => {
        if (error && String(error.response ?? error.Response ?? '').toLowerCase() !== 'success') finish(new Error('AMI trunk list rejected'));
        else if (String(response?.response ?? response?.Response ?? '').toLowerCase() === 'error') finish(new Error('AMI trunk list rejected'));
      };
      manager.on('rawevent', handler);
      manager.on('close', closed);
      try {
        responseActionId = manager.action({ ...action, actionid: actionId }, callback) || actionId;
      } catch { finish(new Error('AMI trunk list rejected')); }
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
