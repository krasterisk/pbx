import { Sequelize as BaseSequelize } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import { ConfigService } from '@nestjs/config';
import { DashboardSystemService } from './dashboard-system.service';
import { DashboardReadStore } from './dashboard-read-store.service';

const { injectReplacements } = require('sequelize/lib/utils/sql') as {
  injectReplacements(sql: string, dialect: unknown, replacements: Record<string, unknown>): string;
};

/** Actual Sequelize lexer catches placeholders skipped by the dialect tokenizer. No DB connection is made. */
describe.each(['mysql', 'postgres'] as const)('system SQL replacement lexer (%s)', (dialectName) => {
  it('expands every collection, retention and history query with the real dialect', async () => {
    const database = new BaseSequelize({ dialect: dialectName, database: 'unused', username: 'unused', password: 'unused', logging: false });
    const expanded: string[] = [];
    const query = jest.fn(async (sql: string, options: { replacements: Record<string, unknown> }) => {
      const result = injectReplacements(sql, (database as unknown as { dialect: unknown }).dialect, options.replacements);
      expect(result).not.toMatch(/:(?:nodeId|at|payload|cutoff|from|to|step)\b/);
      expanded.push(result);
      return [];
    });
    const target = { id: 'pbx', label: 'PBX', role: 'asterisk', url: 'http://127.0.0.1:9100/metrics', filesystems: ['/'] };
    const config = { get: (key: string, fallback?: string) => key === 'DEPLOYMENT_MODE' ? 'BOX'
      : key === 'PBX_MONITORING_TARGETS' ? JSON.stringify([target]) : fallback } as ConfigService;
    const store = { acquireLease: jest.fn().mockResolvedValue(true), renewLease: jest.fn().mockResolvedValue(true) } as unknown as DashboardReadStore;
    const service = new DashboardSystemService({ query, getDialect: () => dialectName } as unknown as Sequelize, config, store);
    jest.spyOn(service as unknown as { fetchExporter: (url: string) => Promise<string> }, 'fetchExporter')
      .mockResolvedValue('node_memory_MemTotal_bytes 1000\nnode_memory_MemAvailable_bytes 900');
    try {
      await service.collect();
      await service.detail('pbx', '7d');
      expect(expanded).toHaveLength(4);
      expect(expanded[0]).toContain("node_id = 'pbx'");
      expect(expanded[1]).toContain('INSERT INTO dashboard_system_samples');
      expect(expanded[2]).toContain('DELETE FROM dashboard_system_samples');
      expect(expanded[3]).toContain('GROUP BY FLOOR((sampled_at - ');
    } finally { await database.close(); }
  });
});
