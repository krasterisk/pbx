import { ConfigService } from '@nestjs/config';
import { DashboardCollectorService } from './dashboard-collector.service';
import { DashboardCacheService } from './dashboard-cache.service';
interface CollectorFixture {
  collector: DashboardCollectorService; cache: DashboardCacheService; states: Map<string, any>; aors: Map<string, any>;
  store: {
    nodeId: string; acquireLease: jest.Mock; renewLease: jest.Mock; releaseLease: jest.Mock;
    select: jest.Mock<Promise<any[]>, [string]>; upsert: jest.Mock<Promise<void>, [string, any]>;
    sequelize: { transaction: (work: (transaction: unknown) => Promise<void>) => Promise<void> };
  };
  ami: { subscribeInternalEvents: jest.Mock; isConnected: jest.Mock; getActiveChannels: jest.Mock; collectDashboardEndpoints: jest.Mock; collectDashboardContacts: jest.Mock; collectDashboardRegistrations: jest.Mock };
}
function setup(channels: any[] = [], config: Record<string, unknown> = { AMI_SECRET: 'test' }): CollectorFixture {
  let persisted = ''; const states = new Map<string, any>(); const aors = new Map<string, any>();
  const store = { nodeId: 'node', acquireLease: jest.fn().mockResolvedValue(true), renewLease: jest.fn().mockResolvedValue(true), releaseLease: jest.fn().mockResolvedValue(undefined), select: jest.fn(async (sql: string): Promise<any[]> => sql.includes('FROM dashboard_leases') ? [{ owner: (collector as any).owner, expires_at: Date.now() + 60000 }] : sql.includes('FROM ps_endpoints') ? [...states.values()] : sql.includes('FROM ps_aors') ? [...aors.values()] : persisted ? [{ payload: persisted, updated_at: Date.now() }] : []), upsert: jest.fn(async (_: string, row: any) => { persisted = row.payload; }), sequelize: { transaction: async (work: (tx: unknown) => Promise<void>) => work({}) } };
  const ami = { subscribeInternalEvents: jest.fn(), isConnected: jest.fn().mockReturnValue(true), getActiveChannels: jest.fn().mockResolvedValue({ complete: true, events: channels }), collectDashboardEndpoints: jest.fn().mockResolvedValue({ complete: true, events: [] }), collectDashboardContacts: jest.fn().mockResolvedValue({ complete: true, events: [] }), collectDashboardRegistrations: jest.fn().mockResolvedValue({ complete: true, events: [] }) };
  const cache = new DashboardCacheService();
  const collector: DashboardCollectorService = new DashboardCollectorService(store as any, ami as any, new ConfigService(config), cache);
  return { collector, store, ami, states, cache, aors };
}
async function collectTick(collector: DashboardCollectorService): Promise<void> {
  const revision = (collector as any).inventoryRevision;
  await collector.tick(); await (collector as any).inventoryTask;
  if ((collector as any).inventoryRevision !== revision) await collector.tick();
}

function restartFixture(fixture: CollectorFixture, saved: any): Pick<CollectorFixture, 'collector' | 'cache'> {
  const { store, ami, states, aors } = fixture; let persisted = JSON.stringify(saved);
  const cache = new DashboardCacheService();
  const collector = new DashboardCollectorService(store as any, ami as any, new ConfigService({ AMI_SECRET: 'test' }), cache);
  store.select.mockImplementation(async (sql: string) => {
    if (sql.includes('FROM dashboard_leases')) return [{ owner: (collector as any).owner, expires_at: Date.now() + 60000 }] as any;
    if (sql.includes('FROM dashboard_live_state')) return [{ payload: persisted, updated_at: Date.now() }] as any;
    if (sql.includes('FROM ps_endpoints')) return [...states.values()];
    if (sql.includes('FROM ps_aors')) return [...aors.values()];
    return [];
  });
  store.upsert.mockImplementation(async (_table: string, row: any) => { persisted = row.payload; });
  return { collector, cache };
}

describe('Dashboard viewer-independent node collector', () => {
  it('serves 10k endpoints / 1k logical calls / 100 viewers using one AMI collection', async () => {
    const channels = Array.from({ length: 1000 }, (_, i) => ({ uniqueid: String(i), linkedid: `call-${i}`, channel: `PJSIP/e${i + 100}_42-01`, calleridnum: String(i + 100), exten: '79000000000', context: 'sip-out42', channelstatedesc: 'Up' }));
    const { collector, ami, states, store } = setup(channels);
    for (let i = 0; i < 10000; i++) { const id = `e${i + 100}_42`; states.set(id, { id, tenantid: '42', callerid: String(i), aors: id }); }
    await collectTick(collector);
    const overviews = await Promise.all(Array.from({ length: 100 }, () => collector.overview(42)));
    expect(overviews.every((o) => o.activeCalls === 1000 && o.endpoints.total === 10000)).toBe(true);
    expect(ami.getActiveChannels).toHaveBeenCalledTimes(1);
    expect(ami.collectDashboardEndpoints).toHaveBeenCalledTimes(1);
    expect(store.select.mock.calls.filter(([sql]) => sql.includes('dashboard_live_state'))).toHaveLength(2);
    expect(Buffer.byteLength(JSON.stringify(overviews[0]))).toBeLessThan(1024);
    expect((await collector.endpoints(42, { limit: 999 })).rows).toHaveLength(100);
    expect((await collector.calls(42, { limit: 1000 })).rows).toHaveLength(100);
  });
  it('does not resurrect a call hung up while a snapshot was in flight', async () => {
    const channel = { uniqueid: 'u1', linkedid: 'l1', channel: 'PJSIP/e101_42-01', context: 'sip-out42', channelstatedesc: 'Up' };
    const { collector, ami } = setup([channel]);
    ami.getActiveChannels.mockImplementationOnce(async () => { (collector as any).onEvent({ event: 'Hangup', uniqueid: 'u1' }); return { complete: true, events: [channel] }; });
    await collectTick(collector); expect((await collector.overview(42)).activeCalls).toBe(0);
  });
  it('keeps the last complete snapshot when a new response times out', async () => {
    const { collector, ami } = setup([{ uniqueid: 'u1', linkedid: 'l1', channel: 'PJSIP/e101_42-01', context: 'sip-out42' }]);
    await collectTick(collector);
    ami.getActiveChannels.mockResolvedValue({ complete: false, events: [] }); (collector as any).lastCalls = 0;
    await collectTick(collector);
    expect((collector as any).channels.size).toBe(1); expect((collector as any).callsSource.state).toBe('stale');
  });
  it('does not issue AMI requests on a follower and filters tenant and effective scope', async () => {
    const { collector, ami, store } = setup(); store.acquireLease.mockResolvedValue(false);
    await collectTick(collector); expect(ami.getActiveChannels).not.toHaveBeenCalled();
    expect((await collector.calls(99, {})).rows).toHaveLength(0);
  });
  it('isolates active linkedid collisions across tenants and does not attach ambiguous technical legs', async () => {
    const { collector } = setup([
      { uniqueid: '42', linkedid: 'same', channel: 'PJSIP/e101_42-01', context: 'sip-out42' },
      { uniqueid: '43', linkedid: 'same', channel: 'PJSIP/e202_43-02', context: 'sip-out43' },
      { uniqueid: 'technical', linkedid: 'same', channel: 'Local/stasis-03', context: '' },
    ]);
    await collectTick(collector);
    const first = await collector.calls(42, {}); const second = await collector.calls(43, {});
    expect(first.total).toBe(1); expect(second.total).toBe(1); expect(first.rows[0].id).not.toBe(second.rows[0].id);
    expect((await collector.calls(42, {}, { operators: ['202'], queues: [], ownExten: null })).total).toBe(0);
  });
  it('continues by sort key when the final row of a page hangs up', async () => {
    const channels = Array.from({ length: 100 }, (_, i) => ({ uniqueid: String(i), linkedid: `call-${i}`, channel: 'PJSIP/e101_42-01', context: 'sip-out42' }));
    const { collector, cache } = setup(channels); await collectTick(collector);
    const first = await collector.calls(42, { limit: 50 });
    (collector as any).channels.delete(first.rows[49].linkedid.replace('call-', ''));
    await collectTick(collector); cache.invalidate('live:');
    const second = await collector.calls(42, { limit: 50, cursor: first.nextCursor! });
    expect(second.rows).toHaveLength(50);
    expect(second.rows.some((row) => first.rows.some((old) => old.id === row.id))).toBe(false);
  });
  it('keeps last-good data stale after live SQL or JSON failures', async () => {
    const { collector, store, cache } = setup([{ uniqueid: 'one', linkedid: 'one', channel: 'PJSIP/e101_42-1', context: 'sip-out42' }]);
    await collectTick(collector); expect((await collector.overview(42)).activeCalls).toBe(1);
    cache.invalidate('live:'); store.select.mockRejectedValue(new Error('database unavailable'));
    expect(await collector.overview(42)).toMatchObject({ activeCalls: 1, source: { state: 'stale' } });
    cache.invalidate('live:'); store.select.mockResolvedValue([{ payload: 'bad JSON', updated_at: Date.now() }] as any);
    expect(await collector.overview(42)).toMatchObject({ activeCalls: 1, source: { state: 'stale' } });
  });
  it('marks scoped overview stale when inventory is stale', async () => {
    const { collector } = setup(); await collectTick(collector);
    (collector as any).inventorySource = { state: 'stale', updatedAt: null };
    await collectTick(collector);
    expect((await collector.overview(42, { operators: ['101'], queues: [], ownExten: null })).source.state).toBe('stale');
  });

  it('keeps an endpoint online when only one of multiple SIP contacts is removed', async () => {
    const { collector, ami, states, cache } = setup();
    states.set('e101_42', { id: 'e101_42', tenantid: '42', callerid: '101', aors: 'e101_42' });
    ami.collectDashboardContacts.mockResolvedValue({ complete: true, events: [{ endpoint: 'e101_42', uri: 'sip:a', status: 'Reachable' }, { endpoint: 'e101_42', uri: 'sip:b', status: 'Reachable' }] });
    await collectTick(collector);
    (collector as any).onEvent({ event: 'ContactStatus', endpointname: 'e101_42', uri: 'sip:a', contactstatus: 'Removed' });
    await collectTick(collector); cache.invalidate('live:');
    expect((await collector.overview(42)).endpoints.online).toBe(1);
    (collector as any).onEvent({ event: 'ContactStatus', endpointname: 'e101_42', uri: 'sip:b', contactstatus: 'Reachable', expirationtime: 1 });
    await collectTick(collector); cache.invalidate('live:');
    expect((await collector.overview(42)).endpoints.online).toBe(0);
  });
  it('preserves unknown contacts and uses normalized DeviceState as a fallback', async () => {
    const { collector, ami, states, cache } = setup();
    states.set('e101_42', { id: 'e101_42', tenantid: '42', callerid: '101', aors: 'e101_42' });
    ami.collectDashboardContacts.mockResolvedValue({ complete: true, events: [{ endpoint: 'e101_42', uri: 'sip:a', status: 'NonQualified' }] });
    await collectTick(collector); expect((await collector.overview(42)).endpoints).toMatchObject({ online: 0, unknown: 1 });
    ami.collectDashboardEndpoints.mockResolvedValue({ complete: true, events: [{ objectname: 'e101_42', devicestate: 'Not in use' }] });
    (collector as any).lastInventory = 0; await collectTick(collector); cache.invalidate('live:');
    expect((await collector.overview(42)).endpoints.online).toBe(1);
  });
  it('does not replace static-trunk reachability with a rejected outbound registration', async () => {
    const { collector, ami, states, aors, store } = setup();
    states.set('t_test_42', { id: 't_test_42', tenantid: '42', callerid: 'test', aors: 't_test_42' });
    aors.set('t_test_42', { id: 't_test_42', contact: 'sip:provider', qualify_frequency: 60 });
    ami.collectDashboardEndpoints.mockResolvedValue({ complete: true, events: [{ objectname: 't_test_42', devicestate: 'Not in use' }] });
    ami.collectDashboardContacts.mockResolvedValue({ complete: true, events: [] }); // Static AoRs are omitted by Asterisk22's bulk contact list.
    ami.collectDashboardRegistrations.mockResolvedValue({ complete: true, events: [{ objectname: 't_test_42', status: 'Rejected' }] });
    await collectTick(collector);
    expect((await collector.overview(42)).trunks).toMatchObject({ total: 1, online: 1, unknown: 0 });
    expect((await collector.trunks(42, {})).rows[0]).toMatchObject({ id: 't_test_42', status: 'online' });
    expect(ami.collectDashboardEndpoints).toHaveBeenCalledTimes(1);
    expect(ami.collectDashboardContacts).toHaveBeenCalledTimes(1);
    expect(ami.collectDashboardRegistrations).toHaveBeenCalledTimes(1);
    expect(store.select.mock.calls.filter(([sql]) => sql.includes('FROM ps_aors'))).toHaveLength(1);
  });
  it.each([
    { title: 'qualification disabled', config: { contact: 'sip:provider', qualify_frequency: 0 } },
    { title: 'qualification missing', config: { contact: 'sip:provider', qualify_frequency: null } },
    { title: 'no static contact', config: { contact: null, qualify_frequency: 60 } },
    { title: 'empty static contact', config: { contact: '  ', qualify_frequency: 60 } },
    { title: 'missing AoR', config: null },
  ])('does not infer trunk availability from positive DeviceState with $title', async ({ config }) => {
    const { collector, ami, states, aors } = setup();
    states.set('t_test_42', { id: 't_test_42', tenantid: '42', callerid: 'test', aors: 'aor_provider' });
    if (config) aors.set('aor_provider', { id: 'aor_provider', ...config });
    ami.collectDashboardEndpoints.mockResolvedValue({ complete: true, events: [{ objectname: 't_test_42', devicestate: 'Not in use' }] });
    await collectTick(collector);
    expect((await collector.overview(42)).trunks).toMatchObject({ total: 1, online: 0, unknown: 1 });
    expect((await collector.trunks(42, {})).rows[0].status).toBe('unknown');
  });
  it.each(['NonQualified', 'Unqualified', 'Unknown'])('keeps an explicit %s contact unknown despite qualified config and positive DeviceState', async status => {
    const { collector, ami, states, aors, cache } = setup();
    states.set('t_test_42', { id: 't_test_42', tenantid: '42', callerid: 'test', aors: 'aor_provider' });
    aors.set('aor_provider', { id: 'aor_provider', contact: 'sip:provider', qualify_frequency: 60 });
    ami.collectDashboardEndpoints.mockResolvedValue({ complete: true, events: [{ objectname: 't_test_42', devicestate: 'Not in use' }] });
    ami.collectDashboardContacts.mockResolvedValue({ complete: true, events: [{ aor: 'aor_provider', uri: 'sip:provider', status }] });
    await collectTick(collector);
    expect((await collector.trunks(42, {})).rows[0].status).toBe('unknown');
    (collector as any).onEvent({ event: 'DeviceStateChange', device: 'PJSIP/t_test_42', state: 'Not in use' });
    await collectTick(collector); cache.invalidate('live:');
    expect((await collector.overview(42)).trunks).toMatchObject({ total: 1, online: 0, unknown: 1 });
  });
  it('correlates multiple AoRs for qualified static fallback and explicit contacts without per-viewer queries', async () => {
    const { collector, ami, states, aors, store, cache } = setup();
    states.set('t_test_42', { id: 't_test_42', tenantid: '42', callerid: 'test', aors: ' aor_primary , aor_qualified ' });
    aors.set('aor_primary', { id: 'aor_primary', contact: 'sip:primary', qualify_frequency: 60 });
    aors.set('aor_qualified', { id: 'aor_qualified', contact: 'sip:qualified', qualify_frequency: 60 });
    ami.collectDashboardEndpoints.mockResolvedValue({ complete: true, events: [{ objectname: 't_test_42', devicestate: 'Not in use' }] });
    await collectTick(collector);
    expect((await collector.overview(42)).trunks.online).toBe(1);
    await Promise.all(Array.from({ length: 100 }, () => collector.overview(42)));
    expect(store.select.mock.calls.filter(([sql]) => sql.includes('FROM ps_aors'))).toHaveLength(1);
    expect(ami.collectDashboardEndpoints).toHaveBeenCalledTimes(1);
    ami.collectDashboardEndpoints.mockResolvedValue({ complete: true, events: [{ objectname: 't_test_42', devicestate: 'Unavailable' }] });
    aors.set('aor_primary', { id: 'aor_primary', contact: 'sip:primary', qualify_frequency: 0 });
    ami.collectDashboardContacts.mockResolvedValue({ complete: true, events: [{ aor: 'aor_primary', uri: 'sip:primary', status: 'Reachable' }] });
    (collector as any).lastInventory = 0; await collectTick(collector); cache.invalidate('live:');
    expect((await collector.trunks(42, {})).rows[0].status).toBe('online');
  });
  it('does not infer availability from aggregate DeviceState when referenced AoRs mix qualified and unqualified contacts', async () => {
    const { collector, ami, states, aors } = setup();
    states.set('t_test_42', { id: 't_test_42', tenantid: '42', callerid: 'test', aors: 'aor_disabled,aor_qualified' });
    aors.set('aor_disabled', { id: 'aor_disabled', contact: 'sip:unqualified', qualify_frequency: 0 });
    aors.set('aor_qualified', { id: 'aor_qualified', contact: 'sip:qualified', qualify_frequency: 60 });
    ami.collectDashboardEndpoints.mockResolvedValue({ complete: true, events: [{ objectname: 't_test_42', devicestate: 'Not in use' }] });
    await collectTick(collector);
    expect((await collector.overview(42)).trunks).toMatchObject({ total: 1, online: 0, unknown: 1 });
    expect((collector as any).trunkAors.get('t_test_42').qualifiedStatic).toBe(false);
  });
  it.each([false, true])('updates endpoint/AoR contact aliases on a negative event while preserving distinct reachable contacts: other=%s', async other => {
    const { collector, ami, states, aors, cache } = setup();
    states.set('t_test_42', { id: 't_test_42', tenantid: '42', callerid: 'test', aors: 'aor_first,aor_second' });
    aors.set('aor_first', { id: 'aor_first', contact: 'sip:first', qualify_frequency: 60 });
    aors.set('aor_second', { id: 'aor_second', contact: 'sip:second', qualify_frequency: 60 });
    ami.collectDashboardContacts.mockResolvedValue({ complete: true, events: [
      { aor: 'aor_first', uri: 'sip:first', status: 'Reachable' },
      { endpoint: 't_test_42', uri: 'sip:first', status: 'Reachable' },
      ...(other ? [{ aor: 'aor_second', uri: 'sip:second', status: 'Reachable' }] : []),
    ] });
    await collectTick(collector);
    expect((await collector.trunks(42, {})).rows[0].status).toBe('online');
    (collector as any).onEvent({ event: 'ContactStatus', endpointname: 't_test_42', uri: 'sip:first', contactstatus: 'Unreachable' });
    await collectTick(collector); cache.invalidate('live:');
    expect((collector as any).contactsByEndpoint.get('aor_first').get('sip:first').status).toBe('offline');
    expect((collector as any).contactsByEndpoint.get('t_test_42').get('sip:first').status).toBe('offline');
    expect((await collector.trunks(42, {})).rows[0].status).toBe(other ? 'online' : 'offline');
    if (other) {
      expect((collector as any).contactsByEndpoint.get('aor_second').get('sip:second').status).toBe('online');
      (collector as any).onEvent({ event: 'ContactStatus', endpointname: 't_test_42', uri: 'sip:second', contactstatus: 'Removed' });
      await collectTick(collector); cache.invalidate('live:');
      expect((await collector.trunks(42, {})).rows[0].status).toBe('offline');
    }
  });
  it('preserves renewal generations and resolves expiration for a contact stored under its AoR alias', async () => {
    const { collector, ami, states, aors, store } = setup();
    const oldExpiry = Date.now() + 1000; const newExpiry = oldExpiry + 600000;
    states.set('t_test_42', { id: 't_test_42', tenantid: '42', callerid: 'test', aors: 'aor_provider' });
    aors.set('aor_provider', { id: 'aor_provider', contact: 'sip:provider', qualify_frequency: 60 });
    ami.collectDashboardContacts.mockResolvedValue({ complete: true, events: [{ aor: 'aor_provider', uri: 'sip:provider', status: 'Reachable', expirationtime: oldExpiry }] });
    await collectTick(collector);
    const original = store.select.getMockImplementation()!;
    store.select.mockImplementation(sql => sql.includes('FROM ps_contacts WHERE')
      ? Promise.resolve([{ id: 'contact', endpoint: 't_test_42', uri: 'sip:provider', expiration_time: newExpiry }])
      : original(sql));
    (collector as any).onEvent({ event: 'ContactStatus', endpointname: 't_test_42', uri: 'sip:provider', contactstatus: 'Updated' });
    const contact = (collector as any).contactsByEndpoint.get('aor_provider').get('sip:provider');
    expect(contact).toMatchObject({ status: 'online', expires: null, renewalPreviousExpiry: oldExpiry });
    await collectTick(collector);
    expect(contact.expires).toBe(newExpiry); expect(contact.renewalPreviousExpiry).toBeUndefined();
    expect((collector as any).contactGenerations.has('t_test_42')).toBe(false);
    expect((collector as any).dirtyContacts.has('t_test_42')).toBe(false);
  });
  it('keeps the last complete qualified configuration stale when the AoR batch exceeds its cap', async () => {
    const { collector, ami, states, aors, store, cache } = setup();
    states.set('t_test_42', { id: 't_test_42', tenantid: '42', callerid: 'test', aors: 'aor_provider' });
    aors.set('aor_provider', { id: 'aor_provider', contact: 'sip:provider', qualify_frequency: 60 });
    ami.collectDashboardEndpoints.mockResolvedValue({ complete: true, events: [{ objectname: 't_test_42', devicestate: 'Not in use' }] });
    await collectTick(collector);
    const original = store.select.getMockImplementation()!;
    store.select.mockImplementation(sql => sql.includes('FROM ps_aors')
      ? Promise.resolve(Array(200001).fill({ id: 'aor_provider', contact: 'sip:provider', qualify_frequency: 0 }))
      : original(sql));
    (collector as any).lastInventory = 0; await collectTick(collector); cache.invalidate('live:');
    expect(await collector.overview(42)).toMatchObject({ trunks: { online: 1 }, inventorySource: { state: 'stale', message: 'inventoryFailed' } });
    expect((collector as any).inventoryRevision).toBe(1);
    expect((collector as any).trunkAors.get('t_test_42').qualifiedStatic).toBe(true);
  });
  it.each([['t_spbx_42', 'trunk', 'unknown'], ['e101_42', 'endpoint', 'offline']])('keeps no-contact %s with Unavailable DeviceState %s as %s', async (id, kind, expected) => {
    const { collector, ami, states } = setup();
    states.set(id, { id, tenantid: '42', callerid: id, aors: id });
    ami.collectDashboardEndpoints.mockResolvedValue({ complete: true, events: [{ objectname: id, devicestate: 'Unavailable' }] });
    ami.collectDashboardContacts.mockResolvedValue({ complete: true, events: [] });
    await collectTick(collector);
    const page = kind === 'trunk' ? await collector.trunks(42, {}) : await collector.endpoints(42, {});
    expect(page.rows[0].status).toBe(expected);
    const summary = await collector.overview(42);
    expect(kind === 'trunk' ? summary.trunks : summary.endpoints).toMatchObject({ total: 1, online: 0, unknown: expected === 'unknown' ? 1 : 0 });
    expect(ami.collectDashboardEndpoints).toHaveBeenCalledTimes(1);
    expect(ami.collectDashboardContacts).toHaveBeenCalledTimes(1);
  });
  it.each(['device', 'contact'])('does not let Registry rejection erase positive %s availability', async source => {
    const { collector, ami, states, cache, aors } = setup();
    states.set('t_test_42', { id: 't_test_42', tenantid: '42', callerid: 'test', aors: 't_test_42' });
    aors.set('t_test_42', { id: 't_test_42', contact: 'sip:provider', qualify_frequency: 60 });
    ami.collectDashboardEndpoints.mockResolvedValue({ complete: true, events: [{ objectname: 't_test_42', devicestate: source === 'device' ? 'Not in use' : 'Unavailable' }] });
    ami.collectDashboardContacts.mockResolvedValue({ complete: true, events: source === 'contact' ? [{ endpoint: 't_test_42', uri: 'sip:provider', status: 'Reachable' }] : [] });
    await collectTick(collector);
    (collector as any).onEvent({ event: 'Registry', objectname: 't_test_42', status: 'Rejected' });
    await collectTick(collector); cache.invalidate('live:');
    expect((await collector.overview(42)).trunks).toMatchObject({ total: 1, online: 1, unknown: 0 });
    expect(ami.collectDashboardEndpoints).toHaveBeenCalledTimes(1);
  });
  it('does not let a Registered result rescue explicitly unreachable SIP contacts', async () => {
    const { collector, ami, states, cache } = setup();
    states.set('t_test_42', { id: 't_test_42', tenantid: '42', callerid: 'test', aors: 't_test_42' });
    ami.collectDashboardEndpoints.mockResolvedValue({ complete: true, events: [{ objectname: 't_test_42', devicestate: 'Not in use' }] });
    ami.collectDashboardContacts.mockResolvedValue({ complete: true, events: [{ endpoint: 't_test_42', uri: 'sip:provider', status: 'Unreachable' }] });
    ami.collectDashboardRegistrations.mockResolvedValue({ complete: true, events: [{ objectname: 't_test_42', status: 'Registered' }] });
    await collectTick(collector);
    (collector as any).onEvent({ event: 'Registry', objectname: 't_test_42', status: 'Registered' });
    await collectTick(collector); cache.invalidate('live:');
    expect((await collector.overview(42)).trunks).toMatchObject({ total: 1, online: 0, unknown: 0 });
    expect((await collector.trunks(42, {})).rows[0].status).toBe('offline');
  });
  it.each([['Avail', 'online'], ['Unavail', 'offline']])('normalizes SIP contact alias %s in bulk snapshots and events to %s', async (status, expected) => {
    const { collector, ami, states, cache } = setup();
    states.set('t_test_42', { id: 't_test_42', tenantid: '42', callerid: 'test', aors: 't_test_42' });
    ami.collectDashboardContacts.mockResolvedValue({ complete: true, events: [{ endpoint: 't_test_42', uri: 'sip:provider', status }] });
    await collectTick(collector);
    expect((await collector.trunks(42, {})).rows[0].status).toBe(expected);
    (collector as any).onEvent({ event: 'ContactStatus', endpointname: 't_test_42', uri: 'sip:provider', contactstatus: status === 'Avail' ? 'Unavail' : 'Avail' });
    await collectTick(collector); cache.invalidate('live:');
    expect((await collector.trunks(42, {})).rows[0].status).toBe(expected === 'online' ? 'offline' : 'online');
  });
  it('preserves contact/device availability when Registry rejection arrives during snapshot replay', async () => {
    const { collector, ami, states, aors } = setup();
    states.set('t_test_42', { id: 't_test_42', tenantid: '42', callerid: 'test', aors: 't_test_42' });
    aors.set('t_test_42', { id: 't_test_42', contact: 'sip:provider', qualify_frequency: 60 });
    ami.collectDashboardEndpoints.mockResolvedValue({ complete: true, events: [{ objectname: 't_test_42', devicestate: 'Not in use' }] });
    ami.collectDashboardRegistrations.mockImplementationOnce(async () => {
      (collector as any).onEvent({ event: 'Registry', objectname: 't_test_42', status: 'Rejected' });
      return { complete: true, events: [{ objectname: 't_test_42', status: 'Registered' }] };
    });
    await collectTick(collector);
    expect((await collector.overview(42)).trunks).toMatchObject({ total: 1, online: 1, unknown: 0 });
  });
  it('does not treat an outgoing caller already Up as a connected conversation', async () => {
    const { collector } = setup([{ uniqueid: 'caller', linkedid: 'one', channel: 'PJSIP/e101_42-01', context: 'sip-out42', channelstatedesc: 'Up', application: 'Dial' }, { uniqueid: 'remote', linkedid: 'one', channel: 'PJSIP/t_trunk_42-02', context: 'sip-out42', channelstatedesc: 'Ring' }]);
    await collectTick(collector); expect((await collector.overview(42)).talking).toBe(0);
    expect((await collector.overview(42)).ringing).toBe(1);
  });
  it('shows a working incoming AI conversation as talking without a human endpoint', async () => {
    const { collector, store } = setup([{ uniqueid: 'remote', linkedid: 'one', channel: 'PJSIP/t_trunk_42-01', context: 'sip-in42', channelstatedesc: 'Up', application: 'Stasis' }]);
    (collector as any).aiTables = new Set(['ai_voice_sessions', 'ai_voice_turns']);
    const original = store.select.getMockImplementation()!;
    store.select.mockImplementation(async (sql: string) => sql.includes('FROM ai_voice_sessions') ? [{ vpbx_user_uid: 42, channel_uniqueid: 'remote' }] as any : original(sql));
    await collectTick(collector); expect((await collector.overview(42)).talking).toBe(1);
  });

  it('keeps reachability during Updated renewals and refreshes expiration in one SQL batch', async () => {
    const { collector, ami, states, cache, store } = setup();
    states.set('e101_42', { id: 'e101_42', tenantid: '42', callerid: '101', aors: 'e101_42' });
    ami.collectDashboardContacts.mockResolvedValue({ complete: true, events: [{ endpoint: 'e101_42', uri: 'sip:a', status: 'Reachable', expirationtime: Date.now() / 1000 + 10 }] });
    await collectTick(collector);
    const original = store.select.getMockImplementation()!;
    store.select.mockImplementation(async (sql: string) => sql.includes('FROM ps_contacts WHERE') ? [{ id: 'contact', endpoint: 'e101_42', uri: 'sip:a', expiration_time: Date.now() / 1000 + 600 }] as any : original(sql));
    for (let i = 0; i < 100; i++) (collector as any).onEvent({ event: 'ContactStatus', endpointname: 'e101_42', uri: 'sip:a', contactstatus: 'Updated' });
    await collectTick(collector); cache.invalidate('live:');
    expect((await collector.overview(42)).endpoints.online).toBe(1);
    expect(ami.collectDashboardContacts).toHaveBeenCalledTimes(1);
    expect(store.select.mock.calls.filter(([sql]) => sql.includes('FROM ps_contacts WHERE'))).toHaveLength(1);
  });

  it('restores an explicit bridge with a Local peer on cold start and clears an explicitly empty bridge', async () => {
    const human = { uniqueid: 'human', linkedid: 'one', channel: 'PJSIP/e101_42-01', context: 'sip-in42', channelstatedesc: 'Up', bridgeid: 'bridge-one' };
    const local = { uniqueid: 'local', linkedid: 'one', channel: 'Local/route-02', context: '', channelstatedesc: 'Up' };
    const { collector, ami, cache } = setup([human, local]);
    await collectTick(collector); expect((await collector.overview(42)).talking).toBe(1);
    ami.getActiveChannels.mockResolvedValue({ complete: true, events: [{ ...human, bridgeid: '' }, local] });
    (collector as any).lastCalls = 0; await collectTick(collector); cache.invalidate('live:');
    expect((await collector.overview(42)).talking).toBe(0);
    expect((await collector.overview(42)).waiting).toBe(1);
  });

  it('keeps 2000 renewed endpoints online when the old deadline passes before the second SQL batch', async () => {
    const realNow = Date.now; let now = realNow();
    const spy = jest.spyOn(Date, 'now').mockImplementation(() => now);
    try {
      const { collector, ami, states, store, cache } = setup();
      const contacts = Array.from({ length: 2000 }, (_, index) => {
        const endpoint = `e${index + 100}_42`; states.set(endpoint, { id: endpoint, tenantid: '42', callerid: String(index), aors: endpoint });
        return { endpoint, uri: `sip:${index}`, status: 'Reachable', expirationtime: now / 1000 + 1 };
      });
      ami.collectDashboardContacts.mockResolvedValue({ complete: true, events: contacts });
      await collectTick(collector);
      const original = store.select.getMockImplementation()!;
      store.select.mockImplementation(async (sql: string, args?: any) => sql.includes('FROM ps_contacts WHERE') ? contacts.filter((contact) => args.endpoints.includes(contact.endpoint)).map((contact) => ({ id: contact.uri, endpoint: contact.endpoint, uri: contact.uri, expiration_time: now / 1000 + 600 })) as any : original(sql));
      for (const contact of contacts) (collector as any).onEvent({ event: 'ContactStatus', endpointname: contact.endpoint, uri: contact.uri, contactstatus: 'Updated' });
      now += 5000; await collectTick(collector); cache.invalidate('live:');
      expect((await collector.overview(42)).endpoints.online).toBe(2000);
      expect((collector as any).dirtyContacts.size).toBe(1000);
      expect((collector as any).contactGenerations.size).toBe(1000);
      now += 5000; await collectTick(collector); cache.invalidate('live:');
      expect((await collector.overview(42)).endpoints.online).toBe(2000);
      expect((collector as any).dirtyContacts.size).toBe(0);
      expect((collector as any).contactGenerations.size).toBe(0);
      expect(ami.collectDashboardContacts).toHaveBeenCalledTimes(1);
    } finally { spy.mockRestore(); }
  });
  it('ignores stale SQL expiration when Updated arrives during the await and retries the pending endpoint', async () => {
    const { collector, ami, states, store, cache } = setup();
    states.set('e101_42', { id: 'e101_42', tenantid: '42', callerid: '101', aors: 'e101_42' });
    ami.collectDashboardContacts.mockResolvedValue({ complete: true, events: [{ endpoint: 'e101_42', uri: 'sip:a', status: 'Reachable', expirationtime: Date.now() / 1000 + 1 }] });
    await collectTick(collector);
    (collector as any).onEvent({ event: 'ContactStatus', endpointname: 'e101_42', uri: 'sip:a', contactstatus: 'Updated' });
    const original = store.select.getMockImplementation()!; let first = true;
    store.select.mockImplementation(async (sql: string) => {
      if (!sql.includes('FROM ps_contacts WHERE')) return original(sql);
      if (first) {
        first = false;
        (collector as any).onEvent({ event: 'ContactStatus', endpointname: 'e101_42', uri: 'sip:a', contactstatus: 'Updated' });
        return [{ id: 'sip:a', endpoint: 'e101_42', uri: 'sip:a', expiration_time: 1 }] as any;
      }
      return [{ id: 'sip:a', endpoint: 'e101_42', uri: 'sip:a', expiration_time: Date.now() / 1000 + 600 }] as any;
    });
    await collectTick(collector); cache.invalidate('live:');
    expect((await collector.overview(42)).endpoints.online).toBe(1);
    expect((collector as any).contactsByEndpoint.get('e101_42').get('sip:a').expires).toBeNull();
    expect((collector as any).dirtyContacts.has('e101_42')).toBe(true);
    await collectTick(collector); cache.invalidate('live:');
    expect((await collector.overview(42)).endpoints.online).toBe(1);
    expect((collector as any).dirtyContacts.size).toBe(0);
    expect(ami.collectDashboardContacts).toHaveBeenCalledTimes(1);
  });
  it('does not replace unknown renewed expiration with zero when SQL has not published the row', async () => {
    const { collector, ami, states, store, cache } = setup();
    states.set('e101_42', { id: 'e101_42', tenantid: '42', callerid: '101', aors: 'e101_42' });
    ami.collectDashboardContacts.mockResolvedValue({ complete: true, events: [{ endpoint: 'e101_42', uri: 'sip:a', status: 'Reachable', expirationtime: Date.now() / 1000 + 1 }] });
    await collectTick(collector);
    const original = store.select.getMockImplementation()!;
    store.select.mockImplementation(async (sql: string) => sql.includes('FROM ps_contacts WHERE') ? [] : original(sql));
    (collector as any).onEvent({ event: 'ContactStatus', endpointname: 'e101_42', uri: 'sip:a', contactstatus: 'Updated' });
    await collectTick(collector); cache.invalidate('live:');
    expect((await collector.overview(42)).endpoints.online).toBe(1);
    expect((collector as any).contactsByEndpoint.get('e101_42').get('sip:a').expires).toBeNull();
    expect((collector as any).dirtyContacts.has('e101_42')).toBe(true);
  });

  it('accepts a renewed registration with a shorter valid timeout', async () => {
    let now = Date.now(); const spy = jest.spyOn(Date, 'now').mockImplementation(() => now);
    try {
      const { collector, ami, states, store, cache } = setup();
      states.set('e101_42', { id: 'e101_42', tenantid: '42', callerid: '101', aors: 'e101_42' });
      ami.collectDashboardContacts.mockResolvedValue({ complete: true, events: [{ endpoint: 'e101_42', uri: 'sip:a', status: 'Reachable', expirationtime: now / 1000 + 600 }] });
      await collectTick(collector);
      const newDeadline = now + 120000; const original = store.select.getMockImplementation()!;
      store.select.mockImplementation(async (sql: string) => sql.includes('FROM ps_contacts WHERE') ? [{ id: 'sip:a', endpoint: 'e101_42', uri: 'sip:a', expiration_time: newDeadline / 1000 }] as any : original(sql));
      (collector as any).onEvent({ event: 'ContactStatus', endpointname: 'e101_42', uri: 'sip:a', contactstatus: 'Updated' });
      await collectTick(collector); expect((collector as any).contactsByEndpoint.get('e101_42').get('sip:a').expires).toBe(newDeadline);
      now += 180000; await collectTick(collector); cache.invalidate('live:');
      expect((await collector.overview(42)).endpoints.online).toBe(0);
    } finally { spy.mockRestore(); }
  });

  it('does not present legacy recognized STT text followed by a TTS failure as talking', async () => {
    const { collector, store } = setup([{ uniqueid: 'remote', linkedid: 'one', channel: 'PJSIP/t_trunk_42-01', context: 'sip-in42', channelstatedesc: 'Up', application: 'VoiceRobot' }]);
    (collector as any).aiTables = new Set(['voice_robot_logs']);
    const original = store.select.getMockImplementation()!;
    store.select.mockImplementation(async (sql: string) => sql.includes('FROM voice_robot_logs') ? [{ user_uid: 42, call_uniqueid: 'remote', recognized_text: 'hello', ai_response: 'hello back', error: 'TTS failed' }] as any : original(sql));
    await collectTick(collector);
    expect((await collector.overview(42)).talking).toBe(0);
    expect(store.select.mock.calls.some(([sql]) => sql.includes('FROM voice_robot_logs'))).toBe(false);
  });

  it('keeps publishing and reconciling channels through a 75-second inventory with independent lease heartbeat', async () => {
    jest.useFakeTimers();
    const { collector, ami, states, store, cache } = setup([{ uniqueid: 'one', linkedid: 'one', channel: 'PJSIP/e101_42-01', context: 'sip-out42' }]);
    states.set('e101_42', { id: 'e101_42', tenantid: '42', callerid: '101', aors: 'e101_42' });
    let finish!: (value: any) => void;
    try {
      await collectTick(collector); const updatedAt = (collector as any).inventorySource.updatedAt;
      ami.collectDashboardEndpoints.mockImplementationOnce((signal?: AbortSignal) => new Promise((resolve) => { finish = resolve; signal?.addEventListener('abort', () => resolve({ complete: false, events: [] }), { once: true }); }));
      const heartbeat = jest.spyOn(collector as any, 'renewInventoryLease');
      (collector as any).lastInventory = 0; await collector.tick(); const task = (collector as any).inventoryTask;
      collector.onModuleInit(); await jest.advanceTimersByTimeAsync(75000);
      expect(heartbeat.mock.calls.length).toBeGreaterThanOrEqual(5);
      expect(ami.getActiveChannels.mock.calls.length).toBeGreaterThanOrEqual(3);
      expect(store.upsert.mock.calls.length).toBeGreaterThanOrEqual(15);
      expect(ami.collectDashboardEndpoints).toHaveBeenCalledTimes(2);
      expect((collector as any).inventoryTask).toBe(task);
      cache.invalidate('live:');
      expect(await collector.overview(42)).toMatchObject({ activeCalls: 1, endpoints: { total: 1 }, inventorySource: { state: 'stale', updatedAt } });
      // Reaching a scheduled reconciliation boundary still reuses the pending job.
      (collector as any).lastInventory = 0; await collector.tick(); expect(ami.collectDashboardEndpoints).toHaveBeenCalledTimes(2);
      finish({ complete: true, events: [] }); await task; await collector.tick(); cache.invalidate('live:');
      expect((await collector.overview(42)).inventorySource?.state).toBe('ok');
      expect(store.upsert.mock.calls.every((call: any[]) => call[3] !== undefined)).toBe(true);
    } finally { await collector.onModuleDestroy(); jest.useRealTimers(); }
  });
  it('keeps a slow heartbeat single-flight and aborts inventory on lease loss', async () => {
    jest.useFakeTimers(); const { collector, ami, store } = setup();
    let completeHeartbeat!: (value: boolean) => void;
    try {
      await collectTick(collector);
      ami.collectDashboardEndpoints.mockImplementationOnce((signal?: AbortSignal) => new Promise((resolve) => signal?.addEventListener('abort', () => resolve({ complete: false, events: [] }), { once: true })));
      (collector as any).lastInventory = 0; await collector.tick();
      store.renewLease.mockImplementationOnce(() => new Promise((resolve) => { completeHeartbeat = resolve; }));
      const heartbeat = jest.spyOn(collector as any, 'renewInventoryLease');
      await jest.advanceTimersByTimeAsync(45000); expect(heartbeat).toHaveBeenCalledTimes(1);
      completeHeartbeat(false); await (collector as any).leaseHeartbeatTask; await (collector as any).inventoryTask;
      expect((collector as any).leader).toBe(false); expect((collector as any).inventorySource.state).toBe('stale');
      expect((collector as any).inventoryHeartbeat).toBeNull();
    } finally { await collector.onModuleDestroy(); jest.useRealTimers(); }
  });
  it('prevents a follower from starting lists and rejects an obsolete inventory after ownership changes during SQL', async () => {
    const { collector, ami, store, states } = setup();
    states.set('e101_42', { id: 'e101_42', tenantid: '42', callerid: 'old', aors: 'e101_42' });
    await collectTick(collector);
    const original = store.select.getMockImplementation()!;
    let leaseOwner = (collector as any).owner; let finishRows!: (rows: any[]) => void; let holdRows = true;
    store.acquireLease.mockImplementation(async (_key: string, owner: string) => owner === leaseOwner);
    store.renewLease.mockImplementation(async (_key: string, owner: string) => owner === leaseOwner);
    store.select.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM dashboard_leases')) return [{ owner: leaseOwner, expires_at: Date.now() + 60000 }] as any;
      if (sql.includes('FROM ps_endpoints') && holdRows) { holdRows = false; return new Promise((resolve) => { finishRows = resolve; }); }
      return original(sql);
    });
    (collector as any).lastInventory = 0; await collector.tick(); const obsolete = (collector as any).inventoryTask;
    const follower = new DashboardCollectorService(store as any, ami as any, new ConfigService({ AMI_SECRET: 'test' }), new DashboardCacheService());
    await follower.tick(); expect(ami.collectDashboardEndpoints).toHaveBeenCalledTimes(2);
    leaseOwner = (follower as any).owner;
    await (collector as any).renewInventoryLease((collector as any).generation);
    states.clear(); states.set('e202_43', { id: 'e202_43', tenantid: '43', callerid: 'new', aors: 'e202_43' });
    await collectTick(follower); const published = store.upsert.mock.calls.length;
    finishRows([{ id: 'e999_42', tenantid: '42', callerid: 'obsolete', aors: 'e999_42' }]); await obsolete;
    expect((collector as any).inventory.map((row: any) => row.id)).toEqual(['e101_42']);
    expect((follower as any).inventory.map((row: any) => row.id)).toEqual(['e202_43']);
    expect(store.upsert.mock.calls).toHaveLength(published); expect(ami.collectDashboardEndpoints).toHaveBeenCalledTimes(3);
    await collector.onModuleDestroy(); await follower.onModuleDestroy();
  });
  it('invalidates a reconnecting inventory and waits for its settlement before starting another list', async () => {
    const { collector, ami, states } = setup(); states.set('e101_42', { id: 'e101_42', tenantid: '42', callerid: 'old', aors: 'e101_42' });
    await collectTick(collector); let finish!: (value: any) => void;
    // An adapter that cannot immediately cancel must still be fenced at eventual completion.
    ami.collectDashboardEndpoints.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    (collector as any).lastInventory = 0; await collector.tick(); const obsolete = (collector as any).inventoryTask;
    (collector as any).onEvent({ event: 'DashboardConnection', connected: true }); await collector.tick();
    expect(ami.collectDashboardEndpoints).toHaveBeenCalledTimes(2);
    finish({ complete: true, events: [] }); await obsolete;
    expect((collector as any).inventoryRevision).toBe(1);
    await collectTick(collector); expect(ami.collectDashboardEndpoints).toHaveBeenCalledTimes(3); expect((collector as any).inventoryRevision).toBe(2);
    await collector.onModuleDestroy();
  });
  it('aborts a pending inventory before releasing its lease on shutdown and never publishes afterward', async () => {
    const { collector, ami, store } = setup(); await collectTick(collector);
    let signal!: AbortSignal;
    ami.collectDashboardEndpoints.mockImplementationOnce((value?: AbortSignal) => { signal = value!; return new Promise((resolve) => signal.addEventListener('abort', () => resolve({ complete: false, events: [] }), { once: true })); });
    (collector as any).lastInventory = 0; await collector.tick(); const published = store.upsert.mock.calls.length;
    await collector.onModuleDestroy(); expect(signal.aborted).toBe(true);
    expect((collector as any).inventoryTask).toBeNull(); expect((collector as any).inventoryHeartbeat).toBeNull();
    expect(store.releaseLease).toHaveBeenCalledTimes(1); await collector.tick(); expect(store.upsert.mock.calls).toHaveLength(published);
  });
  it('rolls back delayed publication when shutdown begins before the transaction can commit', async () => {
    const { collector, store } = setup(); await collectTick(collector);
    let finish!: () => void; let commits = 0; let entered!: () => void;
    const started = new Promise<void>((resolve) => { entered = resolve; });
    store.sequelize.transaction = async (work: (tx: unknown) => Promise<void>) => { await work({}); commits++; };
    store.upsert.mockImplementationOnce(async () => { entered(); await new Promise<void>((resolve) => { finish = resolve; }); });
    const tick = collector.tick(); await started; const stopping = collector.onModuleDestroy();
    expect(store.releaseLease).not.toHaveBeenCalled(); finish(); await tick; await stopping;
    expect(commits).toBe(0); expect(store.releaseLease).toHaveBeenCalledTimes(1);
  });

  it('replays contact removal received during a slow inventory without resurrecting registration', async () => {
    const { collector, ami, states, cache } = setup(); states.set('e101_42', { id: 'e101_42', tenantid: '42', callerid: '101', aors: 'e101_42' });
    ami.collectDashboardContacts.mockResolvedValue({ complete: true, events: [{ endpoint: 'e101_42', uri: 'sip:a', status: 'Reachable' }] });
    await collectTick(collector); let finish!: (value: any) => void;
    ami.collectDashboardEndpoints.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    (collector as any).lastInventory = 0; await collector.tick(); const task = (collector as any).inventoryTask;
    (collector as any).onEvent({ event: 'ContactStatus', endpointname: 'e101_42', uri: 'sip:a', contactstatus: 'Removed' });
    finish({ complete: true, events: [] }); await task; await collector.tick(); cache.invalidate('live:');
    expect((await collector.overview(42)).endpoints).toMatchObject({ total: 1, online: 0 });
    expect((collector as any).contactsByEndpoint.get('e101_42').get('sip:a').status).toBe('offline');
    await collector.onModuleDestroy();
  });
  it('retains the last complete inventory when any of the bulk lists is incomplete', async () => {
    const { collector, ami, states, cache } = setup(); states.set('e101_42', { id: 'e101_42', tenantid: '42', callerid: '101', aors: 'e101_42' });
    await collectTick(collector);
    ami.collectDashboardEndpoints.mockResolvedValue({ complete: false, events: [] }); (collector as any).lastInventory = 0;
    await collectTick(collector); cache.invalidate('live:');
    expect((collector as any).inventory).toHaveLength(1);
    // Failed inventory is published on the next ordinary cycle, with retained values.
    await collector.tick(); cache.invalidate('live:');
    expect(await collector.overview(42)).toMatchObject({ endpoints: { total: 1 }, inventorySource: { state: 'stale', message: 'incompleteInventory' } });
    await collector.onModuleDestroy();
  });
  it('keeps a failed source single-flight until its remaining bulk siblings settle', async () => {
    const { collector, ami } = setup(); await collectTick(collector); let finish!: (value: any) => void;
    ami.collectDashboardEndpoints.mockRejectedValueOnce(new Error('AMI source failed'));
    ami.collectDashboardContacts.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    (collector as any).lastInventory = 0; await collector.tick(); const task = (collector as any).inventoryTask;
    (collector as any).lastInventory = 0; await collector.tick(); expect((collector as any).inventoryTask).toBe(task);
    expect(ami.collectDashboardEndpoints).toHaveBeenCalledTimes(2);
    finish({ complete: true, events: [] }); await task;
    expect((collector as any).inventorySource).toMatchObject({ state: 'stale', message: 'inventoryFailed' });
    await collector.onModuleDestroy();
  });

  it('hydrates 10k endpoints and 1k calls on a cold owner while slow/failed initial snapshots retain original age', async () => {
    jest.useFakeTimers();
    const channels = Array.from({ length: 1000 }, (_, i) => ({ uniqueid: `u${i}`, linkedid: `l${i}`, channel: 'PJSIP/e101_42-01', context: 'sip-out42' }));
    const initial = setup(channels);
    for (let i = 0; i < 10000; i++) initial.states.set(`e${i + 100}_42`, { id: `e${i + 100}_42`, tenantid: '42', callerid: String(i), aors: '' });
    await collectTick(initial.collector);
    const saved = JSON.parse(initial.store.upsert.mock.calls.at(-1)![1].payload); const oldAge = new Date(Date.now() - 600000).toISOString();
    saved.source.updatedAt = oldAge; saved.inventorySource.updatedAt = oldAge;
    // Fallback inventory has no contact reducer: its persisted status must not be re-expired.
    for (const row of saved.inventory) { row.status = 'online'; row.expires = Date.now() - 1; }
    await initial.collector.onModuleDestroy();
    const { collector, cache } = restartFixture(initial, saved); let finish!: (value: any) => void;
    initial.ami.getActiveChannels.mockResolvedValue({ complete: false, events: [] });
    initial.ami.collectDashboardEndpoints.mockImplementationOnce((signal?: AbortSignal) => new Promise((resolve) => { finish = resolve; signal?.addEventListener('abort', () => resolve({ complete: false, events: [] }), { once: true }); }));
    try {
      initial.store.select.mockClear(); await collector.tick(); collector.onModuleInit(); await jest.advanceTimersByTimeAsync(75000); cache.invalidate('live:');
      expect(await collector.overview(42)).toMatchObject({ activeCalls: 1000, endpoints: { total: 10000, online: 10000 }, callsSource: { state: 'stale', updatedAt: oldAge }, inventorySource: { state: 'stale', updatedAt: oldAge } });
      const hydration = initial.store.select.mock.calls.filter(([sql]) => sql.includes('OCTET_LENGTH'));
      expect(hydration).toHaveLength(1);
      expect((hydration[0] as any[])[1].maxBytes).toBe(32 * 1024 * 1024);
      const task = (collector as any).inventoryTask; finish({ complete: false, events: [] }); await task; await collector.tick(); cache.invalidate('live:');
      expect(await collector.overview(42)).toMatchObject({ activeCalls: 1000, endpoints: { total: 10000, online: 10000 }, callsSource: { updatedAt: oldAge }, inventorySource: { state: 'stale', updatedAt: oldAge } });
      initial.ami.getActiveChannels.mockResolvedValue({ complete: true, events: [] }); (collector as any).lastCalls = 0;
      await collector.tick(); cache.invalidate('live:');
      expect(await collector.overview(42)).toMatchObject({ activeCalls: 0, endpoints: { total: 10000 }, callsSource: { state: 'ok' }, inventorySource: { state: 'stale', updatedAt: oldAge } });
      initial.states.clear(); initial.ami.collectDashboardEndpoints.mockResolvedValue({ complete: true, events: [] }); (collector as any).lastInventory = 0;
      await collectTick(collector); cache.invalidate('live:');
      expect(await collector.overview(42)).toMatchObject({ activeCalls: 0, endpoints: { total: 0 }, callsSource: { state: 'ok' }, inventorySource: { state: 'ok' } });
      expect((collector as any).fallbackPayload).toBeNull();
    } finally { await collector.onModuleDestroy(); jest.useRealTimers(); }
  });
  it('replaces only inventory fallback with a complete empty inventory while calls still lack a complete snapshot', async () => {
    const initial = setup([{ uniqueid: 'one', linkedid: 'one', channel: 'PJSIP/e101_42-01', context: 'sip-out42' }]);
    initial.states.set('e101_42', { id: 'e101_42', tenantid: '42', callerid: '101', aors: '' }); await collectTick(initial.collector);
    const saved = JSON.parse(initial.store.upsert.mock.calls.at(-1)![1].payload); await initial.collector.onModuleDestroy();
    const { collector, cache } = restartFixture(initial, saved); initial.states.clear(); initial.ami.getActiveChannels.mockResolvedValue({ complete: false, events: [] });
    await collectTick(collector); cache.invalidate('live:');
    expect(await collector.overview(42)).toMatchObject({ activeCalls: 1, endpoints: { total: 0 }, callsSource: { state: 'stale', updatedAt: saved.source.updatedAt }, inventorySource: { state: 'ok' } });
    await collector.onModuleDestroy();
  });
  it('reports unavailable on first partial calls/inventory without a completed fallback instead of presenting zero as stale data', async () => {
    const { collector, ami, cache } = setup();
    ami.getActiveChannels.mockResolvedValue({ complete: false, events: [] }); ami.collectDashboardEndpoints.mockResolvedValue({ complete: false, events: [] });
    await collectTick(collector); await collector.tick(); cache.invalidate('live:');
    expect(await collector.overview(42)).toMatchObject({ callsSource: { state: 'unavailable', updatedAt: null }, inventorySource: { state: 'unavailable', updatedAt: null } });
    await collector.onModuleDestroy();
  });
  it.each(['SQL', 'lease'])('rejects inventory replay overflow arriving during the final %s await', async (stage) => {
    const { collector, ami, store, states } = setup(); states.set('e101_42', { id: 'e101_42', tenantid: '42', callerid: 'old', aors: '' }); await collectTick(collector);
    const original = store.select.getMockImplementation()!; let finishRows!: (value: any[]) => void; let hold = true;
    store.select.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM ps_endpoints') && hold) { hold = false; return new Promise((resolve) => { finishRows = resolve; }); }
      return original(sql);
    });
    (collector as any).lastInventory = 0; await collector.tick(); const task = (collector as any).inventoryTask;
    let finishRenew!: (value: boolean) => void;
    if (stage === 'lease') {
      let entered!: () => void; const renewing = new Promise<void>((resolve) => { entered = resolve; });
      store.renewLease.mockImplementationOnce(() => { entered(); return new Promise((resolve) => { finishRenew = resolve; }); });
      finishRows([{ id: 'e202_42', tenantid: '42', callerid: 'new', aors: '' }]); await renewing;
    }
    for (let i = 0; i < 50001; i++) (collector as any).onEvent({ event: 'DeviceStateChange', device: 'PJSIP/unknown', state: 'In use' });
    if (stage === 'SQL') finishRows([{ id: 'e202_42', tenantid: '42', callerid: 'new', aors: '' }]); else finishRenew(true);
    await task;
    expect((collector as any).inventory.map((row: any) => row.id)).toEqual(['e101_42']);
    expect((collector as any).inventoryRevision).toBe(1);
    expect((collector as any).inventorySource).toMatchObject({ state: 'stale', message: 'incompleteInventory' });
    expect(ami.collectDashboardEndpoints).toHaveBeenCalledTimes(2); await collector.onModuleDestroy();
  });

  it.each([null, 'calls', 'inventory'])('retains disconnected cold-start snapshots independently when %s lacks a previous timestamp', async (missing) => {
    const initial = setup([{ uniqueid: 'one', linkedid: 'one', channel: 'PJSIP/e101_42-01', context: 'sip-out42' }]);
    initial.states.set('e101_42', { id: 'e101_42', tenantid: '42', callerid: '101', aors: '' }); await collectTick(initial.collector);
    const saved = JSON.parse(initial.store.upsert.mock.calls.at(-1)![1].payload); const age = new Date(Date.now() - 600000).toISOString();
    saved.source.updatedAt = missing === 'calls' ? null : age; saved.inventorySource.updatedAt = missing === 'inventory' ? null : age;
    await initial.collector.onModuleDestroy(); const { collector, cache } = restartFixture(initial, saved);
    initial.ami.isConnected.mockReturnValue(false); initial.ami.getActiveChannels.mockClear(); initial.ami.collectDashboardEndpoints.mockClear();
    await collector.tick(); cache.invalidate('live:');
    const view = await collector.overview(42);
    expect(view).toMatchObject({ activeCalls: missing === 'calls' ? 0 : 1, endpoints: { total: missing === 'inventory' ? 0 : 1 }, callsSource: { state: missing === 'calls' ? 'unavailable' : 'stale', updatedAt: missing === 'calls' ? null : age, message: 'callsDisconnected' }, inventorySource: { state: missing === 'inventory' ? 'unavailable' : 'stale', updatedAt: missing === 'inventory' ? null : age, message: 'inventoryDisconnected' } });
    expect(initial.ami.getActiveChannels).not.toHaveBeenCalled(); expect(initial.ami.collectDashboardEndpoints).not.toHaveBeenCalled();
    await collector.onModuleDestroy();
  });
  it('retains last complete calls/inventory and their age after an AMI disconnect event', async () => {
    const { collector, ami, states, cache } = setup([{ uniqueid: 'one', linkedid: 'one', channel: 'PJSIP/e101_42-01', context: 'sip-out42' }]);
    states.set('e101_42', { id: 'e101_42', tenantid: '42', callerid: '101', aors: '' }); await collectTick(collector);
    const callsAge = (collector as any).callsSource.updatedAt; const inventoryAge = (collector as any).inventorySource.updatedAt;
    ami.isConnected.mockReturnValue(false); (collector as any).onEvent({ event: 'DashboardConnection', connected: false });
    await collector.tick(); cache.invalidate('live:');
    expect(await collector.overview(42)).toMatchObject({ activeCalls: 1, endpoints: { total: 1 }, callsSource: { state: 'stale', updatedAt: callsAge, message: 'callsDisconnected' }, inventorySource: { state: 'stale', updatedAt: inventoryAge, message: 'inventoryDisconnected' } });
    await collector.onModuleDestroy();
  });
  it.each([{ AMI_SECRET: 'test' }, {}])('keeps disconnected first startup without saved data unavailable/not configured: %j', async (config) => {
    const { collector, ami } = setup([], config); ami.isConnected.mockReturnValue(false); await collector.tick();
    const state = 'AMI_SECRET' in config ? 'unavailable' : 'notConfigured';
    expect(await collector.overview(42)).toMatchObject({ callsSource: { state, updatedAt: null }, inventorySource: { state, updatedAt: null } });
    await collector.onModuleDestroy();
  });


  it('classifies real employee-to-trunk ringing and employee-only technical calls without waiting for a context update', async () => {
    const { collector } = setup(); await collectTick(collector);
    const event=(uniqueid:string,channel:string,linkedid:string,context='internal')=>({event:'Newchannel',uniqueid,linkedid,channel,context,calleridnum:'101',exten:'900',channelstatedesc:'Ring'});
    (collector as any).onEvent(event('root','PJSIP/e101_42-1','root'));
    (collector as any).onEvent(event('peer','PJSIP/t_test_42-2','root','sip-in42'));
    const first=(collector as any).buildPayload(); expect(first.calls['42'][0]).toMatchObject({direction:'out',src:'101',state:'ringing'});
    (collector as any).onEvent({event:'Hangup',uniqueid:'root'});
    expect((collector as any).buildPayload().calls['42'][0]).toMatchObject({direction:'out',src:'101'});
    (collector as any).onEvent({event:'Hangup',uniqueid:'peer'}); (collector as any).buildPayload();
    expect((collector as any).origins.size).toBe(0);
    (collector as any).onEvent(event('ivr','PJSIP/e101_42-3','ivr'));
    (collector as any).onEvent({event:'Newstate',uniqueid:'ivr',channelstatedesc:'Up',application:'Playback'});
    expect((collector as any).buildPayload().calls['42'][0]).toMatchObject({direction:'internal',state:'waiting'});
  });
  it('keeps inbound source, direction and start across a disappearing origin and surviving transfer legs', async () => {
    const { collector } = setup(); await collectTick(collector);
    const original={event:'Newchannel',uniqueid:'root',linkedid:'root',channel:'PJSIP/t_in_42-1',context:'sip-in42',calleridnum:'lab-caller',exten:'101',channelstatedesc:'Up'};
    (collector as any).onEvent(original);
    (collector as any).onEvent({...original,uniqueid:'one',channel:'PJSIP/e101_42-2',context:'internal',calleridnum:'101'});
    const before=(collector as any).buildPayload().calls['42'][0];
    (collector as any).onEvent({event:'Hangup',uniqueid:'root'});
    (collector as any).onEvent({...original,uniqueid:'out',channel:'PJSIP/t_out_42-3',context:'sip-out42',calleridnum:'101'});
    const after=(collector as any).buildPayload().calls['42'][0];
    expect(after).toMatchObject({direction:'in',src:'lab-caller',linkedid:'root',startedAt:before.startedAt});
  });
  it('restores versioned source metadata after a restart with only surviving peer channels', async () => {
    const { collector,store,ami,states,aors } = setup(); await collectTick(collector);
    (collector as any).onEvent({event:'Newchannel',uniqueid:'root',linkedid:'root',channel:'PJSIP/t_in_42-1',context:'sip-in42',calleridnum:'lab-caller',exten:'101',channelstatedesc:'Up'});
    (collector as any).onEvent({event:'Newchannel',uniqueid:'peer',linkedid:'root',channel:'PJSIP/e101_42-2',context:'internal',calleridnum:'101',exten:'101',channelstatedesc:'Up'});
    const saved=(collector as any).buildPayload();
    const restarted=restartFixture({collector,store,ami,states,aors,cache:new DashboardCacheService()},saved);
    ami.getActiveChannels.mockResolvedValue({complete:true,events:[{uniqueid:'peer',linkedid:'root',channel:'PJSIP/e101_42-2',context:'internal',calleridnum:'101',exten:'101',channelstatedesc:'Up'}]});
    await collectTick(restarted.collector);
    const page=await restarted.collector.calls(42,{outcome:'active'});
    expect(page.rows[0]).toMatchObject({direction:'in',src:'lab-caller',startedAt:saved.calls['42'][0].startedAt});
    expect(page.rows[0]).not.toHaveProperty('originState',expect.anything());
  });

  it('locks outbound direction on peer arrival before an immediate transfer removes the root before publication', async () => {
    const {collector}=setup(); await collectTick(collector);
    (collector as any).onEvent({event:'Newchannel',uniqueid:'root',linkedid:'root',channel:'PJSIP/e101_42-1',context:'internal',calleridnum:'101',exten:'900'});
    (collector as any).onEvent({event:'Newchannel',uniqueid:'peer',linkedid:'root',channel:'PJSIP/t_out_42-2',context:'sip-in42',calleridnum:'lab',exten:'900'});
    (collector as any).onEvent({event:'Hangup',uniqueid:'root'});
    expect((collector as any).buildPayload().calls['42'][0]).toMatchObject({direction:'out',src:'101'});
  });

  it('captures cold snapshot outbound origin before a terminal Hangup is replayed', async () => {
    const {collector,ami}=setup();
    ami.getActiveChannels.mockImplementation(async()=>{
      (collector as any).onEvent({event:'Hangup',uniqueid:'root'});
      return {complete:true,events:[{uniqueid:'root',linkedid:'root',channel:'PJSIP/e101_42-1',context:'internal',calleridnum:'101',exten:'900'},
        {uniqueid:'peer',linkedid:'root',channel:'PJSIP/t_out_42-2',context:'sip-in42',calleridnum:'lab-trunk',exten:'900'}]};
    });
    await collectTick(collector); const page=await collector.calls(42,{outcome:'active'});
    expect(page.rows[0]).toMatchObject({direction:'out',src:'101',linkedid:'root'});
  });
});
