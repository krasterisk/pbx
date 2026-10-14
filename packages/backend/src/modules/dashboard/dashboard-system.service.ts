import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QueryTypes } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import { randomUUID } from 'node:crypto';
import { get as httpGet } from 'node:http';
import { get as httpsGet } from 'node:https';
import type { DashboardSystemNode, DashboardSystemResponse, DashboardWarning } from '@krasterisk/shared';
import { DashboardReadStore } from './dashboard-read-store.service';
import { parseNodeExporter, type ParsedExporter } from './dashboard-node-exporter';

export interface MonitoringTarget { id: string; label: string; role: 'asterisk' | 'application'; url: string; recordsMount?: string; filesystems?: string[] }
interface Threshold { warningSince: number | null; criticalSince: number | null }
interface StoredSample extends ParsedExporter { thresholds: { cpu: Threshold; memory: Threshold } }
interface State { value: StoredSample | null; failed: boolean }
const PERIODS = { '1h': 3_600_000, '24h': 86_400_000, '7d': 604_800_000 };
const emptyThreshold = (): Threshold => ({ warningSince: null, criticalSince: null });

function validMonitoringMount(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('/') && value.length <= 255
    && !Array.from(value).some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127) && !value.includes('//')
    && (value === '/' || !value.endsWith('/')) && !value.split('/').some((part) => part === '.' || part === '..');
}

export function monitoringTargets(raw: string | undefined): MonitoringTarget[] {
  if (!raw?.trim()) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed) || parsed.length > 8) throw new Error('PBX_MONITORING_TARGETS must contain at most 8 nodes');
  const ids = new Set<string>();
  return parsed.map((value: unknown) => {
    if (!value || typeof value !== 'object') throw new Error('Invalid monitoring node');
    const row = value as Record<string, unknown>;
    if (typeof row.id !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(row.id) || ids.has(row.id)) throw new Error('Invalid or duplicate monitoring node id');
    if (typeof row.label !== 'string' || !row.label.trim() || row.label.length > 128) throw new Error('Invalid monitoring node label');
    if (row.role !== 'asterisk' && row.role !== 'application') throw new Error('Invalid monitoring node role');
    if (typeof row.url !== 'string' || row.url.length > 2048) throw new Error('Invalid exporter URL');
    const url = new URL(row.url);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.hash) throw new Error('Exporter must use HTTP(S) without URL credentials');
    if (row.recordsMount !== undefined && !validMonitoringMount(row.recordsMount)) throw new Error('Invalid recording mount');
    if (row.filesystems !== undefined && (!Array.isArray(row.filesystems) || row.filesystems.length < 1 || row.filesystems.length > 8
      || row.filesystems.some((mount) => !validMonitoringMount(mount)) || new Set(row.filesystems).size !== row.filesystems.length)) {
      throw new Error('filesystems must contain 1 to 8 unique absolute mountpoints');
    }
    ids.add(row.id);
    return { id: row.id, label: row.label.trim(), role: row.role, url: url.toString(), recordsMount: row.recordsMount as string | undefined, filesystems: row.filesystems as string[] | undefined };
  });
}

/** Background-only host collection. HTTP methods never contact an exporter. */
@Injectable()
export class DashboardSystemService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DashboardSystemService.name);
  private readonly owner = randomUUID();
  private readonly targets: MonitoringTarget[];
  private readonly states = new Map<string, State>();
  private readonly historyCache = new Map<string, { expires: number; result: DashboardSystemResponse['history']; pending?: Promise<DashboardSystemResponse['history']> }>();
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  private destroyed = false;
  private nextCleanup = 0;
  private readonly configInvalid: boolean;
  private readonly enabled: boolean;

  constructor(private readonly sequelize: Sequelize, private readonly config: ConfigService, private readonly store: DashboardReadStore) {
    this.enabled = this.config.get<string>('DEPLOYMENT_MODE', 'BOX').trim().toLowerCase() !== 'cloud';
    let targets: MonitoringTarget[] = []; let invalid = false;
    if (this.enabled) {
      try { targets = monitoringTargets(this.config.get<string>('PBX_MONITORING_TARGETS')); }
      catch { invalid = true; this.logger.error('PBX_MONITORING_TARGETS is invalid; host monitoring is unavailable'); }
    }
    this.targets = targets;
    this.configInvalid = invalid;
    for (const target of targets) this.states.set(target.id, { value: null, failed: false });
  }

  onModuleInit(): void {
    if (!this.enabled || !this.targets.length) return;
    void this.collect();
    this.timer = setInterval(() => void this.collect(), 15_000);
    this.timer.unref();
  }

  async onModuleDestroy(): Promise<void> {
    this.destroyed = true;
    if (this.timer) clearInterval(this.timer);
    await Promise.allSettled(this.targets.map((target) => this.store.releaseLease(`exporter:${target.id}`, this.owner)));
  }

  async getOverview(): Promise<DashboardSystemNode[]> {
    if (!this.enabled) return [];
    return this.targets.map((target) => {
      const value = this.states.get(target.id)?.value;
      const updated = value ? Date.parse(value.sample.at) : null;
      return { id: target.id, label: target.label, role: target.role, current: value?.sample ?? null,
        source: { state: updated === null ? 'unavailable' : Date.now() - updated >= 45_000 ? 'stale' : 'ok',
          updatedAt: value?.sample.at ?? null, ...(updated === null ? { message: 'systemSampleUnavailable' } : value?.sample.missingFilesystems?.length ? { message: 'systemFilesystemUnavailable' } : {}) } };
    });
  }

  getWarnings(): DashboardWarning[] {
    if (!this.enabled) return [];
    if (!this.targets.length) return [{ code: this.configInvalid ? 'systemConfigInvalid' : 'systemNotConfigured', severity: 'warning', count: 1, target: 'system' }];
    const counts = new Map<string, DashboardWarning>();
    const add = (code: string, severity: 'warning' | 'critical') => {
      const key = `${code}:${severity}`;
      const prior = counts.get(key);
      counts.set(key, { code, severity, count: (prior?.count ?? 0) + 1, target: 'system' });
    };
    for (const target of this.targets) {
      const value = this.states.get(target.id)?.value;
      if (!value || Date.now() - Date.parse(value.sample.at) >= 45_000) { add('systemSampleUnavailable', 'warning'); continue; }
      for (const kind of ['cpu', 'memory'] as const) {
        const threshold = value.thresholds[kind];
        if (threshold.criticalSince !== null && Date.now() - threshold.criticalSince >= 300_000) add(kind === 'cpu' ? 'systemCpuHigh' : 'systemMemoryHigh', 'critical');
        else if (threshold.warningSince !== null && Date.now() - threshold.warningSince >= 300_000) add(kind === 'cpu' ? 'systemCpuHigh' : 'systemMemoryHigh', 'warning');
      }
      if (value.sample.missingFilesystems?.length) add('systemFilesystemUnavailable', 'warning');
      const highDisks = value.sample.disks.filter((disk) => disk.usedPercent >= 85);
      if (highDisks.length) add('systemDiskHigh', highDisks.some((disk) => disk.usedPercent >= 95) ? 'critical' : 'warning');
    }
    return [...counts.values()];
  }

  async detail(nodeId?: string, range = '24h'): Promise<DashboardSystemResponse> {
    if (!this.enabled) throw new NotFoundException('System monitoring is only available in box mode');
    if (!(range in PERIODS)) throw new BadRequestException('range must be 1h, 24h or 7d');
    const target = nodeId ? this.targets.find((node) => node.id === nodeId) : this.targets.find((node) => node.role === 'asterisk') ?? this.targets[0];
    const nodes = await this.getOverview();
    if (!target) {
      if (nodeId) throw new NotFoundException('Monitoring node is not configured');
      return { nodes };
    }
    const key = `${target.id}:${range}`;
    const cached = this.historyCache.get(key);
    if (cached?.pending) return { nodes, history: await cached.pending };
    if (cached && cached.expires > Date.now()) return { nodes, history: cached.result };
    const pending = this.history(target.id, PERIODS[range as keyof typeof PERIODS]);
    this.historyCache.set(key, { expires: 0, result: [], pending });
    try {
      const result = await pending;
      this.historyCache.set(key, { expires: Date.now() + 15_000, result });
      return { nodes, history: result };
    } catch {
      this.historyCache.delete(key);
      return { nodes: nodes.map((node) => node.id === target.id ? { ...node, source: { ...node.source, state: 'unavailable', message: 'systemHistoryUnavailable' } } : node), history: [] };
    }
  }

  /** Public for the scale harness; the scheduled single collector owns work. */
  async collect(): Promise<void> {
    if (this.destroyed || this.running || !this.enabled) return;
    this.running = true;
    try {
      await Promise.allSettled(this.targets.map(async (target) => {
        try {
          const leader = await this.store.acquireLease(`exporter:${target.id}`, this.owner, 45_000);
          const current = this.states.get(target.id)!;
          if (!current.value || !leader) {
            const rows = await this.sequelize.query<{ payload: string }>(
              'SELECT payload FROM dashboard_system_samples WHERE node_id = :nodeId ORDER BY sampled_at DESC LIMIT 1',
              { replacements: { nodeId: target.id }, type: QueryTypes.SELECT },
            );
            if (rows[0]) current.value = this.stored(rows[0].payload);
          }
          if (!leader || this.destroyed) return;
          const body = await this.fetchExporter(target.url);
          const at = Date.now();
          const parsed = parseNodeExporter(body, at, target.recordsMount, current.value ?? undefined, target.filesystems);
          const continuous = current.value !== null && at - Date.parse(current.value.sample.at) <= 45_000;
          const thresholds = { cpu: emptyThreshold(), memory: emptyThreshold() };
          for (const kind of ['cpu', 'memory'] as const) {
            const prior = continuous ? current.value!.thresholds[kind] : emptyThreshold();
            const number = parsed.sample[kind];
            thresholds[kind] = {
              warningSince: number !== null && number >= 85 ? prior.warningSince ?? at : null,
              criticalSince: number !== null && number >= 95 ? prior.criticalSince ?? at : null,
            };
          }
          const value: StoredSample = { ...parsed, thresholds };
          if (this.destroyed || !await this.store.renewLease(`exporter:${target.id}`, this.owner, 45_000)) return;
          await this.sequelize.query('INSERT INTO dashboard_system_samples (node_id, sampled_at, payload) VALUES (:nodeId, :at, :payload)',
            { replacements: { nodeId: target.id, at, payload: JSON.stringify(value) } });
          current.value = value; current.failed = false;
        } catch {
          this.states.get(target.id)!.failed = true;
          // Keep the last complete sample. Failure never becomes a zero.
        }
      }));
      if (Date.now() >= this.nextCleanup && await this.store.acquireLease('exporter:retention', this.owner, 60_000)) {
        await this.sequelize.query('DELETE FROM dashboard_system_samples WHERE sampled_at < :cutoff',
          { replacements: { cutoff: Date.now() - PERIODS['7d'] } });
        this.nextCleanup = Date.now() + 3_600_000;
      }
    } catch { /* A failed retention/lease source cannot terminate the timer. */ }
    finally { this.running = false; }
  }

  protected fetchExporter(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const get = url.startsWith('https:') ? httpsGet : httpGet;
      const request = get(url, { timeout: 5_000, headers: { Accept: 'text/plain', 'Accept-Encoding': 'identity' } }, (response) => {
        if (response.statusCode !== 200) { response.resume(); reject(new Error('Exporter HTTP failure')); return; }
        const chunks: Buffer[] = []; let bytes = 0;
        response.on('data', (chunk: Buffer) => {
          bytes += chunk.length;
          if (bytes > 2 * 1024 * 1024) { request.destroy(new Error('Exporter body limit exceeded')); return; }
          chunks.push(chunk);
        });
        response.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        response.on('error', reject);
      });
      const deadline = setTimeout(() => request.destroy(new Error('Exporter deadline exceeded')), 5_000);
      deadline.unref();
      request.on('close', () => clearTimeout(deadline));
      request.on('timeout', () => request.destroy(new Error('Exporter timeout')));
      request.on('error', reject);
    });
  }

  private stored(payload: string): StoredSample {
    const value = JSON.parse(payload) as StoredSample;
    if (!value.sample || !Number.isFinite(Date.parse(value.sample.at)) || !value.counters || !value.thresholds) throw new Error('Invalid stored host sample');
    return value;
  }

  private async history(nodeId: string, duration: number): Promise<DashboardSystemResponse['history']> {
    const to = Date.now(); const from = to - duration; const step = Math.ceil(duration / 299);
    const postgres = this.sequelize.getDialect() === 'postgres';
    const field = (name: string) => postgres
      ? `CAST(CAST(payload AS jsonb)->'sample'->>'${name}' AS DECIMAL(12,5))`
      : `CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(payload, '$.sample.${name}')), 'null') AS DECIMAL(12,5))`;
    const rows = await this.sequelize.query<{ bucket: number | string; cpu: number | string | null; cpu_max: number | string | null; memory: number | string | null; memory_max: number | string | null }>(
      `SELECT FLOOR((sampled_at - :from) / :step) AS bucket,
       AVG(${field('cpu')}) AS cpu, MAX(${field('cpu')}) AS cpu_max,
       AVG(${field('memory')}) AS memory, MAX(${field('memory')}) AS memory_max
       FROM dashboard_system_samples WHERE node_id = :nodeId AND sampled_at >= :from AND sampled_at <= :to
       GROUP BY FLOOR((sampled_at - :from) / :step) ORDER BY bucket LIMIT 300`,
      { replacements: { nodeId, from, to, step }, type: QueryTypes.SELECT },
    );
    const map = new Map(rows.map((row) => [Number(row.bucket), row]));
    const nullable = (value: number | string | null | undefined) => value === null || value === undefined ? null : Number(value);
    return Array.from({ length: Math.floor(duration / step) + 1 }, (_, index) => {
      const row = map.get(index);
      return { at: new Date(from + index * step).toISOString(), cpu: nullable(row?.cpu), cpuMax: nullable(row?.cpu_max),
        memory: nullable(row?.memory), memoryMax: nullable(row?.memory_max) };
    });
  }
}
