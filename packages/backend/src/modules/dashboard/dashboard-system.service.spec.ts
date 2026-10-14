import { ConfigService } from '@nestjs/config';
import { Sequelize } from 'sequelize-typescript';
import { DashboardSystemService, monitoringTargets } from './dashboard-system.service';
import { DashboardReadStore } from './dashboard-read-store.service';
const target = { id: 'pbx', label: 'PBX server', role: 'asterisk', url: 'http://127.0.0.1:9100/metrics' };
const host = 'node_memory_MemTotal_bytes 1000\nnode_memory_MemAvailable_bytes 100\nnode_filesystem_size_bytes{device="root",fstype="ext4",mountpoint="/"} 1000\nnode_filesystem_avail_bytes{device="root",fstype="ext4",mountpoint="/"} 900';

describe('DashboardSystemService', () => {
  const query = jest.fn();
  const lease = { acquireLease: jest.fn(), renewLease: jest.fn(), releaseLease: jest.fn() };
  const config = (mode = 'BOX') => ({ get: (key: string, fallback?: string) => key === 'DEPLOYMENT_MODE' ? mode : key === 'PBX_MONITORING_TARGETS' ? JSON.stringify([target]) : fallback }) as ConfigService;
  let service: DashboardSystemService;
  let fetch: jest.SpyInstance;
  beforeEach(() => {
    jest.clearAllMocks();
    query.mockResolvedValue([]); lease.acquireLease.mockResolvedValue(true); lease.renewLease.mockResolvedValue(true); lease.releaseLease.mockResolvedValue(undefined);
    service = new DashboardSystemService({ query, getDialect: () => 'postgres' } as unknown as Sequelize, config(), lease as unknown as DashboardReadStore);
    fetch = jest.spyOn(service as unknown as { fetchExporter: (url: string) => Promise<string> }, 'fetchExporter').mockResolvedValue(host);
  });
  it('shares background collection across viewers and keeps HTTP free from exporter requests', async () => {
    await service.collect();
    expect(fetch).toHaveBeenCalledTimes(1);
    query.mockClear();
    await Promise.all(Array.from({ length: 100 }, () => service.getOverview()));
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(query).not.toHaveBeenCalled();
    const [node] = await service.getOverview();
    expect(node.source.state).toBe('ok');
    expect(node.current?.memory).toBe(90);
  });
  it('keeps failed collection unknown, then retains previous complete values', async () => {
    fetch.mockRejectedValueOnce(new Error('exporter down'));
    await service.collect();
    expect((await service.getOverview())[0].current).toBeNull();
    await service.collect();
    const last = (await service.getOverview())[0].current;
    fetch.mockRejectedValueOnce(new Error('exporter down'));
    await service.collect();
    expect((await service.getOverview())[0].current).toEqual(last);
  });
  it('loads a shared SQL sample when another process owns collection', async () => {
    lease.acquireLease.mockResolvedValue(false);
    const now = new Date().toISOString();
    query.mockResolvedValueOnce([{ payload: JSON.stringify({ sample: { at: now, cpu: null, memory: 10, disks: [] }, counters: {}, thresholds: { cpu: { warningSince: null, criticalSince: null }, memory: { warningSince: null, criticalSince: null } } }) }]);
    await service.collect();
    expect(fetch).not.toHaveBeenCalled();
    expect((await service.getOverview())[0].current?.memory).toBe(10);
  });
  it('coalesces and bounds SQL history, preserves null gaps and peak values', async () => {
    query.mockResolvedValue([{ bucket: 0, cpu: '25', cpu_max: '90', memory: '50', memory_max: '95' }]);
    const results = await Promise.all(Array.from({ length: 100 }, () => service.detail('pbx', '7d')));
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0]).toContain('AVG(');
    expect(query.mock.calls[0][0]).toContain('MAX(');
    expect(results[0].history!.length).toBeLessThanOrEqual(300);
    expect(results[0].history![0]).toMatchObject({ cpu: 25, cpuMax: 90 });
    expect(results[0].history![1].cpu).toBeNull();
  });
  it('does not expose or collect server information in cloud', async () => {
    const cloud = new DashboardSystemService({ query } as unknown as Sequelize, config('CLOUD'), lease as unknown as DashboardReadStore);
    await cloud.collect();
    expect(await cloud.getOverview()).toEqual([]);
    await expect(cloud.detail()).rejects.toThrow('box mode');
    expect(lease.acquireLease).not.toHaveBeenCalled();
  });
  it('restricts users to configured node identifiers and known ranges', async () => {
    await expect(service.detail('http://attacker', '1h')).rejects.toThrow('not configured');
    await expect(service.detail('pbx', '1y')).rejects.toThrow('range');
  });
  it('fences a lost lease before persisting a newly collected sample', async () => {
    lease.renewLease.mockResolvedValue(false);
    await service.collect();
    expect(query.mock.calls.some((call) => call[0].startsWith('INSERT INTO dashboard_system_samples'))).toBe(false);
    expect((await service.getOverview())[0].current).toBeNull();
  });
  it('requires five sustained minutes for memory alerts and resets across missing samples', async () => {
    let now = 2_000_000;
    const clock = jest.spyOn(Date, 'now').mockImplementation(() => now);
    try {
      await service.collect();
      expect(service.getWarnings()).toEqual([]);
      for (let cycle = 0; cycle < 20; cycle++) { now += 15_000; await service.collect(); }
      expect(service.getWarnings()).toEqual([{ code: 'systemMemoryHigh', severity: 'warning', count: 1, target: 'system' }]);
      now += 60_000;
      expect(service.getWarnings()[0].code).toBe('systemSampleUnavailable');
      await service.collect();
      expect(service.getWarnings()).toEqual([]);
    } finally { clock.mockRestore(); }
  });
  it('checks missing/invalid configuration and bounded unique nodes', () => {
    expect(monitoringTargets(undefined)).toEqual([]);
    expect(() => monitoringTargets(JSON.stringify(Array(9).fill(target)))).toThrow('at most 8');
    expect(() => monitoringTargets(JSON.stringify([target, target]))).toThrow('duplicate');
    expect(() => monitoringTargets(JSON.stringify([{ ...target, url: 'file:///etc/passwd' }]))).toThrow('HTTP(S)');
  });
  it('exposes missing configured mounts as unknown and emits a warning', async () => {
    const configured = { get: (key: string, fallback?: string) => key === 'DEPLOYMENT_MODE' ? 'BOX'
      : key === 'PBX_MONITORING_TARGETS' ? JSON.stringify([{ ...target, filesystems: ['/', '/database'] }]) : fallback } as ConfigService;
    const selected = new DashboardSystemService({ query } as unknown as Sequelize, configured, lease as unknown as DashboardReadStore);
    jest.spyOn(selected as unknown as { fetchExporter: (url: string) => Promise<string> }, 'fetchExporter').mockResolvedValue(host);
    await selected.collect();
    const [node] = await selected.getOverview();
    expect(node.current?.missingFilesystems).toEqual(['/database']);
    expect(node.source).toMatchObject({ state: 'ok', message: 'systemFilesystemUnavailable' });
    expect(selected.getWarnings()).toEqual([{ code: 'systemFilesystemUnavailable', severity: 'warning', count: 1, target: 'system' }]);
  });
  it.each([[], Array(9).fill('/'), ['relative'], ['/a', '/a'], ['/a/../b'], ['/a\n'], 'all'])('validates bounded filesystem allowlist %j', (filesystems) => {
    expect(() => monitoringTargets(JSON.stringify([{ ...target, filesystems }]))).toThrow('filesystems');
  });
  it('accepts a canonical server-configured filesystem allowlist', () => {
    expect(monitoringTargets(JSON.stringify([{ ...target, filesystems: ['/', '/var/lib/mysql', '/records'] }]))[0].filesystems)
      .toEqual(['/', '/var/lib/mysql', '/records']);
  });
});
