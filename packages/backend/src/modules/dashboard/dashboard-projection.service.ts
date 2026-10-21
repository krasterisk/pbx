import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'crypto';
import { buildCallFact, CALL_FACTS_VERSION } from '../calls/call-record';
import { artifactsForCall, enrichCallNames, loadCallEnrichment } from '../calls/call-enrichment';
import { DashboardReadStore } from './dashboard-read-store.service';
import { classifyDashboardCall, DASHBOARD_SEMANTICS_VERSION, DashboardEvidence, DashboardLeg, DashboardTechnicalApplication, endpointExtension, tenantFromChannel, parseDashboardTimestamp, dashboardCallKey } from './dashboard-classifier';
import { tenantLegFilter } from '../reports/cdr/cdr.utils';
import { celTimestampExpression } from '../calls/cel-timestamp';

interface DashboardCompletionSnapshot { updatedAt: number; calls: Map<number, Set<string>> }
interface DashboardPersistedProof { call_key: string; kind: string | null; value: string | null; origin: string }
interface DashboardStoredProof { through: number; human: boolean; ai: boolean; origin: string }
const technicalPriority: Record<DashboardTechnicalApplication, number> = { pickup: 1, ivr: 2, voicemail: 3 };
function mergeEvidence(target: DashboardEvidence, proof: DashboardEvidence): void {
  target.humanAnswered ||= proof.humanAnswered; target.aiWorked ||= proof.aiWorked;
  target.aiPresent ||= proof.aiPresent; target.autodial ||= proof.autodial;
  target.complete ||= proof.complete; target.completeThrough = Math.max(target.completeThrough || 0, proof.completeThrough || 0);
  if (proof.technicalApplication && (!target.technicalApplication || technicalPriority[proof.technicalApplication] > technicalPriority[target.technicalApplication])) target.technicalApplication = proof.technicalApplication;
}
/** Only background jobs touch CDR/CEL/AI source tables. All HTTP readers use projections. */
@Injectable()
export class DashboardProjectionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DashboardProjectionService.name);
  private readonly owner = randomUUID();
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private destroyed = false;
  private tables: Set<string> | null = null;
  private catchup = false;
  private continuation: ReturnType<typeof setTimeout> | null = null;
  private readonly batchSize = 500;
  private liveProof: Promise<DashboardCompletionSnapshot | null> | null = null;
  private lastPendingReplay = 0;
  constructor(private readonly store: DashboardReadStore, private readonly config: ConfigService) {}
  private get cdrTimezone(): string { return this.config.get<string>('DASHBOARD_CDR_TIMEZONE', 'UTC'); }
  onModuleInit(): void {
    this.timer = setInterval(() => { void this.tick(); }, 15000);
    this.timer.unref(); void this.tick();
  }
  async onModuleDestroy(): Promise<void> {
    this.destroyed = true;
    if (this.timer) clearInterval(this.timer);
    if (this.continuation) clearTimeout(this.continuation);
    if (!this.running) await this.store.releaseLease(`projection:${this.store.nodeId}`, this.owner).catch(() => undefined);
  }
  async tick(): Promise<void> {
    if (this.running || this.destroyed) return;
    this.running = true;
    const key = `projection:${this.store.nodeId}`;
    try {
      if (!await this.store.acquireLease(key, this.owner, 120000)) return;
      if (!this.tables) {
        const tables = await this.store.sequelize.getQueryInterface().showAllTables();
        this.tables = new Set(tables.map((t) => typeof t === 'string' ? t : (t as { tableName?: string }).tableName || String(t)));
      }
      if (!this.tables.has('cdr')) return;
      this.catchup = false;
      this.liveProof = this.readCompletionSnapshot();
      // Bounded work per cycle leaves room for collectors and ordinary application queries.
      await this.ingestCdr();
      if (this.tables.has('cel')) await this.ingestEvidence('cel', 'id', 'eventtime');
      if (this.tables.has('voice_robot_cdr')) await this.ingestEvidence('voice_robot_cdr', 'uid', 'started_at');
      if (this.tables.has('voice_robot_logs')) await this.ingestEvidence('voice_robot_logs', 'uid', 'timestamp');
      if (this.tables.has('ai_voice_events')) await this.ingestVoiceEvents();
      if (this.tables.has('call_facts')) {
        if (this.tables.has('voicemail_messages')) await this.ingestEvidence('voicemail_messages', 'uid', 'created_at');
        if (this.tables.has('sa_analysis_runs') && this.tables.has('sa_recording_relations')) await this.ingestAnalysisResults();
      }
      await this.replaySemantics();
      if (this.tables.has('call_dimensions')) await this.replayCallFacts();
      // Fast bootstrap continuations must not repeatedly replay the same active inventory.
      if (Date.now() - this.lastPendingReplay >= 5000) await this.replayPending();
      const sources = [`cdr:${this.store.nodeId}`, `semantics:v${DASHBOARD_SEMANTICS_VERSION}:${this.store.nodeId}`, ...['cel', 'voice_robot_cdr', 'voice_robot_logs', 'ai_voice_events'].filter((table) => this.tables?.has(table)).map((table) => `${table}:${this.store.nodeId}`)];
      if (this.tables.has('call_facts')) {
        if (this.tables.has('call_dimensions')) sources.push(`call-facts:v${CALL_FACTS_VERSION}:${this.store.nodeId}`);
        if (this.tables.has('voicemail_messages')) sources.push(`voicemail_messages:${this.store.nodeId}`);
        if (this.tables.has('sa_analysis_runs') && this.tables.has('sa_recording_relations')) sources.push(`call-analysis:${this.store.nodeId}`);
      }
      const checkpoints = await this.store.select<{ source_key: string; bootstrap_complete: number; initialized_from: number }>('SELECT source_key,bootstrap_complete,initialized_from FROM dashboard_checkpoints WHERE source_key IN (:sources)', { sources });
      const ready = checkpoints.length === sources.length && checkpoints.every((cp) => Number(cp.bootstrap_complete) === 1);
      await this.store.saveCheckpoint(`projection:${this.store.nodeId}`, Date.now(), Math.min(...checkpoints.map((cp) => Number(cp.initialized_from)), Date.now() - 31 * 86400000), ready, undefined, this.owner);
      await this.store.renewLease(key, this.owner, 120000);
    } catch (error) { this.catchup = false; this.logger.warn(`Dashboard projection cycle failed: ${error instanceof Error ? error.message : error}`);
      await this.store.saveCheckpoint(`projection:${this.store.nodeId}`, 0, Date.now() - 31 * 86400000, false, undefined, this.owner).catch(() => undefined);
    }
    finally {
      this.running = false;
      this.liveProof = null;
      if (this.catchup && !this.destroyed) {
        if (this.continuation) clearTimeout(this.continuation);
        this.continuation = setTimeout(() => { this.continuation = null; void this.tick(); }, 250);
        this.continuation.unref();
      }
      if (this.destroyed) await this.store.releaseLease(key, this.owner).catch(() => undefined);
    }
  }
  private sqlDate(ms: number, timezone = 'UTC'): string {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(ms));
    const value = (kind: string) => parts.find((p) => p.type === kind)?.value;
    return `${value('year')}-${value('month')}-${value('day')} ${value('hour')}:${value('minute')}:${value('second')}`;
  }
  private async ingestCdr(): Promise<void> {
    const source = `cdr:${this.store.nodeId}`;
    let cp = await this.store.checkpoint(source);
    // The call journal extends the SAME projection to the full CDR archive.
    // A pre-upgrade 31-day checkpoint must restart once, not silently skip old calls.
    const fullHistory = this.tables?.has('call_facts') === true;
    if (fullHistory && cp && Number(cp.initialized_from) > 0) cp = null;
    const from = fullHistory ? 0 : Number(cp?.initialized_from) || Date.now() - 31 * 86400000;
    let cursor = Number(cp?.cursor_value) || 0;
    let span = cp?.cursor_key || '';
    if (!cp) {
      const [first] = await this.store.select<{ id: number }>('SELECT id FROM cdr WHERE calldate>= :from ORDER BY id LIMIT 1', { from: this.sqlDate(from, this.cdrTimezone) });
      cursor = Math.max(0, Number(first?.id || 1) - 1);
      const [high] = await this.store.select<{ high: number }>('SELECT MAX(id) AS high FROM cdr WHERE calldate>= :from', { from: this.sqlDate(from, this.cdrTimezone) });
      span = JSON.stringify({ first: cursor + 1, highwater: Number(high?.high) || cursor });
    }
    const rows = await this.store.select<DashboardLeg>('SELECT * FROM cdr WHERE id> :cursor AND calldate>= :from ORDER BY id LIMIT :limit', { cursor, from: this.sqlDate(from, this.cdrTimezone), limit: this.batchSize });
    await this.reproject(rows);
    this.catchup ||= rows.length === this.batchSize;
    // Save after successful idempotent writes, never before them.
    if (rows.length) cursor = Math.max(...rows.map((r) => Number(r.id)));
    await this.store.saveCheckpoint(source, cursor, from, rows.length < this.batchSize, span, this.owner);
  }
  private async ingestEvidence(table: string, pk: string, date: string): Promise<void> {
    const source = `${table}:${this.store.nodeId}`;
    const cp = await this.store.checkpoint(source);
    const from = Number(cp?.initialized_from) || Date.now() - 31 * 86400000;
    const cursor = Number(cp?.cursor_value) || 0;
    const rows = await this.store.select<Record<string, any>>(`SELECT * FROM ${table} WHERE ${pk}> :cursor AND ${date}>= :from ORDER BY ${pk} LIMIT :limit`, { cursor, from: this.sqlDate(from), limit: this.batchSize });
    this.catchup ||= rows.length === this.batchSize;
    const ids = [...new Set(rows.flatMap((r) => [r.linkedid, r.uniqueid, r.call_uniqueid].filter(Boolean)))];
    if (ids.length) {
      const legs = await this.store.select<DashboardLeg>('SELECT * FROM cdr WHERE uniqueid IN (:ids) OR linkedid IN (:ids) ORDER BY id LIMIT 10001', { ids });
      if (legs.length > 10000) throw new Error('Evidence correlation batch exceeds projection budget');
      await this.reproject(legs);
    }
    await this.store.saveCheckpoint(source, rows.length ? Math.max(...rows.map((r) => Number(r[pk]))) : cursor, from, rows.length < this.batchSize, undefined, this.owner);
  }
  private async ingestVoiceEvents(): Promise<void> {
    const source = `ai_voice_events:${this.store.nodeId}`;
    const cp = await this.store.checkpoint(source);
    const from = Number(cp?.initialized_from) || Date.now() - 31 * 86400000;
    const cursor = Number(cp?.cursor_value) || from;
    const cursorKey = cp?.cursor_key || '';
    const rows = await this.store.select<Record<string, any>>('SELECT e.id,e.created_at,s.channel_uniqueid FROM ai_voice_events e JOIN ai_voice_sessions s ON s.id=e.session_id AND s.vpbx_user_uid=e.vpbx_user_uid WHERE (e.created_at> :from OR (e.created_at= :from AND e.id> :cursorKey)) ORDER BY e.created_at,e.id LIMIT :limit', { from: `${this.sqlDate(cursor)}.${String(cursor % 1000).padStart(3, '0')}`, cursorKey, limit: this.batchSize });
    this.catchup ||= rows.length === this.batchSize;
    const recent = rows.length < this.batchSize ? await this.store.select<Record<string, any>>('SELECT s.channel_uniqueid FROM ai_voice_events e JOIN ai_voice_sessions s ON s.id=e.session_id AND s.vpbx_user_uid=e.vpbx_user_uid WHERE e.created_at>= :recent ORDER BY e.created_at DESC,e.id DESC LIMIT :limit', { recent: `${this.sqlDate(Date.now() - 60000)}.${String((Date.now() - 60000) % 1000).padStart(3, '0')}`, limit: this.batchSize }) : [];
    const ids = [...new Set([...rows, ...recent].map((r) => r.channel_uniqueid).filter(Boolean))];
    if (ids.length) {
      const legs = await this.store.select<DashboardLeg>('SELECT * FROM cdr WHERE uniqueid IN (:ids) OR linkedid IN (:ids) ORDER BY id LIMIT 10001', { ids });
      if (legs.length > 10000) throw new Error('AI correlation batch exceeds projection budget');
      await this.reproject(legs);
    }
    const last = rows[rows.length - 1];
    await this.store.saveCheckpoint(source, last ? parseDashboardTimestamp(last.created_at, 'UTC') : cursor, from, rows.length < this.batchSize, last?.id || cursorKey, this.owner);
  }

  private async ingestAnalysisResults(): Promise<void> {
    const source = `call-analysis:${this.store.nodeId}`;
    const cp = await this.store.checkpoint(source);
    const at = Number(cp?.cursor_value) || 0;
    const rows = await this.store.select<{ id: string; recording_id: string; vpbx_user_uid: number; updated_at: string }>(
      'SELECT id,recording_id,vpbx_user_uid,updated_at FROM sa_analysis_runs WHERE updated_at > :at OR (updated_at=:at AND id > :id) ORDER BY updated_at,id LIMIT :limit',
      { at: `${this.sqlDate(at)}.${String(at % 1000).padStart(3, '0')}`, id: cp?.cursor_key || '', limit: this.batchSize });
    this.catchup ||= rows.length === this.batchSize;
    if (rows.length) {
      const relations = await this.store.select<{ source_id: string; linkedid: string | null; vpbx_user_uid: number }>(
        "SELECT DISTINCT r.source_id,r.linkedid,r.vpbx_user_uid FROM sa_recording_relations r JOIN sa_analysis_runs a ON a.recording_id=r.recording_id AND a.vpbx_user_uid=r.vpbx_user_uid WHERE a.id IN (:ids) AND r.source_kind='cdr' AND r.node_id=:nodeId", { ids: rows.map((row) => row.id), nodeId: this.store.nodeId });
      const ids = [...new Set(relations.flatMap((row) => [row.source_id, row.linkedid]).filter(Boolean))];
      if (ids.length) {
        const legs = await this.store.select<DashboardLeg>('SELECT * FROM cdr WHERE uniqueid IN (:ids) OR linkedid IN (:ids) ORDER BY id LIMIT 10001', { ids });
        if (legs.length > 10000) throw new Error('Analysis correlation batch exceeds projection budget');
        await this.reproject(legs);
      }
    }
    const last = rows[rows.length - 1];
    await this.store.saveCheckpoint(source, last ? parseDashboardTimestamp(last.updated_at, 'UTC') : at, 0, rows.length < this.batchSize, last?.id || cp?.cursor_key || '', this.owner);
  }

  private async readCompletionSnapshot(): Promise<DashboardCompletionSnapshot | null> {
    try {
      const [row] = await this.store.select<{ payload: string; updated_at: number }>('SELECT payload,updated_at FROM dashboard_live_state WHERE node_id= :node', { node: this.store.nodeId });
      if (!row) return null;
      const updatedAt = Number(row.updated_at); const age = Date.now() - updatedAt;
      if (!Number.isFinite(updatedAt) || age > 45000 || age < -1000) return null;
      const payload = typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload;
      if (payload?.source?.state !== 'ok' || !payload.calls || typeof payload.calls !== 'object' || Array.isArray(payload.calls)) return null;
      const calls = new Map<number, Set<string>>();
      for (const [tenant, rows] of Object.entries(payload.calls)) {
        if (!/^\d+$/.test(tenant) || !Array.isArray(rows)) return null;
        const linkedids = new Set<string>();
        for (const call of rows) {
          if (!call || typeof call.linkedid !== 'string' || !call.linkedid) return null;
          linkedids.add(call.linkedid);
        }
        calls.set(Number(tenant), linkedids);
      }
      return { updatedAt, calls };
    } catch { return null; } // An unavailable source cannot turn an incomplete call into a final result.
  }
  private async replayPending(): Promise<void> {
    const source = `pending:${this.store.nodeId}`;
    const cp = await this.store.checkpoint(source);
    const cursor = cp?.cursor_key || '';
    const rows = await this.store.select<{ call_key: string; tenant: number; linkedid: string }>('SELECT call_key,tenant,linkedid FROM dashboard_calls WHERE node_id= :node AND ended_at IS NULL AND call_key> :cursor ORDER BY call_key LIMIT :limit', { node: this.store.nodeId, cursor, limit: this.batchSize });
    // Reprojection loads each tenant's full logical groups in batches, never per pending call.
    await this.reproject(rows.map((row) => ({ vpbx_user_uid: Number(row.tenant), uniqueid: row.linkedid, linkedid: row.linkedid })));
    const next = rows.length === this.batchSize ? rows[rows.length - 1].call_key : '';
    await this.store.saveCheckpoint(source, 0, Number(cp?.initialized_from) || Date.now(), true, next, this.owner);
    this.lastPendingReplay = Date.now();
  }

  private async replaySemantics(): Promise<void> {
    const source = `semantics:v${DASHBOARD_SEMANTICS_VERSION}:${this.store.nodeId}`;
    const cp = await this.store.checkpoint(source);
    if (cp && Number(cp.cursor_value) === DASHBOARD_SEMANTICS_VERSION && Number(cp.bootstrap_complete) === 1) return;
    const from = Number(cp?.initialized_from) || Date.now() - 31 * 86400000;
    let after = '0'.repeat(64); let upper: string;
    if (cp?.cursor_key) {
      if (!/^[a-f0-9]{128}$/.test(cp.cursor_key)) throw new Error('Invalid dashboard semantics replay cursor');
      after = cp.cursor_key.slice(0, 64); upper = cp.cursor_key.slice(64);
    } else {
      const [row] = await this.store.select<{ call_key: string }>('SELECT call_key FROM dashboard_calls WHERE node_id= :node AND started_at>= :from ORDER BY call_key DESC LIMIT 1', { node: this.store.nodeId, from });
      upper = row?.call_key || '';
      // Freeze the scan boundary before work, so restarts do not chase newly created calls.
      await this.store.saveCheckpoint(source, DASHBOARD_SEMANTICS_VERSION, from, !upper, upper ? after + upper : '', this.owner);
      if (!upper) return;
    }
    const rows = await this.store.select<{ call_key: string; tenant: number; linkedid: string }>('SELECT call_key,tenant,linkedid FROM dashboard_calls WHERE node_id= :node AND started_at>= :from AND call_key> :after AND call_key<= :upper ORDER BY call_key LIMIT :limit', { node: this.store.nodeId, from, after, upper, limit: this.batchSize });
    await this.reproject(rows.map((row) => ({ vpbx_user_uid: Number(row.tenant), uniqueid: row.linkedid, linkedid: row.linkedid })));
    if (this.destroyed) throw new Error('Projection stopped before semantics checkpoint');
    const next = rows.length ? rows[rows.length - 1].call_key : after;
    const complete = rows.length < this.batchSize || next === upper;
    // The store fences both initialization and cursor advancement with the projection lease.
    await this.store.saveCheckpoint(source, DASHBOARD_SEMANTICS_VERSION, from, complete, next + upper, this.owner);
    this.catchup ||= !complete;
  }

  private async replayCallFacts(): Promise<void> {
    const source = `call-facts:v${CALL_FACTS_VERSION}:${this.store.nodeId}`;
    const cp = await this.store.checkpoint(source);
    if (Number(cp?.bootstrap_complete) === 1) return;
    const cursor = cp?.cursor_key || '';
    const rows = await this.store.select<{ call_key: string; tenant: number; linkedid: string }>(
      'SELECT call_key,tenant,linkedid FROM dashboard_calls WHERE node_id=:node AND call_key > :cursor ORDER BY call_key LIMIT :limit',
      { node: this.store.nodeId, cursor, limit: this.batchSize });
    await this.reproject(rows.map(row => ({ uniqueid: row.linkedid, linkedid: row.linkedid, vpbx_user_uid: Number(row.tenant) })));
    const complete = rows.length < this.batchSize;
    await this.store.saveCheckpoint(source, CALL_FACTS_VERSION, 0, complete, rows.at(-1)?.call_key || cursor, this.owner);
    this.catchup ||= !complete;
  }

  async reproject(rows: DashboardLeg[]): Promise<void> {
    const groups = new Map<number, Set<string>>();
    for (const row of rows) {
      const tenant = row.vpbx_user_uid == null ? tenantFromChannel(row.channel, row.dcontext) ?? tenantFromChannel(row.dstchannel) : Number(row.vpbx_user_uid);
      if (tenant == null || !Number.isInteger(tenant) || tenant < 0 || !row.uniqueid) continue;
      if (!groups.has(tenant)) groups.set(tenant, new Set());
      groups.get(tenant)!.add(row.linkedid || row.uniqueid);
    }
    if (!groups.size) return;
    const snapshot = await (this.liveProof || this.readCompletionSnapshot());
    let writes = 0;
    for (const [tenant, set] of groups) {
      const keys = [...set]; const tenantFilter = tenantLegFilter(tenant);
      for (let offset = 0; offset < keys.length; offset += 100) {
        if (this.destroyed) throw new Error('Projection stopped before batch completion');
        const ids = keys.slice(offset, offset + 100);
        tenantFilter.replacements.ctxOutLike = `sip-out${tenant}-%`;
        tenantFilter.replacements.ctxInLike = `sip-in${tenant}-%`;
        tenantFilter.replacements.ctxOutUnder = `sip-out${tenant}\\_%`;
        tenantFilter.replacements.ctxInUnder = `sip-in${tenant}\\_%`;
        tenantFilter.sql = tenantFilter.sql.replace('OR c.dcontext LIKE :ctxInLike', 'OR c.dcontext LIKE :ctxInLike OR c.dcontext LIKE :ctxOutUnder OR c.dcontext LIKE :ctxInUnder');
        const legs = await this.store.select<DashboardLeg>(`SELECT c.* FROM cdr c WHERE ${tenantFilter.sql} AND (c.linkedid IN (:ids) OR c.uniqueid IN (:ids)) ORDER BY c.id LIMIT 20001`, { ...tenantFilter.replacements, ids });
        // Fail the batch before advancing checkpoints if an abnormal call fanout exceeds the bounded work budget.
        if (legs.length > 20000) throw new Error('Logical call leg batch exceeds safe projection budget');
        const logical = new Map<string, DashboardLeg[]>();
        for (const leg of legs) {
          const inferred = leg.vpbx_user_uid == null ? tenantFromChannel(leg.channel, leg.dcontext) ?? tenantFromChannel(leg.dstchannel) : Number(leg.vpbx_user_uid);
          if (inferred !== tenant) continue;
          const key = leg.linkedid || leg.uniqueid;
          if (!logical.has(key)) logical.set(key, []);
          logical.get(key)!.push(leg);
        }
        const evidenceMap = await this.evidenceBatch(tenant, [...logical.values()].flat());
        const callKeys = [...logical.keys()].map((key) => dashboardCallKey(tenant, this.store.nodeId, key));
        const proofRows = callKeys.length ? await this.store.select<DashboardPersistedProof>("SELECT c.call_key,c.origin,p.kind,p.value FROM dashboard_calls c LEFT JOIN dashboard_participants p ON p.call_key=c.call_key AND p.tenant=c.tenant AND p.kind IN ('completion','answer') WHERE c.tenant= :tenant AND c.call_key IN (:callKeys)", { tenant, callKeys }) : [];
        const persisted = new Map<string, DashboardStoredProof>();
        for (const row of proofRows) {
          const proof = persisted.get(row.call_key) || { through: 0, human: false, ai: false, origin: row.origin };
          if (row.kind === 'completion') proof.through = Math.max(proof.through, Number(row.value) || 0);
          if (row.kind === 'answer') { proof.human ||= row.value === 'v3:human'; proof.ai ||= row.value === 'v3:ai'; }
          persisted.set(row.call_key, proof);
        }
        const enrichment = this.tables?.has('call_facts') ? await loadCallEnrichment(this.store, this.tables, tenant, legs, this.store.nodeId) : null;
        for (const callLegs of logical.values()) {
          if (callLegs.some((leg) => !Number.isFinite(parseDashboardTimestamp(leg.calldate, this.cdrTimezone)))) {
            const badSource = `cdrInvalid:${this.store.nodeId}`;
            const previous = await this.store.checkpoint(badSource);
            await this.store.saveCheckpoint(badSource, Math.max(Number(previous?.cursor_value) || 0, ...callLegs.map((leg) => Number(leg.id) || 0)), Date.now(), false, undefined, this.owner);
            this.logger.warn('Skipped CDR call with invalid timestamp; history is marked incomplete');
            continue;
          }
          const evidence: DashboardEvidence = {};
          for (const leg of callLegs) {
            for (const id of [leg.uniqueid, leg.linkedid]) {
              const proof = id ? evidenceMap.get(id) : undefined;
              if (proof) mergeEvidence(evidence, proof);
            }
          }
          const linkedid = callLegs[0].linkedid || callLegs[0].uniqueid;
          const latestEnd = Math.max(...callLegs.map((leg) => parseDashboardTimestamp(leg.calldate, this.cdrTimezone) + Math.max(0, Number(leg.duration) || 0) * 1000));
          const previous = persisted.get(dashboardCallKey(tenant, this.store.nodeId, linkedid));
          const previousThrough = previous?.through || 0;
          if (previous) {
            // Preserve only versioned positive provenance; an old accepted outcome is not evidence.
            evidence.humanAnswered ||= previous.human; evidence.aiWorked ||= previous.ai;
            evidence.aiPresent ||= previous.ai || previous.origin === 'ai'; evidence.autodial ||= previous.origin === 'autodial';
          }
          evidence.active = snapshot?.calls.get(tenant)?.has(linkedid) || false;
          if (evidence.active) { evidence.complete = false; evidence.completeThrough = undefined; }
          else if (previousThrough >= latestEnd) { evidence.complete = true; evidence.completeThrough = previousThrough; }
          else if (evidence.complete) evidence.completeThrough = Math.max(latestEnd, evidence.completeThrough || 0);
          else if (snapshot && snapshot.updatedAt >= latestEnd) { evidence.complete = true; evidence.completeThrough = snapshot.updatedAt; }
          const classified = classifyDashboardCall(tenant, this.store.nodeId, callLegs, evidence, this.cdrTimezone);
          if (enrichment) {
            const fact = buildCallFact(classified, callLegs, evidence, this.cdrTimezone, enrichment.events, artifactsForCall(callLegs, enrichment));
            enrichCallNames(fact, enrichment);
            classified.fingerprint = createHash('sha256').update(classified.fingerprint + JSON.stringify(fact)).digest('hex');
            await this.store.putCall(classified, this.owner, fact);
          } else await this.store.putCall(classified, this.owner);
          if (++writes % 25 === 0 && !await this.store.renewLease(`projection:${this.store.nodeId}`, this.owner, 120000)) throw new Error('Projection ownership lost');
        }
      }
    }
  }
  private async evidenceBatch(tenant: number, legs: DashboardLeg[]): Promise<Map<string, DashboardEvidence>> {
    const ids = [...new Set(legs.flatMap((l) => [l.uniqueid, l.linkedid].filter(Boolean)))];
    const result = new Map<string, DashboardEvidence>();
    if (!ids.length) return result;
    const add = (id: string, proof: DashboardEvidence) => { const combined = result.get(id) || {}; mergeEvidence(combined, proof); result.set(id, combined); };
    if (this.tables?.has('cel')) {
      const events = await this.store.select<Record<string, any>>(`SELECT uniqueid,linkedid,eventtype,channame,${await celTimestampExpression(this.store)} AS eventtime,context,appname,appdata,peer,extra FROM cel WHERE (linkedid IN (:ids) OR uniqueid IN (:ids)) AND eventtype IN ('ANSWER','BRIDGE_ENTER','LINKEDID_END','APP_START','APP_END','STREAM_BEGIN','STREAM_END') ORDER BY id LIMIT 100001`, { ids });
      if (events.length > 100000) throw new Error('CEL evidence exceeds projection budget');
      const byUniqueid = new Map<string, Set<string>>(); const byChannel = new Map<string, Set<string>>();
      const destinations = new Map<string, Set<string>>();
      const index = (map: Map<string, Set<string>>, value: string | undefined, key: string) => { if (value) { if (!map.has(value)) map.set(value, new Set()); map.get(value)!.add(key); } };
      for (const leg of legs) {
        const key = leg.linkedid || leg.uniqueid; index(byUniqueid, leg.uniqueid, key);
        index(byChannel, leg.channel, key); index(byChannel, leg.dstchannel, key);
        if (endpointExtension(leg.dstchannel, tenant)) index(destinations, leg.dstchannel, key);
      }
      const peers = (event: Record<string, any>): string[] => {
        const values: unknown[] = [event.peer];
        try {
          const extra = typeof event.extra === 'string' ? JSON.parse(event.extra) : event.extra;
          if (extra && typeof extra === 'object') values.push(extra.peer, extra.peers, extra.bridge_peer, extra.bridge_peers);
        } catch { /* An arbitrary bridge_id alone is not a conversation proof. */ }
        return values.flatMap((value) => Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : []).filter((value): value is string => typeof value === 'string').map((value) => value.trim()).filter(Boolean);
      };
      for (const event of events) {
        // Every evidence type must bind to an owned CDR leg, not merely a colliding linkedid.
        const channelTenant = tenantFromChannel(event.channame);
        if (channelTenant != null && channelTenant !== tenant) continue;
        const uidKeys = byUniqueid.get(event.uniqueid); const channelKeys = byChannel.get(event.channame);
        const owned = uidKeys && channelKeys ? new Set([...uidKeys].filter((key) => channelKeys.has(key))) : uidKeys || channelKeys || new Set<string>();
        for (const key of owned) {
          if (event.linkedid && event.linkedid !== key) continue;
          if (event.eventtype === 'LINKEDID_END') {
            const at = parseDashboardTimestamp(event.eventtime, this.cdrTimezone);
            add(key, { complete: true, completeThrough: Number.isFinite(at) ? at : 0 });
            continue;
          }
          const app = String(event.appname || '');
          const technicalApplication: DashboardTechnicalApplication | undefined = /^VoiceMail$/i.test(app) ? 'voicemail' : /^(?:Playback|Background|Read|WaitExten|IVR)$/i.test(app) ? 'ivr' : /^Answer$/i.test(app) ? 'pickup' : undefined;
          if (technicalApplication) add(key, { technicalApplication });
          if (event.eventtype === 'ANSWER' && !technicalApplication && destinations.get(event.channame)?.has(key)) add(key, { humanAnswered: true });
          if (event.eventtype === 'BRIDGE_ENTER' && endpointExtension(event.channame, tenant) && byChannel.get(event.channame)?.has(key)) {
            // Asterisk's canonical CEL peer is a comma-separated channel list; extra may carry it in adapters.
            // Only a distinct, owned SIP peer proves conversation, not Local IVR/media or a bridge id.
            const conversationalPeer = peers(event).some((peer) => peer !== event.channame && /^PJSIP\//i.test(peer) && byChannel.get(peer)?.has(key) && (tenantFromChannel(peer) == null || tenantFromChannel(peer) === tenant));
            if (conversationalPeer) add(key, { humanAnswered: true });
          }
        }
      }
    }
    if (this.tables?.has('voice_robot_cdr')) {
      const rows = await this.store.select<{ call_uniqueid: string }>('SELECT DISTINCT call_uniqueid FROM voice_robot_cdr WHERE user_uid= :tenant AND call_uniqueid IN (:ids)', { tenant, ids });
      for (const row of rows) add(row.call_uniqueid, { aiPresent: true });
    }
    if (this.tables?.has('voice_robot_logs')) {
      const rows = await this.store.select<{ call_uniqueid: string }>("SELECT DISTINCT call_uniqueid FROM voice_robot_logs WHERE user_uid= :tenant AND call_uniqueid IN (:ids)", { tenant, ids });
      // Legacy logs are written before TTS/actions and do not confirm successful playback.
      for (const row of rows) add(row.call_uniqueid, { aiPresent: true });
    }
    if (this.tables?.has('ai_voice_sessions') && this.tables?.has('ai_voice_turns')) {
      const rows = await this.store.select<{ channel_uniqueid: string; worked: number; autodial: number }>("SELECT s.channel_uniqueid,MAX(CASE WHEN s.ingress_kind='autodial' THEN 1 ELSE 0 END) AS autodial,MAX(CASE WHEN EXISTS (SELECT 1 FROM ai_voice_turns t WHERE t.vpbx_user_uid= :tenant AND t.session_id=s.id AND t.role='assistant' AND t.played_until_ms>0) THEN 1 ELSE 0 END) AS worked FROM ai_voice_sessions s WHERE s.vpbx_user_uid= :tenant AND s.channel_uniqueid IN (:ids) AND s.ingress_kind<>'browser_test' GROUP BY s.channel_uniqueid", { tenant, ids });
      for (const row of rows) { const previous = result.get(row.channel_uniqueid); add(row.channel_uniqueid, { aiPresent: true, aiWorked: previous?.aiWorked || Number(row.worked) > 0, autodial: Number(row.autodial) > 0 }); }
    }
    return result;
  }
}
