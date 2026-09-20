"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var CallCenterStateService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CallCenterStateService = void 0;
/**
 * CallCenter In-Memory State Store.
 *
 * Maintains a real-time snapshot of all agents, queues, and active calls.
 * Updated by AMI events (via CallCenterAmiService), never queried from DB.
 * Provides RxJS Subject streams for SSE push to browsers.
 */
const common_1 = require("@nestjs/common");
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
const endpoint_ids_util_1 = require("../endpoints/endpoint-ids.util");
const cc_event_bus_types_1 = require("./cc-event-bus.types");
// ─── Service ──────────────────────────────────────────────
let CallCenterStateService = CallCenterStateService_1 = class CallCenterStateService {
    logger = new common_1.Logger(CallCenterStateService_1.name);
    /** Per-tenant agent states. Key = `${userUid}:${agentInterface}` */
    agents = new Map();
    /** Per-tenant queue states. Key = `${userUid}:${queueName}` */
    queues = new Map();
    /** Active calls. Key = uniqueid */
    activeCalls = new Map();
    /** RxJS Subject for all CC events — SSE subscribers filter by userUid */
    eventSubject = new rxjs_1.Subject();
    /** Incrementing event ID for SSE Last-Event-ID support */
    eventSeqId = 0;
    onModuleInit() {
        this.logger.log('CallCenter State Store initialized');
    }
    // ─── Event Stream (for SSE) ─────────────────────────────
    /** Unfiltered event stream (shift store / cross-tenant subscribers). */
    getAllEventStream() {
        return this.eventSubject.asObservable();
    }
    /**
     * Returns an Observable filtered by tenant.
     * Used by the SSE controller to push events to the correct tenant.
     */
    getEventStream(userUid) {
        return this.eventSubject.asObservable().pipe((0, operators_1.filter)(event => event.userUid === userUid));
    }
    /**
     * SSE stream for a logged-in operator: JWT tenant OR the queue-suffix tenant
     * where they currently have an online agent (fixes q700_0 vs vpbx=58 mismatch).
     */
    getEventStreamForUser(jwtUserUid, userId) {
        return this.eventSubject.asObservable().pipe((0, operators_1.filter)((event) => {
            if (event.userUid === jwtUserUid)
                return true;
            const agentTenant = this.findTenantForOnlineUser(userId);
            return agentTenant != null && event.userUid === agentTenant;
        }));
    }
    /**
     * Typed overlay over getEventStream (D-41a).
     * Maps known event types into CcEventBusEvent; drops unmapped legacy SSE noise.
     * Does NOT duplicate the Subject — same underlying stream.
     */
    getTypedEventStream(userUid) {
        return this.getEventStream(userUid).pipe((0, operators_1.map)((event) => (0, cc_event_bus_types_1.mapCcEventToBusEvent)(event.type, event.data)), (0, operators_1.filter)((e) => e !== null));
    }
    /** Emit an event to all SSE subscribers of a tenant */
    emitEvent(type, userUid, data) {
        this.eventSeqId++;
        this.eventSubject.next({ type, userUid, data: { ...data, _eventId: this.eventSeqId } });
    }
    // ─── Agent State ────────────────────────────────────────
    agentKey(userUid, iface) {
        return `${userUid}:${iface}`;
    }
    getAgent(userUid, iface) {
        return this.agents.get(this.agentKey(userUid, iface));
    }
    getAllAgents(userUid) {
        const result = [];
        for (const agent of this.agents.values()) {
            if (agent.userUid === userUid)
                result.push(agent);
        }
        return result;
    }
    /** All agents across tenants (reconcile / global AMI sweeps). */
    getAllAgentsGlobal() {
        return Array.from(this.agents.values());
    }
    /**
     * Resolve a live Asterisk channel to a logged-in agent (D-08 / T-09-03-01).
     * Channels look like `PJSIP/e101_42-00000005` — match interface prefix before
     * the Asterisk `-xxxxxxxx` suffix. Also matches the WebRTC↔primary twin
     * (ew112_0 ↔ e112_0). Only logged-in agents (userId > 0); tenant comes from
     * the matched AgentState, never from a queue name suffix.
     */
    findAgentByChannel(channel) {
        if (!channel)
            return undefined;
        for (const agent of this.agents.values()) {
            if (!agent.userId || agent.userId <= 0)
                continue;
            for (const iface of this.channelMatchInterfaces(agent.interface)) {
                if (channel === iface || channel.startsWith(`${iface}-`)) {
                    return agent;
                }
            }
        }
        return undefined;
    }
    /** Agent interface + optional PJSIP twin (primary ↔ WebRTC companion). */
    channelMatchInterfaces(agentInterface) {
        const related = new Set([agentInterface]);
        const slash = agentInterface.indexOf('/');
        const tech = slash >= 0 ? agentInterface.slice(0, slash + 1) : '';
        const sipId = slash >= 0 ? agentInterface.slice(slash + 1) : agentInterface;
        const twin = (0, endpoint_ids_util_1.isWebrtcCompanion)(sipId) ? (0, endpoint_ids_util_1.primaryIdOf)(sipId) : (0, endpoint_ids_util_1.companionIdOf)(sipId);
        if (twin)
            related.add(`${tech}${twin}`);
        return [...related];
    }
    /**
     * Tenant bucket where this login has an online agent (queue suffix may differ from JWT vpbx).
     */
    findTenantForOnlineUser(userId) {
        for (const agent of this.agents.values()) {
            if (agent.userId === userId && agent.status !== 'OFFLINE') {
                return agent.userUid;
            }
        }
        return null;
    }
    /** Snapshot for SSE: prefer the tenant where the user is actually logged into queues. */
    getSnapshotForUser(jwtUserUid, userId) {
        const tenant = this.findTenantForOnlineUser(userId) ?? jwtUserUid;
        return { tenant, snapshot: this.getSnapshot(tenant) };
    }
    setAgent(userUid, iface, state) {
        const key = this.agentKey(userUid, iface);
        const existing = this.agents.get(key);
        const prevQueues = existing?.queues ?? [];
        const prevStatus = existing?.status;
        const updated = {
            interface: iface,
            name: '',
            status: 'OFFLINE',
            queues: [],
            callsTaken: 0,
            callsMissed: 0,
            callsMade: 0,
            userUid,
            userId: 0,
            ...(existing || {}),
            ...state,
        };
        // Stamp when status actually changes so UI timers survive refresh / remount
        if (state.statusSince != null) {
            updated.statusSince =
                state.statusSince instanceof Date
                    ? state.statusSince
                    : new Date(state.statusSince);
        }
        else if (!existing || existing.status !== updated.status) {
            updated.statusSince = new Date();
        }
        else {
            // Same status: always keep the original stamp (ignore accidental clears).
            updated.statusSince = existing.statusSince ?? new Date();
        }
        // Provenance: status transitions without an explicit origin are untrusted
        // (must not drive Asterisk heal). Same-status patches keep prior origin
        // unless the caller sets statusOrigin explicitly.
        if (!existing || existing.status !== updated.status) {
            updated.statusOrigin = state.statusOrigin ?? 'unknown';
        }
        else if (Object.prototype.hasOwnProperty.call(state, 'statusOrigin')) {
            updated.statusOrigin = state.statusOrigin;
        }
        else {
            updated.statusOrigin = existing.statusOrigin ?? 'unknown';
        }
        // Leaving PAUSED / OUTBOUND_WORK must clear reason — undefined is dropped by JSON.stringify (SSE).
        // Keep reason while DIALING so we can resume the prior pause/outbound-work mode after the dial.
        if (updated.status !== 'PAUSED'
            && updated.status !== 'OUTBOUND_WORK'
            && updated.status !== 'DIALING') {
            delete updated.pauseReason;
        }
        // peerNumber only for personal ring/talk; clear when leaving those states
        // (or when caller explicitly clears via empty string / null).
        const keepPeer = updated.status === 'RINGING'
            || updated.status === 'IN_CALL'
            || updated.status === 'DIALING'
            || updated.status === 'CONSULT';
        if (!keepPeer
            || state.peerNumber === ''
            || state.peerNumber === null) {
            delete updated.peerNumber;
        }
        // dialTarget only while outbound dial / answered outbound talk; clear otherwise.
        // Explicit undefined/null/'' from callers must wipe even while still DIALING/IN_CALL.
        const keepDial = updated.status === 'DIALING'
            || updated.status === 'IN_CALL'
            || updated.status === 'CONSULT';
        if (!keepDial
            || state.dialTarget === ''
            || state.dialTarget === null
            || (Object.prototype.hasOwnProperty.call(state, 'dialTarget') && state.dialTarget === undefined)) {
            delete updated.dialTarget;
        }
        this.agents.set(key, updated);
        // Explicit null so SSE clients clear the previous reason / peer / dial labels
        const keepReason = updated.status === 'PAUSED'
            || updated.status === 'OUTBOUND_WORK'
            || updated.status === 'DIALING';
        const payload = {
            ...(keepReason ? updated : { ...updated, pauseReason: null }),
            ...(!updated.peerNumber ? { peerNumber: null } : {}),
            ...(!updated.dialTarget ? { dialTarget: null } : {}),
        };
        this.emitEvent('agentUpdate', userUid, payload);
        // Keep queue free/paused/busy counts in sync (login/pause/dial often skip AMI recalc).
        const queuesChanged = prevQueues.length !== updated.queues.length
            || prevQueues.some((q) => !updated.queues.includes(q));
        if (!existing || prevStatus !== updated.status || queuesChanged) {
            const affected = new Set([...prevQueues, ...updated.queues]);
            for (const queueName of affected) {
                this.recomputeQueueAgentStats(userUid, queueName);
            }
        }
        return updated;
    }
    removeAgent(userUid, iface) {
        const key = this.agentKey(userUid, iface);
        const existing = this.agents.get(key);
        this.agents.delete(key);
        this.emitEvent('agentUpdate', userUid, { interface: iface, status: 'OFFLINE', removed: true });
        if (existing?.queues?.length) {
            for (const queueName of existing.queues) {
                this.recomputeQueueAgentStats(userUid, queueName);
            }
        }
    }
    /**
     * Refresh queue.agents.* from live agent statuses.
     * OFFLINE (Invalid / unreachable) members are excluded from totals.
     */
    recomputeQueueAgentStats(userUid, queueName) {
        if (!this.getQueue(userUid, queueName))
            return;
        const live = this.getAllAgents(userUid).filter((a) => a.queues.includes(queueName) && a.status !== 'OFFLINE');
        this.setQueue(userUid, queueName, {
            agents: {
                total: live.length,
                available: live.filter((a) => a.status === 'READY').length,
                paused: live.filter((a) => a.status === 'PAUSED' || a.status === 'OUTBOUND_WORK').length,
                busy: live.filter((a) => a.status === 'IN_CALL'
                    || a.status === 'RINGING'
                    || a.status === 'DIALING'
                    || a.status === 'CONSULT'
                    || a.status === 'WRAPUP'
                    || a.status === 'ACW').length,
            },
        });
    }
    // ─── Queue State ────────────────────────────────────────
    queueKey(userUid, name) {
        return `${userUid}:${name}`;
    }
    getQueue(userUid, name) {
        return this.queues.get(this.queueKey(userUid, name));
    }
    getAllQueues(userUid) {
        const result = [];
        for (const q of this.queues.values()) {
            if (q.userUid === userUid)
                result.push(q);
        }
        return result;
    }
    setQueue(userUid, name, state) {
        const key = this.queueKey(userUid, name);
        const existing = this.queues.get(key);
        const updated = {
            name,
            displayName: name,
            strategy: 'ringall',
            waiting: 0,
            talking: 0,
            agents: { total: 0, available: 0, paused: 0, busy: 0 },
            // 0 = no offered calls yet (not "perfect 100%"). Strip excludes empty queues from SLA rollup.
            sla: 0,
            calls: { answered: 0, abandoned: 0, total: 0 },
            avgWait: 0,
            avgTalk: 0,
            userUid,
            ...(existing || {}),
            ...state,
        };
        this.queues.set(key, updated);
        this.emitEvent('queueUpdate', userUid, updated);
        return updated;
    }
    // ─── Call State ─────────────────────────────────────────
    getCall(uniqueid) {
        return this.activeCalls.get(uniqueid);
    }
    getAllCalls(userUid) {
        const result = [];
        for (const call of this.activeCalls.values()) {
            if (call.userUid === userUid)
                result.push(call);
        }
        return result;
    }
    setCall(uniqueid, state) {
        const existing = this.activeCalls.get(uniqueid);
        const updated = {
            uniqueid,
            callerIdNum: '',
            callerIdName: '',
            queue: '',
            status: 'WAITING',
            enterTime: new Date(),
            holdTime: 0,
            talkTime: 0,
            userUid: 0,
            ...(existing || {}),
            ...state,
        };
        this.activeCalls.set(uniqueid, updated);
        const eventType = existing ? 'callUpdate' : 'callNew';
        this.emitEvent(eventType, updated.userUid, updated);
        return updated;
    }
    removeCall(uniqueid, reason) {
        const call = this.activeCalls.get(uniqueid);
        if (call) {
            this.activeCalls.delete(uniqueid);
            this.emitEvent('callEnd', call.userUid, { ...call, reason });
        }
    }
    /**
     * Get ALL active calls across all tenants.
     * Used by Hold/Unhold AMI handlers that receive channel name without tenant context.
     */
    getAllCallsGlobal() {
        return Array.from(this.activeCalls.values());
    }
    // ─── Snapshot (for initial SSE connection) ──────────────
    getSnapshot(userUid) {
        return {
            agents: this.getAllAgents(userUid),
            queues: this.getAllQueues(userUid),
            calls: this.getAllCalls(userUid),
        };
    }
};
exports.CallCenterStateService = CallCenterStateService;
exports.CallCenterStateService = CallCenterStateService = CallCenterStateService_1 = __decorate([
    (0, common_1.Injectable)()
], CallCenterStateService);
//# sourceMappingURL=callcenter-state.service.js.map