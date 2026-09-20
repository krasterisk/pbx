"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var AmiService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AmiService = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const config_1 = require("@nestjs/config");
const ami_gateway_1 = require("./ami.gateway");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const AsteriskManager = require('asterisk-manager');
let AmiService = AmiService_1 = class AmiService {
    config;
    gateway;
    moduleRef;
    logger = new common_1.Logger(AmiService_1.name);
    ami;
    connected = false;
    connecting = false;
    reconnectTimer = null;
    reconnectDelay = 5000; // starts at 5s
    MAX_RECONNECT_DELAY = 60000; // max 60s
    BASE_RECONNECT_DELAY = 5000;
    destroyed = false;
    /** True after the first successful AMI connect — used to detect reconnects. */
    hasConnectedOnce = false;
    constructor(config, gateway, moduleRef) {
        this.config = config;
        this.gateway = gateway;
        this.moduleRef = moduleRef;
    }
    warnedMissingWebhooks = false;
    warnedMissingCcAmi = false;
    warnedMissingCcReconciler = false;
    warnedMissingCcPresence = false;
    warnedMissingConferenceState = false;
    /** Lazily resolve DialplanWebhooksService to avoid circular module dependency. */
    getWebhooksService() {
        try {
            // strict: false searches all modules, not just AmiModule's own providers
            return this.moduleRef.get('DialplanWebhooksService', { strict: false });
        }
        catch {
            if (!this.warnedMissingWebhooks) {
                this.warnedMissingWebhooks = true;
                this.logger.warn('DialplanWebhooksService not resolvable via ModuleRef — AMI webhooks disabled');
            }
            return null;
        }
    }
    /** Lazily resolve CallCenterAmiService to avoid circular module dependency. */
    getCcAmiService() {
        try {
            return this.moduleRef.get('CallCenterAmiService', { strict: false });
        }
        catch {
            if (!this.warnedMissingCcAmi) {
                this.warnedMissingCcAmi = true;
                this.logger.warn('CallCenterAmiService not resolvable via ModuleRef — queue SSE state disabled');
            }
            return null;
        }
    }
    /** Lazily resolve CallCenterPresenceService to avoid circular module dependency. */
    getCcPresenceService() {
        try {
            return this.moduleRef.get('CallCenterPresenceService', { strict: false });
        }
        catch {
            if (!this.warnedMissingCcPresence) {
                this.warnedMissingCcPresence = true;
                this.logger.warn('CallCenterPresenceService not resolvable via ModuleRef — BLF presence disabled');
            }
            return null;
        }
    }
    /** Lazily resolve ConferenceStateService to avoid circular module dependency. */
    getConferenceStateService() {
        try {
            return this.moduleRef.get('ConferenceStateService', { strict: false });
        }
        catch {
            if (!this.warnedMissingConferenceState) {
                this.warnedMissingConferenceState = true;
                this.logger.warn('ConferenceStateService not resolvable via ModuleRef — conference live state disabled');
            }
            return null;
        }
    }
    /** Lazily resolve queue_log reconciler (D-05 backfill on AMI reconnect). */
    getCcReconcilerService() {
        try {
            return this.moduleRef.get('CallCenterQueueLogReconcilerService', { strict: false });
        }
        catch {
            if (!this.warnedMissingCcReconciler) {
                this.warnedMissingCcReconciler = true;
                this.logger.warn('CallCenterQueueLogReconcilerService not resolvable via ModuleRef — reconcile disabled');
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
    cancelReconnect() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
    }
    scheduleReconnect() {
        if (this.destroyed)
            return;
        this.cancelReconnect();
        this.logger.warn(`AMI connection closed, reconnecting in ${this.reconnectDelay / 1000}s...`);
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.connect();
        }, this.reconnectDelay);
        // Exponential backoff: 5s → 10s → 20s → 40s → 60s (cap)
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.MAX_RECONNECT_DELAY);
    }
    cleanupAmi() {
        if (this.ami) {
            try {
                this.ami.removeAllListeners();
                this.ami.disconnect();
            }
            catch {
                // ignore cleanup errors
            }
            this.ami = null;
        }
        this.connected = false;
        this.connecting = false;
    }
    connect() {
        if (this.destroyed || this.connecting)
            return;
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
                const wasReconnect = this.hasConnectedOnce;
                this.hasConnectedOnce = true;
                // Seed BLF / SIP registration presence cache (DeviceStateChange only fires
                // on transitions otherwise — softphone badge stays red forever).
                setTimeout(() => {
                    void this.collectDeviceStateList()
                        .then(({ events }) => {
                        const presence = this.getCcPresenceService();
                        if (!presence)
                            return;
                        for (const evt of events) {
                            presence.handleDeviceStateChange(evt);
                        }
                    })
                        .catch((err) => {
                        this.logger.warn(`DeviceStateList presence seed failed: ${err?.message || err}`);
                    });
                }, wasReconnect ? 1500 : 500);
                // On reconnect only: resync in-memory CC state (first connect is handled by
                // CallCenterAmiService.onModuleInit → initialize → loadInitialState).
                if (wasReconnect) {
                    setTimeout(() => {
                        const ccAmi = this.getCcAmiService();
                        if (ccAmi?.loadInitialState) {
                            Promise.resolve(ccAmi.loadInitialState()).catch((err) => {
                                this.logger.warn(`CC state resync after AMI reconnect failed: ${err?.message || err}`);
                            });
                        }
                        // D-05: backfill cc_queue_calls gaps from Asterisk queue_log
                        const reconciler = this.getCcReconcilerService();
                        if (reconciler?.reconcileRecent) {
                            Promise.resolve(reconciler.reconcileRecent()).catch((err) => {
                                this.logger.warn(`CC queue_log reconcile after AMI reconnect failed: ${err?.message || err}`);
                            });
                        }
                    }, 1500);
                }
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
            this.ami.on('error', (err) => {
                this.logger.error(`AMI error: ${err.message}`);
                // error alone doesn't trigger reconnect; the subsequent 'close' event will
            });
            // Real-time events → WebSocket
            this.ami.on('peerstatus', (evt) => {
                this.gateway.emitPeerStatus({
                    peer: evt.peer,
                    status: evt.peerstatus,
                    address: evt.address || '',
                });
            });
            this.ami.on('queuememberstatus', (evt) => {
                this.gateway.emitAgentStatus({
                    queue: evt.queue,
                    member: evt.membername || evt.interface,
                    status: evt.status,
                    paused: evt.paused,
                    callsTaken: evt.callstaken,
                });
            });
            this.ami.on('newchannel', (evt) => {
                this.gateway.emitNewChannel({
                    channel: evt.channel,
                    calleridnum: evt.calleridnum,
                    calleridname: evt.calleridname,
                    exten: evt.exten,
                    context: evt.context,
                    uniqueid: evt.uniqueid,
                });
            });
            this.ami.on('hangup', (evt) => {
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
            this.ami.on('agentconnect', async (evt) => {
                try {
                    const webhooksService = this.getWebhooksService();
                    if (!webhooksService)
                        return;
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
                }
                catch (err) {
                    this.logger.warn(`AgentConnect webhook error: ${err?.message}`);
                }
            });
            // ─── Call Center module event forwarding ───────────────
            // Forward AMI events to CallCenterAmiService for real-time state tracking.
            // Uses lazy ModuleRef resolution (same pattern as webhooks) to avoid circular deps.
            // QueueMemberStatus — agent status changes in queue
            this.ami.on('queuememberstatus', (evt) => {
                this.getCcAmiService()?.handleAgentStatusEvent(evt);
            });
            // QueueMemberAdded — agent dynamically added to queue
            this.ami.on('queuememberadded', (evt) => {
                this.getCcAmiService()?.handleMemberAdded(evt);
            });
            // QueueMemberRemoved — agent removed from queue
            this.ami.on('queuememberremoved', (evt) => {
                this.getCcAmiService()?.handleMemberRemoved(evt);
            });
            // QueueMemberPause — agent pause/unpause
            this.ami.on('queuememberpause', (evt) => {
                this.getCcAmiService()?.handleAgentStatusEvent(evt);
            });
            // QueueCallerJoin — caller entered queue
            this.ami.on('queuecallerjoin', (evt) => {
                this.getCcAmiService()?.handleCallerJoin(evt);
            });
            // QueueCallerLeave — caller left queue (timeout / redirect / hangup)
            this.ami.on('queuecallerleave', (evt) => {
                this.getCcAmiService()?.handleCallerLeave?.(evt);
            });
            // QueueCallerAbandon — caller abandoned queue
            this.ami.on('queuecallerabandon', (evt) => {
                this.getCcAmiService()?.handleCallerAbandon(evt);
            });
            // AgentCalled — queue offered a call to a member (phone ringing).
            // Required so RINGING is visible for RONA / missed_count on later Abandon/RNA.
            this.ami.on('agentcalled', (evt) => {
                this.getCcAmiService()?.handleAgentCalled?.(evt);
            });
            // AgentRingNoAnswer — member did not answer before queue ring timeout
            this.ami.on('agentringnoanswer', (evt) => {
                this.getCcAmiService()?.handleAgentRingNoAnswer?.(evt);
            });
            // AgentConnect — agent answered a queued call (also used by webhooks above)
            this.ami.on('agentconnect', (evt) => {
                this.getCcAmiService()?.handleAgentConnect(evt);
            });
            // AgentComplete — call ended after agent answered
            this.ami.on('agentcomplete', (evt) => {
                this.getCcAmiService()?.handleAgentComplete(evt);
            });
            // Hold / Unhold — channel placed on/off hold
            this.ami.on('hold', (evt) => {
                this.getCcAmiService()?.handleHold(evt);
            });
            this.ami.on('unhold', (evt) => {
                this.getCcAmiService()?.handleUnhold(evt);
            });
            // ─── All-channel agent-scoped events (D-08) ─────────
            // These fire for ANY channel (not just queue-tracked calls) and let
            // CallCenterAmiService resolve tenant/agent by channel name, so
            // outbound/personal/internal calls are tracked without a queue.
            // DialBegin — a dial leg started on some channel (outbound/personal dial)
            this.ami.on('dialbegin', (evt) => {
                this.getCcAmiService()?.handleDialBegin(evt);
            });
            // DialEnd — a dial leg finished with a DialStatus (ANSWER/BUSY/NOANSWER/…)
            this.ami.on('dialend', (evt) => {
                this.getCcAmiService()?.handleDialEnd(evt);
            });
            // Newchannel (CC) — additional listener alongside the WebSocket forwarder
            // above; used only to detect a personal/direct inbound ring on an
            // agent's own channel.
            this.ami.on('newchannel', (evt) => {
                this.getCcAmiService()?.handleNewchannel(evt);
            });
            // Hangup (CC) — additional listener alongside the WebSocket forwarder
            // above; releases DIALING/personal-ring/personal-call agent state that
            // AgentComplete never sees because it isn't queue-driven.
            this.ami.on('hangup', (evt) => {
                this.getCcAmiService()?.handleAgentHangup(evt);
            });
            // ─── BLF presence (D-36/D-37) ────────────────────────
            // DeviceState/ExtensionState are independent of the queue/agent-channel
            // events above; CallCenterPresenceService debounces and re-emits them
            // as presenceUpdate SSE deltas (D-45).
            this.ami.on('devicestatechange', (evt) => {
                this.getCcPresenceService()?.handleDeviceStateChange(evt);
            });
            this.ami.on('extensionstatus', (evt) => {
                this.getCcPresenceService()?.handleExtensionStatus(evt);
            });
            // ─── Conference ConfBridge events (D-34) ─────────────
            this.ami.on('confbridgejoin', (evt) => {
                this.getConferenceStateService()?.handleJoin(evt);
            });
            this.ami.on('confbridgeleave', (evt) => {
                this.getConferenceStateService()?.handleLeave(evt);
            });
            this.ami.on('confbridgetalking', (evt) => {
                this.getConferenceStateService()?.handleTalking(evt);
            });
            this.ami.on('confbridgemute', (evt) => {
                this.getConferenceStateService()?.handleMute(evt);
            });
            this.ami.on('confbridgeunmute', (evt) => {
                this.getConferenceStateService()?.handleUnmute(evt);
            });
            // Reconnection is now managed manually via scheduleReconnect() with exponential backoff.
        }
        catch (error) {
            this.connecting = false;
            this.logger.error(`Failed to connect to AMI: ${error}`);
            this.scheduleReconnect();
        }
    }
    disconnect() {
        this.cancelReconnect();
        this.cleanupAmi();
    }
    isConnected() {
        return this.connected;
    }
    // --- AMI Commands ---
    async action(action) {
        return new Promise((resolve, reject) => {
            if (!this.connected) {
                reject(new Error('AMI not connected'));
                return;
            }
            this.ami.action(action, (err, res) => {
                if (err) {
                    // asterisk-manager bug: some actions (e.g. UpdateConfig) pass
                    // the success response as err instead of res
                    if (err.response === 'Success') {
                        resolve(err);
                    }
                    else {
                        reject(err);
                    }
                }
                else {
                    resolve(res);
                }
            });
        });
    }
    async sipReload() {
        return this.action({ action: 'Command', command: 'sip reload' });
    }
    async pjsipReload() {
        return this.action({ action: 'Command', command: 'pjsip reload' });
    }
    async originate(channel, callerid, context, exten, priority = '1') {
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
    async hangup(channel) {
        return this.action({ action: 'Hangup', channel });
    }
    /**
     * Send an in-call DTMF digit on a live channel (Phase 10 D-32 / SIP softphone).
     * [ASSUMED — A1] PlayDTMF params `channel`/`digit` (no Duration) — verify on live
     * Asterisk during 10-09 checkpoint.
     */
    async playDtmf(channel, digit) {
        return this.action({ action: 'PlayDTMF', channel, digit });
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
    async getActiveChannels() {
        return new Promise((resolve, reject) => {
            if (!this.connected) {
                reject(new Error('AMI not connected'));
                return;
            }
            const events = [];
            const actionId = String(Date.now()) + String(Math.random()).slice(2, 6);
            let settled = false;
            const finish = () => {
                if (settled)
                    return;
                settled = true;
                clearTimeout(timer);
                this.ami.removeListener('rawevent', handler);
                resolve({ events });
            };
            const handler = (evt) => {
                if (evt.actionid !== actionId)
                    return;
                if (evt.event === 'CoreShowChannel') {
                    events.push(evt);
                }
                if (evt.event === 'CoreShowChannelsComplete') {
                    finish();
                }
            };
            this.ami.on('rawevent', handler);
            const timer = setTimeout(finish, 5000);
            this.ami.action({ action: 'CoreShowChannels', actionid: actionId }, (err, _res) => {
                if (err) {
                    clearTimeout(timer);
                    settled = true;
                    this.ami.removeListener('rawevent', handler);
                    reject(err);
                }
            });
        });
    }
    async getPeerStatus(peer) {
        return this.action({ action: 'SIPpeerstatus', peer });
    }
    /**
     * List ConfBridge members for one conference (CR-02 reconcile).
     * ConfbridgeList is an event-list action: ack, then ConfbridgeList rows,
     * then ConfbridgeListComplete — same rawevent shape as CoreShowChannels.
     */
    async confbridgeList(conference) {
        return new Promise((resolve, reject) => {
            if (!this.connected) {
                reject(new Error('AMI not connected'));
                return;
            }
            const events = [];
            const actionId = String(Date.now()) + String(Math.random()).slice(2, 6);
            let settled = false;
            const finish = () => {
                if (settled)
                    return;
                settled = true;
                clearTimeout(timer);
                this.ami.removeListener('rawevent', handler);
                resolve({ events });
            };
            const handler = (evt) => {
                if (evt.actionid !== actionId)
                    return;
                if (evt.event === 'ConfbridgeList') {
                    events.push(evt);
                }
                if (evt.event === 'ConfbridgeListComplete') {
                    finish();
                }
            };
            this.ami.on('rawevent', handler);
            const timer = setTimeout(finish, 5000);
            this.ami.action({ action: 'ConfbridgeList', conference, actionid: actionId }, (err, _res) => {
                if (!err)
                    return;
                // asterisk-manager may surface Success as err
                if (err.response === 'Success')
                    return;
                clearTimeout(timer);
                settled = true;
                this.ami.removeListener('rawevent', handler);
                const msg = String(err.message || err.response || '').toLowerCase();
                if (err.response === 'Error' || msg.includes('not found') || msg.includes('no such')) {
                    resolve({ events: [] });
                    return;
                }
                reject(err);
            });
        });
    }
    // --- Call Control (D-28: park/retrieve, ConfBridge, device presence) ---
    /** Park a channel into the (optional) named parking lot. */
    async park(channel, parkingLot) {
        const params = { action: 'Park', channel };
        if (parkingLot)
            params.parkinglot = parkingLot;
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
    async parkedCalls() {
        return new Promise((resolve, reject) => {
            if (!this.connected) {
                reject(new Error('AMI not connected'));
                return;
            }
            const events = [];
            const actionId = String(Date.now()) + String(Math.random()).slice(2, 6);
            let settled = false;
            const finish = () => {
                if (settled)
                    return;
                settled = true;
                clearTimeout(timer);
                this.ami.removeListener('rawevent', handler);
                resolve({ events });
            };
            const handler = (evt) => {
                if (evt.actionid !== actionId)
                    return;
                if (evt.event === 'ParkedCall') {
                    events.push(evt);
                }
                if (evt.event === 'ParkedCallsComplete') {
                    finish();
                }
            };
            this.ami.on('rawevent', handler);
            const timer = setTimeout(finish, 5000);
            this.ami.action({ action: 'ParkedCalls', actionid: actionId }, (err, _res) => {
                if (err) {
                    clearTimeout(timer);
                    settled = true;
                    this.ami.removeListener('rawevent', handler);
                    reject(err);
                }
            });
        });
    }
    /**
     * Query full device presence/BLF snapshot (D-36/D-37 / SIP softphone D-35).
     * DeviceStateList resolves with Success, then Asterisk emits DeviceStateChange
     * events ending with DeviceStateListComplete — same rawevent collection shape
     * as ParkedCalls / CoreShowChannels.
     */
    async collectDeviceStateList() {
        return new Promise((resolve, reject) => {
            if (!this.connected) {
                reject(new Error('AMI not connected'));
                return;
            }
            const events = [];
            const actionId = String(Date.now()) + String(Math.random()).slice(2, 6);
            let settled = false;
            const finish = () => {
                if (settled)
                    return;
                settled = true;
                clearTimeout(timer);
                this.ami.removeListener('rawevent', handler);
                resolve({ events });
            };
            const handler = (evt) => {
                const eventName = String(evt.event || '').toLowerCase();
                // Prefer ActionID match; accept events without ActionID during the window
                // (some Asterisk builds omit it on intermediate DeviceStateChange rows).
                if (evt.actionid && evt.actionid !== actionId)
                    return;
                if (eventName === 'devicestatechange') {
                    events.push(evt);
                }
                if (eventName === 'devicestatelistcomplete') {
                    finish();
                }
            };
            this.ami.on('rawevent', handler);
            const timer = setTimeout(finish, 5000);
            this.ami.action({ action: 'DeviceStateList', actionid: actionId }, (err, _res) => {
                if (err && err.response !== 'Success') {
                    clearTimeout(timer);
                    settled = true;
                    this.ami.removeListener('rawevent', handler);
                    reject(err);
                }
            });
        });
    }
    /** Fire-and-forget DeviceStateList (legacy callers / warm-up). */
    async deviceStateList() {
        return this.collectDeviceStateList();
    }
    async queueAdd(queue, iface, penalty) {
        return this.action({
            action: 'QueueAdd',
            queue,
            interface: iface,
            penalty: penalty || 0,
        });
    }
    async queueRemove(queue, iface) {
        return this.action({
            action: 'QueueRemove',
            queue,
            interface: iface,
        });
    }
    async queuePause(queue, iface, paused, reason) {
        return this.action({
            action: 'QueuePause',
            queue,
            interface: iface,
            paused: paused ? 'true' : 'false',
            reason: reason || '',
        });
    }
    async queueStatus(queue) {
        const params = { action: 'QueueStatus' };
        if (queue)
            params.queue = queue;
        return this.action(params);
    }
    /**
     * Collect QueueMember rows until QueueStatusComplete (no fixed sleep).
     * `complete` is false only when the action timed out — callers must not
     * treat an empty list as "agent is in no queues" in that case.
     */
    async collectQueueMembers(queue) {
        return new Promise((resolve, reject) => {
            if (!this.connected) {
                reject(new Error('AMI not connected'));
                return;
            }
            const members = [];
            const actionId = String(Date.now()) + String(Math.random()).slice(2, 6);
            let settled = false;
            let complete = false;
            const finish = () => {
                if (settled)
                    return;
                settled = true;
                clearTimeout(timer);
                this.ami.removeListener('rawevent', handler);
                resolve({ members, complete });
            };
            const handler = (evt) => {
                const eventName = String(evt.event || '').toLowerCase();
                if (evt.actionid && evt.actionid !== actionId)
                    return;
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
            const params = { action: 'QueueStatus', actionid: actionId };
            if (queue)
                params.queue = queue;
            this.ami.action(params, (err) => {
                if (err && err.response !== 'Success') {
                    clearTimeout(timer);
                    settled = true;
                    this.ami.removeListener('rawevent', handler);
                    reject(err);
                }
            });
        });
    }
    async dbPut(family, key, val) {
        return this.action({ action: 'DBPut', family, key, val });
    }
    async dbGet(family, key) {
        return this.action({ action: 'DBGet', family, key });
    }
    async dbDel(family, key) {
        return this.action({ action: 'DBDel', family, key });
    }
    async command(cmd) {
        return this.action({ action: 'Command', command: cmd });
    }
    // --- Trunk Management (PJSIP Registration) ---
    /** Register a specific outbound registration by name */
    async pjsipRegister(registrationName) {
        return this.action({ action: 'PJSIPRegister', registration: registrationName });
    }
    /** Unregister a specific outbound registration by name */
    async pjsipUnregister(registrationName) {
        return this.action({ action: 'PJSIPUnregister', registration: registrationName });
    }
    /**
     * Live PJSIP endpoint reachability via PJSIPShowEndpoint (same truth as
     * `pjsip show contacts` / Contact Avail). DeviceState alone is often stale
     * or never seeded for endpoints without BLF hints — D-35 Recover needs this.
     * Returns true if any contact is Reachable/Avail, false if endpoint has no
     * reachable contact, null if AMI could not answer.
     */
    async isPjsipEndpointReachable(endpointId) {
        try {
            const { events } = await this.pjsipShowEndpoint(endpointId);
            if (!events.length)
                return null;
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
            if (!detail)
                return null;
            const deviceState = String(detail.devicestate || detail.DeviceState || detail.state || detail.State || '').trim();
            if (!deviceState)
                return null;
            return !/^(unavailable|invalid|unknown|nonexistent)$/i.test(deviceState);
        }
        catch {
            return null;
        }
    }
    /**
     * PJSIPShowEndpoint event-list: EndpointDetail (+ ContactStatusDetail…) then
     * EndpointDetailComplete — used for SIP softphone registration badge (D-35).
     */
    async pjsipShowEndpoint(endpointId) {
        return new Promise((resolve, reject) => {
            if (!this.connected) {
                reject(new Error('AMI not connected'));
                return;
            }
            const events = [];
            const actionId = String(Date.now()) + String(Math.random()).slice(2, 6);
            let settled = false;
            const finish = () => {
                if (settled)
                    return;
                settled = true;
                clearTimeout(timer);
                this.ami.removeListener('rawevent', handler);
                resolve({ events });
            };
            const handler = (evt) => {
                if (evt.actionid && evt.actionid !== actionId)
                    return;
                const eventName = String(evt.event || '').toLowerCase();
                if (eventName === 'endpointdetail'
                    || eventName === 'contactstatusdetail'
                    || eventName === 'contactlist'
                    || eventName === 'authdetail'
                    || eventName === 'aordetail'
                    || eventName === 'transportdetail'
                    || eventName === 'identifydetail') {
                    events.push(evt);
                }
                if (eventName === 'endpointdetailcomplete') {
                    finish();
                }
            };
            this.ami.on('rawevent', handler);
            const timer = setTimeout(finish, 5000);
            this.ami.action({ action: 'PJSIPShowEndpoint', endpoint: endpointId, actionid: actionId }, (err, _res) => {
                if (err && err.response !== 'Success') {
                    clearTimeout(timer);
                    settled = true;
                    this.ami.removeListener('rawevent', handler);
                    reject(err);
                }
            });
        });
    }
    /**
     * List all outbound PJSIP registrations and their statuses.
     * PJSIPShowRegistrationsOutbound is an event-list command:
     * it returns Success immediately, then sends individual
     * OutboundRegistrationDetail events, ending with
     * OutboundRegistrationDetailComplete.
     */
    async pjsipShowRegistrations() {
        return new Promise((resolve, reject) => {
            if (!this.connected) {
                reject(new Error('AMI not connected'));
                return;
            }
            const events = [];
            const actionId = String(Date.now()) + String(Math.random()).slice(2, 6);
            let settled = false;
            const finish = () => {
                if (settled)
                    return;
                settled = true;
                this.ami.removeListener('rawevent', handler);
                resolve({ events });
            };
            const handler = (evt) => {
                if (evt.actionid !== actionId)
                    return;
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
            this.ami.action({ action: 'PJSIPShowRegistrationsOutbound', actionid: actionId }, (err, _res) => {
                if (err) {
                    clearTimeout(timer);
                    settled = true;
                    this.ami.removeListener('rawevent', handler);
                    reject(err);
                }
            });
            // Clear timeout when finished cleanly
            const origFinish = finish;
            const wrappedFinish = () => { clearTimeout(timer); origFinish(); };
            // Override finish reference for the handler's Complete event
            Object.defineProperty(handler, '_finish', { value: wrappedFinish });
        });
    }
    /** Reload a specific Asterisk module (e.g. res_pjsip_endpoint_identifier_ip.so) */
    async moduleReload(moduleName) {
        return this.action({ action: 'ModuleLoad', module: moduleName, loadtype: 'reload' });
    }
    /**
     * Get the value of a channel variable via AMI GetVar.
     * Used internally to read caller-channel variables from agent-channel context (e.g. AgentConnect).
     *
     * @param channel  - Full channel name (e.g. "PJSIP/e101_42-00000001")
     * @param variable - Variable name (e.g. "HH_ROUTE_UID" or "CDR(vpbx_user_uid)")
     */
    async getChannelVar(channel, variable) {
        const res = await this.action({ action: 'GetVar', channel, variable });
        return res?.value || '';
    }
};
exports.AmiService = AmiService;
exports.AmiService = AmiService = AmiService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        ami_gateway_1.AmiGateway,
        core_1.ModuleRef])
], AmiService);
//# sourceMappingURL=ami.service.js.map