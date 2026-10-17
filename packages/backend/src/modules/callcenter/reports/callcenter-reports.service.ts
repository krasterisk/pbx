/**
 * Call Center reports engine (D-33 backend).
 *
 * Tenant isolation: every query filters `user_uid = vpbxUserUid` from the method
 * parameter (JWT), never from query/body. Hybrid source via resolveAggregationSource.
 */
import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';

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
import { CallCenterRollupService } from '../callcenter-rollup.service';
import { CallCenterMetricsConfigService } from '../callcenter-metrics-config.service';
import { eventTypeToTimelineState } from '../callcenter-agent-timeline.util';
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
  ) {}

  /**
   * Resolve the report period in the TENANT timezone. A date-only bound means the whole local
   * calendar day; full ISO timestamps are taken as given. `fromKey`/`toKey` are the tenant-local
   * date keys used to read daily rollups.
   */
  private async resolvePeriod(vpbxUserUid: number, query: ReportQuery) {
    const { timezone } = await this.config.getTenantConfig(vpbxUserUid);
    const { from, to } = this.parseAndClampPeriod(query.dateFrom, query.dateTo, timezone);
    return {
      from,
      to,
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
    const result = await this.buildReport(reportId as CcReportId, vpbxUserUid, query);
    // cc-ux U3.3: every column carries its type / i18n key / totals rule.
    const { timezone, from, to } = await this.resolvePeriod(vpbxUserUid, query);
    return {
      ...result, columns: typeReportColumns(result.reportId, result.columns),
      timezone, generatedAt: new Date().toISOString(),
      periodStart: from.toISOString(), periodEnd: to.toISOString(),
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
    return { reportId: 'queue-summary', columns, rows: result, source };
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
    if (query.agentInterface) where.agent_interface = query.agentInterface;

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

    const rows: CallDetailRow[] = calls.map((c) => ({
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
    const { from, to, fromKey, toKey, timezone } = await this.resolvePeriod(vpbxUserUid, query);
    const source = this.rollupService.resolveAggregationSource(from, to);
    const columns: ReportColumn[] = [
      { key: 'agentInterface', header: 'Agent' },
      { key: 'agentUserUid', header: 'User ID' },
      { key: 'callsHandled', header: 'Calls' },
      { key: 'totalTalkSec', header: 'Talk (sec)' },
      { key: 'totalHoldSec', header: 'Hold (sec)' },
      { key: 'totalWrapupSec', header: 'Wrap-up (sec)' },
      { key: 'ahtSec', header: 'AHT (sec)' },
      { key: 'loggedInSec', header: 'Logged in (sec)' },
      { key: 'totalPauseSec', header: 'Pause (sec)' },
      { key: 'totalIdleSec', header: 'Idle/Ready (sec)' },
    ];

    const sessionTimeByAgent = await this.aggregateSessionTime(vpbxUserUid, from, to, query.agentInterface);

    if (source === 'rollup') {
      const where: Record<string, unknown> = {
        user_uid: vpbxUserUid,
        stat_date: { [Op.gte]: fromKey, [Op.lte]: toKey },
      };
      if (query.agentInterface) where.agent_interface = query.agentInterface;
      const rows = await this.dailyAgentModel.findAll({ where });
      const byAgent = new Map<string, {
        agentUserUid: number | null;
        calls: number;
        talk: number;
        hold: number;
        wrapup: number;
      }>();
      for (const r of rows) {
        let agg = byAgent.get(r.agent_interface);
        if (!agg) {
          agg = { agentUserUid: r.agent_user_uid ?? null, calls: 0, talk: 0, hold: 0, wrapup: 0 };
          byAgent.set(r.agent_interface, agg);
        }
        agg.calls += r.calls_handled;
        agg.talk += r.total_talk_sec;
        agg.hold += r.total_hold_sec;
        agg.wrapup += r.total_wrapup_sec;
        if (r.agent_user_uid != null) agg.agentUserUid = r.agent_user_uid;
      }
      const result: OperatorStatsRow[] = [];
      for (const [agentInterface, a] of byAgent) {
        const handle = a.talk + a.wrapup; // talk already includes hold
        const sess = sessionTimeByAgent.get(agentInterface);
        result.push({
          agentInterface,
          agentUserUid: a.agentUserUid,
          callsHandled: a.calls,
          totalTalkSec: a.talk,
          totalHoldSec: a.hold,
          totalWrapupSec: a.wrapup,
          avgHandleSec: a.calls ? Math.round(handle / a.calls) : 0,
          ahtSec: a.calls ? Math.round((a.talk + a.wrapup) / a.calls) : 0,
          loggedInSec: sess?.loggedInSec ?? 0,
          totalPauseSec: sess?.totalPauseSec ?? 0,
          totalIdleSec: sess?.totalIdleSec ?? 0,
        });
      }
      return { reportId: 'operator-stats', columns, rows: result, source };
    }

    const where: Record<string, unknown> = {
      user_uid: vpbxUserUid,
      created_at: { [Op.gte]: from, [Op.lte]: to },
      // Handled inbound/personal calls; outbound/internal are "made", not handled.
      disposition: { [Op.in]: ['answered', 'transferred'] },
      direction: { [Op.notIn]: ['outbound', 'internal'] },
    };
    const queueWhere = queueNameWhere(query.queueName);
    if (queueWhere !== undefined) where.queue_name = queueWhere;
    if (query.agentInterface) where.agent_interface = query.agentInterface;
    const calls = await this.queueCallModel.findAll({ where });
    const byAgent = new Map<string, {
      agentUserUid: number | null;
      calls: number;
      talk: number;
      hold: number;
      wrapup: number;
    }>();
    for (const c of calls) {
      const iface = (c.agent_interface || '').trim();
      if (!iface) continue;
      let agg = byAgent.get(iface);
      if (!agg) {
        agg = { agentUserUid: c.agent_user_uid ?? null, calls: 0, talk: 0, hold: 0, wrapup: 0 };
        byAgent.set(iface, agg);
      }
      agg.calls += 1;
      agg.talk += c.talk_time ?? 0;
      agg.hold += c.hold_time ?? 0;
      agg.wrapup += c.wrapup_time ?? 0;
      if (c.agent_user_uid != null) agg.agentUserUid = c.agent_user_uid;
    }
    for (const [iface, sess] of sessionTimeByAgent) {
      if (!byAgent.has(iface)) {
        byAgent.set(iface, { agentUserUid: sess.userId, calls: 0, talk: 0, hold: 0, wrapup: 0 });
      }
    }
    const result: OperatorStatsRow[] = [];
    for (const [agentInterface, a] of byAgent) {
      const handle = a.talk + a.wrapup; // talk already includes hold
      const sess = sessionTimeByAgent.get(agentInterface);
      result.push({
        agentInterface,
        agentUserUid: a.agentUserUid,
        callsHandled: a.calls,
        totalTalkSec: a.talk,
        totalHoldSec: a.hold,
        totalWrapupSec: a.wrapup,
        avgHandleSec: a.calls ? Math.round(handle / a.calls) : 0,
        ahtSec: a.calls ? Math.round((a.talk + a.wrapup) / a.calls) : 0,
        loggedInSec: sess?.loggedInSec ?? 0,
        totalPauseSec: sess?.totalPauseSec ?? 0,
        totalIdleSec: sess?.totalIdleSec ?? 0,
      });
    }
    return { reportId: 'operator-stats', columns, rows: result, source };
  }

  /**
   * Aggregate shift / pause / idle seconds from cc_agent_sessions overlapping [from, to].
   * Sessions fully inside the period use their stored totals (cheap, exact). Boundary sessions
   * are clipped from their event stream so a night shift is not counted twice across days.
   */
  private async aggregateSessionTime(
    vpbxUserUid: number,
    from: Date,
    to: Date,
    agentInterface?: string,
  ): Promise<Map<string, {
    userId: number | null;
    loggedInSec: number;
    totalPauseSec: number;
    totalIdleSec: number;
  }>> {
    const where: Record<string, unknown> = {
      user_uid: vpbxUserUid,
      login_time: { [Op.lte]: to },
      [Op.or]: [
        { logout_time: null },
        { logout_time: { [Op.gte]: from } },
      ],
    };
    if (agentInterface) where.agent_interface = agentInterface;
    const sessions = await this.sessionModel.findAll({ where });
    const map = new Map<string, {
      userId: number | null;
      loggedInSec: number;
      totalPauseSec: number;
      totalIdleSec: number;
    }>();
    const now = Date.now();

    const boundary = sessions.filter((s) => {
      const login = new Date(s.login_time).getTime();
      const logout = s.logout_time ? new Date(s.logout_time).getTime() : now;
      return login < from.getTime() || logout > to.getTime();
    });
    const clipped = await this.clipBoundarySessions(vpbxUserUid, boundary, from, to, now);

    for (const s of sessions) {
      const iface = s.agent_interface;
      let agg = map.get(iface);
      if (!agg) {
        agg = { userId: s.user_id ?? null, loggedInSec: 0, totalPauseSec: 0, totalIdleSec: 0 };
        map.set(iface, agg);
      }
      const login = new Date(s.login_time).getTime();
      const logout = s.logout_time ? new Date(s.logout_time).getTime() : now;
      const overlapStart = Math.max(login, from.getTime());
      const overlapEnd = Math.min(logout, to.getTime());
      if (overlapEnd > overlapStart) {
        agg.loggedInSec += Math.round((overlapEnd - overlapStart) / 1000);
      }
      const partial = clipped.get(s.uid);
      agg.totalPauseSec += partial ? partial.pauseSec : (s.total_pause_time ?? 0);
      agg.totalIdleSec += partial ? partial.idleSec : (s.total_idle_time ?? 0);
      if (s.user_id != null) agg.userId = s.user_id;
    }
    return map;
  }

  /** Pause / ready seconds of sessions that cross the period edge, from clipped timeline segments. */
  private async clipBoundarySessions(
    vpbxUserUid: number,
    sessions: CcAgentSession[],
    from: Date,
    to: Date,
    now: number,
  ): Promise<Map<number, { pauseSec: number; idleSec: number }>> {
    const result = new Map<number, { pauseSec: number; idleSec: number }>();
    if (sessions.length === 0) return result;

    const ids = sessions.map((s) => s.uid);
    const events = await this.agentEventModel.findAll({
      where: { user_uid: vpbxUserUid, session_id: { [Op.in]: ids } },
      order: [['created_at', 'ASC']],
    });
    const bySession = new Map<number, CcAgentEvent[]>();
    for (const ev of events) {
      const list = bySession.get(ev.session_id) ?? [];
      list.push(ev);
      bySession.set(ev.session_id, list);
    }

    for (const s of sessions) {
      const sessionEnd = new Date(s.logout_time ? new Date(s.logout_time).getTime() : now);
      const segments = this.buildAgentTimelineSegments(bySession.get(s.uid) ?? [], sessionEnd);
      let pauseSec = 0;
      let idleSec = 0;
      for (const seg of segments) {
        const start = Math.max(new Date(seg.startTs).getTime(), from.getTime());
        const end = Math.min(new Date(seg.endTs).getTime(), to.getTime());
        if (end <= start) continue;
        const sec = Math.round((end - start) / 1000);
        if (seg.state === 'PAUSED') pauseSec += sec;
        else if (seg.state === 'READY') idleSec += sec;
      }
      result.set(s.uid, { pauseSec, idleSec });
    }
    return result;
  }

  async getPauseReport(
    vpbxUserUid: number,
    query: ReportQuery,
  ): Promise<ReportResult<PauseReportRow>> {
    const { from, to } = await this.resolvePeriod(vpbxUserUid, query);

    const sessionWhere: Record<string, unknown> = { user_uid: vpbxUserUid };
    if (query.agentInterface) sessionWhere.agent_interface = query.agentInterface;
    const sessions = await this.sessionModel.findAll({
      where: sessionWhere,
      attributes: ['uid', 'agent_interface', 'user_id', 'logout_time'],
    });
    const sessionMap = new Map(sessions.map((s) => [s.uid, s]));
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
        created_at: { [Op.gte]: from, [Op.lte]: to },
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

    const now = Date.now();
    for (let i = 0; i < events.length; i++) {
      const ev = events[i];
      if (ev.event_type !== 'PAUSE') continue;
      const sess = sessionMap.get(ev.session_id);
      const agentInterface = sess?.agent_interface || '';
      if (query.agentInterface && agentInterface !== query.agentInterface) continue;

      let durationSec = ev.duration ?? 0;
      if (durationSec <= 0) {
        const next = events.slice(i + 1).find((e) => e.session_id === ev.session_id);
        const start = ev.created_at ? new Date(ev.created_at).getTime() : now;
        // A pause that never got its own end event (the agent was logged out, or the panel just
        // died) ends with the shift. Without this a forgotten pause runs to the end of the report.
        const shiftEnd = sess?.logout_time ? new Date(sess.logout_time).getTime() : null;
        let end = next?.created_at
          ? new Date(next.created_at).getTime()
          : (shiftEnd ?? Math.min(now, to.getTime()));
        if (shiftEnd !== null && end > shiftEnd) end = shiftEnd;
        durationSec = Math.max(0, Math.round((end - start) / 1000));
      }

      const reason = ev.reason || '(none)';
      const key = `${agentInterface}|${ev.user_id}|${reason}`;
      let agg = byKey.get(key);
      if (!agg) {
        const isPaid = reason === '(none)' ? null : (paidByName.get(reason) ?? null);
        agg = {
          agentInterface,
          userId: ev.user_id,
          pauseReason: reason,
          count: 0,
          totalSec: 0,
          isPaid,
        };
        byKey.set(key, agg);
      }
      agg.count += 1;
      agg.totalSec += durationSec;
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
    const { from, to, fromKey, toKey, timezone } = await this.resolvePeriod(vpbxUserUid, query);
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
  ): { from: Date; to: Date } {
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
    if (to.getTime() - from.getTime() > maxMs) {
      to = new Date(from.getTime() + maxMs);
      this.logger.warn(`Report period clamped to ${MAX_PERIOD_DAYS} days`);
    }
    return { from, to };
  }

  /** Shared with the live occupancy restore so READY means the same thing everywhere. */
  private eventTypeToTimelineState(eventType: string): string {
    return eventTypeToTimelineState(eventType);
  }
}
