"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var CallCenterReportsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CallCenterReportsService = void 0;
/**
 * Call Center reports engine (D-33 backend).
 *
 * Tenant isolation: every query filters `user_uid = vpbxUserUid` from the method
 * parameter (JWT), never from query/body. Hybrid source via resolveAggregationSource.
 */
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const sequelize_2 = require("sequelize");
const queue_call_model_1 = require("../models/queue-call.model");
const daily_queue_stats_model_1 = require("../models/daily-queue-stats.model");
const daily_agent_stats_model_1 = require("../models/daily-agent-stats.model");
const agent_event_model_1 = require("../models/agent-event.model");
const agent_session_model_1 = require("../models/agent-session.model");
const missed_call_model_1 = require("../models/missed-call.model");
const pause_reason_model_1 = require("../models/pause-reason.model");
const queue_model_1 = require("../../queues/queue.model");
const callcenter_rollup_service_1 = require("../callcenter-rollup.service");
const callcenter_metrics_service_1 = require("../callcenter-metrics.service");
const callcenter_reports_types_1 = require("./callcenter-reports.types");
const MAX_PERIOD_DAYS = 366;
const DEFAULT_PAGE_SIZE = 50;
let CallCenterReportsService = CallCenterReportsService_1 = class CallCenterReportsService {
    queueCallModel;
    dailyQueueModel;
    dailyAgentModel;
    agentEventModel;
    sessionModel;
    missedCallModel;
    pauseReasonModel;
    queueModel;
    rollupService;
    logger = new common_1.Logger(CallCenterReportsService_1.name);
    slaCache = new Map();
    constructor(queueCallModel, dailyQueueModel, dailyAgentModel, agentEventModel, sessionModel, missedCallModel, pauseReasonModel, queueModel, rollupService) {
        this.queueCallModel = queueCallModel;
        this.dailyQueueModel = dailyQueueModel;
        this.dailyAgentModel = dailyAgentModel;
        this.agentEventModel = agentEventModel;
        this.sessionModel = sessionModel;
        this.missedCallModel = missedCallModel;
        this.pauseReasonModel = pauseReasonModel;
        this.queueModel = queueModel;
        this.rollupService = rollupService;
    }
    async runReport(reportId, vpbxUserUid, query) {
        if (!(0, callcenter_reports_types_1.isCcReportId)(reportId)) {
            throw new common_1.BadRequestException(`Unknown reportId "${reportId}". Allowed: queue-summary, call-detail, operator-stats, pause-report, hourly-heatmap, agent-timeline, missed-callback`);
        }
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
                const _exhaustive = reportId;
                throw new common_1.BadRequestException(`Unhandled reportId: ${_exhaustive}`);
            }
        }
    }
    async getQueueSummary(vpbxUserUid, query) {
        const { from, to } = this.parseAndClampPeriod(query.dateFrom, query.dateTo);
        const source = this.rollupService.resolveAggregationSource(from, to);
        const columns = [
            { key: 'queueName', header: 'Queue' },
            { key: 'totalCalls', header: 'Total' },
            { key: 'answeredCalls', header: 'Answered' },
            { key: 'abandonedCalls', header: 'Abandoned' },
            { key: 'slaPct', header: 'SLA %' },
            { key: 'asrPct', header: 'ASR %' },
            { key: 'asaSec', header: 'ASA (sec)' },
            { key: 'ahtSec', header: 'AHT (sec)' },
            { key: 'abandonPct', header: 'Abandon %' },
            { key: 'maxWaitSec', header: 'Max wait (sec)' },
        ];
        if (source === 'rollup') {
            const where = {
                user_uid: vpbxUserUid,
                stat_date: { [sequelize_2.Op.gte]: toDateOnly(from), [sequelize_2.Op.lte]: toDateOnly(to) },
            };
            if (query.queueName)
                where.queue_name = query.queueName;
            const rows = await this.dailyQueueModel.findAll({ where });
            const byQueue = new Map();
            for (const r of rows) {
                let agg = byQueue.get(r.queue_name);
                if (!agg) {
                    agg = { total: 0, answered: 0, abandoned: 0, slaMet: 0, sumWait: 0, sumTalk: 0, maxWait: 0 };
                    byQueue.set(r.queue_name, agg);
                }
                agg.total += r.total_calls;
                agg.answered += r.answered_calls;
                agg.abandoned += r.abandoned_calls;
                agg.slaMet += r.sla_met_calls;
                agg.sumWait += r.avg_wait_sec * r.answered_calls;
                agg.sumTalk += r.total_talk_sec;
                agg.maxWait = Math.max(agg.maxWait, r.max_wait_sec);
            }
            const result = [];
            for (const [queueName, a] of byQueue) {
                result.push({
                    queueName,
                    totalCalls: a.total,
                    answeredCalls: a.answered,
                    abandonedCalls: a.abandoned,
                    slaPct: a.total ? round1((a.slaMet / a.total) * 100) : 0,
                    asrPct: a.total ? round1((a.answered / a.total) * 100) : 0,
                    asaSec: a.answered ? Math.round(a.sumWait / a.answered) : 0,
                    ahtSec: a.answered ? Math.round(a.sumTalk / a.answered) : 0,
                    abandonPct: a.total ? round1((a.abandoned / a.total) * 100) : 0,
                    maxWaitSec: a.maxWait,
                });
            }
            return { reportId: 'queue-summary', columns, rows: result, source };
        }
        const where = {
            user_uid: vpbxUserUid,
            created_at: { [sequelize_2.Op.gte]: from, [sequelize_2.Op.lte]: to },
        };
        if (query.queueName)
            where.queue_name = query.queueName;
        const calls = await this.queueCallModel.findAll({ where });
        const byQueue = new Map();
        for (const c of calls) {
            let agg = byQueue.get(c.queue_name);
            if (!agg) {
                agg = {
                    total: 0, answered: 0, abandoned: 0, slaMet: 0,
                    sumWait: 0, sumTalk: 0, sumWrapup: 0, maxWait: 0,
                };
                byQueue.set(c.queue_name, agg);
            }
            agg.total += 1;
            agg.maxWait = Math.max(agg.maxWait, c.wait_time ?? 0);
            if (c.disposition === 'answered') {
                agg.answered += 1;
                agg.sumWait += c.wait_time ?? 0;
                agg.sumTalk += c.talk_time ?? 0;
                agg.sumWrapup += c.wrapup_time ?? 0;
                const threshold = await this.resolveSlaThreshold(vpbxUserUid, c.queue_name);
                if ((c.wait_time ?? 0) <= threshold)
                    agg.slaMet += 1;
            }
            else if (c.disposition === 'abandoned') {
                agg.abandoned += 1;
            }
        }
        const result = [];
        for (const [queueName, a] of byQueue) {
            result.push({
                queueName,
                totalCalls: a.total,
                answeredCalls: a.answered,
                abandonedCalls: a.abandoned,
                slaPct: a.total ? round1((a.slaMet / a.total) * 100) : 0,
                asrPct: a.total ? round1((a.answered / a.total) * 100) : 0,
                asaSec: a.answered ? Math.round(a.sumWait / a.answered) : 0,
                ahtSec: a.answered ? Math.round((a.sumTalk + a.sumWrapup) / a.answered) : 0,
                abandonPct: a.total ? round1((a.abandoned / a.total) * 100) : 0,
                maxWaitSec: a.maxWait,
            });
        }
        return { reportId: 'queue-summary', columns, rows: result, source };
    }
    async getCallDetail(vpbxUserUid, query) {
        const { from, to } = this.parseAndClampPeriod(query.dateFrom, query.dateTo);
        const page = Math.max(1, query.page ?? 1);
        const pageSize = Math.min(500, Math.max(1, query.pageSize ?? DEFAULT_PAGE_SIZE));
        const where = {
            user_uid: vpbxUserUid,
            created_at: { [sequelize_2.Op.gte]: from, [sequelize_2.Op.lte]: to },
        };
        if (query.queueName)
            where.queue_name = query.queueName;
        if (query.agentInterface)
            where.agent_interface = query.agentInterface;
        const { rows: calls, count } = await this.queueCallModel.findAndCountAll({
            where,
            order: [['created_at', 'DESC']],
            limit: pageSize,
            offset: (page - 1) * pageSize,
        });
        const columns = [
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
        const rows = calls.map((c) => ({
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
            holdTime: c.hold_time ?? 0,
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
    async getOperatorStats(vpbxUserUid, query) {
        const { from, to } = this.parseAndClampPeriod(query.dateFrom, query.dateTo);
        const source = this.rollupService.resolveAggregationSource(from, to);
        const columns = [
            { key: 'agentInterface', header: 'Agent' },
            { key: 'agentUserUid', header: 'User ID' },
            { key: 'callsHandled', header: 'Calls' },
            { key: 'totalTalkSec', header: 'Talk (sec)' },
            { key: 'totalHoldSec', header: 'Hold (sec)' },
            { key: 'totalWrapupSec', header: 'Wrap-up (sec)' },
            { key: 'avgHandleSec', header: 'Avg handle (sec)' },
            { key: 'ahtSec', header: 'AHT (sec)' },
            { key: 'loggedInSec', header: 'Logged in (sec)' },
            { key: 'totalPauseSec', header: 'Pause (sec)' },
            { key: 'totalIdleSec', header: 'Idle/Ready (sec)' },
        ];
        const sessionTimeByAgent = await this.aggregateSessionTime(vpbxUserUid, from, to, query.agentInterface);
        if (source === 'rollup') {
            const where = {
                user_uid: vpbxUserUid,
                stat_date: { [sequelize_2.Op.gte]: toDateOnly(from), [sequelize_2.Op.lte]: toDateOnly(to) },
            };
            if (query.agentInterface)
                where.agent_interface = query.agentInterface;
            const rows = await this.dailyAgentModel.findAll({ where });
            const byAgent = new Map();
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
                if (r.agent_user_uid != null)
                    agg.agentUserUid = r.agent_user_uid;
            }
            const result = [];
            for (const [agentInterface, a] of byAgent) {
                const handle = a.talk + a.hold + a.wrapup;
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
        const where = {
            user_uid: vpbxUserUid,
            created_at: { [sequelize_2.Op.gte]: from, [sequelize_2.Op.lte]: to },
            disposition: 'answered',
        };
        if (query.queueName)
            where.queue_name = query.queueName;
        if (query.agentInterface)
            where.agent_interface = query.agentInterface;
        const calls = await this.queueCallModel.findAll({ where });
        const byAgent = new Map();
        for (const c of calls) {
            const iface = (c.agent_interface || '').trim();
            if (!iface)
                continue;
            let agg = byAgent.get(iface);
            if (!agg) {
                agg = { agentUserUid: c.agent_user_uid ?? null, calls: 0, talk: 0, hold: 0, wrapup: 0 };
                byAgent.set(iface, agg);
            }
            agg.calls += 1;
            agg.talk += c.talk_time ?? 0;
            agg.hold += c.hold_time ?? 0;
            agg.wrapup += c.wrapup_time ?? 0;
            if (c.agent_user_uid != null)
                agg.agentUserUid = c.agent_user_uid;
        }
        for (const [iface, sess] of sessionTimeByAgent) {
            if (!byAgent.has(iface)) {
                byAgent.set(iface, { agentUserUid: sess.userId, calls: 0, talk: 0, hold: 0, wrapup: 0 });
            }
        }
        const result = [];
        for (const [agentInterface, a] of byAgent) {
            const handle = a.talk + a.hold + a.wrapup;
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
    /** Aggregate shift / pause / idle seconds from cc_agent_sessions overlapping [from, to]. */
    async aggregateSessionTime(vpbxUserUid, from, to, agentInterface) {
        const where = {
            user_uid: vpbxUserUid,
            login_time: { [sequelize_2.Op.lte]: to },
            [sequelize_2.Op.or]: [
                { logout_time: null },
                { logout_time: { [sequelize_2.Op.gte]: from } },
            ],
        };
        if (agentInterface)
            where.agent_interface = agentInterface;
        const sessions = await this.sessionModel.findAll({ where });
        const map = new Map();
        const now = Date.now();
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
            agg.totalPauseSec += s.total_pause_time ?? 0;
            agg.totalIdleSec += s.total_idle_time ?? 0;
            if (s.user_id != null)
                agg.userId = s.user_id;
        }
        return map;
    }
    async getPauseReport(vpbxUserUid, query) {
        const { from, to } = this.parseAndClampPeriod(query.dateFrom, query.dateTo);
        const sessionWhere = { user_uid: vpbxUserUid };
        if (query.agentInterface)
            sessionWhere.agent_interface = query.agentInterface;
        const sessions = await this.sessionModel.findAll({
            where: sessionWhere,
            attributes: ['uid', 'agent_interface', 'user_id'],
        });
        const sessionMap = new Map(sessions.map((s) => [s.uid, s]));
        const sessionIds = sessions.map((s) => s.uid);
        const pauseColumns = [
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
                session_id: { [sequelize_2.Op.in]: sessionIds },
                created_at: { [sequelize_2.Op.gte]: from, [sequelize_2.Op.lte]: to },
            },
            order: [['session_id', 'ASC'], ['created_at', 'ASC']],
        });
        const reasons = await this.pauseReasonModel.findAll({
            where: { user_uid: vpbxUserUid },
            attributes: ['name', 'is_paid'],
        });
        const paidByName = new Map(reasons.map((r) => [r.name, r.is_paid !== false]));
        const byKey = new Map();
        const now = Date.now();
        for (let i = 0; i < events.length; i++) {
            const ev = events[i];
            if (ev.event_type !== 'PAUSE')
                continue;
            const sess = sessionMap.get(ev.session_id);
            const agentInterface = sess?.agent_interface || '';
            if (query.agentInterface && agentInterface !== query.agentInterface)
                continue;
            let durationSec = ev.duration ?? 0;
            if (durationSec <= 0) {
                const next = events.slice(i + 1).find((e) => e.session_id === ev.session_id);
                const start = ev.created_at ? new Date(ev.created_at).getTime() : now;
                const end = next?.created_at
                    ? new Date(next.created_at).getTime()
                    : Math.min(now, to.getTime());
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
        const rows = [...byKey.values()].map((a) => ({
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
    async getHourlyHeatmap(vpbxUserUid, query) {
        const { from, to } = this.parseAndClampPeriod(query.dateFrom, query.dateTo);
        const where = {
            user_uid: vpbxUserUid,
            created_at: { [sequelize_2.Op.gte]: from, [sequelize_2.Op.lte]: to },
        };
        if (query.queueName)
            where.queue_name = query.queueName;
        const calls = await this.queueCallModel.findAll({
            where,
            attributes: ['created_at'],
        });
        const buckets = new Map();
        for (const c of calls) {
            const d = c.created_at ? new Date(c.created_at) : null;
            if (!d)
                continue;
            const dayOfWeek = d.getDay();
            const hour = d.getHours();
            const key = `${dayOfWeek}|${hour}`;
            buckets.set(key, (buckets.get(key) ?? 0) + 1);
        }
        const columns = [
            { key: 'dayOfWeek', header: 'Day of week' },
            { key: 'hour', header: 'Hour' },
            { key: 'callCount', header: 'Calls' },
        ];
        const rows = [];
        for (const [key, callCount] of buckets) {
            const [dow, hour] = key.split('|').map(Number);
            rows.push({ dayOfWeek: dow, hour, callCount });
        }
        rows.sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.hour - b.hour);
        return { reportId: 'hourly-heatmap', columns, rows, source: 'raw' };
    }
    async getAgentTimeline(vpbxUserUid, query) {
        const { from, to } = this.parseAndClampPeriod(query.dateFrom, query.dateTo);
        if (!query.agentInterface) {
            throw new common_1.BadRequestException('agentInterface is required for agent-timeline');
        }
        const sessions = await this.sessionModel.findAll({
            where: {
                user_uid: vpbxUserUid,
                agent_interface: query.agentInterface,
                login_time: { [sequelize_2.Op.lte]: to },
                [sequelize_2.Op.or]: [
                    { logout_time: null },
                    { logout_time: { [sequelize_2.Op.gte]: from } },
                ],
            },
            attributes: ['uid'],
        });
        const sessionIds = sessions.map((s) => s.uid);
        let events = [];
        if (sessionIds.length > 0) {
            events = await this.agentEventModel.findAll({
                where: {
                    user_uid: vpbxUserUid,
                    session_id: { [sequelize_2.Op.in]: sessionIds },
                    created_at: { [sequelize_2.Op.gte]: from, [sequelize_2.Op.lte]: to },
                },
                order: [['created_at', 'ASC']],
            });
        }
        const segments = this.buildAgentTimelineSegments(events, to);
        const columns = [
            { key: 'agentInterface', header: 'Agent' },
            { key: 'segments', header: 'Segments' },
        ];
        const rows = [
            { agentInterface: query.agentInterface, segments },
        ];
        return { reportId: 'agent-timeline', columns, rows, source: 'raw' };
    }
    async getMissedCallback(vpbxUserUid, query) {
        const { from, to } = this.parseAndClampPeriod(query.dateFrom, query.dateTo);
        const where = {
            user_uid: vpbxUserUid,
            created_at: { [sequelize_2.Op.gte]: from, [sequelize_2.Op.lte]: to },
        };
        if (query.queueName)
            where.queue_name = query.queueName;
        const missed = await this.missedCallModel.findAll({
            where,
            order: [['created_at', 'DESC']],
        });
        const columns = [
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
        const rows = missed.map((m) => ({
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
    buildAgentTimelineSegments(events, periodEnd = new Date()) {
        if (events.length === 0)
            return [];
        const segments = [];
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
    async resolveSlaThreshold(userUid, queueName) {
        const key = `${userUid}:${queueName}`;
        const cached = this.slaCache.get(key);
        if (cached !== undefined)
            return cached;
        const row = await this.queueModel.findOne({
            where: { name: queueName, user_uid: userUid },
            attributes: ['servicelevel'],
        });
        const raw = row?.servicelevel;
        const threshold = typeof raw === 'number' && raw > 0 ? raw : callcenter_metrics_service_1.DEFAULT_SLA_THRESHOLD_SEC;
        this.slaCache.set(key, threshold);
        return threshold;
    }
    parseAndClampPeriod(dateFrom, dateTo) {
        // A date-only report interval includes its entire last calendar day.
        // The stored timestamps and Sequelize connection use the DB UTC contract.
        const from = new Date(/^\d{4}-\d{2}-\d{2}$/.test(dateFrom) ? `${dateFrom}T00:00:00.000Z` : dateFrom);
        let to = new Date(/^\d{4}-\d{2}-\d{2}$/.test(dateTo) ? `${dateTo}T23:59:59.999Z` : dateTo);
        if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
            throw new common_1.BadRequestException('dateFrom and dateTo must be valid ISO dates');
        }
        if (to < from) {
            throw new common_1.BadRequestException('dateTo must be >= dateFrom');
        }
        const maxMs = MAX_PERIOD_DAYS * 24 * 60 * 60 * 1000;
        if (to.getTime() - from.getTime() > maxMs) {
            to = new Date(from.getTime() + maxMs);
            this.logger.warn(`Report period clamped to ${MAX_PERIOD_DAYS} days`);
        }
        return { from, to };
    }
    eventTypeToTimelineState(eventType) {
        switch (eventType) {
            case 'LOGIN':
            case 'READY':
            case 'CALL_END':
            case 'WRAPUP_END':
                return 'READY';
            case 'PAUSE':
                return 'PAUSED';
            case 'CALL_START':
            case 'UNHOLD':
                return 'IN_CALL';
            case 'HOLD':
                return 'HOLD';
            case 'WRAPUP_START':
                return 'WRAPUP';
            /** Phase 9 (D-09/D-13): dialing/consultation/after-call-work segments. */
            case 'DIALING':
                return 'DIALING';
            case 'CONSULT':
                return 'CONSULT';
            case 'ACW':
                return 'ACW';
            case 'LOGOUT':
                return 'OFFLINE';
            default:
                return 'OFFLINE';
        }
    }
};
exports.CallCenterReportsService = CallCenterReportsService;
exports.CallCenterReportsService = CallCenterReportsService = CallCenterReportsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, sequelize_1.InjectModel)(queue_call_model_1.CcQueueCall)),
    __param(1, (0, sequelize_1.InjectModel)(daily_queue_stats_model_1.CcDailyQueueStats)),
    __param(2, (0, sequelize_1.InjectModel)(daily_agent_stats_model_1.CcDailyAgentStats)),
    __param(3, (0, sequelize_1.InjectModel)(agent_event_model_1.CcAgentEvent)),
    __param(4, (0, sequelize_1.InjectModel)(agent_session_model_1.CcAgentSession)),
    __param(5, (0, sequelize_1.InjectModel)(missed_call_model_1.CcMissedCall)),
    __param(6, (0, sequelize_1.InjectModel)(pause_reason_model_1.CcPauseReason)),
    __param(7, (0, sequelize_1.InjectModel)(queue_model_1.Queue)),
    __metadata("design:paramtypes", [Object, Object, Object, Object, Object, Object, Object, Object, callcenter_rollup_service_1.CallCenterRollupService])
], CallCenterReportsService);
function round1(n) {
    return Math.round(n * 10) / 10;
}
function toDateOnly(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}
//# sourceMappingURL=callcenter-reports.service.js.map