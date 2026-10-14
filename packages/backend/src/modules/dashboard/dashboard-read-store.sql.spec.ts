import { ConfigService } from '@nestjs/config';
import { Sequelize } from 'sequelize-typescript';
import { DashboardReadStore } from './dashboard-read-store.service';
import { DashboardCacheService } from './dashboard-cache.service';
import { classifyDashboardCall } from './dashboard-classifier';
// Exercise the real Sequelize lexer; mock-query string assertions cannot detect unreplaced placeholders.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { injectReplacements } = require('sequelize/lib/utils/sql');
describe('Dashboard generated SQL real Sequelize replacement lexer', () => {
  it.each(['mysql', 'postgres'] as const)('replaces all named parameters in %s SQL paths', async (dialect) => {
    const database = new Sequelize({ dialect, logging: false });
    const owner = 'test-owner'; const key = 'projection:node';
    const emitted: string[] = [];
    const query = jest.fn(async (sql: string, options: any = {}) => {
      const rendered = injectReplacements(sql, (database as any).dialect, options.replacements || {});
      expect(rendered).not.toMatch(/:(?:step|delta|tenant|from|to|id|until|owner|key|source|limit|cursorAt|cursorId|direction|origin|outcome|search)\b/);
      emitted.push(rendered);
      if (sql.includes('SELECT owner,expires_at')) return [{ owner, expires_at: Date.now() + 100000 }];
      if (sql.includes('SELECT source_key')) return ['cdr:node', 'projection:node'].map((source_key) => ({ source_key, cursor_value: 1, initialized_from: 0, bootstrap_complete: 1, updated_at: Date.now() }));
      if (sql.startsWith('SELECT * FROM dashboard_calls')) return [{ tenant: 42, node_id: 'node', started_at: Date.parse('2026-10-01T00:00:00Z'), direction: 'in', outcome: 'missed', origin: 'telephony', fingerprint: 'different' }];
      return [];
    });
    const sequelize = { getDialect: () => dialect, query, transaction: async (optionsOrWork: any, work?: (tx: unknown) => Promise<unknown>) => (work || optionsOrWork)({}) };
    const store = new DashboardReadStore(sequelize as any, new ConfigService({ DASHBOARD_NODE_ID: 'node' }), new DashboardCacheService());
    const period = { period: 'custom' as const, from: '2026-10-01T00:00:00Z', to: '2026-10-02T00:00:00Z' };
    await store.acquireLease(key, owner); await store.renewLease(key, owner); await store.releaseLease(key, owner);
    await store.saveCheckpoint('cdr:node', 100, 0, true, undefined, owner);
    await store.summary(42, period);
    await store.summary(42, { ...period, direction: 'in', outcome: 'accepted', origin: 'ai', search: '101' }, 'UTC', { operators: ['101'], ownExten: '102', queues: ['700'] });
    await store.calls(42, { ...period, cursor: Buffer.from(JSON.stringify({ at: Date.parse(period.to), id: 'a'.repeat(64) })).toString('base64url') });
    const call = classifyDashboardCall(42, 'node', [{ uniqueid: 'one', linkedid: 'one', calldate: '2026-10-01 00:00:00', channel: 'PJSIP/e101_42-01', dstchannel: 'PJSIP/e102_42-02', disposition: 'ANSWERED', duration: 5 }], { complete: true });
    await store.putCall(call, owner);
    expect(emitted.length).toBeGreaterThan(15);
    expect(emitted.some((sql) => sql.includes('FLOOR'))).toBe(true);
    expect(emitted.some((sql) => sql.includes('call_count'))).toBe(true);
    await database.close();
  });
});
