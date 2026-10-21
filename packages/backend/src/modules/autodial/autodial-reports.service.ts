import { autodialSqlDate } from './autodial-sql-time.util';
import { BadRequestException, Injectable, Logger, Optional } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op, QueryTypes } from 'sequelize';
import { InjectConnection } from '@nestjs/sequelize';
import type { Sequelize } from 'sequelize-typescript';
import type { AutodialDisposition, IAutodialCampaignLiveStats } from '@krasterisk/shared';
import { shiftDateKey, zonedDayWindow, zonedDateKey, type IAutodialDailyStats } from '@krasterisk/shared';
import { CallCenterMetricsConfigService } from '../callcenter/callcenter-metrics-config.service';
import { AcAttempt } from './models/ac-attempt.model';
import { AcCampaign } from './models/ac-campaign.model';
import { AcTask } from './models/ac-task.model';
import { AcContact } from './models/ac-contact.model';
import { AcDailyCampaignStats } from './models/ac-daily-campaign-stats.model';
import { AutodialStateService } from './autodial-state.service';
import { computeAutodialKpi, type AutodialKpi } from './autodial-metrics.util';
import { buildReportCsv } from '../callcenter/reports/exporters/csv-exporter';
import { buildAutodialXlsx } from './autodial-report-export.util';
import type { ReportColumn } from '../callcenter/reports/callcenter-reports.types';

export interface AutodialReportRange {
  from: string;
  to: string;
  campaignUids?: number[];
  attemptUids?: number[];
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
  contacts_reached: number;
  contacts_attempted: number;
  /** No verified identity event is collected by legacy scenarios. */
  right_party_confirmed: null;
  kpi: AutodialKpi;
}

export interface AutodialDetailRow {
  contact_uid: number | null;
  base_uid: number | null;
  external_id: string | null;
  phone: string | null;
  dialled_phone?: string | null;
  client_values_current: Record<string, unknown> | null;
  next_attempt_at: string | null;
  task_status: string | null;
  tour_no: number;
  uniqueid?: string | null;
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
  scenario_result: Record<string, unknown> | null;
}

const SUMMARY_COLUMNS: ReportColumn[] = [
  { key: 'campaign_name', header: 'Кампания' },
  { key: 'dials', header: 'Наборов' },
  { key: 'answered', header: 'Отвечено' },
  { key: 'success', header: 'Технический успех (порог разговора)' },
  { key: 'contacts_reached', header: 'Уникальные ответившие клиенты' },
  { key: 'contacts_attempted', header: 'Уникальные клиенты с попыткой' },
  { key: 'right_party_confirmed', header: 'Подтверждённое нужное лицо (нет данных)' },
  { key: 'short', header: 'Короткие' },
  { key: 'no_answer', header: 'Не ответили' },
  { key: 'busy', header: 'Занято' },
  { key: 'amd', header: 'Автоответчик' },
  { key: 'failed', header: 'Ошибки' },
  { key: 'contact_rate', header: 'Contact rate, %' },
  { key: 'rpc', header: 'Технический успех / попытки, % (legacy rpc)' },
  { key: 'aht', header: 'Разговор / отвеченные, с (legacy aht)' },
  { key: 'acd', header: 'Оплачиваемые секунды / попытки, с (legacy acd)' },
  { key: 'calls_per_hour', header: 'Попытки / час между первым и последним событием' },
];

const DETAIL_COLUMNS: ReportColumn[] = [
  { key: 'contact_uid', header: 'ID клиента' },
  { key: 'external_id', header: 'Внешний ID клиента (текущая карточка)' },
  { key: 'phone', header: 'Номер (текущая карточка)' },
  { key: 'dialled_phone', header: 'Номер при наборе (снимок попытки)' },
  { key: 'tour_no', header: 'Тур' },
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
  { key: 'scenario_result', header: 'Результат сценария' },
  { key: 'business_outcome', header: 'Бизнес-исход (код)' },
  { key: 'business_outcome_label', header: 'Бизнес-исход (подпись на момент звонка)' },
  { key: 'business_outcome_category', header: 'Категория исхода на момент звонка' },
  { key: 'business_goal_relation', header: 'Достижение цели на момент звонка' },
  { key: 'scenario_revision', header: 'Ревизия сценария на момент звонка' },
  { key: 'dtmf', header: 'DTMF' },
  { key: 'next_attempt_at', header: 'Следующая попытка (текущее состояние)' },
];

const DETAIL_ROW_LIMIT = 50_000;

/**
 * Durable attempts are the source for calendar reports, including closed days
 * missed by the nightly rollup. All queries retain the tenant predicate.
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
    @Optional() private readonly metricsConfig?: CallCenterMetricsConfigService,
  ) {}

  /** Live monitor payload: durable task counts plus in-memory channel counts. */
  async liveStats(userUid: number): Promise<IAutodialCampaignLiveStats[]> {
    const campaigns = await this.campaignModel.findAll({
      where: { user_uid: userUid },
      attributes: ['uid', 'status'],
    });
    if (!campaigns.length) return [];
    const timezone = await this.reportingTimezone(userUid);
    const today = zonedDayWindow(zonedDateKey(new Date(), timezone), timezone);
    const totals = await this.attemptModel.findAll({
      attributes: ['campaign_uid',
        [this.sequelize.fn('COUNT', this.sequelize.col('uid')), 'dials'],
        [this.sequelize.literal('SUM(CASE WHEN answered_at IS NOT NULL THEN 1 ELSE 0 END)'), 'answered'],
        [this.sequelize.literal("SUM(CASE WHEN disposition = 'success' THEN 1 ELSE 0 END)"), 'success']],
      where: { user_uid: userUid, started_at: { [Op.gte]: today.from, [Op.lt]: today.to } },
      group: ['campaign_uid'], raw: true,
    }) as unknown as Array<{ campaign_uid: number; dials: number; answered: number; success: number }>;
    const todayByCampaign = new Map(totals.map((row) => [Number(row.campaign_uid), row]));
    const recent = await this.attemptModel.findAll({ attributes: ['campaign_uid', [this.sequelize.fn('COUNT', this.sequelize.col('uid')), 'dials']],
      where: { user_uid: userUid, started_at: { [Op.gte]: new Date(Date.now() - 900000), [Op.lte]: new Date() } }, group: ['campaign_uid'], raw: true,
    }) as unknown as Array<{ campaign_uid: number; dials: number }>;
    const recentDials = new Map(recent.map((row) => [Number(row.campaign_uid), num(row.dials)]));

    const taskCounts = await this.taskStatusCounts(
      userUid,
      campaigns.map((c) => c.uid),
    );

    return campaigns.map((campaign) => {
      const runtime = this.state.ensureRuntime(userUid, campaign.uid);
      runtime.status = campaign.status;
      const durable = todayByCampaign.get(campaign.uid);
      const dials = num(durable?.dials);
      const answered = num(durable?.answered);
      const counts = taskCounts.get(campaign.uid) ?? { total: 0, pending: 0, done: 0 };
      return {
        campaign_uid: campaign.uid,
        status: campaign.status,
        active_channels: this.state.activeChannels(campaign.uid),
        reserved: runtime.reserved,
        capacity: runtime.capacity,
        dials_today: dials,
        answered_today: answered,
        success_today: num(durable?.success),
        contact_rate: dials ? Math.round((answered / dials) * 1000) / 10 : 0,
        asr: dials ? Math.round((answered / dials) * 1000) / 10 : 0,
        tasks_pending: counts.pending,
        tasks_done: counts.done,
        tasks_total: counts.total,
        eta_seconds: campaign.status === 'running' && runtime.capacity > 0 && (recentDials.get(campaign.uid) ?? 0) > 0
          ? Math.ceil(counts.pending * 900 / recentDials.get(campaign.uid)!) : null,
      };
    });
  }

  async summary(userUid: number, range: AutodialReportRange): Promise<AutodialSummaryRow[]> {
    const campaigns = await this.campaignsFor(userUid, range.campaignUids);
    if (!campaigns.size) return [];
    const window = await this.reportWindow(userUid, range);
    const activeSeconds = this.sequelize.getDialect() === 'postgres'
      ? 'EXTRACT(EPOCH FROM (MAX(COALESCE(a.ended_at, a.started_at)) - MIN(a.started_at)))'
      : 'TIMESTAMPDIFF(SECOND, MIN(a.started_at), MAX(COALESCE(a.ended_at, a.started_at)))';

    const rows = (await this.sequelize.query(
      `SELECT a.campaign_uid,
              COUNT(*)                                                    AS dials,
              SUM(CASE WHEN a.answered_at IS NOT NULL THEN 1 ELSE 0 END) AS answered,
              SUM(CASE WHEN a.disposition = 'success' THEN 1 ELSE 0 END) AS success,
              SUM(CASE WHEN a.disposition = 'answered_short' THEN 1 ELSE 0 END) AS short_calls,
              SUM(CASE WHEN a.disposition = 'no_answer' THEN 1 ELSE 0 END) AS no_answer,
              SUM(CASE WHEN a.disposition = 'busy' THEN 1 ELSE 0 END) AS busy,
              SUM(CASE WHEN a.disposition IN ('amd_machine','voicemail') THEN 1 ELSE 0 END) AS amd,
              SUM(CASE WHEN a.disposition IN ('failed','congestion','invalid_number') THEN 1 ELSE 0 END) AS failed,
              COALESCE(SUM(talk_sec), 0)                                  AS talk_sec_sum,
              COALESCE(SUM(billsec), 0)                                   AS billsec_sum,
              COUNT(DISTINCT CASE WHEN a.answered_at IS NOT NULL THEN t.contact_uid END) AS reached,
              COUNT(DISTINCT t.contact_uid) AS attempted,
              ${activeSeconds} AS active_sec
         FROM ac_attempts a
         JOIN ac_tasks t ON t.uid = a.task_uid AND t.vpbx_user_uid = a.vpbx_user_uid
        WHERE a.vpbx_user_uid = :userUid
          AND a.campaign_uid IN (:campaignUids)
          AND a.started_at >= :from
          AND a.started_at < :to
        GROUP BY a.campaign_uid`,
      {
        replacements: {
          userUid,
          campaignUids: [...campaigns.keys()],
          from: autodialSqlDate(window.from, this.sequelize),
          to: autodialSqlDate(window.to, this.sequelize),
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
        contacts_reached: num(raw.reached),
        contacts_attempted: num(raw.attempted),
        right_party_confirmed: null,
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

  /** Tenant calendar buckets, including today and days missed by the nightly job. */
  async daily(
    userUid: number,
    range: AutodialReportRange,
  ): Promise<IAutodialDailyStats[]> {
    const timezone = await this.reportingTimezone(userUid);
    const window = await this.reportWindow(userUid, range);
    const replacements: Record<string, string | number | number[] | Date> = { userUid, from: autodialSqlDate(window.from, this.sequelize), to: autodialSqlDate(window.to, this.sequelize) };
    const clauses: string[] = [];
    for (let day = range.from, index = 0; day <= range.to; day = shiftDateKey(day, 1), index++) {
      const bounds = zonedDayWindow(day, timezone);
      replacements[`start${index}`] = autodialSqlDate(bounds.from, this.sequelize);
      replacements[`end${index}`] = autodialSqlDate(bounds.to, this.sequelize);
      replacements[`day${index}`] = day;
      clauses.push(`WHEN started_at >= :start${index} AND started_at < :end${index} THEN :day${index}`);
    }
    if (range.campaignUids?.length) replacements.campaignUids = range.campaignUids;
    const rows = await this.sequelize.query<Record<string, string | number>>(`
      SELECT campaign_uid, CASE ${clauses.join(' ')} END AS day,
        COUNT(*) AS dials,
        SUM(CASE WHEN answered_at IS NOT NULL THEN 1 ELSE 0 END) AS answered,
        SUM(CASE WHEN disposition = 'success' THEN 1 ELSE 0 END) AS success,
        SUM(CASE WHEN disposition = 'answered_short' THEN 1 ELSE 0 END) AS short,
        SUM(CASE WHEN disposition = 'no_answer' THEN 1 ELSE 0 END) AS no_answer,
        SUM(CASE WHEN disposition = 'busy' THEN 1 ELSE 0 END) AS busy,
        SUM(CASE WHEN disposition IN ('amd_machine','voicemail') THEN 1 ELSE 0 END) AS amd,
        SUM(CASE WHEN disposition IN ('failed','congestion','invalid_number') THEN 1 ELSE 0 END) AS failed,
        COALESCE(SUM(talk_sec), 0) AS talk_sec_sum, COALESCE(SUM(billsec), 0) AS billsec_sum
      FROM ac_attempts WHERE vpbx_user_uid = :userUid AND started_at >= :from AND started_at < :to
      ${range.campaignUids?.length ? 'AND campaign_uid IN (:campaignUids)' : ''}
      GROUP BY campaign_uid, day ORDER BY day, campaign_uid`, {
      replacements, type: QueryTypes.SELECT,
    });
    return rows.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) =>
      [key, key === 'day' ? String(value) : num(value)])) as unknown as IAutodialDailyStats);
  }

  async detail(userUid: number, range: AutodialReportRange): Promise<AutodialDetailRow[]> {
    const window = await this.reportWindow(userUid, range);
    const where: Record<string, unknown> = {
      user_uid: userUid,
      started_at: { [Op.gte]: window.from, [Op.lt]: window.to },
    };
    if (range.campaignUids?.length) {
      where.campaign_uid = { [Op.in]: range.campaignUids };
    }
    if (range.attemptUids) where.uid = { [Op.in]: range.attemptUids };
    const rows = await this.attemptModel.findAll({
      where,
      order: [['uid', 'DESC']],
      limit: DETAIL_ROW_LIMIT,
    });
    if (!rows.length) return [];
    const quote = this.sequelize.getDialect() === 'postgres' ? '"' : '`';
    const contexts = await this.sequelize.query<{
      task_uid: number; contact_uid: number; base_uid: number; external_id: string | null;
      phone: string | null; client_values_current: Record<string, unknown> | string;
      next_attempt_at: Date | string | null; task_status: string;
    }>(`SELECT t.uid AS task_uid, t.contact_uid, c.base_uid, c.external_id,
        p.normalized AS phone, c.${quote}values${quote} AS client_values_current,
        t.next_attempt_at, t.status AS task_status
      FROM ac_tasks t
      LEFT JOIN ac_contacts c ON c.uid = t.contact_uid AND c.vpbx_user_uid = t.vpbx_user_uid
      LEFT JOIN ac_contact_phones p ON p.uid = t.phone_uid AND p.contact_uid = c.uid AND p.base_uid = c.base_uid
      WHERE t.vpbx_user_uid = :userUid AND t.uid IN (:taskUids)`, {
      replacements: { userUid, taskUids: [...new Set(rows.map((row) => row.task_uid))] }, type: QueryTypes.SELECT,
    });
    const contextByTask = new Map(contexts.map((row) => [Number(row.task_uid), row]));
    return rows.map((r) => ({
      contact_uid: contextByTask.get(r.task_uid)?.contact_uid ?? null,
      base_uid: contextByTask.get(r.task_uid)?.base_uid ?? null,
      external_id: contextByTask.get(r.task_uid)?.external_id ?? null,
      phone: contextByTask.get(r.task_uid)?.phone ?? null,
      dialled_phone: typeof (r.scenario_result?.snapshot as { dialled_phone?: unknown } | undefined)?.dialled_phone === 'string'
        ? (r.scenario_result!.snapshot as { dialled_phone: string }).dialled_phone : null,
      client_values_current: parseClientValues(contextByTask.get(r.task_uid)?.client_values_current),
      next_attempt_at: contextByTask.get(r.task_uid)?.next_attempt_at ? new Date(contextByTask.get(r.task_uid)!.next_attempt_at!).toISOString() : null,
      task_status: contextByTask.get(r.task_uid)?.task_status ?? null,
      tour_no: r.tour_no,
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
      scenario_result: r.scenario_result,
      uniqueid: r.uniqueid,
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
    return this.export('autodial-summary', SUMMARY_COLUMNS, rows, format, { tenant: userUid, ...range, timezone: await this.reportingTimezone(userUid) });
  }

  async exportDetail(
    userUid: number,
    range: AutodialReportRange,
    format: 'csv' | 'xlsx',
  ): Promise<{ body: string | Buffer; contentType: string; filename: string }> {
    const rows = (await this.detail(userUid, range)).map((row) => ({ ...row,
      business_outcome: row.scenario_result?.business_outcome ?? null,
      business_outcome_label: row.scenario_result?.business_outcome_label ?? null,
      business_outcome_category: row.scenario_result?.business_outcome_category ?? 'unknown',
      business_goal_relation: row.scenario_result?.business_goal_relation ?? 'unknown',
      scenario_revision: (row.scenario_result?.snapshot as { revision?: number } | undefined)?.revision ?? null,
      dtmf: row.scenario_result?.dtmf ?? null,
    }));
    return this.export(
      'autodial-detail',
      DETAIL_COLUMNS,
      rows as unknown as Array<Record<string, unknown>>,
      format,
      { tenant: userUid, ...range, timezone: await this.reportingTimezone(userUid) },
    );
  }

  private async export(
    name: string,
    columns: ReportColumn[],
    rows: Array<Record<string, unknown>>,
    format: 'csv' | 'xlsx',
    metadata: { tenant: number; from: string; to: string; timezone: string },
  ): Promise<{ body: string | Buffer; contentType: string; filename: string }> {
    if (format === 'xlsx') {
      return {
        body: await buildAutodialXlsx(name, columns, rows, metadata),
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        filename: `${name}.xlsx`,
      };
    }
    const formatter = new Intl.DateTimeFormat('sv-SE', { timeZone: metadata.timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
    const dateKeys = columns.filter((column) => /_at$/.test(column.key)).map((column) => column.key);
    const csvRows = rows.map((row) => {
      const next: Record<string, unknown> = { ...row, report_from: metadata.from, report_to: metadata.to, report_timezone: metadata.timezone };
      for (const key of dateKeys) if (next[key]) next[key] = formatter.format(new Date(String(next[key])));
      return next;
    });
    return {
      body: buildReportCsv([...columns.map((column) => dateKeys.includes(column.key) ? { ...column, header: `${column.header} (${metadata.timezone})` } : column),
        { key: 'report_from', header: 'Период с' }, { key: 'report_to', header: 'Период по (включительно)' }, { key: 'report_timezone', header: 'Зона отчёта' }], csvRows),
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

  async reportingTimezone(userUid: number): Promise<string> {
    return (await this.metricsConfig?.getTenantConfig(userUid))?.timezone ?? 'UTC';
  }

  async reportWindow(userUid: number, range: AutodialReportRange): Promise<{ from: Date; to: Date }> {
    for (const key of [range.from, range.to]) {
      const parsed = new Date(`${key}T00:00:00Z`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || !Number.isFinite(parsed.getTime())
        || parsed.toISOString().slice(0, 10) !== key) {
        throw new BadRequestException({ code: 'AC_REPORT_RANGE', message: 'Invalid calendar date' });
      }
    }
    const span = (Date.parse(range.to) - Date.parse(range.from)) / 86_400_000;
    if (span < 0 || span > 365) throw new BadRequestException({ code: 'AC_REPORT_RANGE', message: 'Select up to 366 calendar days' });
    const timezone = await this.reportingTimezone(userUid);
    return { from: zonedDayWindow(range.from, timezone).from, to: zonedDayWindow(range.to, timezone).to };
  }
}

function num(value: string | number | null | undefined): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function parseClientValues(value: Record<string, unknown> | string | undefined): Record<string, unknown> | null {
  try { const data = typeof value === 'string' ? JSON.parse(value) : value;
    return data && typeof data === 'object' && !Array.isArray(data) ? data : null;
  } catch { return null; }
}
