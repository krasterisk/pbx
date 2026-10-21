import { ConfigService } from '@nestjs/config';
import { DashboardProjectionService } from './dashboard-projection.service';
import { classifyDashboardCall, DASHBOARD_SEMANTICS_VERSION, type DashboardClassifiedCall, type DashboardLeg } from './dashboard-classifier';

const NOW = Date.parse('2026-10-11T10:00:40Z');
const leg = (change: Partial<DashboardLeg> = {}): DashboardLeg => ({ id: 1, vpbx_user_uid: 42, uniqueid: 'own', linkedid: 'root', calldate: '2026-10-11 10:00:00', duration: 30, channel: 'PJSIP/t_trunk_42-01', dstchannel: '', lastapp: 'Playback', disposition: 'ANSWERED', ...change });
function fixture(legs: DashboardLeg[]) {
  const calls = new Map<string, DashboardClassifiedCall>();
  const checkpoints = new Map<string, any>();
  const source = { live: null as null | { payload: string; updated_at: number }, liveFailure: false, events: [] as any[], aiPresent: [] as any[], aiWorked: [] as any[], changes: 0 };
  const store = {
    nodeId: 'node', checkpoint: jest.fn(async (key: string) => checkpoints.get(key) || null),
    saveCheckpoint: jest.fn(async (key: string, cursor: number, from: number, complete: boolean, cursorKey?: string) => { checkpoints.set(key, { cursor_value: cursor, initialized_from: from, bootstrap_complete: complete ? 1 : 0, updated_at: Date.now(), cursor_key: cursorKey }); }),
    select: jest.fn(async (sql: string, args: any = {}): Promise<any[]> => {
      if (sql.includes('FROM dashboard_live_state')) { if (source.liveFailure) throw new Error('SQL unavailable'); return source.live ? [source.live] : []; }
      if (sql.includes('LEFT JOIN dashboard_participants')) return [...calls.values()].filter((c) => c.tenant === args.tenant && args.callKeys.includes(c.id)).flatMap((c) => c.participants.filter((p) => p.kind === 'completion' || p.kind === 'answer').map((p) => ({ call_key: c.id, kind: p.kind, value: p.value, origin: c.origin })));
      if (sql.includes('FROM dashboard_calls WHERE node_id')) {
        const ordered = [...calls.values()].filter((c) => c.nodeId === args.node).sort((a, b) => a.id.localeCompare(b.id));
        if (sql.includes('DESC LIMIT 1')) return ordered.filter((c) => Date.parse(c.startedAt) >= args.from).slice(-1).map((c) => ({ call_key: c.id }));
        const rows = sql.includes('ended_at IS NULL') ? ordered.filter((c) => c.endedAt == null && c.id > args.cursor) : ordered.filter((c) => Date.parse(c.startedAt) >= args.from && c.id > args.after && c.id <= args.upper);
        return rows.slice(0, args.limit).map((c) => ({ call_key: c.id, tenant: c.tenant, linkedid: c.linkedid }));
      }
      if (sql.includes('FROM dashboard_checkpoints')) return args.sources.map((source_key: string) => ({ source_key, ...checkpoints.get(source_key) })).filter((cp: any) => cp.bootstrap_complete != null);
      if (sql.includes('FROM cdr')) {
        if (sql.startsWith('SELECT MAX')) return [{ high: Math.max(...legs.map((l) => Number(l.id)), 0) }];
        if (sql.startsWith('SELECT id')) return [{ id: Math.min(...legs.map((l) => Number(l.id)), 1) }];
        if (args.ids) return legs.filter((l) => args.ids.includes(l.linkedid || l.uniqueid) || args.ids.includes(l.uniqueid));
        return legs.filter((l) => Number(l.id) > args.cursor).slice(0, args.limit);
      }
      if (sql.includes('FROM cel')) return sql.startsWith('SELECT *') ? source.events.filter((e) => e.id > args.cursor).slice(0, args.limit) : source.events;
      if (sql.includes('FROM voice_robot_cdr')) return sql.startsWith('SELECT *') ? [] : source.aiPresent;
      if (sql.includes('FROM voice_robot_logs')) return sql.startsWith('SELECT *') ? [] : source.aiPresent;
      if (sql.includes('FROM ai_voice_sessions')) return source.aiWorked.map((row) => ({ channel_uniqueid: row.call_uniqueid, worked: 1, autodial: 0 }));
      return [];
    }),
    putCall: jest.fn(async (call: DashboardClassifiedCall) => { const changed = calls.get(call.id)?.fingerprint !== call.fingerprint; if (changed) { calls.set(call.id, call); source.changes++; } return changed; }),
    renewLease: jest.fn().mockResolvedValue(true), acquireLease: jest.fn().mockResolvedValue(true), releaseLease: jest.fn(),
    sequelize: { getQueryInterface: () => ({ showAllTables: async () => ['cdr', 'cel', 'voice_robot_cdr', 'voice_robot_logs', 'ai_voice_sessions', 'ai_voice_turns'] }) },
  };
  const createWorker = () => { const worker = new DashboardProjectionService(store as any, new ConfigService({ DASHBOARD_CDR_TIMEZONE: 'UTC' })); (worker as any).tables = new Set(['cdr', 'cel', 'voice_robot_cdr', 'voice_robot_logs', 'ai_voice_sessions', 'ai_voice_turns']); return worker; };
  const live = (members: Record<string, string[]> = {}, updatedAt = NOW, state = 'ok') => { source.live = { updated_at: updatedAt, payload: JSON.stringify({ source: { state }, calls: Object.fromEntries(Object.entries(members).map(([tenant, ids]) => [tenant, ids.map((linkedid) => ({ linkedid }))])) }) }; };
  return { worker: createWorker(), createWorker, store, source, calls, checkpoints, live };
}

describe('Logical completion proof and bounded pending replay', () => {
  beforeEach(() => { jest.spyOn(Date, 'now').mockReturnValue(NOW); });
  afterEach(() => { jest.restoreAllMocks(); });
  it.each(['ivr', 'human', 'ai'])('keeps a continuing %s call active after finalized CDR legs', async (kind) => {
    const legs = [leg(kind === 'human' ? { dstchannel: 'PJSIP/e101_42-02', lastapp: 'Dial' } : kind === 'ai' ? { lastapp: 'Stasis' } : {})];
    const f = fixture(legs); f.live({ 42: ['root'] });
    if (kind === 'ai') { f.source.aiPresent = [{ call_uniqueid: 'own' }]; f.source.aiWorked = [{ call_uniqueid: 'own' }]; }
    await f.worker.reproject(legs);
    expect([...f.calls.values()][0]).toMatchObject({ outcome: 'active', endedAt: null, reason: null });
  });
  it('finalizes only when fresh live absence is at or after the latest CDR leg end', async () => {
    const legs = [leg()]; const f = fixture(legs);
    f.live({}, NOW - 15000); await f.worker.reproject(legs);
    expect([...f.calls.values()][0]).toMatchObject({ outcome: 'unknown', endedAt: null, reason: 'awaitingCompletion' });
    f.live({}, NOW); await f.worker.reproject(legs);
    expect([...f.calls.values()][0]).toMatchObject({ outcome: 'missed', endedAt: '2026-10-11T10:00:30.000Z', reason: 'ivr' });
  });
  it.each(['absent', 'staleAge', 'staleState', 'future', 'malformed'])('does not infer logical completion from %s live evidence, including a human answer', async (kind) => {
    const legs = [leg({ dstchannel: 'PJSIP/e101_42-02', lastapp: 'Dial' })]; const f = fixture(legs);
    if (kind === 'staleAge') f.live({}, NOW - 45001);
    if (kind === 'staleState') f.live({}, NOW, 'stale');
    if (kind === 'future') f.live({}, NOW + 60000);
    if (kind === 'malformed') f.source.live = { payload: '{', updated_at: NOW };
    await f.worker.reproject(legs);
    expect([...f.calls.values()][0]).toMatchObject({ outcome: 'unknown', endedAt: null, reason: 'awaitingCompletion' });
  });
  it('uses tenant-specific live membership for colliding linkedids', async () => {
    const legs = [leg({ vpbx_user_uid: 1, channel: 'PJSIP/t_trunk_1-01' }), leg({ id: 2, uniqueid: 'other', vpbx_user_uid: 2, channel: 'PJSIP/t_trunk_2-01' })];
    const f = fixture(legs); f.live({ 1: ['root'] }); await f.worker.reproject(legs);
    expect([...f.calls.values()].find((c) => c.tenant === 1)).toMatchObject({ outcome: 'active', endedAt: null });
    expect([...f.calls.values()].find((c) => c.tenant === 2)).toMatchObject({ outcome: 'missed', endedAt: '2026-10-11T10:00:30.000Z' });
  });
  it.each(['uniqueid', 'channame'])('accepts tenant-owned terminal %s evidence without completing another tenant sharing linkedid', async (match) => {
    const legs = [leg({ vpbx_user_uid: 1, channel: 'PJSIP/t_trunk_1-01' }), leg({ id: 2, uniqueid: 'other', vpbx_user_uid: 2, channel: 'PJSIP/t_trunk_2-01' })]; const f = fixture(legs);
    f.source.events = [{ eventtype: 'LINKEDID_END', linkedid: 'root', uniqueid: match === 'uniqueid' ? 'own' : 'nonCdrTerminal', channame: match === 'channame' ? 'PJSIP/t_trunk_1-01' : '', eventtime: '2026-10-11 10:00:35' }];
    await f.worker.reproject(legs);
    expect([...f.calls.values()].find((c) => c.tenant === 1)).toMatchObject({ outcome: 'missed', endedAt: '2026-10-11T10:00:30.000Z' });
    expect([...f.calls.values()].find((c) => c.tenant === 2)).toMatchObject({ outcome: 'unknown', endedAt: null });
  });
  it('rejects linkedid-only terminal evidence and gives known-active state priority even over terminal evidence', async () => {
    const legs = [leg()]; const f = fixture(legs);
    f.source.events = [{ eventtype: 'LINKEDID_END', linkedid: 'root', uniqueid: 'foreign', channame: 'PJSIP/t_foreign_99-01' }];
    await f.worker.reproject(legs); expect([...f.calls.values()][0].outcome).toBe('unknown');
    f.source.events[0].uniqueid = 'own'; f.source.events[0].channame = 'PJSIP/t_trunk_42-01'; f.live({ 42: ['root'] });
    await f.worker.reproject(legs); expect([...f.calls.values()][0]).toMatchObject({ outcome: 'active', endedAt: null });
  });
  it('replays a pending ended call without new CDR and reads live proof once in a projection cycle', async () => {
    const legs = [leg()]; const f = fixture(legs); f.live({ 42: ['root'] }); await f.worker.reproject(legs);
    f.checkpoints.set('cdr:node', { cursor_value: 1, initialized_from: NOW - 86400000, bootstrap_complete: 1 });
    f.live({}); f.store.select.mockClear(); await f.worker.tick();
    expect([...f.calls.values()][0]).toMatchObject({ outcome: 'missed', endedAt: '2026-10-11T10:00:30.000Z' });
    expect(f.store.select.mock.calls.filter(([sql]) => sql.includes('FROM dashboard_live_state'))).toHaveLength(1);
    expect(f.store.select.mock.calls.some(([sql]) => sql.includes('ended_at IS NULL'))).toBe(true);
    expect(f.checkpoints.get('cdr:node').cursor_value).toBe(1);
  });
  it('retains durable final answer and stable fingerprint across refreshed snapshots and a source outage', async () => {
    const legs = [leg({ lastapp: 'Stasis' })]; const f = fixture(legs); f.live({});
    f.source.aiPresent = [{ call_uniqueid: 'own' }]; f.source.aiWorked = [{ call_uniqueid: 'own' }];
    await f.worker.reproject(legs); const first = [...f.calls.values()][0]; expect(first.outcome).toBe('accepted');
    jest.spyOn(Date, 'now').mockReturnValue(NOW + 10000); f.live({}, NOW + 10000); await f.worker.reproject(legs);
    expect([...f.calls.values()][0].fingerprint).toBe(first.fingerprint); expect(f.source.changes).toBe(1);
    f.source.liveFailure = true; f.source.aiPresent = []; f.source.aiWorked = []; await f.worker.reproject(legs);
    expect([...f.calls.values()][0]).toMatchObject({ outcome: 'accepted', origin: 'ai', endedAt: first.endedAt });
    expect([...f.calls.values()][0].fingerprint).toBe(first.fingerprint); expect(f.source.changes).toBe(1);
  });
  it('replays at most 500 pending calls per batch fairly and resumes its durable cursor after restart', async () => {
    const legs = Array.from({ length: 1501 }, (_, i) => leg({ id: i + 1, uniqueid: `u${i}`, linkedid: `l${i}` })); const f = fixture(legs);
    for (const row of legs) { const call = classifyDashboardCall(42, 'node', [row], { active: true }); f.calls.set(call.id, call); }
    f.live({ 42: legs.map((row) => row.linkedid!) });
    const ordered = [...f.calls.keys()].sort();
    await (f.worker as any).replayPending(); expect(f.checkpoints.get('pending:node').cursor_key).toBe(ordered[499]);
    const restarted = f.createWorker(); await (restarted as any).replayPending(); expect(f.checkpoints.get('pending:node').cursor_key).toBe(ordered[999]);
    await (restarted as any).replayPending(); expect(f.checkpoints.get('pending:node').cursor_key).toBe(ordered[1499]);
    await (restarted as any).replayPending(); expect(f.checkpoints.get('pending:node').cursor_key).toBe('');
    const pendingReads = f.store.select.mock.calls.filter(([sql]) => sql.includes('ended_at IS NULL'));
    expect(pendingReads).toHaveLength(4); expect(pendingReads.every(([, args]) => args.limit === 500)).toBe(true);
    const visited = f.store.putCall.mock.calls.map(([call]) => call.id); expect(visited).toHaveLength(1501); expect(new Set(visited).size).toBe(1501);
  });
  it('preserves a positive answer recorded while active when source rows later disappear', async () => {
    const legs = [leg({ lastapp: 'Stasis' })]; const f = fixture(legs); f.live({ 42: ['root'] }); f.source.aiWorked = [{ call_uniqueid: 'own' }];
    await f.worker.reproject(legs); expect([...f.calls.values()][0].participants).toContainEqual({ kind: 'answer', value: 'v3:ai' });
    f.source.aiWorked = []; f.live({}); await f.worker.reproject(legs);
    expect([...f.calls.values()][0]).toMatchObject({ outcome: 'accepted', origin: 'ai', endedAt: expect.any(String) });
  });
  it('reclassifies a legacy accepted outcome without using it as a positive proof', async () => {
    const legs = [leg({ lastapp: 'Hangup', channel: 'PJSIP/e101_42-01', src: '101', usrc: '101', dst: '703' })]; const f = fixture(legs);
    const wrong = classifyDashboardCall(42, 'node', legs, { humanAnswered: true, complete: true, completeThrough: NOW });
    wrong.participants = wrong.participants.filter((p) => p.kind !== 'answer'); wrong.fingerprint = 'legacy-v2'; f.calls.set(wrong.id, wrong);
    f.source.events = [{ eventtype: 'ANSWER', uniqueid: 'own', linkedid: 'root', channame: 'PJSIP/e101_42-01', appname: 'Playback' }];
    await f.worker.reproject(legs);
    expect([...f.calls.values()][0]).toMatchObject({ outcome: 'missed', direction: 'internal', reason: 'ivr' });
    expect([...f.calls.values()][0].participants.some((p) => p.kind === 'answer')).toBe(false);
  });
  it('resumes a bounded versioned retrofit after restart with a fixed upper key and coverage', async () => {
    const legs = Array.from({ length: 1101 }, (_, i) => leg({ id: i + 1, uniqueid: `u${i}`, linkedid: `l${i}` })); const f = fixture(legs);
    for (const row of legs) { const call = classifyDashboardCall(42, 'node', [row], { complete: true, completeThrough: NOW }); call.fingerprint = 'v2'; f.calls.set(call.id, call); }
    f.live({}); const ordered = [...f.calls.keys()].sort(); const key = `semantics:v${DASHBOARD_SEMANTICS_VERSION}:node`;
    await (f.worker as any).replaySemantics();
    const first = f.checkpoints.get(key); expect(first).toMatchObject({ cursor_value: DASHBOARD_SEMANTICS_VERSION, bootstrap_complete: 0 }); expect(first.cursor_key).toBe(ordered[499] + ordered[1100]);
    const restarted = f.createWorker(); await (restarted as any).replaySemantics(); expect(f.checkpoints.get(key).cursor_key).toBe(ordered[999] + ordered[1100]);
    await (restarted as any).replaySemantics(); expect(f.checkpoints.get(key)).toMatchObject({ cursor_value: DASHBOARD_SEMANTICS_VERSION, bootstrap_complete: 1, initialized_from: first.initialized_from });
    expect(f.checkpoints.get(key).cursor_key).toBe(ordered[1100] + ordered[1100]);
    expect(f.store.putCall).toHaveBeenCalledTimes(1101); expect(new Set(f.store.putCall.mock.calls.map(([call]) => call.id)).size).toBe(1101);
    const reads = f.store.select.mock.calls.filter(([sql]) => sql.includes('call_key<= :upper')); expect(reads).toHaveLength(3); expect(reads.every(([, args]) => args.limit === 500)).toBe(true);
    const writes = f.store.putCall.mock.calls.length; await (restarted as any).replaySemantics(); expect(f.store.putCall).toHaveBeenCalledTimes(writes);
  });
  it('does not advance the versioned retrofit checkpoint after shutdown or lost lease', async () => {
    const legs = [leg()]; const f = fixture(legs); const call = classifyDashboardCall(42, 'node', legs, { complete: true }); f.calls.set(call.id, call);
    f.store.putCall.mockImplementation(async () => { (f.worker as any).destroyed = true; return false; });
    await expect((f.worker as any).replaySemantics()).rejects.toThrow('stopped before semantics checkpoint');
    expect(f.checkpoints.get(`semantics:v${DASHBOARD_SEMANTICS_VERSION}:node`)).toMatchObject({ bootstrap_complete: 0, cursor_key: '0'.repeat(64) + call.id });
    const restarted = f.createWorker(); f.store.saveCheckpoint.mockRejectedValueOnce(new Error('Projection ownership lost'));
    await expect((restarted as any).replaySemantics()).rejects.toThrow('Projection ownership lost');
    expect(f.checkpoints.get(`semantics:v${DASHBOARD_SEMANTICS_VERSION}:node`).bootstrap_complete).toBe(0);
  });

});
