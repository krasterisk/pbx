import { Injectable, Logger, OnModuleDestroy, OnModuleInit, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID, createHash } from 'crypto';
import type { DashboardCall, DashboardEndpoint, DashboardLive, DashboardPage, DashboardQuery, DashboardSource, DashboardDirection, DashboardOrigin } from '@krasterisk/shared';
import type { CdrAccessScope } from '../reports/cdr/cdr-access-scope';
import { AmiService } from '../ami/ami.service';
import { DashboardReadStore } from './dashboard-read-store.service';
import { DashboardCacheService } from './dashboard-cache.service';
import { participantTokens, scopeAllows, tenantFromChannel } from './dashboard-classifier';
import { dashboardInventoryKey, DASHBOARD_SNAPSHOT_SELECT, decodeDashboardSnapshot, encodeDashboardSnapshot, type DashboardStoredSnapshot } from './dashboard-snapshot-storage';

type Event = Record<string, any>;
interface Contact { status: DashboardEndpoint['status']; expires: number | null; renewalPreviousExpiry?: number | null }
interface Channel { id: string; linkedid: string; tenant: number | null; channel: string; context: string; src: string; dst: string; state: string; application: string; bridged: boolean; started: number }
interface Inventory extends DashboardEndpoint { tenant: number; expires: number | null; kind: 'endpoint' | 'trunk' }
interface TrunkAors { ids: string[]; qualifiedStatic: boolean }
interface CallOrigin { direction: DashboardDirection; origin: DashboardOrigin; src: string; started: number; locked: boolean }
interface LivePayload { version: string; source: DashboardSource; inventorySource: DashboardSource; calls: Record<string, (DashboardCall & { participants: ReturnType<typeof participantTokens>; originState?: { version: 3; locked: boolean } })[]>; inventory: Inventory[]; live: Record<string, DashboardLive> }
const allowedEvents = new Set(['newchannel', 'newstate', 'hangup', 'dialbegin', 'dialend', 'bridgeenter', 'bridgeleave', 'queuecallerjoin', 'queuecallerleave', 'contactstatus', 'devicestatechange', 'registry', 'dashboardconnection']);

/** A single lease holder collects node state; viewers only read its durable, bounded projection. */
@Injectable()
export class DashboardCollectorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DashboardCollectorService.name);
  private readonly owner = randomUUID();
  private readonly channels = new Map<string, Channel>();
  private readonly origins = new Map<string, CallOrigin>();
  private inventory: Inventory[] = [];
  private inventoryById = new Map<string, Inventory>();
  private inventoryReplay: Event[] | null = null;
  private inventoryOverflow = false;
  private contactsByEndpoint = new Map<string, Map<string, Contact>>();
  private devices = new Map<string, DashboardEndpoint['status']>();
  private trunkAors = new Map<string, TrunkAors>();
  private dirtyContacts = new Set<string>();
  private contactGenerations = new Map<string, number>();
  private contactGeneration = 0;
  private callsSource: DashboardSource = { state: 'unavailable', updatedAt: null };
  private inventorySource: DashboardSource = { state: 'unavailable', updatedAt: null };
  private timer: ReturnType<typeof setInterval> | null = null;
  private unsubscribe: (() => void) | null = null;
  private running = false;
  private tickTask: Promise<void> | null = null;
  private inventoryTask: Promise<void> | null = null;
  private inventoryAbort: AbortController | null = null;
  private inventoryHeartbeat: ReturnType<typeof setInterval> | null = null;
  private leaseHeartbeatTask: Promise<void> | null = null;
  private generation = 0;
  private inventoryRevision = 0;
  private persistedInventoryHash: string | null = null;
  private hydratedGeneration = -1;
  private callsInitialized = false;
  private inventoryInitialized = false;
  private fallbackPayload: LivePayload | null = null;
  private readonly maxFallbackBytes = 32 * 1024 * 1024;
  private destroyed = false;
  private leader = false;
  private replay: Event[] | null = null;
  private replayOverflow = false;
  private lastCalls = 0;
  private lastInventory = 0;
  private lastPayload: LivePayload | null = null;
  private aiTables: Set<string> | null = null;
  private aiWorked = new Set<string>();
  constructor(private readonly store: DashboardReadStore, private readonly ami: AmiService, private readonly config: ConfigService, private readonly cache: DashboardCacheService) {}
  onModuleInit(): void {
    this.unsubscribe = this.ami.subscribeInternalEvents((event) => this.onEvent(event));
    this.timer = setInterval(() => { void this.tick(); }, 5000); this.timer.unref(); void this.tick();
  }
  async onModuleDestroy(): Promise<void> {
    this.destroyed = true; this.unsubscribe?.(); if (this.timer) clearInterval(this.timer);
    this.invalidateInventory('collectorStopped'); this.leader = false;
    await Promise.allSettled([this.tickTask, this.inventoryTask, this.leaseHeartbeatTask].filter((task): task is Promise<void> => Boolean(task)));
    await this.store.releaseLease(`collector:${this.store.nodeId}`, this.owner).catch(() => undefined);
  }
  tick(): Promise<void> {
    if (this.running || this.destroyed) return Promise.resolve();
    this.running = true;
    const task = this.performTick(); this.tickTask = task;
    return task.finally(() => { if (this.tickTask === task) this.tickTask = null; });
  }
  private async performTick(): Promise<void> {
    try {
      const previousLeader = this.leader; const beforeAcquire = this.generation;
      const acquired = await this.store.acquireLease(`collector:${this.store.nodeId}`, this.owner, 60000);
      if (this.destroyed || beforeAcquire !== this.generation) return;
      if (!acquired) { if (previousLeader) this.loseLeadership(); return; }
      this.leader = true;
      if (!previousLeader) { this.generation++; this.lastCalls = 0; this.lastInventory = 0; this.persistedInventoryHash = null; }
      const generation = this.generation;
      if (this.hydratedGeneration !== generation) await this.hydrateFallback(generation);
      if (!this.current(generation)) return;
      if (!this.ami.isConnected()) {
        const state = this.config.get<string>('AMI_SECRET') ? 'unavailable' : 'notConfigured';
        this.callsSource = this.callsSource.updatedAt ? this.failedSource(this.callsSource, 'callsDisconnected') : { ...this.callsSource, state, message: 'callsDisconnected' };
        this.inventorySource = this.inventorySource.updatedAt ? this.failedSource(this.inventorySource, 'inventoryDisconnected') : { ...this.inventorySource, state, message: 'inventoryDisconnected' };
      } else {
        if (Date.now() - this.lastCalls >= 30000) await this.reconcileCalls();
        if (!this.current(generation)) return;
        if (Date.now() - this.lastInventory >= 300000) this.startInventory();
      }
      await this.refreshContactExpirations();
      if (!this.current(generation)) return;
      this.expireContacts();
      await this.refreshAI();
      if (!this.current(generation)) return;
      if (await this.store.renewLease(`collector:${this.store.nodeId}`, this.owner, 60000)) {
        if (this.current(generation)) await this.publish(generation);
      } else this.loseLeadership();
    } catch (error) { this.logger.warn(`Dashboard collector cycle failed: ${error instanceof Error ? error.message : error}`); this.callsSource = this.failedSource(this.callsSource); }
    finally { this.running = false; }
  }
  private failedSource(source: DashboardSource, message?: string): DashboardSource {
    return { ...source, state: source.updatedAt ? 'stale' : 'unavailable', ...(message ? { message } : {}) };
  }
  private validFallback(payload: any): payload is LivePayload {
    const source = (value: any) => value && ['ok', 'stale', 'unavailable', 'notConfigured'].includes(value.state) && (value.updatedAt === null || typeof value.updatedAt === 'string' && Number.isFinite(Date.parse(value.updatedAt)));
    if (!payload || typeof payload.version !== 'string' || !source(payload.source) || !source(payload.inventorySource) || !Array.isArray(payload.inventory) || payload.inventory.length > 200000 || !payload.calls || typeof payload.calls !== 'object' || Array.isArray(payload.calls) || !payload.live || typeof payload.live !== 'object' || Array.isArray(payload.live)) return false;
    if (payload.inventory.some((row: any) => !row || typeof row.id !== 'string' || row.id.length > 128 || !Number.isSafeInteger(row.tenant) || row.tenant < 0 || !['endpoint', 'trunk'].includes(row.kind) || !['online', 'offline', 'unknown'].includes(row.status) || typeof row.name !== 'string' || row.name.length > 512 || typeof row.enabled !== 'boolean')) return false;
    let count = 0;
    for (const [tenant, rows] of Object.entries(payload.calls)) {
      if (!/^\d+$/.test(tenant) || !Number.isSafeInteger(Number(tenant)) || !Array.isArray(rows) || (count += rows.length) > 100000) return false;
      for (const row of rows) {
        if (!row || typeof row.id !== 'string' || !/^[a-f0-9]{64}$/.test(row.id) || typeof row.linkedid !== 'string' || !row.linkedid || row.linkedid.length > 128 || !Number.isFinite(Date.parse(row.startedAt)) || row.endedAt !== null || row.outcome !== 'active' || !['in', 'out', 'internal', 'external'].includes(row.direction) || !['telephony', 'ai', 'autodial'].includes(row.origin) || !['ringing', 'talking', 'waiting'].includes(row.state) || typeof row.src !== 'string' || typeof row.dst !== 'string' || !Number.isFinite(row.duration) || row.duration < 0 || !Array.isArray(row.participants)) return false;
        if (row.originState && (row.originState.version !== 3 || typeof row.originState.locked !== 'boolean')) return false;
        if (row.participants.some((part: any) => !part || !['extension', 'queue', 'uniqueid'].includes(part.kind) || typeof part.value !== 'string' || part.value.length > 128)) return false;
      }
    }
    return true;
  }
  private async hydrateFallback(generation: number): Promise<void> {
    const memory = this.callsSource.updatedAt || this.inventorySource.updatedAt ? this.buildPayload() : null;
    if (memory) memory.inventory = memory.inventory.map((row) => ({ ...row }));
    let payload: LivePayload | null = memory;
    try {
      const [row] = await this.store.select<DashboardStoredSnapshot>(DASHBOARD_SNAPSHOT_SELECT, { node: this.store.nodeId, inventoryNode: dashboardInventoryKey(this.store.nodeId), maxBytes: this.maxFallbackBytes });
      if (row && typeof row.payload === 'string' && Buffer.byteLength(row.payload) <= this.maxFallbackBytes) {
        const saved = decodeDashboardSnapshot<LivePayload>(this.store.nodeId, row); if (this.validFallback(saved)) payload = saved;
      }
    } catch { /* Keep an available in-process last complete source; cold starts remain unavailable. */ }
    if (!this.current(generation)) return;
    this.fallbackPayload = payload;
    for (const [tenant, rows] of Object.entries(payload?.calls || {})) for (const call of rows) {
      const key = tenant + ':' + call.linkedid;
      if (!this.origins.has(key) && this.origins.size < 100000) this.origins.set(key, { direction: call.direction, origin: call.origin, src: call.src, started: Date.parse(call.startedAt), locked: call.originState?.version === 3 && call.originState.locked });
    } this.callsInitialized = false; this.inventoryInitialized = false;
    this.callsSource = payload?.source.updatedAt ? this.failedSource(payload.source) : { state: 'unavailable', updatedAt: null };
    this.inventorySource = payload?.inventorySource.updatedAt ? this.failedSource(payload.inventorySource) : { state: 'unavailable', updatedAt: null };
    this.hydratedGeneration = generation;
  }
  private clearInitializedFallback(): void { if (this.callsInitialized && this.inventoryInitialized) this.fallbackPayload = null; }
  private current(generation: number): boolean { return !this.destroyed && this.leader && generation === this.generation; }
  private invalidateInventory(message: string): void {
    this.generation++; this.inventoryAbort?.abort();
    if (this.inventoryHeartbeat) clearInterval(this.inventoryHeartbeat);
    this.inventoryHeartbeat = null;
    this.inventorySource = { ...this.inventorySource, state: this.inventorySource.updatedAt ? 'stale' : 'unavailable', message };
  }
  private loseLeadership(): void {
    this.leader = false; this.callsSource = this.failedSource(this.callsSource);
    this.invalidateInventory('collectorOwnershipLost');
  }
  private startInventory(): void {
    if (this.inventoryTask || this.destroyed || !this.leader) return;
    this.lastInventory = Date.now(); this.inventoryReplay = []; this.inventoryOverflow = false;
    this.inventorySource = { ...this.inventorySource, state: this.inventorySource.updatedAt ? 'stale' : 'unavailable', message: 'inventoryRefreshInProgress' };
    const generation = this.generation; const controller = new AbortController(); this.inventoryAbort = controller;
    this.inventoryTask = this.reconcileInventory(generation, controller.signal).finally(() => {
      if (this.inventoryAbort !== controller) return;
      if (this.inventoryHeartbeat) clearInterval(this.inventoryHeartbeat);
      this.inventoryHeartbeat = null; this.inventoryAbort = null; this.inventoryTask = null; this.inventoryReplay = null;
    });
    this.inventoryHeartbeat = setInterval(() => {
      if (this.leaseHeartbeatTask || !this.current(generation)) return;
      const task = this.renewInventoryLease(generation); this.leaseHeartbeatTask = task;
      void task.finally(() => { if (this.leaseHeartbeatTask === task) this.leaseHeartbeatTask = null; });
    }, 15000);
    this.inventoryHeartbeat.unref();
  }
  private async renewInventoryLease(generation: number): Promise<void> {
    try {
      const renewed = await this.store.renewLease(`collector:${this.store.nodeId}`, this.owner, 60000);
      if (this.current(generation) && !renewed) this.loseLeadership();
    } catch { if (this.current(generation)) this.loseLeadership(); }
  }
  private async publish(generation: number): Promise<void> {
    const inventoryHash = await this.store.sequelize.transaction(async (transaction) => {
      const [lease] = await this.store.select<{ owner: string; expires_at: number }>('SELECT owner,expires_at FROM dashboard_leases WHERE lease_key= :key FOR UPDATE', { key: `collector:${this.store.nodeId}` }, transaction);
      if (!this.current(generation)) return;
      if (lease?.owner !== this.owner || Number(lease.expires_at) <= Date.now()) { this.loseLeadership(); throw new Error('Collector ownership lost before publication'); }
      const snapshot = encodeDashboardSnapshot(this.store.nodeId, this.buildPayload());
      if (snapshot.hash !== this.persistedInventoryHash) {
        await this.store.upsert('dashboard_live_state', { node_id: snapshot.key, payload: snapshot.inventory, updated_at: Date.now() }, ['node_id'], transaction);
      }
      await this.store.upsert('dashboard_live_state', { node_id: this.store.nodeId, payload: snapshot.payload, updated_at: Date.now() }, ['node_id'], transaction);
      if (!this.current(generation) || Number(lease.expires_at) <= Date.now()) throw new Error('Collector publication cancelled before commit');
      return snapshot.hash;
    });
    if (inventoryHash && this.current(generation)) this.persistedInventoryHash = inventoryHash;
  }
  private channel(event: Event): Channel | null {
    const id = String(event.uniqueid || event.destuniqueid || ''); if (!id) return null;
    const previous = this.channels.get(id);
    const name = String(event.channel || previous?.channel || ''); const context = String(event.context || previous?.context || '');
    const duration = String(event.duration || '0:0:0').split(':').reduce((n, v) => n * 60 + Number(v), 0);
    return { id, linkedid: String(event.linkedid || previous?.linkedid || id), tenant: previous?.tenant ?? tenantFromChannel(name, context), channel: name, context, src: String(event.calleridnum || previous?.src || ''), dst: String(event.exten || previous?.dst || ''), state: String(event.channelstatedesc || previous?.state || 'ringing'), application: String(event.application || previous?.application || ''), bridged: Object.prototype.hasOwnProperty.call(event, 'bridgeid') ? Boolean(event.bridgeid && event.bridgeid !== '<none>') : previous?.bridged || false, started: previous?.started || Date.now() - (Number.isFinite(duration) ? duration : 0) * 1000 };
  }
  private onEvent(event: Event): void {
    const name = String(event.event || '').toLowerCase(); if (!allowedEvents.has(name)) return;
    if (name === 'dashboardconnection') {
      this.invalidateInventory(event.connected ? 'inventoryReconnected' : 'inventoryDisconnected');
      if (event.connected) { this.lastCalls = 0; this.lastInventory = 0; }
      else { this.callsSource = this.failedSource(this.callsSource, 'callsDisconnected'); this.inventorySource = this.failedSource(this.inventorySource, 'inventoryDisconnected'); }
      return;
    }
    if (!this.leader) return;
    if (this.replay) {
      if (this.replay.length >= 50000) this.replayOverflow = true;
      else this.replay.push(event);
    }
    if (this.inventoryReplay && ['contactstatus', 'devicestatechange', 'registry'].includes(name)) {
      if (this.inventoryReplay.length >= 50000) this.inventoryOverflow = true;
      else this.inventoryReplay.push(event);
    }
    this.applyEvent(event);
  }
  private applyEvent(event: Event): void {
    const name = String(event.event || '').toLowerCase();
    if (name === 'hangup') { this.channels.delete(String(event.uniqueid)); return; }
    if (name === 'dialend' && event.dialstatus === 'ANSWER') {
      const destination = this.channels.get(String(event.destuniqueid));
      if (destination) { destination.state = 'Up'; destination.bridged = true; }
      const caller = this.channels.get(String(event.uniqueid));
      if (caller) caller.bridged = true;
    }
    if (['newchannel', 'newstate', 'bridgeenter', 'bridgeleave', 'queuecallerjoin', 'queuecallerleave'].includes(name)) {
      const channel = this.channel(event);
      if (channel) {
        if (name === 'queuecallerjoin') channel.state = 'waiting';
        if (name === 'bridgeenter') { channel.state = 'Up'; channel.bridged = true; }
        if (name === 'bridgeleave') channel.bridged = false;
        if (this.channels.size < 100000 || this.channels.has(channel.id)) {
          this.channels.set(channel.id, channel);
          this.captureOrigin(channel);
        }
        else this.callsSource = this.failedSource(this.callsSource, 'channelCapacityExceeded');
      }
    }
    // Outbound REGISTER state is independent of SIP contact/device reachability.
    // Registry events must not replace the reducer used for availability counts.
    if (name === 'contactstatus' || name === 'devicestatechange') {
      const endpoint = String(event.endpointname || event.endpoint || event.objectname || event.device?.replace(/^PJSIP\//, '') || event.username || '');
      const item = this.inventoryById.get(endpoint) || this.inventoryById.get(endpoint.replace(/^ew/, 'e'));
      if (item) {
        if (name === 'contactstatus') {
          const key = String(event.uri || event.contact || '');
          if (this.dirtyContacts.has(endpoint) || this.dirtyContacts.size < 10000) {
            this.dirtyContacts.add(endpoint);
            this.contactGenerations.set(endpoint, ++this.contactGeneration);
          }
          else this.inventorySource = this.failedSource(this.inventorySource, 'contactRefreshCapacityExceeded');
          if (!key) {
            if (String(event.contactstatus || event.status || '').toLowerCase() === 'updated') {
              for (const owner of this.contactKeys(endpoint)) for (const contact of this.contactsByEndpoint.get(owner)?.values() || []) { contact.renewalPreviousExpiry = contact.expires ?? contact.renewalPreviousExpiry; contact.expires = null; }
            }
            this.inventorySource = this.failedSource(this.inventorySource, 'ambiguousContactEvent'); return;
          }
          // Bulk ContactList can identify the AoR while ContactStatus identifies
          // its endpoint. Update every existing alias of this exact contact URI;
          // adding a second entry could leave an old positive alias alive.
          const owners = this.contactKeys(endpoint).filter(owner => this.contactsByEndpoint.get(owner)?.has(key));
          if (!owners.length) owners.push(endpoint);
          const renewed = String(event.contactstatus || event.status || '').toLowerCase() === 'updated';
          const explicitExpiry = this.expiration(event);
          for (const owner of owners) {
            if (!this.contactsByEndpoint.has(owner)) this.contactsByEndpoint.set(owner, new Map());
            const previous = this.contactsByEndpoint.get(owner)!.get(key);
            this.contactsByEndpoint.get(owner)!.set(key, {
              status: renewed ? previous?.status || 'unknown' : this.status(event.contactstatus || event.status),
              expires: explicitExpiry ?? (renewed ? null : previous?.expires ?? null),
              ...(renewed && explicitExpiry == null ? { renewalPreviousExpiry: previous?.expires ?? previous?.renewalPreviousExpiry ?? null } : {}),
            });
          }
        } else this.devices.set(endpoint, this.status(event.state || event.status));
        item.status = this.inventoryStatus(item.id, item.kind);
      }
    }
  }
  private status(raw: unknown): DashboardEndpoint['status'] {
    const value = String(raw || '').toLowerCase().replace(/[^a-z]/g, '');
    if (['reachable', 'avail', 'available', 'notinuse', 'inuse', 'ringing', 'onhold', 'busy'].includes(value)) return 'online';
    if (['unreachable', 'unavail', 'unavailable', 'removed', 'invalid'].includes(value)) return 'offline';
    return 'unknown';
  }
  private expiration(event: Event): number | null {
    const value = Number(event.expirationtime || event.expiration_time || 0);
    return value > 0 ? value > 1e12 ? value : value * 1000 : null;
  }
  private contactKeys(endpoint: string): string[] {
    return [...new Set([endpoint, ...(this.trunkAors.get(endpoint)?.ids || [])])];
  }
  private inventoryStatus(id: string, kind: Inventory['kind'], contactsByEndpoint = this.contactsByEndpoint, deviceStates = this.devices, trunkAors = this.trunkAors): DashboardEndpoint['status'] {
    const keys = kind === 'endpoint' ? [id, id.replace(/^e/, 'ew')] : [id, ...(trunkAors.get(id)?.ids || [])];
    const contacts = keys.flatMap((key) => [...(contactsByEndpoint.get(key)?.values() || [])]);
    const statuses = contacts.map((contact) => contact.expires != null && contact.expires <= Date.now() ? 'offline' : contact.status);
    if (statuses.includes('online')) return 'online';
    const devices = (kind === 'trunk' ? [id] : keys).map((key) => deviceStates.get(key) || 'unknown');
    if (kind === 'trunk') {
      // Explicit contact evidence wins over endpoint DeviceState. In particular,
      // NonQualified/unknown contacts do not prove availability without OPTIONS.
      if (statuses.includes('unknown')) return 'unknown';
      if (statuses.length) return 'offline';
      // Asterisk22 bulk contacts omit static AoRs. Use positive DeviceState only
      // when a configured static contact is actually qualified; absence stays unknown.
      return trunkAors.get(id)?.qualifiedStatic && devices.includes('online') ? 'online' : 'unknown';
    }
    if (statuses.includes('unknown') || !statuses.length) {
      if (devices.includes('online')) return 'online';
      if (statuses.includes('unknown')) return 'unknown';
      return devices.includes('offline') ? 'offline' : 'unknown';
    }
    return 'offline';
  }

  private async reconcileCalls(): Promise<void> {
    this.lastCalls = Date.now(); this.replay = []; this.replayOverflow = false;
    const generation = this.generation;
    try {
      const snapshot = await this.ami.getActiveChannels();
      if (!this.current(generation)) return;
      if (!snapshot.complete || this.replayOverflow) { this.callsSource = this.failedSource(this.callsSource, 'incompleteSnapshot'); return; }
      const replay = this.replay; const previous = new Map(this.channels);
      this.channels.clear();
      for (const event of snapshot.events) {
        const channel = this.channel(event); if (channel) { channel.started = previous.get(channel.id)?.started || channel.started; if (!Object.prototype.hasOwnProperty.call(event, 'bridgeid')) channel.bridged = previous.get(channel.id)?.bridged || false; this.channels.set(channel.id, channel); }
      }
      // Complete snapshot origins must survive a terminal event replayed before publication.
      // One bounded pass, with constant-time linked root lookup for each channel.
      for (const channel of this.channels.values()) this.captureOrigin(channel);
      for (const event of replay) this.applyEvent(event);
      this.callsSource = { state: 'ok', updatedAt: new Date().toISOString() }; this.callsInitialized = true; this.clearInitializedFallback();
    } catch { if (this.current(generation)) this.callsSource = this.failedSource(this.callsSource, 'snapshotFailed'); }
    finally { this.replay = null; }
  }
  private async reconcileInventory(generation: number, signal: AbortSignal): Promise<void> {
    try {
      // One source rejecting must not release single-flight ownership while sibling
      // lists still run. Every source settles or is aborted before this job finishes.
      const sources = await Promise.allSettled([this.ami.collectDashboardEndpoints(signal), this.ami.collectDashboardContacts(signal), this.ami.collectDashboardRegistrations(signal)]);
      if (!this.current(generation) || signal.aborted) return;
      const [endpoints, contacts, registrations] = sources.map((source) => { if (source.status === 'rejected') throw source.reason; return source.value; });
      if (!endpoints.complete || !contacts.complete || !registrations.complete || this.inventoryOverflow) { this.inventorySource = this.failedSource(this.inventorySource, 'incompleteInventory'); return; }
      const rows = await this.store.select<{ id: string; tenantid: string; callerid: string; aors: string }>('SELECT id,tenantid,callerid,aors FROM ps_endpoints ORDER BY id LIMIT 200001');
      if (!this.current(generation) || signal.aborted) return;
      if (rows.length > 200000) throw new Error('Endpoint inventory exceeds collection budget');
      const aors = await this.store.select<{ id: string; contact: string | null; qualify_frequency: number | null }>('SELECT id,contact,qualify_frequency FROM ps_aors ORDER BY id LIMIT 200001');
      if (!this.current(generation) || signal.aborted) return;
      if (aors.length > 200000) throw new Error('AoR inventory exceeds collection budget');
      const qualifiedStaticAors = new Set(aors.filter(aor => Boolean(aor.contact?.trim()) && Number.isFinite(Number(aor.qualify_frequency)) && Number(aor.qualify_frequency) > 0).map(aor => aor.id));
      const nextTrunkAors = new Map<string, TrunkAors>();
      for (const row of rows) if (row.id.startsWith('t_')) {
        const ids = String(row.aors || '').split(',').map(id => id.trim()).filter(Boolean);
        // Aggregate DeviceState cannot identify which AoR supplied its positive
        // state. Fallback is safe only when every referenced AoR is qualified.
        nextTrunkAors.set(row.id, { ids, qualifiedStatic: ids.length > 0 && ids.every(id => qualifiedStaticAors.has(id)) });
      }
      const databaseContacts = await this.store.select<{ id: string; endpoint: string; uri: string; expiration_time: number }>('SELECT id,endpoint,uri,expiration_time FROM ps_contacts LIMIT 200001');
      if (!this.current(generation) || signal.aborted) return;
      if (databaseContacts.length > 200000) throw new Error('Contact inventory exceeds collection budget');
      const expiryByContact = new Map<string, number | null>();
      for (const contact of databaseContacts) { expiryByContact.set(`${contact.endpoint}:${contact.uri}`, this.expiration(contact)); expiryByContact.set(contact.id, this.expiration(contact)); }
      const nextContacts = new Map<string, Map<string, Contact>>();
      for (const contact of contacts.events) {
        const endpoint = String(contact.endpoint || contact.endpointname || contact.aor || contact.objectname?.split(';')[0] || '');
        const key = String(contact.uri || contact.objectname || '');
        if (!endpoint || !key) continue;
        if (!nextContacts.has(endpoint)) nextContacts.set(endpoint, new Map());
        nextContacts.get(endpoint)!.set(key, { status: this.status(contact.status || contact.contactstatus), expires: this.expiration(contact) ?? expiryByContact.get(`${endpoint}:${contact.uri}`) ?? expiryByContact.get(contact.objectname) ?? null });
      }
      const nextDevices = new Map(endpoints.events.map((event) => [String(event.objectname || event.endpointname || event.endpoint || ''), this.status(event.devicestate || event.state)]));
      const inventory: Inventory[] = [];
      for (const row of rows) {
        if (/^ew/.test(row.id) || !/^e[^_]+_\d+$|^t_.+_\d+$/.test(row.id)) continue;
        const tenant = row.tenantid == null || row.tenantid === '' ? Number(row.id.match(/_(\d+)$/)?.[1]) : Number(row.tenantid);
        if (!Number.isInteger(tenant)) continue;
        const kind = row.id.startsWith('t_') ? 'trunk' : 'endpoint';
        const status = this.inventoryStatus(row.id, kind, nextContacts, nextDevices, nextTrunkAors);

        inventory.push({ id: row.id, tenant, kind, name: row.callerid || row.id.replace(/^e|^t_/, '').replace(/_\d+$/, ''), status, enabled: true, expires: null });
      }
      const renewed = await this.store.renewLease(`collector:${this.store.nodeId}`, this.owner, 60000);
      if (!this.current(generation) || signal.aborted) return;
      if (!renewed) { this.loseLeadership(); return; }
      // The replay may overflow during either SQL read or final lease renewal.
      if (this.inventoryOverflow) { this.inventorySource = this.failedSource(this.inventorySource, 'incompleteInventory'); return; }
      // Accept all complete sources together. Events received throughout the slow
      // snapshot and SQL reads are replayed over local maps before the next publication.
      this.contactsByEndpoint = nextContacts; this.devices = nextDevices; this.trunkAors = nextTrunkAors;
      this.inventory = inventory; this.inventoryById = new Map(inventory.map((i) => [i.id, i])); this.inventoryRevision++; this.lastInventory = Date.now();
      this.inventorySource = { state: 'ok', updatedAt: new Date().toISOString() }; this.inventoryInitialized = true; this.clearInitializedFallback();
      for (const event of this.inventoryReplay || []) this.applyEvent(event);
    } catch { if (this.current(generation)) this.inventorySource = this.failedSource(this.inventorySource, 'inventoryFailed'); }
  }
  private async refreshContactExpirations(): Promise<void> {
    if (!this.dirtyContacts.size) return;
    const endpoints = [...this.dirtyContacts].slice(0, 1000);
    const generation = this.generation; const inventoryRevision = this.inventoryRevision;
    const generations = new Map(endpoints.map((endpoint) => [endpoint, this.contactGenerations.get(endpoint)]));
    try {
      const rows = await this.store.select<{ id: string; endpoint: string; uri: string; expiration_time: number }>('SELECT id,endpoint,uri,expiration_time FROM ps_contacts WHERE endpoint IN (:endpoints) LIMIT 50001', { endpoints });
      if (!this.current(generation) || inventoryRevision !== this.inventoryRevision) return;
      if (rows.length > 50000) throw new Error('Contact expiration refresh exceeds budget');
      const resolved = new Set<Contact>();
      for (const row of rows) {
        if (!generations.has(row.endpoint) || generations.get(row.endpoint) !== this.contactGenerations.get(row.endpoint)) continue;
        const contacts = this.contactKeys(row.endpoint).map(owner => this.contactsByEndpoint.get(owner)?.get(row.uri) || this.contactsByEndpoint.get(owner)?.get(row.id)).filter((contact): contact is Contact => Boolean(contact));
        const expires = this.expiration(row);
        // A renewal event invalidates the old deadline. A lagging database row is not new evidence.
        for (const contact of contacts) {
          if (contact.renewalPreviousExpiry != null && (expires == null || expires === contact.renewalPreviousExpiry)) continue;
          contact.expires = expires;
          delete contact.renewalPreviousExpiry;
          resolved.add(contact);
        }
      }
      for (const endpoint of endpoints) {
        if (generations.get(endpoint) !== this.contactGenerations.get(endpoint)) continue;
        const contacts = this.contactKeys(endpoint).flatMap(owner => [...(this.contactsByEndpoint.get(owner)?.values() || [])]);
        if (contacts.some((contact) => contact.status !== 'offline' && !resolved.has(contact))) continue;
        this.dirtyContacts.delete(endpoint); this.contactGenerations.delete(endpoint);
      }
      // Missing or concurrently changed rows remain pending without starving later endpoints.
      for (const endpoint of endpoints) if (this.dirtyContacts.has(endpoint)) { this.dirtyContacts.delete(endpoint); this.dirtyContacts.add(endpoint); }
    } catch { if (this.current(generation)) this.inventorySource = this.failedSource(this.inventorySource, 'contactExpirationRefreshFailed'); }
  }
  private expireContacts(): void {
    for (const row of this.inventory) row.status = this.inventoryStatus(row.id, row.kind);
  }
  private async refreshAI(): Promise<void> {
    const candidates = [...this.channels.values()].filter((channel) => channel.tenant != null && /stasis|voice.?robot/i.test(channel.application));
    if (!candidates.length) { this.aiWorked.clear(); return; }
    const generation = this.generation;
    try {
      if (!this.aiTables) {
        const tables = await this.store.sequelize.getQueryInterface().showAllTables();
        if (!this.current(generation)) return;
        this.aiTables = new Set(tables.map((table) => typeof table === 'string' ? table : (table as { tableName?: string }).tableName || String(table)));
      }
      const ids = [...new Set(candidates.flatMap((channel) => [channel.id, channel.linkedid]))];
      const worked = new Set<string>();
      // Legacy STT/response logs precede or swallow TTS failures, so they cannot
      // prove a working voice session. Only confirmed v2 playback is positive AI evidence.
      if (this.aiTables.has('ai_voice_sessions') && this.aiTables.has('ai_voice_turns')) {
        const rows = await this.store.select<{ vpbx_user_uid: number; channel_uniqueid: string }>("SELECT DISTINCT s.vpbx_user_uid,s.channel_uniqueid FROM ai_voice_sessions s WHERE s.channel_uniqueid IN (:ids) AND s.ingress_kind<>'browser_test' AND EXISTS (SELECT 1 FROM ai_voice_turns t WHERE t.vpbx_user_uid=s.vpbx_user_uid AND t.session_id=s.id AND t.role='assistant' AND t.played_until_ms>0)", { ids });
        for (const row of rows) worked.add(`${row.vpbx_user_uid}:${row.channel_uniqueid}`);
      }
      if (this.current(generation)) this.aiWorked = worked;
    } catch { if (this.current(generation)) this.callsSource = this.failedSource(this.callsSource, 'aiLiveEvidenceUnavailable'); }
  }
  private captureOrigin(channel: Channel): void {
    if (channel.tenant == null) return;
    const key = channel.tenant + ':' + channel.linkedid, origin = this.origins.get(key);
    const root = channel.id === channel.linkedid ? channel : this.channels.get(channel.linkedid);
    if (root && root.tenant === channel.tenant && !origin?.locked && (origin || this.origins.size < 100000)) {
      const observed = this.inferOrigin(root, root.id === channel.id ? [root] : [root, channel]);
      this.origins.set(key, { ...observed, src: origin?.src ?? observed.src, started: origin?.started ?? observed.started,
        origin: origin && origin.origin !== 'telephony' ? origin.origin : observed.origin });
    }
  }
  private inferOrigin(first: Channel, group: Channel[]): CallOrigin {
    const employee = /^PJSIP\/ew?/.test(first.channel);
    const incoming = /sip-in/.test(first.context) || first.channel.includes('/t_');
    const outgoing = /sip-out/.test(first.context) || employee && group.some(c => c.id !== first.id && c.channel.includes('/t_'));
    const internal = employee && !incoming && !outgoing;
    return { direction: incoming ? 'in' : outgoing ? 'out' : internal ? 'internal' : 'external', src: first.src, started: first.started,
      origin: /autodial/i.test(first.context) ? 'autodial' : group.some(c => /stasis|voice.?robot/i.test(c.application)) ? 'ai' : 'telephony',
      locked: incoming || outgoing || group.filter(c => /^PJSIP\/ew?/.test(c.channel)).length > 1 };
  }
  private buildPayload(): LivePayload {
    let calls: LivePayload['calls'] = {}; const live: LivePayload['live'] = {};
    const grouped = new Map<string, Channel[]>();
    const owners = new Map<string, Set<number>>();
    for (const channel of this.channels.values()) if (channel.tenant != null) {
      if (!owners.has(channel.linkedid)) owners.set(channel.linkedid, new Set());
      owners.get(channel.linkedid)!.add(channel.tenant);
    }
    for (const channel of this.channels.values()) {
      const ownersForLink = owners.get(channel.linkedid);
      // Unattributed Local/ExternalMedia legs may join only one unambiguous tenant call.
      const tenant = channel.tenant ?? (ownersForLink?.size === 1 ? [...ownersForLink][0] : null);
      if (tenant == null) continue;
      const key = `${tenant}:${this.store.nodeId}:${channel.linkedid}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push({ ...channel, tenant });
    }
    for (const group of grouped.values()) {
      const known = group.find((c) => c.tenant != null && /^PJSIP\//.test(c.channel)); if (!known) continue;
      const tenant = known.tenant!; const linkedid = known.linkedid;
      const sorted = [...group].sort((a, b) => a.started - b.started);
      const root = group.find(c => c.id === linkedid && /^PJSIP\//.test(c.channel));
      const first = root || sorted.find((c) => /^PJSIP\//.test(c.channel)) || known;
      const originKey = tenant + ':' + linkedid;
      const observed = this.inferOrigin(first, group), previousOrigin = this.origins.get(originKey);
      const origin = previousOrigin && (!root || previousOrigin.locked) ? { ...previousOrigin } : { ...observed, started: previousOrigin?.started ?? observed.started };
      if (observed.origin === 'autodial' || origin.origin === 'telephony') origin.origin = observed.origin;
      if (this.origins.has(originKey) || this.origins.size < 100000) this.origins.set(originKey, origin);
      const started = Math.min(origin.started, sorted[0].started);
      const humanUp = group.some((c) => /^PJSIP\/ew?/.test(c.channel) && /up/i.test(c.state));
      const connected = group.some((c) => c.bridged) || group.filter((c) => /^PJSIP\//.test(c.channel) && /^up$/i.test(c.state)).length >= 2;
      const workingAI = group.some((c) => this.aiWorked.has(`${tenant}:${c.id}`) || this.aiWorked.has(`${tenant}:${c.linkedid}`));
      const waiting = group.some((c) => c.state === 'waiting' || /queue|ivr|background|waitexten|playback|voicemail/i.test(c.application));
      const ringing = group.some((c) => /ring/i.test(c.state));
      const state = humanUp && connected || workingAI ? 'talking' : waiting || !ringing && group.some((c) => /^up$/i.test(c.state)) ? 'waiting' : 'ringing';
      const direction = origin.direction;
      const participants = participantTokens(group.map((c) => ({ uniqueid: c.id, channel: c.channel, dst: c.dst, usrc: c.src })), tenant);
      if (!calls[tenant]) calls[tenant] = [];
      calls[tenant].push({ id: createHash('sha256').update(`${tenant}:${this.store.nodeId}:${linkedid}`).digest('hex'), linkedid, startedAt: new Date(started).toISOString(), endedAt: null, src: origin.src, dst: known.dst, direction, origin: origin.origin, outcome: 'active', reason: null, duration: Math.max(0, Math.round((Date.now() - started) / 1000)), state, participants, originState: { version: 3, locked: origin.locked } });
    }
    if (this.callsInitialized && this.ami.isConnected()) {
      const activeKeys = new Set([...grouped.values()].map(group => group[0].tenant + ':' + group[0].linkedid));
      for (const key of this.origins.keys()) if (!activeKeys.has(key)) this.origins.delete(key);
    }
    if (!this.callsInitialized) calls = this.fallbackPayload?.source.updatedAt ? this.fallbackPayload.calls : {};
    const inventory = this.inventoryInitialized ? this.inventory : this.fallbackPayload?.inventorySource.updatedAt ? this.fallbackPayload.inventory : [];
    const byTenant = new Map<string, Inventory[]>();
    for (const item of inventory) {
      const tenant = String(item.tenant);
      if (!byTenant.has(tenant)) byTenant.set(tenant, []);
      byTenant.get(tenant)!.push(item);
    }
    const tenants = new Set([...Object.keys(calls), ...byTenant.keys()]);
    for (const tenant of tenants) live[tenant] = this.liveFor(calls[tenant] || [], byTenant.get(tenant) || [], this.callsSource);
    return { version: String(Date.now()), source: this.callsSource, inventorySource: this.inventorySource, calls, inventory, live };
  }
  private liveFor(calls: DashboardCall[], inventory: Inventory[], source: DashboardSource): DashboardLive {
    const count = (kind: Inventory['kind']) => ({ online: inventory.filter((i) => i.kind === kind && i.status === 'online').length, total: inventory.filter((i) => i.kind === kind && i.enabled).length, unknown: inventory.filter((i) => i.kind === kind && i.status === 'unknown').length });
    return { activeCalls: calls.length, ringing: calls.filter((c) => c.state === 'ringing').length, talking: calls.filter((c) => c.state === 'talking').length, waiting: calls.filter((c) => c.state === 'waiting').length, endpoints: count('endpoint'), trunks: count('trunk'), source };
  }
  private async read(): Promise<LivePayload> {
    return this.cache.get(`live:${this.store.nodeId}`, 5000, async () => {
      try {
        const [row] = await this.store.select<DashboardStoredSnapshot>(DASHBOARD_SNAPSHOT_SELECT, { node: this.store.nodeId, inventoryNode: dashboardInventoryKey(this.store.nodeId), maxBytes: this.maxFallbackBytes });
        if (!row) throw new Error('live projection missing');
        const payload = decodeDashboardSnapshot<LivePayload>(this.store.nodeId, row);
        if (!payload || !payload.source || !payload.inventorySource || !Array.isArray(payload.inventory) || !payload.calls || !payload.live) throw new Error('invalid live projection');
        this.lastPayload = payload;
        const age = Date.now() - Number(row.updated_at);
        if (!Number.isFinite(age) || age > 45000 || age < -1000) return this.stalePayload(payload);
        return payload;
      } catch {
        if (this.lastPayload) return this.stalePayload(this.lastPayload);
        return { version: '0', source: { state: 'unavailable', updatedAt: null }, inventorySource: { state: 'unavailable', updatedAt: null }, calls: {}, inventory: [], live: {} };
      }
    });
  }
  private stalePayload(payload: LivePayload): LivePayload {
    return { ...payload, source: this.failedSource(payload.source), inventorySource: this.failedSource(payload.inventorySource) };
  }
  private combinedSource(payload: LivePayload): DashboardSource {
    return payload.source.state !== 'ok' ? payload.source : payload.inventorySource.state !== 'ok' ? payload.inventorySource : payload.source;
  }
  async overview(tenant: number, scope: CdrAccessScope | null = null): Promise<DashboardLive> {
    const payload = await this.read();
    if (!scope || !scope.operators.length && !scope.queues.length) {
      const result = payload.live[tenant] || this.liveFor([], [], payload.source);
      return { ...result, source: this.combinedSource(payload), callsSource: payload.source, inventorySource: payload.inventorySource };
    }
    return { ...this.liveFor((payload.calls[tenant] || []).filter((c) => scopeAllows(c.participants, scope)), payload.inventory.filter((i) => i.tenant === tenant), this.combinedSource(payload)), callsSource: payload.source, inventorySource: payload.inventorySource };
  }
  async calls(tenant: number, query: DashboardQuery, scope: CdrAccessScope | null = null): Promise<DashboardPage<DashboardCall>> {
    const payload = await this.read();
    const rows = (payload.calls[tenant] || []).filter((c) => scopeAllows(c.participants, scope) && (!query.direction || c.direction === query.direction) && (!query.origin || c.origin === query.origin) && (!query.state || c.state === query.state) && (!query.search || `${c.src} ${c.dst} ${c.linkedid}`.toLowerCase().includes(query.search.toLowerCase()))).sort((a, b) => b.startedAt.localeCompare(a.startedAt) || a.id.localeCompare(b.id));
    return this.page(rows, query, payload.version, payload.source, (c) => ({ ...c, participants: undefined, originState: undefined } as DashboardCall), true);
  }
  async endpoints(tenant: number, query: DashboardQuery): Promise<DashboardPage<DashboardEndpoint>> { return this.inventoryPage('endpoint', tenant, query); }
  async trunks(tenant: number, query: DashboardQuery): Promise<DashboardPage<DashboardEndpoint>> { return this.inventoryPage('trunk', tenant, query); }
  private async inventoryPage(kind: Inventory['kind'], tenant: number, query: DashboardQuery): Promise<DashboardPage<DashboardEndpoint>> {
    const payload = await this.read(); const rows = payload.inventory.filter((i) => i.tenant === tenant && i.kind === kind && (!query.status || i.status === query.status) && (!query.search || `${i.id} ${i.name}`.toLowerCase().includes(query.search.toLowerCase()))).sort((a, b) => a.id.localeCompare(b.id));
    return this.page(rows, query, payload.version, payload.inventorySource, (i) => ({ id: i.id, name: i.name, status: i.status, enabled: i.enabled }));
  }
  private page<T extends { id: string; startedAt?: string }, R>(rows: T[], query: DashboardQuery, version: string, source: DashboardSource, map: (item: T) => R, calls = false): DashboardPage<R> {
    const limit = Math.max(1, Math.min(100, Math.floor(Number(query.limit)) || 50));
    let remaining = rows;
    if (query.cursor) {
      let cursor: { kind: string; id: string; at?: string };
      try {
        cursor = JSON.parse(Buffer.from(query.cursor, 'base64url').toString());
        if (cursor.kind !== (calls ? 'calls' : 'inventory') || typeof cursor.id !== 'string' || !cursor.id || cursor.id.length > 255 || calls && (!cursor.at || !Number.isFinite(Date.parse(cursor.at)))) throw new Error();
      } catch { throw new BadRequestException('Invalid dashboard cursor'); }
      remaining = rows.filter((row) => calls ? row.startedAt! < cursor.at! || row.startedAt === cursor.at && row.id > cursor.id : row.id > cursor.id);
    }
    const page = remaining.slice(0, limit); const last = page[page.length - 1];
    const cursor = last ? { kind: calls ? 'calls' : 'inventory', id: last.id, ...(calls ? { at: last.startedAt } : {}) } : null;
    return { rows: page.map(map), total: rows.length, nextCursor: remaining.length > limit && cursor ? Buffer.from(JSON.stringify(cursor)).toString('base64url') : null, version, source };
  }
}
