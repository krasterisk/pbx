import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Sequelize } from 'sequelize-typescript';
import { QueryTypes, Transaction } from 'sequelize';
import { createHash } from 'crypto';
import type { DashboardBucket, DashboardCall, DashboardPage, DashboardPeriod as Period, DashboardQuery, DashboardSource, DashboardTotals } from '@krasterisk/shared';
import type { CdrAccessScope } from '../reports/cdr/cdr-access-scope';
import type { DashboardClassifiedCall } from './dashboard-classifier';
import { DashboardCacheService } from './dashboard-cache.service';
import { resolveDashboardPeriod } from './dashboard-period';
import { normalizeCallNumber } from '@krasterisk/shared';
import { CALL_FACTS_VERSION, type CallFact } from '../calls/call-record';
import { callDimensions } from '../calls/call-dimensions';

export const emptyDashboardTotals = (): DashboardTotals => ({ total: 0, incoming: 0, outgoing: 0, internal: 0, external: 0, accepted: 0, missed: 0, unknown: 0 });
export interface DashboardSummary { period: Period; totals: DashboardTotals; buckets: DashboardBucket[]; source: DashboardSource; version: string }
interface SqlFilter { sql: string; replacements: Record<string, unknown> }
export interface DashboardCheckpoint { cursor_value: number; initialized_from: number; bootstrap_complete: number; updated_at: number; cursor_key?: string | null }
const STEP = 300000;

@Injectable()
export class DashboardReadStore {
  readonly nodeId: string;
  constructor(readonly sequelize: Sequelize, private readonly config: ConfigService, private readonly cache: DashboardCacheService) {
    this.nodeId = this.config.get<string>('DASHBOARD_NODE_ID', this.config.get<string>('AMI_HOST', 'local'));
  }
  private get postgres(): boolean { return this.sequelize.getDialect() === 'postgres'; }
  async select<T = Record<string, unknown>>(sql: string, replacements: Record<string, unknown> = {}, transaction?: Transaction): Promise<T[]> {
    return this.sequelize.query(sql, { replacements, type: QueryTypes.SELECT, transaction }) as Promise<T[]>;
  }
  async execute(sql: string, replacements: Record<string, unknown>, transaction?: Transaction): Promise<void> {
    await this.sequelize.query(sql, { replacements, transaction });
  }
  async acquireLease(key: string, owner: string, ttlMs = 60000): Promise<boolean> {
    const now = Date.now(); const args = { key, owner, now, until: now + ttlMs };
    await this.execute('UPDATE dashboard_leases SET owner= :owner, expires_at= :until WHERE lease_key= :key AND (owner= :owner OR expires_at< :now)', args);
    await this.execute(this.postgres
      ? 'INSERT INTO dashboard_leases (lease_key,owner,expires_at) VALUES (:key,:owner,:until) ON CONFLICT (lease_key) DO NOTHING'
      : 'INSERT IGNORE INTO dashboard_leases (lease_key,owner,expires_at) VALUES (:key,:owner,:until)', args);
    const [row] = await this.select<{ owner: string; expires_at: number }>('SELECT owner,expires_at FROM dashboard_leases WHERE lease_key= :key', { key });
    return row?.owner === owner && Number(row.expires_at) > now;
  }
  async renewLease(key: string, owner: string, ttlMs = 60000): Promise<boolean> {
    await this.execute('UPDATE dashboard_leases SET expires_at= :until WHERE lease_key= :key AND owner= :owner AND expires_at>= :now', { key, owner, now: Date.now(), until: Date.now() + ttlMs });
    const [row] = await this.select<{ owner: string; expires_at: number }>('SELECT owner,expires_at FROM dashboard_leases WHERE lease_key= :key', { key });
    return row?.owner === owner && Number(row.expires_at) > Date.now();
  }
  async releaseLease(key: string, owner: string): Promise<void> {
    await this.execute('DELETE FROM dashboard_leases WHERE lease_key= :key AND owner= :owner', { key, owner });
  }
  async checkpoint(source: string): Promise<DashboardCheckpoint | null> {
    const [row] = await this.select<DashboardCheckpoint>('SELECT cursor_value,initialized_from,bootstrap_complete,updated_at,cursor_key FROM dashboard_checkpoints WHERE source_key= :source', { source });
    return row || null;
  }
  async saveCheckpoint(source: string, cursor: number, from: number, complete: boolean, cursorKey?: string, leaseOwner?: string): Promise<void> {
    const values = { source_key: source, cursor_value: cursor, initialized_from: from, bootstrap_complete: complete ? 1 : 0, updated_at: Date.now(), cursor_key: cursorKey || null };
    if (leaseOwner) {
      await this.sequelize.transaction(async (transaction) => {
        const [lease] = await this.select<{ owner: string; expires_at: number }>('SELECT owner,expires_at FROM dashboard_leases WHERE lease_key= :key FOR UPDATE', { key: `projection:${this.nodeId}` }, transaction);
        if (lease?.owner !== leaseOwner || Number(lease.expires_at) <= Date.now()) throw new Error('Projection ownership lost before checkpoint');
        await this.upsert('dashboard_checkpoints', values, ['source_key'], transaction);
        if (Date.now() >= Number(lease.expires_at)) throw new Error('Projection lease expired before checkpoint commit');
      });
    } else await this.upsert('dashboard_checkpoints', values, ['source_key']);
    this.cache.invalidate('source:');
  }
  async upsert(table: string, values: Record<string, unknown>, keys: string[], transaction?: Transaction): Promise<void> {
    const columns = Object.keys(values); const updates = columns.filter((c) => !keys.includes(c));
    const quoted = (c: string) => this.postgres ? `"${c}"` : `\`${c}\``;
    const clause = this.postgres
      ? `ON CONFLICT (${keys.map(quoted).join(',')}) DO UPDATE SET ${updates.map((c) => `${quoted(c)}=EXCLUDED.${quoted(c)}`).join(',')}`
      : `ON DUPLICATE KEY UPDATE ${updates.map((c) => `${quoted(c)}=VALUES(${quoted(c)})`).join(',')}`;
    await this.execute(`INSERT INTO ${table} (${columns.map(quoted).join(',')}) VALUES (${columns.map((c) => `:${c}`).join(',')}) ${clause}`, values, transaction);
  }
  async putCall(call: DashboardClassifiedCall, leaseOwner?: string, fact?: CallFact): Promise<boolean> {
    return this.sequelize.transaction(async (transaction) => {
      let leaseExpiry = Infinity;
      if (leaseOwner) {
        const [lease] = await this.select<{ owner: string; expires_at: number }>('SELECT owner,expires_at FROM dashboard_leases WHERE lease_key= :key FOR UPDATE', { key: `projection:${this.nodeId}` }, transaction);
        if (lease?.owner !== leaseOwner || Number(lease.expires_at) <= Date.now()) throw new Error('Projection ownership lost');
        leaseExpiry = Number(lease.expires_at);
      }
      const [old] = await this.select<Record<string, any>>('SELECT * FROM dashboard_calls WHERE call_key= :id FOR UPDATE', { id: call.id }, transaction);
      if (old?.fingerprint === call.fingerprint) return false;
      const row = { call_key: call.id, tenant: call.tenant, node_id: call.nodeId, linkedid: call.linkedid, started_at: Date.parse(call.startedAt), ended_at: call.endedAt ? Date.parse(call.endedAt) : null, src: call.src.slice(0, 128), dst: call.dst.slice(0, 128), direction: call.direction, origin: call.origin, outcome: call.outcome, reason: call.reason, duration: call.duration, fingerprint: call.fingerprint, updated_at: Date.now() };
      const bucketChanged = !old ||
        ['tenant', 'node_id', 'direction', 'origin', 'outcome'].some(key => old[key] !== row[key as keyof typeof row]) ||
        Math.floor(Number(old.started_at) / STEP) !== Math.floor(row.started_at / STEP);
      if (old && bucketChanged) await this.adjustBucket(old, -1, transaction);
      await this.upsert('dashboard_calls', row, ['call_key'], transaction);
      if (fact) {
        const parties = [fact.caller, fact.recipient, ...fact.participants];
        await this.upsert('call_facts', {
          call_key: call.id, tenant: call.tenant, outcome: fact.outcome,
          caller_number: normalizeCallNumber(fact.caller.number || ''), recipient_number: normalizeCallNumber(fact.recipient.number || ''),
          company_number: normalizeCallNumber(fact.companyNumber || ''), search_text: parties.flatMap((p) => [p.name, p.number, p.department]).filter(Boolean).join(' ').toLowerCase(),
          departments: JSON.stringify([...new Set(parties.map((party) => party.department).filter(Boolean))]).toLowerCase(),
          handling: JSON.stringify(fact.handling), has_voicemail: fact.hasVoicemail ? 1 : 0, analytics_state: fact.analytics?.state || 'none',
          connected_sec: fact.connectedSec, timing_source: fact.timingSource || null, payload: JSON.stringify(fact), schema_version: CALL_FACTS_VERSION,
        }, ['call_key'], transaction);
        await this.execute('DELETE FROM call_dimensions WHERE call_key=:id AND tenant=:tenant', { id: call.id, tenant: call.tenant }, transaction);
        const dimensions = callDimensions(fact);
        for (let offset = 0; offset < dimensions.length; offset += 100) {
          const replacements: Record<string, unknown> = { id: call.id, tenant: call.tenant };
          const values = dimensions.slice(offset, offset + 100).map((dimension, i) => {
            replacements[`kind${i}`] = dimension.kind;
            replacements[`value${i}`] = dimension.value;
            replacements[`label${i}`] = dimension.label;
            replacements[`searchLabel${i}`] = dimension.label.toLowerCase();
            return `(:id,:tenant,:kind${i},:value${i},:label${i},:searchLabel${i})`;
          });
          await this.execute(`INSERT INTO call_dimensions (call_key,tenant,kind,value,label,search_label) VALUES ${values.join(',')}`, replacements, transaction);
        }
      }
      await this.execute('DELETE FROM dashboard_participants WHERE call_key= :id', { id: call.id }, transaction);
      for (let offset = 0; offset < call.participants.length; offset += 100) {
        const replacements: Record<string, unknown> = { id: call.id, tenant: call.tenant };
        const values = call.participants.slice(offset, offset + 100).map((p, i) => { replacements[`k${i}`] = p.kind; replacements[`v${i}`] = p.value.slice(0, 128); return `(:id,:tenant,:k${i},:v${i})`; });
        if (values.length) await this.execute(`INSERT INTO dashboard_participants (call_key,tenant,kind,value) VALUES ${values.join(',')}`, replacements, transaction);
      }
      if (bucketChanged) await this.adjustBucket(row, 1, transaction);
      await this.bumpRevision(call.tenant, transaction);
      if (Date.now() >= leaseExpiry) throw new Error('Projection lease expired before commit');
      return true;
    });
  }
  private async bumpRevision(tenant: number, transaction: Transaction): Promise<void> {
    const values = { source: `revision:${tenant}`, now: Date.now() };
    const clause = this.postgres
      ? 'ON CONFLICT (source_key) DO UPDATE SET cursor_value=dashboard_checkpoints.cursor_value + 1,updated_at=EXCLUDED.updated_at'
      : 'ON DUPLICATE KEY UPDATE cursor_value=cursor_value + 1,updated_at=VALUES(updated_at)';
    await this.execute(`INSERT INTO dashboard_checkpoints (source_key,cursor_value,initialized_from,bootstrap_complete,updated_at,cursor_key) VALUES (:source,1,0,1,:now,NULL) ${clause}`, values, transaction);
  }
  private async snapshotVersion(tenant: number, scope: CdrAccessScope | null, permissionVersion: string, transaction: Transaction): Promise<string> {
    const [row] = await this.select<{ cursor_value: number | string }>('SELECT cursor_value FROM dashboard_checkpoints WHERE source_key= :source', { source: `revision:${tenant}` }, transaction);
    const effectiveScope = scope ? { operators: [...scope.operators].sort(), queues: [...scope.queues].sort(), ownExten: scope.ownExten } : null;
    return createHash('sha256').update(JSON.stringify({ tenant, scope: effectiveScope, permissionVersion, revision: String(row?.cursor_value || 0), calculation: 3 })).digest('hex');
  }
  private async adjustBucket(row: Record<string, any>, delta: number, transaction: Transaction): Promise<void> {
    // Current calls are represented by the live collector, never by history rollups.
    if (row.outcome === 'active') return;
    const values = { tenant: row.tenant, node_id: row.node_id, bucket_at: Math.floor(Number(row.started_at) / STEP) * STEP, direction: row.direction, origin: row.origin, outcome: row.outcome, delta };
    const dimensions = ['tenant', 'node_id', 'bucket_at', 'direction', 'origin', 'outcome'];
    const clause = this.postgres ? `ON CONFLICT (${dimensions.join(',')}) DO UPDATE SET call_count=dashboard_buckets.call_count+ :delta` : 'ON DUPLICATE KEY UPDATE call_count=call_count+ :delta';
    await this.execute(`INSERT INTO dashboard_buckets (${dimensions.join(',')},call_count) VALUES (${dimensions.map((k) => `:${k}`).join(',')},:delta) ${clause}`, values, transaction);
  }
  private filter(tenant: number, query: DashboardQuery, period: Period, scope: CdrAccessScope | null): SqlFilter {
    const clauses = ['c.tenant= :tenant', "c.outcome<>'active'", 'c.started_at>= :from', 'c.started_at< :to'];
    const replacements: Record<string, unknown> = { tenant, from: Date.parse(period.from), to: Date.parse(period.to) };
    for (const field of ['direction', 'origin', 'outcome'] as const) if (query[field]) { clauses.push(`c.${field}=:${field}`); replacements[field] = query[field]; }
    if (query.search?.trim()) { clauses.push('(LOWER(c.src) LIKE :search OR LOWER(c.dst) LIKE :search OR LOWER(c.linkedid) LIKE :search)'); replacements.search = `%${query.search.trim().toLowerCase().replace(/[\\%_]/g, '\\$&')}%`; }
    if (scope && (scope.operators.length || scope.queues.length)) {
      const terms: string[] = [];
      const ext = [...new Set([...scope.operators, ...(scope.ownExten ? [scope.ownExten] : [])])];
      if (ext.length) { terms.push("(p.kind='extension' AND p.value IN (:extensions))"); replacements.extensions = ext; }
      if (scope.queues.length) { terms.push("(p.kind='queue' AND p.value IN (:queues))"); replacements.queues = scope.queues; }
      clauses.push(`EXISTS (SELECT 1 FROM dashboard_participants p WHERE p.tenant= :tenant AND p.call_key=c.call_key AND (${terms.join(' OR ')}))`);
    }
    return { sql: clauses.join(' AND '), replacements };
  }
  private async historyState(): Promise<{ source: DashboardSource; version: string; initializedFrom: number | null }> {
    return this.cache.get<{ source: DashboardSource; version: string; initializedFrom: number | null }>(`source:${this.nodeId}`, 5000, async () => {
      const rows = await this.select<DashboardCheckpoint & { source_key: string }>('SELECT source_key,cursor_value,initialized_from,bootstrap_complete,updated_at,cursor_key FROM dashboard_checkpoints WHERE source_key IN (:sources)', { sources: [`cdr:${this.nodeId}`, `projection:${this.nodeId}`, `cdrInvalid:${this.nodeId}`] });
      const cp = rows.find((row) => row.source_key === `cdr:${this.nodeId}`);
      const readiness = rows.find((row) => row.source_key === `projection:${this.nodeId}`);
      const invalid = rows.some((row) => row.source_key === `cdrInvalid:${this.nodeId}`);
      if (!cp) return { source: { state: 'unavailable', updatedAt: null, message: 'projectionNotInitialized' }, version: '0', initializedFrom: null };
      const stale = invalid || !Number(cp.bootstrap_complete) || !readiness || !Number(readiness.bootstrap_complete) || Date.now() - Number(readiness.updated_at) > 90000;
      let progress: { percent: number | null } | undefined;
      if (!Number(cp.bootstrap_complete) && cp.cursor_key) {
        try { const span = JSON.parse(cp.cursor_key) as { first: number; highwater: number; high?: number }; const high = span.highwater ?? span.high; if (Number.isFinite(span.first)) progress = { percent: Number.isFinite(high) && high! >= span.first ? Math.min(99, Math.max(0, Math.floor(100 * (Number(cp.cursor_value) - span.first + 1) / (high! - span.first + 1)))) : null }; } catch { /* older checkpoint has no span */ }
      }
      const source: DashboardSource & { progress?: { percent: number | null } } = { state: stale ? 'stale' : 'ok', updatedAt: new Date(Number(readiness?.updated_at || cp.updated_at)).toISOString(), ...(invalid ? { message: 'historyInvalidTimestamps' } : !Number(cp.bootstrap_complete) ? { message: 'historyBackfillInProgress' } : stale ? { message: 'historyEvidenceIncomplete' } : {}), ...(progress ? { progress } : {}) };
      return { source, version: `${cp.updated_at}:${readiness?.updated_at || 0}`, initializedFrom: Number(cp.initialized_from) };
    }, (previous) => ({ ...previous, source: { ...previous.source, state: 'stale' as const, message: 'historyUnavailable' } }));
  }
  private cacheKey(tenant: number, query: DashboardQuery, period: Period, scope: CdrAccessScope | null, permissionVersion = ''): string {
    return createHash('sha256').update(JSON.stringify({ tenant, query, period: { ...period, to: query.period === 'custom' || query.period === 'yesterday' ? period.to : Math.floor(Date.parse(period.to) / 30000) }, scope, permissionVersion, calculation: 3 })).digest('hex');
  }
  async summary(tenant: number, query: DashboardQuery, timezone = 'UTC', scope: CdrAccessScope | null = null, permissionVersion = ''): Promise<DashboardSummary> {
    const period = resolveDashboardPeriod(query, timezone); const state = await this.historyState();
    const result = await this.cache.get(`summary:${this.cacheKey(tenant, query, period, scope, permissionVersion)}`, 30000, async () => this.sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.REPEATABLE_READ }, async (transaction) => {
      const version = await this.snapshotVersion(tenant, scope, permissionVersion, transaction);
      const filtered = this.filter(tenant, query, period, scope);
      const from = Date.parse(period.from); const to = Date.parse(period.to);
      const step = Math.ceil((to - from + STEP) / (299 * STEP)) * STEP;
      let rows: { bucket: number; direction: string; outcome: string; amount: number }[];
      if ((!scope || !scope.operators.length && !scope.queues.length) && !query.search) {
        // Full buckets use precomputed counters. Only two boundary buckets need the indexed projection.
        const fullFrom = Math.ceil(from / STEP) * STEP; const fullTo = Math.floor(to / STEP) * STEP;
        const dims = ['direction', 'outcome', 'origin'].filter((key) => query[key as keyof DashboardQuery]).map((key) => `AND ${key}=:${key}`).join(' ');
        rows = await this.select(`SELECT FLOOR(bucket_at/ :step)* :step AS bucket,direction,outcome,SUM(call_count) AS amount FROM dashboard_buckets WHERE tenant= :tenant AND outcome<>'active' AND bucket_at>= :fullFrom AND bucket_at< :fullTo ${dims} GROUP BY FLOOR(bucket_at/ :step)* :step,direction,outcome UNION ALL SELECT FLOOR(c.started_at/ :step)* :step AS bucket,c.direction,c.outcome,COUNT(*) AS amount FROM dashboard_calls c WHERE ${filtered.sql} AND (c.started_at< :fullFrom OR c.started_at>= :fullTo) GROUP BY FLOOR(c.started_at/ :step)* :step,c.direction,c.outcome`, { ...filtered.replacements, step, fullFrom, fullTo }, transaction);
      } else {
        rows = await this.select(`SELECT FLOOR(c.started_at/ :step)* :step AS bucket,c.direction,c.outcome,COUNT(*) AS amount FROM dashboard_calls c WHERE ${filtered.sql} GROUP BY FLOOR(c.started_at/ :step)* :step,c.direction,c.outcome`, { ...filtered.replacements, step }, transaction);
      }
      const totals = emptyDashboardTotals(); const buckets = new Map<number, DashboardBucket>();
      // Preserve elapsed quiet time. SQL rows use aligned internal keys; API boundaries
      // are clamped to the requested period so every click selects the actual interval.
      for (let at = Math.floor(from / step) * step; at < to && buckets.size < 300; at += step) {
        buckets.set(at, { ...emptyDashboardTotals(), at: new Date(Math.max(at, from)).toISOString(), until: new Date(Math.min(at + step, to)).toISOString() });
      }
      for (const row of rows) {
        const n = Number(row.amount); if (n <= 0 || row.outcome === 'active') continue;
        const bucket = buckets.get(Number(row.bucket));
        if (!bucket) continue;
        for (const target of [totals, bucket]) {
          target.total += n;
          const directionKey = ({ in: 'incoming', out: 'outgoing', internal: 'internal', external: 'external' } as const)[row.direction as 'in' | 'out' | 'internal' | 'external'];
          if (directionKey) target[directionKey] += n;
          if (row.direction === 'in' && ['accepted', 'missed', 'unknown'].includes(row.outcome)) target[row.outcome as 'accepted' | 'missed' | 'unknown'] += n;
        }
      }
      return { period, totals, buckets: [...buckets.values()].sort((a, b) => a.at.localeCompare(b.at)).slice(0, 300), source: this.coverage(state.source, period, state.initializedFrom), version };
    }), (previous) => ({ ...previous, source: { ...previous.source, state: 'stale' as const, message: 'historyUnavailable' } }));
    const source = state.source.state !== 'ok' ? { ...result.source, state: 'stale' as const, message: state.source.message } : result.source;
    return { ...result, source: this.coverage(source, result.period, state.initializedFrom) };
  }
  private coverage(source: DashboardSource, period: Period, initializedFrom: number | null): DashboardSource {
    if (initializedFrom == null) return source;
    const from = Date.parse(period.from); const to = Date.parse(period.to);
    if (to <= initializedFrom || from >= Date.now()) return { ...source, state: 'unavailable', message: 'historyOutsideCoverage' };
    if (from < initializedFrom) return { ...source, state: 'stale', message: 'historyPartialCoverage' };
    if (to > Date.now() + 1000) return { ...source, state: 'stale', message: 'historyFutureCoverage' };
    return source;
  }
  async calls(tenant: number, query: DashboardQuery, timezone = 'UTC', scope: CdrAccessScope | null = null, permissionVersion = ''): Promise<DashboardPage<DashboardCall>> {
    const period = resolveDashboardPeriod(query, timezone); const state = await this.historyState();
    const filter = this.filter(tenant, query, period, scope);
    const countFilter = { sql: filter.sql, replacements: { ...filter.replacements } };
    const limit = Math.max(1, Math.min(100, Math.floor(Number(query.limit)) || 50));
    if (query.cursor) {
      let cursor: { at: number; id: string };
      try { cursor = JSON.parse(Buffer.from(query.cursor, 'base64url').toString()); if (!Number.isFinite(cursor.at) || !/^[a-f0-9]{64}$/.test(cursor.id)) throw new Error(); } catch { throw new BadRequestException('Invalid dashboard cursor'); }
      filter.sql += ' AND (c.started_at< :cursorAt OR (c.started_at= :cursorAt AND c.call_key< :cursorId))';
      filter.replacements.cursorAt = cursor.at; filter.replacements.cursorId = cursor.id;
    }
    return this.sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.REPEATABLE_READ }, async (transaction) => {
      const version = await this.snapshotVersion(tenant, scope, permissionVersion, transaction);
      const requestedVersion = (query as DashboardQuery & { version?: string }).version;
      if (requestedVersion && requestedVersion !== version) throw new ConflictException({ code: 'DASHBOARD_SNAPSHOT_EXPIRED', message: 'Dashboard call data changed. Reload the details.' });
      const countKey = createHash('sha256').update(JSON.stringify({ tenant, scope, permissionVersion, version, period, direction: query.direction, outcome: query.outcome, origin: query.origin, search: query.search?.trim() || '', calculation: 3 })).digest('hex');
      const total = await this.cache.get(`count:${countKey}`, 30000, async () => {
        const [count] = await this.select<{ total: number | string }>(`SELECT COUNT(*) AS total FROM dashboard_calls c WHERE ${countFilter.sql}`, countFilter.replacements, transaction);
        return Number(count?.total) || 0;
      });
      const rows = await this.select<Record<string, any>>(`SELECT c.call_key,c.linkedid,c.started_at,c.ended_at,c.src,c.dst,c.direction,c.origin,c.outcome,c.reason,c.duration FROM dashboard_calls c WHERE ${filter.sql} ORDER BY c.started_at DESC,c.call_key DESC LIMIT :limit`, { ...filter.replacements, limit: limit + 1 }, transaction);
      const page = rows.slice(0, limit); const last = page[page.length - 1];
      return { rows: page.map((r) => ({ id: r.call_key, linkedid: r.linkedid, startedAt: new Date(Number(r.started_at)).toISOString(), endedAt: r.ended_at == null ? null : new Date(Number(r.ended_at)).toISOString(), src: r.src, dst: r.dst, direction: r.direction, origin: r.origin, outcome: r.outcome, reason: r.reason, duration: Number(r.duration) })), total, nextCursor: rows.length > limit && last ? Buffer.from(JSON.stringify({ at: Number(last.started_at), id: last.call_key })).toString('base64url') : null, version, source: this.coverage(state.source, period, state.initializedFrom) };
    });
  }
}
