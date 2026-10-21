import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectConnection } from '@nestjs/sequelize';
import { QueryTypes } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import { AUTODIAL_SUPPORTED_ACTIONS, type IAutodialMonitorHealth } from '@krasterisk/shared';
import { AutodialStateService } from './autodial-state.service';
import { AutodialCampaignsService } from './autodial-campaigns.service';
import { AutodialDiagnosisService } from './autodial-diagnosis.service';
import { CallCenterStateService } from '../callcenter/callcenter-state.service';
import { AriConnectionService } from '../ari/ari-connection.service';
import { AmiService } from '../ami/ami.service';
import { autodialSqlDate } from './autodial-sql-time.util';

@Injectable()
export class AutodialMonitorService implements OnModuleInit, OnModuleDestroy {
  private unsubscribe?: () => void;
  private readonly cache = new Map<number, { expires: number; value: Promise<IAutodialMonitorHealth> }>();
  constructor(private readonly campaigns: AutodialCampaignsService, private readonly diagnosis: AutodialDiagnosisService,
    private readonly cc: CallCenterStateService, private readonly ari: AriConnectionService, private readonly ami: AmiService,
    @InjectConnection() private readonly db: Sequelize, private readonly state: AutodialStateService) {}
  onModuleInit() {
    this.unsubscribe = this.ami.subscribeInternalEvents((raw) => {
      const event = Object.fromEntries(Object.entries(raw).map(([key, value]) => [key.toLowerCase(), value]));
      if (event.event !== 'UserEvent' || event.userevent !== 'AutodialStep') return;
      const tenant = Number(event.tenant), attempt = Number(event.attempt), type = String(event.type ?? '');
      if (!Number.isSafeInteger(tenant) || !Number.isSafeInteger(attempt) || !(AUTODIAL_SUPPORTED_ACTIONS as readonly string[]).includes(type)) return;
      this.state.markStep(tenant, attempt, String(event.step ?? ''), type);
    });
  }
  onModuleDestroy() { this.unsubscribe?.(); this.cache.clear(); }

  health(tenant: number): Promise<IAutodialMonitorHealth> {
    const cached = this.cache.get(tenant); if (cached && cached.expires > Date.now()) return cached.value;
    const value = this.build(tenant).catch((error) => { this.cache.delete(tenant); throw error; });
    // Bound cache to active subscribers; no background polling for inactive tenants.
    if (this.cache.size > 1000) for (const [key, row] of this.cache) if (row.expires < Date.now()) this.cache.delete(key);
    this.cache.set(tenant, { expires: Date.now() + 5000, value }); return value;
  }

  private async build(tenant: number): Promise<IAutodialMonitorHealth> {
    const now = new Date();
    const anchor = new Date(autodialSqlDate(now, this.db).replace('T', ' ').slice(0, 16).replace(' ', 'T') + ':00Z').getTime();
    const minutes = Array.from({ length: 15 }, (_, index) => new Date(anchor - (14 - index) * 60000).toISOString().slice(0, 16).replace('T', ' '));
    const all = await this.campaigns.findAll(tenant);
    const rows = [...all].sort((a, b) => Number(['running', 'paused', 'scheduled'].includes(b.status)) - Number(['running', 'paused', 'scheduled'].includes(a.status)) || b.uid - a.uid).slice(0, 50);
    const agents = this.cc.getAllAgents(tenant);
    const bucket = this.db.getDialect() === 'postgres' ? "TO_CHAR(started_at, 'YYYY-MM-DD HH24:MI')" : "DATE_FORMAT(started_at, '%Y-%m-%d %H:%i')";
    const trend = rows.length ? await this.db.query<{ campaign_uid: number; minute: string; dials: number | string }>(
      `SELECT campaign_uid, ${bucket} AS minute, COUNT(*) AS dials FROM ac_attempts
       WHERE vpbx_user_uid = :tenant AND campaign_uid IN (:uids) AND started_at >= :from AND started_at <= :now
       GROUP BY campaign_uid, ${bucket} ORDER BY minute LIMIT 1000`,
      { replacements: { tenant, uids: rows.map((row) => row.uid), from: autodialSqlDate(new Date(now.getTime() - 15 * 60000), this.db), now: autodialSqlDate(now, this.db) }, type: QueryTypes.SELECT }) : [];
    const result: IAutodialMonitorHealth['campaigns'] = [];
    // Keep DB concurrency bounded even for a large tenant.
    for (let index = 0; index < rows.length; index += 5) result.push(...await Promise.all(rows.slice(index, index + 5).map(async (row) => {
      const diagnosis = await this.diagnosis.diagnose(tenant, row.uid);
      const queues = new Set((row.pacing?.providers ?? []).flatMap((provider) => provider.type === 'queue_agents' ? provider.queue_names : []));
      const abandon = diagnosis.runtime?.abandonPct ?? 0;
      const threshold = row.pacing?.predictive?.target_abandon_pct ?? 3;
      return { campaign_uid: row.uid, name: row.name, diagnosis,
        trend: minutes.map((minute) => ({ minute, dials: Number(trend.find((item) => item.campaign_uid === row.uid && item.minute === minute)?.dials ?? 0) })),
        agents: row.dial_mode === 'agentless' ? [] : agents.filter((agent) => agent.queues.some((name) => queues.has(name))).map((agent) =>
          ({ user_uid: agent.userId, name: agent.name || agent.interface, status: agent.status, queues: agent.queues.filter((name) => queues.has(name)) })),
        alerts: [
          ...(row.apply_error ? [{ code: 'apply_error' as const, severity: 'error' as const }] : []),
          ...(row.status === 'running' && diagnosis.schedule_open && diagnosis.active_channels === 0
            && diagnosis.reasons.some((reason) => ['no_ready_agents', 'capacity_no_providers', 'capacity_stale_apply'].includes(reason.code))
            ? [{ code: 'idle' as const, severity: 'warning' as const }] : []),
          ...(abandon > threshold ? [{ code: 'abandon' as const, severity: 'error' as const, value: abandon, threshold }] : []),
        ] };
    })));
    return { checked_at: new Date().toISOString(), ari_connected: this.ari.isConnected(), ami_connected: this.ami.isConnected(),
      truncated: all.length > rows.length, campaigns: result };
  }
}
