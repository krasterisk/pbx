import { ConfigService } from '@nestjs/config';
import { DashboardCacheService } from './dashboard-cache.service';
import { DashboardReadStore } from './dashboard-read-store.service';
import { classifyDashboardCall } from './dashboard-classifier';
function mockStore(dialect = 'postgres') {
  const query = jest.fn().mockResolvedValue([]);
  const sequelize = { query, getDialect: () => dialect, transaction: jest.fn(async (optionsOrWork: any, work?: (t: unknown) => Promise<unknown>) => (work || optionsOrWork)({})) };
  return { store: new DashboardReadStore(sequelize as any, new ConfigService({ DASHBOARD_NODE_ID: 'node' }), new DashboardCacheService()), query, sequelize };
}
const fixedPeriod = { period: 'custom' as const, from: '2026-10-01T00:00:00Z', to: '2026-10-02T00:00:00Z' };
describe('Dashboard durable read store', () => {
  it.each(['mysql', 'postgres'])('uses portable idempotent upserts and atomic bucket corrections in %s', async (dialect) => {
    const { store, query, sequelize } = mockStore(dialect);
    const call = classifyDashboardCall(42, 'node', [{ uniqueid: 'u1', linkedid: 'l1', calldate: '2026-10-01 10:00:00', channel: 'PJSIP/t_trunk_42-1', dstchannel: 'PJSIP/e101_42-2', dialednum: '7495', disposition: 'ANSWERED', duration: 5 }], { complete: true });
    query.mockImplementation(async (sql: string) => sql.startsWith('SELECT * FROM dashboard_calls') ? [{ tenant: 42, node_id: 'node', started_at: Date.parse(call.startedAt), direction: 'in', origin: 'telephony', outcome: 'missed', fingerprint: 'old' }] : []);
    await store.putCall(call);
    expect(sequelize.transaction).toHaveBeenCalledTimes(1);
    const buckets = query.mock.calls.filter(([sql]) => sql.startsWith('INSERT INTO dashboard_buckets'));
    expect(buckets.map(([, options]) => options.replacements.delta)).toEqual([-1, 1]);
    expect(query.mock.calls.find(([sql]) => sql.startsWith('INSERT INTO dashboard_calls'))![0]).toContain(dialect === 'postgres' ? 'ON CONFLICT' : 'ON DUPLICATE KEY');
  });
  it('does not update already projected fingerprints', async () => {
    const { store, query } = mockStore();
    const call = classifyDashboardCall(42, 'node', [{ uniqueid: 'u1', calldate: '2026-10-01 00:00:00', disposition: 'BUSY' }]);
    query.mockImplementation(async (sql: string) => sql.startsWith('SELECT *') ? [{ fingerprint: call.fingerprint }] : []);
    expect(await store.putCall(call)).toBe(false); expect(query.mock.calls).toHaveLength(1);
  });
  it('fences an expired projection owner before any writes', async () => {
    const { store, query } = mockStore();
    query.mockResolvedValue([{ owner: 'other-owner', expires_at: Date.now() + 10000 }]);
    const call = classifyDashboardCall(42, 'node', [{ uniqueid: 'u1', calldate: '2026-10-01 00:00:00', disposition: 'BUSY' }]);
    await expect(store.putCall(call, 'expired-owner')).rejects.toThrow('ownership lost');
    expect(query.mock.calls.every(([sql]) => sql.startsWith('SELECT'))).toBe(true);
  });
  it('reads bounded rollups, never raw CDR, and separates incoming response outcomes', async () => {
    const { store, query } = mockStore();
    query.mockImplementation(async (sql: string, opts: any) => {
      if (sql.includes('dashboard_checkpoints')) return ['cdr:node', 'projection:node'].map((source_key) => ({ source_key, cursor_value: 10, initialized_from: 0, bootstrap_complete: 1, updated_at: Date.now() }));
      if (sql.includes('dashboard_buckets')) return [{ bucket: Date.parse(fixedPeriod.from), direction: 'in', outcome: 'accepted', amount: 10 }, { bucket: Date.parse(fixedPeriod.from), direction: 'in', outcome: 'missed', amount: 5 }, { bucket: Date.parse(fixedPeriod.from), direction: 'out', outcome: 'accepted', amount: 7 }];
      return [];
    });
    const result = await store.summary(42, fixedPeriod);
    expect(result.totals).toMatchObject({ total: 22, incoming: 15, outgoing: 7, accepted: 10, missed: 5 });
    expect(result.buckets).toHaveLength(288);
    expect(result.buckets[0]).toMatchObject({ total: 22, at: fixedPeriod.from.replace('Z', '.000Z'), until: '2026-10-01T00:05:00.000Z' });
    expect(result.buckets.slice(1).every((bucket) => bucket.total === 0)).toBe(true);
    expect(query.mock.calls.every(([sql]) => !/FROM cdr\b/.test(sql))).toBe(true);
  });
  it('uses an EXISTS relation to count overlapping scopes once and keeps tenant bound', async () => {
    const { store, query } = mockStore();
    await store.summary(42, fixedPeriod, 'UTC', { operators: ['101', '102'], ownExten: '102', queues: ['700'] }, 'rights-v2');
    const [sql, opts] = query.mock.calls.find(([sql]) => sql.includes('COUNT(*) AS amount'))!;
    expect(sql).toContain('c.tenant= :tenant'); expect(sql).toContain('EXISTS (SELECT 1 FROM dashboard_participants');
    expect(opts.replacements).toMatchObject({ tenant: 42, extensions: ['101', '102'], queues: ['700'] });
    expect(sql).not.toContain('JOIN dashboard_participants');
  });
  it('rejects malformed cursors and clamps detail pages at 100 rows', async () => {
    const { store, query } = mockStore();
    await expect(store.calls(42, { ...fixedPeriod, cursor: 'invalid' })).rejects.toThrow('Invalid dashboard cursor');
    await store.calls(42, { ...fixedPeriod, limit: 10000 });
    const [, opts] = query.mock.calls.find(([sql]) => sql.includes('ORDER BY c.started_at DESC'))!;
    expect(opts.replacements.limit).toBe(101);
  });
  it('does not report complete CDR as fresh while required evidence is behind', async () => {
    const { store, query } = mockStore();
    query.mockImplementation(async (sql: string) => sql.includes('dashboard_checkpoints') ? [{ source_key: 'cdr:node', bootstrap_complete: 1, updated_at: Date.now() }, { source_key: 'projection:node', bootstrap_complete: 0, updated_at: Date.now() }] : []);
    expect((await store.summary(42, fixedPeriod)).source).toMatchObject({ state: 'stale', message: 'historyEvidenceIncomplete' });
  });
  it('does not let a former owner overwrite the checkpoint', async () => {
    const { store, query } = mockStore(); query.mockResolvedValue([{ owner: 'new-owner', expires_at: Date.now() + 10000 }]);
    await expect(store.saveCheckpoint('cdr:node', 500, 0, true, undefined, 'former-owner')).rejects.toThrow('ownership lost before checkpoint');
    expect(query.mock.calls.every(([sql]) => sql.startsWith('SELECT'))).toBe(true);
  });

  it('marks periods outside initial projection coverage unavailable and partial periods stale', async () => {
    const { store, query } = mockStore();
    query.mockImplementation(async (sql: string) => sql.includes('dashboard_checkpoints') ? ['cdr:node', 'projection:node'].map((source_key) => ({ source_key, initialized_from: Date.parse('2026-10-01T12:00:00Z'), bootstrap_complete: 1, updated_at: Date.now() })) : []);
    const old = await store.summary(42, { period: 'custom', from: '2026-09-01T00:00:00Z', to: '2026-09-02T00:00:00Z' });
    expect(old.source).toMatchObject({ state: 'unavailable', message: 'historyOutsideCoverage' });
    const partial = await store.summary(42, fixedPeriod);
    expect(partial.source).toMatchObject({ state: 'stale', message: 'historyPartialCoverage' });
  });
  it('exposes backfill percentage without tenant-global counts', async () => {
    const { store, query } = mockStore();
    query.mockImplementation(async (sql: string) => sql.includes('dashboard_checkpoints') ? [{ source_key: 'cdr:node', cursor_value: 50, cursor_key: JSON.stringify({ first: 1, highwater: 100 }), initialized_from: 0, bootstrap_complete: 0, updated_at: Date.now() }] : []);
    expect((await store.summary(42, fixedPeriod)).source.progress).toEqual({ percent: 50 });
  });

  it('reads fresh coherent detail count/version while overview keeps its 30-second snapshot', async () => {
    const timestamp = Date.parse('2026-10-01T10:00:00Z');
    const row = (id: string) => ({ call_key: id.repeat(64), linkedid: id, started_at: timestamp, ended_at: timestamp + 1000, src: '7900', dst: '101', direction: 'in', outcome: 'accepted', origin: 'telephony', duration: 1, reason: null });
    let current = { revision: 1, rows: [row('b')] };
    const snapshots: any[] = [];
    const query = jest.fn(async (sql: string, options: any) => {
      const snapshot = options.transaction || current;
      if (sql.includes('SELECT source_key')) return ['cdr:node', 'projection:node'].map((source_key) => ({ source_key, initialized_from: 0, bootstrap_complete: 1, updated_at: Date.now() }));
      if (sql.includes('SELECT cursor_value FROM dashboard_checkpoints')) return [{ cursor_value: snapshot.revision }];
      if (sql.includes('SUM(call_count)')) return [{ bucket: timestamp, direction: 'in', outcome: 'accepted', amount: snapshot.rows.length }];
      if (sql.includes('COUNT(*) AS total')) return [{ total: snapshot.rows.length }];
      if (sql.includes('ORDER BY c.started_at DESC')) return snapshot.rows.filter((r: any) => !options.replacements.cursorId || r.call_key < options.replacements.cursorId).slice(0, options.replacements.limit);
      return [];
    });
    const sequelize = { getDialect: () => 'postgres', query, transaction: jest.fn(async (optionsOrWork: any, work?: (t: unknown) => Promise<unknown>) => {
      const snapshot = { revision: current.revision, rows: [...current.rows] }; snapshots.push(snapshot);
      return (work || optionsOrWork)(snapshot);
    }) };
    const store = new DashboardReadStore(sequelize as any, new ConfigService({ DASHBOARD_NODE_ID: 'node' }), new DashboardCacheService());
    const oldOverview = await store.summary(42, fixedPeriod);
    current = { revision: 2, rows: [row('b'), row('a')] };
    const cachedOverview = await store.summary(42, fixedPeriod);
    expect(cachedOverview.totals.total).toBe(1); expect(cachedOverview.version).toBe(oldOverview.version);
    const details = await store.calls(42, { ...fixedPeriod, limit: 1 });
    expect(details.total).toBe(2); expect(details.rows).toHaveLength(1); expect(details.version).not.toBe(oldOverview.version);
    const next = await store.calls(42, { ...fixedPeriod, limit: 1, cursor: details.nextCursor! });
    expect(next.total).toBe(2); expect(next.rows[0].id).not.toBe(details.rows[0].id); expect(next.version).toBe(details.version);
    await expect(store.calls(42, { ...fixedPeriod, version: oldOverview.version } as any)).rejects.toThrow('Dashboard call data changed');
    expect(sequelize.transaction.mock.calls.every(([options]) => options.isolationLevel === 'REPEATABLE READ')).toBe(true);
    const detailQueries = query.mock.calls.filter(([sql]) => sql.includes('COUNT(*) AS total') || sql.includes('ORDER BY c.started_at DESC'));
    expect(detailQueries.every(([, options]) => options.transaction !== undefined)).toBe(true);
  });
  it('bumps the global tenant revision in the same transaction as a changed call and its buckets', async () => {
    const { store, query } = mockStore();
    const call = classifyDashboardCall(42, 'node', [{ uniqueid: 'one', calldate: '2026-10-01 00:00:00', disposition: 'BUSY' }]);
    await store.putCall(call);
    const writes = query.mock.calls.filter(([sql]) => sql.startsWith('INSERT'));
    const revision = writes.find(([sql]) => sql.includes('dashboard_checkpoints'))!;
    expect(revision[0]).toContain('cursor_value=dashboard_checkpoints.cursor_value + 1');
    expect(revision[1].replacements.source).toBe('revision:42');
    expect(writes.every(([, options]) => options.transaction === revision[1].transaction)).toBe(true);
  });

  it('removes an ongoing call from history buckets and does not insert an active bucket', async () => {
    const { store, query } = mockStore();
    const active = classifyDashboardCall(42, 'node', [{ uniqueid: 'u1', linkedid: 'l1', calldate: '2026-10-01 10:00:00', disposition: 'ANSWERED' }], { active: true });
    query.mockImplementation(async (sql: string) => sql.startsWith('SELECT * FROM dashboard_calls') ? [{ tenant: 42, node_id: 'node', started_at: Date.parse(active.startedAt), direction: 'in', origin: 'telephony', outcome: 'missed', fingerprint: 'old' }] : []);
    await store.putCall(active);
    expect(query.mock.calls.filter(([sql]) => sql.startsWith('INSERT INTO dashboard_buckets')).map(([, opts]) => opts.replacements.delta)).toEqual([-1]);
    query.mockClear(); query.mockResolvedValue([]);
    await store.putCall(active);
    expect(query.mock.calls.some(([sql]) => sql.startsWith('INSERT INTO dashboard_buckets'))).toBe(false);
  });
  it('excludes active projection rows from overview aggregates and historical detail/count queries', async () => {
    const { store, query } = mockStore();
    query.mockImplementation(async (sql: string) => sql.includes('dashboard_buckets') ? [{ bucket: Date.parse(fixedPeriod.from), direction: 'in', outcome: 'active', amount: 100 }, { bucket: Date.parse(fixedPeriod.from), direction: 'in', outcome: 'unknown', amount: 1 }] : []);
    expect((await store.summary(42, fixedPeriod)).totals).toMatchObject({ total: 1, incoming: 1, unknown: 1 });
    await store.calls(42, fixedPeriod);
    const historyQueries = query.mock.calls.filter(([sql]) => sql.includes('FROM dashboard_buckets') || sql.includes('COUNT(*) AS total') || sql.includes('ORDER BY c.started_at DESC'));
    expect(historyQueries).toHaveLength(3);
    expect(historyQueries.every(([sql]) => sql.includes("outcome<>'active'"))).toBe(true);
  });

  it('retains equal-duration temporal bins between morning and evening activity without extra queries', async () => {
    const { store, query } = mockStore();
    query.mockImplementation(async (sql: string) => sql.includes('dashboard_buckets') ? [
      { bucket: Date.parse('2026-10-01T08:00:00Z'), direction: 'in', outcome: 'accepted', amount: 12 },
      { bucket: Date.parse('2026-10-01T20:00:00Z'), direction: 'out', outcome: 'missed', amount: 7 },
    ] : []);
    const result = await store.summary(42, fixedPeriod);
    expect(result.buckets).toHaveLength(288); expect(result.totals.total).toBe(19);
    expect(result.buckets[96]).toMatchObject({ at: '2026-10-01T08:00:00.000Z', until: '2026-10-01T08:05:00.000Z', total: 12 });
    expect(result.buckets[240]).toMatchObject({ at: '2026-10-01T20:00:00.000Z', until: '2026-10-01T20:05:00.000Z', total: 7 });
    expect(result.buckets.slice(97, 240)).toHaveLength(143);
    expect(result.buckets.slice(97, 240).every((bucket) => bucket.total === 0)).toBe(true);
    expect(result.buckets.every((bucket) => Date.parse(bucket.until!) - Date.parse(bucket.at) === 300000)).toBe(true);
    expect(result.buckets.reduce((sum, bucket) => sum + bucket.total, 0)).toBe(19);
    expect(query.mock.calls).toHaveLength(3); expect(query.mock.calls.every(([sql]) => !/FROM cdr\b/.test(sql))).toBe(true);
  });
  it('clamps first and last temporal bin boundaries while retaining their aligned SQL keys', async () => {
    const { store, query } = mockStore();
    query.mockImplementation(async (sql: string) => sql.includes('dashboard_buckets') ? [
      { bucket: Date.parse('2026-10-01T10:00:00Z'), direction: 'in', outcome: 'accepted', amount: 1 },
      { bucket: Date.parse('2026-10-01T10:15:00Z'), direction: 'in', outcome: 'missed', amount: 2 },
    ] : []);
    const result = await store.summary(42, { period: 'custom', from: '2026-10-01T10:02:00Z', to: '2026-10-01T10:18:00Z' });
    expect(result.buckets.map(({ at, until, total }) => ({ at, until, total }))).toEqual([
      { at: '2026-10-01T10:02:00.000Z', until: '2026-10-01T10:05:00.000Z', total: 1 },
      { at: '2026-10-01T10:05:00.000Z', until: '2026-10-01T10:10:00.000Z', total: 0 },
      { at: '2026-10-01T10:10:00.000Z', until: '2026-10-01T10:15:00.000Z', total: 0 },
      { at: '2026-10-01T10:15:00.000Z', until: '2026-10-01T10:18:00.000Z', total: 2 },
    ]);
    expect(result.totals).toMatchObject({ total: 3, accepted: 1, missed: 2 });
  });
  it('bounds a quiet 31-day range at 300 complete contiguous bins', async () => {
    const { store } = mockStore();
    const period = { period: 'custom' as const, from: '2026-09-01T00:02:03Z', to: '2026-10-02T00:02:03Z' };
    const result = await store.summary(42, period);
    expect(result.buckets.length).toBeLessThanOrEqual(300); expect(result.buckets.length).toBeGreaterThan(290);
    expect(result.buckets[0].at).toBe('2026-09-01T00:02:03.000Z');
    expect(result.buckets.at(-1)!.until).toBe('2026-10-02T00:02:03.000Z');
    expect(result.buckets.every((bucket, i) => bucket.total === 0 && (i === 0 || result.buckets[i - 1].until === bucket.at))).toBe(true);
    expect(result.totals.total).toBe(0);
  });

});
