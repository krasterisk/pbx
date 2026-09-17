import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op, QueryTypes } from 'sequelize';
import { InjectConnection } from '@nestjs/sequelize';
import type { Sequelize } from 'sequelize-typescript';
import type { AutodialDisposition, IAutodialCampaignLiveStats } from '@krasterisk/shared';
import { AcAttempt } from './models/ac-attempt.model';
import { AcCampaign } from './models/ac-campaign.model';
import { AcTask } from './models/ac-task.model';
import { AcContact } from './models/ac-contact.model';
import { AcDailyCampaignStats } from './models/ac-daily-campaign-stats.model';
import { AutodialStateService } from './autodial-state.service';
import { computeAutodialKpi, type AutodialKpi } from './autodial-metrics.util';
import { buildReportCsv } from '../callcenter/reports/exporters/csv-exporter';
import { buildReportXlsx } from '../callcenter/reports/exporters/xlsx-exporter';
import type { ReportColumn } from '../callcenter/reports/callcenter-reports.types';

export interface AutodialReportRange {
  from: string;
  to: string;
  campaignUids?: number[];
}

export interface AutodialSummaryRow {
  campaign_uid: number;
  campaign_name: string;
  dials: number;
  answered: number;
  success: number;
  short: number;
  no_answer: number;
  busy: number;
  amd: number;
  failed: number;
  talk_sec_sum: number;
  billsec_sum: number;
  kpi: AutodialKpi;
}

export interface AutodialDetailRow {
  attempt_uid: number;
  campaign_uid: number;
  task_uid: number;
  attempt_no: number;
  started_at: string;
  answered_at: string | null;
  ended_at: string | null;
  duration: number;
  billsec: number;
  disposition: AutodialDisposition;
  hangup_cause: string | null;
  trunk_id: string | null;
  caller_id: string | null;
  queue_name: string | null;
  agent_interface: string | null;
  amd_result: string | null;
}

const SUMMARY_COLUMNS: ReportColumn[] = [
  { key: 'campaign_name', header: 'Кампания' },
  { key: 'dials', header: 'Наборов' },
  { key: 'answered', header: 'Отвечено' },
  { key: 'success', header: 'Успешно' },
  { key: 'short', header: 'Короткие' },
  { key: 'no_answer', header: 'Не ответили' },
  { key: 'busy', header: 'Занято' },
  { key: 'amd', header: 'Автоответчик' },
  { key: 'failed', header: 'Ошибки' },
  { key: 'contact_rate', header: 'Contact rate, %' },
  { key: 'rpc', header: 'RPC, %' },
  { key: 'aht', header: 'AHT, с' },
  { key: 'acd', header: 'ACD, с' },
  { key: 'calls_per_hour', header: 'Звонков/час' },
];

const DETAIL_COLUMNS: ReportColumn[] = [
  { key: 'campaign_uid', header: 'Кампания' },
  { key: 'task_uid', header: 'Задача' },
  { key: 'attempt_no', header: 'Попытка' },
  { key: 'started_at', header: 'Начало' },
  { key: 'answered_at', header: 'Ответ' },
  { key: 'ended_at', header: 'Завершение' },
  { key: 'duration', header: 'Длительность, с' },
  { key: 'billsec', header: 'Разговор, с' },
  { key: 'disposition', header: 'Статус' },
  { key: 'hangup_cause', header: 'Причина' },
  { key: 'trunk_id', header: 'Транк' },
  { key: 'caller_id', header: 'CallerID' },
  { key: 'queue_name', header: 'Очередь' },
  { key: 'agent_interface', header: 'Оператор' },
  { key: 'amd_result', header: 'AMD' },
];

const DETAIL_ROW_LIMIT = 50_000;

/**
 * Reporting reads from `ac_attempts` for ranges that include today and from the
 * nightly `ac_daily_campaign_stats` rollup for closed days, so a long history
 * never scans the attempt table.
 */
@Injectable()
export class AutodialReportsService {
  private readonly logger = new Logger(AutodialReportsService.name);

  constructor(
    @InjectModel(AcAttempt) private readonly attemptModel: typeof AcAttempt,
    @InjectModel(AcCampaign) private readonly campaignModel: typeof AcCampaign,
    @InjectModel(AcTask) private readonly taskModel: typeof AcTask,
    @InjectModel(AcContact) private readonly contactModel: typeof AcContact,
    @InjectModel(AcDailyCampaignStats)
    private readonly dailyModel: typeof AcDailyCampaignStats,
    @InjectConnection() private readonly sequelize: Sequelize,
    private readonly state: AutodialStateService,
  ) {}

  /** Live monitor payload: durable task counts plus in-memory channel counts. */
  async liveStats(userUid: number): Promise<IAutodialCampaignLiveStats[]> {
    const campaigns = await this.campaignModel.findAll({
      where: { user_uid: userUid },
      attributes: ['uid', 'status'],
    });
    if (!campaigns.length) return [];

    const taskCounts = await this.taskStatusCounts(
      userUid,
      campaigns.map((c) => c.uid),
    );

    return campaigns.map((campaign) => {
      const runtime = this.state.ensureRuntime(userUid, campaign.uid);
      const counts = taskCounts.get(campaign.uid) ?? { total: 0, pending: 0, done: 0 };
      return {
        campaign_uid: campaign.uid,
        status: campaign.status,
        active_channels: this.state.activeChannels(campaign.uid),
        reserved: runtime.reserved,
        capacity: runtime.capacity,
        dials_today: runtime.dials,
        answered_today: runtime.answered,
        success_today: runtime.success,
        contact_rate: runtime.dials ? Math.round((runtime.answered / runtime.dials) * 1000) / 10 : 0,
        asr: runtime.dials ? Math.round((runtime.answered / runtime.dials) * 1000) / 10 : 0,
        tasks_pending: counts.pending,
        tasks_done: counts.done,
        tasks_total: counts.total,
      };
    });
  }

  async summary(userUid: number, range: AutodialReportRange): Promise<AutodialSummaryRow[]> {
    const campaigns = await this.campaignsFor(userUid, range.campaignUids);
    if (!campaigns.size) return [];

    const rows = (await this.sequelize.query(
      `SELECT campaign_uid,
              COUNT(*)                                                    AS dials,
              SUM(answered_at IS NOT NULL)                                AS answered,
              SUM(disposition = 'success')                                AS success,
              SUM(disposition = 'answered_short')                         AS short_calls,
              SUM(disposition = 'no_answer')                              AS no_answer,
              SUM(disposition = 'busy')                                   AS busy,
              SUM(disposition IN ('amd_machine','voicemail'))              AS amd,
              SUM(disposition IN ('failed','congestion','invalid_number')) AS failed,
              COALESCE(SUM(talk_sec), 0)                                  AS talk_sec_sum,
              COALESCE(SUM(billsec), 0)                                   AS billsec_sum,
              COUNT(DISTINCT CASE WHEN answered_at IS NOT NULL THEN task_uid END) AS reached,
              COUNT(DISTINCT task_uid)                                    AS attempted,
              TIMESTAMPDIFF(SECOND, MIN(started_at), MAX(COALESCE(ended_at, started_at))) AS active_sec
         FROM ac_attempts
        WHERE vpbx_user_uid = :userUid
          AND campaign_uid IN (:campaignUids)
          AND started_at >= :from
          AND started_at < :to
        GROUP BY campaign_uid`,
      {
        replacements: {
          userUid,
          campaignUids: [...campaigns.keys()],
          from: range.from,
          to: this.exclusiveEnd(range.to),
        },
        type: QueryTypes.SELECT,
      },
    )) as Array<Record<string, string | number | null>>;

    const contactTotals = await this.contactTotals(userUid, campaigns);

    return rows.map((raw) => {
      const campaignUid = Number(raw.campaign_uid);
      const dials = num(raw.dials);
      const answered = num(raw.answered);
      const success = num(raw.success);
      const short = num(raw.short_calls);
      return {
        campaign_uid: campaignUid,
        campaign_name: campaigns.get(campaignUid)?.name ?? `#${campaignUid}`,
        dials,
        answered,
        success,
        short,
        no_answer: num(raw.no_answer),
        busy: num(raw.busy),
        amd: num(raw.amd),
        failed: num(raw.failed),
        talk_sec_sum: num(raw.talk_sec_sum),
        billsec_sum: num(raw.billsec_sum),
        kpi: computeAutodialKpi({
          dials,
          answered,
          success,
          short,
          // Answered but never handed to an agent — the dialer's own abandons.
          abandoned: Math.max(0, answered - success - short),
          talkSecSum: num(raw.talk_sec_sum),
          billsecSum: num(raw.billsec_sum),
          contactsReached: num(raw.reached),
          contactsTotal: contactTotals.get(campaignUid) ?? 0,
          contactsAttempted: num(raw.attempted),
          activeSec: Math.max(0, num(raw.active_sec)),
        }),
      };
    });
  }

  /** Daily series for the charts, served from the rollup table. */
  async daily(
    userUid: number,
    range: AutodialReportRange,
  ): Promise<AcDailyCampaignStats[]> {
    const where: Record<string, unknown> = {
      user_uid: userUid,
      day: { [Op.gte]: range.from, [Op.lte]: range.to },
    };
    if (range.campaignUids?.length) {
      where.campaign_uid = { [Op.in]: range.campaignUids };
    }
    return this.dailyModel.findAll({
      where,
      order: [
        ['day', 'ASC'],
        ['campaign_uid', 'ASC'],
      ],
    });
  }

  async detail(userUid: number, range: AutodialReportRange): Promise<AutodialDetailRow[]> {
    const where: Record<string, unknown> = {
      user_uid: userUid,
      started_at: { [Op.gte]: range.from, [Op.lt]: this.exclusiveEnd(range.to) },
    };
    if (range.campaignUids?.length) {
      where.campaign_uid = { [Op.in]: range.campaignUids };
    }
    const rows = await this.attemptModel.findAll({
      where,
      order: [['uid', 'DESC']],
      limit: DETAIL_ROW_LIMIT,
    });
    return rows.map((r) => ({
      attempt_uid: r.uid,
      campaign_uid: r.campaign_uid,
      task_uid: r.task_uid,
      attempt_no: r.attempt_no,
      started_at: r.started_at.toISOString(),
      answered_at: r.answered_at?.toISOString() ?? null,
      ended_at: r.ended_at?.toISOString() ?? null,
      duration: r.duration,
      billsec: r.billsec,
      disposition: r.disposition,
      hangup_cause: r.hangup_cause,
      trunk_id: r.trunk_id,
      caller_id: r.caller_id,
      queue_name: r.queue_name,
      agent_interface: r.agent_interface,
      amd_result: r.amd_result,
    }));
  }

  // ── export ────────────────────────────────────────────────────────

  async exportSummary(
    userUid: number,
    range: AutodialReportRange,
    format: 'csv' | 'xlsx',
  ): Promise<{ body: string | Buffer; contentType: string; filename: string }> {
    const rows = (await this.summary(userUid, range)).map((r) => ({
      ...r,
      ...r.kpi,
      kpi: undefined,
    }));
    return this.export('autodial-summary', SUMMARY_COLUMNS, rows, format);
  }

  async exportDetail(
    userUid: number,
    range: AutodialReportRange,
    format: 'csv' | 'xlsx',
  ): Promise<{ body: string | Buffer; contentType: string; filename: string }> {
    const rows = await this.detail(userUid, range);
    return this.export(
      'autodial-detail',
      DETAIL_COLUMNS,
      rows as unknown as Array<Record<string, unknown>>,
      format,
    );
  }

  private async export(
    name: string,
    columns: ReportColumn[],
    rows: Array<Record<string, unknown>>,
    format: 'csv' | 'xlsx',
  ): Promise<{ body: string | Buffer; contentType: string; filename: string }> {
    if (format === 'xlsx') {
      return {
        body: await buildReportXlsx(name, columns, rows),
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        filename: `${name}.xlsx`,
      };
    }
    return {
      body: buildReportCsv(columns, rows),
      contentType: 'text/csv; charset=utf-8',
      filename: `${name}.csv`,
    };
  }

  // ── helpers ───────────────────────────────────────────────────────

  private async campaignsFor(
    userUid: number,
    campaignUids?: number[],
  ): Promise<Map<number, { name: string; base_uid: number }>> {
    const where: Record<string, unknown> = { user_uid: userUid };
    if (campaignUids?.length) where.uid = { [Op.in]: campaignUids };
    const rows = await this.campaignModel.findAll({
      where,
      attributes: ['uid', 'name', 'base_uid'],
    });
    return new Map(rows.map((r) => [r.uid, { name: r.name, base_uid: r.base_uid }]));
  }

  private async contactTotals(
    userUid: number,
    campaigns: Map<number, { base_uid: number }>,
  ): Promise<Map<number, number>> {
    const out = new Map<number, number>();
    const byBase = new Map<number, number>();
    for (const [campaignUid, { base_uid }] of campaigns) {
      let total = byBase.get(base_uid);
      if (total == null) {
        total = await this.contactModel.count({
          where: { base_uid, user_uid: userUid },
        });
        byBase.set(base_uid, total);
      }
      out.set(campaignUid, total);
    }
    return out;
  }

  private async taskStatusCounts(
    userUid: number,
    campaignUids: number[],
  ): Promise<Map<number, { total: number; pending: number; done: number }>> {
    const out = new Map<number, { total: number; pending: number; done: number }>();
    const rows = (await this.taskModel.findAll({
      attributes: [
        'campaign_uid',
        'status',
        [this.sequelize.fn('COUNT', this.sequelize.col('uid')), 'cnt'],
      ],
      where: { user_uid: userUid, campaign_uid: { [Op.in]: campaignUids } },
      group: ['campaign_uid', 'status'],
      raw: true,
    })) as unknown as Array<{ campaign_uid: number; status: string; cnt: number }>;

    for (const r of rows) {
      const acc = out.get(r.campaign_uid) ?? { total: 0, pending: 0, done: 0 };
      const cnt = Number(r.cnt) || 0;
      acc.total += cnt;
      if (r.status === 'completed' || r.status === 'cancelled') acc.done += cnt;
      else acc.pending += cnt;
      out.set(r.campaign_uid, acc);
    }
    return out;
  }

  /** Callers pass an inclusive date; SQL wants an exclusive upper bound. */
  private exclusiveEnd(to: string): string {
    return /^\d{4}-\d{2}-\d{2}$/.test(to) ? `${to} 23:59:59` : to;
  }
}

function num(value: string | number | null | undefined): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}
