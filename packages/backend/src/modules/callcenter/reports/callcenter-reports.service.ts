/**
 * Call Center reports engine (D-33 backend).
 *
 * Tenant isolation: every query filters `user_uid = vpbxUserUid` from the method
 * parameter (JWT), never from query/body. Hybrid source via resolveAggregationSource.
 */
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  Optional,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op, QueryTypes } from 'sequelize';

/** One queue, or several comma-separated names (reports multi-select). */
export function queueNameWhere(queueName?: string): string | { [key: symbol]: string[] } | undefined {
  const names = [...new Set((queueName ?? '').split(',').map((part) => part.trim()).filter(Boolean))];
  if (names.length === 0) return undefined;
  if (names.length === 1) return names[0];
  return { [Op.in]: names };
}
import {
  addQueueCall,
  buildQueueMetricsView,
  emptyQueueTotals,
  isQueueCallRow,
  mergeQueueTotals,
  zonedDateKey,
  zonedDayWindow,
  zonedParts,
  type QueueTotals,
} from '@krasterisk/shared';
import { CcQueueCall } from '../models/queue-call.model';
import { CcDailyQueueStats } from '../models/daily-queue-stats.model';
import { CcDailyAgentStats } from '../models/daily-agent-stats.model';
import { CcAgentEvent } from '../models/agent-event.model';
import { CcAgentSession } from '../models/agent-session.model';
import { CcMissedCall } from '../models/missed-call.model';
import { CcPauseReason } from '../models/pause-reason.model';
import { CcAgentOffer } from '../models/agent-offer.model';
import { CcSettings } from '../models/cc-settings.model';
import { User } from '../../users/user.model';
import { normalizeAccessToken } from '../callcenter-access-list.util';
import { CallCenterRollupService } from '../callcenter-rollup.service';
import { CallCenterMetricsConfigService } from '../callcenter-metrics-config.service';
import { eventTypeToTimelineState } from '../callcenter-agent-timeline.util';
import { accountSessionTime } from './agent-time-accounting';
import { buildOperatorStats, factsFromCalls, operatorStatsColumns, DEFAULT_SHORT_CALL_SEC, type OperatorCallFact, type OperatorOfferFact, type OperatorSessionFact } from './operator-stats.build';
import { typeReportColumns } from './callcenter-report-columns';
import {
  AgentTimelineRow,
  AgentTimelineSegment,
  CallDetailRow,
  CcReportId,
  HourlyHeatmapRow,
  isCcReportId,
  MissedCallbackRow,
  OperatorStatsRow,
  PauseReportRow,
  QueueSummaryRow,
  ReportColumn,
  ReportQuery,
  ReportResult,
} from './callcenter-reports.types';

const MAX_PERIOD_DAYS = 366;
const DEFAULT_PAGE_SIZE = 50;

@Injectable()
export class CallCenterReportsService {
  private readonly logger = new Logger(CallCenterReportsService.name);

  constructor(
    @InjectModel(CcQueueCall) private readonly queueCallModel: typeof CcQueueCall,
    @InjectModel(CcDailyQueueStats) private readonly dailyQueueModel: typeof CcDailyQueueStats,
    @InjectModel(CcDailyAgentStats) private readonly dailyAgentModel: typeof CcDailyAgentStats,
    @InjectModel(CcAgentEvent) private readonly agentEventModel: typeof CcAgentEvent,
    @InjectModel(CcAgentSession) private readonly sessionModel: typeof CcAgentSession,
    @InjectModel(CcMissedCall) private readonly missedCallModel: typeof CcMissedCall,
    @InjectModel(CcPauseReason) private readonly pauseReasonModel: typeof CcPauseReason,
    private readonly rollupService: CallCenterRollupService,
    private readonly config: CallCenterMetricsConfigService,
    @Optional() @InjectModel(CcAgentOffer) private readonly offerModel?: typeof CcAgentOffer,
    @Optional() @InjectModel(User) private readonly userModel?: typeof User,
    @Optional() @InjectModel(CcSettings) private readonly settingsModel?: typeof CcSettings,
  ) {}

  /**
   * Resolve the report period in the TENANT timezone. A date-only bound means the whole local
   * calendar day; full ISO timestamps are taken as given. `fromKey`/`toKey` are the tenant-local
   * date keys used to read daily rollups.
   */
  private async resolvePeriod(vpbxUserUid: number, query: ReportQuery) {
    const { timezone } = await this.config.getTenantConfig(vpbxUserUid);
    const { from, to, periodClamped } = this.parseAndClampPeriod(query.dateFrom, query.dateTo, timezone);
    return {
      from,
      to,
      periodClamped,
      timezone,
      fromKey: zonedDateKey(from, timezone),
      toKey: zonedDateKey(to, timezone),
    };
  }

  async runReport(
    reportId: string,
    vpbxUserUid: number,
    query: ReportQuery,
  ): Promise<ReportResult> {
    if (!isCcReportId(reportId)) {
      throw new BadRequestException(
        `Unknown reportId "${reportId}". Allowed: queue-summary, call-detail, operator-stats, pause-report, hourly-heatmap, agent-timeline, missed-callback`,
      );
    }
    if (query.agentInterface && ['queue-summary', 'missed-callback'].includes(reportId)) {
      throw new BadRequestException('This report does not support an operator filter');
    }
    if (query.queueName && ['pause-report', 'agent-timeline'].includes(reportId)) {
      throw new BadRequestException('This report does not support a queue filter');
    }
    this.assertAccess(query);
    const result = await this.buildReport(reportId as CcReportId, vpbxUserUid, query);
    // cc-ux U3.3: every column carries its type / i18n key / totals rule.
    const { timezone, from, to, periodClamped } = await this.resolvePeriod(vpbxUserUid, query);
    return {
      ...result, columns: typeReportColumns(result.reportId, result.columns),
      timezone, generatedAt: new Date().toISOString(),
      periodStart: from.toISOString(), periodEnd: to.toISOString(),
      ...(periodClamped ? { periodClamped: true } : {}),
    };
  }

  private buildReport(
    reportId: CcReportId,
    vpbxUserUid: number,
    query: ReportQuery,
  ): Promise<ReportResult> {
    switch (reportId) {
      case 'queue-summary':
        return this.getQueueSummary(vpbxUserUid, query);
      case 'call-detail':
        return this.getCallDetail(vpbxUserUid, query);
      case 'operator-stats':
        return this.getOperatorStats(vpbxUserUid, query);
      case 'pause-report':
        return this.getPauseReport(vpbxUserUid, query);
      case 'hourly-heatmap':
        return this.getHourlyHeatmap(vpbxUserUid, query);
      case 'agent-timeline':
        return this.getAgentTimeline(vpbxUserUid, query);
      case 'missed-callback':
        return this.getMissedCallback(vpbxUserUid, query);
      default: {
        const _exhaustive: never = reportId;
        throw new BadRequestException(`Unhandled reportId: ${_exhaustive}`);
      }
    }
  }

  async getQueueSummary(
    vpbxUserUid: number,
    query: ReportQuery,
  ): Promise<ReportResult<QueueSummaryRow>> {
    const { from, to, fromKey, toKey } = await this.resolvePeriod(vpbxUserUid, query);
    const source = this.rollupService.resolveAggregationSource(from, to);
    const columns: ReportColumn[] = [
      { key: 'queueName', header: 'Queue' },
      { key: 'totalCalls', header: 'Total' },
      { key: 'answeredCalls', header: 'Answered' },
      { key: 'abandonedCalls', header: 'Abandoned' },
      { key: 'shortAbandonedCalls', header: 'Short abandoned' },
      { key: 'transferredCalls', header: 'Transferred' },
      { key: 'slaPct', header: 'SLA %' },
      { key: 'asrPct', header: 'ASR %' },
      { key: 'asaSec', header: 'ASA (sec)' },
      { key: 'ahtSec', header: 'AHT (sec)' },
      { key: 'abandonPct', header: 'Abandon %' },
      { key: 'maxWaitSec', header: 'Max wait (sec)' },
    ];

    const byQueue = new Map<string, QueueTotals>();
    const totalsFor = (queueName: string): QueueTotals => {
      let totals = byQueue.get(queueName);
      if (!totals) {
        totals = emptyQueueTotals();
        byQueue.set(queueName, totals);
      }
      return totals;
    };

    if (source === 'rollup') {
      const where: Record<string, unknown> = {
        user_uid: vpbxUserUid,
        stat_date: { [Op.gte]: fromKey, [Op.lte]: toKey },
      };
      const queueWhere = queueNameWhere(query.queueName);
      if (queueWhere !== undefined) where.queue_name = queueWhere;
      const rows = await this.dailyQueueModel.findAll({ where });
      for (const r of rows) {
        // Rollup v2 stores additive sums; v1 rows only had averages (rebuilt best-effort).
        const sumWait = r.rollup_version >= 2 ? r.total_wait_sec : r.avg_wait_sec * r.answered_calls;
        mergeQueueTotals(totalsFor(r.queue_name), {
          offered: r.total_calls,
          handled: r.answered_calls,
          handledInSl: r.sla_met_calls,
          abandoned: r.abandoned_calls,
          shortAbandoned: r.short_abandoned_calls ?? 0,
          transferred: r.transferred_calls ?? 0,
          sumWaitHandled: sumWait ?? 0,
          sumTalkHandled: r.total_talk_sec,
          sumWrapupHandled: r.total_wrapup_sec ?? 0,
          sumHoldHandled: r.total_hold_sec ?? 0,
          sumWaitAbandoned: 0,
          maxWait: r.max_wait_sec,
        });
      }
    } else {
      const tenant = await this.config.getTenantConfig(vpbxUserUid);
      const where: Record<string, unknown> = {
        user_uid: vpbxUserUid,
        created_at: { [Op.gte]: from, [Op.lte]: to },
        // Queue aggregates: inbound rows of real queues only (direct:* / outbound are separate streams).
        direction: 'inbound',
        queue_name: { [Op.notLike]: 'direct:%' },
      };
      const queueWhere = queueNameWhere(query.queueName);
      if (queueWhere !== undefined) where.queue_name = queueWhere;
      const calls = await this.queueCallModel.findAll({ where });
      for (const c of calls) {
        if (!isQueueCallRow(c)) continue;
        const slaThresholdSec = await this.config.getSlaThreshold(vpbxUserUid, c.queue_name, tenant.defaultSlaSec);
        addQueueCall(totalsFor(c.queue_name), c, {
          slaThresholdSec,
          shortAbandonSec: tenant.shortAbandonSec,
        });
      }
    }

    const result: QueueSummaryRow[] = [];
    for (const [queueName, totals] of byQueue) {
      const view = buildQueueMetricsView(totals);
      result.push({
        queueName,
        totalCalls: view.offered,
        answeredCalls: view.answered,
        abandonedCalls: view.abandoned,
        shortAbandonedCalls: view.shortAbandoned,
        transferredCalls: view.transferred,
        slaPct: view.sla,
        asrPct: view.asr,
        asaSec: Math.round(view.asa),
        ahtSec: Math.round(view.aht),
        abandonPct: view.abandonRate,
        maxWaitSec: view.maxWait,
      });
    }
    const visible = query.access?.queues
      ? result.filter((row) => query.access!.queues!.includes(normalizeAccessToken(row.queueName)))
      : result;
    return { reportId: 'queue-summary', columns, rows: visible, source };
  }

  async getCallDetail(
    vpbxUserUid: number,
    query: ReportQuery,
  ): Promise<ReportResult<CallDetailRow>> {
    const { from, to } = await this.resolvePeriod(vpbxUserUid, query);
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(500, Math.max(1, query.pageSize ?? DEFAULT_PAGE_SIZE));
    const where: Record<string, unknown> = {
      user_uid: vpbxUserUid,
      created_at: { [Op.gte]: from, [Op.lte]: to },
    };
    const queueWhere = queueNameWhere(query.queueName);
    if (queueWhere !== undefined) where.queue_name = queueWhere;
    const userIds = (query.agentUserUid ?? '').split(',').map((part) => Number(part.trim())).filter((id) => id > 0);
    if (userIds.length === 1) where.agent_user_uid = userIds[0];
    else if (userIds.length > 1) where.agent_user_uid = { [Op.in]: userIds };
    else if (query.agentInterface) where.agent_interface = query.agentInterface;
    if (query.access?.operatorUserIds && where.agent_user_uid == null) {
      where.agent_user_uid = { [Op.in]: query.access.operatorUserIds };
    }

    if (query.kind === 'rna' && this.offerModel) {
      const offerWhere: Record<string, unknown> = {
        user_uid: vpbxUserUid,
        offered_at: { [Op.gte]: from, [Op.lte]: to },
        outcome: 'rna',
      };
      if (queueWhere !== undefined) offerWhere.queue_name = queueWhere;
      if (where.agent_user_uid) offerWhere.agent_user_uid = where.agent_user_uid;
      else if (query.agentInterface) offerWhere.agent_interface = query.agentInterface;
      const offers = await this.offerModel.findAll({ where: offerWhere, order: [['offered_at', 'DESC']] });
      const visible = offers.filter((offer) => this.visibleOperator(query, offer.agent_user_uid ?? null));
      return {
        reportId: 'call-detail',
        columns: [
          { key: 'callUniqueid', header: 'Unique ID' },
          { key: 'queueName', header: 'Queue' },
          { key: 'agentInterface', header: 'Agent' },
          { key: 'callerIdNum', header: 'Caller' },
          { key: 'enterTime', header: 'Enter' },
          { key: 'waitTime', header: 'Wait (sec)' },
          { key: 'disposition', header: 'Disposition' },
        ],
        rows: visible.map((offer) => ({
          callUniqueid: offer.call_uniqueid,
          queueName: offer.queue_name,
          agentInterface: offer.agent_interface || '',
          callerIdNum: offer.caller_id_num || '',
          callerIdName: '',
          enterTime: offer.offered_at ? new Date(offer.offered_at).toISOString() : null,
          answerTime: null,
          endTime: null,
          waitTime: offer.ring_time ?? 0,
          talkTime: 0,
          holdTime: 0,
          wrapupTime: 0,
          disposition: 'rna',
        })),
        total: visible.length,
        source: 'raw' as const,
      };
    }

    const { rows: calls, count } = await this.queueCallModel.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });

    const columns: ReportColumn[] = [
      { key: 'callUniqueid', header: 'Unique ID' },
      { key: 'queueName', header: 'Queue' },
      { key: 'agentInterface', header: 'Agent' },
      { key: 'callerIdNum', header: 'Caller' },
      { key: 'callerIdName', header: 'Caller name' },
      { key: 'enterTime', header: 'Enter' },
      { key: 'answerTime', header: 'Answer' },
      { key: 'endTime', header: 'End' },
      { key: 'waitTime', header: 'Wait (sec)' },
      { key: 'talkTime', header: 'Talk (sec)' },
      { key: 'holdTime', header: 'Hold (sec)' },
      { key: 'wrapupTime', header: 'Wrap-up (sec)' },
      { key: 'disposition', header: 'Disposition' },
    ];

    const rows: CallDetailRow[] = calls.filter((c) => this.visibleOperator(query, c.agent_user_uid ?? null)).map((c) => ({
      callUniqueid: c.call_uniqueid,
      queueName: c.queue_name,
      agentInterface: c.agent_interface || '',
      callerIdNum: c.caller_id_num || '',
      callerIdName: c.caller_id_name || '',
      enterTime: c.enter_time ? c.enter_time.toISOString() : null,
      answerTime: c.answer_time ? c.answer_time.toISOString() : null,
      endTime: c.end_time ? c.end_time.toISOString() : null,
      waitTime: c.wait_time ?? 0,
      talkTime: c.talk_time ?? 0,
      // Legacy abandoned rows copied queue wait into hold_time. No conversation took place.
      holdTime: c.disposition === 'abandoned' ? 0 : (c.hold_time ?? 0),
      wrapupTime: c.wrapup_time ?? 0,
      disposition: c.disposition,
    }));

    return {
      reportId: 'call-detail',
      columns,
      rows,
      total: count,
      page,
      pageSize,
      source: 'raw',
    };
  }

  async getOperatorStats(
    vpbxUserUid: number,
    query: ReportQuery,
  ): Promise<ReportResult<OperatorStatsRow>> {
    const { from, to, timezone } = await this.resolvePeriod(vpbxUserUid, query);
    // Operator rows stay on the call table (grouped in SQL). The daily agent rollup has no queue
    // split and no journal time, so it cannot answer this report. Queue summary still uses it.
    const shortCallSec = await this.shortCallSec(vpbxUserUid);
    const groupBy = query.groupBy ?? 'operator';
    const queueNames = (query.queueName ?? '').split(',').map((part) => part.trim()).filter(Boolean);
    const userIds = (query.agentUserUid ?? '').split(',').map((part) => Number(part.trim())).filter((id) => id > 0);

    const callWhere: Record<string, unknown> = {
      user_uid: vpbxUserUid,
      created_at: { [Op.gte]: from, [Op.lte]: to },
    };
    const queueWhere = queueNameWhere(query.queueName);
    if (queueWhere !== undefined && groupBy !== 'operator') callWhere.queue_name = queueWhere;
    // A queue filter is applied in the builder so shift-only members of the queue still appear.
    if (queueWhere !== undefined && groupBy === 'operator') callWhere.queue_name = queueWhere;
    if (userIds.length === 1) callWhere.agent_user_uid = userIds[0];
    else if (userIds.length > 1) callWhere.agent_user_uid = { [Op.in]: userIds };
    else if (query.agentInterface) callWhere.agent_interface = query.agentInterface;

    const facts = await this.loadCallFacts(callWhere, shortCallSec, groupBy === 'day');
    const offers = await this.loadOfferFacts(vpbxUserUid, from, to, queueWhere, userIds, query.agentInterface);
    const sessions = await this.loadSessionFacts(vpbxUserUid, from, to, userIds, query.agentInterface);
    const directory = await this.loadDirectory(vpbxUserUid, [
      ...facts.map((fact) => fact.agentUserUid),
      ...sessions.map((session) => session.userId),
    ]);
    const paid = await this.paidPauseLookup(vpbxUserUid);

    let rows = buildOperatorStats({
      calls: facts,
      offers,
      sessions,
      directory,
      from,
      to,
      queueNames: groupBy === 'operator' ? queueNames : queueNames,
      shortCallSec,
      isPaid: paid,
      groupBy,
      dateKey: (instant) => zonedDateKey(instant, timezone),
    });
    if (query.access?.operatorUserIds) {
      rows = rows.filter((row) => this.visibleOperator(query, row.agentUserUid));
    }
    const columns = operatorStatsColumns(queueNames.length > 0 && groupBy !== 'queue', groupBy);
    return { reportId: 'operator-stats', columns, rows, source: 'raw' };
  }

  private async shortCallSec(vpbxUserUid: number): Promise<number> {
    if (!this.settingsModel) return DEFAULT_SHORT_CALL_SEC;
    const row = await this.settingsModel.findOne({
      where: { user_uid: vpbxUserUid },
      attributes: ['alert_thresholds'],
    });
    const raw = row?.getDataValue?.('alert_thresholds') ?? row?.alert_thresholds;
    const value = Number(raw?.short_call_sec);
    return Number.isFinite(value) && value >= 0 ? value : DEFAULT_SHORT_CALL_SEC;
  }

  /** SQL groups when a real connection exists; the unit-test doubles take the row path. */
  private async loadCallFacts(
    where: Record<string, unknown>,
    shortCallSec: number,
    needInstants: boolean,
  ): Promise<OperatorCallFact[]> {
    const sequelize = this.queueCallModel.sequelize;
    if (!needInstants && sequelize?.query && where.user_uid != null && where.created_at) {
      const range = where.created_at as { [key: symbol]: Date };
      const from = range[Op.gte];
      const to = range[Op.lte];
      if (from instanceof Date && to instanceof Date) {
        const replacements: Record<string, unknown> = { uid: where.user_uid, from, to, short: shortCallSec };
        const extra: string[] = [];
        if (typeof where.queue_name === 'string') {
          extra.push('AND queue_name = :queue');
          replacements.queue = where.queue_name;
        } else if (where.queue_name && typeof where.queue_name === 'object' && Op.in in (where.queue_name as object)) {
          extra.push('AND queue_name IN (:queues)');
          replacements.queues = (where.queue_name as { [key: symbol]: string[] })[Op.in];
        }
        if (typeof where.agent_interface === 'string') {
          extra.push('AND agent_interface = :iface');
          replacements.iface = where.agent_interface;
        }
        if (typeof where.agent_user_uid === 'number') {
          extra.push('AND agent_user_uid = :agent');
          replacements.agent = where.agent_user_uid;
        }
        const sql = `SELECT agent_user_uid AS "agentUserUid", agent_interface AS "agentInterface", queue_name AS "queueName",
            direction, disposition, COUNT(*) AS calls,
            COALESCE(SUM(talk_time), 0) AS "talkSec", COALESCE(SUM(hold_time), 0) AS "holdSec",
            COALESCE(SUM(wrapup_time), 0) AS "wrapupSec",
            COALESCE(SUM(CASE WHEN disposition IN ('answered', 'transferred') AND direction NOT IN ('outbound', 'internal') AND talk_time < :short THEN 1 ELSE 0 END), 0) AS "shortCalls"
          FROM cc_queue_calls
          WHERE vpbx_user_uid = :uid AND created_at >= :from AND created_at <= :to ${extra.join(' ')}
          GROUP BY agent_user_uid, agent_interface, queue_name, direction, disposition`;
        const grouped = await sequelize.query(sql, { replacements, type: QueryTypes.SELECT });
        return factsFromCalls(grouped as OperatorCallFact[], shortCallSec);
      }
    }
    const calls = await this.queueCallModel.findAll({ where });
    return factsFromCalls(calls, shortCallSec);
  }

  private async loadOfferFacts(
    vpbxUserUid: number,
    from: Date,
    to: Date,
    queueWhere: ReturnType<typeof queueNameWhere>,
    userIds: number[],
    agentInterface?: string,
  ): Promise<OperatorOfferFact[]> {
    if (!this.offerModel) return [];
    const where: Record<string, unknown> = {
      user_uid: vpbxUserUid,
      offered_at: { [Op.gte]: from, [Op.lte]: to },
      outcome: 'rna',
    };
    if (queueWhere !== undefined) where.queue_name = queueWhere;
    if (userIds.length === 1) where.agent_user_uid = userIds[0];
    else if (userIds.length > 1) where.agent_user_uid = { [Op.in]: userIds };
    else if (agentInterface) where.agent_interface = agentInterface;
    const offers = await this.offerModel.findAll({ where });
    const grouped = new Map<string, OperatorOfferFact>();
    for (const offer of offers) {
      const key = `${offer.agent_user_uid ?? ''}|${offer.agent_interface}|${offer.queue_name}`;
      const fact = grouped.get(key) ?? {
        agentUserUid: offer.agent_user_uid ?? null,
        agentInterface: offer.agent_interface,
        queueName: offer.queue_name,
        count: 0,
      };
      fact.count += 1;
      grouped.set(key, fact);
    }
    return [...grouped.values()];
  }

  private async loadSessionFacts(
    vpbxUserUid: number,
    from: Date,
    to: Date,
    userIds: number[],
    agentInterface?: string,
  ): Promise<OperatorSessionFact[]> {
    const where: Record<string, unknown> = {
      user_uid: vpbxUserUid,
      login_time: { [Op.lte]: to },
      [Op.or]: [{ logout_time: null }, { logout_time: { [Op.gte]: from } }],
    };
    if (userIds.length === 1) where.user_id = userIds[0];
    else if (userIds.length > 1) where.user_id = { [Op.in]: userIds };
    else if (agentInterface) where.agent_interface = agentInterface;
    const sessions = await this.sessionModel.findAll({ where });
    const ids = sessions.map((session) => session.uid).filter((id) => id != null);
    const events: CcAgentEvent[] = [];
    for (let i = 0; i < ids.length; i += 500) {
      const chunk = ids.slice(i, i + 500);
      events.push(...await this.agentEventModel.findAll({
        where: { user_uid: vpbxUserUid, session_id: { [Op.in]: chunk } },
        order: [['created_at', 'ASC']],
      }));
    }
    const bySession = new Map<number, CcAgentEvent[]>();
    for (const event of events) {
      const list = bySession.get(event.session_id) ?? [];
      list.push(event);
      bySession.set(event.session_id, list);
    }
    return sessions.map((session) => {
      const rawQueues = session.queues_snapshot;
      const queues = Array.isArray(rawQueues)
        ? rawQueues.map(String)
        : [];
      const login = session.login_time ? new Date(session.login_time) : from;
      return {
        userId: session.user_id ?? null,
        agentInterface: session.agent_interface,
        login,
        logout: session.logout_time ? new Date(session.logout_time) : null,
        queues,
        events: bySession.get(session.uid) ?? [],
      };
    });
  }

  private async loadDirectory(vpbxUserUid: number, ids: Array<number | null | undefined>): Promise<{ userId: number; name: string }[]> {
    if (!this.userModel) return [];
    const unique = [...new Set(ids.filter((id): id is number => id != null && id > 0))];
    if (unique.length === 0) return [];
    const users = await this.userModel.findAll({
      where: { uniqueid: { [Op.in]: unique }, vpbx_user_uid: vpbxUserUid },
      attributes: ['uniqueid', 'name', 'login'],
    });
    return users.map((user) => ({
      userId: Number(user.getDataValue('uniqueid')),
      name: String(user.getDataValue('name') || user.getDataValue('login') || ''),
    }));
  }

  private async paidPauseLookup(vpbxUserUid: number): Promise<(reason: string) => boolean | null> {
    const reasons = await this.pauseReasonModel.findAll({
      where: { user_uid: vpbxUserUid },
      attributes: ['name', 'is_paid'],
    });
    const paid = new Map(reasons.map((reason) => [reason.name, reason.is_paid !== false] as const));
    return (reason: string) => (reason ? (paid.has(reason) ? paid.get(reason)! : null) : null);
  }

  async getPauseReport(
    vpbxUserUid: number,
    query: ReportQuery,
  ): Promise<ReportResult<PauseReportRow>> {
    const { from, to } = await this.resolvePeriod(vpbxUserUid, query);

    const sessionWhere: Record<string, unknown> = {
      user_uid: vpbxUserUid,
      login_time: { [Op.lte]: to },
      [Op.or]: [{ logout_time: null }, { logout_time: { [Op.gte]: from } }],
    };
    if (query.agentInterface) sessionWhere.agent_interface = query.agentInterface;
    if (query.agentUserUid) {
      const ids = query.agentUserUid.split(',').map((part) => Number(part.trim())).filter((id) => id > 0);
      if (ids.length === 1) sessionWhere.user_id = ids[0];
      else if (ids.length > 1) sessionWhere.user_id = { [Op.in]: ids };
    }
    const sessions = await this.sessionModel.findAll({ where: sessionWhere });
    const sessionIds = sessions.map((s) => s.uid);

    const pauseColumns: ReportColumn[] = [
      { key: 'agentInterface', header: 'Agent' },
      { key: 'userId', header: 'User ID' },
      { key: 'pauseReason', header: 'Reason' },
      { key: 'pauseCount', header: 'Count' },
      { key: 'totalPauseSec', header: 'Total (sec)' },
      { key: 'avgPauseSec', header: 'Avg (sec)' },
      { key: 'isPaid', header: 'Paid' },
    ];

    if (!sessionIds.length) {
      return { reportId: 'pause-report', columns: pauseColumns, rows: [], source: 'raw' };
    }

    const events = await this.agentEventModel.findAll({
      where: {
        user_uid: vpbxUserUid,
        session_id: { [Op.in]: sessionIds },
      },
      order: [['session_id', 'ASC'], ['created_at', 'ASC']],
    });

    const reasons = await this.pauseReasonModel.findAll({
      where: { user_uid: vpbxUserUid },
      attributes: ['name', 'is_paid'],
    });
    const paidByName = new Map(
      reasons.map((r) => [r.name, r.is_paid !== false] as const),
    );

    const byKey = new Map<string, {
      agentInterface: string;
      userId: number;
      pauseReason: string;
      count: number;
      totalSec: number;
      isPaid: boolean | null;
    }>();

    const now = new Date();
    for (const sess of sessions) {
      const agentInterface = sess.agent_interface || '';
      if (query.agentInterface && agentInterface !== query.agentInterface) continue;
      if (!this.visibleOperator(query, sess.user_id ?? null)) continue;
      const sessionEvents = events.filter((event) => event.session_id === sess.uid);
      const login = sess.login_time
        ? new Date(sess.login_time)
        : new Date(sessionEvents[0]?.created_at ?? from);
      const accounted = accountSessionTime({
        events: sessionEvents,
        login,
        logout: sess.logout_time ? new Date(sess.logout_time) : null,
        from,
        to,
        now,
        isPaid: (reason) => (paidByName.has(reason) ? paidByName.get(reason)! : null),
      });
      for (const pause of accounted.pauses) {
        const key = `${agentInterface}|${sess.user_id}|${pause.reason}`;
        let agg = byKey.get(key);
        if (!agg) {
          agg = {
            agentInterface,
            userId: sess.user_id,
            pauseReason: pause.reason,
            count: 0,
            totalSec: 0,
            isPaid: pause.isPaid,
          };
          byKey.set(key, agg);
        }
        agg.count += 1;
        agg.totalSec += pause.sec;
      }
    }

    const rows: PauseReportRow[] = [...byKey.values()].map((a) => ({
      agentInterface: a.agentInterface,
      userId: a.userId,
      pauseReason: a.pauseReason,
      pauseCount: a.count,
      totalPauseSec: a.totalSec,
      avgPauseSec: a.count ? Math.round(a.totalSec / a.count) : 0,
      isPaid: a.isPaid,
    }));

    return { reportId: 'pause-report', columns: pauseColumns, rows, source: 'raw' };
  }

  async getHourlyHeatmap(
    vpbxUserUid: number,
    query: ReportQuery,
  ): Promise<ReportResult<HourlyHeatmapRow>> {
    const { from, to, timezone } = await this.resolvePeriod(vpbxUserUid, query);
    const where: Record<string, unknown> = {
      user_uid: vpbxUserUid,
      created_at: { [Op.gte]: from, [Op.lte]: to },
    };
    const queueWhere = queueNameWhere(query.queueName);
    if (queueWhere !== undefined) where.queue_name = queueWhere;
    if (query.agentInterface) where.agent_interface = query.agentInterface;
    const calls = await this.queueCallModel.findAll({
      where,
      attributes: ['created_at'],
    });

    const buckets = new Map<string, number>();
    for (const c of calls) {
      const d = c.created_at ? new Date(c.created_at) : null;
      if (!d) continue;
      const [ly, lm, ld, hour] = zonedParts(d, timezone);
      const dayOfWeek = new Date(Date.UTC(ly, lm - 1, ld)).getUTCDay();
      const key = `${dayOfWeek}|${hour}`;
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }

    const columns: ReportColumn[] = [
      { key: 'dayOfWeek', header: 'Day of week' },
      { key: 'hour', header: 'Hour' },
      { key: 'callCount', header: 'Calls' },
    ];

    const rows: HourlyHeatmapRow[] = [];
    for (const [key, callCount] of buckets) {
      const [dow, hour] = key.split('|').map(Number);
      rows.push({ dayOfWeek: dow, hour, callCount });
    }
    rows.sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.hour - b.hour);

    return { reportId: 'hourly-heatmap', columns, rows, source: 'raw' };
  }

  async getAgentTimeline(
    vpbxUserUid: number,
    query: ReportQuery,
  ): Promise<ReportResult<AgentTimelineRow>> {
    const { from, to } = await this.resolvePeriod(vpbxUserUid, query);
    if (!query.agentInterface) {
      throw new BadRequestException('agentInterface is required for agent-timeline');
    }

    const sessions = await this.sessionModel.findAll({
      where: {
        user_uid: vpbxUserUid,
        agent_interface: query.agentInterface,
        login_time: { [Op.lte]: to },
        [Op.or]: [
          { logout_time: null },
          { logout_time: { [Op.gte]: from } },
        ],
      },
      attributes: ['uid'],
    });
    const sessionIds = sessions.map((s) => s.uid);

    let events: CcAgentEvent[] = [];
    if (sessionIds.length > 0) {
      events = await this.agentEventModel.findAll({
        where: {
          user_uid: vpbxUserUid,
          session_id: { [Op.in]: sessionIds },
          created_at: { [Op.gte]: from, [Op.lte]: to },
        },
        order: [['created_at', 'ASC']],
      });
    }

    const segments = this.buildAgentTimelineSegments(events, new Date(Math.min(to.getTime(), Date.now())));
    const columns: ReportColumn[] = [
      { key: 'agentInterface', header: 'Agent' },
      { key: 'segments', header: 'Segments' },
    ];
    const rows: AgentTimelineRow[] = [
      { agentInterface: query.agentInterface, segments },
    ];

    return { reportId: 'agent-timeline', columns, rows, source: 'raw' };
  }

  async getMissedCallback(
    vpbxUserUid: number,
    query: ReportQuery,
  ): Promise<ReportResult<MissedCallbackRow>> {
    const { from, to } = await this.resolvePeriod(vpbxUserUid, query);
    const where: Record<string, unknown> = {
      user_uid: vpbxUserUid,
      created_at: { [Op.gte]: from, [Op.lte]: to },
    };
    const queueWhere = queueNameWhere(query.queueName);
    if (queueWhere !== undefined) where.queue_name = queueWhere;

    const missed = await this.missedCallModel.findAll({
      where,
      order: [['created_at', 'DESC']],
    });

    const columns: ReportColumn[] = [
      { key: 'uid', header: 'ID' },
      { key: 'callUniqueid', header: 'Unique ID' },
      { key: 'queueName', header: 'Queue' },
      { key: 'callerIdNum', header: 'Caller' },
      { key: 'callerIdName', header: 'Caller name' },
      { key: 'holdTime', header: 'Hold (sec)' },
      { key: 'position', header: 'Position' },
      { key: 'calledBack', header: 'Called back' },
      { key: 'calledBackBy', header: 'Called back by' },
      { key: 'calledBackAt', header: 'Called back at' },
      { key: 'note', header: 'Note' },
      { key: 'createdAt', header: 'Created' },
    ];

    const rows: MissedCallbackRow[] = missed.map((m) => ({
      uid: m.uid,
      callUniqueid: m.call_uniqueid,
      queueName: m.queue_name,
      callerIdNum: m.caller_id_num || '',
      callerIdName: m.caller_id_name || '',
      holdTime: m.hold_time ?? 0,
      position: m.position ?? 0,
      calledBack: !!m.called_back,
      calledBackBy: m.called_back_by ?? null,
      calledBackAt: m.called_back_at ? m.called_back_at.toISOString() : null,
      note: m.note || '',
      createdAt: m.created_at ? m.created_at.toISOString() : '',
    }));

    return { reportId: 'missed-callback', columns, rows, source: 'raw' };
  }

  /** Same segment shape as CallCenterService.getAgentDetail (D-36). */
  buildAgentTimelineSegments(
    events: CcAgentEvent[],
    periodEnd: Date = new Date(),
  ): AgentTimelineSegment[] {
    if (events.length === 0) return [];

    const segments: AgentTimelineSegment[] = [];
    for (let i = 0; i < events.length; i++) {
      const ev = events[i];
      const start = ev.created_at || periodEnd;
      const end = i + 1 < events.length
        ? (events[i + 1].created_at || periodEnd)
        : periodEnd;
      const durationSec = Math.max(0, Math.round((end.getTime() - start.getTime()) / 1000));
      segments.push({
        state: this.eventTypeToTimelineState(ev.event_type),
        startTs: start.toISOString(),
        endTs: end.toISOString(),
        durationSec,
        reason: ev.reason || undefined,
      });
    }
    return segments;
  }

  /** Queue servicelevel, else the tenant default SLA threshold (shared with live metrics and rollup). */
  resolveSlaThreshold(userUid: number, queueName: string): Promise<number> {
    return this.config.getSlaThreshold(userUid, queueName);
  }

  parseAndClampPeriod(
    dateFrom: string,
    dateTo: string,
    timezone?: string,
  ): { from: Date; to: Date; periodClamped: boolean } {
    // A date-only bound is a whole calendar day. With a tenant timezone it is the local day;
    // without one the legacy UTC contract applies.
    const dateOnly = /^\d{4}-\d{2}-\d{2}$/;
    const dayWindow = (key: string) => (timezone ? zonedDayWindow(key, timezone) : null);
    const from = dateOnly.test(dateFrom)
      ? (dayWindow(dateFrom)?.from ?? new Date(`${dateFrom}T00:00:00.000Z`))
      : new Date(dateFrom);
    let to = dateOnly.test(dateTo)
      ? (dayWindow(dateTo) ? new Date(dayWindow(dateTo)!.to.getTime() - 1) : new Date(`${dateTo}T23:59:59.999Z`))
      : new Date(dateTo);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new BadRequestException('dateFrom and dateTo must be valid ISO dates');
    }
    if (to < from) {
      throw new BadRequestException('dateTo must be >= dateFrom');
    }
    const maxMs = MAX_PERIOD_DAYS * 24 * 60 * 60 * 1000;
    let periodClamped = false;
    if (to.getTime() - from.getTime() > maxMs) {
      to = new Date(from.getTime() + maxMs);
      periodClamped = true;
      this.logger.warn(`Report period clamped to ${MAX_PERIOD_DAYS} days`);
    }
    return { from, to, periodClamped };
  }

  /** A restricted supervisor cannot ask for an operator or a queue outside the access list. */
  private assertAccess(query: ReportQuery): void {
    const access = query.access;
    if (!access) return;
    if (access.queues && query.queueName) {
      const allowed = new Set(access.queues);
      for (const name of query.queueName.split(',').map((part) => part.trim()).filter(Boolean)) {
        if (!allowed.has(normalizeAccessToken(name))) {
          throw new ForbiddenException('Queue is outside supervisor access list');
        }
      }
    }
    if (access.operatorUserIds && query.agentUserUid) {
      const allowed = new Set(access.operatorUserIds.map(Number));
      for (const id of query.agentUserUid.split(',').map((part) => Number(part.trim())).filter((id) => id > 0)) {
        if (!allowed.has(id)) throw new ForbiddenException('Operator is outside supervisor access list');
      }
    }
  }

  private visibleOperator(query: ReportQuery, userId: number | null): boolean {
    const ids = query.access?.operatorUserIds;
    if (!ids) return true;
    return userId != null && ids.includes(Number(userId));
  }

  /** Shared with the live occupancy restore so READY means the same thing everywhere. */
  private eventTypeToTimelineState(eventType: string): string {
    return eventTypeToTimelineState(eventType);
  }
}
