import { dashboardInventoryKey, DASHBOARD_SNAPSHOT_SELECT, decodeDashboardSnapshot, encodeDashboardSnapshot } from './dashboard-snapshot-storage';

describe('Dashboard durable snapshot layout', () => {
  const snapshot = { version: '1', inventory: [{ id: 'e101_42', tenant: 42, status: 'online' }], calls: { '42': [{ linkedid: 'call' }] }, source: { state: 'ok' } };
  it('round-trips every field while the compact row excludes the inventory', () => {
    const encoded = encodeDashboardSnapshot('node', snapshot);
    expect(JSON.parse(encoded.payload)).not.toHaveProperty('inventory');
    expect(decodeDashboardSnapshot('node', { payload: encoded.payload, inventory_payload: encoded.inventory })).toEqual(snapshot);
  });
  it('keeps a fixed bounded per-node key and hashes inventory independently of heartbeat and calls', () => {
    const a = encodeDashboardSnapshot('node', snapshot);
    const b = encodeDashboardSnapshot('node', { ...snapshot, version: '2', calls: {} });
    expect(b.hash).toBe(a.hash); expect(b.key).toBe(a.key);
    expect(a.key.length).toBeLessThanOrEqual(80);
    expect(dashboardInventoryKey('other')).not.toBe(a.key);
    expect(encodeDashboardSnapshot('node', { ...snapshot, inventory: [] }).hash).not.toBe(a.hash);
  });
  it('reads legacy inline records without requiring a second row', () => {
    expect(decodeDashboardSnapshot('node', { payload: JSON.stringify(snapshot) })).toEqual(snapshot);
  });
  it.each(['missing', 'wrong-node', 'corrupt', 'changed-hash', 'bad-ref'] as const)('fails closed for %s inventory without substituting empty data', kind => {
    const encoded = encodeDashboardSnapshot('node', snapshot);
    const saved = JSON.parse(encoded.inventory); const main = JSON.parse(encoded.payload);
    if (kind === 'wrong-node') saved.nodeId = 'other';
    if (kind === 'corrupt') saved.inventory = [];
    if (kind === 'changed-hash') saved.hash = '0'.repeat(64);
    if (kind === 'bad-ref') main.inventoryRef.key = dashboardInventoryKey('other');
    expect(() => decodeDashboardSnapshot('node', { payload: JSON.stringify(main), inventory_payload: kind === 'missing' ? undefined : JSON.stringify(saved) })).toThrow();
  });
  it('reads the live row and inventory in one bounded SQL snapshot', () => {
    expect(DASHBOARD_SNAPSHOT_SELECT).toContain('LEFT JOIN dashboard_live_state');
    expect(DASHBOARD_SNAPSHOT_SELECT).toContain('s.node_id=:node');
    expect(DASHBOARD_SNAPSHOT_SELECT).toContain('OCTET_LENGTH(i.payload)<=:maxBytes');
  });
});
