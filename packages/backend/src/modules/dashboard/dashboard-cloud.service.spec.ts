import { DashboardCloudService } from './dashboard-cloud.service';
import { Sequelize } from 'sequelize-typescript';
import { ConfigService } from '@nestjs/config';

describe('DashboardCloudService', () => {
  const query = jest.fn();
  const service = new DashboardCloudService({ query } as unknown as Sequelize, { get: jest.fn().mockReturnValue('UTC') } as unknown as ConfigService);
  beforeEach(() => query.mockReset());
  it('joins billing using cabinet id, counts queues without loading entities, keeps unknown limits', async () => {
    query.mockResolvedValueOnce([{ id: 7, plan_name: 'Pro', plan_expires_at: null, max_extensions: 10000,
      max_trunks: 10, max_queues: 50, max_concurrent_calls: null, status: 'active',
      balance_id: 3, balance_kopecks: '12000', credit_limit_kopecks: '5000', is_blocked: false }]);
    query.mockResolvedValueOnce([{ count: 8 }]);
    const value = await service.overview(42);
    expect(query.mock.calls[0][0]).toContain('b.tenant_id = t.id');
    expect(query.mock.calls[0][1].replacements).toEqual({ tenantUid: 42 });
    expect(value.balanceKopecks).toBe(12000);
    expect(value.limits.concurrentCalls).toBeNull();
    expect(value.usage.queues).toBe(8);
    expect(value.source.state).toBe('ok');
  });
  it('does not fabricate a zero balance if the billing row is missing', async () => {
    query.mockResolvedValueOnce([{ id: 7, plan_name: 'Configured plan', plan_expires_at: null, balance_id: null }]).mockResolvedValueOnce([{ count: 0 }]);
    const value = await service.overview(42);
    expect(value.balanceKopecks).toBeNull();
    expect(value.source.state).toBe('ok');
    expect(value.billingSource?.state).toBe('notConfigured');
    expect(value.planName).toBe('Configured plan');
  });
  it('distinguishes configuration absence from a failed data source', async () => {
    query.mockResolvedValueOnce([]);
    expect((await service.overview(42)).source.state).toBe('notConfigured');
    query.mockRejectedValueOnce(new Error('database down'));
    expect((await service.overview(42)).source.state).toBe('unavailable');
  });
  it('uses organization IANA timezone and defaults only if unset or invalid', async () => {
    query.mockResolvedValueOnce([{ timezone: 'Asia/Krasnoyarsk' }]);
    expect(await service.timezone(42)).toBe('Asia/Krasnoyarsk');
    query.mockResolvedValueOnce([{ timezone: 'bad/zone' }]);
    expect(await service.timezone(42)).toBe('UTC');
  });
});
