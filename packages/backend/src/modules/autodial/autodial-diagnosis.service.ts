import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/sequelize';
import { QueryTypes } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import { CallCenterStateService } from '../callcenter/callcenter-state.service';
import { AriConnectionService } from '../ari/ari-connection.service';
import { AutodialCampaignsService } from './autodial-campaigns.service';
import { AutodialStateService } from './autodial-state.service';
import { campaignWindowOpen } from './autodial-schedule.util';
import { countAutodialReadyAgents } from './autodial-ready-agents.util';
import type { IAutodialDiagnosis } from '@krasterisk/shared';
import { autodialSqlDate } from './autodial-sql-time.util';

@Injectable()
export class AutodialDiagnosisService {
  constructor(
    private readonly campaigns: AutodialCampaignsService,
    private readonly state: AutodialStateService,
    private readonly cc: CallCenterStateService,
    private readonly ari: AriConnectionService,
    @InjectConnection() private readonly db: Sequelize,
  ) {}

  async diagnose(userUid: number, campaignUid: number, now = new Date()): Promise<IAutodialDiagnosis> {
    const campaign = await this.campaigns.findOne(userUid, campaignUid);
    const [counts] = await this.db.query<{ ready: number | string; waiting: number | string; next_attempt_at: Date | string | null }>(`
      SELECT COALESCE(SUM(CASE WHEN status = 'pending' AND (next_attempt_at IS NULL OR next_attempt_at <= :now) THEN 1 ELSE 0 END), 0) AS ready,
        COALESCE(SUM(CASE WHEN status = 'pending' AND next_attempt_at > :now THEN 1 ELSE 0 END), 0) AS waiting,
        MIN(CASE WHEN status = 'pending' AND next_attempt_at > :now THEN next_attempt_at ELSE NULL END) AS next_attempt_at
      FROM ac_tasks WHERE vpbx_user_uid = :userUid AND campaign_uid = :campaignUid`,
    { replacements: { userUid, campaignUid, now: autodialSqlDate(now, this.db) }, type: QueryTypes.SELECT });
    const runtime = this.state.listRuntimes(userUid).find((row) => row.campaignUid === campaignUid);
    const open = campaignWindowOpen(campaign.schedules ?? [], now);
    const readyAgents = countAutodialReadyAgents(campaign.pacing, this.cc.getAllAgents(userUid));
    const reasons: Array<{ code: string; next_at?: string; count?: number; detail?: string }> = [];
    if (campaign.apply_error) reasons.push({ code: 'apply_error', detail: campaign.apply_error });
    if (campaign.status !== 'running') reasons.push({ code: `campaign_${campaign.status}` });
    if (!this.ari.isConnected()) reasons.push({ code: 'ari_disconnected' });
    if (!open) reasons.push({ code: 'outside_schedule' });
    if (campaign.dial_mode !== 'agentless' && readyAgents === 0) reasons.push({ code: 'no_ready_agents' });
    if (Number(counts?.ready ?? 0) === 0) {
      if (Number(counts?.waiting ?? 0) > 0) reasons.push({ code: 'waiting_retry', count: Number(counts.waiting),
        next_at: counts.next_attempt_at ? new Date(counts.next_attempt_at).toISOString() : undefined });
      else reasons.push({ code: campaign.tasks_total ? 'base_exhausted' : 'tasks_not_created' });
    }
    if (runtime?.capacity === 0 && runtime.limitedBy !== 'none') reasons.push({ code: `capacity_${runtime.limitedBy}` });
    return { campaign_uid: campaignUid, status: campaign.status, revision: campaign.revision, applied_revision: campaign.applied_revision,
      checked_at: now.toISOString(), reasons, schedule_open: open, ready_agents: readyAgents,
      ready_tasks: Number(counts?.ready ?? 0), waiting_tasks: Number(counts?.waiting ?? 0),
      next_attempt_at: counts?.next_attempt_at ? new Date(counts.next_attempt_at).toISOString() : null,
      active_channels: this.state.activeChannels(campaignUid), runtime: runtime ?? null };
  }
}
